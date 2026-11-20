# Iron Dawn: 1936

A grand strategy game of Europe on the eve of the Second World War, in the spirit of Hearts of Iron. It runs entirely in the browser.

**Play:** https://yijianxiao2023-netizen.github.io/PineappleClient/

## The game

- **939 provinces** on a real map of Europe, North Africa and the Middle East, with the 1936 borders (East Prussia, the Polish Corridor, Czechoslovakia, Yugoslavia, the colonial empires).
- **32 nations.** You can play any of them. The starting teams follow history: the **Allies** (UK, France, Poland, the Low Countries, Scandinavia, Greece, Yugoslavia, Czechoslovakia), the **Axis** (Germany, Italy, Hungary, Romania, Bulgaria) and the **Comintern** (USSR).
- **Every match is different.** Nothing is scripted: the AI decides who attacks whom, and when.
- **Economy:** civilian factories build, military factories produce infantry equipment and tanks, and manpower limits your army. Captured factories work at reduced output.
- **Research:** industry, land, armor, doctrines and electronics, with a penalty for researching ahead of time.
- **National focuses:** a shared tree plus extra national focuses for the five great powers.
- **Warfare:** infantry and armored divisions, terrain, forts, entrenchment, organization and strength, supply lines, retreats and encirclements, sea crossings, and naval invasions that depend on navy strength.
- **Diplomacy:** factions, war goals, declarations of war, guarantees, and joining, founding or inviting countries to factions. Countries capitulate when they lose their core territory.
- The game ends in 1950.

## Controls

| Input | Action |
|---|---|
| Space / 1–5 | Pause and game speed |
| Drag / scroll | Pan and zoom (arrow keys also pan) |
| Click a counter | Select divisions (Shift adds more, Shift-drag box-selects) |
| Right-click a province | Move or attack |
| F R P A D | Focus, Research, Industry, Army, Diplomacy |
| M | Political or faction map mode |
| Esc | Deselect or close |

## Project layout

```
docs/                  the game (served by GitHub Pages)
  index.html, css/style.css
  js/data.js           countries, factions, techs, focuses, units
  js/sim.js            simulation: economy, movement, combat, supply, diplomacy
  js/ai.js             AI: economy, research, focus, war decisions, front lines
  js/render.js         canvas map renderer
  js/main.js           UI and input
  data/map.json        generated province map
tools/build_map.mjs    builds map.json from Natural Earth data (npm install && npm run build-map)
```

Pushing to `main` deploys the `docs/` folder to GitHub Pages through `.github/workflows/pages.yml`.
In the repo, **Settings → Pages → Source** must be set to **GitHub Actions**.

Map data: Natural Earth, via the `world-atlas` package.
