import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { geoConicConformal, geoContains } from "d3-geo";
import { Delaunay } from "d3-delaunay";
import polygonClipping from "polygon-clipping";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const OUT = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname), "../docs/data/map.json");
const W = 2000, H = 1500;
const LON0 = -12, LON1 = 50, LAT0 = 28, LAT1 = 70.5;

let seed = 1936;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const landTopo = require("world-atlas/land-50m.json");
const countriesTopo = require("world-atlas/countries-50m.json");
const landFC = feature(landTopo, landTopo.objects.land);
const land = landFC.features ? landFC.features[0] : landFC;
const countries = feature(countriesTopo, countriesTopo.objects.countries).features;

const frame = { type: "MultiPoint", coordinates: [] };
for (let lon = LON0; lon <= LON1; lon += 2) frame.coordinates.push([lon, LAT0], [lon, LAT1]);
for (let lat = LAT0; lat <= LAT1; lat += 2) frame.coordinates.push([LON0, lat], [LON1, lat]);
const proj = geoConicConformal().rotate([-18, 0]).parallels([38, 62]).fitExtent([[10, 10], [W - 10, H - 10]], frame);

const CITIES = [
  ["Berlin", 13.4, 52.52, 30, "GER"], ["Hamburg", 10.0, 53.55, 10], ["Munich", 11.58, 48.14, 10], ["Cologne", 6.96, 50.94, 10], ["Essen", 7.01, 51.46, 15], ["Frankfurt", 8.68, 50.11, 5], ["Dresden", 13.74, 51.05, 5], ["Breslau", 17.04, 51.11, 5], ["Königsberg", 20.51, 54.71, 5], ["Stettin", 14.55, 53.43, 3], ["Leipzig", 12.37, 51.34, 5], ["Nuremberg", 11.08, 49.45, 3], ["Hanover", 9.73, 52.37, 3], ["Stuttgart", 9.18, 48.78, 3],
  ["Paris", 2.35, 48.86, 30, "FRA"], ["Lyon", 4.84, 45.76, 5], ["Marseille", 5.37, 43.3, 5], ["Bordeaux", -0.58, 44.84, 3], ["Lille", 3.06, 50.63, 5], ["Strasbourg", 7.75, 48.58, 5], ["Nantes", -1.55, 47.22, 3], ["Brest", -4.49, 48.39, 3], ["Toulouse", 1.44, 43.6, 3], ["Dijon", 5.04, 47.32, 2], ["Algiers", 3.06, 36.75, 5], ["Oran", -0.63, 35.7, 2], ["Tunis", 10.18, 36.8, 5], ["Casablanca", -7.59, 33.57, 3], ["Rabat", -6.84, 34.02, 2], ["Damascus", 36.29, 33.51, 3], ["Beirut", 35.5, 33.89, 2],
  ["London", -0.13, 51.51, 30, "ENG"], ["Birmingham", -1.9, 52.49, 10], ["Manchester", -2.24, 53.48, 10], ["Glasgow", -4.25, 55.86, 5], ["Edinburgh", -3.19, 55.95, 3], ["Liverpool", -2.98, 53.41, 5], ["Newcastle", -1.61, 54.98, 3], ["Plymouth", -4.14, 50.38, 2], ["Belfast", -5.93, 54.6, 3], ["Cairo", 31.24, 30.04, 10], ["Alexandria", 29.92, 31.2, 5], ["Suez", 32.55, 29.97, 5], ["Jerusalem", 35.22, 31.77, 3], ["Amman", 35.93, 31.95, 1], ["Valletta", 14.51, 35.9, 3], ["Nicosia", 33.38, 35.19, 2], ["Inverness", -4.22, 57.48, 1],
  ["Rome", 12.5, 41.9, 30, "ITA"], ["Milan", 9.19, 45.46, 10], ["Turin", 7.69, 45.07, 5], ["Naples", 14.27, 40.85, 5], ["Venice", 12.33, 45.44, 3], ["Genoa", 8.93, 44.41, 3], ["Florence", 11.26, 43.77, 3], ["Bari", 16.87, 41.12, 2], ["Palermo", 13.36, 38.12, 3], ["Cagliari", 9.11, 39.22, 2], ["Trieste", 13.78, 45.65, 3], ["Tripoli", 13.19, 32.89, 5], ["Benghazi", 20.07, 32.12, 3], ["Tobruk", 23.96, 32.08, 3], ["Rhodes", 28.22, 36.43, 1],
  ["Moscow", 37.62, 55.76, 40, "SOV"], ["Leningrad", 30.32, 59.94, 20], ["Kiev", 30.52, 50.45, 15], ["Kharkov", 36.23, 49.99, 10], ["Stalingrad", 44.51, 48.71, 10], ["Minsk", 27.56, 53.9, 5], ["Odessa", 30.72, 46.48, 5], ["Sevastopol", 33.52, 44.62, 5], ["Rostov", 39.72, 47.24, 5], ["Smolensk", 32.05, 54.78, 5], ["Gorky", 44.0, 56.33, 5], ["Murmansk", 33.08, 68.97, 3], ["Arkhangelsk", 40.54, 64.54, 2], ["Tbilisi", 44.79, 41.72, 3], ["Baku", 49.87, 40.41, 10], ["Voronezh", 39.2, 51.67, 3], ["Kursk", 36.19, 51.73, 3], ["Dnepropetrovsk", 35.05, 48.46, 5], ["Kazan", 49.11, 55.79, 3], ["Yaroslavl", 39.89, 57.63, 2], ["Vologda", 39.89, 59.22, 1], ["Petrozavodsk", 34.35, 61.79, 1], ["Kirov", 49.67, 58.6, 1], ["Saratov", 46.03, 51.53, 2], ["Maikop", 40.1, 44.61, 3], ["Grozny", 45.69, 43.32, 3], ["Novgorod", 31.27, 58.52, 1], ["Kalinin", 35.91, 56.86, 2], ["Tula", 37.62, 54.19, 3], ["Bryansk", 34.36, 53.24, 2], ["Penza", 45.0, 53.2, 1], ["Kuibyshev", 50.1, 53.2, 3],
  ["Warsaw", 21.01, 52.23, 20, "POL"], ["Kraków", 19.94, 50.06, 5], ["Lwów", 24.03, 49.84, 5], ["Poznań", 16.93, 52.41, 3], ["Wilno", 25.28, 54.69, 3], ["Łódź", 19.46, 51.76, 3], ["Danzig", 18.65, 54.35, 3], ["Brest-Litovsk", 23.69, 52.1, 2], ["Katowice", 19.02, 50.26, 5],
  ["Prague", 14.42, 50.08, 15, "CZE"], ["Brno", 16.61, 49.2, 3], ["Bratislava", 17.11, 48.15, 3], ["Košice", 21.26, 48.72, 2], ["Pilsen", 13.38, 49.75, 3],
  ["Vienna", 16.37, 48.21, 15, "AUS"], ["Graz", 15.44, 47.07, 2], ["Innsbruck", 11.4, 47.27, 2],
  ["Budapest", 19.04, 47.5, 15, "HUN"], ["Debrecen", 21.63, 47.53, 2], ["Szeged", 20.15, 46.25, 2],
  ["Bucharest", 26.1, 44.43, 15, "ROM"], ["Ploiești", 26.02, 44.94, 10], ["Cluj", 23.6, 46.77, 3], ["Iași", 27.6, 47.16, 3], ["Chișinău", 28.86, 47.01, 3], ["Constanța", 28.63, 44.18, 3], ["Timișoara", 21.23, 45.75, 2], ["Czernowitz", 25.94, 48.29, 2],
  ["Belgrade", 20.46, 44.79, 15, "YUG"], ["Zagreb", 15.98, 45.81, 5], ["Sarajevo", 18.41, 43.86, 3], ["Ljubljana", 14.51, 46.06, 3], ["Skopje", 21.43, 41.99, 2], ["Split", 16.44, 43.51, 2], ["Niš", 21.9, 43.32, 1],
  ["Sofia", 23.32, 42.7, 10, "BUL"], ["Varna", 27.91, 43.21, 2], ["Plovdiv", 24.75, 42.14, 2],
  ["Athens", 23.73, 37.98, 10, "GRE"], ["Thessaloniki", 22.94, 40.64, 5], ["Heraklion", 25.14, 35.34, 2], ["Patras", 21.73, 38.25, 1],
  ["Ankara", 32.85, 39.93, 10, "TUR"], ["Istanbul", 28.98, 41.01, 15], ["Izmir", 27.14, 38.42, 5], ["Adana", 35.32, 37.0, 2], ["Erzurum", 41.27, 39.9, 2], ["Trabzon", 39.72, 41.0, 1], ["Konya", 32.48, 37.87, 1],
  ["Madrid", -3.7, 40.42, 15, "SPA"], ["Barcelona", 2.17, 41.39, 10], ["Seville", -5.98, 37.39, 5], ["Valencia", -0.38, 39.47, 5], ["Bilbao", -2.93, 43.26, 5], ["Zaragoza", -0.89, 41.65, 2], ["La Coruña", -8.41, 43.36, 2], ["Tetuán", -5.37, 35.57, 1],
  ["Lisbon", -9.14, 38.72, 10, "POR"], ["Porto", -8.61, 41.15, 3],
  ["Dublin", -6.26, 53.35, 10, "IRE"], ["Cork", -8.47, 51.9, 2],
  ["Brussels", 4.35, 50.85, 15, "BEL"], ["Antwerp", 4.4, 51.22, 5], ["Liège", 5.57, 50.63, 3],
  ["Amsterdam", 4.9, 52.37, 15, "HOL"], ["Rotterdam", 4.48, 51.92, 5],
  ["Luxembourg", 6.13, 49.61, 5, "LUX"],
  ["Bern", 7.45, 46.95, 10, "SWI"], ["Zürich", 8.54, 47.37, 3], ["Geneva", 6.14, 46.2, 2],
  ["Copenhagen", 12.57, 55.68, 10, "DEN"], ["Aarhus", 10.2, 56.16, 2],
  ["Oslo", 10.75, 59.91, 10, "NOR"], ["Bergen", 5.32, 60.39, 3], ["Trondheim", 10.4, 63.43, 2], ["Narvik", 17.43, 68.44, 3],
  ["Stockholm", 18.07, 59.33, 10, "SWE"], ["Gothenburg", 11.97, 57.71, 3], ["Malmö", 13.0, 55.6, 2], ["Kiruna", 20.23, 67.86, 5], ["Sundsvall", 17.31, 62.39, 1],
  ["Helsinki", 24.94, 60.17, 10, "FIN"], ["Viipuri", 28.73, 60.71, 3], ["Turku", 22.27, 60.45, 2], ["Oulu", 25.47, 65.01, 1], ["Petsamo", 31.1, 69.4, 1],
  ["Tallinn", 24.75, 59.44, 5, "EST"], ["Riga", 24.11, 56.95, 5, "LAT"], ["Kaunas", 23.9, 54.9, 5, "LIT"], ["Memel", 21.14, 55.71, 1],
  ["Tirana", 19.82, 41.33, 5, "ALB"],
  ["Baghdad", 44.36, 33.31, 5, "IRQ"], ["Mosul", 43.13, 36.34, 3], ["Basra", 47.78, 30.51, 2],
  ["Tehran", 51.39, 35.69, 5, "PER"], ["Tabriz", 46.29, 38.08, 2],
  ["Riyadh", 46.72, 24.69, 3, "SAU"], ["Ha'il", 41.69, 27.52, 1],
];

