// Language streak: a path of lessons, a 3-question round, hearts, XP, streak flame and a daily-goal ring.
// Words are the hiragana words of the Kamikin meadow (pond, flower, stone, cloud ...). Local only.
let C, S, db, host, ui = {}, L = null, av = null, avT = 0;
const GOAL = 30, MAXH = 5;
const WORDS = [
  ["いけ", "ike", "pond"], ["はな", "hana", "flower"], ["いし", "ishi", "stone"], ["くも", "kumo", "cloud"], ["ほし", "hoshi", "star"], ["つき", "tsuki", "moon"],
  ["みず", "mizu", "water"], ["ひ", "hi", "fire"], ["き", "ki", "tree"], ["やま", "yama", "mountain"], ["うみ", "umi", "sea"], ["そら", "sora", "sky"],
  ["ねこ", "neko", "cat"], ["いぬ", "inu", "dog"], ["あめ", "ame", "rain"], ["かぜ", "kaze", "wind"], ["きつね", "kitsune", "fox"], ["たまご", "tamago", "egg"],
];
const NODES = ["Pond and flower", "Stone and cloud", "Sky lights", "Water and fire", "Hills and sea", "Animals"].map((t, i) => ({ id: i, title: t, words: [0, 1, 2].map((k) => WORDS[(i * 3 + k) % WORDS.length]) }));
const day = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DEF = () => ({ xp: 0, dayXp: 0, day: day(), streak: 0, last: "", done: [], hearts: MAXH });
const save = () => db.set(S);
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function rollDay() { if (S.day !== day()) { S.day = day(); S.dayXp = 0; const y = new Date(); y.setDate(y.getDate() - 1); if (S.last && S.last !== day() && S.last !== day(y)) S.streak = 0; } }
function chips() { C.chip("streak", `Streak ${S.streak}`); C.chip("xp", `XP ${S.xp}`); C.chip("hearts", `Hearts ${S.hearts}/${MAXH}`); C.chip("goal", `Goal ${Math.min(S.dayXp, GOAL)}/${GOAL}`); }
const flame = '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M8 1.500c.5 3-2.500 4-2.500 7a3 3 0 006 0c0-1.200-.5-2-1-2.600-.1 1-.6 1.400-1.200 1.400C9.600 5.300 8.600 3.400 8 1.500z" fill="#1d1d1b"/></svg>';
const heart = (on) => `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 14C3 10.500 1.500 8 1.500 5.600c0-1.900 1.500-3.100 3.100-3.100 1.400 0 2.600.8 3.400 2 .8-1.200 2-2 3.400-2 1.600 0 3.100 1.200 3.100 3.100 0 2.400-1.500 4.900-6.500 8.400z" fill="${on ? "#1d1d1b" : "none"}" stroke="#1d1d1b" stroke-width="1.200"/></svg>`;
const hearts = () => Array.from({ length: MAXH }, (_, i) => heart(i < S.hearts)).join("");
function ring() {
  const p = Math.min(1, S.dayXp / GOAL), r = 17, c = 2 * Math.PI * r;
  return `<svg viewBox="0 0 44 44" width="44" height="44" role="img" aria-label="Daily goal: ${Math.min(S.dayXp, GOAL)} of ${GOAL} XP"><circle cx="22" cy="22" r="${r}" fill="none" stroke="rgba(29,29,27,.12)" stroke-width="5"/><circle cx="22" cy="22" r="${r}" fill="none" stroke="#1d1d1b" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 22 22)"/><text x="22" y="26" text-anchor="middle" font-size="11" font-weight="700" fill="#1d1d1b">${p >= 1 ? "OK" : Math.round(p * 100) + "%"}</text></svg>`;
}
function react(kind) {
  if (!av) return; clearTimeout(avT);
  const m = { yay: { expression: "excited", clip: "Celebrate", emote: "sparkle" }, no: { expression: "sad", clip: "Idle", emote: "sweat" }, idle: { expression: "happy", clip: "Idle", emote: "" }, win: { expression: "excited", clip: "Celebrate", emote: "star" } }[kind];
  av.set(m); if (kind !== "idle" && kind !== "win") avT = setTimeout(() => react("idle"), 1300);
}

