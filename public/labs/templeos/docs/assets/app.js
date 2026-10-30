/* TempleOS docs: theme, drawer, nav scroll memory, full-text search, copy buttons, toc highlight. No network. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement, rootPath = root.getAttribute("data-root") || "";
  function ls(op, k, v) { try { return op === "get" ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch (e) { return null; } }
  function ss(op, k, v) { try { return op === "get" ? sessionStorage.getItem(k) : sessionStorage.setItem(k, v); } catch (e) { return null; } }

  /* theme */
  function isDark() {
    var t = root.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  }
  Array.prototype.forEach.call(doc.querySelectorAll(".theme-btn"), function (b) {
    b.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      root.setAttribute("data-theme", next);
      ls("set", "td-theme", next);
    });
  });

  /* drawer */
  var menu = doc.querySelector(".menu-btn"), scrim = doc.querySelector(".scrim"), side = doc.getElementById("sidebar");
  function drawer(open) {
    doc.body.classList.toggle("drawer", open);
    if (menu) menu.setAttribute("aria-expanded", open ? "true" : "false");
    if (scrim) scrim.hidden = !open;
    if (open) { var q = doc.getElementById("q"); if (q && window.innerWidth <= 900) q.focus(); }
  }
  if (scrim) scrim.hidden = true;
  if (menu) menu.addEventListener("click", function () { drawer(!doc.body.classList.contains("drawer")); });
  if (scrim) scrim.addEventListener("click", function () { drawer(false); });
  doc.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (doc.body.classList.contains("drawer")) { drawer(false); if (menu) menu.focus(); } } });

  /* nav scroll position kept across pages */
  var tree = doc.getElementById("tree");
  if (tree) {
    var saved = ss("get", "td-scroll");
    var cur = tree.querySelector('[aria-current="page"]');
    if (saved !== null) tree.scrollTop = parseInt(saved, 10) || 0;
    if (cur) {
      var r = cur.getBoundingClientRect(), tr = tree.getBoundingClientRect();
      if (r.top < tr.top || r.bottom > tr.bottom) tree.scrollTop += r.top - tr.top - tr.height / 3;
    }
    var openSecs = [];
    try { openSecs = JSON.parse(ss("get", "td-open") || "[]"); } catch (e) { openSecs = []; }
    Array.prototype.forEach.call(tree.querySelectorAll("details"), function (d) {
      var name = d.getAttribute("data-sec");
      if (openSecs.indexOf(name) >= 0) d.open = true;
      d.addEventListener("toggle", function () {
        var list = Array.prototype.filter.call(tree.querySelectorAll("details"), function (x) { return x.open; }).map(function (x) { return x.getAttribute("data-sec"); });
        ss("set", "td-open", JSON.stringify(list));
      });
    });
    function keep() { ss("set", "td-scroll", String(tree.scrollTop)); }
    tree.addEventListener("scroll", keep, { passive: true });
    tree.addEventListener("click", keep);
  }

  /* copy buttons */
  Array.prototype.forEach.call(doc.querySelectorAll("figure.code .copy"), function (b) {
    b.addEventListener("click", function () {
      var code = b.closest("figure").querySelector("code").innerText;
      function done(ok) { b.textContent = ok ? "Copied" : "Press Ctrl+C"; setTimeout(function () { b.textContent = "Copy"; }, 1600); }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(code).then(function () { done(true); }, function () { done(false); });
      } else {
        var ta = doc.createElement("textarea"); ta.value = code; ta.style.position = "fixed"; ta.style.opacity = "0";
        doc.body.appendChild(ta); ta.select(); var ok = false;
        try { ok = doc.execCommand("copy"); } catch (e) {}
        doc.body.removeChild(ta); done(ok);
      }
    });
  });

  /* on-page toc highlight */
  var tocLinks = doc.querySelectorAll(".toc a");
  if (tocLinks.length && "IntersectionObserver" in window) {
    var map = {};
    Array.prototype.forEach.call(tocLinks, function (a) { map[decodeURIComponent(a.getAttribute("href").slice(1))] = a; });
    var obs = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) {
          Array.prototype.forEach.call(tocLinks, function (a) { a.classList.remove("on"); });
          var a = map[en.target.id]; if (a) a.classList.add("on");
        }
      });
    }, { rootMargin: "0px 0px -75% 0px" });
    Object.keys(map).forEach(function (id) { var h = doc.getElementById(id); if (h) obs.observe(h); });
  }

  /* search */
  var q = doc.getElementById("q"), results = doc.getElementById("results");
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function re(terms) { return new RegExp("(" + terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")", "gi"); }
  var idx = window.__SEARCH_INDEX || [];
  var lower = null;
  function prep() { if (!lower) lower = idx.map(function (e) { return { t: (e.t + " " + e.h).toLowerCase(), x: e.x.toLowerCase() }; }); }
  function snippet(text, lc, terms) {
    var pos = -1;
    for (var i = 0; i < terms.length; i++) { var p = lc.indexOf(terms[i]); if (p >= 0 && (pos < 0 || p < pos)) pos = p; }
    if (pos < 0) return "";
    var s = Math.max(0, pos - 50), e = Math.min(text.length, pos + 120);
    return (s > 0 ? "... " : "") + text.slice(s, e) + (e < text.length ? " ..." : "");
  }
  function run() {
    var val = q.value.trim();
    if (!val) { results.hidden = true; tree.classList.remove("hide"); return; }
    prep();
    var terms = val.toLowerCase().split(/\s+/).filter(Boolean), hits = [];
    idx.forEach(function (e, i) {
      var l = lower[i], score = 0, ok = true;
      for (var k = 0; k < terms.length; k++) {
        var inT = l.t.indexOf(terms[k]) >= 0, inX = l.x.indexOf(terms[k]);
        if (!inT && inX < 0) { ok = false; break; }
        score += (inT ? 50 : 0) + (inX >= 0 ? 1 + Math.min(10, l.x.split(terms[k]).length - 1) : 0);
      }
      if (ok) hits.push({ e: e, i: i, score: score });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    var rx = re(terms), h = "";
    hits.slice(0, 40).forEach(function (hit) {
      var e = hit.e, sn = snippet(e.x, lower[hit.i].x, terms);
      var url = rootPath + e.u + "?h=" + encodeURIComponent(terms.join(" "));
      h += '<a class="res" href="' + esc(url) + '"><span class="rs">' + esc(e.s) + '</span><span class="rt">' + esc(e.t).replace(rx, "<mark>$1</mark>") + "</span>" +
        (sn ? '<span class="rx">' + esc(sn).replace(rx, "<mark>$1</mark>") + "</span>" : "") + "</a>";
    });
    results.innerHTML = h || '<p class="res-empty">No page contains all of: ' + esc(terms.join(", ")) + "</p>";
    if (hits.length > 40) results.innerHTML += '<p class="res-empty">' + (hits.length - 40) + " more; refine the query.</p>";
    results.hidden = false; tree.classList.add("hide");
  }
  if (q && results && tree) {
    q.addEventListener("input", run);
    q.addEventListener("keydown", function (e) {
      var links = results.querySelectorAll("a.res");
      if (e.key === "ArrowDown" && links.length) { e.preventDefault(); links[0].focus(); }
      else if (e.key === "Enter" && links.length) { location.href = links[0].href; }
      else if (e.key === "Escape") { q.value = ""; run(); }
    });
    results.addEventListener("keydown", function (e) {
      var a = doc.activeElement, links = Array.prototype.slice.call(results.querySelectorAll("a.res")), i = links.indexOf(a);
      if (e.key === "ArrowDown" && i < links.length - 1) { e.preventDefault(); links[i + 1].focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (i > 0) links[i - 1].focus(); else q.focus(); }
    });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test((doc.activeElement || {}).tagName || "")) {
        e.preventDefault(); if (doc.body.classList.contains("drawer") === false && window.innerWidth <= 900) drawer(true); q.focus();
      }
    });
  }

  /* highlight search terms in the article when arriving from search (?h=...) */
  var m = /[?&]h=([^&#]*)/.exec(location.search);
  if (m) {
    var terms = decodeURIComponent(m[1]).split(/\s+/).filter(Boolean);
    if (q) { q.value = terms.join(" "); }
    var body = doc.querySelector(".doc-body"), first = null;
    if (body && terms.length) {
      var rx2 = re(terms), walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, null), nodes = [], n;
      while ((n = walker.nextNode())) { if (!n.parentNode.closest("script,style,mark") && rx2.test(n.nodeValue)) nodes.push(n); rx2.lastIndex = 0; }
      nodes.slice(0, 400).forEach(function (node) {
        var frag = doc.createDocumentFragment(), t = node.nodeValue, last = 0, mm;
        rx2.lastIndex = 0;
        while ((mm = rx2.exec(t))) {
          frag.appendChild(doc.createTextNode(t.slice(last, mm.index)));
          var mk = doc.createElement("mark"); mk.textContent = mm[0]; frag.appendChild(mk); if (!first) first = mk;
          last = mm.index + mm[0].length;
        }
        frag.appendChild(doc.createTextNode(t.slice(last)));
        node.parentNode.replaceChild(frag, node);
      });
      if (first) setTimeout(function () { first.scrollIntoView({ block: "center" }); }, 50);
    }
  }
})();
