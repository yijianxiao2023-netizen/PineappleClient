import { TECHS, UNIT } from "./data.js?v=1795222517";

const TECH_ORDER = ["tools1", "constr1", "housing1", "infwep1", "inf_t2", "arty1", "DOCTRINE", "tank1", "bomber1", "radio", "ftr_t2", "housing2", "suppwep", "at1", "tools2", "constr2", "inf_t3", "tank_t2", "ftr2", "motor", "infwep2", "tank2", "at_t2", "bmb_t2", "housing3", "concind", "logistics", "arm_t2", "inf_t4", "cas", "ftr_t3", "tank_t3", "ship_t2", "arty2", "doc2", "at_t3", "radar", "housing4", "constr3", "arm_t3", "inf_t5", "ftr3", "bmb_t3", "tools3", "tank3", "tank_t4", "ftr_t4", "housing5", "arm_t4", "infwep3", "ship_t3", "naval1", "tank_rel", "bmb2", "naval2", "tank_gun", "escort", "subs", "dive", "blitz", "mech", "naval3", "carrier", "bmb_heavy", "tank_sup", "jet"];
const DOCTRINE = { GER: "doc_mobile", SOV: "doc_mass", FRA: "doc_plan", ENG: "doc_fire", ITA: "doc_fire" };
const FOCUS_ORDER = ["industry", "construction", "rearm", "production", "research", "army", "equip", "political", "conscription", "doctrine", "warprop", "alliance", "fleet", "fortify"];
const shuffleFocus = (g, list) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(g.rng() * (i + 1)); if (g.rng() < 0.35) [a[i], a[j]] = [a[j], a[i]]; } return a; };
const hash = s => [...s].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;

const STRATS = {
  blitz: { name: "Blitzkrieg", odds: 1.1, desc: "fast armored breakthroughs, attacking at narrow odds" },
  balanced: { name: "Broad Front", odds: 1.35, desc: "steady pressure along the whole front" },
  defensive: { name: "Defense in Depth", odds: 1.7, desc: "holding the line and striking only with overwhelming odds" },
  encircle: { name: "Encirclement", odds: 1.25, desc: "pincer attacks to cut off and surround enemy pockets" },
  attrition: { name: "Attrition", odds: 1.2, desc: "wearing the enemy down with rested troops" },
};
function strategyOf(g, c) {
  if (!c.strategy) {
    const pool = c.ideology === "fascist" ? ["blitz", "blitz", "encircle", "balanced"] : c.ideology === "communist" ? ["attrition", "attrition", "balanced", "encircle"] : ["defensive", "balanced", "balanced", "encircle", "attrition"];
    c.strategy = pool[Math.floor(g.rng() * pool.length)];
    if (c.major && c.tag !== g.player) g.log(`${c.name} adopts a ${STRATS[c.strategy].name} strategy: ${STRATS[c.strategy].desc}.`, "justify", [c.tag]);
  }
  return STRATS[c.strategy];
}
function coalition(g, tag) { return Object.values(g.countries).filter(o => o.alive && (o.tag === tag || g.friendly(tag, o.tag))); }
function objectiveOf(g, c, day) {
  const team = coalition(g, c.tag).sort((a, b) => g.power(b.tag) - g.power(a.tag));
  const lead = team[0];
  if (!lead.objective || lead.objectiveDay + 30 <= day || !g.atWar(lead.tag, g.P[lead.objective]?.ctrl)) {
    const myCap = g.P[lead.capital] || g.P.find(p => p.ctrl === lead.tag);
    let best = null, bd = 1e9;
    for (const e of g.enemiesOf(c.tag)) {
      const ec = g.c(e); const cap = g.P[ec.capital];
      if (!cap || !g.atWar(c.tag, cap.ctrl) || !myCap) continue;
      const d = Math.hypot(cap.c[0] - myCap.c[0], cap.c[1] - myCap.c[1]) / (1 + (ec.major ? 0.5 : 0));
      if (d < bd) { bd = d; best = cap; }
    }
    const was = lead.objective;
    lead.objective = best ? best.id : null; lead.objectiveDay = day;
    if (best && was !== best.id && team.length > 1 && lead.tag !== g.player) g.log(`${lead.name} and its allies coordinate a joint offensive toward ${best.name} (${g.c(best.ctrl).name}).`, "war", team.map(t => t.tag).slice(0, 6));
  }
  return lead.objective != null ? g.P[lead.objective] : null;
}

