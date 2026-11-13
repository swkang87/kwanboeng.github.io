/*
 * letter-doc.js — 업무관리 → 서류작성 → 공문 (2026-11-13, v2.9.0)
 *
 * 우리 회사 전용 기능이다(화이트라벨 아님 — config.js 에 넣지 않는다). 회사 고정값은 아래 CO 한 곳.
 * 사람 이름(결재란)·직인 그림은 이 파일과 저장소 서식에 두지 않는다(공개 저장소):
 *   결재란 = DB letter_depts, 직인 = DB doc_company_seals(직인) 그림 — 화면이 받아 넘긴다.
 *
 * 하는 일(화면 없이, Node 에서도 돈다):
 *   numberLabels / composeParas  본문 문단 번호(1. → 가. → 1) → 가)) · 첫 문단 인사 · 붙임 · 「끝.」
 *   guessHonorific               수신처 → 호칭(청·공사·본부·원·사)
 *   layout(letter, measure)      A4 배치(pt, 위에서 아래). 미리보기(SVG)와 PDF 가 같은 배치를 쓴다
 *   buildPdf(...)                pdf-lib + fontkit(나눔고딕 부분 글꼴) — 글자 선택되는 PDF
 *   buildHwpx(...)               서식 HWPX(assets/letter/template.hwpx) 채우기 — JSZip
 * 배치 기준 = 실제 발송본 관보26-238(일시정지 요청).pdf 의 글자 위치(pt).
 */
