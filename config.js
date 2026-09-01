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

  // ── 팀 색상 (Team Colors) ─────────────────────────────────────
  // 팀 구성과 색상은 회사마다 다르므로 여기서 관리한다.
  // 참조: leave.html(팀 캘린더 칩·범례), home.html(연차 현황 칩)
  // 키는 teams 테이블의 팀명(name)과 정확히 일치해야 한다.
  TEAM_COLORS: {
    '설계1팀': '#2563eb',
    '설계2팀': '#059669',
    '지반팀':  '#d97706',
    '관리팀':  '#7c3aed',
  },
  TEAM_COLOR_DEFAULT: '#94a3b8',  // 매핑에 없는 팀 / 팀 미배정 직원의 색상

  // ── 연차 캘린더 (leave.html) ──────────────────────────────────
  // 하루 셀에 연차자 칩을 몇 명까지 보일지 / 어떻게 배치할지
  LEAVE_CALENDAR_MAX_VISIBLE:     null,  // null = 전원 표시, 숫자 N = N명 초과분을 '+N'으로 접기
  LEAVE_CALENDAR_CHIP_COLUMNS:    1,     // 칩 배치 열 수 (1 또는 2). 모바일에서는 폭 부족으로 항상 1열
  LEAVE_CALENDAR_CELL_MIN_HEIGHT: 62,    // 월간 캘린더 날짜 칸 최소 높이(px). 인원이 많으면 자동으로 늘어남
  LEAVE_CALENDAR_NAME_MAX_CHARS:  3,     // 모바일 칩 이름 절단 글자수. null = 절단 없음

  // 휴가 바(막대) 길이 — 반차 기준 시간이 회사마다 다르므로 '시간' 을 키로 매핑한다.
  LEAVE_DAY_HOURS: 8,                    // 1일(연차 1개) 기준 근무시간. days 값 → 시간 환산에 사용
  LEAVE_BAR_WIDTH: { '8':'100%', '6':'83%', '4':'66%', '2':'33%' },   // 시간 → 캘린더 바 가로 길이
  LEAVE_BAR_LABEL: { '8':'연차', '6':'3/4일', '4':'반차', '2':'반반차' }, // 시간 → 범례에 표시할 휴가 종류명
  LEAVE_BAR_MIN_WIDTH: 0,                // 바 최소 폭(px). 0 = 제한 없음(길이 차등을 그대로 살림)
  LEAVE_CALENDAR_MAX_WIDTH: 1080,        // 캘린더 화면 전용 최대 폭(px). 모바일에서는 미적용

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
