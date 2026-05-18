// ── Deployables Bar ───────────────────────────────────────────────
// Manages the deployables UI bar: click dispatch, cursor hiding,
// and pointer-event isolation from the gadgets bar.
// Loaded after gadgets.js so its capture listener fires second,
// letting it override the corsair opacity when over this bar.
(function () {
  const bar = document.getElementById('deployable-inventory');
  if (!bar) return;

  // Prevent pointer events from bubbling to the body-level spaceship drag
  // listener in gadgets.js.
  bar.addEventListener('pointerdown', e => { e.stopPropagation(); });

  // Dispatch clicks to individual deployable modules.
  bar.addEventListener('click', e => {
    e.stopPropagation();
    const slot = e.target.closest('.deployable-slot');
    if (!slot) return;
    if (slot.id === 'deployable-drone' && window.toggleDrone) window.toggleDrone();
  });

  // Hide the corsair cursor when the pointer is over the deployables bar.
  // Runs in capture phase and is registered after gadgets.js, so it fires
  // last among capture listeners and has the final say on opacity.
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const corsair = document.getElementById('corsair-cursor');
    if (!corsair) return;
    const over = document.elementFromPoint(e.clientX, e.clientY);
    if (over && over.closest('#deployable-inventory')) {
      corsair.style.opacity = '0';
    }
  }, { capture: true });
})();
