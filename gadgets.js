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
  let spaceshipTouchPending  = false;
  let activePointerId        = null;
  let lastPointerType        = 'mouse';
  let dragStartX        = 0;
  let dragStartY        = 0;
  let cometDragHistory  = [];
  let meteorDragHistory = [];
  let throwParticles    = [];
  let lastTrailTime     = null;

  const SHIP_SVG     = '<svg class="gadget-cursor-ship-svg" viewBox="-13 -16 26 30" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="0,-15 -12,7 -5,2 0,11 5,2 12,7" fill="#6848b8" fill-opacity="0.93" stroke="#c0a8ff" stroke-width="1.3" stroke-linejoin="round"/><ellipse cx="0" cy="-6" rx="2.5" ry="4.5" fill="#98dcff" fill-opacity="0.90" stroke="#c8eeff" stroke-width="0.7" stroke-opacity="0.55"/></svg>';
  const ASTEROID_SVG = '<svg class="gadget-cursor-asteroid-svg" viewBox="-20 -20 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="0,-18 10,-13 17,-4 15,9 6,17 -7,16 -16,7 -15,-6 -8,-16" fill="rgba(0,28,32,0.85)" stroke="#00f5ff" stroke-width="1.6" stroke-linejoin="round"/><circle cx="3" cy="-4" r="2.5" fill="rgba(0,245,255,0.12)" stroke="#00f5ff" stroke-width="0.8"/></svg>';
  const _HP1  = '<path fill="#b8780a" d="M385.1 784c-43.2-14-74.4-41.8-96.6-80.5a628 628 0 0 0-66.1-98c-9.7-11.3-20-21.9-32.6-30.1a43 43 0 0 0-19.4-7.4c-8.7-.9-12-6.9-7.8-14.4 13.7-24.3 31.7-44.5 57.6-56.3 25.5-11.6 50.6-9.1 75.1 3q14.6 7.4 27 17.8c2-1.5 1.3-3.3 1.3-4.8 0-41.3.4-82.7-.2-124q-.6-38.4-.4-77a61 61 0 0 1 28.4-53.1 62 62 0 0 1 72.7 4.1l4.8 4v-18a69 69 0 0 1 6.5-29.6 61.8 61.8 0 0 1 117.1 21.4c.8 8.1 0 16.3 1 25 3.8-2.6 7-5 10.5-7.2 39.2-24.8 90 .2 94.5 46.5 1.5 16.8.5 33.6.5 50.4q-.1 78.3-.7 156.5c0 1.7-.5 3.6.9 5.8q4.4-3.4 8.8-6.4c17.9-12.6 37.1-21.7 59.5-21.8 23.3-.1 43 9.2 60.2 24.3a147 147 0 0 1 30 36c1.6 2.7 3.5 5.4 3.5 8.7-.2 4.2-2 8-6.4 8.4-21.5 2.4-35.5 16.7-49 31.3-29 31.6-51.1 68-72.4 105.1a170 170 0 0 1-90.6 78.3c-17 6.3-35 8.7-52.7 11a412 412 0 0 1-65.8 4c-33.3-1-66.4-4-99.2-13m-43.9-325.5.1 78.5c0 4.5-1 8.3-5.4 10.3-4.5 1.9-8 0-11.2-3.2q-10.7-11-23.3-19.6a85 85 0 0 0-45.7-17c-20-.7-36.4 8.2-51 20.9a110 110 0 0 0-20.6 24.2c5.4 2.6 10.4 4.8 15 7.8a195 195 0 0 1 44.7 43.2 727 727 0 0 1 60.7 92.2 150 150 0 0 0 75.6 67.6c27.6 11 57 13.5 86.3 15.1a475 475 0 0 0 99-5.4 150 150 0 0 0 111.7-76.6 731 731 0 0 1 63.8-96.1c15.6-19 32.2-37 55.4-47.2q.5-.3 1.2-1.4a107 107 0 0 0-18.6-21.9c-14.7-13.5-31.4-22.7-52-22.4a77 77 0 0 0-37.7 11.5c-12.1 6.9-22.6 16-32.6 25.5-3 2.9-6.2 4.6-10.3 2.8-4-1.8-5.5-5.1-5.6-9.3v-3.5l.2-118c.1-30.5-.4-61 .6-91.4.3-7.9.5-15.7-1.2-23.4a44.3 44.3 0 0 0-49.3-34.4 44 44 0 0 0-37.8 43.5v87.5q.2 3.8-.8 7.4c-1.2 4.1-4.3 6-8.2 6.2q-6.2 0-8.3-6-1.2-3.8-1-7.9l.1-79.5c0-25 .5-50-.2-75-.8-26.6-28.3-46.2-54.2-39.5a44 44 0 0 0-33.7 45v149q.1 3.8-.6 7.4a8 8 0 0 1-8.4 6.5c-4 0-7-2.2-8.2-6.2-.8-2.4-.8-5-.8-7.4q.2-45-.1-90A43 43 0 0 0 387 267a44 44 0 0 0-45.8 38c-1.2 10-.4 20-.3 30l.3 123.4"/>';
  const _HP2  = '<path fill="#ffdd55" d="m552.3 546.3 30.8-50.7c1.8-2.8 2-4.9 0-8-4.9-7.8-4.4-16 .6-23.5s12.5-10.5 21.3-9.2a21 21 0 0 1 17.5 14.6 21.6 21.6 0 0 1-14.7 27.7 15 15 0 0 0-9.6 7.6q-14.9 25-30.2 50l-2.7 5q12.8 7.7 24.5 16.5l64.1 46c6.6 4.8 6.8 11.3.3 16-27.4 19.6-53.9 40.5-82.4 58.2-50 31-102.3 32.2-154.4 4.4-23-12.3-42.9-29.8-64.4-44.6q-12.3-8.5-24.5-17.4c-7-5.1-7.1-11.9 0-17l77.2-55.3q4.7-3.2 9.6-6.2c-.8-3.5-3-6-4.5-8.6q-13.6-23.6-27-47.3a14 14 0 0 0-9.3-7.3 21.7 21.7 0 1 1 15.8-40.2c10.4 5.5 15.1 17.8 9.6 28.1-2.9 5.5-2 9.2.8 14q14.3 23.7 27.9 48c2.2 3.8 4.2 5.2 8.6 3.3 13-5.3 26.8-8 40.7-9.4 3.8-.3 4.8-2.1 4.7-5.5V467c.1-3.5-1.8-4.9-4.4-6.3a29 29 0 0 1-15.3-29 28 28 0 0 1 23.4-24.2 28 28 0 0 1 31.5 18.1 28 28 0 0 1-12.5 34.4c-4.2 2.2-5.3 4.6-5.2 9q.2 33 0 66c0 4 1 6 5.4 6.3q21 1.9 40.7 9.6c4.4 1.7 4.1-2.6 6.1-4.6m52.3 105.8 30-21.7-3.4-2.7-59.2-42.5c-47.2-34.1-105.4-36.6-154.1-5.1-23.6 15.2-46 32.4-68.8 48.8q-.6.5-1.2 1.8l4.5 3.4q27.7 19.7 55.1 39.7a143 143 0 0 0 60.1 26.7q46.5 8 87.9-14.6c17.3-9.5 32.3-22.3 49.1-33.8M501.7 433.9c-1.9-6.5-6.8-10.1-12.2-9s-9.6 6.3-9.1 11.4c.6 5.8 5.5 10 11.3 9.7 6-.3 9.7-4.5 10-12m-124.5 45q2.5 2.7 5.4.5c1.2-1 2.2-2.1 1.7-3.8a4 4 0 0 0-3-3.1c-3.2-.9-5 1.6-4 6.5m223 1c3 1 4.4-.8 5.2-3.2.6-1.8-.6-3.1-2.1-4q-3-1.3-4.7 1.3-2.4 3.2 1.7 5.8"/>';
  const _HP3o = '<path fill="#ffdd55" d="M555.2 650a67 67 0 0 1-46.7 45.1 67.4 67.4 0 0 1-84-56 67.6 67.6 0 0 1 55.6-75 67.6 67.6 0 0 1 75.1 85.8M526 595.5a49.6 49.6 0 0 0-66.4-3.4 49.4 49.4 0 1 0 66.4 3.4"/><path fill="#1a0d00" d="M456.7 618a35 35 0 0 1 30.9-24 36 36 0 0 1 30.2 11.6c-6.2 3.7-10.3 8.5-6.4 15.2 3.5 6 9.2 5.5 14.7 2.5 4.2 11.6-1.5 27.2-12.6 35.8a36 36 0 0 1-42.9 1.5c-13.9-9.5-19.1-25.3-14-42.6"/>';
  const _HP3c = '<line x1="420" y1="632" x2="560" y2="632" stroke="#ffdd55" stroke-width="20" stroke-linecap="round"/>';
  const _HG   = '<g transform="scale(0.065) translate(-488,-488)">';
  const HAND_OPEN_SVG = `<svg class="gadget-cursor-hand-svg" viewBox="-24 -22 48 44" fill="none" xmlns="http://www.w3.org/2000/svg">${_HG}${_HP1}${_HP2}${_HP3o}</g></svg>`;
  const HAND_GRAB_SVG = `<svg class="gadget-cursor-hand-svg" viewBox="-24 -22 48 44" fill="none" xmlns="http://www.w3.org/2000/svg">${_HG}${_HP1}${_HP2}${_HP3c}</g></svg>`;
  let godHandGrabType = null;

  { const s = document.createElement('style'); s.textContent = '@keyframes _gh_rb{0%{filter:hue-rotate(0deg)}100%{filter:hue-rotate(360deg)}}.gadget-cursor--god-hand.rainbow{animation:_gh_rb 1.4s linear infinite}'; document.head.appendChild(s); }

  function moveCursor(x, y) {
    if (!cursorEl) return;
    cursorEl.style.left = x + 'px';
    cursorEl.style.top  = y + 'px';
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
      spaceshipTouchPending = false;
      if (activeGadget === 'spaceship') {
        if (cursorEl) cursorEl.classList.remove('pressing');
        window.releaseSpaceship && window.releaseSpaceship();
      } else if (activeGadget === 'god-hand' && godHandGrabType) {
        if (godHandGrabType === 'asteroid')       window.Asteroids?.onGrabCancel();
        else if (godHandGrabType === 'spaceship') window.Spaceship?.onGrabCancel();
        else if (godHandGrabType === 'globe')     window.Globe?.onRelease();
        godHandGrabType = null;
      }
      hideDragFeedback();
    }

    if (activeGadget === 'god-hand') window.Globe?.onHoverLeave();
    activeGadget = (activeGadget === type) ? null : type;

    inventory.querySelectorAll('.gadget-slot').forEach(s => {
      s.classList.toggle('active', s.dataset.gadget === activeGadget);
    });

    if (cursorEl) { cursorEl.remove(); cursorEl = null; }
    if (activeGadget) {
      cursorEl = document.createElement('div');
      cursorEl.className = `gadget-cursor gadget-cursor--${activeGadget}`;
      if (activeGadget === 'spaceship') cursorEl.innerHTML = SHIP_SVG;
      if (activeGadget === 'asteroid')  cursorEl.innerHTML = ASTEROID_SVG;
      if (activeGadget === 'god-hand')  cursorEl.innerHTML = HAND_OPEN_SVG;
      if (activeGadget === 'meteor-shower') {
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

  window.getActiveGadget = () => activeGadget;

  // Track last real pointer type to avoid treating compat mouse events as genuine mouse input
  document.addEventListener('pointerdown', e => { lastPointerType = e.pointerType; }, { capture: true });

  // Track cursor even when pointer is over inventory (above the overlay)
  document.addEventListener('pointermove', e => {
    if (!cursorEl) return;
    // Only move cursor for the active tracked pointer or any mouse
    if (e.pointerType === 'mouse' || e.pointerId === activePointerId || activePointerId === null) {
      moveCursor(e.clientX, e.clientY);
    }

    // Mouse-only: recover from stuck drag when left button silently released (e.g. after contextmenu)
    if (e.pointerType === 'mouse' && isDragging && !(e.buttons & 1)) {
      isDragging = false;
      activePointerId = null;
      hideDragFeedback();
      if (activeGadget === 'spaceship') {
        if (cursorEl) cursorEl.classList.remove('pressing');
        window.releaseSpaceship && window.releaseSpaceship();
      } else if (activeGadget === 'god-hand') {
        if (godHandGrabType) {
          if (godHandGrabType === 'asteroid')       window.Asteroids?.onGrabRelease();
          else if (godHandGrabType === 'spaceship') window.Spaceship?.onGrabRelease();
          else if (godHandGrabType === 'globe')     window.Globe?.onRelease();
          godHandGrabType = null;
          if (cursorEl) cursorEl.innerHTML = HAND_OPEN_SVG;
        }
        if (cursorEl) cursorEl.classList.remove('rainbow');
      }
    }

    if (e.pointerType !== 'mouse') return;
    if (lastPointerType !== 'mouse') return; // ignore compat mouse events that follow a touch
    const over = document.elementFromPoint(e.clientX, e.clientY);
    cursorEl.style.opacity = (over && inventory.contains(over)) ? '0'
      : cursorEl.classList.contains('on-cooldown') ? '0.52' : '1';
  }, { capture: true });

  function onDown(e) {
    if (e.button !== 0) return;
    if (activePointerId !== null) return; // reject a second simultaneous touch
    activePointerId = e.pointerId;
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
    } else if (activeGadget === 'asteroid') {
      window.Asteroids && window.Asteroids.spawnAt(e.clientX, e.clientY);
      isDragging = false;
    } else if (activeGadget === 'spaceship') {
      if (e.pointerType === 'touch') {
        spaceshipTouchPending = true;
      } else {
        window.startSpaceship && window.startSpaceship(e.clientX, e.clientY);
        if (cursorEl) cursorEl.classList.add('pressing');
        overlay.setPointerCapture(e.pointerId);
      }
    } else if (activeGadget === 'comet') {
      cometDragHistory = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      showDragOrigin(dragStartX, dragStartY, 'comet');
      overlay.setPointerCapture(e.pointerId);
    } else if (activeGadget === 'meteor-shower') {
      meteorDragHistory = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      overlay.setPointerCapture(e.pointerId);
      if (!window.MeteorShower || window.MeteorShower.isReady()) {
        showDragOrigin(dragStartX, dragStartY, 'meteor-shower');
      }
    } else if (activeGadget === 'god-hand') {
      godHandGrabType = null;
      if (window.Asteroids && window.Asteroids.tryGrab(e.clientX, e.clientY)) {
        godHandGrabType = 'asteroid';
      } else if (window.Spaceship && window.Spaceship.tryGrab(e.clientX, e.clientY)) {
        godHandGrabType = 'spaceship';
      } else if (window.Globe && window.Globe.tryGrab(e.clientX, e.clientY, e.pointerType)) {
        godHandGrabType = 'globe';
      }
      if (godHandGrabType) {
        if (cursorEl) cursorEl.innerHTML = HAND_GRAB_SVG;
      } else {
        window.GodHandTrail.startAt(e.clientX, e.clientY);
      }
      if (cursorEl) cursorEl.classList.add('rainbow');
      overlay.setPointerCapture(e.pointerId);
    }
  }

  function onMove(e) {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    moveCursor(e.clientX, e.clientY);
    if (activeGadget === 'spaceship' && e.pointerType === 'mouse') {
      const ship = window.Spaceship && window.Spaceship.get();
      if (ship && !ship.exploding && !ship.swirl) {
        ship._aimX = e.clientX;
        ship._aimY = e.clientY;
      }
    }
    if (activeGadget === 'god-hand') window.Globe?.onHover(e.clientX, e.clientY);
    if (!isDragging) return;

    if (activeGadget === 'spaceship') {
      if (spaceshipTouchPending) {
        if (Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) > 12) {
          spaceshipTouchPending = false;
          window.startSpaceship && window.startSpaceship(dragStartX, dragStartY);
          if (cursorEl) cursorEl.classList.add('pressing');
          overlay.setPointerCapture(e.pointerId);
          window.updateSpaceshipTarget && window.updateSpaceshipTarget(e.clientX, e.clientY);
        }
      } else {
        window.updateSpaceshipTarget && window.updateSpaceshipTarget(e.clientX, e.clientY);
      }
    } else if (activeGadget === 'comet') {
      cometDragHistory.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (cometDragHistory.length > 10) cometDragHistory.shift();
      updateDragFeedback(e.clientX, e.clientY);
    } else if (activeGadget === 'meteor-shower') {
      meteorDragHistory.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (meteorDragHistory.length > 10) meteorDragHistory.shift();
      if (!svgEl && window.MeteorShower && window.MeteorShower.isReady()) {
        showDragOrigin(e.clientX, e.clientY, 'meteor-shower');
      }
      updateDragFeedback(e.clientX, e.clientY);
    } else if (activeGadget === 'god-hand') {
      if (godHandGrabType) {
        if (godHandGrabType === 'asteroid')       window.Asteroids?.onGrabMove(e.clientX, e.clientY);
        else if (godHandGrabType === 'spaceship') window.Spaceship?.onGrabMove(e.clientX, e.clientY);
        else if (godHandGrabType === 'globe')     window.Globe?.onMove(e.clientX, e.clientY);
      } else {
        const pts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for (const pt of pts) window.GodHandTrail.spawnAt(pt.clientX, pt.clientY);
      }
    }
  }

  function onUp(e) {
    if (e.button !== 0) return;
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    activePointerId = null;
    if (e.pointerType !== 'mouse' && cursorEl) cursorEl.style.opacity = '0';
    if (!isDragging) return;
    isDragging = false;
    // Trail gadgets: let animateTrail age the path out naturally; others: clean up now
    if (activeGadget === 'comet' || activeGadget === 'meteor-shower') {
      if (cursorEl) cursorEl.style.transform = 'translate(-50%, -50%)';
    } else {
      hideDragFeedback();
    }

    if (activeGadget === 'spaceship') {
      if (spaceshipTouchPending) {
        spaceshipTouchPending = false;
        window.fireSpaceshipLaser && window.fireSpaceshipLaser(e.clientX, e.clientY);
      } else {
        if (cursorEl) cursorEl.classList.remove('pressing');
        window.releaseSpaceship && window.releaseSpaceship();
      }
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
      spawnThrowParticles(e.clientX, e.clientY, 'comet');
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
      spawnThrowParticles(e.clientX, e.clientY, 'meteor-shower');
    } else if (activeGadget === 'god-hand') {
      if (godHandGrabType) {
        if (godHandGrabType === 'asteroid')       window.Asteroids?.onGrabRelease();
        else if (godHandGrabType === 'spaceship') window.Spaceship?.onGrabRelease();
        else if (godHandGrabType === 'globe')     window.Globe?.onRelease();
        godHandGrabType = null;
        if (cursorEl) cursorEl.innerHTML = HAND_OPEN_SVG;
      }
      if (cursorEl) cursorEl.classList.remove('rainbow');
    }
  }

  function onCancel(e) {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    activePointerId = null;
    if (e.pointerType !== 'mouse' && cursorEl) cursorEl.style.opacity = '0';
    spaceshipTouchPending = false;
    if (!isDragging) return;
    isDragging = false;
    hideDragFeedback();
    if (activeGadget === 'spaceship') {
      if (cursorEl) cursorEl.classList.remove('pressing');
      window.releaseSpaceship && window.releaseSpaceship();
    } else if (activeGadget === 'god-hand') {
      if (godHandGrabType) {
        if (godHandGrabType === 'asteroid')       window.Asteroids?.onGrabCancel();
        else if (godHandGrabType === 'spaceship') window.Spaceship?.onGrabCancel();
        else if (godHandGrabType === 'globe')     window.Globe?.onRelease();
        godHandGrabType = null;
        if (cursorEl) cursorEl.innerHTML = HAND_OPEN_SVG;
      }
      if (cursorEl) cursorEl.classList.remove('rainbow');
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

  document.addEventListener('contextmenu', e => {
    if (activeGadget === 'spaceship') {
      e.preventDefault();
      window.fireSpaceshipLaser && window.fireSpaceshipLaser(e.clientX, e.clientY);
    }
  });

  // Fallback: catch pointer release even when the overlay loses capture (e.g. after contextmenu)
  window.addEventListener('pointerup',     onUp);
  window.addEventListener('pointercancel', onCancel);

  // ── God Hand Trail ────────────────────────────────────────────────
  const TRAIL_NEON_10 = [
    { hex: '#00f5ff', r:   0, g: 245, b: 255 },  // cyan
    { hex: '#ff00dc', r: 255, g:   0, b: 220 },  // hot pink
    { hex: '#0088ff', r:   0, g: 136, b: 255 },  // electric blue
    { hex: '#00ff6b', r:   0, g: 255, b: 107 },  // lime green
    { hex: '#bf00ff', r: 191, g:   0, b: 255 },  // purple
    { hex: '#ff6600', r: 255, g: 102, b:   0 },  // orange
    { hex: '#aaff00', r: 170, g: 255, b:   0 },  // yellow-green
    { hex: '#ff0044', r: 255, g:   0, b:  68 },  // red
    { hex: '#00ffcc', r:   0, g: 255, b: 204 },  // teal
    { hex: '#ffd700', r: 255, g: 215, b:   0 },  // gold
  ];
  const TRAIL_SPACING = 7;
  let trailParticles = [];
  let trailCurrentNc = TRAIL_NEON_10[0];
  let trailPrevX = 0, trailPrevY = 0, trailAccum = 0;

  function spawnTrailParticles(x, y) {
    if (trailParticles.length > 800) return;
    const nc      = trailCurrentNc;
    const scatter = 12;

    const dustCount = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < dustCount; i++) {
      trailParticles.push({
        type: 'dust',
        x: x + (Math.random() - 0.5) * scatter,
        y: y + (Math.random() - 0.5) * scatter,
        vx: (Math.random() - 0.5) * 28,
        vy: -4 - Math.random() * 16,
        nc,
        r: 0.5 + Math.random() * 1.3,
        age: 0, maxLife: 0.5 + Math.random() * 0.7,
      });
    }

    trailParticles.push({
      type: 'glow',
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 14,
      vy: -2 - Math.random() * 10,
      nc,
      r: 2.5 + Math.random() * 3.5,
      age: 0, maxLife: 0.8 + Math.random() * 0.9,
    });

    if (Math.random() < 0.35) {
      trailParticles.push({
        type: 'glow',
        x: x + (Math.random() - 0.5) * 14,
        y: y + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 10,
        vy: -1 - Math.random() * 8,
        nc,
        r: 1.5 + Math.random() * 2.5,
        age: 0, maxLife: 0.7 + Math.random() * 0.8,
      });
    }

    if (Math.random() < 0.22) {
      trailParticles.push({
        type: 'spark',
        x: x + (Math.random() - 0.5) * scatter,
        y: y + (Math.random() - 0.5) * scatter,
        vx: (Math.random() - 0.5) * 18,
        vy: -6 - Math.random() * 22,
        nc,
        r: 1.2 + Math.random() * 1.4,
        age: 0, maxLife: 0.4 + Math.random() * 0.5,
      });
    }
  }

  window.GodHandTrail = {
    startAt(x, y) {
      trailCurrentNc = TRAIL_NEON_10[Math.floor(Math.random() * TRAIL_NEON_10.length)];
      trailPrevX = x; trailPrevY = y; trailAccum = 0;
      for (let i = 0; i < 8; i++) spawnTrailParticles(x, y);
    },
    spawnAt(x, y) {
      const dx = x - trailPrevX, dy = y - trailPrevY;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.5) return;
      trailAccum += dist;
      while (trailAccum >= TRAIL_SPACING) {
        trailAccum -= TRAIL_SPACING;
        const frac = 1 - trailAccum / Math.max(dist, 0.001);
        spawnTrailParticles(trailPrevX + dx * frac, trailPrevY + dy * frac);
      }
      trailPrevX = x; trailPrevY = y;
    },
    update(dt) {
      for (let i = trailParticles.length - 1; i >= 0; i--) {
        const p = trailParticles[i];
        p.age += dt;
        if (p.age >= p.maxLife) { trailParticles.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.88, dt * 60);
        p.vy *= Math.pow(0.90, dt * 60);
      }
    },
    draw(ctx) {
      if (!trailParticles.length) return;
      for (const p of trailParticles) {
        const lifeFrac  = p.age / p.maxLife;
        const fade      = Math.pow(1 - lifeFrac, 0.65);
        const sizeScale = Math.pow(1 - lifeFrac, 0.7);
        if (fade < 0.015) continue;

        if (p.type === 'glow') {
          const drawR = p.r * 3.2 * sizeScale;
          ctx.save();
          ctx.globalAlpha = fade * 0.88;
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, drawR);
          grad.addColorStop(0,    'rgba(255,255,240,0.95)');
          grad.addColorStop(0.18, `rgba(${p.nc.r},${p.nc.g},${p.nc.b},0.9)`);
          grad.addColorStop(0.55, `rgba(${p.nc.r},${p.nc.g},${p.nc.b},0.35)`);
          grad.addColorStop(1,    `rgba(${p.nc.r},${p.nc.g},${p.nc.b},0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, drawR, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

        } else if (p.type === 'dust') {
          const drawR = p.r * sizeScale;
          if (drawR < 0.1) continue;
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.shadowColor = p.nc.hex;
          ctx.shadowBlur  = drawR * 5;
          ctx.fillStyle   = `rgba(${p.nc.r},${p.nc.g},${p.nc.b},1)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, drawR, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

        } else if (p.type === 'spark') {
          const sr = p.r * 2.8 * sizeScale;
          if (sr < 0.15) continue;
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.translate(p.x, p.y);
          ctx.shadowColor = p.nc.hex;
          ctx.shadowBlur  = sr * 4;
          ctx.strokeStyle = '#ffffff';
          ctx.lineCap     = 'round';
          ctx.lineWidth   = p.r * 0.55 * sizeScale;
          ctx.beginPath(); ctx.moveTo(-sr, 0);  ctx.lineTo(sr, 0);  ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0,  -sr); ctx.lineTo(0,  sr); ctx.stroke();
          ctx.lineWidth = p.r * 0.35 * sizeScale;
          const d = sr * 0.65;
          ctx.beginPath(); ctx.moveTo(-d, -d); ctx.lineTo(d,  d);  ctx.stroke();
          ctx.beginPath(); ctx.moveTo( d, -d); ctx.lineTo(-d, d);  ctx.stroke();
          ctx.restore();
        }
      }
    },
  };
})();
