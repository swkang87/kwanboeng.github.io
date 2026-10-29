/*
 * doc-defs.js — 서류작성(관리포털) 서류 정의 + 표기 규칙 (화이트라벨 공용)
 *
 * 서류 하나 = 정의 객체 하나. 새 서류는 DEFS 에 정의를 더하고 서식 HWPX 를 doc-templates 버킷에 올리면 된다.
 *   key        서류 종류 코드(발급 이력 doc_type)
 *   template   서식 파일 이름(doc-templates 버킷 안 경로). 서식은 회사별 파일이라 저장소에 두지 않는다.
 *   rows       반복 표 행 {이름:{mergeCol, mergeBy, fit}} — 서식의 {{#행:이름}}. fit = 그 쪽이 원래 담는 행 수(넘으면 빈 줄을 줄임)
 *   pictures   그림 자리 {토큰:{w,h, horzOffset, vertOffset, horzAlign, vertAlign, horzRelTo}} (HWPUNIT, 7200 = 1 inch)
 *              {{이미지:…}} 는 {boxW, boxH} 상자 안에 비율 유지
 *   build(in)  화면 입력 → 엔진 데이터 {title, vars, rows, blocks, warnings}. 그림 값은 화면이 만든 그림 id.
 * 회사명·주소·연락처·결재란·문서번호 접두어는 config.js(COMPANY_*, CEO_NAMES, DOCS)에서 읽는다.
 */
