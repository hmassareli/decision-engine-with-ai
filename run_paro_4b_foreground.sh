#!/usr/bin/env bash
set -euo pipefail
cd "$HOME/paro-wsl"
. .venv/bin/activate
export HF_HUB_DISABLE_XET=1
export CUDA_HOME=/usr/local/cuda
export CUDACXX=/usr/local/cuda/bin/nvcc
export PATH=/usr/local/cuda/bin:$PATH
exec python3 -m paroquant.cli.serve \
  --model z-lab/Qwen3.5-4B-PARO \
  --language-model-only \
  --gpu-memory-utilization 0.75 \
  --max-model-len 8192 \
  --max-num-batched-tokens 512 \
  --max-num-seqs 1 \
  --enforce-eager \
  --port 8000
