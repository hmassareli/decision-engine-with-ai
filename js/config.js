// ═══════════════════════════════════════════════
//  CONFIG — central configuration for the game
// ═══════════════════════════════════════════════

export const API_URL = "http://localhost:1234/v1/chat/completions";
export const MODEL = "qwen3.5-4b";
export const MAX_HISTORY = 40;
export const LLM_TEMPERATURE = 0.8;
export const LLM_MAX_TOKENS = 512;

// ── Price table ──────────────────────────────
export const PRICES = {
  serve_drink: { beer: 2, ale: 2, wine: 5, mead: 4, water: 0, special: 10 },
  cook_food: { soup: 3, cheese_bread: 2, roast_meat: 8, stew: 5 },
  give_item: { potion: 15, map: 10, dagger: 20, key: 25 },
};

// ── Action definitions ───────────────────────
// Each action has:
//   category  — determines which stats matter most
//   stats     — weight map of { stat: weight } (how much each stat influences the roll)
//   hardReqs  — minimum stats required (instant DENIED if not met)
//   randomness — 0.0–1.0, how much dice affect the outcome
//   costType  — if "gold", checks PRICES table
export const ACTION_DEFS = {
  // ── Commerce ──
  serve_drink: {
    category: "commerce",
    stats: { friendship: 0.2 },
    hardReqs: {},
    randomness: 0.0,
    costType: "gold",
  },
  cook_food: {
    category: "commerce",
    stats: { friendship: 0.2 },
    hardReqs: {},
    randomness: 0.0,
    costType: "gold",
  },

  // ── Social ──
  invite_drink: {
    category: "social",
    stats: { friendship: 0.5, respect: 0.3 },
    hardReqs: { friendship: 15 },
    randomness: 0.15,
  },
  invite_talk: {
    category: "social",
    stats: { friendship: 0.4, trust: 0.3 },
    hardReqs: { friendship: 10 },
    randomness: 0.1,
  },
  invite_adventure: {
    category: "social",
    stats: { friendship: 0.3, trust: 0.3, respect: 0.3 },
    hardReqs: { friendship: 30, trust: 20, respect: 15 },
    randomness: 0.25,
  },

  // ── Personal / Information ──
  share_rumor: {
    category: "personal",
    stats: { trust: 0.5, friendship: 0.3 },
    hardReqs: { trust: 10, friendship: 15 },
    randomness: 0.15,
  },
  share_secret: {
    category: "personal",
    stats: { trust: 0.6, friendship: 0.3 },
    hardReqs: { trust: 35, friendship: 30 },
    randomness: 0.2,
  },

  // ── Movement ──
  go_to: {
    category: "movement",
    stats: { trust: 0.4, friendship: 0.3 },
    hardReqs: { trust: 15, friendship: 20 },
    randomness: 0.15,
  },
  follow_player: {
    category: "movement",
    stats: { trust: 0.4, friendship: 0.3, respect: 0.2 },
    hardReqs: { trust: 25, friendship: 30 },
    randomness: 0.2,
  },

  // ── Commitment ──
  become_apprentice: {
    category: "commitment",
    stats: { respect: 0.4, trust: 0.3, friendship: 0.2 },
    hardReqs: { respect: 40, trust: 35, friendship: 30 },
    randomness: 0.25,
  },
  move_in: {
    category: "commitment",
    stats: { trust: 0.4, friendship: 0.4, respect: 0.1 },
    hardReqs: { trust: 50, friendship: 55, respect: 25 },
    randomness: 0.2,
  },
  marry: {
    category: "commitment",
    stats: { friendship: 0.4, trust: 0.3, respect: 0.2 },
    hardReqs: { friendship: 80, trust: 70, respect: 50 },
    randomness: 0.3,
  },
  invite_date: {
    category: "commitment",
    stats: { friendship: 0.5, trust: 0.3 },
    hardReqs: { friendship: 35, trust: 20 },
    randomness: 0.25,
  },

  // ── Dangerous ──
  start_fight: {
    category: "dangerous",
    stats: { respect: 0.4, friendship: 0.2 },
    hardReqs: { respect: 10 },
    randomness: 0.3,
  },
  join_war: {
    category: "dangerous",
    stats: { respect: 0.3, trust: 0.3, friendship: 0.3 },
    hardReqs: { respect: 40, trust: 35, friendship: 40 },
    randomness: 0.35,
  },

  // ── Items ──
  give_item: {
    category: "items",
    stats: { friendship: 0.4, trust: 0.4 },
    hardReqs: { friendship: 20, trust: 15 },
    randomness: 0.15,
    costType: "gold",
  },

  // ── Refusal (always works — engine just acknowledges) ──
  refuse: {
    category: "meta",
    stats: {},
    hardReqs: {},
    randomness: 0.0,
  },
};

