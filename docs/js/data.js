export const START_DATE = Date.UTC(1936, 0, 1);

export const IDEOLOGY = {
  fascist: { name: "Fascist", color: "#6b5a3a" },
  democratic: { name: "Democratic", color: "#3f6fd8" },
  communist: { name: "Communist", color: "#c0392b" },
  neutral: { name: "Non-aligned", color: "#8a8a8a" },
};

export const COUNTRIES = {
  GER: { name: "Germany", adj: "German", color: "#5d5f63", ideology: "fascist", civ: 30, mil: 20, pop: 67, divs: 34, slots: 3, navy: 30, major: true },
  FRA: { name: "France", adj: "French", color: "#3f62c9", ideology: "democratic", civ: 28, mil: 14, pop: 42, divs: 40, slots: 3, navy: 50, major: true },
  ENG: { name: "United Kingdom", adj: "British", color: "#b8433b", ideology: "democratic", civ: 30, mil: 12, pop: 47, divs: 20, slots: 3, navy: 100, major: true },
  ITA: { name: "Italy", adj: "Italian", color: "#3d9a4b", ideology: "fascist", civ: 18, mil: 12, pop: 43, divs: 30, slots: 3, navy: 40, major: true },
  SOV: { name: "Soviet Union", adj: "Soviet", color: "#8f1d24", ideology: "communist", civ: 38, mil: 26, pop: 165, divs: 80, slots: 3, navy: 25, major: true, spirit: { infAtt: -0.25, infDef: -0.2, armAtt: -0.25 } },
  POL: { name: "Poland", adj: "Polish", color: "#d57da0", ideology: "neutral", civ: 10, mil: 5, pop: 34, divs: 28, slots: 2, navy: 3 },
  CZE: { name: "Czechoslovakia", adj: "Czechoslovak", color: "#3fb2c3", ideology: "democratic", civ: 9, mil: 6, pop: 15, divs: 18, slots: 2, navy: 1 },
  AUS: { name: "Austria", adj: "Austrian", color: "#e3d2ad", ideology: "neutral", civ: 4, mil: 1, pop: 7, divs: 6, slots: 2, navy: 1 },
  HUN: { name: "Hungary", adj: "Hungarian", color: "#c38c5a", ideology: "neutral", civ: 4, mil: 2, pop: 9, divs: 8, slots: 2, navy: 1 },
  ROM: { name: "Romania", adj: "Romanian", color: "#e4c23a", ideology: "neutral", civ: 6, mil: 3, pop: 19, divs: 18, slots: 2, navy: 3 },
  YUG: { name: "Yugoslavia", adj: "Yugoslav", color: "#7154b8", ideology: "neutral", civ: 5, mil: 2, pop: 15, divs: 18, slots: 2, navy: 3 },
  BUL: { name: "Bulgaria", adj: "Bulgarian", color: "#6ea573", ideology: "neutral", civ: 3, mil: 1, pop: 6, divs: 8, slots: 2, navy: 1 },
  GRE: { name: "Greece", adj: "Greek", color: "#79b8e6", ideology: "neutral", civ: 4, mil: 1, pop: 7, divs: 10, slots: 2, navy: 6 },
  TUR: { name: "Turkey", adj: "Turkish", color: "#a8895a", ideology: "neutral", civ: 6, mil: 2, pop: 17, divs: 18, slots: 2, navy: 6 },
  SPA: { name: "Spain", adj: "Spanish", color: "#e0ad4a", ideology: "neutral", civ: 8, mil: 3, pop: 25, divs: 16, slots: 2, navy: 10 },
  POR: { name: "Portugal", adj: "Portuguese", color: "#2f7d5b", ideology: "neutral", civ: 3, mil: 1, pop: 7, divs: 5, slots: 2, navy: 5 },
  IRE: { name: "Ireland", adj: "Irish", color: "#7fcf7a", ideology: "democratic", civ: 2, mil: 0, pop: 3, divs: 2, slots: 2, navy: 1 },
  BEL: { name: "Belgium", adj: "Belgian", color: "#c9a52b", ideology: "democratic", civ: 6, mil: 2, pop: 8, divs: 12, slots: 2, navy: 1 },
  HOL: { name: "Netherlands", adj: "Dutch", color: "#ef8a26", ideology: "democratic", civ: 6, mil: 2, pop: 9, divs: 8, slots: 2, navy: 12 },
  LUX: { name: "Luxembourg", adj: "Luxembourgish", color: "#8eb8dd", ideology: "democratic", civ: 1, mil: 0, pop: 0.3, divs: 0, slots: 1, navy: 1 },
  SWI: { name: "Switzerland", adj: "Swiss", color: "#b23c6a", ideology: "democratic", civ: 5, mil: 2, pop: 4, divs: 8, slots: 2, navy: 1 },
  DEN: { name: "Denmark", adj: "Danish", color: "#a8463e", ideology: "democratic", civ: 3, mil: 1, pop: 4, divs: 3, slots: 2, navy: 4 },
  NOR: { name: "Norway", adj: "Norwegian", color: "#8b5b3b", ideology: "democratic", civ: 3, mil: 1, pop: 3, divs: 4, slots: 2, navy: 6 },
  SWE: { name: "Sweden", adj: "Swedish", color: "#3d6cb3", ideology: "democratic", civ: 6, mil: 2, pop: 6, divs: 8, slots: 2, navy: 8 },
  FIN: { name: "Finland", adj: "Finnish", color: "#dfe3ea", ideology: "democratic", civ: 3, mil: 1, pop: 4, divs: 9, slots: 2, navy: 2 },
  EST: { name: "Estonia", adj: "Estonian", color: "#2c5e8a", ideology: "neutral", civ: 1, mil: 0, pop: 1.1, divs: 2, slots: 1, navy: 1 },
  LAT: { name: "Latvia", adj: "Latvian", color: "#8c2d3a", ideology: "neutral", civ: 1, mil: 0, pop: 2, divs: 2, slots: 1, navy: 1 },
  LIT: { name: "Lithuania", adj: "Lithuanian", color: "#c9b73a", ideology: "neutral", civ: 1, mil: 0, pop: 2.5, divs: 3, slots: 1, navy: 1 },
  ALB: { name: "Albania", adj: "Albanian", color: "#6e2a2a", ideology: "neutral", civ: 1, mil: 0, pop: 1, divs: 2, slots: 1, navy: 1 },
  IRQ: { name: "Iraq", adj: "Iraqi", color: "#5a8f3a", ideology: "neutral", civ: 2, mil: 0, pop: 4, divs: 4, slots: 1, navy: 1 },
  PER: { name: "Persia", adj: "Persian", color: "#3aa39a", ideology: "neutral", civ: 3, mil: 1, pop: 15, divs: 6, slots: 1, navy: 1 },
  SAU: { name: "Saudi Arabia", adj: "Saudi", color: "#2e6b3a", ideology: "neutral", civ: 1, mil: 0, pop: 3, divs: 2, slots: 1, navy: 1 },
};