// ---- path ------------------------------------------------------------------------------------------------------
function path() {
  rollDay(); L = null; chips();
  const open = S.done.length;
  ui.body.innerHTML = `<div class="ls-head"><div class="ls-ring" data-ring>${ring()}</div><div class="ls-fl">${flame}<b>${S.streak}</b><span>day streak</span></div><div class="ls-hearts" role="img" aria-label="Hearts ${S.hearts} of ${MAXH}">${hearts()}</div></div>
<div class="ls-path" role="list">${NODES.map((n, i) => {
    const done = S.done.includes(n.id), lock = i > open && !done, cur = i === open;
    return `<div class="ls-row" role="listitem" style="--o:${[0, 1, 2, 1, 0, 1][i % 6]}"><button type="button" class="ls-node${done ? " done" : ""}${cur ? " cur" : ""}" data-node="${i}" ${lock ? "disabled" : ""} aria-label="Lesson ${i + 1}: ${n.title}${done ? ", complete" : lock ? ", locked" : cur ? ", start" : ", replay"}"><span aria-hidden="true">${done ? "&#10003;" : lock ? "&#9679;" : i + 1}</span></button><em>${n.title}</em></div>`;
  }).join("")}</div>`;
  const slot = host.querySelector(".ls-mascot"); if (slot) slot.hidden = false;
  const first = ui.body.querySelector(".ls-node.cur") || ui.body.querySelector(".ls-node:not(:disabled)"); first?.scrollIntoView?.({ block: "nearest" });
  C.hint("Pick the glowing lesson to start. Finish all three questions to keep your streak.");
}

