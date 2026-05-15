// ── Gadget Inventory ─────────────────────────────────────────────
(function () {
  const inventory = document.getElementById('gadget-inventory');
  if (!inventory) return;

  let activeGadget      = null;
  let overlay           = null;
  let cursorEl          = null;
  let originEl          = null;
  let svgEl             = null;
  let pathEl            = null;
  let gradEl            = null;
  let dragPath          = [];
  let isDragging        = false;
  let dragStartX        = 0;
  let dragStartY        = 0;
  let cometDragHistory  = [];
  let meteorDragHistory = [];

  const SHIP_SVG = '<svg class="gadget-cursor-ship-svg" viewBox="-13 -16 26 30" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="0,-15 -12,7 -5,2 0,11 5,2 12,7" fill="#6848b8" fill-opacity="0.93" stroke="#c0a8ff" stroke-width="1.3" stroke-linejoin="round"/><ellipse cx="0" cy="-6" rx="2.5" ry="4.5" fill="#98dcff" fill-opacity="0.90" stroke="#c8eeff" stroke-width="0.7" stroke-opacity="0.55"/></svg>';

  function moveCursor(x, y) {
    if (!cursorEl) return;
    cursorEl.style.left = x + 'px';
    cursorEl.style.top  = y + 'px';
  }

  function showDragOrigin(x, y, type) {
    originEl = document.createElement('div');
    originEl.className = `gadget-origin-dot gadget-origin-dot--${type}`;
    originEl.style.left = x + 'px';
    originEl.style.top  = y + 'px';
    document.body.appendChild(originEl);

    dragPath = [{ x, y }];

    const NS    = 'http://www.w3.org/2000/svg';
    const color = type === 'comet' ? 'rgba(160,235,255,1)' : 'rgba(255,200,80,1)';
    const gradId = `drag-trail-${type}`;

    svgEl = document.createElementNS(NS, 'svg');
    svgEl.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9997;overflow:visible;';

    const defs = document.createElementNS(NS, 'defs');
    gradEl = document.createElementNS(NS, 'linearGradient');
    gradEl.setAttribute('id', gradId);
    gradEl.setAttribute('gradientUnits', 'userSpaceOnUse');
    gradEl.setAttribute('x1', x); gradEl.setAttribute('y1', y);
    gradEl.setAttribute('x2', x); gradEl.setAttribute('y2', y);

    const stop0 = document.createElementNS(NS, 'stop');
    stop0.setAttribute('offset', '0%');
    stop0.setAttribute('stop-color', color);
    stop0.setAttribute('stop-opacity', '0');
    const stop1 = document.createElementNS(NS, 'stop');
    stop1.setAttribute('offset', '100%');
    stop1.setAttribute('stop-color', color);
    stop1.setAttribute('stop-opacity', '0.7');

    gradEl.appendChild(stop0);
    gradEl.appendChild(stop1);
    defs.appendChild(gradEl);
    svgEl.appendChild(defs);

    pathEl = document.createElementNS(NS, 'path');
    pathEl.setAttribute('stroke', `url(#${gradId})`);
    pathEl.setAttribute('stroke-width', '1.8');
    pathEl.setAttribute('stroke-linecap', 'round');
    pathEl.setAttribute('stroke-linejoin', 'round');
    pathEl.setAttribute('fill', 'none');
    svgEl.appendChild(pathEl);

    document.body.appendChild(svgEl);
  }

  function updateDragFeedback(cx, cy) {
    if (!cursorEl || !pathEl) return;

    const last = dragPath[dragPath.length - 1];
    if (Math.hypot(cx - last.x, cy - last.y) > 2) {
      dragPath.push({ x: cx, y: cy });
      if (dragPath.length > 200) dragPath.shift();
    }

    let d = `M ${dragPath[0].x} ${dragPath[0].y}`;
    for (let i = 1; i < dragPath.length; i++) d += ` L ${dragPath[i].x} ${dragPath[i].y}`;
    pathEl.setAttribute('d', d);

    gradEl.setAttribute('x1', dragPath[0].x); gradEl.setAttribute('y1', dragPath[0].y);
    gradEl.setAttribute('x2', cx);            gradEl.setAttribute('y2', cy);

    const dx = cx - dragStartX, dy = cy - dragStartY;
    const dist = Math.hypot(dx, dy);
    if (dist > 4) {
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      cursorEl.style.transform = `translate(-50%, -50%) rotate(${angle + 90}deg)`;
    }
  }

  function hideDragFeedback() {
    if (originEl) { originEl.remove(); originEl = null; }
    if (svgEl)    { svgEl.remove();    svgEl = null; pathEl = null; gradEl = null; }
    dragPath = [];
    if (cursorEl) cursorEl.style.transform = 'translate(-50%, -50%)';
  }

  function setActiveGadget(type) {
    if (isDragging) {
      isDragging = false;
      if (activeGadget === 'spaceship') {
        if (cursorEl) cursorEl.classList.remove('pressing');
        window.releaseSpaceship && window.releaseSpaceship();
      }
      hideDragFeedback();
    }

    activeGadget = (activeGadget === type) ? null : type;

    inventory.querySelectorAll('.gadget-slot').forEach(s => {
      s.classList.toggle('active', s.dataset.gadget === activeGadget);
    });

    if (cursorEl) { cursorEl.remove(); cursorEl = null; }
    if (activeGadget) {
      cursorEl = document.createElement('div');
      cursorEl.className = `gadget-cursor gadget-cursor--${activeGadget}`;
      if (activeGadget === 'spaceship') cursorEl.innerHTML = SHIP_SVG;
      cursorEl.style.left = '-100px';
      cursorEl.style.top  = '-100px';
      document.body.appendChild(cursorEl);
    }

    if (activeGadget && !overlay) {
      overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:50;cursor:none;touch-action:none;';
      overlay.addEventListener('pointerdown',   onDown);
      overlay.addEventListener('pointermove',   onMove);
      overlay.addEventListener('pointerup',     onUp);
      overlay.addEventListener('pointercancel', onCancel);
      document.body.appendChild(overlay);
    } else if (!activeGadget && overlay) {
      overlay.remove();
      overlay = null;
    }
  }

  // Track cursor even when pointer is over inventory (above the overlay)
  document.addEventListener('pointermove', e => {
    if (!cursorEl) return;
    moveCursor(e.clientX, e.clientY);
    if (e.pointerType !== 'mouse') return; // touch cursor visibility is managed by down/up
    const over = document.elementFromPoint(e.clientX, e.clientY);
    cursorEl.style.opacity = (over && inventory.contains(over)) ? '0' : '1';
  }, { capture: true });

  function onDown(e) {
    if (e.pointerType !== 'mouse' && cursorEl) {
      moveCursor(e.clientX, e.clientY);
      cursorEl.style.opacity = '1';
    }
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    if (activeGadget === 'blackhole') {
      window.spawnBlackHole && window.spawnBlackHole(e.clientX, e.clientY);
      isDragging = false;
    } else if (activeGadget === 'spaceship') {
      window.startSpaceship && window.startSpaceship(e.clientX, e.clientY);
      if (cursorEl) cursorEl.classList.add('pressing');
      overlay.setPointerCapture(e.pointerId);
    } else if (activeGadget === 'comet') {
      cometDragHistory = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      showDragOrigin(dragStartX, dragStartY, 'comet');
      overlay.setPointerCapture(e.pointerId);
    } else if (activeGadget === 'meteor-shower') {
      meteorDragHistory = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      showDragOrigin(dragStartX, dragStartY, 'meteor-shower');
      overlay.setPointerCapture(e.pointerId);
    }
  }

  function onMove(e) {
    moveCursor(e.clientX, e.clientY);
    if (!isDragging) return;

    if (activeGadget === 'spaceship') {
      window.updateSpaceshipTarget && window.updateSpaceshipTarget(e.clientX, e.clientY);
    } else if (activeGadget === 'comet') {
      cometDragHistory.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (cometDragHistory.length > 10) cometDragHistory.shift();
      updateDragFeedback(e.clientX, e.clientY);
    } else if (activeGadget === 'meteor-shower') {
      meteorDragHistory.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (meteorDragHistory.length > 10) meteorDragHistory.shift();
      updateDragFeedback(e.clientX, e.clientY);
    }
  }

  function onUp(e) {
    if (e.pointerType !== 'mouse' && cursorEl) cursorEl.style.opacity = '0';
    if (!isDragging) return;
    isDragging = false;
    hideDragFeedback();

    if (activeGadget === 'spaceship') {
      if (cursorEl) cursorEl.classList.remove('pressing');
      window.releaseSpaceship && window.releaseSpaceship();
    } else if (activeGadget === 'comet' && window.spawnComet) {
      const now    = performance.now();
      const recent = cometDragHistory.filter(p => now - p.t < 100);
      let vx = 0, vy = 0;
      if (recent.length >= 2) {
        const first = recent[0], last = recent[recent.length - 1];
        const dtSec = (last.t - first.t) / 1000;
        if (dtSec > 0.005) { vx = (last.x - first.x) / dtSec; vy = (last.y - first.y) / dtSec; }
      }
      if (Math.hypot(vx, vy) < 50) {
        const dx = e.clientX - dragStartX, dy = e.clientY - dragStartY;
        const len = Math.hypot(dx, dy);
        if (len > 5) {
          const spd = Math.min(len * 3.5, 900);
          vx = (dx / len) * spd; vy = (dy / len) * spd;
        } else {
          vx = 0; vy = -500;
        }
      } else {
        const spd = Math.hypot(vx, vy);
        if (spd > 1200) { vx = vx / spd * 1200; vy = vy / spd * 1200; }
      }
      window.spawnComet(e.clientX, e.clientY, vx, vy);
    } else if (activeGadget === 'meteor-shower' && window.spawnMeteorShower) {
      const now    = performance.now();
      const recent = meteorDragHistory.filter(p => now - p.t < 100);
      let dx = 0, dy = 0;
      if (recent.length >= 2) {
        const first = recent[0], last = recent[recent.length - 1];
        const dtSec = (last.t - first.t) / 1000;
        if (dtSec > 0.005) { dx = (last.x - first.x) / dtSec; dy = (last.y - first.y) / dtSec; }
      }
      if (Math.hypot(dx, dy) < 50) {
        dx = e.clientX - dragStartX;
        dy = e.clientY - dragStartY;
      }
      if (Math.hypot(dx, dy) > 15) {
        window.spawnMeteorShower(e.clientX, e.clientY, dx, dy);
      } else {
        window.spawnMeteorShower(e.clientX, e.clientY, 0, 500);
      }
    }
  }

  function onCancel(e) {
    if (e.pointerType !== 'mouse' && cursorEl) cursorEl.style.opacity = '0';
    if (!isDragging) return;
    isDragging = false;
    hideDragFeedback();
    if (activeGadget === 'spaceship') {
      if (cursorEl) cursorEl.classList.remove('pressing');
      window.releaseSpaceship && window.releaseSpaceship();
    }
  }

  inventory.querySelectorAll('.gadget-slot').forEach(slot => {
    let longPressTimer = null;
    let pressX = 0, pressY = 0;

    slot.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch') return;
      pressX = e.clientX; pressY = e.clientY;
      longPressTimer = setTimeout(() => slot.classList.add('show-tooltip'), 500);
    });

    const cancelLongPress = () => {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      slot.classList.remove('show-tooltip');
    };

    slot.addEventListener('pointermove', e => {
      if (e.pointerType !== 'touch' || !longPressTimer) return;
      if (Math.hypot(e.clientX - pressX, e.clientY - pressY) > 10) cancelLongPress();
    });
    slot.addEventListener('pointerup',     cancelLongPress);
    slot.addEventListener('pointercancel', cancelLongPress);

    slot.addEventListener('click', e => {
      e.stopPropagation();
      setActiveGadget(slot.dataset.gadget);
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && activeGadget) setActiveGadget(activeGadget);
  });
})();
