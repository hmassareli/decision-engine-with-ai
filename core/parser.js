// ═══════════════════════════════════════════════
//  PARSER — parse LLM raw output into structured data
// ═══════════════════════════════════════════════

/**
 * Parse the LLM's raw response into { texts: string[], requests: object[] }.
 *
 * Supports:
 *   1. <block type="text">...</block>
 *   2. <block type="request" .../>
 *   3. Plain text fallback
 */
export function parseReply(rawText) {
  const text = rawText.trim();

  const result = { texts: [], requests: [], mood: "neutral" };

  // 2. Extract mood from <reply mood="..."> (conversation atmosphere)
  const replyMoodRx = /<reply\s+mood\s*=\s*["'](\w+)["']/i;
  const replyMoodMatch = replyMoodRx.exec(text);
  if (replyMoodMatch) result.mood = replyMoodMatch[1].toLowerCase();

  // 3. <block type="text">...</block> (mood may still appear on block for compat)
  const textRx =
    /<block\s+type\s*=\s*["']text["']\s*(?:mood\s*=\s*["'](\w+)["'])?\s*>([\s\S]*?)<\/block>/gi;
  let m;
  while ((m = textRx.exec(text)) !== null) {
    // Fallback: if no reply-level mood, use block-level mood
    if (!replyMoodMatch && m[1]) result.mood = m[1].toLowerCase();
    const t = m[2].trim();
    if (t) result.texts.push(t);
  }

  // 3. <block type="request" ... />  (self-closing or not)
  const reqRx = /<block\s+type\s*=\s*["']request["']\s+([\s\S]*?)\/?\s*>/gi;
  while ((m = reqRx.exec(text)) !== null) {
    const attrs = _parseAttrs(m[1]);
    if (attrs.action) result.requests.push(attrs);
  }

  // 4. Fallback: if nothing found, clean raw → treat as text
  if (result.texts.length === 0 && result.requests.length === 0) {
    const cleaned = text
      .replace(/<reply[^>]*>/gi, "")
      .replace(/<\/reply>/gi, "")
      .replace(/<block[^>]*?\/?>/gi, "")
      .replace(/<\/block>/gi, "")
      .trim();
    if (cleaned) result.texts.push(cleaned);
  }

  return result;
}

// ── Internal helpers ─────────────────────────

function _parseAttrs(str) {
  const attrs = {};
  const rx = /(\w+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = rx.exec(str)) !== null) attrs[m[1]] = m[2];
  return attrs;
}
