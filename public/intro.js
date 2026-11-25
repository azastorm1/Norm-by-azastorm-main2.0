/* Norm by Azastorm — кинематографичное интро:
   глаз → зум в зрачок → NORM → Desert Eagle → выстрел → осколки → сайт */
(function () {
  'use strict';
  var intro = document.getElementById('intro');
  if (!intro) return;
  var cvs = document.getElementById('introCanvas');
  var ctx = cvs.getContext('2d');
  var skipBtn = document.getElementById('skipIntro');
  var sndBtn = document.getElementById('snd');

  var seen = false;
  try { seen = sessionStorage.getItem('normIntro') === '1'; } catch (e) {}
  if (seen) { intro.remove(); startSite(); return; }

  var W = 0, H = 0, DPR = Math.min(2, window.devicePixelRatio || 1);
  function size() {
    W = window.innerWidth; H = window.innerHeight;
    cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
    cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  size();
  window.addEventListener('resize', size);

  // ---------- звук ----------
  var AC = null, sound = false, master = null;
  function audio() {
    if (AC) return AC;
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination);
    } catch (e) { AC = null; }
    return AC;
  }
  function noiseBuf(sec) {
    var a = audio(); if (!a) return null;
    var b = a.createBuffer(1, Math.floor(a.sampleRate * sec), a.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    return b;
  }
  function boom() {
    if (!sound || !audio()) return;
    var a = AC, t = a.currentTime;
    var o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.5);
    g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.95);
    var n = a.createBufferSource(), ng = a.createGain(), f = a.createBiquadFilter();
    n.buffer = noiseBuf(0.5); f.type = 'lowpass'; f.frequency.value = 1800;
    ng.gain.setValueAtTime(0.9, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    n.connect(f).connect(ng).connect(master); n.start(t);
  }
  function whoosh(dur, vol) {
    if (!sound || !audio()) return;
    var a = AC, t = a.currentTime, n = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    n.buffer = noiseBuf(dur || 1.2); f.type = 'bandpass'; f.frequency.setValueAtTime(220, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + (dur || 1.2) * 0.8);
    g.gain.setValueAtTime(vol || 0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + (dur || 1.2));
    n.connect(f).connect(g).connect(master); n.start(t);
  }
  function shatter() {
    if (!sound || !audio()) return;
    var a = AC, t = a.currentTime, n = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    n.buffer = noiseBuf(1.4); f.type = 'highpass'; f.frequency.value = 2400;
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    n.connect(f).connect(g).connect(master); n.start(t);
  }
  function click() {
    if (!sound || !audio()) return;
    var a = AC, t = a.currentTime, n = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    n.buffer = noiseBuf(0.08); f.type = 'bandpass'; f.frequency.value = 3000;
    g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    n.connect(f).connect(g).connect(master); n.start(t);
  }
  if (sndBtn) sndBtn.addEventListener('click', function () {
    sound = !sound;
    if (sound) { audio(); if (AC && AC.state === 'suspended') AC.resume(); sndBtn.textContent = '♪ on'; sndBtn.classList.add('on'); }
    else sndBtn.textContent = '♪';
  });
  window.addEventListener('pointerdown', function () { if (AC && AC.state === 'suspended') AC.resume(); }, { once: true });

  // ---------- текст NORM ----------
  var WORD = 'NORM', FONT = '800 200px Unbounded, Manrope, sans-serif';
  var textCv = document.createElement('canvas'), textCtx = textCv.getContext('2d');
  var textRect = { x: 0, y: 0, w: 0, h: 0 };
  function prepText() {
    var fs = Math.min(W * 0.235, H * 0.28, 300);
    ctx.save();
    ctx.font = '800 ' + fs + 'px Unbounded, Manrope, sans-serif';
    var m = ctx.measureText(WORD);
    var w = Math.ceil(m.width + fs * 0.14), h = Math.ceil(fs * 1.12);
    ctx.restore();
    textCv.width = Math.round(w * DPR); textCv.height = Math.round(h * DPR);
    textCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    textCtx.clearRect(0, 0, w, h);
    textCtx.font = '800 ' + fs + 'px Unbounded, Manrope, sans-serif';
    textCtx.textAlign = 'center'; textCtx.textBaseline = 'middle';
    textCtx.fillStyle = '#f4f3ef';
    textCtx.fillText(WORD, w / 2, h / 2);
    textCtx.globalCompositeOperation = 'source-atop';
    var g = textCtx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(.55, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
    textCtx.fillStyle = g; textCtx.fillRect(0, 0, w, h);
    textCtx.globalCompositeOperation = 'source-over';
    textRect = { w: w, h: h };
  }
  prepText();
  window.addEventListener('resize', function () { size(); prepText(); });

  function easeOut(p) { return 1 - Math.pow(1 - p, 3); }
  function easeInOut(p) { return p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  // ---------- фазы ----------
  var T = {
    eyeIn: 0.0, eyeOpen: 0.5, zoom: 1.05, textIn: 1.3, gunIn: 2.35,
    shot: 3.68, bulletIn: 3.72, impact: 4.18, end: 5.55
  };
  var t0 = performance.now(), done = false, shake = 0;
  var frags = [], smoke = [], sparks = [], flash = 0, beam = 0, impactPt = null;

  function stop() {
    if (done) return;
    done = true;
    intro.classList.add('done');
    try { sessionStorage.setItem('normIntro', '1'); } catch (e) {}
    setTimeout(function () { intro.remove(); }, 720);
    startSite();
  }
  function startSite() {
    document.body.classList.add('site-ready');
    window.dispatchEvent(new CustomEvent('norm:intro-done'));
  }
  if (skipBtn) skipBtn.addEventListener('click', stop);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') stop(); });

  // ---------- ГЛАЗ: фото → пиксельная сетка ----------
  var EYE_IMG = new Image();
  EYE_IMG.src = '/media/eye-fullhd.jpg';
  var EYE_OK = false;
  EYE_IMG.onload = function () { EYE_OK = true; };

  var stage = document.createElement('canvas'), sctx = stage.getContext('2d');
  var pixCv = document.createElement('canvas'), pixCtx = pixCv.getContext('2d');
  var PUP = { x: 0.271, y: 0.580 };      // положение зрачка на фото
  var noisCv = document.createElement('canvas'), nctx = noisCv.getContext('2d'), noisePat = null;
  function makeNoise() {
    noisCv.width = 220; noisCv.height = 220;
    var d = nctx.createImageData(220, 220), a = d.data;
    for (var i = 0; i < a.length; i += 4) {
      var v = 120 + Math.random() * 135;
      a[i] = a[i + 1] = a[i + 2] = v; a[i + 3] = Math.random() * 26;
    }
    nctx.putImageData(d, 0, 0);
    noisePat = ctx.createPattern(noisCv, 'repeat');
  }
  makeNoise();

  function drawEyePhoto(t, open, zoomK, cols) {
    if (!EYE_OK) return;
    var iw = EYE_IMG.naturalWidth, ih = EYE_IMG.naturalHeight, ar = iw / ih;

    // пиксельная сетка (чем больше cols — тем мельче пиксель)
    cols = Math.max(10, Math.round(cols));
    var rows = Math.max(4, Math.round(cols / ar));
    if (pixCv.width !== cols || pixCv.height !== rows) { pixCv.width = cols; pixCv.height = rows; }
    pixCtx.imageSmoothingEnabled = true;
    pixCtx.clearRect(0, 0, cols, rows);
    pixCtx.drawImage(EYE_IMG, 0, 0, cols, rows);

    // вписывание «cover»
    var base = Math.max(W / iw, H / ih) * 1.06;
    var dw = iw * base, dh = ih * base;
    var dx = (W - dw) / 2, dy = (H - dh) / 2;
    var px = dx + PUP.x * dw, py = dy + PUP.y * dh;
    // камера понемногу «доводит» зрачок к центру кадра
    var q = easeOut(clamp((zoomK - 1) / 4.0, 0, 1)) * 0.62;
    var ox = px + (W / 2 - px) * q, oy = py + (H / 2 - py) * q;

    // сцена — чтобы применить мягкую маску к краям фотографии
    if (stage.width !== Math.round(W * DPR) || stage.height !== Math.round(H * DPR)) {
      stage.width = Math.round(W * DPR); stage.height = Math.round(H * DPR);
    }
    sctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    sctx.clearRect(0, 0, W, H);
    sctx.save();

    // «открытие» глаза
    var o = 0.05 + 0.95 * easeOut(clamp(open, 0, 1));
    sctx.translate(ox, oy); sctx.scale(1, o); sctx.translate(-ox, -oy);

    // наезд камеры в зрачок
    sctx.translate(ox, oy); sctx.scale(zoomK, zoomK); sctx.translate(-ox, -oy);

    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(pixCv, dx, dy, dw, dh);
    sctx.imageSmoothingEnabled = true;
    sctx.restore();

    // затемнение + тёплый свет
    sctx.globalCompositeOperation = 'multiply';
    sctx.fillStyle = 'rgba(112,100,92,1)'; sctx.fillRect(0, 0, W, H);
    sctx.globalCompositeOperation = 'source-over';
    var warm = sctx.createRadialGradient(ox, oy, 0, ox, oy, Math.min(W, H) * .75);
    warm.addColorStop(0, 'rgba(255,186,110,.20)');
    warm.addColorStop(.45, 'rgba(120,70,30,.06)');
    warm.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = warm; sctx.fillRect(0, 0, W, H);

    // мягкая маска по краям
    sctx.globalCompositeOperation = 'destination-in';
    var m = sctx.createRadialGradient(ox, oy, Math.min(W, H) * .12, ox, oy, Math.max(W, H) * .86);
    m.addColorStop(0, 'rgba(0,0,0,1)');
    m.addColorStop(.62, 'rgba(0,0,0,.92)');
    m.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = m; sctx.fillRect(0, 0, W, H);
    sctx.globalCompositeOperation = 'source-over';

    ctx.drawImage(stage, 0, 0, W, H);

    // «экран» — сетка линий и зерно
    ctx.save();
    ctx.globalAlpha = .10; ctx.fillStyle = '#000';
    for (var yy = 0; yy < H; yy += 3) ctx.fillRect(0, yy, W, 1);
    ctx.globalAlpha = .05;
    if (noisePat) { ctx.translate((t * 90) % 220, (t * 57) % 220); ctx.fillStyle = noisePat; ctx.fillRect(-220, -220, W + 440, H + 440); }
    ctx.restore();

    // виньетка
    var vg = ctx.createRadialGradient(ox, oy, Math.min(W, H) * .16, ox, oy, Math.max(W, H) * .74);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.93)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  function drawText(alpha, scale, glitch) {
    var w = textRect.w * scale, h = textRect.h * scale;
    var x = W / 2 - w / 2, y = H / 2 - h / 2;
    textRect.x = x; textRect.y = y; textRect.sw = w; textRect.sh = h;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(255,255,255,.35)'; ctx.shadowBlur = 42;
    ctx.drawImage(textCv, x, y, w, h);
    ctx.shadowBlur = 0;
    ctx.restore();

    if (glitch > 0) {
      var n = 5;
      for (var i = 0; i < n; i++) {
        var sy = y + Math.random() * h, sh = rnd(2, 14), off = rnd(-26, 26) * glitch;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = .5 * glitch;
        ctx.drawImage(textCv, 0, (sy - y) / h * textCv.height, textCv.width, sh / h * textCv.height, x + off, sy, w, sh);
        ctx.restore();
      }
    }
  }

  var GUN_IMG = new Image();
  GUN_IMG.src = '/img/deagle.png';
  var BUL_IMG = new Image();
  BUL_IMG.src = '/img/bullet.png';
  function drawGun(x, y, s, rot, recoil) {
    ctx.save();
    ctx.translate(x + recoil * 26, y - recoil * 8);
    ctx.rotate(rot);
    ctx.scale(s, s);
    if (GUN_IMG.complete && GUN_IMG.naturalWidth) {
      var gw = 350, gh = gw * GUN_IMG.naturalHeight / GUN_IMG.naturalWidth;
      ctx.drawImage(GUN_IMG, 0, -gh * 0.5, gw, gh);
    }
    ctx.restore();
  }

  function makeFrags(x, y, w, h) {
    frags = [];
    var cols = 26, rows = 11, cw = w / cols, ch = h / rows;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var sx = c * cw, sy = r * ch;
        var dx = x + sx, dy = y + sy;
        var dist = Math.hypot(dx + cw / 2 - impactPt.x, dy + ch / 2 - impactPt.y) || 1;
        frags.push({
          x: dx, y: dy, w: cw, h: ch, ox: sx, oy: sy,
          vx: (dx - impactPt.x) / dist * rnd(0.9, 4.2) + rnd(-.6, .6),
          vy: (dy - impactPt.y) / dist * rnd(0.6, 3.4) - rnd(.4, 2.2),
          rot: 0, vr: rnd(-5, 5), a: 1
        });
      }
    }
  }

  function loop(now) {
    try { return frame(now); } catch (err) { console.error('INTRO ERR', err && err.message); }
  }
  function frame(now) {
    if (done) return;
    var t = (now - t0) / 1000;
    if (t > T.end) { stop(); return; }

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

    if (shake > 0) {
      ctx.translate(rnd(-shake, shake), rnd(-shake, shake));
      shake *= 0.9; if (shake < .2) shake = 0;
    }

    // ---- глаз ----
    if (t < T.zoom + 0.35) {
      var open = clamp((t - 0.12) / 0.5, 0, 1);
      var cols = 18 + 138 * easeOut(clamp((t - 0.04) / 0.95, 0, 1));
      var zk = 1 + Math.pow(clamp((t - T.zoom) / 0.35, 0, 1), 2) * 4.6;
      drawEyePhoto(t, open, zk, cols);
      if (t > T.zoom) {
        var fadeOut = clamp((t - T.zoom) / 0.35, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,' + (fadeOut * 0.95) + ')';
        ctx.fillRect(-40, -40, W + 80, H + 80);
      }
    }

    // ---- надпись NORM ----
    var tA = clamp((t - T.textIn) / 0.55, 0, 1);
    var killed = t >= T.impact;
    if (tA > 0 && !killed) {
      var sc = 0.94 + 0.12 * easeOut(tA) - (t - T.textIn) * 0.012;
      var gl = t < T.gunIn ? 0.9 * (1 - clamp((t - T.textIn) / .7, 0, 1)) : 0.06;
      if (t > T.gunIn) gl = 0.18;
      drawText(easeOut(tA), sc, gl);
      // пыль/гранж
      ctx.globalAlpha = .05;
      for (var d = 0; d < 40; d++) {
        ctx.fillStyle = d % 2 ? '#fff' : '#b9c0ca';
        ctx.fillRect(rnd(0, W), rnd(0, H), rnd(1, 3), rnd(1, 3));
      }
      ctx.globalAlpha = 1;
    }

    // ---- пистолет ----
    var tg = (t - T.gunIn) / 0.55;
    if (tg > 0 && !killed) {
      var enter = easeOut(clamp(tg, 0, 1));
      var gy = H * 0.53;
      var gx = W * 0.52 + (1 - enter) * W * 0.7;
      var recoil = Math.max(0, 1 - (t - T.shot) / 0.25) * (t > T.shot ? 1 : 0);
      var rot = -0.16 - (1 - enter) * 0.35;
      gx += Math.sin(t * 9) * (1 - enter) * 6;
      drawGun(gx, gy, Math.min(W, H) / 620, rot, recoil);
    }

    // ---- выстрел ----
    if (t > T.shot && t < T.shot + 0.22 && !killed) {
      var mx = W * 0.52, my = H * 0.53 - Math.min(W, H) / 620 * 11;
      var f = 1 - (t - T.shot) / 0.22;
      flash = Math.max(flash, f);
      var rg = ctx.createRadialGradient(mx, my, 0, mx, my, Math.max(W, H) * 0.5 * (1.2 - f * .5));
      rg.addColorStop(0, 'rgba(255,255,255,' + (0.95 * f) + ')');
      rg.addColorStop(.18, 'rgba(255,214,140,' + (0.75 * f) + ')');
      rg.addColorStop(.42, 'rgba(255,140,40,' + (0.28 * f) + ')');
      rg.addColorStop(1, 'rgba(255,90,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      // вспышка-звезда
      ctx.save(); ctx.translate(mx, my); ctx.rotate(rnd(0, 1));
      ctx.fillStyle = 'rgba(255,240,200,' + (0.9 * f) + ')';
      for (var k = 0; k < 5; k++) {
        ctx.beginPath();
        var a1 = k * 1.26, L = (70 + Math.random() * 130) * (0.6 + f * .8);
        ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a1) * L, Math.sin(a1) * L);
        ctx.lineTo(Math.cos(a1 + .18) * L * .7, Math.sin(a1 + .18) * L * .7); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      if (!window.__bang) { window.__bang = 1; boom(); shake = 16; }
      // дым
      if (Math.random() < .8) smoke.push({ x: mx, y: my, r: rnd(10, 26), a: .5, vx: rnd(-1.4, .5), vy: rnd(-1.2, -.2), g: rnd(.6, 1.4) });
    }

    // дым частицы
    for (var s = smoke.length - 1; s >= 0; s--) {
      var p = smoke[s];
      p.x += p.vx; p.y += p.vy; p.r += p.g; p.a -= 0.012;
      if (p.a <= 0) { smoke.splice(s, 1); continue; }
      var sg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      sg.addColorStop(0, 'rgba(190,190,200,' + p.a * .5 + ')');
      sg.addColorStop(1, 'rgba(120,120,130,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }

    // ---- пуля ----
    if (t > T.bulletIn && t < T.impact + 0.05) {
      var bp = easeInOut(clamp((t - T.bulletIn) / (T.impact - T.bulletIn), 0, 1));
      var x0 = W * 0.52, x1 = W / 2 - textRect.w * 0.06;
      var bx = x0 + (x1 - x0) * bp;
      var by = H * 0.53 - 8 + (H / 2 - H * 0.53) * bp;
      // ударная волна
      ctx.globalAlpha = .18 * (1 - bp);
      for (var wv = 1; wv <= 3; wv++) {
        ctx.beginPath(); ctx.arc(bx + 70 * wv, by, 26 + 18 * wv, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // след
      var tr = ctx.createLinearGradient(bx + 220, by, bx, by);
      tr.addColorStop(0, 'rgba(255,255,255,0)'); tr.addColorStop(1, 'rgba(255,240,210,.5)');
      ctx.strokeStyle = tr; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx + 210, by); ctx.lineTo(bx + 6, by); ctx.stroke(); ctx.lineCap = 'butt';
      // пуля
      ctx.save();
      ctx.translate(bx, by); ctx.rotate(-Math.PI / 2);
      var bl = Math.min(W, H) * 0.16, bw = bl * BUL_IMG.naturalWidth / BUL_IMG.naturalHeight;
      if (BUL_IMG.complete && BUL_IMG.naturalWidth) ctx.drawImage(BUL_IMG, -bw / 2, -bl / 2, bw, bl);
      ctx.restore();
    }

    // ---- попадание и осколки ----
    if (t >= T.impact) {
      if (!impactPt) {
        impactPt = { x: W / 2 + textRect.w * 0.06, y: H / 2 };
        makeFrags(textRect.x, textRect.y, textRect.w, textRect.h);
        shatter(); shake = 22;
      }
      beam = Math.min(1, beam + 0.12);
      // луч света
      var lg = ctx.createRadialGradient(impactPt.x, impactPt.y, 0, impactPt.x, impactPt.y, Math.max(W, H) * .55);
      lg.addColorStop(0, 'rgba(255,255,255,' + (0.85 * (1 - clamp((t - T.impact) / 1.0, 0, 1))) + ')');
      lg.addColorStop(.25, 'rgba(255,236,190,' + (0.45 * (1 - clamp((t - T.impact) / 1.0, 0, 1))) + ')');
      lg.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);

      // осколки
      var dt = 1 / 60;
      for (var fi = 0; fi < frags.length; fi++) {
        var fr = frags[fi];
        fr.x += fr.vx * 60 * dt * 0.9 * (1 + (t - T.impact) * 0.5);
        fr.y += fr.vy * 60 * dt * 0.9 * (1 + (t - T.impact) * 0.5);
        fr.vy += 0.25 * dt * 6;
        fr.rot += fr.vr * dt * 0.5;
        fr.a -= 0.0055;
        if (fr.a <= 0) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, fr.a);
        ctx.translate(fr.x + fr.w / 2, fr.y + fr.h / 2);
        ctx.rotate(fr.rot);
        try {
          ctx.drawImage(textCv, fr.ox / textRect.w * textCv.width, fr.oy / textRect.h * textCv.height,
            fr.w / textRect.w * textCv.width, fr.h / textRect.h * textCv.height,
            -fr.w / 2, -fr.h / 2, fr.w, fr.h);
        } catch (e) {}
        ctx.restore();
      }

      // финальное затемнение
      var fin = clamp((t - T.impact - 0.72) / 0.5, 0, 1);
      if (fin > 0) { ctx.fillStyle = 'rgba(0,0,0,' + fin + ')'; ctx.fillRect(0, 0, W, H); }
    }

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
