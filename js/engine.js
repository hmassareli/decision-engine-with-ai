// ═══════════════════════════════════════════════
//  GAME ENGINE — stat tracking, evaluation, effects
// ═══════════════════════════════════════════════

import {
  ACTION_DEFS,
  CONVERSATION_MILESTONES,
  EFFECTS,
  MOOD_EFFECTS,
  PRICES,
  RELATIONSHIP_TIERS,
  SERIOUSNESS_THRESHOLDS,
} from "./config.js";

export class GameEngine {
  /**
   * @param {import('./npc.js').NPC} [npc] — active NPC instance (optional for backward compat)
   * @param {import('./world.js').WorldState} [world] — world state (optional)
   */
  constructor(npc = null, world = null) {
    this.npc = npc;
    this.world = world;

    // Use NPC stats if available, otherwise defaults
    this.stats = npc
      ? { ...npc.stats, gold: 50, health: 100 }
      : { friendship: 10, respect: 10, trust: 5, gold: 50, health: 100 };

    this.inventory = [];
    this.flags = npc ? { ...npc.flags } : {};
    this.log = []; // full decision log
    this.textExchanges = 0; // count of text-only exchanges (for milestones)
    this._listeners = []; // onChange callbacks
  }

  // ── Observable ─────────────────────────────

