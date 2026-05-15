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
  let isDragging        = false;
  let dragStartX        = 0;
  let dragStartY        = 0;
  let cometDragHistory  = [];
  let meteorDragHistory = [];
  let throwParticles    = [];
  let lastTrailTime     = null;
  let trailReleaseTime  = null;

  const SHIP_SVG = '<svg class="gadget-cursor-ship-svg" viewBox="-13 -16 26 30" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="0,-15 -12,7 -5,2 0,11 5,2 12,7" fill="#6848b8" fill-opacity="0.93" stroke="#c0a8ff" stroke-width="1.3" stroke-linejoin="round"/><ellipse cx="0" cy="-6" rx="2.5" ry="4.5" fill="#98dcff" fill-opacity="0.90" stroke="#c8eeff" stroke-width="0.7" stroke-opacity="0.55"/></svg>';

  function moveCursor(x, y) {
    if (!cursorEl) return;
    cursorEl.style.left = x + 'px';
    cursorEl.style.top  = y + 'px';
  }

  const TRAIL_MS       = 200;
  const TRAIL_FADE_MS  =  2;

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

    // After release: fade trail out quickly, then clean up when particles also finish
    if (!isDragging && trailReleaseTime !== null) {
      const alpha = Math.max(0, 1 - (now - trailReleaseTime) / TRAIL_FADE_MS);
      pathEl.setAttribute('opacity', alpha);
      if (alpha > 0 && dragPath.length >= 2) {
        const last = dragPath[dragPath.length - 1];
        let d = `M ${dragPath[0].x} ${dragPath[0].y}`;
        for (let i = 1; i < dragPath.length; i++) d += ` L ${dragPath[i].x} ${dragPath[i].y}`;
        pathEl.setAttribute('d', d);
        gradEl.setAttribute('x1', dragPath[0].x); gradEl.setAttribute('y1', dragPath[0].y);
        gradEl.setAttribute('x2', last.x);        gradEl.setAttribute('y2', last.y);
      }
      if (alpha <= 0) dragPath = [];
      if (throwParticles.length > 0 || alpha > 0) {
        trailRafId = requestAnimationFrame(animateTrail);
        return;
      }
      svgEl.remove(); svgEl = null; pathEl = null; gradEl = null; dragPath = [];
      lastTrailTime = null; trailReleaseTime = null;
      return;
    }

    // While dragging: normal scrolling window
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
    const last = dragPath[dragPath.length - 1];
    let d = `M ${dragPath[0].x} ${dragPath[0].y}`;
    for (let i = 1; i < dragPath.length; i++) d += ` L ${dragPath[i].x} ${dragPath[i].y}`;
    pathEl.setAttribute('d', d);
    gradEl.setAttribute('x1', dragPath[0].x); gradEl.setAttribute('y1', dragPath[0].y);
    gradEl.setAttribute('x2', last.x);        gradEl.setAttribute('y2', last.y);
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
    if (Math.hypot(dx, dy) > 4) {
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      cursorEl.style.transform = `translate(-50%, -50%) rotate(${angle + 90}deg)`;
    }
  }

  // Returns signed geometric curvature (rad/px) at the tip of the gesture path.
  // Uses the last 8 points only (end-weighted average) so earlier straight portions
  // of the gesture don't dilute the curve the user actually drew at release.
  function computePathKappa(history) {
    if (history.length < 3) return 0;
    const tail = history.slice(Math.max(0, history.length - 8));
    if (tail.length < 3) return 0;
    let kappa = 0, weight = 0;
    for (let i = 2; i < tail.length; i++) {
      const a = tail[i - 2], b = tail[i - 1], c = tail[i];
      const dx1 = b.x - a.x, dy1 = b.y - a.y;
      const dx2 = c.x - b.x, dy2 = c.y - b.y;
      const len1 = Math.hypot(dx1, dy1);
      const len2 = Math.hypot(dx2, dy2);
      if (len1 < 1 || len2 < 1) continue;
      let dA = Math.atan2(dy2, dx2) - Math.atan2(dy1, dx1);
      if (dA >  Math.PI) dA -= 2 * Math.PI;
      if (dA < -Math.PI) dA += 2 * Math.PI;
      const w = (i - 1) / (tail.length - 1); // later segments weighted more
      kappa  += (dA / (len1 + len2)) * w;
      weight += w;
    }
    if (weight < 0.01) return 0;
    return Math.max(-0.02, Math.min(0.02, kappa / weight));
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
      if (window.MeteorShower && !window.MeteorShower.isReady()) { isDragging = false; return; }
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
      if (cometDragHistory.length > 40) cometDragHistory.shift();
      updateDragFeedback(e.clientX, e.clientY);
    } else if (activeGadget === 'meteor-shower') {
      meteorDragHistory.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (meteorDragHistory.length > 40) meteorDragHistory.shift();
      updateDragFeedback(e.clientX, e.clientY);
    }
  }

  function onUp(e) {
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
      const kappa = computePathKappa(cometDragHistory);
      const launchSpd = Math.min(Math.hypot(vx, vy), 320);
      const omega = Math.max(-5, Math.min(5, kappa * launchSpd));
      window.spawnComet(e.clientX, e.clientY, vx, vy, omega);
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
      const kappa = computePathKappa(meteorDragHistory);
      const omega = Math.max(-2.5, Math.min(2.5, kappa * 350));
      if (Math.hypot(dx, dy) > 15) {
        window.spawnMeteorShower(e.clientX, e.clientY, dx, dy, omega);
      } else {
        window.spawnMeteorShower(e.clientX, e.clientY, 0, 500, omega);
      }
      spawnThrowParticles(e.clientX, e.clientY, 'meteor-shower');
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
