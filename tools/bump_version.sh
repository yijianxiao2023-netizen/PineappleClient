#!/usr/bin/env sh
# Bust browser caches after changing the game: stamps a new ?v= on every module import.
cd "$(dirname "$0")/../docs" || exit 1
V=$(date +%s)
sed -i -E "s#from \"\./(data|sim|ai|render)\.js(\?v=[0-9]+)?\"#from \"./\1.js?v=$V\"#g" js/*.js
sed -i -E "s#js/main\.js(\?v=[0-9]+)?#js/main.js?v=$V#; s#css/style\.css(\?v=[0-9]+)?#css/style.css?v=$V#" index.html
sed -i -E "s#data/map\.json(\?v=[0-9]+)?\"#data/map.json?v=$V\"#" js/main.js
echo "version $V"
