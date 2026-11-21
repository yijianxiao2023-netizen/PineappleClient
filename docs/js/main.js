import { COUNTRIES, UNIT, UNIT_ORDER, BUILD, TECHS, IDEOLOGY, TERRAIN, FACTIONS, ROMAN, TIER_MULT } from "./data.js?v=1795222749";
import { Game, dateStr } from "./sim.js?v=1795222749";
import { runAI, aiAcceptsFaction } from "./ai.js?v=1795222749";
import { MapView, drawUnitIcon } from "./render.js?v=1795222749";

const $ = id => document.getElementById(id);
const SPEEDS = [0, 2, 4, 8, 20, 60];
const END = Date.UTC(1950, 0, 1);
const fmt = n => { const a = Math.abs(n), sg = n < 0 ? "-" : ""; return a >= 1e9 ? sg + (a / 1e9).toFixed(2) + "B" : a >= 1e7 ? sg + (a / 1e6).toFixed(0) + "M" : a >= 1e6 ? sg + (a / 1e6).toFixed(1) + "M" : a >= 1e4 ? sg + (a / 1000).toFixed(0) + "k" : a >= 1000 ? sg + (a / 1000).toFixed(1) + "k" : sg + Math.floor(a).toString(); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const flag = tag => `<span class="swatch" style="background:${COUNTRIES[tag].color}"></span>`;
const TECH = Object.fromEntries(TECHS.map(t => [t.id, t]));
const iconCache = {};
function icon(type, size = 22) {
  const key = type + size;
  if (!iconCache[key]) {
    const c = document.createElement("canvas"); c.width = c.height = size * 2;
    const x = c.getContext("2d"); x.scale(2, 2);
    x.fillStyle = UNIT[type].color; x.fillRect(0, 0, size, size);
    drawUnitIcon(x, type, 3, 4, size - 6, size - 8, "#111");
    iconCache[key] = c.toDataURL();
  }
  return `<img class="uicon" src="${iconCache[key]}" width="${size}" height="${size}" alt="${UNIT[type].name}">`;
}
const money = n => "$" + fmt(n);
const hpColor = v => v > 0.6 ? "#5ec26a" : v > 0.3 ? "#e3b83c" : "#e0533f";
const crew = d => UNIT[d.type].domain === "land" ? UNIT[d.type].mp * 1000 : UNIT[d.type].domain === "air" ? (d.type === "bmb" ? 60 : 40) : 1200;
const men = d => `${Math.round(d.str * crew(d)).toLocaleString()} / ${crew(d).toLocaleString()} ${UNIT[d.type].domain === "air" ? "aircrew" : UNIT[d.type].domain === "sea" ? "sailors" : "men"}`;

let MAP, game, view, player = null, speed = 0, lastSpeed = 3, tab = null, picked = null;
let battleLog = [], unread = 0, logFilter = "all", endShown = false, acc = 0, lastFrame = performance.now(), lastHud = 0, lastPanel = 0, panelDay = -1, infoDay = -1;
const canvas = $("map");

async function boot() {
  const res = await fetch("data/map.json?v=1795222749");
  MAP = await res.json();
  const preview = new Game(MAP, { seed: 1 });
  view = new MapView(canvas, preview);
  view.fit();
  view.draw();
  addEventListener("resize", () => { view.resize(); view.fit(); });
  buildStart();
  requestAnimationFrame(loop);
}

function buildStart() {
  const majors = ["GER", "ENG", "FRA", "SOV", "ITA"];
  const diff = { GER: "Normal", ENG: "Normal", FRA: "Hard", SOV: "Normal", ITA: "Hard" };
  const facName = tag => FACTIONS.find(f => f.members.includes(tag))?.name || "Non-aligned";
  $("majors").innerHTML = majors.map(t => {
    const c = COUNTRIES[t];
    return `<button class="nation-card" data-tag="${t}" style="--c:${c.color}"><div class="diff">${diff[t]}</div><div class="n">${c.name}</div><div class="f">${facName(t)} · ${IDEOLOGY[c.ideology].name}</div>
      <div class="st"><span>Civ. factories</span><b>${c.civ}</b><span>Mil. factories</span><b>${c.mil}</b><span>Divisions</span><b>${c.divs}</b><span>Fleets</span><b>${Math.round(c.navy / 10)}</b></div></button>`;
  }).join("");
  const minors = Object.keys(COUNTRIES).filter(t => !majors.includes(t)).sort((a, b) => COUNTRIES[a].name.localeCompare(COUNTRIES[b].name));
  $("minors").innerHTML = minors.map(t => `<button class="nation-card" data-tag="${t}" style="--c:${COUNTRIES[t].color}"><div class="n">${COUNTRIES[t].name}</div><div class="f">${facName(t)}</div></button>`).join("");
  document.querySelectorAll(".nation-card").forEach(b => b.onclick = () => {
    document.querySelectorAll(".nation-card").forEach(x => x.classList.toggle("sel", x === b));
    picked = b.dataset.tag;
    const c = COUNTRIES[picked];
    const cap = view.g.P[view.g.c(picked).capital];
    $("pickInfo").innerHTML = `<b style="color:var(--gold-2)">${c.name}</b> · ${facName(picked)} · ${IDEOLOGY[c.ideology].name}<br>${c.civ} civilian / ${c.mil} military factories, ${c.divs} divisions. Capital: ${cap ? cap.name : "?"}.`;
    $("startBtn").disabled = false;
    if (cap) view.focusOn(cap.c[0], cap.c[1], Math.max(view.scale, 0.9));
  });
  $("startBtn").onclick = () => picked && startGame(picked);
}

function startGame(tag) {
  player = tag;
  game = new Game(MAP, { player: tag }); window.__game = game;
  game.ai = runAI;
  view = new MapView(canvas, game); window.__game = game; window.__view = view;
  const cap = game.P[game.c(tag).capital];
  view.focusOn(cap.c[0], cap.c[1], 1.5);
  $("start").classList.add("hidden");
  $("hud").classList.remove("hidden");
  setupHud();
  game.on(onEvent);
  setSpeed(0);
  const f = game.factionOf(tag);
  toast(`You lead ${game.c(tag).name}${f ? ", a member of the " + f.name : ""}. Press Space to speed up time (it cycles 1 → 5 → pause).`);
  openTab("focus");
}

const LOG_TYPES = { war: "war", major: "war", justify: "justify", diplo: "diplo", airesearch: "research", research: "research", world: "diplo" };
function onEvent(e) {
  if (e.type === "date") return;
  if (LOG_TYPES[e.type] && !(e.type === "research" && false)) {
    battleLog.push(e); if (battleLog.length > 2000) battleLog.shift();
    if (tab !== "battlelog" && e.type !== "research") { unread++; updateLogBadge(); }
    if (tab === "battlelog") panelDay = -1;
  }
  if ((e.type === "airesearch" || e.type === "justify") && !e.tags.includes(player)) return;
  const mine = e.tags.includes(player) || (e.tags.some(t => game.friendly(player, t)) && (e.type === "war" || e.type === "major"));
  const major = e.tags.some(t => COUNTRIES[t]?.major);
  if (e.type === "world" && !mine) return;
  addLog(e);
  if ((e.type === "war" || e.type === "major") && (mine || major)) toast(e.text, e.type === "war" ? "war" : "");
  if (e.type === "war" && e.tags[1] === player) { setSpeed(0); }
  panelDay = -1;
}

function updateLogBadge() {
  const b = document.querySelector('#sidebar [data-tab="battlelog"]');
  if (!b) return;
  let badge = b.querySelector(".badge");
  if (!badge) { badge = document.createElement("i"); badge.className = "badge"; b.appendChild(badge); }
  badge.textContent = unread > 99 ? "99+" : unread;
  badge.style.display = unread ? "" : "none";
}

function renderBattleLog() {
  const filters = [["all", "Everything"], ["war", "Wars & capitulations"], ["justify", "Justifications"], ["diplo", "Diplomacy & focus"], ["research", "Research"]];
  const list = battleLog.filter(e => logFilter === "all" ? true : LOG_TYPES[e.type] === logFilter).slice(-300).reverse();
  const icons = { war: "⚔", major: "★", justify: "⚑", diplo: "✉", world: "✦", airesearch: "⚗", research: "⚗" };
  return `<div class="logfilters">${filters.map(([k, n]) => `<button class="btn sm ${logFilter === k ? "gold" : ""}" data-act="logf" data-f="${k}">${n}</button>`).join("")}</div>
  <p class="muted" style="margin:6px 0 10px">Everything every country does: research, war goals, declarations of war, capitulations and alliances. Newest first.</p>
  ${list.map(e => `<div class="logrow ${e.type}"><span class="li">${icons[e.type] || "•"}</span><div class="grow"><div class="ld">${dateStr(e.time)} ${e.tags.filter(t => COUNTRIES[t]).slice(0, 2).map(flag).join("")}</div><div>${esc(e.text)}</div></div></div>`).join("") || `<div class="muted">Nothing has happened yet. Unpause the game!</div>`}`;
}

function addLog(e) {
  const el = document.createElement("div");
  el.className = "l " + e.type;
  el.innerHTML = `<span class="d">${dateStr(e.time)}</span>${esc(e.text)}`;
  $("log").appendChild(el);
  while ($("log").children.length > 6) $("log").firstChild.remove();
  setTimeout(() => el.remove(), 20000);
}

function toast(text, cls = "") {
  const el = document.createElement("div");
  el.className = "toast " + cls; el.textContent = text;
  $("toasts").appendChild(el);
  while ($("toasts").children.length > 3) $("toasts").firstChild.remove();
  setTimeout(() => el.remove(), 4200);
}

function setupHud() {
  $("speeds").innerHTML = `<button class="pause" data-s="0" title="Pause">❚❚</button>` + [1, 2, 3, 4, 5].map(s => `<button data-s="${s}" title="Speed ${s}">${s}</button>`).join("");
  $("speeds").onclick = e => { const b = e.target.closest("button"); if (b) setSpeed(+b.dataset.s); };
  document.querySelectorAll("#sidebar [data-tab]").forEach(b => b.onclick = () => openTab(tab === b.dataset.tab ? null : b.dataset.tab));
  $("modeBtn").onclick = toggleMode;
  $("panelClose").onclick = () => openTab(null);
  $("panelBody").addEventListener("click", onPanelClick);
  $("panelBody").addEventListener("input", onPanelInput);
  $("info").addEventListener("click", onPanelClick);
  bindTips(document.body);
  $("legend").innerHTML = `<div class="lg-head">Units <span class="muted">(L)</span></div>` + UNIT_ORDER.map(t => `<div class="lg" data-tip="<b>${UNIT[t].name}</b><br>${esc(UNIT[t].desc)}">${icon(t, 20)}<span>${UNIT[t].name}</span></div>`).join("");
  updateHud();
}

function setSpeed(s) {
  if (s > 0) lastSpeed = s;
  speed = s;
  document.querySelectorAll("#speeds button").forEach(b => b.classList.toggle("on", +b.dataset.s === s));
}

function toggleMode() { view.mode = view.mode === "political" ? "faction" : "political"; view.patterns = {}; view.dirty = true; toast(view.mode === "faction" ? "Map mode: Factions" : "Map mode: Political"); }

function updateHud() {
  const c = game.c(player), f = game.factionOf(player);
  $("tbNation").innerHTML = `<span class="flag" style="background:${c.color}"></span><div><div class="nm">${c.name}</div><div class="fc">${f ? f.name : "Non-aligned"} · ${IDEOLOGY[c.ideology].name}</div></div>`;
  const divs = game.divsOf(player);
  const prod = c.milEff * 4.5 * (1 + (c.mods.output || 0));
  const net = (c.income + c.civEff * 1.5 * 2400) - (c.upkeep || 0);
  const mpDay = c.mpGain || 0, mpSec = mpDay / 24 * SPEEDS[speed || lastSpeed];
  const R = (k, v, tip, warn) => `<div class="r ${warn ? "warn" : ""}" data-tip="${esc(tip)}"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  $("tbRes").innerHTML =
    R("Treasury", `${money(c.money)} <small>${net >= 0 ? "+" : "-"}${money(Math.abs(net))}</small>`, `<b>Money</b><br>Income: +${money(c.income + c.civEff * 1.5 * 2400)}/day from ${c.provCount} provinces and your civilian factories.<br>Upkeep: −${money(c.upkeep || 0)}/day. Every unit costs money every day.<br>If you go broke, your army loses organization.`, c.money < 250000 || net < 0) +
    R("Political", `${Math.floor(c.pp)} <small>+${(2 + (c.mods.ppGain || 0)).toFixed(1)}</small>`, "<b>Political power</b><br>Spent on war goals and guarantees.") +
    R("Civilian", `${c.civEff.toFixed(0)}`, `<b>Civilian factories</b><br>Build new factories and forts. ${Math.round(c.civEff * 5 * (1 + (c.mods.construction || 0)))} construction points per day. Every province you control adds a little industry, and captured factories work for you.`) +
    R("Military", `${c.milEff.toFixed(0)}`, `<b>Military factories</b><br>Produce ${Math.round(prod)} production points per day of equipment, tanks and aircraft. More land means more factories, which means more gear.`) +
    R("Manpower", `${fmt(c.manpower * 1000)} <small>+${fmt(mpSec * 1000)}/s</small>`, `<b>Manpower</b><br>Needed to train and reinforce every unit.<br>+${fmt(mpDay * 1000)} per day (+${fmt(mpSec * 1000)} per second at speed ${speed || lastSpeed}).<br>Research <b>Housing</b> for +25% growth per level, and conquer land for more people.`, c.manpower < 20) +
    R("Equipment", fmt(c.eqInf), "<b>Infantry equipment</b><br>Each infantry division needs 1,000.", c.eqInf < 500) +
    R("Tanks", fmt(c.tanks), "<b>Tanks</b><br>Light tank divisions need 100, armored divisions need 250.") +
    R("Aircraft", fmt(c.planes), "<b>Aircraft</b><br>Fighters need 100, bombers need 150.") +
    R("Army", `${divs.length}${c.training.length ? ` <small>+${c.training.length}</small>` : ""}`, "<b>Land divisions</b><br>Divisions in the field, plus all units in training.") +
    R("Navy", `${game.navyPower(player)}`, "<b>Naval strength</b> (your fleets plus your allies')<br>Sea invasions need at least 90% of the enemy's naval strength.");
  $("tbDate").textContent = dateStr(game.time);
  const alert = (t, on) => document.querySelector(`#sidebar [data-tab=${t}]`).classList.toggle("alert", on);
  alert("focus", !c.focus && game.focusTree(player).some(f => game.focusAvailable(c, f)));
  alert("research", c.research.some(r => !r) && TECHS.some(t => game.techAvailable(c, t)));
  alert("production", c.construction.length === 0);
}

function openTab(t) {
  tab = t;
  document.querySelectorAll("#sidebar [data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === t));
  $("panel").classList.toggle("hidden", !t);
  if (t) { $("panelBody").scrollTop = 0; renderPanel(); }
}

function renderPanel() {
  if (!tab) return;
  const titles = { focus: "National Focus", research: "Research", production: "Industry", army: "Army", diplomacy: "Diplomacy", help: "How to Play", battlelog: "Battle Log" };
  if (tab === "battlelog") { unread = 0; updateLogBadge(); }
  $("panelTitle").textContent = titles[tab];
  const st = $("panelBody").scrollTop, sl = $("panelBody").scrollLeft;
  $("panelBody").innerHTML = { focus: renderFocus, research: renderResearch, production: renderProduction, army: renderArmy, diplomacy: renderDiplomacy, help: renderHelp, battlelog: renderBattleLog }[tab]();
  $("panelBody").scrollTop = st; $("panelBody").scrollLeft = sl;
  panelDay = Math.floor(game.hourCount / 24);
}

function renderFocus() {
  const c = game.c(player);
  const tree = game.focusTree(player);
  const X = 58, Y = 86, W = 104, H = 64;
  const maxX = Math.max(...tree.map(f => f.x)), maxY = Math.max(...tree.map(f => f.y));
  let cur = `<div class="row"><div class="grow"><div class="t">No focus selected</div><div class="s">Pick an available focus (gold border). Each takes 70 days.</div></div></div>`;
  if (c.focus) { const f = game.focusById(player, c.focus.id); cur = `<div class="row"><div class="grow"><div class="t">${esc(f.name)}</div><div class="s">${esc(f.desc)} · ${70 - c.focus.progress} days left</div><div class="bar"><i style="width:${c.focus.progress / 70 * 100}%"></i></div></div></div>`; }
  const lines = [];
  for (const f of tree) for (const r of f.req) { const p = tree.find(x => x.id === r); if (p) lines.push(`<line x1="${p.x * X + W / 2}" y1="${p.y * Y + H}" x2="${f.x * X + W / 2}" y2="${f.y * Y}" stroke="${c.focusDone.has(r) ? "#6fa865" : "#4a505e"}" stroke-width="2"/>`); }
  const nodes = tree.map(f => {
    const st = c.focusDone.has(f.id) ? "done" : c.focus?.id === f.id ? "active" : game.focusAvailable(c, f) && !c.focus ? "avail" : "locked";
    const nat = f.id.includes("_");
    const extra = st === "active" ? `<div class="bar"><i style="width:${c.focus.progress / 70 * 100}%"></i></div>` : `<div class="muted">${st === "done" ? "✓ Done" : "70 days"}</div>`;
    return `<div class="fnode ${st}" style="left:${f.x * X}px;top:${f.y * Y}px" data-act="focus" data-id="${f.id}" data-tip="<b>${esc(f.name)}</b><br>${esc(f.desc)}">${nat ? '<span class="nat">NAT</span>' : ""}<div class="fn">${esc(f.name)}</div>${extra}</div>`;
  }).join("");
  return `<div class="sec"><h4>Current focus</h4>${cur}</div><div class="ftree" style="width:${maxX * X + W + 10}px;height:${maxY * Y + H + 10}px"><svg width="${maxX * X + W + 10}" height="${maxY * Y + H + 10}">${lines.join("")}</svg>${nodes}</div>`;
}

function renderResearch() {
  const c = game.c(player);
  const slots = c.research.map((r, i) => {
    if (!r) return `<div class="slot"><div class="muted">Slot ${i + 1} is empty. Pick a technology below.</div></div>`;
    const t = TECH[r.id], cost = game.techCost(c, t);
    return `<div class="slot full"><div style="display:flex;justify-content:space-between"><b>${esc(t.name)}</b><span class="muted">${cost - r.progress} days</span></div><div class="s muted">${esc(t.desc)}</div><div class="bar"><i style="width:${r.progress / cost * 100}%"></i></div></div>`;
  }).join("");
  const cats = [...new Set(TECHS.map(t => t.cat))];
  const list = cats.map(cat => `<div class="sec"><h4>${cat}</h4>${TECHS.filter(t => t.cat === cat).map(t => {
    const done = c.techs.has(t.id), active = c.research.some(r => r && r.id === t.id), avail = game.techAvailable(c, t);
    const st = done ? "done" : active ? "done" : avail ? "avail" : "locked";
    const cost = game.techCost(c, t);
    const ahead = t.year > game.year;
    const reqs = [...t.req.map(r => TECH[r].name), ...(t.reqAny ? ["any doctrine"] : [])];
    return `<div class="tech ${st} ${ahead ? "ahead" : ""}" data-act="tech" data-id="${t.id}" data-tip="<b>${esc(t.name)}</b><br>${esc(t.desc)}${reqs.length ? "<br>Requires: " + esc(reqs.join(", ")) : ""}${t.group ? "<br>You can only pick one doctrine." : ""}${ahead ? "<br>Ahead of time: takes longer." : ""}">
      <span class="yr">${t.year}</span><div class="grow"><div class="t">${esc(t.name)} ${done ? "✓" : active ? "…" : ""}</div><div class="s muted">${esc(t.desc)}</div></div><span class="muted">${cost}d</span></div>`;
  }).join("")}</div>`).join("");
  return `<div class="sec"><h4>Research slots <small>${c.research.length} slots</small></h4>${slots}</div>${list}`;
}

function renderProduction() {
  const c = game.c(player);
  const cpts = Math.round(c.civEff * 5 * (1 + (c.mods.construction || 0)));
  const prod = c.milEff * 4.5 * (1 + (c.mods.output || 0));
  const armor = c.techs.has("tank1");
  const tankS = armor ? c.share.tank : 0, airS = c.share.air, infS = 1 - tankS - airS;
  const queue = c.construction.map((it, i) => {
    const p = game.P[it.prov], cost = BUILD[it.type].cost;
    const perDay = Math.min(75 * (1 + (c.mods.construction || 0)), cpts);
    return `<div class="row"><div class="grow"><div class="t">${BUILD[it.type].name}</div><div class="s">${esc(p.name)} · ${i < Math.max(1, Math.floor(cpts / 75)) + 0 ? "~" + Math.ceil((cost - it.progress) / Math.max(1, perDay)) + " days" : "waiting"}</div><div class="bar green"><i style="width:${it.progress / cost * 100}%"></i></div></div><button class="btn sm" data-act="unbuild" data-i="${i}">✕</button></div>`;
  }).join("") || `<div class="muted">Nothing being built. Your civilian factories are idle.</div>`;
  return `
  <div class="sec"><h4>Economy</h4><div class="kv">
    <span class="k">Civilian factories</span><span>${c.civEff.toFixed(1)}</span>
    <span class="k">Military factories</span><span>${c.milEff.toFixed(1)}</span>
    <span class="k">Construction</span><span>${cpts} points / day (each project can use up to ${Math.round(75 * (1 + (c.mods.construction || 0)))})</span>
    <span class="k">Factory output</span><span>+${Math.round((c.mods.output || 0) * 100)}%</span>
  </div></div>
  <div class="sec"><h4>Construction</h4>
    <div class="grid2" style="margin-bottom:8px">
      <button class="btn" data-act="build" data-type="civ" data-tip="<b>Civilian factory</b> · ${money(BUILD.civ.money)}<br>${BUILD.civ.cost} points. Speeds up future construction and earns money.">+ Civilian factory</button>
      <button class="btn" data-act="build" data-type="mil" data-tip="<b>Military factory</b> · ${money(BUILD.mil.money)}<br>${BUILD.mil.cost} points. Produces equipment, tanks and aircraft.">+ Military factory</button>
      <button class="btn" data-act="build" data-type="fort" data-tip="<b>Land fort</b> · ${money(BUILD.fort.money)}<br>${BUILD.fort.cost} points. +15% defense per level, up to 5.">+ Land fort</button>
      <button class="btn" data-act="autobuild" data-tip="Queue a military factory in the best free spot.">Auto-build</button>
    </div>${queue}</div>
  <div class="sec"><h4>Military production <small>${Math.round(prod)} points / day</small></h4>
    <div class="muted" style="margin-bottom:4px">Split your military factories between equipment, tanks and aircraft.</div>
    <div class="kv"><span class="k">Tanks ${Math.round(tankS * 100)}%</span>${armor ? `<input type="range" min="0" max="80" value="${Math.round(tankS * 100)}" data-act="shareTank">` : `<span class="muted">Research Light Tanks first</span>`}
    <span class="k">Aircraft ${Math.round(airS * 100)}%</span><input type="range" min="0" max="80" value="${Math.round(airS * 100)}" data-act="shareAir">
    <span class="k">Equipment ${Math.round(infS * 100)}%</span><span class="muted">the rest</span></div>
    <div class="kv" style="margin-top:8px"><span class="k">Infantry equipment</span><span>${fmt(c.eqInf)} (+${Math.round(prod * infS / 0.5)}/day)</span><span class="k">Tanks</span><span>${fmt(c.tanks)} (+${(prod * tankS / 4).toFixed(1)}/day)</span><span class="k">Aircraft</span><span>${fmt(c.planes)} (+${(prod * airS / 2.5).toFixed(1)}/day)</span></div>
  </div>`;
}

function renderArmy() {
  const c = game.c(player);
  const units = game.unitsOf(player);
  const count = t => units.filter(d => d.type === t).length;
  const land = units.filter(d => d.domain === "land");
  const avgStr = land.length ? land.reduce((s, d) => s + d.str, 0) / land.length : 0;
  const train = c.training.map(t => `<div class="row">${icon(t.type)}<div class="grow"><div class="t">${UNIT[t.type].name}</div><div class="s">${t.days} days left</div><div class="bar"><i style="width:${(1 - t.days / t.total) * 100}%"></i></div></div></div>`).join("") || `<div class="muted">Nothing in training.</div>`;
  const cards = UNIT_ORDER.map(t => {
    const u = UNIT[t], block = game.trainBlock(player, t), k = game.unitCost(player, t), tier = k.tier;
    const cost = [money(k.money), k.eq ? `${fmt(k.eq)} equip.` : "", k.tanks ? `${k.tanks} tanks` : "", k.planes ? `${k.planes} aircraft` : "", `${k.mp}k men`, `${k.days} days`, `upkeep ${money(k.upkeep)}/day`].filter(Boolean).join(" · ");
    const old = units.filter(d => d.type === t && (d.tier || 1) < tier);
    const upc = old.length ? game.upgradeCost(player, old[0]) : null;
    const speed = (u.hours / 8).toFixed(u.hours < 16 ? 1 : 0);
    return `<div class="row unitcard">${icon(t, 30)}<div class="grow"><div class="t">${u.name} <span class="tier">Tier ${ROMAN[tier - 1]}</span> <span class="muted">· ${count(t)} active · ${Math.round(TIER_MULT[tier - 1] * 100)}% power</span></div><div class="s">${esc(u.desc)}</div><div class="s">${cost} · ~${speed}s per province at speed 3</div>${block ? `<div class="s" style="color:#ff9a7a">${esc(block)}</div>` : ""}${old.length ? `<div class="s" style="margin-top:4px">${old.length} older unit${old.length > 1 ? "s" : ""} below tier ${ROMAN[tier - 1]} · <button class="btn sm" data-act="upgrade" data-type="${t}">Upgrade (${money(upc.money)} each)</button></div>` : ""}${tier < 5 ? `<div class="s muted">Research the next ${u.name} tier to unlock tier ${ROMAN[tier]}.</div>` : ""}</div>
      <div style="display:flex;flex-direction:column;gap:3px"><button class="btn sm gold" data-act="train" data-type="${t}" data-n="1" ${block ? "disabled" : ""}>Train</button><button class="btn sm" data-act="train" data-type="${t}" data-n="5" ${block ? "disabled" : ""}>×5</button></div></div>`;
  }).join("");
  return `
  <div class="sec"><h4>Forces</h4><div class="kv">
    <span class="k">Land divisions</span><span>${land.length} · average strength ${Math.round(avgStr * 100)}%</span>
    <span class="k">Free tiles</span><span>${Math.max(0, game.freeSpawnCount(player, "land"))} for land units · ${Math.max(0, game.freeSpawnCount(player, "air"))} for air · ${Math.max(0, game.freeSpawnCount(player, "sea"))} coastal for fleets <span class="muted">(1 unit per tile, so more land means more units)</span></span>
    <span class="k">Air wings</span><span>${count("ftr")} fighters, ${count("bmb")} bombers</span>
    <span class="k">Fleets</span><span>${count("ship")} (naval strength ${game.navyPower(player)} with allies)</span>
    <span class="k">Treasury</span><span>${money(c.money)} (upkeep −${money(c.upkeep || 0)}/day)</span>
    <span class="k">Manpower</span><span>${fmt(c.manpower * 1000)} (+${fmt((c.mpGain || 0) * 1000)}/day, research Housing for more)</span>
    <span class="k">Units destroyed / lost</span><span>${c.kills} / ${c.losses}</span>
  </div></div>
  <div class="sec"><h4>Train units <small>New units appear on a free tile of your land, nearest your capital</small></h4>${cards}</div>
  <div class="sec"><h4>In training</h4>${train}</div>
  <div class="sec"><h4>Orders</h4><div class="grid2">
    <button class="btn" data-act="selall">Select all land units</button>
    <button class="btn" data-act="selidle">Select idle land units</button>
    <button class="btn" data-act="selair">Select all aircraft</button>
    <button class="btn" data-act="selships">Select all fleets</button>
  </div><p class="muted" style="line-height:1.5">Click a counter to select it. Shift/Ctrl/⌘-click adds more, Shift-drag box-selects, <kbd>G</kbd> selects every land unit. Then hover over a destination and <b>left-click</b> to move or attack. Right-click cancels. Aircraft fly to any friendly province and support battles within the dashed circle. Fleets sail between friendly ports.</p></div>`;
}

function renderDiplomacy() {
  const c = game.c(player);
  const myF = game.factionOf(player);
  const wars = game.wars.filter(w => w.sides[0].has(player) || w.sides[1].has(player));
  const warHtml = game.wars.length ? game.wars.map(w => `<div class="row"><div class="grow"><div class="t">${esc(w.name)}${wars.includes(w) ? ' <span class="chip enemy">You</span>' : ""}</div><div class="s">${[...w.sides[0]].map(t => flag(t) + " " + COUNTRIES[t].name).join(", ")} <b>vs</b> ${[...w.sides[1]].map(t => flag(t) + " " + COUNTRIES[t].name).join(", ")}</div></div></div>`).join("") : `<div class="muted">Europe is at peace… for now.</div>`;
  const just = c.justifying ? `<div class="row"><div class="grow"><div class="t">Justifying war goal against ${COUNTRIES[c.justifying.target].name}</div><div class="bar red"><i style="width:${(1 - c.justifying.days / c.justifying.total) * 100}%"></i></div><div class="s">${c.justifying.days} days left</div></div></div>` : "";
  const groups = [...game.factions.map(f => ({ name: f.name, members: [...f.members] })), { name: "Non-aligned", members: game.alive().filter(x => !game.factionOf(x.tag)).map(x => x.tag) }];
  const rows = groups.filter(gp => gp.members.length).map(gp => `<div class="sec"><h4>${esc(gp.name)}</h4>${gp.members.filter(t => game.c(t).alive).map(t => countryRow(t, myF)).join("")}</div>`).join("");
  const found = !myF && c.major ? `<button class="btn" data-act="found">Found a faction</button>` : "";
  return `<div class="sec"><h4>Wars</h4>${warHtml}</div>${just}<div class="sec"><h4>Your position <small>${Math.floor(c.pp)} political power</small></h4><div class="muted" style="line-height:1.5;margin-bottom:6px">${myF ? `You are in the <b>${esc(myF.name)}</b> (led by ${COUNTRIES[myF.leader].name}). Your faction joins your wars and you join theirs.` : "You are not in a faction."} To start a war, <b>justify a war goal</b> (costs political power, takes 30 days) and then <b>declare war</b>.</div>${found}</div>${rows}`;
}

function countryRow(t, myF) {
  const c = game.c(player), o = game.c(t);
  const rel = t === player ? "self" : game.relation(player, t);
  const relName = { self: "You", ally: "Ally", enemy: "At war", neutral: "Neutral" }[rel];
  let acts = "";
  if (t !== player) {
    if (rel === "enemy") acts += "";
    else if (c.wargoals[t]) acts += `<button class="btn sm red" data-act="declare" data-t="${t}">Declare war</button>`;
    else if (rel === "neutral" && c.justifying?.target !== t) acts += `<button class="btn sm" data-act="justify" data-t="${t}" ${game.canJustify(player, t) ? "" : "disabled"} data-tip="Justify a war goal: ${game.justifyCost(player)} political power, ${Math.round(30 * (1 - game.mod(player, "justify")))} days.">Justify</button>`;
    if (rel === "neutral" && !c.guarantees.has(t)) acts += `<button class="btn sm" data-act="guarantee" data-t="${t}" ${c.pp >= 25 ? "" : "disabled"} data-tip="Guarantee independence: 25 political power. You join any war started against them.">Guarantee</button>`;
    const f = game.factionOf(t);
    if (!myF && f && f.leader === t && rel !== "enemy") acts += `<button class="btn sm" data-act="join" data-f="${f.id}">Join ${esc(f.name)}</button>`;
    if (myF && myF.leader === player && !f && rel === "neutral") acts += `<button class="btn sm" data-act="invite" data-t="${t}">Invite</button>`;
  }
  const divs = game.divsOf(t).length;
  if (t !== player) acts += `<button class="btn sm gold" data-act="dip" data-t="${t}">Diplomacy…</button>`;
  return `<div class="row crow">${flag(t)}<div class="grow"><div class="t">${o.name} ${c.guarantees.has(t) ? '<span class="chip ally">guaranteed</span>' : ""}${o.overlord ? ` <span class="chip neutral">puppet of ${COUNTRIES[o.overlord].name}</span>` : ""}${game.truce(player, t) ? ' <span class="chip neutral">truce</span>' : ""}</div><div class="s">${IDEOLOGY[o.ideology].name} · ${divs} divisions · ${o.civEff.toFixed(0)}/${o.milEff.toFixed(0)} factories</div></div><span class="chip ${rel}">${relName}</span><div class="racts">${acts}</div></div>`;
}

function renderHelp() {
  return `<div class="help">
  <p><b>Goal:</b> Lead your nation from 1936 to 1950. Build industry, research technology, raise armies and win your wars. The starting alliances follow history, but every war is decided fresh each game.</p>
  <h4>Controls</h4><ul>
    <li><kbd>Space</kbd> steps the speed up: paused → 1 → 2 → 3 → 4 → 5 → paused again. <kbd>1</kbd>–<kbd>5</kbd> jump straight to a speed.</li>
    <li>Drag to pan, scroll to zoom. The arrow keys also pan.</li>
    <li><b>Click your unit</b> (or anywhere in a province where you have units) to select it. Hover over where you want to go, then <b>left-click</b> to send it there. Right-click cancels. <kbd>Shift</kbd>, <kbd>Ctrl</kbd> or <kbd>⌘</kbd>-click adds (or removes) units, <kbd>Shift</kbd>-drag box-selects, <kbd>G</kbd> selects all your land units, and clicking the sea deselects.</li>
    <li><b>Group attacks:</b> send several units at one enemy tile and each one takes a different neighboring tile, so they all hit it at once.</li>
    <li><b>Capitals:</b> take a country's capital and the whole country becomes yours; its units are disbanded. Capitals defend at double strength and take three times as long to march into, so the AI (and you) have time to rush defenders there.</li>
    <li>You never have to click each province. Select a unit, <b>hover</b> over any destination to preview the fastest route (dashed arrows), then <b>left-click once</b> and it walks the whole way. Nothing moves until you click.</li>
    <li>Land units only walk over land. They cross the sea only when there is no land route at all (for example, Britain to France).</li>
    <li>Attacking a country you have no war goal against costs a <b>$10,000 war tax</b>. Betraying allies costs the same.</li>
    <li>The route shows one arrow per province. Each arrow fills up as the unit crosses that province, so no province can be skipped. Red arrows mean the unit is attacking.</li>
    <li><kbd>F</kbd> Focus · <kbd>R</kbd> Research · <kbd>P</kbd> Industry · <kbd>A</kbd> Army · <kbd>D</kbd> Diplomacy · <kbd>M</kbd> map mode · <kbd>Esc</kbd> deselect.</li></ul>
  <h4>Units</h4><ul>
    ${UNIT_ORDER.map(t => `<li style="list-style:none;margin-left:-18px;display:flex;gap:8px;align-items:center">${icon(t, 22)}<span><b>${UNIT[t].name}</b>: ${esc(UNIT[t].desc)}</span></li>`).join("")}
    <li>Every counter shows the unit type icon, how many units are in it, and green (strength) and yellow (organization) bars. A white border means yours, blue means an ally, red means an enemy.</li>
    <li>Movement takes time. At speed 3, infantry needs about 5 seconds per province, tanks about 3, and aircraft and fleets about 1 to 2. Rough terrain is slower.</li></ul>
  <h4>One unit per tile</h4><ul>
    <li>Each tile can hold <b>one</b> land unit (plus one air wing and one fleet). Units can't stack.</li>
    <li>New units appear on a free tile of your land, nearest your capital. You can only train when you have a free tile, so <b>more land means a bigger army</b>.</li>
    <li>Send several units to one spot and they spread out onto the target and the free tiles around it. Send them at an enemy tile and they attack together from different neighboring tiles. Only one moves in when it's taken.</li></ul>
  <h4>Tiers, money &amp; manpower</h4><ul>
    <li>Every unit type has <b>tiers I to V</b>. Research the next tier (Infantry II, Light Tank III and so on) and new units train at that tier, from 100% up to 200% combat power. Upgrade older units from the Army panel.</li>
    <li>Each unit costs money to train <b>and upkeep every day</b>. Higher tiers cost more. If your treasury hits zero, your army loses organization.</li>
    <li>Manpower grows every second. Research <b>Housing I to V</b> (+25% each) and conquer land to grow it faster.</li>
    <li>Open the <b>Battle Log</b> (<kbd>B</kbd>) to see everything the AI does: research, war-goal justifications, declarations of war and capitulations.</li></ul>
  <h4>Attacking &amp; betrayal</h4><ul>
    <li>Send your units onto <b>any</b> other country's land or units to attack them straight away. No justifying or declaring is needed. Their whole faction will fight back, and you pay a $10,000 war tax.</li>
    <li>Every province you take <b>becomes yours</b> and turns your color. It gives you its factories, income and industry.</li>
    <li>Hover over any counter to see each unit's health bar (soldiers left). Click a battle's province to see both sides.</li>
    <li><b>Diplomacy…</b> (Diplomacy panel, or click a foreign province): propose alliances, demand gold, territory or puppets, and send peace treaties that demand gold or land. The AI does the same to each other and to you, and a popup lets you accept or refuse.</li>
    <li>You can <b>betray your allies</b> by moving a unit into their territory or onto their units. No war goal or justification is needed. You leave your faction and join the other side for the rest of the match. Your allies will never betray you first, but anyone else can attack you.</li></ul>
  <h4>Warfare</h4><ul>
    <li>Moving into a province with enemy divisions starts a battle. The bar under the swords shows which side is winning.</li>
    <li>Defenders get bonuses from terrain, forts and digging in. Attack with about 2 to 1 odds or bring armor.</li>
    <li>Divisions with no route back to your capital are <b>out of supply</b>. They lose strength and can't recover organization.</li>
    <li>Broken divisions retreat. If they have nowhere to go, they're destroyed. Encircle your enemies!</li>
    <li>Sea crossings are slow. Landing on an enemy coast needs a navy at least 90% as strong as theirs.</li>
    <li>A country surrenders when it loses most of its core territory, or its capital plus a large share. Its land goes to the occupiers.</li></ul>
  <h4>Economy</h4><ul>
    <li><b>More land means more factories, gear and money.</b> Every province you control adds industry and daily income, and you can use the factories you capture.</li>
    <li>Money pays for every unit and building. Civilian factories build, and military factories make equipment, tanks and aircraft.</li>
    <li>Divisions need equipment and manpower to train and to refill losses.</li></ul></div>`;
}

function onPanelInput(e) {
  const c = game.c(player);
  if (e.target.dataset.act === "shareTank") { c.share.tank = +e.target.value / 100; if (c.share.tank + c.share.air > 0.9) c.share.air = 0.9 - c.share.tank; }
  if (e.target.dataset.act === "shareAir") { c.share.air = +e.target.value / 100; if (c.share.tank + c.share.air > 0.9) c.share.tank = Math.max(0, 0.9 - c.share.air); }
  clearTimeout(onPanelInput.t); onPanelInput.t = setTimeout(renderPanel, 250);
}

function onPanelClick(e) {
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const a = el.dataset.act, c = game.c(player);
  if (a === "focus") { if (game.setFocus(player, el.dataset.id)) toast(`Focus started: ${game.focusById(player, el.dataset.id).name}`); }
  else if (a === "tech") {
    const slot = c.research.findIndex(r => !r);
    if (!game.techAvailable(c, TECH[el.dataset.id])) return;
    if (slot < 0) toast("All research slots are busy.");
    else game.setResearch(player, slot, el.dataset.id);
  }
  else if (a === "build") setBuildMode(el.dataset.type);
  else if (a === "autobuild") {
    const cands = game.P.filter(p => game.canBuild(player, "mil", p.id)).sort((x, y) => y.vp - x.vp);
    if (!cands.length) toast("No free factory slots. Capture more land to get more!");
    else if (game.queueBuild(player, "mil", cands[0].id)) toast(`Military factory queued in ${cands[0].name}.`);
    else toast(`Not enough money (${money(BUILD.mil.money)} needed).`);
  }
  else if (a === "unbuild") c.construction.splice(+el.dataset.i, 1);
  else if (a === "train") { let n = 0; for (let i = 0; i < +el.dataset.n; i++) if (game.train(player, el.dataset.type)) n++; if (!n) toast(game.trainBlock(player, el.dataset.type) || "Can't train that right now."); else toast(`Training ${n} × ${UNIT[el.dataset.type].name}`); }
  else if (a === "selall") { view.selected = new Set(game.divsOf(player).map(d => d.id)); showDivInfo(); }
  else if (a === "selidle") { view.selected = new Set(game.divsOf(player).filter(d => !d.path.length).map(d => d.id)); showDivInfo(); }
  else if (a === "selair") { view.selected = new Set(game.divsOf(player, "air").map(d => d.id)); showDivInfo(); }
  else if (a === "selships") { view.selected = new Set(game.divsOf(player, "sea").map(d => d.id)); showDivInfo(); }
  else if (a === "justify") { if (game.justify(player, el.dataset.t)) toast(`Justifying a war goal against ${COUNTRIES[el.dataset.t].name}…`); if (view.selProv) showProvInfo(view.selProv); }
  else if (a === "forcewar") { if (game.forceWar(player, el.dataset.t)) { toast(`You declared war on ${COUNTRIES[el.dataset.t].name}!`, "war"); setSpeed(0); } else toast("You can't declare war on them right now."); }
  else if (a === "declare") { if (game.declareWar(player, el.dataset.t)) setSpeed(0); }
  else if (a === "guarantee") game.guarantee(player, el.dataset.t);
  else if (a === "join") {
    if (aiAcceptsFaction(game, player, el.dataset.f)) game.joinFaction(player, el.dataset.f);
    else toast(`${COUNTRIES[game.factions.find(f => f.id === el.dataset.f).leader].name} refuses. Your ideologies differ.`);
  }
  else if (a === "invite") {
    const myF = game.factionOf(player);
    if (aiAcceptsFaction(game, el.dataset.t, myF.id) || game.c(el.dataset.t).ideology === "neutral" && game.rng() < 0.5) game.joinFaction(el.dataset.t, myF.id);
    else toast(`${COUNTRIES[el.dataset.t].name} declines your invitation.`);
  }
  else if (a === "found") game.createFaction(player, `${c.adj} Pact`);
  else if (a === "logf") logFilter = el.dataset.f;
  else if (a === "dip") { dipModal(el.dataset.t); return; }
  else if (a === "upgrade") { const n = game.upgradeUnits(player, el.dataset.type); if (!n) toast("Can't afford the upgrade right now."); }
  else if (a === "stop") { for (const id of view.selected) { const d = game.divs.get(id); if (d) { d.path = []; d.attacking = null; } } }
  else if (a === "desel") { view.selected.clear(); $("info").classList.add("hidden"); }
  else if (a === "selprov") { const p = game.P[+el.dataset.p]; view.selected = new Set([...p.divs, ...p.air, ...p.ships].filter(i => game.divs.get(i)?.tag === player)); showDivInfo(); }
  else if (a === "pbuild") { if (game.queueBuild(player, el.dataset.type, +el.dataset.p)) toast(`${BUILD[el.dataset.type].name} queued.`); showProvInfo(game.P[+el.dataset.p]); }
  else if (a === "movehere") { moveSelected(game.P[+el.dataset.p]); }
  renderPanel(); updateHud(); view.dirty = true;
}

function setBuildMode(type) {
  view.buildMode = type;
  canvas.classList.toggle("build", !!type);
  $("buildHint").classList.toggle("hidden", !type);
  if (type) $("buildHint").innerHTML = `Placing <b>${BUILD[type].name}</b>. Click a highlighted province. Shift-click to place several. Right-click or Esc to stop.`;
  view.dirty = true;
}

function showProvInfo(p) {
  const el = $("info");
  el.classList.remove("hidden");
  const own = p.owner === player;
  const here = new Map();
  const byType = [];
  for (const id of [...p.divs, ...p.air, ...p.ships]) { const d = game.divs.get(id); if (!d) continue; here.set(d.tag, (here.get(d.tag) || 0) + 1); }
  for (const t of UNIT_ORDER) { const tags = new Map(); for (const id of [...p.divs, ...p.air, ...p.ships]) { const d = game.divs.get(id); if (d && d.type === t) tags.set(d.tag, (tags.get(d.tag) || 0) + 1); } for (const [tg, n] of tags) byType.push(`<span style="display:inline-flex;align-items:center;gap:3px;margin-right:8px">${icon(t, 16)}${flag(tg)}${n}</span>`); }
  const rel = game.relation(player, p.ctrl);
  const queued = game.c(p.owner).construction.filter(i => i.prov === p.id).length;
  el.innerHTML = `<h3>${flag(p.owner)} ${esc(p.name)}</h3><div class="sub">${TERRAIN[p.terrain].name}${p.vp ? " · Victory points " + p.vp : ""}${p.capital && p.capital === p.owner ? " · Capital" : ""}</div>
  <div class="kv"><span class="k">Owner</span><span>${COUNTRIES[p.owner].name}</span>
  ${p.core !== p.owner ? `<span class="k">Taken from</span><span>${COUNTRIES[p.core].name}</span>` : ""}
  <span class="k">Relation</span><span><span class="chip ${p.ctrl === player ? "self" : rel}">${p.ctrl === player ? "Yours" : rel}</span></span>
  <span class="k">Factories</span><span>${p.civ} civilian, ${p.mil} military (${p.slots} slots${queued ? `, ${queued} queued` : ""})</span>
  <span class="k">Fort level</span><span>${p.fort}</span>
  <span class="k">Income</span><span>${money((1 + 0.4 * p.vp) * (p.core === p.owner ? 1 : 0.8) * 2400)}/day for its owner</span>
  <span class="k">Coast</span><span>${p.coastal ? "Coastal (fleets can dock)" : "Inland"}</span>
  <span class="k">Units</span><span>${byType.join("") || "None"}</span></div>
  ${battleHtml(p)}
  <div class="acts">
    ${p.owner !== player ? `<button class="btn sm gold" data-act="dip" data-t="${p.owner}">Diplomacy with ${COUNTRIES[p.owner].name}…</button>` : ""}
    ${p.owner !== player && !game.atWar(player, p.owner) && !game.friendly(player, p.owner) ? (game.c(player).wargoals[p.owner] ? "" : game.c(player).justifying?.target === p.owner ? `<span class="muted">Justifying: ${game.c(player).justifying.days} days left</span>` : `<button class="btn sm" data-act="justify" data-t="${p.owner}" ${game.canJustify(player, p.owner) ? "" : "disabled"}>Justify war goal</button>`) + `<button class="btn sm red" data-act="forcewar" data-t="${p.owner}">Declare war${game.c(player).wargoals[p.owner] ? "" : " ($10k tax)"}</button>` : ""}
    ${here.get(player) ? `<button class="btn sm" data-act="selprov" data-p="${p.id}">Select my units</button>` : ""}
    ${view.selected.size ? `<button class="btn sm gold" data-act="movehere" data-p="${p.id}">Move selected here</button>` : ""}
    ${own ? ["civ", "mil", "fort"].map(t => `<button class="btn sm" data-act="pbuild" data-type="${t}" data-p="${p.id}" ${game.canBuild(player, t, p.id) ? "" : "disabled"}>+ ${t === "civ" ? "Civilian" : t === "mil" ? "Military" : "Fort"}</button>`).join("") : ""}
  </div>`;
  infoDay = Math.floor(game.hourCount / 24);
}

let dipState = null;
function dipModal(t) {
  const T = game.c(t), me = game.c(player);
  if (!dipState || dipState.t !== t) dipState = { t, gold: Math.round(Math.min(T.money * 0.5, (T.income || 0) * 10) / 1000) * 1000, tiles: new Set(game.borderTiles(player, t, 6).slice(0, 2).map(p => p.id)), mode: "demand", keep: true, pgold: 0, puppet: false };
  const st = dipState;
  const was = speed; if (speed) { st.resume = was; setSpeed(0); }
  const ratio = game.power(player) / game.power(t);
  const rel = game.relation(player, t);
  const pred = (type, terms) => { const r = game.aiAccept(type, player, t, terms); return `<span class="pred ${r.ok ? "yes" : "no"}">${r.ok ? "✓ Likely to accept" : "✗ Will refuse"}</span> <span class="muted">${esc(r.why)}</span>`; };
  const k = game.allianceKind(player, t);
  const border = game.borderTiles(player, t, 6);
  const atWar = game.atWar(player, t);
  const conquered = game.conqueredFrom(player, t).length, lost = game.conqueredFrom(t, player).length;
  const ws = atWar ? game.warScore(player, t) : 0;
  const peaceTerms = st.mode === "white" ? { demander: null } : st.mode === "concede" ? { demander: t, keep: true, keepCount: lost, gold: st.pgold } : { demander: player, keep: st.keep, keepCount: conquered, gold: st.pgold, puppet: st.puppet };
  const sec = (title, body) => `<div class="dsec"><h4>${title}</h4>${body}</div>`;
  let html = `<div class="dhead">${flag(t)} <b>${T.name}</b> <span class="chip ${rel}">${{ ally: "Ally", enemy: "At war", neutral: "Neutral" }[rel] || ""}</span></div>
    <div class="kv" style="text-align:left;margin:8px 0 4px"><span class="k">Ideology</span><span>${IDEOLOGY[T.ideology].name}${game.factionOf(t) ? " · " + esc(game.factionOf(t).name) : ""}${T.overlord ? " · puppet of " + COUNTRIES[T.overlord].name : ""}</span>
    <span class="k">Balance of power</span><span>Your side is <b>${ratio.toFixed(1)}×</b> ${ratio >= 1 ? "stronger" : "as strong"}</span>
    <span class="k">Their treasury</span><span>${money(T.money)} (${money(T.income || 0)}/day from land)</span>
    ${game.truce(player, t) ? `<span class="k">Truce</span><span>Until ${dateStr(me.truces[t])}. Breaking it costs an extra war tax.</span>` : ""}</div>`;
  if (atWar) {
    html += sec(`Peace treaty <small>War score ${Math.round(ws * 100)} (positive = you are winning)</small>`, `
      <div class="seg"><button class="btn sm ${st.mode === "demand" ? "gold" : ""}" data-d="mode" data-v="demand">I demand</button><button class="btn sm ${st.mode === "white" ? "gold" : ""}" data-d="mode" data-v="white">White peace</button><button class="btn sm ${st.mode === "concede" ? "gold" : ""}" data-d="mode" data-v="concede">I concede</button></div>
      ${st.mode === "demand" ? `<label class="ck"><input type="checkbox" data-d="keep" ${st.keep ? "checked" : ""}> Keep the ${conquered} province${conquered === 1 ? "" : "s"} you took from them</label>
      <label class="ck">Demand gold: <input type="number" step="10000" min="0" value="${st.pgold}" data-d="pgold"> <span class="muted">(they have ${money(T.money)})</span></label>
      <label class="ck"><input type="checkbox" data-d="puppet" ${st.puppet ? "checked" : ""}> Make them your puppet</label>` : st.mode === "concede" ? `<div class="muted">They keep the ${lost} province${lost === 1 ? "" : "s"} they took from you.</div><label class="ck">Pay them gold: <input type="number" step="10000" min="0" value="${st.pgold}" data-d="pgold"> <span class="muted">(you have ${money(me.money)})</span></label>` : `<div class="muted">Everyone returns the land they took. War ends with a one-year truce.</div>`}
      <div class="dact"><button class="btn gold" data-d="send" data-type="peace">Send peace offer</button> ${pred("peace", peaceTerms)}</div>`);
  } else {
    const wg = me.wargoals[t], jus = me.justifying;
    const tax = (wg ? 0 : 10000) + (game.truce(player, t) ? 10000 : 0);
    let warBody;
    if (rel === "ally") warBody = `<div class="muted">${T.name} is your ally. Attacking them is a betrayal: you leave your side and join their enemies.</div><div class="dact"><button class="btn red" data-d="betray">Betray and declare war</button></div>`;
    else {
      const justRow = wg ? `<div>✓ You have a war goal against ${T.name}. Declaring war is free.</div>`
        : jus && jus.target === t ? `<div>Justifying… <b>${jus.days}</b> of ${jus.total} days left <div class="bar"><i style="width:${Math.round(100 * (1 - jus.days / jus.total))}%"></i></div></div>`
        : `<div class="dact"><button class="btn" data-d="justify" ${game.canJustify(player, t) ? "" : "disabled"}>Justify war goal</button> <span class="muted">${jus ? `Already justifying against ${COUNTRIES[jus.target].name}.` : me.pp < game.justifyCost(player) ? `Needs ${game.justifyCost(player)} political power (you have ${Math.floor(me.pp)}).` : `Costs ${game.justifyCost(player)} political power and takes ${Math.round(30 * (1 - game.mod(player, "justify")))} days. Then you can declare war with no war tax.`}</span></div>`;
      const defenders = [...new Set([...(game.factionOf(t)?.members || []), ...game.puppetsOf(t)])].filter(x => x !== t && game.c(x).alive).map(x => COUNTRIES[x].name);
      warBody = `${justRow}<div class="dact"><button class="btn red" data-d="declare">Declare war${tax ? ` (war tax ${money(tax)})` : ""}</button> <span class="muted">${tax ? (wg ? "" : "No war goal, so you pay the war tax. ") + (game.truce(player, t) ? "Breaks your truce (+$10,000). " : "") : ""}${defenders.length ? `Their allies join: ${defenders.slice(0, 6).join(", ")}${defenders.length > 6 ? "…" : ""}.` : ""}</span></div>`;
    }
    html += sec("War", warBody);
    html += sec("Alliance", k.kind === "none" ? `<div class="muted">${esc(k.text)}</div>` : `<div class="dact"><button class="btn" data-d="send" data-type="alliance">${esc(k.text)}</button> ${pred("alliance", {})}</div>`);
    if (rel !== "ally") {
      html += sec("Demand gold", `<label class="ck">Amount: <input type="number" step="10000" min="0" value="${st.gold}" data-d="gold"> <span class="muted">(they have ${money(T.money)})</span></label><div class="dact"><button class="btn" data-d="send" data-type="gold">Demand ${money(st.gold)}</button> ${pred("gold", { gold: st.gold })}</div>`);
      html += sec("Demand territory", border.length ? `<div class="tiles">${border.map(p => `<label class="ck"><input type="checkbox" data-d="tile" data-v="${p.id}" ${st.tiles.has(p.id) ? "checked" : ""}> ${esc(p.name)}${p.vp ? ` <span class="muted">VP ${p.vp}</span>` : ""}</label>`).join("")}</div><div class="dact"><button class="btn" data-d="send" data-type="tiles" ${st.tiles.size ? "" : "disabled"}>Demand ${st.tiles.size} province${st.tiles.size === 1 ? "" : "s"}</button> ${pred("tiles", { tiles: [...st.tiles] })}</div>` : `<div class="muted">You don't share a land border with them.</div>`);
      html += sec("Demand they become your puppet", `<div class="muted">Puppets fight on your side and pay you 25% of their income. After 180 days you can annex them.</div><div class="dact"><button class="btn" data-d="send" data-type="puppet">Demand puppet</button> ${pred("puppet", {})}</div>`);
      html += `<p class="muted" style="font-size:12px">If they refuse a demand, you get a free war goal against them (no war tax).</p>`;
    }
    if (T.overlord === player) html += sec("Your puppet", `<div class="dact"><button class="btn" data-d="annex" ${game.canAnnexPuppet(player, t) ? "" : "disabled"}>Annex</button><button class="btn" data-d="release">Release</button> <span class="muted">${game.canAnnexPuppet(player, t) ? "Ready to annex." : "Can annex 180 days after becoming a puppet."}</span></div>`);
  }
  $("modalCard").innerHTML = `<div class="dipmodal">${html}<div class="acts"><button class="btn" data-d="close">Close</button></div></div>`;
  $("modal").classList.remove("hidden");
  $("modalCard").onclick = e => {
    const b = e.target.closest("[data-d]"); if (!b || b.disabled) return;
    const d = b.dataset.d;
    if (d === "close") { closeDip(); return; }
    if (d === "mode") { st.mode = b.dataset.v; st.pgold = 0; dipModal(t); return; }
    if (d === "justify") { if (game.justify(player, t)) toast(`Justifying a war goal against ${T.name}…`); updateHud(); dipModal(t); return; }
    if (d === "declare") {
      const ok = game.forceWar(player, t);
      if (ok) { toast(`You declared war on ${T.name}!`, "war"); dipState.resume = 0; closeDip(); updateHud(); panelDay = -1; view.dirty = true; } else toast("You can't declare war on them right now.");
      return;
    }
    if (d === "betray") { const myF = game.factionOf(player); game.betray(player, t); toast(`You betrayed ${myF ? "the " + myF.name : T.name} and declared war on ${T.name}!`, "war"); dipState.resume = 0; closeDip(); updateHud(); panelDay = -1; view.dirty = true; return; }
    if (d === "annex") { game.annexPuppet(player, t); closeDip(); return; }
    if (d === "release") { game.releasePuppet(player, t); closeDip(); return; }
    if (d === "send") {
      const type = b.dataset.type;
      const terms = type === "gold" ? { gold: st.gold } : type === "tiles" ? { tiles: [...st.tiles] } : type === "peace" ? peaceTerms : {};
      const r = game.propose(type, player, t, terms);
      toast(r.ok ? `${T.name} accepted!` : `${T.name} refused: ${r.msg || ""}${["gold", "tiles", "puppet"].includes(type) && !r.ok ? " You gained a war goal against them." : ""}`, r.ok ? "" : "war");
      updateHud(); panelDay = -1; view.dirty = true;
      if (r.ok) { closeDip(); return; }
      dipModal(t); return;
    }
  };
  $("modalCard").onchange = e => {
    const b = e.target.closest("[data-d]"); if (!b) return;
    const d = b.dataset.d;
    if (d === "keep") st.keep = b.checked;
    if (d === "puppet") st.puppet = b.checked;
    if (d === "gold") st.gold = Math.max(0, +b.value || 0);
    if (d === "pgold") st.pgold = Math.max(0, +b.value || 0);
    if (d === "tile") { const id = +b.dataset.v; b.checked ? st.tiles.add(id) : st.tiles.delete(id); }
    dipModal(t);
  };
}
function closeDip() {
  $("modal").classList.add("hidden");
  $("modalCard").onclick = null; $("modalCard").onchange = null;
  if (dipState?.resume) setSpeed(dipState.resume);
  dipState = null; panelDay = -1; renderPanel();
}

function showPending(p) {
  const was = speed; setSpeed(0);
  const F = game.c(p.from);
  const kind = { alliance: "Alliance proposal", gold: "Demand for gold", tiles: "Demand for territory", puppet: "Demand to become a puppet", peace: "Peace offer" }[p.type];
  const warn = ["gold", "tiles", "puppet"].includes(p.type) ? `<p class="muted">If you refuse, ${F.name} gets a war goal against you.</p>` : p.type === "peace" && p.terms.demander === p.from ? `<p class="muted">Refusing means the war goes on.</p>` : "";
  $("modalCard").innerHTML = `<div class="dipmodal"><div class="dhead">${flag(p.from)} <b>${kind}</b> <span class="muted">from ${F.name}</span></div><p style="text-align:left">${esc(p.text)}</p>${warn}
    <div class="acts"><button class="btn gold" id="pAcc">Accept</button><button class="btn red" id="pRef">Refuse</button></div></div>`;
  $("modal").classList.remove("hidden");
  const done = acc => { game.resolvePending(p.id, acc); $("modal").classList.add("hidden"); setSpeed(was); updateHud(); panelDay = -1; view.dirty = true; };
  $("pAcc").onclick = () => done(true);
  $("pRef").onclick = () => done(false);
}

function battleHtml(p) {
  const b = game.battles.get(p.id);
  if (!b) return "";
  const attackers = [...game.divs.values()].filter(d => d.attacking === p.id);
  const defenders = [...p.divs].map(i => game.divs.get(i)).filter(d => d && game.atWar(d.tag, b.attTag));
  const share = b.A / (b.A + b.D);
  const side = list => list.slice(0, 8).map(d => `<div class="divrow">${icon(d.type, 16)}<div class="hp"><i style="width:${d.str * 100}%;background:${hpColor(d.str)}"></i><span>${men(d)}</span></div>${flag(d.tag)}</div>`).join("") + (list.length > 8 ? `<div class="muted">+${list.length - 8} more</div>` : "");
  return `<div class="battle"><div class="bt-head">⚔ Battle for ${esc(p.name)}</div>
    <div class="bt-bar"><i style="width:${share * 100}%"></i></div>
    <div class="bt-sides"><span>${flag(b.attTag)} Attack ${Math.round(share * 100)}%</span><span>Defense ${Math.round((1 - share) * 100)}% ${flag(b.defTag)}</span></div>
    <div class="grid2"><div>${side(attackers)}</div><div>${side(defenders)}</div></div></div>`;
}

function updateMoveHint() {
  const h = $("moveHint");
  if (!h) return;
  const n = game ? [...view.selected].filter(i => game.divs.get(i)).length : 0;
  h.classList.toggle("hidden", !n);
  if (n) h.innerHTML = `<b>${n} unit${n > 1 ? "s" : ""} selected.</b> Hover over where you want to go, then <b>LEFT-CLICK</b> to move. <span class="muted">Right-click or Esc cancels.</span>`;
}

function showDivInfo() {
  updatePreview();
  updateMoveHint();
  const el = $("info");
  const ds = [...view.selected].map(i => game.divs.get(i)).filter(Boolean);
  view.selected = new Set(ds.map(d => d.id));
  if (!ds.length) { el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  const sup = game.c(player).supplied;
  const land = ds.filter(d => d.domain === "land");
  const avg = (arr, k) => arr.length ? Math.round(arr.reduce((s, d) => s + d[k], 0) / arr.length * 100) : 0;
  const summary = UNIT_ORDER.map(t => { const n = ds.filter(d => d.type === t).length; return n ? `<span style="display:inline-flex;align-items:center;gap:4px;margin:0 10px 4px 0">${icon(t, 20)}<b>${n}</b> ${UNIT[t].name}</span>` : ""; }).join("");
  const rows = ds.slice(0, 14).map(d => `<div class="divrow">${icon(d.type, 18)}<div><div class="hp"><i style="width:${d.str * 100}%;background:${hpColor(d.str)}"></i><span>${ROMAN[(d.tier || 1) - 1]} · ${men(d)}</span></div>${d.domain === "land" ? `<div class="bar"><i style="width:${d.org * 100}%"></i></div>` : ""}</div><span class="muted">${esc(game.P[d.prov].name)}${d.attacking != null ? " ⚔" : d.path.length ? " → " + esc(game.P[d.path[d.path.length - 1].id].name) : ""}${d.domain === "land" && !sup.has(d.prov) ? " ⚠" : ""}</span></div>`).join("");
  el.innerHTML = `<h3>${flag(player)} ${ds.length} unit${ds.length > 1 ? "s" : ""} selected</h3><div style="display:flex;flex-wrap:wrap;margin-bottom:6px">${summary}</div>
  ${land.length ? `<div class="kv"><span class="k">Soldiers</span><span>${Math.round(land.reduce((s, d) => s + d.str * crew(d), 0)).toLocaleString()} / ${land.reduce((s, d) => s + crew(d), 0).toLocaleString()} (${avg(land, "str")}%)</span><span class="k">Organization</span><span>${avg(land, "org")}%</span>
  <span class="k">Supply</span><span>${land.every(d => sup.has(d.prov)) ? "Supplied" : '<b style="color:#ff8a7a">Some out of supply</b>'}</span></div>` : ""}
  <div style="margin-top:8px">${rows}${ds.length > 14 ? `<div class="muted">…and ${ds.length - 14} more</div>` : ""}</div>
  <div class="muted" style="margin-top:8px">Click a province to move${land.length ? " or attack" : ""}.${ds.some(d => d.domain === "air") ? " Aircraft can only fly to friendly provinces." : ""}${ds.some(d => d.domain === "sea") ? " Fleets can only dock in friendly coastal provinces." : ""}</div>
  <div class="acts"><button class="btn sm" data-act="stop">Stop</button><button class="btn sm" data-act="desel">Deselect</button></div>`;
  infoDay = Math.floor(game.hourCount / 24);
  view.dirty = true;
}

function updatePreview() {
  view.preview = null;
  if (!game || !view.selected.size || !view.hoverProv) return;
  view.preview = { none: true, to: view.hoverProv.id };
  const d = [...view.selected].map(i => game.divs.get(i)).find(x => x && x.domain === "land") || game.divs.get([...view.selected][0]);
  if (!d || d.prov === view.hoverProv.id) { view.preview = null; return; }
  let path = game.computePath(d, view.hoverProv.id);
  const rel = game.relation(player, view.hoverProv.ctrl);
  let blocked = false;
  if (!path && d.domain === "land" && rel === "neutral") {
    const saved = game.rel[player][view.hoverProv.ctrl];
    game.rel[player][view.hoverProv.ctrl] = "enemy";
    for (const t of Object.keys(game.countries)) if (game.factionOf(view.hoverProv.ctrl)?.members.has(t)) game.rel[player][t] = "enemy";
    path = game.computePath(d, view.hoverProv.id);
    game.rebuildRelations();
    blocked = true;
  }
  const occ = !blocked && rel !== "enemy" && game.occupiedBy(view.hoverProv.id, player, d.domain, d.id) && ![...view.selected].includes(game.occupiedBy(view.hoverProv.id, player, d.domain, d.id).id);
  if (path && path.length) view.preview = { from: d.prov, to: view.hoverProv.id, path: path.map(s => s.id), attack: rel === "enemy" || blocked, war: blocked, occupied: !!occ, many: view.selected.size };
}

function finishOrder(p) {
  if (moveSelected(p)) { view.selected.clear(); view.preview = null; $("info").classList.add("hidden"); view.selProv = null; }
  updateMoveHint();
  view.dirty = true;
}

function orderWithDiplomacy(p, clickedTag) {
  const hasLand = [...view.selected].some(i => game.divs.get(i)?.domain === "land");
  const target = clickedTag || (p.ctrl !== player ? p.ctrl : null);
  if (!hasLand || !target) return finishOrder(p);
  const rel = game.relation(player, target);
  const T = game.c(target);
  if (rel === "neutral") {
    const taxed = !game.c(player).wargoals[target];
    game.forceWar(player, target);
    toast(`Attacking ${T.name}!${taxed ? ` (war tax ${money(10000)})` : ""}`, "war");
    finishOrder(p); panelDay = -1; updateHud();
    return;
  }
  if (rel === "ally" && T.overlord !== player) {
    const myF = game.factionOf(player);
    game.betray(player, target);
    toast(`You betrayed ${myF ? "the " + myF.name : T.name} and attacked ${T.name}! You are now in the ${game.factionOf(player)?.name || "your own faction"}.`, "war");
    finishOrder(p); panelDay = -1; updateHud();
    return;
  }
  finishOrder(p);
}

function confirmBox(title, html, okLabel, cls, onOk) {
  const was = speed; setSpeed(0);
  $("modalCard").innerHTML = `<h2 style="font-size:26px">${esc(title)}</h2><p>${html}</p><div class="acts"><button class="btn ${cls}" id="cOk">${esc(okLabel)}</button><button class="btn" id="cNo">Cancel</button></div>`;
  $("modal").classList.remove("hidden");
  $("cOk").onclick = () => { $("modal").classList.add("hidden"); onOk(); setSpeed(was); };
  $("cNo").onclick = () => { $("modal").classList.add("hidden"); setSpeed(was); };
}

function moveSelected(p) {
  if (!view.selected.size || !p) return 0;
  const n = game.orderGroup([...view.selected], p.id);
  if (!n) toast(view.selected.size && [...view.selected].every(i => game.divs.get(i)?.domain === "sea") ? "Fleets can only sail to friendly coastal provinces." : [...view.selected].every(i => game.divs.get(i)?.domain === "air") ? "Aircraft can only fly to friendly provinces." : "No route there. You can't enter neutral countries.");
  else if (game.atWar(player, p.ctrl)) toast(`${n} division${n > 1 ? "s" : ""} attacking ${p.name}`);
  view.dirty = true;
  showDivInfo();
  return n;
}

let down = null, pointers = new Map(), pinch = null, lastTap = 0;
canvas.addEventListener("pointerdown", e => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; down = null; return; }
  down = { x: e.clientX, y: e.clientY, btn: e.button, shift: e.shiftKey || e.ctrlKey || e.metaKey, moved: false, ox: view.ox, oy: view.oy, type: e.pointerType };
  if (e.button === 0 && e.shiftKey && game) view.box = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY };
});
canvas.addEventListener("pointermove", e => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
    view.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch.d); pinch.d = d; return;
  }
  if (down) {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) down.moved = true;
    if (view.box) { view.box.x1 = e.clientX; view.box.y1 = e.clientY; view.dirty = true; }
    else if (down.moved && down.btn === 0) { view.ox = down.ox + e.clientX - down.x; view.oy = down.oy + e.clientY - down.y; view.clamp(); view.dirty = true; }
  } else if (e.pointerType !== "touch") {
    const p = view.provAt(e.clientX, e.clientY);
    view.mouse = [e.clientX, e.clientY];
    if (p !== view.hoverProv) { view.hoverProv = p; view.dirty = true; updatePreview(); }
    else if (view.selected.size) view.dirty = true;
    const ctr = game ? view.countersAt(e.clientX, e.clientY) : null;
    const tip = $("tip");
    if (ctr) {
      const ds = ctr.ids.map(i => game.divs.get(i)).filter(Boolean);
      const rel = ctr.tag === player ? "Yours" : { ally: "Ally", enemy: "Enemy", neutral: "Neutral" }[game.relation(player, ctr.tag)];
      tip.innerHTML = `<b>${COUNTRIES[ctr.tag].name}</b> · ${rel}<br>${ds.length} × ${UNIT[ctr.type].name}<div style="margin-top:4px;display:grid;gap:3px;min-width:200px">${ds.slice(0, 8).map(d => `<div class="hp"><i style="width:${d.str * 100}%;background:${hpColor(d.str)}"></i><span>Tier ${ROMAN[(d.tier || 1) - 1]} · ${men(d)}</span></div>`).join("")}${ds.length > 8 ? `<span class="muted">+${ds.length - 8} more</span>` : ""}</div>${view.selected.size && ctr.tag !== player ? `<div style="margin-top:4px;color:#ff8a7a">Click to attack</div>` : ""}`;
      tip.classList.remove("hidden");
      const r = tip.getBoundingClientRect();
      tip.style.left = Math.min(innerWidth - r.width - 8, e.clientX + 14) + "px";
      tip.style.top = Math.min(innerHeight - r.height - 8, e.clientY + 14) + "px";
      tip.dataset.map = "1";
    } else if (tip.dataset.map) { tip.classList.add("hidden"); delete tip.dataset.map; }
  }
});
canvas.addEventListener("pointerup", e => {
  pointers.delete(e.pointerId);
  if (pinch) { if (pointers.size < 2) pinch = null; down = null; return; }
  if (!down) return;
  const d = down; down = null;
  if (!game) return;
  if (view.box) {
    const { x0, y0, x1, y1 } = view.box; view.box = null;
    if (d.moved) {
      const [ax, ay] = view.toWorld(Math.min(x0, x1), Math.min(y0, y1)), [bx, by] = view.toWorld(Math.max(x0, x1), Math.max(y0, y1));
      for (const div of game.unitsOf(player)) { const c = game.P[div.prov].c; if (c[0] >= ax && c[0] <= bx && c[1] >= ay && c[1] <= by) view.selected.add(div.id); }
      showDivInfo(); view.dirty = true; return;
    }
  }
  if (d.moved) return;
  if (d.btn === 2) return;
  handleClick(e.clientX, e.clientY, d.shift, d.type);
});
canvas.addEventListener("contextmenu", e => {
  e.preventDefault();
  if (!game) return;
  if (view.buildMode) { setBuildMode(null); return; }
  if (view.selected.size) { view.selected.clear(); view.preview = null; $("info").classList.add("hidden"); view.dirty = true; updateMoveHint(); }
});
canvas.addEventListener("wheel", e => { e.preventDefault(); view.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });

