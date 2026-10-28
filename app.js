(function () {
  'use strict';

  var API = (typeof ENDPOINT !== 'undefined' && ENDPOINT) ? String(ENDPOINT).trim() : '';
  var MEMBERS = window.NAFIS_MEMBERS || {};
  var CITIES = window.NAFIS_CITIES || [];
  var STORE_KEY = 'nafis-visit-1405';
  var OTHER = '__other';
  var DAYS = {
    '17': { week: 'یکشنبه', num: '۱۷', label: 'یکشنبه ۱۷ آبان' },
    '19': { week: 'سه‌شنبه', num: '۱۹', label: 'سه‌شنبه ۱۹ آبان' }
  };

  var state = { hph: '', key: '', name: '', province: '', city: '', hours: 0, day: '', attend: null, payload: null };

  // ---------- ابزارها ----------
  var $ = function (id) { return document.getElementById(id); };
  function toFa(v) { return String(v).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; }); }

  // باید دقیقاً با build-members.mjs و بک‌اند یکی باشد.
  function normalizeHph(raw) {
    var s = String(raw == null ? '' : raw).trim();
    s = s.replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); });
    s = s.replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); });
    s = s.replace(/[\s​-‏‪-‮⁦-⁩﻿]/g, '');
    s = s.toUpperCase();
    if (/^\d+$/.test(s)) s = 'HPH' + s;
    return s;
  }
  // اگر کیبورد فارسی بوده، «HPH» به شکل «احا» تایپ می‌شود.
  function friendlyHph(raw) {
    var s = normalizeHph(raw);
    var m = /^(احا|اح|ا)?(\d+)$/.exec(s);
    if (m && m[1]) s = 'HPH' + m[2];
    return s;
  }

  var enc = new TextEncoder();
  function sha256(str) { return crypto.subtle.digest('SHA-256', enc.encode(str)); }
  function hex(buf) {
    var b = new Uint8Array(buf), out = '';
    for (var i = 0; i < b.length; i++) out += ('0' + b[i].toString(16)).slice(-2);
    return out;
  }
  function b64bytes(b64) {
    var bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  function lookup(hph) {
    return sha256('nafis-1405:' + hph).then(function (h) {
      var key = hex(h);
      var blob = MEMBERS[key];
      if (!blob) return { key: key, name: null };
      var raw = b64bytes(blob);
      return sha256('nafis-name:' + hph)
        .then(function (kb) { return crypto.subtle.importKey('raw', kb, { name: 'AES-GCM' }, false, ['decrypt']); })
        .then(function (k) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, k, raw.slice(12)); })
        .then(function (pt) { return { key: key, name: new TextDecoder().decode(pt) }; });
    });
  }

  function save(obj) { try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch (e) { /* ممکن است در حالت خصوصی در دسترس نباشد */ } }
  function load() { try { var v = localStorage.getItem(STORE_KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; } }

  // ---------- جابه‌جایی بین صفحه‌ها ----------
  function show(name) {
    var screens = document.querySelectorAll('.screen');
    var target = $('s-' + name);
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
    target.classList.add('active');

    var step = Number(target.getAttribute('data-step') || 0);
    var steps = $('steps');
    steps.hidden = !step;
    var lis = steps.querySelectorAll('li');
    for (var j = 0; j < lis.length; j++) {
      var n = j + 1;
      lis[j].classList.toggle('done', n < step || (step === 4 && name === 'result'));
      lis[j].classList.toggle('now', n === step);
      if (n === step) lis[j].setAttribute('aria-current', 'step'); else lis[j].removeAttribute('aria-current');
    }
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    var h = target.querySelector('h1, h2');
    if (h && name !== 'welcome') setTimeout(function () { try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }, 60);
  }

  function fillNames() {
    var els = document.querySelectorAll('[data-name]');
    for (var i = 0; i < els.length; i++) els[i].textContent = state.name;
  }

  function confetti() {
    var box = $('confetti');
    box.innerHTML = '';
    var colors = ['#2e90fa', '#12b76a', '#f79009', '#0b2545', '#8cc4ff', '#f04438'];
    for (var i = 0; i < 36; i++) {
      var p = document.createElement('i');
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.6) + 's';
      p.style.animationDuration = (2 + Math.random() * 1.4) + 's';
      box.appendChild(p);
    }
    setTimeout(function () { box.innerHTML = ''; }, 4200);
  }

  // ---------- ۱. بررسی کد ----------
  var codeForm = $('f-code'), codeInput = $('hph'), codeErr = $('hph-err'), checkBtn = $('btn-check');

  function codeError(msg) {
    codeErr.textContent = msg;
    codeInput.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  codeInput.addEventListener('input', function () { if (codeErr.textContent) codeError(''); });

  codeForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var hph = friendlyHph(codeInput.value);
    if (!hph) { codeError('لطفاً کد HPH خود را وارد کنید.'); codeInput.focus(); return; }
    if (!/^HPH\d{14}$/.test(hph)) {
      var digits = (hph.match(/\d/g) || []).length;
      if (/^HPH\d+$/.test(hph)) codeError('کد HPH باید ۱۴ رقم داشته باشد، اما ' + toFa(digits) + ' رقم وارد شده است. لطفاً دوباره نگاه کنید.');
      else codeError('کد واردشده درست به نظر نمی‌رسد. کد HPH با حروف «HPH» و ۱۴ رقم نوشته می‌شود.');
      codeInput.focus();
      return;
    }
    if (!window.crypto || !crypto.subtle) {
      codeError('مرورگر شما از این صفحه پشتیبانی نمی‌کند. لطفاً صفحه را با Chrome یا مرورگر به‌روز دیگری باز کنید.');
      return;
    }
    codeError('');
    checkBtn.disabled = true;
    checkBtn.querySelector('.lbl-txt').textContent = 'در حال بررسی…';
    lookup(hph).then(function (r) {
      state.hph = hph; state.key = r.key;
      if (!r.name) { show('sorry'); return; }
      state.name = r.name;
      fillNames();
      show('congrats');
      confetti();
    }).catch(function () {
      codeError('بررسی کد انجام نشد. لطفاً صفحه را یک بار تازه کنید و دوباره امتحان کنید.');
    }).then(function () {
      checkBtn.disabled = false;
      checkBtn.querySelector('.lbl-txt').textContent = 'بررسی کد';
    });
  });

  // ---------- ۳. استان و شهر ----------
  var provSel = $('province'), citySel = $('city'), cityErr = $('city-err');

  CITIES.forEach(function (p, i) {
    var o = document.createElement('option');
    o.value = String(i); o.textContent = p.p;
    provSel.appendChild(o);
  });

  function fillCities() {
    citySel.innerHTML = '';
    var idx = provSel.value;
    if (idx === '') {
      citySel.disabled = true;
      citySel.appendChild(new Option('اول استان را انتخاب کنید', ''));
      return;
    }
    var p = CITIES[Number(idx)];
    citySel.disabled = false;
    citySel.appendChild(new Option('شهر خود را انتخاب کنید', ''));
    p.c.forEach(function (c, i) { citySel.appendChild(new Option(c[0], String(i))); });
    citySel.appendChild(new Option('سایر شهرهای استان ' + p.p, OTHER));
  }
  provSel.addEventListener('change', function () { cityErr.textContent = ''; fillCities(); });
  citySel.addEventListener('change', function () { cityErr.textContent = ''; });

  $('f-city').addEventListener('submit', function (e) {
    e.preventDefault();
    if (provSel.value === '') { cityErr.textContent = 'لطفاً استان خود را انتخاب کنید.'; provSel.focus(); return; }
    if (citySel.value === '') { cityErr.textContent = 'لطفاً شهر خود را انتخاب کنید.'; citySel.focus(); return; }
    var p = CITIES[Number(provSel.value)];
    if (citySel.value === OTHER) { state.city = 'سایر شهرها'; state.hours = p.h; }
    else { var c = p.c[Number(citySel.value)]; state.city = c[0]; state.hours = c[1]; }
    state.province = p.p;
    state.day = state.hours <= 7 ? '19' : '17';
    var d = DAYS[state.day];
    $('attend-q').textContent = 'آیا روز ' + d.label + ' در بازدید حضور پیدا می‌کنید؟';
    $('day-label').textContent = d.label + ' ۱۴۰۵';
    $('cal-num').textContent = d.num;
    show('attend');
  });

  // ---------- ۴ و ۵. حضور و ارسال ----------
  var attendBtns = document.querySelectorAll('[data-attend]');
  for (var i = 0; i < attendBtns.length; i++) {
    attendBtns[i].addEventListener('click', function () {
      state.attend = this.getAttribute('data-attend') === 'yes';
      state.payload = {
        action: 'register',
        hph: state.hph,
        name: state.name,
        province: state.province,
        city: state.city,
        hours: state.hours,
        day: state.day,
        attend: state.attend,
        ua: navigator.userAgent
      };
      submit();
    });
  }

  function mockSend(payload) {
    console.warn('[نفیس] ENDPOINT در config.js خالی است؛ حالت آزمایشی فعال است و چیزی به سرور فرستاده نمی‌شود.');
    var forced = null;
    try { forced = new URLSearchParams(location.search).get('mock'); } catch (e) { /* */ }
    return new Promise(function (res) {
      setTimeout(function () {
        if (forced === 'error') { res(Promise.reject(new Error('mock network error'))); return; }
        if (forced === 'waitlist' || forced === 'already' || forced === 'not_eligible') {
          if (forced === 'not_eligible') { res({ ok: false, error: 'not_eligible' }); return; }
          res({ ok: true, status: forced, day: payload.day, attend: payload.attend, previous: payload.attend ? 'confirmed' : 'declined' });
          return;
        }
        res({ ok: true, status: payload.attend ? 'confirmed' : 'declined', day: payload.day, attend: payload.attend });
      }, 600);
    });
  }

  function send(payload) {
    if (!API) return mockSend(payload);
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 25000) : null;
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }, function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  function submit() {
    show('sending');
    var started = Date.now();
    send(state.payload).then(function (res) {
      // کمی مکث تا صفحه‌ی «در حال ثبت» یک‌باره نپرد.
      var wait = Math.max(0, 500 - (Date.now() - started));
      setTimeout(function () { handle(res); }, wait);
    }).catch(function (err) {
      console.error('[نفیس] خطای ارسال:', err);
      $('err-text').textContent = 'متأسفانه پاسخ شما به دست ما نرسید. لطفاً چند لحظه بعد دوباره امتحان کنید.';
      show('error');
    });
  }

  function handle(res) {
    if (!res || typeof res !== 'object') { $('err-text').textContent = 'پاسخ نامعتبری از سرور رسید. لطفاً دوباره امتحان کنید.'; show('error'); return; }
    if (!res.ok) {
      if (res.error === 'not_eligible') { show('sorry'); return; }
      console.error('[نفیس] خطای سرور:', res.error);
      $('err-text').textContent = 'در ثبت پاسخ شما مشکلی پیش آمد. لطفاً چند لحظه بعد دوباره امتحان کنید.';
      show('error');
      return;
    }
    var rec = {
      key: state.key,
      name: state.name,
      province: state.province,
      city: state.city,
      status: res.status,
      previous: res.previous || null,
      day: String(res.day || state.day),
      attend: typeof res.attend === 'boolean' ? res.attend : state.attend,
      at: Date.now()
    };
    save(rec);
    renderResult(rec, false);
  }

  $('btn-retry').addEventListener('click', function () { if (state.payload) submit(); else show('welcome'); });

  // ---------- نتیجه ----------
  var ICONS = {
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="#12b76a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    wait: '<svg viewBox="0 0 24 24" fill="none" stroke="#f79009" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    thanks: '<svg viewBox="0 0 24 24" fill="none" stroke="#2e90fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="#2e90fa" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
  };
  var STATUS_FA = { confirmed: 'قطعی', waitlist: 'در لیست انتظار', declined: 'شرکت نمی‌کنم' };

  function setText(el, parts) {
    // parts: آرایه‌ای از رشته‌ها یا {b: '...'} برای متن پررنگ (بدون innerHTML برای نام‌ها)
    el.textContent = '';
    parts.forEach(function (p) {
      if (typeof p === 'string') el.appendChild(document.createTextNode(p));
      else { var b = document.createElement('b'); b.textContent = p.b; el.appendChild(b); }
    });
  }

  function renderResult(rec, fromStorage) {
    var d = DAYS[rec.day] || { label: rec.day };
    var name = rec.name || 'همکار';
    var icon = $('res-icon'), title = $('res-title'), text = $('res-text'), note = $('res-note');
    var status = rec.status;
    var effective = status === 'already' ? (rec.previous || (rec.attend ? 'confirmed' : 'declined')) : status;
    icon.className = 'badge-icon';
    note.hidden = true;

    if (status === 'confirmed') {
      icon.classList.add('green'); icon.innerHTML = ICONS.ok;
      title.textContent = 'ثبت‌نام شما قطعی شد!';
      setText(text, [name + ' عزیز، ثبت‌نام شما برای بازدید از کارخانه در روز ', { b: d.label }, ' قطعی شد. منتظر دیدارتان هستیم.']);
      note.textContent = 'اطلاعات تکمیلی بازدید (ساعت و محل حرکت) از طرف شرکت به شما اطلاع داده می‌شود.';
      note.hidden = false;
    } else if (status === 'waitlist') {
      icon.classList.add('amber'); icon.innerHTML = ICONS.wait;
      title.textContent = 'در لیست انتظار قرار گرفتید';
      setText(text, [name + ' عزیز، ظرفیت ۲۰۰ نفره‌ی بازدید روز ', { b: d.label }, ' تکمیل شده است. نام شما در لیست انتظار ثبت شد و اگر جایی خالی شود، حتماً با شما تماس می‌گیریم.']);
    } else if (status === 'declined') {
      icon.innerHTML = ICONS.thanks;
      title.textContent = 'پاسخ شما ثبت شد';
      setText(text, [name + ' عزیز، از اینکه اطلاع دادید سپاسگزاریم. ثبت شد که در بازدید روز ', { b: d.label }, ' حضور نخواهید داشت. امیدواریم در رویدادهای بعدی شما را ببینیم.']);
    } else {
      icon.innerHTML = ICONS.info;
      title.textContent = 'شما قبلاً ثبت‌نام کرده‌اید';
      setText(text, [name + ' عزیز، پاسخ شما پیش‌تر ثبت شده است و نیازی به ثبت دوباره نیست. آنچه ثبت شده:']);
    }

    var sum = $('res-summary');
    sum.innerHTML = '';
    var rows = [['نام', name]];
    if (rec.city && status !== 'already') rows.push(['شهر', rec.city === 'سایر شهرها' ? 'سایر شهرهای ' + rec.province : rec.city]);
    rows.push(['روز بازدید', d.label]);
    rows.push(['حضور', rec.attend ? 'بله' : 'خیر']);
    rows.push(['وضعیت', STATUS_FA[effective] || '—']);
    rows.forEach(function (r) {
      var li = document.createElement('li');
      var a = document.createElement('span'); a.textContent = r[0];
      var b = document.createElement('span'); b.textContent = r[1];
      li.appendChild(a); li.appendChild(b); sum.appendChild(li);
    });

    if (fromStorage) {
      var stored = 'این نتیجه‌ی ثبت‌نام قبلی شما روی همین گوشی است' +
        (rec.at ? ' (تاریخ ثبت: ' + toFa(new Date(rec.at).toLocaleDateString('fa-IR')) + ').' : '.');
      note.textContent = note.hidden ? stored : note.textContent + ' ' + stored;
      note.hidden = false;
    }
    show('result');
    if (status === 'confirmed' && !fromStorage) confetti();
  }

  $('btn-other').addEventListener('click', function () {
    state = { hph: '', key: '', name: '', province: '', city: '', hours: 0, day: '', attend: null, payload: null };
    codeInput.value = '';
    provSel.value = ''; fillCities();
    show('welcome');
    codeInput.focus();
  });

  // دکمه‌های بازگشت/رفتن
  var gos = document.querySelectorAll('[data-go]');
  for (var g = 0; g < gos.length; g++) {
    gos[g].addEventListener('click', function () {
      var to = this.getAttribute('data-go');
      if (to === 'welcome') { codeInput.select(); }
      show(to);
      if (to === 'welcome') codeInput.focus();
    });
  }

  if (!API) console.warn('[نفیس] ENDPOINT خالی است — حالت آزمایشی (mock).');

  // ---------- شروع ----------
  var prev = load();
  if (prev && prev.status && prev.name) renderResult(prev, true);
  else show('welcome');
})();
