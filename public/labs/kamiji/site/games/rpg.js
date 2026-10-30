// Adventure RPG: a town and a cave room, NPC dialogue with a typewriter, a bag of accessories, a 3-move battle, quest log.
let C, S, db, host, ui = {}, off = [], dlg = null, battle = null, mode = "walk", sr;
const COLS = 11, ROWS = 7;
const MAPS = {
  town: ["TTTTTTTTTTT", "T.........T", "T.........T", "T..~~.....T", "T..~~..h..T", "T........DT", "TTTTTTTTTTT"],
  cave: ["###########", "#<..#.....#", "#...#.....#", "#.........#", "#...#.....#", "#.........#", "###########"],
};
const NPCS = { town: [{ id: "elder", name: "Elder Tsuki", x: 3, y: 1, col: "#c9b6ff" }, { id: "merchant", name: "Maru the trader", x: 7, y: 2, col: "#8fd6c4" }], cave: [] };
const ITEMS = { lantern: { name: "Lantern", note: "A warm little lantern. Quest item.", wear: false }, bell: { name: "Bell collar", note: "Jingles when you walk. Worn: +1 damage.", wear: true }, star: { name: "Star clip", note: "A shiny clip. Worn: +2 damage.", wear: true, dmg: 2 }, wizard: { name: "Wizard hat", note: "Pointy and proud. Worn: +3 damage.", wear: true, dmg: 3 } };
const QUESTS = ["Talk to Elder Tsuki in town.", "Find the lantern in the cave (east door).", "Bring the lantern back to the Elder.", "Quest complete! The cave is safe and bright."];
const DEF = () => ({ room: "town", x: 5, y: 4, hp: 20, maxhp: 20, xp: 0, lvl: 1, q: 0, items: [], worn: "", defeated: false, chest: false, met: false });
const save = () => db.set(S);
const need = () => 20 * S.lvl;
const dmgBonus = () => (S.worn ? (ITEMS[S.worn].dmg || 1) : 0);
const tile = (r, x, y) => (MAPS[r][y] || "")[x] || "#";
const solid = (ch) => "T~h#".includes(ch);

function chips() { C.chip("lvl", `Lv ${S.lvl}`); C.chip("hp", `HP ${S.hp}/${S.maxhp}`); C.chip("xp", `XP ${S.xp}/${need()}`); }
function statsBar() { ui.stats.innerHTML = `<span>Lv ${S.lvl}</span><span>HP ${S.hp}/${S.maxhp}</span><div class="g-bar" style="--p:${S.hp / S.maxhp * 100}%;--c:#d65a5a"><i></i></div><span>XP ${S.xp}/${need()}</span><div class="g-bar" style="--p:${S.xp / need() * 100}%;--c:#5a8ad6"><i></i></div>`; chips(); }

function drawRoom() {
  const m = MAPS[S.room];
  ui.grid.innerHTML = m.map((row, y) => [...row].map((ch, x) => `<i class="rp-t rp-${{ T: "tree", "~": "water", h: "house", "#": "wall", ".": "floor", D: "door", "<": "door" }[ch]} ${S.room}" style="grid-column:${x + 1};grid-row:${y + 1}"></i>`).join("")).join("");
  const ents = [...NPCS[S.room].map((n) => ({ ...n, k: "npc" }))];
  if (S.room === "cave") { if (!S.defeated) ents.push({ id: "enemy", name: "Hush blob", x: 7, y: 2, k: "enemy", col: "#6f7a99" }); ents.push({ id: "chest", name: "Chest", x: 8, y: 4, k: "chest", col: "#c58a4e" }); }
  ui.ents = ents;
  ui.layer.innerHTML = ents.map((n) => `<div class="rp-e rp-${n.k}${n.id === "chest" && S.chest ? " open" : ""}" data-e="${n.id}" style="left:${n.x / COLS * 100}%;top:${n.y / ROWS * 100}%;--c:${n.col}"><b></b></div>`).join("") + `<div class="rp-hero" style="left:${S.x / COLS * 100}%;top:${S.y / ROWS * 100}%"><span class="rp-acc" data-acc="${S.worn}"></span></div>`;
  ui.hero = ui.layer.querySelector(".rp-hero");
  host.querySelector(".rp-room").textContent = S.room === "town" ? "Meadow town" : "Hush cave";
}
function placeHero() { ui.hero.style.left = `${S.x / COLS * 100}%`; ui.hero.style.top = `${S.y / ROWS * 100}%`; ui.hero.querySelector(".rp-acc").dataset.acc = S.worn; }

