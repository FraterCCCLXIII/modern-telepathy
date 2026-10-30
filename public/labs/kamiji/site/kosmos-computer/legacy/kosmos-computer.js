// kosmos.computer main page. Starfield adapted from StarfieldWallpaper.tsx, orb shader from RainbowCircle/fluidShader.ts (docs).
(function () {
  "use strict";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var BG = "#0d0d0f";

  /* ---------- Starfield (warp). Reduced motion: one static frame, no loop. ---------- */
  var hero = document.querySelector(".hero");
  var canvas = document.getElementById("stars");
  if (hero && canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d");
    var FL = 500, SPEED = 1.6, BASE_R = 0.45;
    var W = 0, H = 0, cx = 0, cy = 0, mx = 0, my = 0, tx = 0, ty = 0, raf = 0, visible = true;
    var parts = [];
    function rnd(p) { p.x = Math.random() * W; p.y = Math.random() * H; p.z = Math.random() * 1500 + 500; p.pz = p.z; return p; }
    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = hero.clientWidth; H = hero.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = mx = tx = W / 2; cy = my = ty = H / 2;
      var n = W < 769 ? 120 : 220;
      parts = [];
      for (var i = 0; i < n; i++) parts.push(rnd({}));
      draw(true);
    }
    function draw(still) {
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff"; ctx.beginPath();
      var half = Math.PI / 2;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (!still) { p.pz = p.z; p.z -= SPEED; if (p.z <= 0) { rnd(p); continue; } } else p.pz = p.z + 18;
        var ox = cx - (mx - cx) * 0.65, oy = cy - (my - cy) * 0.65;
        var rx = p.x - ox, ry = p.y - oy;
        var f = FL / p.z, x = ox + rx * f, y = oy + ry * f, r = BASE_R * f;
        var pf = FL / p.pz, px = ox + rx * pf, py = oy + ry * pf, pr = BASE_R * pf;
        var a = Math.atan2(py - y, px - x), a1 = a + half, a2 = a - half;
        ctx.moveTo(px + pr * Math.cos(a1), py + pr * Math.sin(a1));
        ctx.arc(px, py, pr, a1, a2, true);
        ctx.lineTo(x + r * Math.cos(a2), y + r * Math.sin(a2));
        ctx.arc(x, y, r, a2, a1, true);
        ctx.closePath();
      }
      ctx.fill();
    }
    function loop() {
      raf = 0;
      if (reduced.matches || !visible || document.hidden) return;
      mx += (tx - mx) * 0.018; my += (ty - my) * 0.018;
      draw(false);
      raf = requestAnimationFrame(loop);
    }
    function kick() { if (!raf && !reduced.matches && visible && !document.hidden) raf = requestAnimationFrame(loop); }
    new ResizeObserver(size).observe(hero);
    window.addEventListener("mousemove", function (e) { var r = hero.getBoundingClientRect(); tx = e.clientX - r.left; ty = e.clientY - r.top; }, { passive: true });
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; kick(); }).observe(hero);
    document.addEventListener("visibilitychange", kick);
    var onRM = function () { if (reduced.matches) { if (raf) cancelAnimationFrame(raf); raf = 0; draw(true); } else kick(); };
    if (reduced.addEventListener) reduced.addEventListener("change", onRM);
    size(); kick();
  }

  /* ---------- Orb (WebGL fluid shader from the docs home). ---------- */
  var orb = document.getElementById("orb");
  if (orb) {
    var oc = orb.querySelector("canvas");
    var gl = oc.getContext("webgl", { alpha: false, antialias: true });
    var VS = "attribute vec4 position;void main(){gl_Position=position;}";
    var FS = "precision mediump float;uniform vec2 u_res;uniform float u_time;uniform vec2 u_mouse;" +
      "vec3 hue2rgb(float h){h=fract(h);float r=abs(h*6.0-3.0)-1.0;float g=2.0-abs(h*6.0-2.0);float b=2.0-abs(h*6.0-4.0);return clamp(vec3(r,g,b),0.0,1.0);}" +
      "void main(){vec2 st=gl_FragCoord.xy/u_res.xy;st.x*=u_res.x/u_res.y;vec2 center=vec2(0.5*u_res.y/u_res.x,0.5);vec2 m=u_mouse;m.x*=u_res.x/u_res.y;float t=u_time*0.45;" +
      "float waveA=sin(st.x*3.2+t);float waveB=cos(st.y*2.8-t*0.9);float waveC=sin((st.x+st.y)*2.4+t*1.1);float blend=(waveA+waveB+waveC)/3.0;" +
      "float hue=fract(blend*0.22+t*0.18+length(st-center)*0.35+(st.x-m.x)*0.08+(st.y-m.y)*0.08);" +
      "vec3 col=hue2rgb(hue);col=mix(col,hue2rgb(hue+0.12),smoothstep(-0.2,0.6,blend)*0.35);gl_FragColor=vec4(col,1.0);}";
    var prog = null;
    if (gl) {
      var sh = function (t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
      var v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, FS);
      if (v && f) {
        prog = gl.createProgram(); gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) prog = null;
      }
    }
    if (prog) {
      gl.useProgram(prog);
      var pos = gl.getAttribLocation(prog, "position"), buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      var uR = gl.getUniformLocation(prog, "u_res"), uT = gl.getUniformLocation(prog, "u_time"), uM = gl.getUniformLocation(prog, "u_mouse");
      var ow = 1, oh = 1, oraf = 0, ovis = true, mouse = [0.42, 0.58];
      var osz = function () {
        var r = orb.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
        ow = Math.max(1, Math.round(r.width * d)); oh = Math.max(1, Math.round(r.height * d));
        oc.width = ow; oc.height = oh; shot(performance.now());
      };
      var shot = function (t) {
        gl.useProgram(prog); gl.viewport(0, 0, ow, oh);
        gl.enableVertexAttribArray(pos); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(uR, ow, oh); gl.uniform1f(uT, t * 0.001); gl.uniform2f(uM, mouse[0], mouse[1]);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      };
      var ol = function (t) { oraf = 0; if (reduced.matches || !ovis || document.hidden) return; shot(t); oraf = requestAnimationFrame(ol); };
      var okick = function () { if (!oraf && !reduced.matches && ovis && !document.hidden) oraf = requestAnimationFrame(ol); };
      new ResizeObserver(osz).observe(orb);
      new IntersectionObserver(function (es) { ovis = es[0].isIntersecting; okick(); }).observe(orb);
      document.addEventListener("visibilitychange", okick);
      if (reduced.addEventListener) reduced.addEventListener("change", okick);
      osz(); okick();
    } else { oc.style.display = "none"; }
  }

  /* ---------- Mobile menu ---------- */
  var menu = document.querySelector(".pill-menu"), nav = document.getElementById("pill-nav");
  if (menu && nav) {
    var setMenu = function (open) { nav.classList.toggle("open", open); menu.setAttribute("aria-expanded", open ? "true" : "false"); menu.textContent = open ? "Close" : "Menu"; };
    menu.addEventListener("click", function () { setMenu(!nav.classList.contains("open")); });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && nav.classList.contains("open")) { setMenu(false); menu.focus(); } });
  }

  /* ---------- Dock tabs ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".dk"));
  var wtitle = document.getElementById("win-title");
  function pick(t, focus) {
    tabs.forEach(function (b) {
      var on = b === t;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
      document.getElementById(b.dataset.panel).hidden = !on;
    });
    wtitle.textContent = t.dataset.title;
    if (focus) t.focus();
  }
  tabs.forEach(function (b, i) {
    b.addEventListener("click", function () { pick(b, false); });
    b.addEventListener("keydown", function (e) {
      var k = e.key, n = tabs.length;
      if (k === "ArrowRight") { e.preventDefault(); pick(tabs[(i + 1) % n], true); }
      else if (k === "ArrowLeft") { e.preventDefault(); pick(tabs[(i + n - 1) % n], true); }
      else if (k === "Home") { e.preventDefault(); pick(tabs[0], true); }
      else if (k === "End") { e.preventDefault(); pick(tabs[n - 1], true); }
    });
  });

  /* ---------- Apps grid (names from src/os/systemApps.tsx i18n titles) ---------- */
  var apps = ["Chat", "Techno Studio", "Apps", "Skills", "Agents", "Memory", "Key Wallet", "Automations", "Drive", "Maps", "Search", "Longformer",
    "Kamiji", "Music", "Video", "Meet", "Notes", "Email", "Calendar", "Tasks", "Board", "Sheets", "Image Gen", "Terminal"];
  var grid = document.getElementById("appgrid");
  if (grid) apps.forEach(function (name, i) {
    var li = document.createElement("li");
    var ico = document.createElement("span");
    ico.className = "app-ico"; ico.setAttribute("aria-hidden", "true");
    ico.style.setProperty("--h", String((i * 47 + 215) % 360));
    ico.textContent = name.charAt(0);
    li.appendChild(ico); li.appendChild(document.createTextNode(name));
    grid.appendChild(li);
  });

  /* ---------- Platform sphere (simplified from PlatformSphere.tsx) ---------- */
  var sph = document.getElementById("sphere");
  if (sph) {
    var labels = ["Desktop", "Android APK", "iOS", "Chromebook", "SteamOS", "Browser / PWA", "Self-host", "Kosmos Cloud"];
    var items = labels.map(function (l, i) {
      var el = document.createElement("span"); el.className = "sp"; el.textContent = l; sph.appendChild(el);
      var n = labels.length, y = 1 - (i + 0.5) * 2 / n, r = Math.sqrt(1 - y * y), th = i * 2.399963;
      return { el: el, x: Math.cos(th) * r, y: y, z: Math.sin(th) * r };
    });
    var ang = 0.5, sraf = 0, svis = true;
    var place = function () {
      var R = sph.clientWidth * 0.36, c = Math.cos(ang), s = Math.sin(ang);
      items.forEach(function (it) {
        var x = it.x * c + it.z * s, z = -it.x * s + it.z * c, k = (z + 1.6) / 2.6;
        it.el.style.transform = "translate(-50%,-50%) translate(" + (x * R).toFixed(1) + "px," + (it.y * R * 0.9).toFixed(1) + "px) scale(" + (0.75 + 0.35 * k).toFixed(3) + ")";
        it.el.style.opacity = (0.35 + 0.65 * k).toFixed(2);
        it.el.style.zIndex = String(Math.round(k * 10));
      });
    };
    var sl = function () { sraf = 0; if (reduced.matches || !svis || document.hidden) return; ang += 0.006; place(); sraf = requestAnimationFrame(sl); };
    var skick = function () { if (!sraf && !reduced.matches && svis && !document.hidden) sraf = requestAnimationFrame(sl); };
    new IntersectionObserver(function (es) { svis = es[0].isIntersecting; skick(); }).observe(sph);
    document.addEventListener("visibilitychange", skick);
    if (reduced.addEventListener) reduced.addEventListener("change", function () { place(); skick(); });
    window.addEventListener("resize", place);
    place(); skick();
  }
})();
