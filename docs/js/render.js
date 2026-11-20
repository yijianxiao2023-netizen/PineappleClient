import { COUNTRIES, UNIT } from "./data.js";

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgb = (c, k = 1, a = 1) => `rgba(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)},${a})`;

export class MapView {
  constructor(canvas, game) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.g = game;
    this.W = game.map.width; this.H = game.map.height;
    this.scale = 1; this.ox = 0; this.oy = 0;
    this.mode = "political";
    this.selected = new Set();
    this.selProv = null;
    this.hoverProv = null;
    this.box = null;
    this.buildMode = null;
    this.dirty = true;
    this.paths = game.P.map(p => { const path = new Path2D(); for (const poly of p.shape) for (const ring of poly) { ring.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y)); path.closePath(); } return path; });
    this.coastPath = new Path2D();
    for (const poly of game.map.coast) for (const ring of poly) { ring.forEach(([x, y], i) => i ? this.coastPath.lineTo(x, y) : this.coastPath.moveTo(x, y)); this.coastPath.closePath(); }
    this.buildEdges();
    this.patterns = {};
    this.lastMapVersion = -1;
    this.resize();
  }

  buildEdges() {
    const edges = new Map();
    const P = this.g.P;
    for (const p of P) for (const poly of p.shape) for (const ring of poly) {
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i], b = ring[i + 1];
        const ka = a[0].toFixed(1) + "," + a[1].toFixed(1), kb = b[0].toFixed(1) + "," + b[1].toFixed(1);
        const key = ka < kb ? ka + "|" + kb : kb + "|" + ka;
        let e = edges.get(key);
        if (!e) { e = { a, b, ps: [] }; edges.set(key, e); }
        if (!e.ps.includes(p.id)) e.ps.push(p.id);
      }
    }
    this.edges = [...edges.values()].filter(e => e.ps.length === 2);
  }

  rebuildDynamic() {
    const g = this.g;
    this.borderPath = new Path2D();
    this.frontPath = new Path2D();
    for (const e of this.edges) {
      const [a, b] = e.ps.map(i => g.P[i]);
      if (a.owner !== b.owner) { this.borderPath.moveTo(e.a[0], e.a[1]); this.borderPath.lineTo(e.b[0], e.b[1]); }
      if (a.ctrl !== b.ctrl && g.atWar(a.ctrl, b.ctrl)) { this.frontPath.moveTo(e.a[0], e.a[1]); this.frontPath.lineTo(e.b[0], e.b[1]); }
    }
    const groups = {};
    for (const p of g.P) { (groups[p.owner] ||= []).push(p); }
    this.labels = [];
    for (const [tag, provs] of Object.entries(groups)) {
      const seen = new Set(); let best = null;
      for (const p of provs) {
        if (seen.has(p.id)) continue;
        const comp = []; const q = [p.id]; seen.add(p.id);
        while (q.length) { const id = q.pop(); comp.push(g.P[id]); for (const n of g.P[id].adj) if (!seen.has(n) && g.P[n].owner === tag) { seen.add(n); q.push(n); } }
        const area = comp.reduce((s, x) => s + x.area, 0);
        if (!best || area > best.area) best = { comp, area };
      }
      if (!best || best.area < 400) continue;
      let cx = 0, cy = 0; for (const x of best.comp) { cx += x.c[0] * x.area; cy += x.c[1] * x.area; } cx /= best.area; cy /= best.area;
      let near = best.comp[0], nd = 1e18; for (const x of best.comp) { const d = (x.c[0] - cx) ** 2 + (x.c[1] - cy) ** 2; if (d < nd) { nd = d; near = x; } }
      const xs = best.comp.map(x => x.c[0]), w = Math.max(...xs) - Math.min(...xs);
      this.labels.push({ tag, x: near.c[0], y: near.c[1], size: Math.max(9, Math.min(46, Math.sqrt(best.area) * 0.32, w * 0.16)) });
    }
    this.lastMapVersion = g.mapVersion;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    const r = this.cv.getBoundingClientRect();
    this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
    this.vw = r.width; this.vh = r.height;
    this.dirty = true;
  }

  fit() {
    this.scale = Math.max(this.vw / this.W, this.vh / this.H) * 1.0;
    this.ox = (this.vw - this.W * this.scale) / 2; this.oy = (this.vh - this.H * this.scale) / 2;
    this.clamp(); this.dirty = true;
  }
  focusOn(x, y, s) { this.scale = s; this.ox = this.vw / 2 - x * s; this.oy = this.vh / 2 - y * s; this.clamp(); this.dirty = true; }
  clamp() {
    const minS = Math.min(this.vw / this.W, this.vh / this.H) * 0.9;
    this.scale = Math.max(minS, Math.min(9, this.scale));
    const mw = this.W * this.scale, mh = this.H * this.scale;
    this.ox = mw < this.vw ? (this.vw - mw) / 2 : Math.min(0, Math.max(this.vw - mw, this.ox));
    this.oy = mh < this.vh ? (this.vh - mh) / 2 : Math.min(0, Math.max(this.vh - mh, this.oy));
  }
  zoomAt(sx, sy, f) { const wx = (sx - this.ox) / this.scale, wy = (sy - this.oy) / this.scale; this.scale *= f; this.clamp(); this.ox = sx - wx * this.scale; this.oy = sy - wy * this.scale; this.clamp(); this.dirty = true; }
  toWorld(sx, sy) { return [(sx - this.ox) / this.scale, (sy - this.oy) / this.scale]; }
  toScreen(x, y) { return [x * this.scale + this.ox, y * this.scale + this.oy]; }

  provAt(sx, sy) {
    const [x, y] = this.toWorld(sx, sy);
    const ctx = this.ctx;
    for (let i = 0; i < this.paths.length; i++) {
      const p = this.g.P[i];
      if (Math.abs(p.c[0] - x) > 160 || Math.abs(p.c[1] - y) > 160) continue;
      if (ctx.isPointInPath(this.paths[i], x, y)) return p;
    }
    return null;
  }

  countersAt(sx, sy) {
    if (!this.counterRects) return null;
    for (let i = this.counterRects.length - 1; i >= 0; i--) { const r = this.counterRects[i]; if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) return r; }
    return null;
  }

  colorFor(tag) {
    if (this.mode === "faction") { const f = this.g.factionOf(tag); return hex(f ? f.color : "#9a958a"); }
    return hex(COUNTRIES[tag].color);
  }

  stripe(tag) {
    const key = this.mode + tag;
    if (this.patterns[key]) return this.patterns[key];
    const c = document.createElement("canvas"); c.width = c.height = 10;
    const x = c.getContext("2d");
    x.strokeStyle = rgb(this.colorFor(tag), 1, 0.95); x.lineWidth = 3.2;
    x.beginPath(); x.moveTo(-2, 12); x.lineTo(12, -2); x.moveTo(-2, 2); x.lineTo(2, -2); x.moveTo(8, 12); x.lineTo(12, 8); x.stroke();
    return (this.patterns[key] = this.ctx.createPattern(c, "repeat"));
  }

  draw() {
    const g = this.g, ctx = this.ctx, s = this.scale;
    if (g.mapVersion !== this.lastMapVersion) this.rebuildDynamic();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const grd = ctx.createLinearGradient(0, 0, 0, this.vh);
    grd.addColorStop(0, "#1b3550"); grd.addColorStop(1, "#14283d");
    ctx.fillStyle = grd; ctx.fillRect(0, 0, this.vw, this.vh);
    ctx.setTransform(this.dpr * s, 0, 0, this.dpr * s, this.dpr * this.ox, this.dpr * this.oy);

    ctx.strokeStyle = "rgba(150,190,220,0.10)"; ctx.lineWidth = 7 / s; ctx.stroke(this.coastPath);
    ctx.strokeStyle = "rgba(150,190,220,0.10)"; ctx.lineWidth = 3 / s; ctx.stroke(this.coastPath);

    const player = g.player;
    for (const p of g.P) {
      const c = this.colorFor(p.owner);
      const shade = p.owner === player ? 1.06 : 0.92;
      ctx.fillStyle = rgb(c, shade);
      ctx.fill(this.paths[p.id]);
      if (p.ctrl !== p.owner) { const pat = this.stripe(p.ctrl); pat.setTransform(new DOMMatrix([1 / s, 0, 0, 1 / s, 0, 0])); ctx.fillStyle = pat; ctx.fill(this.paths[p.id]); }
    }
    if (this.buildMode) {
      for (const p of g.P) if (g.canBuild(player, this.buildMode, p.id)) { ctx.fillStyle = "rgba(255,220,90,0.35)"; ctx.fill(this.paths[p.id]); }
    }
    if (s > 0.9) { ctx.strokeStyle = "rgba(0,0,0,0.16)"; ctx.lineWidth = 0.7 / s; for (const p of g.P) ctx.stroke(this.paths[p.id]); }
    ctx.strokeStyle = "rgba(20,24,28,0.85)"; ctx.lineWidth = 1.7 / s; ctx.stroke(this.borderPath);
    ctx.strokeStyle = "rgba(10,25,40,0.7)"; ctx.lineWidth = 1 / s; ctx.stroke(this.coastPath);
    ctx.save(); ctx.strokeStyle = "rgba(230,40,30,0.9)"; ctx.lineWidth = 2.2 / s; ctx.setLineDash([5 / s, 3 / s]); ctx.stroke(this.frontPath); ctx.restore();

    if (this.hoverProv) { ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fill(this.paths[this.hoverProv.id]); }
    if (this.selProv) { ctx.strokeStyle = "#ffe27a"; ctx.lineWidth = 2.4 / s; ctx.stroke(this.paths[this.selProv.id]); }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawLabels();
    this.drawCities();
    this.drawPaths();
    this.drawUnits();
    this.drawBattles();
    if (this.box) {
      const { x0, y0, x1, y1 } = this.box;
      ctx.fillStyle = "rgba(255,226,122,0.12)"; ctx.strokeStyle = "#ffe27a"; ctx.lineWidth = 1;
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
    this.dirty = false;
  }

  drawLabels() {
    const ctx = this.ctx, s = this.scale;
    if (s > 3.2) return;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const l of this.labels) {
      const size = l.size * s;
      if (size < 8) continue;
      const [x, y] = this.toScreen(l.x, l.y);
      if (x < -200 || y < -50 || x > this.vw + 200 || y > this.vh + 50) continue;
      const name = COUNTRIES[l.tag].name.toUpperCase();
      ctx.font = `700 ${Math.min(size, 64)}px Oswald, "Arial Narrow", sans-serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.strokeText(name, x, y);
      ctx.fillStyle = "rgba(255,255,255,0.82)"; ctx.fillText(name, x, y);
    }
  }

  drawCities() {
    const ctx = this.ctx, s = this.scale;
    if (s < 1.1) return;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    for (const p of this.g.P) {
      if (!p.city) continue;
      if (p.vp < 5 && s < 2.2) continue;
      if (p.vp < 3 && s < 3) continue;
      const [x, y] = this.toScreen(p.c[0], p.c[1]);
      if (x < -50 || y < -20 || x > this.vw + 50 || y > this.vh + 20) continue;
      const cap = !!p.capital && p.owner === p.capital;
      ctx.fillStyle = cap ? "#ffe27a" : "#f3efe2"; ctx.strokeStyle = "#111"; ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (cap) { star(ctx, x, y, 5.5); } else ctx.rect(x - 2.5, y - 2.5, 5, 5);
      ctx.fill(); ctx.stroke();
      ctx.font = `${p.vp >= 10 ? 600 : 500} ${p.vp >= 10 ? 12 : 11}px Inter, system-ui, sans-serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.strokeText(p.city, x + 7, y - 7);
      ctx.fillStyle = "#fff"; ctx.fillText(p.city, x + 7, y - 7);
    }
  }

  drawPaths() {
    const ctx = this.ctx, g = this.g;
    const drawn = new Set();
    for (const d of g.divs.values()) {
      if (!d.path.length || d.tag !== g.player) continue;
      const key = d.prov + ">" + d.path[d.path.length - 1].id;
      const sel = this.selected.has(d.id);
      if (drawn.has(key + sel)) continue; drawn.add(key + sel);
      const pts = [g.P[d.prov].c, ...d.path.map(s => g.P[s.id].c)].map(c => this.toScreen(c[0], c[1]));
      ctx.strokeStyle = sel ? "rgba(255,226,122,0.95)" : "rgba(120,220,120,0.75)";
      ctx.lineWidth = sel ? 3 : 2; ctx.setLineDash(d.attacking != null ? [6, 4] : []);
      ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.setLineDash([]);
      const [ax, ay] = pts[pts.length - 1], [bx, by] = pts[pts.length - 2];
      const ang = Math.atan2(ay - by, ax - bx);
      ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(ax, ay);
      ctx.lineTo(ax - 10 * Math.cos(ang - 0.45), ay - 10 * Math.sin(ang - 0.45)); ctx.lineTo(ax - 10 * Math.cos(ang + 0.45), ay - 10 * Math.sin(ang + 0.45)); ctx.fill();
    }
  }

  drawUnits() {
    const ctx = this.ctx, g = this.g, s = this.scale;
    this.counterRects = [];
    const showAll = s > 1.9;
    for (const p of g.P) {
      if (!p.divs.size) continue;
      const [cx, cy] = this.toScreen(p.c[0], p.c[1]);
      if (cx < -40 || cy < -30 || cx > this.vw + 40 || cy > this.vh + 30) continue;
      const by = new Map();
      for (const id of p.divs) { const d = g.divs.get(id); if (!d) continue; if (!by.has(d.tag)) by.set(d.tag, []); by.get(d.tag).push(d); }
      let k = 0;
      for (const [tag, ds] of by) {
        if (!showAll && tag !== g.player && !g.atWar(g.player, tag)) continue;
        const w = 30, h = 18, x = cx - w / 2 + k * 8, y = cy + 4 + k * 8;
        const col = hex(COUNTRIES[tag].color);
        const sel = ds.some(d => this.selected.has(d.id));
        const rel = tag === g.player ? "self" : g.relation(g.player, tag);
        ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(x + 2, y + 2, w, h);
        ctx.fillStyle = rgb(col, 0.9); ctx.fillRect(x, y, w, h);
        ctx.lineWidth = sel ? 2.5 : 1.2;
        ctx.strokeStyle = sel ? "#ffe27a" : rel === "enemy" ? "#ff4a3d" : rel === "self" ? "#f1f1f1" : rel === "ally" ? "#7fd4ff" : "#222";
        ctx.strokeRect(x, y, w, h);
        const arm = ds.filter(d => d.type === "arm").length;
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.2;
        const ix = x + 3, iy = y + 3, iw = 10, ih = 8;
        ctx.strokeRect(ix, iy, iw, ih);
        ctx.beginPath();
        if (arm >= ds.length / 2) { ctx.ellipse(ix + iw / 2, iy + ih / 2, 3.3, 2.2, 0, 0, Math.PI * 2); }
        else { ctx.moveTo(ix, iy); ctx.lineTo(ix + iw, iy + ih); ctx.moveTo(ix + iw, iy); ctx.lineTo(ix, iy + ih); }
        ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "700 11px Inter, system-ui, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.fillText(String(ds.length), x + w - 3, y + h / 2 - 1);
        const org = ds.reduce((a, d) => a + d.org, 0) / ds.length, str = ds.reduce((a, d) => a + d.str, 0) / ds.length;
        ctx.fillStyle = "#1a1a1a"; ctx.fillRect(x, y + h, w, 4);
        ctx.fillStyle = "#5ed06a"; ctx.fillRect(x, y + h, w * Math.max(0, str), 2);
        ctx.fillStyle = "#e8c24a"; ctx.fillRect(x, y + h + 2, w * Math.max(0, org), 2);
        this.counterRects.push({ x, y, w, h: h + 4, tag, prov: p.id, ids: ds.map(d => d.id) });
        k++;
      }
    }
  }

  drawBattles() {
    const ctx = this.ctx, g = this.g;
    for (const b of g.battles.values()) {
      const p = g.P[b.prov];
      const [x, y] = this.toScreen(p.c[0], p.c[1]);
      if (x < -30 || y < -30 || x > this.vw + 30 || y > this.vh + 30) continue;
      const share = b.A / (b.A + b.D);
      const mine = g.player && (g.friendly(g.player, b.attTag) || g.friendly(g.player, b.defTag));
      const good = g.friendly(g.player, b.attTag) ? share > 0.5 : share < 0.5;
      ctx.beginPath(); ctx.arc(x, y - 14, 10, 0, Math.PI * 2);
      ctx.fillStyle = mine ? (good ? "#2f8f3a" : "#a8322a") : "#555"; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = "#111"; ctx.stroke();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 5, y - 19); ctx.lineTo(x + 5, y - 9); ctx.moveTo(x + 5, y - 19); ctx.lineTo(x - 5, y - 9); ctx.stroke();
      ctx.fillStyle = "#111"; ctx.fillRect(x - 14, y - 2, 28, 4);
      ctx.fillStyle = "#e05a4a"; ctx.fillRect(x - 14, y - 2, 28 * share, 4);
    }
  }
}

function star(ctx, x, y, r) {
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}
