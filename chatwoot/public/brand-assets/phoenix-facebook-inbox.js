(function () {
  'use strict';

  var cfg = window.phoenixPublicConfig || { defaultAccountId: '1' };

  function isFacebookInboxWizard() {
    return /\/settings\/inboxes\/new\/facebook/.test(window.location.pathname);
  }

  function injectAdminHint() {
    if (!isFacebookInboxWizard()) return;
    if (document.getElementById('phoenix-fb-admin-hint')) return;

    var box = document.createElement('div');
    box.id = 'phoenix-fb-admin-hint';
    box.className = 'phoenix-fb-admin-hint';
    box.innerHTML =
      '<strong>Administrador — várias páginas Business</strong><p>No menu abaixo aparecem <em>todas</em> as páginas que você administra no Facebook. ' +
      '★ = já existe caixa (reautorizar ou alternar). ＋ = conectar página nova. ' +
      'Para alternar entre contas já ligadas, use <a href="/comecar/paginas-business">Minhas páginas Business</a> ou o menu <strong>Canais</strong> no painel.</p>';

    var main = document.querySelector('.col-span-6') || document.querySelector('main') || document.body;
    main.insertBefore(box, main.firstChild);
  }

  function watchComboEmpty() {
    if (!isFacebookInboxWizard()) return;
    var observer = new MutationObserver(function () {
      var inputs = document.querySelectorAll('input[placeholder*="Pesquisar"], input[placeholder*="Search"]');
      inputs.forEach(function (input) {
        var parent = input.closest('[class*="combobox"], [class*="ComboBox"], div');
        if (!parent) return;
        var text = parent.textContent || '';
        if (text.indexOf('Nenhum resultado') !== -1 || text.indexOf('No results') !== -1) {
          if (!document.getElementById('phoenix-fb-empty-hint')) {
            var el = document.createElement('p');
            el.id = 'phoenix-fb-empty-hint';
            el.className = 'phoenix-fb-empty-hint';
            el.innerHTML =
              'Nenhuma página listada? Faça login de novo no Facebook ou abra <a href="/comecar/paginas-business">Minhas páginas Business</a>. ' +
              'Se a página já está conectada, ela deve aparecer com ★ no seletor após reiniciar o assistente.';
            parent.appendChild(el);
          }
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('DOMContentLoaded', function () {
    injectAdminHint();
    watchComboEmpty();
  });
})();
