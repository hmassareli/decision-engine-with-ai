// ═══════════════════════════════════════════════
//  MAIN — entry point, wires everything together
// ═══════════════════════════════════════════════

import { initialGreeting, sendUserMessage } from "./chat.js";
import { AVAILABLE_MODELS, setModel, requestModelLoad, isModelReady } from "./config.js";
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

// ── Model selector ───────────────────────────
const modelSelect = document.getElementById("model-select");
{
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "— Select model —";
  placeholder.disabled = true;
  placeholder.selected = true;
  modelSelect.appendChild(placeholder);
}
AVAILABLE_MODELS.forEach((m) => {
  const opt = document.createElement("option");
  opt.value = m.id;
  opt.textContent = m.label;
  modelSelect.appendChild(opt);
});

modelSelect.addEventListener("change", async () => {
  const id = modelSelect.value;
  if (!id) return;
  modelSelect.disabled = true;
  sendBtn.disabled = true;
  const origText = modelSelect.options[modelSelect.selectedIndex].text;
  modelSelect.options[modelSelect.selectedIndex].text = `⏳ Loading ${origText}…`;
  try {
    await requestModelLoad(id);
    modelSelect.options[modelSelect.selectedIndex].text = origText;
    sendBtn.disabled = false;
    runGreeting(); // first load triggers initial greeting
  } catch (err) {
    modelSelect.options[modelSelect.selectedIndex].text = origText;
    alert(`Failed to load model: ${err.message}`);
    sendBtn.disabled = false;
  }
  modelSelect.disabled = false;
});

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
  if (!isModelReady()) {
    alert("Select and load a model first.");
    return;
  }

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

let booted = false;

async function boot() {
  updateStatsPanel(engine);
  sendBtn.disabled = true;
  // greeting will run after the first model is loaded
}

/** Called once after the first model finishes loading. */
export async function runGreeting() {
  if (booted) return;
  booted = true;
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
