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

  /* Reserva de equipamentos */
  var form = document.getElementById('form-reserva');
  if (form) {
    var endpoint = (form.getAttribute('data-endpoint') || '').trim();
    var email = form.getAttribute('data-email');
    var radios = form.querySelectorAll('input[name="equipamento"]');
    var descLabel = document.getElementById('descricao-rotulo');
    var descDefault = descLabel.textContent;
    var qtyGroup = document.getElementById('grupo-quantidade');
    var qtyLabel = document.getElementById('quantidade-rotulo');
    var qtyNote = document.getElementById('quantidade-nota');
    var agendaGroup = document.getElementById('grupo-agenda');
    var phone = document.getElementById('telefone');
    var date = document.getElementById('data');
    var submitBtn = form.querySelector('button[type="submit"]');
    var submitLabel = submitBtn.innerHTML;
    var alertBox = document.getElementById('reserva-alerta');
    var alertText = document.getElementById('reserva-alerta-texto');
    var mailFallback = document.getElementById('reserva-por-email');
    var sentPanel = document.getElementById('reserva-enviada');
    var mailPanel = document.getElementById('reserva-pronta');
    var preview = document.getElementById('reserva-texto');
    var mailLink = document.getElementById('reserva-email');
    var gmailLink = document.getElementById('reserva-gmail');
    var copyBtn = document.getElementById('reserva-copiar');
    var requiredFields = form.querySelectorAll('input[required]:not([type="radio"]), textarea[required], select[required]');

    // Sem o serviço de reservas configurado não existe link de confirmação para anunciar.
    if (!endpoint) document.getElementById('email-dica').hidden = true;

    var chosen = function () {
      return form.querySelector('input[name="equipamento"]:checked');
    };

    var setError = function (el, msg) {
      var group = el.type === 'radio' ? radios : [el];
      Array.prototype.forEach.call(group, function (item) {
        if (msg) item.setAttribute('aria-invalid', 'true');
        else item.removeAttribute('aria-invalid');
      });
      var box = document.getElementById((el.type === 'radio' ? el.name : el.id) + '-erro');
      if (box) box.textContent = msg;
    };

    var toggleGroup = function (group, on) {
      group.hidden = !on;
      group.querySelectorAll('input, select, textarea').forEach(function (el) {
        el.disabled = !on;
        if (!on) setError(el, '');
      });
    };

    // Rótulos e campos extras de cada equipamento vêm dos atributos data-* do HTML.
    var updateEquipment = function () {
      var choice = chosen();
      descLabel.textContent = choice ? choice.getAttribute('data-descricao') : descDefault;
      var qty = choice && choice.getAttribute('data-quantidade');
      toggleGroup(qtyGroup, !!qty);
      if (qty) {
        var note = choice.getAttribute('data-nota') || '';
        qtyLabel.textContent = qty;
        qtyNote.textContent = note;
        qtyNote.hidden = !note;
      }
      toggleGroup(agendaGroup, !!(choice && choice.getAttribute('data-agenda')));
    };

    var check = function (el) {
      if (el.disabled) return true;
      var value = el.value.trim();
      var msg = '';
      if (el.type === 'radio') {
        if (!chosen()) msg = 'Escolha o equipamento que deseja reservar.';
      } else if (!value) {
        msg = el.tagName === 'SELECT' ? 'Selecione uma opção.' : 'Preencha este campo.';
      } else if (el.type === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) msg = 'Informe um e-mail válido, por exemplo nome@exemplo.com.';
      } else if (el === phone) {
        var digits = value.replace(/\D/g, '').length;
        if (digits < 10 || digits > 11) msg = 'Informe o telefone com DDD, por exemplo (87) 91234 5678.';
      } else if (el.type === 'number') {
        var n = Number(value);
        if (!(n >= 1 && Math.floor(n) === n)) msg = 'Informe uma quantidade a partir de 1.';
      } else if (el === date && value < date.min) {
        msg = 'Escolha uma data a partir de hoje.';
      }
      setError(el, msg);
      return !msg;
    };

    var fieldValue = function (id) {
      return document.getElementById(id).value.trim();
    };

    var formatDate = function (iso) {
      var parts = iso.split('-');
      return parts[2] + '/' + parts[1] + '/' + parts[0];
    };

    var now = new Date();
    date.min = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

    phone.addEventListener('input', function () {
      var d = phone.value.replace(/\D/g, '').slice(0, 11);
      var cut = d.length === 11 ? 7 : 6;
      if (d.length > cut) phone.value = '(' + d.slice(0, 2) + ') ' + d.slice(2, cut) + ' ' + d.slice(cut);
      else if (d.length > 2) phone.value = '(' + d.slice(0, 2) + ') ' + d.slice(2);
      else phone.value = d;
    });

    radios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        updateEquipment();
        setError(radio, '');
      });
    });

    requiredFields.forEach(function (el) {
      el.addEventListener('blur', function () {
        if (el.value.trim()) check(el);
      });
      el.addEventListener('input', function () {
        if (el.getAttribute('aria-invalid')) check(el);
      });
    });

    updateEquipment();

    var collect = function () {
      var data = {
        equipamento: chosen().value,
        nome: fieldValue('nome'),
        email: fieldValue('email'),
        telefone: fieldValue('telefone'),
        projeto: fieldValue('projeto'),
        descricao: fieldValue('descricao'),
        site: fieldValue('site')
      };
      if (!qtyGroup.hidden) data.quantidade = fieldValue('quantidade');
      if (!agendaGroup.hidden) {
        data.data = fieldValue('data');
        data.periodo = fieldValue('periodo');
      }
      return data;
    };

    var showPanel = function (panel) {
      form.hidden = true;
      sentPanel.hidden = panel !== sentPanel;
      mailPanel.hidden = panel !== mailPanel;
      panel.focus();
    };

    var setBusy = function (busy) {
      submitBtn.disabled = busy;
      if (busy) {
        submitBtn.setAttribute('aria-busy', 'true');
        submitBtn.textContent = 'Enviando...';
      } else {
        submitBtn.removeAttribute('aria-busy');
        submitBtn.innerHTML = submitLabel;
      }
    };

    var showAlert = function (message, offerEmail) {
      alertText.textContent = message;
      mailFallback.hidden = !offerEmail;
      alertBox.hidden = false;
    };

    // Plano B: monta a mensagem e abre o aplicativo de e-mail do visitante.
    var sendByEmail = function (data) {
      var lines = [
        'Solicitação de reserva de equipamento do LabSEL',
        '',
        'Equipamento: ' + data.equipamento,
        'Nome do solicitante: ' + data.nome,
        'E-mail: ' + data.email,
        'Telefone para contato: ' + data.telefone,
        'Projeto vinculado: ' + data.projeto,
        '',
        'Descrição e objetivo da demanda:',
        data.descricao
      ];
      if (data.quantidade) lines.push('', 'Quantidade: ' + data.quantidade);
      if (data.data) lines.push('', 'Data desejada: ' + formatDate(data.data), 'Período: ' + data.periodo);
      lines.push('', 'Solicitação enviada pelo site do GSEL.');

      var subject = 'Reserva de equipamento: ' + data.equipamento + ' (' + data.nome + ')';
      var body = lines.join('\n').replace(/\r?\n/g, '\r\n');
      mailLink.href = 'mailto:' + email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      gmailLink.href = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(email) +
        '&su=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      preview.textContent = 'Para: ' + email + '\nAssunto: ' + subject + '\n\n' + lines.join('\n');
      showPanel(mailPanel);
      mailLink.click();
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      alertBox.hidden = true;
      var fields = [radios[0]].concat(Array.prototype.slice.call(requiredFields));
      var firstInvalid = null;
      fields.forEach(function (el) {
        if (!check(el) && !firstInvalid) firstInvalid = el;
      });
      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      var data = collect();
      if (!endpoint) {
        sendByEmail(data);
        return;
      }

      // Corpo em texto simples não dispara a checagem prévia de CORS; o Apps Script lê o JSON mesmo assim.
      setBusy(true);
      fetch(endpoint, { method: 'POST', body: JSON.stringify(data) })
        .then(function (res) { return res.json(); })
        .then(function (r) {
          if (r && r.ok) {
            document.getElementById('reserva-enviada-email').textContent = data.email;
            showPanel(sentPanel);
          } else {
            showAlert((r && r.erro) || 'Não foi possível enviar a solicitação. Tente novamente.', false);
          }
        })
        .catch(function () {
          showAlert('Não foi possível conectar ao sistema de reservas. Verifique sua conexão e tente de novo, ou envie a solicitação por e-mail.', true);
        })
        .finally(function () {
          setBusy(false);
        });
    });

    mailFallback.addEventListener('click', function () {
      alertBox.hidden = true;
      sendByEmail(collect());
    });

    copyBtn.addEventListener('click', function () {
      var flash = function (label) {
        copyBtn.textContent = label;
        setTimeout(function () { copyBtn.textContent = 'Copiar mensagem'; }, 3000);
      };
      var copied = function () { flash('Mensagem copiada!'); };
      var fallback = function () {
        var area = document.createElement('textarea');
        area.value = preview.textContent;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
        document.body.removeChild(area);
        if (ok) copied();
        else flash('Selecione o texto abaixo e copie');
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(preview.textContent).then(copied, fallback);
      } else {
        fallback();
      }
    });

    document.querySelectorAll('[data-reserva-nova]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        form.reset();
        form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
        form.querySelectorAll('.field-error').forEach(function (el) { el.textContent = ''; });
        alertBox.hidden = true;
        updateEquipment();
        sentPanel.hidden = true;
        mailPanel.hidden = true;
        form.hidden = false;
        radios[0].focus();
      });
    });
  }

  /* Ano no rodapé */
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