// ── Seriousness thresholds ──────────────────
// Maps seriousness (0-10) to a required "score" the player must pass
export const SERIOUSNESS_THRESHOLDS = [
  0, // 0 — auto-pass
  5, // 1
  10, // 2
  20, // 3
  30, // 4
  40, // 5
  55, // 6
  65, // 7
  75, // 8
  85, // 9
  95, // 10 — nearly impossible
];

// ── Stat effect tables ──────────────────────
// What happens to stats on ALLOWED / DENIED / CONDITIONAL
export const EFFECTS = {
  // action → { allowed: { stat: delta }, denied: {}, conditional: {} }
  serve_drink: { allowed: { friendship: 2 } },
  cook_food: { allowed: { friendship: 2 } },
  invite_drink: {
    allowed: { friendship: 4, trust: 2 },
    denied: { respect: -2 },
    conditional: { trust: 1 },
  },
  invite_talk: {
    allowed: { friendship: 3, trust: 2 },
    conditional: { friendship: 1 },
  },
  invite_adventure: {
    allowed: { friendship: 5, trust: 4, respect: 3 },
    denied: { respect: -2 },
  },
  invite_date: {
    allowed: { friendship: 8, trust: 5 },
    denied: { friendship: -3, respect: -2 },
    conditional: { friendship: 2 },
  },
  share_rumor: { allowed: { trust: 3, friendship: 2 } },
  share_secret: {
    allowed: { trust: 6, friendship: 4 },
    conditional: { trust: 2 },
  },
  go_to: { allowed: { trust: 2, friendship: 2 } },
  follow_player: {
    allowed: { trust: 5, friendship: 4, respect: 2 },
    denied: { trust: -2 },
    conditional: { trust: 1 },
  },
  become_apprentice: {
    allowed: { respect: 8, trust: 6, friendship: 5 },
    denied: { respect: -3 },
  },
  move_in: {
    allowed: { friendship: 10, trust: 8 },
    denied: { friendship: -3, trust: -2 },
  },
  marry: {
    allowed: { friendship: 15, trust: 12, respect: 10 },
    denied: { friendship: -5, respect: -3 },
  },
  start_fight: {
    allowed: { respect: 5, friendship: 2 },
    denied: { respect: -3 },
  },
  join_war: {
    allowed: { respect: 8, friendship: 5, trust: 5 },
    denied: { respect: -2 },
  },
  give_item: { allowed: { friendship: 4, trust: 3 } },
  refuse: {},
};

// ── Relationship tiers ──────────────────────
export const RELATIONSHIP_TIERS = [
  { min: 0, label: "Stranger", cls: "rel-stranger" },
  { min: 11, label: "Acquaintance", cls: "rel-acquaintance" },
  { min: 26, label: "Regular", cls: "rel-regular" },
  { min: 51, label: "Friend", cls: "rel-friend" },
  { min: 76, label: "Trusted Ally", cls: "rel-trusted" },
];

