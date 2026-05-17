// ── Gadget Inventory ─────────────────────────────────────────────
(function () {
  const inventory = document.getElementById('gadget-inventory');
  if (!inventory) return;

  let activeGadget      = null;
  let overlay           = null;
  let cursorEl          = null;
  let svgEl             = null;
  let pathEl            = null;
  let gradEl            = null;
  let trailRafId        = null;
  let dragPath          = [];
  let isDragging             = false;
  let activePointerId        = null;
  let lastPointerType        = 'mouse';
  let dragStartX        = 0;
  let dragStartY        = 0;
  let cometDragHistory  = [];
  let meteorDragHistory = [];
  let throwParticles    = [];
  let lastTrailTime     = null;
  let lastMouseX        = 0;
  let lastMouseY        = 0;
  let corsairFlashTimer = null;

  const CORSAIR_SVG = '<svg viewBox="-24 -24 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle r="20" stroke="#00f5ff" stroke-width="0.8" opacity="0.55"/><line x1="0" y1="-20" x2="0" y2="-9" stroke="#00f5ff" stroke-width="0.8" stroke-linecap="round" opacity="0.5"/><line x1="0" y1="9" x2="0" y2="20" stroke="#00f5ff" stroke-width="0.8" stroke-linecap="round" opacity="0.5"/><line x1="-20" y1="0" x2="-9" y2="0" stroke="#00f5ff" stroke-width="0.8" stroke-linecap="round" opacity="0.5"/><line x1="9" y1="0" x2="20" y2="0" stroke="#00f5ff" stroke-width="0.8" stroke-linecap="round" opacity="0.5"/><path d="M-20,-11 L-20,-20 L-11,-20" stroke="#00f5ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M11,-20 L20,-20 L20,-11" stroke="#00f5ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M20,11 L20,20 L11,20" stroke="#00f5ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M-11,20 L-20,20 L-20,11" stroke="#00f5ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle r="7" stroke="#ff00bb" stroke-width="1.2"><animate attributeName="opacity" values="1;0.3;1" dur="2.2s" repeatCount="indefinite"/></circle><circle r="1.8" fill="#ff00bb"><animate attributeName="opacity" values="0.9;0.4;0.9" dur="2.2s" repeatCount="indefinite"/></circle></svg>';

  function moveCursor(x, y) {
    if (!cursorEl) return;
    cursorEl.style.left = x + 'px';
    cursorEl.style.top  = y + 'px';
  }

  const corsairEl = document.createElement('div');
  corsairEl.id = 'corsair-cursor';
  corsairEl.innerHTML = CORSAIR_SVG;
  for (let i = 0; i < 3; i++) {
    const ring = document.createElement('div');
    ring.className = 'ship-beacon-ring';
    ring.style.animationDelay = (i * 0.53) + 's';
    corsairEl.appendChild(ring);
  }
  document.body.appendChild(corsairEl);

  function updateCorsairVisibility(x, y) {
    if (lastPointerType !== 'mouse') return;
    if (activeGadget) { corsairEl.style.opacity = '0'; return; }
    const over   = document.elementFromPoint(x, y);
    const overUI = inventory.contains(over) || !!(over && over.closest('#perf-toggle')) || !!(over && over.closest('#mobile-toggle'));
    if (window.mobileControlMode) {
      if (overUI) {
        corsairEl.style.opacity = '0';
      } else {
        corsairEl.classList.add('ship-drag');
        corsairEl.style.opacity = '1';
      }
      return;
    }
    corsairEl.style.opacity = overUI ? '0' : '1';
  }

  const TRAIL_MS = 200;

  function showDragOrigin(x, y, type) {
    // Cancel any previous trail before starting fresh
    if (trailRafId !== null) { cancelAnimationFrame(trailRafId); trailRafId = null; }
    if (svgEl) { svgEl.remove(); svgEl = null; pathEl = null; gradEl = null; }

    dragPath = [{ x, y, t: performance.now() }];

    const NS     = 'http://www.w3.org/2000/svg';
    const color  = type === 'comet' ? 'rgba(160,235,255,1)' : 'rgba(255,200,80,1)';
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
    trailRafId = requestAnimationFrame(animateTrail);
  }

  function animateTrail() {
    trailRafId = null;
    if (!svgEl || !pathEl) return;

    const now = performance.now();
    const dt  = lastTrailTime !== null ? (now - lastTrailTime) / 1000 : 0;
    lastTrailTime = now;

    for (let i = throwParticles.length - 1; i >= 0; i--) {
      const p = throwParticles[i];
      p.age += dt;
      if (p.age >= p.maxAge) { p.el.remove(); throwParticles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.el.setAttribute('cx', p.x);
      p.el.setAttribute('cy', p.y);
      p.el.setAttribute('opacity', (1 - p.age / p.maxAge) * 0.85);
    }

    const cutoff = now - TRAIL_MS;
    while (dragPath.length > 1 && dragPath[0].t < cutoff) dragPath.shift();
    if (dragPath.length < 2) {
      if (isDragging || throwParticles.length > 0) {
        trailRafId = requestAnimationFrame(animateTrail);
        return;
      }
      svgEl.remove(); svgEl = null; pathEl = null; gradEl = null; dragPath = [];
      lastTrailTime = null;
      return;
    }
    if (activeGadget !== 'comet') {
      const last = dragPath[dragPath.length - 1];
      let d = `M ${dragPath[0].x} ${dragPath[0].y}`;
      for (let i = 1; i < dragPath.length; i++) d += ` L ${dragPath[i].x} ${dragPath[i].y}`;
      pathEl.setAttribute('d', d);
      gradEl.setAttribute('x1', dragPath[0].x); gradEl.setAttribute('y1', dragPath[0].y);
      gradEl.setAttribute('x2', last.x);        gradEl.setAttribute('y2', last.y);
    }
    trailRafId = requestAnimationFrame(animateTrail);
  }

  function spawnThrowParticles(x, y, type) {
    if (!svgEl) return;
    const NS    = 'http://www.w3.org/2000/svg';
    const color = type === 'comet' ? 'rgba(160,235,255,1)' : 'rgba(255,200,80,1)';
    const count = 7;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.6;
      const spd   = 55 + Math.random() * 75;
      const el    = document.createElementNS(NS, 'circle');
      el.setAttribute('r',    1.4 + Math.random() * 1.6);
      el.setAttribute('fill', color);
      el.setAttribute('cx',   x);
      el.setAttribute('cy',   y);
      svgEl.appendChild(el);
      throwParticles.push({
        el, x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        age: 0,
        maxAge: 0.22 + Math.random() * 0.18,
      });
    }
  }

  function updateDragFeedback(cx, cy) {
    if (!cursorEl || !pathEl) return;
    const last = dragPath[dragPath.length - 1];
    if (Math.hypot(cx - last.x, cy - last.y) > 2) {
      dragPath.push({ x: cx, y: cy, t: performance.now() });
    }
    const dx = cx - dragStartX, dy = cy - dragStartY;
    if (activeGadget === 'comet' && window.smokeParticles && window.smokeParticles.length < 600) {
      const len = Math.hypot(dx, dy) || 1;
      const bx  = -dx / len, by = -dy / len;
      for (let j = 0; j < 8; j++) {
        const spread = (Math.random() - 0.5) * 1.1;
        const cs = Math.cos(spread), ss = Math.sin(spread);
        window.smokeParticles.push({
          x: cx + (Math.random() - 0.5) * 6,
          y: cy + (Math.random() - 0.5) * 6,
          vx: (bx * cs - by * ss) * (25 + Math.random() * 45),
          vy: (bx * ss + by * cs) * (25 + Math.random() * 45),
          life: 0.35 + Math.random() * 0.3,
          maxLife: 0.55,
          r: 2.5 + Math.random() * 3.5,
          core: Math.random() < 0.4,
          comet: true,
        });
      }
    }
  }

  function hideDragFeedback() {
    if (trailRafId !== null) { cancelAnimationFrame(trailRafId); trailRafId = null; }
    if (svgEl) { svgEl.remove(); svgEl = null; pathEl = null; gradEl = null; }
    dragPath = [];
    throwParticles.forEach(p => p.el && p.el.remove());
    throwParticles = [];
    lastTrailTime  = null;
    if (cursorEl) cursorEl.style.transform = 'translate(-50%, -50%)';
  }

  function setActiveGadget(type) {
    if (isDragging) {
      isDragging = false;
      hideDragFeedback();
    }

    activeGadget = (activeGadget === type) ? null : type;

    inventory.querySelectorAll('.gadget-slot').forEach(s => {
      s.classList.toggle('active', s.dataset.gadget === activeGadget);
    });
    const moonSlot = inventory.querySelector('[data-gadget="moon"]');
    if (moonSlot && window.Moon) {
      moonSlot.classList.toggle('deployed', window.Moon.isDeployed() && !activeGadget);
    }

    updateCorsairVisibility(lastMouseX, lastMouseY);

    if (cursorEl) { cursorEl.remove(); cursorEl = null; }
    if (activeGadget) {
      cursorEl = document.createElement('div');
      cursorEl.className = `gadget-cursor gadget-cursor--${activeGadget}`;
      if (activeGadget === 'blackhole' || activeGadget === 'meteor-shower' || activeGadget === 'comet') {
        const ring = document.createElement('div');
        ring.className = 'cooldown-ring';
        cursorEl.appendChild(ring);
      }
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

  // Track last real pointer type to avoid treating compat mouse events as genuine mouse input
  document.addEventListener('pointerdown', e => {
    lastPointerType = e.pointerType;
    if (e.pointerType !== 'mouse') {
      const over   = document.elementFromPoint(e.clientX, e.clientY);
      const overUI = inventory.contains(over) || !!(over && over.closest('#perf-toggle')) || !!(over && over.closest('#mobile-toggle'));
      if (!overUI) {
        corsairEl.style.left = e.clientX + 'px';
        corsairEl.style.top  = e.clientY + 'px';
        corsairEl.style.opacity = '1';
        clearTimeout(corsairFlashTimer);
        corsairFlashTimer = setTimeout(() => { corsairEl.style.opacity = '0'; }, 280);
      }
    }
  }, { capture: true });

  // Track cursor even when pointer is over inventory (above the overlay)
  document.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') {
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      corsairEl.style.left = e.clientX + 'px';
      corsairEl.style.top  = e.clientY + 'px';
    }

    if (!cursorEl) {
      if (e.pointerType === 'mouse' && lastPointerType === 'mouse') {
        updateCorsairVisibility(e.clientX, e.clientY);
      }
      return;
    }
    // Only move cursor for the active tracked pointer or any mouse
    if (e.pointerType === 'mouse' || e.pointerId === activePointerId || activePointerId === null) {
      moveCursor(e.clientX, e.clientY);
    }

    // Mouse-only: recover from stuck drag when left button silently released (e.g. after contextmenu)
    if (e.pointerType === 'mouse' && isDragging && !(e.buttons & 1)) {
      isDragging = false;
      activePointerId = null;
      hideDragFeedback();
    }

    if (e.pointerType !== 'mouse') return;
    if (lastPointerType !== 'mouse') return; // ignore compat mouse events that follow a touch
    const over = document.elementFromPoint(e.clientX, e.clientY);
    cursorEl.style.opacity = (over && (inventory.contains(over) || over.closest('#perf-toggle') || over.closest('#mobile-toggle'))) ? '0'
      : cursorEl.classList.contains('on-cooldown') ? '0.52' : '1';
    updateCorsairVisibility(e.clientX, e.clientY);
  }, { capture: true });

  document.addEventListener('mouseleave', () => { corsairEl.style.opacity = '0'; });

  function onDown(e) {
    if (e.button !== 0) return;
    if (activePointerId !== null) return; // reject a second simultaneous touch
    activePointerId = e.pointerId;
    if (e.pointerType !== 'mouse' && cursorEl) {
      moveCursor(e.clientX, e.clientY);
      if (!(activeGadget === 'spaceship' && e.pointerType === 'touch')) {
        cursorEl.style.opacity = '1';
      }
    }
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    if (activeGadget === 'blackhole') {
      if (!window.BlackHole || window.BlackHole.isReady()) {
        window.spawnBlackHole && window.spawnBlackHole(e.clientX, e.clientY);
        isDragging = false;
        setActiveGadget('blackhole');
        e.stopPropagation();
      } else {
        isDragging = false;
        e.stopPropagation();
      }
    } else if (activeGadget === 'comet') {
      if (window.spawnComet && (!window.Comet || window.Comet.isReady())) {
        window.spawnComet(e.clientX, e.clientY, 0, 500);
      }
      isDragging = false;
      setActiveGadget('comet');
      e.stopPropagation();
    } else if (activeGadget === 'meteor-shower') {
      if (window.spawnMeteorShower && (!window.MeteorShower || window.MeteorShower.isReady())) {
        window.spawnMeteorShower(e.clientX, e.clientY, 0, 500);
      }
      isDragging = false;
      setActiveGadget('meteor-shower');
      e.stopPropagation();
    }
  }

  function onMove(e) {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    moveCursor(e.clientX, e.clientY);
    if (!isDragging) return;

  }

  function onUp(e) {
    if (e.button !== 0) return;
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    activePointerId = null;
    if (e.pointerType !== 'mouse' && cursorEl) cursorEl.style.opacity = '0';
    if (!isDragging) return;
    isDragging = false;
    hideDragFeedback();
  }

  function onCancel(e) {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    activePointerId = null;
    if (e.pointerType !== 'mouse' && cursorEl) cursorEl.style.opacity = '0';
    if (!isDragging) return;
    isDragging = false;
    hideDragFeedback();
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
      if (slot.dataset.gadget === 'moon') {
        if (window.Moon.isDeployed()) {
          window.Moon.undeploy();
          slot.classList.remove('deployed');
        } else {
          window.Moon.deploy();
          slot.classList.add('deployed');
        }
        return;
      }
      if (!slot.classList.contains('on-cooldown')) setActiveGadget(slot.dataset.gadget);
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && activeGadget) setActiveGadget(activeGadget);
  });

  document.addEventListener('contextmenu', e => {
    if (!activeGadget) {
      e.preventDefault();
      window.fireSpaceshipLaser && window.fireSpaceshipLaser(e.clientX, e.clientY);
    }
  });

  // Fallback: catch pointer release even when the overlay loses capture (e.g. after contextmenu)
  window.addEventListener('pointerup',     onUp);
  window.addEventListener('pointercancel', onCancel);

  // ── Direct spaceship control (always-on, below any gadget overlay) ──────────
  {
    let pendingPointerId = null;
    let pendingStartX    = 0, pendingStartY = 0;
    let pendingIsDrag    = false;

    function showBeacon() {
      corsairEl.classList.add('ship-drag');
      corsairEl.style.opacity = '1';
    }

    function hideBeacon() {
      if (window.mobileControlMode) return;
      corsairEl.classList.remove('ship-drag');
      corsairEl.style.opacity = '';
      updateCorsairVisibility(lastMouseX, lastMouseY);
    }

    document.body.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (activeGadget) return;
      if (inventory.contains(e.target)) return;
      if (e.target.closest('#perf-toggle') || e.target.closest('#mobile-toggle')) return;
      pendingPointerId = e.pointerId;
      pendingStartX    = e.clientX;
      pendingStartY    = e.clientY;
      pendingIsDrag    = (e.pointerType !== 'touch') && !window.mobileControlMode;
      if (pendingIsDrag) {
        window.startSpaceship && window.startSpaceship(e.clientX, e.clientY);
        showBeacon();
      }
    });

    document.body.addEventListener('pointermove', e => {
      if (!activeGadget && e.pointerType === 'mouse') {
        const ship = window.Spaceship && window.Spaceship.get();
        if (ship && !ship.exploding) { ship._aimX = e.clientX; ship._aimY = e.clientY; }
      }
      if (e.pointerId !== pendingPointerId || activeGadget) return;
      if (!pendingIsDrag && Math.hypot(e.clientX - pendingStartX, e.clientY - pendingStartY) > 12) {
        pendingIsDrag = true;
        window.startSpaceship && window.startSpaceship(pendingStartX, pendingStartY);
        showBeacon();
      }
      if (pendingIsDrag) {
        corsairEl.style.left = e.clientX + 'px';
        corsairEl.style.top  = e.clientY + 'px';
        window.updateSpaceshipTarget && window.updateSpaceshipTarget(e.clientX, e.clientY);
      }
    });

    const endShipControl = e => {
      if (e.pointerId !== pendingPointerId) return;
      const wasDrag = pendingIsDrag;
      pendingPointerId = null;
      pendingIsDrag    = false;
      hideBeacon();
      if (activeGadget) return;
      if (wasDrag) window.releaseSpaceship && window.releaseSpaceship();
      else if (e.type === 'pointerup' && (e.pointerType === 'touch' || (e.pointerType === 'mouse' && window.mobileControlMode))) {
        if (e.pointerType === 'mouse' && window.mobileControlMode) {
          corsairEl.classList.remove('ship-drag');
          clearTimeout(corsairFlashTimer);
          corsairFlashTimer = setTimeout(() => {
            if (window.mobileControlMode) corsairEl.classList.add('ship-drag');
          }, 280);
        } else {
          corsairEl.style.left = e.clientX + 'px';
          corsairEl.style.top  = e.clientY + 'px';
          corsairEl.style.opacity = '1';
          clearTimeout(corsairFlashTimer);
          corsairFlashTimer = setTimeout(() => { corsairEl.style.opacity = '0'; }, 280);
        }
        window.fireSpaceshipLaser && window.fireSpaceshipLaser(e.clientX, e.clientY);
      }
    };
    document.body.addEventListener('pointerup',     endShipControl);
    document.body.addEventListener('pointercancel', endShipControl);
  }

  // ── Performance mode toggle ───────────────────────────────────────
  const perfToggle = document.getElementById('perf-toggle');
  if (perfToggle) {
    window.perfMode = localStorage.getItem('perfMode') === '1';
    perfToggle.classList.toggle('active', window.perfMode);
    perfToggle.addEventListener('click', () => {
      window.perfMode = !window.perfMode;
      localStorage.setItem('perfMode', window.perfMode ? '1' : '0');
      perfToggle.classList.toggle('active', window.perfMode);
    });
  }

  // ── Mobile control mode toggle ────────────────────────────────────
  const mobileToggle = document.getElementById('mobile-toggle');
  if (mobileToggle) {
    window.mobileControlMode = localStorage.getItem('mobileControlMode') === '1';
    mobileToggle.classList.toggle('active', window.mobileControlMode);
    if (window.mobileControlMode) {
      corsairEl.classList.add('ship-drag');
      updateCorsairVisibility(lastMouseX, lastMouseY);
    }
    mobileToggle.addEventListener('click', () => {
      window.mobileControlMode = !window.mobileControlMode;
      localStorage.setItem('mobileControlMode', window.mobileControlMode ? '1' : '0');
      mobileToggle.classList.toggle('active', window.mobileControlMode);
      clearTimeout(corsairFlashTimer);
      if (window.mobileControlMode) {
        corsairEl.classList.add('ship-drag');
      } else {
        corsairEl.classList.remove('ship-drag');
        corsairEl.style.opacity = '';
      }
      updateCorsairVisibility(lastMouseX, lastMouseY);
    });
  }
})();