export function runAI(g, c) {
  const day = Math.floor(g.hourCount / 24);
  strategyOf(g, c);
  economy(g, c);
  if ((day + hash(c.tag)) % 7 === 0) diplomacy(g, c);
  if ((day + hash(c.tag)) % 15 === 3) aiDiplomacy(g, c);
  military(g, c, day);
}

function economy(g, c) {
  for (let i = 0; i < c.research.length; i++) {
    if (c.research[i]) continue;
    for (const id of TECH_ORDER) {
      const tid = id === "DOCTRINE" ? (DOCTRINE[c.tag] || "doc_plan") : id;
      if (tid.startsWith("tank") || tid === "motor" || tid === "bomber1" || tid === "cas") { if (!c.major && !["POL", "CZE", "SWE", "ROM"].includes(c.tag)) continue; }
      const t = TECHS.find(x => x.id === tid);
      if (t && g.techAvailable(c, t)) { g.setResearch(c.tag, i, tid); break; }
    }
    if (!c.research[i]) { const t = TECHS.filter(x => g.techAvailable(c, x)).sort((a, b) => a.year - b.year)[0]; if (t) g.setResearch(c.tag, i, t.id); }
  }

  if (!c.focus) {
    const tree = g.focusTree(c.tag);
    const national = tree.filter(f => f.id.startsWith(c.tag.toLowerCase() + "_"));
    let pick = national.find(f => g.focusAvailable(c, f));
    if (!c.focusOrder) c.focusOrder = shuffleFocus(g, FOCUS_ORDER);
    if (!pick) for (const id of c.focusOrder) {
      const f = tree.find(x => x.id === id);
      if (!f || !g.focusAvailable(c, f)) continue;
      if (id === "fleet" && !c.major) continue;
      if (id === "alliance" && (c.ideology === "neutral" || g.factionOf(c.tag) || !c.major)) continue;
      pick = f; break;
    }
    if (pick) g.setFocus(c.tag, pick.id);
  }

  if (c.construction.length < 3) {
    const war = g.atWarAny(c.tag);
    const wantMil = war || g.year >= 1939 || c.civEff > c.milEff * 2.2 + 8;
    const type = wantMil ? "mil" : "civ";
    const cands = g.P.filter(p => p.owner === c.tag && p.ctrl === c.tag && g.usedSlots(p) < p.slots);
    if (cands.length) {
      const enemies = new Set(g.enemiesOf(c.tag));
      cands.sort((a, b) => (b.vp - a.vp) + (a.adj.some(n => enemies.has(g.P[n].ctrl)) ? -5 : 0) - (b.adj.some(n => enemies.has(g.P[n].ctrl)) ? -5 : 0));
      g.queueBuild(c.tag, type, cands[Math.floor(g.rng() * Math.min(4, cands.length))].id);
    } else if (war) {
      const front = g.P.filter(p => p.owner === c.tag && p.ctrl === c.tag && p.fort < 3 && p.adj.some(n => g.atWar(c.tag, g.P[n].ctrl)));
      if (front.length) g.queueBuild(c.tag, "fort", front[0].id);
    }
  }

  if ((Math.floor(g.hourCount / 24) + hash(c.tag)) % 30 === 0) for (const t of ["inf", "at", "tank", "arm", "ftr", "bmb", "ship"]) if (c.money > (c.upkeep || 0) * 40) g.upgradeUnits(c.tag, t, 20);
  c.share.tank = c.techs.has("tank1") ? (c.tag === "GER" ? 0.3 : c.major ? 0.2 : 0.08) : 0;
  c.share.air = c.major ? 0.15 : 0.08;

  const land = g.divsOf(c.tag);
  const war = g.atWarAny(c.tag);
  const target = Math.round((8 + c.milEff * 1.6 + c.civEff * 0.3) * (war ? 1.35 : 1));
  const count = t => g.unitsOf(c.tag).filter(d => d.type === t).length + c.training.filter(x => x.type === t).length;
  const landN = land.length + c.training.filter(x => ["inf", "at", "tank", "arm"].includes(x.type)).length;
  const reserve = 40 + land.length * 1.5;
  const mix = c.major ? { at: 0.1, tank: 0.12, arm: 0.1 } : { at: 0.12, tank: 0.05, arm: 0.03 };
  const fleets = { ENG: 14, FRA: 7, ITA: 7, GER: 5, SOV: 4 }[c.tag] || 0;
  let made = 0;
  while (made < 3) {
    const wants = [];
    if (landN + made < target && c.manpower > reserve + 10) {
      for (const [t, f] of Object.entries(mix)) if (count(t) < (landN + made) * f) wants.push([t, f]);
      wants.push(["inf", 0]);
    }
    const ftrWant = Math.ceil(landN / (c.major ? 7 : 12));
    if (count("ftr") < ftrWant) wants.unshift(["ftr", 1]);
    if (c.major && count("bmb") < Math.ceil(ftrWant / 2)) wants.splice(1, 0, ["bmb", 1]);
    if (count("ship") < fleets && c.money > 2500 * 1000) wants.push(["ship", 1]);
    const pick = wants.find(([t]) => g.freeSpawnCount(c.tag, UNIT[t].domain) > 0 && g.canTrain(c.tag, t) && c.money - g.unitCost(c.tag, t).money > (c.upkeep || 0) * 25 && (c.income + c.civEff * 1.5 * 2400) - (c.upkeep || 0) > g.unitCost(c.tag, t).upkeep);
    if (!pick) break;
    g.train(c.tag, pick[0]); made++;
  }

}

