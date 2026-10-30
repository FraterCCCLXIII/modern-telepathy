// Pocket Kamiji: a tiny tamagotchi-style demo. No network, no audio. State lives in localStorage only.
const KEY = "kamiji.tama.v1"; // unchanged key: existing saves keep working
const STATS = [
  { id: "hunger", label: "Hunger", icon: "tm-apple", col: "#ff7a59" },
  { id: "joy", label: "Joy", icon: "tm-heart", col: "#ef5d9b" },
  { id: "energy", label: "Energy", icon: "tm-bolt", col: "#f5b800" },
  { id: "clean", label: "Clean", icon: "tm-spark", col: "#4aa8ff" },
];
const KEYS = { hunger: "h", joy: "j", energy: "e", clean: "c" };
const INTERVAL = { h: 27, j: 35, e: 39, c: 31 }; // seconds per point (seeded spread)
const SLEEP_GAIN = 8, DAY_SECS = 120;
const COLORS = [["#ffd23f", "Yellow"], ["#ff7a59", "Coral"], ["#5ec27a", "Green"], ["#4aa8ff", "Blue"], ["#b583ff", "Violet"], ["#ff7eb6", "Pink"]];
const ACTIONS = [
  { id: "feed", n: "Feed", k: "A", key: "1", icon: "tm-b-feed" },
  { id: "play", n: "Play", k: "B", key: "2", icon: "tm-b-play" },
  { id: "sleep", n: "Sleep", k: "C", key: "3", icon: "tm-b-sleep" },
  { id: "clean", n: "Clean", k: "D", key: "4", icon: "tm-b-clean" },
];
const FOODS = ["tm-apple", "tm-cake", "tm-ice"];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v) => Math.max(0, Math.min(5, v));
const fresh = () => ({ h: 4, j: 4, e: 4, c: 4, age: 0, day: 1, asleep: false, color: "#ffd23f", acc: { h: 0, j: 0, e: 0, c: 0, s: 0, a: 0 } });

function load() {
  const d = fresh();
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || "null");
    if (o && typeof o === "object") {
      for (const k of ["h", "j", "e", "c"]) if (Number.isFinite(o[k])) d[k] = clamp(Math.round(o[k]));
      if (Number.isFinite(o.day) && o.day >= 1) d.day = Math.min(999, Math.floor(o.day));
      d.asleep = o.asleep === true;
      if (COLORS.some((c) => c[0] === o.color)) d.color = o.color;
    }
  } catch (e) { /* storage unavailable */ }
  return d;
}

const S = load();
let root, els = {}, avatar = null, fx = null, fxTimer = 0, lastBubble = "", saveT = 0, started = false;

