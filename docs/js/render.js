import { COUNTRIES, UNIT, UNIT_ORDER, AIR_RANGE, ROMAN } from "./data.js?v=1795222643";

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
    this.bbox = game.P.map(p => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const poly of p.shape) for (const [x, y] of poly[0]) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; });
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
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    let hit = null;
    for (let i = 0; i < this.paths.length && !hit; i++) {
      const b = this.bbox[i];
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      if (ctx.isPointInPath(this.paths[i], x, y)) hit = this.g.P[i];
    }
    ctx.restore();
    return hit;
  }

  countersAt(sx, sy) {
    if (!this.counterRects) return null;
    for (let i = this.counterRects.length - 1; i >= 0; i--) { const r = this.counterRects[i]; if (sx >= r.x - 3 && sx <= r.x + r.w + 3 && sy >= r.y - 4 && sy <= r.y + r.h + 3) return r; }
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
    this.drawUnits();
    this.drawPaths();
    this.drawPreview();
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

  drawPreview() {
    const pv = this.preview, ctx = this.ctx, g = this.g;
    if (!pv || !this.selected.size) return;
    const s = this.scale;
    ctx.save();
    ctx.setTransform(this.dpr * s, 0, 0, this.dpr * s, this.dpr * this.ox, this.dpr * this.oy);
    ctx.fillStyle = pv.none ? "rgba(255,80,60,0.25)" : pv.attack ? "rgba(255,90,72,0.35)" : "rgba(255,230,120,0.35)";
    ctx.fill(this.paths[pv.to]);
    ctx.lineWidth = 3 / s; ctx.strokeStyle = pv.none ? "#ff6a58" : pv.attack ? "#ff6a58" : "#ffe27a"; ctx.stroke(this.paths[pv.to]);
    ctx.restore();
    ctx.save();
    if (pv.none) {
      const [mx, my] = this.mouse || [0, 0];
      ctx.font = "700 12px Inter, system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.strokeText("No route there", mx + 14, my + 10);
      ctx.fillStyle = "#ff9a8a"; ctx.fillText("No route there", mx + 14, my + 10);
      ctx.restore(); return;
    }
    const pts = [g.P[pv.from].c, ...pv.path.map(id => g.P[id].c)].map(c => this.toScreen(c[0], c[1]));
    const t = (performance.now() / 600) % 1;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const len = Math.hypot(bx - ax, by - ay); if (len < 2) continue;
      const ux = (bx - ax) / len, uy = (by - ay) / len, gap = Math.min(6, len * 0.12);
      const sx = ax + ux * gap, sy = ay + uy * gap, ex = bx - ux * gap, ey = by - uy * gap;
      const segLen = Math.hypot(ex - sx, ey - sy), head = Math.min(18, Math.max(8, segLen * 0.5)), shaft = Math.max(0, segLen - head);
      const hx = sx + ux * shaft, hy = sy + uy * shaft, nx = -uy, ny = ux, w = 5.5, hw = 12;
      ctx.beginPath();
      ctx.moveTo(sx + nx * w, sy + ny * w); ctx.lineTo(hx + nx * w, hy + ny * w); ctx.lineTo(hx + nx * hw, hy + ny * hw); ctx.lineTo(ex, ey);
      ctx.lineTo(hx - nx * hw, hy - ny * hw); ctx.lineTo(hx - nx * w, hy - ny * w); ctx.lineTo(sx - nx * w, sy - ny * w); ctx.closePath();
      ctx.fillStyle = pv.attack ? "rgba(255,90,72,0.55)" : "rgba(255,226,122,0.55)"; ctx.fill();
      ctx.setLineDash([6, 4]); ctx.lineDashOffset = -t * 10; ctx.lineWidth = 2.5; ctx.strokeStyle = "#111"; ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = pv.attack ? "#ffb0a4" : "#fff6cf"; ctx.stroke(); ctx.setLineDash([]);
    }
    const [lx, ly] = pts[pts.length - 1];
    const label = pv.occupied && pv.many <= 1 ? "Tile occupied · LEFT-CLICK to go next to it" : `${pv.path.length} step${pv.path.length > 1 ? "s" : ""} · LEFT-CLICK to ${pv.attack ? "attack" : "move"}${pv.many > 1 ? ` (${pv.many} units spread out)` : ""}`;
    ctx.font = "700 12px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    const tw = ctx.measureText(label).width + 12;
    ctx.fillStyle = "rgba(10,12,16,0.85)"; ctx.fillRect(lx - tw / 2, ly - 34, tw, 18);
    ctx.fillStyle = pv.attack ? "#ff9a8a" : "#ffe9a8"; ctx.fillText(label, lx, ly - 18);
    ctx.restore();
    this.dirty = true;
  }

  drawPaths() {
    const ctx = this.ctx, g = this.g, frac = this.frac || 0;
    const seen = new Set();
    const list = [];
    for (const d of g.divs.values()) {
      if (!d.path.length || d.tag !== g.player) continue;
      const key = d.prov + ":" + d.path.map(s => s.id).join(",");
      if (seen.has(key)) continue; seen.add(key);
      list.push(d);
    }
    list.sort((a, b) => (this.selected.has(a.id) ? 1 : 0) - (this.selected.has(b.id) ? 1 : 0));
    for (const d of list) {
      const sel = this.selected.has(d.id);
      const pts = [g.P[d.prov].c, ...d.path.map(s => g.P[s.id].c)].map(c => this.toScreen(c[0], c[1]));
      const leg = g.legHours(d, d.prov, d.path[0].id, d.path[0].sea);
      const done0 = d.attacking != null ? 0 : Math.max(0, Math.min(1, (d.prog + frac) / leg));
      const fillCol = d.attacking != null ? "#ff5a48" : sel ? "#ffe27a" : "#8be07a";
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
        const len = Math.hypot(bx - ax, by - ay);
        if (len < 4) continue;
        const ux = (bx - ax) / len, uy = (by - ay) / len;
        const gap = Math.min(7, len * 0.15);
        const sx = ax + ux * gap, sy = ay + uy * gap, ex = bx - ux * gap, ey = by - uy * gap;
        const segLen = Math.hypot(ex - sx, ey - sy);
        const head = Math.min(18, segLen * 0.5), shaft = Math.max(0, segLen - head);
        const hx = sx + ux * shaft, hy = sy + uy * shaft;
        const nx = -uy, ny = ux, w = 5.5, hw = 12;
        const arrow = () => {
          ctx.beginPath();
          ctx.moveTo(sx + nx * w, sy + ny * w); ctx.lineTo(hx + nx * w, hy + ny * w); ctx.lineTo(hx + nx * hw, hy + ny * hw);
          ctx.lineTo(ex, ey);
          ctx.lineTo(hx - nx * hw, hy - ny * hw); ctx.lineTo(hx - nx * w, hy - ny * w); ctx.lineTo(sx - nx * w, sy - ny * w); ctx.closePath();
        };
        arrow();
        ctx.fillStyle = "rgba(10,12,16,0.7)"; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = sel ? "#ffe27a" : "rgba(255,255,255,0.9)"; ctx.stroke();
        const f = i === 0 ? done0 : 0;
        if (f > 0) {
          const cut = segLen * f;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(sx - nx * 20, sy - ny * 20); ctx.lineTo(sx + nx * 20, sy + ny * 20);
          ctx.lineTo(sx + ux * cut + nx * 20, sy + uy * cut + ny * 20); ctx.lineTo(sx + ux * cut - nx * 20, sy + uy * cut - ny * 20); ctx.closePath();
          ctx.clip();
          arrow(); ctx.fillStyle = fillCol; ctx.fill();
          ctx.restore();
        }
        if (i === 0 && d.attacking != null) {
          ctx.font = "700 10px Inter, system-ui, sans-serif"; ctx.fillStyle = "#ff6a58"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
          ctx.fillText("ATTACKING", (sx + ex) / 2, (sy + ey) / 2 - 8);
        }
      }
    }
  }

  unitPos(d, frac) {
    const g = this.g, a = g.P[d.prov];
    if (!d.path.length || d.attacking != null) return { x: a.c[0], y: a.c[1], moving: false };
    const b = g.P[d.path[0].id];
    const leg = g.legHours(d, d.prov, b.id, d.path[0].sea);
    const t = Math.max(0, Math.min(1, (d.prog + frac) / leg));
    if (t <= 0.001) return { x: a.c[0], y: a.c[1], moving: false };
    return { x: a.c[0] + (b.c[0] - a.c[0]) * t, y: a.c[1] + (b.c[1] - a.c[1]) * t, moving: true, to: b.id };
  }

  drawUnits() {
    const ctx = this.ctx, g = this.g, s = this.scale;
    this.counterRects = [];
    const showAll = s > 1.9;
    const frac = this.frac || 0;
    const groups = new Map();
    for (const d of g.divs.values()) {
      if (!showAll && d.tag !== g.player && !g.atWar(g.player, d.tag)) continue;
      const pos = this.unitPos(d, frac);
      const key = pos.moving ? `m${d.tag}|${d.type}|${d.prov}|${pos.to}|${Math.round(pos.x / 6)}|${Math.round(pos.y / 6)}` : `s${d.prov}|${d.tag}|${d.type}`;
      let gp = groups.get(key);
      if (!gp) { gp = { tag: d.tag, type: d.type, prov: d.prov, x: pos.x, y: pos.y, moving: pos.moving, ds: [] }; groups.set(key, gp); }
      gp.ds.push(d);
    }
    const byProv = new Map();
    const moving = [];
    for (const gp of groups.values()) {
      if (gp.moving) { moving.push(gp); continue; }
      if (!byProv.has(gp.prov)) byProv.set(gp.prov, []);
      byProv.get(gp.prov).push(gp);
    }
    const rank = t => (t === g.player ? 0 : g.atWar(g.player, t) ? 2 : 1);
    for (const [pid, list] of byProv) {
      const p = g.P[pid];
      const [cx, cy] = this.toScreen(p.c[0], p.c[1]);
      if (cx < -80 || cy < -60 || cx > this.vw + 80 || cy > this.vh + 60) continue;
      list.sort((a, b) => rank(a.tag) - rank(b.tag) || a.tag.localeCompare(b.tag) || UNIT_ORDER.indexOf(a.type) - UNIT_ORDER.indexOf(b.type));
      const perRow = 3, W = this.counterW(), H = 22, GAP = 8;
      const rows = Math.ceil(list.length / perRow);
      list.forEach((gp, i) => {
        const r = Math.floor(i / perRow), col = i % perRow, inRow = Math.min(perRow, list.length - r * perRow);
        const x = cx - (inRow * (W + 2)) / 2 + col * (W + 2), y = cy + 6 + r * (H + GAP) - (rows > 2 ? (rows - 2) * (H + GAP) / 2 : 0);
        this.drawCounter(gp, x, y, W, H);
      });
    }
    for (const gp of moving) {
      const [x, y] = this.toScreen(gp.x, gp.y);
      if (x < -60 || y < -40 || x > this.vw + 60 || y > this.vh + 40) continue;
      const W = this.counterW();
      this.drawCounter(gp, x - W / 2, y - 11, W, 22, true);
    }
    for (const id of this.selected) {
      const d = g.divs.get(id);
      if (!d || d.domain !== "air") continue;
      const p = g.P[d.prov];
      const [x, y] = this.toScreen(p.c[0], p.c[1]);
      ctx.beginPath(); ctx.arc(x, y, AIR_RANGE * s, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(108,200,242,0.6)"; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
      break;
    }
  }

  counterW() { return this.scale > 1.4 ? 50 : 36; }

  drawCounter(gp, x, y, w, h, moving) {
    const ctx = this.ctx, g = this.g;
    const u = UNIT[gp.type];
    const col = hex(COUNTRIES[gp.tag].color);
    const sel = gp.ds.some(d => this.selected.has(d.id));
    const rel = gp.tag === g.player ? "self" : g.relation(g.player, gp.tag);
    ctx.globalAlpha = moving ? 0.92 : 1;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x + 2, y + 2, w, h);
    ctx.fillStyle = rgb(col, 0.85); ctx.fillRect(x, y, w, h);
    ctx.fillStyle = u.color; ctx.fillRect(x, y, 20, h);
    drawUnitIcon(ctx, gp.type, x + 2, y + 3, 16, h - 6, "#111");
    ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.font = "700 12px Inter, system-ui, sans-serif";
    ctx.fillText(String(gp.ds.length), x + 23, y + h / 2);
    const tier = Math.max(...gp.ds.map(d => d.tier || 1));
    if (w >= 50) { ctx.font = "600 9px Inter, system-ui, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.textAlign = "right"; ctx.fillText(u.short, x + w - 3, y + h / 2); }
    const tl = "T" + ROMAN[tier - 1];
    ctx.font = "800 9px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const tw = ctx.measureText(tl).width + 6;
    ctx.fillStyle = "#111"; ctx.fillRect(x - 3, y - 7, tw, 11);
    ctx.strokeStyle = ["#9a9a9a", "#5ec26a", "#5aa8f0", "#b47ae8", "#f0c040"][tier - 1]; ctx.lineWidth = 1; ctx.strokeRect(x - 3, y - 7, tw, 11);
    ctx.fillStyle = ["#e0e0e0", "#8fe08f", "#8fd0ff", "#d9b0ff", "#ffd45a"][tier - 1]; ctx.fillText(tl, x - 3 + tw / 2, y - 1.5);
    ctx.textBaseline = "middle";
    ctx.lineWidth = sel ? 2.5 : 1.2;
    ctx.strokeStyle = sel ? "#ffe27a" : rel === "enemy" ? "#ff4a3d" : rel === "self" ? "#f1f1f1" : rel === "ally" ? "#7fd4ff" : "#222";
    ctx.strokeRect(x, y, w, h);
    const str = gp.ds.reduce((a, d) => a + d.str, 0) / gp.ds.length;
    const org = gp.ds.reduce((a, d) => a + d.org, 0) / gp.ds.length;
    ctx.fillStyle = "#111"; ctx.fillRect(x, y + h, w, u.domain === "land" ? 6 : 4);
    ctx.fillStyle = str > 0.6 ? "#5ed06a" : str > 0.3 ? "#e3b83c" : "#e0533f"; ctx.fillRect(x, y + h, w * Math.max(0, str), 4);
    if (u.domain === "land") { ctx.fillStyle = "#9fc3ff"; ctx.fillRect(x, y + h + 4, w * Math.max(0, org), 2); }
    if (u.domain === "air" && gp.ds.some(d => d.mission != null && g.hourCount - d.mission < 2)) { ctx.fillStyle = "#ff6a4a"; ctx.beginPath(); ctx.arc(x + w - 4, y + 4, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    this.counterRects.push({ x, y, w, h: h + 6, tag: gp.tag, prov: gp.prov, type: gp.type, ids: gp.ds.map(d => d.id) });
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

export function drawUnitIcon(ctx, type, x, y, w, h, color = "#111") {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.5; ctx.lineJoin = "round"; ctx.lineCap = "round";
  const cx = x + w / 2, cy = y + h / 2;
  if (type === "inf" || type === "at" || type === "tank" || type === "arm") {
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.beginPath();
    if (type === "inf") { ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + w - 1, y + h - 1); ctx.moveTo(x + w - 1, y + 1); ctx.lineTo(x + 1, y + h - 1); ctx.stroke(); }
    else if (type === "at") { ctx.moveTo(x + 2, y + h - 1.5); ctx.lineTo(cx, y + 2); ctx.lineTo(x + w - 2, y + h - 1.5); ctx.stroke(); }
    else if (type === "tank") { ctx.ellipse(cx, cy, w * 0.33, h * 0.27, 0, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.ellipse(cx, cy, w * 0.34, h * 0.3, 0, 0, Math.PI * 2); ctx.fill(); }
  } else if (type === "ftr" || type === "bmb") {
    const big = type === "bmb";
    ctx.beginPath();
    ctx.moveTo(cx, y); ctx.lineTo(cx, y + h);
    ctx.moveTo(x + (big ? 0 : 2), cy - (big ? 0 : 1)); ctx.lineTo(x + w - (big ? 0 : 2), cy - (big ? 0 : 1));
    ctx.moveTo(cx - (big ? 4 : 3), y + h - 1); ctx.lineTo(cx + (big ? 4 : 3), y + h - 1);
    ctx.lineWidth = big ? 2.6 : 1.8; ctx.stroke();
    if (big) { ctx.beginPath(); ctx.arc(x + 4, cy + 1.5, 1.3, 0, Math.PI * 2); ctx.arc(x + w - 4, cy + 1.5, 1.3, 0, Math.PI * 2); ctx.fill(); }
  } else if (type === "ship") {
    ctx.beginPath();
    ctx.moveTo(x, cy + 1); ctx.lineTo(x + w, cy + 1); ctx.lineTo(x + w - 3, y + h); ctx.lineTo(x + 3, y + h); ctx.closePath(); ctx.fill();
    ctx.fillRect(cx - 3, cy - 3, 6, 4); ctx.fillRect(cx - 0.75, y, 1.5, h / 2);
  }
  ctx.restore();
}
