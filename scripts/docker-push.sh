#!/bin/bash
set -e

# Usage:
#   DOCKER_USERNAME=yourhubuser ./scripts/docker-push.sh
#   DOCKER_USERNAME=yourhubuser IMAGE_TAG=v1.0.0 ./scripts/docker-push.sh

cd "$(dirname "$0")/.."

DOCKER_USERNAME="${DOCKER_USERNAME:-octalagency}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY="${REGISTRY:-docker.io}"

# Production domain URLs (baked into frontend at build time)
NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://api.maskara.bd}"
NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-https://app.maskara.bd}"
NEXT_PUBLIC_PRODUCTION="${NEXT_PUBLIC_PRODUCTION:-true}"

if ! docker ps &>/dev/null; then
  echo "ERROR: Cannot connect to Docker. Is Docker Desktop running?"
  exit 1
fi

BACKEND_IMAGE="$REGISTRY/$DOCKER_USERNAME/maskara-backend:$IMAGE_TAG"
FRONTEND_IMAGE="$REGISTRY/$DOCKER_USERNAME/maskara-frontend:$IMAGE_TAG"

echo "=== Maskara — Building Docker Images ==="
echo "Backend:  $BACKEND_IMAGE"
echo "Frontend: $FRONTEND_IMAGE"
echo ""

echo "Building backend..."
docker build -t "$BACKEND_IMAGE" ./backend

echo "Building frontend..."
docker build \
  --build-arg "NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL" \
  --build-arg "NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL" \
  --build-arg "NEXT_PUBLIC_PRODUCTION=$NEXT_PUBLIC_PRODUCTION" \
  -t "$FRONTEND_IMAGE" ./frontend

echo ""
echo "=== Pushing to $REGISTRY ==="

echo "Pushing backend..."
docker push "$BACKEND_IMAGE"

echo "Pushing frontend..."
docker push "$FRONTEND_IMAGE"

# Also tag as latest if using a version tag
if [ "$IMAGE_TAG" != "latest" ]; then
  docker tag "$BACKEND_IMAGE" "$REGISTRY/$DOCKER_USERNAME/maskara-backend:latest"
  docker tag "$FRONTEND_IMAGE" "$REGISTRY/$DOCKER_USERNAME/maskara-frontend:latest"
  docker push "$REGISTRY/$DOCKER_USERNAME/maskara-backend:latest"
  docker push "$REGISTRY/$DOCKER_USERNAME/maskara-frontend:latest"
fi

echo ""
echo "=== Push Complete ==="
echo "Backend:  $BACKEND_IMAGE"
echo "Frontend: $FRONTEND_IMAGE"
echo ""
echo "Deploy with:"
echo "  docker pull $BACKEND_IMAGE"
echo "  docker pull $FRONTEND_IMAGE"
