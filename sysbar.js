/**
 * SYSBAR MODULE v3.20
 * 모든 페이지 공통: 네비게이션 CSS + React 컴포넌트
 *
 * v3.20 (2026-11-16): 휴대폰 앱(PWA) — manifest·홈 화면 메타 넣기 · 서비스워커(sw.js) 등록·비상 해제 · 새 버전 안내 ·
 *   설치 안내(서랍 「앱 설치」 · 안내 띠 · 설치 창) · 연차 결재 알림 켜기/끄기(웹 푸시) · 앱 아이콘 숫자. Sysbar.Pwa. APP_VERSION 2.11.0
 * v3.18 (2026-11-11): checkUpload 가 BMP 도 받을 수 있다(kinds 에 'bmp' — 받은 화면이 PNG 로 바꿔 올림). APP_VERSION 2.8.1
 * v3.17 (2026-11-09): 업무관리 하위 「서류작성」(docs.html — 다른 화면). SECTION_TABS 항목에 url(다른 화면으로 가는 하위 항목) ·
 *   guest:false(비회원 둘러보기에서 뺌). sectionTabs 가 url 도 돌려준다. APP_VERSION 2.8.0
 * v3.16 (2026-11-03): 데스크탑 앱(1.2.0) 안에서만 — 왼쪽 메뉴 「파일」(앱 내장 파일 탐색기 창, 앱 명령 desk_open_files) ·
 *   트레이 「파일」이 부르는 __kbDeskOpenFiles(잠겨 있으면 해제 뒤에 연다). APP_VERSION 2.7.0
 * v3.15 (2026-11-03): 데스크탑 앱 안에서만 — 시작·「지금 잠그기」 화면 잠금(__kbDeskLock, 비밀번호 다시 확인 · 5번 틀리면 로그아웃) ·
 *   트레이 숫자(desk_badge = 결재 대기 total). 공용 Auth.recheckPassword(급여명세서 본인 확인도 이것 — 생년월일 대체). APP_VERSION 2.6.0
 * v3.14 (2026-11-02): 데스크탑 앱(Tauri) 안에서만 — 연차 결재 대기 알림 감시(startDesktopWatch) · 로그인 유지(1시간 비활동 로그아웃 없음,
 *   앱 재실행 때 localStorage 사본으로 복원 후 서버 확인). 일반 브라우저에서는 동작 없음. APP_VERSION 2.5.0
 *
 * v3.13 (2026-11-02): 메인 메뉴 「업무일지」 → 「업무관리」(SYS_MENUS label · 권한 탭 그룹 이름). APP_VERSION 2.4.6
 *
 * v3.12 (2026-10-29): checkUpload(file, kinds, maxMB) — 올릴 파일을 실제 바이트로 확인(png·jpg·pdf·hwpx) → 표준 MIME + ArrayBuffer.
 *   File 을 그대로 올리면 supabase-js 가 contentType 대신 브라우저 file.type 을 써서 한컴 MIME 등이 버킷에서 거부된다
 *
 * v3.11 (2026-10-29): APP_VERSION 2.4.0 — 착수계 개편(면허별 기술자 · 측량 단독 서식). sysbar 동작 변경 없음
 *
 * v3.10 (2026-10-29): 관리포털 「서류작성」(admin-docs.html, 권한 키 docs) — PERM_DEFS · PORTAL_PAGES 'dc' · SIDE_ICONS.doc
 *
 * v3.9 (2026-10-27): 급여 열람 기록 — logPayrollAccess(sb, action, opts). DB payroll_access_logs 에 한 줄(행위자·일시는 DB 가 채움).
 *   실패해도 화면 동작을 막지 않음(콘솔 경고만). 열람 행동은 같은 기록을 짧은 시간 안에 다시 남기지 않음(PAYROLL.ACCESS_LOG.DEDUP_*)
 *
 * v3.8 (2026-10-26): 비회원 모드 — SysBar guest prop(guest.html). 서버 호출 0, sb 없이 동작. 메뉴 = SYS_MENUS − GUEST.HIDDEN_MENUS,
 *   하위 = SECTION_TABS 의 관리자·팀장·직원 탭 합집합(guestSectionTabs). 누르면 이동 없이 onGuestBlocked(key, title). 펼침 기억은 별도 키
 *
 * v3.7 (2026-10-23): 지금 화면의 상위 메뉴도 접기(열 때는 펼침, 접은 상태는 저장 안 함) · APP_VERSION(제품 버전, 회사명 아래 표시)
 *
 * v3.6 (2026-10-23): 연차 결재 대기 건수 — loadApprovals/refreshApprovals/approvalCounts/approvalBadges(DB my_pending_approvals,
 *   sessionStorage 1분 캐시). 왼쪽 메뉴 「연차관리」 상위·하위(팀원 결재·승인 관리) · 휴대폰 상단 막대 숫자(모든 화면). 다른 부서로 보기 중엔 숨김
 *
 * v3.5.1 (2026-10-23): 연차 탭 「휴가 계획」(plan) 추가, SIDE_ICONS.flag
 *
 * v3.5 변경사항 (왼쪽 메뉴 토글, 2026-10-23):
 *  - SECTION_TABS · sectionTabs(section, user): 공정관리·연차·업무일지 화면 안 탭 정의의 유일한 출처(직급·권한 규칙 포함)
 *  - 하위가 있는 상위 메뉴(공정관리·연차관리·업무일지·내 정보관리·관리포털)는 누르면 펼치기/접기만(이동 없음).
 *    하위 항목을 눌러야 이동: 같은 화면이면 onSubChange(탭 전환), 다른 화면이면 page.html#탭키. 메인메뉴는 바로 이동
 *  - 여러 개 동시에 펼침, PC별 기억(localStorage SESSION_PREFIX + '_side_open'). 지금 화면의 메뉴는 항상 펼침
 *  - SysBar props: subTabs 없앰 → subBadges({탭키: 숫자}, 그 화면에서만). 다른 화면 하위 목록은 권한을 다시 읽은 뒤에 그림
 *
 * v3.4 변경사항 (기능 권한 표 2차, 2026-10-22):
 *  - PERM_DEFS 에 공정관리·연차·업무일지·메인메뉴 키 9개 + group(권한 탭 묶음). PERM_GROUPS
 *  - loadPerms: 같은 계정의 동시 호출은 한 번만 보낸다(화면 + 메뉴)
 *
 * v3.3 변경사항 (왼쪽 메뉴 하위 탭, 2026-10-22):
 *  - SysBar props subTabs([{key,label,svg?,badge?}]) · activeSub · onSubChange(key)
 *    화면이 자기 탭 목록(직급별로 이미 계산된 것)을 넘기면 왼쪽 메뉴의 현재 메뉴 아래에 하위 항목으로 그린다.
 *  - 지금 보고 있는 메뉴만 펼친다(아코디언). 관리포털 하위 6개도 관리포털 화면에서만 펼침
 *  - 메인 메뉴 「급여명세서」 → 「내 정보관리」(me.html). 하위(고정) = 내 정보 · 급여명세서
 *  - PC 에서 화면 탭 줄(.sys-page-tabs) 숨김. 휴대폰은 그대로(열 때 선택된 탭으로 가로 스크롤)
 *  - hashTab(): 화면 안 탭 주소(#탭키) 읽기
 *
 * v3.2 변경사항 (기능 권한 표, 2026-10-22):
 *  - PERM_DEFS · loadPerms(sb) · can(key) · canPortal() — DB has_perm()/my_perms() 결과로 메뉴·버튼 판정
 *  - PORTAL_PAGES.need = 기능 권한 키. portalPerms(팀명 기준 판정)는 없앰
 *  - 관리자 「다른 부서로 보기」(왼쪽 메뉴 아래 선택 상자 + 화면 맨 위 띠). SysBar 에 sb prop 을 넘긴다
 *
 * v3.1 변경사항 (왼쪽 메뉴):
 *  - PC(MOBILE_MAX_WIDTH 초과, 기본 769px~): 상단 막대 대신 왼쪽 고정 메뉴. [ 키 · 손잡이로 완전히 숨기기 (PC별 기억)
 *  - 휴대폰·태블릿(MOBILE_MAX_WIDTH 이하): 기존 상단 막대 그대로
 *  - 관리포털 하위 화면(PORTAL_PAGES) · 권한 판정(portalPerms)을 여기로 통합
 *  - CSS 변수 --sysbar-h: 각 화면 sticky top 기준 (PC 0 / 휴대폰 38px)
 *
 * v3.0 변경사항 (Phase 3 — Supabase Auth 도입):
 *  - 로그인: doLoginFetch(PBKDF2) → signInWithPassword(Supabase Auth JWT)
 *  - 인증: x-user-id/x-user-role 헤더 제거 → JWT 자동 처리
 *  - _makeSb() extraHeaders 제거 → createClient 단순화
 *  - hashPassword/verifyPassword/isPlainPassword 제거
 *  - Auth 성공 후 users 테이블에서 프로필(name,role,team_id 등) 조회
 *  - SessionManager 타임아웃/경고 토스트 유지
 *  - 브루트포스 방어 유지 (localStorage 기반)
 *
 * v2.4 변경사항 (Bundle E — 보안 강화):
 *  - Auth.checkBruteForce / recordFailure / clearFailures 추가
 *    → 5회 실패 시 30초 잠금 (localStorage 기반)
 */
