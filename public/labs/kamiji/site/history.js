// Renders site/history.json (built from docs/history.md) as a timeline.
const list = document.getElementById("timeline");

function figure(entry) {
  const wrap = document.createElement("div");
  wrap.className = "tl-img";
  if (entry.w && entry.h) wrap.style.aspectRatio = `${entry.w} / ${entry.h}`;
  const img = document.createElement("img");
  img.src = entry.image;
  img.alt = entry.alt || "";
  img.loading = "lazy";
  img.decoding = "async";
  if (entry.w && entry.h) {
    img.width = entry.w;
    img.height = entry.h;
  }
  img.addEventListener("error", () => wrap.remove());
  wrap.append(img);
  return wrap;
}

function item(entry) {
  const li = document.createElement("li");
  li.className = `tl-item tl-${entry.kind}`;
  const date = document.createElement("time");
  date.dateTime = entry.date;
  date.textContent = entry.date;
  const body = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = entry.title;
  const text = document.createElement("p");
  text.textContent = entry.summary;
  const meta = document.createElement("p");
  meta.className = "tl-meta";
  meta.textContent = `${entry.project} / ${entry.source}`;
  body.append(title, text);
  if (entry.image) body.append(figure(entry));
  body.append(meta);
  li.append(date, body);
  return li;
}

async function load() {
  if (!list) return;
  try {
    const res = await fetch("history.json");
    if (!res.ok) throw new Error(String(res.status));
    const entries = await res.json();
    list.replaceChildren(...entries.map(item));
  } catch (err) {
    list.replaceChildren();
    const li = document.createElement("li");
    li.className = "tl-loading";
    li.textContent = "History could not be loaded. See docs/history.md in the repository.";
    list.append(li);
    console.error("Kamiji history error", err);
  }
}

load();
