import Phaser from "phaser";
import { CoreAdapter } from "../adapters/coreAdapter.js";
import { NpcActor } from "../entities/NpcActor.js";
import { HudOverlay } from "../ui/HudOverlay.js";

// Frame-row mapping matching Godot's character.gd convention:
// Row 0 = Down, Row 1 = Left, Row 2 = Right, Row 3 = Up
const DIR = { down: 0, left: 1, right: 2, up: 3 };
const PLAYER_COLS = 33; // main_basic.png: 1584/48 = 33 columns per row

export class WorldScene extends Phaser.Scene {
  constructor() {
    super("world");

    this.speed = 90;
    this.nearestNpc = null;
    this.isTalking = false;
    this.facing = "down";
    this.dialogueDone = false; // true when LLM response is fully received
  }

  create() {
    this.core = new CoreAdapter();

    this._createGeneratedTextures();
    this._createAnimations();
    this._createMap();
    this._createPlayer();
    this._createNpcs();
    this._createInput();

    this.hud = new HudOverlay(this);

    // Camera: pixel-art zoom, smooth lerp follow, clamped to world
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(2);
    this.cameras.main.setBounds(0, 0, 1200, 900);
    this.cameras.main.setRoundPixels(true);

    this._createDialoguePanel();
    this._log("World initialized. Core + LLM bridge ready.");
  }

  update() {
    this._updateMovement();
    this._updateNearestNpc();
    this._updatePlayerDepth();

    const snapshot = this.core.getSnapshot();
    this.hud.render(snapshot, this.nearestNpc?.label || null);
  }

  // ── Textures (fallbacks) ───────────────────

  _createGeneratedTextures() {
    const g = this.add.graphics();

    g.fillStyle(0x4e7a4a);
    g.fillRect(0, 0, 16, 16);
    g.generateTexture("tile-grass", 16, 16);

    g.clear();
    g.fillStyle(0x5a4633);
    g.fillRect(0, 0, 16, 16);
    g.generateTexture("tile-road", 16, 16);

    g.destroy();
  }

  // ── Animations ─────────────────────────────

  _createAnimations() {
    const hasPlayer = this.textures.exists("gv-player-main");

    if (hasPlayer) {
      // Player idle: single frame per direction
      for (const [dir, row] of Object.entries(DIR)) {
        this.anims.create({
          key: `player-idle-${dir}`,
          frames: [{ key: "gv-player-main", frame: row * PLAYER_COLS }],
          frameRate: 1,
        });

        // Player walk: frames 1-3 of each row (loop)
        this.anims.create({
          key: `player-walk-${dir}`,
          frames: this.anims.generateFrameNumbers("gv-player-main", {
            start: row * PLAYER_COLS + 1,
            end: row * PLAYER_COLS + 3,
          }),
          frameRate: 8,
          repeat: -1,
        });
      }
    }

    // NPC idle animations (4 cols × 6 rows — first frame of row 0 = idle down)
    const NPC_COLS = 4;
    const npcSheets = ["gv-npc-woman", "gv-npc-cat", "gv-npc-mouse"];
    for (const key of npcSheets) {
      if (!this.textures.exists(key)) continue;
      for (const [dir, row] of Object.entries(DIR)) {
        this.anims.create({
          key: `${key}-idle-${dir}`,
          frames: [{ key, frame: row * NPC_COLS }],
          frameRate: 1,
        });
      }
    }
  }

  // ── Map ────────────────────────────────────

