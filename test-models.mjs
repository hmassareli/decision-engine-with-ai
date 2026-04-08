#!/usr/bin/env node
// ═══════════════════════════════════════════════
//  MODEL BENCHMARK — automated test suite
//  Compares models by sending prompts and scoring
//  the structured responses (actions, attributes)
//  Supports EN + PT variants per test case
// ═══════════════════════════════════════════════

import { writeFileSync } from "node:fs";

// ── Configuration ────────────────────────────

const LMSTUDIO_API_URL = "http://localhost:1234/api/v1/chat";
const PARO_API_URL = "http://localhost:8000/v1/chat/completions";

const MODELS = [
  {
    id: "qwen/qwen3.5-4b",
    label: "Qwen3.5-4B",
    apiUrl: LMSTUDIO_API_URL,
    protocol: "lmstudio-native",
  },
  {
    id: "z-lab/Qwen3.5-4B-PARO",
    label: "Qwen3.5-4B-PARO",
    apiUrl: PARO_API_URL,
    protocol: "openai",
  },
  {
    id: "z-lab/Qwen3.5-9B-PARO",
    label: "Qwen3.5-9B-PARO",
    apiUrl: PARO_API_URL,
    protocol: "openai",
  },
];

const LLM_TEMPERATURE = 0.2; // lower for stricter format compliance
const LLM_STOP = ["</reply>"];
const LLM_DISABLE_THINKING = true;
const RUNS_PER_TEST = 2; // run each test N times for consistency

function formatRole(role) {
  if (role === "assistant") return "ASSISTANT";
  if (role === "user") return "USER";
  return String(role || "user").toUpperCase();
}

function buildTranscript(messages) {
  return messages
    .filter((message) => message?.content)
    .map((message) => `${formatRole(message.role)}:\n${message.content}`)
    .join("\n\n");
}

// ── System prompt (simplified from config.js) ────

const SYSTEM_PROMPT = `# ELARA — THE BROKEN LAMP TAVERN

NO_THINK MODE:
- Do not output chain-of-thought.
- Do not output analysis, reasoning, plans, or "Thinking Process".
- Output only the final <reply> block.

You are Elara, 28, owner of The Broken Lamp Tavern.
You live in this world. Never mention AI, models, prompts, XML, tags, or formatting.

## PERSONALITY
- Sharp, sarcastic, loyal to those who earn it
- Knows the city's gossip, can hold her own in a fight
- Short responses: 2–5 sentences of spoken dialogue only
- No narration, no internal thoughts, no stage directions, no actions in asterisks

## RESPONSE FORMAT

ALWAYS wrap your ENTIRE response in <reply> tags with a mood attribute.
Return ONLY one <reply>...</reply> block and nothing else.
Never include analysis, reasoning, or headings like "Thinking Process".
The mood reflects the OVERALL CONVERSATION ATMOSPHERE — not your speaking tone.
Inside, use <block> elements. There are two types:

### type="text" — Spoken dialogue
<reply mood="friendly">
<block type="text">Your spoken words here</block>
</reply>

### type="request" — An action that needs game engine approval
<reply mood="neutral">
<block type="request" action="ACTION" target="TARGET" seriousness="NUMBER" context="short description"/>
</reply>
Only add paidBy attribute for commerce actions (serve_drink, cook_food, give_item): paidBy="player" when the player pays, paidBy="npc" when you offer to pay. Omit paidBy for all other actions.

## MOOD ATTRIBUTE (on <reply>)
Every <reply> MUST include mood. It represents the conversation quality, NOT your voice tone.
- mood="friendly" — pleasant interaction, good vibes
- mood="neutral" — normal, nothing remarkable
- mood="flirty" — romantic or playful atmosphere
- mood="hostile" — tension, threats, insults, conflict

## RULES

1. EVERY response MUST use <reply> and <block> tags. Nothing outside.
2. NEVER combine type="text" and type="request" in the same <reply>.
3. [ENGINE] messages are from the game engine, NOT the player. React naturally in character.
4. type="text" is the DEFAULT. Use it for: greetings, farewells, casual talk, questions, listing menu.
5. type="request" when the player does an action from the AVAILABLE ACTIONS below.
6. If in doubt → type="text".
7. Commerce: player says "yes" without naming item → ASK which.

## AVAILABLE ACTIONS
- serve_drink [s=1]: Player ORDERS a specific drink. target=beer(2g) | ale(2g) | wine(5g) | mead(4g) | water(0g) | special(10g)
- cook_food [s=3]: Player ORDERS a specific food. target=soup(3g) | cheese_bread(2g) | roast_meat(8g) | stew(5g)
- give_item [s=5]: Player requests an item to buy. target=potion(15g) | map(10g) | dagger(20g) | key(25g)
- invite_drink [s=3]: Player invites you to drink together. target=(person or self)
- invite_talk [s=3]: Player invites you to talk. target=(topic)
- share_rumor [s=5]: Player asks for gossip, rumors, news. target=king | guards | smuggling | merchants | dungeon
- share_secret [s=7]: Player asks for personal secret. target=(topic)
- go_to [s=5]: Player wants to go to a location. target=market | port | castle | forest | mines
- follow_player [s=7]: Player asks you to follow. target=home | market | adventure | quest
- start_fight [s=8]: Player initiates combat. target=bandits | monster | guard | arena
- refuse [s=0]: You refuse a request. target=(reason)

## CURRENT GAME STATE
Player gold: 50
Your gold (NPC): 200
Relationship: Stranger (friendship=10, trust=5, respect=10)
Player inventory: none
Active flags: none
Your menu — Drinks: beer(2g), ale(2g), wine(5g), mead(4g), water(0g), special(10g) | Food: soup(3g), cheese_bread(2g), roast_meat(8g), stew(5g) | Items: potion(15g), map(10g), dagger(20g), key(25g)

## EXAMPLES

Player: "Hi!" → type="text":
<reply mood="friendly"><block type="text">Hey there, stranger. Welcome to the Broken Lamp. Take a seat, what can I get you?</block></reply>

Player: "I'll have the stew." → type="request":
<reply mood="friendly"><block type="request" action="cook_food" target="stew" seriousness="3" context="Player orders stew" paidBy="player"/></reply>

Player: "Got any gossip?" → type="request":
<reply mood="friendly"><block type="request" action="share_rumor" target="guards" seriousness="5" context="Player asks for gossip"/></reply>`;

