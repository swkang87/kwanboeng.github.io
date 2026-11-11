/*
 * seal-prep.js — 도장·서류 그림 손질 (화이트라벨 공용, 회사 고유값 없음) (2026-11-11, v2.8.1)
 *
 * 도장 그림을 문서에 「글 앞으로」 넣으면 흰 배경이 표 선·글자를 가린다. 그래서 넣기 전에
 *   ① 흰(밝은) 배경 → 투명 (배경 밝기는 그림 가장자리에서 잰다 — 누렇게 스캔된 종이도 됨)
 *   ② 반투명 가장자리의 색을 배경색에서 되돌려(언프리멀티플라이) 인영 색(빨강)을 그대로 두고 테두리를 부드럽게
 *   ③ 여백을 잘라 그림 크기 = 인영 크기 → 문서에서 자리별 크기가 그림마다 같아진다
 * 해상도는 줄이지 않는다(긴 변이 MAX_SIDE 를 넘을 때만 줄임). 원본보다 키우지도 않는다.
 *
 *   SealPrep.clean(rgba, w, h, opts) → {data, w, h, changed, bg}   순수 함수(브라우저·Node 공용)
 *   SealPrep.decode(bytes) → Promise<{data, w, h}>                  브라우저: PNG·JPG·BMP
 *   SealPrep.toPng(bytes, {clean}) → Promise<{bytes, w, h, srcW, srcH, changed}>  브라우저: 손질(또는 형식만 바꿈) 후 PNG
 *   SealPrep.convert(bytes, {maxBytes}) → Promise<{bytes, ext, mime, w, h}>       브라우저: 해상도 그대로 PNG(크면 JPG)
 */