const FOREST = (() => {
  const tree = (x, y, r, fill, d = 0) => `<g class="tm-sw" style="--d:${d}s"><rect x="${x - r * .16}" y="${y - r * .9}" width="${r * .32}" height="${r * 1.1}" rx="${r * .1}" fill="#b98a68"/><circle cx="${x}" cy="${y - r * 1.3}" r="${r}" fill="${fill}"/><circle cx="${x - r * .3}" cy="${y - r * 1.55}" r="${r * .5}" fill="#fff" opacity=".22"/></g>`;
  const bush = (x, y, r, fill) => `<g class="tm-sw" style="--d:${(x % 7) / 3}s"><circle cx="${x - r * .7}" cy="${y}" r="${r * .7}" fill="${fill}"/><circle cx="${x + r * .7}" cy="${y}" r="${r * .75}" fill="${fill}"/><circle cx="${x}" cy="${y - r * .35}" r="${r}" fill="${fill}"/><circle cx="${x - r * .3}" cy="${y - r * .7}" r="${r * .4}" fill="#fff" opacity=".2"/></g>`;
  const flower = (x, y, c) => `<g><path d="M${x} ${y}v6" stroke="#4aa86a" stroke-width="1.2"/><circle cx="${x - 2}" cy="${y}" r="1.7" fill="${c}"/><circle cx="${x + 2}" cy="${y}" r="1.7" fill="${c}"/><circle cx="${x}" cy="${y - 2}" r="1.7" fill="${c}"/><circle cx="${x}" cy="${y + 1.6}" r="1.7" fill="${c}"/><circle cx="${x}" cy="${y}" r="1.3" fill="#ffe27a"/></g>`;
  const shroom = (x, y, s, cap) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-2.2" y="-6" width="4.4" height="7" rx="2" fill="#fff4e0"/><path d="M-7 -5.5c0-5 3.2-7.5 7-7.5s7 2.500 7 7.500z" fill="${cap}"/><circle cx="-2.5" cy="-9" r="1.2" fill="#fff"/><circle cx="2.5" cy="-7.8" r="1" fill="#fff"/></g>`;
  const tuft = (x, y) => `<path d="M${x - 3} ${y}l1.5-6 1.5 6 1.5-7 1.500 7 1.500-5 1 5" fill="none" stroke="#4fae6a" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`;
  const far = [[20, 150, 11, "#b7e4cf"], [52, 152, 13, "#c4e8b4"], [92, 150, 11, "#aadccb"], [186, 151, 12, "#c4e8b4"], [222, 150, 13, "#b7e4cf"], [258, 152, 11, "#aadccb"]]
    .map((t, i) => tree(...t, i * .4)).join("");
  const mid = [[18, 172, 18, "#74c898"], [56, 174, 21, "#f2e08c"], [92, 170, 15, "#8fd68a"], [190, 172, 16, "#5fb98e"], [228, 174, 21, "#8fd68a"], [264, 170, 17, "#f2e08c"]]
    .map((t, i) => tree(...t, i * .5)).join("");
  const stars = [[24, 20], [58, 34], [96, 14], [140, 28], [176, 12], [250, 24], [262, 60], [36, 64], [200, 40], [120, 8], [236, 8], [12, 44]]
    .map(([x, y], i) => `<circle class="tm-star" style="--d:${i * .37}s" cx="${x}" cy="${y}" r="${i % 3 ? 1 : 1.5}" fill="#fffbe0"/>`).join("");
  const flies = [[50, 150], [90, 190], [135, 120], [200, 170], [236, 140], [66, 110], [172, 200], [250, 190]]
    .map(([x, y], i) => `<g class="tm-fly" style="--d:${i * .9}s;--x:${i % 2 ? 9 : -9}px"><circle cx="${x}" cy="${y}" r="5" fill="#fff6a0" opacity=".28"/><circle cx="${x}" cy="${y}" r="1.700" fill="#fffbc4"/></g>`).join("");
  const leaves = [[40, -6], [120, -12], [200, -4], [250, -16]]
    .map(([x, y], i) => `<path class="tm-leaf" style="--d:${i * 2.6}s;--x:${i % 2 ? -34 : 30}px" transform="translate(${x} ${y})" d="M0 0c3-2 6 0 5 4-3 1-6-1-5-4z" fill="${["#9ad66f", "#f2c35a", "#7cc98f", "#f09a6a"][i]}"/>`).join("");
  return `<svg class="tm-forest" viewBox="0 0 280 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
<defs>
<linearGradient id="tm-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9def0"/><stop offset=".6" stop-color="#d9f2e6"/><stop offset="1" stop-color="#fdf1c8"/></linearGradient>
<linearGradient id="tm-gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b4e48e"/><stop offset="1" stop-color="#76c46e"/></linearGradient>
</defs>
<rect width="280" height="250" fill="url(#tm-sky)"/>
<g class="tm-sun"><circle cx="140" cy="30" r="20" fill="#fff6c0" opacity=".55"/><circle cx="140" cy="30" r="12" fill="#ffe27a"/></g>

<g class="tm-cl"><g class="tm-cloud" style="--d:0s"><ellipse cx="60" cy="86" rx="20" ry="8" fill="#fff" opacity=".92"/><ellipse cx="72" cy="80" rx="12" ry="8" fill="#fff" opacity=".92"/><ellipse cx="48" cy="81" rx="9" ry="6" fill="#fff" opacity=".92"/></g>
<g class="tm-cloud" style="--d:-14s"><ellipse cx="200" cy="100" rx="16" ry="6" fill="#fff" opacity=".85"/><ellipse cx="210" cy="95" rx="10" ry="6" fill="#fff" opacity=".85"/></g></g>
<path d="M0 150c30-18 60-20 90-8s60 8 90-4 70-4 100 6v40H0z" fill="#b9e6d3"/>
<path d="M0 160c40-12 80-8 120 0s100 8 160-6v40H0z" fill="#a4dcbf"/>
${far}
${mid}
<path d="M0 176c50-8 100-10 150-6s90 2 130-4v90H0z" fill="url(#tm-gr)"/>
<path d="M118 250c4-24 10-50 16-72h14c6 22 12 48 18 72z" fill="#f3e2b4"/>
<path d="M0 232c40-8 70 6 110 0s70-10 110-2 45 4 60 0v20H0z" fill="#8fd3f0"/>
<path d="M12 238c12-3 22 0 34-2M120 236c14-3 24 1 36-2M210 234c10-2 20 0 30-1" stroke="#fff" stroke-width="1.500" stroke-linecap="round" fill="none" opacity=".75" class="tm-ripple"/>
${bush(12, 190, 16, "#69c28a")}${bush(268, 196, 17, "#7ccd8c")}
<g><rect x="22" y="200" width="54" height="17" rx="8.500" fill="#a97b5a"/><path d="M26 203c8-4 36-4 46 0" stroke="#7fd07f" stroke-width="4" stroke-linecap="round" fill="none"/><ellipse cx="74" cy="208.500" rx="4.500" ry="7.500" fill="#d9b48c"/><ellipse cx="74" cy="208.500" rx="2" ry="3.500" fill="#b98a68"/></g>
${shroom(222, 214, 1, "#ff8a7a")}${shroom(236, 218, .7, "#f6c85f")}
${flower(96, 214, "#ff9ec7")}${flower(112, 224, "#fff")}${flower(172, 218, "#ffb36b")}${flower(254, 206, "#ff9ec7")}${flower(40, 226, "#fff")}
${tuft(150, 226)}${tuft(86, 200)}${tuft(204, 200)}${tuft(60, 192)}
<g class="tm-leaves">${leaves}</g>
<rect class="tm-night" width="280" height="250" fill="#18265a"/>
<g class="tm-stars">${stars}</g>
<g class="tm-moon"><path d="M140 17a13 13 0 1 0 9 22 10.500 10.500 0 0 1-9-22z" fill="#fbf6d8"/></g>
<g class="tm-flies">${flies}</g>
</svg>`;
})();