function step(dx, dy) {
  if (mode !== "walk") return;
  const nx = S.x + dx, ny = S.y + dy, ch = tile(S.room, nx, ny);
  const e = ui.ents.find((q) => q.x === nx && q.y === ny);
  if (e) return interact(e);
  if (solid(ch)) { C.sound.beep(120, .05, "square"); return; }
  S.x = nx; S.y = ny; placeHero(); C.sound.beep(260 + ((nx + ny) % 3) * 30, .03);
  if (ch === "D") { S.room = "cave"; S.x = 2; S.y = 1; drawRoom(); C.say("You enter the Hush cave."); C.toast("The cave is quiet..."); }
  else if (ch === "<") { S.room = "town"; S.x = 8; S.y = 5; drawRoom(); C.say("Back in Meadow town."); }
  save();
}

// ---- dialogue (typewriter, like the page's subtitles) ---------------------------------------------------------
function talk(name, lines, done) {
  mode = "talk"; dlg = { name, lines: [...lines], i: 0, pos: 0, full: false, done };
  ui.dlg.hidden = false; ui.dlgName.textContent = name; nextLine();
}
function nextLine() {
  if (dlg.i >= dlg.lines.length) { const d = dlg.done; dlg = null; ui.dlg.hidden = true; mode = "walk"; ui.field.focus(); d && d(); return; }
  const t = dlg.lines[dlg.i]; dlg.pos = 0; dlg.full = C.reduced; ui.dlgText.textContent = C.reduced ? t : ""; sr.textContent = `${dlg.name}: ${t}`;
  ui.dlgNext.textContent = dlg.i === dlg.lines.length - 1 ? "Close" : "Next"; if (C.reduced) dlg.pos = t.length;
}
function advance() { if (!dlg) return; const t = dlg.lines[dlg.i]; if (dlg.pos < t.length) { dlg.pos = t.length; ui.dlgText.textContent = t; dlg.full = true; return; } dlg.i++; nextLine(); }
function typer(dt) { if (!dlg) return; const t = dlg.lines[dlg.i]; if (t && dlg.pos < t.length) { dlg.pos = Math.min(t.length, dlg.pos + dt * 45); ui.dlgText.textContent = t.slice(0, Math.floor(dlg.pos)); if (Math.floor(dlg.pos) % 3 === 0) C.sound.beep(500, .02, "square", .02); } }

function give(id) { if (!S.items.includes(id)) { S.items.push(id); C.toast(`Got: ${ITEMS[id].name}`); C.sound.beep(880, .15); } bag(); }
function interact(e) {
  if (e.id === "elder") {
    if (S.q === 0) talk(e.name, ["Hello, little Kamiji! The cave to the east has gone dark.", "Someone left a lantern there. Could you bring it back?", "Beware the Hush blob, it makes everyone sleepy."], () => { S.q = 1; save(); C.say("Quest started: find the lantern in the cave."); questUI(); });
    else if (S.q === 1) talk(e.name, ["The cave is through the east door. Be brave!"]);
    else if (S.q === 2) talk(e.name, ["The lantern! It glows again. Thank you!", "Please take this hat. It suits you."], () => { S.q = 3; S.xp += 30; give("wizard"); gain(); C.say("Quest complete. Plus 30 XP."); save(); questUI(); });
    else talk(e.name, ["The meadow sleeps easy tonight."]);
  } else if (e.id === "merchant") {
    if (!S.met) talk(e.name, ["Welcome! Here, a bell collar, on the house."], () => { S.met = true; give("bell"); save(); });
    else talk(e.name, ["Come back anytime. Wear your accessories from the bag!"]);
  } else if (e.id === "chest") {
    if (S.chest) { C.toast("The chest is empty."); return; }
    S.chest = true; ui.layer.querySelector('[data-e="chest"]').classList.add("open"); give("lantern");
    if (S.q <= 1) S.q = 2; questUI(); save(); C.say("You found the lantern. Return to the Elder.");
  } else if (e.id === "enemy") startBattle();
}
function gain() { let up = false; while (S.xp >= need()) { S.xp -= need(); S.lvl++; S.maxhp += 4; S.hp = S.maxhp; up = true; } statsBar(); if (up) { C.say(`Level up! You are level ${S.lvl}.`); C.toast(`Level ${S.lvl}!`); } }