(function (root) {
  'use strict';

  var MAX_SIDE = 2400;     // 이보다 크면 줄인다(긴 변 px). 도장 400px · 자격증 사본 A4 300dpi 상당(약 2480)을 넘는 값
  var SOFT = 70;           // 배경 밝기에서 이만큼 어두워지면 완전히 불투명(그 사이는 부드럽게)
  var MARGIN = 12;         // 배경 밝기보다 이만큼 밝거나 비슷하면 완전히 투명
  var PAD_RATIO = 0.02;    // 자른 뒤 둘레에 남길 여백(긴 변 대비)

  function lum(r, g, b) { return Math.min(r, g, b); }   // 「얼마나 흰가」 = 가장 어두운 채널

  // 가장자리 픽셀로 배경 밝기 추정: 불투명 가장자리 픽셀의 min 채널 값 중앙값. 가장자리가 대부분 투명이면 null(이미 투명)
  function borderBg(d, w, h) {
    var vals = [], transp = 0, n = 0;
    function take(x, y) {
      var i = (y * w + x) * 4; n++;
      if (d[i + 3] < 128) { transp++; return; }
      vals.push(lum(d[i], d[i + 1], d[i + 2]));
    }
    var step = Math.max(1, Math.floor(Math.max(w, h) / 200));
    for (var x = 0; x < w; x += step) { take(x, 0); take(x, h - 1); }
    for (var y = 0; y < h; y += step) { take(0, y); take(w - 1, y); }
    if (transp > n * 0.6 || !vals.length) return null;
    vals.sort(function (a, b) { return a - b; });
    return vals[Math.floor(vals.length / 2)];
  }

  function clean(src, w, h, opts) {
    opts = opts || {};
    var d = new Uint8ClampedArray(src);   // 복사
    var bg = borderBg(d, w, h);
    var changed = false;
    // 배경이 충분히 밝을 때만(어두운 배경 그림은 건드리지 않음)
    if (bg !== null && bg >= 150) {
      var hi = bg - MARGIN, lo = hi - SOFT;
      for (var i = 0; i < d.length; i += 4) {
        var a0 = d[i + 3];
        if (!a0) continue;
        var v = lum(d[i], d[i + 1], d[i + 2]);
        var a = v >= hi ? 0 : (v <= lo ? 1 : (hi - v) / SOFT);
        if (a >= 1) continue;
        changed = true;
        if (a <= 0) { d[i + 3] = 0; continue; }
        // 배경색 위에 a 만큼 얹힌 색이라고 보고 원래 색을 되돌린다
        for (var k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, Math.round((d[i + k] - bg * (1 - a)) / a)));
        d[i + 3] = Math.round(a0 * a);
      }
    }
    // 여백 자르기(알파 기준)
    var x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return { data: d, w: w, h: h, changed: changed, bg: bg, empty: true };
    var pad = Math.round(Math.max(x1 - x0 + 1, y1 - y0 + 1) * PAD_RATIO) + 1;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
    var nw = x1 - x0 + 1, nh = y1 - y0 + 1;
    if (nw === w && nh === h) return { data: d, w: w, h: h, changed: changed, bg: bg };
    var out = new Uint8ClampedArray(nw * nh * 4);
    for (var yy = 0; yy < nh; yy++) {
      var s = ((yy + y0) * w + x0) * 4;
      out.set(d.subarray(s, s + nw * 4), yy * nw * 4);
    }
    return { data: out, w: nw, h: nh, changed: true, bg: bg };
  }

  /* ---------- 브라우저 ---------- */
  function sniffMime(b) {
    if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
    if (b[0] === 0xFF && b[1] === 0xD8) return 'image/jpeg';
    if (b[0] === 0x42 && b[1] === 0x4D) return 'image/bmp';
    return '';
  }
  function canvasOf(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  function decode(bytes) {
    var u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var mime = sniffMime(u8);
    if (!mime) return Promise.reject(new Error('PNG·JPG·BMP 그림이 아닙니다.'));
    var blob = new Blob([u8], { type: mime });
    var load = typeof createImageBitmap === 'function'
      ? createImageBitmap(blob)
      : new Promise(function (res, rej) {
        var url = URL.createObjectURL(blob), im = new Image();
        im.onload = function () { URL.revokeObjectURL(url); res(im); };
        im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('그림을 열지 못했습니다.')); };
        im.src = url;
      });
    return load.then(function (img) {
      var w = img.width, h = img.height;
      var sc = Math.min(1, MAX_SIDE / Math.max(w, h));
      var cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
      var c = canvasOf(cw, ch), g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, cw, ch);
      if (img.close) img.close();
      return { data: g.getImageData(0, 0, cw, ch).data, w: cw, h: ch, srcW: w, srcH: h };
    });
  }
  function encode(data, w, h, type, quality) {
    var c = canvasOf(w, h), g = c.getContext('2d');
    if (type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); }
    var tmp = canvasOf(w, h); tmp.getContext('2d').putImageData(new ImageData(data, w, h), 0, 0);
    g.drawImage(tmp, 0, 0);
    var p = c.convertToBlob ? c.convertToBlob({ type: type, quality: quality })
      : new Promise(function (res) { c.toBlob(res, type, quality); });
    return p.then(function (b) { return b.arrayBuffer(); }).then(function (buf) { return new Uint8Array(buf); });
  }
  function encodePng(data, w, h) { return encode(data, w, h, 'image/png'); }
  // 서류 그림(자격증 사본 등)을 해상도 그대로 PNG 로. maxBytes 를 넘으면 JPG(품질 0.92)로 — 버킷 크기 제한 대비
  function convert(bytes, opts) {
    opts = opts || {};
    return decode(bytes).then(function (im) {
      return encodePng(im.data, im.w, im.h).then(function (png) {
        if (!opts.maxBytes || png.length <= opts.maxBytes) return { bytes: png, ext: 'png', mime: 'image/png', w: im.w, h: im.h, srcW: im.srcW, srcH: im.srcH };
        return encode(im.data, im.w, im.h, 'image/jpeg', 0.92).then(function (jpg) {
          return { bytes: jpg, ext: 'jpg', mime: 'image/jpeg', w: im.w, h: im.h, srcW: im.srcW, srcH: im.srcH };
        });
      });
    });
  }
  // opts.clean: true = 배경 투명 + 여백 자르기(도장), false = 형식만 PNG 로(자격증 사본 BMP 등)
  function toPng(bytes, opts) {
    opts = opts || {};
    return decode(bytes).then(function (im) {
      var r = opts.clean === false ? { data: im.data, w: im.w, h: im.h, changed: false } : clean(im.data, im.w, im.h);
      return encodePng(r.data, r.w, r.h).then(function (png) {
        return { bytes: png, w: r.w, h: r.h, srcW: im.srcW, srcH: im.srcH, changed: r.changed || im.w !== im.srcW, empty: !!r.empty };
      });
    });
  }

  var API = { clean: clean, decode: decode, toPng: toPng, convert: convert, sniffMime: sniffMime, MAX_SIDE: MAX_SIDE };
  root.SealPrep = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
