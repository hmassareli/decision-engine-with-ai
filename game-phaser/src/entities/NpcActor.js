import Phaser from "phaser";

export class NpcActor extends Phaser.GameObjects.Container {
  constructor(scene, x, y, label, id, textureKey = null) {
    super(scene, x, y);

    this.id = id;
    this.label = label;
    this.facing = "down";
    this.textureKey = textureKey;

    if (textureKey) {
      this.sprite = scene.add.sprite(0, 0, textureKey, 0).setOrigin(0.5);
      // Play idle animation if it exists
      const idleKey = `${textureKey}-idle-down`;
      if (scene.anims.exists(idleKey)) {
        this.sprite.play(idleKey);
      }
    } else {
      this.sprite = scene.add.rectangle(0, 0, 16, 16, 0xbd8f46).setOrigin(0.5);
    }

    const nameText = scene.add
      .text(0, -28, label, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#f3e7d3",
      })
      .setOrigin(0.5, 1);

    this.add([this.sprite, nameText]);
    scene.add.existing(this);

    scene.physics.add.existing(this, true);
    this.body.setSize(18, 18);
  }

  /** Turn to face the player sprite (like Godot's character.gd) */
  facePlayer(playerSprite) {
    if (!this.textureKey) return;

    const dx = playerSprite.x - this.x;
    const dy = playerSprite.y - this.y;

    // Pick dominant axis
    if (Math.abs(dx) > Math.abs(dy)) {
      this.facing = dx > 0 ? "right" : "left";
    } else {
      this.facing = dy > 0 ? "down" : "up";
    }

    const idleKey = `${this.textureKey}-idle-${this.facing}`;
    if (this.scene.anims.exists(idleKey)) {
      this.sprite.play(idleKey);
    }
  }
}
