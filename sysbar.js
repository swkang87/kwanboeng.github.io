/**
 * SYSBAR MODULE v3.0
 * 모든 페이지 공통: 상단 네비바 CSS + React 컴포넌트
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
      '@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css");' +
      'body,button,input,select,textarea{font-family:\'Pretendard\',\'Noto Sans KR\',sans-serif!important;}' +
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
      '}' +
      '@media print{.no-print{display:none!important;}}';
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
    var ACTIVE_KEY  = 'kwanbo_last_active';
    var LOGIN_KEY   = 'kwanbo_login_ts';
    var ORIGIN_KEY  = 'kwanbo_browser_origin';
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
      ['click', 'keydown', 'scroll', 'touchstart'].forEach(function(ev) {
        document.addEventListener(ev, _touch, { passive: true, capture: true });
      });
      _timer = setInterval(function() {
        var lastActive = parseInt(localStorage.getItem(ACTIVE_KEY) || '0');
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
      var lastActive = parseInt(localStorage.getItem(ACTIVE_KEY) || '0');
      var loginTs    = parseInt(localStorage.getItem(LOGIN_KEY)  || '0');
      var base = lastActive > 0 ? lastActive : loginTs;
      if (base === 0) return false;
      return (Date.now() - base) > TIMEOUT_MS;
    }

    return {
      checkOnLoad: function() {
        if (!localStorage.getItem(SESSION_KEY)) return false;
        // localStorage 기반 세션 → 탭·페이지 이동 시에도 유지
        // 만료 여부만 체크
        if (_isExpired()) {
          localStorage.removeItem(SESSION_KEY);
          localStorage.removeItem(ACTIVE_KEY);
          localStorage.removeItem(LOGIN_KEY);
          sessionStorage.removeItem(ORIGIN_KEY);
          return true;  // 만료 → 로그인 필요
        }
        return false;   // 유효 → 세션 유지
      },

      onLogin: function(logoutCb) {
        if (_registered) { _logoutCb = logoutCb; return; }
        _registered = true;
        if (!localStorage.getItem(LOGIN_KEY)) {
          localStorage.setItem(LOGIN_KEY, Date.now().toString());
        }
        sessionStorage.setItem(ORIGIN_KEY, String(Math.round(performance.timeOrigin)));
        _startWatching(logoutCb);
        _touch();
      },

      onLogout: function() {
        _stop();
        localStorage.removeItem(ACTIVE_KEY);
        localStorage.removeItem(LOGIN_KEY);
        sessionStorage.removeItem(ORIGIN_KEY);
        var el = document.getElementById('kwanbo-timeout-toast');
        if (el) el.remove();
      }
    };
  })();

  // ── Auth 모듈 ───────────────────────────────────────────────
  var Auth = (function() {

    // ── 브루트포스 방어 ──────────────────────────────────────
    var BF_KEY     = 'kwanbo_login_fail';
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
        var raw = localStorage.getItem(SESSION_KEY);
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
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem('kwanbo_uid');
    }

    /**
     * doLogin(sbClient, phone, pw, opts)
     * Supabase Auth signInWithPassword 기반 로그인
     *  - email: 전화번호@kwanbo.internal
     *  - 성공 시 users 테이블에서 프로필 조회 후 sessionStorage 저장
     *  - opts.blockedRoles / allowedRoles 지원
     */
    async function doLogin(sbClient, phone, pw, opts) {
      opts = opts || {};
      var blocked = opts.blockedRoles || ['contractor'];

      // 브루트포스 잠금 체크
      var bf = checkBruteForce();
      if (bf.locked) {
        return { ok: false, locked: true, remainSec: bf.remainSec,
          reason: '로그인 시도가 너무 많습니다. ' + Math.ceil(bf.remainSec / 60) + '분 후 다시 시도하세요.' };
      }

      try {
        var phoneRaw    = String(phone).trim();
        var phoneDigits = phoneRaw.replace(/\D/g, '');
        var emailLocal  = phoneDigits.length > 0 ? phoneDigits : phoneRaw;
        var email = emailLocal + '@kwanbo.internal';

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

        // Auth 성공 → users 테이블에서 프로필 조회
        var profileRes = await sbClient
          .from('users')
          .select('id,name,phone,email,position,team_id,role,join_date,total_days,used_days')
          .eq('auth_id', authRes.data.user.id)
          .single();

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

        // 로그인 성공
        clearFailures();
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        sessionStorage.removeItem('kwanbo_uid');

        return { ok: true, user: user };

      } catch(e) {
        return { ok: false, reason: '서버 오류가 발생했습니다.' };
      }
    }

    return {
      doLogin:           doLogin,
      getSession:        getSession,
      clearSession:      clearSession,
      checkBruteForce:   checkBruteForce,
      recordFailure:     recordFailure,
      clearFailures:     clearFailures,
    };
  })();

  // ── 로그인 CSS 주입 ─────────────────────────────────────────
  var LOGIN_CSS_INJECTED = false;
  function injectLoginCss() {
    if (LOGIN_CSS_INJECTED || document.getElementById('sysbar-login-css')) { LOGIN_CSS_INJECTED = true; return; }
    var s = document.createElement('style');
    s.id = 'sysbar-login-css';
    s.textContent =
      '.sb-lwrap{min-height:100vh;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);display:flex;align-items:center;justify-content:center;padding:16px;font-family:\'Pretendard\',\'Noto Sans KR\',sans-serif;}' +
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
        if (!phone.trim() || !pw) { setErr('전화번호와 비밀번호를 입력하세요.'); return; }
        setLoading(true); setErr('');
        Auth.doLogin(sb, phone, pw, {
          blockedRoles: options.blockedRoles,
          allowedRoles: options.allowedRoles,
        }).then(function(result) {
          setLoading(false);
          if (result.ok) { onLogin(result.user); }
          else {
            if (result.locked) { setLocked(true); setRemain(result.remainSec); }
            setErr(result.reason);
          }
        });
      };

      var onKey = function(ev) { if (ev.key === 'Enter') login(); };

      return e('div', { className: 'sb-lwrap' },
        e('div', { className: 'sb-lbox' },
          e('div', { className: 'sb-lco'  }, cfg.COMPANY_SHORT || cfg.COMPANY_KO || ''),
          e('div', { className: 'sb-lsub' }, subtitle),
          err ? e('div', { className: 'sb-lerr' }, err) : null,
          e('div', { style: { marginBottom: 12 } },
            e('label', { className: 'sb-lfl' }, '전화번호'),
            e('input', { className:'sb-lfi', type:'text', placeholder:'전화번호', value:phone,
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
    createComponent:      createComponent,
    createLoginComponent: createLoginComponent,
    SessionManager:       SessionManager,
    Auth:                 Auth,
  };

})(window);
