// ═══════════════════════════════════════════════
//  WORLD — global state, locations, events, reputation
// ═══════════════════════════════════════════════

// ── Reputation deed categories ───────────────
// Each category tracks a count + total impact
// NPCs use these to judge the player's character
export const DEED_CATEGORIES = {
  // ── Violent / criminal ──
  killed:      { label: "Killed",      icon: "💀", type: "negative" },
  harassed:    { label: "Harassed",    icon: "😡", type: "negative" },
  stolen:      { label: "Stolen",      icon: "🗝️", type: "negative" },
  vandalized:  { label: "Vandalized",  icon: "🔨", type: "negative" },
  threatened:  { label: "Threatened",  icon: "⚔️", type: "negative" },
  betrayed:    { label: "Betrayed",    icon: "🗡️", type: "negative" },

  // ── Good deeds ──
  helped:      { label: "Helped",      icon: "🤝", type: "positive" },
  donated:     { label: "Donated",     icon: "💰", type: "positive" },
  rescued:     { label: "Rescued",     icon: "🛡️", type: "positive" },
  healed:      { label: "Healed",      icon: "💚", type: "positive" },
  defended:    { label: "Defended",     icon: "🏰", type: "positive" },
  forgave:     { label: "Forgave",     icon: "🕊️", type: "positive" },

  // ── Neutral / social ──
  lied:        { label: "Lied",        icon: "🎭", type: "neutral" },
  bribed:      { label: "Bribed",      icon: "💸", type: "neutral" },
  seduced:     { label: "Seduced",     icon: "💋", type: "neutral" },
  snitched:    { label: "Snitched",    icon: "👁️", type: "neutral" },
  explored:    { label: "Explored",    icon: "🗺️", type: "neutral" },
};

// ── Location definitions ─────────────────────
export const LOCATIONS = {
  tavern: {
    name: "The Broken Lamp Tavern",
    description: "A dimly-lit tavern with creaky wooden floors, a long oak bar, and the smell of mead and roasted meat. Candles flicker on every table. A bard plays softly in the corner.",
    npcsPresent: ["elara"],
  },
  market: {
    name: "The Market Square",
    description: "A bustling open-air market with merchants shouting prices. Stalls sell everything from fresh bread to questionable potions.",
    npcsPresent: [],
  },
  port: {
    name: "The Docks",
    description: "Salt air and the creak of ships. Sailors unload cargo while shady figures linger in the shadows between warehouses.",
    npcsPresent: [],
  },
  castle: {
    name: "Stonekeep Castle",
    description: "The imposing castle overlooks the city. Guards patrol the gates. Only those with business or status may enter.",
    npcsPresent: [],
  },
  forest: {
    name: "The Whispering Woods",
    description: "Dense trees block the sunlight. Strange sounds echo between the trunks. Locals avoid it after dark.",
    npcsPresent: [],
  },
  mines: {
    name: "The Old Mines",
    description: "Abandoned iron mines carved into the hillside. Some say creatures have moved in since the miners left.",
    npcsPresent: [],
  },
};

// ── Time of day ──────────────────────────────
const TIME_PERIODS = ["dawn", "morning", "afternoon", "evening", "night"];

// ── Mock rumors (PROVISIONAL — replace with dynamic generation later) ──
// Each key matches a share_rumor target. Array of possible rumors per topic.
// The engine picks one at random when the action is ALLOWED.
const MOCK_RUMORS = {
  king: [
    "They say the king hasn't left his chambers in weeks. Some think he's ill, others say he's afraid.",
    "A messenger from the king was seen arguing with the harbor master last night. Nobody knows why.",
    "The king doubled the guard patrol near the castle. Something's got him spooked.",
  ],
  guards: [
    "Two guards were found asleep on duty near the east gate. Captain Voss was furious.",
    "The new guard recruits are green — half of them can't even hold a sword straight.",
    "I heard a guard got caught taking bribes from the smugglers. He disappeared the next day.",
  ],
  smuggling: [
    "Ships have been coming in at odd hours. The dock workers pretend not to notice.",
    "Someone's been moving crates through the old mine tunnels. Nobody knows what's inside.",
    "A merchant got caught with unmarked goods last week. Paid a 'fine' and walked free. Funny how that works.",
  ],
  merchants: [
    "The spice merchant raised prices again. Says the trade routes aren't safe anymore.",
    "Old Garret's shop closed suddenly. Some say debts, others say he saw something he shouldn't have.",
    "A new merchant arrived from the east. Sells strange potions — nobody's brave enough to try them yet.",
  ],
  dungeon: [
    "They sealed the lower levels of the dungeon years ago. Sometimes you can hear sounds coming from below.",
    "An adventurer went into the dungeon last month. Came back with grey hair and wouldn't talk about it.",
    "The dungeon entrance is past the old mines. Guards stopped patrolling there — too many didn't come back.",
  ],
};

