(function () {
  'use strict';

  var STORAGE_KEY = 'phoenix_post_login_channel';
  var cfg = window.phoenixPublicConfig || { defaultAccountId: '1' };

  function hasSessionCookie() {
    return document.cookie.split(';').some(function (c) {
      return c.trim().indexOf('cw_d_session_info=') === 0;
    });
  }

  function channelAppUrl(channel) {
    return (
      '/app/accounts/' +
      encodeURIComponent(cfg.defaultAccountId) +
      '/settings/inboxes/new/' +
      encodeURIComponent(channel)
    );
  }

  function maybeRedirectAfterLogin() {
    var path = window.location.pathname;
    var dashboardMatch = path.match(/\/app\/accounts\/(\d+)\/dashboard/);
    if (!dashboardMatch) return;

    var params = new URLSearchParams(window.location.search);
    var returnTo = params.get('return_to');
    if (returnTo && returnTo.charAt(0) === '/') {
      window.location.replace(returnTo);
      return;
    }

    var channel = sessionStorage.getItem(STORAGE_KEY);
    if (!channel) return;

    sessionStorage.removeItem(STORAGE_KEY);
    window.location.replace(channelAppUrl(channel));
  }

  function initHeaderScroll() {
    var header = document.querySelector('.phoenix-header--premium');
    if (!header) return;

    var onScroll = function () {
      header.classList.toggle('phoenix-header--scrolled', window.scrollY > 24);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initChatDemoLoop() {
    var chat = document.querySelector('[data-phoenix-chat-demo]');
    if (!chat || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var lastBubble = chat.querySelector('.phoenix-chat-bubble:last-child');
    if (!lastBubble) return;

    chat.addEventListener('animationend', function restart(e) {
      if (e.target !== lastBubble) return;

      setTimeout(function () {
        chat.querySelectorAll('.phoenix-chat-bubble').forEach(function (el) {
          el.style.animation = 'none';
          el.offsetHeight;
          el.style.animation = '';
        });
      }, 4000);
    });
  }

  function initMatrixRain() {
    var canvas = document.querySelector('.phoenix-matrix-canvas');
    if (!canvas) return;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    var chars =
      'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾇﾈﾉﾊﾋﾌﾍﾎﾏ0123456789ＡＢＣＤＥＦ<>{}[];//const let';
    var width = 0;
    var height = 0;
    var dpr = 1;
    var colWidth = 14;
    var colCount = 0;
    var drops = [];
    var frameId = 0;

    function draw() {
      if (reduced || !ctx) return;

      ctx.fillStyle = 'rgba(2, 8, 6, 0.09)';
      ctx.fillRect(0, 0, width, height);
      ctx.font =
        '14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

      for (var i = 0; i < colCount; i++) {
        var x = colWidth * i;
        var pos = drops[i] * colWidth;
        var y = ((pos % (height + 56)) + (height + 56)) % (height + 56) - 28;
        var ch = chars[(Math.random() * chars.length) | 0];
        var bright = ((pos % height) + height) % height < 42;

        ctx.fillStyle = bright
          ? 'rgba(200, 255, 220, 0.9)'
          : 'rgba(0, 255, 90, 0.5)';
        ctx.fillText(ch, x, y);

        if (y > height + 28 && Math.random() > 0.978) {
          drops[i] = 0;
        }
        drops[i] = (drops[i] || 0) + 0.48 + 0.32 * Math.random();
      }

      frameId = requestAnimationFrame(draw);
    }

    function resize() {
      cancelAnimationFrame(frameId);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      colCount = Math.ceil(width / colWidth);
      drops = [];
      for (var i = 0; i < colCount; i++) {
        drops[i] = -80 * Math.random();
      }

      if (reduced) {
        canvas.classList.add('phoenix-matrix-canvas--static');
        return;
      }

      canvas.classList.remove('phoenix-matrix-canvas--static');
      frameId = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });
  }

  document.addEventListener('DOMContentLoaded', function () {
    maybeRedirectAfterLogin();
    initHeaderScroll();
    initChatDemoLoop();
    initMatrixRain();
  });
})();
