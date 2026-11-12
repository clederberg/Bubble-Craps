#!/usr/bin/env bash
# Bundles src/ and the three.js it uses into floor.bundle.js, which is the only
# script the page loads. Run from the floor/ folder:
#   npm install three@0.169.0 esbuild && ./tools/build.sh
set -e
cd "$(dirname "$0")/.."
./node_modules/.bin/esbuild src/boot.js \
  --bundle --format=esm --minify --target=es2020 \
  --alias:three=./node_modules/three/build/three.module.js \
  --alias:three/addons=./node_modules/three/examples/jsm \
  --outfile=floor.bundle.js
ls -lh floor.bundle.js
