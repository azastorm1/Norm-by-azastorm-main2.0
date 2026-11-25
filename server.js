'use strict';
// Norm by Azastorm — сервер магазина. Без внешних зависимостей, нужен Node.js 18+.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), dns = require('dns').promises;

// ---- .env ----
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(l);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) {}

const PORT = +process.env.PORT || 3000;
const DATA = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const UP = path.join(DATA, 'uploads');
const PUB = path.join(__dirname, 'public');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const SECURE = PUBLIC_URL.startsWith('https://');
if (!ADMIN_PASSWORD) { console.error('Ошибка: задайте ADMIN_PASSWORD в файле .env'); process.exit(1); }
fs.mkdirSync(UP, { recursive: true });

// ---- база (один JSON-файл) ----
const DB_FILE = path.join(DATA, 'db.json');
const DEFAULT = {
  settings: {
    prices: { base: 0, print: 0, emb: 0, custom: 0 },
    colors: [
      { id: 'navy', hex: '#16213a', ru: 'Тёмно-синяя', uz: "To'q ko'k", en: 'Navy' },
      { id: 'white', hex: '#f4f3ef', ru: 'Белая', uz: 'Oq', en: 'White' },
      { id: 'red', hex: '#c0344d', ru: 'Красная', uz: 'Qizil', en: 'Red' }
    ],
    sizes: ['S', 'M', 'L', 'XL'],
    contacts: { instagram: 'norm.byazastorm', telegram: '', phone: '' },
    leadTime: { ru: '', uz: '', en: '' }, payment: { ru: '', uz: '', en: '' }, delivery: { ru: '', uz: '', en: '' },
    site: { hero: '', lookbook: [], process: [], about: { ru: '', uz: '', en: '' } },
    tees: {},
    printArea: { front: { x: 36, y: 26, w: 28 }, back: { x: 25, y: 22, w: 50 } }
  },
  designs: [], orders: [], products: [], counter: 0
};
let db;
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { db = JSON.parse(JSON.stringify(DEFAULT)); }
for (const k of Object.keys(DEFAULT)) if (!(k in db)) db[k] = JSON.parse(JSON.stringify(DEFAULT[k]));
for (const k of Object.keys(DEFAULT.settings)) if (!(k in db.settings)) db.settings[k] = JSON.parse(JSON.stringify(DEFAULT.settings[k]));
function save() { const t = DB_FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db)); fs.renameSync(t, DB_FILE); }
save();

// ---- \u0442\u043e\u0432\u0430\u0440\u044b \u043a\u043e\u043b\u043b\u0435\u043a\u0446\u0438\u0438 ----
const CATS = ['tee', 'polo', 'hoodie', 'cap', 'joggers'];
const SEED_CATS = ['tee','tee','tee','tee','tee','tee','tee','tee','tee','tee','tee','tee',
  'hoodie','hoodie','hoodie','hoodie','hoodie','cap','cap','cap','cap',
  'joggers','joggers','joggers','joggers','polo','polo','polo','tee','tee'];
if (!Array.isArray(db.products) || !db.products.length) {
  db.products = SEED_CATS.map((cat, i) => ({
    id: 'p' + String(i + 1).padStart(2, '0'),
    name: { ru: 'Norm ' + String(i + 1).padStart(2, '0'), uz: 'Norm ' + String(i + 1).padStart(2, '0'), en: 'Norm ' + String(i + 1).padStart(2, '0') },
    category: cat,
    price: 0,
    sizes: ['S', 'M', 'L', 'XL'],
    available: true,
    leadTime: '',
    desc: { ru: '', uz: '', en: '' },
    photo: '/collection/n' + String(i + 1).padStart(2, '0') + '.jpg',
    createdAt: new Date().toISOString()
  }));
  save();
}
function cleanProduct(b, cur) {
  cur = cur || {};
  const n = b.name && typeof b.name === 'object' ? b.name : {};
  const d = b.desc && typeof b.desc === 'object' ? b.desc : {};
  const out = {
    id: cur.id || 'p' + crypto.randomBytes(4).toString('hex'),
    name: { ru: str(n.ru, 80) || str(cur.name && cur.name.ru, 80), uz: str(n.uz, 80), en: str(n.en, 80) },
    category: CATS.includes(b.category) ? b.category : (cur.category || 'tee'),
    price: num(b.price, 0, 1e9, 0),
    sizes: (Array.isArray(b.sizes) ? b.sizes : []).map(x => str(x, 8).trim()).filter(Boolean).slice(0, 10),
    available: b.available !== false,
    leadTime: str(b.leadTime, 60),
    desc: { ru: str(d.ru, 600), uz: str(d.uz, 600), en: str(d.en, 600) },
    photo: typeof b.photo === 'string' && /^(\/uploads\/[a-f0-9]+\.(png|jpg|webp)|\/collection\/n\d{2}\.jpg)$/.test(b.photo) ? b.photo : (cur.photo || ''),
    createdAt: cur.createdAt || new Date().toISOString()
  };
  return out;
}