const MODERN = {
  Germany: "GER", France: "FRA", "United Kingdom": "ENG", Italy: "ITA", Russia: "SOV", Belarus: "SOV", Ukraine: "SOV", Georgia: "SOV", Armenia: "SOV", Azerbaijan: "SOV", Kazakhstan: "SOV",
  Poland: "POL", Czechia: "CZE", Slovakia: "CZE", Austria: "AUS", Hungary: "HUN", Romania: "ROM", Moldova: "ROM",
  Slovenia: "YUG", Croatia: "YUG", "Bosnia and Herz.": "YUG", Serbia: "YUG", Montenegro: "YUG", Kosovo: "YUG", Macedonia: "YUG", "North Macedonia": "YUG",
  Bulgaria: "BUL", Greece: "GRE", Turkey: "TUR", Spain: "SPA", Portugal: "POR", Ireland: "IRE", Belgium: "BEL", Netherlands: "HOL", Luxembourg: "LUX", Switzerland: "SWI", Liechtenstein: "SWI",
  Denmark: "DEN", Norway: "NOR", Sweden: "SWE", Finland: "FIN", Estonia: "EST", Latvia: "LAT", Lithuania: "LIT", Albania: "ALB",
  Morocco: "FRA", "W. Sahara": "SPA", Algeria: "FRA", Tunisia: "FRA", Libya: "ITA", Egypt: "ENG", Sudan: "ENG", Syria: "FRA", Lebanon: "FRA", Israel: "ENG", Palestine: "ENG", Jordan: "ENG",
  Iraq: "IRQ", Iran: "PER", "Saudi Arabia": "SAU", Kuwait: "ENG", Cyprus: "ENG", "N. Cyprus": "ENG", Malta: "ENG", Andorra: "SPA", Monaco: "FRA", "San Marino": "ITA", Vatican: "ITA",
  Iceland: "DEN", Greenland: "DEN", Mauritania: "FRA", Mali: "FRA", Niger: "FRA", Chad: "FRA", Qatar: "ENG", Bahrain: "ENG", "United Arab Emirates": "ENG", Oman: "ENG", Turkmenistan: "SOV", Uzbekistan: "SOV",
};

