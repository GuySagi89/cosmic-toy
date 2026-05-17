(function () {
  const LAT_STEPS    = 20;
  const LON_STEPS    = 40;
  const R            = 110;
  const TILT_X       = 0.35;
  const FOV_DIST     = 500;
  const ROT_SPEED     = 0.004;
  const SPIN_DECAY    = 0.03;
  const WAVE_SPEED   = 3.5;
  const W            = 500;
  const H            = 500;
  const cx           = W / 2;
  const cy           = H / 2;

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
  let ripple           = null;
  let snapStartTime    = 0;
  let frostPatches     = [];

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
          snapping: false, _snapDX0: 0, _snapDY0: 0,
          _scale: 1, _rz: 0,
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

  function updateSnap() {
    const snapT = (Date.now() - snapStartTime) / 1000;
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      if (!v.snapping) continue;
      v.driftX = snapEval(v._snapDX0, snapT);
      v.driftY = snapEval(v._snapDY0, snapT);
      if (snapT > 0.6) { v.driftX = 0; v.driftY = 0; v.snapping = false; }
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

  function drawLines(sorted) {
    ctx.lineWidth = 0.5;
    for (let i = 0; i < sorted.length; i++) {
      const v  = sorted[i];
      const rx = v.projX + v.driftX;
      const ry = v.projY + v.driftY;
      if (v.lat < LAT_STEPS) {
        const nb  = grid[v.lat + 1][v.lon];
        const a   = Math.min(v._scale, nb._scale) * 0.52;
        const col = baseColor((v._rz + nb._rz) / 2);
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(nb.projX + nb.driftX, nb.projY + nb.driftY);
        ctx.stroke();
      }
      const nb2  = grid[v.lat][(v.lon + 1) % LON_STEPS];
      const a2   = Math.min(v._scale, nb2._scale) * 0.52;
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
      const a  = Math.min(1, v._scale * 2.1);
      const r  = Math.max(0.5, 2.0 * v._scale);
      const px = v.projX + v.driftX;
      const py = v.projY + v.driftY;

      const [br, bg, bb] = baseColor(v._rz);
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${br},${bg},${bb},${a.toFixed(3)})`;
      ctx.fill();
    }
  }

  // Returns 0–1 opacity for a frost patch (persist 3 s, then fade 12 s), or -1 when expired.
  function frostAlpha(startTime) {
    const age = (Date.now() - startTime) / 1000;
    if (age >= 15.0) return -1;
    if (age <  3.0)  return 1.0;
    return 1.0 - (age - 3.0) / 12.0;
  }

  // backOnly=true  → draw only back-hemisphere faces (call BEFORE mesh)
  // backOnly=false → draw only front-hemisphere faces (call AFTER mesh)
  function drawGlobeFrost(backOnly) {
    for (let i = frostPatches.length - 1; i >= 0; i--) {
      if (frostAlpha(frostPatches[i].startTime) < 0) frostPatches.splice(i, 1);
    }
    if (!frostPatches.length) return;

    const cosR = Math.cos(rotY);
    const sinR = Math.sin(rotY);
    const FROST_R = 0.55;

    for (let lat = 0; lat < LAT_STEPS; lat++) {
      for (let lon = 0; lon < LON_STEPS; lon++) {
        const v00 = grid[lat][lon];
        const v10 = grid[lat + 1][lon];
        const v11 = grid[lat + 1][(lon + 1) % LON_STEPS];
        const v01 = grid[lat][(lon + 1) % LON_STEPS];

        const fcx = (v00.x0 + v10.x0 + v11.x0 + v01.x0) * 0.25;
        const fcy = (v00.y0 + v10.y0 + v11.y0 + v01.y0) * 0.25;
        const fcz = (v00.z0 + v10.z0 + v11.z0 + v01.z0) * 0.25;

        const rfcz = -fcx * sinR + fcz * cosR;
        const isBack = rfcz > 0;
        if (isBack !== backOnly) continue; // skip wrong pass

        // Back faces fade toward the pole; front faces are fully opaque at their depth
        const depthFade = isBack ? Math.max(0, 1 - rfcz / R) : 1.0;

        const fcLen = Math.sqrt(fcx*fcx + fcy*fcy + fcz*fcz) || 1;
        let maxW = 0;
        for (const p of frostPatches) {
          const fa = frostAlpha(p.startTime);
          if (fa <= 0) continue;
          const dot   = (p.ox*fcx + p.oy*fcy + p.oz*fcz) / (R * fcLen);
          const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
          if (angle < FROST_R) {
            const w = (1 - angle / FROST_R) ** 1.5 * fa * depthFade;
            if (w > maxW) maxW = w;
          }
        }
        if (maxW < 0.01) continue;

        ctx.beginPath();
        ctx.moveTo(v00.projX + v00.driftX, v00.projY + v00.driftY);
        ctx.lineTo(v10.projX + v10.driftX, v10.projY + v10.driftY);
        ctx.lineTo(v11.projX + v11.driftX, v11.projY + v11.driftY);
        ctx.lineTo(v01.projX + v01.driftX, v01.projY + v01.driftY);
        ctx.closePath();
        ctx.fillStyle = `rgba(240, 250, 255, ${(maxW * 0.72).toFixed(3)})`;
        ctx.fill();
      }
    }
  }


  function tick() {
    const moonDeployed = window.Moon.isDeployed();
    if (moonDeployed) window.Moon.update();
    const moon = moonDeployed ? window.Moon.getPos() : null;

    rotSpeed += (ROT_SPEED - rotSpeed) * SPIN_DECAY;
    rotY += rotSpeed;
    updateProjections();
    updateSnap();
    updateRipple();
    sortedVertices.sort((a, b) => a._rz - b._rz);
    const sorted = sortedVertices;

    ctx.clearRect(0, 0, W, H);
    drawGlow();
    if (moonDeployed) window.Moon.drawOrbitRing();

    if (moon && moon.mz > 0) {
      window.Moon.draw();
      drawGlobeFrost(true);
      drawLines(sorted);
      drawDots(sorted);
      drawGlobeFrost(false);
    } else {
      drawGlobeFrost(true);
      drawLines(sorted);
      drawDots(sorted);
      drawGlobeFrost(false);
      if (moon) window.Moon.draw();
    }

    if (window.ElectricField && window.ElectricField.isActive()) window.ElectricField.draw(ctx);

    requestAnimationFrame(tick);
  }

  function init() {
    const canvas = document.getElementById('globe-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    canvas.width  = W;
    canvas.height = H;

    window.addEventListener('blackhole-explode', e => {
      const { x: bhX, y: bhY } = e.detail;
      const rect = canvas.getBoundingClientRect();
      const gcx  = rect.left + rect.width  / 2;
      const gcy  = rect.top  + rect.height / 2;
      const ddx  = bhX - gcx;
      const ddy  = bhY - gcy;
      const dist = Math.hypot(ddx, ddy) || 1;
      const strength = Math.max(0.35, 1 - dist / 1200);

      // Globe spin
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
      }
    });

    window.addEventListener('comet-globe-impact', e => {
      const { x: impX, y: impY, vx, vy } = e.detail;
      const rect  = canvas.getBoundingClientRect();
      const speed = Math.hypot(vx, vy) || 1;
      const sf    = Math.min(speed / 400, 2.0);  // speedFactor: 1.0 at 400 px/s, capped at 2x
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
        const mag  = sf * 7.2 * v._scale;
        v.driftX   += (vddx / vd) * mag;
        v.driftY   += (vddy / vd) * mag;
        v._snapDX0  = v.driftX;
        v._snapDY0  = v.driftY;
        v.snapping  = true;
        if (v._rz < 0) {
          const d = Math.hypot(v.projX - icx, v.projY - icy);
          if (d < bestDist) { bestDist = d; nearest = v; }
        }
      }
      if (nearest) {
        ripple = { startTime: Date.now(), ox: nearest.x0, oy: nearest.y0, oz: nearest.z0, amp: sf * 14 };
        if (e.detail.source === 'comet') {
          frostPatches.push({ ox: nearest.x0, oy: nearest.y0, oz: nearest.z0, startTime: Date.now() });
        }
      }

      // Spin: direction from horizontal component, magnitude scales with speed
      rotSpeed += (-vx / speed) * 0.03 * sf;
    });

    window.triggerGlobeRipple = function(impX, impY) {
      const rect = canvas.getBoundingClientRect();
      const icx  = (impX - rect.left) * (W / rect.width);
      const icy  = (impY - rect.top)  * (H / rect.height);
      let nearest = null, bestDist = Infinity;
      for (const v of vertices) {
        if (v._rz < 0) {
          const d = Math.hypot(v.projX - icx, v.projY - icy);
          if (d < bestDist) { bestDist = d; nearest = v; }
        }
      }
      if (nearest) {
        ripple = { startTime: Date.now(), ox: nearest.x0, oy: nearest.y0, oz: nearest.z0, amp: 18 };
      }
    };

    generateVertices();
    requestAnimationFrame(tick);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