const AGGRESSION = { fascist: 1, communist: 0.8, neutral: 0.15, democratic: 0 };

function landNeighbours(g, tag) {
  const out = new Map();
  for (const p of g.P) {
    if (p.ctrl !== tag) continue;
    for (const n of p.adj) { const o = g.P[n].ctrl; if (o !== tag) out.set(o, (out.get(o) || 0) + 1); }
    for (const n of p.sea) { const o = g.P[n].ctrl; if (o !== tag && !out.has(o)) out.set(o, 0.3); }
  }
  return out;
}

function sideStrength(g, tag) {
  let s = 0;
  const f = g.factionOf(tag);
  const members = f ? [...f.members] : [tag];
  for (const m of members) if (g.c(m).alive) s += g.strength(m) * (m === tag ? 1 : 0.6);
  for (const c of g.alive()) if (c.guarantees.has(tag) && !members.includes(c.tag)) s += g.strength(c.tag) * 0.6;
  return s;
}

function diplomacy(g, c) {
  if (c.aggro == null) {
    const base = AGGRESSION[c.ideology] ?? 0;
    c.aggro = base * (0.6 + g.rng() * 0.8);
    c.warReady = g.time + (300 + g.rng() * 900) * 86400000;
  }
  for (const [t, exp] of Object.entries(c.wargoals)) {
    if (!g.c(t).alive || g.atWar(c.tag, t) || g.friendly(c.tag, t)) continue;
    const myF = g.factionOf(c.tag);
    const mine = myF && myF.leader === c.tag ? sideStrength(g, c.tag) : g.strength(c.tag);
    if (mine > sideStrength(g, t) * (1.1 - c.aggro * 0.4) || exp - g.time < 30 * 86400000) g.declareWar(c.tag, t);
  }
  if (!c.aggro || g.time < c.warReady || c.justifying || Object.keys(c.wargoals).length) return;
  const f = g.factionOf(c.tag);
  if (f && f.leader !== c.tag && !c.major) return;
  if (!c.major && g.rng() > 0.05) return;
  const enemies = g.enemiesOf(c.tag);
  const busy = enemies.reduce((s, e) => s + g.strength(e), 0);
  const mine = g.strength(c.tag);
  if (busy > mine * 0.5) return;
  const cands = [];
  for (const [t, contact] of landNeighbours(g, c.tag)) {
    const o = g.c(t);
    if (!o || !o.alive || g.friendly(c.tag, t) || g.atWar(c.tag, t)) continue;
    const theirs = sideStrength(g, t) + 1;
    const ratio = (f && f.leader === c.tag ? sideStrength(g, c.tag) : mine) / theirs;
    if (ratio < 0.7 - c.aggro * 0.2) continue;
    const score = ratio * (0.4 + contact * 0.1) * (0.5 + g.rng()) * (o.major ? 1.3 : 1) * (g.factionOf(t) ? 1 : 1.4);
    cands.push([score, t]);
  }
  if (!cands.length || g.rng() > 0.25 + c.aggro * 0.5) return;
  cands.sort((a, b) => b[0] - a[0]);
  const target = cands[Math.floor(g.rng() * Math.min(3, cands.length))][1];
  c.pp = Math.max(c.pp, g.justifyCost(c.tag));
  if (g.justify(c.tag, target)) c.warReady = g.time + (120 + g.rng() * 400) * 86400000;
}