function owner1936(modern, lon, lat) {
  let o = MODERN[modern];
  if (!o) return null;
  if (modern === "Poland") {
    if (lon < 15.9) o = "GER";
    else if (lat > 53.25 && lon < 17.4) o = "GER";
    else if (lat > 50.15 && lat < 51.75 && lon < 18.0) o = "GER";
    else if (lat > 53.45 && lon > 19.4 && lon < 22.8) o = "GER";
  }
  if (modern === "Russia" && lon < 23 && lat > 54) o = "GER";
  if (modern === "Lithuania" && lon > 24.9 && lat < 55.4) o = "POL";
  if (modern === "Belarus" && lon < 27.2) o = "POL";
  if (modern === "Ukraine") {
    if (lon < 22.9 + 0 && lat < 48.95 && lat > 47.9 && lon > 22.1) o = "CZE";
    else if (lon < 24.6 && lat < 48.6 && lat > 47.9 && lon >= 22.9) o = "CZE";
    else if (lon < 26.3 && lat > 48.6) o = "POL";
    else if (lon > 24.9 && lon < 27.0 && lat > 47.9 && lat <= 48.6) o = "ROM";
    else if (lon > 28.2 && lon < 30.3 && lat > 45.1 && lat < 46.6) o = "ROM";
  }
  if (modern === "Bulgaria" && lat > 43.35 && lon > 26.4) o = "ROM";
  if ((modern === "Slovenia" && lon < 14.4 && lat < 46.2) || (modern === "Croatia" && lon < 14.6 && lat < 45.6 && lat > 44.8)) o = "ITA";
  if (modern === "Greece" && lon > 26.9 && lat < 37.6) o = "ITA";
  if (modern === "Russia" && lat > 60.4 && lat < 62.2 && lon < 31.6) o = "FIN";
  if (modern === "Russia" && lat > 69 && lon < 31.8) o = "FIN";
  if (modern === "Turkey" && lat < 37.0 && lon > 35.7 && lon < 36.8) o = "FRA";
  if (modern === "Morocco" && lat > 34.85 && lon > -6.1 && lon < -2.0) o = "SPA";
  return o;
}