export const FACTIONS = [
  { id: "allies", name: "Allies", leader: "ENG", members: ["ENG", "FRA", "POL", "BEL", "HOL", "LUX", "NOR", "DEN", "GRE", "YUG", "CZE"], color: "#3f6fd8" },
  { id: "axis", name: "Axis", leader: "GER", members: ["GER", "ITA", "HUN", "ROM", "BUL"], color: "#5d5f63" },
  { id: "comintern", name: "Comintern", leader: "SOV", members: ["SOV"], color: "#c0392b" },
];

export const TERRAIN = {
  plains: { name: "Plains", def: 1.0, move: 1.0, armor: 1.0 },
  forest: { name: "Forest", def: 1.25, move: 1.3, armor: 0.7 },
  hills: { name: "Hills", def: 1.3, move: 1.4, armor: 0.8 },
  mountain: { name: "Mountains", def: 1.7, move: 1.9, armor: 0.55 },
  marsh: { name: "Marsh", def: 1.4, move: 1.8, armor: 0.6 },
  desert: { name: "Desert", def: 1.0, move: 1.3, armor: 1.0 },
};

export const UNIT = {
  inf: { name: "Infantry", short: "INF", domain: "land", att: 1.0, def: 1.6, hours: 40, eq: 1000, tanks: 0, planes: 0, mp: 10, money: 250, days: 60, upkeep: 0.4, color: "#a7b0ba", desc: "Cheap, tough defenders." },
  at: { name: "Anti-Tank", short: "AT", domain: "land", att: 0.6, def: 1.9, hours: 44, eq: 900, tanks: 0, planes: 0, mp: 9, money: 300, days: 60, upkeep: 0.5, req: "at1", antiArmor: 0.35, color: "#e8963c", desc: "Defensive. Cuts enemy tank attacks by 35% when defending." },
  tank: { name: "Light Tanks", short: "TNK", domain: "land", att: 2.0, def: 1.1, hours: 20, eq: 300, tanks: 100, planes: 0, mp: 6, money: 450, days: 75, upkeep: 0.8, req: "tank1", armor: true, color: "#8fd46a", desc: "Fast attackers. Weak in rough terrain." },
  arm: { name: "Armored", short: "ARM", domain: "land", att: 3.0, def: 1.6, hours: 26, eq: 400, tanks: 250, planes: 0, mp: 8, money: 700, days: 100, upkeep: 1.2, req: "tank2", armor: true, color: "#3f9a46", desc: "Heavy armored division. The strongest attacker." },
  ftr: { name: "Fighters", short: "FTR", domain: "air", att: 0, def: 0, hours: 8, eq: 0, tanks: 0, planes: 100, mp: 1, money: 400, days: 45, upkeep: 0.6, color: "#6cc8f2", desc: "Win air superiority within range of their airfield." },
  bmb: { name: "Bombers", short: "BMB", domain: "air", att: 0, def: 0, hours: 10, eq: 0, tanks: 0, planes: 150, mp: 2, money: 550, days: 60, upkeep: 0.8, req: "bomber1", color: "#b884ea", desc: "Strengthen your side in nearby battles. Need fighter cover." },
  ship: { name: "Battle Fleet", short: "FLT", domain: "sea", att: 0, def: 0, hours: 12, eq: 1500, tanks: 0, planes: 0, mp: 3, money: 1500, days: 180, upkeep: 2.5, color: "#4a7fd0", desc: "Naval strength for sea invasions. Bombards nearby coastal battles." },
};
export const AIR_RANGE = 170;
export const INCOME_SCALE = 2400;
export const COST_SCALE = 1000;
export const WAR_TAX = 10000;
export const TIER_MULT = [1, 1.2, 1.42, 1.68, 2.0];
export const TIER_COST = [1, 1.2, 1.45, 1.75, 2.1];
export const ROMAN = ["I", "II", "III", "IV", "V"];
export const UNIT_ORDER = ["inf", "at", "tank", "arm", "ftr", "bmb", "ship"];

