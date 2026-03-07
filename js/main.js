// ═══════════════════════════════════════════════
//  MAIN — entry point, wires everything together
// ═══════════════════════════════════════════════

import { initialGreeting, sendUserMessage } from "./chat.js";
import { GameEngine } from "./engine.js";
import { NPC } from "./npc.js";
import {
  addMessage,
  hideProcessing,
  initUI,
  removeWelcome,
  updateStatsPanel,
} from "./ui.js";
import { WorldState } from "./world.js";

// ── Boot ─────────────────────────────────────

// Create world + NPC + engine
const world = new WorldState();
const elara = new NPC("elara");
const engine = new GameEngine(elara, world);

const chatEl = document.getElementById("chat");
const msgEl = document.getElementById("msg");
const sendBtn = document.getElementById("send-btn");
const engineLogEl = document.getElementById("engine-log");
const toggleRawBtn = document.getElementById("toggle-raw-btn");

// Init UI module with DOM refs
initUI(chatEl, engineLogEl, toggleRawBtn);

let isProcessing = false;

// ── Input handling ───────────────────────────

msgEl.addEventListener("input", () => {
  msgEl.style.height = "auto";
  msgEl.style.height = Math.min(msgEl.scrollHeight, 120) + "px";
});

msgEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

sendBtn.addEventListener("click", handleSend);

async function handleSend() {
  const text = msgEl.value.trim();
  if (!text || isProcessing) return;

  isProcessing = true;
  sendBtn.disabled = true;

  addMessage("user", text);
  msgEl.value = "";
  msgEl.style.height = "auto";

  try {
    await sendUserMessage(text, engine);
  } catch (err) {
    hideProcessing();
    const errDiv = addMessage(
      "assistant",
      `⚠️ Error: ${err.message}\n\nMake sure LM Studio is running:\nlms server start --cors`,
    );
    errDiv.style.borderColor = "#ef4444";
  } finally {
    isProcessing = false;
    sendBtn.disabled = false;
    msgEl.focus();
  }
}

// ── Initial greeting ─────────────────────────

async function boot() {
  updateStatsPanel(engine);
  isProcessing = true;
  sendBtn.disabled = true;

  try {
    removeWelcome();
    await initialGreeting(engine);
  } catch (err) {
    console.warn("Initial greeting failed:", err.message);
  } finally {
    isProcessing = false;
    sendBtn.disabled = false;
    msgEl.focus();
  }
}

boot();
