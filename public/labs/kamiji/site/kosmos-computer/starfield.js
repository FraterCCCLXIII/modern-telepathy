// Starfield for the kosmos.computer page. Ported from legacy/kosmos-computer.js (itself adapted from
// StarfieldWallpaper.tsx in the archived Arco wallpaper): perspective warp, FL 500, z 500..2000, streak
// capsules, pointer parallax with 0.018 lag. Added here: twinkle, a few shooting stars, 30 fps cap.
export function createStarfield(canvas, opts) {
  opts = opts || {};
  var density = opts.density || 1, speedK = opts.speed || 1;
  var host = canvas.parentElement;
  var ctx = canvas.getContext("2d");
  if (!ctx || !host) return { dispose: function () {} };
  var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  var FL = 500, SPEED = 1.1 * speedK, BASE_R = 0.75;
  var W = 0, H = 0, cx = 0, cy = 0, mx = 0, my = 0, tx = 0, ty = 0;
  var parts = [], shoots = [], raf = 0, last = 0, nextShoot = 0, visible = true, dead = false;

  function rnd(p) { p.x = Math.random() * W; p.y = Math.random() * H; p.z = Math.random() * 1500 + 500; p.pz = p.z; p.t = Math.random() * 6.283; return p; }
  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = host.clientWidth; H = host.clientHeight;
    if (!W || !H) return;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = mx = tx = W / 2; cy = my = ty = H / 2;
    var n = Math.round((W < 769 ? 110 : 260) * density);
    parts = [];
    for (var i = 0; i < n; i++) parts.push(rnd({}));
    shoots = [];
    draw(reduced(), 0);
  }
  function reduced() { return mq.matches; }
  function capsule(p, still, move) {
    var ox = cx - (mx - cx) * 0.65, oy = cy - (my - cy) * 0.65;
    if (move) { p.pz = p.z; p.z -= SPEED * move; if (p.z <= 0) { rnd(p); p.z = 2000; p.pz = p.z; } } else p.pz = p.z + 14;
    var rx = p.x - ox, ry = p.y - oy, half = Math.PI / 2;
    var f = FL / p.z, x = ox + rx * f, y = oy + ry * f, r = BASE_R * f;
    var pf = FL / p.pz, px = ox + rx * pf, py = oy + ry * pf, pr = BASE_R * pf;
    var a = Math.atan2(py - y, px - x), a1 = a + half, a2 = a - half;
    ctx.moveTo(px + pr * Math.cos(a1), py + pr * Math.sin(a1));
    ctx.arc(px, py, pr, a1, a2, true);
    ctx.lineTo(x + r * Math.cos(a2), y + r * Math.sin(a2));
    ctx.arc(x, y, r, a2, a1, true);
    ctx.closePath();
  }
  // still: one static frame, no motion, no shooting stars. move: frame-time scale (1 = 60 fps step).
  function draw(still, move, now) {
    ctx.clearRect(0, 0, W, H);
    var tw = (now || 0) / 1000;
    // Two alpha groups give a cheap twinkle without per-star fills.
    for (var g = 0; g < 2; g++) {
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = still ? 0.8 : 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(tw * (g ? 1.7 : 1.1) + g * 2));
      ctx.beginPath();
      for (var i = g; i < parts.length; i += 2) capsule(parts[i], still, still ? 0 : move);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (still) return;
    for (var s = shoots.length - 1; s >= 0; s--) {
      var o = shoots[s];
      o.x += o.vx * move; o.y += o.vy * move; o.life -= move;
      if (o.life <= 0) { shoots.splice(s, 1); continue; }
      var al = Math.min(1, o.life / 20) * 0.9;
      var gr = ctx.createLinearGradient(o.x, o.y, o.x - o.vx * 9, o.y - o.vy * 9);
      gr.addColorStop(0, "rgba(255,255,255," + al + ")"); gr.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = gr; ctx.lineWidth = 1.4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x - o.vx * 9, o.y - o.vy * 9); ctx.stroke();
    }
    if (now > nextShoot) {
      nextShoot = now + 3500 + Math.random() * 5500;
      if (shoots.length < 2) {
        var ang = 0.35 + Math.random() * 0.35, sp = 11 + Math.random() * 5;
        shoots.push({ x: Math.random() * W * 0.7, y: Math.random() * H * 0.45, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 42 });
      }
    }
  }
  function loop(now) {
    raf = 0;
    if (dead || reduced() || !visible || document.hidden) { last = 0; return; }
    raf = requestAnimationFrame(loop);
    if (now - last < 33) return;
    var move = last ? Math.min((now - last) / 16.67, 3) : 1;
    last = now;
    mx += (tx - mx) * 0.018 * move; my += (ty - my) * 0.018 * move;
    draw(false, move, now);
  }
  function kick() { if (!raf && !dead && !reduced() && visible && !document.hidden) raf = requestAnimationFrame(loop); }
  function onMove(e) {
    var r = host.getBoundingClientRect();
    if (e.clientY < r.top - 80 || e.clientY > r.bottom + 80) return;
    tx = e.clientX - r.left; ty = e.clientY - r.top;
  }
  function onRM() { if (reduced()) { if (raf) cancelAnimationFrame(raf); raf = 0; draw(true, 0); } else kick(); }
  var ro = new ResizeObserver(size); ro.observe(host);
  var io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; kick(); }); io.observe(host);
  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("visibilitychange", kick);
  if (mq.addEventListener) mq.addEventListener("change", onRM);
  function dispose() {
    dead = true; if (raf) cancelAnimationFrame(raf); raf = 0;
    ro.disconnect(); io.disconnect();
    window.removeEventListener("pointermove", onMove);
    document.removeEventListener("visibilitychange", kick);
    if (mq.removeEventListener) mq.removeEventListener("change", onRM);
  }
  window.addEventListener("pagehide", dispose, { once: true });
  size(); kick();
  return { dispose: dispose };
}

var c = document.getElementById("night-stars");
if (c) createStarfield(c, { density: 1.7, speed: 1 });
