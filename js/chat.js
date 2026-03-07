// ═══════════════════════════════════════════════
//  CHAT — LLM communication and two-pass flow
// ═══════════════════════════════════════════════

import { API_URL, MODEL, MAX_HISTORY, LLM_TEMPERATURE, LLM_MAX_TOKENS, buildSystemPrompt, PROMPT_FORMAT, PROMPT_RULES, PROMPT_FIRST_MESSAGE } from "./config.js";
import { parseReply } from "./parser.js";
import {
  addMessage,
  addStreamingMessage,
  addEngineNotification,
  addStatChangeToast,
  addFlagToast,
  showProcessing,
  hideProcessing,
  updateStatsPanel,
  addEngineLogEntry,
} from "./ui.js";

let conversationHistory = []; // { role, content }[]

// ── LLM API call (non-streaming, kept for fallback) ──

async function callLLM(messages) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: LLM_TEMPERATURE,
      max_tokens: LLM_MAX_TOKENS,
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`API Error ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// ── LLM API call (streaming) ──

/**
 * Stream an LLM response. Calls onToken(fullTextSoFar) with each chunk.
 * Returns the complete text when the stream finishes.
 */
async function callLLMStream(messages, onToken) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: LLM_TEMPERATURE,
      max_tokens: LLM_MAX_TOKENS,
      stream: true,
    }),
  });
  if (!res.ok) throw new Error(`API Error ${res.status}: ${res.statusText}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE format: each event is "data: {...}\n\n"
    const lines = buffer.split("\n");
    // Keep the last potentially incomplete line in buffer
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const payload = trimmed.slice(6);
      if (payload === "[DONE]") continue;

      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          if (onToken) onToken(fullText);
        }
      } catch { /* skip malformed chunks */ }
    }
  }

  return fullText;
}

/**
 * Extract visible text from a (possibly incomplete) raw LLM response.
 * Strips XML tags, <think> blocks, and returns only the spoken dialogue.
 */
