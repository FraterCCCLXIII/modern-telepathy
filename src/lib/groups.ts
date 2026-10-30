/** One grouping used by projects, labs, the home page and both navs. Order here is display order. */
export type GroupId = "systems" | "creative" | "language" | "knowledge" | "games" | "business" | "tools";

export const groups: { id: GroupId; label: string; blurb: string }[] = [
  { id: "systems", label: "Kosmos & systems", blurb: "The operating system, the desktop and the plumbing agents run on." },
  { id: "creative", label: "Characters & creative", blurb: "Avatars, characters, writing and casting." },
  { id: "language", label: "Language, audio & reading", blurb: "Learn, translate, transcribe and read." },
  { id: "knowledge", label: "Knowledge & community", blurb: "Maps of culture, search, and places to learn together." },
  { id: "games", label: "Games", blurb: "Small games and card labs." },
  { id: "tools", label: "Everyday tools", blurb: "Small, finished tools for the desktop and the phone." },
  { id: "business", label: "Business & web tools", blurb: "Signing, booking and publishing." },
];

export const groupLabel = (id: GroupId) => groups.find((g) => g.id === id)!.label;
