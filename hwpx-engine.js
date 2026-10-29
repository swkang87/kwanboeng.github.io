/*
 * hwpx-engine.js — HWPX 서식 채우기 엔진 (화이트라벨 공용, 회사 고유값 없음)
 *
 * 한글 서식(HWPX = ZIP + XML)에 넣어 둔 표시를 데이터로 바꿔 새 HWPX 를 만든다. 서버·한글 설치가 필요 없다.
 *   {{토큰}}                값 치환 (XML 특수문자는 자동 이스케이프). 값이 바뀐 문단은 줄 배치 정보(linesegarray)를 지워
 *                           한글이 열 때 다시 계산하게 한다.
 *   {{#행:이름}}            표의 데이터 행 1줄(이 표시가 든 행)을 데이터 수만큼 복제. rowAddr·rowCnt·표 높이 갱신,
 *                           정의의 mergeCol(열 번호)·mergeBy(값 이름)가 있으면 같은 값이 이어지는 칸을 rowSpan 으로 병합.
 *   {{#블록:이름}} … {{/블록:이름}}   이 표시만 든 문단 사이를 데이터 수만큼 복제(두 번째부터 쪽 나누기). 표시 문단은 지운다.
 *                           0개면 블록을 통째로 지운다. 표시 문단에 구역 속성(secPr)이 있으면 다음 문단으로 옮긴다.
 *   {{도장:키}} / {{도장:키@자리}}    그 문단에 글 앞으로(IN_FRONT_OF_TEXT) 그림. 크기·위치는 정의 pictures[토큰] (없으면 '도장:키').
 *   {{이미지:키}}          글자처럼 취급하는 그림. 정의 pictures 의 상자(boxW×boxH) 안에 비율 유지.
 *   그림 토큰의 값 = images 에 등록한 그림 id. 값이 없으면 토큰만 지우고 warnings 에 남긴다.
 *
 * 사용 (브라우저: JSZip 을 먼저 불러온다)
 *   HwpxEngine.open(arrayBuffer).then(function (doc) {
 *     var res = HwpxEngine.fill(doc, def, data);      // res.warnings, res.leftovers(남은 {{ }})
 *     return HwpxEngine.save(doc);                     // Blob (Node 에서는 Uint8Array)
 *   });
 *   data = { title, vars:{토큰:값}, rows:{이름:[{토큰:값}]}, blocks:{이름:[{토큰:값}]}, images:{id:{bytes:Uint8Array, ext:'png'}} }
 *   def  = { rows:{이름:{mergeCol, mergeBy}}, pictures:{토큰:{…}} } — 서류 정의(doc-defs.js)
 */