// ---- battle ------------------------------------------------------------------------------------------------------------
function startBattle() {
  mode = "battle"; battle = { hp: 18, max: 18, guard: false, en: 6, busy: false };
  ui.bt.hidden = false; battleUI(); blog("A Hush blob blocks the way!"); ui.bt.querySelector("[data-mv='pounce']").focus();
}
function blog(t) { ui.blog.textContent = t; }
function battleUI() {
  ui.bt.querySelector("[data-ehp]").style.setProperty("--p", `${battle.hp / battle.max * 100}%`); ui.bt.querySelector("[data-php]").style.setProperty("--p", `${S.hp / S.maxhp * 100}%`);
  ui.bt.querySelector("[data-pt]").textContent = `You ${S.hp}/${S.maxhp}`; ui.bt.querySelector("[data-et]").textContent = `Hush blob ${battle.hp}/${battle.max}`;
  ui.bt.querySelector("[data-mv='sparkle']").disabled = battle.busy || battle.en < 3; ui.bt.querySelectorAll("[data-mv]").forEach((b) => { if (b.dataset.mv !== "sparkle") b.disabled = battle.busy; });
  ui.bt.querySelector("[data-en]").textContent = `Energy ${battle.en}`; statsBar();
}
function move(mv) {
  if (!battle || battle.busy) return; battle.busy = true; let msg = "";
  const r = (a, b) => Math.floor(C.rnd(a, b + 1));
  if (mv === "pounce") { const d = r(5, 8) + dmgBonus(); battle.hp = Math.max(0, battle.hp - d); msg = `You pounce for ${d}.`; battle.en = Math.min(6, battle.en + 1); }
  else if (mv === "sparkle") { const d = r(9, 12) + dmgBonus(); battle.hp = Math.max(0, battle.hp - d); battle.en -= 3; msg = `Sparkle! ${d} damage.`; }
  else { battle.guard = true; S.hp = Math.min(S.maxhp, S.hp + 2); battle.en = Math.min(6, battle.en + 2); msg = "You brace yourself and recover 2 HP."; }
  C.sound.beep(mv === "sparkle" ? 900 : 400, .1); C.burst(ui.bt, mv === "guard" ? "+2" : "hit", 62, 30);
  blog(msg); battleUI(); C.say(msg);
  if (battle.hp <= 0) return setTimeout(winBattle, C.reduced ? 100 : 500);
  setTimeout(() => {
    if (!battle) return;
    let d = r(3, 6); if (battle.guard) d = Math.ceil(d / 2); battle.guard = false;
    S.hp = Math.max(0, S.hp - d); const m2 = `Hush blob bumps you for ${d}.`; blog(`${msg} ${m2}`); C.say(m2); C.sound.beep(150, .12, "sawtooth");
    battle.busy = false; battleUI();
    if (S.hp <= 0) setTimeout(loseBattle, 500);
  }, C.reduced ? 100 : 650);
}
function winBattle() {
  S.defeated = true; S.xp += 20; battle = null; ui.bt.hidden = true; mode = "walk"; give("star"); gain(); save();
  drawRoom(); C.say("You won! Plus 20 XP. The Hush blob left a star clip."); C.toast("Victory! +20 XP"); statsBar(); ui.field.focus();
}
function loseBattle() {
  battle = null; ui.bt.hidden = true; mode = "walk"; S.hp = S.maxhp; S.room = "town"; S.x = 5; S.y = 4; drawRoom(); statsBar(); save(); C.say("You fainted and woke up in town, fully rested."); C.toast("You rest in town");
}

// ---- bag and quest ----------------------------------------------------------------------------------------------------
function bag() {
  ui.bagList.innerHTML = S.items.length ? S.items.map((id) => `<li><div><b>${ITEMS[id].name}</b><span>${ITEMS[id].note}</span></div>${ITEMS[id].wear ? `<button type="button" class="g-btn sm" data-wear="${id}" aria-pressed="${S.worn === id}">${S.worn === id ? "Worn" : "Wear"}</button>` : ""}</li>`).join("") : "<li><span>Nothing yet. Explore!</span></li>";
  C.chip("bag", `Bag ${S.items.length}`);
}
function questUI() { ui.ql.innerHTML = QUESTS.map((q, i) => `<li class="${i < S.q ? "done" : i === S.q ? "cur" : "later"}"${i === S.q ? ' aria-current="step"' : ""}>${i < S.q ? "&#10003; " : ""}${i <= S.q ? q : "..."}</li>`).join(""); }
function panel(name) { const p = ui[name]; const open = p.hidden; ui.bag.hidden = ui.quest.hidden = true; if (open) { p.hidden = false; p.querySelector("button").focus(); mode = "menu"; } else { mode = "walk"; ui.field.focus(); } }

