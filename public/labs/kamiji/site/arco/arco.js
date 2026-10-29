// Arco UI page: a tiny card renderer plus a scripted chat demo.
// No AI model and no network. The card specs are shaped after the kosmic-app-cards block types
// (id, type, and the fields of weatherCard, taskCard, statCard, calendarCard, formBlock ...) and are illustrative.
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NS = "http://www.w3.org/2000/svg";
let uid = 0;

// ---------- Kamiji orbs: loaded after first paint; the CSS orb stands in until the WebGL one draws ----------
// Agent avatars are the plain clay Kamiji sphere in the agent's tint; the Arco logo and an avatar that is
// generating a reply use the rainbow plasma (arco-orb.js).
const AGENT_TINT = { Planner: "#ffd23f", Reports: "#4aa8ff", Travel: "#5ec27a" };
const SCRIPT_AGENT = { week: "Planner", sales: "Reports", trip: "Travel" };
let orbMod = null;
const orbQueue = [];
function mountOrb(node, opts) {
  const h = { api: null, speaking: false, dead: false };
  const go = () => { if (!h.dead) h.api = orbMod.createArcoOrb(node, { ...opts, speaking: h.speaking, variant: h.speaking ? "plasma" : opts.variant }); };
  if (orbMod) go(); else orbQueue.push(go);
  return {
    speak(v) { h.speaking = v; if (h.api) { h.api.setPlasma(v || opts.variant === "plasma"); h.api.setSpeaking(v); } },
    destroy() { h.dead = true; h.api?.destroy(); },
  };
}
function loadOrbs() {
  import("./arco-orb.js").then((m) => { orbMod = m; orbQueue.splice(0).forEach((f) => f()); }).catch((err) => console.warn("Arco orbs unavailable", err));
}
{
  const go = () => ("requestIdleCallback" in window ? requestIdleCallback(loadOrbs, { timeout: 2500 }) : setTimeout(loadOrbs, 400));
  if (document.readyState === "complete") go(); else addEventListener("load", go, { once: true });
}
function makeAvatar(agent) {
  const slot = el("span", "av");
  const orb = el("span", "orbi");
  orb.style.setProperty("--tint", AGENT_TINT[agent] || "#ffd23f");
  slot.append(orb);
  return { slot, orb: mountOrb(orb, { variant: "clay", tint: AGENT_TINT[agent] || "#ffd23f", expression: "orb" }) };
}
let avatars = [];
{
  const brand = $(".brand-orb");
  if (brand) mountOrb(brand, { variant: "plasma", expression: "orb" });
}

// ---------- icons ----------
function icon(name) {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("width", "22");
  s.setAttribute("height", "22");
  s.setAttribute("aria-hidden", "true");
  s.setAttribute("fill", "none");
  s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "1.8");
  s.setAttribute("stroke-linecap", "round");
  s.setAttribute("stroke-linejoin", "round");
  const P = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.6-7.9A5.5 5.5 0 0 1 17 9.5a4.2 4.2 0 0 1 .5 8.5z"/>',
    partly: '<circle cx="8" cy="8" r="3"/><path d="M8 2v1.5M2 8h1.5M3.8 3.8l1 1M12.2 3.8l-1 1"/><path d="M9 20a3.5 3.5 0 0 1-.4-7A4.8 4.8 0 0 1 18 12.6 3.7 3.7 0 0 1 17.5 20z"/>',
    rain: '<path d="M7 15a4 4 0 0 1-.6-7.9A5.5 5.5 0 0 1 17 6.5a4.2 4.2 0 0 1 .5 8.5z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
  };
  s.innerHTML = P[name] || P.cloud;
  return s;
}
const condIcon = (c) => (/sun|clear/.test(c) ? "sun" : /partly/.test(c) ? "partly" : /rain|drizzle|storm/.test(c) ? "rain" : "cloud");
const condLabel = (c) => c.replace(/_/g, " ");

