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

const APP_CONFIG = {

  // ── 회사 정보 (Company Info) ──────────────────────────────────
  COMPANY_KO:     '(주)관보종합기술단',
  COMPANY_KO_EM:  '관보종합기술단',    // em태그 강조 없는 버전
  COMPANY_EN:     'KWANBO ENGINEERING CO., LTD.',
  COMPANY_SHORT:  '관보종합기술단',    // 짧은 이름 (시스템 헤더 등)
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
  COLOR_PRIMARY:  '#0d2044',   // 메인 네이비
  COLOR_PRIMARY2: '#1b3a6b',   // 서브 네이비
  COLOR_ACCENT:   '#c41e1e',   // 레드 포인트
  COLOR_GOLD:     '#b8902a',   // 골드 포인트

  // ── Supabase ─────────────────────────────────────────────────
  SUPABASE_URL:   'https://pxtddjilxwomzfsjhmvn.supabase.co',
  SUPABASE_KEY:   'sb_publishable_M2fWxHmHFMLfdtRConOuMg_GfIMv9bS',

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
    {
      icon: '✅',
      name: '전자결재',
      desc: '기안·결재·문서함 관리',
      url:  null,
      active: false,
    },
    {
      icon: '🕐',
      name: '근태관리',
      desc: '출퇴근 기록 및 초과근무 신청',
      url:  null,
      active: false,
    },
  ],

  // ── 시스템 내부 링크 ──────────────────────────────────────────
  HOME_URL: 'index.html',

  // ── EmailJS (급여명세서 발송용) ───────────────────────────────
  // https://www.emailjs.com 에서 가입 후 설정값 입력
  EMAILJS_SERVICE_ID:  '',   // 예: 'service_xxxxxxx'
  EMAILJS_TEMPLATE_ID: '',   // 예: 'template_xxxxxxx'
  EMAILJS_PUBLIC_KEY:  '',   // 예: 'xxxxxxxxxxxxxxx'

};