(function (root) {
  'use strict';

  /* ================= 회사 고정값 (이 기능 전용) ================= */
  var CO = {
    NAME_PREFIX: '(주) ',
    NAME: '관보종합기술단',
    SENDER: '(주) 관보종합기술단 대표이사',
    DOC_PREFIX: '관보',                 // 관보26-239
    POSTCODE: '47521',
    ADDRESS: '부산광역시 연제구 거제대로 270, 종근당B/D 301호',
    TEL: '051-853-2633',
    FAX: '051-853-4893',
    EMAIL: 'kwanboacc@naver.com',
    DEPTS: ['관리부', '설계부', '지반부'],   // 결재란 부서(첫째 = 기본). 이름·직급은 DB letter_depts
    TEMPLATE: 'assets/letter/template.hwpx'
  };
  var DISCLOSURE = ['공개', '부분공개', '비공개'];
  var DEFAULT_DISCLOSURE = '부분공개';
  var ARAE = '- 아  래 -';
  var GANA = '가나다라마바사아자차카타파하';

  function pad2(n) { return ('0' + n).slice(-2); }
  function todayIso() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function yy(year) { return pad2(Number(year) % 100); }
  function docNo(year, seq) { return CO.DOC_PREFIX + yy(year) + '-' + seq; }
  function docNoPlaceholder(year) { return CO.DOC_PREFIX + yy(year) + '-'; }
  // ( 2026. 11. 13. )
  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? '( ' + m[1] + '. ' + m[2] + '. ' + m[3] + '. )' : '( ' + new Date().getFullYear() + '.    .    . )';
  }
  // 대장 날짜 26.11.13
  function ledgerDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? m[1].slice(2) + '.' + m[2] + '.' + m[3] : '';
  }
  // 관보26-239(제목).pdf — 파일 이름에 못 쓰는 글자는 뺀다
  function fileName(no, title, ext) {
    var t = String(title || '').replace(/[\\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (t.length > 60) t = t.slice(0, 60).trim();
    return (no || '공문') + (t ? '(' + t + ')' : '') + '.' + ext;
  }

  /* ================= 호칭 ================= */
  // 구청·시청·군청·도청 → 청, ○○공사 → 공사, 본부 → 본부, 학교법인·○○원 → 원, 그 외 → 사
  function guessHonorific(name) {
    var s = String(name || '').replace(/\s+/g, '');
    if (!s) return '';
    if (/(구청|시청|군청|도청|청)(장)?$/.test(s) || /(구|시|군|도)$/.test(s) || /(시장|군수|구청장|도지사|교육감)$/.test(s) || /(구청|시청|군청|도청|교육청)/.test(s)) return '청';
    if (/본부(장)?$/.test(s) || /본부/.test(s)) return '본부';
    if (/공사(사장)?$/.test(s) || /공사/.test(s)) return '공사';
    if (/공단/.test(s)) return '공단';
    if (/학교법인|학교|대학|원(장)?$/.test(s)) return '원';
    if (/사업소(장)?$/.test(s)) return '사업소';
    return '사';
  }
  function greeting(hon) { return '귀 ' + (hon || '사') + '의 무궁한 발전을 기원합니다.'; }

  /* ================= 문단 번호 ================= */
  // body: [{t, lv:1~4, nn:번호 없음, arae:「- 아  래 -」}]
  function labelFor(lv, n) {
    if (lv === 1) return n + '.';
    if (lv === 2) return (GANA[n - 1] || ('(' + n + ')')) + '.';
    if (lv === 3) return n + ')';
    return (GANA[n - 1] || ('(' + n + ')')) + ')';
  }
  // 인사 문단(켜져 있으면 1.)을 포함한 최종 문단 목록 [{lv, label, text, center, arae}]
  function composeParas(letter) {
    var out = [], cnt = [0, 0, 0, 0];
    function num(lv) { cnt[lv - 1]++; for (var i = lv; i < 4; i++) cnt[i] = 0; return labelFor(lv, cnt[lv - 1]); }
    if (letter.greet !== false) out.push({ lv: 1, label: num(1), text: greeting(letter.hon) });
    (letter.body || []).forEach(function (p) {
      if (!p) return;
      if (p.arae) { out.push({ lv: 1, label: '', text: ARAE, center: true, arae: true }); return; }
      var lv = Math.min(4, Math.max(1, Number(p.lv) || 1));
      out.push({ lv: lv, label: p.nn ? '' : num(lv), text: String(p.t || ''), nn: !!p.nn });
    });
    // 붙임이 없으면 마지막 문단 끝에 「  끝.」
    var atts = attachList(letter);
    if (!atts.length) {
      var last = null;
      for (var i = out.length - 1; i >= 0; i--) { if (!out[i].arae) { last = out[i]; break; } }
      if (last) last.text = last.text.replace(/\s+$/, '') + '  끝.';
      else out.push({ lv: 1, label: '', text: '끝.', nn: true });
    }
    return out;
  }
  function attachList(letter) {
    return (letter.attachments || []).filter(function (a) { return a && String(a.name || '').trim(); })
      .map(function (a) { return { name: String(a.name).trim(), qty: String(a.qty || '1부').trim() || '1부' }; });
  }
  // 붙임 줄 [{head:'붙임', no:'1.', text:'○○ 1부.  끝.'}]
  function attachLines(letter) {
    var a = attachList(letter);
    return a.map(function (x, i) {
      var q = x.qty.replace(/\.$/, '') + '.';
      return { head: i === 0 ? '붙임' : '', no: a.length > 1 ? (i + 1) + '.' : '', text: x.name + ' ' + q + (i === a.length - 1 ? '  끝.' : '') };
    });
  }

  /* ================= 글자 폭 ================= */
  // fontkit 글꼴 두 개(보통·굵게)로 폭을 잰다(pt). 미리보기·PDF 가 같은 값을 쓴다
  function makeMeasure(reg, bold) {
    var cache = [{}, {}];
    function adv(cp, b) {
      var c = cache[b ? 1 : 0];
      if (c[cp] === undefined) {
        var f = b ? bold : reg, g = f.glyphForCodePoint(cp);
        c[cp] = (g ? g.advanceWidth : f.unitsPerEm / 2) / f.unitsPerEm;
      }
      return c[cp];
    }
    return function (text, size, b) {
      var w = 0, s = String(text || '');
      for (var i = 0; i < s.length; i++) { var cp = s.codePointAt(i); if (cp > 0xffff) i++; w += adv(cp, b); }
      return w * size;
    };
  }

  /* ================= 줄 나누기 ================= */
  // 한글은 글자 단위, 영문·숫자 묶음은 단어 단위. 줄 첫머리 빈칸은 버린다.
  function wrap(text, width0, widthN, size, measure) {
    var lines = [];
    String(text || '').split('\n').forEach(function (seg) {
      // 토막: 영문·숫자·기호 묶음 / 빈칸 / 그 밖 글자 하나
      var toks = seg.match(/[A-Za-z0-9.,\-_\/%@&:;'"()\[\]]+|\s|[\s\S]/g) || [];
      var cur = '', curW = 0, segStart = lines.length;
      function lim() { return lines.length === 0 ? width0 : widthN; }
      function push() { lines.push({ t: cur.replace(/\s+$/, ''), soft: true }); cur = ''; curW = 0; }
      toks.forEach(function (t) {
        var sp = /^\s$/.test(t);
        if (sp && cur === '' && lines.length > segStart) return;
        var w = measure(t, size);
        if (curW + w > lim() + 0.01 && cur !== '') {
          if (sp) { push(); return; }
          if (w <= widthN) { push(); cur = t; curW = w; return; }
        }
        if (curW + w > lim() + 0.01) {   // 한 토막이 줄보다 길면 글자 단위로
          Array.from(t).forEach(function (ch) {
            var cw = measure(ch, size);
            if (curW + cw > lim() + 0.01 && cur !== '') push();
            cur += ch; curW += cw;
          });
          return;
        }
        cur += t; curW += w;
      });
      lines.push({ t: cur, soft: false });
    });
    return lines;
  }

  /* ================= 배치 (pt, 위 → 아래) ================= */
  var G = {
    W: 595.28, H: 841.89,
    logo: { x: 94.0, y: 61.9, w: 82.3 },
    title: { x: 182.0, base: 97.2, size: 22 },
    head: { labelX: 58.9, valX: 107.4, right: 544.4, base0: 155.9, pitch: 25.2, size: 12 },
    rule: { x0: 53.8, x1: 544.4, gapBelowBase: 8.8, w: 1.08 },
    body: { x: 85.0, right: 544.4, size: 12, pitch: 21.6, firstGap: 36.9, indent: 12, lastBaseMax: 600, pageBaseMax: 792, nextTop: 80 },
    endX: 90.0,
    sign: { base: 647.2, size: 18, spacing: 0.2 },
    seal: { x: 417.1, y: 599.0, w: 78.0, cy: 637.6 },
    bar: { x: 52.4, y: 705.6, w: 483.6, h: 4.8, gray: 0.808 },
    foot: { size: 10, base0: 729.0, pitch: 15, x: 56.5, sign1: 171.0, sign2: 307.6, date: 185.1, recv: 512.1, fax: 206.5, mail: 351.0, right: 536.4 }
  };

  // letter: {docNo, date, recipient, via, title, greet, hon, body, attachments, dept, signLines:[{pos,name}], coop, disclosure}
  // measure(text, size, bold) → pt.  결과: {pages:[[item]], warnings}
  //   item = {k:'text', x, y(기준선), size, bold, text, cs(글자 사이 추가 pt)} | {k:'line'} | {k:'rect'} | {k:'img', key:'logo'|'seal'}
  function layout(letter, measure) {
    var pages = [[]], cur = pages[0], warnings = [];
    function T(x, y, text, size, bold, cs) { cur.push({ k: 'text', x: x, y: y, size: size, bold: !!bold, text: text, cs: cs || 0 }); }
    function spaced(text, size) { return measure(text, size, true) + G.sign.spacing * size * (text.length - 1); }

    // ── 머리: 로고 · 회사명 ──
    cur.push({ k: 'img', key: 'logo', x: G.logo.x, y: G.logo.y, w: G.logo.w });
    var tSize = G.title.size, x = G.title.x;
    T(x, G.title.base, CO.NAME_PREFIX, tSize, true, 0.1 * tSize);
    x += measure(CO.NAME_PREFIX, tSize, true) + 0.1 * tSize * CO.NAME_PREFIX.length;
    T(x, G.title.base, CO.NAME, tSize, true, 0.2 * tSize);

    // ── 수신 · (경유) · 제목 ──
    var h = G.head, base = h.base0, vw = h.right - h.valX;
    [['수  신', letter.recipient], ['(경유)', letter.via], ['제  목', letter.title]].forEach(function (r, i) {
      T(h.labelX, base, r[0], h.size, false);
      var ls = wrap(r[1] || '', vw, vw, h.size, function (s, z) { return measure(s, z, false); });
      ls.forEach(function (l, j) {
        T(h.valX, base, l.t, h.size, false);
        if (j < ls.length - 1) base += h.size * 1.6;
      });
      if (i < 2) base += h.pitch;
    });
    var ruleY = base + G.rule.gapBelowBase;
    cur.push({ k: 'line', x0: G.rule.x0, x1: G.rule.x1, y: ruleY, w: G.rule.w });

    // ── 본문 ──
    var b = G.body, y = ruleY + b.firstGap, paras = composeParas(letter);
    var m = function (s, z) { return measure(s, z, false); };
    var rows = [];   // {x, text, justifyW}
    paras.forEach(function (p) {
      var bx = b.x + (p.lv - 1) * b.indent;
      if (p.arae) { rows.push({ center: true, text: p.text }); return; }
      var lab = p.label ? p.label + ' ' : '';
      var textX = p.nn ? bx + m(labelFor(p.lv, 1) + ' ', b.size) : bx + m(lab, b.size);
      var contX = p.nn ? textX : bx + m(p.label, b.size);
      var firstX = p.nn ? textX : bx;
      var ls = wrap(lab + p.text, b.right - firstX, b.right - contX, b.size, m);
      ls.forEach(function (l, j) { rows.push({ x: j === 0 ? firstX : contX, text: l.t, jw: l.soft ? (b.right - (j === 0 ? firstX : contX)) : 0 }); });
    });
    var al = attachLines(letter);
    if (al.length) {
      rows.push({ gap: true });
      var headW = m('붙임  ', b.size), noW = al.length > 1 ? m('9. ', b.size) : 0;
      al.forEach(function (a) {
        var tx = b.x + headW + noW;
        var ls = wrap(a.text, b.right - tx, b.right - tx, b.size, m);
        ls.forEach(function (l, j) {
          rows.push({ x: tx, text: l.t, pre: j === 0 ? [{ x: b.x, t: a.head }, { x: b.x + headW, t: a.no }] : null });
        });
      });
    }
    // 쪽 나누기: 마지막 쪽은 서명 위(lastBaseMax)까지, 그 앞 쪽은 아래 여백까지
    var lastPageRows = [];
    rows.forEach(function (r) {
      if (y > b.pageBaseMax) { pages.push([]); cur = pages[pages.length - 1]; y = b.nextTop; }
      if (r.gap) { y += b.pitch * 0.5; return; }
      if (r.center) T(G.W / 2 - m(r.text, b.size) / 2, y, r.text, b.size, false);
      else {
        var w = m(r.text, b.size), cs = 0, n = Array.from(r.text).length;
        if (r.jw && n > 1 && r.jw - w > 0 && (r.jw - w) / (n - 1) < b.size * 0.5) cs = (r.jw - w) / (n - 1);
        if (r.pre) r.pre.forEach(function (q) { if (q.t) T(q.x, y, q.t, b.size, false); });
        T(r.x, y, r.text, b.size, false, cs);
      }
      lastPageRows.push(y);
      y += b.pitch;
    });
    // 마지막 글 줄이 서명 자리를 침범하면 서명·하단을 다음 쪽으로
    var lastBase = y - b.pitch;
    if (lastBase > b.lastBaseMax) { pages.push([]); cur = pages[pages.length - 1]; }
    if (pages.length > 1) warnings.push('본문이 길어 ' + pages.length + '쪽이 됩니다.');

    // ── 발신 명의 · 직인 ──
    var s = G.sign, sw = spaced(CO.SENDER, s.size);
    T(G.W / 2 - sw / 2, s.base, CO.SENDER, s.size, true, s.spacing * s.size);
    cur.push({ k: 'img', key: 'seal', x: G.seal.x, y: G.seal.y, w: G.seal.w, cy: G.seal.cy });

    // ── 하단 ──
    cur.push({ k: 'rect', x: G.bar.x, y: G.bar.y, w: G.bar.w, h: G.bar.h, gray: G.bar.gray });
    var f = G.foot, fb = f.base0, fm = function (t) { return measure(t, f.size, false); };
    T(f.x, fb, letter.dept || CO.DEPTS[0], f.size);
    var sl = (letter.signLines || []).filter(function (q) { return q && (q.pos || q.name); });
    if (sl[0]) T(f.sign1, fb, ((sl[0].pos || '') + '  ' + (sl[0].name || '')).trim(), f.size);
    if (sl[1]) T(f.sign2, fb, ((sl[1].pos || '') + '  ' + (sl[1].name || '')).trim(), f.size);
    fb += f.pitch;
    T(f.x, fb, '협조', f.size);
    if (letter.coop) T(f.sign1, fb, letter.coop, f.size);
    fb += f.pitch;
    var no = '시행  ' + (letter.docNo || docNoPlaceholder(yearOf(letter))) + '호';
    T(f.x, fb, no, f.size);
    T(Math.max(f.date, f.x + fm(no) + 12), fb, fmtDate(letter.date), f.size);
    T(f.recv, fb, '접수', f.size);
    fb += f.pitch;
    T(f.x, fb, '우 ' + CO.POSTCODE + '   ' + CO.ADDRESS, f.size);
    fb += f.pitch;
    T(f.x, fb, '전화 ' + CO.TEL, f.size);
    T(f.fax, fb, '전송 ' + CO.FAX, f.size);
    T(f.mail, fb, CO.EMAIL, f.size);
    var dis = letter.disclosure || DEFAULT_DISCLOSURE;
    T(f.right - fm(dis), fb, dis, f.size);
    return { pages: pages, warnings: warnings };
  }
  function yearOf(letter) { var m = /^(\d{4})/.exec(String(letter.date || '')); return m ? Number(m[1]) : new Date().getFullYear(); }

  /* ================= 미리보기 SVG ================= */
  // images: {logo:{url, w, h}, seal:{url,w,h}|null} (w·h = 그림 픽셀). fontFamily = @font-face 이름
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function imgBox(it, im) {
    var w = it.w, hgt = im && im.w ? w * im.h / im.w : w;
    var top = it.cy ? it.cy - hgt / 2 : it.y;
    return { x: it.x, y: top, w: w, h: hgt };
  }
  function pageSvg(items, images, fontFamily) {
    var o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + G.W + ' ' + G.H + '" width="100%" style="display:block;background:#fff">'];
    items.forEach(function (it) {
      if (it.k === 'text') {
        o.push('<text x="' + it.x.toFixed(2) + '" y="' + it.y.toFixed(2) + '" font-size="' + it.size + '" font-family="' + esc(fontFamily) + '"' +
          (it.bold ? ' font-weight="700"' : '') + (it.cs ? ' letter-spacing="' + it.cs.toFixed(3) + '"' : '') + ' xml:space="preserve" fill="#000">' + esc(it.text) + '</text>');
      } else if (it.k === 'line') {
        o.push('<line x1="' + it.x0 + '" y1="' + it.y.toFixed(2) + '" x2="' + it.x1 + '" y2="' + it.y.toFixed(2) + '" stroke="#000" stroke-width="' + it.w + '"/>');
      } else if (it.k === 'rect') {
        var g = Math.round(it.gray * 255);
        o.push('<rect x="' + it.x + '" y="' + it.y + '" width="' + it.w + '" height="' + it.h + '" fill="rgb(' + g + ',' + g + ',' + g + ')"/>');
      } else if (it.k === 'img') {
        var im = images && images[it.key];
        if (!im || !im.url) return;
        var bx = imgBox(it, im);
        o.push('<image href="' + esc(im.url) + '" x="' + bx.x.toFixed(2) + '" y="' + bx.y.toFixed(2) + '" width="' + bx.w.toFixed(2) + '" height="' + bx.h.toFixed(2) + '" preserveAspectRatio="xMidYMid meet"/>');
      }
    });
    o.push('</svg>');
    return o.join('');
  }

  /* ================= PDF ================= */
  // o = {letter, measure, PDFLib, fontkit, fontReg(bytes), fkBold(fontkit 굵은 글꼴), logo(png bytes), seal(png bytes|null)}
  // 글꼴은 통째로 넣는다(@pdf-lib/fontkit 1.1.1 의 부분 글꼴(subset)은 한글 겹친 글리프를 빠뜨림 — 2350자 중 약 1,240자 빈칸, 2026-11-13 확인).
  // 굵은 글씨(회사명·발신 명의, 고정 문구 두 줄)는 글꼴을 하나 더 넣지 않고 글리프 윤곽선으로 그린다(파일 크기 절반).
  function buildPdf(o) {
    var L = o.PDFLib, res = layout(o.letter, o.measure);
    return L.PDFDocument.create().then(function (pdf) {
      pdf.registerFontkit(o.fontkit);
      pdf.setTitle(fileName(o.letter.docNo, o.letter.title, 'pdf').replace(/\.pdf$/, ''));
      pdf.setAuthor(CO.SENDER);
      pdf.setCreator('kbsys 공문');
      return Promise.all([
        pdf.embedFont(o.fontReg, { subset: false }),
        o.logo ? pdf.embedPng(o.logo) : null, o.seal ? pdf.embedPng(o.seal) : null
      ]).then(function (e) {
        var fr = e[0], imgs = { logo: e[1], seal: e[2] };
        res.pages.forEach(function (items) {
          var pg = pdf.addPage([G.W, G.H]);
          items.forEach(function (it) {
            if (it.k === 'text') {
              if (!it.text) return;
              if (it.bold) { drawOutline(pg, L, o.fkBold, it); return; }
              if (it.cs) pg.pushOperators(L.setCharacterSpacing(it.cs));
              pg.drawText(it.text, { x: it.x, y: G.H - it.y, size: it.size, font: fr, color: L.rgb(0, 0, 0) });
              if (it.cs) pg.pushOperators(L.setCharacterSpacing(0));
            } else if (it.k === 'line') {
              pg.drawLine({ start: { x: it.x0, y: G.H - it.y }, end: { x: it.x1, y: G.H - it.y }, thickness: it.w, color: L.rgb(0, 0, 0) });
            } else if (it.k === 'rect') {
              pg.drawRectangle({ x: it.x, y: G.H - it.y - it.h, width: it.w, height: it.h, color: L.rgb(it.gray, it.gray, it.gray) });
            } else if (it.k === 'img') {
              var im = imgs[it.key];
              if (!im) return;
              var bx = imgBox(it, { w: im.width, h: im.height });
              pg.drawImage(im, { x: bx.x, y: G.H - bx.y - bx.h, width: bx.w, height: bx.h });
            }
          });
        });
        return pdf.save();
      });
    });
  }

  function drawOutline(pg, L, fk, it) {
    var s = it.size / fk.unitsPerEm, x = it.x;
    Array.from(it.text).forEach(function (ch) {
      var g = fk.glyphForCodePoint(ch.codePointAt(0));
      var d = g.path.scale(s, -s).toSVG();
      if (d) pg.drawSvgPath(d, { x: x, y: G.H - it.y, color: L.rgb(0, 0, 0), borderWidth: 0 });
      x += g.advanceWidth * s + (it.cs || 0);
    });
  }

  /* ================= HWPX ================= */
  function xesc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function aesc(s) { return xesc(s).replace(/"/g, '&quot;'); }
  function pngSize(b) {
    if (!b || b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50) return null;
    var dv = function (i) { return (b[i] << 24 | b[i + 1] << 16 | b[i + 2] << 8 | b[i + 3]) >>> 0; };
    return { w: dv(16), h: dv(20) };
  }
  // 문단 모양(paraPr) 복사 — 왼쪽 여백·첫 줄·정렬·줄 간격을 바꾼 새 id 를 붙인다(hp:case 값 = hp:default 의 절반)
  function addParaPr(hdr, srcId, o) {
    var re = new RegExp('<hh:paraPr id="' + srcId + '"[\\s\\S]*?</hh:paraPr>');
    var m = re.exec(hdr);
    if (!m) throw new Error('서식 문단 모양 ' + srcId + ' 이 없습니다.');
    var ids = hdr.match(/<hh:paraPr id="(\d+)"/g).map(function (s) { return Number(s.replace(/\D/g, '')); });
    var nid = Math.max.apply(null, ids) + 1;
    var x = m[0].replace('id="' + srcId + '"', 'id="' + nid + '"');
    if (o.align) x = x.replace(/<hh:align horizontal="\w+"/, '<hh:align horizontal="' + o.align + '"');
    function setM(tag, v) {
      var i = 0;
      x = x.replace(new RegExp('<hc:' + tag + ' value="-?\\d+"', 'g'), function () { var val = (i++ === 0) ? Math.round(v / 2) : v; return '<hc:' + tag + ' value="' + val + '"'; });
    }
    if (o.left != null) setM('left', o.left);
    if (o.intent != null) setM('intent', o.intent);
    if (o.right != null) setM('right', o.right);
    if (o.line != null) x = x.replace(/<hh:lineSpacing type="PERCENT" value="\d+"/g, '<hh:lineSpacing type="PERCENT" value="' + o.line + '"');
    if (o.fixed != null) {
      var k = 0;
      x = x.replace(/<hh:lineSpacing type="\w+" value="\d+"/g, function () { var v = (k++ === 0) ? o.fixed : o.fixed * 2; return '<hh:lineSpacing type="FIXED" value="' + v + '"'; });
    }
    hdr = hdr.replace(/(<hh:paraProperties itemCnt=")(\d+)(")/, function (a, p, n, q) { return p + (Number(n) + 1) + q; });
    hdr = hdr.replace('</hh:paraProperties>', x + '</hh:paraProperties>');
    return { hdr: hdr, id: nid };
  }
  function para(pp, cp, text) {
    var parts = String(text).split('\n').map(xesc).join('<hp:lineBreak/>');
    return '<hp:p id="2147483648" paraPrIDRef="' + pp + '" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="' + cp + '"><hp:t>' + parts + '</hp:t></hp:run></hp:p>';
  }
  function emptyPara(pp, cp) {
    return '<hp:p id="2147483648" paraPrIDRef="' + pp + '" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="' + cp + '"/></hp:p>';
  }
  // HWPX 배치 어림값(pt) — 이 PC 한글로 서식을 열어 잰 값(2026-11-13). 서식을 바꾸면 다시 잰다
  var HWPX_GEO = {
    left: 3400, step: 1200, space: 330, hang: [0, 920, 1500, 1000, 1600],   // 문단 모양(HWPUNIT): 번호 x = 51pt + left/100
    textRight: 540.0, bodyTop: 235.0, pitch: 21.6, widthFactor: 1.15,       // 본문 첫 줄 위(pt), 줄 간격, 맑은 고딕 ≈ 나눔고딕 × 1.15(넉넉히 — 적게 잡으면 하단이 다음 쪽으로 넘어감)
    attGap: 21.6, attRow: 23.3, attPad: 5.7,
    picParaTop: 558.0                                                         // 직인 문단 위 = 발신 명의 위 − 54pt(발신 명의 ≈ 612pt, 하단 끝 ≈ 774pt)
  };
  function estimateHwpxBottom(paras, al, measure) {
    var H = HWPX_GEO, n = 0;
    var m = measure ? function (t, z) { return measure(t, z, false) * H.widthFactor; } : function (t, z) { return String(t).length * z * 0.95; };
    paras.forEach(function (p) {
      var lf = 51 + (H.left + (p.lv - 1) * H.step) / 100;
      if (p.arae) { n += 1; return; }
      var x0 = p.label ? lf : lf + (H.hang[p.lv] + H.space) / 100, x1 = p.label ? lf + H.hang[p.lv] / 100 : x0;
      n += wrap((p.label ? p.label + ' ' : '') + p.text, H.textRight - x0, H.textRight - x1, 12, m).length;
    });
    var y = H.bodyTop + n * H.pitch;
    if (al.length) y += H.attGap + al.length * H.attRow + H.attPad;
    return y;
  }
  // 서식 표 칸(행 r, 열 c)의 빈 run 에 글자 넣기
  function fillCell(tbl, r, c, text) {
    var re = new RegExp('(<hp:tc [^>]*>(?:(?!</hp:tc>)[\\s\\S])*?<hp:cellAddr colAddr="' + c + '" rowAddr="' + r + '"/>)');
    var m = re.exec(tbl);
    if (!m) throw new Error('서식 표 칸 ' + r + ',' + c + ' 이 없습니다.');
    var cell = m[1];
    var nc = cell.replace(/<hp:run charPrIDRef="(\d+)"\/>|<hp:run charPrIDRef="(\d+)"><hp:t>[^<]*<\/hp:t><\/hp:run>/, function (a, c1, c2) {
      return '<hp:run charPrIDRef="' + (c1 || c2) + '"><hp:t>' + xesc(text) + '</hp:t></hp:run>';
    });
    return tbl.replace(cell, nc);
  }

  // o = {letter, template(bytes), seal(png bytes|null), JSZip} → Promise(Uint8Array | Blob)
  function buildHwpx(o) {
    var letter = o.letter, JSZip = o.JSZip;
    return JSZip.loadAsync(o.template).then(function (zip) {
      return Promise.all([zip.file('Contents/section0.xml').async('string'), zip.file('Contents/header.xml').async('string'),
        zip.file('mimetype') ? zip.file('mimetype').async('string') : 'application/hwp+zip']).then(function (r) {
        var sec = r[0], hdr = r[1], mimetype = r[2];
        sec = sec.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '');

        // ── 머리 표: 수신 · 경유 · 제목 ──
        var tm = /<hp:tbl id="1258927825"[\s\S]*?<\/hp:tbl>/.exec(sec);
        if (!tm) throw new Error('서식에 수신·제목 표가 없습니다.');
        var tb = tm[0];
        tb = fillCell(tb, 0, 1, letter.recipient || '');
        tb = fillCell(tb, 1, 1, letter.via || '');
        tb = fillCell(tb, 2, 1, letter.title || '');
        sec = sec.replace(tm[0], tb);

        // ── 머리말 여백 56.7 → 6.7pt — 실제 발송본(관보26-238)처럼 전체를 50pt 올려 본문 자리를 넓힌다 ──
        sec = sec.replace(/(<hp:margin header=")5668(")/, '$1668$2');

        // ── 본문 문단: 서식의 「1. 귀 청의…」(paraPr 20) 부터 직인 문단 앞까지를 새로 만든다 ──
        //   본문(수준별 문단 모양) → [빈 줄 + 붙임 표] → 높이 고정 빈 줄(발신 명의를 쪽 아래 자리에 맞춤) → 직인 문단(서식 그대로)
        //   문단 모양 값: hp:case = 실제 HWPUNIT, hp:default = 그 두 배(서식 규칙). 번호 = 왼쪽 여백, 둘째 줄 = 번호 폭만큼 안쪽
        var H = HWPX_GEO, pp = [], ppNN = [];
        for (var lv = 1; lv <= 4; lv++) {
          var lf = H.left + (lv - 1) * H.step;
          var a = addParaPr(hdr, 21, { left: lf * 2, intent: -H.hang[lv] * 2, line: 180 }); hdr = a.hdr; pp[lv] = a.id;
          var b = addParaPr(hdr, 21, { left: (lf + H.hang[lv] + H.space) * 2, intent: 0, line: 180 }); hdr = b.hdr; ppNN[lv] = b.id;
        }
        var cen = addParaPr(hdr, 21, { left: 0, intent: 0, align: 'CENTER', line: 180 }); hdr = cen.hdr;
        var paras = composeParas(letter);
        var bodyXml = paras.map(function (p) {
          if (p.arae) return para(cen.id, 21, p.text);
          if (!p.label) return para(ppNN[p.lv], 21, p.text);
          return para(pp[p.lv], 21, p.label + ' ' + p.text);
        }).join('');
        var start = sec.search(/<hp:p [^>]*paraPrIDRef="20"/);
        var picAt = sec.indexOf('binaryItemIDRef="image2"');
        var picStart = sec.lastIndexOf('<hp:p ', picAt);
        if (start < 0 || picAt < 0 || picStart < start) throw new Error('서식에 본문·직인 문단 자리가 없습니다.');
        var region = sec.slice(start, picStart);
        var am = /<hp:p [^>]*><hp:run charPrIDRef="\d+"><hp:tbl id="1623430322"[\s\S]*?<\/hp:tbl><hp:t\/><\/hp:run><\/hp:p>/.exec(region);
        if (!am) throw new Error('서식에 붙임 표가 없습니다.');
        var al = attachLines(letter);
        var attXml = al.length ? emptyPara(17, 15) + attachTable(am[0], al) : '';
        // 글 끝 높이 어림(pt) → 발신 명의가 G.sign 자리 근처에 오도록 빈 줄 높이를 정한다(넘치면 0 = 그대로 흘러감)
        var est = estimateHwpxBottom(paras, al, o.measure);
        var gap = Math.round(H.picParaTop - est);
        var spacer = '';
        var tail = sec.slice(picStart), tight = false;
        if (gap > 1) { var f = addParaPr(hdr, 18, { fixed: gap * 100 }); hdr = f.hdr; spacer = emptyPara(f.id, 18); }
        else {
          // 글이 길면 직인 문단 뒤 빈 줄 2개(36pt)를 빼서 하단이 같은 쪽에 남게 한다(직인은 문단 맨 위로)
          tight = true;
          var pe = tail.indexOf('</hp:p>') + 7;
          tail = tail.slice(0, pe) + tail.slice(pe).replace(/^(?:<hp:p [^>]*paraPrIDRef="16"[^>]*><hp:run charPrIDRef="18"\/><\/hp:p>){1,2}/, '');
        }
        sec = sec.slice(0, start) + bodyXml + attXml + spacer + tail;

        // ── 직인 ──
        var picRe = /<hp:pic [^>]*>(?:(?!<\/hp:pic>)[\s\S])*binaryItemIDRef="image2"[\s\S]*?<\/hp:pic>/;
        var sealSz = pngSize(o.seal);
        if (!o.seal || !sealSz) sec = sec.replace(picRe, '');
        else sec = sec.replace(picRe, function (pic) { return sealPic(pic, sealSz, tight); });

        // ── 하단: 결재 · 협조 · 시행 · 주소 · 전화/메일/공개 ──
        var sl = (letter.signLines || []).filter(function (q) { return q && (q.pos || q.name); });
        var signTxt = xesc(letter.dept || CO.DEPTS[0]) + '<hp:tab width="376" leader="0" type="1"/><hp:tab width="4000" leader="0" type="1"/>' +
          (sl[0] ? xesc(((sl[0].pos || '') + '  ' + (sl[0].name || '')).trim()) : '') + '<hp:tab width="1776" leader="0" type="1"/><hp:tab width="4000" leader="0" type="1"/>' +
          (sl[1] ? xesc(((sl[1].pos || '') + '  ' + (sl[1].name || '')).trim()) : '') + '  ';
        sec = sec.replace(/(<hp:run charPrIDRef="25"><hp:t>)[^<]*<hp:tab[\s\S]*?(<\/hp:t><\/hp:run><hp:run charPrIDRef="26"\/>)/, function (a0, p1, p2) { return p1 + signTxt + p2; });
        sec = sec.replace('<hp:t> 협조  </hp:t>', '<hp:t> 협조  ' + xesc(letter.coop ? '            ' + letter.coop : '') + '</hp:t>');
        var no = letter.docNo || docNoPlaceholder(yearOf(letter));
        sec = sec.replace(/<hp:t> 시행  [^<]*?(<hp:tab)/, '<hp:t> 시행  ' + xesc(no) + '호     ' + xesc(fmtDate(letter.date)) + '            $1');
        sec = sec.replace(/<hp:t> 우 \d+[^<]*<\/hp:t>/, '<hp:t> 우 ' + CO.POSTCODE + '   ' + xesc(CO.ADDRESS) + '      </hp:t>');
        sec = sec.replace(/mailto:[^;"<]+/g, 'mailto:' + CO.EMAIL);
        sec = sec.replace(/(<hp:run charPrIDRef="27"><hp:t>)[^<]*(<\/hp:t>)/, '$1' + xesc(CO.EMAIL) + '$2');
        // 공개 구분은 메일 주소 뒤 같은 줄 오른쪽 끝(글자 수만큼 앞 빈칸을 줄여 줄이 넘치지 않게)
        var dis = letter.disclosure || DEFAULT_DISCLOSURE;
        sec = sec.replace(/<hp:t>\s+(공개|부분공개|비공개)<\/hp:t>/, '<hp:t>' + '       '.slice(0, Math.max(1, 9 - dis.length * 2 + 1)) + xesc(dis) + '</hp:t>');

        // ── 패키지: mimetype 첫 항목·무압축 ──
        var out = new JSZip(), names = [];
        zip.forEach(function (p, f) { if (!f.dir) names.push(p); });
        out.file('mimetype', mimetype, { compression: 'STORE' });
        var jobs = names.filter(function (p) { return p !== 'mimetype'; }).map(function (p) {
          if (p === 'Contents/section0.xml') { out.file(p, sec); return null; }
          if (p === 'Contents/header.xml') { out.file(p, hdr); return null; }
          if (p === 'Preview/PrvText.txt') { out.file(p, (letter.title || '') + '\r\n'); return null; }
          if (p === 'Contents/content.hpf') {
            return zip.file(p).async('string').then(function (s) {
              out.file(p, s.replace(/<opf:title>[^<]*<\/opf:title>/, '<opf:title>' + xesc(letter.title || '공문') + '</opf:title>'));
            });
          }
          if (p === 'BinData/image2.png' && o.seal) { out.file(p, o.seal); return null; }
          return zip.file(p).async('uint8array').then(function (b) { out.file(p, b); });
        });
        return Promise.all(jobs).then(function () {
          var node = typeof Blob === 'undefined' || o.type === 'uint8array';
          return out.generateAsync({ type: node ? 'uint8array' : 'blob', mimeType: 'application/hwp+zip', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        });
      });
    });
  }
  // 직인 그림: 가로 7800(≈27.5mm, 실제 발송본과 같은 크기), 세로는 비율대로, 가운데 자리 유지
  function sealPic(pic, sz, tight) {
    var W = 7800, H = Math.round(W * sz.h / sz.w);
    var oldCx = 35038 + 9921 / 2, oldCy = 1273 + 9921 / 2;
    var ow = sz.w * 75, oh = sz.h * 75;   // 원본 크기(HWPUNIT, 96dpi 기준)
    return pic
      .replace(/<hp:offset x="\d+" y="\d+"\/>/, '<hp:offset x="0" y="0"/>')
      .replace(/<hp:orgSz width="\d+" height="\d+"\/>/, '<hp:orgSz width="' + ow + '" height="' + oh + '"/>')
      .replace(/<hp:curSz width="\d+" height="\d+"\/>/, '<hp:curSz width="' + W + '" height="' + H + '"/>')
      .replace(/<hp:rotationInfo angle="0" centerX="\d+" centerY="\d+"/, '<hp:rotationInfo angle="0" centerX="' + Math.round(W / 2) + '" centerY="' + Math.round(H / 2) + '"')
      .replace(/<hc:transMatrix [^>]*\/>/, '<hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>')
      .replace(/<hc:scaMatrix [^>]*\/>/, '<hc:scaMatrix e1="' + (W / ow).toFixed(6) + '" e2="0" e3="0" e4="0" e5="' + (H / oh).toFixed(6) + '" e6="0"/>')
      .replace(/<hp:imgRect>[\s\S]*?<\/hp:imgRect>/, '<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="' + ow + '" y="0"/><hc:pt2 x="' + ow + '" y="' + oh + '"/><hc:pt3 x="0" y="' + oh + '"/></hp:imgRect>')
      .replace(/<hp:imgClip [^>]*\/>/, '<hp:imgClip left="0" right="' + ow + '" top="0" bottom="' + oh + '"/>')
      .replace(/<hp:imgDim [^>]*\/>/, '<hp:imgDim dimwidth="' + ow + '" dimheight="' + oh + '"/>')
      .replace(/<hp:sz width="\d+" widthRelTo="ABSOLUTE" height="\d+"/, '<hp:sz width="' + W + '" widthRelTo="ABSOLUTE" height="' + H + '"')
      .replace(/vertOffset="\d+" horzOffset="\d+"/, 'vertOffset="' + (tight ? 0 : Math.max(0, Math.round(oldCy - H / 2))) + '" horzOffset="' + Math.round(oldCx - W / 2) + '"');
  }
  // 서식 붙임 표(4칸 × 4줄)를 필요한 줄 수의 3칸 표로 다시 만든다(첫 줄 모양 복제)
  function attachTable(pXml, lines) {
    var head = /^[\s\S]*?<hp:tr>/.exec(pXml)[0].replace(/<hp:tr>$/, '');
    var tail = /<\/hp:tbl>[\s\S]*$/.exec(pXml)[0];
    var trs = pXml.match(/<hp:tr>[\s\S]*?<\/hp:tr>/g);
    var tcs = trs[0].match(/<hp:tc [\s\S]*?<\/hp:tc>/g);   // 붙임 | 1. | 이름 | 1부.
    var single = lines.length === 1;
    var wHead = 4151, wNo = 2435, wName = 34000, rowH = 2331;
    function cell(src, c, r, w, text, span) {
      var x = src.replace(/<hp:run charPrIDRef="(\d+)"><hp:t>[^<]*<\/hp:t><\/hp:run>(<hp:run charPrIDRef="\d+"\/>)?/, '<hp:run charPrIDRef="$1"/>');
      x = x.replace(/<hp:run charPrIDRef="(\d+)"\/>/, '<hp:run charPrIDRef="$1"><hp:t>' + xesc(text) + '</hp:t></hp:run>');
      x = x.replace(/<hp:cellAddr colAddr="\d+" rowAddr="\d+"\/>/, '<hp:cellAddr colAddr="' + c + '" rowAddr="' + r + '"/>');
      x = x.replace(/<hp:cellSpan colSpan="\d+" rowSpan="\d+"\/>/, '<hp:cellSpan colSpan="' + (span || 1) + '" rowSpan="1"/>');
      x = x.replace(/<hp:cellSz width="\d+" height="\d+"\/>/, '<hp:cellSz width="' + w + '" height="' + rowH + '"/>');
      return x;
    }
    var rows = lines.map(function (l, r) {
      var c0 = cell(tcs[0], 0, r, wHead, l.head);
      if (single) return '<hp:tr>' + c0 + cell(tcs[2], 1, r, wNo + wName, l.text, 2) + '</hp:tr>';
      return '<hp:tr>' + c0 + cell(tcs[1], 1, r, wNo, l.no) + cell(tcs[2], 2, r, wName, l.text) + '</hp:tr>';
    }).join('');
    var total = wHead + wNo + wName;
    head = head.replace(/rowCnt="\d+" colCnt="\d+"/, 'rowCnt="' + lines.length + '" colCnt="3"')
      .replace(/<hp:sz width="\d+" widthRelTo="ABSOLUTE" height="\d+"/, '<hp:sz width="' + total + '" widthRelTo="ABSOLUTE" height="' + (rowH * lines.length) + '"');
    return head + rows + tail;
  }

  /* ================= 대장 엑셀(기존 대장 열 그대로) ================= */
  // rows: official_letters 행 → [[접수번호, 접수년월일, 수신처, 제목, 작성자, 비고]]
  function ledgerNo(r) {
    if (r.seq != null) return r.seq;
    var m = /-(\d+)$/.exec(String(r.doc_no || ''));
    return m ? Number(m[1]) : '';
  }
  function ledgerAoa(rows) {
    var aoa = [['공 문 발 송 대 장', '', '', '', '', ''], ['접수번호', '접수년월일', '수신처', '제목', '작성자', '비고']];
    rows.forEach(function (r) {
      var note = r.note || '';
      if (r.status === 'canceled') note = '(취소' + (r.cancel_reason ? ': ' + r.cancel_reason : '') + ')' + (note ? ' ' + note : '');
      aoa.push([ledgerNo(r), ledgerDate(r.issued_date), r.recipient || '', r.title || '', r.author_name || '', note]);
    });
    return aoa;
  }

  var API = {
    CO: CO, DISCLOSURE: DISCLOSURE, DEFAULT_DISCLOSURE: DEFAULT_DISCLOSURE, ARAE: ARAE, G: G,
    todayIso: todayIso, docNo: docNo, fmtDate: fmtDate, ledgerDate: ledgerDate, fileName: fileName,
    guessHonorific: guessHonorific, greeting: greeting, labelFor: labelFor, composeParas: composeParas, attachLines: attachLines,
    makeMeasure: makeMeasure, wrap: wrap, layout: layout, pageSvg: pageSvg, buildPdf: buildPdf, buildHwpx: buildHwpx,
    pngSize: pngSize, ledgerNo: ledgerNo, ledgerAoa: ledgerAoa
  };
  root.LetterDoc = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