  _createMap() {
    // Extract a single 16x16 grass tile from the spritesheet for tileSprite use.
    if (this.textures.exists("gv-grass-tiles")) {
      const frame = this.textures.getFrame("gv-grass-tiles", 0);
      const canvasTexture = this.textures.createCanvas("grass-single", 16, 16);
      canvasTexture.drawFrame("gv-grass-tiles", 0);
      canvasTexture.refresh();
    }
    const grassKey = this.textures.exists("grass-single") ? "grass-single" : "tile-grass";
    this.add.tileSprite(600, 450, 1200, 900, grassKey).setDepth(0);

    this.walls = this.physics.add.staticGroup();

    const blockers = [
      { x: 220, y: 350, w: 120, h: 24 },
      { x: 470, y: 520, w: 180, h: 24 },
      { x: 810, y: 390, w: 140, h: 24 },
      { x: 1010, y: 560, w: 120, h: 24 },
    ];

    for (const b of blockers) {
      const rect = this.add.rectangle(b.x, b.y, b.w, b.h, 0x000000, 0);
      this.physics.add.existing(rect, true);
      this.walls.add(rect);
    }
  }

  // ── Player ─────────────────────────────────

  _createPlayer() {
    const hasSpritesheet = this.textures.exists("gv-player-main");
    const tex = hasSpritesheet ? "gv-player-main" : null;

    if (tex) {
      this.player = this.physics.add.sprite(600, 450, tex, 0);
    } else {
      // Fallback: colored rectangle
      const rect = this.add.rectangle(600, 450, 16, 16, 0x8d2f2f);
      this.physics.add.existing(rect);
      this.player = rect;
    }

    this.player.setDepth(10);
    this.player.body.setCollideWorldBounds(true);

    // Hitbox smaller than sprite so character overlaps scenery slightly
    this.player.body.setSize(16, 16).setOffset(16, 24);

    this.physics.world.setBounds(0, 0, 1200, 900);
    this.physics.add.collider(this.player, this.walls);

    if (hasSpritesheet) {
      this.player.play("player-idle-down");
    }
  }

  // ── NPCs ───────────────────────────────────

  _createNpcs() {
    this.npcBodies = this.physics.add.staticGroup();
    this.npcs = [];

    const npcSeeds = [
      { id: "elara", label: "Elara", x: 360, y: 430, texture: "gv-npc-woman" },
      { id: "rodrik", label: "Rodrik", x: 700, y: 470, texture: "gv-npc-cat" },
      { id: "voss", label: "Voss", x: 950, y: 430, texture: "gv-npc-mouse" },
    ];

    for (const seed of npcSeeds) {
      const texture =
        seed.texture && this.textures.exists(seed.texture) ? seed.texture : null;
      const npc = new NpcActor(
        this,
        seed.x,
        seed.y,
        seed.label,
        seed.id,
        texture,
      );
      this.npcs.push(npc);
      this.npcBodies.add(npc);
    }

    this.physics.add.collider(this.player, this.npcBodies);
  }

  // ── Input ──────────────────────────────────