function modernAt(lon, lat) {
  for (const f of countries) if (geoContains(f, [lon, lat])) return f.properties.name;
  return null;
}

function terrainAt(lon, lat, tag) {
  const box = (a, b, c, d) => lon >= a && lon <= b && lat >= c && lat <= d;
  if (lat < 31.5 && lon > -8) return "desert";
  if (["SAU", "IRQ"].includes(tag) && lat < 35) return "desert";
  if (box(5.8, 16, 45.7, 47.6) || box(-1.8, 2.8, 42.2, 43.2) || box(42, 49, 41, 43.7) || box(5, 11, 60, 70) || box(13, 19, 64, 69)) return "mountain";
  if (box(19, 26.5, 45, 49.3) && !box(20, 24, 46, 47.8)) return "hills";
  if (box(18.5, 23.5, 40.5, 44.5) || box(22, 26, 41.2, 42.5) || box(-6, -1, 36.8, 38.5) || box(13.5, 16.5, 39.5, 42) || box(33, 45, 38, 41.5) || box(-4, 0, 42.5, 43.3)) return "hills";
  if (box(24, 30.5, 51.3, 52.6)) return "marsh";
  if (lat > 58.5 && lon > 12) return "forest";
  if (box(29, 42, 54.5, 58.5)) return "forest";
  return "plains";
}

