(function () {
  'use strict';
  var I = window.I18N, lang = 'ru';
  try { lang = localStorage.getItem('lang') || ''; } catch (e) {}
  if (!I[lang]) { var nl = (navigator.language || 'ru').slice(0, 2); lang = I[nl] ? nl : 'ru'; }

  var $ = function (id) { return document.getElementById(id); };
  var T = function (k) { return (I[lang] && I[lang][k]) || I.ru[k] || k; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var CATS = ['tee', 'polo', 'hoodie', 'cap', 'joggers'];
  var FONTS = ['Manrope', 'Inter', 'Montserrat', 'Unbounded', 'Russo One', 'Bebas Neue', 'Oswald', 'Playfair Display', 'Cormorant Garamond', 'Righteous', 'Bowlby One', 'Rubik Mono One', 'Pacifico', 'Lobster', 'Marck Script', 'Caveat', 'Comfortaa', 'Mrs Saint Delafield'];
  var DATA = null, PRODUCTS = [], CART = [];

  try { CART = JSON.parse(localStorage.getItem('cart') || '[]') || []; } catch (e) { CART = []; }

  function money(n) {
    if (!n) return T('price') === 'Стоимость' ? 'по запросу' : 'on request';
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + '\u00a0сум';
  }
  function L(o, fb) { return o ? (o[lang] || o.ru || fb || '') : (fb || ''); }
  function catName(c) { return T(c) || c; }

  // ---------------- язык ----------------
  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (e) { e.textContent = T(e.dataset.i18n); });
    document.querySelectorAll('#lang button').forEach(function (b) { b.classList.toggle('on', b.dataset.l === lang); });
    try { localStorage.setItem('lang', lang); } catch (e) {}
    if (DATA) { renderFilters(); renderShop(); renderQuiz(); renderBuilderControls(); updateCartUI(); renderSocials(); renderCollection(); draw(); }
  }
  $('lang').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    lang = b.dataset.l; applyLang();
  });

  // ---------------- данные ----------------
  function load() {
    fetch('/api/public', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      DATA = d;
      PRODUCTS = (d.products || []).slice();
      applyLang();
      renderCollection();
      renderSocials();
      updateCartUI();
    }).catch(function (e) {
      console.error('LOAD FAIL', e && e.message, e && e.stack);
      var box = $('shopGrid'); if (box) box.innerHTML = '<p class="sub">Не удалось загрузить данные. Обновите страницу.</p>';
    });
  }

  function colors() { return (DATA && DATA.settings.colors) || [{ id: 'navy', hex: '#16213a', ru: 'Тёмно-синяя' }]; }
  function sizes() { return (DATA && DATA.settings.sizes) || ['S', 'M', 'L', 'XL']; }
  function prices() { return (DATA && DATA.settings.prices) || { base: 0, print: 0, custom: 0 }; }

  // ---------------- квиз ----------------
  var quiz = { item: '', size: '', style: '' };
  function quizModel() {
    return [
      { k: 'item', q: 'q1', opts: [['tee', 'q1a'], ['hoodie', 'q1b'], ['cap', 'q1c'], ['joggers', 'q1d']] },
      { k: 'size', q: 'q2', opts: sizes().map(function (s) { return [s, s]; }) },
      { k: 'style', q: 'q3', opts: [['min', 'q3a'], ['graph', 'q3b'], ['sport', 'q3c'], ['street', 'q3d']] }
    ];
  }
  function renderQuiz() {
    var box = $('quizSteps'); if (!box) return;
    box.innerHTML = quizModel().map(function (s) {
      return '<div class="qstep"><h4>' + esc(T(s.q)) + '</h4><div class="opts">' +
        s.opts.map(function (o) {
          var on = quiz[s.k] === o[0] ? ' class="on"' : '';
          return '<button data-k="' + s.k + '" data-v="' + esc(o[0]) + '"' + on + '>' + esc(o[0] === o[1] ? o[1] : T(o[1])) + '</button>';
        }).join('') + '</div></div>';
    }).join('');
    $('quizPick').disabled = !(quiz.item && quiz.size && quiz.style);
  }
  $('quizSteps').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    quiz[b.dataset.k] = b.dataset.v; renderQuiz();
  });
  $('quizPick').addEventListener('click', function () {
    var pick = pickLook(quiz);
    var look = $('look'), list = $('lookList');
    list.innerHTML = '';
    if (!pick.length) { $('lookEmpty').hidden = false; }
    else { $('lookEmpty').hidden = true; }
    pick.forEach(function (p) { list.appendChild(lookCard(p)); });
    look.hidden = false;
    look.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('quizAgain').addEventListener('click', function () {
    quiz = { item: '', size: '', style: '' }; renderQuiz(); $('look').hidden = true;
    document.getElementById('top').scrollIntoView({ behavior: 'smooth' });
  });

  function pickLook(q) {
    var pool = PRODUCTS.filter(function (p) { return p.available !== false; });
    var score = function (p) {
      var s = 0;
      if (p.category === q.item) s += 10;
      if ((p.sizes || []).indexOf(q.size) >= 0) s += 4;
      if (q.style === 'min' && /min|basic/i.test(L(p.name))) s += 1;
      if (q.style === 'graph' && /graph|print/i.test(L(p.name))) s += 1;
      s += (p.photo && p.photo.indexOf('/collection/') === 0) ? 1 : 0;
      return s;
    };
    var sorted = pool.slice().sort(function (a, b) { return score(b) - score(a); });
    var out = [];
    var main = sorted.find(function (p) { return p.category === q.item && (p.sizes || []).indexOf(q.size) >= 0; }) || sorted[0];
    if (main) out.push(main);
    ['cap', 'joggers', 'hoodie', 'tee'].forEach(function (c) {
      if (out.length >= 3 || c === q.item) return;
      var p = sorted.find(function (x) { return x.category === c && out.indexOf(x) < 0 && (x.sizes || []).indexOf(q.size) >= 0; });
      if (p) out.push(p);
    });
    return out;
  }

  function lookCard(p) {
    var el = document.createElement('div');
    el.className = 'lookcard';
    el.innerHTML = '<span class="tag">' + esc(catName(p.category)) + '</span>' +
      '<img src="' + esc(p.photo) + '" alt="' + esc(L(p.name)) + '" loading="lazy">' +
      '<div class="meta"><b>' + esc(L(p.name)) + '</b>' +
      '<div class="pr" style="margin-top:4px;font-weight:800">' + money(p.price) + '</div>' +
      '<div class="muted" style="margin:6px 0 12px">' + esc((p.sizes || []).join(' · ')) + (p.leadTime ? ' · ' + esc(p.leadTime) : '') + '</div>' +
      '<button class="mini">' + esc(T('add_cart')) + '</button></div>';
    el.querySelector('button').addEventListener('click', function () { addReady(p); });
    return el;
  }

  // ---------------- магазин ----------------
  var filter = 'all';
  function renderFilters() {
    var box = $('filters'); if (!box) return;
    var all = [['all', T('filter_all')]].concat(CATS.map(function (c) { return [c, T(c)]; }));
    box.innerHTML = all.map(function (x) {
      return '<button data-c="' + x[0] + '"' + (filter === x[0] ? ' class="on"' : '') + '>' + esc(x[1]) + '</button>';
    }).join('');
  }
  $('filters').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    filter = b.dataset.c; renderFilters(); renderShop();
  });

  function renderShop() {
    var grid = $('shopGrid'); if (!grid) return;
    var list = PRODUCTS.filter(function (p) { return filter === 'all' || p.category === filter; });
    if (!list.length) { grid.innerHTML = '<p class="sub">—</p>'; return; }
    grid.innerHTML = '';
    list.forEach(function (p) { grid.appendChild(productCard(p)); });
  }

  function productCard(p) {
    var el = document.createElement('article');
    el.className = 'pcard';
    var out = p.available === false;
    el.innerHTML = '<div class="ph"><img loading="lazy" src="' + esc(p.photo) + '" alt="' + esc(L(p.name)) + '">' +
      '<span class="badge' + (out ? ' out' : '') + '">' + esc(out ? T('out_stock') : T('in_stock')) + '</span></div>' +
      '<div class="info"><div class="nm"><b>' + esc(L(p.name)) + '</b><span class="pr">' + money(p.price) + '</span></div>' +
      '<div class="sz">' + esc(catName(p.category)) + ' · ' + esc((p.sizes || []).join(' ')) + '</div>' +
      '<div class="ld">' + (p.leadTime ? esc(T('lead')) + ': ' + esc(p.leadTime) : '') + '</div></div>';
    el.addEventListener('click', function () { openProduct(p); });
    return el;
  }

  function openProduct(p) {
    var out = p.available === false;
    $('pmBody').innerHTML = '<div class="pm"><div><img src="' + esc(p.photo) + '" alt=""></div><div>' +
      '<h2 style="margin-bottom:6px">' + esc(L(p.name)) + '</h2>' +
      '<div class="muted">' + esc(catName(p.category)) + '</div>' +
      '<div class="pr">' + money(p.price) + '</div>' +
      '<p class="sub">' + esc(L(p.desc, '')) + '</p>' +
      '<h3>' + esc(T('sizes_l')) + '</h3><div class="row" id="pmSizes">' +
      (p.sizes || []).map(function (s) { return '<span data-s="' + esc(s) + '">' + esc(s) + '</span>'; }).join('') + '</div>' +
      (p.leadTime ? '<p class="muted">' + esc(T('lead')) + ': ' + esc(p.leadTime) + '</p>' : '') +
      '<p class="muted">' + esc(out ? T('out_stock') : T('in_stock')) + '</p>' +
      '<button class="btn" id="pmAdd"' + (out ? ' disabled' : '') + '>' + esc(T('add_cart')) + '</button>' +
      '</div></div>';
    $('pmodal').hidden = false;
    var chosen = (p.sizes || [])[0] || '';
    var row = $('pmSizes');
    if (row) {
      row.querySelectorAll('span').forEach(function (s) {
        if (s.dataset.s === chosen) s.style.borderColor = 'rgba(200,242,74,.7)';
        s.addEventListener('click', function () {
          chosen = s.dataset.s;
          row.querySelectorAll('span').forEach(function (x) { x.style.borderColor = ''; });
          s.style.borderColor = 'rgba(200,242,74,.7)';
        });
      });
    }
    var add = $('pmAdd');
    if (add) add.addEventListener('click', function () { addReady(p, chosen); $('pmodal').hidden = true; });
  }
  $('pmClose').addEventListener('click', function () { $('pmodal').hidden = true; });
  $('pmodal').addEventListener('click', function (e) { if (e.target === $('pmodal')) $('pmodal').hidden = true; });

  function renderCollection() {
    var box = $('coll'); if (!box) return;
    var srcs = [];
    PRODUCTS.forEach(function (p) { if (p.photo && srcs.indexOf(p.photo) < 0) srcs.push(p.photo); });
    for (var i = 1; i <= 30; i++) { var s = '/collection/n' + String(i).padStart(2, '0') + '.jpg'; if (srcs.indexOf(s) < 0) srcs.push(s); }
    box.innerHTML = srcs.map(function (s) {
      return '<figure><img loading="lazy" src="' + esc(s) + '" alt="Norm"></figure>';
    }).join('');
  }

  function renderSocials() {
    var c = (DATA && DATA.settings.contacts) || {};
    var html = '';
    if (c.instagram) html += '<a href="https://instagram.com/' + esc(c.instagram) + '" target="_blank" rel="noopener">Instagram</a>';
    if (c.telegram) html += '<a href="https://t.me/' + esc(c.telegram.replace(/^@/, '')) + '" target="_blank" rel="noopener">Telegram</a>';
    if (c.phone) html += '<a href="tel:' + esc(c.phone) + '">' + esc(c.phone) + '</a>';
    html += '<a href="https://www.tiktok.com/@' + esc(c.tiktok || 'norm.byazastorm') + '" target="_blank" rel="noopener">TikTok</a>';
    if ($('socials')) $('socials').innerHTML = html;
    if ($('footYear')) $('footYear').textContent = '© ' + new Date().getFullYear() + ' · ' + T('footer_rights');
  }

  // ---------------- корзина ----------------
  function saveCart() { try { localStorage.setItem('cart', JSON.stringify(CART)); } catch (e) {} }
  function uid() { return Math.random().toString(36).slice(2, 9); }

  function addReady(p, size) {
    size = size || (p.sizes || [])[0] || sizes()[0];
    CART.push({
      id: uid(), kind: 'ready', title: L(p.name), sub: catName(p.category) + ' · ' + size,
      price: +p.price || 0, qty: 1, photo: p.photo,
      config: { mode: 'ready', productId: p.id, productName: L(p.name), item: p.category, size: size, color: colors()[0].id, leadTime: p.leadTime || '' }
    });
    saveCart(); updateCartUI(); flashCart();
  }

  function updateCartUI() {
    var count = CART.reduce(function (a, x) { return a + x.qty; }, 0);
    $('cartCount').textContent = count;
    var total = CART.reduce(function (a, x) { return a + x.price * x.qty; }, 0);
    $('cartTotal').textContent = money(total);
    $('sumTotal').textContent = CART.length ? money(total) : '—';
    var body = $('cartBody');
    if (!CART.length) { body.innerHTML = '<p class="muted" style="padding:20px 4px">' + esc(T('cart_empty')) + '</p>'; return; }
    body.innerHTML = '';
    CART.forEach(function (it) {
      var el = document.createElement('div'); el.className = 'citem';
      el.innerHTML = '<img src="' + esc(it.photo) + '" alt="">' +
        '<div class="ci"><b>' + esc(it.title) + '</b><span>' + esc(it.sub) + '</span>' +
        '<div class="ops"><button data-m="-1">−</button><span>' + it.qty + '</span><button data-m="1">+</button>' +
        '<button class="rm" data-rm="1">' + esc(T('remove')) + '</button></div></div>';
      el.querySelectorAll('[data-m]').forEach(function (b) {
        b.addEventListener('click', function () {
          it.qty = Math.max(1, Math.min(20, it.qty + (+b.dataset.m)));
          saveCart(); updateCartUI();
        });
      });
      el.querySelector('[data-rm]').addEventListener('click', function () {
        CART = CART.filter(function (x) { return x !== it; }); saveCart(); updateCartUI();
      });
      body.appendChild(el);
    });
  }
  function flashCart() { $('cartBtn').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 320 }); }

  function openCart() { $('cart').classList.add('open'); $('scrim').classList.add('on'); $('cart').setAttribute('aria-hidden', 'false'); }
  function closeCart() { $('cart').classList.remove('open'); $('scrim').classList.remove('on'); $('cart').setAttribute('aria-hidden', 'true'); }
  $('cartBtn').addEventListener('click', openCart);
  $('cartClose').addEventListener('click', closeCart);
  $('scrim').addEventListener('click', closeCart);
  $('cartCheckout').addEventListener('click', function () {
    if (!CART.length) return;
    closeCart(); document.getElementById('order').scrollIntoView({ behavior: 'smooth' });
  });

  // ---------------- конструктор ----------------
  var canvas = $('stage'), ctx = canvas.getContext('2d');
  var CW = 720, CH = 900;
  var B = {
    item: 'tee', color: colors()[0].id, custom: '', size: '', side: 'front',
    layers: [], sel: null, angle: 0, drag: null, zipping: false
  };

  function colorHex() {
    if (B.color === 'custom') return B.custom || '#16213a';
    var c = colors().find(function (x) { return x.id === B.color; });
    return c ? c.hex : '#16213a';
  }

  // зона печати (в координатах канвы)
  function zone() {
    var z = {
      tee: { x: 262, y: 268, w: 196, h: 300 },
      polo: { x: 262, y: 240, w: 196, h: 300 },
      hoodie: { x: 268, y: 300, w: 184, h: 250 },
      cap: { x: 262, y: 300, w: 196, h: 120 },
      joggers: { x: 300, y: 470, w: 120, h: 150 }
    }[B.item] || { x: 262, y: 268, w: 196, h: 300 };
    return z;
  }

  var imgCache = {};
  function imgFor(src) {
    if (!imgCache[src]) {
      var im = new Image(); im.onload = draw; im.src = src; imgCache[src] = im;
    }
    return imgCache[src];
  }

  function drawLayer(l) {
    var z = zone();
    var cx = z.x + l.x * z.w, cy = z.y + l.y * z.h;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(l.rot * Math.PI / 180);
    if (l.type === 'text') {
      var fs = Math.max(10, z.w * 0.3 * l.scale);
      ctx.font = '800 ' + fs + 'px ' + (l.font || 'Manrope') + ', Manrope, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = l.color || '#f4f3ef';
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      ctx.fillText(l.text || 'Norm', 0, 0);
      var m = ctx.measureText(l.text || 'Norm');
      l._box = { x: -m.width / 2, y: -fs / 2, w: m.width, h: fs };
    } else {
      var im = imgFor(l.src);
      var w = z.w * 0.72 * l.scale, h = w;
      if (im.complete && im.naturalWidth) h = w * (im.naturalHeight / im.naturalWidth);
      ctx.globalAlpha = 1;
      if (im.complete && im.naturalWidth) {
        // лёгкая печать: умножаем на ткань
        ctx.drawImage(im, -w / 2, -h / 2, w, h);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(-w / 2, -h / 2, w, h);
      }
      l._box = { x: -w / 2, y: -h / 2, w: w, h: h };
    }
    ctx.restore();
    return { cx: cx, cy: cy };
  }

  var BASE_SRC = { tee: '/base/tee.jpg', polo: '/base/polo.jpg', hoodie: '/base/hoodie.jpg', cap: '/base/cap.jpg', joggers: '/base/joggers.jpg' };

  function drawGarment() {
    var im = imgFor(BASE_SRC[B.item] || BASE_SRC.tee);
    if (!im.complete || !im.naturalWidth) return;
    var h = 760, w = h * im.naturalWidth / im.naturalHeight;
    if (w > 600) { w = 600; h = w * im.naturalHeight / im.naturalWidth; }
    var x = (CW - w) / 2, y = (CH - h) / 2 + 10;
    ctx.save();
    ctx.filter = 'grayscale(1)';
    ctx.drawImage(im, x, y, w, h);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = colorHex();
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  function draw() {
    if (!canvas) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, CW, CH);
    var bg = ctx.createRadialGradient(360, 380, 60, 360, 460, 620);
    bg.addColorStop(0, 'rgba(255,255,255,.07)'); bg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);

    // тень под вещью
    ctx.save();
    ctx.filter = 'blur(28px)'; ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.beginPath(); ctx.ellipse(360, B.item === 'cap' ? 545 : 820, 210, 34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    drawGarment();

    // слои
    B.layers.filter(function (l) { return l.side === B.side; }).forEach(function (l) {
      var pos = drawLayer(l);
      if (l === B.sel) {
        var b = l._box;
        ctx.save();
        ctx.translate(pos.cx, pos.cy); ctx.rotate(l.rot * Math.PI / 180);
        ctx.strokeStyle = 'rgba(200,242,74,.9)'; ctx.lineWidth = 1.6; ctx.setLineDash([6, 5]);
        ctx.strokeRect(b.x - 8, b.y - 8, b.w + 16, b.h + 16);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(200,242,74,.9)';
        [[b.x - 8, b.y - 8], [b.x + b.w + 8, b.y - 8], [b.x - 8, b.y + b.h + 8], [b.x + b.w + 8, b.y + b.h + 8]].forEach(function (p) {
          ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, Math.PI * 2); ctx.fill();
        });
        ctx.restore();
      }
    });

    if (!B.layers.some(function (l) { return l.side === B.side; })) {
      ctx.save();
      var z = zone();
      ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1.4; ctx.setLineDash([8, 8]);
      ctx.strokeRect(z.x, z.y, z.w, z.h);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.font = '600 15px Manrope, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(T('no_layers').slice(0, 42), z.x + z.w / 2, z.y + z.h / 2);
      ctx.restore();
    }
  }

  // координаты из события
  function canvasPos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * CW, y: (e.clientY - r.top) / r.height * CH };
  }
  function hit(p) {
    var zoneBox = zone();
    var found = null;
    B.layers.filter(function (l) { return l.side === B.side; }).forEach(function (l) {
      var cx = zoneBox.x + l.x * zoneBox.w, cy = zoneBox.y + l.y * zoneBox.h;
      var b = l._box || { x: -40, y: -20, w: 80, h: 40 };
      var dx = p.x - cx, dy = p.y - cy;
      var a = -l.rot * Math.PI / 180;
      var rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a);
      if (rx > b.x - 6 && rx < b.x + b.w + 6 && ry > b.y - 6 && ry < b.y + b.h + 6) found = l;
    });
    return found;
  }

  canvas.addEventListener('pointerdown', function (e) {
    var p = canvasPos(e);
    var l = hit(p);
    if (l) {
      B.sel = l; B.drag = { l: l, p: p, x: l.x, y: l.y };
      canvas.setPointerCapture(e.pointerId);
      renderLayerList(); draw(); syncAdjust();
    } else {
      B.drag = { tilt: true, x0: e.clientX, angle: B.angle };
      canvas.setPointerCapture(e.pointerId);
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!B.drag) return;
    if (B.drag.tilt) {
      var d = (e.clientX - B.drag.x0) / 6;
      B.angle = Math.max(-32, Math.min(32, B.drag.angle + d));
      canvas.style.transform = 'rotateY(' + B.angle + 'deg)';
      return;
    }
    var p = canvasPos(e), l = B.drag.l, z = zone();
    l.x = Math.max(-0.25, Math.min(1.25, B.drag.x + (p.x - B.drag.p.x) / z.w));
    l.y = Math.max(-0.25, Math.min(1.25, B.drag.y + (p.y - B.drag.p.y) / z.h));
    draw();
  });
  window.addEventListener('pointerup', function () { B.drag = null; });

  $('resetView').addEventListener('click', function () {
    B.angle = 0; canvas.style.transform = 'rotateY(0deg)';
  });

  // стороны
  function renderSides() {
    $('sides').innerHTML = ['front', 'back'].map(function (s) {
      return '<button data-s="' + s + '"' + (B.side === s ? ' class="on"' : '') + '>' + esc(T(s)) + '</button>';
    }).join('');
  }
  $('sides').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    B.side = b.dataset.s; B.sel = null; renderSides(); renderLayerList(); syncAdjust(); draw();
  });

  function renderBuilderControls() {
    // вид одежды
    $('chItem').innerHTML = CATS.map(function (c) {
      return '<button data-v="' + c + '"' + (B.item === c ? ' class="on"' : '') + '>' + esc(T(c)) + '</button>';
    }).join('');
    // цвета
    $('chColor').innerHTML = colors().map(function (c) {
      return '<button data-v="' + esc(c.id) + '"' + (B.color === c.id ? ' class="on"' : '') + '><span class="sw" style="background:' + esc(c.hex) + '"></span>' + esc(L(c, c.id)) + '</button>';
    }).join('') + '<button data-v="custom"' + (B.color === 'custom' ? ' class="on"' : '') + '><span class="sw" style="background:' + esc(B.custom || '#16213a') + '"></span>' + esc(T('custom')) + '</button>';
    // размеры
    $('chSize').innerHTML = sizes().map(function (s) {
      return '<button data-v="' + esc(s) + '"' + (B.size === s ? ' class="on"' : '') + '>' + esc(s) + '</button>';
    }).join('');
    // шрифты
    $('fontSel').innerHTML = FONTS.map(function (f) { return '<option value="' + f + '">' + f + '</option>'; }).join('');
    renderSides(); renderLayerList(); updatePrice();
  }

  $('chItem').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    B.item = b.dataset.v; renderBuilderControls(); draw();
  });
  $('chColor').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    B.color = b.dataset.v; if (B.color === 'custom') B.custom = $('ccol').value;
    renderBuilderControls(); draw();
  });
  $('ccol').addEventListener('input', function () {
    B.custom = this.value; B.color = 'custom';
    renderBuilderControls(); draw();
  });
  $('chSize').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    B.size = b.dataset.v; renderBuilderControls();
  });

  // добавление слоёв
  document.querySelectorAll('[data-add]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var t = btn.dataset.add;
      $('spText').hidden = t !== 'text';
      $('spPhoto').hidden = t !== 'image';
      $('spLink').hidden = t !== 'link';
      if (t === 'text') { $('txtIn').value = $('txtIn').value || 'Norm'; $('txtIn').focus(); }
    });
  });

  function addLayer(l) {
    l.id = uid(); l.side = B.side; l.x = 0.5; l.y = 0.42; l.scale = 1; l.rot = 0;
    B.layers.push(l); B.sel = l;
    renderLayerList(); updatePrice(); draw();
  }
  $('applyText').addEventListener('click', function () {
    var v = $('txtIn').value.trim() || 'Norm';
    addLayer({ type: 'text', text: v, font: $('fontSel').value, color: $('tcolor').value });
  });
  $('photoIn').addEventListener('change', function () {
    var f = this.files && this.files[0]; if (!f) return;
    if (f.size > 6 * 1024 * 1024) { $('linkMsg').textContent = 'Файл больше 6 МБ'; return; }
    var fr = new FileReader();
    fr.onload = function () {
      var im = new Image();
      im.onload = function () { addLayer({ type: 'image', src: im.src }); draw(); };
      im.src = fr.result;
    };
    fr.readAsDataURL(f);
    this.value = '';
  });
  $('linkBtn').addEventListener('click', function () {
    var url = $('linkIn').value.trim();
    if (!url) return;
    $('linkMsg').textContent = '…';
    fetch('/api/ref-image?url=' + encodeURIComponent(url)).then(function (r) { return r.json(); }).then(function (d) {
      if (d.image) { $('linkMsg').textContent = ''; addLayer({ type: 'image', src: d.image, link: url, desc: $('descIn').value.trim() }); draw(); }
      else $('linkMsg').textContent = 'Не удалось загрузить. Попробуй другую ссылку.';
    }).catch(function () { $('linkMsg').textContent = 'Не удалось загрузить.'; });
  });

  function renderLayerList() {
    var box = $('layerList');
    var list = B.layers.filter(function (l) { return l.side === B.side; });
    $('noLayers').hidden = !!list.length;
    box.innerHTML = '';
    list.forEach(function (l) {
      var el = document.createElement('button');
      el.className = 'layeritem' + (l === B.sel ? ' on' : '');
      var th = l.type === 'image' ? '<img class="th" src="' + esc(l.src) + '" alt="">' : '<span class="th">Aa</span>';
      var label = l.type === 'image' ? (l.desc || T('m_photo')) : (l.text || 'Norm');
      el.innerHTML = th + '<span class="lb"><b>' + esc(label) + '</b><span>' + esc(T(l.type === 'image' ? 'm_photo' : 'm_text')) + ' · ' + (l.side === 'front' ? T('front') : T('back')) + '</span></span>';
      el.addEventListener('click', function () { B.sel = l; renderLayerList(); syncAdjust(); draw(); });
      box.appendChild(el);
    });
    if (B.sel && B.layers.indexOf(B.sel) < 0) B.sel = null;
    syncAdjust();
  }

  function syncAdjust() {
    var a = $('adjust');
    if (!B.sel) { a.hidden = true; return; }
    a.hidden = false;
    $('sc').value = Math.round(B.sel.scale * 100);
    $('rot').value = B.sel.rot;
  }
  $('sc').addEventListener('input', function () { if (B.sel) { B.sel.scale = +this.value / 100; draw(); } });
  $('rot').addEventListener('input', function () { if (B.sel) { B.sel.rot = +this.value; draw(); } });
  $('delLayer').addEventListener('click', function () {
    if (!B.sel) return;
    B.layers = B.layers.filter(function (l) { return l !== B.sel; });
    B.sel = null; renderLayerList(); updatePrice(); draw();
  });

  function currentTotal() {
    if (!DATA) return 0;
    var p = prices(), t = (+p.base || 0) + (+p.print || 0);
    if (B.layers.some(function (l) { return l.type === 'image'; })) t += +p.custom || 0;
    return t;
  }
  function updatePrice() { $('price').textContent = (+prices().base) ? money(currentTotal()) : '—'; }

  $('addToCart').addEventListener('click', function () {
    if (!B.layers.length) { addToCartBrief('Добавь хотя бы один элемент'); return; }
    var size = B.size || sizes()[0];
    var preview = snapshot();
    var cfg = {
      mode: B.layers.some(function (l) { return l.type === 'image'; }) ? 'photo' : 'text',
      item: B.item, color: B.color, customHex: B.color === 'custom' ? B.custom : '',
      size: size, text: (B.layers.find(function (l) { return l.type === 'text'; }) || {}).text || '',
      layers: B.layers.map(function (l) { return { side: l.side, type: l.type === 'image' ? 'image' : 'text', t: l.text || l.desc || '' }; }),
      zip: B.zip, cuff: B.cuff
    };
    CART.push({
      id: uid(), kind: 'builder', title: catName(B.item), sub: size + ' · ' + (colors().find(function (c) { return c.id === B.color; }) || { ru: 'свой' })[lang] ,
      price: currentTotal(), qty: 1, photo: preview, config: cfg
    });
    saveCart(); updateCartUI(); flashCart(); openCart();
  });
  function addToCartBrief(msg) {
    var b = $('addToCart'); var old = b.textContent;
    b.textContent = msg; b.disabled = true;
    setTimeout(function () { b.textContent = old; b.disabled = false; }, 1600);
  }

  // снапшот: фронт + спина
  function snapshot() {
    var side = B.side, sel = B.sel;
    B.sel = null;
    var c1 = document.createElement('canvas'); c1.width = CW; c1.height = CH;
    var c2 = document.createElement('canvas'); c2.width = CW; c2.height = CH;
    var mainCtx = ctx;
    // фронт
    var old = ctx;
    function renderTo(target, sd) {
      var tmp = target.getContext('2d');
      ctx = tmp;
      B.side = sd;
      draw();
      ctx = mainCtx;
    }
    renderTo(c1, 'front'); renderTo(c2, 'back');
    B.side = side; B.sel = sel;
    var out = document.createElement('canvas');
    out.width = 900; out.height = 560;
    var o = out.getContext('2d');
    o.fillStyle = '#0b0c10'; o.fillRect(0, 0, out.width, out.height);
    o.drawImage(c1, 0, 0, CW, CH, 0, 0, 450, 560);
    o.drawImage(c2, 0, 0, CW, CH, 450, 0, 450, 560);
    o.fillStyle = 'rgba(255,255,255,.25)'; o.font = '600 12px Manrope, sans-serif';
    o.fillText('FRONT', 14, 20); o.fillText('BACK', 464, 20);
    return out.toDataURL('image/jpeg', 0.72);
  }

  // ---------------- оформление ----------------
  function submitOrder(e) {
    e.preventDefault();
    var name = $('fName').value.trim(), phone = $('fPhone').value.trim();
    var msg = $('formMsg');
    if (name.length < 2) { msg.textContent = 'Укажи имя'; $('fName').focus(); return; }
    if (phone.replace(/\D/g, '').length < 7) { msg.textContent = 'Укажи телефон'; $('fPhone').focus(); return; }
    if (!CART.length) { msg.textContent = 'Корзина пуста — добавь вещь из магазина или конструктора'; return; }
    var btn = $('submitBtn'); btn.disabled = true; msg.textContent = T('sending');
    var lead = CART.map(function (x) { return x.config.leadTime || ''; }).filter(Boolean)[0] || '';
    var payload = {
      customer: { name: name, phone: phone, city: $('fCity').value.trim(), comment: $('fComment').value.trim() },
      lang: lang, leadTime: lead, website: $('website').value,
      items: CART.map(function (x) { return { config: x.config, preview: x.photo, qty: x.qty }; })
    };
    fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        btn.disabled = false;
        if (res.ok) {
          $('okNum').textContent = res.d.number;
          $('modal').hidden = false;
          CART = []; saveCart(); updateCartUI();
          $('form').reset(); msg.textContent = '';
        } else { msg.textContent = res.d.error === 'invalid' ? 'Проверь имя и телефон' : 'Ошибка. Попробуй ещё раз.'; }
      })
      .catch(function () { btn.disabled = false; msg.textContent = 'Нет связи с сервером.'; });
  }
  $('form').addEventListener('submit', submitOrder);
  $('okClose').addEventListener('click', function () { $('modal').hidden = true; });

  $('trkBtn').addEventListener('click', function () {
    var n = $('trkNum').value.trim(), ph = $('trkPhone').value.trim();
    fetch('/api/track?number=' + encodeURIComponent(n) + '&phone=' + encodeURIComponent(ph))
      .then(function (r) { return r.json(); }).then(function (d) {
        $('trkRes').textContent = d.status ? T('track_res') + ': ' + d.status : 'Заказ не найден';
      }).catch(function () { $('trkRes').textContent = 'Ошибка'; });
  });

  // ---------------- повтор интро по клику на глаз ----------------
  var eyeCard = document.querySelector('.eye-card');
  if (eyeCard) {
    eyeCard.style.cursor = 'pointer';
    eyeCard.title = 'Показать интро заново';
    eyeCard.addEventListener('click', function () {
      try { sessionStorage.removeItem('normIntro'); } catch (e) {}
      location.reload();
    });
  }

  // ---------------- старт ----------------
  applyLang();
  load();
  document.body.classList.add('site-ready');
  window.addEventListener('norm:intro-done', function () { draw(); });
})();