const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
<symbol id="tm-apple" viewBox="0 0 16 16"><path d="M8 4.5C6 3 2.5 4.200 2.500 8.200c0 3 2 6 3.700 6 .8 0 1.200-.4 1.800-.4s1 .4 1.800.4c1.700 0 3.700-3 3.700-6C13.500 4.200 10 3 8 4.500z" fill="#ef5b5b"/><path d="M8 4.500C8 3 8.600 1.800 10 1.200" stroke="#6b4a2e" stroke-width="1.200" fill="none" stroke-linecap="round"/><path d="M9.300 3c1.200-1.400 2.600-1.100 3-.8-.3 1.300-1.700 1.900-3 .8z" fill="#5ec27a"/></symbol>
<symbol id="tm-heart" viewBox="0 0 16 16"><path d="M8 14C3 10.500 1.500 8 1.500 5.600 1.500 3.700 3 2.500 4.600 2.500c1.400 0 2.600.8 3.400 2 .8-1.200 2-2 3.400-2 1.600 0 3.100 1.200 3.100 3.100 0 2.400-1.500 4.900-6.500 8.400z" fill="#ff6b9d"/><path d="M4 5c.3-.8 1-1.100 1.700-1" stroke="#fff" stroke-width="1.100" stroke-linecap="round" fill="none" opacity=".7"/></symbol>
<symbol id="tm-bolt" viewBox="0 0 16 16"><path d="M9.500 1L3 9h4l-1 6 7-9H9z" fill="#f6b800" stroke="#c98a00" stroke-width=".8" stroke-linejoin="round"/></symbol>
<symbol id="tm-spark" viewBox="0 0 16 16"><path d="M8 1c.6 3.800 2.200 5.400 6 6-3.800.6-5.400 2.200-6 6-.6-3.800-2.200-5.400-6-6 3.800-.6 5.400-2.200 6-6z" fill="#4aa8ff"/><circle cx="13" cy="3" r="1.200" fill="#4aa8ff"/></symbol>
<symbol id="tm-drop" viewBox="0 0 16 16"><path d="M8 1.500C5.500 5 3.500 7 3.500 9.700a4.500 4.500 0 009 0C12.500 7 10.500 5 8 1.500z" fill="#4aa8ff"/><path d="M6 10a2.200 2.200 0 002 2" stroke="#fff" stroke-width="1.200" stroke-linecap="round" fill="none"/></symbol>
<symbol id="tm-ball" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.500" fill="#ff8f6b"/><path d="M2.500 6.500c4 1.500 7 1.500 11 0M3 11.500c3-1.500 7-1.500 10 0" stroke="#fff" stroke-width="1.200" fill="none" opacity=".85"/></symbol>
<symbol id="tm-zzz" viewBox="0 0 16 16"><path d="M2 3h5L2 9h5M9 8h4l-4 5h4" fill="none" stroke="#6b6bd6" stroke-width="1.800" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="tm-sun" viewBox="0 0 16 16"><circle cx="8" cy="8" r="3.500" fill="#f6b800"/><path d="M8 1.500v2M8 12.500v2M1.500 8h2M12.500 8h2M3.400 3.400l1.400 1.400M11.200 11.200l1.400 1.400M3.400 12.600l1.400-1.400M11.200 4.800l1.400-1.400" stroke="#f6b800" stroke-width="1.400" stroke-linecap="round"/></symbol>
<symbol id="tm-star" viewBox="0 0 16 16"><path d="M8 1.500l1.900 4.100 4.500.5-3.300 3 .9 4.400L8 11.300 4 13.500l.9-4.400-3.300-3 4.500-.5z" fill="#ffc93c" stroke="#d99a00" stroke-width=".8" stroke-linejoin="round"/></symbol>
<symbol id="tm-cake" viewBox="0 0 16 16"><path d="M3.500 9h9l-1.300 5.500H4.800z" fill="#e8b27a"/><path d="M3 9c0-2.500 1.800-3.500 3-3.700C6.400 3.400 7.200 2.500 8 2.500s1.600.9 2 2.800c1.200.2 3 1.200 3 3.700z" fill="#ffb3cf"/><circle cx="8" cy="2.400" r="1.300" fill="#ef5b5b"/></symbol>
<symbol id="tm-ice" viewBox="0 0 16 16"><path d="M5 8.500h6L8 15z" fill="#e8b27a"/><circle cx="8" cy="6.500" r="3.200" fill="#ffc7de"/><circle cx="8" cy="4.500" r="2.500" fill="#fff0a8"/></symbol>
<symbol id="tm-b-feed" viewBox="0 0 16 16"><path d="M8 4.500C6 3 2.500 4.200 2.500 8.200c0 3 2 6 3.700 6 .8 0 1.200-.4 1.800-.4s1 .4 1.800.4c1.700 0 3.700-3 3.700-6C13.500 4.200 10 3 8 4.500z" fill="currentColor"/><path d="M8 4.500C8 3 8.600 1.800 10 1.200" stroke="currentColor" stroke-width="1.300" fill="none" stroke-linecap="round"/></symbol>
<symbol id="tm-b-play" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.600"/><path d="M2.500 6.500c4 1.500 7 1.500 11 0M3 11.500c3-1.500 7-1.500 10 0" stroke="currentColor" stroke-width="1.300" fill="none"/></symbol>
<symbol id="tm-b-sleep" viewBox="0 0 16 16"><path d="M12.500 10.500A5.500 5.500 0 015.500 3.500 5.500 5.500 0 1012.500 10.500z" fill="currentColor"/></symbol>
<symbol id="tm-b-clean" viewBox="0 0 16 16"><path d="M7 2c.5 3.200 1.800 4.500 5 5-3.200.5-4.500 1.800-5 5-.5-3.200-1.800-4.500-5-5 3.200-.5 4.500-1.800 5-5z" fill="currentColor"/><path d="M13 10.500c.2 1.200.6 1.600 1.800 1.800-1.200.2-1.600.6-1.800 1.800-.2-1.200-.6-1.600-1.800-1.800 1.200-.2 1.600-.6 1.800-1.800z" fill="currentColor"/></symbol>
</defs></svg>`;

const ic = (id, cls = "") => `<svg class="tm-ic ${cls}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;
const pips = () => Array.from({ length: 5 }, () => "<i></i>").join("");
const statHTML = (s) => `<div class="tm-stat" data-stat="${s.id}" style="--c:${s.col}">${ic(s.icon)}<div class="tm-meter" role="meter" aria-label="${s.label}: 0 of 5" aria-valuemin="0" aria-valuemax="5" aria-valuenow="0" aria-valuetext="0 of 5">${pips()}</div><span class="tm-sr">${s.label}: 0 of 5</span></div>`;

