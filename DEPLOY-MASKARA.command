#!/bin/bash
cd "$(dirname "$0")"
osascript <<'APPLESCRIPT'
tell application "Terminal"
  activate
  do script "cd /Users/tudo/maskara && bash scripts/deploy-from-mac.sh; echo ''; echo 'Finished — open https://app.maskara.bd/admin'; read -p 'Press Enter to close this window'"
end tell
APPLESCRIPT
