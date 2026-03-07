// ═══════════════════════════════════════════════
//  UI — DOM manipulation, rendering, notifications
// ═══════════════════════════════════════════════

let showRawResponses = false;

// ── Cache DOM refs (set via init) ────────────

let chatEl, engineLogEl;

export function initUI(chatElement, engineLogElement, toggleRawBtn) {
  chatEl = chatElement;
  engineLogEl = engineLogElement;

  toggleRawBtn.addEventListener("click", () => {
    showRawResponses = !showRawResponses;
    toggleRawBtn.textContent = showRawResponses ? "hide raw" : "show raw";
    document
      .querySelectorAll(".raw-response")
      .forEach((el) => el.classList.toggle("visible", showRawResponses));
  });
}

// ── Scroll ───────────────────────────────────

export function scrollToBottom() {
  chatEl.scrollTop = chatEl.scrollHeight;
}

// ── Messages ─────────────────────────────────

export function removeWelcome() {
  const w = chatEl.querySelector(".welcome");
  if (w) w.remove();
}

export function addMessage(role, content) {
  removeWelcome();
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = content;
  chatEl.appendChild(div);
  scrollToBottom();
  return div;
}

/**
 * Create a streaming message bubble.
 * Returns { update(visibleText), finish() }
 */
export function addStreamingMessage(role) {
  removeWelcome();
  const div = document.createElement("div");
  div.className = `message ${role} streaming`;
  div.textContent = "";
  chatEl.appendChild(div);
  scrollToBottom();

  return {
    update(text) {
      div.textContent = text;
      scrollToBottom();
    },
    finish() {
      div.classList.remove("streaming");
    },
    el: div,
  };
}

// ── Engine notification (ALLOWED / DENIED / CONDITIONAL inline) ──

export function addEngineNotification(request, result) {
  const div = document.createElement("div");
  div.className = "message engine-notification";
  const cls =
    result.decision === "ALLOWED"
      ? "en-allowed"
      : result.decision === "DENIED"
        ? "en-denied"
        : "en-conditional";

  const target = request.target ? ` → ${request.target}` : "";
  const scoreInfo =
    result.score !== undefined
      ? ` (score ${result.finalScore} vs ${result.threshold})`
      : "";

  div.innerHTML =
    `⚙️ <span class="en-decision ${cls}">${result.decision}</span> — ` +
    `${request.action}${target}${scoreInfo}`;
  chatEl.appendChild(div);
  scrollToBottom();
}

// ── Stat change toast ────────────────────────

const STAT_LABELS = {
  friendship: "❤️ Friendship",
  respect: "⚔️ Respect",
  trust: "🔒 Trust",
  gold: "🪙 Gold",
  health: "💚 Health",
};

export function addStatChangeToast(changes) {
  const parts = [];
  for (const [key, delta] of Object.entries(changes)) {
    if (delta === 0) continue;
    const cls = delta > 0 ? "positive" : "negative";
    const sign = delta > 0 ? "+" : "";
    parts.push(
      `<span class="${cls}">${sign}${delta} ${STAT_LABELS[key] || key}</span>`,
    );
  }
  if (parts.length === 0) return;

  const div = document.createElement("div");
  div.className = "stat-change-toast";
  div.innerHTML = parts.join("&nbsp;&nbsp;·&nbsp;&nbsp;");
  chatEl.appendChild(div);
  scrollToBottom();
}

// ── Flag toast (following, married, etc.) ────

export function addFlagToast(action, decision) {
  const flagMessages = {
    follow_player: "🚶 Elara is now following you",
    become_apprentice: "📖 Elara became your apprentice",
    move_in: "🏠 Elara moved in with you",
    marry: "💍 You and Elara are now married",
    join_war: "⚔️ Elara joined the war effort",
  };

  if (decision !== "ALLOWED" || !flagMessages[action]) return;

  const div = document.createElement("div");
  div.className = "stat-change-toast";
  div.innerHTML = `<span class="positive">${flagMessages[action]}</span>`;
  chatEl.appendChild(div);
  scrollToBottom();
}

