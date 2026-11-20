#!/usr/bin/env sh
set -e
cd "$(dirname "$0")/mod"
./gradlew build
rm -f ../launcher/mods/pineappleclient-*.jar
for f in build/libs/pineappleclient-*.jar; do
  case "$f" in *sources*) ;; *) cp "$f" ../launcher/mods/ ;; esac
done
echo "Mod built and copied to launcher/mods"
