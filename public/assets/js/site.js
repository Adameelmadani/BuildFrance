/* BUILD FRANCE SAS - site vitrine : animations, menu, formulaire */
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

  /* ---------- formulaire de contact : prépare un e-mail ---------- */
  const form = $('#contact-form');
  if (form) {
    // Pré-sélection du type de projet depuis un lien (contact.html?projet=renovation)
    const pre = new URLSearchParams(location.search).get('projet');
    if (pre) { const r = $(`input[name="projet"][data-slug="${CSS.escape(pre)}"]`, form); if (r) r.checked = true; }

    const check = (field) => {
      const input = $('input, textarea, select', field);
      let ok = input.checkValidity();
      if (input.name === 'telephone' && input.value.trim()) ok = /^[+\d][\d\s.()-]{8,}$/.test(input.value.trim());
      field.classList.toggle('err', !ok);
      return ok;
    };
    $$('.field[data-req]', form).forEach((f) => {
      $('input, textarea, select', f).addEventListener('blur', () => check(f));
      $('input, textarea, select', f).addEventListener('input', () => { if (f.classList.contains('err')) check(f); });
    });

    const shownAt = Date.now();
    const okBox = $('.form-ok', form);
    const errBox = $('.form-err', form);
    const btn = $('#f-submit', form);
    const showError = (html) => { errBox.innerHTML = html; errBox.classList.add('show'); errBox.focus(); };
    const fallback = 'Vous pouvez aussi nous appeler au <a href="tel:+33652473005">06 52 47 30 05</a> ou écrire à <a href="mailto:buildfrance.sas@gmail.com">buildfrance.sas@gmail.com</a>.';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (btn.getAttribute('aria-busy') === 'true') return;
      errBox.classList.remove('show');
      const fields = $$('.field[data-req]', form);
      const bad = fields.filter((f) => !check(f));
      const consent = $('#consent', form);
      if (bad.length) { $('input, textarea, select', bad[0]).focus(); return; }
      if (!consent.checked) { consent.focus(); consent.closest('.check').style.color = 'var(--red-fr)'; return; }
      consent.closest('.check').style.color = '';

      const d = new FormData(form);
      const payload = {
        projet: d.get('projet') || '', nom: d.get('nom'), telephone: d.get('telephone'), email: d.get('email'),
        commune: d.get('commune'), delai: d.get('delai'), message: d.get('message'),
        consent: consent.checked, website: d.get('website'), elapsed: Date.now() - shownAt,
      };

      btn.setAttribute('aria-busy', 'true');
      $('.lbl', btn).textContent = 'Envoi en cours…';
      try {
        const res = await fetch('/api/contact', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          // Erreurs de saisie renvoyées par le serveur : on les affiche sous les champs concernés
          Object.keys(data.fields || {}).forEach((k) => {
            const input = form.elements[k];
            const field = input && input.closest && input.closest('.field');
            if (field) { field.classList.add('err'); const m = $('.msg', field); if (m) m.textContent = data.fields[k]; }
          });
          showError(`${data.error || "L'envoi n'a pas abouti."} ${res.status >= 500 ? fallback : ''}`);
          return;
        }
        form.classList.add('sent');
        okBox.querySelector('.ref').textContent = data.id ? `Référence de votre demande : ${data.id}` : '';
        okBox.classList.add('show');
        okBox.focus();
      } catch (err) {
        showError(`Le serveur ne répond pas : vérifiez votre connexion internet. ${fallback}`);
      } finally {
        btn.setAttribute('aria-busy', 'false');
        $('.lbl', btn).textContent = 'Envoyer ma demande';
      }
    });
  }

  /* ---------- année du pied de page ---------- */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
