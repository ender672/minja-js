#!/usr/bin/env bash
# Builds the diff-fuzz-render C++ binary used by diff-fuzz.js.
#
# Downloads the C++ minja headers and nlohmann/json into a local
# .deps/ directory, then compiles diff-fuzz-render.cpp against them.
#
# Usage:
#   bash scripts/build-diff-fuzz-render.sh
#
# Requirements: c++ compiler with C++17 support, curl, git

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPS_DIR="$SCRIPT_DIR/../.deps"
OUT="$SCRIPT_DIR/diff-fuzz-render"

mkdir -p "$DEPS_DIR"

# Fetch C++ minja (header-only)
if [ ! -d "$DEPS_DIR/minja" ]; then
    echo "Cloning ochafik/minja..."
    git clone --depth 1 https://github.com/ochafik/minja.git "$DEPS_DIR/minja"
else
    echo "Using cached $DEPS_DIR/minja"
fi

# Fetch nlohmann/json (single-include header)
if [ ! -f "$DEPS_DIR/nlohmann/json.hpp" ]; then
    echo "Downloading nlohmann/json..."
    mkdir -p "$DEPS_DIR/nlohmann"
    curl -sfL https://github.com/nlohmann/json/releases/download/v3.11.3/json.hpp \
        -o "$DEPS_DIR/nlohmann/json.hpp"
else
    echo "Using cached $DEPS_DIR/nlohmann/json.hpp"
fi

echo "Compiling diff-fuzz-render..."
c++ -std=c++17 -O2 \
    -I"$DEPS_DIR/minja/include" \
    -I"$DEPS_DIR" \
    -o "$OUT" \
    "$SCRIPT_DIR/diff-fuzz-render.cpp"

echo "Built: $OUT"
echo ""
echo "Run the fuzzer with:"
echo "  node scripts/diff-fuzz.js --cpp-bin $OUT"
