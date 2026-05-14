(function () {
  const LAT_STEPS    = 20;
  const LON_STEPS    = 40;
  const R            = 110;
  const TILT_X       = 0.35;
  const FOV_DIST     = 500;
  const ROT_SPEED     = 0.004;
  const SPIN_DECAY    = 0.03;   // lerp rate back to ROT_SPEED after a snap impulse
  const IMPULSE_SCALE = 0.022;  // canvas-px → rad/frame conversion for the snap kick
  const MOUSE_RADIUS = 80;
  const ATTRACT_STR  = 0.35;
  const SPRING_LERP  = 0.12;
  const GRAB_RADIUS  = 15;
  const DRAG_ANGLE   = 0.65;
  const WAVE_SPEED   = 3.5;
  const W            = 500;
  const H            = 500;
  const cx           = W / 2;
  const cy           = H / 2;

  // Moon
  const MOON_ORBIT_R     = 185;
  const MOON_R           = 28;   // ~1/4 globe diameter (globe R=110)
  const MOON_ORBIT_SPEED = 0.008;   // base orbital speed (rad/frame)
  const MOON_ORBIT_DECAY = 0.018;   // lerp rate back to base after a drag impulse
  const MOON_SELF_SPEED  = 0.008;   // axial rotation speed (rad/frame)
  const MOON_ORBIT_TILT  = 0.50;    // radians — tilts the orbit plane for 3-D feel

  // Precomputed dot positions on the unit sphere (lat/lon grid, before self-rotation)
  const MOON_DOTS = (() => {
    const dots = [], LAT = 12, LON = 24;
    for (let i = 0; i <= LAT; i++) {
      const phi  = i * Math.PI / LAT;
      const sinP = Math.sin(phi), cosP = Math.cos(phi);
      const lons = (i === 0 || i === LAT) ? 1 : LON;
      for (let j = 0; j < lons; j++) {
        const t0 = j * 2 * Math.PI / lons;
        dots.push({ sinP, cosP, sinT: Math.sin(t0), cosT: Math.cos(t0) });
      }
    }
    return dots;
  })();

  // Crater clusters — stored in moon-local frame, rotate with moonSelfAngle
  const MOON_CRATERS = (() => {
    const raw = [
      [  0.50,  0.30, -0.82, 0.25, 0.65 ],
      [ -0.70,  0.10, -0.71, 0.20, 0.55 ],
      [  0.20, -0.75, -0.63, 0.28, 0.70 ],
      [ -0.28,  0.70, -0.65, 0.18, 0.60 ],
      [  0.85,  0.00, -0.53, 0.22, 0.50 ],
      [ -0.15, -0.40, -0.90, 0.14, 0.75 ],
      [  0.60,  0.50,  0.62, 0.20, 0.60 ],
      [ -0.55, -0.65,  0.52, 0.16, 0.55 ],
    ];
    return raw.map(([x, y, z, r, depth]) => {
      const len = Math.sqrt(x*x + y*y + z*z);
      return { nx: x/len, ny: y/len, nz: z/len, cosR: Math.cos(r), depth };
    });
  })();

  // Damped spring constants for snap-back.
  // ζ=0.55 (slightly underdamped → clean overshoot), ωn=22 rad/s (fast).
  // ωd = ωn√(1−ζ²),  k = ζ/√(1−ζ²)
  const SNAP_ZETA = 0.55;
  const SNAP_WN   = 22;
  const SNAP_WD   = SNAP_WN * Math.sqrt(1 - SNAP_ZETA * SNAP_ZETA);
  const SNAP_K    = SNAP_ZETA / Math.sqrt(1 - SNAP_ZETA * SNAP_ZETA);

  // Returns the analytical underdamped spring position at time t, given initial displacement x0.
  function snapEval(x0, t) {
    return x0 * Math.exp(-SNAP_ZETA * SNAP_WN * t)
              * (Math.cos(SNAP_WD * t) + SNAP_K * Math.sin(SNAP_WD * t));
  }

  let rotY          = 0;
  let rotSpeed      = ROT_SPEED;
  let mouseX        = -9999;
  let mouseY        = -9999;
  let mouseInside   = false;
  let dragVertex    = null;
  let ripple        = null;
  let snapStartTime = 0;

  let moonOrbitAngle = 0;
  let moonSelfAngle  = 0;
  let moonOrbitSpeed = MOON_ORBIT_SPEED;
  let moonDragging   = false;
  let moonDragVel    = 0;

  const vertices       = [];
  const sortedVertices = [];
  const grid           = [];
  let   ctx;

  function generateVertices() {
    const cosT = Math.cos(TILT_X);
    const sinT = Math.sin(TILT_X);
    for (let i = 0; i <= LAT_STEPS; i++) {
      grid[i] = [];
      const phi = i * Math.PI / LAT_STEPS;
      for (let j = 0; j < LON_STEPS; j++) {
        const theta = j * 2 * Math.PI / LON_STEPS;
        const x = R * Math.sin(phi) * Math.cos(theta);
        const y = R * Math.cos(phi);
        const z = R * Math.sin(phi) * Math.sin(theta);
        const v = {
          x0: x,
          y0: y * cosT - z * sinT,
          z0: y * sinT + z * cosT,
          lat: i, lon: j,
          projX: 0, projY: 0,
          driftX: 0, driftY: 0,
          rippleDisp: 0,
          dragWeight: 0,
          snapping: false, _snapDX0: 0, _snapDY0: 0,
          _scale: 1, _rz: 0, _heatDist: MOUSE_RADIUS + 1,
        };
        vertices.push(v);
        sortedVertices.push(v);
        grid[i][j] = v;
      }
    }
  }

  function updateProjections() {
    const cosR = Math.cos(rotY);
    const sinR = Math.sin(rotY);
    for (let i = 0; i < vertices.length; i++) {
      const v  = vertices[i];
      const rd = v.rippleDisp;
      const px = v.x0 + (v.x0 / R) * rd;
      const py = v.y0 + (v.y0 / R) * rd;
      const pz = v.z0 + (v.z0 / R) * rd;
      const rx =  px * cosR + pz * sinR;
      const ry =  py;
      const rz = -px * sinR + pz * cosR;
      const scale = FOV_DIST / (FOV_DIST + rz + R);
      v.projX  = cx + rx * scale;
      v.projY  = cy + ry * scale;
      v._scale = scale;
      v._rz    = rz;
    }
  }

  function updateSprings() {
    const ddx = dragVertex ? mouseX - dragVertex.projX : 0;
    const ddy = dragVertex ? mouseY - dragVertex.projY : 0;
    const snapT = (Date.now() - snapStartTime) / 1000;

    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];

      // — drag cluster: moves rigidly with the mouse, weighted by angular falloff —
      if (dragVertex && v.dragWeight > 0) {
        v.driftX    = v.dragWeight * ddx;
        v.driftY    = v.dragWeight * ddy;
        v._heatDist = (1 - v.dragWeight) * MOUSE_RADIUS;
        continue;
      }

      // — elastic snap-back via analytical damped spring —
      if (v.snapping) {
        v.driftX = snapEval(v._snapDX0, snapT);
        v.driftY = snapEval(v._snapDY0, snapT);
        v._heatDist += (MOUSE_RADIUS + 1 - v._heatDist) * 0.12;
        if (snapT > 0.6) { v.driftX = 0; v.driftY = 0; v.snapping = false; }
        continue;
      }

      // — normal hover spring (front hemisphere only) —
      if (v._rz >= 0) {
        v._heatDist += (MOUSE_RADIUS + 1 - v._heatDist) * 0.12;
        v.driftX += (0 - v.driftX) * SPRING_LERP;
        v.driftY += (0 - v.driftY) * SPRING_LERP;
        continue;
      }
      const dx   = mouseX - v.projX;
      const dy   = mouseY - v.projY;
      const dist = Math.hypot(dx, dy);
      v._heatDist = dist;

      let tdx = 0, tdy = 0;
      if (dist > 0 && dist < MOUSE_RADIUS) {
        const s = (1 - dist / MOUSE_RADIUS) * ATTRACT_STR;
        tdx = dx * s;
        tdy = dy * s;
      }
      v.driftX += (tdx - v.driftX) * SPRING_LERP;
      v.driftY += (tdy - v.driftY) * SPRING_LERP;
      if (Math.abs(v.driftX) < 0.01) v.driftX = 0;
      if (Math.abs(v.driftY) < 0.01) v.driftY = 0;
    }
  }

  function updateRipple() {
    if (!ripple) return;
    const t        = (Date.now() - ripple.startTime) / 1000;
    const timeDamp = Math.exp(-2.5 * t);
    if (timeDamp < 0.001) {
      ripple = null;
      for (let i = 0; i < vertices.length; i++) vertices[i].rippleDisp = 0;
      return;
    }
    const waveFront = t * WAVE_SPEED;
    for (let i = 0; i < vertices.length; i++) {
      const v   = vertices[i];
      const dot = (ripple.ox * v.x0 + ripple.oy * v.y0 + ripple.oz * v.z0) / (R * R);
      const ang = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (ang > waveFront + 0.3) { v.rippleDisp = 0; continue; }
      v.rippleDisp = ripple.amp
        * Math.sin(ang * 6 - t * 10)
        * Math.exp(-ang * 1.5)
        * timeDamp;
    }
  }

  function lerpRGB(r1, g1, b1, r2, g2, b2, t) {
    return [
      Math.round(r1 + t * (r2 - r1)),
      Math.round(g1 + t * (g2 - g1)),
      Math.round(b1 + t * (b2 - b1)),
    ];
  }

  // 3-D gradient: front (rz≈−R) → near color, back (rz≈+R) → far color
  function baseColor(rz) {
    const t = (rz + R) / (2 * R); // 0 = front, 1 = back
    return lerpRGB(244, 63, 142, 34, 211, 238, t); // hot-pink → electric-blue
  }

  function heatColor(dist, alpha, rz) {
    const [br, bg, bb] = baseColor(rz);
    if (dist >= MOUSE_RADIUS) return `rgba(${br},${bg},${bb},${alpha.toFixed(3)})`;
    const t = 1 - dist / MOUSE_RADIUS;
    const c = t < 0.5
      ? lerpRGB(br, bg, bb, 255, 220,   0, t * 2)
      : lerpRGB(255, 220, 0, 255,  50, 200, (t - 0.5) * 2);
    return `rgba(${c[0]},${c[1]},${c[2]},${alpha.toFixed(3)})`;
  }

  function drawGlow() {
    const outerR = R * 1.55;
    const grad = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, outerR);
    grad.addColorStop(0,    'rgba(110, 40, 200, 0.28)');
    grad.addColorStop(0.45, 'rgba(70,  20, 155, 0.14)');
    grad.addColorStop(0.75, 'rgba(30,  10,  90, 0.07)');
    grad.addColorStop(1,    'rgba(0,   0,   0,  0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Returns the moon's projected screen position and depth for this frame.
  function getMoonPos() {
    const sinO = Math.sin(moonOrbitAngle);
    const cosO = Math.cos(moonOrbitAngle);
    const mx =  MOON_ORBIT_R * cosO;
    const my = -MOON_ORBIT_R * sinO * Math.sin(MOON_ORBIT_TILT);
    const mz =  MOON_ORBIT_R * sinO * Math.cos(MOON_ORBIT_TILT);
    const s  = FOV_DIST / (FOV_DIST + mz + R);
    return { mx, my, mz, px: cx + mx * s, py: cy + my * s, s };
  }

  // Gauss-Newton: find the orbit angle whose projected screen pos is closest to (msx,msy).
  // Converges in ~6 iterations for any mouse position, stable at all orbit positions.
  function nearestOrbitAngle(msx, msy, startAngle) {
    const sinT = Math.sin(MOON_ORBIT_TILT);
    const cosT = Math.cos(MOON_ORBIT_TILT);
    let θ = startAngle;
    for (let iter = 0; iter < 8; iter++) {
      const sinθ = Math.sin(θ), cosθ = Math.cos(θ);
      const omx  =  MOON_ORBIT_R * cosθ;
      const omy  = -MOON_ORBIT_R * sinθ * sinT;
      const omz  =  MOON_ORBIT_R * sinθ * cosT;
      const denom = FOV_DIST + omz + R;
      const s    = FOV_DIST / denom;
      const px   = cx + omx * s;
      const py   = cy + omy * s;
      const domx = -MOON_ORBIT_R * sinθ;
      const domy = -MOON_ORBIT_R * cosθ * sinT;
      const domz =  MOON_ORBIT_R * cosθ * cosT;
      const ds   = -FOV_DIST * domz / (denom * denom);
      const dpx  = domx * s + omx * ds;
      const dpy  = domy * s + omy * ds;
      const num  = (px - msx) * dpx + (py - msy) * dpy;
      const den  = dpx * dpx + dpy * dpy;
      if (den < 1e-6) break;
      θ -= Math.max(-0.3, Math.min(0.3, num / den));
    }
    return θ;
  }

  function drawOrbitRing() {
    const alpha = 0.18;
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const θ  = (i / 80) * Math.PI * 2;
      const ox =  MOON_ORBIT_R * Math.cos(θ);
      const oy = -MOON_ORBIT_R * Math.sin(θ) * Math.sin(MOON_ORBIT_TILT);
      const oz =  MOON_ORBIT_R * Math.sin(θ) * Math.cos(MOON_ORBIT_TILT);
      const s  = FOV_DIST / (FOV_DIST + oz + R);
      const sx = cx + ox * s;
      const sy = cy + oy * s;
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(140, 110, 210, ${alpha})`;
    ctx.lineWidth   = 0.6;
    ctx.stroke();
  }

  function drawMoon({ px, py, mx, my, mz, s }) {
    const mr = MOON_R * s;

    const depthAlpha = (mz > 0 && !moonDragging) ? Math.max(0.3, 1 - mz / (MOON_ORBIT_R * 1.2)) : 1;
    ctx.save();
    ctx.globalAlpha = depthAlpha;

    // Faint outer lavender glow
    const glow = ctx.createRadialGradient(px, py, mr * 0.9, px, py, mr * 3.2);
    glow.addColorStop(0, 'rgba(175, 148, 220, 0.20)');
    glow.addColorStop(1, 'rgba(90,  70, 170, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py, mr * 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Dot-particle surface
    const cosSA = Math.cos(moonSelfAngle);
    const sinSA = Math.sin(moonSelfAngle);

    // Light: top-right, slightly toward camera (+x=right, -y=screen-up, -z=toward viewer)
    const lx = 0.60, ly = -0.55, lz = -0.58; // pre-normalised length ≈ 1.0

    // Rotate crater centres into the current self-rotation frame
    const rotCraters = MOON_CRATERS.map(c => ({
      nx: c.nx * cosSA - c.nz * sinSA,
      ny: c.ny,
      nz: c.nx * sinSA + c.nz * cosSA,
      cosR: c.cosR, depth: c.depth,
    }));

    for (const d of MOON_DOTS) {
      // Surface normal after Y-axis self-rotation
      const nx = d.sinP * (d.cosT * cosSA - d.sinT * sinSA);
      const ny = d.cosP;
      const nz = d.sinP * (d.sinT * cosSA + d.cosT * sinSA);

      if (nz >= 0) continue; // back hemisphere — cull

      const facing = -nz; // 0 at rim → 1 at disk centre

      // Perspective-project the dot's world position
      const wz = mz + MOON_R * nz;
      const ds = FOV_DIST / (FOV_DIST + wz + R);
      const sx = cx + (mx + MOON_R * nx) * ds;
      const sy = cy + (my + MOON_R * ny) * ds;

      // Directional lighting
      const lit = Math.max(0, nx * lx + ny * ly + nz * lz);

      // Crater influence — soft organic falloff
      let crater = 0;
      for (const c of rotCraters) {
        const dp = nx * c.nx + ny * c.ny + nz * c.nz;
        if (dp > c.cosR) {
          const t = ((dp - c.cosR) / (1 - c.cosR)) ** 0.65;
          crater = Math.max(crater, t * c.depth);
        }
      }

      // Palette: #3A2A5C (shadow) → #C9B8E8 (base) → #F0EBFF (highlight)
      let r, g, b;
      if (lit < 0.5) {
        const t = lit * 2;
        r = Math.round(58  + t * (201 - 58));
        g = Math.round(42  + t * (184 - 42));
        b = Math.round(92  + t * (232 - 92));
      } else {
        const t = (lit - 0.5) * 2;
        r = Math.round(201 + t * (240 - 201));
        g = Math.round(184 + t * (235 - 184));
        b = Math.round(232 + t * (255 - 232));
      }

      // Craters: shift toward darker purple #4A3268
      if (crater > 0) {
        r = Math.round(r + crater * (74  - r));
        g = Math.round(g + crater * (50  - g));
        b = Math.round(b + crater * (104 - b));
      }

      const alpha = Math.min(1, facing * (0.55 + lit * 0.45));
      const dotR  = Math.max(0.35, 1.6 * facing * s);

      ctx.beginPath();
      ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
      ctx.fill();
    }

    ctx.restore();
  }

  function drawLines(sorted) {
    ctx.lineWidth = 0.5;
    for (let i = 0; i < sorted.length; i++) {
      const v  = sorted[i];
      const rx = v.projX + v.driftX;
      const ry = v.projY + v.driftY;
      if (v.lat < LAT_STEPS) {
        const nb  = grid[v.lat + 1][v.lon];
        const a   = Math.min(v._scale, nb._scale) * 0.35;
        const col = baseColor((v._rz + nb._rz) / 2);
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(nb.projX + nb.driftX, nb.projY + nb.driftY);
        ctx.stroke();
      }
      const nb2  = grid[v.lat][(v.lon + 1) % LON_STEPS];
      const a2   = Math.min(v._scale, nb2._scale) * 0.35;
      const col2 = baseColor((v._rz + nb2._rz) / 2);
      ctx.strokeStyle = `rgba(${col2[0]},${col2[1]},${col2[2]},${a2.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(nb2.projX + nb2.driftX, nb2.projY + nb2.driftY);
      ctx.stroke();
    }
  }

  function drawDots(sorted) {
    for (let i = 0; i < sorted.length; i++) {
      const v  = sorted[i];
      const a  = Math.min(1, v._scale * 1.6);
      const r  = Math.max(0.5, 2.0 * v._scale);
      const px = v.projX + v.driftX;
      const py = v.projY + v.driftY;

      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = heatColor(v._heatDist, a, v._rz);
      ctx.fill();
    }
  }

  function tick() {
    moonSelfAngle += MOON_SELF_SPEED;
    if (!moonDragging) {
      moonOrbitSpeed += (MOON_ORBIT_SPEED - moonOrbitSpeed) * MOON_ORBIT_DECAY;
      moonOrbitAngle += moonOrbitSpeed;
    }
    const moon = getMoonPos();

    rotSpeed += (ROT_SPEED - rotSpeed) * SPIN_DECAY;
    rotY += rotSpeed;
    updateProjections();
    updateSprings();
    updateRipple();
    sortedVertices.sort((a, b) => a._rz - b._rz);
    const sorted = sortedVertices;

    ctx.clearRect(0, 0, W, H);
    drawGlow();
    drawOrbitRing();

    if (!moonDragging && moon.mz > 0) {
      // Moon is behind the globe — draw first so globe renders on top
      drawMoon(moon);
      drawLines(sorted);
      drawDots(sorted);
    } else {
      // Moon in front, or being dragged — always draw on top so it stays visible
      drawLines(sorted);
      drawDots(sorted);
      drawMoon(moon);
    }

    requestAnimationFrame(tick);
  }

  function canvasCoords(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (W / rect.width),
      y: (e.clientY - rect.top)  * (H / rect.height),
    };
  }

  function computeDragWeights(grabbed) {
    for (let i = 0; i < vertices.length; i++) {
      const v   = vertices[i];
      const dot = (grabbed.x0 * v.x0 + grabbed.y0 * v.y0 + grabbed.z0 * v.z0) / (R * R);
      const ang = Math.acos(Math.max(-1, Math.min(1, dot)));
      v.dragWeight = ang < DRAG_ANGLE
        ? Math.cos((ang / DRAG_ANGLE) * (Math.PI / 2)) ** 2
        : 0;
      v.snapping = false; // cancel any in-progress snap when re-grabbing
    }
  }

  function init() {
    const canvas = document.getElementById('globe-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    canvas.width  = W;
    canvas.height = H;

    function updateCursor() {
      if (dragVertex || moonDragging) return;
      const m        = getMoonPos();
      const overMoon = Math.hypot(mouseX - m.px, mouseY - m.py) < MOON_R * m.s * 2.0;
      const overGlobe = Math.hypot(mouseX - cx, mouseY - cy) < R;
      canvas.style.cursor = (overMoon || overGlobe) ? 'grab' : 'default';
    }

    const releaseMoon = () => {
      if (!moonDragging) return;
      moonDragging  = false;
      moonOrbitSpeed = Math.max(-0.22, Math.min(0.22, moonDragVel * 2.0));
      if (!mouseInside) { mouseX = -9999; mouseY = -9999; }
      updateCursor();
    };

    const onRelease = () => {
      if (!dragVertex) return;

      const amp = Math.min(Math.hypot(dragVertex.driftX, dragVertex.driftY) * 0.5, 30);
      ripple = { startTime: Date.now(), ox: dragVertex.x0, oy: dragVertex.y0, oz: dragVertex.z0, amp };

      snapStartTime = Date.now();
      for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];
        if (v.dragWeight > 0) {
          v.snapping  = true;
          v._snapDX0  = v.driftX;
          v._snapDY0  = v.driftY;
          v.dragWeight = 0;
        }
      }

      const rawImpulse = dragVertex.driftX * IMPULSE_SCALE / R;
      rotSpeed += Math.max(-0.05, Math.min(0.05, rawImpulse));

      dragVertex = null;
      if (!mouseInside) { mouseX = -9999; mouseY = -9999; }
      updateCursor();
    };

    canvas.addEventListener('pointermove', e => {
      if (e.buttons === 0 && dragVertex)  onRelease();
      if (e.buttons === 0 && moonDragging) releaseMoon();
      const raw = canvasCoords(e, canvas);
      // Clamp to canvas bounds: with setPointerCapture the finger can slide off
      // the canvas edge, producing out-of-range coords that stretch grid lines
      // to the canvas corners ("smear" artifact on mobile).
      const x = Math.max(0, Math.min(W, raw.x));
      const y = Math.max(0, Math.min(H, raw.y));

      if (moonDragging) {
        const prev     = moonOrbitAngle;
        moonOrbitAngle = nearestOrbitAngle(x, y, moonOrbitAngle);
        const dAngle   = moonOrbitAngle - prev;
        moonDragVel    = moonDragVel * 0.7 + Math.max(-0.05, Math.min(0.05, dAngle)) * 0.3;
      }

      mouseX = x;
      mouseY = y;
      if (e.buttons === 0) updateCursor();
    });

    canvas.addEventListener('pointerenter', () => { mouseInside = true; });
    canvas.addEventListener('pointerleave', () => {
      mouseInside = false;
      if (!dragVertex && !moonDragging) { mouseX = -9999; mouseY = -9999; }
      canvas.style.cursor = 'default';
      releaseMoon();
    });

    canvas.addEventListener('pointerdown', e => {
      const raw = canvasCoords(e, canvas);
      const x = Math.max(0, Math.min(W, raw.x));
      const y = Math.max(0, Math.min(H, raw.y));
      // Sync position immediately so the first updateSprings() after pointerdown
      // sees a correct ddx/ddy instead of the stale -9999 initial value, which
      // would fling vertices off-canvas on the very first frame.
      mouseX = x;
      mouseY = y;
      mouseInside = true;

      // Moon grab takes priority — check it first
      const m     = getMoonPos();
      const grabR = MOON_R * m.s * 2.0;
      if (Math.hypot(x - m.px, y - m.py) < grabR) {
        moonDragging = true;
        moonDragVel  = 0;
        canvas.style.cursor = 'grabbing';
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      // Otherwise try to grab a globe vertex.
      // Use a larger radius for touch so a fingertip reliably hits something.
      const effectiveGrabRadius = e.pointerType === 'touch' ? 50 : GRAB_RADIUS;
      let nearest = null, bestDist = effectiveGrabRadius;
      for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];
        if (v._rz >= 0) continue; // skip back hemisphere
        const d = Math.hypot(x - v.projX, y - v.projY);
        if (d < bestDist) { bestDist = d; nearest = v; }
      }
      if (nearest) {
        dragVertex = nearest;
        computeDragWeights(nearest);
        canvas.style.cursor = 'grabbing';
      }
      canvas.setPointerCapture(e.pointerId);
    });

    window.addEventListener('pointerup', () => { onRelease(); releaseMoon(); });

    window.addEventListener('blackhole-explode', e => {
      const { x: bhX, y: bhY } = e.detail;
      const rect = canvas.getBoundingClientRect();
      const gcx  = rect.left + rect.width  / 2;
      const gcy  = rect.top  + rect.height / 2;
      // (nx, ny): unit vector FROM globe center TOWARD BH in screen space
      const ddx  = bhX - gcx;
      const ddy  = bhY - gcy;
      const dist = Math.hypot(ddx, ddy) || 1;
      const nx   = ddx / dist;
      const ny   = ddy / dist;
      const strength = Math.max(0.35, 1 - dist / 1200);

      // Globe: each vertex pushed AWAY from BH based on its own projected screen position
      // Spin driven by globe-center direction (Y-axis rotation, horizontal component only)
      rotSpeed += (bhX - gcx) / dist * strength * 0.05;

      snapStartTime = Date.now();
      for (const v of vertices) {
        const vsx  = rect.left + (v.projX / W) * rect.width;
        const vsy  = rect.top  + (v.projY / H) * rect.height;
        const vddx = vsx - bhX;
        const vddy = vsy - bhY;
        const vd   = Math.hypot(vddx, vddy) || 1;
        const mag  = strength * 32 * v._scale;
        v.driftX    += (vddx / vd) * mag;
        v.driftY    += (vddy / vd) * mag;
        v._snapDX0   = v.driftX;
        v._snapDY0   = v.driftY;
        v.snapping   = true;
        v.dragWeight = 0;
      }

      // Moon: pushed AWAY from BH based on the moon's own screen position.
      // Project onto the moon's orbital screen-space tangent for full XY response.
      const sinO    = Math.sin(moonOrbitAngle);
      const cosO    = Math.cos(moonOrbitAngle);
      const sinTilt = Math.sin(MOON_ORBIT_TILT);
      const cosTilt = Math.cos(MOON_ORBIT_TILT);
      const omx  =  MOON_ORBIT_R * cosO;
      const omy  = -MOON_ORBIT_R * sinO * sinTilt;
      const omz  =  MOON_ORBIT_R * sinO * cosTilt;
      const denom = FOV_DIST + omz + R;
      const s0   = FOV_DIST / denom;
      const domx = -MOON_ORBIT_R * sinO;
      const domy = -MOON_ORBIT_R * cosO * sinTilt;
      const domz =  MOON_ORBIT_R * cosO * cosTilt;
      const ds   = -FOV_DIST * domz / (denom * denom);
      const tdx  = domx * s0 + omx * ds;
      const tdy  = domy * s0 + omy * ds;
      const tmag = Math.hypot(tdx, tdy) || 1;
      // Moon's actual screen position (canvas → viewport CSS px)
      const moonSx = rect.left + ((cx + omx * s0) / W) * rect.width;
      const moonSy = rect.top  + ((cy + omy * s0) / H) * rect.height;
      // Direction from BH toward moon = push moon away from BH
      const mddx = moonSx - bhX;
      const mddy = moonSy - bhY;
      const mdist = Math.hypot(mddx, mddy) || 1;
      moonOrbitSpeed += (mddx / mdist * tdx + mddy / mdist * tdy) / tmag * strength * 1.2;
    });

    window.addEventListener('comet-globe-impact', e => {
      const { x: impX, y: impY, vx, vy } = e.detail;
      const rect = canvas.getBoundingClientRect();
      snapStartTime = Date.now();

      // Convert impact screen pos to canvas coords, find nearest front-hemisphere vertex for ripple
      const icx = (impX - rect.left) * (W / rect.width);
      const icy = (impY - rect.top)  * (H / rect.height);
      let nearest = null, bestDist = Infinity;
      for (const v of vertices) {
        const vsx  = rect.left + (v.projX / W) * rect.width;
        const vsy  = rect.top  + (v.projY / H) * rect.height;
        const vddx = vsx - impX, vddy = vsy - impY;
        const vd   = Math.hypot(vddx, vddy) || 1;
        const mag  = 0.4 * 18 * v._scale;
        v.driftX   += (vddx / vd) * mag;
        v.driftY   += (vddy / vd) * mag;
        v._snapDX0  = v.driftX;
        v._snapDY0  = v.driftY;
        v.snapping  = true;
        v.dragWeight = 0;
        if (v._rz < 0) {
          const d = Math.hypot(v.projX - icx, v.projY - icy);
          if (d < bestDist) { bestDist = d; nearest = v; }
        }
      }
      if (nearest) {
        ripple = { startTime: Date.now(), ox: nearest.x0, oy: nearest.y0, oz: nearest.z0, amp: 14 };
      }

      // Spin direction driven by horizontal momentum: leftward hit → positive spin (right side moves left)
      const speed = Math.hypot(vx, vy) || 1;
      rotSpeed += (-vx / speed) * 0.03;
    });

    window.addEventListener('comet-moon-impact', e => {
      const { vx, vy } = e.detail;
      const speed = Math.hypot(vx, vy) || 1;
      // Project comet velocity onto the moon's orbital tangent to get directional push
      const tangX = -Math.sin(moonOrbitAngle);
      const tangY = -Math.cos(moonOrbitAngle) * Math.sin(MOON_ORBIT_TILT);
      const tangLen = Math.hypot(tangX, tangY) || 1;
      const proj = (vx * tangX + vy * tangY) / (speed * tangLen);
      moonOrbitSpeed += proj * 0.08;
    });

    window.getMoonScreenPos = function () {
      const m   = getMoonPos();
      const rect = canvas.getBoundingClientRect();
      const scl  = rect.width / W;
      return { x: rect.left + m.px * scl, y: rect.top + m.py * scl, r: MOON_R * m.s * scl };
    };

    generateVertices();
    requestAnimationFrame(tick);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
