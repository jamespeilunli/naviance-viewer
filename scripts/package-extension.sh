#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/.extension-package"
ZIP_FILE="$ROOT_DIR/naviance-viewer-release.zip"

cd "$ROOT_DIR"

rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR/content"

cp manifest.json "$PACKAGE_DIR/"
cp -R background dist export icons options parser storage ui "$PACKAGE_DIR/"
cp content/page-script.js "$PACKAGE_DIR/content/page-script.js"

rm -f "$ZIP_FILE"
(
  cd "$PACKAGE_DIR"
  zip -r "$ZIP_FILE" . -x "*.DS_Store"
)

rm -rf "$PACKAGE_DIR"

echo "Created $ZIP_FILE"
