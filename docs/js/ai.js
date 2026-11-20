import { TECHS, UNIT } from "./data.js";

const TECH_ORDER = ["tools1", "constr1", "infwep1", "arty1", "DOCTRINE", "tank1", "radio", "suppwep", "tools2", "constr2", "motor", "at1", "infwep2", "tank2", "concind", "logistics", "arty2", "doc2", "radar", "constr3", "tools3", "tank3", "infwep3"];
const DOCTRINE = { GER: "doc_mobile", SOV: "doc_mass", FRA: "doc_plan", ENG: "doc_fire", ITA: "doc_fire" };
const FOCUS_ORDER = ["industry", "construction", "rearm", "production", "research", "army", "equip", "political", "conscription", "doctrine", "warprop", "alliance", "fleet", "fortify"];
const shuffleFocus = (g, list) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(g.rng() * (i + 1)); if (g.rng() < 0.35) [a[i], a[j]] = [a[j], a[i]]; } return a; };
const hash = s => [...s].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;

export function runAI(g, c) {
  const day = Math.floor(g.hourCount / 24);
  economy(g, c);
  if ((day + hash(c.tag)) % 7 === 0) diplomacy(g, c);
  military(g, c, day);
}

function economy(g, c) {
  for (let i = 0; i < c.research.length; i++) {
    if (c.research[i]) continue;
    for (const id of TECH_ORDER) {
      const tid = id === "DOCTRINE" ? (DOCTRINE[c.tag] || "doc_plan") : id;
      if (tid.startsWith("tank") || tid === "motor") { if (!c.major && !["POL", "CZE", "SWE", "ROM"].includes(c.tag)) continue; }
      const t = TECHS.find(x => x.id === tid);
      if (t && g.techAvailable(c, t)) { g.setResearch(c.tag, i, tid); break; }
    }
    if (!c.research[i]) { const t = TECHS.find(x => g.techAvailable(c, x)); if (t) g.setResearch(c.tag, i, t.id); }
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

  if (c.techs.has("tank1")) c.infShare = c.tag === "GER" ? 0.62 : c.major ? 0.75 : 0.88;

  const divs = g.divsOf(c.tag);
  const war = g.atWarAny(c.tag);
  const target = Math.round((8 + c.milEff * 1.6 + c.civEff * 0.3) * (war ? 1.35 : 1) * 1);
  let n = divs.length + c.training.length, made = 0;
  const armCount = divs.filter(d => d.type === "arm").length + c.training.filter(t => t.type === "arm").length;
  const reserve = 40 + divs.length * 1.5;
  while (n < target && made < 3 && c.manpower > reserve + 10) {
    let type = "inf";
    if (c.techs.has("tank1") && armCount + made < n * 0.22 && g.canTrain(c.tag, "arm")) type = "arm";
    if (!g.canTrain(c.tag, type)) break;
    g.train(c.tag, type); n++; made++;
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
  for (const id of p.divs) { const d = g.divs.get(id); if (d && (hostile ? hostile.has(d.tag) : g.atWar(tag, d.tag))) s += (d.type === "arm" ? 1.6 : 1.2) * d.str * (0.3 + 0.7 * d.org); }
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

function military(g, c, day) {
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
    const power = here.reduce((s, d) => s + UNIT[d.type].att * (d.type === "arm" ? 1.6 : 1) * d.str * d.org * (1 + g.mod(c.tag, d.type === "arm" ? "armAtt" : "infAtt")), 0);
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