// ---------- spec peek ----------
function fmt(spec) {
  return JSON.stringify(spec, null, 2).replace(/\[\s+(-?[\d.]+(?:,\s+-?[\d.]+)*)\s+\]/g, (m, a) => "[" + a.replace(/\s+/g, " ") + "]");
}

// ---------- block bodies: (spec, ctx) -> element ----------
const BODY = {
  weatherCard(spec) {
    const d = el("div", "wx");
    const top = el("div", "wx-now");
    const ic = icon(condIcon(spec.current.condition));
    ic.setAttribute("width", "40");
    ic.setAttribute("height", "40");
    ic.classList.add("wx-ic");
    const t = el("div");
    t.append(el("div", "big", spec.current.temp + "°"), el("div", "dim", condLabel(spec.current.condition)));
    top.append(ic, t);
    const meta = el("div", "dim wx-meta");
    const bits = [];
    if (spec.high != null) bits.push("H " + spec.high + "° / L " + spec.low + "°");
    if (spec.current.humidity != null) bits.push("Humidity " + spec.current.humidity + "%");
    if (spec.current.wind != null) bits.push("Wind " + spec.current.wind);
    meta.textContent = bits.join("  ·  ");
    d.append(top, meta);
    if (spec.forecast) {
      const f = el("ul", "wx-fc");
      spec.forecast.forEach((x) => {
        const li = el("li");
        const i = icon(condIcon(x.condition));
        i.setAttribute("width", "18");
        i.setAttribute("height", "18");
        li.append(el("span", "dim", x.day), i, el("b", null, x.high + "°"));
        li.title = x.day + ": " + condLabel(x.condition);
        f.append(li);
      });
      d.append(f);
    }
    return d;
  },

  taskCard(spec, ctx) {
    const d = el("div", "tasks");
    const prog = el("div", "prog");
    const bar = el("i");
    prog.append(bar);
    const count = el("p", "dim count");
    const ul = el("ul", "task-list");
    const upd = () => {
      const n = spec.items.filter((i) => i.completed).length;
      bar.style.width = (spec.items.length ? (100 * n) / spec.items.length : 0) + "%";
      count.textContent = n + " of " + spec.items.length + " done";
      prog.setAttribute("aria-hidden", "true");
    };
    const addRow = (item) => {
      const li = el("li");
      const id = "t" + ++uid;
      const cb = el("input");
      cb.type = "checkbox";
      cb.id = id;
      cb.checked = !!item.completed;
      const lab = el("label", null, item.label);
      lab.htmlFor = id;
      li.append(cb, lab);
      if (item.priority) li.append(el("span", "pri " + item.priority, item.priority));
      if (item.dueDate) li.append(el("span", "dim due", item.dueDate));
      cb.addEventListener("change", () => {
        item.completed = cb.checked;
        upd();
        ctx.refresh();
      });
      ul.append(li);
    };
    spec.items.forEach(addRow);
    if (spec.showProgress !== false) d.append(prog);
    d.append(count, ul);
    ctx.card.addTask = (label, due) => {
      const item = { id: "n" + ++uid, label, completed: false };
      if (due) item.dueDate = due;
      spec.items.push(item);
      addRow(item);
      upd();
      ctx.refresh();
    };
    upd();
    return d;
  },

  statCard(spec) {
    const d = el("div", "stat");
    const row = el("div", "stat-row");
    row.append(el("span", "big", String(spec.value)));
    if (spec.change) row.append(el("span", "delta " + spec.change.direction, (spec.change.direction === "up" ? "▲ " : "▼ ") + spec.change.amount));
    d.append(row);
    if (spec.caption) d.append(el("p", "dim", spec.caption));
    if (spec.chartValues) {
      const max = Math.max(...spec.chartValues);
      const chart = el("div", "bars");
      chart.setAttribute("role", "img");
      chart.setAttribute("aria-label", "Bar chart of " + spec.chartValues.length + " values: " + spec.chartValues.join(", "));
      spec.chartValues.forEach((v, i) => {
        const col = el("span");
        const b = el("i");
        b.style.setProperty("--h", Math.max(6, (100 * v) / max) + "%");
        b.style.setProperty("--i", i);
        col.append(b, el("em", null, spec.chartLabels ? spec.chartLabels[i] : String(i + 1)));
        chart.append(col);
      });
      d.append(chart);
    }
    return d;
  },

  calendarCard(spec) {
    const d = el("div", "cal");
    const wd = el("div", "cal-days");
    const n = spec.days.length;
    wd.style.setProperty("--n", n);
    spec.days.forEach((day, i) => {
      const c = el("span", day.selected ? "sel" : "");
      c.append(el("small", null, (spec.weekdays || [])[i] || ""), el("b", null, String(day.value)));
      if (day.hasEvents) c.append(el("u"));
      wd.append(c);
    });
    d.append(wd);
    const ul = el("ul", "events");
    (spec.events || []).forEach((e) => {
      const li = el("li", e.tone || "accent");
      li.append(el("span", "dim", e.startTime), el("b", null, e.title));
      ul.append(li);
    });
    d.append(ul);
    return d;
  },

  formBlock(spec, ctx) {
    const f = el("form", "form");
    f.noValidate = true;
    spec.fields.forEach((fd) => {
      const id = "f" + ++uid;
      const row = el("div", "field");
      const lab = el("label", null, fd.label + (fd.required ? " *" : ""));
      lab.htmlFor = id;
      let inp;
      if (fd.type === "select") {
        inp = el("select");
        (fd.options || []).forEach((o) => {
          const op = el("option", null, o.label);
          op.value = o.value;
          inp.append(op);
        });
        if (fd.value) inp.value = fd.value;
      } else if (fd.type === "textarea") {
        inp = el("textarea");
        inp.rows = 2;
        inp.value = fd.value || "";
      } else {
        inp = el("input");
        inp.type = fd.type === "checkbox" ? "checkbox" : fd.type;
        if (fd.type !== "checkbox") inp.value = fd.value || "";
        else inp.checked = fd.value === "true";
      }
      inp.id = id;
      inp.name = fd.id;
      if (fd.placeholder) inp.placeholder = fd.placeholder;
      row.append(lab, inp);
      f.append(row);
    });
    const btn = el("button", "arco-btn", spec.submitLabel || "Submit");
    btn.type = "submit";
    const status = el("p", "form-status dim");
    status.setAttribute("role", "status");
    f.append(btn, status);
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const values = {};
      let missing = null;
      spec.fields.forEach((fd) => {
        const inp = f.elements[fd.id];
        const v = fd.type === "checkbox" ? String(inp.checked) : inp.value.trim();
        values[fd.id] = v;
        if (fd.required && !v && !missing) missing = fd;
      });
      if (missing) {
        status.textContent = missing.label + " is required.";
        status.className = "form-status bad";
        f.elements[missing.id].focus();
        return;
      }
      spec.fields.forEach((fd) => (fd.value = values[fd.id]));
      ctx.refresh();
      const msg = ctx.onSubmit ? ctx.onSubmit(values, ctx.api) : "Done.";
      status.textContent = msg + " (Demo only, nothing is sent.)";
      status.className = "form-status ok";
    });
    return f;
  },

  terminalBlock(spec) {
    const p = el("pre", "term");
    p.textContent = spec.lines.join("\n");
    p.tabIndex = 0;
    return p;
  },

  textBlock(spec) {
    return el("p", "text " + (spec.tone || "default"), spec.text);
  },

  codeBlock(spec) {
    const p = el("pre", "term code");
    p.textContent = spec.code;
    p.tabIndex = 0;
    return p;
  },

  musicPlayerCard(spec) {
    const d = el("div", "music");
    const art = el("div", "art " + (spec.albumArtTone || "accent"));
    const meta = el("div", "music-meta");
    meta.append(el("b", null, spec.title), el("span", "dim", [spec.artist, spec.album].filter(Boolean).join(" · ")));
    const play = el("button", "play");
    play.type = "button";
    const paint = () => {
      play.replaceChildren(icon(spec.playing ? "pause" : "play"));
      play.setAttribute("aria-label", spec.playing ? "Pause (demo, no sound)" : "Play (demo, no sound)");
      play.setAttribute("aria-pressed", String(!!spec.playing));
    };
    paint();
    d.append(art, meta, play);
    const prog = el("div", "prog wide");
    const bar = el("i");
    bar.style.width = (spec.progress || 0) * 100 + "%";
    prog.append(bar);
    const times = el("div", "times dim");
    times.append(el("span", null, spec.elapsed || ""), el("span", null, spec.duration || ""));
    const wrap = el("div", "music-wrap");
    wrap.append(d, prog, times);
    return wrap;
  },
};