// ---- lesson ---------------------------------------------------------------------------------------------------
function startLesson(i) {
  const n = NODES[i]; S.hearts = MAXH; save(); chips();
  L = { n, i, q: 0, qs: [{ t: "pick", w: n.words[0] }, { t: "match", ws: n.words }, { t: "type", w: n.words[2] }], gained: 0, wrong: 0, solved: false };
  ui.body.innerHTML = `<div class="ls-lh"><button type="button" class="g-btn sm" data-quit aria-label="Quit lesson">&times;</button><div class="g-bar ls-prog" data-prog><i></i></div><div class="ls-hearts" data-h role="img" aria-label="Hearts">${hearts()}</div></div>
<div class="ls-qa"><div class="ls-av" data-av></div><div class="ls-q" data-q></div></div><div class="ls-fb" data-fb role="status" aria-live="polite"></div>`;
  av = C.avatar({ shape: "sphere", expression: "happy" }); ui.body.querySelector("[data-av]").appendChild(av);
  host.querySelector(".ls-mascot").hidden = true;
  question();
}
function hud() { const h = ui.body.querySelector("[data-h]"); if (h) { h.innerHTML = hearts(); h.setAttribute("aria-label", `Hearts ${S.hearts} of ${MAXH}`); } const p = ui.body.querySelector("[data-prog]"); if (p) p.style.setProperty("--p", `${(L.q / 3) * 100}%`); chips(); }
function fb(text, ok, cont) {
  const f = ui.body.querySelector("[data-fb]"); f.className = `ls-fb ${ok == null ? "" : ok ? "ok" : "bad"}`;
  f.innerHTML = `<span>${text}</span>${cont ? '<button type="button" class="g-btn pri" data-next>Continue</button>' : ""}`;
  if (cont) f.querySelector("[data-next]").focus();
}
function question() {
  const q = L.qs[L.q], Q = ui.body.querySelector("[data-q]"); L.solved = false; fb("", null); hud();
  if (q.t === "pick") {
    const opts = shuffle([q.w, ...shuffle(WORDS.filter((w) => w !== q.w)).slice(0, 3)]);
    Q.innerHTML = `<p class="ls-p">What does this word mean?</p><div class="ls-big" lang="ja">${q.w[0]}</div><div class="ls-opts" role="group" aria-label="Choices">${opts.map((o, k) => `<button type="button" class="g-btn ls-opt" data-opt="${o[2]}"><kbd aria-hidden="true">${k + 1}</kbd>${o[2]}</button>`).join("")}</div>`;
    C.hint("Pick the meaning. Keys 1 to 4 also work.");
  } else if (q.t === "match") {
    const a = q.ws, b = shuffle(q.ws); L.sel = null; L.left = a.length;
    Q.innerHTML = `<p class="ls-p">Match the pairs</p><div class="ls-match"><div role="group" aria-label="Japanese">${a.map((w) => `<button type="button" class="g-btn ls-m" data-ja="${w[2]}" lang="ja">${w[0]}</button>`).join("")}</div><div role="group" aria-label="English">${b.map((w) => `<button type="button" class="g-btn ls-m" data-en="${w[2]}">${w[2]}</button>`).join("")}</div></div>`;
    C.hint("Tap a Japanese word, then its meaning.");
  } else {
    Q.innerHTML = `<p class="ls-p">Type the reading in letters (romaji)</p><div class="ls-big" lang="ja">${q.w[0]}</div><p class="ls-mean">means "${q.w[2]}"</p><form class="ls-form" data-form><label class="tg-sr" for="ls-in">Romaji</label><input id="ls-in" class="ls-in" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="text" placeholder="romaji"><button type="submit" class="g-btn pri">Check</button></form>`;
    C.hint("Type how the word is read, for example hana, then Check.");
    setTimeout(() => ui.body.querySelector("#ls-in")?.focus(), 30);
  }
}
function wrong(msg) {
  S.hearts = Math.max(0, S.hearts - 1); L.wrong++; react("no"); C.sound.beep(180, .15, "square"); hud(); save();
  fb(msg, false, false);
  if (S.hearts <= 0) setTimeout(outOfHearts, 700);
}
function right(extra = "") {
  if (L.solved) return; L.solved = true; L.gained += 10; S.xp += 10; S.dayXp += 10; react("yay"); C.sound.beep(740, .1); C.burst(ui.body, "+10 XP", 70, 22); save();
  const last = L.q === 2; L.q++; hud();
  fb(`${["Nice!", "Great!", "Perfect!"][L.q - 1]} +10 XP ${extra}`, true, true); C.say(`Correct. Plus 10 XP. ${S.xp} XP total.`);
  if (last) ui.body.querySelector("[data-next]").textContent = "Finish";
}
function finish() {
  const bonus = L.wrong === 0 ? 5 : 0; S.xp += bonus; S.dayXp += bonus; L.gained += bonus;
  const t = day(), y = new Date(); y.setDate(y.getDate() - 1);
  if (S.last !== t) { S.streak = S.last === day(y) ? S.streak + 1 : 1; S.last = t; }
  if (!S.done.includes(L.n.id)) S.done.push(L.n.id);
  save(); chips(); react("win");
  const first = S.dayXp >= GOAL && S.dayXp - L.gained < GOAL;
  ui.body.querySelector(".ls-qa").innerHTML = `<div class="ls-win"><div class="ls-av big" data-av2></div><h4>Level complete!</h4><p>${L.n.title}</p><ul class="ls-sum"><li><b>+${L.gained}</b> XP${bonus ? " (flawless bonus)" : ""}</li><li><b>${S.streak}</b> day streak</li><li><b>${Math.min(S.dayXp, GOAL)}/${GOAL}</b> daily goal${first ? " reached!" : ""}</li></ul></div>`;
  ui.body.querySelector("[data-av2]").appendChild(av);
  fb("", null, true); ui.body.querySelector("[data-next]").textContent = "Back to the path"; ui.body.querySelector("[data-next]").dataset.next = "home";
  C.say(`Level complete. Plus ${L.gained} XP. Streak ${S.streak} days.${first ? " Daily goal reached." : ""}`);
  C.burst(ui.body, "Level up!", 50, 12); C.hint("Lesson done. Come back tomorrow to keep the streak.");
}
function outOfHearts() {
  if (!L) return;
  ui.body.querySelector(".ls-qa").innerHTML = `<div class="ls-win"><h4>Out of hearts</h4><p>Rest a moment, then try the lesson again. Nothing is lost.</p></div>`;
  fb("", null, true); const b = ui.body.querySelector("[data-next]"); b.textContent = "Try again"; b.dataset.next = "retry"; C.say("Out of hearts. Try the lesson again.");
}

