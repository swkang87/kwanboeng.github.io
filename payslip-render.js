/**
 * payslip-render.js — 급여명세서 렌더링 공용 모듈
 *
 * 관리자 미리보기(admin-payroll.html)와 직원 화면(payslip.html)이 같은 컴포넌트를 쓴다.
 * 빌드 없이 쓰는 파일이라 ES5 + React.createElement 로 작성한다 (JSX·?.·화살표 함수 없음).
 *
 * 사용:
 *   var Sheet = PayslipRender.createSheet(React);
 *   var PrintCopy = PayslipRender.createPrintCopy(React, ReactDOM);
 *   <Sheet model={model} />          화면 표시용
 *   <PrintCopy model={model} />      인쇄 전용 복사본 (#pss-print-root 로 포털 렌더)
 *
 * model = {
 *   period:'2026-09', runType:'pay'|'report', payDate:'2026-10-09',
 *   name, birthDate, employeeNo, dept, position, hireDate,
 *   earnings:[{name, amount, method}], deductions:[{name, amount, method}],
 *   totalEarning, totalDeduction, netPay
 * }
 * 회사명·연락처·주소는 APP_CONFIG 에서 읽는다 (화이트라벨).
 */
(function (global) {
  'use strict';

  var CSS_ID = 'pss-css';
  var PRINT_ROOT_ID = 'pss-print-root';

  var CSS = [
    '.pss-sheet{background:#fff;color:#0f172a;max-width:760px;margin:0 auto;padding:32px 36px;border:1px solid #e2e8f0;border-radius:12px;font-size:13px;line-height:1.5;box-sizing:border-box;}',
    '.pss-sheet *{box-sizing:border-box;}',
    '.pss-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:14px;border-bottom:2px solid var(--theme,#0f172a);margin-bottom:16px;}',
    '.pss-co{font-size:12px;font-weight:700;color:#475569;margin-bottom:4px;}',
    '.pss-title{font-size:22px;font-weight:800;letter-spacing:-0.3px;}',
    '.pss-type{flex-shrink:0;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid #cbd5e1;color:#475569;white-space:nowrap;}',
    '.pss-info{display:grid;grid-template-columns:auto 1fr auto 1fr;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:16px;}',
    '.pss-info-l{background:#f8fafc;color:#64748b;font-size:11px;font-weight:700;padding:8px 12px;white-space:nowrap;border-bottom:1px solid #e2e8f0;}',
    '.pss-info-v{padding:8px 12px;font-weight:600;border-bottom:1px solid #e2e8f0;}',
    '.pss-info > :nth-last-child(-n+4){border-bottom:none;}',
    '.pss-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px;}',
    '.pss-sum-b{border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;text-align:right;}',
    '.pss-sum-l{font-size:11px;font-weight:700;color:#64748b;text-align:left;}',
    '.pss-sum-v{font-size:17px;font-weight:800;margin-top:2px;white-space:nowrap;}',
    '.pss-sum-b.net{background:var(--theme,#0f172a);border-color:var(--theme,#0f172a);color:#fff;}',
    '.pss-sum-b.net .pss-sum-l{color:rgba(255,255,255,.75);}',
    '.pss-tbls{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start;}',
    '.pss-tbls.wide{grid-template-columns:1fr;}',
    '.pss-sec-t{font-size:12px;font-weight:800;margin-bottom:6px;}',
    '.pss-tbl{width:100%;border-collapse:collapse;border:1px solid #e2e8f0;}',
    '.pss-tbl th{background:#f8fafc;font-size:11px;font-weight:700;color:#64748b;padding:6px 8px;text-align:left;border-bottom:1px solid #e2e8f0;}',
    '.pss-tbl td{padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:12.5px;vertical-align:top;}',
    '.pss-tbl .r{text-align:right;white-space:nowrap;}',
    '.pss-tbl .m{color:#64748b;font-size:11.5px;}',
    '.pss-tbl tfoot td{border-top:1.5px solid #cbd5e1;border-bottom:none;font-weight:800;background:#f8fafc;}',
    '.pss-empty{color:#94a3b8;text-align:center;}',
    '.pss-foot{margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center;line-height:1.7;}',
    '@media (max-width:640px){',
    '  .pss-sheet{padding:18px 14px;border-radius:10px;}',
    '  .pss-title{font-size:18px;}',
    '  .pss-info{grid-template-columns:auto 1fr;}',
    '  .pss-info > :nth-last-child(-n+4){border-bottom:1px solid #e2e8f0;}',
    '  .pss-info > :nth-last-child(-n+2){border-bottom:none;}',
    '  .pss-sum-v{font-size:14px;}',
    '  .pss-sum-b{padding:8px;}',
    '  .pss-tbls{grid-template-columns:1fr;}',
    '}',
    '#' + PRINT_ROOT_ID + '{display:none;}',
    '@media print{',
    '  @page{size:A4;margin:12mm;}',
    '  html,body{background:#fff !important;}',
    '  body > *:not(#' + PRINT_ROOT_ID + '){display:none !important;}',
    '  #' + PRINT_ROOT_ID + '{display:block !important;}',
    '  #' + PRINT_ROOT_ID + ' .pss-sheet{max-width:none;border:none;border-radius:0;padding:0;}',
    '  #' + PRINT_ROOT_ID + ' .pss-info{grid-template-columns:auto 1fr auto 1fr;}',
    '  #' + PRINT_ROOT_ID + ' .pss-tbls{grid-template-columns:1fr 1fr;}',
    '  #' + PRINT_ROOT_ID + ' .pss-tbls.wide{grid-template-columns:1fr;}',
    '  #' + PRINT_ROOT_ID + ' .pss-sum-v{font-size:16px;}',
    '  #' + PRINT_ROOT_ID + ' .pss-sheet{font-size:11px;line-height:1.35;page-break-inside:avoid;}',
    '  #' + PRINT_ROOT_ID + ' .pss-top{padding-bottom:8px;margin-bottom:10px;}',
    '  #' + PRINT_ROOT_ID + ' .pss-title{font-size:19px;}',
    '  #' + PRINT_ROOT_ID + ' .pss-info{margin-bottom:10px;}',
    '  #' + PRINT_ROOT_ID + ' .pss-info-l,#' + PRINT_ROOT_ID + ' .pss-info-v{padding:5px 10px;}',
    '  #' + PRINT_ROOT_ID + ' .pss-sum{margin-bottom:10px;}',
    '  #' + PRINT_ROOT_ID + ' .pss-sum-b{padding:6px 10px;}',
    '  #' + PRINT_ROOT_ID + ' .pss-tbls{gap:8px;}',
    '  #' + PRINT_ROOT_ID + ' .pss-sec-t{margin-bottom:3px;}',
    '  #' + PRINT_ROOT_ID + ' .pss-tbl th{padding:3px 8px;}',
    '  #' + PRINT_ROOT_ID + ' .pss-tbl td{padding:3px 8px;font-size:11px;}',
    '  #' + PRINT_ROOT_ID + ' .pss-tbl .m{font-size:10.5px;}',
    '  #' + PRINT_ROOT_ID + ' .pss-foot{margin-top:10px;padding-top:8px;font-size:10px;line-height:1.5;}',
    '  #' + PRINT_ROOT_ID + ' *{-webkit-print-color-adjust:exact;print-color-adjust:exact;}',
    '  #' + PRINT_ROOT_ID + ' .pss-tbl tr{page-break-inside:avoid;}',
    '}'
  ].join('\n');

  function injectCss() {
    if (!global.document || document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function cfg() { return global.APP_CONFIG || {}; }

  function won(n) {
    var v = Number(n) || 0;
    return v.toLocaleString('ko-KR');
  }

  function fmtDate(ds) {
    if (!ds) return '-';
    var s = String(ds).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return s.slice(0, 4) + '.' + s.slice(5, 7) + '.' + s.slice(8, 10);
  }

  function titleOf(period) {
    var p = String(period || '');
    if (!/^\d{4}-\d{2}$/.test(p)) return '급여명세서';
    return p.slice(0, 4) + '년 ' + p.slice(5, 7) + '월 급여명세서';
  }

  function typeLabel(t) {
    var labels = (cfg().PAYROLL && cfg().PAYROLL.TYPE_LABELS) || { pay: '지급용', report: '신고용' };
    return labels[t] || '';
  }

  function visible(list) {
    return (list || []).filter(function (x) { return (Number(x.amount) || 0) !== 0; });
  }

  function createSheet(React) {
    injectCss();
    var e = React.createElement;

    function Table(title, rows, total, totalLabel, showMethod) {
      var head = [e('th', { key: 'n' }, '항목'), e('th', { key: 'a', className: 'r' }, '금액')];
      if (showMethod) head.push(e('th', { key: 'm' }, '산출방법'));
      var body = rows.length
        ? rows.map(function (r, i) {
            var tds = [
              e('td', { key: 'n' }, r.name),
              e('td', { key: 'a', className: 'r' }, won(r.amount))
            ];
            if (showMethod) tds.push(e('td', { key: 'm', className: 'm' }, r.method || ''));
            return e('tr', { key: i }, tds);
          })
        : [e('tr', { key: 'empty' }, e('td', { colSpan: showMethod ? 3 : 2, className: 'pss-empty' }, '해당 없음'))];
      var foot = [e('td', { key: 'n' }, totalLabel), e('td', { key: 'a', className: 'r' }, won(total))];
      if (showMethod) foot.push(e('td', { key: 'm' }, ''));
      return e('div', null,
        e('div', { className: 'pss-sec-t' }, title),
        e('table', { className: 'pss-tbl' },
          e('thead', null, e('tr', null, head)),
          e('tbody', null, body),
          e('tfoot', null, e('tr', null, foot))
        )
      );
    }

    return function PayslipSheet(props) {
      var m = props.model || {};
      var c = cfg();
      var earnings = visible(m.earnings);
      var deductions = visible(m.deductions);
      var showMethod = earnings.concat(deductions).some(function (x) { return x.method && String(x.method).trim(); });

      var idLabel = m.birthDate ? '생년월일' : '사원번호';
      var idValue = m.birthDate ? fmtDate(m.birthDate) : (m.employeeNo || '-');

      var info = [
        ['성명', m.name || '-'], [idLabel, idValue],
        ['부서', m.dept || '-'], ['직급', m.position || '-'],
        ['입사일', fmtDate(m.hireDate)], ['지급일자', fmtDate(m.payDate)]
      ];
      var infoCells = [];
      info.forEach(function (kv, i) {
        infoCells.push(e('div', { key: 'l' + i, className: 'pss-info-l' }, kv[0]));
        infoCells.push(e('div', { key: 'v' + i, className: 'pss-info-v' }, kv[1]));
      });

      var footLines = [c.COMPANY_KO || ''];
      var contact = [];
      if (c.TEL) contact.push('TEL ' + c.TEL);
      if (c.FAX) contact.push('FAX ' + c.FAX);

      return e('div', { className: 'pss-sheet' },
        e('div', { className: 'pss-top' },
          e('div', null,
            e('div', { className: 'pss-co' }, c.COMPANY_KO || ''),
            e('div', { className: 'pss-title' }, titleOf(m.period))
          ),
          typeLabel(m.runType) ? e('div', { className: 'pss-type' }, typeLabel(m.runType)) : null
        ),
        e('div', { className: 'pss-info' }, infoCells),
        e('div', { className: 'pss-sum' },
          e('div', { className: 'pss-sum-b' },
            e('div', { className: 'pss-sum-l' }, '지급총액'),
            e('div', { className: 'pss-sum-v' }, won(m.totalEarning))),
          e('div', { className: 'pss-sum-b' },
            e('div', { className: 'pss-sum-l' }, '공제총액'),
            e('div', { className: 'pss-sum-v' }, won(m.totalDeduction))),
          e('div', { className: 'pss-sum-b net' },
            e('div', { className: 'pss-sum-l' }, '실지급액'),
            e('div', { className: 'pss-sum-v' }, won(m.netPay)))
        ),
        e('div', { className: 'pss-tbls' + (showMethod ? ' wide' : '') },
          Table('지급 내역', earnings, m.totalEarning, '지급 합계', showMethod),
          Table('공제 내역', deductions, m.totalDeduction, '공제 합계', showMethod)
        ),
        e('div', { className: 'pss-foot' },
          footLines.concat(contact.length ? [contact.join(' · ')] : [], c.ADDRESS ? [c.ADDRESS] : [])
            .filter(function (x) { return x; })
            .map(function (x, i) { return e('div', { key: i }, x); })
        )
      );
    };
  }

  function printRoot() {
    var el = document.getElementById(PRINT_ROOT_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = PRINT_ROOT_ID;
      document.body.appendChild(el);
    }
    return el;
  }

  /** 인쇄 전용 복사본 — body 바로 아래 #pss-print-root 로 포털 렌더. 동시에 하나만 마운트할 것. */
  function createPrintCopy(React, ReactDOM) {
    var Sheet = createSheet(React);
    return function PayslipPrintCopy(props) {
      return ReactDOM.createPortal(React.createElement(Sheet, { model: props.model }), printRoot());
    };
  }

  global.PayslipRender = {
    createSheet: createSheet,
    createPrintCopy: createPrintCopy,
    won: won,
    fmtDate: fmtDate
  };
})(window);