(function (root) {
  'use strict';

  var HWPUNIT_PER_PX = 75;          // 96 dpi 기준 (7200 HWPUNIT = 1 inch)
  var TOKEN_RE = /\{\{([^{}]+)\}\}/g;

  /* ================= XML: 원문 보존형 최소 파서 ================= */
  // 노드: {t:'el', n:이름, a:[[속성, 원문값]], c:[자식], sc:빈요소였는지} / {t:'text', v:원문} / {t:'raw', v:원문(<?…?>, 주석, CDATA)}
  function parseXml(src) {
    var rootNode = { t: 'doc', c: [] };
    var stack = [rootNode];
    var i = 0, n = src.length;
    while (i < n) {
      var lt = src.indexOf('<', i);
      if (lt < 0) { stack[stack.length - 1].c.push({ t: 'text', v: src.slice(i) }); break; }
      if (lt > i) stack[stack.length - 1].c.push({ t: 'text', v: src.slice(i, lt) });
      var end;
      if (src.substr(lt, 2) === '<?') { end = src.indexOf('?>', lt) + 2; stack[stack.length - 1].c.push({ t: 'raw', v: src.slice(lt, end) }); i = end; continue; }
      if (src.substr(lt, 4) === '<!--') { end = src.indexOf('-->', lt) + 3; stack[stack.length - 1].c.push({ t: 'raw', v: src.slice(lt, end) }); i = end; continue; }
      if (src.substr(lt, 9) === '<![CDATA[') { end = src.indexOf(']]>', lt) + 3; stack[stack.length - 1].c.push({ t: 'raw', v: src.slice(lt, end) }); i = end; continue; }
      if (src.charAt(lt + 1) === '/') {
        end = src.indexOf('>', lt);
        var cname = src.slice(lt + 2, end).replace(/\s+$/, '');
        var top = stack.pop();
        if (!top || top.n !== cname) throw new Error('XML 구조 오류: </' + cname + '>');
        i = end + 1; continue;
      }
      // 여는 태그 (따옴표 안의 > 는 건너뜀)
      var j = lt + 1, q = '';
      while (j < n) {
        var ch = src.charAt(j);
        if (q) { if (ch === q) q = ''; }
        else if (ch === '"' || ch === "'") q = ch;
        else if (ch === '>') break;
        j++;
      }
      var inner = src.slice(lt + 1, j);
      var selfClose = /\/\s*$/.test(inner);
      if (selfClose) inner = inner.replace(/\/\s*$/, '');
      var m = /^([^\s]+)/.exec(inner);
      var el = { t: 'el', n: m[1], a: [], c: [], sc: selfClose };
      var re = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, am;
      var rest = inner.slice(m[1].length);
      while ((am = re.exec(rest))) el.a.push([am[1], am[2] !== undefined ? am[2] : am[3].replace(/"/g, '&quot;')]);
      stack[stack.length - 1].c.push(el);
      if (!selfClose) stack.push(el);
      i = j + 1;
    }
    if (stack.length !== 1) throw new Error('XML 구조 오류: 닫히지 않은 요소 ' + stack[stack.length - 1].n);
    return rootNode;
  }

  function serialize(node) {
    var out = [];
    (function w(nd) {
      if (nd.t === 'text' || nd.t === 'raw') { out.push(nd.v); return; }
      if (nd.t === 'doc') { nd.c.forEach(w); return; }
      out.push('<', nd.n);
      for (var k = 0; k < nd.a.length; k++) out.push(' ', nd.a[k][0], '="', nd.a[k][1], '"');
      if (!nd.c.length && nd.sc) { out.push('/>'); return; }
      out.push('>');
      nd.c.forEach(w);
      out.push('</', nd.n, '>');
    })(node);
    return out.join('');
  }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function unesc(s) {
    return String(s).replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, function (all, e) {
      if (e === 'lt') return '<'; if (e === 'gt') return '>'; if (e === 'amp') return '&';
      if (e === 'quot') return '"'; if (e === 'apos') return "'";
      if (e.charAt(1) === 'x') return String.fromCodePoint(parseInt(e.slice(2), 16));
      return String.fromCodePoint(parseInt(e.slice(1), 10));
    });
  }

  function attr(el, k) { for (var i = 0; i < el.a.length; i++) if (el.a[i][0] === k) return unesc(el.a[i][1]); return null; }
  function setAttr(el, k, v) {
    for (var i = 0; i < el.a.length; i++) if (el.a[i][0] === k) { el.a[i][1] = esc(v); return; }
    el.a.push([k, esc(v)]);
  }
  function kids(el, name) { return el.c.filter(function (x) { return x.t === 'el' && (!name || x.n === name); }); }
  function kid(el, name) { for (var i = 0; i < el.c.length; i++) if (el.c[i].t === 'el' && el.c[i].n === name) return el.c[i]; return null; }
  function findAll(node, name, out) {
    out = out || [];
    (node.c || []).forEach(function (x) { if (x.t !== 'el') return; if (x.n === name) out.push(x); findAll(x, name, out); });
    return out;
  }
  function clone(nd) {
    if (nd.t !== 'el') { var o = { t: nd.t, v: nd.v }; return o; }
    var c = { t: 'el', n: nd.n, a: nd.a.map(function (p) { return [p[0], p[1]]; }), c: nd.c.map(clone), sc: nd.sc };
    if (nd._scope) c._scope = nd._scope;
    return c;
  }
  function el(name, attrs, children) {
    var a = [];
    Object.keys(attrs || {}).forEach(function (k) { a.push([k, esc(attrs[k])]); });
    return { t: 'el', n: name, a: a, c: children || [], sc: !(children && children.length) };
  }
  // 한 요소 안의 글자(hp:t) 전체
  function textOf(node) {
    var s = '';
    (function w(nd) {
      if (nd.t !== 'el') return;
      if (nd.n === 'hp:t') { nd.c.forEach(function (x) { if (x.t === 'text') s += unesc(x.v); }); return; }
      nd.c.forEach(w);
    })(node);
    return s;
  }

  /* ================= 그림 크기 (PNG·JPEG 머리 읽기) ================= */
  function imageSize(bytes) {
    var b = bytes;
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) {
      return { w: ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0, h: ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0, ext: 'png', mime: 'image/png' };
    }
    if (b[0] === 0xFF && b[1] === 0xD8) {
      var i = 2;
      while (i < b.length) {
        if (b[i] !== 0xFF) { i++; continue; }
        var mk = b[i + 1];
        if (mk >= 0xC0 && mk <= 0xCF && mk !== 0xC4 && mk !== 0xC8 && mk !== 0xCC) {
          return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8], ext: 'jpg', mime: 'image/jpeg' };
        }
        i += 2 + ((b[i + 2] << 8) | b[i + 3]);
      }
    }
    return null;
  }

  function u32(v) { v = Math.round(v); return v < 0 ? v + 4294967296 : v; }

  /* ================= 문서 열기 ================= */
  function getZipLib() {
    if (root.JSZip) return root.JSZip;
    throw new Error('JSZip 을 불러오지 못했습니다.');
  }

  function open(data) {
    var JSZip = getZipLib();
    return JSZip.loadAsync(data).then(function (zip) {
      var doc = { zip: zip, files: {}, order: [] };
      zip.forEach(function (path, f) { if (!f.dir) doc.order.push(path); });
      var hpf = zip.file('Contents/content.hpf');
      if (!hpf) throw new Error('HWPX 파일이 아닙니다(Contents/content.hpf 없음).');
      var jobs = doc.order.filter(function (p) { return /\.(xml|hpf)$/i.test(p); }).map(function (p) {
        return zip.file(p).async('string').then(function (s) { doc.files[p] = s; });
      });
      return Promise.all(jobs).then(function () {
        doc.hpf = parseXml(doc.files['Contents/content.hpf']);
        doc.sections = [];
        findAll(doc.hpf, 'opf:item').forEach(function (it) {
          var href = attr(it, 'href') || '';
          if (/^Contents\/section\d+\.xml$/.test(href)) doc.sections.push({ path: href, tree: parseXml(doc.files[href]) });
        });
        doc.bin = {};   // 새로 넣을 그림: 경로 → bytes
        return doc;
      });
    });
  }

  /* ================= 채우기 ================= */
  function fill(doc, def, data) {
    def = def || {}; data = data || {};
    var ctx = {
      def: def, data: data, doc: doc, warnings: [],
      globalScope: data.vars || {},
      imageIds: {},          // 데이터 그림 id → manifest id
      nextObjId: 0, nextZ: 0, nextBin: 1
    };
    initIds(ctx);
    doc.sections.forEach(function (sec) {
      var secEl = kids(sec.tree).filter(function (x) { return x.n === 'hs:sec'; })[0];
      if (!secEl) return;
      expandBlocks(ctx, secEl);
      expandRows(ctx, secEl);
      shrinkSpacers(ctx, secEl);
      replaceTokens(ctx, secEl);
    });
    if (data.title) setTitle(doc, data.title);
    var leftovers = [];
    doc.sections.forEach(function (sec) {
      var s = textOfAll(sec.tree);
      var m; TOKEN_RE.lastIndex = 0;
      while ((m = TOKEN_RE.exec(s))) if (leftovers.indexOf(m[0]) < 0) leftovers.push(m[0]);
    });
    return { warnings: ctx.warnings, leftovers: leftovers };
  }

  function textOfAll(tree) {
    var s = '';
    (function w(nd) { if (nd.t === 'text') s += unesc(nd.v) + '\n'; else if (nd.c) nd.c.forEach(w); })(tree);
    return s;
  }

  function initIds(ctx) {
    var maxId = 0, maxZ = 0;
    ctx.doc.sections.forEach(function (sec) {
      (function w(nd) {
        if (nd.t !== 'el') return;
        if (nd.n !== 'hp:p') {
          var v = parseInt(attr(nd, 'id'), 10); if (v > maxId && v < 2147483000) maxId = v;
          v = parseInt(attr(nd, 'instid'), 10); if (v > maxId && v < 2147483000) maxId = v;
        }
        var z = parseInt(attr(nd, 'zOrder'), 10); if (z > maxZ) maxZ = z;
        nd.c.forEach(w);
      })(sec.tree);
    });
    ctx.nextObjId = maxId + 1;
    ctx.nextZ = maxZ + 1;
    var maxBin = 0;
    findAll(ctx.doc.hpf, 'opf:item').forEach(function (it) {
      var m = /^BinData\/[A-Za-z]*?(\d+)\./.exec(attr(it, 'href') || '');
      if (m && +m[1] > maxBin) maxBin = +m[1];
    });
    ctx.nextBin = maxBin + 1;
  }
  function newId(ctx) { return String(ctx.nextObjId++); }

  // 복제본 안의 개체 id 를 새로 매긴다 (같은 id 가 두 번 나오지 않게). 필드 시작·끝은 같은 짝으로 맞춘다.
  function renumber(ctx, node) {
    var fieldMap = {};
    (function w(nd) {
      if (nd.t !== 'el') return;
      if (nd.n !== 'hp:p' && nd.n !== 'hp:subList') {
        var id = attr(nd, 'id');
        if (id && /^\d+$/.test(id) && id !== '0') {
          var nid = newId(ctx);
          if (nd.n === 'hp:fieldBegin') fieldMap[id] = nid;
          setAttr(nd, 'id', nid);
        }
        if (attr(nd, 'instid')) setAttr(nd, 'instid', newId(ctx));
        if (attr(nd, 'zOrder') !== null && nd.n !== 'hp:p') setAttr(nd, 'zOrder', String(ctx.nextZ++));
      }
      nd.c.forEach(w);
    })(node);
    (function w2(nd) {
      if (nd.t !== 'el') return;
      if (nd.n === 'hp:fieldEnd') { var b = attr(nd, 'beginIDRef'); if (b && fieldMap[b]) setAttr(nd, 'beginIDRef', fieldMap[b]); }
      nd.c.forEach(w2);
    })(node);
  }

  /* ---- 반복 블록 (구역 바로 아래 문단만) ---- */
  function markerOf(p) {
    var t = textOf(p).replace(/^\s+|\s+$/g, '');
    var m = /^\{\{([#\/])블록:([^{}]+)\}\}$/.exec(t);
    return m ? { kind: m[1], name: m[2] } : null;
  }
  function takeSecRun(p) {
    // 표시 문단의 구역 속성(secPr)·단 정의(colPr) 실행 단위를 떼어 돌려준다
    var out = [];
    p.c = p.c.filter(function (x) {
      if (x.t === 'el' && x.n === 'hp:run' && (kid(x, 'hp:secPr') || hasColPr(x))) {
        x.c = x.c.filter(function (y) { return !(y.t === 'el' && y.n === 'hp:t'); });
        out.push(x); return false;
      }
      return true;
    });
    return out;
  }
  function hasColPr(run) { return run.c.some(function (y) { return y.t === 'el' && y.n === 'hp:ctrl' && kid(y, 'hp:colPr'); }); }

  function expandBlocks(ctx, secEl) {
    var src = secEl.c, out = [], carry = [];
    var i = 0;
    function pushPara(p) {
      if (carry.length && p.t === 'el' && p.n === 'hp:p') { p.c = carry.concat(p.c); carry = []; }
      out.push(p);
    }
    while (i < src.length) {
      var nd = src[i];
      var mk = (nd.t === 'el' && nd.n === 'hp:p') ? markerOf(nd) : null;
      if (!mk) { pushPara(nd); i++; continue; }
      if (mk.kind === '/') { ctx.warnings.push('블록 끝 표시만 있습니다: ' + mk.name); carry = carry.concat(takeSecRun(nd)); i++; continue; }
      // 끝 표시 찾기
      var j = i + 1;
      while (j < src.length && !(src[j].t === 'el' && src[j].n === 'hp:p' && (function (m) { return m && m.kind === '/' && m.name === mk.name; })(markerOf(src[j])))) j++;
      if (j >= src.length) throw new Error('블록 끝 표시가 없습니다: {{/블록:' + mk.name + '}}');
      carry = carry.concat(takeSecRun(nd)).concat(takeSecRun(src[j]));
      var body = src.slice(i + 1, j);
      var items = (ctx.data.blocks && ctx.data.blocks[mk.name]) || [];
      items.forEach(function (item, k) {
        var paras = body.map(clone);
        if (k > 0) {
          paras.forEach(function (p) { renumber(ctx, p); });
          var first = paras.filter(function (p) { return p.t === 'el' && p.n === 'hp:p'; })[0];
          if (first) { setAttr(first, 'pageBreak', '1'); dropLineseg(first); }
        }
        paras.forEach(function (p) { if (p.t === 'el') p._scope = item; pushPara(p); });
      });
      i = j + 1;
    }
    if (carry.length) {
      // 블록 뒤에 문단이 없으면 빈 문단에 실어 둔다
      out.push({ t: 'el', n: 'hp:p', a: [['id', '0'], ['paraPrIDRef', '0'], ['styleIDRef', '0'], ['pageBreak', '0'], ['columnBreak', '0'], ['merged', '0']], c: carry, sc: false });
    }
    secEl.c = out;
    // 첫 문단의 쪽 나누기는 의미가 없으므로 끈다(블록이 0개여서 뒤 문단이 첫 문단이 된 경우)
    var firstP = out.filter(function (x) { return x.t === 'el' && x.n === 'hp:p'; })[0];
    if (firstP && attr(firstP, 'pageBreak') === '1') setAttr(firstP, 'pageBreak', '0');
  }

  /* ---- 반복 표 행 ---- */
  function rowMarker(tr) {
    var m = /\{\{#행:([^{}]+)\}\}/.exec(textOf(tr));
    return m ? m[1] : null;
  }
  function cellAddr(tc) { return kid(tc, 'hp:cellAddr'); }
  function cellSpan(tc) { return kid(tc, 'hp:cellSpan'); }
  function cellSz(tc) { return kid(tc, 'hp:cellSz'); }

  function expandRows(ctx, secEl) {
    // 바깥 문단의 범위(scope)를 표까지 내려보내며 처리
    (function w(nd, scope) {
      if (nd.t !== 'el') return;
      if (nd._scope) scope = nd._scope;
      if (nd.n === 'hp:tbl') expandTable(ctx, nd, scope);
      nd.c.forEach(function (x) { w(x, scope); });
    })(secEl, null);
  }

  function expandTable(ctx, tbl, scope) {
    var trs = kids(tbl, 'hp:tr');
    for (var ri = 0; ri < trs.length; ri++) {
      var name = rowMarker(trs[ri]);
      if (!name) continue;
      var items = (scope && scope.__rows && scope.__rows[name]) || (ctx.data.rows && ctx.data.rows[name]) || [];
      var rdef = (ctx.def.rows && ctx.def.rows[name]) || {};
      var tpl = trs[ri];
      var baseRow = +attr(cellAddr(kids(tpl, 'hp:tc')[0]), 'rowAddr');
      var rowH = 0;
      kids(tpl, 'hp:tc').forEach(function (tc) { if (attr(cellSpan(tc), 'rowSpan') === '1') rowH = Math.max(rowH, +attr(cellSz(tc), 'height')); });
      var clones = items.map(function (item, k) {
        var tr = clone(tpl);
        tr._scope = item;
        kids(tr, 'hp:tc').forEach(function (tc) { setAttr(cellAddr(tc), 'rowAddr', String(baseRow + k)); });
        return tr;
      });
      // 같은 값이 이어지면 병합
      if (rdef.mergeCol !== undefined && rdef.mergeBy) {
        var k0 = 0;
        while (k0 < clones.length) {
          var v = items[k0][rdef.mergeBy], k1 = k0 + 1;
          while (k1 < clones.length && v && items[k1][rdef.mergeBy] === v) k1++;
          if (k1 - k0 > 1) {
            var head = cellAtCol(clones[k0], rdef.mergeCol);
            if (head) {
              setAttr(cellSpan(head), 'rowSpan', String(k1 - k0));
              setAttr(cellSz(head), 'height', String(+attr(cellSz(head), 'height') * (k1 - k0)));
              for (var kk = k0 + 1; kk < k1; kk++) {
                var c2 = cellAtCol(clones[kk], rdef.mergeCol);
                clones[kk].c = clones[kk].c.filter(function (x) { return x !== c2; });
              }
            }
          }
          k0 = k1;
        }
      }
      var delta = clones.length - 1;
      // 아래 행 번호 밀기
      for (var rj = ri + 1; rj < trs.length; rj++) {
        kids(trs[rj], 'hp:tc').forEach(function (tc) { var ca = cellAddr(tc); setAttr(ca, 'rowAddr', String(+attr(ca, 'rowAddr') + delta)); });
      }
      var pos = tbl.c.indexOf(tpl);
      Array.prototype.splice.apply(tbl.c, [pos, 1].concat(clones));
      setAttr(tbl, 'rowCnt', String(+attr(tbl, 'rowCnt') + delta));
      var sz = kid(tbl, 'hp:sz');
      if (sz) setAttr(sz, 'height', String(Math.max(0, +attr(sz, 'height') + delta * rowH)));
      tbl._dirty = true;
      if (rdef.fit && clones.length > rdef.fit) tbl._extra = (tbl._extra || 0) + (clones.length - rdef.fit) * rowH;
      trs = kids(tbl, 'hp:tr');
      ri += delta;
    }
  }
  // 표가 서식 설계(fit 행)보다 길어지면, 그 표가 든 문단부터 다음 쪽 나누기 전까지의 빈 문단을 늘어난 높이만큼 지운다
  // (원본 서식 쪽이 거의 꽉 차 있어 서명란이 다음 쪽으로 넘어가지 않게). 빈 문단이 모자라면 넘어간다.
  var DEFAULT_LINE_H = 2340;
  function isEmptyPara(p) {
    if (attr(p, 'pageBreak') === '1') return false;
    if (/\S/.test(textOf(p))) return false;
    var hasObj = false;
    (function w(nd) { if (nd.t !== 'el' || hasObj) return; if (/^hp:(tbl|pic|ctrl|secPr|rect|container|equation|ole)$/.test(nd.n)) { hasObj = true; return; } nd.c.forEach(w); })(p);
    return !hasObj;
  }
  function lineHeight(p) {
    var la = kid(p, 'hp:linesegarray'), ls = la && kid(la, 'hp:lineseg');
    if (!ls) return DEFAULT_LINE_H;
    return (+attr(ls, 'vertsize') || 0) + (+attr(ls, 'spacing') || 0) || DEFAULT_LINE_H;
  }
  function shrinkSpacers(ctx, secEl) {
    var paras = secEl.c;
    var drop = [];
    for (var i = 0; i < paras.length; i++) {
      var p = paras[i];
      if (p.t !== 'el' || p.n !== 'hp:p') continue;
      var extra = 0;
      findAll(p, 'hp:tbl').forEach(function (t) { extra += t._extra || 0; });
      if (extra <= 0) continue;
      for (var j = i + 1; j < paras.length && extra > 0; j++) {
        var q = paras[j];
        if (q.t !== 'el' || q.n !== 'hp:p') continue;
        if (attr(q, 'pageBreak') === '1') break;
        if (drop.indexOf(q) < 0 && isEmptyPara(q)) { drop.push(q); extra -= lineHeight(q); }
      }
      if (extra > 0) ctx.warnings.push('표가 길어 일부 쪽이 다음 쪽으로 넘어갈 수 있어요. 한글에서 확인하세요.');
    }
    if (drop.length) secEl.c = paras.filter(function (x) { return drop.indexOf(x) < 0; });
  }

  function cellAtCol(tr, col) {
    var tcs = kids(tr, 'hp:tc');
    for (var i = 0; i < tcs.length; i++) if (+attr(cellAddr(tcs[i]), 'colAddr') === +col) return tcs[i];
    return null;
  }

  /* ---- 토큰 치환 ---- */
  function lookup(scopes, key) {
    for (var i = scopes.length - 1; i >= 0; i--) {
      var s = scopes[i];
      if (s && Object.prototype.hasOwnProperty.call(s, key)) return s[key];
    }
    return undefined;
  }
  function dropLineseg(p) { p.c = p.c.filter(function (x) { return !(x.t === 'el' && x.n === 'hp:linesegarray'); }); }

  function replaceTokens(ctx, secEl) {
    var scopes = [ctx.globalScope];
    var paraStack = [];
    function markDirty() { paraStack.forEach(function (p) { p._dirty = true; }); }
    (function w(nd, parent) {
      if (nd.t !== 'el') return;
      var pushedScope = false;
      if (nd._scope) { scopes.push(nd._scope); pushedScope = true; }
      if (nd.n === 'hp:p') paraStack.push(nd);
      if (nd._dirty) markDirty();
      if (nd.n === 'hp:run') {
        processRun(ctx, nd, scopes, markDirty);
      } else if (nd.n !== 'hp:t') {
        // 글자가 아닌 곳(필드 매개변수 등)의 토큰도 바꾼다
        nd.c.forEach(function (x) {
          if (x.t === 'text' && x.v.indexOf('{{') >= 0) {
            var nv = esc(replaceText(ctx, unesc(x.v), scopes, null));
            if (nv !== x.v) { x.v = nv; markDirty(); }
          }
        });
      }
      nd.c.forEach(function (x) { w(x, nd); });
      if (nd.n === 'hp:p') {
        paraStack.pop();
        if (nd._dirty) dropLineseg(nd);
      }
      if (pushedScope) scopes.pop();
    })(secEl, null);
  }

  function processRun(ctx, run, scopes, markDirty) {
    var newKids = [];
    run.c.forEach(function (x) {
      if (!(x.t === 'el' && x.n === 'hp:t')) { newKids.push(x); return; }
      var pics = [];
      var changed = false;
      x.c.forEach(function (tn) {
        if (tn.t !== 'text' || tn.v.indexOf('{{') < 0) return;
        var nv = replaceText(ctx, unesc(tn.v), scopes, pics);
        tn.v = esc(nv); changed = true;
      });
      if (changed) markDirty();
      pics.forEach(function (p) { newKids.push(p); });
      newKids.push(x);
    });
    run.c = newKids;
  }

  function replaceText(ctx, s, scopes, pics) {
    return s.replace(TOKEN_RE, function (all, key) {
      if (/^[#\/]/.test(key)) return '';                         // 행 표시 등
      var m = /^(도장|이미지):(.+)$/.exec(key);
      if (m) {
        var base = m[1] + ':' + m[2].split('@')[0];
        var imgId = lookup(scopes, base);
        if (!pics) return '';
        if (!imgId) { ctx.warnings.push('그림 없음: ' + base); return ''; }
        var pic = makePic(ctx, key, m[1], imgId);
        if (pic) pics.push(pic);
        return '';
      }
      var v = lookup(scopes, key);
      if (v === undefined || v === null) return all;               // 남은 토큰 → 경고
      return String(v);
    });
  }

  /* ---- 그림 ---- */
  function registerImage(ctx, imgId) {
    if (ctx.imageIds[imgId]) return ctx.imageIds[imgId];
    var img = ctx.data.images && ctx.data.images[imgId];
    if (!img || !img.bytes) { ctx.warnings.push('그림 데이터 없음: ' + imgId); return null; }
    var info = imageSize(img.bytes);
    if (!info) { ctx.warnings.push('PNG·JPG 그림만 넣을 수 있습니다: ' + imgId); return null; }
    var n = ctx.nextBin++;
    var itemId = 'image' + n;
    var href = 'BinData/' + itemId + '.' + info.ext;
    ctx.doc.bin[href] = img.bytes;
    var manifest = findAll(ctx.doc.hpf, 'opf:manifest')[0];
    var items = kids(manifest, 'opf:item');
    var lastImg = null;
    items.forEach(function (it) { if (/^BinData\//.test(attr(it, 'href') || '')) lastImg = it; });
    var neu = el('opf:item', { id: itemId, href: href, 'media-type': info.mime, isEmbeded: '1' });
    var at = lastImg ? manifest.c.indexOf(lastImg) + 1 : 0;
    manifest.c.splice(at, 0, neu);
    ctx.imageIds[imgId] = { id: itemId, w: info.w, h: info.h };
    return ctx.imageIds[imgId];
  }

  function makePic(ctx, token, kind, imgId) {
    var pdef = (ctx.def.pictures && (ctx.def.pictures[token] || ctx.def.pictures[token.split('@')[0]])) || null;
    if (!pdef) { ctx.warnings.push('그림 자리 정의 없음: ' + token); return null; }
    var reg = registerImage(ctx, imgId);
    if (!reg) return null;
    var ow = reg.w * HWPUNIT_PER_PX, oh = reg.h * HWPUNIT_PER_PX;
    var bw = pdef.boxW || pdef.w, bh = pdef.boxH || pdef.h;
    var sc = Math.min(bw / ow, bh / oh);
    var w = Math.round(ow * sc), h = Math.round(oh * sc);
    var inline = kind === '이미지' || pdef.inline;
    // 상자 가운데 맞춤(글 앞 그림만): 상자 기준 위치 + 남는 폭의 절반. 정렬이 CENTER 면 한글이 가운데에 둔다.
    var ha = pdef.horzAlign || 'LEFT', va = pdef.vertAlign || 'TOP';
    var hx = (pdef.horzOffset || 0) + (inline || ha === 'CENTER' ? 0 : Math.round((bw - w) / 2));
    var vy = (pdef.vertOffset || 0) + (inline || va === 'CENTER' ? 0 : Math.round((bh - h) / 2));
    var id = newId(ctx), inst = newId(ctx);
    var f6 = function (v) { return String(Math.round(v * 1e6) / 1e6); };
    var xml =
      '<hp:pic id="' + id + '" zOrder="' + (ctx.nextZ++) + '" numberingType="PICTURE" textWrap="' + (inline ? 'TOP_AND_BOTTOM' : 'IN_FRONT_OF_TEXT') + '" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="' + inst + '" reverse="0">' +
      '<hp:offset x="0" y="0"/><hp:orgSz width="' + ow + '" height="' + oh + '"/><hp:curSz width="' + w + '" height="' + h + '"/>' +
      '<hp:flip horizontal="0" vertical="0"/><hp:rotationInfo angle="0" centerX="' + Math.round(w / 2) + '" centerY="' + Math.round(h / 2) + '" rotateimage="1"/>' +
      '<hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="' + f6(w / ow) + '" e2="0" e3="0" e4="0" e5="' + f6(h / oh) + '" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo>' +
      '<hc:img binaryItemIDRef="' + reg.id + '" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>' +
      '<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="' + ow + '" y="0"/><hc:pt2 x="' + ow + '" y="' + oh + '"/><hc:pt3 x="0" y="' + oh + '"/></hp:imgRect>' +
      '<hp:imgClip left="0" right="' + ow + '" top="0" bottom="' + oh + '"/><hp:inMargin left="0" right="0" top="0" bottom="0"/>' +
      '<hp:imgDim dimwidth="' + ow + '" dimheight="' + oh + '"/><hp:effects/>' +
      '<hp:sz width="' + w + '" widthRelTo="ABSOLUTE" height="' + h + '" heightRelTo="ABSOLUTE" protect="0"/>' +
      (inline
        ? '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
        : '<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="' + (pdef.flowWithText === 0 ? 0 : 1) + '" allowOverlap="1" holdAnchorAndSO="0" vertRelTo="' + (pdef.vertRelTo || 'PARA') + '" horzRelTo="' + (pdef.horzRelTo || 'COLUMN') + '" vertAlign="' + va + '" horzAlign="' + ha + '" vertOffset="' + u32(vy) + '" horzOffset="' + u32(hx) + '"/>') +
      '<hp:outMargin left="0" right="0" top="0" bottom="0"/></hp:pic>';
    return parseXml(xml).c[0];
  }

  function setTitle(doc, title) {
    var t = findAll(doc.hpf, 'opf:title')[0];
    if (t) t.c = [{ t: 'text', v: esc(title) }];
  }

  /* ================= 저장 ================= */
  function save(doc, opts) {
    var JSZip = getZipLib();
    var out = new JSZip();
    var nodeEnv = typeof Blob === 'undefined' || (opts && opts.type === 'uint8array');
    doc.sections.forEach(function (sec) { doc.files[sec.path] = serialize(sec.tree); });
    doc.files['Contents/content.hpf'] = serialize(doc.hpf);
    var keep = {};
    findAll(doc.hpf, 'opf:item').forEach(function (it) { keep[attr(it, 'href')] = true; });
    var jobs = [];
    // mimetype 은 첫 항목·무압축
    var mt = doc.zip.file('mimetype');
    var order = ['mimetype'].concat(doc.order.filter(function (p) { return p !== 'mimetype'; }));
    return (mt ? mt.async('string') : Promise.resolve('application/hwp+zip')).then(function (mimetype) {
      out.file('mimetype', mimetype, { compression: 'STORE' });
      order.slice(1).forEach(function (p) {
        if (/^BinData\//.test(p) && !keep[p]) return;              // 서식에서 등록 해제된 그림은 버림
        if (doc.files[p] !== undefined) out.file(p, doc.files[p]);
        else jobs.push(doc.zip.file(p).async('uint8array').then(function (b) { return [p, b]; }));
      });
      return Promise.all(jobs);
    }).then(function (bins) {
      bins.forEach(function (pb) { out.file(pb[0], pb[1]); });
      Object.keys(doc.bin).forEach(function (p) { out.file(p, doc.bin[p]); });
      return out.generateAsync({ type: nodeEnv ? 'uint8array' : 'blob', mimeType: 'application/hwp+zip', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    });
  }

  var API = {
    open: open,
    fill: fill,
    save: save,
    imageSize: imageSize,
    // 서식 만들기 스크립트·검증용
    _xml: { parse: parseXml, serialize: serialize, attr: attr, setAttr: setAttr, kids: kids, kid: kid, findAll: findAll, clone: clone, el: el, textOf: textOf, esc: esc, unesc: unesc }
  };
  root.HwpxEngine = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