function handleClick(x, y, shift, ptype) {
  if (view.buildMode) {
    const p = view.provAt(x, y);
    if (p && game.queueBuild(player, view.buildMode, p.id)) { toast(`${BUILD[view.buildMode].name} queued in ${p.name}.`); if (tab === "production") renderPanel(); }
    else toast(p && game.canBuild(player, view.buildMode, p.id) ? `Not enough money (${money(BUILD[view.buildMode].money)} needed).` : "You can't build there.");
    if (!shift) setBuildMode(null);
    view.dirty = true; return;
  }
  const ctr = view.countersAt(x, y);
  const selProvs = new Set([...view.selected].map(i => game.divs.get(i)?.prov));
  if (ctr && ctr.tag === player && view.selected.size && !shift && !selProvs.has(ctr.prov)) { finishOrder(game.P[ctr.prov]); return; }
  if (ctr && ctr.tag === player) {
    if (shift && ctr.ids.every(i => view.selected.has(i))) { for (const i of ctr.ids) view.selected.delete(i); view.dirty = true; if (view.selected.size) showDivInfo(); else $("info").classList.add("hidden"); return; }
    if (!shift) view.selected.clear();
    const now = performance.now();
    const ids = now - lastTap < 350 ? game.divsOf(player, UNIT[ctr.type].domain).filter(d => d.type === ctr.type && Math.hypot(game.P[d.prov].c[0] - game.P[ctr.prov].c[0], game.P[d.prov].c[1] - game.P[ctr.prov].c[1]) < 120).map(d => d.id) : ctr.ids;
    lastTap = now;
    for (const id of ids) view.selected.add(id);
    view.selProv = null; showDivInfo(); return;
  }
  const p = view.provAt(x, y);
  if (view.selected.size && !shift) {
    if (!p) { view.selected.clear(); $("info").classList.add("hidden"); view.dirty = true; return; }
    orderWithDiplomacy(p, ctr && ctr.tag !== player ? ctr.tag : null);
    return;
  }
  if (!shift) view.selected.clear();
  if (p) {
    const mine = [...p.divs, ...p.air, ...p.ships].map(i => game.divs.get(i)).filter(d => d && d.tag === player);
    const land = mine.filter(d => d.domain === "land");
    if (mine.length) {
      for (const d of (land.length ? land : mine)) view.selected.add(d.id);
      view.selProv = null; showDivInfo(); view.dirty = true; return;
    }
  }
  view.selProv = p;
  if (p) showProvInfo(p); else $("info").classList.add("hidden");
  view.dirty = true;
}

