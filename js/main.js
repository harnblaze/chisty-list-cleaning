/* Чистый Лист — интерактив лендинга */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rub = (n) => n.toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₽';

  const storage = {
    get(key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } },
    set(key, val) { try { sessionStorage.setItem(key, val); } catch (e) { /* storage недоступен */ } }
  };

  /* ---------- Header ---------- */
  const header = $('.header');
  const mobileCta = $('#mobileCta');
  const hero = $('.hero');

  function onScroll() {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 8);
    if (mobileCta && hero) {
      const past = y > hero.offsetHeight * 0.6;
      const nearOrder = $('#order').getBoundingClientRect().top < window.innerHeight;
      mobileCta.classList.toggle('is-visible', past && !nearOrder);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const burger = $('#burger');
  const nav = $('#nav');

  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    document.body.classList.toggle('menu-open', open);
  }
  burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  $$('a', nav).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  window.addEventListener('resize', () => { if (window.innerWidth > 1024) setMenu(false); });

  /* ---------- Active nav link ---------- */
  const navLinks = $$('.nav > a');
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navLinks.forEach((a) => {
    const target = $(a.getAttribute('href'));
    if (target) sectionObserver.observe(target);
  });

  /* ---------- Reveal on scroll ---------- */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  $$('.reveal').forEach((el) => {
    const siblings = $$(':scope > .reveal', el.parentElement);
    const idx = siblings.indexOf(el);
    if (idx > 0) el.style.transitionDelay = Math.min(idx * 0.07, 0.4) + 's';
    revealObserver.observe(el);
  });

  /* ---------- Counters ---------- */
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      counterObserver.unobserve(el);
      if (reduceMotion) return;
      const end = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      const suffix = el.dataset.suffix || '';
      const plainYear = end > 1900 && end < 2100;
      const start = plainYear ? end - 20 : 0;
      const duration = 1400;
      const t0 = performance.now();
      const format = (v) => (plainYear ? String(Math.round(v)) : v.toLocaleString('ru-RU', {
        minimumFractionDigits: decimals, maximumFractionDigits: decimals
      }).replace(/ /g, ' ')) + suffix;
      (function tick(now) {
        const p = Math.min((now - t0) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = format(start + (end - start) * eased);
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach((el) => counterObserver.observe(el));

  /* ---------- Checklist tabs ---------- */
  const tabs = $$('.tab');
  function activateTab(tab, focus) {
    tabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !active;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', (e) => {
      let next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === 'Home') next = tabs[0];
      if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) { e.preventDefault(); activateTab(next, true); }
    });
  });

  /* ---------- Calculator ---------- */
  // Базовая цена = 1 комната + 1 санузел; далее надбавка за каждую комнату
  const PRICING = {
    standard:   { name: 'Поддерживающая', base: 2490, room: 1610, bath: 900,  hours: [2, 3] },
    general:    { name: 'Генеральная',    base: 5990, room: 2400, bath: 1500, hours: [4, 6] },
    renovation: { name: 'После ремонта',  base: 8990, room: 3000, bath: 2000, hours: [6, 9] },
    moving:     { name: 'Перед заселением', base: 4490, room: 1800, bath: 1200, hours: [3, 5] }
  };
  const DISCOUNT = 0.15;
  const calcForm = $('#calcForm');
  const totalEl = $('#calcTotal');
  const oldEl = $('#calcOld');
  const timeEl = $('#calcTime');
  const summaryEl = $('#calcSummary');
  let lastOrder = null;

  function hoursLabel(n) {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'час';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'часа';
    return 'часов';
  }

  function calculate() {
    const data = new FormData(calcForm);
    const type = PRICING[data.get('type')];
    const rooms = parseInt(data.get('rooms'), 10);
    const baths = parseInt(data.get('baths'), 10);
    const extras = $$('input[name="extra"]:checked', calcForm);

    const roomsCost = type.room * (rooms - 1);
    const bathsCost = type.bath * (baths - 1);
    const extrasCost = extras.reduce((sum, el) => sum + parseInt(el.value, 10), 0);
    const full = type.base + roomsCost + bathsCost + extrasCost;
    const total = Math.round(full * (1 - DISCOUNT) / 10) * 10;
    const extraHours = Math.ceil(rooms / 2) - 1 + (baths - 1) + Math.ceil(extras.length / 2);
    const h1 = type.hours[0] + extraHours;
    const h2 = type.hours[1] + extraHours;

    const rows = [
      [type.name + ', ' + (rooms === 4 ? '4+' : rooms) + '-комн.', rub(type.base + roomsCost)],
      ['Санузлов: ' + baths, bathsCost ? '+' + rub(bathsCost) : 'включено']
    ];
    extras.forEach((el) => rows.push([el.nextElementSibling.firstChild.textContent.trim(), '+' + rub(parseInt(el.value, 10))]));
    rows.push(['Скидка 15%', '−' + rub(full - total)]);

    summaryEl.innerHTML = '';
    rows.forEach(([label, value]) => {
      const li = document.createElement('li');
      const a = document.createElement('span'); a.textContent = label;
      const b = document.createElement('span'); b.textContent = value;
      li.append(a, b);
      summaryEl.appendChild(li);
    });

    const prev = totalEl.textContent;
    totalEl.textContent = rub(total);
    oldEl.textContent = rub(full);
    timeEl.textContent = '≈ ' + h1 + '–' + h2 + ' ' + hoursLabel(h2);
    if (prev !== totalEl.textContent && !reduceMotion) {
      totalEl.classList.remove('bump');
      void totalEl.offsetWidth;
      totalEl.classList.add('bump');
    }

    lastOrder = { text: rows[0][0] + (extras.length ? ' + доп. услуги (' + extras.length + ')' : '') + ' — ' + rub(total) };
  }
  calcForm.addEventListener('change', calculate);
  calcForm.addEventListener('submit', (e) => e.preventDefault());
  calculate();

  // Кнопки «Заказать» в карточках услуг выбирают тип в калькуляторе
  $$('[data-service]').forEach((btn) => btn.addEventListener('click', () => {
    const radio = $('input[name="type"][value="' + btn.dataset.service + '"]', calcForm);
    if (radio) { radio.checked = true; calculate(); }
  }));

  /* ---------- Order summary (calc / plans → form) ---------- */
  const orderSummary = $('#orderSummary');
  function showSummary(text) {
    orderSummary.textContent = 'Ваш выбор: ' + text;
    orderSummary.hidden = false;
  }
  $('#calcBook').addEventListener('click', () => { if (lastOrder) showSummary(lastOrder.text); });
  $$('[data-plan]').forEach((btn) => btn.addEventListener('click', () => showSummary('подписка «' + btn.dataset.plan + '»')));

  /* ---------- Before / After ---------- */
  const ba = $('#ba');
  const baRange = $('#baRange');
  if (ba && baRange) {
    const update = () => ba.style.setProperty('--pos', baRange.value + '%');
    baRange.addEventListener('input', update);
    // Подсказка-анимация при первом появлении
    if (!reduceMotion) {
      const hint = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        hint.disconnect();
        const frames = [50, 30, 70, 50];
        let i = 0;
        (function step() {
          if (i >= frames.length) return;
          const from = parseFloat(baRange.value), to = frames[i++];
          const t0 = performance.now();
          (function anim(now) {
            const p = Math.min((now - t0) / 500, 1);
            baRange.value = from + (to - from) * (0.5 - Math.cos(Math.PI * p) / 2);
            update();
            if (p < 1) requestAnimationFrame(anim); else step();
          })(t0);
        })();
      }, { threshold: 0.6 });
      hint.observe(ba);
    }
  }

  /* ---------- Reviews slider ---------- */
  const track = $('#reviewsTrack');
  const scrollByCard = (dir) => {
    const card = track.firstElementChild;
    const step = card.getBoundingClientRect().width + 16;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    const atStart = track.scrollLeft <= 4;
    if (dir > 0 && atEnd) track.scrollTo({ left: 0, behavior: 'smooth' });
    else if (dir < 0 && atStart) track.scrollTo({ left: track.scrollWidth, behavior: 'smooth' });
    else track.scrollBy({ left: dir * step, behavior: 'smooth' });
  };
  $('#revPrev').addEventListener('click', () => scrollByCard(-1));
  $('#revNext').addEventListener('click', () => scrollByCard(1));

  /* ---------- Countdown to end of week ---------- */
  const timer = $('#timer');
  function endOfWeek() {
    const d = new Date();
    const daysToSunday = (7 - d.getDay()) % 7;
    d.setDate(d.getDate() + daysToSunday);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  const deadline = endOfWeek();
  const pad = (n) => String(n).padStart(2, '0');
  function tickTimer() {
    let diff = Math.max(0, deadline - Date.now());
    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5); diff -= h * 36e5;
    const m = Math.floor(diff / 6e4); diff -= m * 6e4;
    const s = Math.floor(diff / 1e3);
    $('[data-t="d"]', timer).textContent = pad(d);
    $('[data-t="h"]', timer).textContent = pad(h);
    $('[data-t="m"]', timer).textContent = pad(m);
    $('[data-t="s"]', timer).textContent = pad(s);
  }
  tickTimer();
  setInterval(tickTimer, 1000);

  /* ---------- FAQ: одна открытая вкладка ---------- */
  const faqItems = $$('.faq__item');
  faqItems.forEach((item) => item.addEventListener('toggle', () => {
    if (item.open) faqItems.forEach((other) => { if (other !== item) other.open = false; });
  }));

  /* ---------- Phone mask ---------- */
  const phoneInput = $('input[name="phone"]');
  function formatPhone(value) {
    let digits = value.replace(/\D/g, '');
    if (digits.startsWith('8')) digits = '7' + digits.slice(1);
    if (!digits.startsWith('7')) digits = '7' + digits;
    digits = digits.slice(0, 11);
    const p = digits.slice(1);
    let out = '+7';
    if (p.length) out += ' (' + p.slice(0, 3);
    if (p.length >= 3) out += ')';
    if (p.length > 3) out += ' ' + p.slice(3, 6);
    if (p.length > 6) out += '-' + p.slice(6, 8);
    if (p.length > 8) out += '-' + p.slice(8, 10);
    return out;
  }
  phoneInput.addEventListener('focus', () => { if (!phoneInput.value) phoneInput.value = '+7 ('; });
  phoneInput.addEventListener('blur', () => { if (phoneInput.value.replace(/\D/g, '').length <= 1) phoneInput.value = ''; });
  phoneInput.addEventListener('input', (e) => {
    if (e.inputType && e.inputType.startsWith('delete')) return;
    phoneInput.value = formatPhone(phoneInput.value);
  });

  /* ---------- Modals ---------- */
  let lastFocus = null;
  function openModal(modal) {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    const focusable = $('button, a', modal);
    if (focusable) focusable.focus();
  }
  function closeModal(modal) {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  $$('.modal').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('[data-close]')) closeModal(modal);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    $$('.modal').forEach((m) => { if (!m.hidden) closeModal(m); });
    if (nav.classList.contains('is-open')) setMenu(false);
  });

  /* ---------- Order form ---------- */
  const orderForm = $('#orderForm');
  orderForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nameField = orderForm.elements.name.closest('.field');
    const phoneField = phoneInput.closest('.field');
    const consent = orderForm.elements.consent;

    const nameOk = orderForm.elements.name.value.trim().length >= 2;
    const phoneOk = phoneInput.value.replace(/\D/g, '').length === 11;
    const consentOk = consent.checked;

    nameField.classList.toggle('is-invalid', !nameOk);
    phoneField.classList.toggle('is-invalid', !phoneOk);
    consent.closest('.check').classList.toggle('is-invalid', !consentOk);

    if (!nameOk) return orderForm.elements.name.focus();
    if (!phoneOk) return phoneInput.focus();
    if (!consentOk) return consent.focus();

    // Здесь подключается отправка на сервер / в CRM / в Telegram-бота
    orderForm.reset();
    orderSummary.hidden = true;
    storage.set('cl_submitted', '1');
    openModal($('#thanksModal'));
  });
  $$('input', orderForm).forEach((input) => input.addEventListener('input', () => {
    const wrap = input.closest('.field, .check');
    if (wrap) wrap.classList.remove('is-invalid');
  }));

  /* ---------- Exit intent (только десктоп, раз за сессию) ---------- */
  const exitModal = $('#exitModal');
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (canHover) {
    const armedAt = Date.now();
    document.addEventListener('mouseout', function handler(e) {
      if (e.relatedTarget || e.clientY > 0) return;
      if (Date.now() - armedAt < 8000) return;
      if (storage.get('cl_exit_shown') || storage.get('cl_submitted')) return;
      if ($$('.modal').some((m) => !m.hidden)) return;
      storage.set('cl_exit_shown', '1');
      document.removeEventListener('mouseout', handler);
      openModal(exitModal);
    });
  }
})();
