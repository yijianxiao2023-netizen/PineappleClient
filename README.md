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
- **Movement takes real time.** One game day takes 10 minutes at speed 1 (5 min at 2, 2.5 min at 3, 1 min at 4, 30 s at 5, 15 s at 10, 6 s at 25). Infantry needs about 25 seconds per province at speed 1. Research takes at most 42 game days (7 hours at speed 1). Moving units slide across the map, and every province on the route gets its own arrow that fills up as the unit crosses it.
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
- **Diplomacy:** factions, war goals, declarations of war and guarantees. Open **Diplomacy…** on any country to propose alliances, **demand gold**, **demand territory**, **demand they become your puppet**, or send **peace treaties** that demand gold, land or a puppet (or offer white peace or concessions). Puppets fight for you and pay 25% of their income, and you can annex them after 180 days. Peace brings a one-year truce. AIs ally with each other, make demands and peace offers to each other, and send them to you as popups you can accept or refuse. Refusing a demand gives the demander a free war goal.
- Countries capitulate when they lose their core territory.
- The game ends in 1950.

## Controls

| Input | Action |
|---|---|
| Space | Cycle speed: paused → 1 → 2 → 3 → 4 → 5 → 10 → 25 → paused |
| 1–7 | Jump to a speed (6 = speed 10, 7 = speed 25) |
| Right-drag / scroll | Move around the map and zoom (arrow keys also pan; right-click without dragging cancels) |
| Click a counter, then click a province | Move or attack (right-click also works) |
| Shift/Ctrl/⌘-click, Shift-drag | Add to selection / box-select |
| G | Select all your land units |
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

## One unit per tile, capitals and AI strategy

- Each tile holds one land unit (plus one air wing and one fleet). New units appear on a free tile of your land, so you can only train while you have room.
- Groups spread out around their destination; groups sent at an enemy tile attack it together from different sides.
- Capturing a capital annexes the whole country and disbands its units. Capitals defend at double strength.
- Each AI picks a strategy per match (Blitzkrieg, Broad Front, Defense in Depth, Encirclement, Attrition). Allies coordinate a joint offensive target, launch joint attacks, and send help when an ally's capital is threatened.
- Research now includes extra armor (Reliability, High-Velocity Guns, Blitzkrieg, Mechanized, Super-Heavy), navy (Fire Control, Hulls, Submarines, Naval Radar, Carriers) and air (Strategic, Dive and Heavy Bombers, Escort Fighters, Jets) techs.

## Fleets and naval landings

- The sea is divided into water tiles (built by `tools/add_sea.mjs`). Fleets move only on water.
- Select a fleet and press **Board nearby units** to load up to 3 land units within 3 tiles of it. Sail, press **Unload…**, then left-click a land tile within 3 tiles of the fleet to land them.
- Land units can no longer cross water on their own. The AI ferries invasions with its fleets.

## Bombers

Select a bomber wing and left-click an enemy tile within its range (dashed circle, twice the fighter range). It flies there, bombs units (or factories and forts if the tile is empty) and returns to base. Enemy fighters near the target shoot back; your fighters nearby escort.

When a fleet is selected, **Choose units to board…** lets you click exactly which units to load, on the map or in the list.
