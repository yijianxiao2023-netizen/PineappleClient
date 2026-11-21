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
- **Units, each with its own icon and color:** Infantry, Anti-Tank, Light Tanks, Armored divisions, Fighters, Bombers and Battle Fleets. A legend sits on the map (toggle with `L`).
- **Movement takes real time.** At speed 3, infantry takes about 5 seconds per province, tanks about 3, and aircraft and fleets about 1 to 2. Moving units slide across the map, and every province on the route gets its own arrow that fills up as the unit crosses it.
- **Warfare:** terrain, forts, entrenchment, organization and strength, supply lines, retreats and encirclements. Anti-tank divisions blunt tank attacks. Fighters win air superiority, and bombers boost nearby battles. Fleets fight each other, bombard coastal battles and decide naval invasions.
- **More land means more factories, gear and money.** Every province you control adds industry and daily income, and you can use the factories you capture. Money pays for every unit and building.
- **Economy:** income comes from land and factories. Greece earns about $75k a day and Germany about $300k. Attacking without a war goal costs a $10,000 war tax.
- **Attack anyone:** send your units onto another country's land or units. If you aren't at war yet, you'll confirm, and then war is declared on them and their faction. Every province you take becomes yours and turns your color.
- **Health bars:** each unit shows how many soldiers it has left. Hover over a counter to see them, and click a battle to see both sides.
- **Betrayal:** attack an ally's unit to leave your faction and join the other side for the rest of the match. AI allies never betray you first.
- **Unit tiers I to V:** research better tiers for every unit type, from 100% to 200% combat power. New units train at your best tier, and you can upgrade older ones.
- **Upkeep:** every unit costs money every day, and higher tiers cost more. If you go broke, your army loses organization.
- **Manpower** grows every second. Research **Housing I to V** (+25% each) and conquer land to grow it faster.
- **Battle Log** (`B`): a separate channel listing everything every country does, including research, war-goal justifications, declarations of war, capitulations and alliances.
- **Diplomacy:** factions, war goals, declarations of war, guarantees, and joining, founding or inviting countries to factions. Countries capitulate when they lose their core territory.
- The game ends in 1950.

## Controls

| Input | Action |
|---|---|
| Space / 1–5 | Pause and game speed |
| Drag / scroll | Pan and zoom (arrow keys also pan) |
| Click a counter, then click a province | Move or attack (right-click also works) |
| Shift-click / Shift-drag | Add to selection / box-select |
| F R P A D | Focus, Research, Industry, Army, Diplomacy |
| B | Battle Log |
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

GitHub Pages serves the repo root, and `index.html` there forwards to `docs/`, where the game lives. If you switch **Settings → Pages → Source** to **GitHub Actions**, run the `Deploy game to GitHub Pages` workflow by hand to publish `docs/` directly.

Map data: Natural Earth, via the `world-atlas` package.