const TITLES = {
  weatherCard: (s) => s.location,
  taskCard: (s) => s.title,
  statCard: (s) => s.label,
  calendarCard: (s) => s.monthLabel,
  formBlock: (s) => s.title || "Form",
  terminalBlock: (s) => s.title || "Terminal",
  textBlock: () => "Note",
  codeBlock: (s) => s.filename || "Code",
  musicPlayerCard: () => "Now playing",
};

// Build a card element from a spec: header, body, collapsible spec peek.
function buildCard(def) {
  const spec = def.spec;
  const card = el("article", "acard");
  card.dataset.type = spec.type;
  const head = el("header", "acard-h");
  head.append(el("h4", null, TITLES[spec.type](spec)), el("span", "type", spec.type));
  const pre = el("pre", "spec");
  const refresh = () => (pre.textContent = fmt(spec));
  refresh();
  pre.tabIndex = 0;
  const ctx = { card, refresh, onSubmit: def.onSubmit, api: def.api };
  const body = el("div", "acard-b");
  body.append(BODY[spec.type](spec, ctx));
  const det = el("details", "peek");
  det.append(el("summary", null, "Spec (illustrative)"), pre);
  card.append(head, body, det);
  return card;
}

// ---------- shared sample specs ----------
const days = (vals, sel, ev) => vals.map((v, i) => ({ value: v, selected: i === sel, hasEvents: ev.includes(i) }));
const SPECS = {
  week: [
    {
      spec: { id: "week-cal", type: "calendarCard", monthLabel: "This week", weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], days: days([12, 13, 14, 15, 16, 17, 18], 2, [0, 2, 3, 4]), events: [
        { id: "e1", title: "Team sync", startTime: "Mon 10:00", tone: "accent" },
        { id: "e2", title: "Dentist", startTime: "Wed 15:30", tone: "warning" },
        { id: "e3", title: "Design review", startTime: "Thu 11:00", tone: "accent" },
        { id: "e4", title: "Dinner with Sam", startTime: "Fri 19:30", tone: "success" },
      ] },
      note: "schedule card",
    },
    {
      spec: { id: "week-tasks", type: "taskCard", title: "To do this week", showProgress: true, items: [
        { id: "1", label: "Send the invoice", completed: false, dueDate: "Tue", priority: "high" },
        { id: "2", label: "Prepare review slides", completed: false, dueDate: "Thu", priority: "medium" },
        { id: "3", label: "Book train tickets", completed: false, priority: "low" },
        { id: "4", label: "Water the plants", completed: true },
      ] },
      note: "checklist card",
    },
    {
      spec: { id: "week-focus", type: "statCard", label: "Focus time", value: "14 h", caption: "Planned deep work, Mon to Fri", tone: "accent", change: { amount: "+2 h", direction: "up" }, chartValues: [3, 2, 4, 1, 4] , chartLabels: ["M", "T", "W", "T", "F"] },
      note: "bar chart card",
    },
    {
      spec: { id: "week-wx", type: "weatherCard", location: "Thursday run", current: { temp: 14, condition: "partly_cloudy", humidity: 62, wind: 11 }, high: 16, low: 8, forecast: [{ day: "Wed", condition: "rainy", high: 12 }, { day: "Thu", condition: "partly_cloudy", high: 16 }, { day: "Fri", condition: "sunny", high: 18 }] },
      note: "weather card",
    },
    {
      spec: { id: "week-add", type: "formBlock", title: "Add to the plan", submitLabel: "Add to plan", fields: [
        { id: "task", label: "Task", type: "text", placeholder: "Call the plumber", required: true },
        { id: "day", label: "Day", type: "select", value: "Fri", options: ["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => ({ value: d, label: d })) },
      ] },
      note: "quick-form card",
      onSubmit: (v, api) => {
        const t = api.find("taskCard");
        if (t && t.addTask) {
          t.addTask(v.task, v.day);
          return "Added to your checklist.";
        }
        return "Noted.";
      },
    },
  ],
  sales: [
    { spec: { id: "s-rev", type: "statCard", label: "Revenue", value: "$45,231", caption: "Month to date, sample data", tone: "success", change: { amount: "+12.5%", direction: "up" } }, note: "revenue card" },
    { spec: { id: "s-ord", type: "statCard", label: "Orders", value: "1,284", caption: "Month to date, sample data", tone: "warning", change: { amount: "-3.1%", direction: "down" } }, note: "orders card" },
    { spec: { id: "s-weeks", type: "statCard", label: "Revenue by week", value: "$13.8k", caption: "Week 4, in thousands", tone: "accent", chartValues: [9.8, 11.2, 10.4, 13.8], chartLabels: ["W1", "W2", "W3", "W4"] }, note: "bar chart card" },
    { spec: { id: "s-q", type: "terminalBlock", title: "Query the agent ran", lines: ["$ sum revenue --by week --month current", "W1   9.8k", "W2  11.2k", "W3  10.4k", "W4  13.8k", "ok: 4 rows"] }, note: "query card" },
    { spec: { id: "s-fu", type: "taskCard", title: "Follow-ups", showProgress: true, items: [
      { id: "1", label: "Check why orders dipped in W3", completed: false, priority: "high" },
      { id: "2", label: "Compare W4 with last month", completed: false },
      { id: "3", label: "Share the numbers", completed: false },
    ] }, note: "checklist card" },
    { spec: { id: "s-send", type: "formBlock", title: "Send this report", submitLabel: "Draft email", fields: [
      { id: "to", label: "Send to", type: "select", value: "finance", options: [{ value: "finance", label: "Finance team" }, { value: "founders", label: "Founders" }] },
      { id: "chart", label: "Include the chart", type: "checkbox", value: "true" },
    ] }, note: "quick-form card", onSubmit: (v) => "Draft for " + (v.to === "finance" ? "the finance team" : "the founders") + (v.chart === "true" ? " with the chart." : " without the chart.") },
  ],
  trip: [
    { spec: { id: "t-wx", type: "weatherCard", location: "Lisbon", current: { temp: 22, condition: "sunny", humidity: 55, wind: 12 }, high: 24, low: 16, forecast: [{ day: "Fri", condition: "sunny", high: 24 }, { day: "Sat", condition: "partly_cloudy", high: 22 }, { day: "Sun", condition: "rainy", high: 19 }] }, note: "weather card" },
    { spec: { id: "t-cal", type: "calendarCard", monthLabel: "Itinerary", weekdays: ["Fri", "Sat", "Sun"], days: days([1, 2, 3], 0, [0, 1, 2]), events: [
      { id: "e1", title: "Old town walk", startTime: "Fri 10:00", tone: "accent" },
      { id: "e2", title: "River-side museum", startTime: "Sat 09:30", tone: "accent" },
      { id: "e3", title: "Long lunch", startTime: "Sun 12:00", tone: "success" },
      { id: "e4", title: "Flight home", startTime: "Sun 19:40", tone: "warning" },
    ] }, note: "itinerary card" },
    { spec: { id: "t-pack", type: "taskCard", title: "Packing list", showProgress: true, items: [
      { id: "1", label: "Passport", completed: true },
      { id: "2", label: "Rain jacket (Sunday)", completed: false },
      { id: "3", label: "Comfortable shoes", completed: false },
      { id: "4", label: "Phone charger", completed: false },
    ] }, note: "packing card" },
    { spec: { id: "t-budget", type: "formBlock", title: "Budget", submitLabel: "Per day", fields: [
      { id: "total", label: "Total budget (EUR)", type: "number", value: "400", required: true },
      { id: "days", label: "Days", type: "number", value: "3", required: true },
    ] }, note: "budget card", onSubmit: (v) => (Number(v.days) > 0 ? "About " + Math.round(Number(v.total) / Number(v.days)) + " EUR per day." : "Days must be above zero.") },
    { spec: { id: "t-tip", type: "textBlock", text: "Tip: book tickets for the busiest sights ahead of time.", tone: "muted" }, note: "tip" },
  ],
};

const SCRIPTS = {
  week: {
    label: "Plan my week",
    prompt: "Plan my week and show it as cards",
    reply: "Here is a plan for the week. Your fixed commitments are in a schedule, everything else is in a checklist, and I checked the weather for Thursday's run. Add anything I missed with the form at the end.",
    after: "Tick things off as you go, or add a task and I will put it on the list.",
  },
  sales: {
    label: "Sales dashboard",
    prompt: "Show me a sales dashboard for this month",
    reply: "Here is the month so far. The first two cards are the headline numbers, the bars show revenue by week, and I kept the query so you can check it. All numbers are made up for this demo.",
    after: "Orders dipped in week 3, so I put that at the top of the follow-ups.",
  },
  trip: {
    label: "Plan a trip",
    prompt: "Plan a 3-day trip to Lisbon",
    reply: "Three days in Lisbon, Friday to Sunday. I checked the forecast, laid out an itinerary, made a packing list and a quick budget check. The places and numbers are made up for this demo.",
    after: "Sunday looks rainy, so the long lunch is indoors.",
  },
};

// ---------- demo ----------
const log = $("#log");
const feed = $("#demo-feed");
const feedEmpty = $("#feed-empty");
const feedCount = $("#feed-count");
const stateEl = $("#demo-state");
const chips = [...document.querySelectorAll(".chip-btn[data-script]")];
let runId = 0;
let current = null;
let started = false;
let feedCards = [];

const scrollEnd = (box) => box.scrollTo({ top: box.scrollHeight, behavior: reduceMotion() ? "auto" : "smooth" });
const setState = (t) => (stateEl.textContent = t);
const cloneSpecs = (key) => JSON.parse(JSON.stringify(SPECS[key])).map((d, i) => ({ ...d, onSubmit: SPECS[key][i].onSubmit }));

function addMsg(kind, text) {
  const m = el("div", "msg " + kind);
  let orb = null;
  if (kind === "agent") {
    const a = makeAvatar(SCRIPT_AGENT[current] || "Planner");
    avatars.push(a.orb);
    orb = a.orb;
    m.append(a.slot);
  }
  const b = el("div", "bub");
  b.append(el("span", "sr", kind === "agent" ? "Agent: " : "You: "));
  const t = el("span", "txt", text || "");
  b.append(t);
  m.append(b);
  log.append(m);
  scrollEnd(log);
  return { m, t, orb };
}

async function streamInto(t, text, alive) {
  if (reduceMotion()) {
    t.textContent = text;
    return;
  }
  const caret = el("span", "caret");
  t.after(caret);
  log.setAttribute("aria-busy", "true");
  let i = 0;
  while (i < text.length) {
    if (!alive()) {
      caret.remove();
      return;
    }
    const step = 1 + Math.floor(Math.random() * 3);
    i = Math.min(text.length, i + step);
    t.textContent = text.slice(0, i);
    if (i % 12 < 3) scrollEnd(log);
    await sleep(12 + Math.random() * 14);
  }
  caret.remove();
  log.removeAttribute("aria-busy");
}

function updateCount() {
  feedCount.textContent = feedCards.length + (feedCards.length === 1 ? " card" : " cards");
  feedEmpty.hidden = feedCards.length > 0;
}

async function run(key, auto) {
  const my = ++runId;
  const alive = () => my === runId;
  const s = SCRIPTS[key];
  current = key;
  started = true;
  chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.script === key)));
  log.removeAttribute("aria-busy");
  avatars.forEach((a) => a.destroy());
  avatars = [];
  log.replaceChildren();
  feed.querySelectorAll(".acard, .skel").forEach((n) => n.remove());
  feedCards = [];
  updateCount();
  setState("Running");
  const wait = async (ms) => {
    if (!reduceMotion()) await sleep(ms);
    return alive();
  };

  addMsg("user", s.prompt);
  if (!(await wait(450))) return;
  const thinking = addMsg("agent", "");
  thinking.orb.speak(true);
  thinking.t.classList.add("dots-t");
  if (!reduceMotion()) {
    thinking.t.textContent = "…";
    if (!(await wait(550))) return;
    thinking.t.classList.remove("dots-t");
    thinking.t.textContent = "";
  }
  await streamInto(thinking.t, s.reply, alive);
  thinking.orb.speak(false);
  if (!alive()) return;

  const defs = cloneSpecs(key);
  const api = { find: (type) => feedCards.map((c) => c.el).find((c) => c.dataset.type === type) };
  for (const def of defs) {
    if (!(await wait(250))) return;
    let sk = null;
    if (!reduceMotion()) {
      sk = el("div", "skel");
      sk.setAttribute("aria-hidden", "true");
      sk.append(el("i"), el("i"), el("i"));
      feed.append(sk);
      feedEmpty.hidden = true;
      scrollEnd(feed);
      const note = addMsg("note", "Generating " + def.note + "…");
      note.m.classList.add("pending");
      if (!(await wait(600 + Math.random() * 300))) return;
      note.m.remove();
    }
    def.api = api;
    const card = buildCard(def);
    if (!reduceMotion()) card.classList.add("pop");
    if (sk) sk.replaceWith(card);
    else feed.append(card);
    feedCards.push({ el: card });
    updateCount();
    scrollEnd(feed);
    const n = el("div", "note done");
    n.textContent = "Card ready: " + def.note;
    log.append(n);
    scrollEnd(log);
  }
  if (!(await wait(450))) return;
  const m2 = addMsg("agent", "");
  m2.orb.speak(true);
  await streamInto(m2.t, s.after, alive);
  m2.orb.speak(false);
  if (!alive()) return;
  setState("Done");
}