function offensiveAllowed(g, c, enemyTag) {
  const sEnemy = g.c(enemyTag);
  const mine = g.strength(c.tag), theirs = g.strength(enemyTag);
  const war = g.wars.find(w => (w.sides[0].has(c.tag) && w.sides[1].has(enemyTag)) || (w.sides[1].has(c.tag) && w.sides[0].has(enemyTag)));
  const days = war ? (g.time - war.start) / 86400000 : 0;
  if (c.ideology === "democratic" && sEnemy.major) return mine > theirs * 1.05 || days > 365;
  return mine > theirs * 1.0 || days > 120;
}

function enemyStrengthAt(g, tag, p, hostile) {
  let s = 0;
  for (const id of p.divs) { const d = g.divs.get(id); if (d && (hostile ? hostile.has(d.tag) : g.atWar(tag, d.tag))) s += ({ arm: 2, tank: 1.6, at: 1.3 }[d.type] || 1.2) * d.str * (0.3 + 0.7 * d.org); }
  return s;
}

function hostileSet(g, c) {
  const h = new Set(g.enemiesOf(c.tag));
  for (const t of Object.keys(g.countries)) {
    const o = g.c(t);
    if (!o.alive || g.friendly(c.tag, t)) continue;
    if (o.wargoals[c.tag] || (o.justifying && o.justifying.target === c.tag) || c.wargoals[t]) h.add(t);
  }
  return h;
}

function airAI(g, c, day) {
  if ((day + hash(c.tag)) % 4 !== 0) return;
  const air = g.divsOf(c.tag, "air").filter(d => !d.path.length);
  if (!air.length) return;
  const enemies = new Set(g.enemiesOf(c.tag));
  let targets = [];
  for (const b of g.battles.values()) if (g.friendly(c.tag, b.attTag) || g.friendly(c.tag, b.defTag)) targets.push(g.P[b.prov]);
  if (!targets.length && enemies.size) targets = g.P.filter(p => p.ctrl === c.tag && p.adj.some(n => enemies.has(g.P[n].ctrl)));
  if (!targets.length) return;
  let cx = 0, cy = 0; for (const t of targets) { cx += t.c[0]; cy += t.c[1]; } cx /= targets.length; cy /= targets.length;
  const focus = targets.reduce((a, b) => (Math.hypot(a.c[0] - cx, a.c[1] - cy) < Math.hypot(b.c[0] - cx, b.c[1] - cy) ? a : b));
  const bases = g.P.filter(p => p.ctrl === c.tag && c.supplied.has(p.id) && Math.hypot(p.c[0] - focus.c[0], p.c[1] - focus.c[1]) < 140 && !p.adj.some(n => enemies.has(g.P[n].ctrl)));
  const base = bases.sort((a, b) => Math.hypot(a.c[0] - focus.c[0], a.c[1] - focus.c[1]) - Math.hypot(b.c[0] - focus.c[0], b.c[1] - focus.c[1]))[0] || focus;
  if (!g.friendly(c.tag, base.ctrl)) return;
  for (const d of air) if (Math.hypot(g.P[d.prov].c[0] - base.c[0], g.P[d.prov].c[1] - base.c[1]) > 120) g.orderMove([d.id], base.id);
}