(function(global) {
  'use strict';

  var _prefix = (global.APP_CONFIG && global.APP_CONFIG.SESSION_PREFIX) ? global.APP_CONFIG.SESSION_PREFIX : 'kwanbo';
  var SESSION_KEY = _prefix + '_session';

  // ── ERP 제품 버전 (2026-10-23~) — 회사별 값이 아니라 제품 값이다. 다른 회사에 납품해도 같은 코드 = 같은 버전.
  //   config.js 에 두지 않는다. sysbar.js?v= (브라우저 캐시 값)와 섞지 않는다. 올리는 규칙·기록은 CLAUDE.md 「버전」.
  var APP_VERSION = '2.11.0';

  // icon = 휴대폰 상단 막대(이모지), svg = PC 왼쪽 메뉴(선 아이콘, SIDE_ICONS 키)
  var SYS_MENUS = [
    { key:'home',    icon:'🏠', svg:'home',    label:'메인메뉴', url:'home.html' },
    { key:'project', icon:'📊', svg:'project', label:'공정관리', url:'project.html' },
    { key:'leave',   icon:'📅', svg:'cal',     label:'연차관리', url:'leave.html'   },
    { key:'worklog', icon:'📝', svg:'note',    label:'업무관리', url:'worklog.html' },
    // 내 정보관리: 하위가 화면이 아니라 고정 링크다(subs). 급여명세서 화면에서도 이 메뉴가 펼쳐진다(activeKey 'me', activeSub 'payslip')
    { key:'me',      icon:'👤', svg:'user',    label:'내 정보관리', url:'me.html', subs:[
      { key:'info',    svg:'user', label:'내 정보',   href:'me.html' },
      { key:'payslip', svg:'won',  label:'급여명세서',
        href:(global.APP_CONFIG && global.APP_CONFIG.PAYROLL && global.APP_CONFIG.PAYROLL.SLIP_PAGE) || 'payslip.html' },
    ] },
    { key:'admin',   icon:'🏢', svg:'admin',   label:'관리포털', url:'admin-worklog.html', adminOnly:true },
  ];
  // 협력업체가 열 수 있는 메뉴(나머지는 누르면 안내). 내 정보관리 안 급여명세서는 막힌다(급여명세서 화면도 임직원 전용)
  function contractorOk(key) { return key === 'project' || key === 'me' || key === 'info'; }

  // ── 화면 안 탭 주소(해시) — project.html#weekly 처럼 기존 탭 키를 그대로 쓴다 ──
  //   읽기만 여기서. 그 직급에 없는 탭이면 각 화면이 기본 탭으로 바꾸고, 탭을 바꿀 때 각 화면이 history 에 쓴다.
  function hashTab() { try { return decodeURIComponent((global.location.hash || '').replace(/^#/, '')); } catch(e) { return ''; } }

  // ── 화면 안 탭 정의 — 탭 목록의 유일한 출처 (2026-10-23) ──
  //   왼쪽 메뉴 하위 항목(어느 화면에서든) · 각 화면의 위 탭 줄 · 휴대폰 하단 바 · 주소(#탭키) 검사가 모두 sectionTabs() 를 쓴다.
  //   직급·권한 규칙은 여기에만 둔다(화면에 다시 쓰지 말 것). show(c) 가 없으면 모두에게 보임.
  //   c = { role, admin, manager, contractor, can }. can 은 「다른 부서로 보기」 중이면 그 부서 기준(team_perms).
  //   icon = 화면 탭 줄·휴대폰 하단 바(이모지, 함수면 c 로 계산), short = 휴대폰 하단 바 짧은 이름(없으면 label)
  //   url = 같은 화면 안 탭이 아니라 다른 화면으로 가는 하위 항목(예: 업무관리 → 서류작성 = docs.html). 그 화면은 activeSub 로 탭 키를 넘긴다
  //   guest:false = 비회원 둘러보기(guest.html) 메뉴에서 뺀다
  var SECTION_TABS = {
    project: [
      { key:'mine',     label:'내 프로젝트',   icon:'📁', svg:'folder' },
      { key:'weekly',   label:'주간보고',      icon:'📋', svg:'list' },
      { key:'monthly',  label:'월간달력',      icon:'📅', svg:'cal' },
      { key:'projects', label:'전체 프로젝트', icon:'📊', svg:'chart' },
      { key:'admin',    label:'관리',          icon:'⚙',  svg:'gear', show:function(c) { return c.can('project_admin'); } },
    ],
    // 연차: 승인 관리 = leave_approve, 통계·감사 로그 = leave_admin. 팀 관리·직원 관리는 관리자 고정 규칙이라 관리자 + leave_admin.
    //   팀원 결재는 팀장 직급(결재 흐름). 관리자는 신청·내역 없음
    leave: [
      { key:'calendar',      label:'캘린더',    icon:'📅', svg:'cal' },
      { key:'dashboard',     label:'대시보드',  icon:function(c) { return c.admin ? '📊' : '🏠'; }, svg:'grid' },
      { key:'team_approve',  label:'팀원 결재', icon:'✅', svg:'check',  show:function(c) { return c.manager; } },
      { key:'apply',         label:'연차 신청', icon:'✏️', svg:'pencil', show:function(c) { return !c.admin; } },
      { key:'history',       label:'신청 내역', icon:'📋', svg:'clock',  show:function(c) { return !c.admin; } },
      { key:'plan',          label:'휴가 계획', icon:'🗓️', svg:'flag',   show:function(c) { return !c.admin; } },   // 정식 신청 전 예정 공유(2026-10-23) — 신청 탭과 같은 사람
      { key:'admin_approve', label:'승인 관리', icon:'✅', svg:'check',  show:function(c) { return c.can('leave_approve'); } },
      { key:'admin_teams',   label:'팀 관리',   icon:'🏢', svg:'admin',  show:function(c) { return c.admin && c.can('leave_admin'); } },
      { key:'admin_users',   label:'직원 관리', icon:'👥', svg:'people', show:function(c) { return c.admin && c.can('leave_admin'); } },
      { key:'admin_stats',   label:'통계',      icon:'📈', svg:'chart',  show:function(c) { return c.can('leave_admin'); } },
      { key:'admin_audit',   label:'감사 로그', icon:'📋', svg:'list',   show:function(c) { return c.can('leave_admin'); } },
    ],
    worklog: [
      { key:'my_log',   label:'내 업무일지',   short:'내 일지', icon:'📝', svg:'pencil' },
      { key:'all_logs', label:'전체 업무일지', short:'전체',    icon:'👥', svg:'people' },
      { key:'history',  label:'내 기록',       short:'기록',    icon:'📅', svg:'cal' },
      { key:'supply',   label:'비품관리',      short:'비품',    icon:'🧾', svg:'box' },
      { key:'logs',     label:'작성이력',      short:'이력',    icon:'🗒️', svg:'list', show:function(c) { return c.can('worklog_history'); } },
      // 서류작성(2026-11-09): 직원 전체(협력업체 제외), 권한 키 없음. 서류 종류 목록은 docs.html DOC_TYPES
      { key:'docs',     label:'서류작성',      short:'서류',    icon:'📄', svg:'doc', url:'docs.html', guest:false, show:function(c) { return !c.contractor; } },
    ],
  };
  // section = 'project' | 'leave' | 'worklog', user = 로그인 사용자(없으면 이 창 세션)
  //   → [{key, label, short, icon, svg, url}] (이 사람에게 보이는 것만, 정의 순서. url 은 다른 화면 하위 항목만)
  function sectionTabs(section, user) {
    var defs = SECTION_TABS[section];
    var u = user || _me();
    if (!defs || !u) return [];
    var role = u.role;
    var c = { role: role, admin: role === 'admin', manager: role === 'manager', contractor: role === 'contractor', can: can };
    return defs.filter(function(t) { return !t.show || t.show(c); }).map(function(t) {
      return { key: t.key, label: t.label, short: t.short || t.label, icon: typeof t.icon === 'function' ? t.icon(c) : t.icon, svg: t.svg, url: t.url || null };
    });
  }

  // ── 비회원 둘러보기(guest.html, 2026-10-26) — 메뉴 구조만 보여 준다. 서버 호출·데이터 없음 ──
  //   하위 탭 = 관리자·팀장·직원 중 누구에게든 보이는 탭(합집합, SECTION_TABS 정의 순서). 비회원용 목록을 따로 두지 않는다 —
  //   실제 탭이 늘면 자동 반영. 권한 키로 거르는 탭은 켜진 것으로 본다(관리자는 항상 켜짐). 협력업체에게만 보이는 탭은 빠진다.
  var GUEST_ROLES = ['admin', 'manager', 'employee'];
  function _canAll() { return true; }
  function guestSectionTabs(section) {
    var defs = SECTION_TABS[section] || [];
    return defs.filter(function(t) {
      if (t.guest === false) return false;
      if (!t.show) return true;
      return GUEST_ROLES.some(function(r) {
        return t.show({ role: r, admin: r === 'admin', manager: r === 'manager', contractor: false, can: _canAll });
      });
    }).map(function(t) {
      return { key: t.key, label: t.label, short: t.short || t.label, svg: t.svg };
    });
  }
  // 비회원에게 보이는 상위 메뉴 = SYS_MENUS − APP_CONFIG.GUEST.HIDDEN_MENUS (설정이 없으면 관리포털만 숨김)
  function guestMenus() {
    var g = (global.APP_CONFIG && global.APP_CONFIG.GUEST) || {};
    var hidden = Array.isArray(g.HIDDEN_MENUS) ? g.HIDDEN_MENUS : ['admin'];
    return SYS_MENUS.filter(function(m) { return hidden.indexOf(m.key) < 0; });
  }

  // ── 기능 권한 표 (2026-10-22~) ─────────────────────────────────────────
  //   키 목록은 DB 함수 public.perm_keys() 와 같아야 한다(키를 더하면 두 곳 모두).
  //   기본값(= 이전 규칙)·예외(부서/사람) 판정은 DB has_perm() 이 하고, 화면은 my_perms() 결과만 쓴다.
  //   pages = 이 권한으로 열리는 화면(권한 탭 안내용), group = 권한 탭에서 묶어 보이는 단위(PERM_GROUPS 순서)
  //   2차(2026-10-22): 공정관리·연차·업무일지·메인메뉴. 기본값은 DB perm_default_for (= 그 전 규칙)
  var PERM_GROUPS = ['관리포털', '공정관리', '연차', '업무관리', '메인메뉴'];
  var PERM_DEFS = [
    { key:'worklog_admin', group:'관리포털', label:((global.APP_CONFIG && global.APP_CONFIG.ADMIN_TEAM_NAME) || '관리포털') + ' 업무일지', desc:'관리포털 업무일지 화면',                        pages:['admin-worklog.html'] },
    { key:'perf',          group:'관리포털', label:'수금관리',        desc:'수금·계약/잔금·예상수금',                        pages:['admin-perf.html'] },
    { key:'tax',           group:'관리포털', label:'세금계산서',      desc:'수금관리 안 세금계산서·매칭확인 탭',             pages:['admin-perf.html'] },
    { key:'payroll',       group:'관리포털', label:'급여 작성·명세서', desc:'급여관리 화면(명세서 작성·확정·메일)',          pages:['admin-payroll.html'] },
    { key:'payroll_bank',  group:'관리포털', label:'송금·계좌',       desc:'송금내역 엑셀·송금 계좌·추가 송금 (급여 권한도 있어야 함)', pages:['admin-payroll.html'] },
    { key:'staff',         group:'관리포털', label:'직원관리',        desc:'직원 정보 조회·수정',                            pages:['admin-staff.html'] },
    { key:'account',       group:'관리포털', label:'계정관리',        desc:'계정(장부) 보기·입력',                           pages:['admin-account.html'] },
    { key:'system',        group:'관리포털', label:'시스템',          desc:'사용량·백업 상태, 권한 표 보기',                 pages:['admin-system.html'] },
    { key:'docs',          group:'관리포털', label:'서류작성',        desc:'착수계 등 공문서 만들기, 기술자 명부·회사 도장·장비 관리', pages:['admin-docs.html'] },
    { key:'project_admin',   group:'공정관리', label:'관리 탭',           desc:'공정관리 「관리」 탭(프로젝트 등록·수정, 직원 목록)',                                  pages:['project.html#admin'] },
    { key:'project_manage',  group:'공정관리', label:'삭제·수정 로그·계약', desc:'프로젝트·주간보고·주요공정 삭제, 수정 로그 보기, 계약금액·계약서 PDF 저장 (관리 탭 안 기능은 관리 탭 권한도 있어야 함)', pages:['project.html#admin'] },
    { key:'leave_approve',   group:'연차',     label:'최종 승인',          desc:'연차 「승인 관리」 탭(최종 승인·반려·취소 승인). 팀장 「팀원 결재」는 직급 규칙 그대로',  pages:['leave.html#admin_approve'] },
    { key:'leave_admin',     group:'연차',     label:'통계·감사 로그',      desc:'연차 통계·감사 로그 탭 (팀 관리·직원 관리 탭은 관리자만 — 부서·계정 변경은 고정 규칙)',  pages:['leave.html#admin_stats', 'leave.html#admin_audit'] },
    { key:'worklog_all',     group:'업무관리', label:'다른 사람 일지 보기',  desc:'전체 업무일지에서 다른 사람이 쓴 내용 보기',                                          pages:['worklog.html#all_logs'] },
    { key:'worklog_history', group:'업무관리', label:'작성이력',           desc:'업무일지 「작성이력」 탭(전 직원 수정 기록)',                                         pages:['worklog.html#logs'] },
    { key:'supply_admin',    group:'업무관리', label:'비품 전체 수정',      desc:'비품관리에서 다른 사람 기록 수정·삭제 (본인 기록은 누구나)',                            pages:['worklog.html#supply'] },
    { key:'letter_admin',    group:'업무관리', label:'공문 대장 관리',      desc:'서류작성 → 공문: 다른 사람 공문 고치기·취소, 대장 비고 고치기 (번호 받기·보기·본인 공문은 직원 누구나)', pages:['docs.html#letter'] },
    { key:'notice',          group:'메인메뉴', label:'공지 작성',          desc:'메인메뉴 공지 작성, 다른 사람 공지 수정·삭제 (본인 공지는 작성자도 가능)',               pages:['home.html'] },
    { key:'company_events',  group:'메인메뉴', label:'회사 일정',          desc:'메인메뉴 회사 일정 등록·수정·삭제',                                                    pages:['home.html'] },
  ];
  // 표에서 바꿀 수 없는 규칙(권한 탭 🔒 안내)
  var PERM_FIXED_RULES = [
    '관리자는 항상 전부 켜져 있어요.',
    '협력업체와 비활성 계정(아이디·비밀번호 변경 전, 퇴사)은 항상 전부 꺼져 있어요.',
    '계정 아이디·비밀번호 초기화는 관리자만 할 수 있어요.',
    '권한을 바꾸는 것은 관리자만 할 수 있어요.',
  ];

  // ── 관리포털 하위 화면 (admin-*.html 공용 — 여기 한 곳에서만 관리) ──
  //   need = 이 화면을 여는 기능 권한 키(PERM_DEFS)
  var PORTAL_PAGES = [
    { key:'wl', svg:'note',   label:'업무일지', tabLabel:'📝 업무일지', href:'admin-worklog.html', need:'worklog_admin' },
    { key:'pf', svg:'chart',  label:'수금관리', tabLabel:'📊 수금관리', href:'admin-perf.html',    need:'perf'          },
    { key:'py', svg:'wallet', label:'급여관리', tabLabel:'💼 급여관리', href:'admin-payroll.html', need:'payroll'       },
    { key:'ab', svg:'key',    label:'계정관리', tabLabel:'🔑 계정관리', href:'admin-account.html', need:'account'       },
    { key:'st', svg:'people', label:'직원관리', tabLabel:'👥 직원관리', href:'admin-staff.html',   need:'staff'         },
    { key:'dc', svg:'doc',    label:'서류작성', tabLabel:'📄 서류작성', href:'admin-docs.html',    need:'docs'          },
    { key:'sy', svg:'gear',   label:'시스템',   tabLabel:'⚙️ 시스템',   href:'admin-system.html',  need:'system'        },
  ];

  // ── 내 기능 권한 (my_perms() 결과를 이 창 sessionStorage 에 둔다. 로그인·로그아웃 때 지움) ──
  //   관리자가 「다른 부서로 보기」를 고르면 그 부서 기준(team_perms) 값으로 메뉴·버튼만 판정한다.
  //   데이터 접근은 언제나 DB 가 실제 계정 기준으로 판정한다(화면 표시만 바뀜).
  var PERMS_KEY = _prefix + '_perms';
  var VIEW_KEY  = _prefix + '_view_as';
  function _ssGet(k) { try { var v = sessionStorage.getItem(k); return v ? JSON.parse(v) : null; } catch(e) { return null; } }
  function _ssSet(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch(e) {} }
  var APPR_KEY  = _prefix + '_approvals';   // 연차 결재 대기 건수(my_pending_approvals) — 아래 loadApprovals
  function clearPerms() { _ssSet(PERMS_KEY, null); _ssSet(VIEW_KEY, null); _ssSet(APPR_KEY, null); }
  function _me() { try { return Auth.getSession(); } catch(e) { return null; } }
  function _realPerms() {
    var c = _ssGet(PERMS_KEY), u = _me();
    if (!c || !u || c.uid !== u.id) return null;
    return c.perms || {};
  }
  function getViewAs() {
    var u = _me();
    if (!u || u.role !== 'admin') return null;   // 실제 관리자만
    var v = _ssGet(VIEW_KEY);
    return (v && v.team_id && v.perms) ? v : null;
  }
  function getPerms() { var v = getViewAs(); return v ? v.perms : _realPerms(); }
  function can(key) { var p = getPerms(); return !!(p && p[key]); }
  function canPortal() { return PORTAL_PAGES.some(function(pg) { return can(pg.need); }); }
  function portalCanShow(pg) { return can(pg && pg.need); }

  // 서버에서 내 권한을 다시 읽는다(화면을 열 때마다 — 관리자가 바꾼 권한이 새로고침으로 적용되게).
  var _permsInflight = null;   // { uid, p } — 화면과 메뉴(SysBar)가 동시에 불러도 요청은 한 번
  function loadPerms(sbClient) {
    var u = _me();
    if (!sbClient || !sbClient.rpc || !u) return Promise.resolve(getPerms());
    if (_permsInflight && _permsInflight.uid === u.id) return _permsInflight.p;
    var p = sbClient.rpc('my_perms').then(function(r) {
      if (r.error || !r.data) { logError(r.error, '기능 권한 조회'); return getPerms(); }
      // 응답이 오는 사이 만료·로그아웃으로 세션이 지워졌거나 다른 계정이면 쓰지 않는다
      // (화면을 열 때 만료 정리 뒤에 이 응답이 도착해 권한 캐시가 되살아나던 문제 — 2026-10-22)
      var now = _me();
      if (!now || now.id !== u.id) return getPerms();
      _ssSet(PERMS_KEY, { uid: u.id, perms: r.data });
      return getPerms();
    }, function(err) { logError(err, '기능 권한 조회'); return getPerms(); });
    _permsInflight = { uid: u.id, p: p };
    p.then(function() { _permsInflight = null; }, function() { _permsInflight = null; });
    return p;
  }

  // 다른 부서로 보기 (관리자만). team = {id, name} 또는 null(원래대로). 성공하면 true.
  function setViewAs(sbClient, team) {
    if (!team) { _ssSet(VIEW_KEY, null); return Promise.resolve(true); }
    var u = _me();
    if (!u || u.role !== 'admin' || !sbClient) return Promise.resolve(false);
    return sbClient.rpc('team_perms', { p_team: team.id }).then(function(r) {
      if (r.error || !r.data) { showError(r.error, '다른 부서로 보기'); return false; }
      _ssSet(VIEW_KEY, { team_id: team.id, team_name: team.name, perms: r.data.perms || {} });
      return true;
    }, function(err) { showError(err, '다른 부서로 보기'); return false; });
  }

  // ── 연차 결재 대기 건수 (2026-10-23) ──
  //   DB my_pending_approvals() 하나로 센다 → { team, final, cancel, total, *_list(최대 3건 이름·기간) }.
  //   team = 팀원 결재(팀장), final = 최종 승인, cancel = 취소 요청(final·cancel 은 leave_approve 권한).
  //   이 창 sessionStorage 에 1분 캐시 — 화면을 옮길 때마다 부르지 않게. 결재 처리 직후에는 refreshApprovals 로 다시 읽는다.
  //   값이 바뀌면 창에 'sys-approvals' 이벤트를 보낸다(왼쪽 메뉴·홈 배너·연차 화면이 다시 그림).
  var APPR_TTL = 60000;
  var _apprInflight = null;
  function getApprovals() {
    var c = _ssGet(APPR_KEY), u = _me();
    if (!c || !u || c.uid !== u.id) return null;
    return c.data || null;
  }
  // 화면 표시용 — 「다른 부서로 보기」 중이면 null(데이터가 관리자 기준이라 숫자를 보이지 않는다)
  function approvalCounts() { return getViewAs() ? null : getApprovals(); }
  // 연차 화면 하위 탭 숫자: 팀원 결재 = team, 승인 관리 = final + cancel(둘 다 그 탭 「최종 승인」에서 처리)
  function approvalBadges() {
    var a = approvalCounts();
    if (!a) return {};
    return { team_approve: a.team || 0, admin_approve: (a.final || 0) + (a.cancel || 0) };
  }
  function loadApprovals(sbClient, force) {
    var u = _me();
    if (!sbClient || !sbClient.rpc || !u || u.role === 'contractor') return Promise.resolve(getApprovals());
    var c = _ssGet(APPR_KEY);
    if (!force && c && c.uid === u.id && (Date.now() - c.at) < APPR_TTL) return Promise.resolve(c.data);
    if (_apprInflight && _apprInflight.uid === u.id && !force) return _apprInflight.p;
    var p = sbClient.rpc('my_pending_approvals').then(function(r) {
      if (r.error || !r.data) { logError(r.error, '결재 대기 건수 조회'); return getApprovals(); }
      var now = _me();
      if (!now || now.id !== u.id) return getApprovals();   // 응답 사이 로그아웃·만료 — 쓰지 않는다
      _ssSet(APPR_KEY, { uid: u.id, at: Date.now(), data: r.data });
      _deskBadge(r.data.total || 0);   // 데스크탑 앱 트레이 숫자(앱 안에서만, 값이 바뀔 때만)
      pwaBadge(r.data.total || 0);     // 휴대폰 앱 아이콘 숫자(앱으로 열었을 때만, 지원하는 기기만)
      try { global.dispatchEvent(new Event('sys-approvals')); } catch(e) {}
      return r.data;
    }, function(err) { logError(err, '결재 대기 건수 조회'); return getApprovals(); });
    _apprInflight = { uid: u.id, p: p };
    p.then(function() { _apprInflight = null; }, function() { _apprInflight = null; });
    return p;
  }
  function refreshApprovals(sbClient) { return loadApprovals(sbClient, true); }

  // ── 데스크탑 앱(Tauri) 안에서만 — 연차 결재 대기 알림 · 로그인 유지 (2026-11-02) ──
  //   앱이 아니면(일반 브라우저) 아래 함수는 모두 아무것도 하지 않는다(서버 호출 없음).
  //   앱 판정 = 앱이 넣는 window.__TAURI__.core.invoke. 앱 쪽 명령은 desk_config · desk_notify · desk_badge · desk_open_files 넷뿐.
  //   ① 감시: pollSeconds(앱 설정)마다 my_pending_approvals() 를 다시 읽고(캐시도 갱신), 직전 값(localStorage)보다
  //      팀원 결재 · 최종 승인 · 취소 요청 중 늘어난 것이 있으면 알림 1건(이름·사유 없음). 직전 값이 없으면(첫 실행) 대기 건이 있을 때 한 번.
  //      한 창에 하나. 「다른 부서로 보기」 중에는 건너뜀. 창이 트레이에 숨어 타이머가 늦어져도 앱이 같은 주기로 __kbDeskTick() 을 부른다.
  //   ② 로그인 유지(2026-11-02 승우 결정): 앱 안에서는 1시간 비활동 자동 로그아웃을 하지 않고, 앱을 다시 켜면
  //      저장해 둔 로그인(localStorage 사본)으로 들어간 뒤 서버로 다시 확인한다. 로그아웃하면 사본도 지운다.
  var DESK_LAST_KEY = _prefix + '_desk_appr_last';   // 직전 결재 대기 건수 {uid, team, final, cancel}
  var DESK_SESS_KEY = _prefix + '_desk_session';     // 로그인 사본(앱 안에서만)
  var DESK_KINDS = [
    { key:'team',   label:'팀원 결재', tab:'team_approve'  },
    { key:'final',  label:'최종 승인', tab:'admin_approve' },
    { key:'cancel', label:'취소 요청', tab:'admin_approve' },
  ];
  var _deskWatch = null;      // { uid, sb, timer, ms, busy, at }
  var _deskRestored = false;  // 이번 화면을 로그인 사본으로 열었는가 → 서버로 다시 확인
  function isDesktopApp() {
    var t = global.__TAURI__;
    return !!(t && t.core && typeof t.core.invoke === 'function');
  }
  function _deskInvoke(cmd, args) {
    try {
      return Promise.resolve(global.__TAURI__.core.invoke(cmd, args || {}))
        .then(null, function(err) { logError(err, '데스크탑 앱 ' + cmd); return null; });
    } catch(e) { return Promise.resolve(null); }
  }
  function _lsGet(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch(e) { return null; } }
  function _lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} }
  function _deskMirror() {
    if (!isDesktopApp()) return;
    try { var s = sessionStorage.getItem(SESSION_KEY); if (s) localStorage.setItem(DESK_SESS_KEY, s); } catch(e) {}
  }
  // 앱을 다시 켜면 sessionStorage 가 비어 있다 → 화면이 세션을 읽기 전에(이 파일이 불릴 때) 사본으로 채운다
  (function() {
    if (!isDesktopApp()) return;
    try {
      if (!sessionStorage.getItem(SESSION_KEY)) {
        var m = localStorage.getItem(DESK_SESS_KEY);
        if (m) { sessionStorage.setItem(SESSION_KEY, m); _deskRestored = true; }
      }
    } catch(e) {}
    try { global.addEventListener('pagehide', _deskMirror); } catch(e) {}
  })();
  function stopDesktopWatch() {
    if (_deskWatch && _deskWatch.timer) clearInterval(_deskWatch.timer);
    _deskWatch = null;
  }
  function _deskCompare(uid, a) {
    var prev = _lsGet(DESK_LAST_KEY);
    var first = !prev || prev.uid !== uid;
    var cur = { uid: uid };
    var parts = [], tab = null;
    DESK_KINDS.forEach(function(k) {
      var n = a[k.key] || 0;
      cur[k.key] = n;
      if (n > 0 && (first || n > (prev[k.key] || 0))) {
        parts.push(k.label + ' ' + n + '건');
        if (!tab) tab = k.tab;
      }
    });
    _lsSet(DESK_LAST_KEY, cur);
    if (!parts.length) return;
    _deskInvoke('desk_notify', { title: '연차 결재 요청', body: parts.join(' · '), path: 'leave.html#' + tab });
  }
  function _deskTick() {
    var w = _deskWatch;
    if (!w) return;
    var u = _me();
    if (!u || u.id !== w.uid) { stopDesktopWatch(); return; }
    _deskMirror();
    if (getViewAs()) return;                                   // 다른 부서로 보기 중에는 감시 안 함
    if (w.busy || (Date.now() - w.at) < w.ms / 2) return;      // 앱 신호 · 타이머가 겹치면 한 번만
    w.busy = true; w.at = Date.now();
    loadApprovals(w.sb, true).then(function(a) {
      w.busy = false;
      if (_deskWatch === w && a && _me() && _me().id === w.uid) _deskCompare(w.uid, a);
    }, function() { w.busy = false; });
  }
  function startDesktopWatch(sbClient) {
    if (!isDesktopApp() || !sbClient || !sbClient.rpc) return;
    _lockSb = sbClient;                                        // 화면 잠금 해제(비밀번호 확인)에 같은 클라이언트를 쓴다
    var u = _me();
    if (!u || u.role === 'contractor') return;
    if (_deskWatch && _deskWatch.uid === u.id) return;          // 한 창에 하나
    stopDesktopWatch();
    var w = { uid: u.id, sb: sbClient, timer: null, ms: 60000, busy: false, at: 0 };
    _deskWatch = w;
    _deskMirror();
    global.__kbDeskTick = _deskTick;                           // 앱(Rust)이 같은 주기로 부른다
    if (_deskRestored) {
      _deskRestored = false;
      Auth.verifySession(sbClient).then(function(r) {
        if (r && !r.ok && !r.hold) { stopDesktopWatch(); try { localStorage.removeItem(DESK_SESS_KEY); } catch(e) {} global.location.reload(); }
      });
    }
    _deskInvoke('desk_config').then(function(cfg) {
      if (_deskWatch !== w) return;
      var s = cfg ? Number(cfg.pollSeconds) : 0;
      if (s >= 15) w.ms = s * 1000;
      w.timer = setInterval(_deskTick, w.ms);
      _deskTick();
    });
  }

  // ── 트레이 숫자 (2026-11-03) — 결재 대기 total 을 앱에 보낸다(desk_badge). 값이 바뀔 때만. 로그아웃 = 0 ──
  var DESK_BADGE_KEY = _prefix + '_desk_badge';     // sessionStorage {n} — 마지막으로 보낸 값
  function _deskBadge(n, force) {
    if (!isDesktopApp()) return;
    n = Math.max(0, Math.min(999, parseInt(n, 10) || 0));
    var last = _ssGet(DESK_BADGE_KEY);
    if (!force && last && last.n === n) return;
    _ssSet(DESK_BADGE_KEY, { n: n });
    _deskInvoke('desk_badge', { n: n });
  }

  // ── 휴대폰 앱(PWA) — 홈 화면 설치 · 서비스워커 · 연차 결재 알림(웹 푸시) (2026-11-16, v2.11.0) ──
  //   설정 = APP_CONFIG.PWA(이름·색·아이콘·비상 스위치·푸시 공개키). manifest·아이콘은 tools/build_pwa.py 가 만든다.
  //   ① 머리 태그: 이 파일이 <head> 에서 불릴 때 manifest 링크 · theme-color · 아이폰 홈 화면 메타를 넣는다(화면 HTML 에 따로 쓰지 않음).
  //   ② 서비스워커: 화면을 다 읽은 뒤 sw.js?v=APP_VERSION 등록(버전이 바뀌면 주소가 바뀌어 바로 교체). SW_ENABLED=false 면 해제 + 저장분 삭제.
  //   ③ 새 버전 안내: 화면을 다시 볼 때(30분에 한 번) sysbar.js 의 APP_VERSION 을 서버에서 읽어 다르면 「새 버전이 있습니다 · 새로고침」.
  //   ④ 설치 안내: 직원(협력업체 제외) · 휴대폰(안드로이드·아이폰) · 앱으로 열지 않았을 때만. 서랍 아래 「앱 설치」 · 내 정보 · 로그인 뒤 한 번 안내 띠.
  //   ⑤ 알림: 단추를 누를 때만 권한을 묻는다. 구독은 DB push_subscriptions(push_subscribe/push_unsubscribe 함수). 발송은 DB 트리거 → Edge Function.
  //   데스크탑 앱(Tauri) 안에서는 ①~⑤ 모두 하지 않는다(앱 자체 알림이 있음 — 남은 등록이 있으면 푼다).
  var _pwaCfg = (global.APP_CONFIG && global.APP_CONFIG.PWA) || null;
  var PWA_CACHE_PREFIX = 'sys-shell-';
  var PWA_BANNER_OFF_KEY  = _prefix + '_pwa_banner_off';    // localStorage — 「다시 보지 않기」
  var PWA_BANNER_SEEN_KEY = _prefix + '_pwa_banner_seen';   // sessionStorage {uid} — 이번 로그인에 이미 보였음
  var PWA_INSTALLED_KEY   = _prefix + '_pwa_installed';     // localStorage — 안드로이드 설치 완료(appinstalled)
  var PWA_PUSH_KEY        = _prefix + '_pwa_push';          // localStorage {uid, endpoint} — 이 기기 알림을 켠 사람
  var PWA_VER_KEY         = _prefix + '_pwa_vercheck';      // sessionStorage {at} — 새 버전 확인 시각
  var _pwaBip = null;          // 안드로이드 크롬 설치 신호(beforeinstallprompt)
  var _pwaSb = null;           // 알림 켜기·동기화에 쓰는 Supabase 클라이언트(SysBar 가 넘겨 줌)
  var _pwaPanels = [];         // 다시 그릴 패널들(설치·알림 상태가 바뀌면)

  function pwaOn() { return !!(_pwaCfg && _pwaCfg.ENABLED !== false) && !isDesktopApp(); }
  function swWanted() { return !!(_pwaCfg && _pwaCfg.SW_ENABLED !== false) && !isDesktopApp(); }
  function pwaPlatform() {
    if (isDesktopApp()) return 'desktop-app';
    var ua = (global.navigator && navigator.userAgent) || '';
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'pc';
  }
  function isStandalone() {
    try { if (global.matchMedia('(display-mode: standalone)').matches) return true; } catch(e) {}
    return !!(global.navigator && navigator.standalone);
  }
  function pwaStaff(user) { user = user || _me(); return !!(user && user.role && user.role !== 'contractor'); }
  function pwaIsPhone() { var p = pwaPlatform(); return p === 'android' || p === 'ios'; }
  // 설치 안내를 보일까: 직원 · 휴대폰 · 앱으로 열지 않음 · (안드로이드) 이 기기에 설치했다고 기록되지 않음
  function canInstallUi(user) {
    if (!pwaOn() || !pwaStaff(user) || !pwaIsPhone() || isStandalone()) return false;
    try { if (localStorage.getItem(PWA_INSTALLED_KEY) === '1') return false; } catch(e) {}
    return true;
  }

  // ① 머리 태그 — 이미 있으면 그대로
  function _pwaHead() {
    if (!pwaOn()) return;
    var head = document.head || document.getElementsByTagName('head')[0];
    if (!head) return;
    var c = global.APP_CONFIG || {}, icons = _pwaCfg.ICONS || {};
    var theme = _pwaCfg.THEME_COLOR || c.COLOR_PRIMARY || '#0f172a';
    function add(tag, attrs, sel) {
      if (sel && document.querySelector(sel)) return;
      var el = document.createElement(tag);
      for (var k in attrs) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
      head.appendChild(el);
    }
    add('link', { rel:'manifest', href:_pwaCfg.MANIFEST || 'manifest.webmanifest' }, 'link[rel="manifest"]');
    add('meta', { name:'theme-color', content:theme }, 'meta[name="theme-color"]');
    add('meta', { name:'mobile-web-app-capable', content:'yes' }, 'meta[name="mobile-web-app-capable"]');
    add('meta', { name:'apple-mobile-web-app-capable', content:'yes' }, 'meta[name="apple-mobile-web-app-capable"]');
    add('meta', { name:'apple-mobile-web-app-status-bar-style', content:'default' }, 'meta[name="apple-mobile-web-app-status-bar-style"]');
    add('meta', { name:'apple-mobile-web-app-title', content:_pwaCfg.SHORT_NAME || c.COMPANY_SHORT || '' }, 'meta[name="apple-mobile-web-app-title"]');
    if (icons.APPLE_TOUCH) add('link', { rel:'apple-touch-icon', href:icons.APPLE_TOUCH }, 'link[rel="apple-touch-icon"]');
  }
  try { _pwaHead(); } catch(e) { logError(e, '앱 머리 태그'); }

  // 안드로이드 크롬 — 설치 신호를 잡아 두었다가 「앱 설치」 단추에서 쓴다
  try {
    global.addEventListener('beforeinstallprompt', function(ev) {
      if (!pwaOn()) return;
      ev.preventDefault(); _pwaBip = ev; _pwaRedraw();
    });
    global.addEventListener('appinstalled', function() {
      _pwaBip = null;
      try { localStorage.setItem(PWA_INSTALLED_KEY, '1'); } catch(e) {}
      _pwaBannerClose(); _pwaRedraw();
    });
  } catch(e) {}

  // ② 서비스워커 등록 · 비상 스위치 해제
  function _swKill() {
    var sw = global.navigator && navigator.serviceWorker;
    var p1 = sw && sw.getRegistrations ? sw.getRegistrations().then(function(list) {
      return Promise.all(list.filter(function(r) {
        var w = r.active || r.waiting || r.installing;
        return w && /\/sw\.js(\?|$)/.test(w.scriptURL);
      }).map(function(r) { return r.unregister(); }));
    }).catch(function() {}) : Promise.resolve();
    var p2 = global.caches && caches.keys ? caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k.indexOf(PWA_CACHE_PREFIX) === 0; }).map(function(k) { return caches.delete(k); }));
    }).catch(function() {}) : Promise.resolve();
    return Promise.all([p1, p2]);
  }
  var _swReg = null;
  function swRegister() {
    var sw = global.navigator && navigator.serviceWorker;
    if (!sw) return Promise.resolve(null);
    if (!swWanted()) return _swKill().then(function() { return null; });
    if (_swReg) return _swReg;
    _swReg = sw.register('sw.js?v=' + encodeURIComponent(APP_VERSION), { scope:'./' }).then(null, function(err) {
      logError(err, '서비스워커 등록'); _swReg = null; return null;
    });
    return _swReg;
  }
  try {
    if (global.navigator && navigator.serviceWorker) {
      var _swStart = function() { swRegister(); };
      if (document.readyState === 'complete') setTimeout(_swStart, 0); else global.addEventListener('load', _swStart);
      // 알림을 눌렀는데 이 화면이 이미 열려 있으면 → 그 주소(#탭)로 다시 읽는다(새 결재 건이 보이게)
      navigator.serviceWorker.addEventListener('message', function(ev) {
        var d = ev.data || {};
        if (d.type !== 'sys-open' || !d.url) return;
        try { global.history.replaceState(global.history.state, '', d.url); } catch(e) {}
        global.location.reload();
      });
    }
  } catch(e) { logError(e, '서비스워커'); }

  // ③ 새 버전 안내 — 화면을 다시 볼 때 확인(30분에 한 번)
  var PWA_VER_EVERY = 30 * 60 * 1000;
  function checkNewVersion(force) {
    if (!swWanted() || !global.fetch) return Promise.resolve(null);
    var last = _ssGet(PWA_VER_KEY);
    if (!force && last && (Date.now() - last.at) < PWA_VER_EVERY) return Promise.resolve(null);
    _ssSet(PWA_VER_KEY, { at: Date.now() });
    return fetch('sysbar.js?vc=' + Date.now(), { cache:'no-store' }).then(function(r) { return r.ok ? r.text() : ''; }).then(function(t) {
      var m = /var APP_VERSION = '([^']+)'/.exec(t || '');
      if (m && m[1] !== APP_VERSION) _pwaUpdateBand(m[1]);
      return m ? m[1] : null;
    }, function() { return null; });
  }
  function _pwaUpdateBand(v) {
    if (document.getElementById('sys-pwa-update') || !document.body) return;
    _pwaCss();
    var el = document.createElement('div');
    el.id = 'sys-pwa-update'; el.className = 'sys-pwa-band no-print'; el.setAttribute('role', 'status');
    el.innerHTML = '<span>새 버전이 있습니다</span><button type="button" class="sys-pwa-b on">새로고침</button><button type="button" class="sys-pwa-x" aria-label="닫기">✕</button>';
    el.querySelector('.on').addEventListener('click', function() { global.location.reload(); });
    el.querySelector('.sys-pwa-x').addEventListener('click', function() { el.parentNode && el.parentNode.removeChild(el); });
    document.body.appendChild(el);
  }
  try {
    document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'visible') checkNewVersion(); });
  } catch(e) {}

  // 앱 아이콘 숫자(결재 대기) — 앱으로 열었을 때만, 지원하지 않는 기기는 건너뜀
  function pwaBadge(n) {
    try {
      if (!pwaOn() || !isStandalone() || !navigator.setAppBadge) return;
      n = parseInt(n, 10) || 0;
      (n > 0 ? navigator.setAppBadge(n) : navigator.clearAppBadge()).then(null, function() {});
    } catch(e) {}
  }

  // ⑤ 알림(웹 푸시)
  function _b64uToBytes(s) {
    s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var raw = atob(s), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function _bytesToB64u(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function _pwaDevice() {
    var ua = navigator.userAgent || '', p = pwaPlatform();
    var dev = p === 'ios' ? (/iPad/.test(ua) || /Macintosh/.test(ua) ? 'iPad' : 'iPhone') : p === 'android' ? 'Android' : 'PC';
    var br = /SamsungBrowser/.test(ua) ? '삼성 인터넷' : /EdgA?\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
    return dev + (br ? ' · ' + br : '') + (isStandalone() ? ' · 앱' : '');
  }
  // 상태: unsupported(이유 why) | denied | on | off
  function pushStatus(user) {
    user = user || _me();
    var why = null;
    if (!pwaOn() || !pwaStaff(user)) why = 'off';
    else if (!pwaIsPhone()) why = 'pc';
    else if (!_pwaCfg.PUSH_PUBLIC_KEY || !swWanted()) why = 'nokey';
    else if (pwaPlatform() === 'ios' && !isStandalone()) why = 'ios-browser';
    else if (!('serviceWorker' in navigator) || !global.PushManager || !global.Notification) why = 'browser';
    if (why) return Promise.resolve({ state:'unsupported', why:why });
    if (Notification.permission === 'denied') return Promise.resolve({ state:'denied' });
    return swRegister().then(function(reg) {
      if (!reg) return { state:'unsupported', why:'browser' };
      return reg.pushManager.getSubscription().then(function(sub) {
        var mine = _lsGet(PWA_PUSH_KEY);
        var on = !!(sub && Notification.permission === 'granted' && mine && mine.uid === user.id && mine.endpoint === sub.endpoint);
        return { state: on ? 'on' : 'off', other: !!(sub && mine && mine.uid !== user.id) };
      });
    }, function() { return { state:'unsupported', why:'browser' }; });
  }
  function _pushSave(sbClient, sub) {
    var j = sub.toJSON ? sub.toJSON() : {};
    var keys = j.keys || {};
    return sbClient.rpc('push_subscribe', {
      p_endpoint: sub.endpoint, p_p256dh: keys.p256dh || _bytesToB64u(sub.getKey('p256dh')),
      p_auth: keys.auth || _bytesToB64u(sub.getKey('auth')), p_device: _pwaDevice()
    });
  }
  // 알림 켜기 — 반드시 단추를 누른 그 순간에 부른다(권한 요청이 사용자 동작 안에 있어야 함)
  function pushEnable(sbClient) {
    var user = _me();
    sbClient = sbClient || _pwaSb;
    if (!user || !sbClient) return Promise.resolve({ ok:false, reason:'로그인 정보를 확인할 수 없어요. 다시 로그인해 주세요.' });
    var perm;
    try { perm = Notification.requestPermission(); } catch(e) { perm = null; }
    return Promise.resolve(perm).then(function(p) {
      p = p || Notification.permission;
      if (p !== 'granted') return { ok:false, reason: p === 'denied' ? '알림이 차단되었어요. 휴대폰 설정에서 이 앱의 알림을 허용해 주세요.' : '알림을 허용하지 않았어요.' };
      return swRegister().then(function(reg) {
        if (!reg) return { ok:false, reason:'이 브라우저는 알림을 지원하지 않아요.' };
        return navigator.serviceWorker.ready.then(function(ready) {
          return ready.pushManager.getSubscription().then(function(old) {
            return old || ready.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:_b64uToBytes(_pwaCfg.PUSH_PUBLIC_KEY) });
          });
        }).then(function(sub) {
          return _pushSave(sbClient, sub).then(function(r) {
            if (r.error) { logError(r.error, '알림 켜기'); return { ok:false, reason:'알림을 켜지 못했어요. 잠시 뒤 다시 시도해 주세요.' }; }
            _lsSet(PWA_PUSH_KEY, { uid:user.id, endpoint:sub.endpoint });
            return { ok:true };
          });
        });
      });
    }).then(function(r) { _pwaRedraw(); return r; }, function(err) {
      logError(err, '알림 켜기'); _pwaRedraw();
      return { ok:false, reason:'알림을 켜지 못했어요. 잠시 뒤 다시 시도해 주세요.' };
    });
  }
  // 알림 끄기 — 서버의 구독을 지우고 이 기기 구독도 푼다
  function pushDisable(sbClient) {
    sbClient = sbClient || _pwaSb;
    return swRegister().then(function(reg) {
      if (!reg) return null;
      return reg.pushManager.getSubscription();
    }).then(function(sub) {
      if (!sub) return { ok:true };
      var del = sbClient ? sbClient.rpc('push_unsubscribe', { p_endpoint: sub.endpoint }) : Promise.resolve({});
      return Promise.resolve(del).then(function(r) {
        if (r && r.error) logError(r.error, '알림 끄기');
        return sub.unsubscribe().then(function() { return { ok:true }; }, function() { return { ok:true }; });
      });
    }).then(function(r) { _lsSet(PWA_PUSH_KEY, null); _pwaRedraw(); return r; }, function(err) {
      logError(err, '알림 끄기'); return { ok:false, reason:'알림을 끄지 못했어요.' };
    });
  }
  // 화면을 열 때(로그인한 직원, 이번 창에서 한 번): 알림을 켠 사람이 지금 사람이면 구독을 서버에 다시 알린다(주소가 바뀌었을 수 있음)
  var _pushSynced = false;
  function pushSync(sbClient) {
    var user = _me();
    if (_pushSynced || !sbClient || !user) return;
    _pushSynced = true;
    var mine = _lsGet(PWA_PUSH_KEY);
    if (!mine || mine.uid !== user.id) return;
    pushStatus(user).then(function(st) {
      if (st.state === 'unsupported') return;
      return navigator.serviceWorker.ready.then(function(reg) { return reg.pushManager.getSubscription(); }).then(function(sub) {
        if (!sub || Notification.permission !== 'granted') { _lsSet(PWA_PUSH_KEY, null); return; }
        return _pushSave(sbClient, sub).then(function(r) {
          if (r.error) { logError(r.error, '알림 구독 확인'); return; }
          _lsSet(PWA_PUSH_KEY, { uid:user.id, endpoint:sub.endpoint });
        });
      });
    }).then(null, function(err) { logError(err, '알림 구독 확인'); });
  }
  // 시험 알림 — 내 기기들에만 한 건(Edge Function 이 내 로그인으로 확인)
  function pushTest(sbClient) {
    sbClient = sbClient || _pwaSb;
    if (!sbClient) return Promise.resolve({ ok:false, reason:'로그인 정보를 확인할 수 없어요.' });
    return sbClient.auth.getSession().then(function(s) {
      var tok = s && s.data && s.data.session && s.data.session.access_token;
      if (!tok) return { ok:false, reason:'로그인이 만료되었어요. 다시 로그인해 주세요.' };
      return sbClient.functions.invoke(_pwaCfg.PUSH_FUNCTION || 'leave-push', {
        body: { action:'self_test' }, headers: { Authorization:'Bearer ' + tok }
      }).then(function(r) {
        if (r.error) { logError(r.error, '시험 알림'); return { ok:false, reason:'시험 알림을 보내지 못했어요.' }; }
        var n = (r.data && r.data.sent) || 0;
        return n > 0 ? { ok:true, sent:n } : { ok:false, reason:'알림을 받을 기기가 없어요. 알림을 먼저 켜 주세요.' };
      });
    }).then(null, function(err) { logError(err, '시험 알림'); return { ok:false, reason:'시험 알림을 보내지 못했어요.' }; });
  }

  // ── 화면 조각(바닐라 DOM): 패널(내 정보 · 설치 창 끝) · 설치 창 · 안내 띠 ──
  var _pwaCssDone = false;
  function _pwaCss() {
    if (_pwaCssDone || document.getElementById('sys-pwa-css')) { _pwaCssDone = true; return; }
    var s = document.createElement('style'); s.id = 'sys-pwa-css';
    s.textContent =
      '.sys-pwa-band{position:fixed;left:12px;right:12px;top:calc(var(--sysbar-h,48px) + 8px);z-index:940;display:flex;align-items:center;gap:8px;' +
        'background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 8px 28px rgba(15,23,42,.18);padding:10px 8px 10px 14px;font-size:14px;max-width:520px;margin:0 auto;}' +
      '.sys-pwa-band>span{flex:1;min-width:0;line-height:1.4;}' +
      '.sys-pwa-band>span small{display:block;color:#64748b;font-size:12px;}' +
      '#sys-pwa-banner{flex-wrap:wrap;row-gap:6px;padding:10px 6px 10px 14px;}' +
      '#sys-pwa-banner>span{flex:1 1 calc(100% - 52px);}' +
      '#sys-pwa-banner>.sys-pwa-x{order:1;align-self:flex-start;margin-top:-6px;}' +
      '#sys-pwa-banner>.sys-pwa-b{order:2;}' +
      '#sys-pwa-banner>.sys-pwa-b.on{margin-left:auto;}' +
      '.sys-pwa-b{min-height:40px;padding:0 12px;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc;color:#334155;font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;}' +
      '.sys-pwa-b.on{background:var(--theme,#0f172a);border-color:var(--theme,#0f172a);color:#fff;}' +
      '.sys-pwa-b:disabled{opacity:.5;cursor:default;}' +
      '.sys-pwa-x{width:40px;height:40px;border:0;background:none;color:#94a3b8;font-size:16px;cursor:pointer;flex-shrink:0;}' +
      '.sys-pwa-sheet-bg{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:960;}' +
      '.sys-pwa-sheet{position:fixed;left:0;right:0;bottom:0;z-index:961;background:#fff;border-radius:16px 16px 0 0;max-height:92dvh;overflow-y:auto;' +
        'padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px));box-sizing:border-box;max-width:560px;margin:0 auto;}' +
      '.sys-pwa-sheet:focus{outline:none;}' +
      '.sys-pwa-sheet h2{font-size:17px;margin:0 0 4px;display:flex;align-items:center;gap:8px;}' +
      '.sys-pwa-sheet h2 button{margin-left:auto;}' +
      '.sys-pwa-sheet .lead{font-size:13px;color:#64748b;margin:0 0 14px;line-height:1.6;}' +
      '.sys-pwa-steps{list-style:none;margin:0 0 16px;padding:0;counter-reset:s;}' +
      '.sys-pwa-steps li{counter-increment:s;display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;line-height:1.5;}' +
      '.sys-pwa-steps li:before{content:counter(s);flex-shrink:0;width:24px;height:24px;border-radius:50%;background:var(--theme,#0f172a);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;}' +
      '.sys-pwa-steps svg{flex-shrink:0;color:#2563eb;}' +
      '.sys-pwa-panel{font-size:14px;}' +
      '.sys-pwa-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid #f1f5f9;flex-wrap:wrap;}' +
      '.sys-pwa-row:first-child{border-top:0;padding-top:0;}' +
      '.sys-pwa-row>span{flex:1;min-width:160px;line-height:1.5;}' +
      '.sys-pwa-row small{display:block;color:#64748b;font-size:12px;}' +
      '.sys-pwa-row .btns{display:flex;gap:6px;flex-wrap:wrap;}' +
      '.sys-pwa-msg{font-size:12px;border-radius:8px;padding:8px 10px;margin-top:8px;line-height:1.5;}' +
      '.sys-pwa-msg.ok{background:#dcfce7;color:#166534;}.sys-pwa-msg.e{background:#fee2e2;color:#991b1b;}' +
      '@media print{.sys-pwa-band,.sys-pwa-sheet,.sys-pwa-sheet-bg{display:none!important;}}';
    (document.head || document.documentElement).appendChild(s);
    _pwaCssDone = true;
  }
  function _esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function(ch) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]; }); }
  var PWA_SVG = {
    share: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>',
    plus:  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
    dots:  '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
    home:  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M11 18h2"/></svg>'
  };

  // 패널 — 설치 줄 + 알림 줄. el 을 비우고 다시 그린다. opts.inSheet = 설치 창 안(설치 줄 없음)
  function _pwaRedraw() { _pwaPanels = _pwaPanels.filter(function(p) { return p.el.isConnected; }); _pwaPanels.forEach(function(p) { _pwaDraw(p); }); }
  function mountPanel(el, opts) {
    if (!el) return function() {};
    _pwaCss();
    var p = { el: el, opts: opts || {}, msg: null, busy: false };
    if (p.opts.sb) _pwaSb = p.opts.sb;
    _pwaPanels.push(p);
    _pwaDraw(p);
    return function() { _pwaPanels = _pwaPanels.filter(function(x) { return x !== p; }); };
  }
  // 「내 정보」에 카드를 보일까: 직원 · 데스크탑 앱 아님
  function panelVisible(user) { return pwaOn() && pwaStaff(user); }
  function _pwaDraw(p) {
    var user = _me(), el = p.el;
    if (!panelVisible(user)) { el.innerHTML = ''; return; }
    var plat = pwaPlatform(), html = '';
    if (plat === 'pc') {
      var durl = _pwaCfg.DESKTOP_APP_URL || 'desktop/';
      el.innerHTML = '<div class="sys-pwa-panel"><div class="sys-pwa-row"><span>PC 에서는 데스크탑 앱을 쓰세요<small>연차 결재 요청이 오면 PC 알림으로 알려 드려요. 휴대폰 앱 설치·알림은 휴대폰에서 이 화면을 열면 보여요.</small></span>' +
        '<div class="btns"><a class="sys-pwa-b" style="display:inline-flex;align-items:center;text-decoration:none" href="' + _esc(durl) + '">데스크탑 앱 ›</a></div></div></div>';
      return;
    }
    if (!p.opts.inSheet) {
      if (isStandalone()) html += '<div class="sys-pwa-row"><span>✓ 앱으로 열려 있어요<small>홈 화면 아이콘으로 열면 주소창 없이 보여요.</small></span></div>';
      else html += '<div class="sys-pwa-row"><span>📱 휴대폰 앱 설치<small>홈 화면에 아이콘을 두고 앱처럼 열 수 있어요.</small></span><div class="btns"><button type="button" class="sys-pwa-b on" data-a="install">앱 설치</button></div></div>';
    }
    html += '<div class="sys-pwa-row" data-push><span>🔔 연차 결재 알림<small>확인하는 중…</small></span></div>';
    el.innerHTML = '<div class="sys-pwa-panel">' + html + '</div>' + (p.msg ? '<div class="sys-pwa-msg ' + (p.msg.ok ? 'ok' : 'e') + '">' + _esc(p.msg.text) + '</div>' : '');
    var ins = el.querySelector('[data-a="install"]');
    if (ins) ins.addEventListener('click', function() { openInstall(); });
    var row = el.querySelector('[data-push]');
    pushStatus(user).then(function(st) {
      if (!row.isConnected) return;
      var t = '', b = '';
      if (st.state === 'unsupported') {
        t = st.why === 'ios-browser' ? '알림은 홈 화면에 추가한 앱에서 켤 수 있어요(아이폰은 앱 설치 뒤에만 알림이 와요).'
          : st.why === 'nokey' ? '알림이 아직 준비되지 않았어요.' : '이 브라우저는 알림을 지원하지 않아요. 크롬(안드로이드)이나 사파리(아이폰)를 써 주세요.';
      } else if (st.state === 'denied') {
        t = '알림이 차단되어 있어요. 휴대폰 설정 → 알림에서 이 앱(또는 브라우저)의 알림을 허용한 뒤 다시 열어 주세요.';
      } else if (st.state === 'on') {
        t = '켜짐 · 결재할 연차 신청이 오면 알려 드려요.';
        b = '<button type="button" class="sys-pwa-b" data-a="test">시험 알림</button><button type="button" class="sys-pwa-b" data-a="off">알림 끄기</button>';
      } else {
        t = st.other ? '이 기기는 다른 계정이 알림을 받고 있어요. 켜면 이 계정으로 바뀌어요.' : '꺼짐 · 결재할 연차 신청이 오면 휴대폰으로 알려 드려요.';
        b = '<button type="button" class="sys-pwa-b on" data-a="on">알림 켜기</button>';
      }
      row.innerHTML = '<span>🔔 연차 결재 알림<small>' + _esc(t) + '</small></span>' + (b ? '<div class="btns">' + b + '</div>' : '');
      function act(name, fn) {
        var bt = row.querySelector('[data-a="' + name + '"]');
        if (bt) bt.addEventListener('click', function() {
          if (p.busy) return;
          p.busy = true; bt.disabled = true;
          fn().then(function(r) {
            p.busy = false;
            p.msg = r.ok ? (name === 'test' ? { ok:true, text:'시험 알림을 보냈어요. 잠시 뒤 알림이 오는지 확인해 주세요.' } : null) : { ok:false, text:r.reason };
            _pwaDraw(p);
          });
        });
      }
      act('on', function() { return pushEnable(p.opts.sb); });
      act('off', function() { return pushDisable(p.opts.sb); });
      act('test', function() { return pushTest(p.opts.sb); });
    });
  }

  // 설치 창(아래에서 올라오는 창) — 휴대폰 종류별 안내 + 끝에 알림 켜기
  function openInstall() {
    if (!pwaOn() || !document.body) return;
    _pwaCss(); _pwaBannerClose();
    if (document.getElementById('sys-pwa-sheet')) return;
    var plat = pwaPlatform(), name = _pwaCfg.SHORT_NAME || '';
    var bg = document.createElement('div'); bg.className = 'sys-pwa-sheet-bg no-print';
    var sh = document.createElement('div'); sh.id = 'sys-pwa-sheet'; sh.className = 'sys-pwa-sheet no-print';
    sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('tabindex', '-1'); sh.setAttribute('aria-label', '앱 설치');
    var body = '';
    if (isStandalone()) {
      body = '<p class="lead">이미 앱으로 열려 있어요.</p>';
    } else if (plat === 'ios') {
      body = '<p class="lead">사파리에서 아래 순서대로 누르면 홈 화면에 「' + _esc(name) + '」 아이콘이 생겨요. (다른 앱 안의 브라우저에서는 안 될 수 있어요 — 사파리로 열어 주세요.)</p>' +
        '<ol class="sys-pwa-steps"><li>' + PWA_SVG.share + '<span>화면 아래(또는 위) <b>공유</b> 단추를 누릅니다</span></li>' +
        '<li>' + PWA_SVG.plus + '<span>목록을 내려 <b>홈 화면에 추가</b>를 누릅니다</span></li>' +
        '<li>' + PWA_SVG.home + '<span>오른쪽 위 <b>추가</b> → 홈 화면의 아이콘으로 엽니다</span></li></ol>' +
        '<p class="lead">아이폰은 <b>홈 화면에 추가한 앱에서만</b> 알림을 켤 수 있어요. 설치한 뒤 앱의 「내 정보」에서 알림을 켜 주세요.</p>';
    } else if (plat === 'android' && _pwaBip) {
      body = '<p class="lead">아래 단추를 누르면 홈 화면에 「' + _esc(name) + '」 앱이 생겨요.</p>' +
        '<p style="margin:0 0 16px"><button type="button" class="sys-pwa-b on" data-a="bip" style="width:100%;min-height:48px;font-size:15px">앱 설치</button></p>';
    } else if (plat === 'android') {
      body = '<p class="lead">크롬에서 아래 순서대로 누르면 홈 화면에 「' + _esc(name) + '」 앱이 생겨요. 이미 설치했다면 홈 화면 아이콘으로 열어 주세요.</p>' +
        '<ol class="sys-pwa-steps"><li>' + PWA_SVG.dots + '<span>오른쪽 위 <b>⋮</b> 메뉴를 누릅니다</span></li>' +
        '<li>' + PWA_SVG.plus + '<span><b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 누릅니다</span></li>' +
        '<li>' + PWA_SVG.home + '<span><b>설치</b> → 홈 화면의 아이콘으로 엽니다</span></li></ol>';
    } else {
      body = '<p class="lead">휴대폰 앱 설치는 휴대폰에서 할 수 있어요. PC 에서는 데스크탑 앱을 써 주세요.</p>';
    }
    sh.innerHTML = '<h2>📱 앱 설치<button type="button" class="sys-pwa-x" data-a="x" aria-label="닫기">✕</button></h2>' + body + '<div data-panel></div>';
    function close() {
      [bg, sh].forEach(function(n) { if (n.parentNode) n.parentNode.removeChild(n); });
      document.removeEventListener('keydown', onKey, true);
    }
    function onKey(ev) { if (ev.key === 'Escape') close(); }
    bg.addEventListener('click', close);
    sh.querySelector('[data-a="x"]').addEventListener('click', close);
    document.addEventListener('keydown', onKey, true);
    var bip = sh.querySelector('[data-a="bip"]');
    if (bip) bip.addEventListener('click', function() {
      var ev = _pwaBip; if (!ev) return;
      _pwaBip = null;
      try {
        ev.prompt();
        Promise.resolve(ev.userChoice).then(function(c) {
          if (c && c.outcome === 'accepted') {
            try { localStorage.setItem(PWA_INSTALLED_KEY, '1'); } catch(e) {}
            bip.parentNode.innerHTML = '<span class="sys-pwa-msg ok" style="display:block">설치했어요. 홈 화면의 아이콘으로 열어 주세요.</span>';
          }
        });
      } catch(e) { logError(e, '앱 설치'); }
    });
    document.body.appendChild(bg); document.body.appendChild(sh);
    if (plat !== 'pc') mountPanel(sh.querySelector('[data-panel]'), { sb:_pwaSb, inSheet:true });
    try { sh.focus(); } catch(e) {}   // 창 자체에 포커스(Esc 로 닫기 · 화면 읽기 프로그램이 창을 읽음)
  }

  // ④ 로그인 뒤 한 번 안내 띠 — ✕ = 이번 로그인만, 「다시 보지 않기」 = 이 기기에서 계속
  function _pwaBannerClose() { var b = document.getElementById('sys-pwa-banner'); if (b && b.parentNode) b.parentNode.removeChild(b); }
  function maybeInstallBanner(user) {
    if (!canInstallUi(user) || !document.body || document.getElementById('sys-pwa-banner')) return;
    try { if (localStorage.getItem(PWA_BANNER_OFF_KEY) === '1') return; } catch(e) {}
    var seen = _ssGet(PWA_BANNER_SEEN_KEY);
    if (seen && seen.uid === user.id) return;
    _ssSet(PWA_BANNER_SEEN_KEY, { uid: user.id });
    _pwaCss();
    var el = document.createElement('div');
    el.id = 'sys-pwa-banner'; el.className = 'sys-pwa-band no-print'; el.setAttribute('role', 'status');
    el.innerHTML = '<span>휴대폰 앱으로 설치할 수 있어요<small>홈 화면 아이콘 · 연차 결재 알림</small></span>' +
      '<button type="button" class="sys-pwa-b on" data-a="how">설치 방법</button>' +
      '<button type="button" class="sys-pwa-b" data-a="never">다시 보지 않기</button>' +
      '<button type="button" class="sys-pwa-x" data-a="x" aria-label="닫기">✕</button>';
    el.querySelector('[data-a="how"]').addEventListener('click', function() { openInstall(); });
    el.querySelector('[data-a="never"]').addEventListener('click', function() { try { localStorage.setItem(PWA_BANNER_OFF_KEY, '1'); } catch(e) {} _pwaBannerClose(); });
    el.querySelector('[data-a="x"]').addEventListener('click', _pwaBannerClose);
    document.body.appendChild(el);
  }
  // SysBar 가 로그인한 사람으로 그릴 때 한 번 — 알림 구독 확인 · 안내 띠 · 새 버전 확인
  function pwaOnUser(sbClient, user) {
    if (!pwaOn() || !user) return;
    if (sbClient) _pwaSb = sbClient;
    if (!pwaStaff(user)) return;
    pushSync(sbClient);
    setTimeout(function() { maybeInstallBanner(user); }, 600);
  }

  var Pwa = {
    platform: pwaPlatform, isStandalone: isStandalone, enabled: pwaOn, swEnabled: swWanted,
    canInstallUi: canInstallUi, openInstall: openInstall, maybeInstallBanner: maybeInstallBanner,
    panelVisible: panelVisible, mountPanel: mountPanel,
    pushStatus: pushStatus, pushEnable: pushEnable, pushDisable: pushDisable, pushTest: pushTest,
    register: swRegister, checkNewVersion: checkNewVersion, badge: pwaBadge, onUser: pwaOnUser,
    _kill: _swKill
  };

  // ── 비밀번호 다시 확인 (2026-11-03) — 앱 화면 잠금 해제 · 급여명세서 본인 확인 공용 ──
  //   지금 로그인한 계정의 이메일 + 입력한 비밀번호로 signInWithPassword. 성공하면 새 세션이 생기고(서버는 JWT amr 로
  //   「방금 비밀번호를 넣었다」를 확인할 수 있다 — payslip_verify_pw), 이전 세션은 지운다(남은 세션이 쌓이지 않게, 실패 무시).
  //   반환 { ok } | { ok:false, wrong:true } | { ok:false, noSession:true, reason } | { ok:false, reason }
  //   틀린 횟수는 scope 별로 이 창 sessionStorage 에 센다(새로고침해도 이어짐). RECHECK_MAX_FAILS 번이면 화면이 로그아웃한다.
  var RECHECK_MAX_FAILS = 5;
  function _recheckKey(scope) { return _prefix + '_recheck_fail_' + scope; }
  function recheckFails(scope) { var v = _ssGet(_recheckKey(scope)); return (v && v.n) || 0; }
  function recheckFailAdd(scope) { var n = recheckFails(scope) + 1; _ssSet(_recheckKey(scope), { n: n }); return n; }
  function recheckFailClear(scope) { _ssSet(_recheckKey(scope), null); }
  function _revokeSessionToken(token) {
    var c = global.APP_CONFIG || {};
    if (!token || !c.SUPABASE_URL || !global.fetch) return;
    try {
      global.fetch(c.SUPABASE_URL + '/auth/v1/logout?scope=local', {
        method: 'POST', keepalive: true,
        headers: { apikey: c.SUPABASE_KEY, Authorization: 'Bearer ' + token },
      }).then(null, function() {});
    } catch(e) {}
  }
  function recheckPassword(sbClient, pw) {
    var NET = '확인하지 못했어요. 네트워크를 확인하고 다시 시도하세요.';
    if (!sbClient || !sbClient.auth || !sbClient.auth.getSession) return Promise.resolve({ ok: false, reason: NET });
    return sbClient.auth.getSession().then(function(res) {
      var s = res && res.data && res.data.session;
      var email = s && s.user && s.user.email;
      if (!email) return { ok: false, noSession: true, reason: '로그인이 끝났어요. 다시 로그인해 주세요.' };
      var oldToken = s.access_token, oldUid = s.user.id;
      return sbClient.auth.signInWithPassword({ email: email, password: String(pw || '') }).then(function(r) {
        if (r && r.error) {
          var st = r.error.status || 0, code = r.error.code || '';
          if (code === 'invalid_credentials' || st === 400) return { ok: false, wrong: true };
          if (st === 429) return { ok: false, reason: '시도가 너무 많아요. 잠시 뒤 다시 시도하세요.' };
          return { ok: false, reason: NET };
        }
        var ns = r && r.data && r.data.session;
        if (!ns || !ns.user || ns.user.id !== oldUid) return { ok: false, reason: NET };
        if (ns.access_token !== oldToken) _revokeSessionToken(oldToken);
        return { ok: true };
      }, function() { return { ok: false, reason: NET }; });
    }, function() { return { ok: false, reason: NET }; });
  }

  // ── 데스크탑 앱 화면 잠금 (2026-11-03, PC 카카오톡 방식) — 앱 안에서만 ──
  //   앱을 켤 때(재실행 포함) 한 번 + 트레이 「지금 잠그기」(앱이 __kbDeskLock() 을 부름). 비활동 자동 잠금 없음.
  //   해제 = 비밀번호 다시 확인(recheckPassword). 해제 상태는 이 실행 동안만(sessionStorage — 앱을 다시 켜면 비어 있음).
  //   잠겨 있어도 화면 뒤에서는 그대로 돈다(감시·알림·트레이 숫자). 화면 내용은 이 파일이 불릴 때(<head>) 먼저 가린다.
  //   5번 틀리면 로그아웃(로그인 사본도 삭제). 로그인 화면에서 막 로그인한 경우는 잠그지 않는다(doLogin 이 해제 표시).
  var DESK_UNLOCK_KEY = _prefix + '_desk_unlocked';   // sessionStorage {uid}
  var _lockSb = null;
  var _lockEl = null;
  var _lockBusy = false;
  function _sessUser() {
    try { var v = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); return (v && v.id && v.role) ? v : null; } catch(e) { return null; }
  }
  function _deskNeedsLock() {
    if (!isDesktopApp()) return false;
    var u = _sessUser();
    if (!u) return false;
    var f = _ssGet(DESK_UNLOCK_KEY);
    return !(f && f.uid === u.id);
  }
  function _deskMarkUnlocked(uid) {
    if (!isDesktopApp() || !uid) return;
    _ssSet(DESK_UNLOCK_KEY, { uid: uid });
    recheckFailClear('lock');
  }
  function _lockClient() {
    if (_lockSb) return _lockSb;
    var c = global.APP_CONFIG || {};
    try { if (global.supabase && global.supabase.createClient) _lockSb = global.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_KEY); } catch(e) {}
    return _lockSb;
  }
  function _lockCss() {
    if (document.getElementById('kb-desk-lock-css')) return;
    var c = global.APP_CONFIG || {};
    var p1 = c.COLOR_PRIMARY || '#0f172a', p2 = c.COLOR_PRIMARY2 || '#1b3a6b';
    var s = document.createElement('style');
    s.id = 'kb-desk-lock-css';
    s.textContent =
      'html.kb-desk-locked body>*:not(#kb-desk-lock){visibility:hidden!important}' +
      'html.kb-desk-locked,html.kb-desk-locked body{overflow:hidden!important}' +
      '#kb-desk-lock{position:fixed;inset:0;z-index:2147483647;visibility:visible;display:flex;align-items:center;justify-content:center;' +
        'background:linear-gradient(160deg,' + p1 + ',' + p2 + ');font-family:\'Pretendard\',\'Noto Sans KR\',-apple-system,sans-serif;padding:20px;box-sizing:border-box}' +
      '#kb-desk-lock *{box-sizing:border-box}' +
      '#kb-desk-lock .kdl-card{width:100%;max-width:340px;background:#fff;border-radius:16px;padding:30px 26px 22px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.35)}' +
      '#kb-desk-lock .kdl-logo{height:44px;max-width:180px;object-fit:contain;margin:0 auto 10px;display:block}' +
      '#kb-desk-lock .kdl-co{font-size:14px;font-weight:700;color:#475569}' +
      '#kb-desk-lock .kdl-who{font-size:20px;font-weight:800;color:#0f172a;margin:14px 0 4px}' +
      '#kb-desk-lock .kdl-sub{font-size:12px;color:#64748b;margin-bottom:16px}' +
      '#kb-desk-lock input{width:100%;padding:12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:15px;margin-bottom:10px;font-family:inherit}' +
      '#kb-desk-lock input:focus{outline:none;border-color:' + p2 + ';box-shadow:0 0 0 3px rgba(27,58,107,.15)}' +
      '#kb-desk-lock .kdl-err{font-size:12px;color:#b91c1c;min-height:18px;margin-bottom:6px;line-height:1.5}' +
      '#kb-desk-lock .kdl-ok{width:100%;padding:12px;border:none;border-radius:10px;background:' + p1 + ';color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}' +
      '#kb-desk-lock .kdl-ok:disabled{opacity:.6;cursor:default}' +
      '#kb-desk-lock .kdl-out{margin-top:14px;background:none;border:none;color:#64748b;font-size:12px;text-decoration:underline;cursor:pointer;font-family:inherit}';
    (document.head || document.documentElement).appendChild(s);
  }
  function _lockFocus() {
    if (!_lockEl) return;
    var i = _lockEl.querySelector('input');
    if (i && document.activeElement !== i) { try { i.focus(); } catch(e) {} }
  }
  // 잠긴 동안 뒤 화면으로 가는 키·포커스를 막는다(뒤 화면은 visibility:hidden 이라 클릭·포커스 대상도 아님)
  function _lockKey(ev) {
    if (!_lockEl) return;
    ev.stopPropagation();                       // 화면의 단축키([ 키 등)가 동작하지 않게
    if (_lockEl.contains(ev.target)) return;    // 잠금 창 안 입력은 그대로
    if (ev.key === 'Tab' || ev.key === 'Enter' || ev.key === ' ' || /^Arrow|^Page|^Home$|^End$/.test(ev.key || '')) ev.preventDefault();
    _lockFocus();
  }
  function _lockFocusIn(ev) { if (_lockEl && !_lockEl.contains(ev.target)) _lockFocus(); }
  function _lockMount() {
    if (_lockEl || !document.body) return;
    var c = global.APP_CONFIG || {};
    var u = _sessUser() || {};
    var el = document.createElement('div');
    el.id = 'kb-desk-lock';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'kb-desk-lock-who');
    var form = document.createElement('form');
    form.className = 'kdl-card';
    form.setAttribute('autocomplete', 'off');
    if (c.LOGO_URL) {
      var img = document.createElement('img');
      img.className = 'kdl-logo'; img.src = c.LOGO_URL; img.alt = '';
      img.onerror = function() { img.style.display = 'none'; };
      form.appendChild(img);
    }
    function div(cls, text, id) { var d = document.createElement('div'); d.className = cls; if (id) d.id = id; d.textContent = text; form.appendChild(d); return d; }
    div('kdl-co', c.COMPANY_SHORT || c.COMPANY_KO || '');
    div('kdl-who', (u.name || '') + ' 님', 'kb-desk-lock-who');
    div('kdl-sub', '화면이 잠겨 있어요. 비밀번호를 입력하세요.');
    var inp = document.createElement('input');
    inp.type = 'password'; inp.autocomplete = 'current-password'; inp.placeholder = '비밀번호'; inp.setAttribute('aria-label', '비밀번호');
    form.appendChild(inp);
    var err = div('kdl-err', '');
    err.setAttribute('role', 'alert');
    var ok = document.createElement('button');
    ok.type = 'submit'; ok.className = 'kdl-ok'; ok.textContent = '잠금 해제';
    form.appendChild(ok);
    var out = document.createElement('button');
    out.type = 'button'; out.className = 'kdl-out'; out.textContent = '다른 계정으로 로그인';
    form.appendChild(out);
    el.appendChild(form);

    function setErr(t) { err.textContent = t || ''; }
    form.addEventListener('submit', function(ev) {
      ev.preventDefault();
      if (_lockBusy) return;
      var pw = inp.value;
      if (!pw) { setErr('비밀번호를 입력하세요.'); _lockFocus(); return; }
      _lockBusy = true; ok.disabled = true; ok.textContent = '확인 중...'; setErr('');
      recheckPassword(_lockClient(), pw).then(function(r) {
        _lockBusy = false; ok.disabled = false; ok.textContent = '잠금 해제'; inp.value = '';
        if (r.ok) { _deskMarkUnlocked((_sessUser() || {}).id); _lockUnmount(); _filesAfterUnlock(); return; }
        if (r.wrong) {
          var n = recheckFailAdd('lock');
          if (n >= RECHECK_MAX_FAILS) { setErr('비밀번호를 ' + RECHECK_MAX_FAILS + '번 틀려 로그아웃합니다.'); _lockLogout(1200); return; }
          setErr('비밀번호가 맞지 않아요. (' + n + '/' + RECHECK_MAX_FAILS + ')');
        } else if (r.noSession) {
          setErr(r.reason); _lockLogout(1200); return;
        } else setErr(r.reason);
        _lockFocus();
      });
    });
    out.addEventListener('click', function() { if (!_lockBusy) _lockLogout(0); });

    document.body.appendChild(el);
    _lockEl = el;
    global.addEventListener('keydown', _lockKey, true);
    global.addEventListener('keyup', _lockKey, true);
    global.addEventListener('keypress', _lockKey, true);
    document.addEventListener('focusin', _lockFocusIn, true);
    try { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); } catch(e) {}
    setTimeout(_lockFocus, 0);
  }
  function _lockUnmount() {
    try { document.documentElement.classList.remove('kb-desk-locked'); } catch(e) {}
    global.removeEventListener('keydown', _lockKey, true);
    global.removeEventListener('keyup', _lockKey, true);
    global.removeEventListener('keypress', _lockKey, true);
    document.removeEventListener('focusin', _lockFocusIn, true);
    if (_lockEl && _lockEl.parentNode) _lockEl.parentNode.removeChild(_lockEl);
    _lockEl = null;
  }
  function _lockShow() {
    _lockCss();
    try { document.documentElement.classList.add('kb-desk-locked'); } catch(e) {}
    if (document.body) { _lockMount(); return; }
    // <head> 에서 불렸다 — <body> 가 생기는 즉시 잠금 창을 붙인다(그 전까지는 위 CSS 로 이미 가려져 있음)
    function later() { if (_deskNeedsLock()) _lockMount(); }
    try {
      var mo = new MutationObserver(function() { if (document.body) { mo.disconnect(); later(); } });
      mo.observe(document.documentElement, { childList: true });
    } catch(e) {}
    document.addEventListener('DOMContentLoaded', later);
  }
  // 5번 틀림 · 「다른 계정으로 로그인」 · 세션 없음 → 로그아웃(로그인 사본 삭제) 후 새로고침 = 그 화면의 로그인 화면
  function _lockLogout(delay) {
    _lockBusy = true;
    var sb = _lockClient();
    try { SessionManager.onLogout(); } catch(e) {}
    try { Auth.clearSession(); } catch(e) {}
    _ssSet(DESK_UNLOCK_KEY, null);
    recheckFailClear('lock');
    var done = false;
    function go() { if (done) return; done = true; global.location.reload(); }
    var p = null;
    try { p = sb && sb.auth && sb.auth.signOut ? sb.auth.signOut({ scope: 'local' }) : null; } catch(e) {}
    var wait = Math.max(delay || 0, 300);
    if (p && p.then) p.then(function() { setTimeout(go, delay || 0); }, function() { setTimeout(go, delay || 0); });
    setTimeout(go, wait + 2000);   // signOut 이 늦어도 새로고침
  }
  // 앱(Rust) 트레이 「지금 잠그기」
  function lockDesktopNow() {
    if (!isDesktopApp() || !_sessUser()) return false;
    _ssSet(DESK_UNLOCK_KEY, null);
    _lockShow();
    return true;
  }
  // ── 파일 탐색기 창(앱 1.2.0) — 앱 안에서만. 창은 앱에 내장된 화면이고 파일 일은 앱(Rust)이 한다. 여기서는 「열어 달라」만 ──
  //   왼쪽 메뉴 「파일」 · 트레이 「파일」(앱이 __kbDeskOpenFiles() 를 부름). 로그인 전이면 열지 않고(false → 앱이 이 창을 보여 줌),
  //   잠겨 있으면 해제한 뒤에 연다(잠금 중에는 파일 창을 열지 않는다 — 2026-11-03 작업지시서).
  var _filesPending = false;
  function openDesktopFiles() {
    if (!isDesktopApp() || !_sessUser()) return false;
    if (_lockEl || _deskNeedsLock()) { _filesPending = true; return false; }
    _deskInvoke('desk_open_files');
    return true;
  }
  function _filesAfterUnlock() {
    if (!_filesPending) return;
    _filesPending = false;
    _deskInvoke('desk_open_files');
  }

  // 이 파일이 불릴 때(<head>, 화면 내용보다 먼저) 판정해서 가린다
  (function() {
    if (!isDesktopApp()) return;
    global.__kbDeskLock = lockDesktopNow;
    global.__kbDeskOpenFiles = openDesktopFiles;
    if (_deskNeedsLock()) _lockShow();
  })();

  // 「다른 부서로 보기」 띠 — React 밖(DOM)에 둔다. 권한 없는 화면의 안내 화면에서도 보여야 해서.
  function renderViewBand() {
    try {
      var v = getViewAs();
      var el = document.getElementById('sys-view-band');
      if (!v) { if (el) el.parentNode.removeChild(el); return; }
      if (!document.body) return;
      if (!el) {
        el = document.createElement('div');
        el.id = 'sys-view-band';
        el.className = 'no-print';
        el.setAttribute('role', 'status');
        el.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:8px 14px;'
          + 'background:#f59e0b;color:#1c1917;font-size:13px;font-weight:700;line-height:1.4;text-align:center;';
        document.body.insertBefore(el, document.body.firstChild);
      }
      el.textContent = '';
      var t = document.createElement('span');
      t.textContent = v.team_name + ' 입장으로 보는 중 — 메뉴·버튼만 바뀌고, 데이터는 관리자 권한으로 보여요';
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = '원래대로';
      b.style.cssText = 'padding:4px 12px;border-radius:6px;border:1px solid #1c1917;background:#fff;color:#1c1917;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;';
      b.onclick = function() { _ssSet(VIEW_KEY, null); location.reload(); };
      el.appendChild(t); el.appendChild(b);
    } catch(e) {}
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderViewBand);
    else renderViewBand();
  }

  // ── PC 왼쪽 메뉴 선 아이콘 (24x24, stroke=currentColor → 테마 색 자동) ──
  var SIDE_ICONS = {
    home:    '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    project: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 15v-3M12 15V9M17 15v-5"/>',
    cal:     '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h3M8 17h6"/>',
    note:    '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM8.5 11h7M8.5 15h5"/>',
    won:     '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7.5 9.5l1.5 5 1.5-4 1.5 4 1.5-4 1.5 4 1.5-5M7 12h10"/>',
    admin:   '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16"/><path d="M15 10h4a1 1 0 0 1 1 1v10M3 21h18M8 8h3M8 12h3M8 16h3"/>',
    chart:   '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    wallet:  '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1V7z"/><path d="M4 7l11-3v3M16 13.5h.01"/>',
    key:     '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
    people:  '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a4.5 4.5 0 0 1 5 4.8"/>',
    gear:    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    doc:     '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    globe:   '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    out:     '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/>',
    chevL:   '<path d="M15 18l-6-6 6-6"/>',
    chevR:   '<path d="M9 18l6-6-6-6"/>',
    // 하위 탭용
    user:    '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    folder:  '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    list:    '<path d="M9 4h6v3H9z"/><path d="M9 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3"/><path d="M9 12h6M9 16h4"/>',
    check:   '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 12l3 3 5-6"/>',
    pencil:  '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    clock:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    box:     '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
    flag:    '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
    menu:    '<path d="M4 7h16M4 12h16M4 17h16"/>',
    x:       '<path d="M6 6l12 12M18 6L6 18"/>',
    phone:   '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18h2"/>',
    grid:    '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  };
  function sideIcon(React, name, size) {
    var s = size || 18;
    return React.createElement('svg', {
      key:'i', width:s, height:s, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:2,
      strokeLinecap:'round', strokeLinejoin:'round', 'aria-hidden':'true', className:'sys-ico',
      dangerouslySetInnerHTML:{ __html: SIDE_ICONS[name] || '' }
    });
  }

  // 메뉴 접힘 상태 저장 키 (PC별 기억)
  var SIDE_OFF_KEY = _prefix + '_side_off';
  function sideOffGet() { try { return localStorage.getItem(SIDE_OFF_KEY) === '1'; } catch(e) { return false; } }
  function sideOffSet(v) { try { if (v) localStorage.setItem(SIDE_OFF_KEY, '1'); else localStorage.removeItem(SIDE_OFF_KEY); } catch(e) {} }
  // 펼친 상위 메뉴(하위 있음) 저장 키 (PC별 기억). 지금 보고 있는 화면의 메뉴는 이 값과 무관하게 항상 펼친다
  var SIDE_OPEN_KEY = _prefix + '_side_open';
  function sideOpenGet() {
    try { var v = JSON.parse(localStorage.getItem(SIDE_OPEN_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch(e) { return []; }
  }
  function sideOpenSet(list) { try { if (list.length) localStorage.setItem(SIDE_OPEN_KEY, JSON.stringify(list)); else localStorage.removeItem(SIDE_OPEN_KEY); } catch(e) {} }
  // 비회원 모드는 따로 기억한다(로그인 사용자의 펼침·접힘과 섞이지 않게)
  var GUEST_OPEN_KEY = _prefix + '_guest_side_open';
  var GUEST_OFF_KEY  = _prefix + '_guest_side_off';
  function guestOpenGet() {
    try { var v = JSON.parse(localStorage.getItem(GUEST_OPEN_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch(e) { return []; }
  }
  function guestOpenSet(list) { try { if (list.length) localStorage.setItem(GUEST_OPEN_KEY, JSON.stringify(list)); else localStorage.removeItem(GUEST_OPEN_KEY); } catch(e) {} }
  function guestOffGet() { try { return localStorage.getItem(GUEST_OFF_KEY) === '1'; } catch(e) { return false; } }
  function guestOffSet(v) { try { if (v) localStorage.setItem(GUEST_OFF_KEY, '1'); else localStorage.removeItem(GUEST_OFF_KEY); } catch(e) {} }

  // ── 휴대폰 폭 판정 · 서랍 메뉴 (2026-11-16, v3.19 모바일 버전2) ──
  //   휴대폰 = APP_CONFIG.MOBILE_MAX_WIDTH 이하. <html> 에 sys-m 클래스를 붙여 CSS 가 같은 기준을 쓰게 한다
  //   (화면 CSS 에 768 같은 숫자를 다시 쓰지 말고 html.sys-m 선택자를 쓸 것).
  var MOBILE_MAX = ((global.APP_CONFIG && global.APP_CONFIG.MOBILE_MAX_WIDTH) || 768);
  var _mq = null;
  try { _mq = global.matchMedia('(max-width:' + MOBILE_MAX + 'px)'); } catch(e) { _mq = null; }
  function isMobile() { return _mq ? _mq.matches : ((global.innerWidth || 1024) <= MOBILE_MAX); }
  function syncMobileClass() {
    var r = document.documentElement; if (!r) return;
    var m = isMobile();
    if (r.classList.contains('sys-m') !== m) {
      // 휴대폰 ↔ PC 가 바뀌는 순간에는 메뉴 미끄러짐 애니메이션을 끈다(창 크기를 바꿀 때 메뉴가 쓸려 들어오지 않게)
      r.classList.add('sys-noanim');
      setTimeout(function () { r.classList.remove('sys-noanim'); }, 300);
    }
    r.classList.toggle('sys-m', m);
    if (!m && _drawer.open) drawerClose();   // 휴대폰 → PC 로 넓어지면 서랍은 닫는다
  }
  // 서랍 상태(화면에 하나). 열 때 history 에 한 칸을 넣어 휴대폰 「뒤로」가 서랍만 닫게 한다.
  //   이 popstate 처리기는 sysbar.js 를 읽을 때 붙으므로 화면의 popstate 처리기보다 먼저 돈다 —
  //   서랍 칸이 빠질 때는 화면 처리기까지 가지 않게 막는다(탭 주소가 바뀌지 않는다).
  var _drawer = { open:false, pushed:false, after:null, set:null };
  function _drawerSetOpen(v) {
    _drawer.open = v;
    try { document.documentElement.classList.toggle('sys-drawer-open', v); } catch(e) {}
    if (_drawer.set) _drawer.set(v);
  }
  function drawerOpen() {
    if (_drawer.open || !isMobile()) return;
    _drawerSetOpen(true);
    try {
      var st = global.history.state;
      var ns = (st && typeof st === 'object') ? Object.assign({}, st) : {};
      ns.__sysDrawer = 1;
      global.history.pushState(ns, '');   // 주소 인자 생략 = 지금 주소(#탭) 그대로
      _drawer.pushed = true;
    } catch(e) { _drawer.pushed = false; }
  }
  // after: 서랍이 다 닫힌 뒤 할 일(같은 화면 탭 전환 등 — history 칸이 빠진 다음에 해야 주소 기록이 꼬이지 않는다)
  function drawerClose(after) {
    if (!_drawer.open) { if (after) after(); return; }
    if (_drawer.pushed) { _drawer.after = after || null; try { global.history.back(); return; } catch(e) { _drawer.pushed = false; } }
    _drawerSetOpen(false);
    if (after) after();
  }
  // 서랍 안 링크로 다른 화면에 갈 때: 서랍 칸을 새 화면으로 바꿔 끼운다(뒤로 = 서랍 열기 전 화면)
  function drawerGo(href) {
    var same = false;
    try { var u = new URL(href, global.location.href); same = u.pathname === global.location.pathname; } catch(e) {}
    if (_drawer.open && _drawer.pushed && !same) { _drawer.open = false; global.location.replace(href); return; }
    drawerClose(function() { global.location.href = href; });
  }
  global.addEventListener('popstate', function(ev) {
    if (!_drawer.open || !_drawer.pushed) return;
    try { ev.stopImmediatePropagation(); } catch(e) {}
    _drawer.pushed = false;
    var f = _drawer.after; _drawer.after = null;
    _drawerSetOpen(false);
    if (f) setTimeout(f, 0);
  });
  global.addEventListener('keydown', function(ev) { if (ev.key === 'Escape' && _drawer.open) drawerClose(); });
  if (_mq) { try { _mq.addEventListener('change', syncMobileClass); } catch(e) { try { _mq.addListener(syncMobileClass); } catch(e2) { global.addEventListener('resize', syncMobileClass); } } }
  else global.addEventListener('resize', syncMobileClass);
  syncMobileClass();

  // ── 표를 휴대폰 카드로(.m-cards): 머리줄 글자를 각 칸 data-label 로 채운다(이미 있으면 그대로) ──
  var _mcPending = false;
  function labelMCards() {
    _mcPending = false;
    try {
      var tbs = document.querySelectorAll('table.m-cards');
      for (var i = 0; i < tbs.length; i++) {
        var ths = tbs[i].querySelectorAll('thead th');
        if (!ths.length) continue;
        var names = []; for (var j = 0; j < ths.length; j++) names.push((ths[j].textContent || '').trim());
        var rows = tbs[i].querySelectorAll('tbody tr');
        for (var r = 0; r < rows.length; r++) {
          var c = 0, tds = rows[r].children;
          for (var k = 0; k < tds.length; k++) {
            if (!tds[k].hasAttribute('data-label') && names[c]) tds[k].setAttribute('data-label', names[c]);
            c += (+tds[k].getAttribute('colspan') || 1);
          }
        }
      }
    } catch(e) { logError(e, '표 카드 이름표'); }
  }
  function watchMCards() {
    try {
      var mo = new MutationObserver(function() {
        if (_mcPending || !document.querySelector('table.m-cards')) return;
        _mcPending = true;
        (global.requestAnimationFrame || setTimeout)(labelMCards);
      });
      mo.observe(document.body, { childList:true, subtree:true });
      labelMCards();
    } catch(e) { logError(e, '표 카드 감시'); }
  }
  if (document.body) watchMCards(); else document.addEventListener('DOMContentLoaded', watchMCards);

  var CSS_INJECTED = false;

  /**
   * injectThemeVars()
   * APP_CONFIG의 브랜드 색상을 :root CSS 변수로 주입한다.
   * documentElement.style(인라인)에 주입하므로 각 파일 <style>의 :root보다 우선한다.
   * → config.js만 바꾸면 전 페이지 브랜드 색이 통일된다 (화이트라벨 핵심).
   * 주입 실패 시에도 각 색상 사용처는 var(--theme, #폴백) 형태라 기존 색이 유지된다.
   */
  var THEME_INJECTED = false;
  function injectThemeVars() {
    try {
      var cfg = global.APP_CONFIG || {};
      var root = document.documentElement;
      if (!root) return;
      if (cfg.COLOR_PRIMARY)  root.style.setProperty('--theme',        cfg.COLOR_PRIMARY);
      if (cfg.COLOR_PRIMARY2) root.style.setProperty('--theme2',       cfg.COLOR_PRIMARY2);
      if (cfg.COLOR_ACCENT)   root.style.setProperty('--brand-accent', cfg.COLOR_ACCENT);
      if (cfg.COLOR_GOLD)     root.style.setProperty('--brand-gold',   cfg.COLOR_GOLD);
      THEME_INJECTED = true;
    } catch(e) {}
  }
  // config.js가 먼저 로드된 경우 즉시 주입 (표준 로드 순서)
  injectThemeVars();

  function injectCss() {
    if (!THEME_INJECTED) injectThemeVars();  // APP_CONFIG가 늦게 로드된 경우 보장
    if (CSS_INJECTED || document.getElementById('sysbar-css')) { CSS_INJECTED = true; return; }
    // 왼쪽 메뉴는 화면들의 모바일 기준(MOBILE_MAX_WIDTH)보다 넓을 때만 — 그 폭 이하는 각 화면이 하단 탭바를 쓴다
    var sideMin = (((global.APP_CONFIG && global.APP_CONFIG.MOBILE_MAX_WIDTH) || 768) + 1) + 'px';
    var s = document.createElement('style');
    s.id = 'sysbar-css';
    s.textContent =
      '@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css");' +
      'body,button,input,select,textarea{font-family:\'Pretendard\',\'Noto Sans KR\',sans-serif!important;}' +
      /* ─── 휴대폰 상단 막대 (MOBILE_MAX_WIDTH 이하, 2026-11-16 버전2) ───
         ☰(서랍 메뉴) + 화면 제목만. 높이 48px + 아이폰 위 안전영역. 서랍 = 아래 .sys-side 를 그대로 씀(메뉴 한 벌) */
      '.sys-bar{position:sticky;top:0;z-index:300;background:var(--theme,#0f172a);color:#fff;display:flex;align-items:center;gap:4px;' +
        'height:calc(48px + env(safe-area-inset-top,0px));padding:env(safe-area-inset-top,0px) calc(8px + env(safe-area-inset-right,0px)) 0 calc(4px + env(safe-area-inset-left,0px));box-sizing:border-box;flex-shrink:0;}' +
      '.sys-m-menu{position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:44px;flex-shrink:0;padding:0;border:none;border-radius:10px;background:transparent;color:#e2e8f0;cursor:pointer;font-family:inherit;}' +
      '.sys-m-menu:active{background:rgba(255,255,255,.12);}' +
      '.sys-m-dot{position:absolute;top:5px;right:3px;min-width:16px;height:16px;padding:0 4px;box-sizing:border-box;border-radius:8px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;line-height:16px;text-align:center;font-variant-numeric:tabular-nums;}' +
      '.sys-m-title{flex:1;min-width:0;display:flex;align-items:baseline;gap:6px;white-space:nowrap;overflow:hidden;}' +
      '.sys-m-title b{font-size:16px;font-weight:800;letter-spacing:-.3px;flex-shrink:0;}' +
      '.sys-m-title span{font-size:14px;font-weight:500;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;}' +
      '.sys-m-x{display:none;}' +
      '@media print{.no-print{display:none!important;}}' +

      /* ─── 왼쪽 메뉴 (PC, MOBILE_MAX_WIDTH 초과) ───
         --sysbar-h : 화면 위 고정 막대 높이. 각 화면의 sticky top 은 var(--sysbar-h,38px) 를 쓴다.
                      휴대폰 = 38px(상단 막대), PC 왼쪽 메뉴 = 0
         --sys-side-w : 왼쪽 메뉴 폭. 접으면(body.sys-side-off) 0 */
      ':root{--sysbar-h:calc(48px + env(safe-area-inset-top,0px));--sys-head-h:45px;--sys-side-w:212px;}' +
      '.sys-side,.sys-side-tog,.sys-pc-only,.sys-drawer-bg{display:none;}' +
      '@media(min-width:' + sideMin + '){' +
        'body.sys-has-side{--sysbar-h:0px;padding-left:var(--sys-side-w);transition:padding-left .2s;}' +
        'body.sys-has-side.sys-side-off{padding-left:0;}' +
        'body.sys-has-side .sys-bar{display:none;}' +
        'body.sys-has-side .sys-portal-tabs,body.sys-has-side .sys-page-tabs,body.sys-has-side .sys-mobile-only{display:none!important;}' +
        'body.sys-has-side .sys-pc-only{display:block;}' +
        '.sys-side{display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;width:var(--sys-side-w);background:var(--theme,#0f172a);color:#cbd5e1;z-index:190;border-right:1px solid rgba(255,255,255,.06);transition:transform .2s;}' +
        'body.sys-side-off .sys-side{transform:translateX(-100%);}' +
        '.sys-side-tog{display:flex;align-items:center;justify-content:center;position:fixed;top:50%;margin-top:-22px;left:var(--sys-side-w);width:18px;height:44px;padding:0;border:none;border-radius:0 8px 8px 0;background:var(--theme,#0f172a);color:#94a3b8;cursor:pointer;z-index:195;box-shadow:2px 2px 6px rgba(0,0,0,.15);transition:left .2s,color .15s;}' +
        '.sys-side-tog:hover{color:#fff;}' +
        'body.sys-side-off .sys-side-tog{left:0;}' +
      '}' +
      '.sys-side-brand{display:flex;align-items:center;gap:10px;height:45px;box-sizing:border-box;padding:0 16px;text-decoration:none;color:#fff;border-bottom:1px solid rgba(255,255,255,.07);}' +
      '.sys-side-brand img{width:30px;height:30px;object-fit:contain;flex-shrink:0;}' +
      '.sys-side-tt{display:flex;flex-direction:column;min-width:0;}' +
      '.sys-side-ver{font-size:10px;font-weight:500;color:#64748b;line-height:1.2;letter-spacing:0;}' +
      '.sys-side-brand b{display:block;font-size:15px;font-weight:800;letter-spacing:-.3px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.sys-side-nav{flex:1;min-height:0;overflow-y:auto;padding:12px 10px;display:flex;flex-direction:column;gap:2px;scrollbar-width:thin;}' +
      '.sys-side-b{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:8px;font-size:13.5px;font-weight:600;color:#94a3b8;text-decoration:none;cursor:pointer;border:none;background:transparent;font-family:inherit;text-align:left;width:100%;transition:background .12s,color .12s;}' +
      '.sys-side-b:hover{background:rgba(255,255,255,.07);color:#fff;}' +
      '.sys-side-b .sys-ico{flex-shrink:0;}' +
      '.sys-side-b.on{background:#1d4ed8;color:#fff;cursor:default;}' +
      '.sys-side-b.on-admin{background:rgba(124,58,237,.22);color:#fff;}' +
      '.sys-side-b.on-parent{background:rgba(29,78,216,.22);color:#fff;}' +
      '.sys-side-b.disabled{color:#475569;}' +
      '.sys-side-b.disabled:hover{background:transparent;color:#64748b;}' +
      '.sys-side-sub{display:flex;flex-direction:column;gap:1px;margin:2px 0 4px 21px;padding-left:8px;border-left:1px solid rgba(255,255,255,.1);}' +
      '.sys-side-sub .sys-side-b{padding:7px 10px;font-size:12.5px;font-weight:500;gap:9px;}' +
      '.sys-side-sub .sys-side-b.on{background:#1d4ed8;cursor:pointer;}' +
      '.sys-side-sub.adm .sys-side-b.on{background:#7c3aed;cursor:default;}' +
      '.sys-side-dot{width:16px;height:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}' +
      '.sys-side-dot:before{content:"";width:4px;height:4px;border-radius:50%;background:currentColor;}' +
      '.sys-side-chev{margin-left:auto;flex-shrink:0;opacity:.6;transition:transform .15s;}' +
      '.sys-side-b[aria-expanded="true"] .sys-side-chev{transform:rotate(90deg);}' +
      '.sys-side-wait{padding:7px 10px;font-size:12px;color:#64748b;}' +
      '.sys-side-b .sys-side-badge + .sys-side-chev{margin-left:6px;}' +
      '.sys-side-badge{margin-left:auto;background:#ef4444;color:#fff;border-radius:10px;padding:0 6px;font-size:10px;font-weight:700;line-height:16px;}' +
      '.sys-side-foot{padding:12px 12px 14px;border-top:1px solid rgba(255,255,255,.07);}' +
      '.sys-side-view{padding:0 4px 10px;}' +
      '.sys-side-view label{display:block;font-size:10.5px;color:#64748b;margin-bottom:4px;}' +
      '.sys-side-view select{width:100%;padding:5px 6px;border-radius:6px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font-size:12px;font-family:inherit;}' +
      '.sys-side-view.on select{border-color:#f59e0b;color:#fbbf24;}' +
      '.sys-side-who{padding:0 4px 10px;}' +
      '.sys-side-who b{display:block;font-size:13px;color:#fff;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.sys-side-who span{display:block;font-size:11px;color:#64748b;margin-top:1px;}' +
      '.sys-side-btns{display:flex;gap:6px;}' +
      '.sys-side-install{width:100%;margin-bottom:6px;color:#e2e8f0;border-color:#475569;}' +
      '.sys-side-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:7px 8px;border-radius:7px;border:1px solid #334155;background:transparent;color:#94a3b8;font-size:12px;font-family:inherit;cursor:pointer;text-decoration:none;white-space:nowrap;}' +
      '.sys-side-btn:hover{color:#fff;border-color:#475569;}' +
      '@media print{.sys-side,.sys-side-tog{display:none!important;}body.sys-has-side{padding-left:0!important;transition:none!important;}}' +

      /* ─── 휴대폰 서랍 메뉴 + 공통 휴대폰 규칙 (html.sys-m = MOBILE_MAX_WIDTH 이하, sysbar.js 가 붙임) ─── */
      'html.sys-m{--sys-head-h:0px;-webkit-text-size-adjust:100%;text-size-adjust:100%;}' +
      'html.sys-m body{padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px);}' +
      'html.sys-m .sys-side{display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;width:min(86vw,320px);background:var(--theme,#0f172a);color:#cbd5e1;z-index:960;' +
        'transform:translateX(-102%);visibility:hidden;transition:transform .22s ease,visibility 0s linear .22s;box-shadow:8px 0 28px rgba(0,0,0,.28);' +
        'padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);box-sizing:border-box;overscroll-behavior:contain;}' +
      'html.sys-noanim .sys-side,html.sys-noanim .sys-side-tog,html.sys-noanim body.sys-has-side,html.sys-noanim .sys-drawer-bg{transition:none!important;}' +
      'html.sys-m.sys-drawer-open .sys-side{transform:none;visibility:visible;transition:transform .22s ease;}' +
      'html.sys-m .sys-drawer-bg{display:block;position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:955;opacity:0;pointer-events:none;transition:opacity .2s;touch-action:none;}' +
      'html.sys-m.sys-drawer-open .sys-drawer-bg{opacity:1;pointer-events:auto;}' +
      'html.sys-drawer-open,html.sys-drawer-open body{overflow:hidden!important;overscroll-behavior:none;}' +
      'html.sys-m .sys-side-brand{height:56px;padding:0 56px 0 16px;flex-shrink:0;}' +
      'html.sys-m .sys-side-brand b{font-size:16px;}' +
      'html.sys-m .sys-side-ver{font-size:12px;}' +
      'html.sys-m .sys-m-x{display:flex;align-items:center;justify-content:center;position:absolute;top:calc(env(safe-area-inset-top,0px) + 6px);right:6px;z-index:1;width:44px;height:44px;border:none;background:transparent;color:#94a3b8;border-radius:10px;cursor:pointer;padding:0;}' +
      'html.sys-m .sys-side-nav{padding:10px 10px;gap:2px;}' +
      'html.sys-m .sys-side-b{min-height:46px;font-size:15px;padding:0 12px;}' +
      'html.sys-m .sys-side-sub{margin-left:21px;}' +
      'html.sys-m .sys-side-sub .sys-side-b{min-height:44px;font-size:14px;padding:0 10px;}' +
      'html.sys-m .sys-side-badge{font-size:12px;line-height:20px;padding:0 7px;border-radius:10px;}' +
      'html.sys-m .sys-side-wait{font-size:14px;padding:12px 10px;}' +
      'html.sys-m .sys-side-who b{font-size:15px;}' +
      'html.sys-m .sys-side-who span{font-size:13px;}' +
      'html.sys-m .sys-side-view label{font-size:13px;}' +
      'html.sys-m .sys-side-view select{min-height:44px;font-size:16px;}' +
      'html.sys-m .sys-side-btn{min-height:44px;font-size:14px;}' +
      /* 휴대폰에서는 PC 처럼 화면 안 탭 줄·관리포털 탭 줄·화면 제목 띠를 숨긴다(서랍 메뉴와 상단 막대 제목이 대신함) */
      'html.sys-m .sys-portal-tabs,html.sys-m .sys-page-tabs,html.sys-m .sys-page-head{display:none!important;}' +
      /* 입력칸 글자 16px — 아이폰이 입력할 때 화면을 확대하지 않게 */
      'html.sys-m input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]),html.sys-m select,html.sys-m textarea{font-size:16px!important;}' +
      'html.sys-m .btn{min-height:44px;}' +
      'html.sys-m .btn-sm{min-height:40px;}' +
      '@media print{.sys-drawer-bg,.sys-bar{display:none!important;}}' +

      /* ─── 버전2 디자인 토큰 (모든 폭 공통) — 새 코드는 숫자 대신 이 변수를 쓴다 ─── */
      ':root{--sys-radius:10px;--sys-radius-sm:6px;--sys-radius-lg:14px;--sys-gap:12px;--sys-pad:16px;' +
        '--sys-shadow:0 1px 3px rgba(15,23,42,.08),0 1px 2px rgba(15,23,42,.04);--sys-shadow-lg:0 10px 30px rgba(15,23,42,.18);' +
        '--sys-line:#e2e8f0;--sys-bg:#f1f5f9;--sys-card:#fff;--sys-text:#0f172a;--sys-muted:#64748b;--sys-accent:#1d4ed8;--sys-danger:#dc2626;}' +
      'html.sys-m{--sys-pad:14px;--sys-gap:10px;}' +

      /* ─── 공통 휴대폰 클래스 (2026-11-16) — 사용법은 CLAUDE.md 「모바일 규칙」 ───
         .num      숫자 폭 고정 · 줄바꿈 없음 (모든 폭). .num.r / .num-r = 오른쪽 정렬
         .m-cards  표(table) → 휴대폰에서 카드 목록. 칸 이름표는 thead 글자로 자동(data-label 이 있으면 그것)
         .m-scroll 넓은 표를 감싸는 상자 → 휴대폰에서 상자 안에서만 가로 스크롤. .m-first = 첫 열 고정
         .m-sheet  창(모달) 상자 → 휴대폰에서 아래에서 올라오는 시트. .m-sheet.m-full = 전체 화면
         .m-stack  가로 배치(flex·grid) → 휴대폰에서 세로로 쌓기 */
      '.num{font-variant-numeric:tabular-nums;white-space:nowrap;}' +
      '.num.r,.num-r{text-align:right;}' +
      'html.sys-m table.m-cards,html.sys-m table.m-cards tbody,html.sys-m table.m-cards tr,html.sys-m table.m-cards td{display:block;width:auto!important;}' +
      'html.sys-m table.m-cards{border:0!important;min-width:0!important;}' +
      'html.sys-m table.m-cards thead{display:none;}' +
      'html.sys-m table.m-cards tr{background:var(--sys-card);border:1px solid var(--sys-line);border-radius:var(--sys-radius);box-shadow:var(--sys-shadow);margin:0 0 10px;padding:6px 14px;}' +
      'html.sys-m table.m-cards td{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:7px 0!important;border:0!important;border-bottom:1px solid #f1f5f9!important;text-align:right!important;font-size:14px;min-height:0!important;height:auto!important;white-space:normal!important;}' +
      'html.sys-m table.m-cards td:last-child{border-bottom:0!important;}' +
      'html.sys-m table.m-cards td[data-label]:before{content:attr(data-label);flex-shrink:0;max-width:45%;text-align:left;color:var(--sys-muted);font-size:13px;font-weight:600;}' +
      'html.sys-m table.m-cards td.m-card-head{display:block;text-align:left!important;font-size:15px;font-weight:700;}' +
      'html.sys-m table.m-cards td.m-card-head:before{display:none;}' +
      'html.sys-m .m-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%;overscroll-behavior-x:contain;}' +
      'html.sys-m .m-scroll.m-first th:first-child,html.sys-m .m-scroll.m-first td:first-child{position:sticky;left:0;z-index:1;background:var(--sys-card);box-shadow:1px 0 0 var(--sys-line);}' +
      'html.sys-m .m-sheet{position:fixed!important;left:0!important;right:0!important;bottom:0!important;top:auto!important;transform:none!important;width:100%!important;max-width:none!important;' +
        'max-height:92dvh;margin:0!important;border-radius:var(--sys-radius-lg) var(--sys-radius-lg) 0 0!important;overflow-y:auto;box-sizing:border-box;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px))!important;}' +
      'html.sys-m .m-sheet.m-full{top:0!important;max-height:none;height:100%;border-radius:0!important;padding-top:env(safe-area-inset-top,0px)!important;}' +
      'html.sys-m .m-stack{flex-direction:column!important;align-items:stretch!important;grid-template-columns:minmax(0,1fr)!important;}' +
      'html.sys-m .m-stack>*{max-width:100%;min-width:0;}' +
      'html.sys-m .m-hide{display:none!important;}' +

      /* ─── 공통 컴포넌트 클래스 (화이트라벨: 색상은 config 변수 연결) ─── */
      /* 버튼: <button class="btn btn-primary"> 형태로 사용 */
      '.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 28px;border-radius:8px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;border:1px solid transparent;transition:opacity .15s,background .15s;text-decoration:none;line-height:1;}' +
      '.btn:disabled{opacity:.5;cursor:default;}' +
      '.btn-sm{padding:6px 14px;font-size:12px;}' +
      '.btn-block{width:100%;}' +
      '.btn-primary{background:var(--theme,#0f172a);color:#fff;}' +
      '.btn-primary:hover:not(:disabled){background:var(--theme2,#1b3a6b);}' +
      '.btn-secondary{background:#f1f5f9;color:#475569;border-color:#e2e8f0;}' +
      '.btn-secondary:hover:not(:disabled){background:#e2e8f0;}' +
      '.btn-danger{background:#fee2e2;color:#dc2626;border-color:#fecaca;}' +
      '.btn-danger:hover:not(:disabled){background:#fecaca;}' +
      '.btn-success{background:#dcfce7;color:#15803d;border-color:#bbf7d0;}' +
      '.btn-success:hover:not(:disabled){background:#bbf7d0;}' +
      /* 배지: <span class="badge badge-success"> */
      '.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:600;line-height:1.4;}' +
      '.badge-pill{border-radius:20px;}' +
      '.badge-success{background:#ecfdf5;color:#065f46;}' +
      '.badge-warn{background:#fef3c7;color:#92400e;}' +
      '.badge-danger{background:#fee2e2;color:#dc2626;}' +
      '.badge-info{background:#eff6ff;color:#1d4ed8;}' +
      '.badge-neutral{background:#f1f5f9;color:#475569;}' +
      /* 카드 */
      '.card{background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:20px 24px;}' +
      '.card-shadow{box-shadow:0 4px 24px rgba(0,0,0,.06);border-color:transparent;}' +
      /* 섹션 타이틀 / 페이지 헤더 */
      '.section-title{font-size:16px;font-weight:800;color:#1e293b;margin-bottom:12px;}' +
      '.page-header{background:var(--theme,#0f172a);color:#fff;padding:20px 24px;border-radius:0;}' +
      '.page-header h1,.page-header .ph-title{font-size:18px;font-weight:800;margin:0;}' +
      '.page-header .ph-sub{font-size:13px;color:#cbd5e1;margin-top:4px;}' +
      /* 빈 상태 */
      '.empty-state{text-align:center;padding:48px 20px;color:#94a3b8;font-size:14px;}' +
      '.empty-state .es-icon{font-size:36px;margin-bottom:12px;opacity:.6;}';
    var target = document.head || document.documentElement;
    target.appendChild(s);
    CSS_INJECTED = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCss);
  } else {
    injectCss();
  }

  // ── SessionManager ─────────────────────────────────────────
  // 1시간 비활동 자동 로그아웃 + 브라우저/컴퓨터 재시작 후 만료 체크
  var SessionManager = (function() {
    var ACTIVE_KEY  = _prefix + '_last_active';
    var LOGIN_KEY   = _prefix + '_login_ts';
    var ORIGIN_KEY  = _prefix + '_browser_origin';
    var TIMEOUT_MS  = 60 * 60 * 1000;  // 1시간
    var WARN_MS     = 55 * 60 * 1000;  // 55분 경과 시 경고
    var THROTTLE_MS = 30 * 1000;

    var _timer      = null;
    var _lastTouch  = 0;
    var _warnShown  = false;
    var _registered = false;
    var _logoutCb   = null;

    function _touch() {
      var now = Date.now();
      if (now - _lastTouch < THROTTLE_MS) return;
      sessionStorage.setItem(ACTIVE_KEY, now.toString());
      _lastTouch = now;
      if (_warnShown) {
        _warnShown = false;
        var t = document.getElementById('kwanbo-timeout-toast');
        if (t) t.remove();
      }
    }

    function _showWarn(min) {
      if (_warnShown) return;
      _warnShown = true;
      var el = document.getElementById('kwanbo-timeout-toast');
      if (el) el.remove();
      el = document.createElement('div');
      el.id = 'kwanbo-timeout-toast';
      el.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:#1e293b;color:#fff;padding:14px 20px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 8px 32px rgba(0,0,0,.4);border-left:4px solid #f59e0b;max-width:300px;line-height:1.6;font-family:\'Pretendard\',\'Noto Sans KR\',sans-serif;cursor:pointer;';
      el.innerHTML = '⏱ <strong>' + min + '분</strong> 후 자동 로그아웃됩니다.<br><span style="font-size:11px;color:#94a3b8">화면을 클릭하면 세션이 연장됩니다.</span>';
      el.addEventListener('click', function() { _touch(); el.remove(); _warnShown = false; });
      document.body.appendChild(el);
    }

    function _startWatching(cb) {
      _logoutCb = cb;
      if (isDesktopApp()) return;   // 데스크탑 앱 안에서는 1시간 비활동 로그아웃 없음(2026-11-02 승우 결정)
      ['click', 'keydown', 'scroll', 'touchstart'].forEach(function(ev) {
        document.addEventListener(ev, _touch, { passive: true, capture: true });
      });
      _timer = setInterval(function() {
        var lastActive = parseInt(sessionStorage.getItem(ACTIVE_KEY) || '0');
        if (lastActive === 0) return;
        var elapsed = Date.now() - lastActive;
        if (elapsed >= TIMEOUT_MS) {
          _stop();
          var el = document.getElementById('kwanbo-timeout-toast');
          if (el) el.remove();
          _logoutCb && _logoutCb('timeout');
        } else if (elapsed >= WARN_MS) {
          _showWarn(Math.ceil((TIMEOUT_MS - elapsed) / 60000));
        }
      }, 60000);
    }

    function _stop() {
      if (_timer) { clearInterval(_timer); _timer = null; }
      _registered = false;
      _warnShown = false;
    }

    function _isExpired() {
      if (isDesktopApp()) return false;   // 데스크탑 앱 — 위 _startWatching 과 같은 결정
      var lastActive = parseInt(sessionStorage.getItem(ACTIVE_KEY) || '0');
      var loginTs    = parseInt(sessionStorage.getItem(LOGIN_KEY)  || '0');
      var base = lastActive > 0 ? lastActive : loginTs;
      if (base === 0) return false;
      return (Date.now() - base) > TIMEOUT_MS;
    }

    return {
      // 화면을 열 때 모든 화면이 부른다(2026-10-22 통일). sbClient 를 주면 만료 때 이 기기의 로그인 토큰도 끝낸다.
      checkOnLoad: function(sbClient) {
        if (!sessionStorage.getItem(SESSION_KEY)) return false;
        // sessionStorage 기반 세션 → 브라우저/탭 닫으면 자동 만료
        // 만료 여부만 체크
        if (_isExpired()) {
          sessionStorage.removeItem(SESSION_KEY);
          sessionStorage.removeItem(ACTIVE_KEY);
          sessionStorage.removeItem(LOGIN_KEY);
          sessionStorage.removeItem(ORIGIN_KEY);
          clearPerms();   // 기능 권한 캐시 · 다른 부서로 보기도 같이 (2026-10-22)
          // 로그인 토큰도 끝낸다 — 남겨 두면 토큰으로 세션을 다시 여는 화면(공정관리 verifySession)에서 만료가 풀린다.
          // scope 'local' = 이 기기만(다른 기기 로그인은 그대로)
          if (sbClient && sbClient.auth && sbClient.auth.signOut) {
            try { var p = sbClient.auth.signOut({ scope: 'local' }); if (p && p.then) p.then(null, function() {}); } catch(e) {}
          }
          return true;  // 만료 → 로그인 필요
        }
        return false;   // 유효 → 세션 유지
      },

      onLogin: function(logoutCb) {
        if (_registered) { _logoutCb = logoutCb; return; }
        _registered = true;
        if (!sessionStorage.getItem(LOGIN_KEY)) {
          sessionStorage.setItem(LOGIN_KEY, Date.now().toString());
        }
        sessionStorage.setItem(ORIGIN_KEY, String(Math.round(performance.timeOrigin)));
        _startWatching(logoutCb);
        _touch();
      },

      onLogout: function() {
        _stop();
        sessionStorage.removeItem(ACTIVE_KEY);
        sessionStorage.removeItem(LOGIN_KEY);
        sessionStorage.removeItem(ORIGIN_KEY);
        var el = document.getElementById('kwanbo-timeout-toast');
        if (el) el.remove();
      }
    };
  })();

  // ── Auth 모듈 ───────────────────────────────────────────────
  var Auth = (function() {

    // ── 브루트포스 방어 ──────────────────────────────────────
    var BF_KEY     = _prefix + '_login_fail';
    var BF_MAX     = 5;
    var BF_LOCK_MS = 5 * 60 * 1000;  // 5분 잠금

    function _bfGet() {
      try { return JSON.parse(localStorage.getItem(BF_KEY) || 'null') || { count: 0, lockedAt: 0 }; }
      catch(e) { return { count: 0, lockedAt: 0 }; }
    }
    function _bfSet(v) { localStorage.setItem(BF_KEY, JSON.stringify(v)); }

    function checkBruteForce() {
      var s = _bfGet();
      if (s.lockedAt) {
        var elapsed = Date.now() - s.lockedAt;
        if (elapsed < BF_LOCK_MS) {
          return { locked: true, remainSec: Math.ceil((BF_LOCK_MS - elapsed) / 1000) };
        }
        _bfSet({ count: 0, lockedAt: 0 });
      }
      return { locked: false };
    }

    function recordFailure() {
      var s = _bfGet();
      s.count = (s.count || 0) + 1;
      if (s.count >= BF_MAX) { s.lockedAt = Date.now(); }
      _bfSet(s);
    }

    function clearFailures() {
      localStorage.removeItem(BF_KEY);
    }

    /**
     * getSession()
     * sessionStorage에서 user 프로필 복원
     */
    function getSession() {
      try {
        var raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        var v = JSON.parse(raw);
        if (v && v.id && v.role) return v;
        return null;
      } catch(e) { return null; }
    }

    /**
     * clearSession()
     */
    function clearSession() {
      clearPerms();   // 기능 권한 캐시 + 다른 부서로 보기
      stopDesktopWatch();
      try { localStorage.removeItem(DESK_SESS_KEY); } catch(e) {}   // 데스크탑 앱 로그인 사본
      _deskBadge(0);   // 데스크탑 앱 트레이 숫자 지움(앱 안에서만, 이미 0이면 안 보냄)
      pwaBadge(0);     // 휴대폰 앱 아이콘 숫자 지움
      _ssSet(DESK_UNLOCK_KEY, null);
      recheckFailClear('lock'); recheckFailClear('payslip');
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem('kwanbo_uid');
      // 레거시 잔재 정리 (구버전 키 / localStorage 흔적)
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem('kwanbo_uid');
      localStorage.removeItem('kwanbo_pm_user');
    }

    /**
     * logout(sbClient)
     * 로그아웃 통합 함수 — 세션 워처 정지 + 세션 삭제 + Supabase Auth signOut
     * 각 페이지에서 onLogout()/clearSession()/signOut() 3줄 반복 대신 이 한 줄 사용
     */
    function logout(sbClient) {
      SessionManager.onLogout();
      clearSession();
      if (sbClient && sbClient.auth && sbClient.auth.signOut) {
        return sbClient.auth.signOut();
      }
      return Promise.resolve();
    }

    /**
     * doLogin(sbClient, loginId, pw, opts)
     * Supabase Auth signInWithPassword 기반 로그인
     *  - email: username(또는 전화번호)@kwanbo.internal
     *  - username이 있으면 username 우선, 없으면 phone으로 fallback
     *  - 성공 시 users 테이블에서 프로필 조회 후 sessionStorage 저장
     *  - opts.blockedRoles / allowedRoles 지원
     */
    async function doLogin(sbClient, loginId, pw, opts) {
      opts = opts || {};
      var blocked = opts.blockedRoles || ['contractor'];

      // 브루트포스 잠금 체크
      var bf = checkBruteForce();
      if (bf.locked) {
        return { ok: false, locked: true, remainSec: bf.remainSec,
          reason: '로그인 시도가 너무 많습니다. ' + Math.ceil(bf.remainSec / 60) + '분 후 다시 시도하세요.' };
      }

      try {
        // 전화번호 형태(숫자·하이픈 등)면 숫자만, 그 외(아이디)는 소문자 그대로 — loginLocalFromInput
        var emailLocal = loginLocalFromInput(loginId);
        var domain = (global.APP_CONFIG && global.APP_CONFIG.AUTH_DOMAIN) ? global.APP_CONFIG.AUTH_DOMAIN : 'kwanbo.internal';
        var email = emailLocal + '@' + domain;

        // Supabase Auth 로그인
        var authRes = await sbClient.auth.signInWithPassword({ email: email, password: String(pw) });

        if (authRes.error) {
          recordFailure();
          var bfAfter = checkBruteForce();
          if (bfAfter.locked) {
            return { ok: false, locked: true, remainSec: bfAfter.remainSec,
              reason: '로그인 시도가 너무 많습니다. ' + Math.ceil(bfAfter.remainSec / 60) + '분 후 다시 시도하세요.' };
          }
          return { ok: false, reason: '아이디 또는 비밀번호가 올바르지 않습니다.' };
        }

        // Auth 성공 → 본인 프로필 조회 (H-1: 민감 컬럼은 본인 조회 함수로만 받는다)
        var profileRes = await loadMyProfile(sbClient,
          'id,name,phone,username,email,position,team_id,role,join_date,total_days,used_days,must_change_pw,must_change_id,leave_date');

        if (profileRes.error || !profileRes.data) {
          await sbClient.auth.signOut();
          return { ok: false, reason: '사용자 정보를 찾을 수 없습니다. 관리자에게 문의하세요.' };
        }

        var user = profileRes.data;

        // 역할 차단/허용 체크
        var roleBlocked    = blocked.indexOf(user.role) !== -1;
        var roleNotAllowed = opts.allowedRoles && opts.allowedRoles.indexOf(user.role) === -1;
        if (roleBlocked || roleNotAllowed) {
          await sbClient.auth.signOut();
          return { ok: false, reason: '이 시스템에 대한 접근 권한이 없습니다.' };
        }

        // 비밀번호는 맞았으므로 실패 카운터는 여기서 지운다.
        clearFailures();

        // H-2: 초기 비밀번호(또는 관리자 초기화) 상태면 강제 변경 전까지 세션을 열지 않는다.
        // sessionStorage 를 쓰지 않으므로 새로고침해도 다시 로그인 화면이다.
        // (Auth JWT 자체는 살아 있다 — change-own-password 호출에 그 토큰이 필요하다.)
        // 아이디 변경 플래그(must_change_id)도 같은 화면에서 처리한다.
        if (user.must_change_pw || user.must_change_id) {
          return { ok: false, mustChangePw: true, user: user,
            reason: '아이디·비밀번호를 변경한 뒤 이용할 수 있습니다.' };
        }

        // 로그인 성공
        clearPerms();   // 이전 계정의 기능 권한 캐시가 남지 않게
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
        sessionStorage.removeItem('kwanbo_uid');
        _deskMarkUnlocked(user.id);   // 데스크탑 앱: 방금 비밀번호로 로그인했으니 잠그지 않음

        return { ok: true, user: user };

      } catch(e) {
        return { ok: false, reason: '서버 오류가 발생했습니다.' };
      }
    }

    /**
     * verifySession(sbClient)
     * sessionStorage 캐시를 서버 JWT 로 검증한다.
     *
     * 왜 필요한가 — 지금까지 각 페이지는 sessionStorage 의 JSON 을 그대로 믿었다.
     * 개발자도구에서 role:'admin' 을 써넣으면 관리자 UI 가 열린다. 실제 DB 접근은
     * RLS 가 막지만, 화면이 열리는 것만으로도 오조작과 혼란을 부른다.
     * 그래서 캐시는 '초기 렌더용'으로만 쓰고, 마운트 직후 이 함수로 서버에 확인한다.
     *
     * 절차
     *   1. sbClient.auth.getSession() 으로 실제 JWT 존재를 확인한다.
     *      (이름이 비슷한 Auth.getSession() 은 sessionStorage 캐시를 읽는 별개 함수다.)
     *   2. JWT 가 없으면 캐시를 비우고 실패를 돌려준다 → 호출부는 로그인 화면으로 보낸다.
     *   3. JWT 가 있으면 users 에서 auth_id = session.user.id 로 프로필을 재조회한다.
     *   4. 프로필이 없거나 조회에 실패하면 캐시를 비우고 signOut 한다.
     *      (auth_id 가 끊긴 계정이 유효한 세션처럼 남는 것을 막는다.)
     *   5. 성공하면 서버 값으로 sessionStorage 를 덮어쓴다.
     *      캐시의 role 은 신뢰하지 않는다 — 언제나 서버 값이 이긴다.
     *
     * .then() 체인으로 작성했고 throw 하지 않는다.
     * 반환: Promise<{ ok, user, changed, reason, error }>
     *   ok=false 의 reason: 'no-client' | 'no-session' | 'profile-missing'
     *                       | 'profile-error' | 'auth-error' | 'network-error'
     *   hold=true (auth-error · network-error): 판정 보류 — 세션을 지우지 않았다. 화면은 로그아웃하지 말 것.
     *     세션은 서버가 명확히 답한 실패(no-session · profile-missing · 오류 코드/401·403·404 가 있는 profile-error)일 때만 지운다.
     *
     * 페이지 공용이다. 다른 페이지도 마운트 직후 같은 방식으로 호출하면 된다.
     */
    // 서버가 명확히 답한 실패인가(2026-10-22).
    // 화면을 떠나는 중 중단된 요청 · 네트워크 오류 · 서버 일시 오류는 코드 없는 오류(status 0 · 5xx)로 돌아온다 —
    // 이것을 실패로 보고 세션을 지우면 멀쩡한 로그인이 풀린다(공정관리 #profile → 내 정보 이동 때 실제로 일어남).
    function _isClearFailure(err, status) {
      if (!err) return false;
      if (err.code) return true;                         // PostgreSQL · PostgREST 오류 코드(42501, PGRST… 등)
      var st = status || err.status || 0;
      return st === 401 || st === 403 || st === 404;
    }

    function verifySession(sbClient) {
      if (!sbClient || !sbClient.auth || !sbClient.auth.getSession) {
        return Promise.resolve({ ok: false, reason: 'no-client' });
      }
      var cached = getSession();   // 검증 전 캐시 (role 비교용)
      // 판정 보류 — 세션을 지우지 않고 돌려준다. 호출하는 화면은 hold 면 로그아웃하지 않는다.
      function hold(reason, err) { return { ok: false, reason: reason, hold: true, error: err || null }; }

      return sbClient.auth.getSession().then(function(res) {
        var session = (res && res.data) ? res.data.session : null;
        if (!session || !session.user) {
          // 토큰 갱신이 네트워크 문제로 실패한 경우도 session 이 비어 온다 → 보류(토큰이 정말 무효면 4xx)
          var ge = res && res.error;
          if (ge && (ge.name === 'AuthRetryableFetchError' || !(ge.status >= 400 && ge.status < 500))) return hold('network-error', ge);
          clearSession();
          return { ok: false, reason: 'no-session' };
        }

        return loadMyProfile(sbClient,
            'id,name,phone,username,email,position,team_id,role,join_date,total_days,used_days,leave_date')
          .then(function(pr) {
            if (pr.error && !_isClearFailure(pr.error, pr.status)) return hold('network-error', pr.error);
            if (pr.error || !pr.data) {
              clearSession();
              if (sbClient.auth.signOut) {
                try { sbClient.auth.signOut(); } catch (e) {}
              }
              return {
                ok: false,
                reason: pr.error ? 'profile-error' : 'profile-missing',
                error: pr.error || null,
              };
            }

            var fresh = pr.data;
            var changed = !cached || cached.id !== fresh.id || cached.role !== fresh.role;

            // 캐시 role 은 믿지 않는다. 항상 서버 값으로 덮어쓴다.
            try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(fresh)); } catch (e) {}

            if (cached && cached.role !== fresh.role) {
              logError({ cachedRole: cached.role, serverRole: fresh.role },
                       '세션 role 불일치 — 서버 값으로 교정');
            }
            return { ok: true, user: fresh, changed: changed };
          }, function(e) { return hold('network-error', e); });
      }, function(e) {
        return hold('auth-error', e);
      });
    }

    /**
     * changeOwnPassword(sbClient, currentPw, newPw)
     * 본인 비밀번호 변경. change-own-password Edge Function 이
     * Auth 비밀번호 변경과 must_change_pw 해제를 한 경로에서 처리한다.
     * 클라이언트가 둘 중 하나만 하는 상태를 만들 수 없게 하려는 것이다(H-2).
     *
     * 성공 시 세션(sessionStorage)까지 열어 준다 — 강제 변경 직후 바로 진입하기 위함.
     */
    // newLoginId: 새 로그인 아이디(선택). 주면 인증 계정 이메일과 users.username 을 함께 바꾼다.
    function changeOwnPassword(sbClient, currentPw, newPw, user, newLoginId) {
      var body = { current_pw: currentPw };
      if (newPw) body.new_pw = newPw;
      if (newLoginId) body.new_login_id = newLoginId;
      return invokeAuthed(sbClient, 'change-own-password', body
      ).then(function(res) {
        var data = res && res.data;
        var msg  = (data && data.error) || (res && res.error && res.error.message) || '';
        if (msg || !(data && data.ok)) {
          return { ok: false, reason: msg || '비밀번호를 변경하지 못했습니다.' };
        }
        if (user) {
          var fresh = {};
          for (var k in user) { if (Object.prototype.hasOwnProperty.call(user, k)) fresh[k] = user[k]; }
          if (newPw) fresh.must_change_pw = false;
          if (newLoginId) { fresh.must_change_id = false; fresh.username = data.login_id || newLoginId; }
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
          sessionStorage.removeItem('kwanbo_uid');
          _deskMarkUnlocked(fresh.id);   // 데스크탑 앱: 첫 로그인 강제 변경 직후 잠그지 않음
          return { ok: true, user: fresh, loginId: data.login_id || null, flagCleared: !!data.flag_cleared };
        }
        return { ok: true, loginId: data.login_id || null, flagCleared: !!data.flag_cleared };
      }, function(e) {
        return { ok: false, reason: '네트워크 오류: ' + ((e && e.message) || e) };
      });
    }

    return {
      doLogin:           doLogin,
      changeOwnPassword: changeOwnPassword,
      getSession:        getSession,
      verifySession:     verifySession,
      clearSession:      clearSession,
      logout:            logout,
      checkBruteForce:   checkBruteForce,
      recordFailure:     recordFailure,
      clearFailures:     clearFailures,
      recheckPassword:   recheckPassword,
      recheckFails:      recheckFails,
      recheckFailAdd:    recheckFailAdd,
      recheckFailClear:  recheckFailClear,
      RECHECK_MAX_FAILS: RECHECK_MAX_FAILS,
    };
  })();

  // ── 로그인 CSS 주입 ─────────────────────────────────────────
  var LOGIN_CSS_INJECTED = false;
  function injectLoginCss() {
    if (LOGIN_CSS_INJECTED || document.getElementById('sysbar-login-css')) { LOGIN_CSS_INJECTED = true; return; }
    var s = document.createElement('style');
    s.id = 'sysbar-login-css';
    s.textContent =
      '.sb-lwrap{min-height:100vh;background:linear-gradient(135deg,var(--theme,#0f172a) 0%,#1e3a5f 50%,#1e40af 100%);display:flex;align-items:center;justify-content:center;padding:16px;font-family:\'Pretendard\',\'Noto Sans KR\',sans-serif;}' +
      '.sb-lbox{background:#fff;border-radius:16px;padding:32px 28px;width:100%;max-width:340px;box-shadow:0 24px 70px rgba(0,0,0,.45);}' +
      '.sb-lco{font-size:15px;font-weight:800;color:#0f172a;text-align:center;margin-bottom:2px;}' +
      '.sb-lsub{font-size:11px;color:#94a3b8;text-align:center;margin-bottom:22px;}' +
      '.sb-lfl{display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;}' +
      '.sb-lfi{width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit;color:#0f172a;transition:border .15s;}' +
      '.sb-lfi:focus{border-color:#3b82f6;}' +
      '.sb-lerr{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;padding:7px 11px;font-size:12px;margin-bottom:12px;}' +
      '.sb-lbtn{width:100%;padding:11px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:6px;}' +
      '.sb-lbtn:disabled{opacity:.6;cursor:default;}' +
      '@media(max-width:400px){.sb-lbox{padding:28px 20px;}}';
    var target = document.head || document.documentElement;
    target.appendChild(s);
    LOGIN_CSS_INJECTED = true;
  }

  /**
   * createLoginComponent(React, options)
   *  options.subtitle      : 로그인 박스 부제목
   *  options.blockedRoles  : 차단할 role 목록
   *  options.allowedRoles  : 허용할 role 목록
   *
   * props.supabaseClient : Supabase 클라이언트 (필수)
   * props.onLogin(user)  : 로그인 성공 콜백 (필수)
   */
  function createLoginComponent(React, options) {
    if (!React) { console.error('[sysbar] React가 없습니다.'); return null; }
    injectLoginCss();
    options = options || {};

    return function SysbarLoginScreen(props) {
      var sb       = props.supabaseClient;
      var onLogin  = props.onLogin;
      var subtitle = props.subtitle || options.subtitle || '통합 관리 시스템';
      var cfg      = global.APP_CONFIG || {};

      var useState  = React.useState;
      var useEffect = React.useEffect;
      var _phone   = useState('');
      var phone    = _phone[0]; var setPhone = _phone[1];
      var _pw      = useState('');
      var pw       = _pw[0];    var setPw    = _pw[1];
      var _err     = useState('');
      var err      = _err[0];   var setErr   = _err[1];
      var _loading = useState(false);
      var loading  = _loading[0]; var setLoading = _loading[1];
      var _locked  = useState(false);
      var locked   = _locked[0]; var setLocked = _locked[1];
      var _remain  = useState(0);
      var remain   = _remain[0]; var setRemain = _remain[1];
      // H-2 강제 비밀번호 변경 단계. mustChange 에 프로필이 들어오면 변경 화면으로 전환된다.
      var _mc      = useState(null);
      var mustChange = _mc[0]; var setMustChange = _mc[1];
      var _np      = useState('');
      var npw      = _np[0];  var setNpw  = _np[1];
      var _np2     = useState('');
      var npw2     = _np2[0]; var setNpw2 = _np2[1];
      var _nid     = useState('');
      var nid      = _nid[0]; var setNid  = _nid[1];

      var e = React.createElement;

      useEffect(function() {
        var bf = Auth.checkBruteForce();
        if (bf.locked) { setLocked(true); setRemain(bf.remainSec); }
        var timer = setInterval(function() {
          var bf2 = Auth.checkBruteForce();
          if (bf2.locked) { setLocked(true); setRemain(bf2.remainSec); }
          else { setLocked(false); setRemain(0); }
        }, 1000);
        return function() { clearInterval(timer); };
      }, []);

      var login = function() {
        if (locked) return;
        if (!phone.trim() || !pw) { setErr('아이디와 비밀번호를 입력하세요.'); return; }
        setLoading(true); setErr('');
        Auth.doLogin(sb, phone, pw, {
          blockedRoles: options.blockedRoles,
          allowedRoles: options.allowedRoles,
        }).then(function(result) {
          setLoading(false);
          if (result.ok) { onLogin(result.user); }
          else if (result.mustChangePw) {
            // 비밀번호는 맞았지만 강제 변경 대상이다. 세션은 아직 열리지 않았다.
            setMustChange(result.user); setErr('');
          }
          else {
            if (result.locked) { setLocked(true); setRemain(result.remainSec); }
            setErr(result.reason);
          }
        });
      };

      var onKey = function(ev) { if (ev.key === 'Enter') login(); };

      // 강제 변경 제출. 현재 비밀번호는 방금 입력한 pw 를 그대로 쓴다.
      // 아이디(must_change_id)·비밀번호(must_change_pw) 중 켜진 것만 입력받아 한 번에 보낸다.
      var needId = !!(mustChange && mustChange.must_change_id);
      var needPw = !!(mustChange && mustChange.must_change_pw);
      var idMsg  = needId && nid ? checkLoginId(nid, { phone: mustChange.phone }) : '';
      var submitChange = function() {
        var newId = needId ? nid.trim().toLowerCase() : '';
        if (needId) {
          if (!newId) { setErr('새 아이디를 입력하세요.'); return; }
          var m = checkLoginId(newId, { phone: mustChange.phone });
          if (m) { setErr(m); return; }
        }
        if (needPw) {
          if (!npw || !npw2) { setErr('새 비밀번호를 입력하세요.'); return; }
          if (npw !== npw2)  { setErr('새 비밀번호가 일치하지 않습니다.'); return; }
          var pwMin = authPolicy().pwMin;
          if (npw.length < pwMin) { setErr('새 비밀번호는 ' + pwMin + '자 이상이어야 합니다.'); return; }
          if (newId && npw.toLowerCase() === newId) { setErr('아이디를 비밀번호로 사용할 수 없습니다.'); return; }
        }
        setLoading(true); setErr('');
        Auth.changeOwnPassword(sb, pw, needPw ? npw : '', mustChange, newId).then(function(r) {
          setLoading(false);
          if (!r.ok) { setErr(r.reason); return; }
          if (r.loginId) {
            try { global.alert('아이디가 "' + r.loginId + '"(으)로 바뀌었습니다.\n다음부터는 새 아이디로 로그인하세요.'); } catch (x) {}
          }
          onLogin(r.user);
        });
      };
      var onChgKey = function(ev) { if (ev.key === 'Enter') submitChange(); };

      if (mustChange) {
        return e('div', { className: 'sb-lwrap' },
          e('div', { className: 'sb-lbox' },
            e('div', { className: 'sb-lco'  }, cfg.COMPANY_SHORT || cfg.COMPANY_KO || ''),
            e('div', { className: 'sb-lsub' },
              needId && needPw ? '아이디·비밀번호 변경이 필요합니다' : (needId ? '아이디 변경이 필요합니다' : '비밀번호 변경이 필요합니다')),
            e('div', { style: { background:'#fffbeb', border:'1px solid #fde68a', color:'#92400e',
                                borderRadius:6, padding:'10px 12px', fontSize:13, lineHeight:1.5,
                                marginBottom:14 } },
              '보안 강화를 위해 ' + (needId && needPw ? '새 아이디와 새 비밀번호를' : (needId ? '새 아이디를' : '새 비밀번호를'))
                + ' 정하면 이용할 수 있습니다.'),
            err ? e('div', { className: 'sb-lerr' }, err) : null,
            needId ? e('div', { style: { marginBottom: 12 } },
              e('label', { className: 'sb-lfl' }, '새 아이디'),
              e('input', { className:'sb-lfi', type:'text', placeholder:'새 아이디', value:nid, autoComplete:'username',
                autoCapitalize:'none', spellCheck:false,
                onChange: function(ev){ setNid(ev.target.value.toLowerCase()); }, onKeyDown: onChgKey }),
              e('div', { style: { fontSize:11, marginTop:4, lineHeight:1.5, color: idMsg ? '#dc2626' : '#64748b' } },
                idMsg || loginIdRuleText())
            ) : null,
            needPw ? e('div', { style: { marginBottom: 12 } },
              e('label', { className: 'sb-lfl' }, '새 비밀번호 (' + authPolicy().pwMin + '자 이상)'),
              e('input', { className:'sb-lfi', type:'password', placeholder:'새 비밀번호', value:npw, autoComplete:'new-password',
                onChange: function(ev){ setNpw(ev.target.value); }, onKeyDown: onChgKey })
            ) : null,
            needPw ? e('div', { style: { marginBottom: 18 } },
              e('label', { className: 'sb-lfl' }, '새 비밀번호 확인'),
              e('input', { className:'sb-lfi', type:'password', placeholder:'새 비밀번호 확인', value:npw2, autoComplete:'new-password',
                onChange: function(ev){ setNpw2(ev.target.value); }, onKeyDown: onChgKey })
            ) : null,
            e('button', { className:'sb-lbtn', onClick:submitChange, disabled: loading },
              loading ? '변경 중...' : '변경하고 시작하기'
            )
          )
        );
      }

      return e('div', { className: 'sb-lwrap' },
        e('div', { className: 'sb-lbox' },
          e('div', { className: 'sb-lco'  }, cfg.COMPANY_SHORT || cfg.COMPANY_KO || ''),
          e('div', { className: 'sb-lsub' }, subtitle),
          err ? e('div', { className: 'sb-lerr' }, err) : null,
          e('div', { style: { marginBottom: 12 } },
            e('label', { className: 'sb-lfl' }, '로그인 아이디'),
            e('input', { className:'sb-lfi', type:'text', placeholder:'아이디 (처음이면 휴대폰 번호)', value:phone,
              autoCapitalize:'none', spellCheck:false,
              onChange: function(ev){ setPhone(ev.target.value); }, onKeyDown: onKey, disabled: locked })
          ),
          e('div', { style: { marginBottom: 18 } },
            e('label', { className: 'sb-lfl' }, '비밀번호'),
            e('input', { className:'sb-lfi', type:'password', placeholder:'비밀번호', value:pw,
              onChange: function(ev){ setPw(ev.target.value); }, onKeyDown: onKey, disabled: locked })
          ),
          e('button', { className:'sb-lbtn', onClick:login, disabled: loading || locked },
            locked ? ('잠금 ' + Math.ceil(remain / 60) + '분') : (loading ? '로그인 중...' : '로그인')
          )
        )
      );
    };
  }

  function createComponent(React) {
    if (!React) { console.error('[sysbar] React가 없습니다.'); return null; }
    injectCss();

    // ── 휴대폰 서랍 메뉴 공용 (로그인·비회원 둘 다) ──
    //   서랍 = PC 왼쪽 메뉴(.sys-side) 그 자체. 열림 상태는 모듈의 _drawer 한 곳(뒤로가기·Esc·바깥 누르기·메뉴 선택으로 닫힘)
    function useDrawer() {
      var st = React.useState(_drawer.open);
      React.useEffect(function() {
        _drawer.set = st[1];
        return function() { if (_drawer.set === st[1]) _drawer.set = null; if (_drawer.open) _drawerSetOpen(false); };
      }, []);
      var open = st[0];
      React.useEffect(function() {   // 열면 닫기 단추로, 닫으면 ☰ 단추로 포커스
        if (!isMobile()) return;
        try {
          var el = document.querySelector(open ? '.sys-side .sys-m-x' : '.sys-bar .sys-m-menu');
          if (el && (open || document.activeElement && document.activeElement.closest && document.activeElement.closest('.sys-side'))) el.focus();
        } catch(err) {}
      }, [open]);
      return open;
    }
    function mobileTopBar(o) {
      var e = React.createElement;
      return e('div', {key:'top', className:'sys-bar' + (o.noPrint ? ' no-print' : '')},
        e('button', {key:'m', type:'button', className:'sys-m-menu', 'aria-label': o.badge ? '메뉴 열기 (결재 대기 ' + o.badge + '건)' : '메뉴 열기',
          'aria-expanded': o.open ? 'true' : 'false', 'aria-controls':'sys-side', onClick:function() { drawerOpen(); }},
          sideIcon(React, 'menu', 24),
          o.badge ? e('span', {key:'d', className:'sys-m-dot', 'aria-hidden':'true'}, o.badge > 99 ? '99+' : o.badge) : null),
        e('div', {key:'t', className:'sys-m-title'},
          e('b', {key:'b'}, o.title || ''),
          o.sub ? e('span', {key:'s'}, o.sub) : null)
      );
    }
    function drawerBg() {
      return React.createElement('div', {key:'bg', className:'sys-drawer-bg no-print', 'aria-hidden':'true', onClick:function() { drawerClose(); }});
    }
    function drawerX() {
      return React.createElement('button', {key:'x', type:'button', className:'sys-m-x', 'aria-label':'메뉴 닫기',
        onClick:function(ev) { ev.preventDefault(); drawerClose(); }}, sideIcon(React, 'x', 22));
    }
    // 서랍 안 링크: 휴대폰에서 서랍이 열려 있으면 서랍 칸을 새 화면으로 바꿔 끼운다(뒤로 = 서랍 열기 전 화면)
    function onSideClick(ev) {
      if (!_drawer.open) return;
      var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if (!a || a.target === '_blank' || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.defaultPrevented) return;
      ev.preventDefault();
      drawerGo(a.getAttribute('href'));
    }
    // 같은 화면 안에서 할 일(탭 전환·안내 창·로그아웃)은 서랍을 닫은 뒤에
    function afterClose(fn) { return function(ev) { if (_drawer.open) drawerClose(function() { fn(ev); }); else fn(ev); }; }

    // ── 비회원 모드 (guest.html) — 서버 호출 없음(sb 를 받지 않는다). 메뉴를 눌러도 이동하지 않고 onGuestBlocked(key, title) ──
    //   props: activeKey / activeSub = 마지막으로 누른 메뉴 강조(표시만), onGuestBlocked(key, title), onHome() = 회사명을 눌렀을 때
    //   key = 상위 메뉴 key 또는 '상위/하위', title = '연차관리 › 휴가 계획'
    function GuestSysBar(props) {
      var cfg = global.APP_CONFIG || {};
      var e = React.createElement;
      var activeKey = props.activeKey || null, activeSub = props.activeSub || null;
      var blocked = props.onGuestBlocked || function(){};
      var onHome = props.onHome || function(){};
      var loginUrl = (cfg.INDEX_URL || 'index.html') + '#erp';   // index.html 이 #erp 로 열리면 로그인 창을 연다
      var menus = guestMenus();

      var offState = React.useState(guestOffGet());
      var sideOff = offState[0], setSideOff = offState[1];
      React.useEffect(function() {
        document.body.classList.add('sys-has-side');
        return function() { document.body.classList.remove('sys-has-side'); document.body.classList.remove('sys-side-off'); };
      }, []);
      React.useEffect(function() { document.body.classList.toggle('sys-side-off', !!sideOff); }, [sideOff]);
      React.useEffect(function() {
        function onKey(ev) {
          if (ev.key !== '[' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
          var t = ev.target, tg = t && t.tagName;
          if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT' || (t && t.isContentEditable)) return;
          ev.preventDefault();
          setSideOff(function(v) { var nv = !v; guestOffSet(nv); return nv; });
        }
        document.addEventListener('keydown', onKey);
        return function() { document.removeEventListener('keydown', onKey); };
      }, []);
      function toggleSide() { var nv = !sideOff; guestOffSet(nv); setSideOff(nv); }

      // 상위 메뉴 펼침 — 실제와 같은 토글(여러 개 동시에, 이 PC 에 기억). 비회원 전용 키
      var openState = React.useState(guestOpenGet);
      var openKeys = openState[0], setOpenKeys = openState[1];
      function toggleOpen(key) {
        setOpenKeys(function(prev) {
          var nx = prev.indexOf(key) >= 0 ? prev.filter(function(k) { return k !== key; }) : prev.concat([key]);
          guestOpenSet(nx);
          return nx;
        });
      }
      // 하위 목록: 내 정보관리 = 고정 subs, 화면 탭 = SECTION_TABS 합집합, 없으면(메인메뉴) null
      function subsOf(m) {
        if (m.subs) return m.subs.map(function(s) { return { key: s.key, label: s.label, svg: s.svg }; });
        return SECTION_TABS[m.key] ? guestSectionTabs(m.key) : null;
      }

      // 휴대폰 상단 막대: ☰ + 제목(마지막으로 누른 메뉴, 없으면 회사 이름). 메뉴는 서랍(.sys-side)
      var drawerOpenNow = useDrawer();
      var gMenu = menus.filter(function(m) { return m.key === activeKey; })[0];
      var gSub = '';
      if (gMenu && activeSub) {
        var gs = (subsOf(gMenu) || []).filter(function(x) { return x.key === activeSub; })[0];
        gSub = gs ? gs.label : '';
      }
      var topBar = mobileTopBar({ noPrint:true, open:drawerOpenNow,
        title: gMenu ? gMenu.label : (cfg.COMPANY_SHORT || cfg.COMPANY_KO || ''), sub: gMenu ? gSub : '비회원 둘러보기' });

      var sideItems = [];
      menus.forEach(function(m) {
        var subs = subsOf(m);
        var inner = [sideIcon(React, m.svg), e('span', {key:'l'}, m.label)];
        if (!subs) {
          sideItems.push(e('button', {key:m.key, type:'button', className:'sys-side-b' + (m.key === activeKey ? ' on' : ''), style:{cursor:'pointer'},
            onClick:afterClose(function() { blocked(m.key, m.label); })}, inner));
          return;
        }
        var open = openKeys.indexOf(m.key) >= 0;
        var subId = 'sys-side-sub-' + m.key;
        inner.push(e('span', {key:'c', className:'sys-side-chev', 'aria-hidden':'true'}, sideIcon(React, 'chevR', 14)));
        sideItems.push(e('button', {key:m.key, type:'button', 'aria-expanded': open ? 'true' : 'false', 'aria-controls':subId,
          className:'sys-side-b' + (m.key === activeKey ? ' on-parent' : ''),
          onClick:function() { toggleOpen(m.key); }}, inner));
        if (!open) return;
        sideItems.push(e('div', {key:m.key + '-sub', id:subId, className:'sys-side-sub'},
          subs.map(function(s) {
            var on = m.key === activeKey && s.key === activeSub;
            return e('button', {key:s.key, type:'button', className:'sys-side-b' + (on ? ' on' : ''),
              onClick:afterClose(function() { blocked(m.key + '/' + s.key, m.label + ' › ' + s.label); })},
              (s.svg && SIDE_ICONS[s.svg]) ? sideIcon(React, s.svg, 16) : e('span', {key:'i', className:'sys-side-dot', 'aria-hidden':'true'}),
              e('span', {key:'l'}, s.label));
          })
        ));
      });

      var side = e('aside', {key:'side', id:'sys-side', className:'sys-side no-print', 'aria-label':'메뉴', onClick:onSideClick},
        drawerX(),
        e('button', {key:'brand', type:'button', className:'sys-side-brand', onClick:afterClose(onHome),
          style:{background:'none',border:'none',borderBottom:'1px solid rgba(255,255,255,.07)',width:'100%',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}},
          cfg.LOGO_URL ? e('img', {key:'i', src:cfg.LOGO_URL, alt:''}) : null,
          e('span', {key:'t', className:'sys-side-tt'},
            e('b', {key:'n'}, cfg.COMPANY_SHORT || cfg.COMPANY_KO || ''),
            e('span', {key:'v', className:'sys-side-ver'}, 'v' + APP_VERSION)
          )
        ),
        e('nav', {key:'nav', className:'sys-side-nav'}, sideItems),
        e('div', {key:'foot', className:'sys-side-foot'},
          e('div', {key:'who', className:'sys-side-who'}, e('b', null, '비회원'), e('span', null, '둘러보기')),
          e('div', {key:'btns', className:'sys-side-btns'},
            e('a', {key:'hp', href:cfg.INDEX_URL||'index.html', className:'sys-side-btn', title:'홈페이지'}, sideIcon(React, 'globe', 14), '홈페이지'),
            e('a', {key:'li', href:loginUrl, className:'sys-side-btn'}, sideIcon(React, 'user', 14), '로그인')
          )
        )
      );

      var tog = e('button', {
        key:'tog', type:'button', className:'sys-side-tog no-print', onClick:toggleSide,
        title: sideOff ? '메뉴 펴기 ( [ 키 )' : '메뉴 접기 ( [ 키 )',
        'aria-label': sideOff ? '메뉴 펴기' : '메뉴 접기'
      }, sideIcon(React, sideOff ? 'chevR' : 'chevL', 14));

      return e(React.Fragment, null, topBar, drawerBg(), side, tog);
    }

    return function SysBar(props) {
      // 비회원 모드는 별도 컴포넌트(훅 순서가 다르다). guest 값은 화면이 열려 있는 동안 바뀌지 않는다
      if (props.guest) return React.createElement(GuestSysBar, props);
      var cfg        = global.APP_CONFIG || {};
      var user       = props.user;
      var activeKey  = props.activeKey;
      var teamName   = props.teamName        || '';
      var onLogout   = props.onLogout        || function(){};
      var onDisabled = props.onDisabledClick || function(){};
      var noPrint    = props.noPrint         || false;
      var contractor = !!(user && user.role === 'contractor');
      var sbClient   = props.sb || null;          // 기능 권한·부서 목록 조회용(없으면 이 창에 저장된 권한만 씀)
      // 화면 안 탭 — 목록은 SECTION_TABS(sectionTabs)에서 계산한다. 화면은 지금 탭 · 탭 전환 · 배지만 넘긴다
      var activeSub   = props.activeSub;
      var onSubChange = props.onSubChange || null;
      var subBadges   = props.subBadges || {};    // {탭키: 숫자} — 데이터가 있는 그 화면에서만(다른 화면 메뉴에는 배지 없음)
      var e = React.createElement;

      // ── 기능 권한: 화면을 열 때마다 서버 값으로 다시 읽는다 ──
      //   permsLoaded 전에는 다른 화면의 하위 목록을 그리지 않는다(이전 캐시로 잘못된 목록이 잠깐 보이지 않게)
      var permTick = React.useState(0);
      var setPermTick = permTick[1];
      var loadedState = React.useState(!sbClient);   // sb 가 없으면 다시 읽을 수 없으니 이 창 권한 그대로
      var permsLoaded = loadedState[0], setPermsLoaded = loadedState[1];
      React.useEffect(function() {
        if (!user || !sbClient) return;
        var alive = true;
        loadPerms(sbClient).then(function() { if (alive) { setPermsLoaded(true); setPermTick(function(x) { return x + 1; }); } });
        return function() { alive = false; };
      }, [user ? user.id : null]);
      var canAdmin   = !!user && canPortal();    // 관리포털 메뉴 = 관리포털 권한이 하나라도 있으면

      // ── 연차 결재 대기 건수(모든 화면): 1분 캐시, 바뀌면 다시 그림 ──
      var apprTick = React.useState(0);
      React.useEffect(function() {
        if (!user || !sbClient) return;
        function onAppr() { apprTick[1](function(x) { return x + 1; }); }
        global.addEventListener('sys-approvals', onAppr);
        loadApprovals(sbClient);
        startDesktopWatch(sbClient);   // 데스크탑 앱 안에서만(일반 브라우저는 아무것도 안 함)
        pwaOnUser(sbClient, user);     // 휴대폰 앱: 알림 구독 확인 · 설치 안내 띠(직원 · 휴대폰만)
        return function() { global.removeEventListener('sys-approvals', onAppr); };
      }, [user ? user.id : null]);
      var appr = user ? approvalCounts() : null;
      var apprBadges = approvalBadges();
      function menuBadge(key) { return (key === 'leave' && appr && appr.total > 0) ? appr.total : 0; }

      // ── 다른 부서로 보기 (실제 관리자만) ──
      var isRealAdmin = !!(user && user.role === 'admin');
      var viewAs = getViewAs();
      var teamsState = React.useState([]);
      var teams = teamsState[0], setTeams = teamsState[1];
      React.useEffect(function() {
        if (!isRealAdmin || !sbClient) return;
        sbClient.from('teams').select('id,name').order('name').then(function(r) { if (!r.error && r.data) setTeams(r.data); });
      }, [isRealAdmin]);
      function onViewChange(ev) {
        var id = ev.target.value;
        var t = teams.filter(function(x) { return x.id === id; })[0] || null;
        setViewAs(sbClient, t).then(function(ok) { if (ok) location.reload(); });
      }
      React.useEffect(function() { renderViewBand(); });

      // ── 휴대폰 탭 줄(관리포털 · 화면 탭): 선택된 탭이 보이도록 가로 스크롤 ──
      React.useEffect(function() {
        var t = setTimeout(function() {
          try {
            var a = document.querySelector('.sys-portal-tabs .nav-btn.active, .sys-page-tabs .sys-tab-on');
            var box = a && a.parentNode;
            if (!box || box.scrollWidth <= box.clientWidth) return;
            box.scrollLeft = Math.max(0, a.offsetLeft - (box.clientWidth - a.offsetWidth) / 2);
          } catch(err) {}
        }, 0);
        return function() { clearTimeout(t); };
      }, [permTick[0], activeSub]);

      // ── PC 왼쪽 메뉴: 접힘 상태 + body 클래스 + [ 단축키 ──
      var offState = React.useState(sideOffGet());
      var sideOff = offState[0], setSideOff = offState[1];
      React.useEffect(function() {
        document.body.classList.add('sys-has-side');
        return function() { document.body.classList.remove('sys-has-side'); document.body.classList.remove('sys-side-off'); };
      }, []);
      React.useEffect(function() {
        document.body.classList.toggle('sys-side-off', !!sideOff);
        // 본문 폭이 바뀌므로 표 · 차트가 다시 계산되도록 알림
        var t = setTimeout(function() { try { global.dispatchEvent(new Event('resize')); } catch(err) {} }, 220);
        return function() { clearTimeout(t); };
      }, [sideOff]);
      React.useEffect(function() {
        function onKey(ev) {
          if (ev.key !== '[' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
          var t = ev.target, tg = t && t.tagName;
          if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT' || (t && t.isContentEditable)) return;
          ev.preventDefault();
          setSideOff(function(v) { var nv = !v; sideOffSet(nv); return nv; });
        }
        document.addEventListener('keydown', onKey);
        return function() { document.removeEventListener('keydown', onKey); };
      }, []);
      function toggleSide() { var nv = !sideOff; sideOffSet(nv); setSideOff(nv); }

      // ── 상위 메뉴 펼침(하위 있음): 누르면 그 자리에서 펼치기/접기(이동 없음). 여러 개 동시에 열 수 있고 PC별 기억 ──
      var openState = React.useState(sideOpenGet);
      var openKeys = openState[0], setOpenKeys = openState[1];
      function toggleOpen(key) {
        setOpenKeys(function(prev) {
          var nx = prev.indexOf(key) >= 0 ? prev.filter(function(k) { return k !== key; }) : prev.concat([key]);
          sideOpenSet(nx);
          return nx;
        });
      }
      // 지금 화면의 상위 메뉴: 화면을 열 때(새로고침·다른 화면에서 이동) 항상 펼친 채 시작하고, 누르면 접기/펼치기.
      //   접은 상태는 저장하지 않는다 — SysBar 가 그대로 있는 같은 화면 안 탭 전환·뒤로가기에서는 접은 채 유지(2026-10-23)
      var curClosedState = React.useState(null);   // 접은 지금 화면 메뉴 키(activeKey) 또는 null
      var curClosed = curClosedState[0] === activeKey;
      function toggleCur() { curClosedState[1](function(v) { return v === activeKey ? null : activeKey; }); }

      // ── 휴대폰 상단 막대: ☰(서랍 = 아래 왼쪽 메뉴 그대로) + 화면 제목(메뉴 › 하위). 버전1 상단 막대(메뉴 단추 줄)는 2026-11-16 삭제 ──
      var curFile = (function() { try { return (location.pathname.split('/').pop() || '').toLowerCase(); } catch(err) { return ''; } })();
      var drawerOpenNow = useDrawer();
      var curMenu = SYS_MENUS.filter(function(m) { return m.key === activeKey; })[0] || null;
      var mSub = '';
      if (props.mobileSub !== undefined) mSub = props.mobileSub || '';
      else if (activeKey === 'admin') {
        var cp = PORTAL_PAGES.filter(function(pg) { return pg.href.toLowerCase() === curFile; })[0];
        mSub = cp ? cp.label : '';
      } else if (curMenu && curMenu.subs) {
        var cs = curMenu.subs.filter(function(x) { return x.key === activeSub; })[0];
        mSub = cs ? cs.label : '';
      } else if (curMenu && SECTION_TABS[activeKey] && user) {
        var ct = sectionTabs(activeKey, user).filter(function(x) { return x.key === activeSub; })[0];
        mSub = ct ? ct.label : '';
      }
      var topBar = mobileTopBar({ noPrint:noPrint, open:drawerOpenNow, badge: appr && appr.total > 0 ? appr.total : 0,
        title: props.mobileTitle || (curMenu ? curMenu.label : (cfg.COMPANY_SHORT || cfg.COMPANY_KO || '')), sub: mSub });

      // ── PC 왼쪽 메뉴 (휴대폰에서는 같은 것이 서랍) ──

      // 하위 항목 하나. href 가 있으면 다른 화면으로(링크 — 화면 탭이면 page.html#탭키), 없으면 같은 화면 안 탭 전환(onSubChange)
      //   guard = 고정 링크(내 정보관리 하위)만 협력업체 판정. 화면 탭은 sectionTabs 가 이미 직급별로 거른 것
      function subItem(s, on, guard) {
        var inner = [
          (s.svg && SIDE_ICONS[s.svg]) ? sideIcon(React, s.svg, 16) : e('span', {key:'i', className:'sys-side-dot', 'aria-hidden':'true'}),
          e('span', {key:'l'}, s.label)
        ];
        if (s.badge > 0) inner.push(e('span', {key:'b', className:'sys-side-badge'}, s.badge));
        if (guard && contractor && !contractorOk(s.key))
          return e('div', {key:s.key, className:'sys-side-b disabled', onClick:afterClose(onDisabled)}, inner);
        if (s.href) {
          return on ? e('div', {key:s.key, className:'sys-side-b on', 'aria-current':'page'}, inner)
                    : e('a', {key:s.key, href:s.href, className:'sys-side-b'}, inner);
        }
        // 선택된 탭도 누를 수 있다(공정관리 상세보기 → 목록 등)
        return e('button', {key:s.key, type:'button', className:'sys-side-b' + (on ? ' on' : ''), 'aria-current': on ? 'page' : undefined,
          onClick:afterClose(function() { if (onSubChange) onSubChange(s.key); })}, inner);
      }

      // 상위 메뉴: 하위가 없으면(메인메뉴) 바로 이동, 하위가 있으면 누를 때 펼치기/접기만(지금 화면의 메뉴는 항상 펼침)
      var sideItems = [];
      SYS_MENUS.forEach(function(m) {
        if (m.adminOnly && !canAdmin) return;
        var isCur = m.key === activeKey;
        var kind = m.key === 'admin' ? 'admin' : m.subs ? 'fixed' : SECTION_TABS[m.key] ? 'section' : null;
        var inner = [sideIcon(React, m.svg), e('span', {key:'l'}, m.label)];
        if (contractor && !contractorOk(m.key)) {   // 막힌 메뉴는 펼치지 않고 안내
          sideItems.push(e('div', {key:m.key, className:'sys-side-b disabled', onClick:afterClose(onDisabled)}, inner));
          return;
        }
        if (!kind) {
          sideItems.push(isCur ? e('div', {key:m.key, className:'sys-side-b on', 'aria-current':'page'}, inner)
                               : e('a', {key:m.key, href:m.url, className:'sys-side-b'}, inner));
          return;
        }
        var open = isCur ? !curClosed : openKeys.indexOf(m.key) >= 0;
        var subId = 'sys-side-sub-' + m.key;
        var mbadge = menuBadge(m.key);
        if (mbadge) inner.push(e('span', {key:'b', className:'sys-side-badge', title:'결재 대기'}, mbadge));
        inner.push(e('span', {key:'c', className:'sys-side-chev', 'aria-hidden':'true'}, sideIcon(React, 'chevR', 14)));
        sideItems.push(e('button', {key:m.key, type:'button', 'aria-expanded': open ? 'true' : 'false', 'aria-controls':subId,
          'aria-current': isCur ? 'page' : undefined,
          className:'sys-side-b' + (isCur ? (m.key === 'admin' ? ' on-admin' : ' on-parent') : ''),   // 접혀도 「지금 화면」 강조는 그대로
          onClick:function() { if (isCur) toggleCur(); else toggleOpen(m.key); }}, inner));
        if (!open) return;

        // 하위 목록. 다른 화면의 목록은 권한을 다시 읽은 뒤에만 그린다(그 전엔 자리만)
        var subs = null, subOn = null;
        var wait = !isCur && !permsLoaded && kind !== 'fixed';
        if (wait) {
          subs = null;
        } else if (kind === 'admin') {
          subs = PORTAL_PAGES.filter(function(pg) { return can(pg.need); }).map(function(pg) {
            if (curFile === pg.href.toLowerCase()) subOn = pg.key;
            return { key:pg.key, label:pg.label, svg:pg.svg, href:pg.href };
          });
        } else if (kind === 'fixed') {
          subs = m.subs; subOn = isCur ? activeSub : null;
        } else {
          var secTabs = sectionTabs(m.key, user);
          // 지금 화면이 다른 화면 하위 항목(url)이면(예: docs.html) 같은 메뉴의 화면 탭들도 링크로 간다
          var onUrlPage = isCur && secTabs.some(function(t) { return t.url && t.key === activeSub; });
          subs = secTabs.map(function(t) {
            var b = (m.key === 'leave' && apprBadges[t.key] !== undefined) ? apprBadges[t.key] : (isCur ? subBadges[t.key] : 0);
            var href = t.url ? t.url : ((isCur && !onUrlPage) ? null : m.url + '#' + t.key);
            return { key:t.key, label:t.label, svg:t.svg, badge: b, href: href };
          });
          subOn = isCur ? activeSub : null;
        }
        sideItems.push(e('div', {key:m.key + '-sub', id:subId, className:'sys-side-sub' + (m.key === 'admin' ? ' adm' : '')},
          wait ? e('div', {className:'sys-side-wait'}, '불러오는 중…')
               : subs.map(function(s) { return subItem(s, s.key === subOn, kind === 'fixed'); })
        ));
      });

      // 데스크탑 앱 안에서만: 「파일」(앱 내장 파일 탐색기 창을 연다 — 이동 없음). 협력업체 제외
      if (isDesktopApp() && user && !contractor) {
        sideItems.push(e('button', {key:'desk-files', type:'button', className:'sys-side-b', title:'파일 탐색기 창 열기(앱)',
          onClick:function() { openDesktopFiles(); }}, [sideIcon(React, 'folder'), e('span', {key:'l'}, '파일')]));
      }

      var side = e('aside', {key:'side', id:'sys-side', className:'sys-side no-print', 'aria-label':'메뉴', onClick:onSideClick},
        drawerX(),
        e('a', {key:'brand', className:'sys-side-brand', href:cfg.HOME_URL||'home.html'},
          cfg.LOGO_URL ? e('img', {key:'i', src:cfg.LOGO_URL, alt:''}) : null,
          e('span', {key:'t', className:'sys-side-tt'},
            e('b', {key:'n'}, cfg.COMPANY_SHORT || cfg.COMPANY_KO || ''),
            e('span', {key:'v', className:'sys-side-ver'}, 'v' + APP_VERSION)
          )
        ),
        e('nav', {key:'nav', className:'sys-side-nav'}, sideItems),
        e('div', {key:'foot', className:'sys-side-foot'},
          (isRealAdmin && sbClient) ? e('div', {key:'view', className:'sys-side-view' + (viewAs ? ' on' : '')},
            e('label', {htmlFor:'sys-view-sel'}, '다른 부서로 보기'),
            e('select', {id:'sys-view-sel', value: viewAs ? viewAs.team_id : '', onChange:onViewChange},
              [e('option', {key:'-', value:''}, '관리자 (원래)')].concat(teams.map(function(t) {
                return e('option', {key:t.id, value:t.id}, t.name);
              }))
            )
          ) : null,
          user ? e('div', {key:'who', className:'sys-side-who'},
            e('b', null, user.name + ' 님'),
            teamName ? e('span', null, teamName) : null
          ) : null,
          // 휴대폰 앱 설치(직원 · 휴대폰 · 앱으로 열지 않았을 때만) — 로그아웃 위
          canInstallUi(user) ? e('button', {key:'pwa', type:'button', className:'sys-side-btn sys-side-install', onClick:afterClose(function() { openInstall(); })},
            sideIcon(React, 'phone', 14), '앱 설치') : null,
          e('div', {key:'btns', className:'sys-side-btns'},
            e('a', {key:'hp', href:cfg.INDEX_URL||'index.html', className:'sys-side-btn', title:'홈페이지'}, sideIcon(React, 'globe', 14), '홈페이지'),
            e('button', {key:'lo', type:'button', className:'sys-side-btn', onClick:afterClose(function() { onLogout(); })}, sideIcon(React, 'out', 14), '로그아웃')
          )
        )
      );

      var tog = e('button', {
        key:'tog', type:'button', className:'sys-side-tog no-print', onClick:toggleSide,
        title: sideOff ? '메뉴 펴기 ( [ 키 )' : '메뉴 접기 — 본문만 크게 ( [ 키 )',
        'aria-label': sideOff ? '메뉴 펴기' : '메뉴 접기'
      }, sideIcon(React, sideOff ? 'chevR' : 'chevL', 14));

      return e(React.Fragment, null, topBar, drawerBg(), side, tog);
    };
  }

  // ───────────────────────────────────────────────────────────────
  //  쓰기 실패 알림 — showError / logError / writeFailed
  //
  //  배경: 이 앱의 쓰기 호출 상당수가 Supabase 응답의 error 를 확인하지 않아
  //  RLS 로 막혀도 화면은 성공한 것처럼 보였다. 페이지마다 알림 UI 가 달라
  //  여기에 공용 헬퍼를 둔다. 표시 문구는 config.js 의 ERROR_* 라벨을 쓴다.
  //
  //  ※ RLS 차단의 형태가 두 가지라는 점이 중요하다.
  //     · INSERT  차단 → error.code '42501' 로 error 가 온다.
  //     · UPDATE/DELETE 차단 → error 가 없고 "영향 행 0" 으로 조용히 끝난다.
  //    두 번째는 error 검사만으로는 절대 잡히지 않는다. 호출부에 .select() 를
  //    붙여 영향 행을 돌려받고 writeFailed(res, ctx, {expectRows:true}) 로 판정한다.
  //    단, 원래 0행이 정상인 삭제(예: 하위 데이터가 없을 수 있는 일괄 삭제)에는
  //    expectRows 를 쓰지 말 것 — 정상 동작을 실패로 오인한다.
  // ───────────────────────────────────────────────────────────────
  var ERR_BOX_ID = 'sys-err-box';
  var _errTimer = null;

  function _cfg() { return global.APP_CONFIG || {}; }

  /** Supabase 오류를 사용자 문구로 바꾼다. */
  function describeError(err) {
    var cfg = _cfg();
    var code = (err && (err.code || err.status)) || '';
    var msg = (err && (err.message || err.msg)) || '';
    var denied = String(code) === '42501' || String(code) === '401' || String(code) === '403'
      || /row-level security|permission denied|not authorized|JWT/i.test(msg);
    var base = denied
      ? (cfg.ERROR_PERMISSION || '권한이 없습니다. 관리자에게 문의해 주세요.')
      : (cfg.ERROR_GENERIC || '처리 중 오류가 발생했습니다.');
    return msg ? base + ' (' + msg + ')' : base;
  }

  function hideErrBox() {
    if (_errTimer) { clearTimeout(_errTimer); _errTimer = null; }
    try {
      var box = document.getElementById(ERR_BOX_ID);
      if (box) box.style.display = 'none';
    } catch (e) {}
  }

  /**
   * 화면 상단 고정 박스에 표시한다. 성공하면 true.
   * 인라인 style 만 쓰므로 injectCss() 호출 여부와 무관하게 동작한다.
   */
  function renderErrBox(text) {
    try {
      if (!global.document || !document.body) return false;
      var box = document.getElementById(ERR_BOX_ID);
      if (!box) {
        box = document.createElement('div');
        box.id = ERR_BOX_ID;
        box.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);'
          + 'z-index:99999;max-width:560px;width:calc(100vw - 32px);box-sizing:border-box;'
          + 'padding:11px 14px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;'
          + 'color:#991b1b;font-size:13px;line-height:1.55;white-space:pre-wrap;'
          + 'word-break:break-word;box-shadow:0 4px 14px rgba(0,0,0,.14);cursor:pointer;';
        box.title = '클릭하면 닫힙니다';
        box.onclick = hideErrBox;
        document.body.appendChild(box);
      }
      box.textContent = text;
      box.style.display = 'block';
      if (_errTimer) clearTimeout(_errTimer);
      _errTimer = setTimeout(hideErrBox, 8000);
      return true;
    } catch (e) { return false; }
  }

  /** 콘솔에만 남긴다. 사용자 흐름을 막으면 안 되는 부수기록(감사로그 등)용. */
  function logError(err, context) {
    try { console.error('[' + (context || 'error') + ']', err); } catch (e) {}
  }

  /** 사용자에게 알리고 콘솔에도 남긴다. 박스 생성 실패 시 alert 로 대체. */
  function showError(err, context) {
    logError(err, context);
    var cfg = _cfg();
    var text = (cfg.ERROR_TITLE || '처리하지 못했습니다')
      + (context ? ' · ' + context : '') + '\n' + describeError(err);
    if (!renderErrBox(text)) { try { global.alert(text); } catch (e) {} }
  }

  /**
   * writeFailed(res, context, opts) → 실패면 알린 뒤 true
   *  res      : supabase 쓰기 응답 ({ data, error })
   *  context  : 사용자에게 보여줄 동작 이름 (예: '팀원 추가')
   *  opts.expectRows : true 면 영향 행 0 건도 실패로 본다 (.select() 필요)
   */
  function writeFailed(res, context, opts) {
    var o = opts || {};
    if (!res) { showError(new Error('no response'), context); return true; }
    if (res.error) { showError(res.error, context); return true; }
    if (o.expectRows) {
      var rows = res.data;
      var n = (rows == null) ? 0 : (rows.length == null ? 1 : rows.length);
      if (n === 0) {
        showError({ code: '42501', message: _cfg().ERROR_NO_ROWS
          || '대상을 찾을 수 없거나 권한이 없어 변경되지 않았습니다.' }, context);
        return true;
      }
    }
    return false;
  }

  /**
   * invokeAuthed(sbClient, fnName, body)
   * Edge Function 호출 시 로그인 JWT 를 Authorization 헤더로 명시 첨부한다.
   *
   * 왜 필요한가 — 이 앱의 "로그인됨" 화면 상태는 sessionStorage 프로필이고,
   * 실제 인증 JWT 는 supabase 가 localStorage 에 들고 있는 세션이다. 둘이 어긋나면
   * functions.invoke() 의 토큰 자동첨부가 누락돼 Edge Function 의 getUser() 가
   * 실패하고 401 이 난다(admin-staff.html 에서 실제로 발생). 그래서 토큰을 직접 붙인다.
   *
   * 원래 admin-staff.html 안에만 있던 헬퍼를 공용으로 올린 것이다.
   * sbClient 를 인자로 받으므로 어느 페이지에서나 쓸 수 있다.
   *
   * 반환: Promise<{ data, error }> — functions.invoke 와 같은 모양. throw 하지 않는다.
   * ※ Edge Function 이 4xx/5xx 로 답하면 본문의 error 가 data.error 에 담겨 올 수
   *   있으므로, 호출부는 error 와 data.error 를 모두 확인해야 한다.
   */
  function invokeAuthed(sbClient, fnName, body) {
    if (!sbClient || !sbClient.auth || !sbClient.functions) {
      return Promise.resolve({
        data: null,
        error: { message: 'Supabase 클라이언트를 사용할 수 없습니다.' },
      });
    }
    return sbClient.auth.getSession().then(function(sess) {
      var session = (sess && sess.data) ? sess.data.session : null;
      if (!session || !session.access_token) {
        return { data: null, error: { message: '세션이 만료되었습니다. 다시 로그인해 주세요.' } };
      }
      return sbClient.functions.invoke(fnName, {
        body: body,
        headers: { Authorization: 'Bearer ' + session.access_token },
      });
    });
  }

  // ── 급여 열람 기록 (DB payroll_access_logs, 2026-10-27~) ─────────────────
  //   action: 'run_view'(급여대장 화면) · 'slip_view'(관리자 명세서 미리보기) · 'excel_download'(급여대장 엑셀) ·
  //           'mail_send'(알림 메일 일괄 발송) · 'self_slip_view'(직원 본인 명세서). 확정·확정 취소와 송금내역 내려받기는
  //           이미 DB 가 다른 표(payroll_audit_logs · payroll_transfer_exports)에 남기므로 여기서 다시 쓰지 않는다.
  //   opts: { employeeId, period, runType, detail }. 행위자·이름·일시는 DB 트리거가 로그인 계정으로 채운다(보내도 무시됨).
  //   반환: Promise(항상 이행). 실패는 콘솔 경고만 — 열람·내려받기·발송을 막지 않는다.
  //   중복 방지: config PAYROLL.ACCESS_LOG.DEDUP_ACTIONS 의 행동은 같은 내용이면 DEDUP_SECONDS 안에 다시 남기지 않는다
  //   (이 창 sessionStorage — 새로고침해도 유지).
  var ACCESS_DEDUP_KEY = _prefix + '_payroll_access_recent';
  function _accessCfg() {
    var p = (global.APP_CONFIG && global.APP_CONFIG.PAYROLL && global.APP_CONFIG.PAYROLL.ACCESS_LOG) || {};
    return {
      sec: (p.DEDUP_SECONDS == null) ? 60 : p.DEDUP_SECONDS,
      acts: p.DEDUP_ACTIONS || ['run_view', 'slip_view', 'self_slip_view'],
    };
  }
  function logPayrollAccess(sbClient, action, opts) {
    try {
      opts = opts || {};
      if (!sbClient || !sbClient.from || !action) return Promise.resolve(false);
      var cfg = _accessCfg();
      var row = {
        action: action,
        target_employee_id: opts.employeeId || null,
        period: opts.period || null,
        run_type: opts.runType || null,
        detail: opts.detail || {},
      };
      var key = null, now = Date.now(), recent = null;
      if (cfg.sec > 0 && cfg.acts.indexOf(action) !== -1) {
        var u = _me();
        key = [u ? u.id : '', action, row.target_employee_id || '', row.period || '', row.run_type || '', JSON.stringify(row.detail)].join('|');
        recent = _ssGet(ACCESS_DEDUP_KEY) || {};
        Object.keys(recent).forEach(function(k) { if (now - recent[k] > cfg.sec * 1000) delete recent[k]; });
        if (recent[key]) return Promise.resolve(false);
      }
      // 조회 권한이 없는 사람도 쓰므로 결과 행을 돌려받지 않는다(.select() 붙이지 말 것)
      return sbClient.from('payroll_access_logs').insert(row).then(function(r) {
        if (r && r.error) { console.warn('[급여 열람 기록] 남기지 못했습니다:', r.error.message || r.error); return false; }
        if (key) { recent[key] = now; _ssSet(ACCESS_DEDUP_KEY, recent); }
        return true;
      }, function(e) {
        console.warn('[급여 열람 기록] 남기지 못했습니다:', (e && e.message) || e);
        return false;
      });
    } catch (e) {
      console.warn('[급여 열람 기록] 남기지 못했습니다:', (e && e.message) || e);
      return Promise.resolve(false);
    }
  }

  // ── 올릴 파일 형식 확인 (2026-10-29) ─────────────────────────────
  // 브라우저가 붙이는 file.type 은 PC·프로그램마다 다르다(한글이 깔린 PC 는 .hwpx 를 application/haansofthwpx 로 보냄).
  // 그리고 supabase-js 는 File(Blob)을 받으면 FormData 로 보내면서 contentType 옵션을 무시하고 file.type 을 쓴다.
  // → 실제 앞부분 바이트로 형식을 확인하고, 바이트(ArrayBuffer) + 표준 MIME 으로 올린다(이때는 contentType 이 그대로 쓰인다).
  // checkUpload(file, kinds, maxMB) → Promise<{ok:true, kind, mime, ext, body} | {ok:false, message}>
  //   kinds: ['png','jpg'] · ['hwpx'] · ['pdf'] 중 허용할 것
  var UPLOAD_KINDS = {
    png:  { mime: 'image/png',           ext: 'png'  },
    jpg:  { mime: 'image/jpeg',          ext: 'jpg'  },
    pdf:  { mime: 'application/pdf',     ext: 'pdf'  },
    hwpx: { mime: 'application/hwp+zip', ext: 'hwpx' },
    bmp:  { mime: 'image/bmp',           ext: 'bmp'  },   // 받기만 — 올리기 전에 화면이 PNG 로 바꾼다(버킷은 PNG·JPG 만)
  };
  function _startsWith(b, arr, off) { off = off || 0; for (var i = 0; i < arr.length; i++) if (b[off + i] !== arr[i]) return false; return true; }
  function _ascii(b, off, len) { var s = ''; for (var i = 0; i < len && off + i < b.length; i++) s += String.fromCharCode(b[off + i]); return s; }
  // ZIP 안 mimetype 항목(압축 안 함)의 내용. 맨 앞부터 로컬 헤더를 따라가며 찾는다(HWPX 는 보통 첫 항목).
  function _zipMimetype(b) {
    var off = 0;
    for (var n = 0; n < 64 && off + 30 <= b.length; n++) {
      if (!_startsWith(b, [0x50, 0x4B, 0x03, 0x04], off)) return null;
      var flag = b[off + 6] | (b[off + 7] << 8), method = b[off + 8] | (b[off + 9] << 8);
      var csize = (b[off + 18] | (b[off + 19] << 8) | (b[off + 20] << 16) | (b[off + 21] << 24)) >>> 0;
      var nlen = b[off + 26] | (b[off + 27] << 8), xlen = b[off + 28] | (b[off + 29] << 8);
      var name = _ascii(b, off + 30, nlen), data = off + 30 + nlen + xlen;
      if (name === 'mimetype') return method === 0 ? _ascii(b, data, csize).trim() : null;
      if (flag & 8) return null;   // 크기가 뒤에 적힌 항목 — 더 따라갈 수 없음
      off = data + csize;
    }
    return null;
  }
  function _sniff(b) {
    if (_startsWith(b, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return 'png';
    if (_startsWith(b, [0xFF, 0xD8, 0xFF])) return 'jpg';
    if (_startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2D])) return 'pdf';
    if (_startsWith(b, [0x50, 0x4B, 0x03, 0x04])) return _zipMimetype(b) === 'application/hwp+zip' ? 'hwpx' : 'zip';
    if (_startsWith(b, [0xD0, 0xCF, 0x11, 0xE0])) return 'hwp';    // 옛 한글(.hwp)·옛 오피스 형식
    if (_startsWith(b, [0x42, 0x4D])) return 'bmp';
    if (_ascii(b, 0, 4) === 'GIF8') return 'gif';
    if (_ascii(b, 0, 4) === 'RIFF' && _ascii(b, 8, 4) === 'WEBP') return 'webp';
    if (_ascii(b, 4, 4) === 'ftyp') return 'heic';
    return '';
  }
  var UPLOAD_NAMES = { bmp: 'BMP', gif: 'GIF', webp: 'WEBP', heic: 'HEIC(아이폰 사진)', hwp: '.hwp', zip: '일반 ZIP', png: 'PNG', jpg: 'JPG', pdf: 'PDF', hwpx: '.hwpx' };
  function _uploadMsg(kinds, got) {
    var gotName = got ? UPLOAD_NAMES[got] + ' 파일이라 ' : '';
    if (kinds.indexOf('hwpx') !== -1) {
      if (got === 'hwp') return '한글 서식 파일(.hwpx)만 올릴 수 있습니다. 한글에서 「다른 이름으로 저장 → HWPX」로 저장해 올려 주세요.';
      return '한글 서식 파일(.hwpx)만 올릴 수 있습니다.' + (got ? ' (고른 파일: ' + UPLOAD_NAMES[got] + ')' : '');
    }
    if (kinds.indexOf('pdf') !== -1) return 'PDF 파일만 올릴 수 있습니다.' + (got ? ' (고른 파일: ' + UPLOAD_NAMES[got] + ')' : '');
    if (kinds.indexOf('bmp') !== -1) return 'PNG · JPG · BMP 그림만 올릴 수 있습니다.' + (got ? ' (고른 파일: ' + UPLOAD_NAMES[got] + ')' : '');
    return 'PNG 또는 JPG 그림만 올릴 수 있습니다.' + (gotName ? ' ' + gotName + '안 돼요 — 그림판 등에서 PNG 로 저장해 올려 주세요.' : '');
  }
  function checkUpload(file, kinds, maxMB) {
    kinds = kinds || [];
    if (!file) return Promise.resolve({ ok: false, message: '파일을 고르세요.' });
    if (maxMB && file.size > maxMB * 1024 * 1024) return Promise.resolve({ ok: false, message: maxMB + 'MB 이하 파일만 올릴 수 있습니다.' });
    if (!file.size) return Promise.resolve({ ok: false, message: '빈 파일입니다.' });
    var read = file.arrayBuffer ? file.arrayBuffer() : new Promise(function(res, rej) {
      var fr = new FileReader(); fr.onload = function() { res(fr.result); }; fr.onerror = function() { rej(fr.error); }; fr.readAsArrayBuffer(file);
    });
    return read.then(function(buf) {
      var got = _sniff(new Uint8Array(buf, 0, Math.min(buf.byteLength, 4096)));
      if (got === 'zip' && kinds.indexOf('hwpx') !== -1) got = _zipMimetype(new Uint8Array(buf)) === 'application/hwp+zip' ? 'hwpx' : 'zip';
      if (kinds.indexOf(got) === -1) return { ok: false, message: _uploadMsg(kinds, got) };
      var k = UPLOAD_KINDS[got];
      return { ok: true, kind: got, mime: k.mime, ext: k.ext, body: buf };
    }, function(e) { return { ok: false, message: '파일을 읽지 못했습니다: ' + ((e && e.message) || e) }; });
  }

  // ── 끌어다 놓기 올리기 (2026-10-29) ──────────────────────────────
  // dropZone(el, opts) → { destroy } — el 에 파일을 끌어다 놓으면 checkUpload 로 형식을 확인해 넘긴다.
  //   opts = { kinds, maxMB, multiple, onFiles(list), onError(message, errors), busy() }
  //   list = [{file, kind, mime, ext, body}] (형식 확인 통과). 한 개만 받는 곳에 여러 개를 놓으면 「한 개만 올려 주세요.」
  //   여러 개를 받는 곳은 통과한 것만 onFiles 로 넘기고, 형식이 다른 것은 errors=[{name, message}] 로 onError.
  //   끌고 들어오면 el 에 클래스 sys-drop-on. 영역이 하나라도 있는 동안 페이지 전체에서 파일 놓기 기본 동작
  //   (브라우저가 파일을 열어 버림)을 막는다 — 영역이 모두 없어지면(화면을 떠나면) 원래대로.
  // checkFiles(files, opts) → Promise<{ok:[…], errors:[…]}> — 클릭으로 고른 파일도 같은 규칙으로 검사
  // canDrop() → 끌어다 놓기가 되는 환경(마우스가 있는 PC)이면 true. 휴대폰은 클릭으로 고르기만 안내한다.
  var _dropZones = 0;
  function _hasFiles(e) { return !!(e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0); }
  // 상자 밖에 놓으면 브라우저가 파일을 여는 것만 막고 아무 일도 없어서 「올렸는데 안 바뀜」이 됐다 → 안내를 띄운다(2026-11-06)
  function _pageGuard(e) {
    if (!_hasFiles(e)) return;
    e.preventDefault();
    if (e.type === 'dragover') e.dataTransfer.dropEffect = 'none';
    else renderErrBox('올리지 않았어요 — 파일은 「올리기」 상자 위에 놓아 주세요.');
  }
  function _dropCss() {
    if (document.getElementById('sys-drop-css')) return;
    var s = document.createElement('style');
    s.id = 'sys-drop-css';
    s.textContent =
      '.sys-drop{border:2px dashed #cbd5e1;border-radius:12px;background:#f8fafc;transition:background .15s,border-color .15s;}' +
      '.sys-drop.sys-drop-on{border-color:#7c3aed;background:#f5f3ff;}';
    document.head.appendChild(s);
  }
  // 데스크탑 앱(Tauri) 기본 창은 끌어다 놓은 파일을 앱이 받아 웹 화면에 넘기지 않는다(Windows WebView2 + Tauri 기본값).
  // 그 안에서는 「끌어다 놓기 가능」이라고 안내하지 않고 클릭해서 고르기만 안내한다(2026-11-06)
  function canDrop() {
    if (global.__TAURI__) return false;
    try { return 'ondrop' in document.createElement('div') && !!(global.matchMedia && global.matchMedia('(pointer:fine)').matches); }
    catch (e) { return false; }
  }
  // pickedFiles(e) → 파일 고르기 칸(change)에서 고른 파일을 배열로 복사한 뒤 칸을 비운다(같은 파일을 다시 고를 수 있게).
  //   ⚠ 순서가 중요하다: Chromium(Edge·데스크탑 앱 WebView2)은 input.value = '' 를 하면 방금 받은 FileList 를
  //   그 자리에서 0개로 비운다 — `var fs = e.target.files; e.target.value = ''` 는 항상 빈 목록이 된다(2026-11-06 실측).
  function pickedFiles(e) {
    var t = e && e.target;
    var list = Array.prototype.slice.call((t && t.files) || []);
    try { if (t) t.value = ''; } catch (x) {}
    return list;
  }
  // onPickCancel(input, fn) → 파일 선택 창에서 취소하면 fn() (브라우저 cancel 이벤트). 돌려준 함수로 해제
  function onPickCancel(input, fn) {
    if (!input || !input.addEventListener) return function() {};
    input.addEventListener('cancel', fn);
    return function() { input.removeEventListener('cancel', fn); };
  }
  function checkFiles(files, opts) {
    opts = opts || {};
    var list = Array.prototype.slice.call(files || []);
    // 0개를 조용히 넘기지 않는다 — 「아무 반응 없음」이 되지 않게(2026-11-06)
    if (!list.length) return Promise.resolve({ ok: [], errors: [{ name: '', message: '고른 파일을 받지 못했어요. 다시 골라 주세요.' }] });
    if (!opts.multiple && list.length > 1) return Promise.resolve({ ok: [], errors: [{ name: '', message: '한 개만 올려 주세요.' }] });
    return Promise.all(list.map(function(f) {
      return checkUpload(f, opts.kinds, opts.maxMB).then(function(c) { return { file: f, c: c }; });
    })).then(function(rs) {
      var ok = [], errors = [];
      rs.forEach(function(r) {
        if (r.c.ok) ok.push({ file: r.file, kind: r.c.kind, mime: r.c.mime, ext: r.c.ext, body: r.c.body });
        else errors.push({ name: r.file.name || '', message: r.c.message });
      });
      return { ok: ok, errors: errors };
    });
  }
  function dropZone(el, opts) {
    opts = opts || {};
    if (!el) return { destroy: function() {} };
    _dropCss();
    el.classList.add('sys-drop');
    var depth = 0;
    function busy() { return !!(opts.busy && opts.busy()); }
    function on(e) { if (!_hasFiles(e)) return; e.preventDefault(); depth++; if (!busy()) el.classList.add('sys-drop-on'); }
    function over(e) { if (!_hasFiles(e)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = busy() ? 'none' : 'copy'; }
    function off(e) { if (!_hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) el.classList.remove('sys-drop-on'); }
    function drop(e) {
      if (!_hasFiles(e)) return;
      e.preventDefault(); e.stopPropagation();
      depth = 0; el.classList.remove('sys-drop-on');
      if (busy()) return;
      checkFiles(e.dataTransfer.files, opts).then(function(r) {
        if (r.errors.length && opts.onError) opts.onError(r.errors[0].message, r.errors);
        if (r.ok.length && opts.onFiles) opts.onFiles(r.ok);
      });
    }
    el.addEventListener('dragenter', on); el.addEventListener('dragover', over);
    el.addEventListener('dragleave', off); el.addEventListener('drop', drop);
    if (!_dropZones++) { global.addEventListener('dragover', _pageGuard); global.addEventListener('drop', _pageGuard); }
    var alive = true;
    return {
      destroy: function() {
        if (!alive) return; alive = false;
        el.removeEventListener('dragenter', on); el.removeEventListener('dragover', over);
        el.removeEventListener('dragleave', off); el.removeEventListener('drop', drop);
        el.classList.remove('sys-drop', 'sys-drop-on');
        if (!--_dropZones) { global.removeEventListener('dragover', _pageGuard); global.removeEventListener('drop', _pageGuard); }
      }
    };
  }

  // ── 로그인 아이디 규칙 (config.js AUTH_POLICY) ───────────────────
  // 서버(change-own-password)도 같은 규칙·같은 문구로 다시 검사한다. 여기는 입력 중 안내용.
  function authPolicy() {
    var p = (global.APP_CONFIG && global.APP_CONFIG.AUTH_POLICY) || {};
    return {
      min: p.LOGIN_ID_MIN || 4,
      max: p.LOGIN_ID_MAX || 20,
      requireLetter: p.LOGIN_ID_REQUIRE_LETTER !== false,
      reserved: (p.LOGIN_ID_RESERVED || []).map(function(x) { return String(x).toLowerCase(); }),
      pwMin: Math.max(8, p.PASSWORD_MIN_LENGTH || 8),
    };
  }

  // 로그인 입력 → 인증 이메일 앞부분.
  // 숫자·하이픈·공백·괄호·점만 있으면 휴대폰 번호로 보고 숫자만 남긴다(기존 계정 호환).
  // 그 외(영문이 섞인 아이디)는 소문자 그대로. (예전에는 숫자가 하나라도 있으면 숫자만 남겨 kim2024 → 2024 가 됐다)
  function loginLocalFromInput(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (/^[0-9\-\s().+]+$/.test(s)) return s.replace(/\D/g, '');
    return s.toLowerCase();
  }

  // 반환: 문제 없으면 '' , 있으면 화면에 보여줄 이유
  function checkLoginId(id, ctx) {
    var p = authPolicy();
    var v = String(id || '').trim().toLowerCase();
    var phone = ctx && ctx.phone ? String(ctx.phone).replace(/\D/g, '') : '';
    if (v.length < p.min || v.length > p.max) return '아이디는 ' + p.min + '~' + p.max + '자로 정해 주세요.';
    if (!/^[a-z0-9]+$/.test(v)) return '아이디는 영문 소문자와 숫자만 쓸 수 있습니다.';
    if (p.requireLetter && !/[a-z]/.test(v)) return '아이디에 영문을 1자 이상 넣어 주세요.';
    if (p.reserved.indexOf(v) !== -1) return '사용할 수 없는 아이디입니다.';
    if (phone && v === phone) return '휴대폰 번호는 아이디로 쓸 수 없습니다.';
    return '';
  }

  // 아이디 규칙 한 줄 안내 (화면 표시용)
  function loginIdRuleText() {
    var p = authPolicy();
    return '영문 소문자·숫자 ' + p.min + '~' + p.max + '자' + (p.requireLetter ? ', 영문 1자 이상' : '')
         + ', 휴대폰 번호·생년월일 불가';
  }

  // config.js AUTH_POLICY 를 DB(auth_policy)로 복사 — 서버 함수가 같은 규칙을 쓰도록.
  // admin 만 저장된다(RLS). 그 외 역할이면 조용히 건너뛴다. 반환: Promise<{ synced, changed, error }>
  function syncAuthPolicy(sbClient, userId) {
    var p = authPolicy();
    var row = {
      id: 1, login_id_min: p.min, login_id_max: p.max, login_id_require_letter: p.requireLetter,
      login_id_reserved: p.reserved, password_min_length: p.pwMin,
      synced_at: new Date().toISOString(), synced_by: userId || null,
    };
    return sbClient.from('auth_policy').select('*').eq('id', 1).maybeSingle().then(function(r) {
      if (r.error) return { synced: false, changed: false, error: r.error };
      var cur = r.data;
      var same = cur && cur.login_id_min === row.login_id_min && cur.login_id_max === row.login_id_max
        && cur.login_id_require_letter === row.login_id_require_letter
        && cur.password_min_length === row.password_min_length
        && JSON.stringify(cur.login_id_reserved || []) === JSON.stringify(row.login_id_reserved);
      if (same) return { synced: true, changed: false, error: null };
      var q = cur ? sbClient.from('auth_policy').update(row).eq('id', 1).select('id')
                  : sbClient.from('auth_policy').insert(row).select('id');
      return q.then(function(w) {
        return { synced: !w.error && !!(w.data && w.data.length), changed: true, error: w.error || null };
      });
    });
  }

  // config.js ADMIN_TEAM_NAME 을 DB(app_settings)로 복사 — DB 의 관리 권한 판정(is_admin_team)이 같은 팀명을 쓰도록.
  // admin 만 저장된다(RLS). 그 외 역할이면 조용히 건너뛴다. 반환: Promise<{ synced, changed, error }>
  function syncAppSettings(sbClient, userId) {
    var name = (global.APP_CONFIG && global.APP_CONFIG.ADMIN_TEAM_NAME) || null;
    var row = { id: 1, admin_team_name: name, synced_at: new Date().toISOString(), synced_by: userId || null };
    return sbClient.from('app_settings').select('*').eq('id', 1).maybeSingle().then(function(r) {
      if (r.error) return { synced: false, changed: false, error: r.error };
      var cur = r.data;
      if (cur && cur.admin_team_name === row.admin_team_name) return { synced: true, changed: false, error: null };
      var q = cur ? sbClient.from('app_settings').update(row).eq('id', 1).select('id')
                  : sbClient.from('app_settings').insert(row).select('id');
      return q.then(function(w) {
        return { synced: !w.error && !!(w.data && w.data.length), changed: true, error: w.error || null };
      });
    });
  }

  // ── 직원 정보 조회 (H-1) ──────────────────────────────────────
  // users 의 민감 컬럼(phone · email · birth_date · username)은 일반 조회 권한에서 빠진다.
  //   · 본인 정보   → loadMyProfile()      (DB 함수 get_my_profile)
  //   · 전 직원 목록 → USER_PUBLIC_COLS 로 조회 후 mergeUserPrivate()
  //                    (DB 함수 users_private_list — admin·관리팀만. 그 외에는 민감 컬럼 없이 그대로)
  // select('*') 나 민감 컬럼 직접 지정은 권한 회수 후 42501 로 실패하므로 쓰지 않는다.
  var USER_PUBLIC_COLS = 'id,name,role,team_id,join_date,total_days,used_days,created_at,position,'
                       + 'auth_id,hire_date,leave_date,must_change_pw,must_change_id';
  var USER_PRIVATE_COLS = ['phone', 'email', 'birth_date', 'username'];

  // 반환: Promise<{ data: 프로필|null, error }>
  function loadMyProfile(sbClient, cols) {
    return sbClient.rpc('get_my_profile').select(cols || '*').maybeSingle();
  }

  // rows 에 민감 컬럼을 id 기준으로 붙인다. 반환: Promise<{ data, error, privateOk }>
  // 권한이 없으면(42501) 오류로 보지 않고 rows 를 그대로 돌려준다(privateOk=false).
  function mergeUserPrivate(sbClient, rows) {
    return sbClient.rpc('users_private_list').then(function(r) {
      if (r.error) {
        var denied = r.error.code === '42501';
        if (!denied) logError(r.error, '직원 개인정보 조회');
        return { data: rows || [], error: denied ? null : r.error, privateOk: false };
      }
      var byId = {};
      (r.data || []).forEach(function(p) { byId[p.id] = p; });
      var out = (rows || []).map(function(u) {
        var p = byId[u.id];
        if (!p) return u;
        var n = {};
        for (var k in u) { if (Object.prototype.hasOwnProperty.call(u, k)) n[k] = u[k]; }
        USER_PRIVATE_COLS.forEach(function(c) { n[c] = p[c]; });
        return n;
      });
      return { data: out, error: null, privateOk: true };
    });
  }

  // 전 직원(이름순) + 권한이 있으면 민감 컬럼. 반환: Promise<{ data, error, privateOk }>
  function loadUsersFull(sbClient) {
    return sbClient.from('users').select(USER_PUBLIC_COLS).order('name').then(function(r) {
      if (r.error) return { data: [], error: r.error, privateOk: false };
      return mergeUserPrivate(sbClient, r.data || []);
    });
  }

  global.Sysbar = {
    authPolicy:          authPolicy,
    loginLocalFromInput: loginLocalFromInput,
    checkLoginId:        checkLoginId,
    loginIdRuleText:     loginIdRuleText,
    syncAuthPolicy:      syncAuthPolicy,
    syncAppSettings:     syncAppSettings,
    USER_PUBLIC_COLS: USER_PUBLIC_COLS,
    loadMyProfile:    loadMyProfile,
    mergeUserPrivate: mergeUserPrivate,
    loadUsersFull:    loadUsersFull,
    SESSION_KEY: SESSION_KEY,
    SYS_MENUS:   SYS_MENUS,
    hashTab:     hashTab,
    SECTION_TABS:  SECTION_TABS,
    sectionTabs:   sectionTabs,
    APP_VERSION:   APP_VERSION,
    guestSectionTabs: guestSectionTabs,
    guestMenus:    guestMenus,
    loadApprovals:    loadApprovals,
    refreshApprovals: refreshApprovals,
    getApprovals:     getApprovals,
    approvalCounts:   approvalCounts,
    approvalBadges:   approvalBadges,
    isDesktopApp:     isDesktopApp,
    Pwa:              Pwa,
    openDesktopFiles: openDesktopFiles,
    startDesktopWatch: startDesktopWatch,
    lockDesktopNow:    lockDesktopNow,
    PORTAL_PAGES:  PORTAL_PAGES,
    portalCanShow: portalCanShow,
    PERM_DEFS:        PERM_DEFS,
    PERM_GROUPS:      PERM_GROUPS,
    PERM_FIXED_RULES: PERM_FIXED_RULES,
    loadPerms:     loadPerms,
    can:           can,
    canPortal:     canPortal,
    getPerms:      getPerms,
    getViewAs:     getViewAs,
    setViewAs:     setViewAs,
    clearPerms:    clearPerms,
    injectCss:   injectCss,
    isMobile:    isMobile,
    MOBILE_MAX_WIDTH: MOBILE_MAX,
    drawerOpen:  drawerOpen,
    drawerClose: drawerClose,
    createComponent:      createComponent,
    createLoginComponent: createLoginComponent,
    SessionManager:       SessionManager,
    Auth:                 Auth,
    showError:    showError,
    invokeAuthed: invokeAuthed,
    logPayrollAccess: logPayrollAccess,
    checkUpload:  checkUpload,
    dropZone:     dropZone,
    checkFiles:   checkFiles,
    pickedFiles:  pickedFiles,
    onPickCancel: onPickCancel,
    canDrop:      canDrop,
    logError:     logError,
    writeFailed:  writeFailed,
    describeError: describeError,
  };

})(window);