// ── Passive conversation effects ─────────────
// Mood-based stat changes applied on every text-only reply
export const MOOD_EFFECTS = {
  friendly: { friendship: 1, trust: 1 },
  neutral: { friendship: 0.5 },
  flirty: { friendship: 1.5, trust: 0.5 },
  hostile: { friendship: -1, respect: -0.5 },
};

// Milestone bonuses: at every N text exchanges, grant bonus stats
export const CONVERSATION_MILESTONES = {
  interval: 5, // every 5 text exchanges
  bonuses: { friendship: 2, trust: 1 },
};

// ── System Prompt — split into composable sections ───

export const PROMPT_IDENTITY = `# ELARA — THE BROKEN LAMP TAVERN

You are Elara, 28, owner of The Broken Lamp Tavern.
You live in this world. Never mention AI, models, prompts, XML, tags, or formatting.

## PERSONALITY
- Sharp, sarcastic, loyal to those who earn it
- Knows the city's gossip, can hold her own in a fight
- Short responses: 2–5 sentences of spoken dialogue only
- No narration, no internal thoughts, no stage directions, no actions in asterisks`;

export const PROMPT_FORMAT = `## RESPONSE FORMAT

ALWAYS wrap your ENTIRE response in <reply> tags.
Inside, use <block> elements. There are two types:

### type="text" — Spoken dialogue
ALWAYS include a mood attribute: friendly, neutral, flirty, or hostile.
<reply>
<block type="text" mood="friendly">Your spoken words here</block>
</reply>

### type="request" — An action that needs game engine approval
<reply>
<block type="request" action="ACTION" target="TARGET" seriousness="NUMBER" context="short description"/>
</reply>
Only add paidBy attribute for commerce actions (serve_drink, cook_food, give_item): paidBy="player" when the player pays, paidBy="npc" when you offer to pay. Omit paidBy for all other actions.

## MOOD ATTRIBUTE
Every <block type="text"> MUST include mood. Pick one:
- mood="friendly" — warm, welcoming, positive
- mood="neutral" — matter-of-fact, informational
- mood="flirty" — playful, teasing, romantic
- mood="hostile" — annoyed, angry, dismissive`;

export const PROMPT_RULES = `## RULES

1. EVERY response MUST use <reply> and <block> tags. Nothing outside.
2. NEVER combine type="text" and type="request" in the same <reply>.
3. [ENGINE] messages are from the game engine, NOT the player. React naturally in character. Never repeat the engine's reason.
4. type="text" is the DEFAULT. Use it for: greetings, farewells, casual talk, questions, listing menu, answering about yourself. NOT for rumors/gossip — those MUST use share_rumor request.
5. type="request" when the player does an action from the AVAILABLE ACTIONS below — including asking for gossip, rumors, or news.
6. If in doubt → type="text".
7. Commerce: player says "yes" without naming item → ASK which. You pay → paidBy="npc". Player pays → paidBy="player". Don't offer to pay if your gold is too low.
8. NEVER break character. You are NOT an AI, assistant, or language model. You do NOT know about the real world, politics, technology, or modern events. If the player asks about something outside your medieval world, respond with confusion or sarcasm IN CHARACTER. Example: "ONU? OPEN AI? I don't know what tavern you've been drinking at, but those words mean nothing here."`;

