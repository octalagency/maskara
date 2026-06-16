#!/bin/bash
cd "$(dirname "$0")"
echo "=== Maskara Docker Build + Push ==="
echo "User: octalagency"
echo ""

if ! docker ps &>/dev/null; then
  echo "ERROR: Docker Desktop is not running!"
  echo "Open Docker Desktop and run this script again."
  read -p "Press Enter to exit..."
  exit 1
fi

chmod +x build-push.sh
./build-push.sh 2>&1 | tee docker-push.log

echo ""
echo "Log saved to: $(pwd)/docker-push.log"
echo "Check Docker Hub: https://hub.docker.com/u/octalagency"
read -p "Press Enter to close..."
