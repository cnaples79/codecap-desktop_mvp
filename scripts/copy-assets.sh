#!/bin/sh
# Copy non-compiled assets (HTML files, icons, CSS) to the dist directory.
set -e
ROOT="$(dirname "$0")/.."
DIST="$ROOT/dist"

# Create necessary directories
mkdir -p "$DIST/renderer"
mkdir -p "$DIST/assets"

# Copy HTML files
cp "$ROOT/src/renderer"/*.html "$DIST/renderer" 2>/dev/null || true

# Copy CSS if any
if [ -d "$ROOT/src/renderer/styles" ]; then
  mkdir -p "$DIST/renderer/styles"
  cp "$ROOT/src/renderer/styles"/* "$DIST/renderer/styles" 2>/dev/null || true
fi

# Copy static assets
if [ -d "$ROOT/assets" ]; then
  cp -R "$ROOT/assets" "$DIST/"
fi