// ── Test cases ───────────────────────────────

// Each test has `messages` (EN) and optional `pt` (PT messages).
// Both share the same `expect` — XML structure doesn't change.
const TEST_CASES = [
  // ────── BASIC TEXT RESPONSES ──────
  {
    name: "Greeting → text response",
    messages: [{ role: "user", content: "Hey there! How's it going?" }],
    pt: [{ role: "user", content: "E aí! Tudo bem?" }],
    expect: {
      type: "text",
      hasReplyTag: true,
      mood: ["friendly", "neutral"],
      noRequest: true,
    },
  },
  {
    name: "Question about menu → text response",
    messages: [{ role: "user", content: "What do you have to drink?" }],
    pt: [{ role: "user", content: "O que você tem pra beber?" }],
    expect: {
      type: "text",
      hasReplyTag: true,
      mood: ["friendly", "neutral"],
      noRequest: true,
    },
  },
  {
    name: "Vague order (no item) → text asking which",
    messages: [{ role: "user", content: "I'll have a drink." }],
    pt: [{ role: "user", content: "Quero uma bebida." }],
    expect: {
      type: "text",
      hasReplyTag: true,
      noRequest: true,
    },
  },

  // ────── COMMERCE REQUESTS ──────
  {
    name: "Order beer → serve_drink request",
    messages: [{ role: "user", content: "I'll have a beer please." }],
    pt: [{ role: "user", content: "Me vê uma cerveja, por favor." }],
    expect: {
      type: "request",
      hasReplyTag: true,
      action: "serve_drink",
      target: "beer",
      hasPaidBy: true,
      paidBy: "player",
      hasSeriousness: true,
    },
  },
  {
    name: "Order stew → cook_food request",
    messages: [{ role: "user", content: "Give me some stew." }],
    pt: [{ role: "user", content: "Me dá um ensopado." }],
    expect: {
      type: "request",
      hasReplyTag: true,
      action: "cook_food",
      target: "stew",
      hasPaidBy: true,
      paidBy: "player",
      hasSeriousness: true,
    },
  },
  {
    name: "Order wine → serve_drink (multi-turn)",
    messages: [
      { role: "user", content: "What drinks do you have?" },
      {
        role: "assistant",
        content:
          '<reply mood="friendly"><block type="text">We have beer, ale, wine, mead, water, or the house special. What will it be?</block></reply>',
      },
      { role: "user", content: "Wine, please." },
    ],
    pt: [
      { role: "user", content: "Que bebidas vocês têm?" },
      {
        role: "assistant",
        content:
          '<reply mood="friendly"><block type="text">We have beer, ale, wine, mead, water, or the house special. What will it be?</block></reply>',
      },
      { role: "user", content: "Vinho, por favor." },
    ],
    expect: {
      type: "request",
      hasReplyTag: true,
      action: "serve_drink",
      target: "wine",
      hasPaidBy: true,
    },
  },
  {
    name: "Order mead → serve_drink request",
    messages: [{ role: "user", content: "One mead, please." }],
    pt: [{ role: "user", content: "Um hidromel, por favor." }],
    expect: {
      type: "request",
      hasReplyTag: true,
      action: "serve_drink",
      target: "mead",
      hasPaidBy: true,
      hasSeriousness: true,
    },
  },
  {
    name: "Order roast meat → cook_food request",
    messages: [{ role: "user", content: "I want some roast meat." }],
    pt: [{ role: "user", content: "Quero carne assada." }],
    expect: {
      type: "request",
      hasReplyTag: true,
      action: "cook_food",
      target: "roast_meat",
      hasPaidBy: true,
      hasSeriousness: true,
    },
  },
  {
    name: "Buy a map → give_item request",
    messages: [{ role: "user", content: "I need a map, how much?" }],
    pt: [{ role: "user", content: "Preciso de um mapa, quanto custa?" }],
    expect: {
      type: "request",
      hasReplyTag: true,
      action: "give_item",
      target: "map",
      hasPaidBy: true,
    },
  },
  {
    name: "Buy a dagger → give_item request",
    messages: [{ role: "user", content: "Got any daggers for sale?" }],
    pt: [{ role: "user", content: "Tem alguma adaga pra vender?" }],
    expect: {
      type: "request",
      hasReplyTag: true,
      action: "give_item",
      target: "dagger",
      hasPaidBy: true,
    },
  },

  // ────── SOCIAL / INFO REQUESTS ──────
  {
    name: "Ask for gossip → share_rumor request",
    messages: [{ role: "user", content: "Got any gossip about town?" }],
    pt: [{ role: "user", content: "Tem alguma fofoca sobre a cidade?" }],
    expect: {
      type: "request",
      hasReplyTag: true,
      action: "share_rumor",
      target: ["king", "guards", "smuggling", "merchants", "dungeon"],
      hasSeriousness: true,
    },
  },
  {
    name: "Ask about guards → share_rumor target=guards",
    messages: [
      { role: "user", content: "What have you heard about the guards?" },
    ],
    pt: [{ role: "user", content: "O que você ouviu sobre os guardas?" }],
    expect: {
      type: "request",
      hasReplyTag: true,
      action: "share_rumor",
      target: "guards",
      hasSeriousness: true,
    },
  },
  {
    name: "Ask about the king → share_rumor target=king",
    messages: [{ role: "user", content: "Any news about the king?" }],
    pt: [{ role: "user", content: "Alguma novidade sobre o rei?" }],
    expect: {
      type: "request",
      hasReplyTag: true,
      action: "share_rumor",
      target: "king",
      hasSeriousness: true,
    },
  },
  {
    name: "Invite to drink → invite_drink request",
    messages: [{ role: "user", content: "Hey, want to have a drink with me?" }],
    pt: [{ role: "user", content: "Ei, quer beber comigo?" }],
    expect: {
      type: "request",
      hasReplyTag: true,
      action: "invite_drink",
      hasSeriousness: true,
      noPaidBy: true,
    },
  },

  // ────── MOVEMENT ──────
  {
    name: "Go to market → go_to request",
    messages: [
      { role: "user", content: "Can you tell me how to get to the market?" },
    ],
    pt: [{ role: "user", content: "Pode me dizer como chegar no mercado?" }],
    expect: {
      type: "request",
      hasReplyTag: true,
      action: "go_to",
      target: "market",
      hasSeriousness: true,
      noPaidBy: true,
    },
  },

  // ────── HOSTILE MOOD ──────
  {
    name: "Threat → hostile mood text",
    messages: [
      { role: "user", content: "I'm going to burn this tavern down!" },
    ],
    pt: [{ role: "user", content: "Eu vou botar fogo nessa taverna!" }],
    expect: {
      type: "text",
      hasReplyTag: true,
      mood: ["hostile"],
    },
  },
  {
    name: "Insult → hostile mood text",
    messages: [
      {
        role: "user",
        content: "Your drinks taste like swamp water, this place is a dump.",
      },
    ],
    pt: [
      {
        role: "user",
        content: "Suas bebidas parecem água de esgoto, esse lugar é um lixo.",
      },
    ],
    expect: {
      type: "text",
      hasReplyTag: true,
      mood: ["hostile"],
    },
  },

  // ────── ENGINE RESPONSE HANDLING ──────
  {
    name: "React to ENGINE DENIED → text in character",
    messages: [
      { role: "user", content: "Tell me your deepest secret." },
      {
        role: "assistant",
        content:
          '<reply mood="neutral"><block type="request" action="share_secret" target="personal" seriousness="7" context="Player asks for secret"/></reply>',
      },
      {
        role: "user",
        content:
          '[ENGINE] decision=DENIED reason="Not enough trust (trust=5, need 35)"',
      },
    ],
    pt: [
      { role: "user", content: "Me conta teu segredo mais profundo." },
      {
        role: "assistant",
        content:
          '<reply mood="neutral"><block type="request" action="share_secret" target="personal" seriousness="7" context="Player asks for secret"/></reply>',
      },
      {
        role: "user",
        content:
          '[ENGINE] decision=DENIED reason="Not enough trust (trust=5, need 35)"',
      },
    ],
    expect: {
      type: "text",
      hasReplyTag: true,
      noRequest: true,
      noEngineLeak: true,
    },
  },

  // ────── MULTI-TURN CONTEXT ──────
  {
    name: "Multi-turn: greet then order → request",
    messages: [
      { role: "user", content: "Hello!" },
      {
        role: "assistant",
        content:
          '<reply mood="friendly"><block type="text">Welcome to the Broken Lamp! What can I get you?</block></reply>',
      },
      { role: "user", content: "I'll take an ale and some cheese bread." },
    ],
    pt: [
      { role: "user", content: "Olá!" },
      {
        role: "assistant",
        content:
          '<reply mood="friendly"><block type="text">Welcome to the Broken Lamp! What can I get you?</block></reply>',
      },
      { role: "user", content: "Quero uma ale e um pão com queijo." },
    ],
    expect: {
      type: "request",
      hasReplyTag: true,
      action: ["serve_drink", "cook_food"],
      hasSeriousness: true,
    },
  },
  {
    name: "Follow me → follow_player request",
    messages: [
      { role: "user", content: "Come with me, I need your help on a quest." },
    ],
    pt: [
      {
        role: "user",
        content: "Vem comigo, preciso da tua ajuda numa missão.",
      },
    ],
    expect: {
      type: "request",
      hasReplyTag: true,
      action: "follow_player",
      target: ["quest", "adventure"],
      hasSeriousness: true,
      noPaidBy: true,
    },
  },
];