const FACE = `<div class="tm-face" aria-hidden="true"><i class="tm-eye l"></i><i class="tm-eye r"></i><i class="tm-cheek l"></i><i class="tm-cheek r"></i><i class="tm-mouth"></i></div>`;

function build(mount) {
  mount.innerHTML = `${SPRITE}
<div class="tm-wrap">
<div class="tm-device" role="group" aria-label="Pocket Kamiji">
 <i class="tm-cord" aria-hidden="true"></i><i class="tm-hole" aria-hidden="true"></i>
 <div class="tm-bezel"><div class="tm-screen">
  ${FOREST}
  <div class="tm-k"><i class="tm-gshadow"></i><div class="tm-kwrap"><kamiji-avatar size="100%" shape="hand" expression="happy" color="${S.color}" src="../assets/">${FACE}</kamiji-avatar></div></div>
  <div class="tm-food" aria-hidden="true"></div>
  <div class="tm-zz" aria-hidden="true"><b>z</b><b>z</b><b>Z</b></div>
  <div class="tm-bubble" hidden aria-hidden="true"></div>
  <div class="tm-pops" aria-hidden="true"></div>
  <div class="tm-lcd" aria-hidden="true"></div>
  <div class="tm-hud tm-hl">${statHTML(STATS[0])}${statHTML(STATS[1])}</div>
  <div class="tm-hud tm-hr">${statHTML(STATS[2])}${statHTML(STATS[3])}</div>
  <div class="tm-day">${ic("tm-sun")}<span>Day <b data-day>1</b></span></div>
 </div></div>
 <div class="tm-btns">${ACTIONS.map((a, i) => `<div class="tm-bw tm-b${i}"><button type="button" class="tm-btn" data-act="${a.id}" aria-label="${a.n} (button ${a.k}, key ${a.key})"${a.id === "sleep" ? ' aria-pressed="false"' : ""}>${ic(a.icon)}</button><span class="tm-bl" aria-hidden="true">${a.k} <em>${a.n}</em></span></div>`).join("")}</div>
</div>
<div class="tm-ctl"><span class="lbl" id="tm-col-l">Colour</span><div class="swatches" role="group" aria-labelledby="tm-col-l">${COLORS.map((c) => `<button type="button" class="swatch" data-col="${c[0]}" style="background:${c[0]}" aria-label="${c[1]}" aria-pressed="${c[0] === S.color}"></button>`).join("")}</div></div>
<p class="tm-sr" role="status" aria-live="polite" data-live></p>
</div>`;
  root = mount.querySelector(".tm-device");
  els = {
    mount, screen: root.querySelector(".tm-screen"), bubble: root.querySelector(".tm-bubble"), pops: root.querySelector(".tm-pops"),
    food: root.querySelector(".tm-food"), day: root.querySelector("[data-day]"), live: mount.querySelector("[data-live]"),
    kwrap: root.querySelector(".tm-kwrap"), sleepBtn: root.querySelector('[data-act="sleep"]'), mount2: mount,
  };
  avatar = root.querySelector("kamiji-avatar");
}

