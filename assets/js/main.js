(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Navegação: fundo sólido após rolar */
  var nav = document.getElementById('site-nav');
  function updateNav() {
    nav.classList.toggle('is-scrolled', window.scrollY > 24);
  }
  updateNav();
  window.addEventListener('scroll', updateNav, { passive: true });

  /* Menu mobile */
  var menu = document.getElementById('mobile-menu');
  var toggle = document.querySelector('.nav-toggle');
  var closeBtn = menu.querySelector('.mobile-close');

  function openMenu() {
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('menu-open');
    closeBtn.focus();
  }

  function closeMenu(returnFocus) {
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
    if (returnFocus) toggle.focus();
  }

  toggle.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', function () { closeMenu(true); });
  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) closeMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) closeMenu(true);
  });
  menu.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var items = menu.querySelectorAll('a, button');
    var first = items[0];
    var last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  /* Animação de entrada das seções */
  var revealed = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealed.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealed.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* Destaque do link da seção visível */
  var navLinks = document.querySelectorAll('.nav-link');
  var linkFor = {};
  navLinks.forEach(function (link) {
    linkFor[link.getAttribute('href').slice(1)] = link;
  });
  var aliases = { localizacao: 'contato', vinculos: 'contato' };
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = aliases[entry.target.id] || entry.target.id;
        navLinks.forEach(function (link) { link.removeAttribute('aria-current'); });
        if (linkFor[id]) linkFor[id].setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('header[id], section[id], footer[id]').forEach(function (s) { spy.observe(s); });
  }

  /* Galeria: carrossel */
  var track = document.getElementById('galeria-fotos');
  var prev = document.querySelector('[data-carousel="prev"]');
  var next = document.querySelector('[data-carousel="next"]');

  function step() {
    var card = track.querySelector('.photo-card');
    return card ? card.getBoundingClientRect().width + 24 : track.clientWidth;
  }

  function updateArrows() {
    var max = track.scrollWidth - track.clientWidth - 2;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max;
  }

  prev.addEventListener('click', function () {
    track.scrollBy({ left: -step(), behavior: reduceMotion ? 'auto' : 'smooth' });
  });
  next.addEventListener('click', function () {
    track.scrollBy({ left: step(), behavior: reduceMotion ? 'auto' : 'smooth' });
  });
  track.addEventListener('scroll', updateArrows, { passive: true });
  window.addEventListener('resize', updateArrows);
  updateArrows();

  /* Galeria: foto ampliada */
  var lightbox = document.getElementById('lightbox');
  var photos = Array.prototype.slice.call(track.querySelectorAll('.photo-card button'));
  var current = 0;

  if (lightbox && typeof lightbox.showModal === 'function') {
    var lbImg = lightbox.querySelector('img');
    var lbTag = lightbox.querySelector('.photo-tag');
    var lbCaption = lightbox.querySelector('.lightbox-caption');

    var show = function (index) {
      current = (index + photos.length) % photos.length;
      var btn = photos[current];
      var thumb = btn.querySelector('img.main');
      lbImg.src = btn.getAttribute('data-full');
      lbImg.alt = thumb.alt;
      lbTag.textContent = btn.getAttribute('data-tag');
      lbCaption.textContent = btn.querySelector('.photo-caption').textContent;
    };

    photos.forEach(function (btn, i) {
      btn.addEventListener('click', function () {
        show(i);
        lightbox.showModal();
      });
    });

    lightbox.querySelector('.lightbox-close').addEventListener('click', function () { lightbox.close(); });
    lightbox.querySelector('.lightbox-prev').addEventListener('click', function () { show(current - 1); });
    lightbox.querySelector('.lightbox-next').addEventListener('click', function () { show(current + 1); });
    lightbox.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) lightbox.close();
    });
    lightbox.addEventListener('close', function () {
      photos[current].focus();
    });
  } else {
    photos.forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.open(btn.getAttribute('data-full'), '_blank', 'noopener');
      });
    });
  }

  /* Ano no rodapé */
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