chips.forEach((c) => c.addEventListener("click", () => run(c.dataset.script)));
$("#replay").addEventListener("click", () => run(current || "week"));

// start the first script once, when the demo is in view
const demoWin = $("#demo-win");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && !started) {
      io.disconnect();
      run("week", true);
    }
  }, { threshold: 0.35 });
  io.observe(demoWin);
} else run("week", true);

// ---------- static pieces drawn with the same renderer ----------
function fill(target, defs) {
  defs.forEach((d) => target.append(buildCard(d)));
}

const GALLERY = [
  { spec: SPECS.trip[0].spec },
  { spec: SPECS.week[1].spec },
  { spec: SPECS.week[2].spec },
  { spec: SPECS.week[0].spec },
  { spec: SPECS.trip[3].spec, onSubmit: SPECS.trip[3].onSubmit },
  { spec: { id: "g-music", type: "musicPlayerCard", title: "Evening Loop", artist: "Sample Artist", playing: false, progress: 0.35, elapsed: "1:12", duration: "3:24" } },
  { spec: { id: "g-code", type: "codeBlock", language: "ts", filename: "plan.ts", code: "const plan = week.map((day) =>\n  day.events.filter((e) => e.fixed)\n);" } },
  { spec: SPECS.sales[3].spec },
  { spec: SPECS.trip[4].spec },
];
const gal = $("#gallery");
if (gal) fill(gal, JSON.parse(JSON.stringify(GALLERY)).map((d, i) => ({ ...d, onSubmit: GALLERY[i].onSubmit })));

