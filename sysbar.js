/**
 * SYSBAR MODULE v2.4
 * 모든 페이지 공통: 상단 네비바 CSS + React 컴포넌트
 *
 * v2.4 변경사항 (Bundle E — 보안 강화):
 *  - Auth.checkBruteForce / recordFailure / clearFailures 추가
 *    → 5회 실패 시 30초 잠금 (localStorage 기반)
 *  - doLogin: select 컬럼 명시 (password 포함하되 safeUser에서 제거)
 *  - doLogin: 역할 차단 + 비밀번호 검증 순서 조정 (타이밍 공격 방지)
 *  - createLoginComponent: 잠금 카운트다운 UI 추가
 *
 * v2.3 변경사항:
 *  - Auth 모듈 추가: hashPassword / verifyPassword / isPlainPassword / doLogin
 *  - createLoginComponent(): 공통 로그인 화면 컴포넌트 반환
 *  - 각 HTML 파일의 개별 LoginScreen / 해시 함수 제거 → 이 파일로 일원화
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
  // 1시간 비활동 자동 로그아웃 + 브라우저/컴퓨터 재시작 후 만료 체크
  var SessionManager = (function() {
    var ACTIVE_KEY  = 'kwanbo_last_active';  // 마지막 활동 시각
    var LOGIN_KEY   = 'kwanbo_login_ts';     // 로그인 시각 (세션 생성 시 기록)
    var ORIGIN_KEY  = 'kwanbo_browser_origin'; // 브라우저 기동 시각 (performance.timeOrigin, sessionStorage)
    var TIMEOUT_MS  = 60 * 60 * 1000;       // 1시간 비활동 시 로그아웃
    var WARN_MS     = 55 * 60 * 1000;       // 55분 경과 시 경고
    var THROTTLE_MS = 30 * 1000;            // 활동감지 30초 쓰로틀

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
        if (!localStorage.getItem(SESSION_KEY)) { _stop(); return; }
        var lastActive = parseInt(localStorage.getItem(ACTIVE_KEY) || '0');
        if (lastActive === 0) return; // 아직 _touch 미실행 시 무시
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
      // 마지막 활동 시각 기준으로 1시간 초과 여부 확인
      // ACTIVE_KEY 없으면 LOGIN_KEY 기준으로 체크 (첫 페이지 진입 등)
      var lastActive = parseInt(localStorage.getItem(ACTIVE_KEY) || '0');
      var loginTs    = parseInt(localStorage.getItem(LOGIN_KEY)  || '0');
      var base = lastActive > 0 ? lastActive : loginTs;
      if (base === 0) return false; // 기준값 없으면 만료 아님
      return (Date.now() - base) > TIMEOUT_MS;
    }

    return {
      // 페이지 로드 시 호출 — true: 만료(로그아웃) / false: 유효
      checkOnLoad: function() {
        if (!localStorage.getItem(SESSION_KEY)) return false;

        // performance.timeOrigin = 브라우저 프로세스 기동 시각(ms)
        // 저장값과 현재값이 같으면 → 같은 브라우저 세션(탭 이동) → 만료 체크 스킵
        // 다르거나 없으면 → 브라우저 재시작 (Chrome 세션복원도 여기서 걸림) → 만료 체크
        var storedOrigin  = sessionStorage.getItem(ORIGIN_KEY);
        var currentOrigin = String(Math.round(performance.timeOrigin));
        if (storedOrigin && storedOrigin === currentOrigin) return false;

        // 브라우저가 새로 시작된 것 → 1시간 초과 여부 체크
        if (_isExpired()) {
          localStorage.removeItem(SESSION_KEY);
          localStorage.removeItem(ACTIVE_KEY);
          localStorage.removeItem(LOGIN_KEY);
          return true; // 만료 → 로그아웃
        }

        return false;
      },

      // 로그인 성공 / SSO 복원 후 호출
      onLogin: function(logoutCb) {
        if (_registered) { _logoutCb = logoutCb; return; }
        _registered = true;

        // 로그인 시각 기록 (ACTIVE_KEY 없을 때 기준값으로 사용)
        if (!localStorage.getItem(LOGIN_KEY)) {
          localStorage.setItem(LOGIN_KEY, Date.now().toString());
        }

        // 브라우저 기동 시각을 sessionStorage에 기록 (재시작 감지용)
        sessionStorage.setItem(ORIGIN_KEY, String(Math.round(performance.timeOrigin)));

        _startWatching(logoutCb);
        _touch(); // 즉시 활동 시각 기록
      },

      // 로그아웃 시 호출
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
  // PBKDF2 + SHA-256, 100k iterations, Web Crypto API
  var Auth = (function() {

    // ── 브루트포스 방어 ──────────────────────────────────────
    // 5회 실패 시 30초 잠금 (localStorage 기반, 페이지 이동해도 유지)
    var BF_KEY      = 'kwanbo_login_fail';
    var BF_MAX      = 5;       // 최대 실패 횟수
    var BF_LOCK_MS  = 30000;   // 잠금 시간 30초

    function _bfGet() {
      try { return JSON.parse(localStorage.getItem(BF_KEY) || 'null') || { count: 0, lockedAt: 0 }; }
      catch(e) { return { count: 0, lockedAt: 0 }; }
    }
    function _bfSet(v) { localStorage.setItem(BF_KEY, JSON.stringify(v)); }

    /**
     * checkBruteForce()
     * 잠금 상태면 → { locked: true, remainSec: N }
     * 정상이면   → { locked: false }
     */
    function checkBruteForce() {
      var s = _bfGet();
      if (s.lockedAt) {
        var elapsed = Date.now() - s.lockedAt;
        if (elapsed < BF_LOCK_MS) {
          return { locked: true, remainSec: Math.ceil((BF_LOCK_MS - elapsed) / 1000) };
        }
        // 잠금 해제: 카운트 리셋
        _bfSet({ count: 0, lockedAt: 0 });
      }
      return { locked: false };
    }

    /** 로그인 실패 시 호출 */
    function recordFailure() {
      var s = _bfGet();
      s.count = (s.count || 0) + 1;
      if (s.count >= BF_MAX) { s.lockedAt = Date.now(); }
      _bfSet(s);
    }

    /** 로그인 성공 시 호출 */
    function clearFailures() {
      localStorage.removeItem(BF_KEY);
    }

    async function hashPassword(plain) {
      var salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
      var enc  = new TextEncoder();
      var km   = await crypto.subtle.importKey('raw', enc.encode(plain), {name:'PBKDF2'}, false, ['deriveBits']);
      var bits = await crypto.subtle.deriveBits({name:'PBKDF2', salt:enc.encode(salt), iterations:100000, hash:'SHA-256'}, km, 256);
      var hash = Array.from(new Uint8Array(bits)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
      return 'pbkdf2$' + salt + '$' + hash;
    }

    async function verifyPassword(plain, stored) {
      if (!stored || plain == null) return false;
      if (!String(stored).startsWith('pbkdf2$')) return plain === stored; // 평문 호환 (lazy migration)
      var parts = stored.split('$');
      if (parts.length !== 3) return false;
      var salt = parts[1];
      var enc  = new TextEncoder();
      var km   = await crypto.subtle.importKey('raw', enc.encode(plain), {name:'PBKDF2'}, false, ['deriveBits']);
      var bits = await crypto.subtle.deriveBits({name:'PBKDF2', salt:enc.encode(salt), iterations:100000, hash:'SHA-256'}, km, 256);
      var hash = Array.from(new Uint8Array(bits)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
      return stored === 'pbkdf2$' + salt + '$' + hash;
    }

    function isPlainPassword(stored) {
      return stored && !String(stored).startsWith('pbkdf2$');
    }

    /**
     * getSession()
     * localStorage에서 세션 복원. 없거나 형식 불량이면 null 반환.
     */
    function getSession() {
      try {
        var raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        var v = JSON.parse(raw);
        if (v && v.id && v.role) {
          // 혹시 password가 남아있으면 제거
          if (v.password) { delete v.password; localStorage.setItem(SESSION_KEY, JSON.stringify(v)); }
          return v;
        }
        return null;
      } catch(e) { return null; }
    }

    /**
     * clearSession()
     * 세션 및 관련 키 전체 제거
     */
    function clearSession() {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem('kwanbo_pm_user');
      sessionStorage.removeItem('kwanbo_uid');
    }

    /**
     * doLoginFetch(sbUrl, sbKey, phone, pw, opts)
     * Supabase JS SDK 없이 raw fetch로 동작하는 로그인 (leave.html 등 SDK 미사용 페이지용)
     * opts.blockedRoles / allowedRoles / extraHeaders 지원
     *  - 성공 시 → { ok:true,  user: safeUser }
     *  - 실패 시 → { ok:false, reason: '...', locked?: true, remainSec?: N }
     */
    async function doLoginFetch(sbUrl, sbKey, phone, pw, opts) {
      opts = opts || {};
      var blocked = opts.blockedRoles || ['contractor'];

      // ── 브루트포스 잠금 체크 ──────────────────────────────
      var bf = checkBruteForce();
      if (bf.locked) {
        return { ok: false, locked: true, remainSec: bf.remainSec,
          reason: '로그인 시도가 너무 많습니다. ' + bf.remainSec + '초 후 다시 시도하세요.' };
      }

      try {
        var phoneRaw    = String(phone).trim();
        var phoneDigits = phoneRaw.replace(/\D/g, "");
        var headers = { 'apikey': sbKey, 'Authorization': 'Bearer ' + sbKey };
        var cols = 'id,name,phone,email,position,team_id,role,join_date,total_days,used_days,password';
        var user = null;
        var queries = phoneDigits !== phoneRaw ? [phoneRaw, phoneDigits] : [phoneRaw];
        for (var qi = 0; qi < queries.length; qi++) {
          var res = await fetch(
            sbUrl + '/users?phone=eq.' + encodeURIComponent(queries[qi]) + '&select=' + cols + '&limit=1',
            { headers: headers }
          );
          var rows = res.ok ? await res.json() : [];
          if (rows[0]) { user = rows[0]; break; }
        }

        if (!user) {
          recordFailure();
          return { ok: false, reason: '아이디 또는 비밀번호가 올바르지 않습니다.' };
        }

        // 역할 차단/허용 체크 + 비밀번호 검증 (항상 둘 다 실행 — 타이밍 공격 방지)
        var roleBlocked    = blocked.indexOf(user.role) !== -1;
        var roleNotAllowed = opts.allowedRoles && opts.allowedRoles.indexOf(user.role) === -1;
        var storedPw = user.password;
        var pwOk = await verifyPassword(pw, storedPw);

        // password는 검증 직후 메모리에서 제거
        delete user.password;

        if (roleBlocked || roleNotAllowed) {
          return { ok: false, reason: '이 시스템에 대한 접근 권한이 없습니다.' };
        }

        if (!pwOk) {
          recordFailure();
          var bfAfter = checkBruteForce();
          if (bfAfter.locked) {
            return { ok: false, locked: true, remainSec: bfAfter.remainSec,
              reason: '로그인 시도가 너무 많습니다. ' + bfAfter.remainSec + '초 후 다시 시도하세요.' };
          }
          return { ok: false, reason: '아이디 또는 비밀번호가 올바르지 않습니다.' };
        }

        // 로그인 성공 — 실패 카운트 초기화
        clearFailures();

        // Lazy migration: 평문이면 해시로 업그레이드
        if (isPlainPassword(storedPw)) {
          try {
            var hashed = await hashPassword(pw);
            var patchHeaders = Object.assign({}, headers, {
              'Content-Type': 'application/json',
              'x-user-id': String(user.id),
              'x-user-role': user.role,
            });
            await fetch(sbUrl + '/users?id=eq.' + user.id, {
              method: 'PATCH', headers: patchHeaders,
              body: JSON.stringify({ password: hashed })
            });
          } catch(e) {}
        }

        // 세션 저장 (password 이미 제거됨)
        var safeUser = Object.assign({}, user);
        localStorage.setItem(SESSION_KEY, JSON.stringify(safeUser));
        localStorage.removeItem('kwanbo_pm_user');
        sessionStorage.removeItem('kwanbo_uid');

        return { ok: true, user: safeUser };

      } catch(e) {
        return { ok: false, reason: '서버 오류가 발생했습니다.' };
      }
    }

    return {
      hashPassword:      hashPassword,
      verifyPassword:    verifyPassword,
      isPlainPassword:   isPlainPassword,
      doLoginFetch:      doLoginFetch,
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
   *  options.subtitle  : 로그인 박스 부제목 (기본: '통합 관리 시스템')
   *  options.blockedRoles / allowedRoles: doLogin 에 그대로 전달
   *
   * 반환: LoginScreen 컴포넌트
   *  props.supabaseClient : Supabase 클라이언트 (필수)
   *  props.onLogin(user)  : 로그인 성공 콜백 (필수)
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

      var useState = React.useState;
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

      // 잠금 상태 카운트다운
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
        var _cfg = window.APP_CONFIG || cfg;
        Auth.doLoginFetch((_cfg.SUPABASE_URL||'') + '/rest/v1', _cfg.SUPABASE_KEY||'', phone, pw, {
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

      var onKey = function(e) { if (e.key === 'Enter') login(); };

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
            locked ? ('잠금 ' + remain + '초') : (loading ? '로그인 중...' : '로그인')
          )
        )
      );
    };
  }

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
    createComponent:      createComponent,
    createLoginComponent: createLoginComponent,
    SessionManager:       SessionManager,
    Auth:                 Auth,
  };

})(window);
