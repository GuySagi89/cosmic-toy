// ── Comet ─────────────────────────────────────────────────────────
(function () {
  const canvas = document.getElementById('stars-canvas');
  const ctx    = canvas.getContext('2d');
  const { updateCooldownUI, getGlobeBounds } = window.CosmicUtils;

  let comets      = [];
  let explosions  = [];
  let freezeRings = [];

  function spawnImpactDebris(x, y, vx, vy) {
    const spd  = Math.hypot(vx, vy) || 1;
    const nx   = vx / spd, ny = vy / spd;
    for (let i = 0; i < 55; i++) {
      const directional = i < 36;
      const spread = directional
        ? (Math.random() - 0.5) * Math.PI * 1.5
        : Math.random() * Math.PI * 2;
      const cs = Math.cos(spread), ss = Math.sin(spread);
      const dx = directional ? nx * cs - ny * ss : Math.cos(spread);
      const dy = directional ? nx * ss + ny * cs : Math.sin(spread);
      const s  = 300 + Math.random() * 500;
      const ml = 0.9 + Math.random() * 0.7;
      window.smokeParticles.push({
        x: x + (Math.random() - 0.5) * 12,
        y: y + (Math.random() - 0.5) * 12,
        vx: dx * s, vy: dy * s,
        life: ml, maxLife: ml,
        r: 5 + Math.random() * 10,
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

  function spawnExplosion(x, y) {
    explosions.push({ x, y, age: 0, maxAge: 0.65 });
  }

  function spawnFreezeRing(x, y) {
    freezeRings.push({ x, y, r: 0, maxR: 240, speed: 480, fadingOut: false, fadeAge: 0, maxFadeAge: 0.30 });
  }

  function spawnFreezeExplosion(x, y) {
    explosions.push({ x, y, age: 0, maxAge: 0.80, freeze: true });
    if (!window.smokeParticles) return;
    for (let i = 0; i < 45; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = 60 + Math.random() * 300;
      const ml    = 0.35 + Math.random() * 0.55;
      window.smokeParticles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        life: ml, maxLife: ml,
        r: 2.5 + Math.random() * 6,
        core: Math.random() < 0.4, ice: true,
      });
    }
  }

  function drawFreezeExplosion(exp, gs = 1) {
    const frac = exp.age / exp.maxAge;

    if (frac < 0.38) {
      const f2 = frac / 0.38;
      const r  = ((1 - f2) * 52 + 6) * gs;
      const fg = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, r);
      fg.addColorStop(0,    `rgba(255,255,255,${(1 - f2) * 0.95})`);
      fg.addColorStop(0.30, `rgba(200,248,255,${(1 - f2) * 0.72})`);
      fg.addColorStop(1,    'rgba(80,180,255,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, (1 - frac) * 0.90);
    ctx.strokeStyle = frac < 0.50 ? 'rgba(235,252,255,1)' : 'rgba(140,215,255,0.85)';
    ctx.lineWidth   = ((1 - frac) * 3.5 + 0.4) * gs;
    ctx.shadowColor = 'rgba(160,230,255,0.8)';
    ctx.shadowBlur  = 20 * (1 - frac) * gs;
    ctx.beginPath();
    ctx.arc(exp.x, exp.y, Math.max(0.5, frac * 105 * gs), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (frac > 0.10) {
      const f2 = (frac - 0.10) / 0.90;
      ctx.save();
      ctx.globalAlpha = Math.max(0, (1 - f2) * 0.58);
      ctx.strokeStyle = 'rgba(185,238,255,0.9)';
      ctx.lineWidth   = ((1 - f2) * 2.2 + 0.3) * gs;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, Math.max(0.5, f2 * 68 * gs), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawExplosion(exp, gs = 1) {
    if (exp.freeze) { drawFreezeExplosion(exp, gs); return; }
    const frac = exp.age / exp.maxAge;

    if (frac < 0.5) {
      const f2 = frac / 0.5;
      const r  = ((1 - f2) * 45 + 6) * gs;
      const fg = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, r);
      fg.addColorStop(0,    `rgba(255,255,255,${(1 - f2) * 0.92})`);
      fg.addColorStop(0.35, `rgba(180,245,255,${(1 - f2) * 0.65})`);
      fg.addColorStop(1,    'rgba(60,160,255,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, (1 - frac) * 0.90);
    ctx.strokeStyle = frac < 0.45 ? 'rgba(210,248,255,1)' : 'rgba(80,185,255,0.85)';
    ctx.lineWidth   = ((1 - frac) * 3.5 + 0.4) * gs;
    ctx.shadowColor = 'rgba(100,220,255,0.7)';
    ctx.shadowBlur  = 18 * (1 - frac) * gs;
    ctx.beginPath();
    ctx.arc(exp.x, exp.y, Math.max(0.5, frac * 85 * gs), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (frac > 0.08) {
      const f2 = (frac - 0.08) / 0.92;
      ctx.save();
      ctx.globalAlpha = Math.max(0, (1 - f2) * 0.55);
      ctx.strokeStyle = 'rgba(160,235,255,0.9)';
      ctx.lineWidth   = ((1 - f2) * 2 + 0.3) * gs;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, Math.max(0.5, f2 * 55 * gs), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  let cooldown       = 0;
  const COOLDOWN_MAX = 12;

  function spawnComet(x, y, vx, vy) {
    if (cooldown > 0) return;
    const MAX_SPD = 320;
    const s = Math.hypot(vx, vy);
    if (s > MAX_SPD) { vx = vx / s * MAX_SPD; vy = vy / s * MAX_SPD; }
    if (comets.length >= 5) blastComet(comets.shift(), x, y);
    comets.push({ x, y, vx, vy, hp: 3 });
    cooldown = COOLDOWN_MAX;
    updateCooldownUI('comet', cooldown, COOLDOWN_MAX);
  }

  function updateComet(dt) {
    if (cooldown > 0) {
      cooldown = Math.max(0, cooldown - dt);
      updateCooldownUI('comet', cooldown, COOLDOWN_MAX);
    }
    for (let i = explosions.length - 1; i >= 0; i--) {
      explosions[i].age += dt;
      if (explosions[i].age >= explosions[i].maxAge) explosions.splice(i, 1);
    }

    for (let i = freezeRings.length - 1; i >= 0; i--) {
      const ring = freezeRings[i];
      if (!ring.fadingOut) {
        ring.r = Math.min(ring.maxR, ring.r + ring.speed * dt);
        if (window.Asteroids) window.Asteroids.freezeInRadius(ring.x, ring.y, ring.r);
        if (ring.r >= ring.maxR) ring.fadingOut = true;
      } else {
        ring.fadeAge += dt;
        if (ring.fadeAge >= ring.maxFadeAge) freezeRings.splice(i, 1);
      }
    }

    const g      = getGlobeBounds();
    const moon   = window.getMoonScreenPos ? window.getMoonScreenPos() : null;
    const margin = 120;

    // Comet-comet collisions
    for (let i = comets.length - 1; i >= 1; i--) {
      for (let j = i - 1; j >= 0; j--) {
        if (Math.hypot(comets[i].x - comets[j].x, comets[i].y - comets[j].y) < 18) {
          const mx = (comets[i].x + comets[j].x) * 0.5;
          const my = (comets[i].y + comets[j].y) * 0.5;
          spawnExplosion(mx, my);
          spawnImpactDebris(mx, my, comets[i].vx, comets[i].vy);
          spawnImpactDebris(mx, my, comets[j].vx, comets[j].vy);
          comets.splice(i, 1);
          comets.splice(j, 1);
          i = j;
          break;
        }
      }
    }

    for (let i = comets.length - 1; i >= 0; i--) {
      const c = comets[i];

      c.x += c.vx * dt;
      c.y += c.vy * dt;

      if (window.smokeParticles.length < 600) {
        const spd = Math.hypot(c.vx, c.vy) || 1;
        const bx  = -c.vx / spd, by = -c.vy / spd;
        for (let j = 0; j < 5; j++) {
          const spread = (Math.random() - 0.5) * 1.1;
          const cs = Math.cos(spread), ss = Math.sin(spread);
          window.smokeParticles.push({
            x: c.x + bx * 10 + (Math.random() - 0.5) * 6,
            y: c.y + by * 10 + (Math.random() - 0.5) * 6,
            vx: (bx * cs - by * ss) * (25 + Math.random() * 45),
            vy: (bx * ss + by * cs) * (25 + Math.random() * 45),
            life: 0.35 + Math.random() * 0.3,
            maxLife: 0.55,
            r: 2.5 + Math.random() * 3.5,
            core: Math.random() < 0.4,
            ice: true,
          });
        }
      }

      if (c.x < -margin || c.x > canvas.width  + margin ||
          c.y < -margin || c.y > canvas.height + margin) {
        comets.splice(i, 1); continue;
      }

      if (g && window.ElectricField && window.ElectricField.isActive() &&
          Math.hypot(c.x - g.x, c.y - g.y) < g.r * window.ElectricField.SHIELD_FACTOR) {
        window.ElectricField.impact(c.x, c.y);
        spawnImpactDebris(c.x, c.y, c.vx, c.vy);
        comets.splice(i, 1); continue;
      }

      if (g && Math.hypot(c.x - g.x, c.y - g.y) < g.r) {
        window.dispatchEvent(new CustomEvent('comet-globe-impact',
          { detail: { x: c.x, y: c.y, vx: c.vx, vy: c.vy, source: 'comet' } }));
        spawnImpactDebris(c.x, c.y, c.vx, c.vy);
        spawnFreezeRing(c.x, c.y);
        comets.splice(i, 1); continue;
      }

      if (moon && Math.hypot(c.x - moon.x, c.y - moon.y) < moon.r * 1.4) {
        window.dispatchEvent(new CustomEvent('comet-moon-impact',
          { detail: { x: c.x, y: c.y, vx: c.vx, vy: c.vy, source: 'comet' } }));
        spawnImpactDebris(c.x, c.y, c.vx, c.vy);
        spawnFreezeRing(c.x, c.y);
        comets.splice(i, 1); continue;
      }

      if (window.Asteroids && window.Asteroids.touchAny(c.x, c.y, 18)) {
        spawnFreezeRing(c.x, c.y);
        spawnFreezeExplosion(c.x, c.y);
        comets.splice(i, 1); continue;
      }
    }
  }

  function drawComet() {
    const gs = window.gadgetScale || 1;

    for (const ring of freezeRings) {
      if (ring.r < 1) continue;
      const alpha = ring.fadingOut ? Math.max(0, 1 - ring.fadeAge / ring.maxFadeAge) : 1;

      ctx.save();
      // Broad ice-blue glow body
      ctx.globalAlpha = alpha * 0.55;
      ctx.strokeStyle = 'rgba(130, 220, 255, 1)';
      ctx.lineWidth   = 14 * gs;
      ctx.shadowColor = 'rgba(180, 240, 255, 1)';
      ctx.shadowBlur  = 28 * gs;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.stroke();
      // Mid ring
      ctx.globalAlpha = alpha * 0.80;
      ctx.strokeStyle = 'rgba(200, 245, 255, 1)';
      ctx.lineWidth   = 5 * gs;
      ctx.shadowBlur  = 14 * gs;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.stroke();
      // Sharp bright leading edge
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgba(245, 255, 255, 1)';
      ctx.lineWidth   = 1.5 * gs;
      ctx.shadowColor = 'rgba(220, 250, 255, 1)';
      ctx.shadowBlur  = 8 * gs;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const exp of explosions) drawExplosion(exp, gs);
    for (const c of comets) {
      const spd = Math.hypot(c.vx, c.vy);
      if (spd < 1) continue;
      const nx = c.vx / spd, ny = c.vy / spd;

      ctx.save();
      const tailLen = Math.min(200, spd * 0.28) * gs;
      const tx = c.x - nx * tailLen, ty = c.y - ny * tailLen;

      const tailGrad = ctx.createLinearGradient(c.x, c.y, tx, ty);
      tailGrad.addColorStop(0,   'rgba(240, 252, 255, 0.95)');
      tailGrad.addColorStop(0.3, 'rgba(175, 235, 255, 0.62)');
      tailGrad.addColorStop(1,   'rgba(100, 195, 255, 0)');
      ctx.strokeStyle = tailGrad;
      ctx.lineWidth   = 10 * gs;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      ctx.shadowColor = 'rgba(210, 248, 255, 1)';
      ctx.shadowBlur  = 50 * gs;
      const coreR    = 26 * gs;
      const coreGrad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, coreR);
      coreGrad.addColorStop(0,   'rgba(240, 255, 255, 1)');
      coreGrad.addColorStop(0.4, 'rgba(180, 242, 255, 0.88)');
      coreGrad.addColorStop(1,   'rgba(90, 185, 255, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(c.x, c.y, coreR, 0, Math.PI * 2);
      ctx.fill();

      // Crystal sparkle arms
      ctx.globalAlpha = 0.70;
      ctx.strokeStyle = 'rgba(225, 252, 255, 0.90)';
      ctx.lineWidth   = 1.2 * gs;
      ctx.shadowBlur  = 10 * gs;
      for (let k = 0; k < 4; k++) {
        const ang = (k / 4) * Math.PI + (spd * 0.0008);
        const len = 18 * gs;
        ctx.beginPath();
        ctx.moveTo(c.x - Math.cos(ang) * len, c.y - Math.sin(ang) * len);
        ctx.lineTo(c.x + Math.cos(ang) * len, c.y + Math.sin(ang) * len);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  window.spawnComet       = spawnComet;
  window.spawnImpactDebris = spawnImpactDebris;

  window.Comet = {
    update:  updateComet,
    draw:    drawComet,
    isReady: () => cooldown <= 0,
    getAll:  () => comets,
    damage(c, amount) {
      if (c.swirl || c.hp <= 0) return;
      c.hp -= amount;
      if (c.hp <= 0) {
        spawnImpactDebris(c.x, c.y, c.vx, c.vy);
        const idx = comets.indexOf(c);
        if (idx >= 0) comets.splice(idx, 1);
      }
    },
    blastInRadius(cx, cy, r) {
      for (let i = comets.length - 1; i >= 0; i--) {
        if (r >= Math.hypot(cx - comets[i].x, cy - comets[i].y) - 8) {
          spawnImpactDebris(comets[i].x, comets[i].y, comets[i].vx, comets[i].vy);
          comets.splice(i, 1);
        }
      }
    },
  };
})();