function military(g, c, day) {
  airAI(g, c, day);
  const my = g.divsOf(c.tag);
  if (!my.length) return;
  const enemies = g.enemiesOf(c.tag);
  const hostile = hostileSet(g, c);
  const idle = d => !d.path.length && d.attacking == null;
  const reserved = g.reservedFor(c.tag, "land");
  const taken = new Set(reserved);
  for (const d of my) taken.add(d.prov);
  const freeTile = p => !taken.has(p.id) && !g.occupiedBy(p.id, c.tag, "land");
  const moveTo = (d, p) => { const path = g.computePath(d, p.id); if (!path || !path.length) return false; d.path = path; d.prog = 0; d.attacking = null; taken.add(p.id); return true; };

  const lineIds0 = new Set();
  for (const id of c.supplied || []) { const p = g.P[id]; if (p.adj.some(n => hostile.has(g.P[n].ctrl))) lineIds0.add(id); }
  if (enemies.length) {
    const cap = g.P[c.capital];
    if (cap && cap.ctrl === c.tag) {
      const near = new Set([cap.id]); let ring = [cap.id];
      for (let r = 0; r < 3; r++) { const nx = []; for (const id of ring) for (const n of g.P[id].adj) if (!near.has(n)) { near.add(n); nx.push(n); } ring = nx; }
      const danger = [...near].some(id => [...g.P[id].divs].some(i => { const e = g.divs.get(i); return e && g.atWar(c.tag, e.tag); }));
      {
        const ring = cap.adj.map(n => g.P[n]).filter(q => q.ctrl === c.tag);
        const ring2 = danger ? [...new Set(ring.flatMap(q => q.adj))].map(n => g.P[n]).filter(q => q.ctrl === c.tag && q !== cap && !ring.includes(q)) : [];
        const guard = [cap, ...(danger ? [...ring, ...ring2] : ring.filter(q => q.adj.some(n => g.atWar(c.tag, g.P[n].ctrl))).slice(0, 2))];
        const gset = new Set(guard.map(q => q.id));
        const pool = my.filter(d => idle(d) && !gset.has(d.prov) && (danger || !lineIds0.has(d.prov))).sort((a, b) => dist(g.P[a.prov], cap) - dist(g.P[b.prov], cap));
        for (const q of guard) {
          if (!freeTile(q) || !pool.length) continue;
          const d = pool.shift();
          moveTo(d, q);
        }
        if (danger && c.capitalAlarm == null) { c.capitalAlarm = day; g.log(`${c.name} rushes troops to defend ${cap.name}!`, "war", [c.tag]); }
        if (!danger) c.capitalAlarm = null;
      }
    }
  }

  if (enemies.length && (day + hash(c.tag)) % 3 === 0) {
    for (const a of coalition(g, c.tag)) {
      if (a.tag === c.tag) continue;
      const ac = g.P[a.capital];
      if (!ac || ac.ctrl !== a.tag) continue;
      const threat = ac.adj.some(n => [...g.P[n].divs].some(i => { const e = g.divs.get(i); return e && g.atWar(a.tag, e.tag); }));
      if (!threat) continue;
      const spots = [ac, ...ac.adj.map(n => g.P[n])].filter(q => g.friendly(c.tag, q.ctrl) && freeTile(q));
      const helpers = my.filter(d => idle(d) && dist(g.P[d.prov], ac) < 260).sort((x, y) => dist(g.P[x.prov], ac) - dist(g.P[y.prov], ac)).slice(0, Math.min(3, Math.floor(my.length / 4)));
      let sent = 0;
      for (const d of helpers) { const q = spots.shift(); if (!q) break; if (moveTo(d, q)) sent++; }
      if (sent && a.helpLog !== day && c.tag !== g.player) { a.helpLog = day; g.log(`${c.name} sends ${sent} unit${sent > 1 ? "s" : ""} to help defend ${ac.name} for its ally ${a.name}.`, "war", [c.tag, a.tag]); }
    }
  }

  let line;
  if (!hostile.size) {
    if ((day + hash(c.tag)) % 10 !== 0) return;
    const home = g.homeComponent(c.tag).filter(p => p.ctrl === c.tag);
    line = home.filter(p => p.adj.some(n => g.P[n].owner !== c.tag && !g.friendly(c.tag, g.P[n].owner)));
  } else {
    line = [];
    for (const id of c.supplied) {
      const p = g.P[id];
      if (!g.friendly(c.tag, p.ctrl)) continue;
      if (p.adj.some(n => hostile.has(g.P[n].ctrl))) line.push(p);
    }
    if (!line.length) { if (enemies.length) seaInvasion(g, c, my, enemies); return; }
  }
  const lineIds = new Set(line.map(p => p.id));
  const weight = p => 1 + p.adj.reduce((s, n) => s + enemyStrengthAt(g, c.tag, g.P[n], hostile), 0) + p.vp / 10;
  const open = line.filter(freeTile).sort((a, b) => weight(b) - weight(a));
  const second = [];
  for (const p of line) for (const n of p.adj) { const q = g.P[n]; if (q.ctrl === c.tag && !lineIds.has(n) && freeTile(q) && !second.includes(q)) second.push(q); }
  const spare = my.filter(d => idle(d) && !lineIds.has(d.prov) && !(enemies.length && d.prov === c.capital));
  let moves = 0;
  for (const target of [...open, ...second]) {
    if (moves > 60 || !spare.length) break;
    if (!freeTile(target)) continue;
    spare.sort((a, b) => dist(g.P[a.prov], target) - dist(g.P[b.prov], target));
    const d = spare[0];
    if (moveTo(d, target)) { spare.shift(); moves++; }
    else spare.push(spare.shift());
  }

  if (!enemies.length) return;
  const allowed = new Map(enemies.map(e => [e, offensiveAllowed(g, c, e)]));
  const usedAtt = new Set();
  const targets = new Map();
  for (const f of line) for (const n of f.adj) { const q = g.P[n]; if (g.atWar(c.tag, q.ctrl) && allowed.get(q.ctrl)) targets.set(q.id, q); }
  const strat = strategyOf(g, c);
  const obj = objectiveOf(g, c, day);
  const surround = q => q.adj.filter(n => g.friendly(c.tag, g.P[n].ctrl)).length / Math.max(1, q.adj.length);
  const score = (q, s) => s - q.vp * 0.05 - (obj ? 1.5 - Math.min(1.5, dist(q, obj) / 300) : 0) - (c.strategy === "encircle" ? surround(q) * 2 : surround(q) * 0.5) - (g.P[g.c(q.ctrl).capital] === q ? 1 : 0);
  const ranked = [...targets.values()].map(q => ({ q, s: enemyStrengthAt(g, c.tag, q) * (1 + 0.15 * q.fort) * ({ mountain: 1.7, hills: 1.3, forest: 1.25, marsh: 1.4 }[q.terrain] || 1) })).sort((a, b) => score(a.q, a.s) - score(b.q, b.s));
  for (const { q, s } of ranked) {
    const atk = [];
    for (const n of q.adj) {
      const p = g.P[n];
      if (!g.friendly(c.tag, p.ctrl)) continue;
      for (const id of p.divs) { const d = g.divs.get(id); if (d && (d.tag === c.tag || (d.tag !== g.player && g.friendly(c.tag, d.tag) && g.atWar(d.tag, q.ctrl))) && idle(d) && !usedAtt.has(d.id) && !(g.attackLock?.get(d.id) > g.hourCount) && d.org > (c.strategy === "attrition" ? 0.8 : 0.6) && d.str > 0.5) atk.push(d); }
    }
    for (let i = atk.length - 1; i >= 0; i--) if (enemies.length && atk[i].prov === g.c(atk[i].tag).capital) atk.splice(i, 1);
    if (!atk.length) continue;
    const power = atk.reduce((sum, d) => sum + UNIT[d.type].att * g.tm(d) * (UNIT[d.type].armor ? 1.3 : 1) * d.str * d.org * (1 + g.mod(c.tag, UNIT[d.type].armor ? "armAtt" : "infAtt")), 0);
    if (s === 0) {
      const d = atk.sort((a, b) => b.str - a.str)[0];
      const home = g.P[d.prov];
      const exposed = home.adj.filter(n => g.atWar(c.tag, g.P[n].ctrl) && enemyStrengthAt(g, c.tag, g.P[n]) > 0).length;
      if (exposed && atk.length < 2) continue;
      d.path = [{ id: q.id, sea: false }]; d.prog = 0; usedAtt.add(d.id);
    } else if (power > s * strat.odds) {
      if (!g.attackLock) g.attackLock = new Map();
      for (const d of atk) { d.path = [{ id: q.id, sea: false }]; d.prog = 0; usedAtt.add(d.id); g.attackLock.set(d.id, g.hourCount + 6); }
      const tags = [...new Set(atk.map(d => d.tag))];
      if (tags.length > 1 && atk.length >= 3 && g.rng() < 0.25) g.log(`Joint attack: ${tags.map(t => g.c(t).name).join(" and ")} strike ${q.name} together with ${atk.length} units.`, "war", tags);
    }
  }
}

