// Compatibility rules. A part or accessory can be unavailable (blocked, with a reason), or applying it can fix other slots (notes).
import { STYLE_BY_ID, SLOTS_BY_STYLE, SLOT_LABEL, CATEGORIES } from "./data.js";
import { PARTS, partsFor } from "./parts.js";
import { ACC } from "./acc.js";
import { partOf } from "./figure.js";

export const planOf = (ch) => (STYLE_BY_ID[ch.style]?.engine === "proc" ? partOf(ch, "body")?.params?.plan || "upright" : "upright");
const UPRIGHT_ONLY = { arms: "Arms need an upright body plan. This body walks on its front legs, so edit Legs instead.", hands: "Hands need arms. This body plan has none.", clothing: "Outfits are cut for upright bodies. Use accessories instead." };

/** Why a slot is unavailable for the character (null = available). */
export function slotBlock(ch, slot) {
  const st = STYLE_BY_ID[ch.style];
  if (!SLOTS_BY_STYLE[ch.style]?.includes(slot)) return `${SLOT_LABEL[slot] || slot} is not part of the ${st.label} style. Switch to Creature or Mix to use it.`;
  if (st.engine === "proc" && planOf(ch) !== "upright" && UPRIGHT_ONLY[slot]) return UPRIGHT_ONLY[slot];
  return null;
}
export function categoryBlock(ch, catId) {
  const cat = CATEGORIES.find((c) => c.id === catId);
  if (!cat || !cat.slots.length) return null;
  const msgs = cat.slots.map((s) => slotBlock(ch, s));
  return msgs.every(Boolean) ? msgs[0] : null;
}

/** Part availability. */
export function partBlock(ch, slot, part) {
  const sb = slotBlock(ch, slot); if (sb) return sb;
  if (!part.for.includes(ch.style)) return "Not available in this style.";
  const head = partOf(ch, "head");
  if (slot === "hair" && part.id !== "none" && (head?.noHair || head?.fur === true)) return `The ${head.label} head cannot take hair (fixed shape or fur).`;
  if (slot === "ears" && part.id !== "none" && head?.hasEars) return `The ${head.label} head already has its own ears. Pick another head to add ears.`;
  if (slot === "head" && part.hasEars) { const ears = partOf(ch, "ears"); if (ears && ears.id !== "none" && SLOTS_BY_STYLE[ch.style].includes("ears")) return null; }
  return null;
}

/** Apply a part choice, fixing dependent slots. Returns { ch, notes }. */
export function setPartRules(ch, slot, id) {
  const next = JSON.parse(JSON.stringify(ch)); next.parts = { ...next.parts, [slot]: id }; const notes = [];
  const part = PARTS.find((p) => p.slot === slot && p.id === id && p.for.includes(ch.style));
  const drop = (s, why) => { const cur = partOf(next, s); if (cur && cur.id !== "none" && SLOTS_BY_STYLE[next.style].includes(s)) { next.parts[s] = "none"; notes.push(why); } };
  if (slot === "head" && part) {
    if (part.hasEars) drop("ears", `${part.label} has its own ears: Ears set to none.`);
    if (part.noHair || part.fur) { if (next.style !== "creature") drop("hair", `${part.label} cannot take hair: Hair set to none.`); }
  }
  if (slot === "body" && part?.params) {
    if (part.params.plan !== "upright") {
      if (next.accessories.some((a) => a.socket.startsWith("hand_"))) { next.accessories = next.accessories.filter((a) => !a.socket.startsWith("hand_")); notes.push("Held items removed: this body has no hands."); }
      if (partOf(next, "clothing")?.id && partOf(next, "clothing").id !== "none") { next.parts.clothing = "none"; notes.push("Outfit removed: outfits are cut for upright bodies."); }
    }
  }
  if (slot === "wings" && id !== "none" && next.accessories.some((a) => a.socket === "back")) { next.accessories = next.accessories.filter((a) => a.socket !== "back"); notes.push("Wings use the back socket: the back accessory was removed."); }
  if (slot === "tail" && id === "none" && next.accessories.some((a) => a.socket === "tail")) { next.accessories = next.accessories.filter((a) => a.socket !== "tail"); notes.push("Tail accessories removed: no tail to wear them on."); }
  return { ch: next, notes };
}