function say(t) { ctx && ctx.say(t); }

function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ h: S.h, j: S.j, e: S.e, c: S.c, day: S.day, asleep: S.asleep, color: S.color })); } catch (e) { /* ignore */ }
  }, 150);
}

function bubbleKind() {
  if (S.asleep) return "";
  const low = [["h", "tm-apple", "hungry"], ["e", "tm-zzz", "sleepy"], ["j", "tm-ball", "wants to play"], ["c", "tm-drop", "wants a wash"]]
    .filter((x) => S[x[0]] <= 2).sort((a, b) => S[a[0]] - S[b[0]])[0];
  if (low) return low;
  if (S.h >= 4 && S.j >= 4 && S.e >= 4 && S.c >= 4) return ["", "tm-heart", "happy"];
  return "";
}

function look() {
  if (S.asleep) return { x: "sleepy", clip: "Idle", em: "zzz", face: "sleep" };
  if (fx) return fx;
  const m = Math.min(S.h, S.j, S.e, S.c);
  if (S.e <= 1 && m === S.e) return { x: "sleepy", clip: "Idle", em: m === 0 ? "sweat" : "", face: "sleepy" };
  if (m <= 1) return { x: "sad", clip: "Idle", em: m === 0 ? "tear" : "sweat", face: "sad" };
  if (m <= 2) return { x: "sad", clip: "Idle", em: "", face: "sad" };
  if (m >= 4) return { x: "happy", clip: "Idle", em: "", face: "happy" };
  return { x: "neutral", clip: "Idle", em: "", face: "ok" };
}

