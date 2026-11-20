// One site, three tools: a small switcher injected on every page. Links are relative to this file, so it works
// at the domain root, under a GitHub Pages project path, and from any subfolder.
(() => {
  const root = new URL('.', document.currentScript.src).href;
  const items = [['SurgeForce', ''], ['FireSight', 'firesight/'], ['AI-NETRA', 'netra/']];
  const here = location.href.startsWith(root + 'firesight/') ? 'firesight/' : location.href.startsWith(root + 'netra/') ? 'netra/' : '';
  const css = document.createElement('style');
  css.textContent = `#sitenav{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:99999;display:flex;gap:2px;padding:4px;
    border-radius:999px;background:rgba(11,31,58,.92);border:1px solid #2a4c7d;box-shadow:0 6px 24px rgba(0,0,0,.4);font:600 13px/1 system-ui,Segoe UI,Arial,sans-serif}
    #sitenav a{color:#dcebf5;text-decoration:none;padding:8px 14px;border-radius:999px}
    #sitenav a:hover{background:#15325a}#sitenav a[aria-current=page]{background:#f2a33a;color:#0b1f3a}`;
  const nav = document.createElement('nav');
  nav.id = 'sitenav'; nav.setAttribute('aria-label', 'Switch tool');
  nav.innerHTML = items.map(([n, p]) => `<a href="${root}${p}"${p === here ? ' aria-current="page"' : ''}>${n}</a>`).join('');
  document.head.append(css); document.body.append(nav);
})();