// ---- утилиты ----
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json' };
const SEC = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"
};
function json(res, code, obj, extra) { res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, SEC, extra || {})); res.end(JSON.stringify(obj)); }
function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    if (!/application\/json/.test(req.headers['content-type'] || '')) return reject({ code: 415, msg: 'JSON expected' });
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject({ code: 413, msg: 'Too large' }); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject({ code: 400, msg: 'Bad JSON' }); } });
    req.on('error', () => reject({ code: 400, msg: 'Error' }));
  });
}
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const num = (v, lo, hi, d) => { v = +v; return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
function saveImage(d) {
  if (typeof d !== 'string') return null;
  const i = d.indexOf(','); if (i < 0) return null;
  const m = /^data:image\/(png|jpeg|webp);base64$/.exec(d.slice(0, i)); if (!m) return null;
  const buf = Buffer.from(d.slice(i + 1), 'base64');
  if (!buf.length || buf.length > 6 * 1024 * 1024) return null;
  const name = crypto.randomBytes(12).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(UP, name), buf);
  return { url: '/uploads/' + name, buf, mime: 'image/' + m[1], name };
}
function rmFile(url) { if (typeof url === 'string' && /^\/uploads\/[a-f0-9]+\.(png|jpg|webp)$/.test(url)) fs.unlink(path.join(DATA, url), () => {}); }

// ---- сессии админа ----
const sessions = new Map(), fails = new Map();
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
function cookie(req, n) { const m = new RegExp('(?:^|; )' + n + '=([^;]*)').exec(req.headers.cookie || ''); return m ? m[1] : ''; }
function isAdmin(req) { const s = sessions.get(cookie(req, 'sid')); return !!(s && s > Date.now()); }
const ip = req => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

