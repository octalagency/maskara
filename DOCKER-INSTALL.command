#!/bin/bash
echo "=== Docker Desktop Install ==="
echo ""
echo "আপনার Docker.app ভাঙা (executable missing)."
echo "নতুন install করতে হবে।"
echo ""
open "https://www.docker.com/products/docker-desktop/" 2>/dev/null || true
echo "1. Download Docker Desktop for Mac"
echo "2. Install করুন"
echo "3. Docker open করুন — whale icon stable হওয়া পর্যন্ত wait"
echo "4. FIX.command double-click করুন:"
echo "   /Users/tudo/maskara/FIX.command"
echo ""
read -p "Press Enter to close..."
