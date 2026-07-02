/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              WHITE-LABEL CONFIGURATION FILE                  ║
 * ║  이 파일만 수정하면 다른 회사에 동일한 시스템을 납품할 수 있습니다.  ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * 납품 시 체크리스트:
 *  1. 회사 정보 (Company Info) 섹션 수정
 *  2. 연락처 (Contact) 섹션 수정
 *  3. 색상 테마 (Theme Colors) 섹션 수정 (선택)
 *  4. Supabase 프로젝트 새로 생성 후 URL/KEY 교체
 *  5. 메뉴 활성화 여부 (active) 조정
 */

var APP_CONFIG = {

  // ── 회사 정보 (Company Info) ──────────────────────────────────
  COMPANY_KO:     '(주)관보종합기술단',
  COMPANY_KO_EM:  '관보종합기술단',    // em태그 강조 없는 버전
  COMPANY_EN:     'KWANBO ENGINEERING CO., LTD.',
  COMPANY_SHORT:  '관보종합기술단',    // 짧은 이름 (시스템 헤더 등)
  COMPANY_BIZ_NO: '604-81-29017',     // 사업자등록번호 (세금계산서 매입/매출 판별용)
  LOGO_URL:       'logo.png',
  SINCE:          '1987',             // 설립연도

  // ── 연락처 (Contact) ─────────────────────────────────────────
  ADDRESS:          '부산광역시 연제구 거제대로 270, 705호 (거제동, 종근당빌딩)',
  TEL:              '051) 853-2633',
  FAX:              '051) 853-4893',
  EMAIL_DESIGN:     'kwanboeng@naver.com',
  EMAIL_CONTRACT:   'kwanboacc@naver.com',
  MOBILE_NAME:      '강승우 실장',
  MOBILE:           '010-9315-2914',
  MOBILE_TEL:       '01093152914',
  COPYRIGHT_YEAR:   '2025',

  // ── 색상 테마 (Theme Colors) ─────────────────────────────────
  COLOR_PRIMARY:  '#0f172a',   // 메인 네이비 (시스템 UI 기준색)
  COLOR_PRIMARY2: '#1b3a6b',   // 서브 네이비
  COLOR_ACCENT:   '#c41e1e',   // 레드 포인트
  COLOR_GOLD:     '#b8902a',   // 골드 포인트

  // ── Supabase ─────────────────────────────────────────────────
  SUPABASE_URL:   'https://pxtddjilxwomzfsjhmvn.supabase.co',
  SUPABASE_KEY:   'sb_publishable_M2fWxHmHFMLfdtRConOuMg_GfIMv9bS',

  // ── 관리 설정 ─────────────────────────────────────────────────
  ADMIN_TEAM_NAME: '관리팀',          // 관리포털 접근 팀명
  SESSION_PREFIX:  'kwanbo',          // 스토리지 키 prefix
  AUTH_DOMAIN:     'kwanbo.internal', // 로그인 이메일 도메인
  MOBILE_MAX_WIDTH: 768,              // 모바일 판별 기준 폭(px) — 이하일 때 모바일 처리

  // ── 비품관리 결제수단 ─────────────────────────────────────────
  // worklog.html 비품관리 탭의 결제수단 드롭다운 (식대카드 역산 집계용)
  PAYMENT_METHODS: ['식대카드(유현수)','식대카드(이규민)','식대카드(이다빈)','식대카드(이창환)','법인카드','현금'],

  // ── 시스템 메뉴 ───────────────────────────────────────────────
  // active: true  → 클릭 가능
  // active: false → 준비중 표시 (비활성)
  MENUS: [
    {
      icon: '📊',
      name: '공정관리',
      desc: '주간보고·프로젝트 공정 현황',
      url:  'project.html',
      active: true,
    },
    {
      icon: '📅',
      name: '연차관리',
      desc: '연차 신청·조회·잔여일수 확인',
      url:  'leave.html',
      active: true,
    },
    {
      icon: '📝',
      name: '업무일지',
      desc: '일·주간 업무 기록 및 팀 현황 공유',
      url:  'worklog.html',
      active: true,
    },
    {
      icon: '🏢',
      name: '관리포털',
      desc: '실적·급여·직원관리 (관리팀 전용)',
      url:  'admin-portal.html',
      active: true,
    },

  ],

  // ── 시스템 내부 링크 ──────────────────────────────────────────
  HOME_URL: 'home.html',
  INDEX_URL: 'index.html',  // 회사 홈페이지

  // ── EmailJS (급여명세서 발송용) ───────────────────────────────
  // https://www.emailjs.com 에서 가입 후 설정값 입력
  EMAILJS_SERVICE_ID:  'service_1cwama6',
  EMAILJS_TEMPLATE_ID: 'template_358o2dn',
  EMAILJS_PUBLIC_KEY:  'bjJqZiyA9due-lOAL',

};