// ── Parser (mirrors core/parser.js) ──────────

function sanitizeModelText(rawText) {
  let text = typeof rawText === "string" ? rawText : String(rawText ?? "");
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Discard any preamble so scoring focuses on the structured reply block.
  const replyStart = text.search(/<reply\b/i);
  if (replyStart >= 0) text = text.slice(replyStart);

  const replyClose = /<\/reply>/i.exec(text);
  if (replyClose) {
    text = text.slice(0, replyClose.index + replyClose[0].length);
  }

  return text;
}

function parseReply(rawText) {
  const text = sanitizeModelText(rawText);
  const result = { texts: [], requests: [], mood: null, raw: rawText };

  const replyMoodRx = /<reply\s+mood\s*=\s*["'](\w+)["']/i;
  const replyMatch = replyMoodRx.exec(text);
  if (replyMatch) result.mood = replyMatch[1].toLowerCase();

  const textRx = /<block\s+type\s*=\s*["']text["'][^>]*>([\s\S]*?)<\/block>/gi;
  let m;
  while ((m = textRx.exec(text)) !== null) {
    const t = (m[1] || "").trim();
    if (t) result.texts.push(t);
  }

  const reqRx = /<block\s+type\s*=\s*["']request["']\s+([\s\S]*?)\/?\s*>/gi;
  while ((m = reqRx.exec(text)) !== null) {
    const attrs = {};
    const attrRx = /(\w+)\s*=\s*"([^"]*)"/g;
    let a;
    while ((a = attrRx.exec(m[1])) !== null) attrs[a[1]] = a[2];
    if (attrs.action) result.requests.push(attrs);
  }

  return result;
}

// ── Scoring ──────────────────────────────────

function scoreResponse(parsed, expect) {
  const checks = [];
  let total = 0;
  let earned = 0;

  function check(name, weight, pass) {
    total += weight;
    if (pass) earned += weight;
    checks.push({ name, weight, pass });
  }

  // 1. Has <reply> tag
  if (expect.hasReplyTag) {
    check("has <reply> tag", 1, parsed.mood !== null);
  }

  // 2. Correct type (text vs request)
  if (expect.type === "text") {
    check("is text response", 3, parsed.texts.length > 0);
  } else if (expect.type === "request") {
    check("is request response", 3, parsed.requests.length > 0);
  }

  // 3. No request when text expected
  if (expect.noRequest) {
    check("no unwanted request", 2, parsed.requests.length === 0);
  }

  // 4. Correct mood
  if (expect.mood) {
    const validMoods = Array.isArray(expect.mood) ? expect.mood : [expect.mood];
    check(
      `mood in [${validMoods.join(",")}]`,
      2,
      parsed.mood && validMoods.includes(parsed.mood),
    );
  }

  // 5. Correct action
  if (expect.action && parsed.requests.length > 0) {
    const validActions = Array.isArray(expect.action)
      ? expect.action
      : [expect.action];
    const found = parsed.requests.some((r) => validActions.includes(r.action));
    check(`action in [${validActions.join(",")}]`, 3, found);
  }

  // 6. Correct target
  if (expect.target && parsed.requests.length > 0) {
    const validTargets = Array.isArray(expect.target)
      ? expect.target
      : [expect.target];
    const found = parsed.requests.some((r) => validTargets.includes(r.target));
    check(`target in [${validTargets.join(",")}]`, 2, found);
  }

  // 7. Has seriousness attribute
  if (expect.hasSeriousness && parsed.requests.length > 0) {
    const has = parsed.requests.some(
      (r) => r.seriousness !== undefined && r.seriousness !== "",
    );
    check("has seriousness", 1, has);
  }

  // 8. Has paidBy attribute
  if (expect.hasPaidBy && parsed.requests.length > 0) {
    const has = parsed.requests.some((r) => r.paidBy !== undefined);
    check("has paidBy", 1, has);
  }

  // 9. Correct paidBy value
  if (expect.paidBy && parsed.requests.length > 0) {
    const found = parsed.requests.some((r) => r.paidBy === expect.paidBy);
    check(`paidBy="${expect.paidBy}"`, 1, found);
  }

  // 10. No paidBy when not expected
  if (expect.noPaidBy && parsed.requests.length > 0) {
    const none = parsed.requests.every((r) => r.paidBy === undefined);
    check("no paidBy (non-commerce)", 1, none);
  }

  // 11. No engine leak (doesn't parrot engine internals)
  if (expect.noEngineLeak) {
    const textContent = parsed.texts.join(" ").toLowerCase();
    const leaks =
      textContent.includes("engine") ||
      textContent.includes("decision=") ||
      textContent.includes("trust=5") ||
      textContent.includes("need 35");
    check("no engine leak", 2, !leaks);
  }

  return { checks, total, earned, pct: total > 0 ? (earned / total) * 100 : 0 };
}

// ── API call ─────────────────────────────────

function modelsEndpoint(model) {
  if (model.protocol === "lmstudio-native") {
    return model.apiUrl.replace(/\/api\/v1\/chat$/, "/api/v1/models");
  }
  return model.apiUrl.replace(/\/chat\/completions$/, "/models");
}

async function callOpenAiCompatibleModel(apiUrl, model, messages) {
  const allMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

  const basePayload = {
    model,
    messages: allMessages,
    temperature: LLM_TEMPERATURE,
    stop: LLM_STOP,
    stream: false,
  };

  const payloadWithNoThink = LLM_DISABLE_THINKING
    ? {
        ...basePayload,
        // Some OpenAI-compatible backends support this hint.
        reasoning_effort: "low",
        // Some Qwen-compatible backends support this hint.
        chat_template_kwargs: { enable_thinking: false },
      }
    : basePayload;

  const start = performance.now();
  let res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadWithNoThink),
  });

  // Graceful fallback if backend rejects non-standard no-think params.
  if (
    !res.ok &&
    LLM_DISABLE_THINKING &&
    (res.status === 400 || res.status === 422)
  ) {
    res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(basePayload),
    });
  }

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  const elapsed = performance.now() - start;
  const content =
    typeof data?.choices?.[0]?.message?.content === "string"
      ? data.choices[0].message.content
      : "";
  const usage = data?.usage || {};

  return { content, elapsed, usage };
}

