// Morph slider panel: grouped sliders with numeric inputs, reset, symmetry lock, per-group lock, randomise within range.
import { MORPHS, STYLE_BY_ID, MORPH_BY_ID, SHAPE_TARGETS } from "./data.js";
import { partOf, morphValue } from "./figure.js";
import { planOf } from "./rules.js";
import { h } from "./ui.js";

// groups opened by default for each category
const OPEN = { body: ["Proportions"], head: ["Head shape"], face: ["Face features", "Face", "Eyes", "Brows"], torso: ["Proportions"], arms: ["Limbs"], hands: ["Limbs"], legs: ["Limbs"], feet: ["Limbs"], ears: ["Creature"], tail: ["Creature"], wings: ["Creature"], horns: ["Creature"], style: ["Proportions", "Shape"] };

export function visibleMorphs(ch) {
  const st = STYLE_BY_ID[ch.style], eng = st.engine === "proc" ? "proc" : ch.style;
  const plan = st.engine === "proc" ? planOf(ch) : "upright";
  return MORPHS.filter((m) => {
    if (!m.styles.includes(eng)) return false;
    if (m.only && !m.only.includes(ch.style)) return false;
    if (st.engine === "proc") {
      if (m.slot) { const p = partOf(ch, m.slot); if (!p || p.id === "none") return false; }
      if ((m.id.startsWith("armLen")) && plan !== "upright") return false;
      if (m.id === "handSize" && plan !== "upright") return false;
      if (m.id === "bodyLen" && plan === "upright") return false;
    }
    return true;
  });
}

export function renderMorphs(app, root) {
  const { store } = app, ch = store.ch, st = STYLE_BY_ID[ch.style];
  const list = visibleMorphs(ch), groups = [...new Set(list.map((m) => m.group))];
  const openSet = new Set([...(app.openGroups || []), ...(OPEN[store.ui.category] || [])]);
  app.openGroups = openSet;
  const head = h("div", { class: "st-ctl" },
    h("button", { class: "st-btn st-btn-sm", type: "button", "aria-pressed": String(store.ui.symmetry), onclick: () => { store.ui.symmetry = !store.ui.symmetry; renderMorphs(app, root); app.say("Symmetry lock " + (store.ui.symmetry ? "on: left and right sliders move together" : "off")); }, title: "Left and right sliders move together" }, "Symmetry"),
    h("button", { class: "st-btn st-btn-sm", type: "button", onclick: () => app.randomMorphs() , title: "Random values inside each slider's range; locked groups are kept" }, "Randomise"),
    h("button", { class: "st-btn st-btn-sm", type: "button", onclick: () => app.resetMorphs(), title: "Reset all unlocked groups" }, "Reset"));
  root.replaceChildren(head, h("p", { class: "st-note", text: st.engine === "proc" ? "Head shape sliders are real blendshapes (morph targets). The others change proportions by rebuilding the rig." : ch.style === "shapes" ? "All 34 sliders are real morph targets of one GLB. Picking a shape in Body sets that target to 1; blend several." : "Real morph targets of the Kamiji hand GLB." }));
  if (!list.length) { root.append(h("p", { class: "st-note", text: "This style has no morph sliders. Use Body, Materials and Accessories." })); return; }
  if (app._openFor !== ch.style) { app._openFor = ch.style; if (!groups.some((g) => openSet.has(g)) && groups[0]) openSet.add(groups[0]); }
  for (const g of groups) {
    const items = list.filter((m) => m.group === g), locked = !!store.ui.locks["morph:" + g];
    const d = h("details", { class: "st-grp" }, h("summary", {}, h("span", { text: g })),
      h("div", { class: "st-ctl" },
        h("button", { class: "st-mini", type: "button", "aria-pressed": String(locked), title: "Lock this group: Randomise and Reset keep it", onclick: () => app.toggleLock("morph:" + g) }, locked ? "Locked" : "Lock"),
        h("button", { class: "st-mini", type: "button", title: "Reset this group", onclick: () => app.resetMorphs(g) }, "Reset group")));
    if (openSet.has(g)) d.open = true;
    d.addEventListener("toggle", () => { if (d.open) openSet.add(g); else openSet.delete(g); });
    for (const m of items) {
      const id = "mo-" + m.id, val = shapeVal(ch, m);
      const range = h("input", { type: "range", id, min: m.min, max: m.max, step: m.step, value: val, "data-morph": m.id, oninput: (e) => { num.value = (+e.target.value).toFixed(2); app.setMorph(m.id, +e.target.value, true); }, onchange: () => store.endLive() });
      const num = h("input", { class: "st-num", type: "number", min: m.min, max: m.max, step: m.step, value: val.toFixed(2), "aria-label": m.label + " value", onchange: (e) => { const v = Math.min(m.max, Math.max(m.min, +e.target.value || 0)); range.value = v; app.setMorph(m.id, v, false); } });
      const rs = h("button", { class: "st-rs", type: "button", "aria-label": "Reset " + m.label, title: "Reset", onclick: () => { app.setMorph(m.id, m.def, false); } }, "↺");
      d.append(h("div", { class: "st-row" + (m.real != null ? " is-real" : "") }, h("label", { for: id, text: m.label }), range, num, rs));
    }
    root.append(d);
  }
}
const shapeVal = (ch, m) => { const v = ch.morphs[m.id]; if (v != null) return v; if (ch.style === "shapes" && m.id === "sh_" + (ch.parts.body || "drop")) return 1; return m.def; };
