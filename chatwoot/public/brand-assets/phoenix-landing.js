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
    var channel = sessionStorage.getItem(STORAGE_KEY);
    if (!channel) return;

    var path = window.location.pathname;
    var dashboardMatch = path.match(/\/app\/accounts\/(\d+)\/dashboard/);
    if (!dashboardMatch) return;

    sessionStorage.removeItem(STORAGE_KEY);
    window.location.replace(channelAppUrl(channel));
  }

  document.addEventListener('DOMContentLoaded', function () {
    maybeRedirectAfterLogin();
  });
})();
