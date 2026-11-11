/*
 * doc-defs.js — 서류작성(관리포털) 서류 정의 + 표기 규칙
 *
 * 서류 하나 = 정의 객체 하나. 새 서류는 DEFS 에 정의를 더하고 서식 HWPX 를 doc-templates 버킷에 올리면 된다.
 *   key        서류 종류 코드(발급 이력 doc_type)
 *   template   서식 파일 이름(doc-templates 버킷 안 경로). 서식은 저장소에 두지 않는다.
 *   rows       반복 표 행 {이름:{merge:[{col, by}], fit}} — 서식의 {{#행:이름}}. fit = 그 쪽이 원래 담는 행 수(넘으면 빈 줄을 줄임)
 *   pictures   그림 자리 {토큰:{w,h, horzOffset, vertOffset, horzAlign, vertAlign, horzRelTo}} (HWPUNIT, 7200 = 1 inch)
 *              {{이미지:…}} 는 {boxW, boxH} 상자 안에 비율 유지
 *   build(in)  화면 입력 → 엔진 데이터 {title, vars, rows, blocks, warnings}. 그림 값은 화면이 만든 그림 id.
 * 착수계는 우리 회사 전용 서류다(화이트라벨 아님). 회사명·주소·연락처·결재란·대표이사는 서식 HWPX 에 글자로 들어 있고,
 * 이 파일에는 보유 면허 목록과 문서번호 접두어만 둔다.
 */
