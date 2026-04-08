import { LLM_MAX_TOKENS, LLM_TEMPERATURE } from "./config.js";

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

function extractMessageText(data) {
  if (!Array.isArray(data?.output)) return "";

  return data.output
    .filter(
      (item) => item?.type === "message" && typeof item.content === "string",
    )
    .map((item) => item.content)
    .join("\n\n")
    .trim();
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

export async function requestLmStudioChat({
  apiUrl,
  model,
  systemPrompt,
  messages,
  onToken,
}) {
  const shouldStream = typeof onToken === "function";
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: buildTranscript(messages),
      system_prompt: systemPrompt,
      reasoning: "off",
      temperature: LLM_TEMPERATURE,
      max_output_tokens: LLM_MAX_TOKENS,
      store: false,
      stream: shouldStream,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(errorText || `API Error ${res.status}: ${res.statusText}`);
  }

  if (shouldStream) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";

      for (const event of events) {
        const parsed = parseSseEvent(event);
        if (!parsed?.data) continue;

        try {
          const json = JSON.parse(parsed.data);

          if (
            parsed.eventType === "message.delta" &&
            typeof json?.content === "string"
          ) {
            fullText += json.content;
            onToken(fullText);
            continue;
          }

          if (parsed.eventType === "chat.end") {
            const finalText = extractMessageText(json?.result);
            if (finalText && finalText !== fullText) {
              fullText = finalText;
              onToken(fullText);
            }
          }
        } catch {
          // Ignore malformed SSE chunks.
        }
      }
    }

    return fullText.trim();
  }

  const data = await res.json();
  return extractMessageText(data);
}