const PROVINCE_NAMES = new Map();

function ringArea(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); }
function polyArea(p) { return p.reduce((s, poly) => s + ringArea(poly[0]) - poly.slice(1).reduce((t, h) => t + ringArea(h), 0), 0); }
function bboxOf(rings) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const r of rings) for (const [x, y] of r) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; }
function pointInRing(x, y, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function pointInPoly(x, y, poly) { if (!pointInRing(x, y, poly[0])) return false; for (let k = 1; k < poly.length; k++) if (pointInRing(x, y, poly[k])) return false; return true; }

function simplify(ring, tol) {
  if (ring.length < 6) return ring;
  const keep = new Uint8Array(ring.length); keep[0] = keep[ring.length - 1] = 1;
  const st = [[0, ring.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1;
    const [ax, ay] = ring[a], [bx, by] = ring[b]; const dx = bx - ax, dy = by - ay; const L = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * ring[i][0] - dx * ring[i][1] + bx * ay - by * ax) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  const out = ring.filter((_, i) => keep[i]);
  return out.length >= 4 ? out : ring;
}

console.log("projecting land");
const rect = [[[0, 0], [W, 0], [W, H], [0, H], [0, 0]]];
const landPolys = [];
for (const poly of land.geometry.coordinates) {
  const rings = poly.map(r => r.map(c => proj(c)).filter(Boolean));
  const b = bboxOf(rings);
  if (b[2] < 0 || b[3] < 0 || b[0] > W || b[1] > H) continue;
  let clipped;
  try { clipped = polygonClipping.intersection(rings, rect); } catch (e) { continue; }
  for (const p of clipped) {
    const s = p.map(r => simplify(r, 0.6));
    const a = polyArea([s]);
    if (a < 25) continue;
    landPolys.push({ poly: s, bbox: bboxOf(s), area: a });
  }
}
console.log("land polygons", landPolys.length);
const onLand = (x, y) => landPolys.some(l => x >= l.bbox[0] && x <= l.bbox[2] && y >= l.bbox[1] && y <= l.bbox[3] && pointInPoly(x, y, l.poly));

const seeds = [];
const cityAt = [];
for (const c of CITIES) {
  const p = proj([c[1], c[2]]);
  if (!p || p[0] < 0 || p[1] < 0 || p[0] > W || p[1] > H) continue;
  let [x, y] = p;
  if (!onLand(x, y)) {
    let best = null;
    for (let r = 1; r < 25 && !best; r++) for (let a = 0; a < 16; a++) { const tx = x + Math.cos(a / 16 * Math.PI * 2) * r, ty = y + Math.sin(a / 16 * Math.PI * 2) * r; if (onLand(tx, ty)) { best = [tx, ty]; break; } }
    if (!best) continue;
    [x, y] = best;
  }
  seeds.push([x, y]);
  cityAt.push({ name: c[0], vp: c[3], capitalOf: c[4] || null });
}
const cityCount = seeds.length;

function density(lon, lat) {
  if (lat < 31 && lon > -8) return 0.12;
  if (lat < 33 && lon > 34) return 0.15;
  if (lon > 44) return 0.35;
  if (lat > 64) return 0.35;
  if (lon > 38 && lat > 50) return 0.45;
  if (lon > 30 && lat < 38) return 0.4;
  return 1;
}
const MIN_D = 30;
let tries = 0;
while (tries++ < 60000) {
  const x = rand() * W, y = rand() * H;
  if (!onLand(x, y)) continue;
  const ll = proj.invert([x, y]);
  if (rand() > density(ll[0], ll[1])) continue;
  const md = MIN_D / Math.sqrt(density(ll[0], ll[1]));
  let ok = true;
  for (const s of seeds) { const dx = s[0] - x, dy = s[1] - y; if (dx * dx + dy * dy < md * md * (seeds.indexOf(s) < cityCount ? 0.55 : 1)) { ok = false; break; } }
  if (ok) { seeds.push([x, y]); cityAt.push(null); }
}
for (const l of landPolys) {
  if (l.area < 120) continue;
  const has = seeds.some(s => s[0] >= l.bbox[0] && s[0] <= l.bbox[2] && s[1] >= l.bbox[1] && s[1] <= l.bbox[3] && pointInPoly(s[0], s[1], l.poly));
  if (has) continue;
  for (let k = 0; k < 200; k++) { const x = l.bbox[0] + rand() * (l.bbox[2] - l.bbox[0]), y = l.bbox[1] + rand() * (l.bbox[3] - l.bbox[1]); if (pointInPoly(x, y, l.poly)) { seeds.push([x, y]); cityAt.push(null); break; } }
}
console.log("seeds", seeds.length);

const del = Delaunay.from(seeds);
const vor = del.voronoi([0, 0, W, H]);

const provinces = [];
const keepIdx = new Map();
const orphans = [];
const seedLand = [];
for (let i = 0; i < seeds.length; i++) {
  const cell = vor.cellPolygon(i);
  if (!cell) continue;
  const cb = bboxOf([cell]);
  const pieces = [];
  for (let li = 0; li < landPolys.length; li++) {
    const l = landPolys[li];
    if (l.bbox[2] < cb[0] || l.bbox[0] > cb[2] || l.bbox[3] < cb[1] || l.bbox[1] > cb[3]) continue;
    try { for (const pc of polygonClipping.intersection([cell], l.poly)) pieces.push({ pc, li }); } catch (e) {}
  }
  const rounded = pieces.map(({ pc, li }) => ({ li, poly: pc.map(r => simplify(r, 0.5).map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10])) })).filter(o => ringArea(o.poly[0]) > 3);
  const home = rounded.find(o => pointInPoly(seeds[i][0], seeds[i][1], o.poly)) || rounded.sort((a, b) => ringArea(b.poly[0]) - ringArea(a.poly[0]))[0];
  if (!home) continue;
  for (const o of rounded) if (o !== home) orphans.push(o);
  const shape = [home.poly];
  seedLand[provinces.length] = home.li;
  const [x, y] = seeds[i];
  const [lon, lat] = proj.invert([x, y]);
  const modern = modernAt(lon, lat);
  let owner = modern ? owner1936(modern, lon, lat) : null;
  if (!owner) {
    let best = null, bd = 1e9;
    for (const p of provinces) { const d = (p.c[0] - x) ** 2 + (p.c[1] - y) ** 2; if (d < bd) { bd = d; best = p; } }
    owner = best ? best.owner : "SOV";
  }
  keepIdx.set(i, provinces.length);
  const city = cityAt[i];
  provinces.push({ id: provinces.length, owner, c: [Math.round(x), Math.round(y)], shape, terrain: terrainAt(lon, lat, owner), city: city ? city.name : null, vp: city ? city.vp : 0, capital: city && city.capitalOf ? city.capitalOf : null, ll: [Math.round(lon * 100) / 100, Math.round(lat * 100) / 100], area: Math.round(polyArea(shape)) });
}
console.log("provinces", provinces.length, "orphans", orphans.length);
for (const o of orphans) {
  let cx = 0, cy = 0; for (const [x, y] of o.poly[0]) { cx += x; cy += y; } cx /= o.poly[0].length; cy /= o.poly[0].length;
  let best = null, bd = 1e18;
  for (let k = 0; k < provinces.length; k++) { if (seedLand[k] !== o.li) continue; const d = (provinces[k].c[0] - cx) ** 2 + (provinces[k].c[1] - cy) ** 2; if (d < bd) { bd = d; best = provinces[k]; } }
  if (best) { best.shape.push(o.poly); best.area += Math.round(ringArea(o.poly[0])); }
}