addEventListener("keydown", e => {
  if (!game || e.target.tagName === "INPUT") return;
  const k = e.key.toLowerCase();
  if (k === " ") { e.preventDefault(); setSpeed(speed >= 5 ? 0 : speed + 1); toast(speed ? `Speed ${speed}` : "Paused"); }
  else if ("12345".includes(k) && k.length === 1) setSpeed(+k);
  else if (k === "g") { view.selected.clear(); for (const d of game.divsOf(player)) view.selected.add(d.id); view.dirty = true; if (view.selected.size) { showDivInfo(); toast(`Selected all ${view.selected.size} land units`); } }
  else if (k === "f") openTab(tab === "focus" ? null : "focus");
  else if (k === "r") openTab(tab === "research" ? null : "research");
  else if (k === "p") openTab(tab === "production" ? null : "production");
  else if (k === "a") openTab(tab === "army" ? null : "army");
  else if (k === "d") openTab(tab === "diplomacy" ? null : "diplomacy");
  else if (k === "h" || k === "?") openTab(tab === "help" ? null : "help");
  else if (k === "b") openTab(tab === "battlelog" ? null : "battlelog");
  else if (k === "m") toggleMode();
  else if (k === "l") $("legend").classList.toggle("hidden");
  else if (k === "escape") { if (view.buildMode) setBuildMode(null); else if (view.selected.size) { view.selected.clear(); view.preview = null; $("info").classList.add("hidden"); updateMoveHint(); } else openTab(null); view.dirty = true; }
  else if (k === "+" || k === "=") view.zoomAt(view.vw / 2, view.vh / 2, 1.25);
  else if (k === "-") view.zoomAt(view.vw / 2, view.vh / 2, 0.8);
  if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { e.preventDefault(); panKeys.add(k); }
});
addEventListener("keyup", e => panKeys.delete(e.key.toLowerCase()));
const panKeys = new Set();

