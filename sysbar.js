/**
 * SYSBAR MODULE v2.2
 * 모든 페이지 공통: 상단 네비바 CSS + React 컴포넌트
 */
(function(global) {
  'use strict';

  var SESSION_KEY = 'kwanbo_session';

  var SYS_MENUS = [
    { key:'home',    icon:'🏠', label:'메인메뉴', url:'home.html' },
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
      '.sys-link.active-home{background:#0f172a;color:#e2e8f0;font-weight:700;cursor:default;border:1px solid #334155;}' +
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
    if (document.head) {
      document.head.appendChild(s);
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        document.head.appendChild(s);
      });
    }
    CSS_INJECTED = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCss);
  } else {
    injectCss();
  }

  // ── SessionManager ─────────────────────────────────────────
  // 브라우저 닫힘 감지 + 1시간 자동 로그아웃
  var SessionManager = (function() {
    var TABS_KEY    = 'kwanbo_tabs';
    var CLOSE_KEY   = 'kwanbo_close_ts';
    var ACTIVE_KEY  = 'kwanbo_last_active';
    var NAV_KEY     = 'kwanbo_nav_ts';     // localStorage 타임스탬프 (2초 이내 = 페이지 이동)
    var NAV_WINDOW  = 3000;               // 3초 이내면 페이지 이동으로 판단
    var TIMEOUT_MS  = 60 * 60 * 1000;     // 1시간
    var WARN_MS     = 55 * 60 * 1000;     // 55분 (5분 전 경고)
    var THROTTLE_MS = 30 * 1000;          // 활동감지 30초 쓰로틀

    var _timer      = null;
    var _lastTouch  = 0;
    var _warnShown  = false;
    var _registered = false;
    var _logoutCb   = null;

    function _getTabId() {
      var id = sessionStorage.getItem('kwanbo_tab_id');
      if (!id) {
        id = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem('kwanbo_tab_id', id);
      }
      return id;
    }
    function _getTabs() {
      try { return JSON.parse(localStorage.getItem(TABS_KEY) || '[]'); } catch(e) { return []; }
    }
    function _addTab() {
      var id = _getTabId(), tabs = _getTabs();
      if (tabs.indexOf(id) === -1) tabs.push(id);
      localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
    }
    function _removeTab() {
      var id = _getTabId();
      var tabs = _getTabs().filter(function(t) { return t !== id; });
      localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
      if (tabs.length === 0) localStorage.setItem(CLOSE_KEY, Date.now().toString());
    }
    function _touch() {
      var now = Date.now();
      if (now - _lastTouch < THROTTLE_MS) return;
      localStorage.setItem(ACTIVE_KEY, now.toString());
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
      ['click','keydown','scroll','touchstart'].forEach(function(ev) {
        document.addEventListener(ev, _touch, { passive: true, capture: true });
      });
      _timer = setInterval(function() {
        if (!localStorage.getItem(SESSION_KEY)) { _stop(); return; }
        var lastActive = parseInt(localStorage.getItem(ACTIVE_KEY) || Date.now());
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
    }

    return {
      // 페이지 로드 초입에 호출 — true: 세션 무효(로그아웃) / false: 유효
      checkOnLoad: function() {
        if (!localStorage.getItem(SESSION_KEY)) return false;

        // 페이지 이동인지 확인 — NAV_KEY가 3초 이내면 같은 탭 내 이동
        var navTs = parseInt(localStorage.getItem(NAV_KEY) || '0');
        var isNav = navTs > 0 && (Date.now() - navTs) < NAV_WINDOW;
        if (isNav) {
          localStorage.removeItem(NAV_KEY);
          _addTab();
          return false;
        }

        // 탭 없음 + 마지막 닫힘이 1초 이상 전 → 브라우저 닫혔던 것
        var tabs = _getTabs();
        var closeTs = parseInt(localStorage.getItem(CLOSE_KEY) || '0');
        if (tabs.length === 0 && closeTs > 0 && (Date.now() - closeTs) > 1000) {
          localStorage.removeItem(SESSION_KEY);
          localStorage.removeItem(CLOSE_KEY);
          localStorage.removeItem(ACTIVE_KEY);
          localStorage.removeItem(NAV_KEY);
          return true;
        }

        // 비활동 1시간 초과
        var lastActive = parseInt(localStorage.getItem(ACTIVE_KEY) || '0');
        if (lastActive > 0 && (Date.now() - lastActive) > TIMEOUT_MS) {
          localStorage.removeItem(SESSION_KEY);
          localStorage.removeItem(ACTIVE_KEY);
          return true;
        }
        return false;
      },

      // 로그인 성공 / SSO 복원 후 호출
      onLogin: function(logoutCb) {
        if (_registered) { _logoutCb = logoutCb; return; }
        _registered = true;
        _addTab();
        _startWatching(logoutCb);
        _touch();
        window.addEventListener('beforeunload', function() {
          localStorage.setItem(NAV_KEY, Date.now().toString()); // 페이지 이동 타임스탬프
          _removeTab();
        });
      },

      // 로그아웃 시 호출
      onLogout: function() {
        _stop();
        _removeTab();
        localStorage.removeItem(ACTIVE_KEY);
        localStorage.removeItem(NAV_KEY);
        var el = document.getElementById('kwanbo-timeout-toast');
        if (el) el.remove();
      }
    };
  })();

  function createComponent(React) {
    if (!React) { console.error('[sysbar] React가 없습니다.'); return null; }
    injectCss();

    return function SysBar(props) {      var cfg        = global.APP_CONFIG || {};
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
          if (m.key === activeKey) {
            var cls = m.key === 'admin' ? 'sys-link active-admin'
                    : m.key === 'home'  ? 'sys-link active-home'
                    : 'sys-link active';
            return e('div', {key:m.key, className:cls}, label);
          }
          if (contractor && m.key !== 'project')
            return e('div', {key:m.key, className:'sys-link disabled', onClick:onDisabled}, label);
          return e('a', {key:m.key, href:m.url, className:'sys-link'}, label);
        });

      var userLabel = user
        ? (user.name + ' 님' + (teamName ? ' ('+teamName+')' : ''))
        : '';

      return e('div', {className:'sys-bar'+(noPrint?' no-print':'')},
        e('a', {key:'home-link', href:cfg.INDEX_URL||'index.html', className:'sys-co', title:'홈페이지'}, '🌐'),
        e('a', {key:'co', href:cfg.HOME_URL||'home.html', className:'sys-co'}, cfg.COMPANY_KO||''),
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
    SessionManager:  SessionManager,
  };

})(window);
