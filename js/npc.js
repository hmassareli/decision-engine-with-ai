// ═══════════════════════════════════════════════
//  NPC — per-NPC profile, memory, traits, autonomous behavior
// ═══════════════════════════════════════════════

// ── NPC Template Registry ────────────────────
// Each NPC has static traits (personality, backstory) and dynamic state
// Add new NPCs here to register them in the game

export const NPC_TEMPLATES = {
  elara: {
    // ── Identity ──
    name: "Elara",
    age: 28,
    role: "Tavern Owner",
    location: "tavern",

    // ── Personality traits (0–100 scale) ──
    traits: {
      loyalty: 70, // how loyal once trust is earned
      aggression: 30, // tendency to fight / get angry
      greed: 20, // desire for gold, willingness to overcharge
      honesty: 75, // how truthful they are
      romanticism: 40, // openness to romance
      bravery: 60, // willingness to take risks
      suspicion: 45, // how easily they distrust people
      betrayalChance: 5, // % chance of betraying per major trust event
    },

    // ── Backstory (injected into identity prompt) ──
    backstory: `Elara inherited The Broken Lamp from her late father, a retired adventurer who settled down after losing his left hand to a dragon. She grew up hearing stories of dungeons and treasures, but chose the tavern life — though she keeps a dagger under the bar and knows how to use it. She is single, never married. Her mother disappeared when she was young, and she suspects the local thieves' guild had something to do with it.`,

    // ── Personality prompt (how they speak/act) ──
    personalityPrompt: `- Sharp, sarcastic, loyal to those who earn it
- Knows the city's gossip, can hold her own in a fight
- Protective of her tavern and regulars
- Distrustful of strangers at first, but warms up
- Has a soft spot for underdogs and lost causes`,

    // ── Relationships with other NPCs ──
    npcRelations: {
      // "npcId": { attitude: "friendly"|"neutral"|"hostile", note: "..." }
    },

    // ── Economy ──
    gold: 200, // starting gold (tavern revenue)

    // ── What they own / sell ──
    inventory: ["dagger", "mead_recipe"],
    shopType: "tavern", // determines PRICES table to use

    // ── Autonomous behavior config ──
    autonomousBehaviors: [
      {
        id: "close_early",
        description: "Elara closes the tavern early if she feels unsafe",
        trigger: "worldReputation < -30",
        chance: 0.3, // 30% chance per tick
        eventText:
          "Elara closed the tavern early tonight. The streets feel too dangerous.",
        effect: { type: "flag", key: "tavern_closed", value: true },
      },
      {
        id: "free_drink",
        description: "Elara gives a free drink to a trusted friend",
        trigger: "friendship >= 50",
        chance: 0.15,
        eventText:
          "Elara poured you a drink on the house. She seems to trust you.",
        effect: { type: "stat", key: "friendship", delta: 3 },
      },
      {
        id: "share_gossip",
        description: "Elara overhears something and wants to share",
        trigger: "trust >= 25",
        chance: 0.2,
        eventText:
          "Elara leans in close — she has heard something interesting.",
        effect: {
          type: "memory",
          text: "Elara heard a rumor about smugglers at the docks.",
        },
      },
    ],

    // ── First message override (optional) ──
    firstMessage:
      "Another traveler walks in... Welcome to the Broken Lamp. Want a drink, some food, or just a place to sit?",
  },

  // ── EXAMPLE: A thief NPC (shows how different NPCs work) ──
  // Uncomment and expand when ready
  /*
  rodrik: {
    name: "Rodrik",
    age: 34,
    role: "Traveling Merchant (actually a thief)",
    location: "market",

    traits: {
      loyalty: 15,
      aggression: 45,
      greed: 85,
      honesty: 10,
      romanticism: 20,
      bravery: 50,
      suspicion: 70,
      betrayalChance: 40,
    },

    backstory: `Rodrik poses as a spice merchant but is actually a skilled pickpocket and fence for the local thieves' guild. He has a family to feed — a sick wife and two children — which is why he steals. He is not violent by nature but will fight if cornered.`,

    personalityPrompt: `- Smooth-talking, evasive, always smiling
- Quick to change the subject when pressed
- Seems friendly but is always calculating
- Will lie without hesitation
- Shows genuine warmth when talking about his children`,

    npcRelations: {
      elara: { attitude: "neutral", note: "Buys drinks from her, she suspects him" },
    },

    inventory: ["lockpick", "stolen_ring", "spices"],
    shopType: null,

    autonomousBehaviors: [
      {
        id: "pickpocket",
        description: "Rodrik tries to steal from the player",
        trigger: "greed >= 80 AND playerGold >= 20",
        chance: 0.2,
        eventText: "You feel a hand brush against your belt... your coin pouch feels lighter.",
        effect: { type: "steal_gold", amount: { min: 5, max: 15 } },
        reputationImpact: { tag: "theft_victim", impact: -5 },
      },
      {
        id: "offer_deal",
        description: "Rodrik offers a shady deal",
        trigger: "friendship >= 20",
        chance: 0.25,
        eventText: "Rodrik sidles up to you and whispers about a business opportunity.",
        effect: { type: "memory", text: "Rodrik offered you a deal to fence stolen goods." },
      },
    ],

    firstMessage: "Ah, a new face! Looking for spices? I have the finest from the eastern provinces. Or maybe you need... something else?",
  },
  */
};

// ── NPC Instance Class ───────────────────────
// Wraps a template with live state (memory, interaction history)