export const BUILD_BASE = {
  civ: { name: "Civilian Factory", cost: 10800, money: 600 },
  mil: { name: "Military Factory", cost: 7200, money: 600 },
  fort: { name: "Land Fort", cost: 3000, money: 200 },
};
for (const u of Object.values(UNIT)) { u.money *= COST_SCALE; u.upkeep *= COST_SCALE; }
export const BUILD = BUILD_BASE;
for (const b of Object.values(BUILD)) b.money *= COST_SCALE;

export const TECHS = [
  { id: "tools1", name: "Basic Machine Tools", cat: "Industry", year: 1936, days: 120, req: [], fx: { output: 0.1 }, desc: "+10% factory output" },
  { id: "constr1", name: "Construction I", cat: "Industry", year: 1936, days: 120, req: [], fx: { construction: 0.1 }, desc: "+10% construction speed" },
  { id: "tools2", name: "Improved Machine Tools", cat: "Industry", year: 1938, days: 160, req: ["tools1"], fx: { output: 0.1 }, desc: "+10% factory output" },
  { id: "constr2", name: "Construction II", cat: "Industry", year: 1938, days: 160, req: ["constr1"], fx: { construction: 0.1 }, desc: "+10% construction speed" },
  { id: "concind", name: "Concentrated Industry", cat: "Industry", year: 1939, days: 180, req: ["tools2"], fx: { output: 0.15 }, desc: "+15% factory output" },
  { id: "tools3", name: "Advanced Machine Tools", cat: "Industry", year: 1941, days: 200, req: ["concind"], fx: { output: 0.15 }, desc: "+15% factory output" },
  { id: "constr3", name: "Construction III", cat: "Industry", year: 1940, days: 180, req: ["constr2"], fx: { construction: 0.15 }, desc: "+15% construction speed" },
  { id: "infwep1", name: "Infantry Equipment I", cat: "Land", year: 1936, days: 100, req: [], fx: { infAtt: 0.1 }, desc: "+10% infantry attack" },
  { id: "suppwep", name: "Support Weapons", cat: "Land", year: 1937, days: 120, req: ["infwep1"], fx: { infDef: 0.1 }, desc: "+10% infantry defense" },
  { id: "arty1", name: "Artillery", cat: "Land", year: 1936, days: 120, req: [], fx: { infAtt: 0.15 }, desc: "+15% infantry attack" },
  { id: "infwep2", name: "Infantry Equipment II", cat: "Land", year: 1939, days: 160, req: ["infwep1"], fx: { infAtt: 0.1, infDef: 0.1 }, desc: "+10% infantry attack and defense" },
  { id: "at1", name: "Anti-Tank Guns", cat: "Land", year: 1937, days: 130, req: ["arty1"], fx: { antiArmor: 0.15 }, desc: "Unlocks anti-tank divisions. Enemy tanks deal 15% less damage." },
  { id: "arty2", name: "Improved Artillery", cat: "Land", year: 1940, days: 180, req: ["arty1", "suppwep"], fx: { infAtt: 0.15 }, desc: "+15% infantry attack" },
  { id: "infwep3", name: "Infantry Equipment III", cat: "Land", year: 1942, days: 200, req: ["infwep2"], fx: { infAtt: 0.1, infDef: 0.15 }, desc: "+10% attack, +15% defense" },
  { id: "tank1", name: "Light Tanks", cat: "Armor", year: 1936, days: 120, req: [], fx: {}, desc: "Unlocks light tank divisions and tank production." },
  { id: "tank2", name: "Medium Tanks", cat: "Armor", year: 1938, days: 170, req: ["tank1"], fx: { armAtt: 0.15 }, desc: "Unlocks armored divisions. +15% tank attack." },
  { id: "tank3", name: "Heavy Tanks", cat: "Armor", year: 1941, days: 200, req: ["tank2"], fx: { armAtt: 0.2, armDef: 0.3 }, desc: "+20% armor attack, +30% armor defense" },
  { id: "motor", name: "Motorization", cat: "Armor", year: 1937, days: 140, req: ["tank1"], fx: { speed: 0.15 }, desc: "+15% movement speed" },
  { id: "doc_mobile", name: "Mobile Warfare", cat: "Doctrine", year: 1936, days: 150, req: [], fx: { armAtt: 0.15, speed: 0.1 }, desc: "+15% armor attack, +10% speed", group: "doctrine" },
  { id: "doc_fire", name: "Superior Firepower", cat: "Doctrine", year: 1936, days: 150, req: [], fx: { infAtt: 0.1, infDef: 0.1 }, desc: "+10% infantry attack and defense", group: "doctrine" },
  { id: "doc_plan", name: "Grand Battleplan", cat: "Doctrine", year: 1936, days: 150, req: [], fx: { entrench: 0.2, infDef: 0.1 }, desc: "+20% entrenchment, +10% defense", group: "doctrine" },
  { id: "doc_mass", name: "Mass Assault", cat: "Doctrine", year: 1936, days: 150, req: [], fx: { manpower: 0.3, orgRegen: 0.2 }, desc: "+30% manpower, faster recovery", group: "doctrine" },
  { id: "doc2", name: "Combined Arms", cat: "Doctrine", year: 1940, days: 200, req: [], reqAny: ["doc_mobile", "doc_fire", "doc_plan", "doc_mass"], fx: { infAtt: 0.1, armAtt: 0.1 }, desc: "+10% attack for all divisions" },
  { id: "ftr2", name: "Improved Fighters", cat: "Air", year: 1938, days: 150, req: [], fx: { ftr: 0.3 }, desc: "+30% fighter strength" },
  { id: "bomber1", name: "Tactical Bombers", cat: "Air", year: 1936, days: 120, req: [], fx: {}, desc: "Unlocks bomber wings." },
  { id: "cas", name: "Close Air Support", cat: "Air", year: 1939, days: 170, req: ["bomber1"], fx: { bmb: 0.3 }, desc: "+30% bomber effect in battles" },
  { id: "ftr3", name: "Fighter Interceptors", cat: "Air", year: 1941, days: 200, req: ["ftr2"], fx: { ftr: 0.3 }, desc: "+30% fighter strength" },
  { id: "radio", name: "Radio", cat: "Electronics", year: 1937, days: 120, req: [], fx: { orgRegen: 0.25 }, desc: "+25% organization recovery" },
  { id: "logistics", name: "Logistics", cat: "Electronics", year: 1938, days: 150, req: ["radio"], fx: { supply: 1, speed: 0.05 }, desc: "Units out of supply suffer less, +5% speed" },
  { id: "radar", name: "Radar", cat: "Electronics", year: 1940, days: 180, req: ["radio"], fx: { infDef: 0.05, armDef: 0.05 }, desc: "+5% defense" },
];
const TIER_LINES = [
  { type: "inf", cat: "Infantry", name: "Infantry", base: null, years: [1936, 1938, 1940, 1942] },
  { type: "at", cat: "Anti-Tank", name: "Anti-Tank", base: "at1", years: [1938, 1939, 1941, 1943] },
  { type: "tank", cat: "Tanks", name: "Light Tank", base: "tank1", years: [1937, 1939, 1941, 1943] },
  { type: "arm", cat: "Tanks", name: "Armored", base: "tank2", years: [1939, 1940, 1942, 1944] },
  { type: "ftr", cat: "Air Force", name: "Fighter", base: null, years: [1937, 1939, 1941, 1943] },
  { type: "bmb", cat: "Air Force", name: "Bomber", base: "bomber1", years: [1937, 1939, 1941, 1943] },
  { type: "ship", cat: "Navy", name: "Fleet", base: null, years: [1937, 1939, 1941, 1943] },
];
const ROMAN_T = ["I", "II", "III", "IV", "V"];
for (const L of TIER_LINES) {
  for (let t = 2; t <= 5; t++) {
    const prev = t === 2 ? (L.base ? [L.base] : []) : [`${L.type}_t${t - 1}`];
    TECHS.push({ id: `${L.type}_t${t}`, name: `${L.name} ${ROMAN_T[t - 1]}`, cat: L.cat, year: L.years[t - 2], days: 100 + t * 30, req: prev, fx: {}, tier: { type: L.type, t }, desc: `New ${L.name.toLowerCase()} units are trained at tier ${ROMAN_T[t - 1]} (${Math.round([1, 1.2, 1.42, 1.68, 2.0][t - 1] * 100)}% combat power). Older units can be upgraded.` });
  }
}
for (let t = 1; t <= 5; t++) TECHS.push({ id: `housing${t}`, name: `Housing ${ROMAN_T[t - 1]}`, cat: "Housing", year: 1934 + t * 2, days: 90 + t * 30, req: t > 1 ? [`housing${t - 1}`] : [], fx: { manpower: 0.25 }, desc: "+25% manpower growth. Better housing means more recruits every day." });


