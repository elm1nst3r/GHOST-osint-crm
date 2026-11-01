#!/bin/sh
set -e

echo "🔧 Setting up permissions for upload directories..."

# Create upload directories if they don't exist
mkdir -p /usr/src/app/public/uploads/logos
mkdir -p /usr/src/app/data/files

# Fix permissions for the nodejs user
# This ensures the app can write to mounted volumes regardless of host UID/GID
chown -R nodejs:nodejs /usr/src/app/public 2>/dev/null || true
# Uploaded files (issue #97). A new named volume is created root-owned.
chown -R nodejs:nodejs /usr/src/app/data 2>/dev/null || true

echo "✅ Permissions configured successfully"

# Execute the main container command
exec "$@"