const STAGES = [[1, "Baby", "sphere", 0.82], [3, "Kid", "sphere", 0.92], [6, "Teen", "cube", 1], [10, "Grown", "hand", 1.06]];
const stageOf = (d) => STAGES.filter((x) => d >= x[0]).pop();
let lastStage = "";
function stageChip(quiet) {
  const st = stageOf(S.day);
  if (st[1] !== lastStage) {
    if (lastStage && !quiet) { say(`Kamiji grew into a ${st[1]}!`); pop("tm-star", st[1]); }
    lastStage = st[1];
  }
  avatar?.setAttribute("shape", st[2]);
  if (els.kwrap) els.kwrap.style.setProperty("--tm-grow", st[3]);
  ctx.chip("stage", `Stage ${st[1]}`);
  ctx.chip("day", `Day ${S.day}`);
}
function render() {
  if (!root) return;
  for (const s of STATS) {
    const v = S[KEYS[s.id]], el = root.querySelector(`[data-stat="${s.id}"]`);
    const m = el.querySelector(".tm-meter"), txt = `${s.label}: ${v} of 5`;
    m.setAttribute("aria-label", txt); m.setAttribute("aria-valuenow", v); m.setAttribute("aria-valuetext", `${v} of 5`);
    el.querySelector(".tm-sr").textContent = txt;
    el.classList.toggle("low", v <= 1);
    [...m.children].forEach((p, i) => p.classList.toggle("on", i < v));
  }
  els.day.textContent = S.day; stageChip(false);
  els.screen.classList.toggle("is-night", S.asleep);
  els.sleepBtn.setAttribute("aria-pressed", String(S.asleep));
  const L = look();
  ctx.chip("mood", `Mood ${L.face === "ok" ? "okay" : L.face}`);
  els.kwrap.dataset.face = L.face;
  if (avatar) {
    avatar.setAttribute("expression", L.x);
    avatar.setAttribute("clip", L.clip);
    if (L.em) avatar.setAttribute("emote", L.em); else avatar.removeAttribute("emote");
  }
  const b = bubbleKind();
  const key = b ? b[2] : "";
  els.bubble.hidden = !b;
  if (b) els.bubble.innerHTML = ic(b[1]);
  if (key !== lastBubble) { lastBubble = key; if (key && started) say(`Kamiji is ${key}`); }
  save();
}

