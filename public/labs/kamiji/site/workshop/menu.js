// Workshops disclosure menu. Self-initialises on any page that has a
// [data-ws-menu] block (the home page header); studio pages call
// initWorkshopMenu() after they build their own header.
// Testing: add ?menu=open to a URL to load the page with the menu open.
import { STUDIOS } from "./studios.js";

export function initWorkshopMenu(scope = document) {
  const wrap = scope.querySelector("[data-ws-menu]");
  if (!wrap || wrap.dataset.ready) return;
  wrap.dataset.ready = "1";
  const btn = wrap.querySelector(".ws-btn");
  const menu = wrap.querySelector(".ws-menu");
  const here = location.pathname.split("/").pop();

  const list = document.createElement("ul");
  list.setAttribute("aria-label", "Workshop studios");
  STUDIOS.forEach((s) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.className = "ws-item";
    a.href = new URL(s.href, import.meta.url).href;
    if (s.href === here) a.setAttribute("aria-current", "page");
    const img = document.createElement("img");
    img.src = new URL(s.thumb, import.meta.url).href;
    img.alt = ""; img.width = 56; img.height = 56; img.loading = "lazy";
    const text = document.createElement("span");
    text.className = "ws-txt";
    const b = document.createElement("b");
    b.textContent = s.name;
    const d = document.createElement("span");
    d.textContent = s.blurb;
    text.append(b, d);
    a.append(img, text);
    li.append(a);
    list.append(li);
  });
  const foot = document.createElement("p");
  foot.className = "ws-foot";
  foot.textContent = "Early prototype editors. Each one exports code and JSON.";
  menu.replaceChildren(list, foot);

  const links = () => [...menu.querySelectorAll("a")];
  const isOpen = () => btn.getAttribute("aria-expanded") === "true";
  function open(focusFirst) {
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    if (focusFirst) links()[0]?.focus();
  }
  function close(returnFocus) {
    if (!isOpen()) return;
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    if (returnFocus) btn.focus();
  }

  btn.addEventListener("click", () => (isOpen() ? close(false) : open(false)));
  btn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (!isOpen()) open(true); else links()[0]?.focus(); }
    if (e.key === "Escape") close(false);
  });
  menu.addEventListener("keydown", (e) => {
    const items = links(), i = items.indexOf(document.activeElement);
    const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
    if (to !== undefined) { e.preventDefault(); items[(to + items.length) % items.length].focus(); }
    else if (e.key === "Escape") { e.preventDefault(); close(true); }
  });
  wrap.addEventListener("focusout", (e) => {
    if (e.relatedTarget && !wrap.contains(e.relatedTarget)) close(false);
  });
  document.addEventListener("pointerdown", (e) => { if (!wrap.contains(e.target)) close(false); });
  if (new URLSearchParams(location.search).get("menu") === "open") open(false);
}

initWorkshopMenu();
