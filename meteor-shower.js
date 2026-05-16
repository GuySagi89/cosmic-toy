// ── Meteor Shower ─────────────────────────────────────────────
(function () {
  const canvas = document.getElementById('stars-canvas');
  const ctx    = canvas.getContext('2d');
  const { updateCooldownUI, addTrailPoint, getGlobeBounds } = window.CosmicUtils;

  const COUNT          = 28;
  const SPAWN_DURATION = 1.4;   // s to emit all meteors
  const BASE_SPEED     = 800;   // px/s
  const SPEED_VARIANCE = 220;
  const SPREAD         = 130;   // perpendicular spread (total)
  const BACK_OFFSET    = 0;     // spawn at release point, not behind it
  const COOLDOWN_MAX   = 3.0;   // seconds between launches

  let showers  = [];
  let impacts  = [];
  let cooldown = 0;

  function refreshCooldownUI() {
    updateCooldownUI('meteor-shower', cooldown, COOLDOWN_MAX);
    const cursorEl = document.querySelector('.gadget-cursor--meteor-shower');
    if (cursorEl) {
      const cur = parseFloat(cursorEl.style.opacity);
      if (cur > 0) cursorEl.style.opacity = cooldown > 0 ? '0.52' : '1';
    }
  }

  function launch(sx, sy, dirX, dirY) {
    if (cooldown > 0) return;
    const len = Math.hypot(dirX, dirY);
    if (len < 8) return;
    const dx = dirX / len, dy = dirY / len;
    showers.push({
      dx, dy,
      px: -dy, py: dx,
      ox: sx,  oy: sy,
      elapsed: 0,
      spawned: 0,
      meteors: [],
    });
    cooldown = COOLDOWN_MAX;
    refreshCooldownUI();
  }

  function spawnOne(s) {
    const spread = (Math.random() - 0.5) * SPREAD;
    const drift  = (Math.random() - 0.5) * 32;
    const sp     = BASE_SPEED + (Math.random() - 0.5) * SPEED_VARIANCE;
    s.meteors.push({
      x:  s.ox + s.px * spread,
      y:  s.oy + s.py * spread,
      vx: s.dx * sp + s.px * drift,
      vy: s.dy * sp + s.py * drift,
      r:  (2.2 + Math.random() * 1.4) * (window.gadgetScale || 1),
      trail: [],
      age: 0,
    });
  }

  function update(dt) {
    if (cooldown > 0) {
      cooldown = Math.max(0, cooldown - dt);
      refreshCooldownUI();
    }

    const g    = getGlobeBounds();
    const moon = window.getMoonScreenPos ? window.getMoonScreenPos() : null;

    // ── Meteor-meteor collisions (all showers combined) ──────────
    {
      const flat = [];
      for (const s of showers) {
        for (const m of s.meteors) { if (!m.swirl) flat.push({ s, m }); }
      }
      const dead = new Set();
      for (let i = flat.length - 1; i >= 1; i--) {
        if (dead.has(flat[i].m)) continue;
        for (let j = i - 1; j >= 0; j--) {
          if (dead.has(flat[j].m)) continue;
          if (flat[i].s === flat[j].s) continue;
          const mi = flat[i].m, mj = flat[j].m;
          if (Math.hypot(mi.x - mj.x, mi.y - mj.y) < 12) {
            spawnImpact(mi.x, mi.y, mi.vx, mi.vy);
            spawnImpact(mj.x, mj.y, mj.vx, mj.vy);
            dead.add(mi);
            dead.add(mj);
          }
        }
      }
      if (dead.size > 0) {
        for (const s of showers) s.meteors = s.meteors.filter(m => !dead.has(m));
      }
    }

    for (let si = showers.length - 1; si >= 0; si--) {
      const s = showers[si];
      s.elapsed += dt;

      const target = Math.min(COUNT, Math.floor(s.elapsed / SPAWN_DURATION * COUNT));
      while (s.spawned < target) { spawnOne(s); s.spawned++; }

      for (let mi = s.meteors.length - 1; mi >= 0; mi--) {
        const m = s.meteors[mi];
        m.age += dt;

        // Swirl into black hole
        if (m.swirl) {
          if (window.BlackHole.updateSwirl(m, dt)) s.meteors.splice(mi, 1);
          continue;
        }

        // Black hole gravity
        if (window.BlackHole && window.BlackHole.applyGravity(m, dt, { swirlMaxAge: 1.2, gravityK: 1200000, minSwirlR: 4 })) continue;

        addTrailPoint(m.trail, 8, m.x, m.y);

        m.x += m.vx * dt;
        m.y += m.vy * dt;

        let hit = false;

        if (g && Math.hypot(m.x - g.x, m.y - g.y) < g.r + m.r) {
          window.dispatchEvent(new CustomEvent('comet-globe-impact', {
            detail: { x: m.x, y: m.y, vx: m.vx * 0.055, vy: m.vy * 0.055, source: 'meteor' }
          }));
          spawnImpact(m.x, m.y, m.vx, m.vy);
          hit = true;
        }

        if (!hit && moon && Math.hypot(m.x - moon.x, m.y - moon.y) < moon.r * 1.2 + m.r) {
          window.dispatchEvent(new CustomEvent('comet-moon-impact', {
            detail: { x: m.x, y: m.y, vx: m.vx * 0.055, vy: m.vy * 0.055, source: 'meteor' }
          }));
          spawnImpact(m.x, m.y, m.vx, m.vy);
          hit = true;
        }

        if (!hit && window.Asteroids && window.Asteroids.checkHit(m.x, m.y, m.r * 2, 0.5)) {
          spawnImpact(m.x, m.y, m.vx, m.vy);
          hit = true;
        }

        if (!hit && window.Comet) {
          const allComets = [...window.Comet.getAll()];
          for (const c of allComets) {
            if (!c.swirl && Math.hypot(m.x - c.x, m.y - c.y) < 28) {
              window.Comet.damage(c, 0.5);
              spawnImpact(m.x, m.y, m.vx, m.vy);
              hit = true;
              break;
            }
          }
        }

        if (hit || m.age > 4.5 ||
            m.x < -500 || m.x > canvas.width  + 500 ||
            m.y < -500 || m.y > canvas.height + 500) {
          s.meteors.splice(mi, 1);
        }
      }

      if (s.spawned >= COUNT && s.meteors.length === 0) showers.splice(si, 1);
    }

    for (let i = impacts.length - 1; i >= 0; i--) {
      impacts[i].age += dt;
      if (impacts[i].age >= impacts[i].maxAge) impacts.splice(i, 1);
    }
  }

  function spawnImpact(x, y, vx, vy) {
    impacts.push({ x, y, age: 0, maxAge: 0.34 });

    if (!window.smokeParticles || window.smokeParticles.length >= 580) return;
    const spd = Math.hypot(vx, vy) || 1;
    const nx  = vx / spd, ny = vy / spd;
    for (let i = 0; i < 9; i++) {
      const spread = (Math.random() - 0.5) * Math.PI * 1.6;
      const cs = Math.cos(spread), ss = Math.sin(spread);
      const dx = nx * cs - ny * ss, dy = nx * ss + ny * cs;
      const sp2 = 35 + Math.random() * 80;
      window.smokeParticles.push({
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        vx: dx * sp2, vy: dy * sp2,
        life: 0.18 + Math.random() * 0.14, maxLife: 0.32,
        r: 1 + Math.random() * 1.4,
        core: Math.random() < 0.45, comet: false,
      });
    }
  }

  function draw() {
    for (const imp of impacts) drawImpact(imp);
    for (const s of showers) {
      for (const m of s.meteors) drawMeteor(m);
    }
  }

  function drawImpact(imp) {
    const gs   = window.gadgetScale || 1;
    const frac = imp.age / imp.maxAge;
    const r    = frac * 22 * gs;

    // Inner flash — only in the first third
    if (frac < 0.35) {
      const f2 = frac / 0.35;
      const fg = ctx.createRadialGradient(imp.x, imp.y, 0, imp.x, imp.y, r * 0.8 + 4);
      fg.addColorStop(0,   `rgba(255, 255, 230, ${(1 - f2) * 0.75})`);
      fg.addColorStop(0.5, `rgba(255, 185,  55, ${(1 - f2) * 0.45})`);
      fg.addColorStop(1,   'rgba(255, 100, 10, 0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(imp.x, imp.y, r * 0.8 + 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Expanding ring
    ctx.save();
    ctx.globalAlpha = (1 - frac) * 0.75;
    ctx.strokeStyle = frac < 0.5 ? '#ffe090' : '#ff8830';
    ctx.lineWidth   = 1.8 * (1 - frac) + 0.3;
    ctx.beginPath();
    ctx.arc(imp.x, imp.y, Math.max(0.5, r), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawMeteor(m) {
    if (m.swirl) {
      const frac  = m.swirl.age / m.swirl.maxAge;
      const scale = Math.max(0, 1 - Math.pow(frac, 0.55));
      if (scale < 0.02) return;
      const r = Math.max(0.1, m.r * 3 * scale);
      ctx.save();
      ctx.globalAlpha = scale;
      ctx.shadowColor = 'rgba(255, 160, 40, 1)';
      ctx.shadowBlur  = 14 * scale;
      const sg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
      sg.addColorStop(0,    'rgba(255, 255, 220, 1)');
      sg.addColorStop(0.4,  'rgba(255, 170,  60, 0.85)');
      sg.addColorStop(1,    'rgba(255,  80,  10, 0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    const trailLen = m.trail.length;

    if (trailLen >= 2) {
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 1; i < trailLen; i++) {
        const t = 1 - i / trailLen;
        ctx.globalAlpha = t * 0.68;
        ctx.strokeStyle = i < 3 ? '#ffd08a' : '#ff7828';
        ctx.lineWidth   = m.r * t * 1.9;
        ctx.beginPath();
        ctx.moveTo(m.trail[i - 1].x, m.trail[i - 1].y);
        ctx.lineTo(m.trail[i].x,     m.trail[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Outer glow
    const grd = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 3.8);
    grd.addColorStop(0,    'rgba(255,252,220,0.95)');
    grd.addColorStop(0.32, 'rgba(255,175, 70,0.55)');
    grd.addColorStop(1,    'rgba(255, 90, 15,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r * 3.8, 0, Math.PI * 2);
    ctx.fill();

    // Solid white core
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.fill();
  }

  window.spawnMeteorShower = launch;
  window.MeteorShower = {
    update, draw,
    isReady: () => cooldown <= 0,
    blastInRadius(cx, cy, r) {
      for (let si = showers.length - 1; si >= 0; si--) {
        const s = showers[si];
        for (let mi = s.meteors.length - 1; mi >= 0; mi--) {
          const m = s.meteors[mi];
          if (m.swirl) continue;
          if (Math.hypot(cx - m.x, cy - m.y) <= r) {
            spawnImpact(m.x, m.y, m.vx, m.vy);
            s.meteors.splice(mi, 1);
          }
        }
      }
    },
  };
})();