// ── Processing indicator ─────────────────────

let processingDiv = null;

export function showProcessing(label) {
  hideProcessing();
  processingDiv = document.createElement("div");
  processingDiv.className = "processing-indicator";
  processingDiv.innerHTML = `<div class="dots"><span></span><span></span><span></span></div> ${label}`;
  chatEl.appendChild(processingDiv);
  scrollToBottom();
}

export function hideProcessing() {
  if (processingDiv) {
    processingDiv.remove();
    processingDiv = null;
  }
}

// ── Stats panel ──────────────────────────────

export function updateStatsPanel(engine) {
  const s = engine.stats;
  for (const key of ["friendship", "respect", "trust", "health"]) {
    document.getElementById(`val-${key}`).textContent = s[key];
    document.getElementById(`bar-${key}`).style.width = s[key] + "%";
  }
  document.getElementById("val-gold").textContent = s.gold;

  // Relationship badge
  const rel = engine.getRelationship();
  const badge = document.getElementById("relationship-badge");
  badge.textContent = rel.label;
  badge.className = "relationship-badge " + rel.cls;

  // Flags
  const flagsEl = document.getElementById("flags-container");
  const activeFlags = Object.entries(engine.flags).filter(
    ([, v]) => v === true || (typeof v === "string" && v),
  );
  if (activeFlags.length === 0) {
    flagsEl.innerHTML = '<div class="inventory-empty">None</div>';
  } else {
    const flagLabels = {
      following: "🚶 Following",
      apprentice: "📖 Apprentice",
      livingTogether: "🏠 Living together",
      married: "💍 Married",
      atWar: "⚔️ At war",
    };
    flagsEl.innerHTML =
      '<ul class="inventory-list">' +
      activeFlags.map(([k]) => `<li>${flagLabels[k] || k}</li>`).join("") +
      "</ul>";
  }

  // Inventory
  const invEl = document.getElementById("inventory-container");
  if (engine.inventory.length === 0) {
    invEl.innerHTML = '<div class="inventory-empty">Empty</div>';
  } else {
    invEl.innerHTML =
      '<ul class="inventory-list">' +
      engine.inventory.map((i) => `<li>${i}</li>`).join("") +
      "</ul>";
  }
}

// ── Engine log panel ─────────────────────────

export function addEngineLogEntry(request, result, rawResponse) {
  const entry = document.createElement("div");
  entry.className = "engine-log-entry";
  const cls =
    result.decision === "ALLOWED"
      ? "en-allowed"
      : result.decision === "DENIED"
        ? "en-denied"
        : "en-conditional";

  const breakdownHtml = result.breakdown
    ? Object.entries(result.breakdown)
        .map(
          ([s, b]) =>
            `<span class="el-stat">${s}: ${b.value}×${b.weight}=${b.contribution}</span>`,
        )
        .join(" · ")
    : "";

  entry.innerHTML = `
    <div class="el-time">${new Date().toLocaleTimeString()}</div>
    <div class="el-action">${request.action} <span class="el-target">${request.target || ""}</span></div>
    <div class="el-context">seriousness: ${request.seriousness || "?"} · ${request.context || "—"}</div>
    <div class="el-decision ${cls}">${result.decision}</div>
    <div class="el-score">score: ${result.score ?? "?"} ${result.roll >= 0 ? "+" : ""}${result.roll ?? 0} luck = ${result.finalScore ?? "?"} vs ${result.threshold ?? "?"}</div>
    ${breakdownHtml ? `<div class="el-breakdown">${breakdownHtml}</div>` : ""}
    <div class="el-reason">${result.reason}</div>
    <div class="raw-response ${showRawResponses ? "visible" : ""}">${_escapeHtml(rawResponse || "")}</div>
  `;
  engineLogEl.prepend(entry);
}

// ── Helpers ──────────────────────────────────

function _escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
