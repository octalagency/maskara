#!/bin/bash
set -e

# Maskara — one-command build + push to Docker Hub
# Usage: ./build-push.sh
#        DOCKER_USERNAME=otheruser ./build-push.sh

export DOCKER_USERNAME="${DOCKER_USERNAME:-octalagency}"
export IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "Docker Hub user: $DOCKER_USERNAME"
echo ""

# Check docker is running
if ! docker ps &>/dev/null; then
  echo "ERROR: Docker is not running."
  echo "Open Docker Desktop, then run this script again."
  exit 1
fi

# Check login
if ! docker info 2>/dev/null | grep -q "Username"; then
  if [ -z "$(docker system info 2>/dev/null)" ]; then
    echo "Logging in to Docker Hub..."
    docker login || { echo "Run: docker login"; exit 1; }
  fi
fi

exec "$(dirname "$0")/scripts/docker-push.sh"