const G = (id, name, x, y, req, fx, desc, extra = {}) => ({ id, name, x, y, req, fx, desc, ...extra });

export const GENERIC_FOCUS = [
  G("army", "Army Effort", 0, 0, [], { research: "infwep1", pp: 0 }, "Grants progress toward Infantry Equipment I and +5% infantry attack.", { bonus: { infAtt: 0.05 } }),
  G("equip", "Equipment Effort", 0, 1, ["army"], { mil: 1 }, "+1 military factory and +10% factory output.", { bonus: { output: 0.1 } }),
  G("doctrine", "Doctrine Effort", 0, 2, ["equip"], {}, "+10% infantry and armor attack.", { bonus: { infAtt: 0.1, armAtt: 0.1 } }),
  G("industry", "Industrial Effort", 2, 0, [], { civ: 1 }, "+1 civilian factory, +10% construction speed.", { bonus: { construction: 0.1 } }),
  G("construction", "Construction Effort", 2, 1, ["industry"], { civ: 2 }, "+2 civilian factories.", {}),
  G("production", "Production Effort", 2, 2, ["construction"], { mil: 2 }, "+2 military factories, +10% factory output.", { bonus: { output: 0.1 } }),
  G("research", "Research Slot", 2, 3, ["production"], { slot: 1 }, "Adds a research slot.", {}),
  G("political", "Political Effort", 4, 0, [], { pp: 120 }, "+120 political power, +0.5 daily political power.", { bonus: { ppGain: 0.5 } }),
  G("conscription", "Conscription Drive", 4, 1, ["political"], { manpower: 80 }, "+80k manpower, +30% manpower growth.", { bonus: { manpower: 0.3 } }),
  G("fortify", "Fortify Borders", 4, 2, ["conscription"], { fortBorders: 2 }, "Builds level 2 forts in all border provinces.", {}),
  G("rearm", "Rearmament", 6, 0, [], { mil: 3 }, "+3 military factories.", {}),
  G("warprop", "War Propaganda", 6, 1, ["rearm"], {}, "Justifying war goals costs 50% less and is twice as fast.", { bonus: { justify: 0.5 } }),
  G("alliance", "Seek Alliance", 6, 2, ["warprop"], { joinFaction: 1 }, "Join the faction that matches our ideology.", {}),
  G("fleet", "Expand the Fleet", 6, 3, ["warprop"], { navy: 30 }, "Launches 3 battle fleets. Sea invasions need a navy at least 90% as strong as the enemy navy.", {}),
];