function pop(icon, text) {
  if (!els.pops) return;
  const p = document.createElement("span");
  p.className = "tm-pop";
  p.innerHTML = `${ic(icon)}<b>${text}</b>`;
  p.style.setProperty("--dx", `${(els.pops.children.length % 3 - 1) * 14}px`);
  els.pops.appendChild(p);
  setTimeout(() => p.remove(), 1400);
}

function effect(o, ms = 2400) {
  fx = o; clearTimeout(fxTimer);
  fxTimer = setTimeout(() => { fx = null; render(); }, ms);
}

function food() {
  const f = FOODS[Math.floor(Math.random() * FOODS.length)];
  els.food.innerHTML = ic(f);
  els.food.classList.remove("go"); void els.food.offsetWidth; els.food.classList.add("go");
  setTimeout(() => els.food.classList.remove("go"), 1500);
}

function hop() {
  els.kwrap.classList.remove("hop"); void els.kwrap.offsetWidth; els.kwrap.classList.add("hop");
  setTimeout(() => els.kwrap.classList.remove("hop"), 1300);
}

function wake(announce = true) { if (S.asleep) { S.asleep = false; if (announce) say("Kamiji woke up"); } }

function act(id) {
  if (id === "sleep") {
    if (S.asleep) { wake(); } else { fx = null; S.asleep = true; say("Lights out, Kamiji is sleeping"); }
    render(); return;
  }
  wake(false);
  if (id === "feed") {
    if (S.h >= 5) { say("Kamiji is full"); effect({ x: "happy", clip: "Idle", em: "", face: "happy" }, 1500); render(); return; }
    S.h = clamp(S.h + 2); food(); pop("tm-apple", "+2");
    effect({ x: "excited", clip: "Idle", em: "heart", face: "happy" }); say("You fed Kamiji");
  } else if (id === "play") {
    S.j = clamp(S.j + 2); S.e = clamp(S.e - 1); S.h = clamp(S.h - 1); pop("tm-star", "+2"); hop();
    effect({ x: "excited", clip: S.e % 2 ? "Celebrate" : "Wave", em: "star", face: "happy" }); say("You played with Kamiji");
  } else if (id === "clean") {
    S.c = clamp(S.c + 3); pop("tm-spark", "+3");
    effect({ x: "happy", clip: "Idle", em: "sparkle", face: "happy" }); say("You cleaned Kamiji");
  }
  render();
}

