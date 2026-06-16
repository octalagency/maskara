#!/bin/bash
cd "$(dirname "$0")/.."
export PATH="$(pwd)/.tools/node/bin:$PATH"

if ! command -v node &>/dev/null; then
  echo "Node install হচ্ছে..."
  mkdir -p .tools
  curl -fsSL https://nodejs.org/dist/v22.16.0/node-v22.16.0-darwin-arm64.tar.gz -o .tools/node.tar.gz
  tar -xzf .tools/node.tar.gz -C .tools
  mv .tools/node-v22.16.0-darwin-arm64 .tools/node
  rm .tools/node.tar.gz
  export PATH="$(pwd)/.tools/node/bin:$PATH"
fi

# Stop old API on port 4000
if lsof -ti:4000 &>/dev/null; then
  echo "Port 4000 বন্ধ করা হচ্ছে..."
  lsof -ti:4000 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

load_env() {
  [ -f .env ] && export $(grep -v '^#' .env | xargs) 2>/dev/null || true
}
load_env

echo "Starting Maskara Standalone API on :${PORT:-4000}..."
exec node standalone-api/server.js
