#!/bin/bash
cd "$(dirname "$0")"
osascript <<'APPLESCRIPT'
tell application "Terminal"
  activate
  do script "cd /Users/tudo/maskara && export MASKARA_SSH_HOST=148.135.137.47 && bash scripts/deploy-vps.sh; echo ''; read -p 'Press Enter to close'"
end tell
APPLESCRIPT