// Game clock: dt in seconds. Asleep: energy refills, hunger slows. No catch-up (callers clamp dt).
function step(dt) {
  const a = S.acc;
  const dec = (k, mult = 1) => { a[k] += dt * mult; while (a[k] >= INTERVAL[k]) { a[k] -= INTERVAL[k]; S[k] = clamp(S[k] - 1); } };
  if (S.asleep) {
    dec("h", .5);
    a.s += dt;
    while (a.s >= SLEEP_GAIN) { a.s -= SLEEP_GAIN; S.e = clamp(S.e + 1); }
    if (S.e >= 5) { S.asleep = false; say("Kamiji woke up rested"); }
  } else { dec("h"); dec("j"); dec("e"); dec("c"); }
  a.a += dt;
  while (a.a >= DAY_SECS) { a.a -= DAY_SECS; S.day = Math.min(999, S.day + 1); }
}

let last = 0;
const fast = /[?&]tamafast=1/.test(location.search) ? 10 : 1;
function tick() {
  const now = performance.now();
  const active = alive && ctx.isActive();
  if (active && last) step(Math.min((now - last) / 1000, 1.2) * fast); // clamp: returning never costs more than ~1 point
  last = active ? now : 0;
  if (active) render();
}
window.__tamaTick = (n = 1) => { for (let i = 0; i < n; i++) step(1); render(); return { ...S }; };
window.__tamaState = () => ({ h: S.h, j: S.j, e: S.e, c: S.c, day: S.day, asleep: S.asleep, color: S.color });
window.__tamaSet = (o) => { Object.assign(S, o); render(); };

function setColor(c) {
  S.color = c;
  avatar?.setAttribute("color", c);
  els.mount.style.setProperty("--tm-color", c);
  els.mount.querySelectorAll("[data-col]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.col === c)));
  save();
}

let timer = 0, booted = false;
async function boot3d() {
  if (booted) return; booted = true;
  try {
    await import("../../packages/kamiji-avatar/kamiji-avatar.js");
    const K = customElements.get("kamiji-avatar");
    if (!K || !K.supported()) { els.kwrap.classList.add("flat"); return; }
    avatar.whenReady?.().catch(() => {});
    avatar.addEventListener("kamiji-error", () => els.kwrap.classList.add("flat"));
    avatar.addEventListener("kamiji-ready", () => { els.kwrap.classList.add("ready"); render(); });
  } catch (e) { els.kwrap.classList.add("flat"); }
}

let ctx = null, ivs = [], alive = false;
export function mount(container, c) {
  ctx = c; alive = true; started = false; lastBubble = ""; fx = null; last = 0;
  Object.assign(S, load());
  build(container);
  setColor(S.color);
  stageChip(true);
  render();
  started = true;
  ctx.hint("Keys 1 to 4 work while the pocket Kamiji has focus: 1 Feed, 2 Play, 3 Sleep, 4 Clean.");
  root.addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (b) act(b.dataset.act); });
  root.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const a = ACTIONS.find((x) => x.key === e.key);
    if (a) { e.preventDefault(); act(a.id); }
  });
  container.addEventListener("click", (e) => {
    const cc = e.target.closest("[data-col]");
    if (cc) { setColor(cc.dataset.col); render(); say(`Kamiji is now ${cc.getAttribute("aria-label").toLowerCase()}`); }
  });
  ivs.push(setInterval(tick, 1000));
  boot3d();
}
export function reset() {
  const col = S.color; Object.assign(S, fresh(), { color: col }); fx = null; stageChip(true); render(); say("Kamiji was reset");
}
export function destroy() {
  alive = false; ivs.forEach(clearInterval); ivs = []; clearTimeout(fxTimer); clearTimeout(saveT);
  try { localStorage.setItem(KEY, JSON.stringify({ h: S.h, j: S.j, e: S.e, c: S.c, day: S.day, asleep: S.asleep, color: S.color })); } catch (e) { /* ignore */ }
  try { avatar?.dispose?.(); } catch (e) { /* ignore */ }
  root = null; els = {}; avatar = null; booted = false;
}