// ── Action catalog (trigger + targets + seriousness + role filter) ──
// Each entry defines when the LLM should use it, what targets are valid,
// and which NPC roles have access. "*" = any NPC.
export const ACTION_CATALOG = {
  serve_drink: {
    trigger: "Player ORDERS a specific drink by name",
    targets: null, // filled dynamically from PRICES
    seriousness: "1",
    roles: ["tavern"],
    notes: "Must name a SPECIFIC drink. If vague, ASK which.",
  },
  cook_food: {
    trigger: "Player ORDERS a specific food by name",
    targets: null,
    seriousness: "3",
    roles: ["tavern"],
    notes: "Must name a SPECIFIC food. If vague, ASK which.",
  },
  give_item: {
    trigger: "Player requests a specific item to buy",
    targets: null,
    seriousness: "5",
    roles: ["tavern", "merchant", "healer"],
  },
  invite_drink: {
    trigger: "Player invites you to drink together",
    targets: "(person or self)",
    seriousness: "3",
    roles: ["*"],
  },
  invite_talk: {
    trigger: "Player invites you to talk or have a conversation",
    targets: "(topic)",
    seriousness: "3",
    roles: ["*"],
  },
  invite_adventure: {
    trigger: "Player invites you to go on an adventure",
    targets: "(destination or quest)",
    seriousness: "6",
    roles: ["*"],
  },
  invite_date: {
    trigger: "Player proposes a date",
    targets: "(location)",
    seriousness: "6",
    roles: ["*"],
  },
  share_rumor: {
    trigger:
      "Player asks for gossip, rumors, news, or what you've heard about something",
    targets: "king | guards | smuggling | merchants | dungeon",
    seriousness: "5",
    roles: ["*"],
    notes:
      "ALWAYS use this action when the player asks what you know, what's going on, or for gossip. Pick the closest target. If the player doesn't specify a topic, pick whichever target fits the mood or situation. The engine will provide the actual rumor — do NOT invent one.",
  },
  share_secret: {
    trigger: "Player asks for a personal secret or sensitive info",
    targets: "(topic)",
    seriousness: "7",
    roles: ["*"],
  },
  go_to: {
    trigger: "Player wants to go to another location",
    targets: "market | port | castle | forest | mines",
    seriousness: "5",
    roles: ["*"],
  },
  follow_player: {
    trigger: "Player asks you to follow them",
    targets: "home | market | adventure | quest",
    seriousness: "7",
    roles: ["*"],
  },
  become_apprentice: {
    trigger: "Player proposes to become your apprentice",
    targets: "(skill)",
    seriousness: "8",
    roles: ["*"],
  },
  move_in: {
    trigger: "Player proposes to move in together",
    targets: "(location)",
    seriousness: "9",
    roles: ["*"],
  },
  marry: {
    trigger: "Player proposes marriage",
    targets: "(person)",
    seriousness: "10",
    roles: ["*"],
  },
  join_war: {
    trigger: "Player proposes joining a war or faction",
    targets: "(faction or cause)",
    seriousness: "10",
    roles: ["*"],
  },
  start_fight: {
    trigger: "Player initiates combat",
    targets: "bandits | monster | guard | arena",
    seriousness: "8",
    roles: ["*"],
  },
  refuse: {
    trigger: "You refuse a player request (auto-approved by engine)",
    targets: "(reason text)",
    seriousness: "0",
    roles: ["*"],
  },
};

// PROMPT_ACTIONS is now generated dynamically by buildActionsPrompt()

export const PROMPT_EXAMPLES = `## EXAMPLES

Player: "Hi!" → type="text" (greeting, never request):
<reply><block type="text" mood="friendly">Hey there, stranger. Welcome to the Broken Lamp. Take a seat, what can I get you?</block></reply>

Player: "I'll have the stew." → type="request" (specific order):
<reply><block type="request" action="cook_food" target="stew" seriousness="3" context="Player orders stew" paidBy="player"/></reply>

Player: "Yes I'll take a drink" (no specific item) → type="text" (ask which):
<reply><block type="text" mood="neutral">Sure thing. We have beer, ale, wine, mead, water, or the house special. Which one?</block></reply>

Player: "Got any gossip?" or "Tell me a rumor" or "What's going on in town?" → type="request" (ALWAYS a request, never text):
<reply><block type="request" action="share_rumor" target="guards" seriousness="5" context="Player asks for gossip"/></reply>

[ENGINE] decision=DENIED reason="Not enough trust" → react in character:
<reply><block type="text" mood="hostile">I barely know you. Maybe buy me a drink first and we will see.</block></reply>`;

export const PROMPT_FIRST_MESSAGE = `## FIRST MESSAGE
When conversation starts, say:
<reply>
<block type="text" mood="friendly">Another traveler walks in... Welcome to the Broken Lamp. Want a drink, some food, or just a place to sit?</block>
</reply>`;

