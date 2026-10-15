#!/bin/sh
# Publish Grimoire to GitHub Pages: run the solver test, stamp a new version on every
# script/stylesheet link (so browsers never mix old and new files), commit and push.
# Usage: tools/publish.sh "What changed"
set -e
cd "$(dirname "$0")/.."
msg=${1:-"Update Grimoire"}

node tests/check.js 300 5000 | tail -1
v=$(date +%Y%m%d%H%M)
sed -i '' -E "s#((src|href)=\"(js|css)/[^\"?]+)(\?v=[0-9]+)?\"#\1?v=$v\"#g" index.html

git add -A
git commit -q -m "$msg"
git push -q
echo "Pushed version $v. Live in about a minute at https://leokayehsu-bit.github.io/grimoire/"
