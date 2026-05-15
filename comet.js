// ── Comet ─────────────────────────────────────────────────────────
(function () {
  const canvas = document.getElementById('stars-canvas');
  const ctx    = canvas.getContext('2d');

  let comets = [];

  function spawnImpactDebris(x, y) {
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = 60 + Math.random() * 120;
      window.smokeParticles.push({
        x, y,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        life: 0.3 + Math.random() * 0.2, maxLife: 0.5,
        r: 2 + Math.random() * 3,
        core: Math.random() < 0.5, comet: true,
      });
    }
  }

  function blastComet(c, srcX, srcY) {
    const dx   = c.x - srcX, dy = c.y - srcY;
    const dist = Math.hypot(dx, dy) || 1;
    const nx   = dx / dist, ny = dy / dist;
    for (let i = 0; i < 18; i++) {
      let sdx, sdy;
      if (i < 13) {
        const spread = (Math.random() - 0.5) * Math.PI * 1.4;
        const cs = Math.cos(spread), ss = Math.sin(spread);
        sdx = nx * cs - ny * ss;
        sdy = nx * ss + ny * cs;
      } else {
        const a = Math.random() * Math.PI * 2;
        sdx = Math.cos(a); sdy = Math.sin(a);
      }
      const spd     = 110 + Math.random() * 270;
      const maxLife = 0.28 + Math.random() * 0.32;
      window.smokeParticles.push({
        x: c.x + (Math.random() - 0.5) * 14,
        y: c.y + (Math.random() - 0.5) * 14,
        vx: sdx * spd, vy: sdy * spd,
        life: maxLife, maxLife,
        r: 1.5 + Math.random() * 2.5,
        core: Math.random() < 0.6, comet: true,
      });
    }
  }

  function spawnComet(x, y, vx, vy) {
    if (comets.length >= 5) blastComet(comets.shift(), x, y);
    comets.push({ x, y, vx, vy });
  }

  function updateComet(dt) {
    const allBHs  = window.BlackHole ? window.BlackHole.getAll() : [];
    const globeEl = document.getElementById('globe-canvas');
    const gr      = globeEl ? globeEl.getBoundingClientRect() : null;
    const moon    = window.getMoonScreenPos ? window.getMoonScreenPos() : null;
    const margin  = 120;

    // Comet-comet collisions
    for (let i = comets.length - 1; i >= 1; i--) {
      if (comets[i].swirl) continue;
      for (let j = i - 1; j >= 0; j--) {
        if (comets[j].swirl) continue;
        if (Math.hypot(comets[i].x - comets[j].x, comets[i].y - comets[j].y) < 18) {
          blastComet(comets[i], comets[j].x, comets[j].y);
          blastComet(comets[j], comets[i].x, comets[i].y);
          comets.splice(i, 1);
          comets.splice(j, 1);
          i = j;
          break;
        }
      }
    }

    for (let i = comets.length - 1; i >= 0; i--) {
      const c = comets[i];

      if (c.swirl) {
        const sw = c.swirl;
        sw.age += dt;
        const frac = sw.age / sw.maxAge;
        if (frac >= 1) { comets.splice(i, 1); continue; }
        const r   = sw.r * Math.pow(1 - frac, 0.65);
        sw.angle += (3 + frac * 10) * dt;
        c.x = sw.bh.x + Math.cos(sw.angle) * r;
        c.y = sw.bh.y + Math.sin(sw.angle) * r;
        continue;
      }

      for (const bh of allBHs) {
        const dx = bh.x - c.x, dy = bh.y - c.y;
        const d  = Math.hypot(dx, dy);
        if (d < bh.baseRadius * 3) {
          c.swirl = { bh, angle: Math.atan2(c.y - bh.y, c.x - bh.x), r: Math.max(d, 4), age: 0, maxAge: 0.75 };
          break;
        }
        if (d < bh.baseRadius * 20) {
          const g = 18000 / (d * d);
          c.vx += (dx / d) * g * dt;
          c.vy += (dy / d) * g * dt;
        }
      }
      if (c.swirl) continue;

      c.x += c.vx * dt;
      c.y += c.vy * dt;

      if (window.smokeParticles.length < 600) {
        const spd = Math.hypot(c.vx, c.vy) || 1;
        const bx  = -c.vx / spd, by = -c.vy / spd;
        for (let j = 0; j < 3; j++) {
          const spread = (Math.random() - 0.5) * 0.8;
          const cs = Math.cos(spread), ss = Math.sin(spread);
          window.smokeParticles.push({
            x: c.x + bx * 6 + (Math.random() - 0.5) * 4,
            y: c.y + by * 6 + (Math.random() - 0.5) * 4,
            vx: (bx * cs - by * ss) * (20 + Math.random() * 30),
            vy: (bx * ss + by * cs) * (20 + Math.random() * 30),
            life: 0.25 + Math.random() * 0.25,
            maxLife: 0.4,
            r: 1.5 + Math.random() * 2,
            core: Math.random() < 0.4,
            comet: true,
          });
        }
      }

      if (c.x < -margin || c.x > canvas.width  + margin ||
          c.y < -margin || c.y > canvas.height + margin) {
        comets.splice(i, 1); continue;
      }

      if (gr) {
        const gcx = gr.left + gr.width  / 2;
        const gcy = gr.top  + gr.height / 2;
        if (Math.hypot(c.x - gcx, c.y - gcy) < gr.width * 0.22) {
          window.dispatchEvent(new CustomEvent('comet-globe-impact',
            { detail: { x: c.x, y: c.y, vx: c.vx, vy: c.vy, source: 'comet' } }));
          spawnImpactDebris(c.x, c.y);
          comets.splice(i, 1); continue;
        }
      }

      if (moon && Math.hypot(c.x - moon.x, c.y - moon.y) < moon.r * 1.4) {
        window.dispatchEvent(new CustomEvent('comet-moon-impact',
          { detail: { x: c.x, y: c.y, vx: c.vx, vy: c.vy, source: 'comet' } }));
        spawnImpactDebris(c.x, c.y);
        comets.splice(i, 1); continue;
      }

      const ship = window.Spaceship && window.Spaceship.get();
      if (ship && !ship.exploding && Math.hypot(c.x - ship.x, c.y - ship.y) < 22) {
        ship.hits += 3;
        spawnImpactDebris(c.x, c.y);
        if (ship.hits >= 10) window.Spaceship.triggerExplosion();
        comets.splice(i, 1); continue;
      }
    }
  }

  function drawComet() {
    for (const c of comets) {
      if (c.swirl) {
        const frac  = c.swirl.age / c.swirl.maxAge;
        const scale = Math.max(0, 1 - Math.pow(frac, 0.55));
        if (scale < 0.02) continue;
        const r = Math.max(0.1, 10 * scale);
        ctx.save();
        ctx.globalAlpha = scale;
        ctx.shadowColor = 'rgba(160, 240, 255, 1)';
        ctx.shadowBlur  = 18 * scale;
        const cg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
        cg.addColorStop(0,   'rgba(255, 255, 255, 1)');
        cg.addColorStop(0.4, 'rgba(180, 240, 255, 0.85)');
        cg.addColorStop(1,   'rgba(60, 160, 255, 0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }

      const spd = Math.hypot(c.vx, c.vy);
      if (spd < 1) continue;
      const nx = c.vx / spd, ny = c.vy / spd;

      ctx.save();
      const tailLen = Math.min(60, spd * 0.1);
      const tx = c.x - nx * tailLen, ty = c.y - ny * tailLen;

      const tailGrad = ctx.createLinearGradient(c.x, c.y, tx, ty);
      tailGrad.addColorStop(0,   'rgba(220, 240, 255, 0.80)');
      tailGrad.addColorStop(0.3, 'rgba(100, 220, 255, 0.45)');
      tailGrad.addColorStop(1,   'rgba(60, 140, 255, 0)');
      ctx.strokeStyle = tailGrad;
      ctx.lineWidth   = 3.5;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      ctx.shadowColor = 'rgba(160, 240, 255, 1)';
      ctx.shadowBlur  = 18;
      const coreGrad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 10);
      coreGrad.addColorStop(0,   'rgba(255, 255, 255, 1)');
      coreGrad.addColorStop(0.4, 'rgba(180, 240, 255, 0.85)');
      coreGrad.addColorStop(1,   'rgba(60, 160, 255, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  window.spawnComet       = spawnComet;
  window.spawnImpactDebris = spawnImpactDebris;

  window.Comet = {
    update: updateComet,
    draw:   drawComet,
    blastInRadius(cx, cy, r) {
      for (let i = comets.length - 1; i >= 0; i--) {
        if (r >= Math.hypot(cx - comets[i].x, cy - comets[i].y) - 8) {
          blastComet(comets[i], cx, cy);
          comets.splice(i, 1);
        }
      }
    },
  };
})();
