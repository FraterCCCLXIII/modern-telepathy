// Theme toggle and mobile menu. No dependencies.
(() => {
  const root = document.documentElement;
  const safe = (fn) => { try { return fn(); } catch (e) { return null; } };

  document.getElementById('theme')?.addEventListener('click', () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    root.dataset.theme = next;
    safe(() => localStorage.setItem('tos-theme', next));
  });

  root.classList.add('js');
  const items = document.querySelectorAll('.card, .tile, .frow');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach((el, i) => { el.setAttribute('data-reveal', ''); el.style.setProperty('--d', `${(i % 3) * 70}ms`); io.observe(el); });
  } else items.forEach((el) => el.classList.add('in'));

  const menu = document.getElementById('menu');
  menu?.addEventListener('click', () => {
    const open = document.getElementById('nav').classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
  });
})();