function bindTips(root) {
  const tip = $("tip");
  root.addEventListener("mouseover", e => {
    const el = e.target.closest("[data-tip]");
    if (!el) { tip.classList.add("hidden"); return; }
    tip.innerHTML = el.dataset.tip; tip.classList.remove("hidden");
  });
  root.addEventListener("mousemove", e => {
    if (tip.classList.contains("hidden")) return;
    const r = tip.getBoundingClientRect();
    tip.style.left = Math.min(innerWidth - r.width - 8, e.clientX + 14) + "px";
    tip.style.top = Math.min(innerHeight - r.height - 8, e.clientY + 14) + "px";
  });
}

function loop(now) {
  try { loopInner(now); } catch (err) { console.error(err); if (view) view.dirty = true; }
  requestAnimationFrame(loop);
}

function loopInner(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  if (view && panKeys.size) {
    const v = 700 * dt;
    if (panKeys.has("arrowup")) view.oy += v;
    if (panKeys.has("arrowdown")) view.oy -= v;
    if (panKeys.has("arrowleft")) view.ox += v;
    if (panKeys.has("arrowright")) view.ox -= v;
    view.clamp(); view.dirty = true;
  }
  if (game && speed > 0 && !game.gameOver) {
    acc += dt * SPEEDS[speed];
    let n = 0;
    while (acc >= 1 && n < 240) { game.tickHour(); acc--; n++; }
    view.frac = acc;
    view.dirty = true;
    if (game.time >= END && !game.gameOver && !endShown) {
      endShown = true;
      const own = game.P.filter(p => p.owner === player).length;
      game.gameOver = { win: true, end: true, text: `The year is 1950. ${game.c(player).name} controls ${own} provinces.` };
    }
    if (game.gameOver) showGameOver();
  }
  if (game && now - lastHud > 250) { updateHud(); lastHud = now; }
  if (game && tab && now - lastPanel > 400 && Math.floor(game.hourCount / 24) !== panelDay && !document.querySelector("#panelBody:hover input")) { renderPanel(); lastPanel = now; }
  if (game && now - lastPanel > 400 && Math.floor(game.hourCount / 24) !== infoDay && !$("info").classList.contains("hidden") && !$("info").matches(":hover")) {
    if (view.selected.size) showDivInfo(); else if (view.selProv) showProvInfo(view.selProv);
  }
  if (game && game.pending.length && $("modal").classList.contains("hidden")) showPending(game.pending[0]);
  if (view && view.dirty) view.draw();
}

function showGameOver() {
  setSpeed(0);
  const g = game.gameOver;
  const c = game.c(player);
  $("modalCard").innerHTML = `<h2>${g.end ? "The End" : g.win ? "Victory" : "Defeat"}</h2><p>${esc(g.text)}</p>
    <p class="muted">${dateStr(game.time)} · ${c.kills} enemy divisions destroyed · ${c.losses} divisions lost</p>
    <div class="acts"><button class="btn gold" id="againBtn">New game</button>${!g.win ? "" : `<button class="btn" id="keepBtn">Keep watching</button>`}</div>`;
  $("modal").classList.remove("hidden");
  $("againBtn").onclick = () => location.reload();
  if ($("keepBtn")) $("keepBtn").onclick = () => { $("modal").classList.add("hidden"); game.gameOver = null; };
}

boot();
