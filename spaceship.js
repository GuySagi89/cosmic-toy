// ── Spaceship ─────────────────────────────────────────────────────
(function () {
  const canvas = document.getElementById('stars-canvas');
  const ctx    = canvas.getContext('2d');

  let spaceship    = null;
  let shipImpacts  = [];
  let shipDebris   = [];
  let tractorTarget  = null;
  let tractorActive  = false;
  let tractorOffsetX = 0;
  let tractorOffsetY = 0;
  let tractorPhase   = 0;
  let shipGrabbed  = false;
  let shipGrabHist = [];
  let shipNeonTint = null;

  function lerpAngle(a, b, t) {
    let d = (b - a) % (Math.PI * 2);
    if (d >  Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * Math.min(1, t);
  }

  function emitSmoke() {
    if (!spaceship) return;
    const bx = -Math.sin(spaceship.angle);
    const by =  Math.cos(spaceship.angle);
    const rx = spaceship.x + bx * 12 + (Math.random() - 0.5) * 3;
    const ry = spaceship.y + by * 12 + (Math.random() - 0.5) * 3;
    const spread = (Math.random() - 0.5) * 0.65;
    const cs = Math.cos(spread), ss = Math.sin(spread);
    const speed   = 32 + Math.random() * 35;
    const maxLife = 0.50 + Math.random() * 0.35;
    window.smokeParticles.push({
      x: rx, y: ry,
      vx: (bx * cs - by * ss) * speed + spaceship.vx * 0.12,
      vy: (bx * ss + by * cs) * speed + spaceship.vy * 0.12,
      life: maxLife, maxLife,
      r: 2.5 + Math.random() * 2.5,
      core: Math.random() < 0.45,
    });
  }

  function spawnBounceDebris(x, y, vx, vy) {
    if (!window.smokeParticles) return;
    const spd = Math.hypot(vx, vy) || 1;
    const nx  = vx / spd, ny = vy / spd;
    for (let i = 0; i < 28; i++) {
      const spread = (Math.random() - 0.5) * Math.PI * 2.0;
      const cs = Math.cos(spread), ss = Math.sin(spread);
      const dx = nx * cs - ny * ss, dy = nx * ss + ny * cs;
      const s  = 90 + Math.random() * 180;
      const ml = 0.30 + Math.random() * 0.30;
      window.smokeParticles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: dx * s, vy: dy * s,
        life: ml, maxLife: ml,
        r: 2.5 + Math.random() * 3.5,
        core: Math.random() < 0.5,
      });
    }
  }

  function spawnShipImpact(x, y) {
    shipImpacts.push({ x, y, age: 0, maxAge: 0.50 });
  }

  function drawShipImpacts() {
    for (const imp of shipImpacts) {
      const frac = imp.age / imp.maxAge;

      // Central flash — bright white-purple burst
      if (frac < 0.30) {
        const f2  = frac / 0.30;
        const fr  = 55 * (1 - f2);
        const fg  = ctx.createRadialGradient(imp.x, imp.y, 0, imp.x, imp.y, fr);
        fg.addColorStop(0,    `rgba(255, 248, 255, ${(1 - f2) * 0.98})`);
        fg.addColorStop(0.25, `rgba(210, 170, 255, ${(1 - f2) * 0.80})`);
        fg.addColorStop(0.60, `rgba(130,  70, 255, ${(1 - f2) * 0.45})`);
        fg.addColorStop(1,    'rgba(60, 20, 180, 0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(imp.x, imp.y, fr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Primary expanding ring
      const r1 = frac * 75;
      ctx.save();
      ctx.shadowColor = 'rgba(190, 130, 255, 1)';
      ctx.shadowBlur  = 14 * (1 - frac);
      ctx.globalAlpha = (1 - frac) * 0.90;
      ctx.strokeStyle = frac < 0.45 ? '#e8d8ff' : '#a060ff';
      ctx.lineWidth   = 3.5 * (1 - frac) + 0.4;
      ctx.beginPath();
      ctx.arc(imp.x, imp.y, Math.max(0.5, r1), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Secondary ring, slightly delayed
      if (frac > 0.12) {
        const f2 = (frac - 0.12) / 0.88;
        const r2 = f2 * 45;
        ctx.save();
        ctx.globalAlpha = (1 - f2) * 0.55;
        ctx.strokeStyle = '#cc99ff';
        ctx.lineWidth   = 2.0 * (1 - f2) + 0.2;
        ctx.beginPath();
        ctx.arc(imp.x, imp.y, Math.max(0.5, r2), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Debris shape library — points in local space, roughly matching the ship silhouette
  const DEBRIS_SHAPES = [
    [[0,-12],[-3,0],[3,0]],                        // nose tip
    [[-12,7],[-5,2],[-3,-3]],                      // left wing
    [[12,7],[5,2],[3,-3]],                         // right wing
    [[-3,-12],[3,-12],[2,-3],[-2,-3]],             // upper hull
    [[-4,0],[4,0],[3,7],[-3,7]],                   // mid hull
    [[-2,8],[2,8],[3,13],[-3,13]],                 // engine block
    [[-8,3],[-4,-1],[-2,5]],                       // left strut
    [[8,3],[4,-1],[2,5]],                          // right strut
    [[0,-8],[-5,2],[1,5]],                         // shard A
    [[2,-5],[6,0],[-1,6],[-4,1]],                  // shard B
  ];

  function spawnExplosionDebris(cx, cy, baseAngle) {
    for (const shape of DEBRIS_SHAPES) {
      const angle  = Math.random() * Math.PI * 2;
      const speed  = 70 + Math.random() * 220;
      const maxAge = 0.7 + Math.random() * 0.6;
      shipDebris.push({
        x: cx + (Math.random() - 0.5) * 14,
        y: cy + (Math.random() - 0.5) * 14,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        angle: baseAngle + (Math.random() - 0.5) * Math.PI,
        angVel: (Math.random() - 0.5) * 9,
        age: 0, maxAge, shape,
      });
    }
  }

  function drawShipDebris() {
    for (const d of shipDebris) {
      const frac  = d.age / d.maxAge;
      const alpha = Math.pow(1 - frac, 1.4);
      if (alpha < 0.02) continue;
      // bright white-purple → ship purple → dark purple
      const t = Math.min(1, frac * 2.0);
      const r = Math.round(t < 0.5 ? 225 - t * 2 * 80  : 145 - (t - 0.5) * 2 * 95);
      const g = Math.round(t < 0.5 ? 210 - t * 2 * 125 :  85 - (t - 0.5) * 2 * 60);
      const b = Math.round(t < 0.5 ? 255 - t * 2 * 25  : 230 - (t - 0.5) * 2 * 160);
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.angle);
      ctx.globalAlpha  = alpha;
      ctx.strokeStyle  = `rgb(${r},${g},${b})`;
      ctx.lineWidth    = 1.6;
      ctx.lineJoin     = 'round';
      ctx.shadowColor  = `rgb(${r},${g},${b})`;
      ctx.shadowBlur   = 6 * alpha;
      ctx.beginPath();
      ctx.moveTo(d.shape[0][0], d.shape[0][1]);
      for (let i = 1; i < d.shape.length; i++) ctx.lineTo(d.shape[i][0], d.shape[i][1]);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  function triggerShipExplosion() {
    if (!spaceship || spaceship.exploding) return;
    tractorActive = false;
    tractorTarget = null;
    spaceship.active        = false;
    spaceship.exploding     = true;
    spaceship.explodeAge    = 0;
    spaceship.explodeMaxAge = 1.1;

    // Fast directional burst
    for (let i = 0; i < 60; i++) {
      const angle   = (Math.PI * 2 * i / 60) + (Math.random() - 0.5) * 0.55;
      const speed   = 180 + Math.random() * 420;
      const maxLife = 0.35 + Math.random() * 0.45;
      window.smokeParticles.push({
        x: spaceship.x + (Math.random() - 0.5) * 14,
        y: spaceship.y + (Math.random() - 0.5) * 14,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: maxLife, maxLife,
        r: 4 + Math.random() * 6,
        core: Math.random() < 0.55,
      });
    }
    // Slow expanding fireball cloud
    for (let i = 0; i < 32; i++) {
      const angle   = Math.random() * Math.PI * 2;
      const speed   = 15 + Math.random() * 70;
      const maxLife = 0.55 + Math.random() * 0.55;
      window.smokeParticles.push({
        x: spaceship.x + (Math.random() - 0.5) * 22,
        y: spaceship.y + (Math.random() - 0.5) * 22,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: maxLife, maxLife,
        r: 9 + Math.random() * 13,
        core: false,
      });
    }

    spawnExplosionDebris(spaceship.x, spaceship.y, spaceship.angle);

    const BLAST_R = 280;
    const ex = spaceship.x, ey = spaceship.y;

    const globeEl = document.getElementById('globe-canvas');
    if (globeEl) {
      const gr   = globeEl.getBoundingClientRect();
      const gcx  = gr.left + gr.width  / 2;
      const gcy  = gr.top  + gr.height / 2;
      const ddx  = gcx - ex, ddy = gcy - ey;
      const dist = Math.hypot(ddx, ddy);
      if (dist < BLAST_R) {
        const strength = 1 - dist / BLAST_R;
        const spd = 500 * strength;
        window.dispatchEvent(new CustomEvent('comet-globe-impact', {
          detail: { x: ex, y: ey, vx: (ddx / dist) * spd, vy: (ddy / dist) * spd, source: 'spaceship' }
        }));
      }
    }

    const moon = window.getMoonScreenPos && window.getMoonScreenPos();
    if (moon) {
      const ddx  = moon.x - ex, ddy = moon.y - ey;
      const dist = Math.hypot(ddx, ddy);
      if (dist < BLAST_R) {
        const strength = 1 - dist / BLAST_R;
        const spd = 500 * strength;
        window.dispatchEvent(new CustomEvent('comet-moon-impact', {
          detail: { x: moon.x, y: moon.y, vx: (ddx / dist) * spd, vy: (ddy / dist) * spd, source: 'spaceship' }
        }));
      }
    }
  }

  function updateSpaceship(dt) {
    for (let i = shipImpacts.length - 1; i >= 0; i--) {
      shipImpacts[i].age += dt;
      if (shipImpacts[i].age >= shipImpacts[i].maxAge) shipImpacts.splice(i, 1);
    }
    for (let i = shipDebris.length - 1; i >= 0; i--) {
      const d = shipDebris[i];
      d.age   += dt;
      if (d.age >= d.maxAge) { shipDebris.splice(i, 1); continue; }
      d.x     += d.vx * dt;
      d.y     += d.vy * dt;
      d.angle += d.angVel * dt;
    }
    tractorPhase = (tractorPhase + dt * 5) % (Math.PI * 2);

    if (!spaceship) return;

    // Rigidly carry the tractor target at its locked offset from the ship
    if (tractorActive && tractorTarget) {
      if (tractorTarget.dead || tractorTarget.swirl) {
        tractorTarget = null;
        tractorActive = false;
      } else {
        tractorTarget.x  = spaceship.x + tractorOffsetX;
        tractorTarget.y  = spaceship.y + tractorOffsetY;
        tractorTarget.vx = 0;
        tractorTarget.vy = 0;
      }
    }

    if (spaceship.exploding) {
      spaceship.explodeAge += dt;
      spaceship.alpha = Math.max(0, 1 - spaceship.explodeAge / (spaceship.explodeMaxAge * 0.28));
      spaceship.vx *= Math.pow(0.95, dt * 60);
      spaceship.vy *= Math.pow(0.95, dt * 60);
      spaceship.x  += spaceship.vx * dt;
      spaceship.y  += spaceship.vy * dt;
      if (spaceship.explodeAge >= spaceship.explodeMaxAge) spaceship = null;
      return;
    }

    if (shipGrabbed) return;

    if (spaceship.active) {
      const dx   = spaceship.targetX - spaceship.x;
      const dy   = spaceship.targetY - spaceship.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 2) {
        const gain = 28;
        spaceship.vx += (dx / dist) * Math.min(dist, 160) * gain * dt;
        spaceship.vy += (dy / dist) * Math.min(dist, 160) * gain * dt;
      }
    }

    const speed = Math.hypot(spaceship.vx, spaceship.vy);
    if (speed > 520) {
      spaceship.vx = spaceship.vx / speed * 520;
      spaceship.vy = spaceship.vy / speed * 520;
    }

    const drag = Math.pow(spaceship.active ? 0.97 : 0.96, dt * 60);
    spaceship.vx *= drag;
    spaceship.vy *= drag;

    spaceship.x += spaceship.vx * dt;
    spaceship.y += spaceship.vy * dt;

    const spd = Math.hypot(spaceship.vx, spaceship.vy);
    if (spaceship._aimX != null) {
      const aimDx = spaceship._aimX - spaceship.x;
      const aimDy = spaceship._aimY - spaceship.y;
      if (Math.hypot(aimDx, aimDy) > 5) {
        spaceship.angle = Math.atan2(aimDy, aimDx) + Math.PI / 2;
      }
    } else if (spd > 12) {
      spaceship.angle = lerpAngle(
        spaceship.angle,
        Math.atan2(spaceship.vy, spaceship.vx) + Math.PI / 2,
        Math.min(1, dt * 14)
      );
    }

    if (spd > 25 && window.smokeParticles.length < 300) {
      spaceship.emitAccum += dt * (spd / 80) * 60;
      while (spaceship.emitAccum >= 1) { emitSmoke(); spaceship.emitAccum--; }
    }

    if (spaceship.bounceCD > 0) spaceship.bounceCD -= dt;

    const globeEl = document.getElementById('globe-canvas');
    if (globeEl) {
      const gr     = globeEl.getBoundingClientRect();
      const gcx    = gr.left + gr.width  / 2;
      const gcy    = gr.top  + gr.height / 2;
      const globeR = gr.width * 0.22;
      const bdx    = spaceship.x - gcx, bdy = spaceship.y - gcy;
      const bdist  = Math.hypot(bdx, bdy);
      if (bdist < globeR + 8) {
        const nx  = bdx / (bdist || 1), ny = bdy / (bdist || 1);
        spaceship.x = gcx + nx * (globeR + 8);
        spaceship.y = gcy + ny * (globeR + 8);
        const dot = spaceship.vx * nx + spaceship.vy * ny;
        if (spaceship.bounceCD <= 0) {
          if (dot < 0) {
            const inVx = spaceship.vx, inVy = spaceship.vy;
            spaceship.vx = (spaceship.vx - 2 * dot * nx) * 0.65;
            spaceship.vy = (spaceship.vy - 2 * dot * ny) * 0.65;
            spawnBounceDebris(spaceship.x, spaceship.y, inVx, inVy);
            spawnShipImpact(spaceship.x, spaceship.y);
            window.dispatchEvent(new CustomEvent('comet-globe-impact',
              { detail: { x: spaceship.x, y: spaceship.y, vx: inVx, vy: inVy, source: 'spaceship' } }));
          }
          spaceship.bounceCD = 0.5;
        } else if (dot < 0) {
          spaceship.vx -= dot * nx;
          spaceship.vy -= dot * ny;
        }
      }
    }

    if (window.getMoonScreenPos) {
      const m     = window.getMoonScreenPos();
      const bdx   = spaceship.x - m.x, bdy = spaceship.y - m.y;
      const bdist = Math.hypot(bdx, bdy);
      if (bdist < m.r + 8) {
        const nx  = bdx / (bdist || 1), ny = bdy / (bdist || 1);
        spaceship.x = m.x + nx * (m.r + 8);
        spaceship.y = m.y + ny * (m.r + 8);
        const dot = spaceship.vx * nx + spaceship.vy * ny;
        if (spaceship.bounceCD <= 0) {
          if (dot < 0) {
            const inVx = spaceship.vx, inVy = spaceship.vy;
            spaceship.vx = (spaceship.vx - 2 * dot * nx) * 0.65;
            spaceship.vy = (spaceship.vy - 2 * dot * ny) * 0.65;
            spawnBounceDebris(spaceship.x, spaceship.y, inVx, inVy);
            spawnShipImpact(spaceship.x, spaceship.y);
            window.dispatchEvent(new CustomEvent('comet-moon-impact',
              { detail: { vx: inVx, vy: inVy, source: 'spaceship' } }));
          }
          spaceship.bounceCD = 0.5;
        } else if (dot < 0) {
          spaceship.vx -= dot * nx;
          spaceship.vy -= dot * ny;
        }
      }
    }

    // Canvas bounds — reflect velocity, no health penalty
    const MARGIN = 20;
    if (spaceship.x < MARGIN && spaceship.vx < 0) {
      spaceship.x  = MARGIN;
      spaceship.vx = -spaceship.vx * 0.65;
    } else if (spaceship.x > canvas.width - MARGIN && spaceship.vx > 0) {
      spaceship.x  = canvas.width - MARGIN;
      spaceship.vx = -spaceship.vx * 0.65;
    }
    if (spaceship.y < MARGIN && spaceship.vy < 0) {
      spaceship.y  = MARGIN;
      spaceship.vy = -spaceship.vy * 0.65;
    } else if (spaceship.y > canvas.height - MARGIN && spaceship.vy > 0) {
      spaceship.y  = canvas.height - MARGIN;
      spaceship.vy = -spaceship.vy * 0.65;
    }


  }

  function drawTractorBeam() {
    if (!tractorActive || !tractorTarget || !spaceship || spaceship.exploding) return;
    const a = tractorTarget;
    if (a.dead) return;

    const sx  = spaceship.x, sy  = spaceship.y;
    const ax  = a.x,         ay  = a.y;
    const ddx = ax - sx,     ddy = ay - sy;
    const dist = Math.hypot(ddx, ddy);
    if (dist < 2) return;

    const nx = ddx / dist, ny = ddy / dist;
    const px = -ny,        py = nx;
    const gs = window.gadgetScale || 1;
    const ph = tractorPhase;

    // Outer soft glow
    ctx.save();
    ctx.globalAlpha = 0.14 + Math.sin(ph * 1.5) * 0.04;
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth   = 14 * gs;
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur  = 28;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ax, ay);
    ctx.stroke();
    ctx.restore();

    // Sine-wave core beam
    const segs = Math.max(12, Math.floor(dist / 8));
    ctx.save();
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur  = 10;
    ctx.globalAlpha = 0.65 + Math.sin(ph * 2) * 0.12;
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth   = 2 * gs;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    for (let i = 0; i <= segs; i++) {
      const bt   = i / segs;
      const env  = Math.sin(bt * Math.PI);
      const wave = Math.sin(bt * Math.PI * 8 - ph * 3.5) * 6 * env;
      const bx   = sx + ddx * bt + px * wave;
      const by_  = sy + ddy * bt + py * wave;
      if (i === 0) ctx.moveTo(bx, by_);
      else         ctx.lineTo(bx, by_);
    }
    ctx.stroke();
    ctx.restore();

    // Energy blobs traveling ship → asteroid
    for (let i = 0; i < 4; i++) {
      const blobT = ((i / 4) + (ph / (Math.PI * 2)) * 0.9) % 1;
      const bx    = sx + ddx * blobT;
      const by_   = sy + ddy * blobT;
      const alpha = Math.sin(blobT * Math.PI) * 0.9;
      if (alpha < 0.05) continue;
      const blobR = 5 * gs;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = '#00f5ff';
      ctx.shadowBlur  = 14;
      const bg = ctx.createRadialGradient(bx, by_, 0, bx, by_, blobR * 2);
      bg.addColorStop(0,    'rgba(220, 255, 255, 1)');
      bg.addColorStop(0.35, 'rgba(0, 245, 255, 0.9)');
      bg.addColorStop(1,    'rgba(0, 245, 255, 0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(bx, by_, blobR * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Ship-end pulsing ring
    ctx.save();
    ctx.globalAlpha = 0.55 + Math.sin(ph * 3) * 0.2;
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur  = 20;
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth   = 1.8 * gs;
    ctx.beginPath();
    ctx.arc(sx, sy, 16 * gs, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Asteroid-end pulsing ring
    ctx.save();
    ctx.globalAlpha = 0.45 + Math.sin(ph * 3 + 1.2) * 0.2;
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur  = 18;
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth   = 2 * gs;
    ctx.beginPath();
    ctx.arc(ax, ay, a.r * 1.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawSpaceship() {
    drawShipImpacts();
    drawShipDebris();
    drawTractorBeam();
    if (!spaceship) return;
    ctx.save();

    if (spaceship.exploding) {
      const prog    = spaceship.explodeAge / spaceship.explodeMaxAge;
      const easeOut = t => 1 - Math.pow(1 - t, 3);

      // White-hot core flash with fire-to-purple gradient
      const flashPeak = Math.sin(prog * Math.PI) * (1 - prog);
      if (flashPeak > 0.01) {
        const flash = ctx.createRadialGradient(spaceship.x, spaceship.y, 0, spaceship.x, spaceship.y, 220);
        flash.addColorStop(0,    `rgba(255, 255, 255,  ${flashPeak * 0.99})`);
        flash.addColorStop(0.04, `rgba(255, 245, 200,  ${flashPeak * 0.95})`);
        flash.addColorStop(0.12, `rgba(255, 160,  40,  ${flashPeak * 0.75})`);
        flash.addColorStop(0.28, `rgba(200,  80, 255,  ${flashPeak * 0.45})`);
        flash.addColorStop(0.55, `rgba( 90,  30, 180,  ${flashPeak * 0.18})`);
        flash.addColorStop(1,    'rgba(0, 0, 0, 0)');
        ctx.fillStyle = flash;
        ctx.beginPath();
        ctx.arc(spaceship.x, spaceship.y, 220, 0, Math.PI * 2);
        ctx.fill();
      }

      // Fast shockwave — fire-orange, gone by halfway
      const shockFrac = Math.min(1, prog * 2.2);
      if (shockFrac < 1) {
        const shockR = easeOut(shockFrac) * 340;
        ctx.save();
        ctx.globalAlpha = (1 - shockFrac) * 0.80;
        ctx.shadowColor = 'rgba(255, 200, 80, 1)';
        ctx.shadowBlur  = 22;
        ctx.strokeStyle = `rgba(255, 210, 100, ${(1 - shockFrac) * 0.85})`;
        ctx.lineWidth   = 5.5 * (1 - shockFrac) + 0.4;
        ctx.beginPath();
        ctx.arc(spaceship.x, spaceship.y, Math.max(1, shockR), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Fire ring — orange, mid-speed
      if (prog > 0.04) {
        const pf     = (prog - 0.04) / 0.96;
        const fireR  = easeOut(pf) * 200;
        ctx.save();
        ctx.globalAlpha = (1 - pf) * 0.70;
        ctx.shadowColor = 'rgba(255, 120, 30, 1)';
        ctx.shadowBlur  = 18;
        ctx.strokeStyle = `rgba(255, 145, 50, ${(1 - pf) * 0.80})`;
        ctx.lineWidth   = 4.0 * (1 - pf) + 0.3;
        ctx.beginPath();
        ctx.arc(spaceship.x, spaceship.y, Math.max(1, fireR), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Primary purple ring
      const wave1R = easeOut(prog) * 270;
      ctx.save();
      ctx.globalAlpha = (1 - prog) * 0.92;
      ctx.shadowColor = 'rgba(215, 180, 255, 1)';
      ctx.shadowBlur  = 36;
      ctx.strokeStyle = `rgba(230, 200, 255, ${(1 - prog) * 0.95})`;
      ctx.lineWidth   = 6.0 * (1 - prog) + 0.4;
      ctx.beginPath();
      ctx.arc(spaceship.x, spaceship.y, Math.max(1, wave1R), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Secondary purple ring, delayed
      if (prog > 0.10) {
        const p2     = (prog - 0.10) / 0.90;
        const wave2R = easeOut(p2) * 190;
        ctx.save();
        ctx.globalAlpha = (1 - p2) * 0.62;
        ctx.shadowColor = 'rgba(190, 148, 255, 1)';
        ctx.shadowBlur  = 20;
        ctx.strokeStyle = `rgba(200, 158, 255, ${(1 - p2) * 0.70})`;
        ctx.lineWidth   = 3.5 * (1 - p2) + 0.3;
        ctx.beginPath();
        ctx.arc(spaceship.x, spaceship.y, Math.max(1, wave2R), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Third ring — cool blue-purple trailing wave
      if (prog > 0.22) {
        const p3     = (prog - 0.22) / 0.78;
        const wave3R = easeOut(p3) * 130;
        ctx.save();
        ctx.globalAlpha = (1 - p3) * 0.45;
        ctx.shadowColor = 'rgba(130, 180, 255, 1)';
        ctx.shadowBlur  = 14;
        ctx.strokeStyle = `rgba(160, 200, 255, ${(1 - p3) * 0.55})`;
        ctx.lineWidth   = 2.4 * (1 - p3) + 0.2;
        ctx.beginPath();
        ctx.arc(spaceship.x, spaceship.y, Math.max(1, wave3R), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    const topR = 192, topG = 162, topB = 255;
    const midR = 126, midG =  90, midB = 228;
    const botR =  78, botG =  55, botB = 180;
    const glR  = 158, glG  = 118, glB  = 255;
    const stR  = 220, stG  = 208, stB  = 255;

    const gs = window.gadgetScale || 1;
    ctx.globalAlpha = spaceship.alpha;
    ctx.translate(spaceship.x, spaceship.y);
    ctx.scale(gs, gs);

    ctx.rotate(spaceship.angle);

    if (spaceship.swirl) {
      const s = Math.max(0, 1 - Math.pow(spaceship.swirl.age / spaceship.swirl.maxAge, 0.6));
      ctx.scale(s, s);
    }

    ctx.shadowColor = `rgba(${glR}, ${glG}, ${glB}, 0.9)`;
    ctx.shadowBlur  = 14;

    ctx.beginPath();
    ctx.moveTo( 0, -15);
    ctx.lineTo(-12,   7);
    ctx.lineTo( -5,   2);
    ctx.lineTo(  0,  11);
    ctx.lineTo(  5,   2);
    ctx.lineTo( 12,   7);
    ctx.closePath();

    const bg = ctx.createLinearGradient(0, -15, 0, 11);
    bg.addColorStop(0,   `rgba(${topR}, ${topG}, ${topB}, 0.97)`);
    bg.addColorStop(0.5, `rgba(${midR}, ${midG}, ${midB}, 0.93)`);
    bg.addColorStop(1,   `rgba(${botR}, ${botG}, ${botB}, 0.88)`);
    ctx.fillStyle = bg;
    ctx.fill();

    ctx.shadowBlur  = 0;
    ctx.strokeStyle = `rgba(${stR}, ${stG}, ${stB}, 0.92)`;
    ctx.lineWidth   = 1.2;
    ctx.lineJoin    = 'round';
    ctx.stroke();

    ctx.shadowColor = 'rgba(148, 232, 255, 0.9)';
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.ellipse(0, -6, 2.5, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle   = 'rgba(172, 238, 255, 0.92)';
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = 'rgba(210, 248, 255, 0.50)';
    ctx.lineWidth   = 0.7;
    ctx.stroke();

    ctx.restore();

    if (shipNeonTint && spaceship && !spaceship.exploding) {
      const age = (Date.now() - shipNeonTint.startTime) / 1000;
      const fa = age < 2.0 ? 1.0 : 1.0 - (age - 2.0) / 0.6;
      if (fa <= 0) { shipNeonTint = null; }
      else {
        const gs = window.gadgetScale || 1;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const sg = ctx.createRadialGradient(spaceship.x, spaceship.y, 0, spaceship.x, spaceship.y, 28 * gs);
        sg.addColorStop(0, `rgba(${shipNeonTint.r},${shipNeonTint.g},${shipNeonTint.b},${(fa * 0.65).toFixed(3)})`);
        sg.addColorStop(1, `rgba(${shipNeonTint.r},${shipNeonTint.g},${shipNeonTint.b},0)`);
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(spaceship.x, spaceship.y, 28 * gs, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

  }

  window.startSpaceship = function(x, y) {
    if (!spaceship) {
      spaceship = { x, y, targetX: x, targetY: y, vx: 0, vy: 0, angle: 0, active: true, alpha: 1, emitAccum: 0, bounceCD: 0 };
    } else if (!spaceship.exploding && !spaceship.swirl) {
      spaceship.targetX = x;
      spaceship.targetY = y;
      spaceship.active  = true;
      spaceship.alpha   = 1;
    }
  };
  window.updateSpaceshipTarget = function(x, y) {
    if (spaceship) { spaceship.targetX = x; spaceship.targetY = y; }
  };
  window.releaseSpaceship = function() {
    if (spaceship) spaceship.active = false;
  };

  window.activateTractorBeam = function(targetX, targetY) {
    if (!spaceship || spaceship.exploding || spaceship.swirl) return;
    if (tractorActive) {
      tractorActive = false;
      tractorTarget = null;
      return;
    }
    if (!window.Asteroids) return;
    const allAsteroids = window.Asteroids.getAll();
    let nearest = null;
    let nearestDist = 300;
    for (const a of allAsteroids) {
      if (a.dead || a.swirl) continue;
      const d = Math.hypot(a.x - targetX, a.y - targetY);
      if (d < nearestDist) { nearestDist = d; nearest = a; }
    }
    if (nearest) {
      tractorTarget  = nearest;
      tractorOffsetX = nearest.x - spaceship.x;
      tractorOffsetY = nearest.y - spaceship.y;
      tractorActive  = true;
    }
  };

  window.Spaceship = {
    update:           updateSpaceship,
    draw:             drawSpaceship,
    get:              () => spaceship,
    triggerExplosion: triggerShipExplosion,
    hit(x, y, vx, vy) {
      if (!spaceship || spaceship.exploding || spaceship.swirl) return;
      spawnShipImpact(x, y);
      spawnBounceDebris(x, y, vx, vy);
    },
    tryGrab(sx, sy) {
      if (!spaceship || spaceship.exploding || spaceship.swirl) return false;
      if (Math.hypot(sx - spaceship.x, sy - spaceship.y) < 28) {
        shipGrabbed = true;
        spaceship.active = false;
        spaceship.vx = 0; spaceship.vy = 0;
        shipGrabHist = [{ x: sx, y: sy, t: performance.now() }];
        return true;
      }
      return false;
    },
    onGrabMove(sx, sy) {
      if (!spaceship || !shipGrabbed) return;
      spaceship.x = sx; spaceship.y = sy;
      spaceship.vx = 0; spaceship.vy = 0;
      shipGrabHist.push({ x: sx, y: sy, t: performance.now() });
      if (shipGrabHist.length > 12) shipGrabHist.shift();
    },
    onGrabRelease() {
      if (!spaceship || !shipGrabbed) return;
      const now = performance.now();
      const recent = shipGrabHist.filter(h => now - h.t < 80);
      let vx = 0, vy = 0;
      if (recent.length >= 2) {
        const f = recent[0], l = recent[recent.length - 1];
        const dt = (l.t - f.t) / 1000;
        if (dt > 0.005) {
          vx = (l.x - f.x) / dt; vy = (l.y - f.y) / dt;
          const spd = Math.hypot(vx, vy);
          if (spd > 600) { vx = vx / spd * 600; vy = vy / spd * 600; }
        }
      }
      shipGrabbed = false;
      spaceship.vx = vx; spaceship.vy = vy;
    },
    onGrabCancel() {
      if (!spaceship || !shipGrabbed) return;
      shipGrabbed = false;
      spaceship.vx = 0; spaceship.vy = 0;
    },
    isGrabbed() { return shipGrabbed; },
    applyNeonTint(r, g, b) { shipNeonTint = { r, g, b, startTime: Date.now() }; },
  };
})();
