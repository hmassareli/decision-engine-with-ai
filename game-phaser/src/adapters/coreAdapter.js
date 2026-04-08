// Adapter between Phaser client and core simulation modules.
// Keeps scene code simple and centralizes state synchronization rules.

import { GameEngine } from "../../../core/engine.js";
import { createInWorldChatBridge } from "../../../core/llmBridge.js";
import { NPC, NPC_TEMPLATES } from "../../../core/npc.js";
import { WorldState } from "../../../core/world.js";

/**
 * @typedef {Object} PlayerIntent
 * @property {string} action
 * @property {string} [target]
 * @property {number} [seriousness]
 * @property {string} [context]
 * @property {"player"|"npc"|"system"} [source]
 * @property {"player"|"npc"} [paidBy]
 */

/**
 * @typedef {Object} EngineDecision
 * @property {"ALLOWED"|"DENIED"|"CONDITIONAL"} decision
 * @property {string} reason
 * @property {Record<string, number|string|boolean>} effects
 * @property {Object} [raw]
 */

/**
 * CoreAdapter exposes a stable interface for Phaser scenes.
 * Scene code should never mutate engine/world/npc directly.
 */
export class CoreAdapter {
  /**
   * @param {{npcId?: string, chatBridge?: (text: string, engine: GameEngine) => Promise<void>}} [options]
   */
  constructor(options = {}) {
    this.world = new WorldState();
    this.defaultNpcId = options.npcId || "elara";
    this.enginesByNpcId = new Map();
    this.activeNpcId = this.defaultNpcId;

    // Gold and health are global player state shared across NPC interactions.
    this.sharedPlayerState = { gold: 50, health: 100 };

    this.chatBridge = options.chatBridge || createInWorldChatBridge();

    this._ensureEngine(this.defaultNpcId);
  }

  _ensureEngine(requestedNpcId) {
    const npcId = NPC_TEMPLATES[requestedNpcId]
      ? requestedNpcId
      : this.defaultNpcId;

    if (!this.enginesByNpcId.has(npcId)) {
      const npc = new NPC(npcId);
      const engine = new GameEngine(npc, this.world);
      engine.stats.gold = this.sharedPlayerState.gold;
      engine.stats.health = this.sharedPlayerState.health;
      this.enginesByNpcId.set(npcId, engine);
    }

    this.activeNpcId = npcId;
    return this.enginesByNpcId.get(npcId);
  }

  _withActiveEngine(npcId) {
    const engine = this._ensureEngine(npcId || this.defaultNpcId);
    engine.stats.gold = this.sharedPlayerState.gold;
    engine.stats.health = this.sharedPlayerState.health;
    return engine;
  }

  _syncSharedPlayerState(engine) {
    this.sharedPlayerState.gold = engine.stats.gold;
    this.sharedPlayerState.health = engine.stats.health;
  }

  /**
   * Evaluate and apply an intent atomically.
   * @param {PlayerIntent} intent
   * @returns {EngineDecision}
   */
  processIntent(intent) {
    const engine = this._withActiveEngine(intent.npcId || intent.target);

    const request = {
      action: intent.action,
      target: intent.target,
      seriousness: intent.seriousness,
      context: intent.context,
      source: intent.source || "player",
      paidBy: intent.paidBy,
    };

    const evaluation = engine.evaluate(request);
    const effects = engine.applyEffects(request, evaluation.decision);
    this._syncSharedPlayerState(engine);

    return {
      decision: evaluation.decision,
      reason: evaluation.reason,
      effects,
      raw: evaluation,
    };
  }

  /**
   * Bridge for in-world dialogue with the local LLM flow.
   * Returns after chat/engine side effects are applied.
   * @param {string} text
   */
  async sendDialogue(text, options = {}) {
    if (!this.chatBridge) {
      throw new Error(
        "No chatBridge configured. Inject one in CoreAdapter options to enable in-world dialogue.",
      );
    }

    const engine = this._withActiveEngine(options.npcId);
    const chatResult = await this.chatBridge(text, engine, options);
    this._syncSharedPlayerState(engine);
    return { chat: chatResult, snapshot: this.getSnapshot() };
  }

  /**
   * Tick autonomous NPC behavior once and return generated events.
   */
  tickAutonomous() {
    const events = [];
    for (const engine of this.enginesByNpcId.values()) {
      events.push(...engine.tickAutonomous());
    }
    return events;
  }

  /**
   * Read-only snapshot for UI/HUD updates.
   */
  getSnapshot() {
    const engine = this._withActiveEngine();
    return {
      player: { ...engine.stats },
      flags: { ...engine.flags },
      inventory: [...engine.inventory],
      relationship: engine.getRelationship(),
      npc: {
        id: engine.npc.id,
        name: engine.npc.template.name,
        mood: engine.npc.currentMood,
        gold: engine.npc.gold,
        stats: { ...engine.npc.stats },
      },
      world: {
        day: this.world.dayCount,
        time: this.world.timePeriod,
        locationId: this.world.currentLocation,
        location: this.world.location,
        reputation: this.world.reputation,
        reputationLabel: this.world.getReputationLabel(),
        events: this.world.getRecentEvents(20),
      },
    };
  }

  /**
   * Move player to another world location through core world rules.
   * @param {string} locationId
   */
  moveTo(locationId) {
    const moved = this.world.moveTo(locationId);
    return { moved, snapshot: this.getSnapshot() };
  }
}
