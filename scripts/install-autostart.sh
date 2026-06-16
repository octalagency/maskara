#!/bin/bash
# One-time: double-click START-API.command instead if you prefer manual start
PLIST="$HOME/Library/LaunchAgents/com.maskara.api.plist"
NODE="/Applications/Cursor.app/Contents/Resources/app/resources/helpers/node"
DIR="/Users/tudo/maskara"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.maskara.api</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$DIR/standalone-api/server.js</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$DIR/standalone-api.log</string>
  <key>StandardErrorPath</key>
  <string>$DIR/standalone-api.error.log</string>
</dict>
</plist>
EOF

launchctl load "$PLIST" 2>/dev/null || launchctl bootstrap gui/$(id -u) "$PLIST" 2>/dev/null || true
echo "✓ Maskara API auto-start installed"
