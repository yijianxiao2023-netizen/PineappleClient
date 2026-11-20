import { COUNTRIES, UNIT, BUILD, TECHS, IDEOLOGY, TERRAIN, FACTIONS } from "./data.js";
import { Game, dateStr } from "./sim.js";
import { runAI, aiAcceptsFaction } from "./ai.js";
import { MapView } from "./render.js";

const $ = id => document.getElementById(id);
const SPEEDS = [0, 4, 12, 36, 96, 240];
const END = Date.UTC(1950, 0, 1);
const fmt = n => n >= 10000 ? (n / 1000).toFixed(0) + "k" : n >= 1000 ? (n / 1000).toFixed(1) + "k" : Math.floor(n).toString();
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const flag = tag => `<span class="swatch" style="background:${COUNTRIES[tag].color}"></span>`;
const TECH = Object.fromEntries(TECHS.map(t => [t.id, t]));

let MAP, game, view, player = null, speed = 0, lastSpeed = 2, tab = null, picked = null;
let endShown = false, acc = 0, lastFrame = performance.now(), lastHud = 0, lastPanel = 0, panelDay = -1, infoDay = -1;
const canvas = $("map");

async function boot() {
  const res = await fetch("data/map.json");
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
      <div class="st"><span>Civ. factories</span><b>${c.civ}</b><span>Mil. factories</span><b>${c.mil}</b><span>Divisions</span><b>${c.divs}</b><span>Navy</span><b>${c.navy}</b></div></button>`;
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
  game = new Game(MAP, { player: tag });
  game.ai = runAI;
  view = new MapView(canvas, game);
  const cap = game.P[game.c(tag).capital];
  view.focusOn(cap.c[0], cap.c[1], 1.5);
  $("start").classList.add("hidden");
  $("hud").classList.remove("hidden");
  setupHud();
  game.on(onEvent);
  setSpeed(0);
  const f = game.factionOf(tag);
  toast(`You lead ${game.c(tag).name}${f ? ", a member of the " + f.name : ""}. Press Space to start time.`);
  openTab("focus");
}

function onEvent(e) {
  if (e.type === "date") return;
  const mine = e.tags.includes(player) || (e.tags.some(t => game.friendly(player, t)) && (e.type === "war" || e.type === "major"));
  const major = e.tags.some(t => COUNTRIES[t]?.major);
  if (e.type === "world" && !mine) return;
  addLog(e);
  if ((e.type === "war" || e.type === "major") && (mine || major)) toast(e.text, e.type === "war" ? "war" : "");
  if (e.type === "war" && e.tags[1] === player) { setSpeed(0); }
  panelDay = -1;
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
  $("speeds").innerHTML = `<button class="pause" data-s="0" title="Pause (Space)">❚❚</button>` + [1, 2, 3, 4, 5].map(s => `<button data-s="${s}" title="Speed ${s}">${s}</button>`).join("");
  $("speeds").onclick = e => { const b = e.target.closest("button"); if (b) setSpeed(+b.dataset.s); };
  document.querySelectorAll("#sidebar [data-tab]").forEach(b => b.onclick = () => openTab(tab === b.dataset.tab ? null : b.dataset.tab));
  $("modeBtn").onclick = toggleMode;
  $("panelClose").onclick = () => openTab(null);
  $("panelBody").addEventListener("click", onPanelClick);
  $("panelBody").addEventListener("input", onPanelInput);
  $("info").addEventListener("click", onPanelClick);
  bindTips(document.body);
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
  const R = (k, v, tip, warn) => `<div class="r ${warn ? "warn" : ""}" data-tip="${esc(tip)}"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  $("tbRes").innerHTML =
    R("Political", `${Math.floor(c.pp)} <small>+${(2 + (c.mods.ppGain || 0)).toFixed(1)}</small>`, "<b>Political power</b><br>Spent on war goals and guarantees.") +
    R("Civilian", `${c.civEff.toFixed(0)}`, `<b>Civilian factories</b><br>Build new factories and forts. ${Math.round(c.civEff * 5 * (1 + (c.mods.construction || 0)))} construction points per day.`) +
    R("Military", `${c.milEff.toFixed(0)}`, `<b>Military factories</b><br>Produce ${Math.round(prod)} production points per day of infantry equipment and tanks.`) +
    R("Manpower", fmt(c.manpower * 1000), "<b>Manpower</b><br>Needed to train and reinforce divisions.", c.manpower < 20) +
    R("Equipment", fmt(c.eqInf), "<b>Infantry equipment</b><br>Each infantry division needs 1,000.", c.eqInf < 500) +
    R("Tanks", fmt(c.tanks), "<b>Tanks</b><br>Each armored division needs 150. Unlock with Light Tanks research.") +
    R("Divisions", `${divs.length}${c.training.length ? ` <small>+${c.training.length}</small>` : ""}`, "<b>Divisions</b><br>Divisions in the field, plus those in training.") +
    R("Navy", `${game.navyPower(player)}`, "<b>Naval strength</b> (you and your allies)<br>Sea invasions need at least 90% of the enemy's naval strength.");
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
  const titles = { focus: "National Focus", research: "Research", production: "Industry", army: "Army", diplomacy: "Diplomacy", help: "How to Play" };
  $("panelTitle").textContent = titles[tab];
  const st = $("panelBody").scrollTop, sl = $("panelBody").scrollLeft;
  $("panelBody").innerHTML = { focus: renderFocus, research: renderResearch, production: renderProduction, army: renderArmy, diplomacy: renderDiplomacy, help: renderHelp }[tab]();
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
  const share = armor ? c.infShare : 1;
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
      <button class="btn" data-act="build" data-type="civ" data-tip="<b>Civilian factory</b><br>${BUILD.civ.cost} points. Speeds up future construction.">+ Civilian factory</button>
      <button class="btn" data-act="build" data-type="mil" data-tip="<b>Military factory</b><br>${BUILD.mil.cost} points. Produces equipment and tanks.">+ Military factory</button>
      <button class="btn" data-act="build" data-type="fort" data-tip="<b>Land fort</b><br>${BUILD.fort.cost} points. +15% defense per level, up to 5.">+ Land fort</button>
      <button class="btn" data-act="autobuild" data-tip="Queue a military factory in the best free spot.">Auto-build</button>
    </div>${queue}</div>
  <div class="sec"><h4>Military production <small>${Math.round(prod)} points / day</small></h4>
    ${armor ? `<div style="display:flex;justify-content:space-between" class="muted"><span>Infantry equipment ${Math.round(share * 100)}%</span><span>Tanks ${Math.round((1 - share) * 100)}%</span></div><input type="range" min="0" max="100" value="${Math.round(share * 100)}" data-act="share">` : `<div class="muted">All output goes to infantry equipment. Research <b>Light Tanks</b> to build tanks.</div>`}
    <div class="kv" style="margin-top:8px"><span class="k">Infantry equipment</span><span>${fmt(c.eqInf)} (+${Math.round(prod * share / 0.5)}/day)</span><span class="k">Tanks</span><span>${fmt(c.tanks)}${armor ? ` (+${(prod * (1 - share) / 4).toFixed(1)}/day)` : ""}</span></div>
  </div>`;
}

function renderArmy() {
  const c = game.c(player);
  const divs = game.divsOf(player);
  const inf = divs.filter(d => d.type === "inf").length, arm = divs.length - inf;
  const avgStr = divs.length ? divs.reduce((s, d) => s + d.str, 0) / divs.length : 0;
  const train = c.training.map(t => `<div class="row"><div class="grow"><div class="t">${UNIT[t.type].name} division</div><div class="s">${t.days} days left</div><div class="bar"><i style="width:${(1 - t.days / t.total) * 100}%"></i></div></div></div>`).join("") || `<div class="muted">No divisions in training.</div>`;
  const btn = (type, n) => `<button class="btn ${n === 1 ? "gold" : ""}" data-act="train" data-type="${type}" data-n="${n}" ${game.canTrain(player, type) ? "" : "disabled"}>Train ${n > 1 ? n + "× " : ""}${UNIT[type].name}</button>`;
  return `
  <div class="sec"><h4>Forces</h4><div class="kv">
    <span class="k">Divisions</span><span>${divs.length} (${inf} infantry, ${arm} armored)</span>
    <span class="k">Average strength</span><span>${Math.round(avgStr * 100)}%</span>
    <span class="k">Manpower</span><span>${fmt(c.manpower * 1000)}</span>
    <span class="k">Equipment</span><span>${fmt(c.eqInf)} infantry equipment, ${fmt(c.tanks)} tanks</span>
    <span class="k">Battles won / lost</span><span>${c.kills} divisions destroyed / ${c.losses} lost</span>
  </div></div>
  <div class="sec"><h4>Train divisions</h4>
    <div class="grid2">${btn("inf", 1)}${btn("inf", 5)}${btn("arm", 1)}${btn("arm", 3)}</div>
    <p class="muted" style="margin:8px 0 0;line-height:1.5">Infantry: ${UNIT.inf.eq} equipment, ${UNIT.inf.mp}k men, ${UNIT.inf.days} days. Strong defenders.<br>Armored: ${UNIT.arm.eq} equipment + ${UNIT.arm.tanks} tanks, ${UNIT.arm.mp}k men, ${UNIT.arm.days} days. Fast and hard-hitting, weaker in rough terrain.<br>New divisions appear at your capital.</p>
  </div>
  <div class="sec"><h4>In training</h4>${train}</div>
  <div class="sec"><h4>Orders</h4><div class="grid2">
    <button class="btn" data-act="selall">Select all divisions</button>
    <button class="btn" data-act="selidle">Select idle divisions</button>
  </div><p class="muted" style="line-height:1.5">Click a counter to select it, or Shift-drag to box-select. Then <b>right-click</b> a province to move or attack. On touch screens, tap a province.</p></div>`;
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
  return `<div class="row">${flag(t)}<div class="grow"><div class="t">${o.name} ${c.guarantees.has(t) ? '<span class="chip ally">guaranteed</span>' : ""}</div><div class="s">${IDEOLOGY[o.ideology].name} · ${divs} divisions · ${o.civEff.toFixed(0)}/${o.milEff.toFixed(0)} factories</div></div><span class="chip ${rel}">${relName}</span>${acts}</div>`;
}

function renderHelp() {
  return `<div class="help">
  <p><b>Goal:</b> Lead your nation from 1936 to 1950. Build industry, research technology, raise armies and win your wars. The starting alliances follow history, but every war is decided fresh each game.</p>
  <h4>Controls</h4><ul>
    <li><kbd>Space</kbd> pause or unpause, <kbd>1</kbd>–<kbd>5</kbd> game speed.</li>
    <li>Drag to pan, scroll to zoom. The arrow keys also pan.</li>
    <li>Click a division counter to select it. <kbd>Shift</kbd>-click adds more, <kbd>Shift</kbd>-drag box-selects.</li>
    <li><b>Right-click</b> a province to move or attack with the selected divisions. Paths go around neutral countries.</li>
    <li><kbd>F</kbd> Focus · <kbd>R</kbd> Research · <kbd>P</kbd> Industry · <kbd>A</kbd> Army · <kbd>D</kbd> Diplomacy · <kbd>M</kbd> map mode · <kbd>Esc</kbd> deselect.</li></ul>
  <h4>Warfare</h4><ul>
    <li>Moving into a province with enemy divisions starts a battle. The bar under the swords shows which side is winning.</li>
    <li>Defenders get bonuses from terrain, forts and digging in. Attack with about 2 to 1 odds or bring armor.</li>
    <li>Divisions with no route back to your capital are <b>out of supply</b>. They lose strength and can't recover organization.</li>
    <li>Broken divisions retreat. If they have nowhere to go, they're destroyed. Encircle your enemies!</li>
    <li>Sea crossings are slow. Landing on an enemy coast needs a navy at least 90% as strong as theirs.</li>
    <li>A country surrenders when it loses most of its core territory, or its capital plus a large share. Its land goes to the occupiers.</li></ul>
  <h4>Economy</h4><ul>
    <li>Civilian factories build things. Military factories make equipment. Captured factories work at reduced output.</li>
    <li>Divisions need equipment and manpower to train and to refill losses.</li></ul></div>`;
}

function onPanelInput(e) {
  if (e.target.dataset.act === "share") { game.c(player).infShare = +e.target.value / 100; }
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
    if (cands.length) { game.queueBuild(player, "mil", cands[0].id); toast(`Military factory queued in ${cands[0].name}.`); } else toast("No free factory slots. Build forts or capture more land.");
  }
  else if (a === "unbuild") c.construction.splice(+el.dataset.i, 1);
  else if (a === "train") { let n = 0; for (let i = 0; i < +el.dataset.n; i++) if (game.train(player, el.dataset.type)) n++; if (!n) toast("Not enough equipment or manpower."); }
  else if (a === "selall") { view.selected = new Set(game.divsOf(player).map(d => d.id)); showDivInfo(); }
  else if (a === "selidle") { view.selected = new Set(game.divsOf(player).filter(d => !d.path.length).map(d => d.id)); showDivInfo(); }
  else if (a === "justify") { if (game.justify(player, el.dataset.t)) toast(`Justifying a war goal against ${COUNTRIES[el.dataset.t].name}…`); }
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
  else if (a === "stop") { for (const id of view.selected) { const d = game.divs.get(id); if (d) { d.path = []; d.attacking = null; } } }
  else if (a === "desel") { view.selected.clear(); $("info").classList.add("hidden"); }
  else if (a === "selprov") { const p = game.P[+el.dataset.p]; view.selected = new Set([...p.divs].filter(i => game.divs.get(i)?.tag === player)); showDivInfo(); }
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
  for (const id of p.divs) { const d = game.divs.get(id); if (d) here.set(d.tag, (here.get(d.tag) || 0) + 1); }
  const rel = game.relation(player, p.ctrl);
  const queued = game.c(p.owner).construction.filter(i => i.prov === p.id).length;
  el.innerHTML = `<h3>${flag(p.owner)} ${esc(p.name)}</h3><div class="sub">${TERRAIN[p.terrain].name}${p.vp ? " · Victory points " + p.vp : ""}${p.capital && p.capital === p.owner ? " · Capital" : ""}</div>
  <div class="kv"><span class="k">Owner</span><span>${COUNTRIES[p.owner].name}</span>
  ${p.ctrl !== p.owner ? `<span class="k">Occupied by</span><span>${COUNTRIES[p.ctrl].name}</span>` : ""}
  <span class="k">Relation</span><span><span class="chip ${p.ctrl === player ? "self" : rel}">${p.ctrl === player ? "Yours" : rel}</span></span>
  <span class="k">Factories</span><span>${p.civ} civilian, ${p.mil} military (${p.slots} slots${queued ? `, ${queued} queued` : ""})</span>
  <span class="k">Fort level</span><span>${p.fort}</span>
  <span class="k">Divisions</span><span>${[...here].map(([t, n]) => flag(t) + " " + n).join(" &nbsp;") || "None"}</span></div>
  <div class="acts">
    ${here.get(player) ? `<button class="btn sm" data-act="selprov" data-p="${p.id}">Select my divisions</button>` : ""}
    ${view.selected.size ? `<button class="btn sm gold" data-act="movehere" data-p="${p.id}">Move selected here</button>` : ""}
    ${own ? ["civ", "mil", "fort"].map(t => `<button class="btn sm" data-act="pbuild" data-type="${t}" data-p="${p.id}" ${game.canBuild(player, t, p.id) ? "" : "disabled"}>+ ${t === "civ" ? "Civilian" : t === "mil" ? "Military" : "Fort"}</button>`).join("") : ""}
  </div>`;
  infoDay = Math.floor(game.hourCount / 24);
}

function showDivInfo() {
  const el = $("info");
  const ds = [...view.selected].map(i => game.divs.get(i)).filter(Boolean);
  view.selected = new Set(ds.map(d => d.id));
  if (!ds.length) { el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  const avg = k => Math.round(ds.reduce((s, d) => s + d[k], 0) / ds.length * 100);
  const inf = ds.filter(d => d.type === "inf").length;
  const sup = game.c(player).supplied;
  const rows = ds.slice(0, 14).map(d => `<div class="divrow"><b>${UNIT[d.type].short}</b><div><div class="bar green"><i style="width:${d.str * 100}%"></i></div><div class="bar"><i style="width:${d.org * 100}%"></i></div></div><span class="muted">${esc(game.P[d.prov].name)}${d.attacking != null ? " ⚔" : d.path.length ? " →" : ""}${sup.has(d.prov) ? "" : " ⚠"}</span></div>`).join("");
  el.innerHTML = `<h3>${flag(player)} ${ds.length} division${ds.length > 1 ? "s" : ""} selected</h3><div class="sub">${inf} infantry · ${ds.length - inf} armored</div>
  <div class="kv"><span class="k">Strength</span><span>${avg("str")}%</span><span class="k">Organization</span><span>${avg("org")}%</span>
  <span class="k">Supply</span><span>${ds.every(d => sup.has(d.prov)) ? "Supplied" : '<b style="color:#ff8a7a">Some out of supply</b>'}</span></div>
  <div style="margin-top:8px">${rows}${ds.length > 14 ? `<div class="muted">…and ${ds.length - 14} more</div>` : ""}</div>
  <div class="muted" style="margin-top:8px">Right-click a province to move or attack.</div>
  <div class="acts"><button class="btn sm" data-act="stop">Stop</button><button class="btn sm" data-act="desel">Deselect</button></div>`;
  infoDay = Math.floor(game.hourCount / 24);
  view.dirty = true;
}

function moveSelected(p) {
  if (!view.selected.size || !p) return;
  const n = game.orderMove([...view.selected], p.id);
  if (!n) toast("No route there. You can't enter neutral countries.");
  else if (game.atWar(player, p.ctrl)) toast(`${n} division${n > 1 ? "s" : ""} attacking ${p.name}`);
  view.dirty = true;
  showDivInfo();
}

let down = null, pointers = new Map(), pinch = null, lastTap = 0;
canvas.addEventListener("pointerdown", e => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; down = null; return; }
  down = { x: e.clientX, y: e.clientY, btn: e.button, shift: e.shiftKey, moved: false, ox: view.ox, oy: view.oy, type: e.pointerType };
  if (e.button === 0 && e.shiftKey && game) view.box = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY };
});
canvas.addEventListener("pointermove", e => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
    view.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch.d); pinch.d = d; return;
  }
  if (down) {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) down.moved = true;
    if (view.box) { view.box.x1 = e.clientX; view.box.y1 = e.clientY; view.dirty = true; }
    else if (down.moved && down.btn === 0) { view.ox = down.ox + e.clientX - down.x; view.oy = down.oy + e.clientY - down.y; view.clamp(); view.dirty = true; }
  } else if (e.pointerType === "mouse") {
    const p = view.provAt(e.clientX, e.clientY);
    if (p !== view.hoverProv) { view.hoverProv = p; view.dirty = true; }
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
      for (const div of game.divsOf(player)) { const c = game.P[div.prov].c; if (c[0] >= ax && c[0] <= bx && c[1] >= ay && c[1] <= by) view.selected.add(div.id); }
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
  moveSelected(view.provAt(e.clientX, e.clientY));
});
canvas.addEventListener("wheel", e => { e.preventDefault(); view.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });

function handleClick(x, y, shift, ptype) {
  if (view.buildMode) {
    const p = view.provAt(x, y);
    if (p && game.queueBuild(player, view.buildMode, p.id)) { toast(`${BUILD[view.buildMode].name} queued in ${p.name}.`); if (tab === "production") renderPanel(); }
    else toast("You can't build there.");
    if (!shift) setBuildMode(null);
    view.dirty = true; return;
  }
  const ctr = view.countersAt(x, y);
  if (ctr && ctr.tag === player) {
    if (!shift) view.selected.clear();
    const now = performance.now();
    const ids = now - lastTap < 350 ? game.divsOf(player).filter(d => Math.hypot(game.P[d.prov].c[0] - game.P[ctr.prov].c[0], game.P[d.prov].c[1] - game.P[ctr.prov].c[1]) < 120).map(d => d.id) : ctr.ids;
    lastTap = now;
    for (const id of ids) view.selected.add(id);
    view.selProv = null; showDivInfo(); return;
  }
  const p = view.provAt(x, y);
  if (ptype === "touch" && view.selected.size && p && !(ctr && ctr.tag === player)) { moveSelected(p); return; }
  if (!shift) view.selected.clear();
  view.selProv = p;
  if (p) showProvInfo(p); else $("info").classList.add("hidden");
  view.dirty = true;
}

addEventListener("keydown", e => {
  if (!game || e.target.tagName === "INPUT") return;
  const k = e.key.toLowerCase();
  if (k === " ") { e.preventDefault(); setSpeed(speed ? 0 : lastSpeed); }
  else if ("12345".includes(k) && k.length === 1) setSpeed(+k);
  else if (k === "f") openTab(tab === "focus" ? null : "focus");
  else if (k === "r") openTab(tab === "research" ? null : "research");
  else if (k === "p") openTab(tab === "production" ? null : "production");
  else if (k === "a") openTab(tab === "army" ? null : "army");
  else if (k === "d") openTab(tab === "diplomacy" ? null : "diplomacy");
  else if (k === "h" || k === "?") openTab(tab === "help" ? null : "help");
  else if (k === "m") toggleMode();
  else if (k === "escape") { if (view.buildMode) setBuildMode(null); else if (view.selected.size) { view.selected.clear(); $("info").classList.add("hidden"); } else openTab(null); view.dirty = true; }
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
    if (n) view.dirty = true;
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
  if (view && view.dirty) view.draw();
  requestAnimationFrame(loop);
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
