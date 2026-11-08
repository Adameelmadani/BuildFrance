/* BUILD FRANCE SAS - site vitrine : animations et menu */
(function () {
  'use strict';
  document.documentElement.classList.add('js');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- en-tête : ombre au défilement + menu mobile ---------- */
  const hd = $('.hd');
  const onScroll = () => hd && hd.classList.toggle('scrolled', window.scrollY > 20);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const menuBtn = $('.menu-btn');
  if (menuBtn) {
    const setMenu = (open) => {
      hd.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      $('.menu-lbl', menuBtn).textContent = open ? 'Fermer' : 'Menu';
    };
    menuBtn.addEventListener('click', () => setMenu(!hd.classList.contains('open')));
    $$('.nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && hd.classList.contains('open')) { setMenu(false); menuBtn.focus(); }
    });
  }

  /* ---------- apparitions au défilement ---------- */
  const targets = $$('.rv, .rv-l, .rv-r, .rv-img, .steps');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });
    targets.forEach((t) => io.observe(t));
  } else {
    targets.forEach((t) => t.classList.add('in'));
  }

  /* ---------- parallaxe légère des grandes photos ---------- */
  const para = $$('[data-parallax]');
  if (para.length && !reduce) {
    let ticking = false;
    const update = () => {
      const vh = window.innerHeight;
      para.forEach((el) => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const p = (r.top + r.height / 2 - vh / 2) / vh; // -1 … 1
        el.style.transform = `translate3d(0, ${(p * -Number(el.dataset.parallax || 60)).toFixed(1)}px, 0)`;
      });
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ---------- page domaines : pastille active selon la section ---------- */
  const sub = $$('.subnav a');
  if (sub.length && 'IntersectionObserver' in window) {
    const bar = $('.subnav-in');
    const map = new Map(sub.map((a) => [a.getAttribute('href').slice(1), a]));
    let current = null;
    const io2 = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const a = map.get(en.target.id);
        if (!a || a === current) return;
        if (current) current.classList.remove('on');
        a.classList.add('on');
        current = a;
        // Recentre la pastille en ne faisant défiler QUE la barre (horizontalement).
        // scrollIntoView() ferait aussi défiler la page et interromprait le défilement en cours.
        if (bar.scrollWidth > bar.clientWidth) {
          bar.scrollTo({ left: a.offsetLeft - (bar.clientWidth - a.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((a, id) => { const s = document.getElementById(id); if (s) io2.observe(s); });
  }

  /* ---------- année du pied de page ---------- */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
