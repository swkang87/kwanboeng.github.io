/*
 * sw.js — 휴대폰 앱(PWA) 서비스워커 (2026-11-16, v2.11.0)
 *
 * 등록은 sysbar.js 한 곳(Sysbar.Pwa)에서만 — 주소 sw.js?v=<APP_VERSION>. 버전이 바뀌면 주소가 바뀌어 새 서비스워커로 바로 교체된다.
 * 홈페이지(index.html)·서비스 소개 페이지는 등록하지 않는다(이 파일이 그 요청을 받아도 손대지 않고 그대로 보낸다).
 *
 * 원칙 = 앱 모양 유지용. 데이터는 휴대폰에 저장하지 않는다.
 *   · 시스템 화면 HTML(아래 SHELL_PAGES) · sysbar.js · config.js = 네트워크 우선. 실패하면 마지막 사본, 그것도 없으면 offline.html
 *   · Supabase(다른 주소) · 로그인 · 급여(payslip.html · payslip-render.js · admin-payroll.html · 급여 서버 함수) = 저장하지 않음
 *     (급여 화면은 연결이 끊겼을 때 오프라인 안내만 보인다 — 사본 없음)
 *   · 준공사진(tools/jungong — Pyodide)·홈페이지·서비스 소개·desktop/ = 관여하지 않음(브라우저 캐시 그대로)
 *   · 앱 아이콘(manifest 의 icons) · offline.html = 설치할 때 미리 저장
 * 비상 스위치: config.js PWA.SW_ENABLED = false 로 배포하면 화면(sysbar.js)과 이 파일 둘 다 해제·삭제를 한다.
 * 회사 값 없음 — 이름·색·아이콘 경로는 manifest·config.js 에서 읽는다.
 */
'use strict';

var REV = 1;                                   // 저장 구조가 바뀔 때만 올린다(올리면 예전 저장분을 지운다)
var CACHE = 'sys-shell-r' + REV;
var CACHE_PREFIX = 'sys-shell-';
var BASE = new URL('./', self.location.href);  // 등록 범위(저장소 루트)
var VERSION = new URL(self.location.href).searchParams.get('v') || '';

var SHELL_PAGES = [
  'home.html', 'project.html', 'leave.html', 'worklog.html', 'me.html', 'docs.html', 'guest.html', 'import_weekly.html',
  'admin-portal.html', 'admin-worklog.html', 'admin-perf.html', 'admin-account.html', 'admin-staff.html',
  'admin-system.html', 'admin-docs.html'
];
var SHELL_FILES = ['sysbar.js', 'config.js'];
var NO_STORE_PAGES = ['payslip.html', 'admin-payroll.html'];   // 급여 — 사본을 만들지 않는다(끊기면 안내 화면만)
var OFFLINE = 'offline.html';
var MANIFEST = 'manifest.webmanifest';
var KILL_RE = /SW_ENABLED\s*:\s*false/;

function rel(url) {
  var u = new URL(url);
  if (u.origin !== BASE.origin || u.pathname.indexOf(BASE.pathname) !== 0) return null;
  return u.pathname.slice(BASE.pathname.length);
}
function abs(r) { return new URL(r, BASE).href; }

// 설치: offline.html · config.js · manifest 와 그 아이콘을 미리 저장
self.addEventListener('install', function(ev) {
  ev.waitUntil(caches.open(CACHE).then(function(c) {
    return c.addAll([OFFLINE, MANIFEST, 'config.js'].map(abs)).then(function() {
      return c.match(abs(MANIFEST)).then(function(r) { return r ? r.json() : null; });
    }).then(function(m) {
      var icons = (m && m.icons) || [];
      return Promise.all(icons.map(function(i) { return c.add(abs(i.src)).catch(function() {}); }));
    });
  }).then(function() { return self.skipWaiting(); }));
});

self.addEventListener('activate', function(ev) {
  ev.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE; })
      .map(function(k) { return caches.delete(k); }));
  }).then(function() {
    // 미리 받기(navigation preload)는 켜지 않는다 — 켜면 관여하지 않는 홈페이지 이동도 두 번 받는다
    if (self.registration.navigationPreload) return self.registration.navigationPreload.disable().catch(function() {});
  }).then(function() { return self.clients.claim(); }));
});

// 비상 스위치 — 저장분을 모두 지우고 등록을 푼다(열려 있는 화면은 다음 이동부터 서비스워커 없이)
function selfDestruct() {
  return caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k.indexOf(CACHE_PREFIX) === 0; }).map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.registration.unregister(); }).catch(function() {});
}

