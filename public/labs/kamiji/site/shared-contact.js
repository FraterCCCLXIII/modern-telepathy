// Shared "Contact us" section for every page. One file, one lookup table by path.
// Pages load it with <script type="module" src="shared-contact.js"> (or ../shared-contact.js from a subfolder).
// It adds <section id="contact"> before the footer, unless the page already has a #contact (the Kamiji home page writes its own).
// It reuses each page's own classes (style.css on the light pages, kosmos-computer.css on the dark one), so there is no extra CSS.
// The button is a mailto: link. Nothing is sent from the page.
const TO = "openartist@gmail.com";

const COPY = {
  kosmos: {
    title: "Contact us",
    sub: "Want to know more about the Kosmos engine, or get access? The repository is private today, so access starts with a conversation.",
    items: [
      ["Access to the engine", "Tell us what you would like to build and we will reply with what can be shared. No public build exists yet."],
      ["Previs and film", "How shots, cameras, timelines and the film player work, and how agents can drive them."],
      ["Game and character tools", "Scenes, characters, animation, the editor and the character studios."],
    ],
    note: "Tell us who you are, what you would like to make and what you need from the engine. No prices or dates are fixed.",
    subject: "Kosmos engine: question and access",
    body: ["Hi,", "", "I would like to know more about the Kosmos engine and ask about access.", "", "Name / company:", "What I would like to make (previs, game, characters, other):", "Platform I work on:", "Questions:", "", "Thanks,"],
  },
  hands: {
    title: "Contact us",
    sub: "Want to know more about Hands, get access or get it set up? Write to us.",
    items: [
      ["Access", "Ask how to get started and which option fits your team."],
      ["Getting it set up", "Tell us where you want to run it and what you want it to do, and we will reply with what we know."],
      ["The product itself", "For official documentation and the canvas, see docs.openhands.dev."],
    ],
    note: "Questions about this page and about the avatars are welcome too.",
    subject: "Hands: access and set-up",
    body: ["Hi,", "", "I would like to know more about Hands and get access.", "", "Name / company:", "Where I would like to run it:", "Questions:", "", "Thanks,"],
  },
  castbook: {
    title: "Contact us",
    sub: "Want to know more about CastBook and get access? Write to us.",
    items: [
      ["Access", "Tell us about your casting work and we will reply with how to get it."],
      ["Self-hosting", "CastBook is self-hosted, so say where you would run it and who would use it."],
    ],
    note: "Tell us how many actors and projects you manage and which languages you need.",
    subject: "CastBook: access",
    body: ["Hi,", "", "I would like to know more about CastBook and get access.", "", "Name / company:", "What I cast (film, theatre, ads, other):", "Where I would host it:", "Questions:", "", "Thanks,"],
  },
  yakopop: {
    title: "Contact us",
    sub: "Want to know more about Yakopop, its components or how transcripts and translations are made? Write to us. For the learning platform itself, use yakopop.com.",
    items: [
      ["The components", "Which parts of the subtitle overlay and the talk tools exist today, and how far each one is."],
      ["Using them in your own video or game", "Tell us what carries the clock (a video, a film, a game) and which languages you teach, and we will reply with what we know."],
    ],
    note: "The source code is private, and no public package or embed widget is documented yet. The demos on this page run on sample data.",
    subject: "Yakopop components: question",
    body: ["Hi,", "", "I would like to know more about the Yakopop components.", "", "Name / company:", "What I would like to show subtitles over (video, film, game, other):", "Languages:", "Questions:", "", "Thanks,"],
    link: ["yakopop.com", "https://yakopop.com"],
  },
  longformer: {
    title: "Contact us",
    sub: "Want to know more about Longformer, the book planner the app calls Podbook? Write to us.",
    items: [
      ["How far it goes", "Which parts run on the mock backend today and which are only planned."],
      ["Trying it or using the Canvas view", "Tell us what content you want to turn into a book and where you would run it."],
    ],
    note: "The repository is public on GitHub. It is early stage and has no README yet.",
    subject: "Longformer: question",
    body: ["Hi,", "", "I would like to know more about Longformer.", "", "Name / company:", "What I would like to turn into a book (podcast, video, text, other):", "Questions:", "", "Thanks,"],
    link: ["GitHub", "https://github.com/FraterCCCLXIII/longformer"],
  },
  kamae: {
    title: "Contact us",
    sub: "Want to know more about Kamae or how far the game goes today? Write to us.",
    items: [
      ["How far it goes", "Which parts of the duel, multiplayer and replays run today and which are untested."],
      ["Rights and art", "Ask about the origin of the code and the AI-generated art."],
    ],
    note: "Prototype. Rights to the code are still being confirmed, so nothing here is a public release.",
    subject: "Kamae: question",
    body: ["Hi,", "", "I would like to know more about Kamae.", "", "Name / company:", "Questions:", "", "Thanks,"],
  },
  newsphere: {
    title: "Contact us",
    sub: "Want to know more about Newsphere or try the beta? Write to us.",
    items: [
      ["Platforms", "The beta targets Apple Silicon. Other platforms are untested."],
      ["The assistant", "It is optional and uses a key you supply."],
    ],
    note: "Beta. No public download is linked from this page.",
    subject: "Newsphere: question",
    body: ["Hi,", "", "I would like to know more about Newsphere.", "", "Name / company:", "Questions:", "", "Thanks,"],
  },
  sutraya: {
    title: "Contact us",
    sub: "Want to know more about Sutraya or its corpus? Write to us.",
    items: [
      ["The corpus", "Which texts are included and under which licences."],
      ["Ask and OCR", "These need a model or service you supply."],
    ],
    note: "Prototype. Corpus licences are listed on the page; check them before reuse.",
    subject: "Sutraya: question",
    body: ["Hi,", "", "I would like to know more about Sutraya.", "", "Name / company:", "Questions:", "", "Thanks,"],
  },
  triunfi: {
    title: "Contact us",
    sub: "Want to know more about Triunfi, the open card game engine? Write to us.",
    items: [
      ["The engine and sets", "How the rule modules, card JSON and simulator fit together."],
      ["Licence", "The card sets and the code carry different licence notes; ask before reuse."],
    ],
    note: "Prototype. The numbers on the page are quoted from the repository's reports, not re-run.",
    subject: "Triunfi: question",
    body: ["Hi,", "", "I would like to know more about Triunfi.", "", "Name / company:", "Questions:", "", "Thanks,"],
  },
  sidekicks: {
    title: "Contact us",
    sub: "Want to know more about Sidekicks, the agent runtime control plane? Write to us.",
    items: [
      ["How far it goes", "Which runtimes and deploy paths work today."],
      ["Running it", "Docker Compose runs it locally; details are in the repository."],
    ],
    note: "Prototype with no automated tests.",
    subject: "Sidekicks: question",
    body: ["Hi,", "", "I would like to know more about Sidekicks.", "", "Name / company:", "Questions:", "", "Thanks,"],
  },
  kosmographica: {
    title: "Contact us",
    sub: "Want to know more about Kosmographica, the provenance-first knowledge graph? Write to us.",
    items: [
      ["The claim model", "How claims, sources and trust tiers are meant to work."],
      ["The data", "Which snapshots exist and which parts are only planned."],
    ],
    note: "Early build. Counts on the page are quoted from the snapshot, not recounted.",
    subject: "Kosmographica: question",
    body: ["Hi,", "", "I would like to know more about Kosmographica.", "", "Name / company:", "Questions:", "", "Thanks,"],
  },
  kamikin: {
    title: "Contact us",
    sub: "Want to know more about Kamikin, use the characters or get access? Write to us.",
    items: [
      ["Using the characters", "Free for non-commercial use with credit. For-profit use comes under the Premium Licence, still a draft term sheet."],
      ["The game", "No public play site is live yet. Ask what can be shared."],
    ],
    note: "Tell us where the characters would appear and roughly when you need them.",
    subject: "Kamikin: question and access",
    body: ["Hi,", "", "I would like to know more about Kamikin and get access.", "", "Name / company:", "Where I would use the characters:", "Questions:", "", "Thanks,"],
  },
  "kosmos-computer": {
    title: "Questions about this page",
    sub: "Want to know more about kosmos.computer, the generative AI operating system, or about this page? Write to us. For the product itself, use its own site and docs. It is a different product from the Kosmos 3D engine and from Kamiji.",
    items: [],
    note: "",
    subject: "kosmos.computer: question",
    body: ["Hi,", "", "I have a question about kosmos.computer.", "", "Name / company:", "Questions:", "", "Thanks,"],
    link: ["kosmos.computer", "https://www.kosmos.computer/"],
  },
  arco: {
    title: "Contact us",
    sub: "Want to know more about Arco UI, the generative UI library of kosmos.computer? Write to us. For the product itself, use its own site and docs.",
    items: [
      ["The cards and the library", "Which blocks, tokens and SDK pieces exist today, and how far each one is."],
      ["Using it with your agent", "Tell us what your agent should generate and where it should appear, and we will reply with what we know."],
    ],
    note: "Arco UI is a different product from the Kosmos 3D engine and from Kamiji. This page and its demo are scripted; no AI model runs on it.",
    subject: "Arco UI: question",
    body: ["Hi,", "", "I would like to know more about Arco UI.", "", "Name / company:", "What I would like my agent to generate:", "Questions:", "", "Thanks,"],
    link: ["kosmos.computer", "https://www.kosmos.computer/"],
  },
  "ui-experiments": {
    title: "Contact us",
    sub: "Want to know more about the UI Experiments gallery, or about a component in it? Write to us.",
    items: [
      ["The components", "Where each one comes from in the owner's workspace and how far it goes today."],
      ["Using one in your own project", "Tell us which component and where it would run, and we will reply with what we know."],
    ],
    note: "Prototype gallery of experiments. Nothing here is a released package, and the previews run on sample data.",
    subject: "UI Experiments: question",
    body: ["Hi,", "", "I would like to know more about the UI Experiments components.", "", "Name / company:", "Which component:", "Questions:", "", "Thanks,"],
  },
  previs: {
    title: "Contact us",
    sub: "Want to know more about Previs, or to try it on your own scenes? Write to us.",
    items: [
      ["What it is today", "A working prototype: a story map of live 3D scenes, a timeline, a storyboard strip and a viewport. Audio and video export are not built."],
      ["Using your own scenes", "Today it uses the Kamiji, Kamikin and Rubbernose models from this repository. Tell us what you would bring and we will reply with what we know."],
    ],
    note: "Tell us what you plan to previsualise and which team would use it. No prices or dates are fixed.",
    subject: "Previs: question",
    body: ["Hi,", "", "I would like to know more about Previs.", "", "Name / company:", "What I would like to previsualise:", "Questions:", "", "Thanks,"],
  },
  studio: {
    title: "Contact us",
    sub: "Want to know more about Studio, or to bring your own character parts? Write to us.",
    items: [
      ["What it is today", "A working prototype character creator: part swaps, morph sliders, colours, accessories, poses and JSON / GLB export. Procedural parts are marked as such."],
      ["Using your own parts", "Today it uses the Kamiji, Kamikin and Rubbernose GLBs in this repository plus procedural parts. Tell us what you would bring and we will reply with what we know."],
    ],
    note: "Tell us what you plan to build with characters and which tools you use. No prices or dates are fixed.",
    subject: "Studio: question",
    body: ["Hi,", "", "I would like to know more about Studio.", "", "Name / company:", "What I would like to make:", "Questions:", "", "Thanks,"],
  },
  default: {
    title: "Contact us",
    sub: "Want to know more or get access? Write to us.",
    items: [],
    note: "",
    subject: "Question from the site",
    body: ["Hi,", "", "I would like to know more.", "", "Name / company:", "Questions:", "", "Thanks,"],
  },
};

