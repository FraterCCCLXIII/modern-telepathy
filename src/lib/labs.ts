/**
 * Catalog of the static sites and demos served from `public/labs/`.
 * Each entry is plain HTML that Vercel serves as-is; the React app only links to it.
 * `project` ties a lab to a project slug in `projects.tsx` (shown on that project page).
 */
export type Lab = {
  id: string;
  title: string;
  blurb: string;
  href: string;
  group: LabGroup;
  project?: string;
};

export type LabGroup = "Kamiji" | "Kosmos" | "TempleOS" | "Languages & text" | "Games & tools";

export const labGroups: LabGroup[] = ["Kamiji", "Kosmos", "TempleOS", "Languages & text", "Games & tools"];

const K = "/labs/kamiji/site";

export const labs: Lab[] = [
  { id: "kamiji-home", title: "Kamiji", blurb: "The rigged 3D hand avatar and its characters.", href: `${K}/`, group: "Kamiji", project: "kamiji" },
  { id: "studio", title: "Studio", blurb: "Character creator with swappable parts, morphs, accessories and GLB export.", href: `${K}/studio/`, group: "Kamiji", project: "kamiji" },
  { id: "workshop", title: "Workshop: hand", blurb: "Poses, expressions and motions for the Kamiji hand.", href: `${K}/workshop/hand.html`, group: "Kamiji", project: "kamiji" },
  { id: "workshop-emoji", title: "Workshop: hand emoji", blurb: "The animated hand emoji set.", href: `${K}/workshop/emoji.html`, group: "Kamiji", project: "kamiji" },
  { id: "workshop-kamikin", title: "Workshop: Kamikin", blurb: "Kamikin characters with expressions and motions.", href: `${K}/workshop/kamikin.html`, group: "Kamiji", project: "kamiji" },
  { id: "hands", title: "Hands", blurb: "Your code could use a hand: the avatar for agents.", href: `${K}/hands/`, group: "Kamiji", project: "kamiji" },
  { id: "subtitles", title: "Subtitles", blurb: "A playground for talking characters.", href: `${K}/subtitles/`, group: "Kamiji", project: "kamiji" },
  { id: "voice-lab", title: "Voice Lab", blurb: "Try the Kamiji voices.", href: `${K}/voice-lab/`, group: "Kamiji", project: "kamiji" },
  { id: "previs", title: "Previs", blurb: "A story map, timeline and storyboard with live 3D scenes.", href: `${K}/previs/`, group: "Kamiji", project: "kamiji" },
  { id: "arco", title: "Arco", blurb: "Generative UI for agents.", href: `${K}/arco/`, group: "Kamiji", project: "kosmos" },
  { id: "ui-experiments", title: "UI Experiments", blurb: "A gallery of interface experiments.", href: `${K}/ui-experiments/`, group: "Kamiji" },
  { id: "sidekicks", title: "Sidekicks", blurb: "Control plane for agent sidekicks.", href: `${K}/sidekicks/`, group: "Kamiji" },

  { id: "kosmos", title: "Reality Kosmos Engine", blurb: "The engine page: what runs and how.", href: `${K}/kosmos/`, group: "Kosmos", project: "kosmos" },
  { id: "kosmos-computer", title: "Kosmos computer", blurb: "The generative AI operating system, as first sketched.", href: `${K}/kosmos-computer/`, group: "Kosmos", project: "kosmos" },
  { id: "kosmographica", title: "Kosmographica", blurb: "Knowledge graph.", href: `${K}/kosmographica/`, group: "Kosmos", project: "kosmographica" },

  { id: "templeos-docs", title: "TempleOS desktop docs", blurb: "Plans and specs for the HolyC desktop, its browser and its host apps.", href: "/labs/templeos/docs/", group: "TempleOS", project: "templeos" },

  { id: "kamikin", title: "Kamikin", blurb: "Learn Japanese with small friends.", href: `${K}/kamikin/`, group: "Languages & text" },
  { id: "yakopop", title: "Yakopop", blurb: "Learn languages from the words on screen.", href: `${K}/yakopop/`, group: "Languages & text" },
  { id: "sutraya", title: "Sutraya", blurb: "Ancient text library.", href: `${K}/sutraya/`, group: "Languages & text" },
  { id: "longformer", title: "Longformer", blurb: "From long-form audio to a book plan.", href: `${K}/longformer/`, group: "Languages & text" },
  { id: "newsphere", title: "Newsphere", blurb: "Feed reader.", href: `${K}/newsphere/`, group: "Languages & text", project: "newsphere" },

  { id: "kamae", title: "Kamae Blade Duels", blurb: "A small duelling game.", href: `${K}/kamae/`, group: "Games & tools" },
  { id: "triunfi", title: "Triunfi Card Lab", blurb: "Card lab.", href: `${K}/triunfi/`, group: "Games & tools" },
  { id: "castbook", title: "CastBook", blurb: "Casting, kept simple.", href: `${K}/castbook/`, group: "Games & tools" },
];

export const labsForProject = (slug: string) => labs.filter((l) => l.project === slug);