function seaInvasion(g, c, my, enemies) {
  if (Math.floor(g.hourCount / 24) % 15 !== 0) return;
  const idleDivs = my.filter(d => !d.path.length && d.attacking == null && d.org > 0.8 && d.str > 0.8);
  if (idleDivs.length < 4) return;
  const coastTargets = [];
  for (const p of g.P) {
    if (!enemies.includes(p.ctrl) || !offensiveAllowed(g, c, p.ctrl)) continue;
    for (const n of p.sea) if (c.supplied.has(n) && g.P[n].ctrl === c.tag) coastTargets.push({ p, from: g.P[n], s: enemyStrengthAt(g, c.tag, p) });
  }
  if (!coastTargets.length) return;
  coastTargets.sort((a, b) => a.s - b.s);
  const t = coastTargets[0];
  if (t.s > idleDivs.length * 0.6) return;
  const d = idleDivs.sort((a, b) => b.str - a.str)[0];
  g.orderMove([d.id], t.p.id);
}

const dist = (a, b) => Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]);

export function aiAcceptsFaction(g, tag, factionId) {
  const f = g.factions.find(x => x.id === factionId);
  if (!f) return false;
  const c = g.c(tag), leader = g.c(f.leader);
  if (leader.ideology === "neutral") return true;
  if (c.ideology === leader.ideology) return true;
  if (c.ideology === "neutral" && g.enemiesOf(tag).some(e => [...f.members].some(m => g.atWar(m, e)))) return true;
  return false;
}


