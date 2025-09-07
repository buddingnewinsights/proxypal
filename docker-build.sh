#!/usr/bin/env bash
#
# build.sh - Linux/macOS Build Script
#
# This script automates the process of building and running the Docker container
# with version information dynamically injected at build time.

# Exit immediately if a command exits with a non-zero status.
set -euo pipefail

# --- Step 1: Choose Environment ---
echo "Please select your environment:"
echo "1) Local Development (Build and Run)"
echo "2) Remote Deployment (Run from Image)"
read -r -p "Enter choice [1-2]: " choice

# --- Step 2: Execute based on choice ---
case "$choice" in
  1)
    echo "--- Starting Local Development Environment ---"

    # Get Version Information
    VERSION="$(git describe --tags --always --dirty)"
    COMMIT="$(git rev-parse --short HEAD)"
    BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

    echo "Building with the following info:"
    echo "  Version: ${VERSION}"
    echo "  Commit: ${COMMIT}"
    echo "  Build Date: ${BUILD_DATE}"
    echo "----------------------------------------"

    # Build the Docker Image
    docker compose build \
      --build-arg VERSION="${VERSION}" \
      --build-arg COMMIT="${COMMIT}" \
      --build-arg BUILD_DATE="${BUILD_DATE}"

    # Start the Services
    docker compose up -d --remove-orphans

    echo "Build complete. Services are starting."
    echo "Run 'docker compose logs -f' to see the logs."
    ;;
  2)
    echo "--- Starting Remote Deployment Environment ---"
    docker compose -f docker-compose.yml -f docker-compose.remote.yml up -d
    echo "Services are starting from remote image."
    echo "Run 'docker compose logs -f' to see the logs."
    ;;
  *)
    echo "Invalid choice. Please enter 1 or 2."
    exit 1
    ;;
esac