// ---- заказы ----
const rate = new Map();
function priceOf(c, s, designs) {
  if (c.mode === 'ready') { const pr = db.products.find(x => x.id === c.productId); return pr ? +pr.price || 0 : 0; }
  const p = s.prices; let t = (+p.base || 0) + ((c.kind === 'emb' ? +p.emb : +p.print) || 0);
  if (c.mode === 'photo' || c.mode === 'ref') t += +p.custom || 0;
  if (c.mode === 'design') { const d = designs.find(x => x.id === c.designId); if (d) t += +d.extra || 0; }
  return t;
}
function cleanConfig(c, s) {
  c = c || {};
  const custom = /^#[0-9a-f]{6}$/i.test(c.customHex || '') ? c.customHex : '';
  const color = custom ? 'custom' : (s.colors.find(x => x.id === c.color) ? c.color : s.colors[0].id);
  return {
    color, customHex: custom, item: ITEM[c.item] ? c.item : 'tee', zip: !!c.zip, cuff: !!c.cuff,
    font: /^[A-Za-z0-9 ]{1,40}$/.test(c.font || '') ? c.font : 'Manrope',
    runs: (Array.isArray(c.runs) ? c.runs : []).slice(0, 40).map(r => ({ t: str(r && r.t, 40), f: /^[A-Za-z0-9 ]{1,40}$/.test((r && r.f) || '') ? r.f : '', c: /^#[0-9a-f]{6}$/i.test((r && r.c) || '') ? r.c : '' })), tcolor: /^#[0-9a-f]{6}$/i.test(c.tcolor || '') ? c.tcolor : '', kind: c.kind === 'emb' ? 'emb' : 'print', place: c.place === 'back' ? 'back' : 'front',
    size: s.sizes.includes(c.size) ? c.size : '', mode: ['text', 'photo', 'ref', 'design', 'ready'].includes(c.mode) ? c.mode : 'text',
    productId: str(c.productId, 40), productName: str(c.productName, 80), leadTime: str(c.leadTime, 60),
    layers: (Array.isArray(c.layers) ? c.layers : []).slice(0, 12).map(l => ({ side: l && l.side === 'back' ? 'back' : 'front', type: ['text', 'image', 'link'].includes(l && l.type) ? l.type : 'text', t: str(l && l.t, 60) })),
    text: str(c.text, 40), desc: str(c.desc, 600), ref: str(c.ref, 300), designId: str(c.designId, 40),
    scale: num(c.scale, 20, 250, 100), dx: num(c.dx, -60, 60, 0), dy: num(c.dy, -60, 60, 0)
  };
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// ---- загрузка референса по ссылке (Pinterest и др.) ----
const REF_HOSTS = ['pinterest.com', 'pinterest.ru', 'pinterest.co.uk', 'pin.it', 'pinimg.com', 'behance.net', 'imgur.com', 'unsplash.com', 'pexels.com'].concat((process.env.REF_HOSTS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean));
const hostOk = h => { h = h.toLowerCase(); return REF_HOSTS.some(x => h === x || h.endsWith('.' + x) || (x === 'pinterest.com' && /(^|\.)pinterest\.(?:com|ru|de|fr|es|it|jp|ca|ch|at|nl|se|dk|pt|ie|ph|nz|cl|co\.uk|com\.au|com\.mx|com\.br)$/.test(h))); };
function priv(ip) {
  if (ip.includes(':')) { const l = ip.toLowerCase(), m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(l); if (m) return priv(m[1]); return l === '::1' || l === '::' || /^f[cd]/.test(l) || /^fe[89ab]/.test(l); }
  const p = ip.split('.').map(Number);
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || p[0] >= 224;
}
async function safeFetch(urlStr, hops) {
  const u = new URL(urlStr);
  if (!/^https?:$/.test(u.protocol) || (u.port && !['80', '443'].includes(u.port)) || !hostOk(u.hostname)) throw new Error('host');
  const addrs = await dns.lookup(u.hostname, { all: true });
  if (!addrs.length || addrs.some(a => priv(a.address))) throw new Error('private');
  const r = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Accept': 'text/html,image/*;q=0.9,*/*;q=0.5', 'Accept-Language': 'en' } });
  if ([301, 302, 303, 307, 308].includes(r.status)) { if ((hops || 0) >= 4) throw new Error('redirects'); return safeFetch(new URL(r.headers.get('location'), u).href, (hops || 0) + 1); }
  return r;
}
async function readLimited(r, max) {
  const chunks = []; let n = 0;
  for await (const c of r.body) { n += c.length; if (n > max) throw new Error('big'); chunks.push(c); }
  return Buffer.concat(chunks);
}
function sniff(b) { if (b[0] === 0x89 && b[1] === 0x50) return 'image/png'; if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg'; if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return 'image/webp'; return ''; }
async function refImage(link) {
  let r = await safeFetch(link), buf = await readLimited(r, 6e6), mime = sniff(buf);
  if (!mime) {
    const html = buf.toString('utf8', 0, 1500000);
    const m = /<meta[^>]+(?:property|name)=["']og:image(?::url)?["'][^>]*content=["']([^"']+)["']/i.exec(html) || /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image["']/i.exec(html);
    if (!m) throw new Error('noimage');
    let img = m[1].replace(/&amp;/g, '&').replace(/\/(?:\d+x\d*|\d+x)\//, '/736x/');
    r = await safeFetch(new URL(img, link).href); buf = await readLimited(r, 6e6); mime = sniff(buf);
    if (!mime) throw new Error('noimage');
  }
  return 'data:' + mime + ';base64,' + buf.toString('base64');
}
const refRate = new Map();

const ITEM = { tee: 'футболка', polo: 'поло финка', hoodie: 'худи', cap: 'кепка', joggers: 'джоггеры' };
// ---- API ----
async function api(req, res, u) {
  const p = u.pathname, m = req.method;
  try {
    if (m === 'GET' && p === '/api/public') return json(res, 200, { settings: db.settings, designs: db.designs.filter(d => d.published !== false), products: db.products });

    if (m === 'POST' && p === '/api/orders') {
      const k = ip(req), now = Date.now(), r = (rate.get(k) || []).filter(t => now - t < 3600e3);
      if (r.length >= 10) return json(res, 429, { error: 'rate' });
      const b = await readJson(req, 12e6);
      if (b.website) return json(res, 200, { number: 'N-0' }); // ловушка для ботов
      const cu = b.customer || {}, name = str(cu.name, 80).trim(), phone = str(cu.phone, 30).trim();
      if (name.length < 2 || phone.replace(/\D/g, '').length < 7) return json(res, 400, { error: 'invalid' });
      const rawItems = Array.isArray(b.items) && b.items.length ? b.items.slice(0, 12) : [{ config: b.config, preview: b.preview, photo: b.photo, refImage: b.refImage }];
      const items = [];
      for (const it of rawItems) {
        const cfg = cleanConfig(it.config || b.config, db.settings);
        const prev = saveImage(it.preview || b.preview);
        const ph = cfg.mode === 'photo' ? saveImage(it.photo || b.photo) : null;
        const rf = cfg.mode === 'ref' ? saveImage(it.refImage || b.refImage) : null;
        const qty = Math.max(1, Math.min(20, parseInt(it.qty, 10) || 1));
        items.push({ config: cfg, preview: prev ? prev.url : '', photo: ph ? ph.url : '', refImg: rf ? rf.url : '', qty, price: priceOf(cfg, db.settings, db.designs) });
      }
      if (!items.length) return json(res, 400, { error: 'empty' });
      r.push(now); rate.set(k, r);
      db.counter++;
      const total = items.reduce((a, x) => a + x.price * x.qty, 0);
      const first = items[0];
      const o = {
        id: crypto.randomBytes(8).toString('hex'), number: 'N-' + (1000 + db.counter), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        status: 'new', note: '', lang: ['ru', 'uz', 'en'].includes(b.lang) ? b.lang : 'ru',
        leadTime: str(b.leadTime, 120),
        customer: { name, phone, city: str(cu.city, 120), comment: str(cu.comment, 600) },
        items,
        config: first.config, price: total, preview: first.preview, photo: first.photo, refImg: first.refImg, rights: true
      };
      db.orders.unshift(o); save();
      return json(res, 200, { number: o.number });
    }

    if (m === 'GET' && p === '/api/ref-image') {
      const k = ip(req), now = Date.now(), r = (refRate.get(k) || []).filter(t => now - t < 3600e3);
      if (r.length >= 20) return json(res, 429, { error: 'rate' });
      r.push(now); refRate.set(k, r);
      try { return json(res, 200, { image: await refImage(str(u.searchParams.get('url'), 500)) }); }
      catch (e) { return json(res, 422, { error: e.message === 'host' ? 'host' : 'fail' }); }
    }

    if (m === 'GET' && p === '/api/track') {
      const n = str(u.searchParams.get('number'), 20).trim().toUpperCase(), ph = str(u.searchParams.get('phone'), 30).replace(/\D/g, '');
      const o = db.orders.find(x => x.number === n && ph.length >= 7 && x.customer.phone.replace(/\D/g, '').endsWith(ph.slice(-7)));
      return o ? json(res, 200, { number: o.number, status: o.status, updatedAt: o.updatedAt }) : json(res, 404, { error: 'not_found' });
    }

    if (m === 'POST' && p === '/api/admin/login') {
      const k = ip(req), f = fails.get(k) || { n: 0, until: 0 };
      if (f.until > Date.now()) return json(res, 429, { error: 'locked' });
      const b = await readJson(req, 2000);
      if (crypto.timingSafeEqual(sha(b.password || ''), sha(ADMIN_PASSWORD))) {
        fails.delete(k); const sid = crypto.randomBytes(32).toString('hex'); sessions.set(sid, Date.now() + 7 * 864e5);
        return json(res, 200, { ok: true }, { 'Set-Cookie': 'sid=' + sid + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800' + (SECURE ? '; Secure' : '') });
      }
      f.n++; if (f.n >= 5) { f.until = Date.now() + 10 * 60e3; f.n = 0; } fails.set(k, f);
      return json(res, 401, { error: 'bad' });
    }

    if (!p.startsWith('/api/admin/')) return json(res, 404, { error: 'not_found' });
    if (!isAdmin(req)) return json(res, 401, { error: 'auth' });

    if (m === 'POST' && p === '/api/admin/logout') { sessions.delete(cookie(req, 'sid')); return json(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; Max-Age=0; Path=/' }); }
    if (m === 'GET' && p === '/api/admin/data') return json(res, 200, { settings: db.settings, designs: db.designs, orders: db.orders, products: db.products });

    if (m === 'PUT' && p === '/api/admin/settings') {
      const b = await readJson(req, 1e6), s = db.settings, o = {};
      const bp = b.prices || {}; o.prices = {}; for (const k of ['base', 'print', 'emb', 'custom']) o.prices[k] = num(bp[k], 0, 1e9, 0);
      o.colors = (Array.isArray(b.colors) ? b.colors : []).slice(0, 12).filter(c => /^[a-z0-9_-]{1,20}$/.test(c.id) && /^#[0-9a-f]{6}$/i.test(c.hex)).map(c => ({ id: c.id, hex: c.hex, ru: str(c.ru, 40) || c.id, uz: str(c.uz, 40), en: str(c.en, 40) }));
      if (!o.colors.length) return json(res, 400, { error: 'colors' });
      o.sizes = (Array.isArray(b.sizes) ? b.sizes : []).map(x => str(x, 8).trim()).filter(Boolean).slice(0, 12); if (!o.sizes.length) return json(res, 400, { error: 'sizes' });
      const bc = b.contacts || {}; o.contacts = { instagram: str(bc.instagram, 60).replace(/^@/, ''), telegram: str(bc.telegram, 60).replace(/^@/, ''), phone: str(bc.phone, 30) };
      for (const k of ['leadTime', 'payment', 'delivery']) { const x = b[k] || {}; o[k] = { ru: str(x.ru, 600), uz: str(x.uz, 600), en: str(x.en, 600) }; }
      o.tees = {}; const bt = b.tees || {};
      for (const c of o.colors) { o.tees[c.id] = {}; for (const side of ['front', 'back']) { const v = bt[c.id] && bt[c.id][side]; if (typeof v === 'string' && /^\/uploads\/[a-f0-9]+\.(png|jpg|webp)$/.test(v)) o.tees[c.id][side] = v; } }
      const pa = b.printArea || {}; o.printArea = {};
      for (const side of ['front', 'back']) { const a = pa[side] || {}; o.printArea[side] = { x: num(a.x, 0, 90, 30), y: num(a.y, 0, 90, 25), w: num(a.w, 5, 90, 40) }; }
      const urlOk = v => typeof v === 'string' && /^\/uploads\/[a-f0-9]+\.(png|jpg|webp)$/.test(v);
      const bs = b.site || {}, ba = bs.about || {};
      o.site = { hero: urlOk(bs.hero) ? bs.hero : '', lookbook: (Array.isArray(bs.lookbook) ? bs.lookbook : []).filter(urlOk).slice(0, 8), process: (Array.isArray(bs.process) ? bs.process : []).filter(urlOk).slice(0, 4), about: { ru: str(ba.ru, 1500), uz: str(ba.uz, 1500), en: str(ba.en, 1500) } };
      const collect = x => { const set = new Set(); Object.values(x.tees || {}).forEach(t => Object.values(t).forEach(v => set.add(v))); const st = x.site || {}; if (st.hero) set.add(st.hero); (st.lookbook || []).concat(st.process || []).forEach(v => set.add(v)); return set; };
      const used = collect(o); collect(s).forEach(v => { if (!used.has(v)) rmFile(v); });
      db.settings = o; save(); return json(res, 200, { ok: true, settings: o });
    }

    if (m === 'POST' && p === '/api/admin/upload') {
      const b = await readJson(req, 9e6), im = saveImage(b.image);
      return im ? json(res, 200, { url: im.url }) : json(res, 400, { error: 'image' });
    }

    if (m === 'POST' && p === '/api/admin/designs') {
      const b = await readJson(req, 9e6), n = b.name || {};
      if (!str(n.ru, 80).trim()) return json(res, 400, { error: 'name' });
      let d = b.id && db.designs.find(x => x.id === b.id);
      if (!d) { d = { id: crypto.randomBytes(6).toString('hex'), src: '' }; db.designs.push(d); }
      if (b.image) { const im = saveImage(b.image); if (!im) return json(res, 400, { error: 'image' }); rmFile(d.src); d.src = im.url; }
      if (!d.src) { db.designs = db.designs.filter(x => x !== d); return json(res, 400, { error: 'image' }); }
      d.name = { ru: str(n.ru, 80), uz: str(n.uz, 80), en: str(n.en, 80) }; d.extra = num(b.extra, 0, 1e9, 0); d.published = b.published !== false;
      save(); return json(res, 200, { ok: true });
    }
    let mm;
    if (m === 'DELETE' && (mm = /^\/api\/admin\/designs\/([a-f0-9]+)$/.exec(p))) {
      const d = db.designs.find(x => x.id === mm[1]); if (d) { rmFile(d.src); db.designs = db.designs.filter(x => x !== d); save(); } return json(res, 200, { ok: true });
    }
    if (m === 'PATCH' && (mm = /^\/api\/admin\/orders\/([a-f0-9]+)$/.exec(p))) {
      const o = db.orders.find(x => x.id === mm[1]); if (!o) return json(res, 404, { error: 'not_found' });
      const b = await readJson(req, 20000);
      if (['new', 'confirmed', 'sewing', 'printing', 'shipped', 'done', 'cancelled'].includes(b.status)) o.status = b.status;
      if (typeof b.note === 'string') o.note = str(b.note, 2000);
      if (typeof b.leadTime === 'string') o.leadTime = str(b.leadTime, 120);
      if (typeof b.deadline === 'string') o.deadline = str(b.deadline, 40);
      o.updatedAt = new Date().toISOString(); save(); return json(res, 200, { ok: true });
    }
    if (m === 'DELETE' && (mm = /^\/api\/admin\/orders\/([a-f0-9]+)$/.exec(p))) {
      const o = db.orders.find(x => x.id === mm[1]); if (o) { rmFile(o.preview); rmFile(o.photo); rmFile(o.refImg); db.orders = db.orders.filter(x => x !== o); save(); } return json(res, 200, { ok: true });
    }
    if (m === 'POST' && p === '/api/admin/products') {
      const b = await readJson(req, 9e6);
      let prod = b.id ? db.products.find(x => x.id === b.id) : null;
      if (b.image) { const im = saveImage(b.image); if (!im) return json(res, 400, { error: 'image' }); b.photo = im.url; }
      if (!prod) { prod = cleanProduct(b, null); db.products.push(prod); }
      else { const merged = cleanProduct(Object.assign({}, prod, b), prod); Object.assign(prod, merged); }
      if (!prod.name.ru) prod.name.ru = 'Norm';
      if (!prod.sizes.length) prod.sizes = db.settings.sizes.slice(0, 4);
      save(); return json(res, 200, { ok: true, product: prod });
    }
    let pm;
    if (m === 'DELETE' && (pm = /^\/api\/admin\/products\/([a-z0-9]+)$/.exec(p))) {
      db.products = db.products.filter(x => x.id !== pm[1]); save(); return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'not_found' });
  } catch (e) {
    if (e && e.code && e.msg) return json(res, e.code, { error: e.msg });
    console.error(e); return json(res, 500, { error: 'server' });
  }
}

// ---- статика ----
function serveFile(res, file, cache) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, SEC); return res.end('Not found'); }
    res.writeHead(200, Object.assign({ 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': cache }, SEC)); res.end(buf);
  });
}
http.createServer((req, res) => {
  let u; try { u = new URL(req.url, 'http://x'); } catch (e) { res.writeHead(400); return res.end(); }
  if (u.pathname.startsWith('/api/')) return api(req, res, u);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, SEC); return res.end(); }
  let p; try { p = decodeURIComponent(u.pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (p.startsWith('/uploads/')) {
    const f = path.join(UP, path.basename(p));
    return serveFile(res, f, 'public, max-age=31536000, immutable');
  }
  if (p === '/' ) p = '/index.html'; else if (p === '/admin' || p === '/admin/') p = '/admin.html';
  const f = path.join(PUB, path.normalize(p));
  if (!f.startsWith(PUB + path.sep)) { res.writeHead(403, SEC); return res.end(); }
  serveFile(res, f, 'no-cache');
}).listen(PORT, () => console.log('Norm by Azastorm: http://localhost:' + PORT + '  (админка: /admin)'));
