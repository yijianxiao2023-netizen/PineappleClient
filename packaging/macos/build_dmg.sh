#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT="$(pwd)"
APP=PineappleClient
WORK="$ROOT/build/macos"
rm -rf "$WORK" "$ROOT/dist"
mkdir -p "$WORK/$APP.iconset" "$ROOT/dist"

if ! ls launcher/mods/pineappleclient-*.jar >/dev/null 2>&1; then
  echo "Mod jar missing in launcher/mods. Run ./build_mod.sh first." >&2
  exit 1
fi

for s in 16 32 128 256 512; do
  sips -z $s $s docs/img/icon-1024.png --out "$WORK/$APP.iconset/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2))
  sips -z $d $d docs/img/icon-1024.png --out "$WORK/$APP.iconset/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$WORK/$APP.iconset" -o "$WORK/$APP.icns"

python3 -m pip install -q -r launcher/requirements.txt pyinstaller
python3 -m PyInstaller --noconfirm --clean --windowed \
  --name "$APP" \
  --icon "$WORK/$APP.icns" \
  --osx-bundle-identifier com.slaxy.pineappleclient \
  --collect-all minecraft_launcher_lib \
  --add-data "launcher/mods:mods" \
  --distpath "$WORK/dist" --workpath "$WORK/pyi" --specpath "$WORK" \
  launcher/launcher.py

codesign --force --deep --sign - "$WORK/dist/$APP.app"

STAGE="$WORK/dmg"
mkdir -p "$STAGE"
cp -R "$WORK/dist/$APP.app" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname "$APP" -srcfolder "$STAGE" -ov -format UDZO "$ROOT/dist/$APP.dmg"
echo "Built dist/$APP.dmg"
