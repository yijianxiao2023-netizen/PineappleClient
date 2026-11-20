import { START_DATE, COUNTRIES, FACTIONS, TERRAIN, UNIT, BUILD, TECHS, GENERIC_FOCUS, NATIONAL_FOCUS } from "./data.js";

const DAY = 86400000;
const HOUR = 3600000;
const TECH = Object.fromEntries(TECHS.map(t => [t.id, t]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function dateStr(t) {
  const d = new Date(t);
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  return `${d.getUTCDate()} ${m} ${d.getUTCFullYear()}`;
}

export class Game {
  constructor(map, opts = {}) {
    this.map = map;
    this.P = map.provinces;
    this.time = START_DATE;
    this.hourCount = 0;
    this.player = opts.player || null;
    this.seed = opts.seed ?? Math.floor(Math.random() * 1e9);
    this.rng = mulberry(this.seed);
    this.events = [];
    this.listeners = [];
    this.divs = new Map();
    this.nextDivId = 1;
    this.wars = [];
    this.nextWarId = 1;
    this.battles = new Map();
    this.relVersion = 0;
    this.mapVersion = 0;
    this.ai = null;
    this.gameOver = null;
    this.factions = FACTIONS.map(f => ({ ...f, members: new Set(f.members) }));
    this.countries = {};
    for (const [tag, d] of Object.entries(COUNTRIES)) {
      this.countries[tag] = {
        tag, ...d, alive: true, pp: 50, manpower: d.pop * 8, eqInf: d.mil * 600 + d.divs * 200, tanks: 0, infShare: 1,
        techs: new Set(), research: Array.from({ length: d.slots }, () => null), focus: null, focusDone: new Set(),
        focusBonus: { ...(d.spirit || {}) }, mods: {}, construction: [], training: [], wargoals: {}, justifying: null, guarantees: new Set(),
        capital: -1, civEff: 0, milEff: 0, supplied: new Set(), kills: 0, losses: 0, flags: {},
      };
    }
    for (const p of this.P) {
      p.ctrl = p.owner; p.civ = 0; p.mil = 0; p.fort = 0; p.divs = new Set();
      p.slots = Math.max(1, 1 + Math.floor(p.vp / 5)) + (p.terrain === "plains" ? 1 : 0) - (p.terrain === "desert" ? 1 : 0);
      if (p.slots < 0) p.slots = 0;
      if (p.capital && this.countries[p.capital]) this.countries[p.capital].capital = p.id;
    }
    for (const c of Object.values(this.countries)) {
      const home = this.homeComponent(c.tag);
      for (const p of home) p.home = true;
      const own = this.ownedProvs(c.tag);
      const tot = own.reduce((s, p) => s + (1 + p.vp) * (p.home ? 1 : 0.2), 0) || 1;
      for (const p of own) p.pop = c.pop * (1 + p.vp) * (p.home ? 1 : 0.2) / tot;
    }
    for (const c of Object.values(this.countries)) {
      if (c.capital < 0) c.capital = this.ownedProvs(c.tag).sort((a, b) => b.vp - a.vp)[0]?.id ?? -1;
      this.recomputeMods(c);
      this.distributeFactories(c, "civ", c.civ);
      this.distributeFactories(c, "mil", c.mil);
      this.placeStartingDivisions(c);
    }
    this.rebuildRelations();
    this.updateEconomyCache();
    this.computeSupply();
  }

  on(fn) { this.listeners.push(fn); }
  log(text, type = "info", tags = []) {
    const e = { time: this.time, text, type, tags };
    this.events.push(e);
    if (this.events.length > 300) this.events.shift();
    for (const fn of this.listeners) fn(e);
  }

  c(tag) { return this.countries[tag]; }
  ownedProvs(tag) { return this.P.filter(p => p.owner === tag); }
  controlledProvs(tag) { return this.P.filter(p => p.ctrl === tag); }
  divsOf(tag) { return [...this.divs.values()].filter(d => d.tag === tag); }
  alive() { return Object.values(this.countries).filter(c => c.alive); }
  get date() { return new Date(this.time); }
  get year() { return new Date(this.time).getUTCFullYear(); }

  homeComponent(tag) {
    const c = this.c(tag);
    const start = this.P[c.capital];
    if (!start || start.owner !== tag) return this.ownedProvs(tag);
    const seen = new Set([start.id]), q = [start.id];
    while (q.length) { const id = q.pop(); for (const n of this.P[id].adj) if (!seen.has(n) && this.P[n].owner === tag) { seen.add(n); q.push(n); } }
    return [...seen].map(i => this.P[i]);
  }

  distributeFactories(c, kind, n) {
    if (n <= 0) return;
    let provs = this.homeComponent(c.tag).filter(p => p.ctrl === c.tag);
    if (!provs.length) provs = this.controlledProvs(c.tag).filter(p => p.owner === c.tag);
    if (!provs.length) return;
    for (let k = 0; k < n; k++) {
      let free = provs.filter(p => p.civ + p.mil < p.slots);
      if (!free.length) { const best = provs.reduce((a, b) => (b.vp > a.vp ? b : a)); best.slots++; free = [best]; }
      let tot = free.reduce((s, p) => s + p.vp + 1, 0), r = this.rng() * tot;
      let pick = free[0];
      for (const p of free) { r -= p.vp + 1; if (r <= 0) { pick = p; break; } }
      pick[kind]++;
    }
  }

  placeStartingDivisions(c) {
    const home = this.homeComponent(c.tag);
    if (!home.length) return;
    const border = home.filter(p => p.adj.some(n => this.P[n].owner !== c.tag));
    const spots = border.length ? border : home;
    for (let i = 0; i < c.divs; i++) {
      const p = i % 5 === 4 || !spots.length ? this.P[c.capital] || home[0] : spots[Math.floor(this.rng() * spots.length)];
      this.spawnDiv(c.tag, "inf", p.id, 1, 0.8);
    }
  }

  spawnDiv(tag, type, provId, str = 1, org = 0.6) {
    const d = { id: this.nextDivId++, tag, type, prov: provId, str, org, path: [], prog: 0, attacking: null, entrench: 0, sea: false };
    this.divs.set(d.id, d);
    this.P[provId].divs.add(d.id);
    return d;
  }
  removeDiv(d) { this.P[d.prov].divs.delete(d.id); this.divs.delete(d.id); }
  moveDivTo(d, provId) { this.P[d.prov].divs.delete(d.id); d.prov = provId; this.P[provId].divs.add(d.id); }

  factionOf(tag) { return this.factions.find(f => f.members.has(tag)) || null; }

  rebuildRelations() {
    const tags = Object.keys(this.countries);
    this.rel = {};
    for (const a of tags) { this.rel[a] = {}; for (const b of tags) this.rel[a][b] = a === b ? "self" : "neutral"; }
    for (const f of this.factions) for (const a of f.members) for (const b of f.members) if (a !== b) this.rel[a][b] = "ally";
    for (const w of this.wars) {
      for (const s of [0, 1]) {
        for (const a of w.sides[s]) {
          for (const b of w.sides[s]) if (a !== b) this.rel[a][b] = "ally";
          for (const b of w.sides[1 - s]) this.rel[a][b] = "enemy";
        }
      }
    }
    this.relVersion++;
  }
  relation(a, b) { return this.rel[a]?.[b] || "neutral"; }
  atWar(a, b) { return this.relation(a, b) === "enemy"; }
  friendly(a, b) { const r = this.relation(a, b); return r === "self" || r === "ally"; }
  atWarAny(tag) { return this.wars.some(w => w.sides[0].has(tag) || w.sides[1].has(tag)); }
  enemiesOf(tag) { return Object.keys(this.countries).filter(t => this.atWar(tag, t)); }
  navyPower(tag) { let n = 0; for (const c of this.alive()) if (this.friendly(tag, c.tag)) n += c.navy; return n; }
  canInvade(tag, enemy) { return this.navyPower(tag) >= this.navyPower(enemy) * 0.9; }
  canEnter(tag, p) { const r = this.relation(tag, p.ctrl); return r === "self" || r === "ally" || r === "enemy"; }

  recomputeMods(c) {
    const m = {};
    const add = fx => { for (const [k, v] of Object.entries(fx || {})) if (typeof v === "number") m[k] = (m[k] || 0) + v; };
    for (const id of c.techs) add(TECH[id].fx);
    add(c.focusBonus);
    c.mods = m;
  }
  mod(tag, k) { return this.countries[tag].mods[k] || 0; }

  updateEconomyCache() {
    for (const c of Object.values(this.countries)) { c.civEff = 0; c.milEff = 0; c.vpOwned = 0; c.vpLost = 0; c.mpBase = 0; }
    for (const p of this.P) {
      const c = this.countries[p.ctrl];
      if (c) { const f = p.owner === p.ctrl ? (p.home ? 1 : 0.6) : 0.3; c.civEff += p.civ * f; c.milEff += p.mil * f; c.mpBase += (p.pop || 0) * (p.owner === p.ctrl && p.home ? 1 : 0.12); }
      const o = this.countries[p.owner];
      if (o) { const w = (1 + p.vp) * (p.home ? 1 : 0.15); o.vpOwned += w; if (p.ctrl !== p.owner && this.atWar(p.ctrl, p.owner)) o.vpLost += w; }
    }
  }

  computeSupply() {
    for (const c of this.alive()) {
      let start = this.P[c.capital];
      if (!start || start.ctrl !== c.tag) start = this.controlledProvs(c.tag).filter(p => p.owner === c.tag).sort((a, b) => b.vp - a.vp)[0];
      const set = new Set();
      if (start) {
        set.add(start.id); const q = [start.id];
        while (q.length) {
          const id = q.pop(), p = this.P[id];
          for (const n of p.adj) if (!set.has(n) && this.friendly(c.tag, this.P[n].ctrl)) { set.add(n); q.push(n); }
          for (const n of p.sea) if (!set.has(n) && this.friendly(c.tag, this.P[n].ctrl) && this.P[n].ctrl === c.tag) { set.add(n); q.push(n); }
        }
        for (const p of this.P) if (p.ctrl === c.tag && p.owner === c.tag && !set.has(p.id)) {
          set.add(p.id); const q2 = [p.id];
          while (q2.length) { const id = q2.pop(); for (const n of this.P[id].adj) if (!set.has(n) && this.friendly(c.tag, this.P[n].ctrl)) { set.add(n); q2.push(n); } }
        }
      }
      c.supplied = set;
    }
  }

  legHours(d, from, to, viaSea) {
    const a = this.P[from], b = this.P[to];
    const dist = Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]);
    let h = UNIT[d.type].hours * TERRAIN[b.terrain].move * clamp(dist / 38, 0.6, 3.2);
    if (viaSea) h *= 3;
    if (this.atWar(d.tag, b.ctrl)) h *= 1.5;
    if (this.isWinter(b) && d.tag !== "SOV" && d.tag !== "FIN") h *= 1.3;
    return h / (1 + this.mod(d.tag, "speed"));
  }
  isWinter(p) { const m = new Date(this.time).getUTCMonth(); return (m >= 10 || m <= 1) && p.c[1] < 820 && p.c[0] > 900; }

  findPath(tag, type, from, to) {
    if (from === to) return [];
    const dist = new Map([[from, 0]]), prev = new Map(), done = new Set();
    const heap = [[0, from]];
    const push = item => { heap.push(item); let i = heap.length - 1; while (i > 0) { const pa = (i - 1) >> 1; if (heap[pa][0] <= heap[i][0]) break; [heap[pa], heap[i]] = [heap[i], heap[pa]]; i = pa; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const fake = { type, tag };
    const tp = this.P[to];
    while (heap.length) {
      const [dcur, id] = pop();
      if (done.has(id)) continue; done.add(id);
      if (id === to) break;
      const p = this.P[id];
      for (let k = 0; k < p.adj.length + p.sea.length; k++) {
        const sea = k >= p.adj.length, n = sea ? p.sea[k - p.adj.length] : p.adj[k];
        if (done.has(n)) continue;
        const q = this.P[n];
        const r = this.relation(tag, q.ctrl);
        if (r === "neutral") continue;
        if (sea && r === "enemy" && !this.canInvade(tag, q.ctrl)) continue;
        const cost = this.legHours(fake, id, n, sea) + (r === "enemy" ? 6 : 0);
        const nd = dcur + cost;
        if (nd < (dist.get(n) ?? Infinity)) { dist.set(n, nd); prev.set(n, [id, sea]); push([nd + Math.hypot(q.c[0] - tp.c[0], q.c[1] - tp.c[1]) * 0.3, n]); }
      }
    }
    if (!prev.has(to)) return null;
    const path = []; let cur = to;
    while (cur !== from) { const [pv, sea] = prev.get(cur); path.unshift({ id: cur, sea }); cur = pv; }
    return path;
  }

  orderMove(divIds, target) {
    let ok = 0;
    for (const id of divIds) {
      const d = this.divs.get(id);
      if (!d) continue;
      if (d.prov === target) { d.path = []; d.attacking = null; d.prog = 0; ok++; continue; }
      const path = this.findPath(d.tag, d.type, d.prov, target);
      if (path) { d.path = path; d.prog = 0; d.attacking = null; ok++; }
    }
    return ok;
  }

  capture(p, tag) {
    if (p.ctrl === tag) return;
    const prevCtrl = p.ctrl;
    let newCtrl = tag;
    if (p.owner !== prevCtrl && this.friendly(tag, p.owner) && this.countries[p.owner].alive) newCtrl = p.owner;
    p.ctrl = newCtrl;
    this.mapVersion++;
    for (const id of [...p.divs]) { const d = this.divs.get(id); if (d && this.atWar(d.tag, tag)) this.retreatOrDestroy(d, tag); }
  }

  retreatOrDestroy(d, enemyTag) {
    const hasEnemy = q => [...q.divs].some(i => this.atWar(this.divs.get(i)?.tag, d.tag));
    const seen = new Set([d.prov]);
    let layer = [d.prov], dest = null;
    for (let depth = 0; depth < 4 && !dest && layer.length; depth++) {
      const next = [];
      for (const id of layer) for (const n of [...this.P[id].adj, ...this.P[id].sea]) {
        if (seen.has(n)) continue; seen.add(n);
        const q = this.P[n];
        if (!this.friendly(d.tag, q.ctrl)) continue;
        if (this.P[id].sea.includes(n) && !this.P[id].adj.includes(n) && q.ctrl !== d.tag) continue;
        if (hasEnemy(q)) continue;
        next.push(n);
        if (!dest || q.divs.size > this.P[dest].divs.size) dest = n;
      }
      layer = next;
    }
    if (dest == null) {
      this.countries[d.tag].losses++;
      if (this.countries[enemyTag]) this.countries[enemyTag].kills++;
      this.removeDiv(d);
      return false;
    }
    this.moveDivTo(d, dest);
    d.path = []; d.attacking = null; d.prog = 0; d.entrench = 0;
    d.str = Math.max(0.06, d.str - 0.03);
    return true;
  }

  tickHour() {
    if (this.gameOver) return;
    this.time += HOUR;
    this.hourCount++;
    this.battles.clear();
    const attackersBy = new Map();
    for (const d of this.divs.values()) {
      if (!d.path.length) { d.attacking = null; continue; }
      const step = d.path[0], next = this.P[step.id];
      if (!this.canEnter(d.tag, next) && next.ctrl !== d.tag) { d.path = []; d.attacking = null; continue; }
      const enemyHere = [...next.divs].some(i => { const e = this.divs.get(i); return e && this.atWar(d.tag, e.tag); });
      if (enemyHere) {
        if (d.org < 0.15) { d.path = []; d.attacking = null; continue; }
        d.attacking = next.id; d.sea = step.sea;
        if (!attackersBy.has(next.id)) attackersBy.set(next.id, []);
        attackersBy.get(next.id).push(d);
        continue;
      }
      d.attacking = null;
      d.prog += 1;
      d.entrench = 0;
      if (d.prog >= this.legHours(d, d.prov, next.id, step.sea)) {
        d.prog = 0; d.path.shift();
        this.moveDivTo(d, next.id);
        if (this.atWar(d.tag, next.ctrl)) this.capture(next, d.tag);
      }
    }
    for (const [pid, atts] of attackersBy) this.resolveBattle(this.P[pid], atts);
    for (const d of this.divs.values()) {
      if (d.attacking != null) continue;
      const inBattle = this.battles.has(d.prov);
      if (inBattle) continue;
      const supplied = this.countries[d.tag].supplied.has(d.prov);
      const maxOrg = supplied ? 1 : 0.3;
      const regen = (d.path.length ? 0.008 : 0.025) * (1 + this.mod(d.tag, "orgRegen"));
      d.org = Math.min(maxOrg, d.org + regen);
      if (!d.path.length) d.entrench = Math.min(1, d.entrench + 1 / 168);
    }
    if (this.hourCount % 24 === 0) this.tickDay();
  }

  resolveBattle(p, atts) {
    const defs = [...p.divs].map(i => this.divs.get(i)).filter(e => e && atts.some(a => this.atWar(a.tag, e.tag)));
    if (!defs.length) return;
    const terr = TERRAIN[p.terrain];
    const winter = this.isWinter(p);
    const antiArmor = Math.max(0, ...defs.map(d => this.mod(d.tag, "antiArmor")));
    const attPow = d => {
      const u = UNIT[d.type];
      let v = u.att * (1 + this.mod(d.tag, d.type === "arm" ? "armAtt" : "infAtt")) * d.str * (0.3 + 0.7 * d.org);
      if (d.type === "arm") v *= terr.armor * (1 - antiArmor);
      if (d.sea) v *= 0.5;
      if (winter && d.tag !== "SOV" && d.tag !== "FIN") v *= 0.75;
      return v;
    };
    const defPow = d => {
      const u = UNIT[d.type];
      return u.def * (1 + this.mod(d.tag, d.type === "arm" ? "armDef" : "infDef")) * terr.def * (1 + 0.15 * p.fort) * (1 + 0.25 * d.entrench * (1 + this.mod(d.tag, "entrench"))) * d.str * (0.3 + 0.7 * d.org);
    };
    const top = (arr, f) => arr.map(f).sort((a, b) => b - a).slice(0, 12).reduce((s, v, i) => s + v * (i < 8 ? 1 : 0.5), 0);
    const A = top(atts, attPow), D = top(defs, defPow);
    const r = A / Math.max(D, 0.01);
    const defLoss = clamp(0.013 * r, 0.001, 0.09), attLoss = clamp(0.013 / r, 0.001, 0.09);
    for (const d of defs) { const j = 0.8 + this.rng() * 0.4; d.org -= defLoss * j; d.str -= defLoss * 0.2 * j; d.entrench = Math.max(0, d.entrench - 0.002); }
    for (const a of atts) { const j = 0.8 + this.rng() * 0.4; a.org -= attLoss * j; a.str -= attLoss * 0.16 * j; }
    const attTag = atts[0].tag, defTag = defs[0].tag;
    this.battles.set(p.id, { A, D, attTag, defTag, prov: p.id, from: [...new Set(atts.map(a => a.prov))] });
    for (const d of [...defs]) {
      if (d.str <= 0.05) { this.countries[d.tag].losses++; this.countries[attTag].kills++; this.removeDiv(d); continue; }
      if (d.org <= 0.08) this.retreatOrDestroy(d, attTag);
    }
    for (const a of atts) {
      if (a.str <= 0.05) { this.countries[a.tag].losses++; this.countries[defTag].kills++; this.removeDiv(a); continue; }
      if (a.org < 0.12) { a.path = []; a.attacking = null; }
    }
    const remaining = [...p.divs].some(i => { const e = this.divs.get(i); return e && atts.some(a => this.atWar(a.tag, e.tag)); });
    if (!remaining) {
      for (const a of atts) if (this.divs.has(a.id) && a.path.length) { a.attacking = null; a.prog = this.legHours(a, a.prov, p.id, a.sea) * 0.75; }
    }
  }

  tickDay() {
    this.updateEconomyCache();
    this.computeSupply();
    for (const c of this.alive()) this.dailyCountry(c);
    for (const d of [...this.divs.values()]) {
      const c = this.countries[d.tag];
      if (!c.supplied.has(d.prov)) { d.str -= 0.006 * (c.mods.supply ? 0.5 : 1); if (d.str <= 0.05) { c.losses++; this.removeDiv(d); } }
    }
    this.checkCapitulations();
    if (this.ai) for (const c of this.alive()) if (c.tag !== this.player) this.ai(this, c);
    const d = new Date(this.time);
    if (d.getUTCDate() === 1) this.log(`${dateStr(this.time)}`, "date");
  }

  dailyCountry(c) {
    c.pp = Math.min(2000, c.pp + 2 + (c.mods.ppGain || 0));
    c.manpower += c.mpBase * 0.02 * (1 + (c.mods.manpower || 0));

    let pts = c.civEff * 5 * (1 + (c.mods.construction || 0));
    const perItem = 15 * 5 * (1 + (c.mods.construction || 0));
    for (const item of c.construction) {
      if (pts <= 0) break;
      const p = this.P[item.prov];
      if (p.ctrl !== c.tag) continue;
      const use = Math.min(pts, perItem, BUILD[item.type].cost - item.progress);
      item.progress += use; pts -= use;
      if (item.progress >= BUILD[item.type].cost) {
        item.done = true;
        if (item.type === "fort") p.fort = Math.min(5, p.fort + 1);
        else if (p.civ + p.mil < p.slots) p[item.type]++;
        if (c.tag === this.player) this.log(`${BUILD[item.type].name} completed in ${p.name}.`, "build", [c.tag]);
      }
    }
    c.construction = c.construction.filter(i => !i.done && this.P[i.prov].owner === c.tag);

    const prod = c.milEff * 4.5 * (1 + (c.mods.output || 0));
    const armor = c.techs.has("tank1");
    const inf = armor ? clamp(c.infShare, 0, 1) : 1;
    c.eqInf += prod * inf / 0.5;
    if (armor) c.tanks += prod * (1 - inf) / 4;

    for (const d of this.divs.values()) {
      if (d.tag !== c.tag || d.str >= 1 || d.attacking != null || !c.supplied.has(d.prov)) continue;
      const u = UNIT[d.type];
      const need = Math.min(0.05, 1 - d.str);
      const eq = need * u.eq, tk = need * u.tanks, mp = need * u.mp;
      if (c.eqInf >= eq && c.tanks >= tk && c.manpower >= mp) { c.eqInf -= eq; c.tanks -= tk; c.manpower -= mp; d.str += need; }
    }

    for (const t of c.training) t.days--;
    const ready = c.training.filter(t => t.days <= 0);
    c.training = c.training.filter(t => t.days > 0);
    for (const t of ready) {
      let at = this.P[c.capital];
      if (!at || at.ctrl !== c.tag) at = this.controlledProvs(c.tag).sort((a, b) => b.vp - a.vp)[0];
      if (at) { this.spawnDiv(c.tag, t.type, at.id, 1, 0.5); if (c.tag === this.player) this.log(`New ${UNIT[t.type].name.toLowerCase()} division ready in ${at.name}.`, "army", [c.tag]); }
    }

    for (let i = 0; i < c.research.length; i++) {
      const r = c.research[i];
      if (!r) continue;
      r.progress++;
      if (r.progress >= this.techCost(c, TECH[r.id])) {
        c.techs.add(r.id); c.research[i] = null; this.recomputeMods(c);
        if (c.tag === this.player) this.log(`Research complete: ${TECH[r.id].name}.`, "research", [c.tag]);
      }
    }

    if (c.focus) {
      c.focus.progress++;
      if (c.focus.progress >= 70) {
        const f = this.focusById(c.tag, c.focus.id);
        c.focusDone.add(f.id); c.focus = null;
        this.applyFocus(c, f);
      }
    }

    if (c.justifying) {
      c.justifying.days--;
      const t = this.countries[c.justifying.target];
      if (!t.alive) c.justifying = null;
      else if (c.justifying.days <= 0) {
        c.wargoals[t.tag] = this.time + 365 * DAY;
        if (c.tag === this.player || this.player === t.tag) this.log(`${c.name} has a war goal against ${t.name}.`, "diplo", [c.tag, t.tag]);
        c.justifying = null;
      }
    }
    for (const [t, exp] of Object.entries(c.wargoals)) if (exp < this.time) delete c.wargoals[t];
  }

  techCost(c, t) {
    const ahead = Math.max(0, t.year - this.year);
    return Math.round(t.days * (1 + 0.5 * ahead));
  }
  techAvailable(c, t) {
    if (c.techs.has(t.id) || c.research.some(r => r && r.id === t.id)) return false;
    if (!t.req.every(r => c.techs.has(r))) return false;
    if (t.reqAny && !t.reqAny.some(r => c.techs.has(r))) return false;
    if (t.group && TECHS.some(o => o.group === t.group && o.id !== t.id && (c.techs.has(o.id) || c.research.some(r => r && r.id === o.id)))) return false;
    return true;
  }
  setResearch(tag, slot, techId) {
    const c = this.countries[tag], t = TECH[techId];
    if (!t || slot < 0 || slot >= c.research.length || !this.techAvailable(c, t)) return false;
    c.research[slot] = { id: techId, progress: 0 };
    return true;
  }

  focusTree(tag) { return [...GENERIC_FOCUS, ...(NATIONAL_FOCUS[tag] || [])]; }
  focusById(tag, id) { return this.focusTree(tag).find(f => f.id === id); }
  focusAvailable(c, f) {
    if (c.focusDone.has(f.id) || (c.focus && c.focus.id === f.id)) return false;
    if (!f.req.every(r => c.focusDone.has(r))) return false;
    if (f.after && this.time < f.after) return false;
    const fx = f.fx;
    if (fx.annex && !this.countries[fx.annex].alive) return false;
    if (fx.annex && this.atWarAny(fx.annex)) return false;
    if (fx.sudeten && (!this.countries[fx.sudeten].alive || this.atWarAny(fx.sudeten))) return false;
    if (fx.bessarabia && (!this.countries[fx.bessarabia].alive || this.atWarAny(fx.bessarabia))) return false;
    if (fx.wargoal && !this.countries[fx.wargoal].alive) return false;
    if (fx.invite && (!this.countries[fx.invite].alive || this.factionOf(fx.invite))) return false;
    return true;
  }
  setFocus(tag, id) {
    const c = this.countries[tag], f = this.focusById(tag, id);
    if (!f || c.focus || !this.focusAvailable(c, f)) return false;
    c.focus = { id, progress: 0 };
    return true;
  }

  applyFocus(c, f) {
    const fx = f.fx;
    if (fx.civ) this.distributeFactories(c, "civ", fx.civ);
    if (fx.mil) this.distributeFactories(c, "mil", fx.mil);
    if (fx.pp) c.pp += fx.pp;
    if (fx.slot) c.research.push(null);
    if (fx.manpower) c.manpower += fx.manpower;
    if (fx.navy) c.navy += fx.navy;
    if (f.bonus) { for (const [k, v] of Object.entries(f.bonus)) c.focusBonus[k] = (c.focusBonus[k] || 0) + v; this.recomputeMods(c); }
    if (fx.fortBorders) for (const p of this.P) if (p.owner === c.tag && p.ctrl === c.tag && p.adj.some(n => this.P[n].owner !== c.tag)) p.fort = Math.max(p.fort, fx.fortBorders);
    if (fx.joinFaction) {
      const want = { democratic: "allies", fascist: "axis", communist: "comintern" }[c.ideology];
      const f2 = this.factions.find(x => x.id === want && this.countries[x.leader]?.alive);
      if (f2 && !this.factionOf(c.tag)) this.joinFaction(c.tag, f2.id);
    }
    if (fx.annex) this.annex(c.tag, fx.annex, true);
    if (fx.annexMany) for (const t of fx.annexMany) if (this.countries[t].alive && !this.atWarAny(t)) this.annex(c.tag, t, true);
    if (fx.sudeten) {
      const t = fx.sudeten;
      const provs = this.P.filter(p => p.owner === t && p.adj.some(n => this.P[n].owner === c.tag));
      for (const p of provs) this.transferProvince(p, c.tag);
      this.log(`${c.name} takes the ${this.countries[t].adj} border regions.`, "diplo", [c.tag, t]);
    }
    if (fx.bessarabia) {
      const t = fx.bessarabia;
      const iasi = this.P.find(p => p.city === "Iași");
      const provs = this.P.filter(p => p.owner === t && iasi && p.c[0] > iasi.c[0] + 8);
      for (const p of provs) this.transferProvince(p, c.tag);
      this.log(`${c.name} takes Bessarabia from ${this.countries[t].name}.`, "diplo", [c.tag, t]);
    }
    if (fx.wargoal) { c.wargoals[fx.wargoal] = this.time + 365 * DAY; }
    if (fx.invite) { const fac = this.factionOf(c.tag); if (fac) this.joinFaction(fx.invite, fac.id); }
    if (fx.joinAxis) { const ax = this.factions.find(x => x.id === "axis" && this.countries[x.leader]?.alive); if (ax && !this.factionOf(c.tag)) this.joinFaction(c.tag, "axis"); }
    if (fx.guarantee) for (const t of fx.guarantee) if (this.countries[t].alive) c.guarantees.add(t);
    this.log(`${c.name} completed the focus "${f.name}".`, c.tag === this.player ? "focus" : "world", [c.tag]);
    this.updateEconomyCache();
  }

  transferProvince(p, tag) {
    for (const id of [...p.divs]) { const d = this.divs.get(id); if (d && d.tag !== tag) { const cap = this.P[this.countries[d.tag].capital]; if (cap && cap.ctrl === d.tag) this.moveDivTo(d, cap.id); else this.removeDiv(d); } }
    p.owner = tag; p.ctrl = tag;
    this.mapVersion++;
  }

  annex(tag, target, peaceful) {
    const t = this.countries[target];
    if (!t.alive) return;
    for (const p of this.P) if (p.owner === target) { p.owner = tag; p.ctrl = tag; }
    for (const p of this.P) if (p.ctrl === target) p.ctrl = p.owner;
    for (const d of [...this.divs.values()]) if (d.tag === target) { if (peaceful) { d.tag = tag; d.path = []; } else this.removeDiv(d); }
    this.killCountry(t);
    this.log(peaceful ? `${this.countries[tag].name} annexed ${t.name}.` : `${t.name} has capitulated to ${this.countries[tag].name}.`, "major", [tag, target]);
  }

  killCountry(t) {
    t.alive = false; t.focus = null; t.research = t.research.map(() => null); t.construction = []; t.training = []; t.justifying = null;
    for (const f of this.factions) {
      if (f.members.delete(t.tag) && f.leader === t.tag) f.leader = [...f.members][0] || null;
    }
    this.factions = this.factions.filter(f => f.members.size > 0);
    for (const c of Object.values(this.countries)) { c.guarantees.delete(t.tag); delete c.wargoals[t.tag]; }
    for (const w of this.wars) { w.sides[0].delete(t.tag); w.sides[1].delete(t.tag); }
    const ended = this.wars.filter(w => !w.sides[0].size || !w.sides[1].size);
    this.wars = this.wars.filter(w => w.sides[0].size && w.sides[1].size);
    for (const w of ended) this.log(`The ${w.name} has ended.`, "major", []);
    this.rebuildRelations();
    this.cleanupAfterPeace();
    this.mapVersion++;
    if (t.tag === this.player) this.gameOver = { win: false, text: `${t.name} has fallen.` };
  }

  cleanupAfterPeace() {
    for (const p of this.P) {
      if (p.ctrl !== p.owner && !this.atWar(p.ctrl, p.owner)) {
        if (!this.countries[p.owner].alive) p.owner = p.ctrl; else p.ctrl = p.owner;
      }
    }
    for (const d of [...this.divs.values()]) {
      const p = this.P[d.prov];
      if (!this.friendly(d.tag, p.ctrl)) {
        const cap = this.P[this.countries[d.tag].capital];
        if (cap && cap.ctrl === d.tag) { this.moveDivTo(d, cap.id); d.path = []; d.attacking = null; }
        else this.removeDiv(d);
      }
      d.path = d.path.filter(s => this.canEnter(d.tag, this.P[s.id]));
    }
  }

  checkCapitulations() {
    for (const c of this.alive()) {
      if (!this.atWarAny(c.tag) || !c.vpOwned) continue;
      const lost = c.vpLost / c.vpOwned;
      const cap = this.P[c.capital];
      const capLost = !cap || (cap.owner === c.tag && cap.ctrl !== c.tag);
      const need = c.tag === "SOV" ? 0.8 : c.tag === "ENG" ? 0.7 : 0.6;
      const since = Math.min(...this.wars.filter(w => w.sides[0].has(c.tag) || w.sides[1].has(c.tag)).map(w => w.start));
      if (this.time - since < (c.major ? 45 : 25) * DAY && lost < 0.9) continue;
      if (lost >= need || (capLost && lost >= 0.45) || (this.divsOf(c.tag).length === 0 && lost >= 0.25)) this.capitulate(c);
    }
  }

  capitulate(c) {
    const weight = {};
    for (const p of this.P) if (p.owner === c.tag && p.ctrl !== c.tag && this.atWar(p.ctrl, c.tag)) weight[p.ctrl] = (weight[p.ctrl] || 0) + (1 + p.vp) * (p.home ? 1 : 0.15);
    const enemies = this.enemiesOf(c.tag).filter(t => this.countries[t].alive);
    let conqueror = Object.entries(weight).sort((a, b) => b[1] - a[1])[0]?.[0] || enemies[0];
    if (!conqueror) return;
    for (const p of this.P) {
      if (p.owner !== c.tag) continue;
      if (p.ctrl !== c.tag && this.atWar(p.ctrl, c.tag)) p.owner = p.ctrl;
      else { p.owner = conqueror; p.ctrl = conqueror; }
    }
    for (const p of this.P) if (p.ctrl === c.tag) p.ctrl = p.owner;
    for (const d of [...this.divs.values()]) if (d.tag === c.tag) this.removeDiv(d);
    this.log(`${c.name} has capitulated! Its lands are taken by ${this.countries[conqueror].name}.`, "major", [c.tag, conqueror]);
    this.killCountry(c);
    if (this.player && this.countries[this.player].alive) {
      const pf = this.factionOf(this.player);
      const enemiesLeft = this.enemiesOf(this.player).length;
      if (!enemiesLeft && this.alive().every(x => x.tag === this.player || this.friendly(this.player, x.tag) || !x.major)) {
        this.gameOver = { win: true, text: `${this.countries[this.player].name}${pf ? " and the " + pf.name : ""} dominate Europe!` };
      }
    }
  }

  joinFaction(tag, factionId) {
    const f = this.factions.find(x => x.id === factionId);
    if (!f || this.factionOf(tag)) return false;
    f.members.add(tag);
    for (const w of this.wars) {
      const s = w.sides[0].has(f.leader) ? 0 : w.sides[1].has(f.leader) ? 1 : -1;
      if (s >= 0 && !w.sides[1 - s].has(tag)) w.sides[s].add(tag);
    }
    this.rebuildRelations();
    this.log(`${this.countries[tag].name} joined the ${f.name}.`, "diplo", [tag]);
    return true;
  }

  createFaction(tag, name) {
    if (this.factionOf(tag)) return false;
    this.factions.push({ id: "f_" + tag, name, leader: tag, members: new Set([tag]), color: this.countries[tag].color });
    this.rebuildRelations();
    this.log(`${this.countries[tag].name} founded the ${name}.`, "diplo", [tag]);
    return true;
  }

  justifyCost(tag) { return Math.round(50 * (1 - this.mod(tag, "justify"))); }
  canJustify(tag, target) {
    const c = this.countries[tag], t = this.countries[target];
    if (!t.alive || tag === target || c.justifying || c.wargoals[target] || this.atWar(tag, target) || this.friendly(tag, target)) return false;
    return c.pp >= this.justifyCost(tag);
  }
  justify(tag, target) {
    if (!this.canJustify(tag, target)) return false;
    const c = this.countries[tag];
    c.pp -= this.justifyCost(tag);
    c.justifying = { target, days: Math.round(30 * (1 - this.mod(tag, "justify"))), total: Math.round(30 * (1 - this.mod(tag, "justify"))) };
    return true;
  }
  canDeclare(tag, target) {
    const c = this.countries[tag], t = this.countries[target];
    return c.alive && t.alive && !!c.wargoals[target] && !this.atWar(tag, target) && !this.friendly(tag, target);
  }
  declareWar(tag, target) {
    if (!this.canDeclare(tag, target)) return false;
    const att = new Set([tag]), def = new Set([target]);
    const fa = this.factionOf(tag), fd = this.factionOf(target);
    if (fd) for (const m of fd.members) def.add(m);
    if (!this.atWarAny(target)) for (const c of this.alive()) if (c.guarantees.has(target)) def.add(c.tag);
    if (fa) for (const m of fa.members) if (!def.has(m)) att.add(m);
    for (const m of [...def]) if (att.has(m)) def.delete(m);
    if (!def.has(target)) return false;
    for (const m of [...def]) { const f = this.factionOf(m); if (f) for (const x of f.members) if (!att.has(x)) def.add(x); }
    const name = `${this.countries[tag].adj}–${this.countries[target].adj} War`;
    this.wars.push({ id: this.nextWarId++, name, sides: [att, def], start: this.time });
    delete this.countries[tag].wargoals[target];
    this.rebuildRelations();
    this.log(`${this.countries[tag].name} declared war on ${this.countries[target].name}!` + (def.size > 1 ? ` (${[...def].filter(x => x !== target).map(x => this.countries[x].name).join(", ")} join the defense)` : ""), "war", [tag, target]);
    return true;
  }

  guarantee(tag, target) {
    const c = this.countries[tag];
    if (c.pp < 25 || c.guarantees.has(target) || this.atWar(tag, target) || tag === target) return false;
    c.pp -= 25; c.guarantees.add(target);
    this.log(`${c.name} guaranteed the independence of ${this.countries[target].name}.`, "diplo", [tag, target]);
    return true;
  }

  usedSlots(p) { const c = this.countries[p.owner]; return p.civ + p.mil + c.construction.filter(i => i.prov === p.id && i.type !== "fort").length; }
  canBuild(tag, type, provId) {
    const p = this.P[provId];
    if (!p || p.owner !== tag || p.ctrl !== tag) return false;
    if (type === "fort") return p.fort + this.countries[tag].construction.filter(i => i.prov === p.id && i.type === "fort").length < 5;
    return this.usedSlots(p) < p.slots;
  }
  queueBuild(tag, type, provId) {
    if (!this.canBuild(tag, type, provId)) return false;
    this.countries[tag].construction.push({ type, prov: provId, progress: 0 });
    return true;
  }

  canTrain(tag, type) {
    const c = this.countries[tag], u = UNIT[type];
    if (type === "arm" && !c.techs.has("tank1")) return false;
    return c.eqInf >= u.eq && c.tanks >= u.tanks && c.manpower >= u.mp;
  }
  train(tag, type) {
    if (!this.canTrain(tag, type)) return false;
    const c = this.countries[tag], u = UNIT[type];
    c.eqInf -= u.eq; c.tanks -= u.tanks; c.manpower -= u.mp;
    c.training.push({ type, days: u.days, total: u.days });
    return true;
  }

  strength(tag) {
    let s = 0;
    for (const d of this.divs.values()) if (d.tag === tag) s += (d.type === "arm" ? 2 : 1) * d.str;
    return s;
  }
}
