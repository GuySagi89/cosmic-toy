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
  const HAND_OPEN_SVG = '<svg class="gadget-cursor-hand-svg" viewBox="-13 -21 26 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="-10" y="-21" width="4" height="13" rx="2" fill="#6848b8" fill-opacity="0.93" stroke="#c0a8ff" stroke-width="1.3"/><rect x="-5" y="-23" width="4" height="15" rx="2" fill="#6848b8" fill-opacity="0.93" stroke="#c0a8ff" stroke-width="1.3"/><rect x="1" y="-21" width="4" height="13" rx="2" fill="#6848b8" fill-opacity="0.93" stroke="#c0a8ff" stroke-width="1.3"/><rect x="6" y="-17" width="4" height="10" rx="2" fill="#6848b8" fill-opacity="0.93" stroke="#c0a8ff" stroke-width="1.3"/><rect x="-13" y="-9" width="6.5" height="4" rx="2" fill="#6848b8" fill-opacity="0.93" stroke="#c0a8ff" stroke-width="1.3" transform="rotate(15 -13 -9)"/><path d="M -11,-8 L 10,-8 Q 12,-8 12,8 Q 12,18 6,18 Q 0,18 -4,18 Q -12,18 -12,8 Q -12,-8 -11,-8 Z" fill="#6848b8" fill-opacity="0.93" stroke="#c0a8ff" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  const HAND_GRAB_SVG = '<svg class="gadget-cursor-hand-svg" viewBox="-13 -14 26 34" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M -11,-13 Q -8.5,-15 -6,-13 Q -3,-15 0,-13 Q 3,-15 6,-13 Q 8.5,-15 11,-13 L 12,-1 L -12,-1 Z" fill="#6848b8" fill-opacity="0.93" stroke="#c0a8ff" stroke-width="1.3" stroke-linejoin="round"/><path d="M -12,-2 Q -16,-1 -16,4 Q -16,9 -12,10 Z" fill="#6848b8" fill-opacity="0.93" stroke="#c0a8ff" stroke-width="1.3" stroke-linejoin="round"/><rect x="-12" y="-2" width="24" height="16" rx="5" fill="#6848b8" fill-opacity="0.93" stroke="#c0a8ff" stroke-width="1.3"/></svg>';
  let godHandGrabType = null;

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
      } else if (activeGadget === 'god-hand' && godHandGrabType) {
        if (godHandGrabType === 'asteroid')       window.Asteroids?.onGrabRelease();
        else if (godHandGrabType === 'spaceship') window.Spaceship?.onGrabRelease();
        else if (godHandGrabType === 'globe')     window.Globe?.onRelease();
        godHandGrabType = null;
        if (cursorEl) cursorEl.innerHTML = HAND_OPEN_SVG;
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
    } else if (activeGadget === 'god-hand' && godHandGrabType) {
      if (godHandGrabType === 'asteroid')       window.Asteroids?.onGrabCancel();
      else if (godHandGrabType === 'spaceship') window.Spaceship?.onGrabCancel();
      else if (godHandGrabType === 'globe')     window.Globe?.onRelease();
      godHandGrabType = null;
      if (cursorEl) cursorEl.innerHTML = HAND_OPEN_SVG;
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
