#!/usr/bin/env bash
# Pulls a Poly Haven texture set (CC0) into textures/<name>/ as the four maps
# the floor uses. Run it from the floor/ folder:
#
#   ./tools/fetch-polyhaven.sh carpet_red_01 2k
#   ./tools/fetch-polyhaven.sh dark_wood 2k
#   ./tools/fetch-polyhaven.sh marble_01 2k
#
# Browse names at https://polyhaven.com/textures. Then in src/materials.js swap
# the generated material for:  loadPBR('carpet_red_01', { repeat: 12 })
set -e
NAME="$1"; RES="${2:-2k}"
[ -z "$NAME" ] && { echo "usage: $0 <polyhaven-texture-id> [1k|2k|4k]"; exit 1; }
cd "$(dirname "$0")/.."
OUT="textures/$NAME"
mkdir -p "$OUT"
BASE="https://dl.polyhaven.org/file/ph-assets/Textures/jpg/$RES/$NAME"
for MAP in diff nor_gl rough ao disp; do
  URL="$BASE/${NAME}_${MAP}_${RES}.jpg"
  if curl -fsSL "$URL" -o "$OUT/$MAP.jpg"; then
    echo "  got $MAP"
  else
    rm -f "$OUT/$MAP.jpg"
    echo "  no $MAP for this set (fine, it is optional)"
  fi
done
echo "saved to $OUT"
