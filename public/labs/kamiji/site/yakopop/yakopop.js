// Yakopop page: loads the extracted components (assets/yakopop-demo.js, ~316 KB) only when a demo comes near the viewport,
// after first paint. No network beyond that file. See README.md for how the module is built.
const mounts = [...document.querySelectorAll("[data-demo]")];
let mod = null;

function load() {
  if (!mod) mod = import("./assets/yakopop-demo.js");
  return mod;
}

async function start(el) {
  if (el.dataset.started) return;
  el.dataset.started = "1";
  try {
    const m = await load();
    el.replaceChildren();
    m.mount(el.dataset.demo, el, { lang: el.dataset.lang });
  } catch (err) {
    el.dataset.started = "";
    el.innerHTML = '<p class="loading">The live demo could not load. Reload the page to try again.</p>';
    console.error("yakopop demo:", err);
  }
}

if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); start(e.target); }
  }, { rootMargin: "400px 0px" });
  mounts.forEach((m) => io.observe(m));
} else {
  // no observer: wait for the page to settle, then load them all
  addEventListener("load", () => setTimeout(() => mounts.forEach(start), 800));
}

// language pills above the player and stack demos
document.querySelectorAll("[data-lang-for]").forEach((group) => {
  const target = document.querySelector(`[data-demo="${group.dataset.langFor}"]`);
  group.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-lang]");
    if (!b || !target) return;
    group.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    target.dataset.lang = b.dataset.lang;
    if (target.dataset.started) {
      mod?.then((m) => m.mount(target.dataset.demo, target, { lang: b.dataset.lang }));
    }
  });
});