// Fallback for targets not in the map
const GENERIC_RUMORS = [
  "People have been on edge lately. Something feels off in the city.",
  "I've heard whispers, but nothing I can confirm. You know how people talk.",
  "There's always gossip flying around, but half of it's made up. Hard to know what's real.",
];

// ── World State ──────────────────────────────
export class WorldState {
  constructor() {
    this.currentLocation = "tavern";
    this.dayCount = 1;
    this.timeIndex = 3; // start at evening
    this.reputation = 0; // -100 (villain) to +100 (hero)

    // Event log — things that happened in the world
    // { day, time, text, impact, category, tags[] }
    this.events = [];

    // Deed tracker — structured record of what the player has done
    // { category: { count, totalImpact, details[] } }
    this.deeds = {};

    // Legacy free-form tags (still supported for custom events)
    this.reputationTags = {};

    this._listeners = [];
  }

  // ── Observable ─────────────────────────────
  onChange(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(f => f !== fn); };
  }

  _notify() {
    for (const fn of this._listeners) fn(this);
  }

  // ── Time ───────────────────────────────────

  get timePeriod() {
    return TIME_PERIODS[this.timeIndex];
  }

  advanceTime() {
    this.timeIndex++;
    if (this.timeIndex >= TIME_PERIODS.length) {
      this.timeIndex = 0;
      this.dayCount++;
    }
    this._notify();
  }

  // ── Location ───────────────────────────────

  get location() {
    return LOCATIONS[this.currentLocation];
  }

  moveTo(locationId) {
    if (!LOCATIONS[locationId]) return false;
    this.currentLocation = locationId;
    this.advanceTime(); // moving takes time
    this._notify();
    return true;
  }

  // ── Reputation ─────────────────────────────

  /**
   * Get a rumor for a given topic. Picks a random one from MOCK_RUMORS.
   * PROVISIONAL — will be replaced by dynamic rumor generation later.
   * @param {string} target — rumor topic (king, guards, smuggling, etc.)
   * @returns {string} — the rumor text
   */
  getRumor(target) {
    const pool = MOCK_RUMORS[target] || GENERIC_RUMORS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Record a categorized deed the player did.
   * @param {string} category — key from DEED_CATEGORIES (e.g., "killed", "helped")
   * @param {string} detail — short description (e.g., "killed a stray dog")
   * @param {number} impact — reputation points (negative = bad, positive = good)
   */
  addDeed(category, detail, impact) {
    // Validate category
    if (!DEED_CATEGORIES[category]) {
      console.warn(`Unknown deed category: "${category}". Using as free tag.`);
      return this.addReputationEvent(detail, impact, category);
    }

    // Update reputation score
    this.reputation = Math.max(-100, Math.min(100, this.reputation + impact));

    // Track in deeds
    if (!this.deeds[category]) {
      this.deeds[category] = { count: 0, totalImpact: 0, details: [] };
    }
    this.deeds[category].count++;
    this.deeds[category].totalImpact += impact;
    this.deeds[category].details.push({
      text: detail,
      day: this.dayCount,
      time: this.timePeriod,
      impact,
    });

    // Keep details bounded (last 10 per category)
    if (this.deeds[category].details.length > 10) {
      this.deeds[category].details = this.deeds[category].details.slice(-10);
    }

    // Also log as event
    this.events.push({
      day: this.dayCount,
      time: this.timePeriod,
      text: detail,
      impact,
      category,
      tags: [category],
    });

    this._notify();
  }

  /**
   * Add a generic reputation event (for non-categorized things).
   * @param {string} text — what happened
   * @param {number} impact — reputation delta
   * @param {string} [tag] — optional free-form tag
   */
  addReputationEvent(text, impact, tag = null) {
    this.reputation = Math.max(-100, Math.min(100, this.reputation + impact));

    if (tag) {
      this.reputationTags[tag] = (this.reputationTags[tag] || 0) + impact;
    }

    this.events.push({
      day: this.dayCount,
      time: this.timePeriod,
      text,
      impact,
      category: null,
      tags: tag ? [tag] : [],
    });

    this._notify();
  }

  /**
   * Get reputation label.
   */
  getReputationLabel() {
    const r = this.reputation;
    if (r <= -50) return "Villain";
    if (r <= -20) return "Troublemaker";
    if (r <= -5)  return "Suspicious";
    if (r <= 5)   return "Unknown";
    if (r <= 20)  return "Decent";
    if (r <= 50)  return "Respected";
    return "Hero";
  }

  /**
   * Get recent events as text (for prompt injection).
   * Returns last N events as short summaries.
   */
  getRecentEvents(count = 5) {
    return this.events.slice(-count);
  }

  /**
   * Get active reputation tags as readable list.
   */
  getReputationTagsSummary() {
    const entries = Object.entries(this.reputationTags);
    if (entries.length === 0) return "none";
    return entries
      .map(([tag, val]) => {
        const label = tag.replace(/_/g, " ");
        return `${label} (${val > 0 ? "+" : ""}${val})`;
      })
      .join(", ");
  }

  /**
   * Get a structured summary of player deeds for the prompt.
   * Groups by type (positive/negative/neutral) and shows counts.
   */
  getDeedsSummary() {
    const active = Object.entries(this.deeds).filter(([, d]) => d.count > 0);
    if (active.length === 0) return "No notable deeds yet.";

    const lines = [];

    // Group by type
    const byType = { negative: [], positive: [], neutral: [] };
    for (const [cat, data] of active) {
      const def = DEED_CATEGORIES[cat];
      if (!def) continue;
      byType[def.type].push({ cat, def, data });
    }

    if (byType.negative.length > 0) {
      lines.push("CRIMES & MISDEEDS:");
      for (const { def, data } of byType.negative) {
        const latest = data.details[data.details.length - 1];
        lines.push(`  ${def.icon} ${def.label}: ${data.count} time(s) — last: "${latest.text}" (day ${latest.day})`);
      }
    }

    if (byType.positive.length > 0) {
      lines.push("GOOD DEEDS:");
      for (const { def, data } of byType.positive) {
        const latest = data.details[data.details.length - 1];
        lines.push(`  ${def.icon} ${def.label}: ${data.count} time(s) — last: "${latest.text}" (day ${latest.day})`);
      }
    }

    if (byType.neutral.length > 0) {
      lines.push("OTHER ACTIONS:");
      for (const { def, data } of byType.neutral) {
        const latest = data.details[data.details.length - 1];
        lines.push(`  ${def.icon} ${def.label}: ${data.count} time(s) — last: "${latest.text}" (day ${latest.day})`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Check if player has done a specific deed category at least N times.
   */
  hasDeed(category, minCount = 1) {
    return (this.deeds[category]?.count || 0) >= minCount;
  }

  /**
   * Get total count of a deed category.
   */
  getDeedCount(category) {
    return this.deeds[category]?.count || 0;
  }

  /**
   * Build the world context section for the prompt.
   */
  buildWorldPrompt() {
    const loc = this.location;
    const recentEvents = this.getRecentEvents(5);
    const eventsText = recentEvents.length > 0
      ? recentEvents.map(e => `- Day ${e.day}, ${e.time}: ${e.text}`).join("\n")
      : "- Nothing notable has happened yet.";

    const deedsSummary = this.getDeedsSummary();
    const freeTags = this.getReputationTagsSummary();

    return `## WORLD CONTEXT
Location: ${loc.name}
${loc.description}
Time: ${this.timePeriod}, Day ${this.dayCount}
Player reputation: ${this.getReputationLabel()} (${this.reputation})
${freeTags !== "none" ? `Other traits: ${freeTags}` : ""}

## PLAYER HISTORY
${deedsSummary}

## RECENT EVENTS IN THE CITY
${eventsText}`;
  }
}