function onClick(e) {
  const t = e.target;
  const nd = t.closest("[data-node]"); if (nd) return startLesson(+nd.dataset.node);
  if (t.closest("[data-quit]")) { path(); return; }
  const nx = t.closest("[data-next]");
  if (nx) { if (nx.dataset.next === "home") { path(); return; } if (nx.dataset.next === "retry") { startLesson(L.i); return; } if (L.q >= 3) return finish(); question(); return; }
  const o = t.closest("[data-opt]");
  if (o && L && !L.solved) {
    if (o.dataset.opt === L.qs[L.q].w[2]) { o.classList.add("ok"); ui.body.querySelectorAll("[data-opt]").forEach((b) => (b.disabled = true)); right(`${L.qs[L.q].w[0]} = ${L.qs[L.q].w[2]}`); }
    else { o.classList.add("bad"); o.disabled = true; wrong("Not quite. Try another."); }
    return;
  }
  const ja = t.closest("[data-ja]"), en = t.closest("[data-en]");
  if (ja && !ja.disabled) { ui.body.querySelectorAll("[data-ja]").forEach((b) => b.classList.remove("sel")); ja.classList.add("sel"); L.sel = ja; return; }
  if (en && !en.disabled && L) {
    if (!L.sel) { C.toast("Pick a Japanese word first"); return; }
    if (L.sel.dataset.ja === en.dataset.en) { L.sel.disabled = true; en.disabled = true; L.sel.classList.replace("sel", "ok"); en.classList.add("ok"); L.sel = null; if (--L.left === 0) right("All pairs matched"); else { C.sound.beep(600, .06); } }
    else { L.sel.classList.remove("sel"); L.sel = null; en.classList.add("bad"); setTimeout(() => en.classList.remove("bad"), 500); wrong("Not a match. Try again."); }
  }
}
function onSubmit(e) {
  const f = e.target.closest("[data-form]"); if (!f) return; e.preventDefault();
  const v = f.querySelector("input").value.trim().toLowerCase(), q = L.qs[L.q];
  if (!v || L.solved) return;
  if (v === q.w[1]) { f.querySelector("input").disabled = true; right(`${q.w[0]} = ${q.w[1]}`); } else wrong(`Not quite. Hint: it starts with "${q.w[1][0]}".`);
}

export function mount(container, ctx) {
  C = ctx; C.css("lang.css"); db = C.store(); S = db.get(DEF()); rollDay();
  host = C.h("div", "g-root ls");
  host.innerHTML = '<div class="ls-body" data-body></div><div class="ls-mascot" aria-hidden="true"></div>';
  container.appendChild(host); ui = { body: host.querySelector("[data-body]") };
  const m = host.querySelector(".ls-mascot"); av = C.avatar({ shape: "sphere", expression: "happy" }); m.appendChild(av);
  host.addEventListener("click", onClick); host.addEventListener("submit", onSubmit);
  host.addEventListener("keydown", (e) => { if (/^[1-4]$/.test(e.key) && L && L.qs[L.q].t === "pick" && !(e.target instanceof HTMLInputElement)) ui.body.querySelectorAll("[data-opt]")[+e.key - 1]?.click(); });
  path();
  C.say("Language streak. Lessons are listed as a path.");
}
export function reset() { S = DEF(); av = null; save(); const m = host.querySelector(".ls-mascot"); m.textContent = ""; av = C.avatar({ shape: "sphere" }); m.appendChild(av); path(); C.say("Progress reset."); }
export function destroy() { clearTimeout(avT); if (S) { try { db.set(S); } catch (e) { /* ignore */ } } host?.remove(); host = null; L = null; av = null; }
