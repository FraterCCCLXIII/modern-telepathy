// Interactive parts: the mini desktop (/try/), tabs, palette, counters, bars and the history filter. No dependencies.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---- Tabs (HolyC tour): buttons with data-tab, panels with data-panel
  $$('[data-tabs]').forEach((box) => {
    const btns = $$('[data-tab]', box), panels = $$('[data-panel]', box);
    const show = (id) => {
      btns.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
      panels.forEach((p) => { p.hidden = p.dataset.panel !== id; });
    };
    btns.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
    show(btns[0].dataset.tab);
  });

  // ---- 16-colour palette: click a swatch to see its HolyC name and copy it
  const pal = $('#palette');
  if (pal) {
    const out = $('#palette-out');
    $$('button', pal).forEach((b) => b.addEventListener('click', () => {
      out.textContent = `${b.dataset.name} = ${b.dataset.i}, ${b.dataset.hex}`;
      $$('button', pal).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      try { navigator.clipboard.writeText(b.dataset.name).catch(() => {}); } catch (e) { /* clipboard not available */ }
    }));
  }

  // ---- Permission explorer: click a word to read its plain sentence
  $$('.permx').forEach((box) => {
    const btns = $$('[data-perm]', box), texts = $$('[data-permtext]', box);
    btns.forEach((b) => b.addEventListener('click', () => {
      btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      texts.forEach((t) => { t.hidden = t.dataset.permtext !== b.dataset.perm; });
    }));
  });

  // ---- Local nav scroll-spy: highlight the link of the chapter in view
  const spy = $$('[data-spy]');
  if (spy.length && 'IntersectionObserver' in window) {
    const map = new Map(spy.map((a) => [a.dataset.spy, a]));
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { spy.forEach((a) => a.classList.toggle('on', a === map.get(e.target.id))); }
    }), { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

  // ---- Download: detect platform and architecture, label the main button, fill the menu
  const dls = $$('[data-dl]');
  if (dls.length) {
    const ua = navigator.userAgent || '';
    const plat = /iPhone|iPad|iPod|Android/i.test(ua) ? 'mobile' : /Win/i.test(navigator.platform || ua) ? 'windows' : /Mac/i.test(navigator.platform || ua) ? 'mac' : /Linux|X11|CrOS/i.test(ua) ? 'linux' : 'other';
    let arch = /arm|aarch64/i.test(ua) ? 'arm64' : /x86_64|x64|Win64|WOW64|amd64|Intel/i.test(ua) ? 'x86_64' : 'unknown';
    const gl = () => { try { const c = document.createElement('canvas').getContext('webgl'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : ''; } catch (x) { return ''; } };
    const pick = () => {
      const m = { mac: arch === 'arm64' ? 'mac-arm' : 'mac-x86', windows: arch === 'arm64' ? 'win-arm' : 'win-x86', linux: arch === 'arm64' ? 'linux-arm' : 'linux-x86', mobile: 'mobile' };
      return m[plat] || 'mac-arm';
    };
    const apply = (guess) => {
      const id = pick(), rowEl = document.getElementById(id);
      const label = (rowEl ? $('b', rowEl).textContent : null);
      dls.forEach((box) => {
        const main = $('[data-dl-main]', box);
        if (id === 'mobile') { main.textContent = 'Try it in your browser'; main.href = '/labs/templeos/site/try/'; }
        else { const item = $(`[data-id="${id}"]`, box); main.textContent = 'Download for ' + (item ? $('span', item).textContent : 'your Mac'); main.href = '/download/#' + id; }
        const cur = $(`[data-id="${id}"]`, box); if (cur) cur.classList.add('rec');
      });
      const d = $('[data-detected]'); if (d) {
        d.hidden = false; $('[data-detected-label]', d).textContent = (label || id) + (guess ? ' (best guess)' : '');
        $('[data-detected-link]', d).href = '#' + id;
        if (id === 'mobile') { $('[data-detected-link]', d).href = '/labs/templeos/site/try/'; $('[data-detected-link]', d).textContent = 'Open in your browser'; }
      }
      $$('.dltable tbody tr').forEach((r) => r.classList.toggle('match', r.id === id));
    };
    // High-entropy client hints give the real architecture on Chromium; Safari needs a guess from the GPU name.
    if (plat === 'mac' && /Apple/i.test(gl())) arch = 'arm64';
    else if (plat === 'mac') arch = 'x86_64';
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness']).then((h) => {
        if (h.architecture === 'arm') arch = 'arm64'; else if (h.architecture === 'x86') arch = 'x86_64';
        apply(false);
      }).catch(() => apply(plat === 'mac'));
    } else apply(plat === 'mac');
    dls.forEach((box) => {
      const t = $('[data-dl-toggle]', box), menu = $('[data-dl-menu]', box);
      const set = (open) => { menu.hidden = !open; t.setAttribute('aria-expanded', String(open)); };
      t.addEventListener('click', (e) => { e.stopPropagation(); set(menu.hidden); });
      document.addEventListener('click', (e) => { if (!box.contains(e.target)) set(false); });
      box.addEventListener('keydown', (e) => { if (e.key === 'Escape') { set(false); t.focus(); } });
    });
  }

  // ---- Counters: count up once when they scroll into view
  $$('[data-count]').forEach((el) => {
    const to = Number(el.dataset.count), dec = Number(el.dataset.dec || 0);
    const run = () => {
      const t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / 900); el.textContent = (to * (1 - Math.pow(1 - k, 3))).toFixed(dec); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { io.disconnect(); run(); } });
      io.observe(el);
    } else el.textContent = to.toFixed(dec);
  });

  // ---- Benchmark bars: a toggle switches the before and after numbers
  const bench = $('#bench');
  if (bench) {
    const set = (mode) => {
      $$('[data-before]', bench).forEach((row) => {
        const v = Number(row.dataset[mode]), base = Number(row.dataset.before);
        $('.bar-fill', row).style.width = `${Math.max(2, (v / base) * 100)}%`;
        $('.bar-val', row).textContent = `${v} ${row.dataset.unit}`;
      });
      $$('[data-mode]', bench).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    };
    $$('[data-mode]', bench).forEach((b) => b.addEventListener('click', () => set(b.dataset.mode)));
    set('before');
    setTimeout(() => set('after'), 900);
  }

  // ---- Filter groups: chips with data-filter narrow items with data-kind inside the same .fgroup
  $$('.fgroup').forEach((g) => {
    const chips = $$('[data-filter]', g);
    chips.forEach((c) => c.addEventListener('click', () => {
      const f = c.dataset.filter;
      chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
      $$('[data-kind]', g).forEach((el) => { el.hidden = f !== 'all' && el.dataset.kind !== f; });
    }));
  });

  // ---- Precedence demo: a*b>>1 as HolyC parses it and as C parses it
  const pd = $('#prec');
  if (pd) {
    const upd = () => {
      const a = Number($('#prec-a').value), b = Number($('#prec-b').value);
      $('#prec-av').textContent = a; $('#prec-bv').textContent = b;
      $('#prec-holyc').textContent = a * (b >> 1);
      $('#prec-c').textContent = (a * b) >> 1;
    };
    $$('input', pd).forEach((i) => i.addEventListener('input', upd));
    upd();
  }

  // ---- Mini desktop
  const dt = $('#desk');
  if (dt) {
    let z = 10;
    const wins = {};
    const focus = (w) => { w.style.zIndex = ++z; $$('.win', dt).forEach((x) => x.classList.toggle('on', x === w)); };
    $$('.win', dt).forEach((w) => {
      wins[w.dataset.app] = w;
      w.addEventListener('pointerdown', () => focus(w));
      $('.win-close', w).addEventListener('click', () => toggle(w.dataset.app, false));
      const bar = $('.win-bar', w);
      bar.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        const r = dt.getBoundingClientRect(), x0 = e.clientX - w.offsetLeft, y0 = e.clientY - w.offsetTop;
        bar.setPointerCapture(e.pointerId);
        const move = (m) => {
          w.style.left = `${Math.max(0, Math.min(r.width - 60, m.clientX - x0))}px`;
          w.style.top = `${Math.max(26, Math.min(r.height - 40, m.clientY - y0))}px`;
        };
        const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); };
        bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up);
      });
    });
    const toggle = (app, on) => {
      const w = wins[app]; if (!w) return;
      const open = on === undefined ? w.hidden : on;
      w.hidden = !open;
      $(`[data-dock="${app}"]`, dt)?.classList.toggle('open', open);
      if (open) focus(w);
    };
    $$('[data-dock]', dt).forEach((b) => b.addEventListener('click', () => toggle(b.dataset.dock)));
    ['files', 'notes'].forEach((a) => toggle(a, true));
    toggle('clock', true); toggle('calc', false); toggle('about', false);

    $('#desk-theme').addEventListener('click', () => dt.classList.toggle('dark'));
    $('#desk-glass').addEventListener('click', (e) => { dt.classList.toggle('glass'); e.currentTarget.setAttribute('aria-pressed', String(dt.classList.contains('glass'))); });

    // Clock: menubar time and world clocks
    const zones = [['Cupertino', 'America/Los_Angeles'], ['London', 'Europe/London'], ['Tokyo', 'Asia/Tokyo']];
    const tick = () => {
      const now = new Date();
      $('#desk-time').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      $('#world').innerHTML = zones.map(([n, tz]) => `<li><span>${n}</span><b>${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: tz })}</b></li>`).join('');
      const s = now.getSeconds() * 6, m = now.getMinutes() * 6 + now.getSeconds() / 10, h = (now.getHours() % 12) * 30 + now.getMinutes() / 2;
      $('#hh').style.transform = `rotate(${h}deg)`; $('#mh').style.transform = `rotate(${m}deg)`; $('#sh').style.transform = `rotate(${s}deg)`;
    };
    tick(); setInterval(tick, 1000);

    // Notes: saved in this browser only
    const notes = $('#notes');
    try { notes.value = localStorage.getItem('tos-notes') || notes.value; } catch (e) { /* storage blocked */ }
    notes.addEventListener('input', () => { try { localStorage.setItem('tos-notes', notes.value); } catch (e) { /* storage blocked */ } });

    // Files: a small fake tree; clicking a text file opens it in Notes
    const tree = { 'T:/Home': ['Demo/', 'Doc/', 'Apps/', 'Hello.HC'], 'T:/Home/Demo': ['Graphics/', 'Games/', 'Hello.HC'], 'T:/Home/Doc': ['Charter.TXT', 'HolyC.TXT'], 'T:/Home/Apps': ['Kosmos.HC', 'Browser.HC', 'Sheet.HC'] };
    const files = { 'Hello.HC': '"Hello, world!\\n";\n', 'Charter.TXT': 'A temple is a place for a conversation.\n', 'HolyC.TXT': 'Top-level statements run as you type them.\n', 'Kosmos.HC': '// the desktop shell\n', 'Browser.HC': '// the browser painter\n', 'Sheet.HC': '// the spreadsheet\n' };
    let cwd = 'T:/Home';
    const list = $('#files-list');
    const draw = () => {
      $('#files-path').textContent = cwd;
      list.innerHTML = (cwd === 'T:/Home' ? [] : ['../']).concat(tree[cwd] || []).map((n) => `<li><button type="button" data-n="${n}">${n.endsWith('/') ? '▸ ' : ''}${n}</button></li>`).join('');
    };
    list.addEventListener('click', (e) => {
      const n = e.target.dataset.n; if (!n) return;
      if (n === '../') cwd = cwd.slice(0, cwd.lastIndexOf('/'));
      else if (n.endsWith('/')) cwd = `${cwd}/${n.slice(0, -1)}`;
      else { notes.value = `// ${cwd}/${n}\n${files[n] || ''}`; toggle('notes', true); }
      draw();
    });
    draw();

    // Calculator
    const disp = $('#calc-disp'); let acc = null, op = null, cur = '0', fresh = true;
    const calc = (a, b, o) => (o === '+' ? a + b : o === '−' ? a - b : o === '×' ? a * b : o === '÷' ? (b === 0 ? NaN : a / b) : b);
    const show = (v) => { disp.textContent = String(v).slice(0, 12); };
    $('#calc-keys').addEventListener('click', (e) => {
      const k = e.target.dataset.k; if (!k) return;
      if (/\d|\./.test(k)) { cur = fresh ? (k === '.' ? '0.' : k) : (k === '.' && cur.includes('.') ? cur : cur + k); fresh = false; show(cur); }
      else if (k === 'C') { acc = op = null; cur = '0'; fresh = true; show(0); }
      else if (k === '±') { cur = String(-Number(cur)); show(cur); }
      else { const v = Number(cur); acc = op && !fresh ? calc(acc, v, op) : v; show(acc); op = k === '=' ? null : k; cur = String(acc); fresh = true; }
    });
  }
})();
