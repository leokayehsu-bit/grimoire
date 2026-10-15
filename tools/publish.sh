#!/bin/sh
# Publish Grimoire to GitHub Pages: run the solver test, stamp a new version on every
# script/stylesheet link (so browsers never mix old and new files), commit and push.
# Usage: tools/publish.sh "What changed"
set -e
cd "$(dirname "$0")/.."
msg=${1:-"Update Grimoire"}

# Never publish a build that fails the solver test.
if ! out=$(node tests/check.js 300 6000 2>&1); then
  echo "$out" | tail -40
  echo "Tests failed — nothing was published."
  exit 1
fi
echo "$out" | tail -1
v=$(date +%Y%m%d%H%M)
sed -i '' -E "s#((src|href)=\"(js|css)/[^\"?]+)(\?v=[0-9]+)?\"#\1?v=$v\"#g" index.html
# A new worker version makes installed apps pick up this release.
sed -i '' -E "s/^const VERSION = '[^']*';/const VERSION = '$v';/" sw.js

git add -A
git commit -q -m "$msg"
git push -q
echo "Pushed version $v. Live in about a minute at https://leokayehsu-bit.github.io/grimoire/"
