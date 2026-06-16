#!/bin/bash
# Open Docker Desktop (works when Docker.app wrapper is broken)

BIN="/Applications/Docker.app/Contents/MacOS/Docker Desktop.app/Contents/MacOS/Docker Desktop"
if [ -x "$BIN" ]; then
  "$BIN" &>/dev/null &
  echo "Docker Desktop binary started"
  exit 0
fi

PATHS=(
  "/Applications/Docker.app/Contents/MacOS/Docker Desktop.app"
  "/Applications/Docker.app"
  "$HOME/Applications/Docker.app/Contents/MacOS/Docker Desktop.app"
)

for p in "${PATHS[@]}"; do
  if [ -e "$p" ]; then
    open "$p" 2>/dev/null && echo "Opened: $p" && exit 0
  fi
done

echo "Docker Desktop খুঁজে পাওয়া যায়নি।"
echo "DOCKER-INSTALL.command চালান — নতুন install করতে হবে।"
exit 1
