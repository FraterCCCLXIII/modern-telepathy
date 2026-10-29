import { createSpriteMark, PATTERNS, cleanText } from './sprite-mark.js';

const host = document.getElementById('sprite-host');
const ui = document.getElementById('sprite-ui');
if (host) {
  const mark = createSpriteMark(host, { text: 'KOSMOS', pattern: 'random', color: '#1d1d1b', minPitch: () => (window.matchMedia('(min-width: 900px)').matches ? 30 : 0) });
  const $ = (id) => document.getElementById(id);
  const pause = $('sp-pause');
  const replay = $('sp-replay');
  const sel = $('sp-pattern');
  const input = $('sp-text');

  const toggle = $('sp-toggle');
  const panel = $('sprite-panel');
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Hide controls' : 'Show controls';
  });
  for (const p of PATTERNS) sel.add(new Option(p.name, p.id));

  const sync = () => {
    pause.setAttribute('aria-pressed', String(mark.paused));
    const still = mark.reducedMotion;
    pause.disabled = still || mark.finished;
    replay.disabled = still;
    host.dataset.state = mark.finished ? 'finished' : mark.paused ? 'paused' : 'playing';
  };
  mark.on('state', sync);
  sync();

  replay.addEventListener('click', () => mark.replay());
  pause.addEventListener('click', () => { mark.toggle(); sync(); });
  sel.addEventListener('change', () => mark.setPattern(sel.value));
  input.addEventListener('input', () => {
    const clean = cleanText(input.value);
    if (clean !== input.value.toUpperCase()) input.value = clean;
    mark.setText(clean || 'KOSMOS');
  });
  $('sp-png').addEventListener('click', () => {
    mark.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'kosmos-sprite-mark.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, { bg: '#f0efe7' });
  });
  window.kosmosSpriteMark = mark;
}