/** Is a socket available (for this character and figure)? */
export function socketBlock(ch, fig, socket) {
  if (socket === "back" && partOf(ch, "wings") && partOf(ch, "wings").id !== "none" && SLOTS_BY_STYLE[ch.style].includes("wings")) return "Wings are on the back. Remove the wings to wear a back accessory.";
  if (socket === "tail" && STYLE_BY_ID[ch.style].engine === "proc" && (!partOf(ch, "tail") || partOf(ch, "tail").id === "none")) return "This character has no tail. Add a tail first.";
  if (fig && !(fig.sockets?.[socket]?.length)) {
    if (socket.startsWith("hand_")) return "This body has no hands to hold things.";
    return socket === "tail" ? `${STYLE_BY_ID[ch.style].label} has no tail. Use Creature or Mix.` : `${STYLE_BY_ID[ch.style].label} has no ${socket} socket.`;
  }
  if (socket.startsWith("hand_") && STYLE_BY_ID[ch.style].engine === "proc" && planOf(ch) !== "upright") return "This body has no hands to hold things.";
  return null;
}
/** Add an accessory. Zone conflicts resolve newest-wins; one accessory per socket. */
export function addAccessory(ch, entry, socket, fig) {
  const block = socketBlock(ch, fig, socket); if (block) return { ch, notes: [], error: block };
  const next = JSON.parse(JSON.stringify(ch)), notes = [];
  const zones = new Set([entry.zone, ...(entry.conflicts || [])]);
  next.accessories = next.accessories.filter((a) => {
    const o = ACC.byId.get(a.id); if (!o) return false;
    const oz = new Set([o.zone, ...(o.conflicts || [])]);
    const clash = a.socket === socket || [...zones].some((z) => oz.has(z));
    if (clash && a.id !== entry.id) notes.push(`${o.label} removed: it shares ${a.socket === socket ? "the " + socket + " socket" : "a zone"} with ${entry.label}.`);
    return !clash;
  });
  const have = ch.accessories.find((a) => a.id === entry.id && a.socket === socket);
  next.accessories.push({ id: entry.id, socket, tint: have?.tint });
  if (entry.conflicts?.includes("hair") && partOf(next, "hair") && partOf(next, "hair").id !== "none") notes.push(`${entry.label} covers the hair: the crown of the hair is hidden under it.`);
  if (entry.socket === "head" && partOf(next, "horns") && partOf(next, "horns").id !== "none" && SLOTS_BY_STYLE[next.style].includes("horns")) notes.push(`${entry.label} sits over the horns: they may poke through.`);
  return { ch: next, notes };
}
export const heldSocketFor = (ch) => (["hand_R", "hand_L"].find((s) => !ch.accessories.some((a) => a.socket === s)) || "hand_R");

/** Standing notes shown in the rules strip. */
export function standingNotes(ch, fig) {
  const out = [], st = STYLE_BY_ID[ch.style];
  if (st.engine === "proc" && planOf(ch) !== "upright") out.push("Quadruped / six-legged body: arms, hands and outfits are unavailable.");
  const hats = ch.accessories.filter((a) => ACC.byId.get(a.id)?.conflicts?.includes("hair"));
  if (hats.length && partOf(ch, "hair") && partOf(ch, "hair").id !== "none") out.push("A hat is on: hair crown hidden.");
  if (st.engine === "glb" && ch.style !== "shapes") out.push(`${st.label} bases are single skinned GLBs: part swaps are limited to the base, colours and accessories.`);
  if (ch.style === "kamiji" && fig && ch.morphs.shapeSphere < 0.5 && !ch.morphs.shapeCube) out.push("Head accessories sit best once the hand is morphed to the sphere or cube shape.");
  return out;
}