for (const p of provinces) {
  if (p.city) continue;
  let best = null, bd = 1e9;
  for (const q of provinces) if (q.city && q.owner === p.owner) { const d = (q.c[0] - p.c[0]) ** 2 + (q.c[1] - p.c[1]) ** 2; if (d < bd) { bd = d; best = q; } }
  const base = best ? best.city : p.owner;
  const n = (PROVINCE_NAMES.get(base) || 0) + 1; PROVINCE_NAMES.set(base, n);
  const dirs = ["North", "South", "East", "West", "Upper", "Lower", "Greater", "Outer"];
  if (best) {
    const dx = p.c[0] - best.c[0], dy = p.c[1] - best.c[1];
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "East" : "West") : (dy > 0 ? "South" : "North");
    p.name = n <= 1 ? `${dir} ${base}` : `${dirs[(n + 3) % dirs.length]} ${base}`;
  } else p.name = `${base} ${n}`;
}
const seenNames = new Map();
for (const p of provinces) {
  if (p.city) { p.name = p.city; continue; }
  const k = p.name; const n = (seenNames.get(k) || 0) + 1; seenNames.set(k, n);
  if (n > 1) p.name = `${k} ${["II", "III", "IV", "V", "VI", "VII", "VIII"][Math.min(n - 2, 6)]}`;
}

