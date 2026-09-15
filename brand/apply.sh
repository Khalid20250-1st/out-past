#!/bin/bash
# Reskin Out Past from ONE image.
#
# HOW TO USE:
#   1. Put your logo image at:  ~/Desktop/Out Past Logo/logo.png  (square, 1024x1024 best)
#   2. Tell Claude "build" — it runs this and deploys.
#
# It makes the Mac app icon AND the in-app logo from that same file, so they
# always match. Your image is used exactly as given, corners and all.

set -e
cd "$(dirname "$0")/.."
SRC="$HOME/Desktop/Out Past Logo/logo.png"
# Fall back to the in-repo copy if the Desktop folder is not there.
[ -f "$SRC" ] || SRC="brand/logo.png"
[ -f "$SRC" ] || { echo "No logo found. Put your image at ~/Desktop/Out Past Logo/logo.png"; exit 1; }
echo "Using logo: $SRC"
cp "$SRC" brand/logo.png

# 1) in-app logo = the exact same image the renderer shows everywhere
cp "$SRC" src/assets/app-logo.png

# 2) Mac app icon (.icns) built from the same image
python3 - "$SRC" <<'PY'
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGBA")
if im.size != (1024, 1024):
    im = im.resize((1024, 1024), Image.LANCZOS)
import os
os.makedirs("build/op.iconset", exist_ok=True)
R = lambda s: im.resize((s, s), Image.LANCZOS)
for s in [16, 32, 64, 128, 256, 512, 1024]:
    R(s).save(f"build/op.iconset/icon_{s}x{s}.png")
for base, two in [(16,32),(32,64),(128,256),(256,512),(512,1024)]:
    R(two).save(f"build/op.iconset/icon_{base}x{base}@2x.png")
im.save("build/icon.png")
print("iconset rendered")
PY
iconutil -c icns build/op.iconset -o build/icon.icns
rm -rf build/op.iconset
echo "Done. Icon: build/icon.icns   In-app: src/assets/app-logo.png"
echo "Next: npm run build, then deploy."
