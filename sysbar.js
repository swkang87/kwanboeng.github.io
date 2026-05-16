/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              SYSBAR & SESSION MODULE                         ║
 * ║  모든 페이지에서 공유하는 상단 네비 + 통합 세션 관리             ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * 사용법:
 *   1) <script src="config.js"></script>
 *   2) <script src="sysbar.js"></script>
 *
 * 제공 API (window.Sysbar):
 *   - getSession()     → 로그인된 user 객체 반환 (없으면 null)
 *   - setSession(user) → password 자동 제거 후 통합 세션 저장
 *   - clearSession()   → 로그아웃 (모든 페이지에서 동일하게 적용)
 *   - render(opts)     → 상단 sys-bar 렌더링 (옵션: activeKey, user, extraRight)
 */

(function(global){
  'use strict';

  // ── 통합 세션 키 (모든 시스템 공통) ──────────────────────────────
  const SESSION_KEY = 'kwanbo_session';

  // ── 메뉴 목록 (config.js의 MENUS와 url로 매칭) ───────────────
  // sys-bar에 표시되는 핵심 시스템 4개 (active=true인 것만 노출)
  const SYS_MENUS = [
    { key:'project',  icon:'📊', label:'공정관리', url:'project.html' },
    { key:'leave',    icon:'📅', label:'연차관리', url:'leave.html' },
    { key:'worklog',  icon:'📝', label:'업무일지', url:'worklog.html' },
    { key:'admin',    icon:'🏢', label:'관리포털', url:'admin-portal.html', adminOnly:true },
  ];

  // ── Session API ─────────────────────────────────────────────
  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const v = JSON.parse(raw);
      // 구버전(userId만 있는 경우)이거나 user 객체면 그대로
      // password가 있다면 즉시 제거 (마이그레이션 안전장치)
      if (v && typeof v === 'object' && v.password) {
        delete v.password;
        localStorage.setItem(SESSION_KEY, JSON.stringify(v));
      }
      return v;
    } catch(e) { return null; }
  }

  function setSession(user) {
    if (!user) { clearSession(); return null; }
    const safe = Object.assign({}, user);
    delete safe.password;
    localStorage.setItem(SESSION_KEY, JSON.stringify(safe));
    return safe;
  }

  function clearSession() {
    // 통합 세션 키 제거
    localStorage.removeItem(SESSION_KEY);
    // 구버전 세션 키들도 같이 제거 (마이그레이션)
    localStorage.removeItem('kwanbo_pm_user');
    sessionStorage.removeItem('kwanbo_uid');
  }

  // ── 권한 체크 ────────────────────────────────────────────────
  function canAccessAdminPortal(user, teamName) {
    if (!user) return false;
    return user.role === 'admin' || teamName === '관리팀';
  }

  function isContractor(user) {
    return !!(user && user.role === 'contractor');
  }

  // ── CSS 주입 (모든 페이지 공통 스타일) ────────────────────────
  function injectCss() {
    if (document.getElementById('sysbar-css')) return;
    const cfg = global.APP_CONFIG || {};
    const adminActive = cfg.COLOR_ADMIN_ACTIVE || '#7c3aed';
    const css = `
.sys-bar{position:sticky;top:0;z-index:300;background:#0f172a;height:38px;display:flex;align-items:center;padding:0 10px;gap:3px;border-bottom:1px solid #1e293b;flex-shrink:0;}
.sys-co{font-size:11px;font-weight:800;color:#94a3b8;margin-right:6px;letter-spacing:-.3px;white-space:nowrap;text-decoration:none;flex-shrink:0;}
.sys-link{display:flex;align-items:center;justify-content:center;gap:3px;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:600;text-decoration:none;color:#94a3b8;background:#1e293b;white-space:nowrap;flex-shrink:0;border:none;cursor:pointer;font-family:inherit;}
.sys-link.active{background:#1d4ed8;color:#fff;font-weight:700;cursor:default;}
.sys-link.active-admin{background:${adminActive};color:#fff;font-weight:700;cursor:default;}
.sys-link.disabled{color:#475569;cursor:pointer;}
.sys-right{margin-left:auto;display:flex;align-items:center;gap:8px;flex-shrink:0;}
.sys-user{font-size:11px;color:#94a3b8;white-space:nowrap;}
.sys-logout{background:transparent;color:#64748b;border:1px solid #334155;border-radius:4px;padding:3px 10px;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;}
@media(max-width:640px){
  .sys-bar{padding:0 4px;gap:2px;}
  .sys-co{display:none;}
  .sys-link{flex:1;padding:4px 1px;font-size:10px;gap:1px;}
  .sys-user{display:none;}
  .sys-logout{padding:3px 6px;font-size:10px;}
}
`;
    const s = document.createElement('style');
    s.id = 'sysbar-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ── Sysbar Renderer (React 의존 없음, 순수 JSX 호환을 위해 createElement) ──
  // React가 있으면 React.createElement로 컴포넌트 생성, 없으면 DOM 직접 생성
  function createComponent(React) {
    if (!React) return null;
    return function SysBar(props) {
      injectCss();
      const cfg = global.APP_CONFIG || {};
      const user = props.user;
      const activeKey = props.activeKey;
      const teamName = props.teamName || '';
      const onLogout = props.onLogout || function(){};
      const onDisabledClick = props.onDisabledClick || function(){};
      const contractor = isContractor(user);
      const canAdmin = canAccessAdminPortal(user, teamName);

      const e = React.createElement;

      // 회사명 링크
      const companyLink = e('a', {
        href: cfg.HOME_URL || 'index.html',
        className: 'sys-co'
      }, cfg.COMPANY_KO || '');

      // 메뉴 링크들
      const links = SYS_MENUS.filter(function(m) {
        if (m.adminOnly) return canAdmin;
        return true;
      }).map(function(m) {
        const isActive = (m.key === activeKey);
        // 비활성 / 활성 / 일반 분기
        if (isActive) {
          const cls = (m.key === 'admin') ? 'sys-link active-admin' : 'sys-link active';
          return e('div', { key: m.key, className: cls }, m.icon + ' ' + m.label);
        }
        if (contractor && m.key !== 'project') {
          // 기술지원은 공정관리만 접근 가능
          return e('div', {
            key: m.key,
            className: 'sys-link disabled',
            onClick: onDisabledClick
          }, m.icon + ' ' + m.label);
        }
        return e('a', {
          key: m.key,
          href: m.url,
          className: 'sys-link'
        }, m.icon + ' ' + m.label);
      });

      // 우측 사용자/로그아웃
      const userLabel = user
        ? (user.name + ' 님' + (teamName ? ' (' + teamName + ')' : ''))
        : '';
      const right = e('div', { className: 'sys-right' },
        user ? e('span', { className: 'sys-user' }, userLabel) : null,
        e('button', { className: 'sys-logout', onClick: onLogout }, '로그아웃')
      );

      return e('div', { className: 'sys-bar' + (props.noPrint ? ' no-print' : '') },
        companyLink, links, right
      );
    };
  }

  // ── Export ──────────────────────────────────────────────────
  global.Sysbar = {
    SESSION_KEY: SESSION_KEY,
    SYS_MENUS: SYS_MENUS,
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    canAccessAdminPortal: canAccessAdminPortal,
    isContractor: isContractor,
    injectCss: injectCss,
    createComponent: createComponent,
  };

})(window);