const hero = $("#hero-feed");
if (hero) {
  const m = el("div", "msg user");
  const b = el("div", "bub", "Plan my week and show it as cards");
  m.append(b);
  hero.append(m);
  fill(hero, JSON.parse(JSON.stringify([SPECS.week[1], SPECS.sales[0]])).map((d) => ({ ...d })));
  hero.querySelectorAll("details").forEach((d) => d.remove());
}

const mock = $("#feed-mock");
if (mock) {
  const posts = [
    { who: "Planner agent", when: "just now", text: "Your week, laid out. Two things need a decision.", spec: SPECS.week[1].spec },
    { who: "Reports agent", when: "9 min ago", text: "Month to date. Orders dipped in week 3.", spec: SPECS.sales[2].spec },
    { who: "Travel agent", when: "yesterday", text: "Lisbon forecast for your trip.", spec: SPECS.trip[0].spec },
  ];
  posts.forEach((p) => {
    const post = el("div", "post");
    const h = el("div", "post-h");
    h.append(makeAvatar(p.who.split(" ")[0]).slot, el("b", null, p.who), el("span", "dim", p.when));
    post.append(h, el("p", "post-t", p.text), buildCard({ spec: JSON.parse(JSON.stringify(p.spec)) }));
    mock.append(post);
  });
}