(function (root) {
  'use strict';

  function cfg() { return root.APP_CONFIG || {}; }
  function dcfg() { return cfg().DOCS || {}; }
  function pad(n) { return ('0' + n).slice(-2); }
  function parts(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
    return m ? { y: m[1], m: m[2], d: m[3] } : null;
  }

  /* ---------------- 표기 규칙 ---------------- */
  var F = {
    // 세 글자 이름은 한 칸씩 띄운다: 홍길동 → 홍 길 동
    name: function (s) { s = String(s || '').replace(/\s+/g, ''); return s.length === 3 ? s.split('').join(' ') : s; },
    // 본문 날짜 2026/09/03
    slash: function (d) { var p = parts(d); return p ? p.y + '/' + p.m + '/' + p.d : ''; },
    // 서류 하단 날짜 2026.  09.  03.
    bottom: function (d) { var p = parts(d); return p ? p.y + '.  ' + p.m + '.  ' + p.d + '.' : ''; },
    // 공문 시행일 2026. 09. 03.
    dotted: function (d) { var p = parts(d); return p ? p.y + '. ' + p.m + '. ' + p.d + '.' : ''; },
    // 생년월일 90.01.31
    birth: function (d) { var p = parts(d); return p ? p.y.slice(2) + '.' + p.m + '.' + p.d : ''; },
    // 입사일 09. 03. 03
    hire: function (d) { var p = parts(d); return p ? p.y.slice(2) + '. ' + p.m + '. ' + p.d : ''; },
    // 주민번호 앞자리 + 성별 자리만: 900131-1****** (2000년 이후 출생은 3·4). 전체 번호는 저장하지 않는다.
    rrn: function (d, gender) {
      var p = parts(d); if (!p) return '';
      var g = (+p.y >= 2000 ? 3 : 1) + (gender === 'F' ? 1 : 0);
      return p.y.slice(2) + p.m + p.d + '-' + (gender ? g : '*') + '******';
    },
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
    // 대표이사 표기: [갑, 을] → 갑 외 1인
    ceo: function (names) {
      names = (names || []).filter(Boolean);
      if (!names.length) return '';
      return names.length > 1 ? names[0] + ' 외 ' + (names.length - 1) + '인' : names[0];
    },
    // 회사명: (주)관보종합기술단 → {formal:'(주) 관보종합기술단', spaced:'(주) 관 보 종 합 기 술 단', name:'관보종합기술단'}
    company: function (ko, nameOnly) {
      ko = String(ko || '');
      var m = /^(\([^)]+\))\s*(.+)$/.exec(ko);
      var pre = m ? m[1] + ' ' : '', name = nameOnly || (m ? m[2] : ko);
      return { formal: pre + name, spaced: pre + name.replace(/\s+/g, '').split('').join(' '), name: name };
    },
    // 문서번호: 접두어 + 연도 2자리 + '-' + 번호 + '호' (관보26-191호)
    docNo: function (num, date) {
      num = String(num || '').replace(/\s+/g, '');
      if (!num) return '';
      if (/호$/.test(num) && /\D/.test(num.replace(/호$/, ''))) return num;   // 직접 쓴 전체 번호
      var p = parts(date) || parts(localDate(new Date()));
      return (dcfg().DOC_NO_PREFIX || '') + p.y.slice(2) + '-' + num.replace(/호$/, '') + '호';
    }
  };
  function localDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function companyVars() {
    var c = cfg(), d = dcfg(), co = F.company(c.COMPANY_KO, c.COMPANY_KO_EM);
    var line = d.APPROVAL_LINE || [];
    return {
      '회사명': co.formal, '회사명_이름': co.name, '회사명_자간': co.spaced,
      '대표자': F.ceo(c.CEO_NAMES),
      '서명주소': d.SIGN_ADDRESS || '', '공문주소': d.LETTER_ADDRESS || '', '우편번호': d.ZIP || '',
      '전화': d.TEL || '', '전송': d.FAX || '', '이메일': d.EMAIL || '',
      '결재부서': d.APPROVAL_DEPT || '', '결재1': line[0] || '', '결재2': line[1] || ''
    };
  }

  /* ---------------- 서류 정의 ---------------- */
  // 착수계: 공문(경유처마다) · 착수신고서 · 책임기술자 지정 신고서 · 재직증명서 · 자격증 사본 · 참여기술자 명단 ·
  //         인력 및 장비 투입 계획서 · 보안각서
  var CHAKSU = {
    key: 'chaksu',
    name: '착수계',
    desc: '공문 · 착수신고서 · 책임기술자 지정 · 재직증명서 · 자격증 사본 · 참여기술자 명단 · 인력/장비 투입 계획 · 보안각서',
    template: 'chaksu.hwpx',
    fileName: function (v) { return String(v['용역명'] || '착수계').replace(/[\\\/:*?"<>|]/g, '_') + '_착수계.hwpx'; },
    rows: {
      // fit = 서식 쪽이 원래 담도록 설계된 행 수(샘플 3줄). 넘으면 그 쪽의 빈 줄을 줄여 서명란을 지킨다
      '기술자': { mergeCol: 0, mergeBy: '분야', fit: 3 },
      '장비': { fit: 3 }
    },
    pictures: {
      // 공문 직인: 샘플 공문 직인과 같은 중심·크기(약 18.6mm, 대표이사 줄 위 빈 문단 기준)
      '도장:회사@공문': { w: 5300, h: 5300, horzOffset: 37348, vertOffset: 2382 },
      // 「대표이사 … (印)」 줄: 오른쪽 정렬 문단 끝의 (印) 위, 줄 가운데 높이
      '도장:회사': { w: 4300, h: 4300, horzAlign: 'RIGHT', horzOffset: -1000, vertOffset: -1500, flowWithText: 0 },
      // 재직증명서 표 안: 회사명 줄 기준으로 아래 「대표이사 … (印)」 위 (표 안에서는 위쪽 음수 간격이 안 돼서)
      '도장:회사@칸': { w: 4300, h: 4300, horzAlign: 'RIGHT', horzOffset: 600, vertOffset: 1220 },
      // 보안각서 서명 칸: 칸 가운데
      '도장:기술자': { w: 3700, h: 3700, horzAlign: 'CENTER', horzRelTo: 'PARA', horzOffset: 0, vertAlign: 'CENTER', vertOffset: 0 },
      // 자격증 사본: 원래 그림 상자 안에 비율 유지
      '이미지:자격증': { boxW: 43646, boxH: 37001 }
    },
    // in = { title, amount, contractDate, startDate, endDate, receiver, vias:[{name, docNo}], issueDate, submitDate,
    //        lead:기술자, members:[기술자], certIds:[기술자 id], licenseIds:[기술자 id], equipment:[{name,spec,qty,unit}], sealImg }
    // 기술자 = { id, name, birth_date, gender, address, hire_date, dept, position, duty, field, qual, qual_no, sealImg, certImg }
    build: function (inp) {
      var warnings = [];
      var lead = inp.lead;
      if (!lead) warnings.push('책임기술자를 고르세요.');
      var people = (lead ? [lead] : []).concat(inp.members || []);
      var byId = {}; people.forEach(function (p) { byId[p.id] = p; });
      var vars = companyVars();
      vars['용역명'] = inp.title || '';
      vars['계약금액'] = inp.amountText || F.amount(inp.amount);
      vars['계약일'] = F.slash(inp.contractDate);
      vars['착수일'] = F.slash(inp.startDate);
      vars['완료일'] = F.slash(inp.endDate);
      vars['제출일'] = F.bottom(inp.submitDate || inp.startDate);
      vars['시행일'] = F.dotted(inp.issueDate || inp.startDate);
      vars['수신'] = inp.receiver || '';
      vars['책임기술자'] = lead ? F.name(lead.name) : '';
      vars['도장:회사'] = inp.sealImg || null;
      if (!inp.sealImg) warnings.push('회사 도장이 없습니다.');

      var leadField = dcfg().LEAD_FIELD || '사업책임기술자';
      var rowsTech = people.map(function (p, i) {
        if (!p.sealImg) warnings.push(F.name(p.name) + ': 도장 이미지가 없어 보안각서 서명 칸이 비어요.');
        return {
          '분야': (i === 0 && lead) ? (p.field || leadField) : (p.field || ''),
          '성명': F.name(p.name), '생년월일': F.birth(p.birth_date),
          '자격': p.qual || '', '자격번호': p.qual_no || '',
          '도장:기술자': p.sealImg || null
        };
      });
      var rowsEq = (inp.equipment || []).map(function (q) {
        return { '장비명': q.name || '', '규격': q.spec || '', '수량': (q.qty === null || q.qty === undefined || q.qty === '' ? '' : q.qty) + (q.unit || '') };
      });
      var vias = (inp.vias || []).filter(function (v) { return v && (v.name || v.docNo); });
      if (!vias.length) warnings.push('경유처가 없어 공문이 빠집니다.');
      var blkLetter = vias.map(function (v) { return { '경유': v.name || '', '문서번호': F.docNo(v.docNo, inp.issueDate || inp.startDate) }; });
      var blkCert = (inp.certIds || []).filter(function (id) { return byId[id]; }).map(function (id) {
        var p = byId[id];
        return {
          '성명': F.name(p.name), '생년월일': F.birth(p.birth_date), '주민번호': F.rrn(p.birth_date, p.gender),
          '주소': p.address || '', '입사일': F.hire(p.hire_date), '성별': F.gender(p.gender),
          '부서': p.dept || '', '직위': p.position || '', '담당업무': p.duty || '',
          '재직기간': p.hire_date ? F.hire(p.hire_date) + '. - 현재' : ''
        };
      });
      var blkLic = [];
      (inp.licenseIds || []).forEach(function (id) {
        var p = byId[id]; if (!p) return;
        if (!p.certImg) { warnings.push(F.name(p.name) + ': 자격증 사본 이미지가 없어 그 쪽을 뺐어요.'); return; }
        blkLic.push({ '이미지:자격증': p.certImg });
      });
      return {
        title: (inp.title || '') + ' 착수계',
        vars: vars,
        rows: { '기술자': rowsTech, '장비': rowsEq },
        blocks: { '공문': blkLetter, '재직증명서': blkCert, '자격증': blkLic },
        warnings: warnings
      };
    }
  };

  var DEFS = [CHAKSU];
  var API = { DEFS: DEFS, get: function (key) { return DEFS.filter(function (d) { return d.key === key; })[0] || null; }, F: F };
  root.DocDefs = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
