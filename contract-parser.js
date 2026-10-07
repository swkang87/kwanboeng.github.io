/*
 * contract-parser.js — 계약서 PDF 자동 판독기 (화이트라벨 공용)
 *
 * - 회사명·사업자번호 등 회사 고유값을 코드에 두지 않는다. 우리 회사 판별은 opts.bizNo(config.js의 BIZ_NO)로 한다.
 * - 양식별 규칙은 FORMATS 배열에 등록한다. 현재: 나라장터 전자계약서(용역·용역변경).
 * - 브라우저: pdf.js는 처음 판독할 때 cdnjs에서 자동으로 불러온다.
 *     ContractParser.parseFile(file, { bizNo: CONFIG.BIZ_NO }).then(function (r) { ... })
 * - 반환값 r.ok === false 이면 r.error 에 사유가 들어 있다.
 */
(function (root) {
  'use strict';

  var PDFJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  var PDFJS_CMAP_URL = PDFJS_BASE + 'cmaps/';
  var CELL_GAP = 12;   // 이 간격(pt)보다 넓으면 다른 칸
  var WORD_GAP = 1.0;  // 이 간격보다 넓으면 띄어쓰기
  var LINE_TOL = 2;    // 같은 줄로 보는 y 오차
  var WRAP_TOL = 10;   // 줄바꿈된 값이 붙을 라벨과의 y 거리

  /* ---------------- 공통 유틸 ---------------- */
  function compact(s) { return String(s || '').replace(/\s+/g, ''); }
  function digits(s) { return String(s || '').replace(/[^0-9]/g, ''); }
  function trim(s) { return String(s || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, ''); }

  function toDate(s) {
    var m = String(s || '').match(/(\d{4})\s*[\/.\-년]\s*(\d{1,2})\s*[\/.\-월]\s*(\d{1,2})/);
    if (!m) return '';
    return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  }

  function toAmount(s) {
    // "일천육백칠십이만원 ( \ 16,720,000)" → 16720000, "0원" → 0
    var all = String(s || '').match(/\d[\d,]*/g);
    if (!all || !all.length) return null;
    var n = parseInt(all[all.length - 1].replace(/,/g, ''), 10);
    return isNaN(n) ? null : n;
  }

  function toFirstAmount(s) {
    // "0원 (수정전: 173,913,000 원)" → 0, "-1,000,000원" → -1000000
    var m = String(s || '').match(/(-?)\s*(\d[\d,]*)/);
    if (!m) return null;
    var n = parseInt(m[2].replace(/,/g, ''), 10);
    return isNaN(n) ? null : (m[1] ? -n : n);
  }

  function toPercent(s) {
    var m = String(s || '').match(/(\d+(?:\.\d+)?)\s*%/);
    return m ? parseFloat(m[1]) : null;
  }

  /* ---------------- 1단계: PDF → 줄/칸 ---------------- */
  function itemsToLines(pages) {
    // pages: [{ page, items:[{x,y,w,s}] }]
    var lines = [];
    pages.forEach(function (pg) {
      var its = pg.items.filter(function (i) { return trim(i.s) !== ''; });
      its.sort(function (a, b) { return (b.y - a.y) || (a.x - b.x); });
      var pl = [];
      its.forEach(function (it) {
        var L = null;
        for (var k = 0; k < pl.length; k++) { if (Math.abs(pl[k].y - it.y) < LINE_TOL) { L = pl[k]; break; } }
        if (!L) { L = { page: pg.page, y: it.y, items: [] }; pl.push(L); }
        L.items.push(it);
      });
      pl.sort(function (a, b) { return b.y - a.y; });
      pl.forEach(function (L) {
        L.items.sort(function (a, b) { return a.x - b.x; });
        var cells = [], cur = null, prev = null;
        L.items.forEach(function (c) {
          var gap = prev ? c.x - (prev.x + prev.w) : 0;
          if (!cur || gap > CELL_GAP) { cur = { x: c.x, text: '' }; cells.push(cur); }
          else if (gap > WORD_GAP) { cur.text += ' '; }
          cur.text += c.s;
          prev = c;
        });
        cells.forEach(function (c) { c.text = trim(c.text); });
        lines.push({ page: L.page, y: L.y, x: cells.length ? cells[0].x : 0, cells: cells,
          text: cells.map(function (c) { return c.text; }).join(' ') });
      });
    });
    return lines;
  }

  // pdf.js는 계약서를 처음 읽을 때만 불러온다 (공정관리 화면 일반 사용자에게는 받지 않게)
  var pdfjsPromise = null;
  function loadPdfjs() {
    if (root.pdfjsLib) return Promise.resolve(root.pdfjsLib);
    if (pdfjsPromise) return pdfjsPromise;
    pdfjsPromise = new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.src = PDFJS_BASE + 'pdf.min.js';
      sc.onload = function () {
        if (!root.pdfjsLib) { reject(new Error('pdf.js 초기화 실패')); return; }
        root.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.js';
        resolve(root.pdfjsLib);
      };
      sc.onerror = function () { pdfjsPromise = null; reject(new Error('pdf.js를 불러오지 못했습니다. 인터넷 연결을 확인하세요.')); };
      document.head.appendChild(sc);
    });
    return pdfjsPromise;
  }

  function extractLines(data) {
    return loadPdfjs().then(function (pdfjs) {
      return pdfjs.getDocument({ data: data, cMapUrl: PDFJS_CMAP_URL, cMapPacked: true }).promise;
    }).then(function (doc) {
      var jobs = [];
      for (var p = 1; p <= doc.numPages; p++) {
        jobs.push(doc.getPage(p).then(function (page) {
          return page.getTextContent().then(function (tc) {
            return { page: page.pageNumber, items: tc.items.map(function (i) {
              return { x: i.transform[4], y: i.transform[5], w: i.width, s: i.str };
            }) };
          });
        }));
      }
      return Promise.all(jobs);
    }).then(itemsToLines);
  }

  /* ---------------- 2단계: 라벨-값 짝 찾기 ---------------- */
  var LABELS = [
    '기관명', '계약관직책', '계약관', '담당부서', '담당', '상호', '사업자등록번호', '주소', '전화번호', '대표자', 'FAX', '담당자',
    '계약유형', '계약방법', '계약법구분', '조항호', '계약번호', '관리번호', '기관관리번호', '계약일자', '변경계약일자',
    '공동도급방식', '계약건명', '계약금액', '총용역부기금액', '현장', '착수일자', '금차완수일자', '총완수일자', '완수기한',
    '검사기관', '검수기관', '총계약보증금', '계약보증금율', '면세사업여부', '부가세율', '지체상금율', '계약해지여부', '계약해지일자',
    '변경구분', '변경사유', '변경계약증감액', '변경전착수일자', '변경후착수일자', '변경전금차완수일자', '변경후금차완수일자',
    '완수기한변경사유', '변경전계약금액', '변경금액', '변경후계약금액', '공종', '지분율', '대표', '수급',
    '지방채매입액', '인지세과세대상여부', '인지세액', '채권구분', '채권매입액', '추가계약보증금', '보증금율', '기간(비고)',
    '납부안내사항', '전자제출여부'
  ];
  var LABEL_SET = {};
  LABELS.forEach(function (l) { LABEL_SET[l] = true; });

  function matchLabelAt(cells, i) {
    // 자간이 벌어진 라벨("상 | 호", "변|경|구|분")까지 칸을 이어 붙여 가장 긴 라벨을 찾는다
    var best = 0;
    var acc = '';
    for (var k = 0; k < 12 && i + k < cells.length; k++) {
      var t = compact(cells[i + k].text);
      var isLast = /:$/.test(t);
      acc += t.replace(/:$/, '');
      if (acc.indexOf(':') >= 0) break;
      if (LABEL_SET[acc]) best = k + 1;
      if (isLast) break;
    }
    return best;
  }

  function buildPairs(lines) {
    lines.forEach(function (L) {
      L.pairs = [];
      var cur = null;
      var i = 0;
      while (i < L.cells.length) {
        var n = matchLabelAt(L.cells, i);
        if (n) {
          var label = L.cells.slice(i, i + n).map(function (c) { return compact(c.text); }).join('').replace(/:$/, '');
          cur = { label: label, x: L.cells[i].x, parts: [], wraps: [] };
          L.pairs.push(cur);
          i += n;
        } else {
          if (cur) cur.parts.push(L.cells[i].text);
          i += 1;
        }
      }
    });
    // 라벨이 없는 줄(두 줄로 나뉜 값)을 가까운 빈 라벨에 붙인다
    lines.forEach(function (L) {
      if (L.pairs.length || L.x < 60) return;
      var best = null;
      lines.forEach(function (M) {
        if (M.page !== L.page || M === L || Math.abs(M.y - L.y) > WRAP_TOL) return;
        M.pairs.forEach(function (p) {
          if (p.parts.length || p.x >= L.x) return;
          if (!best || p.x > best.x || (p.x === best.x && Math.abs(M.y - L.y) < best.dy)) {
            best = { pair: p, x: p.x, dy: Math.abs(M.y - L.y) };
          }
        });
      });
      if (best) best.pair.wraps.push({ y: L.y, text: L.text });
    });
    lines.forEach(function (L) {
      L.pairs.forEach(function (p) {
        if (!p.parts.length && p.wraps.length) {
          p.wraps.sort(function (a, b) { return b.y - a.y; });
          p.value = joinWrapped(p.wraps.map(function (w) { return w.text; }));
        } else {
          p.value = trim(p.parts.join(' '));
        }
      });
    });
    return lines;
  }

  function joinWrapped(arr) {
    // 줄 끝에서 단어가 잘린 경우 그대로 붙이고, 쉼표 뒤에서 끊긴 경우는 띄어 쓴다
    var out = '';
    arr.forEach(function (t, idx) {
      if (idx === 0) { out = t; return; }
      out += /[,]$/.test(out) ? ' ' + t : t;
    });
    return trim(out);
  }

  /* ---------------- 3단계: 나라장터 용역계약서 해석 ---------------- */
  function sectionOf(text, prev) {
    var t = compact(text);
    if (t === '<발주처>') return 'client';
    if (t === '<계약상대자>') return 'contractor';
    if (t === '<수요기관>') return 'demand';
    if (/^계약유형/.test(t)) return 'main';
    if (t === '[계약변경정보]' || t === '[기간변경정보]' || t === '[계약금액변경정보]') return 'change';
    if (t === '[채권및인지세정보]') return 'bond';
    if (t === '[계약업체정보]') return 'companies';
    if (t === '[첨부문서]') return 'attach';
    return prev;
  }

  function parseKoneps(lines, opts) {
    var warnings = [];
    var title = '';
    var docDate = '';
    var f = {};          // 'section.label' → value
    var companies = [];
    var comp = null;
    var section = 'head';

    lines.forEach(function (L) {
      if (!title && L.page === 1 && /계약서$/.test(compact(L.text))) title = compact(L.text);
      if (!docDate && L.page === 1 && /^\d{4}년\d{1,2}월\d{1,2}일$/.test(compact(L.text))) docDate = toDate(L.text);
      section = sectionOf(L.text, section);
      L.pairs.forEach(function (p) {
        if (section === 'companies') {
          if (p.label === '상호') { comp = { role: '', name: p.value, bizNo: '', trade: '', share: null }; companies.push(comp); return; }
          if (!comp) return;
          if (p.label === '대표' || p.label === '수급') comp.role = p.label;
          else if (p.label === '사업자등록번호') comp.bizNo = p.value;
          else if (p.label === '공종') comp.trade = p.value;
          else if (p.label === '지분율') comp.share = toPercent(p.value);
          return;
        }
        var key = section + '.' + p.label;
        if (!(key in f)) f[key] = p.value;
      });
    });

    function g(sec, label) { var v = f[sec + '.' + label]; return v === undefined ? '' : v; }

    var contractNo = g('main', '계약번호');
    var noMatch = contractNo.match(/^(.*?)-(\d+)$/);
    var contractType = g('main', '계약유형');
    var changeDate = toDate(g('main', '변경계약일자'));
    var isChange = /변경/.test(title) || /변경/.test(contractType) || !!changeDate;

    var clientTelM = g('client', '담당').match(/^(.*?)\(\s*Tel\s*:\s*([0-9\-]+)\s*\)/i);

    var r = {
      ok: true,
      format: 'koneps-service',
      formatName: '나라장터 전자계약서(용역)',
      docTitle: title,
      docDate: docDate,
      docType: isChange ? 'change' : 'new',
      changeSeq: noMatch ? parseInt(noMatch[2], 10) : 0,
      contractNo: contractNo,
      contractNoBase: noMatch ? noMatch[1] : contractNo,

      title: g('main', '계약건명'),
      client: g('client', '기관명'),
      clientDept: g('client', '담당부서'),
      clientManager: clientTelM ? trim(clientTelM[1]) : g('client', '담당'),
      clientTel: clientTelM ? clientTelM[2] : '',
      demandOrg: g('demand', '기관명'),
      demandAddr: g('demand', '주소'),
      demandManager: g('demand', '담당자'),
      demandTel: g('demand', '전화번호'),

      contractType: contractType,
      contractMethod: g('main', '계약방법'),
      contractLaw: g('main', '계약법구분'),
      contractClause: g('main', '조항호'),
      contractDate: toDate(g('main', '계약일자')),
      changeDate: changeDate,
      startDate: toDate(g('main', '착수일자')),
      currentEndDate: toDate(g('main', '금차완수일자')),
      endDate: toDate(g('main', '총완수일자')) || toDate(g('main', '금차완수일자')),
      durationText: g('main', '완수기한'),
      site: g('main', '현장'),

      amount: toAmount(g('main', '계약금액')),
      amountTotal: toAmount(g('main', '총용역부기금액')),
      deposit: toAmount(g('main', '총계약보증금')),
      depositRate: toPercent(g('main', '계약보증금율')),
      delayRate: toPercent(g('main', '지체상금율')),

      jointType: g('main', '공동도급방식'),
      isJoint: !!g('main', '공동도급방식') && !/단독/.test(g('main', '공동도급방식')),
      companies: companies,

      change: isChange ? {
        kind: g('change', '변경구분'),
        reason: g('change', '변경사유') || g('change', '완수기한변경사유'),
        delta: toFirstAmount(g('change', '변경계약증감액')),
        beforeStart: toDate(g('change', '변경전착수일자')),
        afterStart: toDate(g('change', '변경후착수일자')),
        beforeEnd: toDate(g('change', '변경전금차완수일자')),
        afterEnd: toDate(g('change', '변경후금차완수일자')),
        beforeAmount: toAmount(g('change', '변경전계약금액')),
        afterAmount: toAmount(g('change', '변경후계약금액'))
      } : null,

      ours: null,
      ourAmount: null,
      warnings: warnings
    };

    // 필수값 점검
    if (!r.title) warnings.push('계약건명을 읽지 못했습니다.');
    if (!r.contractNo) warnings.push('계약번호를 읽지 못했습니다.');
    if (r.amount === null) warnings.push('계약금액을 읽지 못했습니다.');
    if (!r.startDate || !r.endDate) warnings.push('착수일 또는 완수일을 읽지 못했습니다.');

    // 우리 회사 판별 (config.js의 BIZ_NO)
    var myBiz = digits(opts.bizNo);
    var mine = [];
    if (myBiz) {
      mine = companies.filter(function (c) { return digits(c.bizNo) === myBiz; });
      if (!mine.length && !companies.length) {
        // 계약업체 정보가 없는 양식이면 계약상대자 칸으로 판별
        if (digits(g('contractor', '사업자등록번호')) === myBiz) mine = [{ role: '대표', name: g('contractor', '상호'), bizNo: g('contractor', '사업자등록번호'), trade: '', share: 100 }];
      }
      if (!mine.length) warnings.push('이 계약서의 계약업체 중 우리 회사 사업자번호가 없습니다. 다른 회사 계약서인지 확인하세요.');
    } else {
      warnings.push('설정에 사업자번호(BIZ_NO)가 없어 우리 회사 여부를 확인하지 못했습니다.');
    }
    r.ours = { found: mine.length > 0, rows: mine };

    // 우리 몫 금액
    if (!r.isJoint) {
      r.ourAmount = r.amount;
    } else if (/공동이행/.test(r.jointType)) {
      var shares = {};
      mine.forEach(function (c) { if (c.share !== null) shares[c.share] = true; });
      var keys = Object.keys(shares);
      if (r.amount !== null && keys.length === 1) {
        r.ourAmount = Math.round(r.amount * parseFloat(keys[0]) / 100);
        warnings.push('공동이행 계약입니다. 계약금액 × 우리 지분율(' + keys[0] + '%)로 금액을 계산했습니다. 확인하세요.');
      } else {
        warnings.push('공동이행 계약이지만 우리 지분율을 확정하지 못했습니다. 우리 지분 금액을 직접 입력하세요.');
      }
    } else {
      warnings.push(r.jointType + ' 공동도급 계약입니다. 계약서의 금액은 전체 금액이므로, 우리 지분 금액을 직접 입력하세요.');
    }
    return r;
  }

  /* ---------------- 양식 등록부 ---------------- */
  var FORMATS = [
    {
      id: 'koneps-service',
      name: '나라장터 전자계약서(용역)',
      detect: function (lines) {
        var head = lines.filter(function (L) { return L.page === 1; }).map(function (L) { return compact(L.text); }).join('\n');
        return /^용역(변경)?계약서$/m.test(head) && head.indexOf('계약번호') >= 0 && head.indexOf('계약건명') >= 0;
      },
      parse: parseKoneps
    }
  ];

  function parseLines(lines, opts) {
    opts = opts || {};
    buildPairs(lines);
    for (var i = 0; i < FORMATS.length; i++) {
      if (FORMATS[i].detect(lines)) return FORMATS[i].parse(lines, opts);
    }
    var hasText = lines.some(function (L) { return trim(L.text) !== ''; });
    return { ok: false, error: hasText
      ? '지원하지 않는 계약서 양식입니다. 현재는 나라장터 용역계약서만 자동 판독할 수 있습니다.'
      : 'PDF에서 글자를 읽을 수 없습니다. 스캔한 이미지 PDF는 자동 판독할 수 없습니다.' };
  }

  function parseFile(file, opts) {
    return file.arrayBuffer().then(function (buf) {
      return extractLines(new Uint8Array(buf));
    }).then(function (lines) {
      return parseLines(lines, opts);
    }, function (e) {
      return { ok: false, error: 'PDF를 열 수 없습니다: ' + (e && e.message ? e.message : e) };
    });
  }

  // 용역명 비교용: 띄어쓰기·괄호·기호 차이를 무시
  function normalizeTitle(s) {
    return String(s || '').replace(/[\s()\[\]{}<>「」『』"'·,.\-_]/g, '').toLowerCase();
  }

  var API = {
    formats: FORMATS,
    parseFile: parseFile,
    loadPdfjs: loadPdfjs,
    parseLines: parseLines,
    itemsToLines: itemsToLines,
    normalizeTitle: normalizeTitle,
    _util: { toDate: toDate, toAmount: toAmount, toPercent: toPercent }
  };
  root.ContractParser = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
