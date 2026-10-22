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
  CEO_NAMES:      ['강호갑', '이수금'], // 대표이사 (공동대표면 여러 명, 1인 회사는 1명만)
  LOGO_URL:       'logo.png',
  SINCE:          '1987',             // 설립연도

  // ── 연락처 (Contact) ─────────────────────────────────────────
  ADDRESS:          '부산광역시 연제구 거제대로 270, 301호 (거제동, 종근당빌딩)',
  TEL:              '051) 853-2633',
  FAX:              '051) 853-4893',
  EMAIL_DESIGN:     'kwanboeng@naver.com',
  EMAIL_CONTRACT:   'kwanboacc@naver.com',
  MOBILE_NAME:      '강승우 실장',
  MOBILE:           '010-9315-2914',
  MOBILE_TEL:       '01093152914',
  COPYRIGHT_YEAR:   null,

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

  // ── 표시 라벨 (키 = DB 값, 화면 표시만 바꾼다) ─────────────────────
  // full = 필터 칩·입력 창 등 넓은 자리, short = 표 안의 좁은 배지. DB 값은 바꾸지 않는다.
  CATEGORY_LABELS: {
    '관급':     { full: '관급',     short: '관급' },
    '사급':     { full: '사급',     short: '사급' },
    '기술지원': { full: '기술지원', short: '기술지원' },
    '감리':     { full: '감리',     short: '감리' },
  },
  ENTRY_TYPE_LABELS: {            // 수금 내역 entry_type
    both:           { full: '수금',     short: '수금' },
    outsource_only: { full: '외주비만', short: '외주비' },
    supervision:    { full: '감리',     short: '감리' },
  },

  // ── 계약서 자동등록 (project.html 관리 → 새 프로젝트 등록) ────────
  // 나라장터 전자계약서 PDF를 읽어 프로젝트를 등록·변경한다. 우리 회사 판별은 COMPANY_BIZ_NO 를 쓴다.
  CONTRACT_IMPORT: {
    PDF_BUCKET:       'contract-pdfs', // 계약서 원본 보관 Storage 버킷 (supabase/sql/contract_pdfs.sql 로 생성)
    DEFAULT_CATEGORY: '관급',          // 계약서로 등록할 때의 분류
    DEFAULT_STATUS:   '진행중',        // 계약서로 등록할 때의 상태
  },

  // ── 로그인 정책 (화면 안내·검사 기준. 서버 함수와 Supabase Auth 최소 길이도 같은 값으로 맞춘다) ──
  // 직원관리 화면(admin)을 열 때 DB(auth_policy)로 복사되어 서버 함수도 같은 규칙을 쓴다.
  AUTH_POLICY: {
    PASSWORD_MIN_LENGTH: 8,            // 비밀번호 최소 길이 (8 미만으로 내려도 서버는 8을 지킨다)
    LOGIN_ID_MIN: 4,                   // 로그인 아이디 길이 (영문 소문자·숫자)
    LOGIN_ID_MAX: 20,
    LOGIN_ID_REQUIRE_LETTER: true,     // 영문 1자 이상 필수 (숫자만 쓰면 휴대폰 번호와 구분이 안 됨)
    LOGIN_ID_RESERVED: ['admin', 'root', 'test', 'manager', 'payroll'], // 쓸 수 없는 아이디
  },
  MOBILE_MAX_WIDTH: 768,              // 모바일 판별 기준 폭(px) — 이하일 때 모바일 처리

  // ── 오류 안내 문구 ────────────────────────────────────────────
  // Sysbar.showError / Sysbar.writeFailed 가 쓰는 공통 문구.
  // 쓰기 실패(주로 RLS 차단) 시 사용자에게 보이는 텍스트라 여기서 관리한다.
  ERROR_TITLE:      '처리하지 못했습니다',
  ERROR_PERMISSION: '권한이 없습니다. 관리자에게 문의해 주세요.',
  ERROR_GENERIC:    '처리 중 오류가 발생했습니다.',
  ERROR_NO_ROWS:    '대상을 찾을 수 없거나 권한이 없어 변경되지 않았습니다.',

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
  LEAVE_BAR_WIDTH: { '8':'100%', '6':'75%', '4':'50%', '2':'33%' },   // 시간 → 캘린더 바 가로 길이
  LEAVE_BAR_LABEL: { '8':'연차', '6':'3/4일', '4':'반차', '2':'반반차' }, // 시간 → 범례에 표시할 휴가 종류명
  LEAVE_BAR_TAG:   { '6':'6H', '4':'4H', '2':'2H' },                  // 시간 → 캘린더 칩 이름 뒤 표시할 태그. 맵에 없으면 태그 없이 이름만
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

  // ── 급여명세서 (admin-payroll.html / payslip.html) ─────────────
  // 회사명·연락처·주소는 위 회사 정보·연락처 값을 그대로 쓴다.
  PAYROLL: {
    PAY_DAY:          9,              // 급여 지급일(일)
    PAY_MONTH_OFFSET: 1,              // 귀속월 기준 지급월 (1 = 다음 달 지급)
    MAIL_FROM_NAME:    '',            // 알림 메일 발신자 이름. 비우면 COMPANY_SHORT + ' 급여'
    MAIL_FROM_ADDRESS: 'payroll@kwanboeng.com', // 알림 메일 발신 주소 (Resend 인증 도메인이어야 함)
                                      // 회신 주소는 EMAIL_CONTRACT 를 쓴다. 급여 화면을 열 때 이 값들이 DB(payroll_mail_settings)로 복사된다.
    AUTO_SEND:        false,          // 알림 메일 자동 발송(지급일 09:00). false = 관리자가 [알림 메일 발송]을 눌러야만 발송
                                      // true 로 켤 때는 DB 예약 작업도 함께 등록해야 한다(운영 문서 참고)
    SLIP_PAGE:        'payslip.html', // 직원용 명세서 페이지
    // 급여명세서 생년월일 6자리 확인 — 급여 화면을 열 때 DB(payroll_mail_settings)로 복사되어 서버가 쓴다
    SLIP_VERIFY_MAX_FAILS:      5,      // 연속으로 이만큼 틀리면 잠금
    SLIP_VERIFY_LOCK_MINUTES:   10,     // 잠금 시간(분) — 급여관리 → 설정 → 변경 기록에서 바로 해제할 수도 있다
    SLIP_VERIFY_UNLOCK_MINUTES: 10,     // 확인 후 명세서를 볼 수 있는 시간(분). 창을 닫거나 로그아웃하면 바로 다시 잠김
    LEAVER_VIEW_MONTHS: 3,            // 퇴사자가 퇴사일 이후 본인 명세서를 볼 수 있는 개월 수 (0 = 퇴사일 당일까지)
                                      // 기간 안에는 알림 메일도 받는다. 급여 화면을 열 때 DB(payroll_mail_settings)로 복사된다.
    TYPE_LABELS:      { pay: '지급용', report: '신고용' },
    // 급여대장 엑셀 내려받기 ({YYYY} {YY} {MM} {TYPE} {COMPANY} {STATUS} 치환)
    EXCEL_FILE_MONTH:   '급여_{YYYY}-{MM}',      // 이번 달 파일명 (.xlsx 자동)
    EXCEL_FILE_YEAR:    '급여_{YYYY}',           // 연간 파일명
    EXCEL_DRAFT_SUFFIX: '_작성중',               // 작성중 묶음이 하나라도 있으면 파일명 끝에 붙임
    EXCEL_SHEET_NAME:   '{YY}.{MM} {TYPE}',      // 시트 이름 (예: 26.08 지급)
    EXCEL_SHEET_TYPE:   { pay: '지급', report: '신고' },
    EXCEL_TITLE:        '{COMPANY} {YYYY}년 {MM}월 급여대장 ({TYPE}) — {STATUS}', // 시트 1행 제목
    // 편집 표 참고 표시 대상 항목명 (payroll_items.name 과 일치해야 함)
    REF_REPORT_ITEM:   '보고회수당',   // 보고회·위원회 횟수 표시 + '산출방법 채우기' 대상
    REF_OVERTIME_ITEM: '연장근로수당', // 초과근무 시간 표시 (참고만, 자동 입력 없음)
    ALLOWANCE_EVENT_TYPES: ['보고회', '위원회'], // 월별수당·보고회 횟수 집계 대상 일정 유형
    // ── 급여 송금내역 (급여 편집 탭 [📥 엑셀] → 송금내역) ──
    // 은행 업로드용 .xls(비밀번호 없음) / 보관용 .xlsx(비밀번호) 중 골라 내려받는다. 확정된 지급용 묶음만.
    TRANSFER_TITLE:        '급 여  송 금 내 역',         // A1 제목 (원본 글자 그대로)
    TRANSFER_FILE:         '급여송금내역_{YYYY}-{MM}',   // 파일명 (.xls / .xlsx 자동)
    TRANSFER_DEPOSITOR:    { pay: '관보급여', travel: '관보출장비' }, // 입금자명 기본값 (급여·퇴직금 적립 등 = pay)
    // 하단 4줄 — 원본 글자 그대로(자동 띄어쓰기 없음). col = 엑셀 열. 데이터·합계 아래 한 줄 띄우고 차례로 쓴다.
    TRANSFER_FOOTER: [
      { col: 'B', text: '부산광역시  연제구  거제대로 270' },
      { col: 'B', text: '㈜ 관 보 종 합 기 술 단' },
      { col: 'B', text: '대 표 이 사  강   호   갑   (인)' },
      { col: 'C', text: '6 0 4  -  8 1  -  2 9 0 1 7' },
    ],
    MAIN_BANK_CODE:        '032',           // 주거래은행 — 요약에서 따로 집계 (H12 '부산(n)')
    BANK_ORDER: ['032', '020', '004', '092', '090', '081', '011'], // 송금내역 은행 묶음 순서. 목록에 없는 은행은 뒤에 코드순
    RETIREMENT_ITEM:       '퇴직금',        // 퇴직금 적립 기본 금액 = 그 달 명세서의 이 공제 항목 합계
    BANKS: [                                // 송금 계좌 은행 선택 목록 (코드 · 표시 이름)
      { code: '032', name: '부산' },   { code: '039', name: '경남' },   { code: '004', name: '국민' },
      { code: '020', name: '우리' },   { code: '088', name: '신한' },   { code: '081', name: '하나' },
      { code: '011', name: '농협' },   { code: '012', name: '지역농축협' }, { code: '003', name: '기업' },
      { code: '002', name: '산업' },   { code: '007', name: '수협' },   { code: '023', name: 'SC제일' },
      { code: '027', name: '씨티' },   { code: '031', name: 'iM뱅크(대구)' }, { code: '034', name: '광주' },
      { code: '035', name: '제주' },   { code: '037', name: '전북' },   { code: '045', name: '새마을금고' },
      { code: '048', name: '신협' },   { code: '050', name: '저축은행' }, { code: '071', name: '우체국' },
      { code: '089', name: '케이뱅크' }, { code: '090', name: '카카오뱅크' }, { code: '092', name: '토스뱅크' },
    ],
  },

  // ── 시스템 화면 (admin-system.html — 사용량·백업 상태) ──────────────
  //   요금제 한도는 화면 막대의 기준값일 뿐, 실제 한도는 Supabase 요금제를 따른다(요금제를 바꾸면 여기도 맞춘다).
  //   Supabase 대시보드 주소는 SUPABASE_URL 의 프로젝트 ref 로 화면이 만든다(여기 적지 않음).
  SYSTEM: {
    PLAN_NAME:         '무료',
    DB_LIMIT_MB:       500,   // DB 용량 한도
    STORAGE_LIMIT_MB:  1024,  // 파일(Storage) 용량 한도
    FILE_MAX_MB:       50,    // 파일 하나 최대 크기 (안내용)
    EGRESS_LIMIT_GB:   5,     // 한 달 내려받기 한도 — 이 화면에서 조회 불가, 안내용
    BACKUP_ALERT_DAYS: 3,     // 마지막 성공 백업이 이 일수보다 오래되면 경고. 사무실 PC 백업 config.ps1 의 AlertDays 와 같게
  },

};