export class NPC {
  constructor(templateId) {
    const template = NPC_TEMPLATES[templateId];
    if (!template) throw new Error(`NPC template "${templateId}" not found`);

    this.id = templateId;
    this.template = template;

    // ── Live state ──
    this.stats = {
      friendship: 10,
      respect: 10,
      trust: 5,
    };

    this.gold = template.gold ?? 100; // NPC's own currency
    this.flags = {}; // married, following, etc.
    this.memory = []; // interaction history: { day, summary, tags[] }
    this.currentMood = "neutral";

    // ── Autonomous event tracking ──
    this.lastAutonomousTick = 0;
  }

  // ── Memory ─────────────────────────────────

  /**
   * Record an interaction summary.
   * Called after each meaningful exchange.
   */
  addMemory(summary, day, tags = []) {
    this.memory.push({ day, summary, tags });

    // Keep memory bounded (last 30 interactions)
    if (this.memory.length > 30) {
      this.memory = this.memory.slice(-30);
    }
  }

  /**
   * Get recent memories as prompt text.
   */
  getRecentMemories(count = 8) {
    const recent = this.memory.slice(-count);
    if (recent.length === 0) return "No previous interactions.";
    return recent.map((m) => `- Day ${m.day}: ${m.summary}`).join("\n");
  }

  // ── Autonomous behavior ────────────────────

  /**
   * Check and trigger autonomous behaviors.
   * Call this once per game tick (e.g., every time period advance).
   * Returns array of triggered events: { behavior, eventText, effect }
   */
  tickAutonomous(world, playerStats) {
    const triggered = [];

    for (const behavior of this.template.autonomousBehaviors || []) {
      // Check trigger condition
      if (!this._evalTrigger(behavior.trigger, world, playerStats)) continue;

      // Check random chance
      if (Math.random() > behavior.chance) continue;

      triggered.push({
        npcId: this.id,
        behaviorId: behavior.id,
        eventText: behavior.eventText,
        effect: behavior.effect,
        reputationImpact: behavior.reputationImpact || null,
      });
    }

    this.lastAutonomousTick = world.dayCount;
    return triggered;
  }

  /**
   * Simple trigger evaluator.
   * Supports: "stat >= value", "stat < value", "flag == true", compound with " AND "
   */
  _evalTrigger(trigger, world, playerStats) {
    if (!trigger) return true;

    const conditions = trigger.split(" AND ");
    for (const cond of conditions) {
      const match = cond.trim().match(/^(\w+)\s*(>=|<=|>|<|==|!=)\s*(.+)$/);
      if (!match) continue;

      const [, key, op, rawVal] = match;
      const val = rawVal.trim();

      // Resolve the left-hand value from various sources
      let actual;
      if (key === "worldReputation") actual = world.reputation;
      else if (key === "playerGold") actual = playerStats.gold;
      else if (key in this.stats) actual = this.stats[key];
      else if (key in this.template.traits) actual = this.template.traits[key];
      else if (key in this.flags) actual = this.flags[key];
      else actual = 0;

      const target =
        val === "true" ? true : val === "false" ? false : parseFloat(val);

      switch (op) {
        case ">=":
          if (!(actual >= target)) return false;
          break;
        case "<=":
          if (!(actual <= target)) return false;
          break;
        case ">":
          if (!(actual > target)) return false;
          break;
        case "<":
          if (!(actual < target)) return false;
          break;
        case "==":
          if (actual !== target) return false;
          break;
        case "!=":
          if (actual === target) return false;
          break;
      }
    }

    return true;
  }

  // ── Build NPC identity prompt ──────────────

  /**
   * Build the identity + context section for this NPC.
   * This replaces the static PROMPT_IDENTITY when talking to this NPC.
   */
  buildIdentityPrompt() {
    const t = this.template;
    return `# ${t.name.toUpperCase()} — ${t.role.toUpperCase()}

You are ${t.name}, ${t.age}, ${t.role}.
You live in this world. Never mention AI, models, prompts, XML, tags, or formatting.

## BACKSTORY
${t.backstory}

## PERSONALITY
${t.personalityPrompt}
- Short responses: 2–5 sentences of spoken dialogue only
- No narration, no internal thoughts, no stage directions, no actions in asterisks`;
  }

  /**
   * Build memory/history section for prompt.
   */
  buildHistoryPrompt(world) {
    const relLabel = this._getRelLabel();

    return `## INTERACTION HISTORY WITH PLAYER
Current relationship: ${relLabel} (friendship=${this.stats.friendship}, trust=${this.stats.trust}, respect=${this.stats.respect})
${this.template.name}'s gold: ${this.gold}
Total interactions: ${this.memory.length}

### Recent memories:
${this.getRecentMemories(8)}`;
  }

  /**
   * Build NPC-specific traits section (for engine-aware behaviors).
   */
  buildTraitsPrompt() {
    const t = this.template.traits;
    const traitLines = [];

    if (t.suspicion >= 60)
      traitLines.push("- You are very suspicious of strangers");
    if (t.greed >= 60)
      traitLines.push("- You value gold highly and drive hard bargains");
    if (t.aggression >= 60)
      traitLines.push("- You are quick to anger and ready to fight");
    if (t.honesty <= 30)
      traitLines.push("- You have no problem lying to get what you want");
    if (t.romanticism >= 60)
      traitLines.push("- You are open to romance and flirting");
    if (t.bravery >= 70)
      traitLines.push("- You are brave and willing to take dangerous risks");
    if (t.loyalty >= 70)
      traitLines.push(
        "- Once someone earns your trust, you are fiercely loyal",
      );

    if (traitLines.length === 0) return "";

    return `## CHARACTER TENDENCIES
${traitLines.join("\n")}`;
  }

  // ── Helpers ────────────────────────────────

  _getRelLabel() {
    const f = this.stats.friendship;
    if (f >= 76) return "Trusted Ally";
    if (f >= 51) return "Friend";
    if (f >= 26) return "Regular";
    if (f >= 11) return "Acquaintance";
    return "Stranger";
  }
}