function extractVisibleText(raw) {
  // Strip <think>...</think>
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // If there's an unclosed <think>, hide everything after it
  text = text.replace(/<think>[\s\S]*/gi, "");
  // Check if this is a request (no visible text to show)
  if (/<block[^>]*type\s*=\s*["']request["']/i.test(text)) return null;
  // Extract text content from <block type="text">
  const match = text.match(/<block[^>]*type\s*=\s*["']text["'][^>]*>([\s\S]*?)(<\/block>|$)/i);
  if (match) return match[1].trim();
  // If no block tags yet, return nothing (still building XML)
  return "";
}

function trimHistory() {
  if (conversationHistory.length > MAX_HISTORY) {
    conversationHistory = conversationHistory.slice(-MAX_HISTORY);
  }
}

// ── Core two-pass flow ───────────────────────

/**
 * Called after user sends a message.
 *   Pass 1 → LLM responds with text OR request
 *     • text → display
 *     • request → engine evaluates → inject [ENGINE] response → Pass 2
 *   Pass 2 → LLM reacts to engine decision → display text
 */
async function processLLMResponse(engine) {
  const systemPrompt = buildSystemPrompt(engine);
  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
  ];

  // ── Pass 1 (streamed) ──
  showProcessing("Elara is thinking...");

  let streamBubble = null;

  const rawPass1 = await callLLMStream(messages, (fullSoFar) => {
    const visible = extractVisibleText(fullSoFar);
    if (visible === null) return; // request detected — don't show
    if (visible && visible.length > 0) {
      if (!streamBubble) {
        hideProcessing();
        streamBubble = addStreamingMessage("assistant");
      }
      streamBubble.update(visible);
    }
  });

  hideProcessing();

  conversationHistory.push({ role: "assistant", content: rawPass1 });
  trimHistory();

  const parsed = parseReply(rawPass1);

  // ── Text-only → finalize stream bubble and apply passive effects ──
  if (parsed.requests.length === 0) {
    const text = parsed.texts.join("\n\n");
    if (streamBubble) {
      // Final update with fully parsed text
      streamBubble.update(text);
      streamBubble.finish();
    } else if (text) {
      addMessage("assistant", text);
    }

    // Apply passive conversation effects (mood + milestones)
    const passiveChanges = engine.applyPassiveEffects(parsed.mood);
    addStatChangeToast(passiveChanges);
    updateStatsPanel(engine);
    return;
  }

  // ── Has request → evaluate via engine → Pass 2 ──
  // Remove the stream bubble if one was created (request shouldn't show text)
  if (streamBubble) {
    // If model broke rules and included text with request, finalize it
    if (parsed.texts.length > 0) {
      streamBubble.update(parsed.texts.join("\n\n"));
      streamBubble.finish();
    } else {
      streamBubble.el.remove();
    }
  } else if (parsed.texts.length > 0) {
    addMessage("assistant", parsed.texts.join("\n\n"));
  }

  for (const request of parsed.requests) {
    // Engine evaluation
    const result = engine.evaluate(request);
    const changes = engine.applyEffects(request, result.decision);

    // UI updates
    addEngineNotification(request, result);
    addStatChangeToast(changes);
    addFlagToast(request.action, result.decision);
    updateStatsPanel(engine);
    addEngineLogEntry(request, result, rawPass1);

    // Inject engine response into conversation
    let engineExtra = "";

    // For share_rumor: inject actual rumor content so LLM doesn't invent
    if (request.action === "share_rumor" && result.decision === "ALLOWED" && engine.world) {
      const rumor = engine.world.getRumor(request.target);
      engineExtra = `\nRumor you know about "${request.target}": "${rumor}"\nTell this rumor in your own words. Do NOT invent a different rumor.`;
    }

    const engineMsg =
      `[ENGINE]\n` +
      `<engine_response decision="${result.decision}" action="${request.action}" reason="${result.reason}"/>\n` +
      `Respond as Elara based on this decision.${engineExtra}`;

    conversationHistory.push({ role: "user", content: engineMsg });
    trimHistory();

    // ── Pass 2: LLM reacts to engine decision ──
    const systemPrompt2 = buildSystemPrompt(engine);
    const messages2 = [
      { role: "system", content: systemPrompt2 },
      ...conversationHistory,
    ];

    const statusLabels = {
      ALLOWED:     "Engine approved — Elara reacts...",
      DENIED:      "Engine denied — Elara reacts...",
      CONDITIONAL: "Engine conditional — Elara reacts...",
    };
    showProcessing(statusLabels[result.decision] || "Elara reacts...");

    let streamBubble2 = null;

    const rawPass2 = await callLLMStream(messages2, (fullSoFar) => {
      const visible = extractVisibleText(fullSoFar);
      if (visible === null) return;
      if (visible && visible.length > 0) {
        if (!streamBubble2) {
          hideProcessing();
          streamBubble2 = addStreamingMessage("assistant");
        }
        streamBubble2.update(visible);
      }
    });

    hideProcessing();

    conversationHistory.push({ role: "assistant", content: rawPass2 });
    trimHistory();

    const reaction = parseReply(rawPass2);
    const reactionText = reaction.texts.join("\n\n");

    if (streamBubble2) {
      if (reactionText) streamBubble2.update(reactionText);
      streamBubble2.finish();
    } else if (reactionText) {
      addMessage("assistant", reactionText);
    }

    // Apply passive effects for the reaction dialogue too
    if (reaction.texts.length > 0) {
      const passiveChanges = engine.applyPassiveEffects(reaction.mood);
      addStatChangeToast(passiveChanges);
      updateStatsPanel(engine);
    }

    // Guard: don't recurse if reaction has another request
    if (reaction.requests.length > 0) {
      console.warn("LLM sent request inside engine reaction — ignoring to prevent loop.", reaction.requests);
    }
  }
}

// ── Public API ───────────────────────────────

/**
 * Send a user message and process the response.
 */
export async function sendUserMessage(text, engine) {
  conversationHistory.push({ role: "user", content: text });
  trimHistory();
  await processLLMResponse(engine);
}

/**
 * Trigger the initial greeting from Elara.
 */
export async function initialGreeting(engine) {
  const npcName = engine.npc?.template?.name || "NPC";
  showProcessing(`${npcName} notices you walk in...`);

  // Use NPC identity if available, otherwise fallback
  const identity = engine.npc
    ? engine.npc.buildIdentityPrompt()
    : PROMPT_FORMAT;
  const greetingPrompt = [identity, PROMPT_FORMAT, PROMPT_RULES, PROMPT_FIRST_MESSAGE].join("\n\n");

  let streamBubble = null;

  const raw = await callLLMStream(
    [
      { role: "system", content: greetingPrompt },
      { role: "user", content: "*A traveler walks into the tavern.*" },
    ],
    (fullSoFar) => {
      const visible = extractVisibleText(fullSoFar);
      if (visible && visible.length > 0) {
        if (!streamBubble) {
          hideProcessing();
          streamBubble = addStreamingMessage("assistant");
        }
        streamBubble.update(visible);
      }
    }
  );

  hideProcessing();

  // Add the dummy user message to history so subsequent calls have valid user→assistant ordering
  conversationHistory.push({ role: "user", content: "*A traveler walks into the tavern.*" });
  conversationHistory.push({ role: "assistant", content: raw });

  const parsed = parseReply(raw);
  const text = parsed.texts.join("\n\n");
  if (streamBubble) {
    if (text) streamBubble.update(text);
    streamBubble.finish();
  } else if (text) {
    addMessage("assistant", text);
  }
}