function key(path) {
  if (/\/kosmos-computer\//.test(path)) return "kosmos-computer";
  for (const k of ["kosmos", "hands", "castbook", "kamikin", "arco", "yakopop", "longformer", "kamae", "newsphere", "sutraya", "triunfi", "sidekicks", "kosmographica", "ui-experiments", "previs", "studio"]) if (new RegExp("/" + k + "/").test(path)) return k;
  return "default";
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function build() {
  if (document.getElementById("contact")) return;
  const c = COPY[key(location.pathname)];
  const href = "mailto:" + TO + "?subject=" + encodeURIComponent(c.subject) + "&body=" + encodeURIComponent(c.body.join("\n") + "\n");
  const dark = document.body.classList.contains("sx-dark");
  const sec = el("section", dark ? "sec sec-alt" : "section");
  sec.id = "contact";
  const wrap = el("div", dark ? "wrap" : "wrap split");
  sec.append(wrap);
  const note = "The button opens an email to " + TO + ". Nothing is sent from this page.";
  if (dark) {
    wrap.append(el("p", "eyebrow", "Contact"), el("h2", "h2", c.title), el("p", "lead", c.sub));
    const btns = el("p", "btns left");
    const a = el("a", "btn btn-cream", "Contact us");
    a.href = href;
    btns.append(a);
    if (c.link) {
      const l = el("a", "btn btn-ghost", c.link[0]);
      l.href = c.link[1];
      l.rel = "noopener";
      btns.append(l);
    }
    wrap.append(btns, el("p", "note", note));
  } else {
    const side = el("div", "side");
    side.append(el("h2", null, c.title), el("p", "sub", c.sub));
    const row = el("p", "cta-row");
    const a = el("a", "cta", "Contact us");
    a.href = href;
    row.append(a);
    side.append(row, el("p", "quiet", note));
    const main = el("div");
    if (c.items.length) {
      const ul = el("ul", "list");
      for (const [h, p] of c.items) {
        const li = el("li");
        li.append(el("h3", null, h), el("p", null, p));
        ul.append(li);
      }
      main.append(ul);
    }
    if (c.note) main.append(el("p", "small", c.note));
    wrap.append(side, main);
  }
  const foot = document.querySelector("footer.site-footer, footer.foot, footer");
  if (foot) foot.before(sec);
  else document.body.append(sec);
  if (location.hash === "#contact") sec.scrollIntoView();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
else build();
