/**
 * payroll-transfer.js — 급여 송금내역 엑셀 공용 모듈 (admin-payroll.html)
 *
 * 빌드 없이 쓰는 파일이라 ES5 로 작성한다. 데이터는 DB 함수 payroll_transfer_export(period, format, preview) 의 결과를 쓴다:
 *   { run, salary:[{employee_id,name,amount,bank_code,bank_name,account_no,holder}],
 *     extra:[{id,kind,emp_name,amount,depositor,bank_code,bank_name,account_no,holder,account_label}],
 *     cash:[{amount,memo}], summary }
 * 급여 줄 = 확정 명세서 실지급액(0원 제외), 추가 송금 줄 = 출장비·퇴직금 적립·기타, 현금 = 금액만.
 *
 * 양식(기존 송금 파일): A1 제목 / 2행 머리글 은행코드·은행명·계좌번호·금액·예금주·입금자명 /
 * 주거래은행 먼저 → 타행(은행코드 순) / H·I열 요약(주거래·타행·총 건수와 합계) / 데이터 아래 현금 줄 → 전체 합계 /
 * 하단 주소 · 회사명 · "대표이사 OOO (인)" · 사업자번호.
 * 회사·은행·입금자명·제목·파일명은 전부 APP_CONFIG 에서 읽는다(화이트라벨). 계좌번호는 입력한 형식 그대로 쓴다.
 *
 * 사용:
 *   var model = PayrollTransfer.build(data);
 *   XLSX.writeFile(PayrollTransfer.toXlsWorkbook(XLSX, model), PayrollTransfer.fileName(period, 'xls'), { bookType: 'biff8' });
 *   PayrollTransfer.toXlsxBlob(XlsxPopulate, model, password).then(function(blob) { ... });
 */