  _createInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      interact: Phaser.Input.Keyboard.KeyCodes.E,
    });

    this.input.keyboard.on("keydown-E", () => this._handleInteract());
  }

  async _handleInteract() {
    // If dialogue finished, dismiss it
    if (this.isTalking && this.dialogueDone) {
      this.isTalking = false;
      this.dialogueDone = false;
      this._setDialoguePreview("");
      return;
    }

    if (this.isTalking) return; // LLM still streaming

    if (!this.nearestNpc) {
      this._log("No NPC in interaction range.");
      return;
    }

    const result = this.core.processIntent({
      action: "invite_talk",
      target: this.nearestNpc.id,
      npcId: this.nearestNpc.id,
      seriousness: 3,
      context: `Player interacts in-world with ${this.nearestNpc.label}`,
      source: "player",
    });

    this._log(
      `${this.nearestNpc.label}: ${result.decision} (${result.reason})`,
    );

    if (result.decision === "DENIED") return;

    // Face the NPC
    this.nearestNpc.facePlayer(this.player);

    // Lock movement
    this.isTalking = true;
    this.dialogueDone = false;
    this.player.body.setVelocity(0, 0);
    this._playIdle();
    this._setDialoguePreview(`${this.nearestNpc.label} is thinking...`);

    try {
      const chatResult = await this.core.sendDialogue(
        `I approach ${this.nearestNpc.label} and start a tavern-style conversation. Reply in-world and concise.`,
        {
          npcId: this.nearestNpc.id,
          onToken: (visibleText) => {
            if (visibleText) this._setDialoguePreview(visibleText);
          },
        },
      );

      const finalText = chatResult.chat?.assistantText || "(No text returned)";
      this._setDialoguePreview(`${this.nearestNpc.label}: ${finalText}\n\n[E] Close`);
    } catch (error) {
      this._setDialoguePreview(`Dialogue error: ${error.message}\n\n[E] Close`);
    }

    // Mark done — next E press dismisses
    this.dialogueDone = true;
  }

  // ── Movement ───────────────────────────────

  _updateMovement() {
    // Block movement during dialogue
    if (this.isTalking) {
      this.player.body.setVelocity(0, 0);
      return;
    }

    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) vx = -1;
    else if (this.cursors.right.isDown || this.wasd.right.isDown) vx = 1;

    if (this.cursors.up.isDown || this.wasd.up.isDown) vy = -1;
    else if (this.cursors.down.isDown || this.wasd.down.isDown) vy = 1;

    const moving = vx !== 0 || vy !== 0;

    if (moving) {
      // Determine facing direction (prioritize vertical for diagonal)
      if (vy < 0) this.facing = "up";
      else if (vy > 0) this.facing = "down";
      else if (vx < 0) this.facing = "left";
      else if (vx > 0) this.facing = "right";

      // Normalize diagonal speed
      const len = Math.sqrt(vx * vx + vy * vy);
      vx = (vx / len) * this.speed;
      vy = (vy / len) * this.speed;

      this.player.body.setVelocity(vx, vy);
      this._playWalk();
    } else {
      this.player.body.setVelocity(0, 0);
      this._playIdle();
    }
  }

  _playWalk() {
    const key = `player-walk-${this.facing}`;
    if (this.player.anims && this.player.anims.currentAnim?.key !== key) {
      this.player.play(key, true);
    }
  }

  _playIdle() {
    const key = `player-idle-${this.facing}`;
    if (this.player.anims && this.player.anims.currentAnim?.key !== key) {
      this.player.play(key, true);
    }
  }

  // ── Y-sort depth ──────────────────────────

  _updatePlayerDepth() {
    // Simple y-sort: deeper y = higher depth
    this.player.setDepth(10 + this.player.y * 0.01);
    for (const npc of this.npcs) {
      npc.setDepth(10 + npc.y * 0.01);
    }
  }

  // ── Nearest NPC ────────────────────────────

  _updateNearestNpc() {
    let closest = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const npc of this.npcs) {
      const d = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        npc.x,
        npc.y,
      );

      if (d < bestDistance) {
        bestDistance = d;
        closest = npc;
      }
    }

    this.nearestNpc = bestDistance <= 50 ? closest : null;
  }

  // ── UI helpers ─────────────────────────────

  _log(text) {
    if (!this.eventLog) {
      this.eventLog = this.add
        .text(12, 140, "", {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#d8cab5",
          backgroundColor: "rgba(0,0,0,0.35)",
          padding: { x: 8, y: 6 },
          wordWrap: { width: 420 },
        })
        .setScrollFactor(0)
        .setDepth(1000);
      this.logLines = [];
    }

    this.logLines.unshift(text);
    this.logLines = this.logLines.slice(0, 7);
    this.eventLog.setText(this.logLines);
  }

  _createDialoguePanel() {
    this.dialoguePanel = this.add
      .text(12, 256, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#f8f2e2",
        backgroundColor: "rgba(0,0,0,0.65)",
        padding: { x: 10, y: 8 },
        wordWrap: { width: 420 },
      })
      .setScrollFactor(0)
      .setDepth(1001);
  }

  _setDialoguePreview(text) {
    if (!this.dialoguePanel) return;
    this.dialoguePanel.setText(text || "");
    this.dialoguePanel.setVisible(!!text);
  }
}
