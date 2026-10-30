/** Dependency-free SVG string builders for the SVG creature families. No DOM needed. */

const ORB_PATHS = [
  "M32 6C45 5 58 15 58 31C58 47 46 58 31 58C17 58 6 47 6 32C6 17 18 7 32 6Z",
  "M30 5C44 4 59 17 58 33C57 48 44 59 30 58C16 57 5 46 6 31C7 17 17 6 30 5Z",
  "M34 6C47 8 58 19 57 34C56 49 43 58 29 57C15 56 6 44 7 29C8 15 21 4 34 6Z",
];

const mix = (hex: string, other: string, t: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const m = parseInt(other.slice(1), 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) * (1 - t) + ((m >> s) & 255) * t);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
};

/** A Wisp: a flat blob with two pill eyes. `index` picks one of three slightly different outlines. */
export function wispSvg(fill: string = "#8B5CF6", index = 0, eye = "#1a0f33"): string {
  const d = ORB_PATHS[index % ORB_PATHS.length];
  return (
    `<svg viewBox="0 0 64 64" role="img" aria-label="Wisp" xmlns="http://www.w3.org/2000/svg">` +
    `<circle cx="32" cy="33" r="31" fill="${fill}" opacity=".16"/>` +
    `<path d="${d}" fill="${fill}"/>` +
    `<rect x="21" y="23" width="7" height="19" rx="3.5" fill="${eye}"/>` +
    `<rect x="36" y="23" width="7" height="19" rx="3.5" fill="${eye}"/></svg>`
  );
}

export const MITT_ROWS = [
  ".......XX.......", ".......XX.......", "....XX.XX.XX....", "....XX.XX.XX....", "....XX.XX.XX....", ".XX.XX.XX.XX....",
  ".XX.XX.XX.XX....", ".XX.XXXXXXXX....", ".XXXXXXXXXXXXX..", ".XXXXXXXXXXXXXX.", ".XXXXXXXXXXXXXXX", "..XXXXXXXXXXXX..",
  "..XXXXXXXXXXXX..", "...XXXXXXXXXX...", "....XXXXXXXX....", "................",
];
export const SPOOKLET_ROWS = [
  "................", "....XXXXXXXX....", "...XXXXXXXXXX...", "..XXXXXXXXXXXX..", "..XXXXXXXXXXXX..", "..XXXXXXXXXXXX..",
  "..XXXXXXXXXXXX..", "..XXXXXXXXXXXX..", "..XXXXXXXXXXXX..", "..XXXXXXXXXXXX..", "..XXXXXXXXXXXX..", "..XXXXXXXXXXXX..",
  "..XXXXXXXXXXXX..", "..XXXXXXXXXXXX..", "..XX.XXXX.XXXX..", "..X...XX...XX...",
];
const MITT_EYES: [number, number, number, number][] = [[5.15, 8.5, 1.15, 3], [9.7, 8.5, 1.15, 3]];
const MITT_MOUTH = [[5, 12], [6, 13], [7, 13], [8, 13], [9, 13], [10, 12]];
const SPOOKLET_EYES: [number, number, number, number][] = [[5.15, 5.2, 1.15, 3.2], [9.7, 5.2, 1.15, 3.2]];
const SPOOKLET_MOUTH = [[7, 10], [8, 10]];

function voxels(rows: string[], fill: string, eyes: [number, number, number, number][], mouth: number[][], shift: [number, number], label: string): string {
  const dark = mix(fill, "#000000", 0.35);
  const light = mix(fill, "#ffffff", 0.4);
  let cubes = "";
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== "X") return;
      cubes +=
        `<rect x="${x + 0.04}" y="${y + 0.04}" width=".92" height=".92" fill="${fill}"/>` +
        `<rect x="${x + 0.04}" y="${y + 0.04}" width=".92" height=".26" fill="${light}" opacity=".5"/>` +
        `<rect x="${x + 0.04}" y="${y + 0.7}" width=".92" height=".26" fill="${dark}" opacity=".4"/>`;
    }),
  );
  const face =
    eyes.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="#1a0f33"/>`).join("") +
    mouth.map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1" fill="#1a0f33"/>`).join("");
  return (
    `<svg viewBox="0 0 64 64" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">` +
    `<g transform="scale(4) translate(${shift[0]} ${shift[1]})" shape-rendering="crispEdges">${cubes}${face}</g></svg>`
  );
}

export const mittSvg = (fill = "#8B5CF6") => voxels(MITT_ROWS, fill, MITT_EYES, MITT_MOUTH, [-0.5, 0.5], "Mitt");
export const spookletSvg = (fill = "#8B5CF6") => voxels(SPOOKLET_ROWS, fill, SPOOKLET_EYES, SPOOKLET_MOUTH, [0, -0.5], "Spooklet");

// Pixlings: 12 by 12 bitmaps. X body, E eye, M mouth, V visor, A antenna.
export const WANDERER_ROWS = [
  "...XXXXXX...", "..XXXXXXXX..", ".XXXXXXXXXX.", ".XXEEXXEEXX.", ".XXEEXXEEXX.", ".XXXXXXXXXX.",
  ".XXXMMMMXXX.", "..XXXXXXXX..", "...XXXXXX...", "..X.XXXX.X..", "....X..X....", "...XX..XX...",
];
export const TINKER_ROWS = [
  ".....AA.....", ".....AA.....", "..XXXXXXXX..", ".XXXXXXXXXX.", ".XVVVVVVVVX.", ".XVEVVVVEVX.",
  ".XVVVVVVVVX.", ".XXXXXXXXXX.", "..XXXXXXXX..", ".XXXXXXXXXX.", "..XX....XX..", "..XX....XX..",
];

export function pixlingSvg(kind: "wanderer" | "tinker", fill = "#f59e0b"): string {
  const rows = kind === "tinker" ? TINKER_ROWS : WANDERER_ROWS;
  const dark = mix(fill, "#000000", 0.55);
  const colour: Record<string, string> = { X: fill, A: mix(fill, "#ffffff", 0.35), V: dark, E: "#ffffff", M: dark };
  let rects = "";
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (colour[c]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${colour[c]}"/>`;
    }),
  );
  return `<svg viewBox="0 0 12 12" role="img" aria-label="${kind === "tinker" ? "Tinker" : "Wanderer"}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}
