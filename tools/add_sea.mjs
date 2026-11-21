import fs from "node:fs";
import path from "node:path";
import polygonClipping from "polygon-clipping";

const FILE = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname), "../docs/data/map.json");
const map = JSON.parse(fs.readFileSync(FILE));
const W = map.width, H = map.height;
const R = 34;
const provinces = map.provinces;

function ringArea(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); }
function polyArea(p) { return ringArea(p[0]) - p.slice(1).reduce((t, h) => t + ringArea(h), 0); }
function pointInRing(x, y, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function pointInPoly(x, y, poly) { if (!pointInRing(x, y, poly[0])) return false; for (let k = 1; k < poly.length; k++) if (pointInRing(x, y, poly[k])) return false; return true; }
function bboxOfRings(rings) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const r of rings) for (const [x, y] of r) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; }
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - t * dx, py - ay - t * dy); }

const land = [...map.coast, ...provinces.map(p => p.shape).flat()].map(poly => ({ poly, bb: bboxOfRings(poly) }));
const provBB = provinces.map(p => bboxOfRings(p.shape.flat()));

const hexW = Math.sqrt(3) * R, rowH = 1.5 * R;
const hexes = [];
const key = (q, r) => q + "," + r;
const hexIndex = new Map();
for (let row = 0; row * rowH < H + R; row++) for (let col = 0; col * hexW < W + hexW; col++) {
  const cx = col * hexW + (row % 2 ? hexW / 2 : 0), cy = row * rowH;
  const pts = [];
  for (let k = 0; k < 6; k++) { const a = Math.PI / 180 * (60 * k - 30); pts.push([+(cx + R * Math.cos(a)).toFixed(2), +(cy + R * Math.sin(a)).toFixed(2)]); }
  pts.push(pts[0]);
  const h = { col, row, cx, cy, ring: pts, pieces: [] };
  hexIndex.set(key(col, row), h);
  hexes.push(h);
}
const hexArea = ringArea(hexes[0].ring);

for (const h of hexes) {
  const hb = [h.cx - R, h.cy - R, h.cx + R, h.cy + R];
  const near = land.filter(l => l.bb[0] <= hb[2] && l.bb[2] >= hb[0] && l.bb[1] <= hb[3] && l.bb[3] >= hb[1]).map(l => l.poly);
  let water;
  try { water = near.length ? polygonClipping.difference([[h.ring]], ...near) : [[h.ring]]; }
  catch { water = []; }
  for (const poly of water) {
    const a = polyArea(poly);
    if (a < hexArea * 0.14) continue;
    let sx = 0, sy = 0, n = 0;
    for (const [x, y] of poly[0]) { sx += x; sy += y; n++; }
    let c = [sx / n, sy / n];
    if (!pointInPoly(c[0], c[1], poly)) {
      let best = null, bd = 1e9;
      for (let gx = -R; gx <= R; gx += 4) for (let gy = -R; gy <= R; gy += 4) { const x = h.cx + gx, y = h.cy + gy; if (pointInPoly(x, y, poly)) { const d = Math.hypot(x - c[0], y - c[1]); if (d < bd) { bd = d; best = [x, y]; } } }
      if (best) c = best;
    }
    h.pieces.push({ poly: poly.map(r => r.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10])), c: [Math.round(c[0]), Math.round(c[1])], area: a, hex: h });
  }
}

const seas = [];
let id = provinces.length;
for (const h of hexes) for (const p of h.pieces) { p.id = id++; seas.push(p); }

