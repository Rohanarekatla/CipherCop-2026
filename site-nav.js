// Flood / Fire slide switch, injected on every page. Flood = SurgeForce with AI-NETRA built in (Rohan + Malik);
// Fire = FireSight (Aditya). On the flood centre, sliding to Fire slides FireSight in over the page without
// leaving it (lazy-loaded the first time), so the flood plan keeps running underneath. Click, drag or swipe the
// knob, or press the arrow keys. #fire in the URL opens straight on Fire. Links are relative to this file, so it
// works at the domain root, under a GitHub Pages project path, and from any subfolder.
(() => {
  if (window.top !== window) return; // inside the slide-in frame: the host page already has the switch
  const root = new URL('.', document.currentScript.src).href;
  const onFirePage = location.href.startsWith(`${root}firesight/`);
  const css = document.createElement('style');
  css.textContent = `
  #hz{position:fixed;right:22px;bottom:18px;z-index:100000;display:flex;align-items:center;gap:10px;padding:6px 8px;
    border-radius:999px;background:#fff;border:1px solid #cbd5e1;box-shadow:0 8px 24px rgba(16,32,56,.16);font:600 13px/1 Inter,system-ui,Segoe UI,Arial,sans-serif;
    color:#142033;user-select:none;-webkit-user-select:none;touch-action:none;backdrop-filter:blur(10px)}
  #hz .lbl{padding:0 4px;cursor:pointer;opacity:.6;transition:opacity .2s}#hz .lbl.on{opacity:1}
  #hz .track{position:relative;width:64px;height:30px;border-radius:999px;background:linear-gradient(90deg,#1d63d8,#e2581f);cursor:grab;outline:none}
  #hz .track:focus-visible{box-shadow:0 0 0 3px #4fb3ff88}
  #hz .knob{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.4);
    transition:transform .35s cubic-bezier(.2,.8,.2,1);display:grid;place-items:center;font-size:13px}
  #hz.fire .knob{transform:translateX(34px)}
  #fireStage{position:fixed;inset:0;z-index:99999;background:#0b0f14;transform:translateX(100%);transition:transform .55s cubic-bezier(.2,.8,.2,1);visibility:hidden}
  #fireStage.open{transform:none;visibility:visible}
  #fireStage iframe{width:100%;height:100%;border:0;display:block}
  @media (max-width:700px){#hz{right:50%;transform:translateX(50%)}}
  @media (prefers-reduced-motion: reduce){#hz .knob,#fireStage{transition:none}}`;
  const sw = document.createElement('div');
  sw.id = 'hz';
  sw.innerHTML = `<span class="lbl" data-to="flood">🌊 Flood</span>
    <div class="track" role="switch" tabindex="0" aria-label="Switch between flood and fire command" aria-checked="false"><div class="knob" aria-hidden="true">🌊</div></div>
    <span class="lbl" data-to="fire">Fire 🔥</span>`;
  document.head.append(css); document.body.append(sw);
  const track = sw.querySelector('.track'), knob = sw.querySelector('.knob');
  let stage = null, fire = false;

  function set(on, { instant = false } = {}) {
    fire = on;
    sw.classList.toggle('fire', on);
    track.setAttribute('aria-checked', String(on));
    knob.textContent = on ? '🔥' : '🌊';
    sw.querySelectorAll('.lbl').forEach((l) => l.classList.toggle('on', (l.dataset.to === 'fire') === on));
    if (onFirePage) { if (!on) setTimeout(() => { location.href = root; }, instant ? 0 : 320); return; }
    if (on && !stage) {
      stage = document.createElement('div');
      stage.id = 'fireStage';
      stage.innerHTML = `<iframe title="FireSight: fire risk and response" src="${root}firesight/"></iframe>`;
      document.body.append(stage);
      stage.getBoundingClientRect(); // let the first slide animate
    }
    stage?.classList.toggle('open', on);
    if (on) history.replaceState(null, '', '#fire');
    else if (location.hash === '#fire') history.replaceState(null, '', location.pathname + location.search); // leave other hashes (#buildings) alone
  }

  // click, keyboard, and drag / swipe on the track
  sw.querySelectorAll('.lbl').forEach((l) => l.addEventListener('click', () => set(l.dataset.to === 'fire')));
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') set(true);
    else if (e.key === 'ArrowLeft') set(false);
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); set(!fire); }
  });
  let startX = null, moved = false;
  track.addEventListener('pointerdown', (e) => { startX = e.clientX; moved = false; track.setPointerCapture(e.pointerId); });
  track.addEventListener('pointermove', (e) => {
    if (startX == null) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) { moved = true; knob.style.transition = 'none'; knob.style.transform = `translateX(${Math.max(0, Math.min(34, (fire ? 34 : 0) + dx))}px)`; }
  });
  track.addEventListener('pointerup', (e) => {
    const dx = e.clientX - (startX ?? e.clientX);
    startX = null; knob.style.transition = ''; knob.style.transform = '';
    set(moved ? dx > 0 ? true : dx < 0 ? false : fire : !fire);
  });

  set(onFirePage || location.hash === '#fire', { instant: true });
})();
