// ═══════════════════════════════════════════════
//  MODEL SERVER — on-demand model load/unload
//  Saves VRAM by only keeping the active model loaded.
//  Usage: node model-server.mjs
// ═══════════════════════════════════════════════

import http from "node:http";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(exec);
const PORT = 3100;

// ── Model registry ───────────────────────────
const MODELS = {
  "qwen3.5-4b": {
    type: "lmstudio",
    lmsId: "qwen/qwen3.5-4b",
  },
  "qwen3.5-4b-paro": {
    type: "docker",
    image: "ghcr.io/z-lab/paroquant:serve",
    modelArg: "z-lab/Qwen3.5-4B-PARO",
    container: "paroquant-serve",
    port: 8000,
  },
  "qwen3.5-9b-paro": {
    type: "docker",
    image: "ghcr.io/z-lab/paroquant:serve",
    modelArg: "z-lab/Qwen3.5-9B-PARO",
    container: "paroquant-serve",
    port: 8000,
    args: [
      "--language-model-only",
      "--gpu-memory-utilization", "0.7",
      "--max-model-len", "16384",
      "--max-num-seqs", "1",
      "--max-num-batched-tokens", "512",
      "--attention-backend", "TRITON_ATTN",
    ],
  },
};

let activeModel = null;

// ── Helpers ──────────────────────────────────

async function shell(cmd) {
  console.log(`  $ ${cmd}`);
  const { stdout, stderr } = await run(cmd, { timeout: 120_000 });
  if (stdout.trim()) console.log(`    ${stdout.trim()}`);
  if (stderr.trim()) console.log(`    (stderr) ${stderr.trim()}`);
  return stdout.trim();
}

async function unloadLmStudio(id) {
  try {
    await shell(`lms unload ${id}`);
  } catch {
    // model may already be unloaded
  }
}

async function loadLmStudio(id) {
  await shell(`lms load ${id}`);
}

async function stopDocker(containerName) {
  try {
    await shell(`docker stop ${containerName}`);
  } catch {
    // container may not exist
  }
  // wait a moment for port release
  await new Promise((r) => setTimeout(r, 1000));
}

async function startDocker(cfg) {
  const extraArgs = (cfg.args || []).join(" ");
  await shell(
    `docker run --rm -d --gpus all --ipc=host ` +
    `-p ${cfg.port}:8000 ` +
    `--name ${cfg.container} ` +
    `${cfg.image} --model ${cfg.modelArg} ${extraArgs}`
  );
}

async function waitForReady(url, maxWaitMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* not ready yet */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

// ── Core logic ───────────────────────────────

async function unloadCurrent() {
  if (!activeModel) return;
  const cfg = MODELS[activeModel];
  console.log(`[unload] Stopping ${activeModel} (${cfg.type})`);
  if (cfg.type === "lmstudio") {
    await unloadLmStudio(cfg.lmsId);
  } else {
    await stopDocker(cfg.container);
  }
  activeModel = null;
}

async function loadModel(id) {
  const cfg = MODELS[id];
  if (!cfg) throw new Error(`Unknown model: ${id}`);

  if (activeModel === id) return { status: "already_loaded" };

  // unload previous
  await unloadCurrent();

  console.log(`[load] Starting ${id} (${cfg.type})`);
  if (cfg.type === "lmstudio") {
    await loadLmStudio(cfg.lmsId);
    activeModel = id;
    return { status: "loaded" };
  } else {
    await startDocker(cfg);
    console.log(`[load] Waiting for ${id} to become ready...`);
    const ready = await waitForReady(
      `http://localhost:${cfg.port}/v1/models`
    );
    if (!ready) throw new Error(`${id} failed to start within timeout`);
    activeModel = id;
    return { status: "loaded" };
  }
}

// ── HTTP server ──────────────────────────────

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, code, data) {
  cors(res);
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // GET /status
  if (req.method === "GET" && url.pathname === "/status") {
    return json(res, 200, { activeModel, models: Object.keys(MODELS) });
  }

  // POST /load  { model: "qwen3.5-4b" }
  if (req.method === "POST" && url.pathname === "/load") {
    let body = "";
    for await (const chunk of req) body += chunk;
    let parsed;
    try { parsed = JSON.parse(body); } catch {
      return json(res, 400, { error: "invalid JSON" });
    }
    const modelId = parsed.model;
    if (!modelId || !MODELS[modelId]) {
      return json(res, 400, { error: `unknown model: ${modelId}` });
    }
    try {
      const result = await loadModel(modelId);
      return json(res, 200, result);
    } catch (err) {
      console.error(`[load] Error:`, err.message);
      return json(res, 500, { error: err.message });
    }
  }

  // POST /unload
  if (req.method === "POST" && url.pathname === "/unload") {
    try {
      await unloadCurrent();
      return json(res, 200, { status: "unloaded" });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`Model server listening on http://localhost:${PORT}`);
  console.log(`  POST /load   { "model": "qwen3.5-4b" }`);
  console.log(`  POST /unload`);
  console.log(`  GET  /status`);
  console.log(`Available models: ${Object.keys(MODELS).join(", ")}`);
});