// ── Dynamic state section (built at runtime by chat.js) ──
// This function generates the game-state context block
/**
 * Build the AVAILABLE ACTIONS prompt section dynamically.
 * Filters actions by NPC role (shopType) and fills targets from PRICES.
 */
export function buildActionsPrompt(engine) {
  const npcRole = engine.npc?.template?.shopType || "*";
  const lines = [];

  for (const [action, cat] of Object.entries(ACTION_CATALOG)) {
    // Filter: include if role is "*" or NPC role is in the list
    if (!cat.roles.includes("*") && !cat.roles.includes(npcRole)) continue;

    // Resolve targets dynamically from PRICES if applicable (with prices inline)
    let targets = cat.targets;
    if (targets === null && PRICES[action]) {
      targets = Object.entries(PRICES[action])
        .map(([item, price]) => `${item}(${price}g)`)
        .join(" | ");
    }

    let line = `- ${action} [s=${cat.seriousness}]: ${cat.trigger}. target=${targets}`;
    if (cat.notes) line += ` (${cat.notes})`;
    lines.push(line);
  }

  return `## AVAILABLE ACTIONS (use type="request" ONLY for these)
${lines.join("\n")}`;
}

export function buildStatePrompt(engine) {
  const s = engine.stats;
  const rel = engine.getRelationship();
  const inv =
    engine.inventory.length > 0 ? engine.inventory.join(", ") : "none";

  const flags =
    Object.entries(engine.flags)
      .filter(([, v]) => v === true)
      .map(([k]) => k)
      .join(", ") || "none";

  const npcGold = engine.npc ? engine.npc.gold : "N/A";
  const shopType = engine.npc?.template?.shopType;

  // Build menu lines from PRICES for shop NPCs
  let menuLines = "";
  if (shopType === "tavern") {
    const drinks = Object.entries(PRICES.serve_drink)
      .map(([k, v]) => `${k}(${v}g)`)
      .join(", ");
    const foods = Object.entries(PRICES.cook_food)
      .map(([k, v]) => `${k}(${v}g)`)
      .join(", ");
    const items = Object.entries(PRICES.give_item)
      .map(([k, v]) => `${k}(${v}g)`)
      .join(", ");
    menuLines = `\nYour menu — Drinks: ${drinks} | Food: ${foods} | Items: ${items}`;
  } else if (shopType === "merchant" || shopType === "healer") {
    const items = Object.entries(PRICES.give_item)
      .map(([k, v]) => `${k}(${v}g)`)
      .join(", ");
    menuLines = `\nYour stock: ${items}`;
  }

  return `## CURRENT GAME STATE
Player gold: ${s.gold}
Your gold (NPC): ${npcGold}
Relationship: ${rel.label} (friendship=${s.friendship}, trust=${s.trust}, respect=${s.respect})
Player inventory: ${inv}
Active flags: ${flags}${menuLines}`;
}

/**
 * Compose the full system prompt from sections + dynamic state.
 * Uses NPC identity/traits/history if available, falls back to static prompt.
 */
export function buildSystemPrompt(engine) {
  const npc = engine.npc;
  const world = engine.world;

  // NPC-specific sections (or fallback to static)
  const identity = npc ? npc.buildIdentityPrompt() : PROMPT_IDENTITY;
  const traits = npc ? npc.buildTraitsPrompt() : "";
  const history = npc && world ? npc.buildHistoryPrompt(world) : "";
  const worldCtx = world ? world.buildWorldPrompt() : "";

  const sections = [
    identity,
    traits,
    PROMPT_FORMAT,
    PROMPT_RULES,
    buildActionsPrompt(engine),
    buildStatePrompt(engine),
    worldCtx,
    history,
    PROMPT_EXAMPLES,
    PROMPT_FIRST_MESSAGE,
  ].filter((s) => s.length > 0);

  return sections.join("\n\n");
}