function touches(A, B) {
  const pts = new Set();
  for (const poly of A) for (const ring of poly) for (const [x, y] of ring) pts.add(Math.round(x) + "," + Math.round(y));
  let hits = 0;
  for (const poly of B) for (const ring of poly) for (const [x, y] of ring) {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (pts.has((Math.round(x) + dx) + "," + (Math.round(y) + dy))) { hits++; dx = 2; dy = 2; }
    if (hits >= 2) return true;
  }
  return false;
}
const adj = provinces.map(() => new Set());
const sea = provinces.map(() => new Set());
const { halfedges, triangles } = del;
const seen = new Set();
for (let e = 0; e < halfedges.length; e++) {
  const a = triangles[e], b = triangles[e % 3 === 2 ? e - 2 : e + 1];
  const key = a < b ? a + "," + b : b + "," + a;
  if (seen.has(key)) continue; seen.add(key);
  if (!keepIdx.has(a) || !keepIdx.has(b)) continue;
  const pa = keepIdx.get(a), pb = keepIdx.get(b);
  const ca = vor.cellPolygon(a), cb = vor.cellPolygon(b);
  if (!ca || !cb) continue;
  const shared = ca.filter(v => cb.some(w => Math.abs(w[0] - v[0]) < 1e-6 && Math.abs(w[1] - v[1]) < 1e-6));
  let landLink = false;
  if (shared.length >= 2) {
    const [u, v] = shared;
    let near = false;
    for (let t = 0.1; t <= 0.91; t += 0.2) if (onLand(u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t)) { near = true; break; }
    if (near) landLink = touches(provinces[pa].shape, provinces[pb].shape);
  }
  const d = Math.hypot(seeds[a][0] - seeds[b][0], seeds[a][1] - seeds[b][1]);
  if (landLink) { adj[pa].add(pb); adj[pb].add(pa); }
  else if (d < 95) { sea[pa].add(pb); sea[pb].add(pa); }
}
provinces.forEach((p, i) => { p.adj = [...adj[i]]; p.sea = [...sea[i]].filter(j => !adj[i].has(j)); });

const isolated = provinces.filter(p => !p.adj.length && !p.sea.length);
for (const p of isolated) {
  let best = null, bd = 1e9;
  for (const q of provinces) if (q !== p) { const d = Math.hypot(q.c[0] - p.c[0], q.c[1] - p.c[1]); if (d < bd) { bd = d; best = q; } }
  if (best && bd < 220) { p.sea.push(best.id); best.sea.push(p.id); }
}

const coast = landPolys.filter(l => l.area > 25).map(l => l.poly.map(r => r.map(([x, y]) => [Math.round(x), Math.round(y)])));
const out = { width: W, height: H, provinces: provinces.map(({ ll, ...p }) => p), coast };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
const owners = {};
for (const p of provinces) owners[p.owner] = (owners[p.owner] || 0) + 1;
console.log("written", OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + "KB");
console.log(owners);
console.log("isolated after fix", provinces.filter(p => !p.adj.length && !p.sea.length).map(p => p.name));
