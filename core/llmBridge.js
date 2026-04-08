import {
  buildSystemPrompt,
  getApiUrl,
  getModel,
  MAX_HISTORY,
} from "./config.js";
import { requestLmStudioChat } from "./lmStudioChat.js";
import { parseReply } from "./parser.js";

function trimHistory(history) {
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
}

function extractVisibleText(raw) {
  const text = raw.trim();
  if (/<block[^>]*type\s*=\s*["']request["']/i.test(text)) return null;
  const match = text.match(
    /<block[^>]*type\s*=\s*["']text["'][^>]*>([\s\S]*?)(<\/block>|$)/i,
  );
  if (match) return match[1].trim();
  return "";
}

async function callLLMStream(messages, onToken) {
  return requestLmStudioChat({
    apiUrl: getApiUrl(),
    model: getModel(),
    systemPrompt: buildSystemPrompt(messages.engine),
    messages: messages.history,
    onToken,
  });
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

    const pass1Raw = await callLLMStream({ history, engine }, (fullSoFar) => {
      const visible = extractVisibleText(fullSoFar);
      if (visible !== null && onToken) onToken(visible, 1);
    });

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

      const pass2Raw = await callLLMStream({ history, engine }, (fullSoFar) => {
        const visible = extractVisibleText(fullSoFar);
        if (visible !== null && onToken) onToken(visible, 2);
      });

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
