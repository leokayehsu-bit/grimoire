#!/bin/sh
# Render icons/icon.svg to the PNG sizes the app manifest and iOS need, using headless Chrome.
# Usage: tools/icons.sh
set -e
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP=$(mktemp -d)
for spec in "icon-192:192:0" "icon-512:512:0" "icon-maskable-512:512:1" "apple-touch-icon:180:0"; do
  name=${spec%%:*}; rest=${spec#*:}; size=${rest%%:*}; mask=${rest#*:}
  # Maskable icons are cropped to a circle by Android, so shrink the art into the safe zone.
  scale=1; [ "$mask" = 1 ] && scale=0.8
  cat > "$TMP/$name.html" <<EOF
<!doctype html><html><body style="margin:0;background:#0b0810;width:${size}px;height:${size}px;overflow:hidden;display:grid;place-items:center">
<img src="file://$PWD/icons/icon.svg" style="width:calc(${size}px * $scale);height:calc(${size}px * $scale)"></body></html>
EOF
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --window-size="$size,$size" --screenshot="$PWD/icons/$name.png" "file://$TMP/$name.html" 2>/dev/null
  echo "icons/$name.png"
done
rm -rf "$TMP"