const desk = $("#desk-body");
if (desk) desk.append(buildCard({ spec: JSON.parse(JSON.stringify(SPECS.week[1].spec)) }));

// ---------- token swatches ----------
const DARK = [
  ["--arco-bg-desktop", "#0d0d0f"], ["--arco-bg-surface-solid", "#1a1a1c"], ["--arco-text-primary", "#ececee"], ["--arco-text-secondary", "#a8a8ae"], ["--arco-text-tertiary", "#717178"],
  ["--arco-accent", "#7c9dff"], ["--arco-accent-strong", "#5b82ff"], ["--arco-success", "#58c98b"], ["--arco-warning", "#e5b567"], ["--arco-danger", "#e5737d"], ["--arco-border", "rgba(255,255,255,.09)"],
];
const LIGHT = [
  ["--arco-bg-desktop", "#dfe4ec"], ["--arco-bg-surface-solid", "#fcfdff"], ["--arco-text-primary", "#171b23"], ["--arco-text-secondary", "#4e5665"], ["--arco-text-tertiary", "#8a92a3"],
  ["--arco-accent", "#3b64e0"], ["--arco-accent-strong", "#2b51c7"], ["--arco-success", "#23985e"], ["--arco-warning", "#b57f24"], ["--arco-danger", "#cc4450"], ["--arco-border", "rgba(15,20,30,.1)"],
];
function swatches(target, list, dark) {
  if (!target) return;
  const h = el("p", "sw-h", dark ? "Dark (html[data-theme=\"dark\"])" : "Light (html[data-theme=\"light\"])");
  target.append(h);
  const ul = el("ul");
  list.forEach(([name, val]) => {
    const li = el("li");
    const chip = el("span", "sw-chip");
    chip.style.background = val;
    if (name.endsWith("border")) {
      chip.style.background = dark ? "#1a1a1c" : "#fcfdff";
      chip.style.border = "3px solid " + val;
    }
    li.append(chip, el("code", null, name), el("span", "dim", val));
    ul.append(li);
  });
  target.append(ul);
}
swatches($("#swatches"), DARK, true);
swatches($("#swatches-light"), LIGHT, false);
