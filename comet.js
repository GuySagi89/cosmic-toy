// ── Comet Blast ───────────────────────────────────────────────────
(function () {
  const canvas = document.getElementById('stars-canvas');
  const ctx    = canvas.getContext('2d');
  const { updateCooldownUI, getGlobeBounds } = window.CosmicUtils;

  let explosions  = [];
  let freezeRings = [];

  function spawnImpactDebris(x, y) {
    if (!window.smokeParticles) return;
    for (let i = 0; i < 55; i++) {
      const a  = Math.random() * Math.PI * 2;
      const s  = 200 + Math.random() * 600;
      const ml = 0.8 + Math.random() * 0.8;
      window.smokeParticles.push({
        x: x + (Math.random() - 0.5) * 12,
        y: y + (Math.random() - 0.5) * 12,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: ml, maxLife: ml,
        r: 5 + Math.random() * 10,
        core: Math.random() < 0.5, comet: true,
      });
    }
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
  }

  let cooldown       = 0;
  const COOLDOWN_MAX = 12;

  function blast(x, y) {
    if (cooldown > 0) return;

    spawnFreezeExplosion(x, y);
    spawnFreezeRing(x, y);
    spawnImpactDebris(x, y);

    const g = getGlobeBounds();
    if (g && Math.hypot(x - g.x, y - g.y) < g.r * 1.5) {
      window.dispatchEvent(new CustomEvent('comet-globe-impact',
        { detail: { x, y, vx: 0, vy: 0, source: 'comet' } }));
    }

    const moon = window.getMoonScreenPos ? window.getMoonScreenPos() : null;
    if (moon && Math.hypot(x - moon.x, y - moon.y) < moon.r * 2) {
      window.dispatchEvent(new CustomEvent('comet-moon-impact',
        { detail: { x, y, vx: 0, vy: 0, source: 'comet' } }));
    }

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
  }

  function drawComet() {
    const gs = window.gadgetScale || 1;

    for (const ring of freezeRings) {
      if (ring.r < 1) continue;
      const alpha = ring.fadingOut ? Math.max(0, 1 - ring.fadeAge / ring.maxFadeAge) : 1;

      ctx.save();
      ctx.globalAlpha = alpha * 0.55;
      ctx.strokeStyle = 'rgba(130, 220, 255, 1)';
      ctx.lineWidth   = 14 * gs;
      ctx.shadowColor = 'rgba(180, 240, 255, 1)';
      ctx.shadowBlur  = 28 * gs;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = alpha * 0.80;
      ctx.strokeStyle = 'rgba(200, 245, 255, 1)';
      ctx.lineWidth   = 5 * gs;
      ctx.shadowBlur  = 14 * gs;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.stroke();

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
  }

  window.spawnImpactDebris = spawnImpactDebris;
  window.spawnComet        = blast;

  window.Comet = {
    update:  updateComet,
    draw:    drawComet,
    blast,
    isReady: () => cooldown <= 0,
    getAll:  () => [],
    damage:  () => {},
    blastInRadius: () => {},
  };
})();
