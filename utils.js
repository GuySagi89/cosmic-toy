// ── Shared Utilities ──────────────────────────────────────────────
(function () {
  function rng(a, b) { return a + Math.random() * (b - a); }

  function lerpAngle(a, b, t) {
    let d = (b - a) % (Math.PI * 2);
    if (d >  Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * Math.min(1, t);
  }

  function addTrailPoint(trail, maxLen, x, y) {
    trail.unshift({ x, y });
    if (trail.length > maxLen) trail.pop();
  }

  function updateCooldownUI(gadgetName, cooldown, cooldownMax) {
    const pct    = cooldown > 0 ? `${((1 - cooldown / cooldownMax) * 100).toFixed(1)}%` : '0%';
    const active = cooldown > 0;
    for (const el of [
      document.getElementById(`gadget-${gadgetName}`),
      document.querySelector(`.gadget-cursor--${gadgetName}`),
    ]) {
      if (!el) continue;
      const wasOnCooldown = el.classList.contains('on-cooldown');
      el.style.setProperty('--cd-pct', pct);
      el.classList.toggle('on-cooldown', active);
      if (wasOnCooldown && !active && el.classList.contains('gadget-slot')) {
        el.classList.remove('ready-flash');
        void el.offsetWidth;
        el.classList.add('ready-flash');
        el.addEventListener('animationend', () => el.classList.remove('ready-flash'), { once: true });
      }
    }
  }

  function getGlobeBounds() {
    const el = document.getElementById('globe-canvas');
    if (!el) return null;
    const gr = el.getBoundingClientRect();
    return { x: gr.left + gr.width / 2, y: gr.top + gr.height / 2, r: gr.width * 0.22 };
  }

  window.CosmicUtils = { rng, lerpAngle, addTrailPoint, updateCooldownUI, getGlobeBounds };
})();