function offlinePage() {
  return caches.match(abs(OFFLINE)).then(function(r) {
    return r || new Response('<meta charset="utf-8"><p>인터넷 연결을 확인해 주세요.</p>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  });
}

// 네트워크 우선 + 성공하면 사본 갱신(주소 인자 ?v= 는 빼고 파일 이름 하나로 저장)
function networkFirst(ev, key, isNav) {
  var req = ev.request;
  return fetch(req).then(function(res) {
    if (res && res.ok && res.type === 'basic') {
      var copy = res.clone();
      var save = caches.open(CACHE).then(function(c) { return c.put(abs(key), copy.clone()); });
      if (key === 'config.js') {
        save = save.then(function() { return copy.text(); }).then(function(t) { if (KILL_RE.test(t)) return selfDestruct(); });
      }
      ev.waitUntil(save.catch(function() {}));
    }
    return res;
  }, function() {
    return caches.match(abs(key)).then(function(r) {
      if (r) return r;
      return isNav ? offlinePage() : Response.error();
    });
  });
}

self.addEventListener('fetch', function(ev) {
  var req = ev.request;
  if (req.method !== 'GET') return;
  var r = rel(req.url);
  if (r === null) return;                                   // 다른 주소(Supabase · CDN) — 그대로
  if (req.mode === 'navigate') {
    if (SHELL_PAGES.indexOf(r) >= 0) { ev.respondWith(networkFirst(ev, r, true)); return; }
    if (NO_STORE_PAGES.indexOf(r) >= 0) {                   // 급여 — 저장 없이, 끊기면 안내만
      ev.respondWith(fetch(req).catch(offlinePage));
      return;
    }
    return;                                                 // 홈페이지 · 소개 페이지 · desktop/ 등 — 그대로
  }
  if (SHELL_FILES.indexOf(r) >= 0) { ev.respondWith(networkFirst(ev, r, false)); return; }
  if (r === OFFLINE || r === MANIFEST || r.indexOf('assets/pwa/') === 0) {
    ev.respondWith(caches.match(abs(r)).then(function(c) { return c || fetch(req); }));
  }
});

self.addEventListener('message', function(ev) {
  var d = ev.data || {};
  if (d.type === 'sys-kill') ev.waitUntil(selfDestruct());
  if (d.type === 'sys-version' && ev.source) ev.source.postMessage({ type: 'sys-version', version: VERSION, rev: REV });
});

// ── 웹 푸시(연차 결재 요청) — 내용은 Edge Function(leave-push)이 만든다: 제목 · 이름 · 종류 · 날짜(사유 없음) ──
function manifestIcon() {
  return caches.match(abs(MANIFEST)).then(function(r) { return r ? r.json() : null; }).then(function(m) {
    var i = m && m.icons && m.icons[0];
    return i ? abs(i.src) : undefined;
  }).catch(function() { return undefined; });
}
function setBadge(n) {
  try {
    if (typeof n !== 'number' || !self.navigator || !self.navigator.setAppBadge) return Promise.resolve();
    return (n > 0 ? self.navigator.setAppBadge(n) : self.navigator.clearAppBadge()).catch(function() {});
  } catch (e) { return Promise.resolve(); }
}

self.addEventListener('push', function(ev) {
  var d = {};
  try { d = ev.data ? ev.data.json() : {}; } catch (e) { d = { body: ev.data ? ev.data.text() : '' }; }
  ev.waitUntil(manifestIcon().then(function(icon) {
    return Promise.all([
      self.registration.showNotification(d.title || '알림', {
        body: d.body || '',
        tag: d.tag || 'sys-push',
        renotify: true,
        icon: icon,
        lang: 'ko',
        data: { url: d.url || 'leave.html' }
      }),
      setBadge(d.badge)
    ]);
  }));
});

// 알림을 누르면: 같은 화면이 열려 있으면 그 창으로(새로 읽게 함), 다른 화면만 있으면 그 창을 결재 화면으로, 없으면 새 창
self.addEventListener('notificationclick', function(ev) {
  ev.notification.close();
  var url = abs((ev.notification.data && ev.notification.data.url) || 'leave.html');
  var path = new URL(url).pathname;
  ev.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
    var same = null, any = null;
    list.forEach(function(c) {
      if (rel(c.url) === null) return;
      if (!any) any = c;
      if (!same && new URL(c.url).pathname === path) same = c;
    });
    if (same) {
      return same.focus().then(function(c) { (c || same).postMessage({ type: 'sys-open', url: url }); });
    }
    if (any) {
      return any.focus().then(function(c) {
        var w = c || any;
        if (w.navigate) return w.navigate(url).catch(function() { return self.clients.openWindow(url); });
        return self.clients.openWindow(url);
      });
    }
    return self.clients.openWindow(url);
  }));
});