  onChange(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((f) => f !== fn);
    };
  }

  _notify() {
    for (const fn of this._listeners) fn(this);
  }

  // ── Getters ────────────────────────────────

  getRelationship() {
    const f = this.stats.friendship;
    // Walk tiers from top to bottom
    for (let i = RELATIONSHIP_TIERS.length - 1; i >= 0; i--) {
      if (f >= RELATIONSHIP_TIERS[i].min) return RELATIONSHIP_TIERS[i];
    }
    return RELATIONSHIP_TIERS[0];
  }

  getCost(action, target) {
    return PRICES[action]?.[target] ?? 0;
  }

  // ── Core evaluation ────────────────────────

  /**
   * Evaluate a request object { action, target, seriousness, context }.
   * Returns { decision, reason, roll, score, threshold, breakdown }
   */
  evaluate(request) {
    const { action, target } = request;
    const seriousness = Math.min(
      10,
      Math.max(0, parseInt(request.seriousness) || 0),
    );

    // Look up action definition (fallback to generic)
    const def = ACTION_DEFS[action] || this._genericDef(seriousness);

    // ── 1. Meta actions auto-pass ──
    if (def.category === "meta") {
      return this._result("ALLOWED", "Meta action — auto-approved.", 0, 100, 0);
    }

    // ── 2. Validate target exists for commerce/item actions ──
    if (def.costType === "gold" && target) {
      const priceTable = PRICES[action];
      if (priceTable && !(target in priceTable)) {
        const available = Object.keys(priceTable).join(", ");
        return this._result(
          "DENIED",
          `Item "${target}" is not available. Available options: ${available}.`,
          0,
          0,
          0,
        );
      }
    }

    // ── 3. Gold check ──
    const paidBy = request.paidBy || "player";
    if (def.costType === "gold") {
      const cost = this.getCost(action, target);
      if (cost > 0) {
        if (paidBy === "npc") {
          // NPC is paying — check NPC's gold
          const npcGold = this.npc?.gold ?? 0;
          if (npcGold < cost) {
            return this._result(
              "DENIED",
              `${this.npc?.template?.name || "NPC"} can't afford it. Needs ${cost}, has ${npcGold}.`,
              0,
              0,
              cost,
            );
          }
        } else {
          // Player is paying — check player's gold
          if (this.stats.gold < cost) {
            return this._result(
              "DENIED",
              `Not enough gold. Needs ${cost}, has ${this.stats.gold}.`,
              0,
              0,
              cost,
            );
          }
        }
      }
    }

    // ── 3. Commerce auto-pass (only need gold, already checked above) ──
    if (def.category === "commerce") {
      return this._result("ALLOWED", "Commerce — auto-approved.", 0, 100, 0);
    }

    // ── 4. Hard requirements ──
    for (const [stat, minVal] of Object.entries(def.hardReqs || {})) {
      if ((this.stats[stat] ?? 0) < minVal) {
        return this._result(
          "DENIED",
          `Hard requirement failed: ${stat} is ${this.stats[stat]}, needs ${minVal}.`,
          0,
          this.stats[stat],
          minVal,
        );
      }
    }

    // ── 4. Weighted score ──
    const { score, breakdown } = this._calcScore(def);

    // ── 5. Random factor ──
    // Roll a value between -maxSwing..+maxSwing  (uniform distribution)
    const maxSwing = def.randomness * 50; // randomness=0.3 → ±15 points
    const roll = (Math.random() * 2 - 1) * maxSwing;
    const finalScore = score + roll;

    // ── 6. Threshold from seriousness ──
    const threshold = SERIOUSNESS_THRESHOLDS[seriousness] ?? 50;

    // ── 7. Decision ──
    // Clear pass / fail with a CONDITIONAL band of ±8 around the threshold
    const band = 8;
    let decision;
    if (finalScore >= threshold + band) {
      decision = "ALLOWED";
    } else if (finalScore <= threshold - band) {
      decision = "DENIED";
    } else {
      decision = "CONDITIONAL";
    }

    const reason = this._buildReason(
      decision,
      score,
      roll,
      finalScore,
      threshold,
      breakdown,
      seriousness,
    );

    return {
      decision,
      reason,
      score: Math.round(score),
      roll: Math.round(roll * 10) / 10,
      finalScore: Math.round(finalScore * 10) / 10,
      threshold,
      breakdown,
    };
  }

  // ── Apply effects ──────────────────────────

  /**
   * Apply stat changes and flags after a decision.
   * Returns { stat: delta } map for the UI.
   */
  applyEffects(request, decision) {
    const { action, target } = request;
    const effectDef = EFFECTS[action] || {};
    const decisionKey = decision.toLowerCase();
    const deltas = { ...(effectDef[decisionKey] || {}) };

    // Deduct gold for allowed purchases (only if player pays)
    if (decision === "ALLOWED" && ACTION_DEFS[action]?.costType === "gold") {
      const paidBy = request.paidBy || "player";
      const cost = this.getCost(action, target);
      if (cost > 0) {
        if (paidBy === "player") {
          this.stats.gold -= cost;
          deltas.gold = -cost;
        } else if (paidBy === "npc" && this.npc) {
          // Deduct from NPC's gold
          this.npc.gold -= cost;
          deltas.npcGold = -cost;
        }
      }
    }

    // Add items to inventory
    if (decision === "ALLOWED" && action === "give_item" && target) {
      this.inventory.push(target);
    }

    // Set game flags for commitment / movement actions
    if (decision === "ALLOWED") {
      switch (action) {
        case "follow_player":
          this.flags.following = true;
          this.flags.followTarget = target;
          break;
        case "become_apprentice":
          this.flags.apprentice = true;
          break;
        case "move_in":
          this.flags.livingTogether = true;
          break;
        case "marry":
          this.flags.married = true;
          break;
        case "join_war":
          this.flags.atWar = true;
          this.flags.warFaction = target;
          break;
      }
    }

    // Apply stat deltas (except gold — already handled)
    for (const [stat, delta] of Object.entries(deltas)) {
      if (stat === "gold") continue;
      if (this.stats[stat] !== undefined) {
        this.stats[stat] = this._clamp(this.stats[stat] + delta, 0, 100);
      }
    }

    // Log
    this.log.push({
      time: new Date(),
      action,
      target,
      decision,
      deltas,
      stats: { ...this.stats },
      flags: { ...this.flags },
    });

    // Sync to NPC and record memory
    this._syncToNpc();
    this.recordMemory(action, target, decision);

    this._notify();
    return deltas;
  }

  // ── Sync NPC stats ─────────────────────────

  /**
   * Push engine relationship stats back to the NPC instance.
   */
  _syncToNpc() {
    if (!this.npc) return;
    this.npc.stats.friendship = this.stats.friendship;
    this.npc.stats.respect = this.stats.respect;
    this.npc.stats.trust = this.stats.trust;
    this.npc.flags = { ...this.flags };
    // gold is tracked directly on npc.gold, no sync needed
  }

  /**
   * Record an interaction in NPC memory.
   */
  recordMemory(action, target, decision) {
    if (!this.npc || !this.world) return;
    const summary = `${action} → ${target} → ${decision}`;
    this.npc.addMemory(summary, this.world.dayCount, [
      action,
      decision.toLowerCase(),
    ]);
  }

  /**
   * Add a world reputation event (e.g., player did something visible).
   */
  addWorldEvent(text, impact, tag = null) {
    if (!this.world) return;
    this.world.addReputationEvent(text, impact, tag);
  }

  /**
   * Tick autonomous NPC behaviors.
   * Returns array of triggered events for the UI to display.
   */
  tickAutonomous() {
    if (!this.npc || !this.world) return [];

    const events = this.npc.tickAutonomous(this.world, this.stats);

    for (const event of events) {
      // Apply effects
      if (event.effect) {
        switch (event.effect.type) {
          case "stat":
            if (this.stats[event.effect.key] !== undefined) {
              this.stats[event.effect.key] = this._clamp(
                this.stats[event.effect.key] + event.effect.delta,
                0,
                100,
              );
            }
            break;
          case "flag":
            this.flags[event.effect.key] = event.effect.value;
            break;
          case "steal_gold": {
            const amt = event.effect.amount;
            const stolen = Math.min(
              this.stats.gold,
              Math.floor(Math.random() * (amt.max - amt.min + 1)) + amt.min,
            );
            this.stats.gold -= stolen;
            event.stolenAmount = stolen;
            break;
          }
          case "memory":
            this.npc.addMemory(event.effect.text, this.world.dayCount, [
              event.behaviorId,
            ]);
            break;
        }
      }

      // Apply reputation impact if any
      if (event.reputationImpact) {
        this.world.addReputationEvent(
          event.eventText,
          event.reputationImpact.impact,
          event.reputationImpact.tag,
        );
      }
    }

    this._syncToNpc();
    this._notify();
    return events;
  }

  // ── Passive conversation effects ───────────

  /**
   * Apply passive stat changes from a text-only exchange.
   * Uses mood (from LLM) + milestone bonuses every N exchanges.
   * Returns { stat: delta } map for the UI.
   */
  applyPassiveEffects(mood = "neutral") {
    this.textExchanges++;
    const deltas = {};

    // 1. Mood-based effects
    const moodDeltas = MOOD_EFFECTS[mood] || MOOD_EFFECTS.neutral;
    for (const [stat, delta] of Object.entries(moodDeltas)) {
      deltas[stat] = (deltas[stat] || 0) + delta;
    }

    // 2. Milestone bonuses
    const { interval, bonuses } = CONVERSATION_MILESTONES;
    if (this.textExchanges % interval === 0) {
      for (const [stat, delta] of Object.entries(bonuses)) {
        deltas[stat] = (deltas[stat] || 0) + delta;
      }
    }

    // Apply stat deltas
    for (const [stat, delta] of Object.entries(deltas)) {
      if (this.stats[stat] !== undefined) {
        this.stats[stat] = this._clamp(this.stats[stat] + delta, 0, 100);
      }
    }

    // Log
    this.log.push({
      time: new Date(),
      action: "conversation",
      target: mood,
      decision: "PASSIVE",
      deltas,
      stats: { ...this.stats },
      flags: { ...this.flags },
      textExchanges: this.textExchanges,
    });

    this._syncToNpc();
    this._notify();
    return deltas;
  }

  // ── Internal helpers ───────────────────────

  _calcScore(def) {
    const breakdown = {};
    let score = 0;
    for (const [stat, weight] of Object.entries(def.stats || {})) {
      const val = this.stats[stat] ?? 0;
      const contribution = val * weight;
      breakdown[stat] = {
        value: val,
        weight,
        contribution: Math.round(contribution * 10) / 10,
      };
      score += contribution;
    }
    return { score, breakdown };
  }

  _genericDef(seriousness) {
    // Fallback for unknown actions
    return {
      category: "unknown",
      stats: { friendship: 0.3, trust: 0.3, respect: 0.2 },
      hardReqs: {},
      randomness: seriousness >= 7 ? 0.3 : 0.15,
    };
  }

  _buildReason(
    decision,
    score,
    roll,
    finalScore,
    threshold,
    breakdown,
    seriousness,
  ) {
    const statsUsed = Object.entries(breakdown)
      .map(([s, b]) => `${s}=${b.value}(×${b.weight}→${b.contribution})`)
      .join(", ");

    const rollStr = roll >= 0 ? `+${roll.toFixed(1)}` : roll.toFixed(1);

    return (
      `${decision}. ` +
      `Score: ${score.toFixed(1)} ${rollStr} luck = ${finalScore.toFixed(1)} vs threshold ${threshold} (seriousness ${seriousness}). ` +
      `Stats: ${statsUsed || "none"}.`
    );
  }

  _result(decision, reason, roll, score, threshold) {
    return {
      decision,
      reason,
      roll,
      score,
      finalScore: score,
      threshold,
      breakdown: {},
    };
  }

  _clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }
}
