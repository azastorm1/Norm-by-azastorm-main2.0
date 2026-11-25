(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var data = { settings: null, designs: [], orders: [], products: [] };
  var CATS = { tee: 'Футболка', polo: 'Поло', hoodie: 'Худи', cap: 'Кепка', joggers: 'Джоггеры' };
  var STATUS = { new: 'Новый', confirmed: 'Подтверждён', sewing: 'Пошив', printing: 'Печать', shipped: 'Отправлен', done: 'Готов', cancelled: 'Отменён' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function api(url, opts) {
    return fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' }, cache: 'no-store' }, opts || {}))
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); });
  }

  // ---- вход ----
  function boot() {
    api('/api/admin/data').then(function (r) {
      if (r.ok) { data = r.d; showApp(); }
      else { $('login').hidden = false; $('pw').focus(); }
    }).catch(function () { $('login').hidden = false; });
  }
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    $('loginErr').textContent = '';
    api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: $('pw').value }) }).then(function (r) {
      if (r.ok) { $('login').hidden = true; api('/api/admin/data').then(function (x) { data = x.d; showApp(); }); }
      else $('loginErr').textContent = r.status === 429 ? 'Слишком много попыток. Подождите 10 минут.' : 'Неверный пароль';
    });
  });
  $('logout').addEventListener('click', function () {
    api('/api/admin/logout', { method: 'POST', body: '{}' }).then(function () { location.reload(); });
  });

  function showApp() {
    $('app').hidden = false; $('login').hidden = true;
    $('tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; go(b.dataset.t);
    });
    go('orders');
  }
  function go(t) {
    ['orders', 'products', 'designs', 'settings'].forEach(function (x) { $('t-' + x).hidden = x !== t; });
    $('tabs').querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); });
    if (t === 'orders') renderOrders();
    if (t === 'products') renderProducts();
    if (t === 'designs') renderDesigns();
    if (t === 'settings') renderSettings();
  }

  // ---- заказы ----
  var filter = 'all';
  function renderOrders() {
    var f = $('filter');
    if (!f.options.length) {
      f.innerHTML = '<option value="all">Все</option>' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '">' + STATUS[k] + '</option>'; }).join('');
      f.addEventListener('change', function () { filter = f.value; renderOrders(); });
    }
    var list = data.orders.filter(function (o) { return filter === 'all' || o.status === filter; });
    var c = {}; Object.keys(STATUS).forEach(function (k) { c[k] = data.orders.filter(function (o) { return o.status === k; }).length; });
    $('stats').innerHTML = Object.keys(STATUS).map(function (k) {
      return '<div class="stat"><b>' + c[k] + '</b><span>' + STATUS[k] + '</span></div>';
    }).join('');

    $('orders').innerHTML = '';
    list.forEach(function (o) {
      var el = document.createElement('div');
      el.className = 'card order';
      var items = (o.items && o.items.length ? o.items : [{ config: o.config, preview: o.preview, photo: o.photo, price: o.price, qty: 1 }]);
      el.innerHTML =
        '<div class="ohead"><div><b>№ ' + esc(o.number) + '</b> <span class="muted">' + new Date(o.createdAt).toLocaleString() + '</span></div>' +
        '<select data-st>' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (o.status === k ? ' selected' : '') + '>' + STATUS[k] + '</option>'; }).join('') + '</select></div>' +
        '<div class="ocust"><b>' + esc(o.customer.name) + '</b> · <a href="tel:' + esc(o.customer.phone) + '">' + esc(o.customer.phone) + '</a>' +
        (o.customer.city ? ' · ' + esc(o.customer.city) : '') + (o.customer.comment ? '<div class="muted">' + esc(o.customer.comment) + '</div>' : '') + '</div>' +
        '<div class="oitems">' + items.map(function (it) {
          var c = it.config || {};
          return '<div class="oitem">' +
            (it.preview ? '<img src="' + esc(it.preview) + '" alt="">' : '') +
            '<div><b>' + esc(CATS[c.item] || c.item || '') + '</b>' +
            '<div class="muted">' + esc(c.mode === 'ready' ? (c.productName || 'товар') : (c.text || c.mode || '')) +
            (c.color ? ' · ' + esc(c.color) : '') + (c.size ? ' · ' + esc(c.size) : '') + '</div>' +
            ((c.layers && c.layers.length) ? '<div class="muted small">' + c.layers.map(function (l) { return (l.side === 'back' ? 'сзади' : 'спереди') + ':' + esc(l.t); }).join(' · ') + '</div>' : '') +
            '<div class="muted">' + (it.qty || 1) + ' шт · ' + (it.price || 0) + ' сум</div></div>' +
            (it.photo ? '<a href="' + esc(it.photo) + '" target="_blank">фото</a>' : '') +
            '</div>';
        }).join('') + '</div>' +
        '<div class="orow"><label>Срок изготовления<input class="lead" maxlength="120" value="' + esc(o.leadTime || '') + '" placeholder="например 3–5 дней"></label>' +
        '<label>Готово к <input type="date" class="dead" value="' + esc(o.deadline || '') + '"></label>' +
        '<label class="wide">Заметка<textarea class="note" rows="2" maxlength="2000">' + esc(o.note || '') + '</textarea></label></div>' +
        '<div class="ofoot"><b>' + (o.price || 0) + ' сум</b><button class="mini save">Сохранить</button><button class="mini danger del">Удалить</button></div>';

      el.querySelector('[data-st]').addEventListener('change', function () {
        api('/api/admin/orders/' + o.id, { method: 'PATCH', body: JSON.stringify({ status: this.value }) }).then(function () { o.status = this.value; });
      });
      el.querySelector('.save').addEventListener('click', function () {
        var body = { leadTime: el.querySelector('.lead').value, deadline: el.querySelector('.dead').value, note: el.querySelector('.note').value };
        api('/api/admin/orders/' + o.id, { method: 'PATCH', body: JSON.stringify(body) }).then(function (r) {
          if (r.ok) { Object.assign(o, body); this.textContent = 'Сохранено'; }
        }.bind(this));
      });
      el.querySelector('.del').addEventListener('click', function () {
        if (!confirm('Удалить заказ ' + o.number + '?')) return;
        api('/api/admin/orders/' + o.id, { method: 'DELETE' }).then(function () {
          data.orders = data.orders.filter(function (x) { return x !== o; }); renderOrders();
        });
      });
      $('orders').appendChild(el);
    });
  }

  // ---- товары ----
  function renderProducts() {
    $('pList').innerHTML = '';
    var cats = {};
    data.products.forEach(function (p) { (cats[p.category] = cats[p.category] || []).push(p); });
    Object.keys(cats).forEach(function (c) {
      var h = document.createElement('h3');
      h.textContent = (CATS[c] || c) + ' · ' + cats[c].length;
      $('pList').appendChild(h);
      var grid = document.createElement('div'); grid.className = 'cards';
      cats[c].forEach(function (p) { grid.appendChild(productCard(p)); });
      $('pList').appendChild(grid);
    });
  }
  function productCard(p) {
    var el = document.createElement('div');
    el.className = 'card prod' + (p.available === false ? ' off' : '');
    el.innerHTML = '<img src="' + esc(p.photo) + '" alt="">' +
      '<div class="pbody"><b>' + esc((p.name && p.name.ru) || '—') + '</b>' +
      '<div class="muted">' + (p.price || 0) + ' сум · ' + esc((p.sizes || []).join(' ')) + '</div>' +
      '<div class="muted small">' + (p.available === false ? 'нет в наличии' : 'в наличии') + (p.leadTime ? ' · ' + esc(p.leadTime) : '') + '</div>' +
      '<div class="pops"><button class="mini edit">Изменить</button><button class="mini danger del">Удалить</button></div></div>';
    el.querySelector('.edit').addEventListener('click', function () { fillProduct(p); });
    el.querySelector('.del').addEventListener('click', function () {
      if (!confirm('Удалить товар «' + ((p.name && p.name.ru) || '') + '»?')) return;
      api('/api/admin/products/' + p.id, { method: 'DELETE' }).then(function () {
        data.products = data.products.filter(function (x) { return x !== p; }); renderProducts();
      });
    });
    return el;
  }
  function fillProduct(p) {
    $('pId').value = p.id; $('pRu').value = (p.name && p.name.ru) || '';
    $('pUz').value = (p.name && p.name.uz) || ''; $('pEn').value = (p.name && p.name.en) || '';
    $('pCat').value = p.category; $('pPrice').value = p.price || 0;
    $('pSizes').value = (p.sizes || []).join(', '); $('pLead').value = p.leadTime || '';
    $('pAvail').checked = p.available !== false; $('pDesc').value = (p.desc && p.desc.ru) || '';
    $('pCancel').hidden = false; $('pMsg').textContent = 'Редактирование: ' + ((p.name && p.name.ru) || '');
    $('pForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('pCancel').addEventListener('click', function () { $('pForm').reset(); $('pId').value = ''; $('pCancel').hidden = true; $('pMsg').textContent = ''; });
  $('pFile').addEventListener('change', function () {
    var f = this.files[0]; if (!f) return;
    var fr = new FileReader();
    fr.onload = function () { $('pForm').dataset.img = fr.result; $('pMsg').textContent = 'Фото выбрано'; };
    fr.readAsDataURL(f);
  });
  $('pForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var body = {
      id: $('pId').value || undefined,
      name: { ru: $('pRu').value.trim() || 'Norm', uz: $('pUz').value.trim(), en: $('pEn').value.trim() },
      category: $('pCat').value,
      price: +$('pPrice').value || 0,
      sizes: $('pSizes').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      leadTime: $('pLead').value.trim(),
      available: $('pAvail').checked,
      desc: { ru: $('pDesc').value.trim(), uz: '', en: '' }
    };
    if ($('pForm').dataset.img) body.image = $('pForm').dataset.img;
    $('pMsg').textContent = 'Сохраняем…';
    api('/api/admin/products', { method: 'POST', body: JSON.stringify(body) }).then(function (r) {
      if (!r.ok) { $('pMsg').textContent = 'Ошибка сохранения'; return; }
      var saved = r.d.product;
      var i = data.products.findIndex(function (x) { return x.id === saved.id; });
      if (i >= 0) data.products[i] = saved; else data.products.push(saved);
      $('pForm').reset(); $('pId').value = ''; $('pCancel').hidden = true; delete $('pForm').dataset.img;
      $('pMsg').textContent = 'Сохранено';
      renderProducts();
    });
  });

  // ---- дизайны ----
  function renderDesigns() {
    $('dList').innerHTML = '';
    data.designs.forEach(function (d) {
      var el = document.createElement('div'); el.className = 'card prod';
      el.innerHTML = '<img src="' + esc(d.src) + '" alt=""><div class="pbody"><b>' + esc(d.name.ru) + '</b>' +
        '<div class="muted">+' + (d.extra || 0) + ' сум · ' + (d.published === false ? 'скрыт' : 'на сайте') + '</div>' +
        '<div class="pops"><button class="mini del">Удалить</button></div></div>';
      el.querySelector('.del').addEventListener('click', function () {
        if (!confirm('Удалить дизайн?')) return;
        api('/api/admin/designs/' + d.id, { method: 'DELETE' }).then(function () {
          data.designs = data.designs.filter(function (x) { return x !== d; }); renderDesigns();
        });
      });
      $('dList').appendChild(el);
    });
  }
  $('dForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = $('dFile').files[0];
    var send = function (img) {
      var body = {
        name: { ru: $('dRu').value.trim(), uz: $('dUz').value.trim(), en: $('dEn').value.trim() },
        extra: +$('dExtra').value || 0, published: $('dPub').checked
      };
      if (img) body.image = img;
      api('/api/admin/designs', { method: 'POST', body: JSON.stringify(body) }).then(function (r) {
        $('dMsg').textContent = r.ok ? 'Сохранено (обновите страницу)' : 'Ошибка';
        if (r.ok) setTimeout(function () { location.reload(); }, 600);
      });
    };
    if (f) { var fr = new FileReader(); fr.onload = function () { send(fr.result); }; fr.readAsDataURL(f); }
    else send(null);
  });

  // ---- настройки ----
  function renderSettings() {
    var s = data.settings, p = s.prices || {};
    $('fPrices').innerHTML =
      '<label>База, сум<input type="number" data-pr="base" value="' + (p.base || 0) + '"></label>' +
      '<label>Печать, сум<input type="number" data-pr="print" value="' + (p.print || 0) + '"></label>' +
      '<label>Вышивка, сум<input type="number" data-pr="emb" value="' + (p.emb || 0) + '"></label>' +
      '<label>Своё фото, сум<input type="number" data-pr="custom" value="' + (p.custom || 0) + '"></label>';

    $('fColors').innerHTML = (s.colors || []).map(function (c, i) {
      return '<div class="row"><input type="color" data-c="' + i + '" value="' + esc(c.hex) + '">' +
        '<input type="text" data-cn="' + i + '" value="' + esc(c.ru) + '" placeholder="Название">' +
        '<span class="muted">' + esc(c.id) + '</span></div>';
    }).join('');

    $('fMisc').innerHTML =
      '<label>Размеры (через запятую)<input id="sSizes" value="' + esc((s.sizes || []).join(', ')) + '"></label>' +
      '<label>Instagram<input id="sIg" value="' + esc(s.contacts.instagram || '') + '"></label>' +
      '<label>Telegram<input id="sTg" value="' + esc(s.contacts.telegram || '') + '"></label>' +
      '<label>Телефон<input id="sPh" value="' + esc(s.contacts.phone || '') + '"></label>' +
      '<label>Срок изготовления по умолчанию (рус)<input id="sLead" value="' + esc((s.leadTime && s.leadTime.ru) || '') + '"></label>' +
      '<label>Срок изготовления (uz)<input id="sLeadUz" value="' + esc((s.leadTime && s.leadTime.uz) || '') + '"></label>';

    $('fTexts').innerHTML =
      '<label>Оплата (рус)<textarea id="sPay" rows="2">' + esc((s.payment && s.payment.ru) || '') + '</textarea></label>' +
      '<label>Доставка (рус)<textarea id="sDel" rows="2">' + esc((s.delivery && s.delivery.ru) || '') + '</textarea></label>';
  }
  $('saveSettings').addEventListener('click', function () {
    var s = JSON.parse(JSON.stringify(data.settings));
    $('fPrices').querySelectorAll('[data-pr]').forEach(function (i) { s.prices[i.dataset.pr] = +i.value || 0; });
    $('fColors').querySelectorAll('[data-c]').forEach(function (i) { s.colors[+i.dataset.c].hex = i.value; });
    $('fColors').querySelectorAll('[data-cn]').forEach(function (i) { s.colors[+i.dataset.cn].ru = i.value; });
    s.sizes = $('sSizes').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    s.contacts.instagram = $('sIg').value.replace(/^@/, '');
    s.contacts.telegram = $('sTg').value.replace(/^@/, '');
    s.contacts.phone = $('sPh').value;
    s.leadTime.ru = $('sLead').value; s.leadTime.uz = $('sLeadUz').value;
    s.payment.ru = $('sPay').value; s.delivery.ru = $('sDel').value;
    $('sMsg').textContent = 'Сохраняем…';
    api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(s) }).then(function (r) {
      $('sMsg').textContent = r.ok ? 'Сохранено' : 'Ошибка: ' + (r.d.error || '');
      if (r.ok) data.settings = r.d.settings;
    });
  });

  boot();
})();