(function (root) {
  'use strict';

  function pad(n) { return ('0' + n).slice(-2); }
  function parts(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
    return m ? { y: m[1], m: m[2], d: m[3] } : null;
  }
  function localDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  /* ---------------- 표기 규칙 ---------------- */
  var F = {
    // 세 글자 이름은 한 칸씩 띄운다: 홍길동 → 홍 길 동
    name: function (s) { s = String(s || '').replace(/\s+/g, ''); return s.length === 3 ? s.split('').join(' ') : s; },
    // 본문 날짜 2026/09/03
    slash: function (d) { var p = parts(d); return p ? p.y + '/' + p.m + '/' + p.d : ''; },
    // 서류 하단 날짜 2026.  09.  03.
    bottom: function (d) { var p = parts(d); return p ? p.y + '.  ' + p.m + '.  ' + p.d + '.' : ''; },
    // 공문 시행일 · 재직증명서 생년월일 2026. 09. 03.
    dotted: function (d) { var p = parts(d); return p ? p.y + '. ' + p.m + '. ' + p.d + '.' : ''; },
    // 생년월일 90.01.31
    birth: function (d) { var p = parts(d); return p ? p.y.slice(2) + '.' + p.m + '.' + p.d : ''; },
    // 입사일 09. 03. 03
    hire: function (d) { var p = parts(d); return p ? p.y.slice(2) + '. ' + p.m + '. ' + p.d : ''; },
    gender: function (g) { return g === 'M' ? '남' : (g === 'F' ? '여' : ''); },
    // 숫자 → 한글 금액 (일천·일백은 '일'을 붙이고 십은 그대로: 20,800,000 → 이천팔십만)
    korean: function (n) {
      n = Math.floor(Math.abs(Number(n) || 0));
      if (!n) return '영';
      var D = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'], S = ['', '십', '백', '천'], B = ['', '만', '억', '조', '경'];
      var s = String(n), out = '', gi = 0;
      while (s.length) {
        var g = s.slice(-4); s = s.slice(0, -4);
        var w = '';
        for (var i = 0; i < g.length; i++) {
          var dgt = +g.charAt(i), p = g.length - 1 - i;
          if (!dgt) continue;
          w += (dgt === 1 && p === 1 ? '' : D[dgt]) + S[p];
        }
        if (w) out = w + B[gi] + out;
        gi++;
      }
      return out;
    },
    amount: function (n) {
      if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '';
      return '일금 ' + F.korean(n) + '원정 (￦ ' + Number(n).toLocaleString('ko-KR') + ' )';
    },
    // 수신: 기관명 + 장 (부산광역시 서구 → 부산광역시 서구청장)
    receiver: function (org) {
      org = String(org || '').replace(/\s+/g, ' ').replace(/^\s|\s$/g, '');
      if (!org) return '';
      if (/(청장|시장|군수|도지사|사장|이사장|원장|총장)$/.test(org)) return org;
      if (/구$/.test(org)) return org + '청장';
      if (/군$/.test(org)) return org + '수';
      if (/도$/.test(org)) return org + '지사';
      return org + '장';
    },
    // 경유: 기관관리번호 "건설과-2850" → 건설과장, 담당부서 "재무과" → 재무과장
    viaFromMgmtNo: function (s) { var m = /^\s*([^\s\-]+?(?:과|팀|실|국|소|단|센터))\s*-/.exec(String(s || '')); return m ? m[1] + '장' : ''; },
    viaFromDept: function (s) { s = String(s || '').replace(/\s+/g, ''); return s ? (/장$/.test(s) ? s : s + '장') : ''; },
    // 측량 기술등급: 두 글자는 원본처럼 글자 사이 세 칸 (고급 → 고   급), 그 밖은 그대로 (초급기능사)
    grade: function (g) { g = String(g || '').replace(/\s+/g, ''); return g.length === 2 ? g.charAt(0) + '   ' + g.charAt(1) : g; },
    // 문서번호: 접두어 + 연도 2자리 + '-' + 번호 + '호'
    docNo: function (num, date, prefix) {
      num = String(num || '').replace(/\s+/g, '');
      if (!num) return '';
      if (/호$/.test(num) && /\D/.test(num.replace(/호$/, ''))) return num;   // 직접 쓴 전체 번호
      var p = parts(date) || parts(localDate(new Date()));
      return (prefix || '') + p.y.slice(2) + '-' + num.replace(/호$/, '') + '호';
    }
  };

  /* ---------------- 서류 정의 ---------------- */
  // 착수계: 공문(경유처마다) · 착수신고서 · 책임기술자 지정 신고서 · 재직증명서 · 자격증 사본 · 참여기술자 명단 · 보안각서 ·
  //         (선택) 인력 및 장비 투입 계획서 (제출본 순서, 2026-11-11). 표가 있는 쪽은 일반(면허별) / 측량 단독 두 모양을 서식에 두고 블록으로 고른다.
  var SURVEY = '공공측량업';
  // 보유 면허 (표시 순서 고정): 엔지니어링업 9개 + 공공측량업
  var LICENSES = ['교통', '도로공항', '상하수도', '수질관리', '토질지질', '구조', '도시계획', '수자원개발', '조경', SURVEY];
  var LEAD_FIELD = '사업책임기술자';
  var MERGE2 = [{ col: 0, by: '분야' }, { col: 1, by: '구분키' }];   // 분야 칸 → 그 면허 전체, 구분 칸 → 책임 1줄 / 참여 전체
  // 도장 크기 = 실제 제출본(2026-11, 사람이 만든 착수계)의 인영 크기 대표값. 그림은 화면이 흰 배경을 투명하게 하고 여백을 잘라
  // 넣으므로(seal-prep.js) 그림 크기 = 인영 크기. 제출본 실측(인영): 직인 18.6 · 사용인감 17.5 · 기술자 11.1~12.9mm(대표 12)
  var MM = function (mm) { return Math.round(mm * 7200 / 25.4); };
  var SEAL_CO = MM(17.5);
  // 보안각서 서명 칸(행 높이 16.2mm, 제출본과 같음) 가운데에 가로 12mm · 세로는 비율대로 · 세로 최대 15mm(넘으면 세로 15mm 기준으로 축소).
  // 둥근 도장 = 12×12, 세로로 긴 도장 = 12×15 쯤(제출본 실측 11.7×14.5). 칸 밖 그림(outOfCell)이라 행 높이를 바꾸지 않는다.
  // 줄 높이를 줄여 도장 세로보다 낮아지면(사람이 많을 때) 도장은 그대로 두고 서명 칸 안에서 왼쪽·오른쪽 번갈아(지그재그, v2.8.3 —
  // 동천 제출본 방식: 30mm 칸에 칸 선에서 1mm 안쪽). 줄이 넉넉하면 칸 가운데
  var SEAL_S = { w: MM(12), h: MM(15), outOfCell: true, zigzag: 'auto', zigzagEdge: MM(1) };
  // 사람이 많아 쪽을 넘치면 줄 높이를 줄임(도장 크기는 그대로 — 위 지그재그) — 줄 높이 하한 9.2mm(예전 서식·동천 제출본 줄 높이).
  // cap = 빈 줄을 다 줄였을 때 16.2mm 줄로 담기는 반복 행 수(2026-11-11 한글로 잼: 명단 5 · 보안각서 4). 쪽 맞추기도 9.2mm 까지
  var SQUEEZE_SEC = { cap: 4, minH: 2612 };
  // fitMinH = 용역명이 길어 쪽 맞추기(pageFit)가 더 줄일 때의 하한(7mm — 10pt 한 줄이 드는 높이)
  var SQUEEZE_MAN = { cap: 5, minH: 2329, fitMinH: MM(7) };
  var SQUEEZE_FIT = { cap: 999, fitMinH: MM(7) };
  var ATTACH_MAX = 9;   // 공문 붙임 목록이 한 쪽에 드는 줄 수

  var CHAKSU = {
    key: 'chaksu',
    name: '착수계',
    desc: '공문 · 착수신고서 · 책임기술자 지정 · 재직증명서 · 자격증 사본 · 참여기술자 명단 · 보안각서 · (선택) 인력/장비 투입 계획',
    template: 'chaksu.hwpx',
    // 서식 버전 = 서식 HWPX 가 마지막으로 바뀐 제품 버전. 서식 안 표시(HwpxEngine.templateVersion)와 다르면 화면이 만들기를 막는다.
    // 서식을 바꾸면 여기와 서식 만드는 스크립트(docs-work/node/build_template2.js — 이 값을 읽어 넣음)를 같이 올린다
    templateVersion: '2.8.2',
    // 쪽 맞추기(엔진 pageFit): 용역명 등이 길어 줄이 늘면 그 쪽 빈 줄을 줄이고, 그래도 넘치면 용역명 문단 장평을 85% 까지 줄인다.
    // slack = 아래 ref 값 + 반복 표 fit 행으로 만든 쪽을 이 PC 한글로 열었을 때 맨 아래 줄 밑에 남는 높이(HWPUNIT, 2026-11-11 잼).
    // 서식을 바꾸면 다시 잰다(docs-work/v282/slack.py). 일반 표·측량 단독 표의 여유가 같아 한 줄씩. match = 그 쪽에 든 글자(모두).
    pageFit: {
      ref: { '용역명': '2026년 주요시설물 정기안전점검용역', '수신': '부산광역시 연제구청장',
             '계약금액': '일금 사천사백삼십육만원정 (￦ 44,360,000 )' },
      shrink: ['용역명'],
      ratios: [95, 90, 85],
      minLineSpacing: 130,  // 장평 85% 로도 넘치면 접힌 용역명 문단의 줄 간격을 이 % 까지 낮춘다(경고 전 마지막 단계)
      margin: 100,      // 글 줄이 늘었을 때만 더하는 안전 여유(한글 쪽 끝 판정 오차 ±70)
      pages: [
        { label: '공문', match: ['착수계 제출'], slack: 268 },
        { label: '착수신고서', match: ['착수 신고서'], slack: 91 },
        { label: '책임기술자 지정 신고서', match: ['책임기술자 지정 신고서'], slack: 337 },
        { label: '참여기술자 명단', match: ['참여기술자 명단'], slack: 71 },
        { label: '보안각서', match: ['보안각서'], slack: 2839 },
        { label: '인력 및 장비투입 계획서', match: ['장비 투입 계획서'], slack: 261 }
      ]
    },
    licenses: LICENSES,
    survey: SURVEY,
    docNoPrefix: '관보',
    // 따로 붙이는 서류(붙임 목록에만 올림): 기본 체크 여부
    attachments: [
      { key: 'schedule', label: '예정공정표', on: true },
      { key: 'bill', label: '도급내역서', on: true },
      { key: 'cems', label: 'CEMS 입력증명서', on: false }
    ],
    docNo: function (num, date) { return F.docNo(num, date, CHAKSU.docNoPrefix); },
    isSurveyOnly: function (lics) { return !!lics && lics.length === 1 && lics[0].name === SURVEY; },
    fileName: function (v) { return String(v['용역명'] || '착수계').replace(/[\\\/:*?"<>|]/g, '_') + '_착수계.hwpx'; },
    rows: {
      // fit = 그 쪽이 빈 줄을 줄이지 않고 담는 반복 행 수(사업책임 줄 제외, 2026-11-11 서식 2.8.1 을 한글로 잼: 명단·보안각서 2).
      // fit 을 넘으면 넘친 높이만큼 표 아래 빈 줄을 줄여 서명란을 지키고, squeeze.cap 을 넘으면 줄 높이도 함께 줄인다(하한까지)
      '명단': { merge: MERGE2, fit: 2, squeeze: SQUEEZE_MAN, label: '참여기술자 명단' },
      '보안': { merge: MERGE2, fit: 2, squeeze: SQUEEZE_SEC, label: '보안각서 서명표' },
      '인력': { merge: MERGE2, fit: 2, squeeze: { cap: 6, minH: 2329, fitMinH: MM(7) }, label: '인력투입 계획서' },
      // 측량 단독 표: 미리 줄이지 않고(cap 없음) 쪽 맞추기가 넘칠 때만 줄 높이를 줄인다(하한 fitMinH)
      '측량명단': { merge: [{ col: 0, by: '분야' }], fit: 3, squeeze: SQUEEZE_FIT, label: '참여기술자 명단' },
      '측량보안': { merge: [{ col: 0, by: '분야' }], fit: 3, squeeze: SQUEEZE_SEC, label: '보안각서 서명표' },
      '측량인력': { merge: [{ col: 0, by: '분야' }], fit: 3, squeeze: SQUEEZE_FIT, label: '인력투입 계획서' },
      '장비': { fit: 3 },
      // 붙임 목록: 9줄까지 서식 간격 그대로(제출본 9줄). 넘으면 build 가 두 줄을 합치고, 그래도 넘으면 「대표이사」 줄 아래 빈 줄만 줄인다
      // (표 바로 아래 빈 줄은 공문 직인 자리라 그대로. 글 줄은 한글이 내용 높이보다 낮게 줄이지 않아 squeeze 는 안 씀)
      '붙임': { fit: 9, spacerAfter: '대표이사' }
    },
    pictures: {
      // 공문 직인: 샘플 공문 직인과 같은 중심(대표이사 줄 위 빈 문단 기준), 인영 18.6mm(제출본과 같음)
      '도장:회사@공문': { w: MM(18.6), h: MM(18.6), horzOffset: 37348 + Math.round((5300 - MM(18.6)) / 2), vertOffset: 2382 + Math.round((5300 - MM(18.6)) / 2) },
      // 「대표이사 … (印)」 줄: 오른쪽 정렬 문단 끝의 (印) 가운데, 줄 가운데 높이 — 인영 17.5mm
      '도장:회사': { w: SEAL_CO, h: SEAL_CO, horzAlign: 'RIGHT', horzOffset: -1350, vertOffset: -1850, flowWithText: 0 },
      // 재직증명서 표 안: 회사명 줄 기준으로 아래 「대표이사 … (印)」 위
      '도장:회사@칸': { w: SEAL_CO, h: SEAL_CO, horzAlign: 'RIGHT', horzOffset: 530, vertOffset: 1320 },
      // 자격증 사본 「원본대조필」 옆 빈 칸(떠 있는 표 안) — 칸 가운데(제출본과 같은 자리). 한글은 이 그림을 쪽 본문 왼쪽(가로)·
      // 표가 든 바깥 문단(세로) 기준으로 놓는다 → 칸 가운데 = 본문 왼쪽 기준 160.25mm, 문단 위에서 10.75mm(한글 PDF 로 잼). 그림은 글과 함께 움직이지 않아 칸이 커지지 않음
      '도장:회사@대조': { w: SEAL_CO, h: SEAL_CO, horzOffset: MM(160.25) - Math.round(SEAL_CO / 2), flowWithText: 0, vertOffset: MM(10.75) - Math.round(SEAL_CO / 2) },
      // 보안각서 서명 칸(일반·측량 모두 행 높이 16.2mm): 칸 가운데 12mm
      '도장:기술자': SEAL_S,
      '도장:기술자@작게': SEAL_S,
      '도장:사업책임@작게': SEAL_S,
      // 자격증 사본: 원래 그림 상자 안에 비율 유지
      '이미지:자격증': { boxW: 43646, boxH: 37001 }
    },
    // in = { title, amount, amountText, contractDate, startDate, endDate, receiver, vias:[{name, docNo}], issueDate, submitDate,
    //        lead:기술자, licenses:[{name, lead:기술자, members:[기술자]}], plan:불(인력·장비 투입 계획서 포함),
    //        equipment:[{name,spec,qty,unit}], attach:{schedule, bill, cems}, sealImg(서류 도장), letterSealImg(공문 도장),
    //        certSeparate:불(사업책임기술자 자격증 사본 그림이 없을 때 「따로 붙임」 — 붙임 문구를 그대로 둠),
    //        certJoin:불(붙임에 「재직증명서, 자격증 사본」 한 줄 — 기본은 제출본처럼 두 줄) }
    // 기술자 = { id, name, birth_date, gender, address, hire_date, dept, position, duty, qual, qual_no,
    //           survey_field, survey_grade, sealImg, certImg }
    build: function (inp) {
      var warnings = [];
      var lead = inp.lead;
      if (!lead) warnings.push('사업책임기술자를 고르세요.');
      var lics = (inp.licenses || []).filter(function (l) { return l && l.name; });
      var surveyOnly = CHAKSU.isSurveyOnly(lics);

      var vars = {};
      vars['용역명'] = inp.title || '';
      vars['계약금액'] = inp.amountText || F.amount(inp.amount);
      vars['계약일'] = F.slash(inp.contractDate);
      vars['착수일'] = F.slash(inp.startDate);
      vars['완료일'] = F.slash(inp.endDate);
      vars['제출일'] = F.bottom(inp.submitDate || inp.startDate);
      vars['시행일'] = F.dotted(inp.issueDate || inp.startDate);
      vars['수신'] = inp.receiver || '';
      vars['책임기술자'] = lead ? F.name(lead.name) : '';
      vars['사업_성명'] = lead ? F.name(lead.name) : '';
      vars['사업_생년월일'] = lead ? F.birth(lead.birth_date) : '';
      vars['사업_자격'] = lead ? (lead.qual || '') : '';
      vars['사업_자격번호'] = lead ? (lead.qual_no || '') : '';
      vars['도장:사업책임'] = lead ? (lead.sealImg || null) : null;
      // 회사 도장 두 자리: 공문 직인 자리(도장:회사@공문) = 공문 도장, 나머지 (印) 자리 = 서류 도장
      vars['도장:회사'] = inp.sealImg || null;
      vars['도장:회사@공문'] = inp.letterSealImg || null;
      if (!inp.sealImg) warnings.push('서류 도장이 없어요(고르지 않았거나 그림이 없음) — 「대표이사 (印)」 자리가 비어요.');

      // 같은 사람이 여러 자리에 → 경고만 (측량 단독의 사업책임 = 공공측량업 책임은 같은 자리로 본다)
      var seen = {}, dup = {};
      function seat(p) { if (!p) return; if (seen[p.id]) dup[p.id] = p; seen[p.id] = true; }
      seat(lead);
      lics.forEach(function (l) {
        if (!l.lead) warnings.push(l.name + ': 책임기술자를 고르세요.');
        if (!(surveyOnly && lead && l.lead && l.lead.id === lead.id)) seat(l.lead);
        (l.members || []).forEach(seat);
      });
      Object.keys(dup).forEach(function (id) { warnings.push(F.name(dup[id].name) + ': 여러 자리에 들어 있어요. 확인하세요.'); });

      // 도장 없는 사람 · 자격번호 없는 사람 — 한 줄에 모아서(한 사람은 한 번)
      var noSeal = {}, noSealN = [], noNo = {}, noNoN = [];
      var everyone = [lead];
      lics.forEach(function (l) { everyone.push(l.lead); (l.members || []).forEach(function (m) { everyone.push(m); }); });
      everyone.forEach(function (p) {
        if (p && !p.sealImg && !noSeal[p.id]) { noSeal[p.id] = true; noSealN.push(F.name(p.name)); }
      });
      if (noSealN.length) warnings.push('도장 그림이 없는 기술자: ' + noSealN.join(', ') + ' — 보안각서 서명 칸이 비어요.');
      function needNo(p) { if (p && !p.qual_no && !noNo[p.id]) { noNo[p.id] = true; noNoN.push(F.name(p.name)); } }

      // 공공측량업 줄(일반 표): 학력,자격증 칸 = 측량 기술등급 분야, 자격증번호 칸 = 등급. 등급이 없으면 대표 자격·번호 + 경고
      function surveyQual(p) {
        if (p.survey_grade) return [p.survey_field || '', p.survey_grade];
        warnings.push(F.name(p.name) + ': 측량 기술등급이 없어 ' + SURVEY + ' 줄에 대표 자격을 넣었어요.');
        return [p.qual || '', p.qual_no || ''];
      }
      // 일반(면허별) 표: 면허마다 책임 1줄 + 참여 N줄
      var rowsGen = [];
      if (!surveyOnly) lics.forEach(function (l) {
        var ppl = (l.lead ? [[l.lead, '책임']] : []).concat((l.members || []).map(function (m) { return [m, '참여']; }));
        ppl.forEach(function (pr) {
          var p = pr[0], q = l.name === SURVEY ? surveyQual(p) : [p.qual || '', p.qual_no || ''];
          if (l.name !== SURVEY) needNo(p);
          rowsGen.push({
            '분야': l.name, '구분': pr[1], '구분키': l.name + '|' + pr[1],
            '성명': F.name(p.name), '생년월일': F.birth(p.birth_date),
            '자격': q[0], '자격번호': q[1],
            '도장:기술자': p.sealImg || null
          });
        });
      });
      // 측량 단독 표: 사업책임기술자 + 참여기술자(세로 병합)
      var rowsSv = [];
      if (surveyOnly && lead) {
        [[lead, LEAD_FIELD]].concat((lics[0].members || []).map(function (m) { return [m, '참여기술자']; })).forEach(function (pr) {
          var p = pr[0];
          if (!p.survey_grade) warnings.push(F.name(p.name) + ': 측량 기술등급이 없어요. 명부에서 넣어 주세요.');
          rowsSv.push({
            '분야': pr[1], '성명': F.name(p.name), '생년월일': F.birth(p.birth_date),
            '기술등급분야': p.survey_field || '', '등급': F.grade(p.survey_grade), '도장:기술자': p.sealImg || null
          });
        });
      }
      if (!surveyOnly) needNo(lead);
      if (noNoN.length) warnings.push('자격번호가 없는 기술자: ' + noNoN.join(', ') + ' — 명단 표 자격증번호 칸이 비어요(명부에서 넣어 주세요).');
      var rowsEq = (inp.equipment || []).map(function (q) {
        return { '장비명': q.name || '', '규격': q.spec || '', '수량': (q.qty === null || q.qty === undefined || q.qty === '' ? '' : q.qty) + (q.unit || '') };
      });
      if (inp.plan && !rowsEq.length) warnings.push('인력 및 장비 투입 계획서에 장비가 없어요.');

      // 붙임 목록: 실제 넣은 서류 순서대로 번호, 마지막 줄 끝에 「끝.」. 순서는 제출본(2026-11)과 같게 —
      // 재직증명서 · 자격증 사본(따로 쓰기가 기본, certJoin 이면 한 줄) · 명단 · 보안각서 · 인력 및 장비투입계획서(서류도 이 순서) · 따로 붙이는 서류
      var at = inp.attach || {};
      // 사업책임기술자 자격증 사본 그림이 없으면 그 쪽이 빠지므로 자격증 사본은 목록에서 뺀다(「따로 붙임」을 고르면 그대로 둠)
      var noCert = !!lead && !lead.certImg;
      var withCert = !noCert || !!inp.certSeparate;
      var names = ['착수신고서', '과업 책임기술자 선임계'];
      if (inp.certJoin) names.push(withCert ? '재직증명서, 자격증 사본' : '재직증명서');
      else { names.push('재직증명서'); if (withCert) names.push('자격증 사본'); }
      names.push('분야별 참여 기술자 명단', '보안각서');
      if (inp.plan) names.push('인력 및 장비투입계획서');
      CHAKSU.attachments.forEach(function (a) { if (at[a.key]) names.push(a.label); });
      // 공문 한 쪽에 붙임은 9줄까지 들어간다(2026-11-11 한글로 잼 — 10줄이면 결재란 끝줄이 다음 쪽으로). 넘으면 두 줄을 합친다
      var iJ = names.indexOf('재직증명서');
      if (names.length > ATTACH_MAX && iJ >= 0 && names[iJ + 1] === '자격증 사본') {
        names.splice(iJ, 2, '재직증명서, 자격증 사본');
        warnings.push('붙임이 ' + (names.length + 1) + '줄이라 공문 한 쪽을 넘어 「재직증명서, 자격증 사본」을 한 줄로 합쳤어요.');
      }
      if (names.length > ATTACH_MAX) warnings.push('붙임이 ' + names.length + '줄이라 공문 결재란이 다음 쪽으로 넘어갈 수 있어요. 한글에서 확인하세요.');
      var rowsAt = names.map(function (n, i) {
        return { '붙임머리': i === 0 ? '붙임' : '', '번호': (i + 1) + '.', '붙임': n, '부수': i === names.length - 1 ? '1부.     끝.' : '1부.' };
      });

      var vias = (inp.vias || []).filter(function (v) { return v && (v.name || v.docNo); });
      if (!vias.length) warnings.push('경유처가 없어 공문이 빠집니다.');
      else if (!inp.letterSealImg) warnings.push('공문 도장이 없어요(고르지 않았거나 그림이 없음) — 공문 직인 자리가 비어요.');
      vias.forEach(function (v) {
        if (!String(v.docNo || '').trim()) warnings.push('경유 「' + (v.name || '(이름 없음)') + '」: 문서번호가 비어 있어요.');
        if (!String(v.name || '').trim()) warnings.push('문서번호 ' + v.docNo + ' 의 경유처 이름이 비어 있어요.');
      });
      var blkLetter = vias.map(function (v) { return { '경유': v.name || '', '문서번호': CHAKSU.docNo(v.docNo, inp.issueDate || inp.startDate) }; });
      // 재직증명서·자격증 사본: 사업책임기술자 1명. 재직증명서에는 주민등록번호 칸이 없고 생년월일만(네 자리 연도 1977. 03. 28.)
      var blkCert = lead ? [{
        '성명': F.name(lead.name), '생년월일': F.dotted(lead.birth_date),
        '주소': lead.address || '', '입사일': F.hire(lead.hire_date), '성별': F.gender(lead.gender),
        '부서': lead.dept || '', '직위': lead.position || '', '담당업무': lead.duty || '',
        '재직기간': lead.hire_date ? F.hire(lead.hire_date) + '. - 현재' : ''
      }] : [];
      var blkLic = [];
      if (lead) {
        if (lead.certImg) blkLic.push({ '이미지:자격증': lead.certImg });
        else warnings.push(F.name(lead.name) + ': 자격증 사본 그림이 없어 자격증 쪽이 빠져요 — ' +
          (inp.certSeparate ? '붙임 목록의 「자격증 사본」은 그대로(따로 붙임).' : '붙임 목록에서 「자격증 사본」을 뺐어요.'));
      }
      var one = [{}], none = [];
      return {
        title: (inp.title || '') + ' 착수계',
        vars: vars,
        rows: {
          '명단': rowsGen, '보안': rowsGen, '인력': rowsGen,
          '측량명단': rowsSv, '측량보안': rowsSv, '측량인력': rowsSv,
          '장비': rowsEq, '붙임': rowsAt
        },
        blocks: {
          '공문': blkLetter, '재직증명서': blkCert, '자격증': blkLic,
          '인력장비_일반': inp.plan && !surveyOnly ? one : none, '인력장비_측량': inp.plan && surveyOnly ? one : none,
          '명단_일반': surveyOnly ? none : one, '명단_측량': surveyOnly ? one : none,
          '보안_일반': surveyOnly ? none : one, '보안_측량': surveyOnly ? one : none
        },
        attachList: names,
        noCert: noCert,
        surveyOnly: surveyOnly,
        warnings: warnings
      };
    }
  };

  var DEFS = [CHAKSU];
  var API = { DEFS: DEFS, get: function (key) { return DEFS.filter(function (d) { return d.key === key; })[0] || null; }, F: F };
  root.DocDefs = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
