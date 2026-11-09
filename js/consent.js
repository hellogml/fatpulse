/*! cms:consent-banner —— GDPR/ePrivacy 同意管理（自包含，无依赖）
 * 只写一个 localStorage 键（记录用户选择本身，属严格必要存储）。
 * 全局读点：window.__twaConsent；document 上事件 'twa:consent'（detail = 状态对象）。
 * 将来接入 gtag（Google Consent Mode v2）时同意状态自动同步。
 */
(function () {
  'use strict';
  var KEY = 'twa-consent-v1';
  var banner = document.querySelector('.cookie-banner');
  if (!banner) return;

  var prefs = banner.querySelector('.cookie-prefs');
  var cbPref = banner.querySelector('[data-consent-pref-preferences]');
  var cbAds = banner.querySelector('[data-consent-pref-ads]');

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY));
      if (v && typeof v === 'object') return v;
    } catch (e) {}
    var old = localStorage.getItem('cookie-consent');           // 旧版一代：accepted/declined
    if (old === 'accepted' || old === 'declined') {
      return { necessary: true, preferences: old === 'accepted', ads: old === 'accepted', ts: 0, migrated: true };
    }
    if (localStorage.getItem('ck') === '1') {                     // 旧版二代：只点过 Accept
      return { necessary: true, preferences: true, ads: true, ts: 0, migrated: true };
    }
    return null;
  }
  function save(state) {
    state.necessary = true;
    state.ts = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    apply(state);
    banner.classList.remove('show');
  }
  function apply(state) {
    window.__twaConsent = state;
    try { document.dispatchEvent(new CustomEvent('twa:consent', { detail: state })); } catch (e) {}
    if (typeof window.gtag === 'function') {
      var on = state.ads ? 'granted' : 'denied';
      window.gtag('consent', 'update', {
        ad_storage: on, ad_user_data: on, ad_personalization: on,
        analytics_storage: state.preferences ? 'granted' : 'denied'
      });
    }
  }

  banner.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('button') : null;
    if (!t) return;
    if (t.hasAttribute('data-consent-accept')) {
      save({ preferences: true, ads: true });
    } else if (t.hasAttribute('data-consent-decline')) {
      save({ preferences: false, ads: false });
    } else if (t.hasAttribute('data-consent-settings')) {
      var cur = read() || { preferences: false, ads: false };
      if (cbPref) cbPref.checked = !!cur.preferences;
      if (cbAds) cbAds.checked = !!cur.ads;
      if (prefs) prefs.classList.add('open');
    } else if (t.hasAttribute('data-consent-save')) {
      save({ preferences: !!(cbPref && cbPref.checked), ads: !!(cbAds && cbAds.checked) });
    }
  });

  /* 页脚「Cookie Settings」入口：带 data-cookie-settings 的链接随时可重开横幅；
     无 JS 时退化为跳转到隐私政策（其中有 Cookies 章节）。 */
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('[data-cookie-settings]') : null;
    if (!a) return;
    ev.preventDefault();
    if (prefs) prefs.classList.add('open');
    banner.classList.add('show');
  });

  var state = read();
  if (state) {
    apply(state);
    if (state.migrated) save(state);   // 旧访客迁移，不再打扰第二次
  } else {
    banner.classList.add('show');
  }
})();
