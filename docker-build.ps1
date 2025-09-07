# build.ps1 - Windows PowerShell Build Script
#
# This script automates the process of building and running the Docker container
# with version information dynamically injected at build time.

# Stop script execution on any error
$ErrorActionPreference = "Stop"

# --- Step 1: Choose Environment ---
Write-Host "Please select your environment:"
Write-Host "1) Local Development (Build and Run)"
Write-Host "2) Remote Deployment (Run from Image)"
$choice = Read-Host -Prompt "Enter choice [1-2]"

# --- Step 2: Execute based on choice ---
switch ($choice) {
    "1" {
        Write-Host "--- Starting Local Development Environment ---"

        # Get Version Information
        $VERSION = (git describe --tags --always --dirty)
        $COMMIT  = (git rev-parse --short HEAD)
        $BUILD_DATE = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

        Write-Host "Building with the following info:"
        Write-Host "  Version: $VERSION"
        Write-Host "  Commit: $COMMIT"
        Write-Host "  Build Date: $BUILD_DATE"
        Write-Host "----------------------------------------"

        # Build the Docker Image
        docker compose build --build-arg VERSION=$VERSION --build-arg COMMIT=$COMMIT --build-arg BUILD_DATE=$BUILD_DATE

        # Start the Services
        docker compose up -d --remove-orphans

        Write-Host "Build complete. Services are starting."
        Write-Host "Run 'docker compose logs -f' to see the logs."
    }
    "2" {
        Write-Host "--- Starting Remote Deployment Environment ---"
        docker compose -f docker-compose.yml -f docker-compose.remote.yml up -d
        Write-Host "Services are starting from remote image."
        Write-Host "Run 'docker compose logs -f' to see the logs."
    }
    default {
        Write-Host "Invalid choice. Please enter 1 or 2."
        exit 1
    }
}