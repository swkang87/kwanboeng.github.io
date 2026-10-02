/**
 * payroll-excel.js — 급여대장 엑셀 내려받기 공용 모듈 (admin-payroll.html)
 *
 * 빌드 없이 쓰는 파일이라 ES5 로 작성한다. 화면 상태가 아니라 DB 에 저장된 명세서로 만든다
 * (편집 화면 표와 같은 구조: 순서 · 이름 · 부서 · 직급 · 지급 항목 · 지급합계 · 공제 항목 · 공제합계 · 실지급액 · 산출방법).
 *
 * 넣지 않는 것: 계좌번호, 생년월일, 이메일, 월별수당 참고값.
 * 회사명·시트 이름·파일명 형식은 APP_CONFIG(COMPANY_SHORT, PAYROLL.EXCEL_*)에서 읽는다 (화이트라벨).
 *
 * 사용:
 *   var built = PayrollExcel.buildSheet({ run, slips, lines, items, empOrder });
 *   var ws = PayrollExcel.toWorksheet(XLSX, built);
 *   XLSX.utils.book_append_sheet(wb, ws, built.sheetName);
 */
(function(global) {
  'use strict';

  function cfg() { return global.APP_CONFIG || {}; }
  function pcfg() { return cfg().PAYROLL || {}; }

  function fill(tpl, map) {
    return String(tpl).replace(/\{(\w+)\}/g, function(m, k) { return map[k] != null ? String(map[k]) : m; });
  }
  function ymMap(period) {
    return { YYYY: period.slice(0, 4), YY: period.slice(2, 4), MM: period.slice(5, 7) };
  }
  function typeLabel(t) {
    var L = pcfg().TYPE_LABELS || { pay: '지급용', report: '신고용' };
    return L[t] || t;
  }
  function sheetTypeLabel(t) {
    var L = pcfg().EXCEL_SHEET_TYPE || { pay: '지급', report: '신고' };
    return L[t] || t;
  }

  // 엑셀 시트 이름 규칙: 31자 이하, \ / ? * [ ] : 사용 불가
  function sheetName(period, runType) {
    var m = ymMap(period); m.TYPE = sheetTypeLabel(runType);
    return fill(pcfg().EXCEL_SHEET_NAME || '{YY}.{MM} {TYPE}', m).replace(/[\\\/?*\[\]:]/g, '-').slice(0, 31);
  }

  // kind: 'month' (key = 'YYYY-MM') | 'year' (key = 'YYYY')
  function fileName(kind, key, isDraft) {
    var P = pcfg();
    var m = kind === 'month' ? ymMap(key) : { YYYY: key, YY: key.slice(2, 4), MM: '' };
    var base = fill(kind === 'month' ? (P.EXCEL_FILE_MONTH || '급여_{YYYY}-{MM}') : (P.EXCEL_FILE_YEAR || '급여_{YYYY}'), m);
    if (isDraft) base += (P.EXCEL_DRAFT_SUFFIX != null ? P.EXCEL_DRAFT_SUFFIX : '_작성중');
    return base.replace(/[\\\/?*:"<>|]/g, '-') + '.xlsx';
  }

  function titleOf(run) {
    var m = ymMap(run.period);
    m.COMPANY = cfg().COMPANY_SHORT || cfg().COMPANY_KO || '';
    m.TYPE = typeLabel(run.run_type);
    m.STATUS = run.status === 'confirmed' ? '확정' : '작성중';
    return fill(pcfg().EXCEL_TITLE || '{COMPANY} {YYYY}년 {MM}월 급여대장 ({TYPE}) — {STATUS}', m).trim();
  }

  function num(v) { var n = Number(v); return isNaN(n) ? 0 : n; }

  /**
   * input = {
   *   run:   { id, period, run_type, status },
   *   slips: [{ id, employee_id, name_snap, dept_snap, position_snap, total_earning, total_deduction, net_pay }],
   *   lines: [{ slip_id, item_id, item_name, item_kind, sort_order, amount, method }],   // 이 묶음 명세서의 항목
   *   items: [payroll_items],                 // 항목 순서 기준 (설정의 항목 순서)
   *   empOrder: { employee_id: sort_order }   // 대상자 순서
   * }
   * 반환: { sheetName, title, header, rows, totals, numStart, numEnd, hasMethod, warnings }
   */
  function buildSheet(input) {
    var run = input.run, slips = input.slips || [], lines = input.lines || [];
    var itemById = {};
    (input.items || []).forEach(function(it) { itemById[it.id] = it; });
    var order = input.empOrder || {};

    // 명세서별 항목
    var bySlip = {};
    lines.forEach(function(l) { (bySlip[l.slip_id] = bySlip[l.slip_id] || []).push(l); });

    // 열: 이 묶음에서 금액이 하나라도 있는 항목만. 순서 = 지급 먼저, 설정의 항목 순서
    var colMap = {};
    lines.forEach(function(l) {
      if (num(l.amount) === 0) return;
      var key = l.item_id || ('n:' + l.item_kind + ':' + l.item_name);
      if (colMap[key]) return;
      var it = l.item_id ? itemById[l.item_id] : null;
      colMap[key] = {
        key: key,
        kind: it ? it.kind : l.item_kind,
        name: it ? it.name : l.item_name,
        sort: it ? num(it.sort_order) : num(l.sort_order),
      };
    });
    var cols = Object.keys(colMap).map(function(k) { return colMap[k]; }).sort(function(a, b) {
      if (a.kind !== b.kind) return a.kind === 'earning' ? -1 : 1;
      if (a.sort !== b.sort) return a.sort - b.sort;
      return a.name.localeCompare(b.name, 'ko');
    });
    var earnCols = cols.filter(function(c) { return c.kind === 'earning'; });
    var dedCols = cols.filter(function(c) { return c.kind === 'deduction'; });

    // 행: 대상자 순서(sort_order) → 이름
    var sorted = slips.slice().sort(function(a, b) {
      var oa = order[a.employee_id] != null ? num(order[a.employee_id]) : 1e9;
      var ob = order[b.employee_id] != null ? num(order[b.employee_id]) : 1e9;
      if (oa !== ob) return oa - ob;
      return String(a.name_snap || '').localeCompare(String(b.name_snap || ''), 'ko');
    });

    var warnings = [];
    var hasMethod = lines.some(function(l) { return l.method && String(l.method).trim() && num(l.amount) !== 0; });
    var rows = sorted.map(function(s, i) {
      var ls = bySlip[s.id] || [];
      var amt = {}, methods = [], sumE = 0, sumD = 0;
      ls.forEach(function(l) {
        var key = l.item_id || ('n:' + l.item_kind + ':' + l.item_name);
        var a = num(l.amount);
        amt[key] = (amt[key] || 0) + a;
        if (l.item_kind === 'earning') sumE += a; else sumD += a;
        if (a !== 0 && l.method && String(l.method).trim()) methods.push((l.item_name || '') + ': ' + String(l.method).trim());
      });
      var te = num(s.total_earning), td = num(s.total_deduction), net = num(s.net_pay);
      if (sumE !== te || sumD !== td || te - td !== net) {
        warnings.push((s.name_snap || '대상자') + ': 명세서 합계와 항목 합이 다릅니다');
      }
      var row = [i + 1, s.name_snap || '', s.dept_snap || '', s.position_snap || ''];
      earnCols.forEach(function(c) { row.push(amt[c.key] ? amt[c.key] : null); });
      row.push(te);
      dedCols.forEach(function(c) { row.push(amt[c.key] ? amt[c.key] : null); });
      row.push(td, net);
      if (hasMethod) row.push(methods.join(' / '));
      return row;
    });

    var header = ['순서', '이름', '부서', '직급'];
    earnCols.forEach(function(c) { header.push(c.name); });
    header.push('지급합계');
    dedCols.forEach(function(c) { header.push(c.name); });
    header.push('공제합계', '실지급액');
    if (hasMethod) header.push('산출방법');

    var numStart = 4, numEnd = 4 + earnCols.length + 1 + dedCols.length + 2 - 1;   // 금액 열 범위(0 기준)
    var totals = [];
    for (var c = numStart; c <= numEnd; c++) {
      totals[c] = rows.reduce(function(acc, r) { return acc + num(r[c]); }, 0);
    }
    var teCol = numStart + earnCols.length, tdCol = teCol + dedCols.length + 1, netCol = tdCol + 1;

    return {
      sheetName: sheetName(run.period, run.run_type),
      title: titleOf(run),
      header: header,
      rows: rows,
      totals: totals,
      numStart: numStart,
      numEnd: numEnd,
      sum: { earning: totals[teCol], deduction: totals[tdCol], net: totals[netCol] },
      hasMethod: hasMethod,
      warnings: warnings,
    };
  }

  // 0 기준 열 번호 → 엑셀 열 문자
  function colLetter(i) {
    var s = '';
    i += 1;
    while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }

  var NUM_FMT = '#,##0';

  // 1행 제목, 2행 머리글, 3행부터 대상자, 마지막 합계 행(SUM 수식 + 계산값)
  function toWorksheet(XLSX, b) {
    var aoa = [[b.title], b.header].concat(b.rows);
    var totalRow = ['', '합계', '', ''];
    for (var c = b.numStart; c <= b.numEnd; c++) totalRow[c] = b.totals[c];
    if (b.hasMethod) totalRow.push('');
    aoa.push(totalRow);
    var ws = XLSX.utils.aoa_to_sheet(aoa);

    var firstData = 3, lastData = 2 + b.rows.length, totalR = lastData + 1;   // 엑셀 행 번호(1 기준)
    for (var r = firstData; r <= totalR; r++) {
      for (var cc = b.numStart; cc <= b.numEnd; cc++) {
        var ref = colLetter(cc) + r;
        var cell = ws[ref];
        if (r === totalR) {
          ws[ref] = cell = { t: 'n', v: b.totals[cc] || 0 };
          if (b.rows.length) cell.f = 'SUM(' + colLetter(cc) + firstData + ':' + colLetter(cc) + lastData + ')';
        }
        if (cell && cell.t === 'n') cell.z = NUM_FMT;
      }
    }

    var width = b.header.length;
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, width - 1) } }];
    ws['!cols'] = b.header.map(function(h, i) {
      if (i === 0) return { wch: 5 };
      if (i === 1) return { wch: 10 };
      if (i <= 3) return { wch: 9 };
      if (b.hasMethod && i === width - 1) return { wch: 40 };
      return { wch: Math.max(11, String(h).length * 2 + 2) };
    });
    return ws;
  }

  global.PayrollExcel = {
    buildSheet: buildSheet,
    toWorksheet: toWorksheet,
    sheetName: sheetName,
    fileName: fileName,
    titleOf: titleOf,
  };
})(typeof window !== 'undefined' ? window : globalThis);