export function mount(container, ctx) {
  C = ctx; C.css("rpg.css"); db = C.store(); S = db.get(DEF()); if (!Array.isArray(S.items)) S.items = [];
  host = C.h("div", "g-root rp");
  host.innerHTML = `<div class="rp-stats" data-stats></div><span class="rp-room tg-sr"></span>
<div class="rp-field" tabindex="0" role="application" aria-label="Game map. Arrow keys or WASD to walk, walk into people and chests to interact."><div class="rp-grid" data-grid></div><div class="rp-layer" data-layer></div>
 <div class="rp-dlg" hidden><b data-dname></b><p data-dtext></p><button type="button" class="g-btn sm pri" data-dnext>Next</button></div></div>
<div class="rp-bar"><div class="rp-pad" role="group" aria-label="Move"><button type="button" class="g-btn" data-m="-1,0" aria-label="Walk west">&#9664;</button><button type="button" class="g-btn" data-m="0,-1" aria-label="Walk north">&#9650;</button><button type="button" class="g-btn" data-m="0,1" aria-label="Walk south">&#9660;</button><button type="button" class="g-btn" data-m="1,0" aria-label="Walk east">&#9654;</button></div>
 <div class="g-row"><button type="button" class="g-btn" data-panel="quest">Quest</button><button type="button" class="g-btn" data-panel="bag">Bag</button></div></div>
<div class="g-overlay rp-p" data-quest hidden><h4>Quest log</h4><ol class="rp-ql" data-ql></ol><button type="button" class="g-btn pri" data-panel="quest">Close</button></div>
<div class="g-overlay rp-p" data-bag hidden><h4>Bag</h4><ul class="rp-bl" data-bl></ul><button type="button" class="g-btn pri" data-panel="bag">Close</button></div>
<div class="g-overlay rp-bt" hidden role="dialog" aria-label="Battle"><div class="rp-foe" aria-hidden="true"><i></i><i></i><u></u></div><div class="rp-bars"><span data-et></span><div class="g-bar" data-ehp style="--c:#6f7a99"><i></i></div><span data-pt></span><div class="g-bar" data-php style="--c:#d65a5a"><i></i></div><span data-en></span></div><p class="rp-blog" data-blog></p>
 <div class="g-row"><button type="button" class="g-btn pri" data-mv="pounce">Pounce</button><button type="button" class="g-btn" data-mv="guard">Guard</button><button type="button" class="g-btn" data-mv="sparkle">Sparkle (3)</button></div></div>
<p class="tg-sr" role="status" aria-live="polite" data-srl></p>`;
  container.appendChild(host);
  const q = (s) => host.querySelector(s);
  sr = q("[data-srl]");
  ui = { stats: q("[data-stats]"), field: q(".rp-field"), grid: q("[data-grid]"), layer: q("[data-layer]"), dlg: q(".rp-dlg"), dlgName: q("[data-dname]"), dlgText: q("[data-dtext]"), dlgNext: q("[data-dnext]"),
    quest: q("[data-quest]"), bag: q("[data-bag]"), ql: q("[data-ql]"), bagList: q("[data-bl]"), bt: q(".rp-bt"), blog: q("[data-blog]"), ents: [] };
  C.hint("Arrow keys or WASD walk. Bump into the Elder to talk, the chest to open it, the Hush blob to battle. Enter advances dialogue.");
  drawRoom(); statsBar(); bag(); questUI();
  const av = C.avatar({ shape: "sphere" }); av.className += " rp-port"; ui.stats.before(av);
  host.addEventListener("click", (e) => {
    const m = e.target.closest("[data-m]"); if (m) { const [x, y] = m.dataset.m.split(",").map(Number); step(x, y); ui.field.focus(); return; }
    if (e.target.closest("[data-dnext]") || (e.target.closest(".rp-dlg"))) return advance();
    const p = e.target.closest("[data-panel]"); if (p) return panel(p.dataset.panel);
    const mv = e.target.closest("[data-mv]"); if (mv) return move(mv.dataset.mv);
    const w = e.target.closest("[data-wear]"); if (w) { S.worn = S.worn === w.dataset.wear ? "" : w.dataset.wear; placeHero(); bag(); save(); C.say(S.worn ? `You wear the ${ITEMS[S.worn].name}.` : "You take it off."); ui.bagList.querySelector("[data-wear]")?.focus(); }
  });
  host.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") { if (mode === "menu") panel(ui.quest.hidden ? "bag" : "quest"); return; }
    if (mode === "talk" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); advance(); return; }
    if (mode === "walk" && e.target === ui.field) {
      const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }[e.key];
      if (d) { e.preventDefault(); step(...d); } else if (e.key === "q") panel("quest"); else if (e.key === "b") panel("bag");
    }
  });
  off.push(C.loop(typer));
}
export function reset() { S = DEF(); battle = null; dlg = null; mode = "walk"; [ui.dlg, ui.bt, ui.quest, ui.bag].forEach((x) => (x.hidden = true)); drawRoom(); statsBar(); bag(); questUI(); save(); C.say("Adventure reset."); }
export function destroy() { try { db.set(S); } catch (e) { /* ignore */ } off.forEach((f) => f()); off = []; host?.remove(); host = null; battle = null; dlg = null; mode = "walk"; }
