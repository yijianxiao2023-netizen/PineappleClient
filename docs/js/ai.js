import { TECHS, UNIT } from "./data.js?v=1795220562";

const TECH_ORDER = ["tools1", "constr1", "housing1", "infwep1", "inf_t2", "arty1", "DOCTRINE", "tank1", "bomber1", "radio", "ftr_t2", "housing2", "suppwep", "at1", "tools2", "constr2", "inf_t3", "tank_t2", "ftr2", "motor", "infwep2", "tank2", "at_t2", "bmb_t2", "housing3", "concind", "logistics", "arm_t2", "inf_t4", "cas", "ftr_t3", "tank_t3", "ship_t2", "arty2", "doc2", "at_t3", "radar", "housing4", "constr3", "arm_t3", "inf_t5", "ftr3", "bmb_t3", "tools3", "tank3", "tank_t4", "ftr_t4", "housing5", "arm_t4", "infwep3", "ship_t3"];
const DOCTRINE = { GER: "doc_mobile", SOV: "doc_mass", FRA: "doc_plan", ENG: "doc_fire", ITA: "doc_fire" };
const FOCUS_ORDER = ["industry", "construction", "rearm", "production", "research", "army", "equip", "political", "conscription", "doctrine", "warprop", "alliance", "fleet", "fortify"];
const shuffleFocus = (g, list) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(g.rng() * (i + 1)); if (g.rng() < 0.35) [a[i], a[j]] = [a[j], a[i]]; } return a; };
const hash = s => [...s].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;

export function runAI(g, c) {
  const day = Math.floor(g.hourCount / 24);
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
    const pick = wants.find(([t]) => g.canTrain(c.tag, t) && c.money - g.unitCost(c.tag, t).money > (c.upkeep || 0) * 25 && (c.income + c.civEff * 1.5 * 2400) - (c.upkeep || 0) > g.unitCost(c.tag, t).upkeep);
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

  if (!hostile.size) {
    if ((day + hash(c.tag)) % 10 !== 0) return;
    const home = g.homeComponent(c.tag).filter(p => p.ctrl === c.tag);
    const border = home.filter(p => p.adj.some(n => g.P[n].owner !== c.tag && !g.friendly(c.tag, g.P[n].owner)));
    if (!border.length) return;
    const want = Math.max(1, Math.floor(my.length * 0.85 / border.length));
    let moves = 0;
    for (const d of my) {
      if (!idle(d) || moves > 20) continue;
      const here = g.P[d.prov];
      if (border.includes(here) && here.divs.size <= want + 1) continue;
      const tgt = border.filter(p => p.divs.size < want).sort((a, b) => dist(a, here) - dist(b, here))[0];
      if (tgt) { g.orderMove([d.id], tgt.id); moves++; }
    }
    return;
  }

  const supplied = c.supplied;
  const frontier = [];
  for (const id of supplied) {
    const p = g.P[id];
    if (!g.friendly(c.tag, p.ctrl)) continue;
    const foes = p.adj.filter(n => hostile.has(g.P[n].ctrl));
    if (foes.length) frontier.push({ p, foes, w: 0 });
  }
  if (!frontier.length) {
    if (enemies.length) seaInvasion(g, c, my, enemies);
    return;
  }
  for (const f of frontier) {
    f.w = 1.5 + f.foes.reduce((s, n) => s + enemyStrengthAt(g, c.tag, g.P[n], hostile), 0) + (f.p.owner === c.tag ? 0.5 + f.p.vp / 10 : 0);
  }
  const totalW = frontier.reduce((s, f) => s + f.w, 0);
  const reserve = my.length > 12 ? 1 : 0;
  const avail = my.length - reserve;
  const mine = new Map(frontier.map(f => [f.p.id, 0]));
  for (const d of my) {
    const tgt = d.path.length ? d.path[d.path.length - 1].id : d.prov;
    if (mine.has(tgt)) mine.set(tgt, mine.get(tgt) + 1);
  }
  const need = f => Math.max(1, Math.round(avail * f.w / totalW)) - (mine.get(f.p.id) || 0);
  let moves = 0;
  const frontIds = new Set(frontier.map(f => f.p.id));
  const off = my.filter(d => idle(d) && !frontIds.has(d.prov) && !(d.prov === c.capital && reserve && g.P[c.capital].divs.size <= 1));
  const maxMoves = 60;
  for (const d of off) {
    if (moves > maxMoves) break;
    const here = g.P[d.prov];
    const cand = frontier.filter(f => need(f) > 0).sort((a, b) => dist(a.p, here) / (1 + need(a)) - dist(b.p, here) / (1 + need(b)))[0];
    if (!cand) break;
    if (g.orderMove([d.id], cand.p.id)) { mine.set(cand.p.id, (mine.get(cand.p.id) || 0) + 1); moves++; }
  }
  if (moves < 20) {
    for (const f of frontier) {
      const surplus = -need(f);
      if (surplus <= 1) continue;
      const here = [...f.p.divs].map(i => g.divs.get(i)).filter(d => d && d.tag === c.tag && idle(d));
      for (let k = 0; k < Math.min(surplus - 1, here.length - 1) && moves < 30; k++) {
        const cand = frontier.filter(x => need(x) > 1).sort((a, b) => dist(a.p, f.p) - dist(b.p, f.p))[0];
        if (!cand) break;
        if (g.orderMove([here[k].id], cand.p.id)) { mine.set(cand.p.id, (mine.get(cand.p.id) || 0) + 1); mine.set(f.p.id, mine.get(f.p.id) - 1); moves++; }
      }
    }
  }

  if (!enemies.length) return;
  const allowed = new Map(enemies.map(e => [e, offensiveAllowed(g, c, e)]));
  for (const f of frontier) {
    const here = [...f.p.divs].map(i => g.divs.get(i)).filter(d => d && d.tag === c.tag && idle(d) && d.org > 0.6 && d.str > 0.5);
    if (!here.length) continue;
    const targets = f.foes.map(n => g.P[n]).filter(q => g.atWar(c.tag, q.ctrl) && allowed.get(q.ctrl)).map(q => ({ q, s: enemyStrengthAt(g, c.tag, q) * (1 + 0.15 * q.fort) * ({ mountain: 1.7, hills: 1.3, forest: 1.25, marsh: 1.4 }[q.terrain] || 1) }));
    if (!targets.length) continue;
    targets.sort((a, b) => a.s - b.s + (b.q.vp - a.q.vp) * 0.05);
    const t = targets[0];
    const power = here.reduce((s, d) => s + UNIT[d.type].att * (UNIT[d.type].armor ? 1.3 : 1) * d.str * d.org * (1 + g.mod(c.tag, UNIT[d.type].armor ? "armAtt" : "infAtt")), 0);
    const threatened = f.foes.some(n => enemyStrengthAt(g, c.tag, g.P[n]) > 0);
    if (t.s === 0) {
      const send = here.slice(0, threatened && here.length > 1 ? here.length - 1 : here.length).slice(0, 2);
      if (send.length) g.orderMove(send.map(d => d.id), t.q.id);
    } else if (power > t.s * 1.35) {
      const send = threatened && targets.length > 1 && here.length > 2 ? here.slice(0, here.length - 1) : here;
      g.orderMove(send.map(d => d.id), t.q.id);
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
  const send = idleDivs.slice(0, Math.min(idleDivs.length - 2, 8));
  g.orderMove(send.map(d => d.id), t.p.id);
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