function aiDiplomacy(g, c) {
  if (c.overlord) return;
  const now = g.time, DAY = 86400000;
  const toPlayerOk = t => t !== g.player || now - (c.lastProp || 0) > 120 * DAY;
  const send = (type, to, terms) => { if (!toPlayerOk(to)) return false; if (to === g.player) c.lastProp = now; g.propose(type, c.tag, to, terms); return true; };

  const threats = g.threatsTo(c.tag);
  if (!g.factionOf(c.tag) && threats.length && g.rng() < 0.6) {
    const options = g.factions.filter(f => g.countries[f.leader]?.alive && !threats.some(t => f.members.has(t)) && ![...f.members].some(m => g.atWar(m, c.tag)));
    options.sort((a, b) => g.factionStrength(b) - g.factionStrength(a));
    const f = options.find(o => g.aiAccept("alliance", c.tag, o.leader).ok || o.leader === g.player);
    if (f) { send("alliance", f.leader, {}); return; }
    const buddy = g.alive().find(o => o.tag !== c.tag && !g.factionOf(o.tag) && !o.overlord && !g.atWar(o.tag, c.tag) && g.threatsTo(o.tag).some(t => threats.includes(t)));
    if (buddy && g.rng() < 0.5) { send("alliance", buddy.tag, {}); return; }
  }
  const myF = g.factionOf(c.tag);
  if (myF && myF.leader === c.tag && g.rng() < 0.15) {
    const cand = g.alive().find(o => o.tag !== c.tag && !o.major && !g.factionOf(o.tag) && !o.overlord && !g.atWar(o.tag, c.tag) && o.ideology === c.ideology);
    if (cand) { send("alliance", cand.tag, {}); return; }
  }

  for (const w of g.wars) {
    const s = w.sides[0].has(c.tag) ? 0 : w.sides[1].has(c.tag) ? 1 : -1;
    if (s < 0) continue;
    const leadsSide = (w.main || []).includes(c.tag) || myF?.leader === c.tag;
    if (!leadsSide) continue;
    const foes = [...w.sides[1 - s]];
    const foe = foes.find(t => (w.main || []).includes(t)) || foes.sort((a, b) => g.strength(b) - g.strength(a))[0];
    if (!foe) continue;
    const days = (now - w.start) / DAY;
    const ws = g.warScore(c.tag, foe);
    if (days > 90 && ws > 0.25) {
      const terms = { demander: c.tag, keep: true, keepCount: g.conqueredFrom(c.tag, foe).length, gold: ws > 0.45 ? Math.round(g.countries[foe].money * 0.3) : 0 };
      if (send("peace", foe, terms)) return;
    } else if (days > 120 && ws < -0.3) {
      const terms = { demander: foe, keep: true, keepCount: g.conqueredFrom(foe, c.tag).length, gold: 0 };
      if (send("peace", foe, terms)) return;
    } else if (days > 540 && Math.abs(ws) < 0.1 && g.rng() < 0.3) {
      if (send("peace", foe, { demander: null })) return;
    }
  }

  if ((c.aggro || 0) > 0.3 && !g.atWarAny(c.tag) && g.rng() < 0.25) {
    const neigh = new Set();
    for (const p of g.P) if (p.owner === c.tag) for (const n of p.adj) { const o = g.P[n].owner; if (o !== c.tag) neigh.add(o); }
    const cands = [...neigh].filter(t => g.countries[t].alive && !g.friendly(c.tag, t) && !g.truce(c.tag, t) && !c.wargoals[t]);
    cands.sort((a, b) => g.power(a) - g.power(b));
    const t = cands[0];
    if (!t) return;
    const ratio = g.power(c.tag) / g.power(t);
    const T = g.countries[t];
    if (ratio > 6 && !T.major && !g.factionOf(t) && g.year >= 1937) send("puppet", t, {});
    else if (ratio > 3) send("tiles", t, { tiles: g.borderTiles(c.tag, t, 3).map(p => p.id) });
    else if (ratio > 2.5) send("gold", t, { gold: Math.round(Math.min(T.money * 0.5, T.income * 10)) });
  }
}
