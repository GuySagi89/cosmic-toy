// ── Gadget Inventory ─────────────────────────────────────────────
(function () {
  const inventory = document.getElementById('gadget-inventory');
  if (!inventory) return;

  let ghost              = null;
  let gadgetType         = null;
  let slotCX             = 0;
  let slotCY             = 0;
  let cometDragHistory   = [];
  let meteorDragHistory  = [];

  function spawnGhost(type, clientX, clientY) {
    ghost = document.createElement('div');
    ghost.className      = 'gadget-drag-ghost';
    ghost.dataset.gadget = type;
    ghost.style.left     = clientX + 'px';
    ghost.style.top      = clientY + 'px';
    document.body.appendChild(ghost);
  }

  function cancelDrag(slot) {
    if (ghost) { ghost.remove(); ghost = null; }
    if (gadgetType === 'spaceship') window.releaseSpaceship && window.releaseSpaceship();
    gadgetType = null;
    if (slot) slot.classList.add('no-tooltip');
  }

  inventory.querySelectorAll('.gadget-slot').forEach(slot => {
    slot.addEventListener('pointerdown', e => {
      e.stopPropagation();
      slot.classList.add('no-tooltip');
      gadgetType = slot.dataset.gadget;

      const r = slot.getBoundingClientRect();
      slotCX = r.left + r.width  / 2;
      slotCY = r.top  + r.height / 2;

      if (gadgetType === 'blackhole') {
        spawnGhost('blackhole', e.clientX, e.clientY);
      } else if (gadgetType === 'spaceship') {
        window.startSpaceship && window.startSpaceship(e.clientX, e.clientY);
      } else if (gadgetType === 'comet') {
        cometDragHistory = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
        spawnGhost('comet', e.clientX, e.clientY);
      } else if (gadgetType === 'meteor-shower') {
        meteorDragHistory = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
        spawnGhost('meteor-shower', e.clientX, e.clientY);
      }

      slot.setPointerCapture(e.pointerId);
    });

    slot.addEventListener('pointermove', e => {
      if (gadgetType === 'blackhole' && ghost) {
        ghost.style.left = e.clientX + 'px';
        ghost.style.top  = e.clientY + 'px';
      } else if (gadgetType === 'spaceship') {
        window.updateSpaceshipTarget && window.updateSpaceshipTarget(e.clientX, e.clientY);
      } else if (gadgetType === 'comet' && ghost) {
        ghost.style.left = e.clientX + 'px';
        ghost.style.top  = e.clientY + 'px';
        cometDragHistory.push({ x: e.clientX, y: e.clientY, t: performance.now() });
        if (cometDragHistory.length > 10) cometDragHistory.shift();
        const n = cometDragHistory.length;
        let angle;
        if (n >= 2) {
          const vdx = cometDragHistory[n - 1].x - cometDragHistory[0].x;
          const vdy = cometDragHistory[n - 1].y - cometDragHistory[0].y;
          angle = Math.hypot(vdx, vdy) > 4
            ? Math.atan2(vdy, vdx) * 180 / Math.PI
            : Math.atan2(e.clientY - slotCY, e.clientX - slotCX) * 180 / Math.PI;
        } else {
          angle = Math.atan2(e.clientY - slotCY, e.clientX - slotCX) * 180 / Math.PI;
        }
        ghost.style.transform = `translate(-50%, -50%) rotate(${angle + 90}deg)`;
      } else if (gadgetType === 'meteor-shower' && ghost) {
        ghost.style.left = e.clientX + 'px';
        ghost.style.top  = e.clientY + 'px';
        meteorDragHistory.push({ x: e.clientX, y: e.clientY, t: performance.now() });
        if (meteorDragHistory.length > 10) meteorDragHistory.shift();
        const mn = meteorDragHistory.length;
        let mAngle;
        if (mn >= 2) {
          const vdx = meteorDragHistory[mn - 1].x - meteorDragHistory[0].x;
          const vdy = meteorDragHistory[mn - 1].y - meteorDragHistory[0].y;
          mAngle = Math.hypot(vdx, vdy) > 4
            ? Math.atan2(vdy, vdx) * 180 / Math.PI
            : Math.atan2(e.clientY - slotCY, e.clientX - slotCX) * 180 / Math.PI;
        } else {
          mAngle = Math.atan2(e.clientY - slotCY, e.clientX - slotCX) * 180 / Math.PI;
        }
        ghost.style.transform = `translate(-50%, -50%) rotate(${mAngle + 90}deg)`;
      }
    });

    slot.addEventListener('pointerup', e => {
      const over        = document.elementFromPoint(e.clientX, e.clientY);
      const onInventory = inventory.contains(over);

      if (gadgetType === 'blackhole') {
        if (ghost) { ghost.remove(); ghost = null; }
        if (!onInventory && window.spawnBlackHole) {
          window.spawnBlackHole(e.clientX, e.clientY);
        }
      } else if (gadgetType === 'spaceship') {
        window.releaseSpaceship && window.releaseSpaceship();
      } else if (gadgetType === 'comet') {
        if (ghost) { ghost.remove(); ghost = null; }
        if (!onInventory && window.spawnComet) {
          const now    = performance.now();
          const recent = cometDragHistory.filter(p => now - p.t < 100);
          let vx = 0, vy = 0;
          if (recent.length >= 2) {
            const first = recent[0], last = recent[recent.length - 1];
            const dtSec = (last.t - first.t) / 1000;
            if (dtSec > 0.005) { vx = (last.x - first.x) / dtSec; vy = (last.y - first.y) / dtSec; }
          }
          if (Math.hypot(vx, vy) < 50) {
            const dx   = e.clientX - slotCX, dy = e.clientY - slotCY;
            const vlen = Math.hypot(dx, dy) || 1;
            const spd  = Math.min(vlen * 3.5, 900);
            vx = (dx / vlen) * spd; vy = (dy / vlen) * spd;
          } else {
            const spd = Math.hypot(vx, vy);
            if (spd > 1200) { vx = vx / spd * 1200; vy = vy / spd * 1200; }
          }
          window.spawnComet(e.clientX, e.clientY, vx, vy);
        }
      } else if (gadgetType === 'meteor-shower') {
        if (ghost) { ghost.remove(); ghost = null; }
        if (!onInventory && window.spawnMeteorShower) {
          const now    = performance.now();
          const recent = meteorDragHistory.filter(p => now - p.t < 100);
          let dx = 0, dy = 0;
          if (recent.length >= 2) {
            const first = recent[0], last = recent[recent.length - 1];
            const dtSec = (last.t - first.t) / 1000;
            if (dtSec > 0.005) { dx = (last.x - first.x) / dtSec; dy = (last.y - first.y) / dtSec; }
          }
          if (Math.hypot(dx, dy) < 50) {
            dx = e.clientX - slotCX;
            dy = e.clientY - slotCY;
          }
          if (Math.hypot(dx, dy) > 15) {
            window.spawnMeteorShower(e.clientX, e.clientY, dx, dy);
          }
        }
      }

      gadgetType = null;
      slot.classList.add('no-tooltip');
    });

    slot.addEventListener('pointercancel', () => cancelDrag(slot));

    slot.addEventListener('pointerenter', () => {
      if (!gadgetType) slot.classList.remove('no-tooltip');
    });
  });
})();