async function callLmStudioNativeModel(apiUrl, model, messages) {
  const start = performance.now();
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: buildTranscript(messages),
      system_prompt: SYSTEM_PROMPT,
      reasoning: LLM_DISABLE_THINKING ? "off" : "low",
      temperature: LLM_TEMPERATURE,
      max_output_tokens: 512,
      store: false,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(errorText || `API ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  const elapsed = performance.now() - start;
  const content = Array.isArray(data?.output)
    ? data.output
        .filter(
          (item) =>
            item?.type === "message" && typeof item.content === "string",
        )
        .map((item) => item.content)
        .join("\n\n")
    : "";
  const usage = {
    completion_tokens: data?.stats?.total_output_tokens || 0,
    reasoning_tokens: data?.stats?.reasoning_output_tokens || 0,
    prompt_tokens: data?.stats?.input_tokens || 0,
  };

  return { content, elapsed, usage };
}

async function callModel(modelConfig, messages) {
  if (modelConfig.protocol === "lmstudio-native") {
    return callLmStudioNativeModel(
      modelConfig.apiUrl,
      modelConfig.id,
      messages,
    );
  }

  return callOpenAiCompatibleModel(
    modelConfig.apiUrl,
    modelConfig.id,
    messages,
  );
}

// ── Runner ───────────────────────────────────

async function runTestCase(model, testCase, messages, lang) {
  const results = [];

  for (let run = 0; run < RUNS_PER_TEST; run++) {
    try {
      const { content, elapsed, usage } = await callModel(model, messages);
      const parsed = parseReply(content);
      const score = scoreResponse(parsed, testCase.expect);

      results.push({
        run: run + 1,
        lang,
        score,
        elapsed,
        tokens: usage.completion_tokens || 0,
        raw: content,
        parsed,
      });
    } catch (err) {
      results.push({
        run: run + 1,
        lang,
        error: err.message,
        score: { checks: [], total: 0, earned: 0, pct: 0 },
        elapsed: 0,
        tokens: 0,
      });
    }
  }

  return results;
}

// ── Pretty print ─────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
  bgGreen: "\x1b[42m",
  bgRed: "\x1b[41m",
  bgYellow: "\x1b[43m",
};

function pctColor(pct) {
  if (pct >= 90) return C.green;
  if (pct >= 60) return C.yellow;
  return C.red;
}

function printBar(pct, width = 20) {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  return `${pctColor(pct)}${"█".repeat(filled)}${C.dim}${"░".repeat(empty)}${C.reset}`;
}

function toFileSafeName(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// ── Main ─────────────────────────────────────

async function main() {
  // Parse CLI args
  const args = process.argv.slice(2);
  const onlyModels = args.filter((a) => !a.startsWith("-"));
  const verbose = args.includes("-v") || args.includes("--verbose");

  let modelsToTest = MODELS;
  if (onlyModels.length > 0) {
    const normalizedArgs = onlyModels.map((a) => a.toLowerCase());
    modelsToTest = MODELS.filter((m) => {
      const id = m.id.toLowerCase();
      const label = m.label.toLowerCase();
      return normalizedArgs.some(
        (a) => id === a || label === a || id.includes(a) || label.includes(a),
      );
    });
  }

  if (modelsToTest.length === 0) {
    console.error(
      "No matching models found. Available:",
      MODELS.map((m) => m.id).join(", "),
    );
    process.exit(1);
  }

  const ptCount = TEST_CASES.filter((tc) => tc.pt).length;
  const totalTests = TEST_CASES.length + ptCount;

  console.log(
    `\n${C.bold}═══════════════════════════════════════════════════${C.reset}`,
  );
  console.log(
    `${C.bold}  MODEL BENCHMARK — ${TEST_CASES.length} EN + ${ptCount} PT tests × ${RUNS_PER_TEST} runs${C.reset}`,
  );
  console.log(
    `${C.bold}═══════════════════════════════════════════════════${C.reset}\n`,
  );

  const summary = [];
  const fullLog = []; // saved to file at end

  for (const model of modelsToTest) {
    console.log(`\n${C.cyan}${C.bold}▶ ${model.label}${C.reset} (${model.id})`);
    console.log(`${C.dim}  API: ${model.apiUrl}${C.reset}`);

    // Check if API is reachable
    try {
      await fetch(modelsEndpoint(model));
    } catch {
      console.log(`  ${C.red}✖ API not reachable — skipping${C.reset}\n`);
      summary.push({
        model,
        avgPct: -1,
        avgTime: -1,
        totalTokens: 0,
        tokPerSec: 0,
        en: null,
        pt: null,
      });
      continue;
    }

    const langStats = {
      en: { total: 0, earned: 0, count: 0, time: 0 },
      pt: { total: 0, earned: 0, count: 0, time: 0 },
    };
    let totalTokens = 0;

    for (const tc of TEST_CASES) {
      // Run EN
      const enResults = await runTestCase(model, tc, tc.messages, "en");
      printTestResult(tc.name, "EN", enResults, verbose);
      accumulateLangStats(langStats.en, enResults);
      totalTokens += enResults.reduce((s, r) => s + r.tokens, 0);
      logResults(fullLog, model, tc.name, "en", enResults);

      // Run PT if available
      if (tc.pt) {
        const ptResults = await runTestCase(model, tc, tc.pt, "pt");
        printTestResult(tc.name, "PT", ptResults, verbose);
        accumulateLangStats(langStats.pt, ptResults);
        totalTokens += ptResults.reduce((s, r) => s + r.tokens, 0);
        logResults(fullLog, model, tc.name, "pt", ptResults);
      }
    }

    const enPct =
      langStats.en.count > 0
        ? (langStats.en.earned / langStats.en.total) * 100
        : 0;
    const ptPct =
      langStats.pt.count > 0
        ? (langStats.pt.earned / langStats.pt.total) * 100
        : 0;
    const allPct =
      langStats.en.total + langStats.pt.total > 0
        ? ((langStats.en.earned + langStats.pt.earned) /
            (langStats.en.total + langStats.pt.total)) *
          100
        : 0;
    const avgTime =
      langStats.en.count + langStats.pt.count > 0
        ? (langStats.en.time + langStats.pt.time) /
          (langStats.en.count + langStats.pt.count)
        : 0;
    const totalElapsedMs = langStats.en.time + langStats.pt.time;
    const tokPerSec =
      totalElapsedMs > 0 ? totalTokens / (totalElapsedMs / 1000) : 0;

    summary.push({
      model,
      avgPct: allPct,
      avgTime,
      totalTokens,
      tokPerSec,
      en: enPct,
      pt: ptPct,
    });

    console.log(
      `\n  ${C.bold}EN: ${printBar(enPct)} ${pctColor(enPct)}${enPct.toFixed(1)}%${C.reset}  |  ${C.bold}PT: ${printBar(ptPct)} ${pctColor(ptPct)}${ptPct.toFixed(1)}%${C.reset}  |  ${C.bold}All: ${pctColor(allPct)}${allPct.toFixed(1)}%${C.reset}`,
    );
    console.log(
      `  ${C.dim}avg ${avgTime.toFixed(0)}ms/test  ${totalTokens} total tokens  ${tokPerSec.toFixed(2)} tok/s${C.reset}`,
    );
  }

  // ── Final comparison ─────────────────────

  console.log(
    `\n${C.bold}═══════════════════════════════════════════════════${C.reset}`,
  );
  console.log(`${C.bold}  COMPARISON${C.reset}`);
  console.log(
    `${C.bold}═══════════════════════════════════════════════════${C.reset}\n`,
  );

  console.log(
    `  ${"Model".padEnd(22)} ${"EN".padStart(7)} ${"PT".padStart(7)} ${"Total".padStart(7)} ${"Avg ms".padStart(8)} ${"Tokens".padStart(8)} ${"Tok/s".padStart(8)}`,
  );
  console.log(`  ${"─".repeat(71)}`);

  for (const s of summary) {
    if (s.avgPct < 0) {
      console.log(`  ${s.model.label.padEnd(22)} ${C.red}SKIPPED${C.reset}`);
    } else {
      console.log(
        `  ${s.model.label.padEnd(22)} ${pctColor(s.en)}${s.en.toFixed(1).padStart(6)}%${C.reset} ${pctColor(s.pt)}${s.pt.toFixed(1).padStart(6)}%${C.reset} ${pctColor(s.avgPct)}${s.avgPct.toFixed(1).padStart(6)}%${C.reset} ${(s.avgTime.toFixed(0) + "ms").padStart(8)} ${String(s.totalTokens).padStart(8)} ${s.tokPerSec.toFixed(2).padStart(8)}`,
      );
    }
  }

  // Winner
  const valid = summary.filter((s) => s.avgPct >= 0);
  if (valid.length > 1) {
    const best = valid.reduce((a, b) => (a.avgPct > b.avgPct ? a : b));
    const fastest = valid.reduce((a, b) => (a.avgTime < b.avgTime ? a : b));
    console.log(
      `\n  ${C.green}${C.bold}🏆 Best accuracy: ${best.model.label} (${best.avgPct.toFixed(1)}%)${C.reset}`,
    );
    console.log(
      `  ${C.cyan}${C.bold}⚡ Fastest: ${fastest.model.label} (${fastest.avgTime.toFixed(0)}ms avg)${C.reset}`,
    );
  }

  // ── Save log file ──────────────────────
  const modelSuffix =
    modelsToTest.length === 1
      ? toFileSafeName(modelsToTest[0].id)
      : `multi-${modelsToTest.length}-models`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = `benchmark-log-${modelSuffix}-${timestamp}`;
  const logFile = `${baseName}.json`;
  writeFileSync(logFile, JSON.stringify(fullLog, null, 2));

  const scoredRuns = fullLog.filter(
    (r) => typeof r.scoreTotal === "number" && r.scoreTotal > 0,
  );
  const totalEarned = scoredRuns.reduce((sum, r) => sum + r.scoreEarned, 0);
  const totalPossible = scoredRuns.reduce((sum, r) => sum + r.scoreTotal, 0);
  const totalAccuracyPct =
    totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;
  const summaryByModel = summary
    .filter((s) => s.avgPct >= 0)
    .map((s) => ({
      model: s.model.id,
      modelLabel: s.model.label,
      enPct: s.en,
      ptPct: s.pt,
      totalPct: s.avgPct,
      avgMs: s.avgTime,
      totalTokens: s.totalTokens,
      tokPerSec: s.tokPerSec,
    }));

  const summaryPayload = {
    generatedAt: new Date().toISOString(),
    modelsTested: modelsToTest.map((m) => m.id),
    runsPerTest: RUNS_PER_TEST,
    totalRuns: fullLog.length,
    scoredRuns: scoredRuns.length,
    totalEarned,
    totalPossible,
    totalAccuracyPct,
    byModel: summaryByModel,
  };

  const summaryFile = `${baseName}.summary.json`;
  writeFileSync(summaryFile, JSON.stringify(summaryPayload, null, 2));

  console.log(`\n  ${C.dim}Log saved: ${logFile}${C.reset}`);
  console.log(`  ${C.dim}Summary saved: ${summaryFile}${C.reset}`);
  console.log(
    `  ${C.dim}Total accuracy: ${totalAccuracyPct.toFixed(2)}% (${totalEarned}/${totalPossible})${C.reset}`,
  );
  console.log();
}

// ── Helpers ──────────────────────────────────

function printTestResult(name, lang, results, verbose) {
  const avgPct = results.reduce((s, r) => s + r.score.pct, 0) / results.length;
  const avgTime = results.reduce((s, r) => s + r.elapsed, 0) / results.length;
  const avgTokens = results.reduce((s, r) => s + r.tokens, 0) / results.length;
  const tokPerSec = avgTime > 0 ? avgTokens / (avgTime / 1000) : 0;

  const icon = avgPct >= 90 ? "✔" : avgPct >= 60 ? "◐" : "✖";
  const iconColor = avgPct >= 90 ? C.green : avgPct >= 60 ? C.yellow : C.red;
  const langTag =
    lang === "pt" ? `${C.magenta}PT${C.reset}` : `${C.white}EN${C.reset}`;

  console.log(
    `  ${iconColor}${icon}${C.reset} [${langTag}] ${name.padEnd(42)} ${printBar(avgPct)} ${pctColor(avgPct)}${avgPct.toFixed(0).padStart(3)}%${C.reset}  ${C.dim}${avgTime.toFixed(0)}ms ${avgTokens.toFixed(0)}tok ${tokPerSec.toFixed(2)}tok/s${C.reset}`,
  );

  if (verbose) {
    for (const r of results) {
      if (r.error) {
        console.log(`    ${C.red}Run ${r.run}: ERROR — ${r.error}${C.reset}`);
      } else {
        for (const ch of r.score.checks) {
          const mark = ch.pass ? `${C.green}✔` : `${C.red}✖`;
          console.log(`    ${mark} ${ch.name} (w=${ch.weight})${C.reset}`);
        }
        // Show text content (for checking language / grammar)
        const textPreview =
          r.parsed.texts.length > 0
            ? r.parsed.texts.join(" | ").slice(0, 150)
            : r.raw.slice(0, 150);
        console.log(`    ${C.dim}Response: ${textPreview}${C.reset}`);
      }
    }
  }
}

function accumulateLangStats(stats, results) {
  for (const r of results) {
    stats.total += r.score.total;
    stats.earned += r.score.earned;
    stats.time += r.elapsed;
    stats.count++;
  }
}

function logResults(log, model, testName, lang, results) {
  for (const r of results) {
    log.push({
      model: model.id,
      modelLabel: model.label,
      test: testName,
      lang,
      run: r.run,
      scorePct: r.score.pct,
      scoreEarned: r.score.earned,
      scoreTotal: r.score.total,
      checks: r.score.checks,
      elapsed: r.elapsed,
      tokens: r.tokens,
      raw: r.raw || null,
      texts: r.parsed?.texts || [],
      requests: r.parsed?.requests || [],
      mood: r.parsed?.mood || null,
      error: r.error || null,
    });
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
