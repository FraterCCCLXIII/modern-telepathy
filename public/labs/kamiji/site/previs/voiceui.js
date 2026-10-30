// Voice chips on nodes and the one shared voice picker. A chip is a compact button ("Auto", "Qwen girl teen") that opens the picker
// for one character (artboard nodes) or for every speaker of a scene (story-map cards).
import { el, svg } from "./ui.js";
import { voiceLabel } from "./speech.js";

export function createVoiceUI({ speech, store, charName, cleanup = () => {} }) {
  const pop = el("div", { class: "pv-voicepop", role: "dialog", "aria-label": "Character voices", hidden: true, tabindex: "-1" });
  document.body.append(pop);
  let anchor = null, ids = [];

  const icon = () => { const s = svg("svg", { viewBox: "0 0 16 16", width: "11", height: "11", "aria-hidden": "true", class: "pv-vi" }); s.append(svg("path", { d: "M2 6h3l4-3v10l-4-3H2z", fill: "currentColor" }), svg("path", { d: "M11.5 5.5a3.5 3.5 0 010 5", fill: "none", stroke: "currentColor", "stroke-width": "1.4", "stroke-linecap": "round" })); return s; };

  // a chip for card bodies; `idsOf()` returns the character ids it speaks for
  function chip(idsOf) {
    const b = el("button", { type: "button", class: "pv-btn pv-btn-sm pv-card-ctl pv-voice-chip", "aria-haspopup": "dialog" });
    b.append(icon(), el("span", { class: "pv-vc-t" }));
    b.addEventListener("click", (e) => { e.stopPropagation(); open(b, idsOf()); });
    b.addEventListener("pointerdown", (e) => e.stopPropagation());
    b.addEventListener("dblclick", (e) => e.stopPropagation());
    b.update = () => {
      const list = idsOf(), t = b.querySelector(".pv-vc-t");
      const txt = list.length === 1 ? speech.chipText(list[0]) : `${list.length} voices`;
      if (t.textContent !== txt) t.textContent = txt;
      const label = list.length === 1 ? `Voice for ${charName(list[0])}: ${txt}. Change voice` : `Voices of ${list.map(charName).join(", ")}. Change voices`;
      if (b.getAttribute("aria-label") !== label) { b.setAttribute("aria-label", label); b.title = label; }
      b.hidden = !list.length;
    };
    b.update();
    return b;
  }

  function optionsFor(cid, sel) {
    const o = speech.options(), cur = speech.voiceOf(cid).voice;
    const group = (label, list) => (list.length ? el("optgroup", { label }, ...list.map((v) => el("option", { value: v, text: voiceLabel(v), selected: v === cur }))) : null);
    const known = new Set([...o.qwen, ...o.kokoro, ...o.system]);
    sel.append(el("option", { value: "", text: "Auto (picked for this character)", selected: !cur }));
    if (cur && !known.has(cur)) sel.append(el("option", { value: cur, text: voiceLabel(cur) + " (not available now)", selected: true }));
    [group("Server: Qwen", o.qwen), group("Server: Kokoro", o.kokoro), group("System voices", o.system)].forEach((g) => g && sel.append(g));
  }

  function render() {
    pop.replaceChildren();
    const cat = speech.cat;
    pop.append(el("p", { class: "pv-vp-status", text: cat.server ? "Voice server connected (Qwen, Kokoro)." : cat.checked ? "Voice server not running. System voices only. Start it with tools/voice-server/run.sh start." : "Checking for the voice server." }));
    for (const cid of ids) {
      const v = speech.voiceOf(cid), uid = "pv-vp-" + cid.replace(/\W/g, "_");
      const sel = el("select", { class: "pv-select pv-sm", id: uid + "-v", "data-char": cid, "aria-label": `Voice for ${charName(cid)}` });
      optionsFor(cid, sel);
      sel.addEventListener("change", () => { speech.setVoice(cid, { voice: sel.value }); });
      const range = (key, min, max, step, fmt) => {
        const out = el("output", { text: fmt(v[key]) }), inp = el("input", { type: "range", min, max, step, value: v[key], "aria-label": `${key === "speed" ? "Speed" : "Pitch"} for ${charName(cid)}`, "data-key": key });
        inp.addEventListener("input", () => { out.textContent = fmt(+inp.value); speech.setVoice(cid, { [key]: +inp.value }, { commit: false }); });
        inp.addEventListener("change", () => store.commit());
        return [inp, out];
      };
      const prev = el("button", { type: "button", class: "pv-btn pv-btn-sm", "data-preview": cid, text: "Preview", title: `Hear ${charName(cid)}'s voice` });
      prev.addEventListener("click", () => speech.preview(cid));
      pop.append(el("div", { class: "pv-vp-row", "data-char": cid },
        el("div", { class: "pv-vp-h" }, el("b", { text: charName(cid) }), prev),
        sel,
        el("label", { class: "pv-vp-l" }, el("span", { text: "Speed" }), ...range("speed", 0.6, 1.5, 0.05, (x) => x.toFixed(2) + "x")),
        el("label", { class: "pv-vp-l" }, el("span", { text: "Pitch" }), ...range("shift", -6, 8, 1, (x) => (x > 0 ? "+" : "") + x + " st"))));
    }
  }
  function place() {
    const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + "px";
    pop.style.top = Math.max(8, r.bottom + 6 + h > innerHeight - 8 ? r.top - h - 6 : r.bottom + 6) + "px";
  }
  function open(btn, list) {
    if (!list.length) return;
    if (!pop.hidden && anchor === btn) { close(); return; }
    anchor = btn; ids = list; render(); pop.hidden = false; place(); speech.refresh(false);
    pop.querySelector("select")?.focus();
  }
  function close(refocus = true) { if (pop.hidden) return; pop.hidden = true; speech.stopPreview(); if (refocus) anchor?.focus?.({ preventScroll: true }); anchor = null; }
  pop.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } });
  document.addEventListener("pointerdown", (e) => { if (!pop.hidden && !pop.contains(e.target) && !e.target.closest(".pv-voice-chip")) close(false); }, true);
  speech.onChange((what) => { if (what === "catalog" && !pop.hidden && !pop.contains(document.activeElement)) render(); });
  return { chip, open, close, el: pop };
}
