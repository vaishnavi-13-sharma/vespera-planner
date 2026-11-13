// Paints the last-used Realm before the app loads, so a light realm never flashes dark.
// Written by applyRealm() in src/lib/realm.ts. Only well-formed token values are applied.
(function () {
  try {
    var cached = JSON.parse(localStorage.getItem('vespera_realm') || 'null');
    if (!cached || typeof cached.vars !== 'object' || cached.vars === null) return;
    var root = document.documentElement;
    for (var name in cached.vars) {
      var value = cached.vars[name];
      if (/^--(color-[a-z]+|shadow-color)$/.test(name) && /^#[0-9a-fA-F]{6}$/.test(value)) root.style.setProperty(name, value);
    }
    if (/^[a-z]{3,12}$/.test(cached.realm)) root.dataset.realm = cached.realm;
    root.style.colorScheme = cached.scheme === 'light' ? 'light' : 'dark';
    var meta = document.querySelector('meta[name="theme-color"]');
    var espresso = cached.vars['--color-espresso'];
    if (meta && /^#[0-9a-fA-F]{6}$/.test(espresso)) meta.setAttribute('content', espresso);
    // iPhone status bar: dark text on a light realm, light text over a dark one.
    var bar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (bar) bar.setAttribute('content', cached.scheme === 'light' ? 'default' : 'black-translucent');
  } catch (e) {
    // No cache, or storage blocked: the app applies the realm once it starts.
  }
})();
