import {
  getApiUrl,
  buildSystemPrompt,
  LLM_MAX_TOKENS,
  LLM_TEMPERATURE,
  MAX_HISTORY,
  getModel,
} from "./config.js";
import { parseReply } from "./parser.js";

function trimHistory(history) {
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
}

function extractVisibleText(raw) {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
  text = text.replace(/<think>[\s\S]*/gi, "");
  if (/<block[^>]*type\s*=\s*["']request["']/i.test(text)) return null;
  const match = text.match(
    /<block[^>]*type\s*=\s*["']text["'][^>]*>([\s\S]*?)(<\/block>|$)/i,
  );
  if (match) return match[1].trim();
  return "";
}

async function callLLMStream(messages, onToken) {
  const res = await fetch(getApiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: getModel(),
      messages,
      temperature: LLM_TEMPERATURE,
      max_tokens: LLM_MAX_TOKENS,
      stream: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`API Error ${res.status}: ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || "";

    for (const ev of events) {
      const parsed = parseSseEvent(ev);
      if (!parsed?.data || parsed.data === "[DONE]") continue;

      try {
        const json = JSON.parse(parsed.data);
        const delta = extractDeltaText(json, parsed.eventType);
        if (!delta) continue;

        fullText += delta;
        if (onToken) onToken(fullText);
      } catch {
        // Ignore malformed chunk.
      }
    }
  }

  return fullText;
}

function parseSseEvent(rawEvent) {
  const lines = rawEvent.split(/\r?\n/);
  let eventType = "";
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) return null;
  return { eventType, data: dataLines.join("\n") };
}

function extractDeltaText(json, eventType = "") {
  // Never stream reasoning traces to callers.
  if (eventType === "reasoning.delta" || eventType === "response.reasoning.delta") {
    return "";
  }

  const deltaContent = json?.choices?.[0]?.delta?.content;
  if (typeof deltaContent === "string") return deltaContent;
  if (Array.isArray(deltaContent)) {
    const joined = deltaContent
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        return "";
      })
      .join("");
    if (joined) return joined;
  }

  if (typeof json?.content === "string") return json.content;
  if (Array.isArray(json?.content)) {
    const joined = json.content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .join("");
    if (joined) return joined;
  }

  if (typeof json?.delta === "string") return json.delta;

  // Legacy completion-like chunk.
  if (typeof json?.choices?.[0]?.text === "string") {
    return json.choices[0].text;
  }

  if (
    eventType === "message.delta" &&
    typeof json?.content === "string"
  ) {
    return json.content;
  }

  return "";
}

/**
 * Creates a stateful headless bridge for in-world chat.
 * The bridge preserves conversation history and applies engine side effects.
 */
export function createInWorldChatBridge() {
  /** @type {{role: "user"|"assistant", content: string}[]} */
  const history = [];

  return async function chatBridge(text, engine, options = {}) {
    const { onToken } = options;

    history.push({ role: "user", content: text });
    trimHistory(history);

    const pass1Raw = await callLLMStream(
      [{ role: "system", content: buildSystemPrompt(engine) }, ...history],
      (fullSoFar) => {
        const visible = extractVisibleText(fullSoFar);
        if (visible !== null && onToken) onToken(visible, 1);
      },
    );

    history.push({ role: "assistant", content: pass1Raw });
    trimHistory(history);

    const pass1 = parseReply(pass1Raw);
    const decisions = [];
    const assistantTexts = [];

    if (pass1.requests.length === 0) {
      const textOnly = pass1.texts.join("\n\n").trim();
      if (textOnly) assistantTexts.push(textOnly);
      const passive = engine.applyPassiveEffects(pass1.mood);
      return {
        assistantText: assistantTexts.join("\n\n"),
        decisions,
        passive,
        mood: pass1.mood,
      };
    }

    if (pass1.texts.length > 0) {
      assistantTexts.push(pass1.texts.join("\n\n"));
    }

    for (const request of pass1.requests) {
      const result = engine.evaluate(request);
      const effects = engine.applyEffects(request, result.decision);

      decisions.push({ request, result, effects });

      let engineExtra = "";
      if (
        request.action === "share_rumor" &&
        result.decision === "ALLOWED" &&
        engine.world
      ) {
        const rumor = engine.world.getRumor(request.target);
        engineExtra = `\nRumor you know about "${request.target}": "${rumor}"\nTell this rumor in your own words. Do NOT invent a different rumor.`;
      }

      const engineMsg =
        `[ENGINE]\n` +
        `<engine_response decision="${result.decision}" action="${request.action}" reason="${result.reason}"/>\n` +
        `Respond in character based on this decision.${engineExtra}`;

      history.push({ role: "user", content: engineMsg });
      trimHistory(history);

      const pass2Raw = await callLLMStream(
        [{ role: "system", content: buildSystemPrompt(engine) }, ...history],
        (fullSoFar) => {
          const visible = extractVisibleText(fullSoFar);
          if (visible !== null && onToken) onToken(visible, 2);
        },
      );

      history.push({ role: "assistant", content: pass2Raw });
      trimHistory(history);

      const pass2 = parseReply(pass2Raw);
      const reactionText = pass2.texts.join("\n\n").trim();
      if (reactionText) {
        assistantTexts.push(reactionText);
        engine.applyPassiveEffects(pass2.mood);
      }
    }

    return {
      assistantText: assistantTexts.join("\n\n").trim(),
      decisions,
      passive: null,
      mood: pass1.mood,
    };
  };
}
