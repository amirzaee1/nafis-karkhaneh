(function () {
  'use strict';

  var API = (typeof ENDPOINT !== 'undefined' && ENDPOINT) ? String(ENDPOINT).trim() : '';
  var CAP_DAYS = { '17': 'یکشنبه ۱۷ آبان', '19': 'سه‌شنبه ۱۹ آبان' };
  // رنگ‌های دسته‌ای به ترتیب ثابت؛ «سایر شهرها» همیشه خاکستری است.
  var COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'];
  var OTHER = '#98a2b3';
  var SS_HPH = 'nafis-admin-hph', SS_PW = 'nafis-admin-pw';

  var $ = function (id) { return document.getElementById(id); };
  function toFa(v) { return String(v).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; }); }
  function ssGet(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function ssSet(k, v) { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch (e) { /* اختیاری */ } }
  function normalizeHph(raw) {
    var s = String(raw || '').trim();
    s = s.replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); });
    s = s.replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); });
    s = s.replace(/[\s​-‏‪-‮⁦-⁩﻿]/g, '').toUpperCase();
    if (/^\d+$/.test(s)) s = 'HPH' + s;
    return s;
  }

  function call(payload) {
    if (!API) return Promise.reject(new Error('no_endpoint'));
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  // ---------- ورود ----------
  var form = $('f-login'), hphIn = $('a-hph'), pwIn = $('a-pw'), pw2In = $('a-pw2');
  var mode = 'code'; // code → password | setup
  var data = null, scope = 'all';

  function loginErr(m) { $('login-err').textContent = m || ''; }
  function busy(on) {
    $('btn-login').disabled = on;
    $('btn-login').querySelector('.lbl-txt').textContent = on ? 'لطفاً صبر کنید…' : (mode === 'setup' ? 'ذخیره‌ی رمز و ورود' : mode === 'password' ? 'ورود' : 'ادامه');
  }
  function setMode(m) {
    mode = m;
    $('pw-box').hidden = m === 'code';
    $('pw2-box').hidden = m !== 'setup';
    if (m === 'setup') {
      $('pw-note').textContent = 'اولین ورود شماست. یک رمز دلخواه (دست‌کم ۶ حرف یا عدد) بگذارید. از این به بعد فقط با کد شما و همین رمز می‌شود وارد مدیریت شد.';
      $('pw-lbl').textContent = 'رمز جدید';
      pwIn.setAttribute('autocomplete', 'new-password');
    } else if (m === 'password') {
      $('pw-note').textContent = 'رمز مدیریت را وارد کنید.';
      $('pw-lbl').textContent = 'رمز';
      pwIn.setAttribute('autocomplete', 'current-password');
    }
    busy(false);
    if (m !== 'code') setTimeout(function () { pwIn.focus(); }, 30);
  }

  function handleAuth(res, hph, pw) {
    if (res && res.ok) {
      ssSet(SS_HPH, hph); ssSet(SS_PW, pw);
      data = res;
      $('login').hidden = true; $('dash').hidden = false; $('btn-logout').hidden = false;
      render();
      return;
    }
    var e = res && res.error;
    if (e === 'not_admin') { setMode('code'); loginErr('این کد اجازه‌ی ورود به مدیریت را ندارد.'); }
    else if (e === 'no_password') { setMode('setup'); loginErr(''); }
    else if (e === 'wrong') { if (mode === 'password' && pw) loginErr('رمز درست نیست.'); else loginErr(''); setMode('password'); }
    else if (e === 'short') { setMode('setup'); loginErr('رمز باید دست‌کم ۶ حرف یا عدد باشد.'); }
    else loginErr('خطا: ' + (e || 'نامشخص'));
  }

  function tryLogin(hph, pw, setup) {
    busy(true);
    return call({ action: 'admin', hph: hph, pw: pw, setup: !!setup })
      .then(function (res) { handleAuth(res, hph, pw); })
      .catch(function () { loginErr('ارتباط با سرور برقرار نشد. اینترنت یا فیلترشکن را بررسی کنید و دوباره امتحان کنید.'); })
      .then(function () { busy(false); });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    loginErr('');
    var hph = normalizeHph(hphIn.value);
    if (!/^HPH\d{14}$/.test(hph)) { loginErr('کد HPH را کامل وارد کنید.'); hphIn.focus(); return; }
    if (mode === 'code') { tryLogin(hph, '', false); return; }
    var pw = pwIn.value;
    if (!pw) { loginErr('رمز را وارد کنید.'); pwIn.focus(); return; }
    if (mode === 'setup') {
      if (pw.length < 6) { loginErr('رمز باید دست‌کم ۶ حرف یا عدد باشد.'); return; }
      if (pw !== pw2In.value) { loginErr('رمز و تکرار آن یکی نیستند.'); pw2In.focus(); return; }
      tryLogin(hph, pw, true);
    } else {
      tryLogin(hph, pw, false);
    }
  });
  hphIn.addEventListener('input', function () { if (mode !== 'code') { setMode('code'); pwIn.value = ''; pw2In.value = ''; } });

  $('btn-logout').addEventListener('click', function () {
    ssSet(SS_HPH, ''); ssSet(SS_PW, '');
    data = null;
    $('dash').hidden = true; $('login').hidden = false; $('btn-logout').hidden = true;
    hphIn.value = ''; pwIn.value = ''; pw2In.value = ''; setMode('code');
  });

  $('btn-refresh').addEventListener('click', function () {
    var b = this; b.disabled = true; b.textContent = 'در حال به‌روزرسانی…';
    call({ action: 'admin', hph: ssGet(SS_HPH), pw: ssGet(SS_PW) })
      .then(function (res) { if (res.ok) { data = res; render(); } else { $('btn-logout').click(); } })
      .catch(function () { $('updated').textContent = 'به‌روزرسانی انجام نشد؛ دوباره امتحان کنید.'; })
      .then(function () { b.disabled = false; b.textContent = 'به‌روزرسانی'; });
  });

  // ---------- داشبورد ----------
  function pct(n, d) { return d ? Math.round(n * 1000 / d) / 10 : 0; }
  function faPct(v) { return toFa(String(v)).replace('.', '٫') + '٪'; }

  function render() {
    var rows = data.rows || [];
    var yes = rows.filter(function (r) { return r.attend; });
    var no = rows.length - yes.length;
    $('k-total').textContent = toFa(rows.length);
    $('k-total-sub').textContent = 'از ' + toFa(data.eligible) + ' نفر واجد شرایط';
    $('k-yes').textContent = toFa(yes.length);
    $('k-yes-sub').textContent = faPct(pct(yes.length, rows.length)) + ' از ثبت‌نام‌ها';
    $('k-no').textContent = toFa(no);
    $('k-no-sub').textContent = faPct(pct(no, rows.length)) + ' از ثبت‌نام‌ها';
    $('k-wait').textContent = toFa(Math.max(0, data.eligible - rows.length));
    var now = new Date();
    $('updated').textContent = 'آخرین به‌روزرسانی: ' + toFa(('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2));
    renderDays(rows);
    renderPie();
    renderTable();
  }

  function renderDays(rows) {
    var box = $('days'); box.innerHTML = '';
    ['17', '19'].forEach(function (d) {
      var c = rows.filter(function (r) { return r.day === d && r.status === 'قطعی'; }).length;
      var w = rows.filter(function (r) { return r.day === d && r.status === 'لیست انتظار'; }).length;
      var n = rows.filter(function (r) { return r.day === d && !r.attend; }).length;
      var el = document.createElement('div'); el.className = 'day';
      el.innerHTML = '<div class="day-top"><b></b><span></span></div><div class="bar"><i class="c"></i><i class="w"></i></div><div class="day-sub"></div>';
      el.querySelector('b').textContent = CAP_DAYS[d];
      el.querySelector('.day-top span').textContent = toFa(c) + ' از ' + toFa(data.cap) + ' نفر قطعی';
      var cw = Math.min(100, c * 100 / data.cap);
      el.querySelector('.c').style.width = cw + '%';
      el.querySelector('.w').style.width = Math.min(100 - cw, w * 100 / data.cap) + '%';
      el.querySelector('.day-sub').textContent = 'لیست انتظار: ' + toFa(w) + ' نفر · نمی‌آیند: ' + toFa(n) + ' نفر';
      box.appendChild(el);
    });
  }

  function countCities(rows) {
    var m = {};
    rows.forEach(function (r) { var k = r.city || 'نامشخص'; m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).map(function (k) { return { name: k, n: m[k] }; })
      .sort(function (a, b) { return b.n - a.n || a.name.localeCompare(b.name, 'fa'); });
  }

  function cityGroups() {
    // رنگ هر شهر از رتبه‌اش در «همه‌ی ثبت‌نام‌ها» می‌آید تا با عوض کردن فیلتر، رنگ شهرها جابه‌جا نشود.
    var all = countCities(data.rows || []);
    var named = all.length > COLORS.length ? COLORS.length - 1 : all.length;
    var colorOf = {};
    all.slice(0, named).forEach(function (g, i) { colorOf[g.name] = COLORS[i]; });

    var rows = (data.rows || []).filter(function (r) { return scope === 'all' || r.attend; });
    var list = [], rest = [];
    countCities(rows).forEach(function (g) { if (colorOf[g.name]) { g.color = colorOf[g.name]; list.push(g); } else rest.push(g); });
    if (rest.length) {
      list.push({ name: 'سایر شهرها (' + toFa(rest.length) + ' شهر)', n: rest.reduce(function (s, x) { return s + x.n; }, 0), color: OTHER, other: true });
    }
    return { list: list, total: rows.length };
  }

  function arc(cx, cy, r, a0, a1) {
    var x0 = cx + r * Math.sin(a0), y0 = cy - r * Math.cos(a0);
    var x1 = cx + r * Math.sin(a1), y1 = cy - r * Math.cos(a1);
    return 'M' + cx + ',' + cy + 'L' + x0.toFixed(2) + ',' + y0.toFixed(2) +
      'A' + r + ',' + r + ' 0 ' + (a1 - a0 > Math.PI ? 1 : 0) + ' 1 ' + x1.toFixed(2) + ',' + y1.toFixed(2) + 'Z';
  }

  function renderPie() {
    var g = cityGroups(), svg = $('pie'), leg = $('legend'), tip = $('tip');
    svg.innerHTML = ''; leg.innerHTML = '';
    $('pie-empty').hidden = g.total > 0;
    svg.style.display = g.total ? '' : 'none';
    if (!g.total) return;
    var a = 0, NS = 'http://www.w3.org/2000/svg';
    g.list.forEach(function (s, i) {
      var p = pct(s.n, g.total), sweep = s.n / g.total * Math.PI * 2;
      var el;
      if (g.list.length === 1) { el = document.createElementNS(NS, 'circle'); el.setAttribute('cx', 100); el.setAttribute('cy', 100); el.setAttribute('r', 96); }
      else { el = document.createElementNS(NS, 'path'); el.setAttribute('d', arc(100, 100, 96, a, a + sweep)); }
      el.setAttribute('fill', s.color);
      var mid = a + sweep / 2; a += sweep;
      var label = s.name + ' — ' + toFa(s.n) + ' نفر (' + faPct(p) + ')';
      var t = document.createElementNS(NS, 'title'); t.textContent = label; el.appendChild(t);
      var li = document.createElement('li');
      li.innerHTML = '<span class="sw"></span><span class="nm"></span><span class="n"></span><span class="p"></span>';
      li.querySelector('.sw').style.background = s.color;
      li.querySelector('.nm').textContent = s.name;
      li.querySelector('.n').textContent = toFa(s.n) + ' نفر';
      li.querySelector('.p').textContent = faPct(p);
      function on() {
        svg.classList.add('hovering'); el.classList.add('on'); li.classList.add('on');
        tip.textContent = label; tip.hidden = false;
        var box = svg.getBoundingClientRect(), k = box.width / 200;
        tip.style.right = 'auto';
        tip.style.left = ((100 + 60 * Math.sin(mid)) * k) + 'px';
        tip.style.top = ((100 - 60 * Math.cos(mid)) * k) + 'px';
      }
      function off() { svg.classList.remove('hovering'); el.classList.remove('on'); li.classList.remove('on'); tip.hidden = true; }
      el.addEventListener('mouseenter', on); el.addEventListener('mouseleave', off);
      li.addEventListener('mouseenter', on); li.addEventListener('mouseleave', off);
      el.addEventListener('click', on);
      svg.appendChild(el); leg.appendChild(li);
    });
  }

  var segBtns = document.querySelectorAll('.seg button');
  for (var i = 0; i < segBtns.length; i++) {
    segBtns[i].addEventListener('click', function () {
      scope = this.getAttribute('data-scope');
      for (var j = 0; j < segBtns.length; j++) segBtns[j].setAttribute('aria-selected', String(segBtns[j] === this));
      renderPie();
    });
  }

  function renderTable() {
    var q = $('q').value.trim(), tb = $('rows');
    tb.innerHTML = '';
    var rows = (data.rows || []).slice().reverse().filter(function (r) {
      return !q || [r.name, r.city, r.province, r.hph].join(' ').indexOf(q) >= 0 || String(r.hph).indexOf(normalizeHph(q)) >= 0;
    });
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      var d = new Date(r.t);
      var when = isNaN(d) ? '' : d.toLocaleString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      var cls = r.status === 'قطعی' ? 'ok' : r.status === 'لیست انتظار' ? 'wl' : 'no';
      [r.name, r.city, CAP_DAYS[r.day] || r.day, r.attend ? 'بله' : 'خیر', null, when].forEach(function (v, k) {
        var td = document.createElement('td');
        if (k === 4) { var s = document.createElement('span'); s.className = 'pill ' + cls; s.textContent = r.status; td.appendChild(s); }
        else td.textContent = v;
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    if (!rows.length) {
      var tr = document.createElement('tr'), td = document.createElement('td');
      td.colSpan = 6; td.textContent = q ? 'موردی پیدا نشد.' : 'هنوز کسی ثبت‌نام نکرده است.'; td.className = 'muted';
      tr.appendChild(td); tb.appendChild(tr);
    }
  }
  $('q').addEventListener('input', function () { if (data) renderTable(); });

  // اگر از صفحه‌ی اول با کد مدیر آمده‌ایم، کد را پر کن و اگر رمز این نشست را داریم، مستقیم وارد شو.
  var savedHph = ssGet(SS_HPH), savedPw = ssGet(SS_PW);
  if (savedHph) {
    hphIn.value = savedHph;
    tryLogin(savedHph, savedPw, false);
  }
})();
