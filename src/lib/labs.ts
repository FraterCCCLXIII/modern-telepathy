/**
 * Catalog of the static sites and demos served from `public/labs/`.
 * Each entry is plain HTML that Vercel serves as-is; the React app only links to it.
 * `project` ties a lab to a project slug in `projects.tsx` (shown on that project page).
 */
import type { GroupId } from "@/lib/groups";

export type Lab = {
  id: string;
  title: string;
  blurb: string;
  href: string;
  group: GroupId;
  project?: string;
};


const K = "/labs/kamiji/site";

export const labs: Lab[] = [
  { id: "kamiji-home", title: "Kamiji", blurb: "The rigged 3D hand avatar and its characters.", href: `${K}/`, group: "creative", project: "kamiji" },
  { id: "studio", title: "Studio", blurb: "Character creator with swappable parts, morphs, accessories and GLB export.", href: `${K}/studio/`, group: "creative", project: "kamiji" },
  { id: "workshop", title: "Workshop: hand", blurb: "Poses, expressions and motions for the Kamiji hand.", href: `${K}/workshop/hand.html`, group: "creative", project: "kamiji" },
  { id: "workshop-emoji", title: "Workshop: hand emoji", blurb: "The animated hand emoji set.", href: `${K}/workshop/emoji.html`, group: "creative", project: "kamiji" },
  { id: "workshop-kamikin", title: "Workshop: Kamikin", blurb: "Kamikin characters with expressions and motions.", href: `${K}/workshop/kamikin.html`, group: "creative", project: "kamiji" },
  { id: "hands", title: "Hands", blurb: "Your code could use a hand: the avatar for agents.", href: `${K}/hands/`, group: "creative", project: "kamiji" },
  { id: "subtitles", title: "Subtitles", blurb: "A playground for talking characters.", href: `${K}/subtitles/`, group: "language", project: "kamiji" },
  { id: "voice-lab", title: "Voice Lab", blurb: "Try the Kamiji voices.", href: `${K}/voice-lab/`, group: "language", project: "kamiji" },
  { id: "previs", title: "Previs", blurb: "A story map, timeline and storyboard with live 3D scenes.", href: `${K}/previs/`, group: "creative", project: "kamiji" },
  { id: "arco", title: "Arco", blurb: "Generative UI for agents.", href: `${K}/arco/`, group: "systems", project: "arco" },
  { id: "ui-experiments", title: "UI Experiments", blurb: "A gallery of interface experiments.", href: `${K}/ui-experiments/`, group: "systems" },
  { id: "sidekicks", title: "Sidekicks", blurb: "Control plane for agent sidekicks.", href: `${K}/sidekicks/`, group: "systems" },

  { id: "kosmos", title: "Reality Kosmos Engine", blurb: "The engine page: what runs and how.", href: `${K}/kosmos/`, group: "systems", project: "kosmos-engine" },
  { id: "kosmos-computer", title: "Kosmos computer", blurb: "The generative AI operating system, as first sketched.", href: `${K}/kosmos-computer/`, group: "systems", project: "kosmos" },
  { id: "kosmographica", title: "Kosmographica", blurb: "Knowledge graph.", href: `${K}/kosmographica/`, group: "knowledge", project: "kosmographica" },

  { id: "templeos-site", title: "TempleOS website", blurb: "The product site: download, apps, developers, security and history.", href: "/labs/templeos/site/", group: "systems", project: "templeos" },
  { id: "templeos-docs", title: "TempleOS desktop docs", blurb: "Plans and specs for the HolyC desktop, its browser and its host apps.", href: "/labs/templeos/docs/", group: "systems", project: "templeos" },

  { id: "kamikin", title: "Kamikin", blurb: "Learn Japanese with small friends.", href: `${K}/kamikin/`, group: "language" },
  { id: "yakopop", title: "Yakopop", blurb: "Learn languages from the words on screen.", href: `${K}/yakopop/`, group: "language", project: "yakopop" },
  { id: "sutraya", title: "Sutraya", blurb: "Ancient text library.", href: `${K}/sutraya/`, group: "language", project: "sutraya" },
  { id: "longformer", title: "Longformer", blurb: "From long-form audio to a book plan.", href: `${K}/longformer/`, group: "language", project: "longformer" },
  { id: "newsphere", title: "Newsphere", blurb: "Feed reader.", href: `${K}/newsphere/`, group: "language", project: "newsphere" },

  { id: "kamae", title: "Kamae Blade Duels", blurb: "A small duelling game.", href: `${K}/kamae/`, group: "games" },
  { id: "triunfi", title: "Triunfi Card Lab", blurb: "Card lab.", href: `${K}/triunfi/`, group: "games" },
  { id: "castbook", title: "CastBook", blurb: "Casting, kept simple.", href: `${K}/castbook/`, group: "creative" },
];

export const labsForProject = (slug: string) => labs.filter((l) => l.project === slug);
export const labsInGroup = (id: GroupId) => labs.filter((l) => l.group === id);
