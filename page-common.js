/* ══════════════════════════════════════════════════════════════
   page-common.js — 사업분야 상세페이지 공통 스크립트
   · #site-nav / #site-footer 컨테이너에 NAV·모바일메뉴·FOOTER 를 주입한다.
   · 마크업은 index.html 의 것을 그대로 쓰되 링크만 index.html#앵커 로 바꾼다.
   · 종합정보시스템 버튼은 ERP 모달을 띄우지 않고 index.html 로 이동시킨다.
     (로그인 모달 로직은 index.html 에만 둔다 — 여기에 Supabase 인증을 복제하지 않는다)
   · 순수 vanilla JS. 옵셔널 체이닝(?.) 미사용, 빈 catch 블록 없음.
══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── config 폴백 헬퍼 ────────────────────────────────────── */
  function cfg(key, fallback) {
    if (window.APP_CONFIG && window.APP_CONFIG[key]) return window.APP_CONFIG[key];
    return fallback;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var INDEX = cfg('INDEX_URL', 'index.html');
  var LOGO  = cfg('LOGO_URL', 'logo.png');
  var CO_KO = cfg('COMPANY_KO', '(주)관보종합기술단');
  var CO_EN = cfg('COMPANY_EN', 'KWAN BO ENGINEERING CO., LTD.');

  /* 회사명 앞의 '(주)' 는 index.html 과 동일하게 <em> 으로 강조한다.
     접두어가 없는 회사명이면 그대로 출력한다. */
  function coNameHTML() {
    var m = /^\((주|재|사|유)\)\s*/.exec(CO_KO);
    if (m) return '<em>' + esc(m[0].trim()) + '</em>' + esc(CO_KO.slice(m[0].length));
    return esc(CO_KO);
  }

  /* ── NAV + 모바일 메뉴 마크업 ───────────────────────────── */
  function navHTML() {
    return '' +
      '<nav id="nav">' +
        '<a href="' + esc(INDEX) + '" class="logo">' +
          '<img src="' + esc(LOGO) + '" alt="' + esc(CO_KO) + ' 로고" class="logo-img"/>' +
          '<div class="logo-ko">' + coNameHTML() + '</div>' +
        '</a>' +

        '<div class="nav-center">' +
          '<a href="' + esc(INDEX) + '#about"    class="nav-link">회사소개</a>' +
          '<a href="' + esc(INDEX) + '#services" class="nav-link">사업분야</a>' +
          '<a href="' + esc(INDEX) + '#drone"    class="nav-link">드론측량</a>' +
          '<a href="' + esc(INDEX) + '#projects" class="nav-link">수행실적</a>' +
          '<a href="' + esc(INDEX) + '#contact"  class="nav-link">문의</a>' +
        '</div>' +

        '<div class="nav-right">' +
          '<button class="nav-erp" id="erpBtn">' +
            '<div class="erp-dot"></div>' +
            '종합정보시스템' +
          '</button>' +
          '<a href="' + esc(INDEX) + '#contact" class="nav-contact">문의하기</a>' +
          '<div class="ham" id="hamBtn"><span></span><span></span><span></span></div>' +
        '</div>' +
      '</nav>' +

      '<div id="mob-menu">' +
        '<a href="' + esc(INDEX) + '#about"    class="ml">회사소개</a>' +
        '<a href="' + esc(INDEX) + '#services" class="ml">사업분야</a>' +
        '<a href="' + esc(INDEX) + '#drone"    class="ml">드론측량</a>' +
        '<a href="' + esc(INDEX) + '#projects" class="ml">수행실적</a>' +
        '<a href="' + esc(INDEX) + '#contact"  class="ml">문의</a>' +
        '<button class="ml" id="mobErpBtn">종합정보시스템</button>' +
      '</div>';
  }

  /* ── FOOTER 마크업 ──────────────────────────────────────── */
  function footerHTML() {
    var addr = cfg('ADDRESS', '부산광역시 연제구 거제대로 270, 301호 (거제동, 종근당빌딩)');
    var tel  = cfg('TEL', '051) 853-2633');
    var fax  = cfg('FAX', '051) 853-4893');
    var mail = cfg('EMAIL_DESIGN', 'kwanboeng@naver.com');
    var year = cfg('COPYRIGHT_YEAR', '2025');

    return '' +
      '<footer>' +
        '<div class="footer-in">' +
          '<div class="footer-top">' +
            '<div>' +
              '<div class="footer-logo-wrap">' +
                '<img src="' + esc(LOGO) + '" alt="' + esc(CO_KO) + ' 로고" class="footer-logo-img"/>' +
                '<div class="footer-ko">' + coNameHTML() + '</div>' +
              '</div>' +
              '<div class="footer-en">' + esc(CO_EN) + '</div>' +
              '<div class="footer-addr">' +
                esc(addr) + '<br/>' +
                'T. ' + esc(tel) + ' &nbsp;|&nbsp; F. ' + esc(fax) + ' &nbsp;|&nbsp; ' + esc(mail) +
              '</div>' +
            '</div>' +
            '<div class="footer-nav">' +
              '<a href="' + esc(INDEX) + '#about">회사소개</a>' +
              '<a href="' + esc(INDEX) + '#services">사업분야</a>' +
              '<a href="' + esc(INDEX) + '#drone">드론측량</a>' +
              '<a href="' + esc(INDEX) + '#projects">수행실적</a>' +
              '<a href="' + esc(INDEX) + '#certs">인증현황</a>' +
              '<a href="' + esc(INDEX) + '#contact">오시는 길</a>' +
            '</div>' +
          '</div>' +
          '<div class="footer-btm">' +
            '<span class="footer-copy">&copy; ' + esc(year) + ' ' + esc(CO_KO) + '. All rights reserved.</span>' +
            '<button class="footer-erp-link" id="footerErpBtn">' +
              '<div class="footer-erp-dot"></div>' +
              '종합정보시스템 임직원 로그인' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</footer>';
  }

  /* ── 인터랙션 ───────────────────────────────────────────── */

  /* 종합정보시스템 — 상세페이지에서는 모달 대신 index.html 로 이동 */
  function goIndex() {
    window.location.href = INDEX;
  }

  function bindNav() {
    var nav = document.getElementById('nav');
    if (nav) {
      var onScroll = function () {
        nav.classList.toggle('scrolled', window.scrollY > 40);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    var ham = document.getElementById('hamBtn');
    var mob = document.getElementById('mob-menu');
    if (ham && mob) {
      ham.addEventListener('click', function () { mob.classList.toggle('open'); });
    }
    if (mob) {
      var mls = document.querySelectorAll('.ml');
      for (var i = 0; i < mls.length; i++) {
        mls[i].addEventListener('click', function () { mob.classList.remove('open'); });
      }
    }

    var erpBtn = document.getElementById('erpBtn');
    if (erpBtn) erpBtn.addEventListener('click', goIndex);

    var mobErpBtn = document.getElementById('mobErpBtn');
    if (mobErpBtn) mobErpBtn.addEventListener('click', goIndex);
  }

  function bindFooter() {
    var footerErpBtn = document.getElementById('footerErpBtn');
    if (footerErpBtn) footerErpBtn.addEventListener('click', goIndex);
  }

  /* 스크롤 리빌 — index.html 과 동일 */
  function bindReveal() {
    var els = document.querySelectorAll('.sr');
    if (!window.IntersectionObserver) {
      for (var j = 0; j < els.length; j++) els[j].classList.add('on');
      return;
    }
    var obs = new window.IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('on');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: .12 });
    for (var k = 0; k < els.length; k++) obs.observe(els[k]);
  }

  /* ── 부팅 ───────────────────────────────────────────────── */
  function boot() {
    var navSlot = document.getElementById('site-nav');
    if (navSlot) {
      navSlot.innerHTML = navHTML();
      bindNav();
    }

    var footSlot = document.getElementById('site-footer');
    if (footSlot) {
      footSlot.innerHTML = footerHTML();
      bindFooter();
    }

    bindReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
