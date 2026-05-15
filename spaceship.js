// ── Spaceship ─────────────────────────────────────────────────────
(function () {
  const canvas = document.getElementById('stars-canvas');
  const ctx    = canvas.getContext('2d');

  let spaceship = null;

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

  function triggerShipExplosion() {
    if (!spaceship || spaceship.exploding) return;
    spaceship.active        = false;
    spaceship.exploding     = true;
    spaceship.explodeAge    = 0;
    spaceship.explodeMaxAge = 1.8;

    for (let i = 0; i < 42; i++) {
      const angle   = (Math.PI * 2 * i / 42) + (Math.random() - 0.5) * 0.55;
      const speed   = 140 + Math.random() * 340;
      const maxLife = 0.55 + Math.random() * 0.85;
      window.smokeParticles.push({
        x: spaceship.x + (Math.random() - 0.5) * 12,
        y: spaceship.y + (Math.random() - 0.5) * 12,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: maxLife, maxLife,
        r: 3.5 + Math.random() * 5.5,
        core: Math.random() < 0.55,
      });
    }
    for (let i = 0; i < 22; i++) {
      const angle   = Math.random() * Math.PI * 2;
      const speed   = 18 + Math.random() * 65;
      const maxLife = 0.9 + Math.random() * 0.85;
      window.smokeParticles.push({
        x: spaceship.x + (Math.random() - 0.5) * 18,
        y: spaceship.y + (Math.random() - 0.5) * 18,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: maxLife, maxLife,
        r: 7 + Math.random() * 10,
        core: false,
      });
    }
  }

  function updateSpaceship(dt) {
    if (!spaceship) return;

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

    if (spaceship.swirl) {
      const sw = spaceship.swirl;
      sw.age += dt;
      const frac = sw.age / sw.maxAge;
      if (frac >= 1) { spaceship = null; return; }
      const r     = sw.r * Math.pow(1 - frac, 0.65);
      sw.angle   += (3 + frac * 10) * dt;
      spaceship.x     = sw.bh.x + Math.cos(sw.angle) * r;
      spaceship.y     = sw.bh.y + Math.sin(sw.angle) * r;
      spaceship.angle = sw.angle + Math.PI / 2;
      spaceship.alpha = 1 - Math.pow(frac, 0.6);
      return;
    }

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
    if (spd > 12) {
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
            window.spawnImpactDebris && window.spawnImpactDebris(spaceship.x, spaceship.y);
            window.dispatchEvent(new CustomEvent('comet-globe-impact',
              { detail: { x: spaceship.x, y: spaceship.y, vx: inVx, vy: inVy, source: 'spaceship' } }));
            spaceship.hits++;
            if (spaceship.hits >= 10) triggerShipExplosion();
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
            window.spawnImpactDebris && window.spawnImpactDebris(spaceship.x, spaceship.y);
            window.dispatchEvent(new CustomEvent('comet-moon-impact',
              { detail: { vx: inVx, vy: inVy, source: 'spaceship' } }));
            spaceship.hits++;
            if (spaceship.hits >= 10) triggerShipExplosion();
          }
          spaceship.bounceCD = 0.5;
        } else if (dot < 0) {
          spaceship.vx -= dot * nx;
          spaceship.vy -= dot * ny;
        }
      }
    }

    const allBHs = window.BlackHole ? window.BlackHole.getAll() : [];
    for (const bh of allBHs) {
      const dx = bh.x - spaceship.x, dy = bh.y - spaceship.y;
      const d  = Math.hypot(dx, dy);
      if (d < bh.baseRadius * 3) {
        spaceship.swirl  = { bh, angle: Math.atan2(spaceship.y - bh.y, spaceship.x - bh.x), r: Math.max(d, 5), age: 0, maxAge: 0.9 };
        spaceship.active = false;
        break;
      }
    }

    if (!spaceship.active) {
      spaceship.alpha = Math.max(0, spaceship.alpha - dt * 1.3);
      if (spaceship.alpha <= 0) { spaceship = null; return; }
    }
  }

  function drawSpaceship() {
    if (!spaceship) return;
    ctx.save();

    if (spaceship.exploding) {
      const prog    = spaceship.explodeAge / spaceship.explodeMaxAge;
      const easeOut = t => 1 - Math.pow(1 - t, 3);

      const flashPeak = Math.sin(prog * Math.PI);
      if (flashPeak > 0.01) {
        const flash = ctx.createRadialGradient(spaceship.x, spaceship.y, 0, spaceship.x, spaceship.y, 145);
        flash.addColorStop(0,    `rgba(255, 252, 255, ${flashPeak * 0.98})`);
        flash.addColorStop(0.06, `rgba(255, 215, 255, ${flashPeak * 0.74})`);
        flash.addColorStop(0.22, `rgba(175,  95, 255, ${flashPeak * 0.40})`);
        flash.addColorStop(0.55, `rgba(100,  45, 200, ${flashPeak * 0.16})`);
        flash.addColorStop(1,    'rgba(0, 0, 0, 0)');
        ctx.fillStyle = flash;
        ctx.beginPath();
        ctx.arc(spaceship.x, spaceship.y, 145, 0, Math.PI * 2);
        ctx.fill();
      }

      const wave1R = easeOut(prog) * 230;
      ctx.beginPath();
      ctx.arc(spaceship.x, spaceship.y, wave1R, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(230, 200, 255, ${(1 - prog) * 0.92})`;
      ctx.lineWidth   = 5.5 * (1 - prog) + 0.4;
      ctx.shadowColor = 'rgba(215, 180, 255, 1)';
      ctx.shadowBlur  = 32;
      ctx.stroke();
      ctx.shadowBlur  = 0;

      if (prog > 0.12) {
        const p2     = (prog - 0.12) / 0.88;
        const wave2R = easeOut(p2) * 165;
        ctx.beginPath();
        ctx.arc(spaceship.x, spaceship.y, wave2R, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200, 158, 255, ${(1 - p2) * 0.58})`;
        ctx.lineWidth   = 3.2 * (1 - p2) + 0.3;
        ctx.shadowColor = 'rgba(190, 148, 255, 1)';
        ctx.shadowBlur  = 18;
        ctx.stroke();
        ctx.shadowBlur  = 0;
      }
    }

    const hits    = spaceship.hits;
    const hitFrac = Math.min(hits / 9, 1);
    const now     = Date.now();
    const cl = (a, b, t) => Math.round(a + (b - a) * t);
    let fl = 0, warnFreq = 0;
    if (hits >= 7) {
      warnFreq = [0.7, 1.3, 2.2][Math.min(hits - 7, 2)];
      fl = (Math.sin(now / 1000 * warnFreq * Math.PI * 2) + 1) / 2;
    }
    const topR = cl(cl(192, 255, hitFrac), 255, fl * 0.92);
    const topG = cl(cl(162,  65, hitFrac),  15, fl * 0.92);
    const topB = cl(cl(255,  65, hitFrac),  15, fl * 0.92);
    const midR = cl(cl(126, 215, hitFrac), 255, fl * 0.92);
    const midG = cl(cl( 90,  35, hitFrac),   5, fl * 0.92);
    const midB = cl(cl(228,  35, hitFrac),   5, fl * 0.92);
    const botR = cl(cl( 78, 170, hitFrac), 220, fl * 0.92);
    const botG = cl(cl( 55,  18, hitFrac),   2, fl * 0.92);
    const botB = cl(cl(180,  18, hitFrac),   2, fl * 0.92);
    const glR  = cl(cl(158, 255, hitFrac), 255, fl);
    const glG  = cl(cl(118,  45, hitFrac),   0, fl);
    const glB  = cl(cl(255,  45, hitFrac),   0, fl);
    const stR  = cl(220, 255, hitFrac);
    const stG  = cl(208, 140, hitFrac);
    const stB  = cl(255, 140, hitFrac);

    ctx.globalAlpha = spaceship.alpha;
    ctx.translate(spaceship.x, spaceship.y);

    if (hits >= 7 && !spaceship.swirl) {
      const period   = 1000 / warnFreq;
      const maxRingR = 55 + (hits - 7) * 14;
      ctx.save();
      for (let ri = 0; ri < 2; ri++) {
        const phase  = ((now + ri * period * 0.5) % period) / period;
        const ringR  = 14 + phase * maxRingR;
        const rAlpha = (1 - phase) * (0.45 + fl * 0.45);
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 20, 20, ${rAlpha})`;
        ctx.lineWidth   = (1 - phase) * 5 + 0.5;
        ctx.shadowColor = 'rgba(255, 0, 0, 1)';
        ctx.shadowBlur  = 18;
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.rotate(spaceship.angle);

    if (spaceship.swirl) {
      const s = Math.max(0, 1 - Math.pow(spaceship.swirl.age / spaceship.swirl.maxAge, 0.6));
      ctx.scale(s, s);
    }

    ctx.shadowColor = `rgba(${glR}, ${glG}, ${glB}, 0.9)`;
    ctx.shadowBlur  = 14 + (hits >= 7 ? fl * 28 : 0);

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
  }

  window.startSpaceship = function(x, y) {
    spaceship = { x, y, targetX: x, targetY: y, vx: 0, vy: 0, angle: 0, active: true, alpha: 1, emitAccum: 0, bounceCD: 0, hits: 0 };
  };
  window.updateSpaceshipTarget = function(x, y) {
    if (spaceship) { spaceship.targetX = x; spaceship.targetY = y; }
  };
  window.releaseSpaceship = function() {
    if (spaceship) spaceship.active = false;
  };

  window.Spaceship = {
    update:           updateSpaceship,
    draw:             drawSpaceship,
    get:              () => spaceship,
    triggerExplosion: triggerShipExplosion,
  };
})();