(function(global) {
  'use strict';

  function cfg() { return global.APP_CONFIG || {}; }
  function pcfg() { return cfg().PAYROLL || {}; }
  function num(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
  function fill(tpl, map) {
    return String(tpl).replace(/\{(\w+)\}/g, function(m, k) { return map[k] != null ? String(map[k]) : m; });
  }

  var HEADER = ['은행코드', '은 행 명', '계 좌 번 호', '금 액', '예 금 주', '입금자명'];
  var KIND_ORDER = { salary: 0, travel: 1, retirement: 2, other: 3 };
  var KIND_LABEL = { salary: '급여', travel: '출장비', retirement: '퇴직금 적립', other: '기타' };

  function depositorOf(kind, given) {
    if (given && String(given).trim()) return String(given).trim();
    var D = pcfg().TRANSFER_DEPOSITOR || {};
    return (kind === 'travel' ? D.travel : D.pay) || D.pay || '';
  }
  function mainBank() {
    var code = pcfg().MAIN_BANK_CODE || '';
    var name = '';
    (pcfg().BANKS || []).forEach(function(b) { if (b.code === code) name = b.name; });
    return { code: code, name: name || code };
  }

  function fileName(period, fmt) {
    var base = fill(pcfg().TRANSFER_FILE || '급여송금내역_{YYYY}-{MM}',
      { YYYY: period.slice(0, 4), YY: period.slice(2, 4), MM: period.slice(5, 7) });
    return base.replace(/[\\\/?*:"<>|]/g, '-') + (fmt === 'xlsx' ? '.xlsx' : '.xls');
  }

  function footerLines() {
    var C = cfg();
    var names = C.CEO_NAMES || [];
    var idx = pcfg().TRANSFER_SIGNER_INDEX || 0;
    var signer = names[idx] != null ? names[idx] : (names[0] || '');
    var out = [];
    if (C.ADDRESS) out.push(C.ADDRESS);
    if (C.COMPANY_KO) out.push(C.COMPANY_KO);
    if (signer) out.push('대표이사 ' + signer + ' (인)');
    if (C.COMPANY_BIZ_NO) out.push('사업자번호 ' + C.COMPANY_BIZ_NO);
    return out;
  }

  // data → 화면·파일 공용 모델
  function build(data) {
    var main = mainBank();
    var rows = [];
    (data.salary || []).forEach(function(s, i) {
      rows.push({ kind: 'salary', seq: i, who: s.name || '', amount: num(s.amount),
        bank_code: s.bank_code || '', bank_name: s.bank_name || '', account_no: s.account_no || '',
        holder: s.holder || s.name || '', depositor: depositorOf('salary', null), missing: !s.account_no });
    });
    (data.extra || []).forEach(function(x, i) {
      var k = KIND_ORDER[x.kind] != null ? x.kind : 'other';
      rows.push({ kind: k, seq: i, who: x.emp_name || x.account_label || KIND_LABEL[k], amount: num(x.amount),
        bank_code: x.bank_code || '', bank_name: x.bank_name || '', account_no: x.account_no || '',
        holder: x.holder || x.emp_name || '', depositor: depositorOf(k, x.depositor), missing: !x.account_no });
    });
    rows = rows.filter(function(r) { return r.amount > 0; });

    function grp(r) { return r.missing ? 2 : (r.bank_code === main.code ? 0 : 1); }
    rows.sort(function(a, b) {
      var ga = grp(a), gb = grp(b);
      if (ga !== gb) return ga - gb;
      if (ga === 1 && a.bank_code !== b.bank_code) return a.bank_code < b.bank_code ? -1 : 1;
      if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
      return a.seq - b.seq;
    });

    function sum(list) { return list.reduce(function(t, r) { return t + r.amount; }, 0); }
    var mainRows = rows.filter(function(r) { return grp(r) === 0; });
    var otherRows = rows.filter(function(r) { return grp(r) === 1; });
    var missRows = rows.filter(function(r) { return grp(r) === 2; });
    var cashTotal = (data.cash || []).reduce(function(t, c) { return t + num(c.amount); }, 0);
    var transferTotal = sum(rows);

    var summary = [
      { label: main.name + '(' + mainRows.length + '건)', n: mainRows.length, amount: sum(mainRows) },
      { label: '타행(' + otherRows.length + '건)', n: otherRows.length, amount: sum(otherRows) },
    ];
    if (missRows.length) summary.push({ label: '계좌 없음(' + missRows.length + '건)', n: missRows.length, amount: sum(missRows) });
    summary.push({ label: '총(' + rows.length + '건)', n: rows.length, amount: transferTotal });

    return {
      period: data.run && data.run.period, title: pcfg().TRANSFER_TITLE || '급 여 송 금 내 역',
      rows: rows, summary: summary, cashTotal: cashTotal, cashCount: (data.cash || []).length,
      transferTotal: transferTotal, grandTotal: transferTotal + cashTotal,
      missing: missRows.map(function(r) { return r.who + ' · ' + KIND_LABEL[r.kind]; }),
      footer: footerLines(),
    };
  }

  // 시트 배치(행 번호 0부터): 0 제목 / 1 머리글 / 2.. 데이터 / 현금 / 합계 / 빈 줄 / 하단
  function layout(model) {
    var first = 2, last = first + model.rows.length - 1;
    var cashRow = first + model.rows.length;
    var totalRow = cashRow + 1;
    var footerStart = totalRow + 2;
    return { first: first, last: last, cashRow: cashRow, totalRow: totalRow, footerStart: footerStart };
  }

  // 값만 담은 2차원 배열 (xls·검증 공용)
  function toAoa(model) {
    var L = layout(model);
    var aoa = [];
    function setCell(r, c, v) { while (aoa.length <= r) aoa.push([]); aoa[r][c] = v; }
    setCell(0, 0, model.title);
    HEADER.forEach(function(h, c) { setCell(1, c, h); });
    model.rows.forEach(function(r, i) {
      var row = L.first + i;
      setCell(row, 0, r.bank_code); setCell(row, 1, r.bank_name); setCell(row, 2, r.account_no);
      setCell(row, 3, r.amount);    setCell(row, 4, r.holder);    setCell(row, 5, r.depositor);
    });
    model.summary.forEach(function(s, i) { setCell(1 + i, 7, s.label); setCell(1 + i, 8, s.amount); });
    setCell(L.cashRow, 1, '현금'); setCell(L.cashRow, 3, model.cashTotal);
    setCell(L.totalRow, 1, '합계'); setCell(L.totalRow, 3, model.grandTotal);
    model.footer.forEach(function(t, i) { setCell(L.footerStart + i, 0, t); });
    for (var r = 0; r < aoa.length; r++) for (var c = 0; c < 9; c++) if (aoa[r][c] === undefined) aoa[r][c] = null;
    return aoa;
  }

  var COL_WIDTHS = [9, 12, 24, 14, 12, 12, 3, 16, 14];

  // 은행 업로드용 .xls (SheetJS, 비밀번호·서식 없음 — 금액 형식과 제목 병합만)
  function toXlsWorkbook(XLSX, model) {
    var L = layout(model);
    var ws = XLSX.utils.aoa_to_sheet(toAoa(model));
    var money = [];
    model.rows.forEach(function(r, i) { money.push('D' + (L.first + i + 1)); });
    money.push('D' + (L.cashRow + 1), 'D' + (L.totalRow + 1));
    model.summary.forEach(function(s, i) { money.push('I' + (2 + i)); });
    money.forEach(function(a) { if (ws[a] && ws[a].t === 'n') ws[a].z = '#,##0'; });
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
    model.footer.forEach(function(t, i) { ws['!merges'].push({ s: { r: L.footerStart + i, c: 0 }, e: { r: L.footerStart + i, c: 5 } }); });
    ws['!cols'] = COL_WIDTHS.map(function(w) { return { wch: w }; });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '송금내역');
    return wb;
  }

  // 보관용 .xlsx (xlsx-populate, 비밀번호·서식·합계 수식) → Promise<Blob|Buffer>
  function toXlsxBlob(XP, model, password, outType) {
    var L = layout(model);
    var aoa = toAoa(model);
    return XP.fromBlankAsync().then(function(wb) {
      var s = wb.sheet(0);
      s.name('송금내역');
      aoa.forEach(function(row, r) { row.forEach(function(v, c) { if (v !== null) s.row(r + 1).cell(c + 1).value(v); }); });
      COL_WIDTHS.forEach(function(w, i) { s.column(i + 1).width(w + 2); });
      s.range('A1:F1').merged(true).style({ bold: true, fontSize: 16, horizontalAlignment: 'center' });
      s.range('A2:F2').style({ bold: true, horizontalAlignment: 'center', fill: 'f1f5f9', border: true });
      if (model.rows.length) {
        s.range('A' + (L.first + 1) + ':F' + (L.last + 1)).style({ border: true });
        s.range('D' + (L.first + 1) + ':D' + (L.last + 1)).style('numberFormat', '#,##0');
      }
      var cashA = 'D' + (L.cashRow + 1), totA = 'D' + (L.totalRow + 1);
      s.range('A' + (L.cashRow + 1) + ':F' + (L.totalRow + 1)).style({ border: true });
      s.range('B' + (L.totalRow + 1) + ':D' + (L.totalRow + 1)).style({ bold: true });
      s.cell(cashA).style('numberFormat', '#,##0');
      // 합계 = 송금 줄 합 + 현금 (엑셀에서 다시 계산되도록 수식)
      var sumExpr = model.rows.length ? 'SUM(D' + (L.first + 1) + ':D' + (L.last + 1) + ')+' + cashA : cashA;
      s.cell(totA).formula(sumExpr).style('numberFormat', '#,##0');
      model.summary.forEach(function(x, i) {
        s.cell('H' + (2 + i)).style({ border: true });
        s.cell('I' + (2 + i)).style({ border: true, numberFormat: '#,##0' });
      });
      model.footer.forEach(function(t, i) {
        var r = L.footerStart + i + 1;
        s.range('A' + r + ':F' + r).merged(true).style({ horizontalAlignment: 'center' });
      });
      return wb.outputAsync(password ? { password: password, type: outType } : { type: outType });
    });
  }

  global.PayrollTransfer = {
    HEADER: HEADER, KIND_LABEL: KIND_LABEL,
    fileName: fileName, build: build, layout: layout, toAoa: toAoa,
    toXlsWorkbook: toXlsWorkbook, toXlsxBlob: toXlsxBlob, footerLines: footerLines,
  };
})(typeof window !== 'undefined' ? window : globalThis);
