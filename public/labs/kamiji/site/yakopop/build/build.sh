#!/bin/sh
# Rebuilds site/yakopop/assets/yakopop-demo.{js,css} from READ-ONLY copies of the yakopop sources.
# Usage: sh build.sh [path to the yakopop checkout]   (default /Users/paulbloch/Documents/github/yakopop)
# Works in a temp dir; nothing is installed or built inside the yakopop repository.
set -e
Y="${1:-/Users/paulbloch/Documents/github/yakopop}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../assets"
T="$(mktemp -d /tmp/yk-build.XXXXXX)"
cd "$T"
echo '{"name":"yk-build","private":true,"type":"module"}' > package.json
npm install --save-exact esbuild@0.25.10 react@18.3.1 react-dom@18.3.1
mkdir -p src/overlay src/shared src/talk/meeting/logic
cp -R "$Y/packages/overlay/src/." src/overlay/
rm -f src/overlay/player/*.test.ts
for f in types text langs fonts subtitles; do cp "$Y/packages/shared/src/$f.ts" src/shared/; done
printf 'export * from "./types";\nexport * from "./text";\nexport { LANGS } from "./langs";\nexport * from "./fonts";\nexport * from "./subtitles";\n' > src/shared/index.ts
M="$Y/apps/world/src/features/meeting"
cp -R "$M/talkLangs" src/talk/meeting/talkLangs && rm -f src/talk/meeting/talkLangs/*.test.ts
cp "$M/dialogue.ts" src/talk/meeting/
cp "$M/logic/talkView.ts" src/talk/meeting/logic/
cp "$HERE/entry.tsx" src/entry.tsx
cp "$HERE/build.mjs" build.mjs
node build.mjs dist
cp dist/yakopop-demo.js dist/yakopop-demo.css "$OUT/"
echo "built into $OUT (temp dir $T)"
