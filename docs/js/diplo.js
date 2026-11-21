const DAY = 86400000;
const fmtMoney = n => "$" + (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : Math.round(n));

export function installDiplomacy(G) {
  Object.assign(G.prototype, {
    puppetsOf(tag) { return this.alive().filter(c => c.overlord === tag).map(c => c.tag); },

    power(tag) {
      const day = Math.floor(this.hourCount / 24);
      if (this._powDay !== day || this._powRel !== this.relVersion) { this._powDay = day; this._powRel = this.relVersion; this._pow = {}; }
      if (this._pow[tag] != null) return this._pow[tag];
      let s = this.strength(tag);
      for (const c of this.alive()) if (c.tag !== tag && this.relation(tag, c.tag) === "ally") s += this.strength(c.tag) * 0.5;
      return (this._pow[tag] = s + 1);
    },

    lostShare(tag) { const c = this.countries[tag]; return c.vpOwned ? c.vpLost / c.vpOwned : 0; },

    warScore(a, b) {
      const sa = this.strength(a) + 1, sb = this.strength(b) + 1;
      return this.lostShare(b) - this.lostShare(a) + 0.12 * Math.log(sa / sb);
    },

    borderTiles(from, to, max = 6) {
      return this.P.filter(p => p.owner === to && p.adj.some(n => this.P[n].owner === from)).sort((x, y) => y.vp - x.vp).slice(0, max);
    },

    conqueredFrom(a, b) {
      const side = new Set([b, ...this.puppetsOf(b)]);
      return this.P.filter(p => p.owner === a && side.has(p.core) && p.core !== a);
    },

    truce(a, b) { const t = this.countries[a].truces?.[b]; return !!t && t > this.time; },

    threatsTo(tag) {
      const out = new Set(this.enemiesOf(tag));
      for (const c of this.alive()) {
        if (c.tag === tag || this.friendly(tag, c.tag)) continue;
        if (c.wargoals[tag] || (c.justifying && c.justifying.target === tag)) out.add(c.tag);
      }
      return [...out];
    },

    allianceKind(from, to) {
      const fF = this.factionOf(from), fT = this.factionOf(to);
      if (this.friendly(from, to)) return { kind: "none", text: "You are already allies." };
      if (this.atWar(from, to)) return { kind: "none", text: "You are at war." };
      if (this.countries[to].overlord || this.countries[from].overlord) return { kind: "none", text: "Puppets can't make alliances." };
      if (fF && fT) return { kind: "none", text: `You are both already in factions (${fF.name} and ${fT.name}).` };
      if (fT) return { kind: "join", faction: fT, text: `Ask to join the ${fT.name}` };
      if (fF) return { kind: "invite", faction: fF, text: `Invite them into the ${fF.name}` };
      return { kind: "new", text: "Form a new alliance together" };
    },

    aiAccept(type, from, to, terms = {}) {
      const P = this.power(from), Q = this.power(to);
      const C = this.countries[to], F = this.countries[from];
      const ratio = P / Q;
      const no = why => ({ ok: false, why });
      const yes = why => ({ ok: true, why });
      if (type === "alliance") {
        const k = this.allianceKind(from, to);
        if (k.kind === "none") return no(k.text);
        const threats = this.threatsTo(to);
        if (k.kind === "join") {
          const leader = this.countries[k.faction.leader];
          if ([...k.faction.members].some(m => this.atWar(m, from))) return no("They are at war with you or your allies.");
          if (leader.ideology === F.ideology || F.ideology === "neutral" && this.threatsTo(from).length) return yes("They welcome a like-minded ally.");
          if (this.strength(from) > this.strength(leader.tag) * 0.35) return yes("You would be a strong addition.");
          return no(`${leader.name} doesn't trust a ${F.ideology} government.`);
        }
        if (k.kind === "invite") {
          const leader = this.countries[k.faction.leader];
          if ([...k.faction.members].some(m => this.atWar(m, to))) return no("They are at war with your faction.");
          if (C.major && C.ideology !== leader.ideology) return no("A great power won't follow your lead.");
          if (C.ideology === leader.ideology) return yes("Same ideology.");
          if (threats.length && !threats.some(t => k.faction.members.has(t))) return yes("They need protection.");
          if (C.ideology === "neutral" && ratio > 3) return yes("They'd rather be on the strong side.");
          return no("They see no reason to join.");
        }
        if (C.ideology === F.ideology || threats.length) return yes(threats.length ? "They need protection." : "Same ideology.");
        if (ratio > 2 && C.ideology === "neutral") return yes("They'd rather be on the strong side.");
        return no("They see no reason to ally with you.");
      }
      if (this.friendly(from, to)) return no("They won't accept demands from an ally.");
      if (type === "gold") {
        const amt = terms.gold || 0;
        if (amt > C.money * 0.8) return no(`They only have ${fmtMoney(C.money)}.`);
        if (ratio > 2.5) return yes(`Your side is ${ratio.toFixed(1)}× stronger.`);
        return no(`Your side is only ${ratio.toFixed(1)}× stronger (need 2.5×).`);
      }
      if (type === "tiles") {
        const n = (terms.tiles || []).length;
        const share = n / Math.max(1, this.P.filter(p => p.owner === to).length);
        const need = share > 0.3 ? 5 : 3;
        if (C.major && share > 0.1) return no("A great power won't give up that much land.");
        if (ratio > need) return yes(`Your side is ${ratio.toFixed(1)}× stronger.`);
        return no(`Your side is only ${ratio.toFixed(1)}× stronger (need ${need}×).`);
      }
      if (type === "puppet") {
        if (C.major) return no("Great powers never become puppets.");
        if (this.factionOf(to)) return no("Their faction protects them.");
        if (C.overlord) return no("They are already someone's puppet.");
        if (ratio > 6) return yes(`Your side is ${ratio.toFixed(1)}× stronger.`);
        return no(`Your side is only ${ratio.toFixed(1)}× stronger (need 6×).`);
      }
      if (type === "peace") {
        const d = terms.demander === from;
        const ws = d ? this.warScore(from, to) : this.warScore(to, from);
        const war = this.wars.find(w => (w.sides[0].has(from) && w.sides[1].has(to)) || (w.sides[1].has(from) && w.sides[0].has(to)));
        const days = war ? (this.time - war.start) / DAY : 0;
        const payer = d ? C : F;
        let need = -0.06;
        if (terms.keep) need += 0.1 + 0.008 * (terms.keepCount || 0);
        if (terms.gold) need += 0.06 + Math.min(0.2, terms.gold / Math.max(1, payer.money) * 0.15);
        if (terms.puppet) need += 0.4;
        if (days > 365) need -= 0.05;
        if (terms.gold && terms.gold > payer.money) return no(`${payer.name} can't pay ${fmtMoney(terms.gold)}.`);
        if (!terms.keep && !terms.gold && !terms.puppet) {
          const wsThem = this.warScore(to, from);
          if (wsThem > 0.15 && days < 720) return no("They think they are winning.");
          return yes("Both sides are tired of war.");
        }
        if (!d) return yes("They gladly accept your concessions.");
        if (terms.puppet && (C.major || this.factionOf(to)?.leader === to)) return no("They'd rather fight to the end than become a puppet.");
        if (ws >= need) return yes(`War score ${Math.round(ws * 100)} (need ${Math.round(need * 100)}).`);
        return no(`War score ${Math.round(ws * 100)} (need ${Math.round(need * 100)}). Win more battles first.`);
      }
      return no("Unknown proposal.");
    },

    describe(type, from, to, terms = {}) {
      const A = this.countries[from].name, B = this.countries[to].name;
      if (type === "alliance") return `${A} proposes an alliance with ${B} (${this.allianceKind(from, to).text.toLowerCase()}).`;
      if (type === "gold") return `${A} demands ${fmtMoney(terms.gold)} from ${B}.`;
      if (type === "tiles") return `${A} demands ${terms.tiles.length} province${terms.tiles.length > 1 ? "s" : ""} from ${B}: ${terms.tiles.map(i => this.P[i].name).join(", ")}.`;
      if (type === "puppet") return `${A} demands that ${B} become its puppet.`;
      if (type === "peace") {
        const parts = [];
        const winner = this.countries[terms.demander]?.name;
        if (terms.keep) parts.push(`${winner} keeps the land it took`);
        if (terms.gold) parts.push(`${winner} receives ${fmtMoney(terms.gold)}`);
        if (terms.puppet) parts.push(`the loser becomes ${winner}'s puppet`);
        return `${A} offers ${B} peace${parts.length ? ": " + parts.join(", ") : " (white peace: everyone returns what they took)"}.`;
      }
      return `${A} → ${B}: ${type}`;
    },

    propose(type, from, to, terms = {}) {
      if (!this.countries[to].alive || !this.countries[from].alive) return { ok: false, msg: "That country no longer exists." };
      if (type === "tiles") terms.tiles = (terms.tiles || []).filter(i => this.P[i].owner === to);
      if (type === "tiles" && !terms.tiles.length) return { ok: false, msg: "No provinces selected." };
      if (to === this.player) {
        if (this.pending.some(p => p.from === from && p.type === type)) return { ok: false, msg: "Already waiting." };
        this.pending.push({ id: this.nextPendingId++, type, from, to, terms, text: this.describe(type, from, to, terms), time: this.time });
        return { ok: true, pending: true };
      }
      const r = this.aiAccept(type, from, to, terms);
      this.log(`${this.describe(type, from, to, terms)} ${this.countries[to].name} ${r.ok ? "accepted" : "refused"}.`, type === "peace" ? "war" : "diplo", [from, to]);
      if (r.ok) this.execute(type, from, to, terms);
      else this.onRefused(type, from, to);
      return { ok: r.ok, msg: r.why };
    },

    onRefused(type, from, to) {
      if (["gold", "tiles", "puppet"].includes(type) && !this.friendly(from, to)) {
        this.countries[from].wargoals[to] = this.time + 365 * DAY;
        this.log(`${this.countries[from].name} now has a war goal against ${this.countries[to].name} for refusing its demands.`, "justify", [from, to]);
      }
    },

    resolvePending(id, accept) {
      const i = this.pending.findIndex(p => p.id === id);
      if (i < 0) return;
      const p = this.pending.splice(i, 1)[0];
      if (!this.countries[p.from].alive || !this.countries[p.to].alive) return;
      this.log(`${p.text} ${this.countries[p.to].name} ${accept ? "accepted" : "refused"}.`, p.type === "peace" ? "war" : "diplo", [p.from, p.to]);
      if (accept) this.execute(p.type, p.from, p.to, p.terms);
      else this.onRefused(p.type, p.from, p.to);
    },

    execute(type, from, to, terms) {
      if (type === "alliance") {
        const k = this.allianceKind(from, to);
        if (k.kind === "join") this.joinFaction(from, k.faction.id);
        else if (k.kind === "invite") this.joinFaction(to, k.faction.id);
        else if (k.kind === "new") { this.createFaction(from, `${this.countries[from].adj}–${this.countries[to].adj} Alliance`); this.joinFaction(to, this.factionOf(from).id); }
        for (const t of [from, to]) for (const pp of this.puppetsOf(t)) { const f = this.factionOf(t); if (f && !this.factionOf(pp)) this.joinFaction(pp, f.id); }
      } else if (type === "gold") {
        const amt = Math.min(terms.gold, this.countries[to].money);
        this.countries[to].money -= amt; this.countries[from].money += amt;
      } else if (type === "tiles") {
        for (const id of terms.tiles) if (this.P[id].owner === to) this.transferProvince(this.P[id], from);
        this.updateEconomyCache(); this.computeSupply();
      } else if (type === "puppet") {
        this.setPuppet(from, to);
      } else if (type === "peace") {
        this.makePeace(from, to, terms);
      }
      this.rebuildRelations();
      this.mapVersion++;
    },

    setPuppet(o, p) {
      const P = this.countries[p];
      const f = this.factionOf(p);
      if (f) { f.members.delete(p); if (f.leader === p) f.leader = [...f.members][0] || null; this.factions = this.factions.filter(x => x.members.size); }
      P.overlord = o; P.puppetSince = this.time;
      const of = this.factionOf(o);
      if (of) this.joinFaction(p, of.id);
      for (const w of this.wars) {
        const s = w.sides[0].has(o) ? 0 : w.sides[1].has(o) ? 1 : -1;
        if (s >= 0) { w.sides[1 - s].delete(p); w.sides[s].add(p); }
      }
      this.wars = this.wars.filter(w => w.sides[0].size && w.sides[1].size);
      this.rebuildRelations();
      this.log(`${P.name} is now a puppet of ${this.countries[o].name}. It pays a quarter of its income as tribute.`, "major", [o, p]);
    },

    canAnnexPuppet(o, p) { const P = this.countries[p]; return P.alive && P.overlord === o && this.time - (P.puppetSince || 0) >= 180 * DAY; },
    annexPuppet(o, p) { if (!this.canAnnexPuppet(o, p)) return false; this.annex(o, p, true); this.updateEconomyCache(); return true; },
    releasePuppet(o, p) {
      const P = this.countries[p];
      if (P.overlord !== o) return false;
      P.overlord = null;
      const f = this.factionOf(p); if (f) f.members.delete(p);
      this.rebuildRelations();
      this.log(`${this.countries[o].name} released ${P.name} from its control.`, "diplo", [o, p]);
      return true;
    },

    makePeace(a, b, terms) {
      const wars = this.wars.filter(w => (w.sides[0].has(a) && w.sides[1].has(b)) || (w.sides[1].has(a) && w.sides[0].has(b)));
      if (!wars.length) return false;
      const isMain = (t, w, s) => (w.main || []).includes(t) || this.factionOf(t)?.leader === t || [...w.sides[s]].every(x => x === t || this.countries[x].overlord === t);
      let groupA = new Set(), groupB = new Set();
      for (const w of wars) {
        const sa = w.sides[0].has(a) ? 0 : 1, sb = 1 - sa;
        const ma = isMain(a, w, sa), mb = isMain(b, w, sb);
        let leave;
        if (ma && mb) { for (const x of w.sides[sa]) groupA.add(x); for (const x of w.sides[sb]) groupB.add(x); leave = [...w.sides[sa], ...w.sides[sb]]; }
        else if (mb) { groupA.add(a); for (const x of this.puppetsOf(a)) groupA.add(x); for (const x of w.sides[sb]) groupB.add(x); leave = [...groupA]; }
        else { groupB.add(b); for (const x of this.puppetsOf(b)) groupB.add(x); for (const x of w.sides[sa]) groupA.add(x); leave = [...groupB]; }
        for (const x of leave) { w.sides[0].delete(x); w.sides[1].delete(x); }
      }
      this.wars = this.wars.filter(w => w.sides[0].size && w.sides[1].size);
      const demA = groupA.has(terms.demander), demB = groupB.has(terms.demander);
      let ceded = 0, returned = 0;
      for (const p of this.P) {
        if (groupB.has(p.core) && groupA.has(p.owner) && p.core !== p.owner) {
          if (terms.keep && demA) { p.core = p.owner; ceded++; } else { p.owner = p.ctrl = p.core; returned++; }
        } else if (groupA.has(p.core) && groupB.has(p.owner) && p.core !== p.owner) {
          if (terms.keep && demB) { p.core = p.owner; ceded++; } else { p.owner = p.ctrl = p.core; returned++; }
        }
      }
      const winner = terms.demander, loser = winner === a ? b : a;
      if (terms.gold && winner) { const amt = Math.min(terms.gold, this.countries[loser].money); this.countries[loser].money -= amt; this.countries[winner].money += amt; }
      for (const x of groupA) for (const y of groupB) { (this.countries[x].truces ||= {})[y] = this.time + 365 * DAY; (this.countries[y].truces ||= {})[x] = this.time + 365 * DAY; }
      this.rebuildRelations();
      if (terms.puppet && winner && this.countries[loser].alive && !this.countries[loser].major) this.setPuppet(winner, loser);
      this.cleanupAfterPeace();
      this.updateEconomyCache(); this.computeSupply();
      this.mapVersion++;
      this.log(`Peace between ${[...groupA].map(t => this.countries[t].name).join(", ")} and ${[...groupB].map(t => this.countries[t].name).join(", ")}. ${ceded ? ceded + " provinces ceded. " : ""}${returned ? returned + " provinces returned. " : ""}${terms.gold ? fmtMoney(terms.gold) + " paid. " : ""}One-year truce.`, "war", [a, b]);
      return true;
    },
  });
}