export const NATIONAL_FOCUS = {
  GER: [
    G("ger_rhine", "Remilitarize the Rhineland", 8, 0, [], { pp: 100 }, "+100 political power, +10% factory output.", { bonus: { output: 0.1 } }),
    G("ger_4year", "Four Year Plan", 8, 1, ["ger_rhine"], { mil: 4, civ: 2 }, "+4 military and +2 civilian factories.", {}),
    G("ger_blitz", "Blitzkrieg Doctrine", 8, 2, ["ger_4year"], {}, "+15% armor attack, +10% speed.", { bonus: { armAtt: 0.15, speed: 0.1 } }),
  ],
  SOV: [
    G("sov_5year", "Second Five-Year Plan", 8, 0, [], { civ: 4 }, "+4 civilian factories.", {}),
    G("sov_3rd", "Third Five-Year Plan", 8, 1, ["sov_5year"], { mil: 5 }, "+5 military factories.", {}),
    G("sov_purge", "Rebuild the Officer Corps", 8, 2, ["sov_3rd"], {}, "Ends the Great Purge penalties, +10% defense, +20% organization recovery.", { bonus: { infAtt: 0.25, infDef: 0.3, armAtt: 0.25, orgRegen: 0.2 } }),
  ],
  ITA: [
    G("ita_empire", "Italian Empire", 8, 0, [], { pp: 80 }, "+80 political power.", {}),
    G("ita_ind", "Autarky", 8, 1, ["ita_empire"], { civ: 2, mil: 2 }, "+2 civilian and +2 military factories.", {}),
    G("ita_alpini", "Alpini Corps", 8, 2, ["ita_ind"], {}, "+15% infantry defense.", { bonus: { infDef: 0.15 } }),
  ],
  ENG: [
    G("eng_rearm", "Rearm the Empire", 8, 0, [], { mil: 3 }, "+3 military factories.", {}),
    G("eng_shadow", "Shadow Factories", 8, 1, ["eng_rearm"], { mil: 3, civ: 1 }, "+3 military and +1 civilian factory.", {}),
    G("eng_navy", "Two-Ocean Navy", 8, 2, ["eng_shadow"], { navy: 40 }, "Launches 4 battle fleets.", {}),
  ],
  FRA: [
    G("fra_maginot", "Maginot Extension", 8, 0, [], { fortBorders: 3 }, "Level 3 forts along all borders.", {}),
    G("fra_arm", "Rearmament Plan", 8, 1, ["fra_maginot"], { mil: 3 }, "+3 military factories.", {}),
    G("fra_doctrine", "Methodical Battle", 8, 2, ["fra_arm"], {}, "+15% infantry defense, +10% entrenchment.", { bonus: { infDef: 0.15, entrench: 0.1 } }),
  ],
};

export const SCHEDULE = [];
