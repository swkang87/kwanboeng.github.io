/**
 * SYSBAR MODULE v2.1
 * 모든 페이지 공통: 상단 네비바 CSS + React 컴포넌트
 *
 * 사용법:
 *   <script src="config.js"></script>
 *   <script src="sysbar.js"></script>
 *   const SysBar = Sysbar.createComponent(React);
 *   <SysBar activeKey="leave" user={user} teamName={teamName} onLogout={fn} />
 */
(function(global) {
  'use strict';

  var SESSION_KEY = 'kwanbo_session';

  var SYS_MENUS = [
    { key:'project', icon:'📊', label:'공정관리', url:'project.html' },
    { key:'leave',   icon:'📅', label:'연차관리', url:'leave.html'   },
    { key:'worklog', icon:'📝', label:'업무일지', url:'worklog.html' },
    { key:'admin',   icon:'🏢', label:'관리포털', url:'admin-portal.html', adminOnly:true },
  ];

  var CSS_INJECTED = false;

  function injectCss() {
    if (CSS_INJECTED || document.getElementById('sysbar-css')) { CSS_INJECTED = true; return; }
    var s = document.createElement('style');
    s.id = 'sysbar-css';
    s.textContent =
      '.sys-bar{position:sticky;top:0;z-index:300;background:#0f172a;height:38px;display:flex;align-items:center;padding:0 10px;gap:3px;border-bottom:1px solid #1e293b;flex-shrink:0;}' +
      '.sys-co{font-size:11px;font-weight:800;color:#94a3b8;margin-right:6px;letter-spacing:-.3px;white-space:nowrap;text-decoration:none;flex-shrink:0;}' +
      '.sys-link{display:flex;align-items:center;justify-content:center;gap:3px;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:600;text-decoration:none;color:#94a3b8;background:#1e293b;white-space:nowrap;flex-shrink:0;border:none;cursor:pointer;font-family:inherit;}' +
      '.sys-link.active{background:#1d4ed8;color:#fff;font-weight:700;cursor:default;}' +
      '.sys-link.active-admin{background:#7c3aed;color:#fff;font-weight:700;cursor:default;}' +
      '.sys-link.disabled{color:#475569;cursor:pointer;}' +
      '.sys-right{margin-left:auto;display:flex;align-items:center;gap:8px;flex-shrink:0;}' +
      '.sys-user{font-size:11px;color:#94a3b8;white-space:nowrap;}' +
      '.sys-logout{background:transparent;color:#64748b;border:1px solid #334155;border-radius:4px;padding:3px 8px;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;}' +
      '@media(max-width:640px){' +
        '.sys-bar{padding:0 4px;gap:2px;}' +
        '.sys-co{display:none;}' +
        '.sys-link{flex:1;padding:4px 1px;font-size:10px;gap:1px;}' +
        '.sys-user{display:none;}' +
        '.sys-logout{padding:3px 6px;font-size:10px;}' +
      '}';
    // head가 준비됐으면 바로, 아니면 DOMContentLoaded 때 삽입
    if (document.head) {
      document.head.appendChild(s);
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        document.head.appendChild(s);
      });
    }
    CSS_INJECTED = true;
  }

  // 페이지 로드 즉시 CSS 주입 (React 컴포넌트 실행 전에도 스타일 적용)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCss);
  } else {
    injectCss();
  }

  function createComponent(React) {
    if (!React) { console.error('[sysbar] React가 없습니다.'); return null; }
    injectCss(); // 한 번 더 보장

    return function SysBar(props) {
      var cfg        = global.APP_CONFIG || {};
      var user       = props.user;
      var activeKey  = props.activeKey;
      var teamName   = props.teamName        || '';
      var onLogout   = props.onLogout        || function(){};
      var onDisabled = props.onDisabledClick || function(){};
      var noPrint    = props.noPrint         || false;
      var contractor = !!(user && user.role === 'contractor');
      var canAdmin   = !!(user && (user.role === 'admin' || teamName === '관리팀'));
      var e = React.createElement;

      var links = SYS_MENUS
        .filter(function(m){ return m.adminOnly ? canAdmin : true; })
        .map(function(m){
          var label = m.icon + ' ' + m.label;
          if (m.key === activeKey)
            return e('div', {key:m.key, className:'sys-link '+(m.key==='admin'?'active-admin':'active')}, label);
          if (contractor && m.key !== 'project')
            return e('div', {key:m.key, className:'sys-link disabled', onClick:onDisabled}, label);
          return e('a', {key:m.key, href:m.url, className:'sys-link'}, label);
        });

      var userLabel = user
        ? (user.name + ' 님' + (teamName ? ' ('+teamName+')' : ''))
        : '';

      return e('div', {className:'sys-bar'+(noPrint?' no-print':'')},
        e('a', {key:'co', href:cfg.HOME_URL||'index.html', className:'sys-co'}, cfg.COMPANY_KO||''),
        links,
        e('div', {key:'right', className:'sys-right'},
          user ? e('span', {className:'sys-user'}, userLabel) : null,
          e('button', {className:'sys-logout', onClick:onLogout}, '로그아웃')
        )
      );
    };
  }

  global.Sysbar = {
    SESSION_KEY: SESSION_KEY,
    SYS_MENUS:   SYS_MENUS,
    injectCss:   injectCss,
    createComponent: createComponent,
  };

})(window);
