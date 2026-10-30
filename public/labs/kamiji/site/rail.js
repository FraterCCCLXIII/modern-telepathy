// Horizontal rail selector: one dropdown per control group (Expression, Shape, Clip, Mouth, Effect, Tint).
// It sits on top of the existing pill and swatch groups that main.js fills, mirrors their
// state and clicks the real buttons, so every selection stays exactly as before.
// The earlier card design is stashed: open the page with ?selector=card to bring it back
// (see docs/stash/selector-card.md).
const card = document.querySelector(".card.controls");
const mode = new URLSearchParams(location.search).get("selector") === "card" ? "card" : "rail";
if (card) card.dataset.selector = mode;

const GROUPS = [
  { id: "g-expr", label: "Expression" },
  { id: "g-shape", label: "Shape" },
  { id: "g-clip", label: "Clip" },
  { id: "g-mouth", label: "Mouth" },
  { id: "g-accessory", label: "Accessory", multi: true, noun: "accessories" },   // grouped by data-group (slot) headings
  { id: "g-effect", label: "Effect", multi: true },   // multi: checkmark list, each pill toggles on its own
  { id: "g-tint", label: "Tint", swatch: true },
];

let openMenu = null;
function closeMenu(focusBtn) {
  if (!openMenu) return;
  openMenu.menu.hidden = true;
  openMenu.btn.setAttribute("aria-expanded", "false");
  if (focusBtn) openMenu.btn.focus();
  openMenu = null;
}

function build(group) {
  const source = document.getElementById(group.id);
  if (!source) return null;
  const row = source.closest(".row");
  const wrap = document.createElement("div");
  wrap.className = "rail-dd";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "rail-btn";
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");
  const lbl = document.createElement("span");
  lbl.className = "rail-lbl";
  lbl.textContent = group.label;
  const val = document.createElement("span");
  val.className = "rail-val";
  const dot = document.createElement("i");
  dot.className = "rail-dot";
  dot.hidden = !group.swatch;
  const text = document.createElement("span");
  text.className = "rail-text";
  const chev = document.createElement("span");
  chev.className = "rail-chev";
  chev.setAttribute("aria-hidden", "true");
  val.append(dot, text);
  btn.append(lbl, val, chev);
  const menu = document.createElement("ul");
  menu.className = "rail-menu";
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", group.label);
  if (group.multi) menu.setAttribute("aria-multiselectable", "true");
  menu.hidden = true;
  wrap.append(btn, menu);

  const items = () => [...source.querySelectorAll(group.swatch ? ".swatch" : ".pill")];
  const nameOf = (el) => (group.swatch ? el.getAttribute("aria-label").replace(/^Tint\s*/, "") : el.textContent.trim());

  // Multi-select (Effect): checked rows carry a leading check; the button shows none / the name / "N effects".
  function syncMulti() {
    const list = items();
    wrap.hidden = !!row?.hidden || list.length === 0;
    const on = list.filter((el) => el.getAttribute("aria-pressed") === "true");
    text.textContent = on.length === 0 ? "None" : on.length === 1 ? nameOf(on[0]) : `${on.length} ${group.noun || "effects"}`;
    const optCount = () => menu.querySelectorAll('li[role="option"]').length;
    if (optCount() !== list.length + 1 || list.some((el, i) => menu.querySelectorAll('li[role="option"]')[i]?.textContent !== nameOf(el))) {   // rebuilt only when the choices change, so focus survives toggling
      menu.replaceChildren();
      let heading = "";
      list.forEach((el) => {
        if (el.dataset.group && el.dataset.group !== heading) {   // slot headings (Accessory): not focusable options
          heading = el.dataset.group;
          const h = document.createElement("li");
          h.className = "rail-head"; h.setAttribute("role", "presentation"); h.textContent = heading;
          menu.append(h);
        }
        const li = document.createElement("li");
        li.setAttribute("role", "option");
        li.tabIndex = -1;
        const chk = document.createElement("span");
        chk.className = "rail-check";
        chk.setAttribute("aria-hidden", "true");
        li.append(chk, document.createTextNode(nameOf(el)));
        li.addEventListener("click", () => el.click());
        menu.append(li);
      });
      const clr = document.createElement("li");
      clr.setAttribute("role", "option");
      clr.className = "rail-clear";
      clr.tabIndex = -1;
      clr.textContent = "Clear all";
      clr.addEventListener("click", () => items().filter((el) => el.getAttribute("aria-pressed") === "true").forEach((el) => el.click()));
      menu.append(clr);
    }
    const opts = menu.querySelectorAll('li[role="option"]');
    list.forEach((el, i) => opts[i].setAttribute("aria-selected", String(on.includes(el))));
    const clr = menu.lastElementChild;
    clr.setAttribute("aria-selected", "false");
    clr.setAttribute("aria-disabled", String(on.length === 0));
  }

  function sync() {
    if (group.multi) return syncMulti();
    const list = items();
    wrap.hidden = !!row?.hidden || list.length === 0;
    const current = list.find((el) => el.getAttribute("aria-pressed") === "true");
    text.textContent = current ? nameOf(current) : "None";
    if (group.swatch) dot.style.background = current ? current.style.background : "transparent";
    menu.replaceChildren();
    list.forEach((el) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.tabIndex = -1;
      li.setAttribute("aria-selected", String(el === current));
      if (group.swatch) {
        const d = document.createElement("i");
        d.className = "rail-dot";
        d.style.background = el.style.background;
        li.append(d);
      }
      li.append(document.createTextNode(nameOf(el)));
      li.addEventListener("click", () => { el.click(); closeMenu(true); });
      menu.append(li);
    });
  }

  function open() {
    closeMenu(false);
    sync();
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    openMenu = { btn, menu };
    (menu.querySelector('[aria-selected="true"]') || menu.querySelector('li[role="option"]'))?.focus();
  }
  btn.addEventListener("click", () => (menu.hidden ? open() : closeMenu(true)));
  btn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); }
  });
  menu.addEventListener("keydown", (e) => {
    const opts = [...menu.querySelectorAll('li[role="option"]')];
    const i = opts.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); opts[Math.min(opts.length - 1, i + 1)]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); opts[Math.max(0, i - 1)]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); opts[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); opts[opts.length - 1]?.focus(); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); document.activeElement?.click(); }
    else if (group.multi && (e.key === "Escape" || e.key === "Tab")) { closeMenu(true); if (e.key === "Escape") e.preventDefault(); }   // Tab: focus is back on the button, so the browser moves on from there
    else if (e.key === "Escape" || e.key === "Tab") { closeMenu(e.key === "Escape"); }
  });

  new MutationObserver(sync).observe(source, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
  if (row) new MutationObserver(sync).observe(row, { attributes: true, attributeFilter: ["hidden"] });
  sync();
  return wrap;
}

if (card) {
  const rail = document.createElement("div");
  rail.className = "rail";
  rail.setAttribute("role", "group");
  rail.setAttribute("aria-label", "Model controls");
  GROUPS.forEach((g) => { const el = build(g); if (el) rail.append(el); });
  card.prepend(rail);
  document.addEventListener("pointerdown", (e) => { if (openMenu && !openMenu.btn.parentElement.contains(e.target)) closeMenu(false); });
}