function neighbors(h) {
  const odd = h.row % 2;
  const d = odd ? [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]] : [[1, 0], [-1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]];
  return d.map(([dc, dr]) => hexIndex.get(key(h.col + dc, h.row + dr))).filter(Boolean);
}
const adj = new Map(seas.map(s => [s.id, new Set()]));
for (const h of hexes) {
  if (!h.pieces.length) continue;
  for (const g of neighbors(h)) {
    if (!g.pieces.length || g.row * 1000 + g.col < h.row * 1000 + h.col) continue;
    let e = null;
    for (let i = 0; i < 6 && !e; i++) for (let j = 0; j < 6 && !e; j++) {
      const a = h.ring[i], b = h.ring[i + 1];
      const c = g.ring[j], d = g.ring[j + 1];
      if (Math.hypot(a[0] - d[0], a[1] - d[1]) < 0.5 && Math.hypot(b[0] - c[0], b[1] - c[1]) < 0.5) e = [a, b];
    }
    if (!e) continue;
    for (const A of h.pieces) for (const B of g.pieces) {
      let ok = false;
      for (let t = 0.1; t <= 0.91 && !ok; t += 0.1) {
        const x = e[0][0] + (e[1][0] - e[0][0]) * t, y = e[0][1] + (e[1][1] - e[0][1]) * t;
        const ax = x + (h.cx - x) * 0.04, ay = y + (h.cy - y) * 0.04, bx = x + (g.cx - x) * 0.04, by = y + (g.cy - y) * 0.04;
        if (pointInPoly(ax, ay, A.poly) && pointInPoly(bx, by, B.poly)) ok = true;
      }
      if (ok) { adj.get(A.id).add(B.id); adj.get(B.id).add(A.id); }
    }
  }
}

const shore = new Map(seas.map(s => [s.id, new Set()]));
for (const s of seas) {
  const bb = bboxOfRings(s.poly);
  const cand = provinces.filter((p, i) => provBB[i][0] <= bb[2] + 3 && provBB[i][2] >= bb[0] - 3 && provBB[i][1] <= bb[3] + 3 && provBB[i][3] >= bb[1] - 3);
  for (const ring of s.poly) for (let k = 0; k < ring.length; k += 1) {
    const [vx, vy] = ring[k];
    for (const p of cand) {
      if (shore.get(s.id).has(p.id)) continue;
      let hit = false;
      for (const poly of p.shape) { for (const r of poly) { for (let i = 0, j = r.length - 1; i < r.length; j = i++) if (segDist(vx, vy, r[j][0], r[j][1], r[i][0], r[i][1]) < 2.2) { hit = true; break; } if (hit) break; } if (hit) break; }
      if (hit) shore.get(s.id).add(p.id);
    }
  }
}

for (const p of provinces) p.shore = [];
for (const s of seas) for (const pid of shore.get(s.id)) provinces[pid].shore.push(s.id);

for (const s of seas) {
  const sh = [...shore.get(s.id)];
  if (sh.length) {
    const big = sh.map(i => provinces[i]).sort((a, b) => (b.vp || 0) - (a.vp || 0) || Math.hypot(a.c[0] - s.c[0], a.c[1] - s.c[1]) - Math.hypot(b.c[0] - s.c[0], b.c[1] - s.c[1]))[0];
    s.name = `Waters off ${big.name}`;
  } else s.name = "Open sea";
}
const nameCount = new Map();
for (const s of seas) { const n = (nameCount.get(s.name) || 0) + 1; nameCount.set(s.name, n); if (n > 1) s.name += ` ${["II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][Math.min(n - 2, 8)]}`; }

map.seas = seas.map(s => ({ id: s.id, name: s.name, c: s.c, shape: [s.poly], adj: [...adj.get(s.id)], shore: [...shore.get(s.id)] }));
fs.writeFileSync(FILE, JSON.stringify(map));
const coastal = provinces.filter(p => p.shore.length).length;
const noShore = provinces.filter(p => p.sea.length && !p.shore.length).map(p => p.name);
console.log("sea tiles", seas.length, "coastal provinces", coastal, "isolated sea tiles", seas.filter(s => !adj.get(s.id).size).length);
console.log("provinces with old sea links but no shore:", noShore.length, noShore.slice(0, 20).join(", "));
console.log("size", (fs.statSync(FILE).size / 1024).toFixed(0) + "KB");
