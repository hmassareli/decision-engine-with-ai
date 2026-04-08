#!/usr/bin/env bash
set -euo pipefail

cd "$HOME/paro-wsl"
. .venv/bin/activate

export HF_HUB_DISABLE_XET=1
export CUDA_HOME=/usr/local/cuda
export CUDACXX=/usr/local/cuda/bin/nvcc
export PATH=/usr/local/cuda/bin:$PATH

# Stop stale servers if any.
pkill -f paroquant.cli.serve || true
pkill -f vllm.entrypoints.openai.api_server || true
sleep 1

nohup python3 -m paroquant.cli.serve \
	--model z-lab/Qwen3.5-4B-PARO \
	--language-model-only \
	--gpu-memory-utilization 0.75 \
	--max-model-len 8192 \
	--max-num-batched-tokens 512 \
	--port 8000 \
	> /tmp/paro-serve.log 2>&1 &

echo "paro-started"
echo "log: /tmp/paro-serve.log"
