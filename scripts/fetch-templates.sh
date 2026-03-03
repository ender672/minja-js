#!/usr/bin/env bash
# Fetches .jinja template files from HuggingFace for test-capabilities and test-tool-rendering tests.
# Some models have multiple named templates (e.g. "default", "rag", "tool_use") — this script
# extracts all of them and saves each with a `-<name>` suffix.
#
# Usage: bash scripts/fetch-templates.sh
#
# For gated models (Google Gemma, Meta Llama, CohereForAI), set HF_TOKEN:
#   HF_TOKEN=hf_xxx bash scripts/fetch-templates.sh
#
# Requirements: curl, python3

set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)/test-templates"
mkdir -p "$DIR"

AUTH_HEADER=""
if [ -n "${HF_TOKEN:-}" ]; then
  AUTH_HEADER="Authorization: Bearer $HF_TOKEN"
  echo "Using HF_TOKEN for authenticated access"
fi

EXTRACT_PY='
import sys, json

config = json.load(sys.stdin)
ct = config.get("chat_template", "")

if isinstance(ct, list):
    for entry in ct:
        name = entry.get("name", "default")
        template = entry.get("template", "")
        if template:
            print(f"NAMED:{name}")
            print(template)
            print("END_TEMPLATE")
elif isinstance(ct, str) and ct:
    print("NAMED:__single__")
    print(ct)
    print("END_TEMPLATE")
'

fetch() {
  local model_id="$1"
  local base_filename
  base_filename="$(echo "$model_id" | tr '/' '-')"
  local url="https://huggingface.co/${model_id}/resolve/main/tokenizer_config.json"

  echo "Fetching $model_id ..."
  local config
  local curl_args=(-sfL)
  if [ -n "$AUTH_HEADER" ]; then
    curl_args+=(-H "$AUTH_HEADER")
  fi
  config=$(curl "${curl_args[@]}" "$url") || { echo "  FAILED to fetch $model_id (may require HF_TOKEN for gated models)"; return 1; }

  local current_name=""
  local current_template=""
  local in_template=false
  local found=false

  while IFS= read -r line; do
    if [[ "$line" == NAMED:* ]]; then
      current_name="${line#NAMED:}"
      current_template=""
      in_template=true
    elif [[ "$line" == "END_TEMPLATE" ]]; then
      in_template=false
      found=true
      local filename
      if [[ "$current_name" == "__single__" ]]; then
        filename="${base_filename}.jinja"
      else
        filename="${base_filename}-${current_name}.jinja"
      fi
      if [ -f "$DIR/$filename" ]; then
        echo "  Already exists: $filename"
      else
        printf '%s\n' "$current_template" > "$DIR/$filename"
        echo "  Saved $filename"
      fi
    elif $in_template; then
      if [ -z "$current_template" ]; then
        current_template="$line"
      else
        current_template="$current_template
$line"
      fi
    fi
  done < <(echo "$config" | python3 -c "$EXTRACT_PY" 2>/dev/null)

  if ! $found; then
    echo "  No chat_template found for $model_id"
    return 1
  fi
}

# Models referenced by test-capabilities.mjs and test-tool-rendering.mjs
# Public models (no auth required):
fetch "Qwen/QwQ-32B"
fetch "Qwen/Qwen3-Coder-30B-A3B-Instruct"
fetch "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B"
fetch "meetkai/functionary-medium-v3.1"
fetch "meetkai/functionary-medium-v3.2"
fetch "MiniMaxAI/MiniMax-Text-01"
fetch "mistralai/Mistral-7B-Instruct-v0.2"
fetch "mistralai/Mistral-Nemo-Instruct-2407"
fetch "NousResearch/Hermes-3-Llama-3.1-70B"
fetch "NousResearch/Hermes-2-Pro-Llama-3-8B"

# Gated models (require HF_TOKEN):
fetch "google/gemma-7b-it" || true
fetch "meta-llama/Llama-3.1-8B-Instruct" || true
fetch "meta-llama/Llama-3.2-3B-Instruct" || true
fetch "meta-llama/Llama-3.3-70B-Instruct" || true
fetch "CohereForAI/c4ai-command-r-plus" || true
fetch "CohereForAI/c4ai-command-r7b-12-2024" || true

echo ""
echo "Done. Templates saved to: $DIR"
ls -1 "$DIR"
