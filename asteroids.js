// ── Asteroids ─────────────────────────────────────────────────────
(function () {
  const canvas = document.getElementById('stars-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Synthwave neon palette — each entry has hex + precomputed RGB + dark fill
  const NEON = [
    { hex: '#00f5ff', r:   0, g: 245, b: 255, fill: 'rgba(0,28,32,0.90)'   }, // electric cyan
    { hex: '#ff00dc', r: 255, g:   0, b: 220, fill: 'rgba(28,0,22,0.90)'   }, // neon magenta
    { hex: '#ff0090', r: 255, g:   0, b: 144, fill: 'rgba(28,0,14,0.90)'   }, // hot pink
    { hex: '#bf00ff', r: 191, g:   0, b: 255, fill: 'rgba(16,0,30,0.90)'   }, // electric violet
    { hex: '#00ff9f', r:   0, g: 255, b: 159, fill: 'rgba(0,30,16,0.90)'   }, // neon mint
    { hex: '#ff6b00', r: 255, g: 107, b:   0, fill: 'rgba(30,14,0,0.90)'   }, // neon orange
  ];

  // Size tiers: rMin/rMax in px, hp, vertex count range, drift speed range
  const TIERS = {
    large:  { rMin: 54, rMax: 72, hp: 3, vMin: 8,  vMax: 11, sMin: 22, sMax: 46, splits: 'medium', splitN: 2    },
    medium: { rMin: 27, rMax: 41, hp: 2, vMin: 6,  vMax:  9, sMin: 38, sMax: 68, splits: 'small',  splitN: [2,3] },
    small:  { rMin: 13, rMax: 21, hp: 1, vMin: 5,  vMax:  7, sMin: 58, sMax: 95, splits: null                   },
  };

  let asteroids = [];
  let fragments = [];

  function rng(a, b) { return a + Math.random() * (b - a); }

  // Pre-generate random crack lines in local space (clipped to polygon at draw time)
  function makeCracks(count, r) {
    const lines = [];
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const len = rng(r * 0.18, r * 0.55);
      const ox  = rng(-r * 0.42, r * 0.42);
      const oy  = rng(-r * 0.42, r * 0.42);
      lines.push({ x1: ox, y1: oy, x2: ox + Math.cos(ang) * len, y2: oy + Math.sin(ang) * len });
    }
    return lines;
  }

  // Generate an irregular polygon with n vertices and nominal radius r
  function makeShape(n, r) {
    const step = (Math.PI * 2) / n;
    const pts  = [];
    for (let i = 0; i < n; i++) {
      const baseAng = step * i;
      const jitter  = (Math.random() - 0.5) * step * 0.68;
      const rr      = r * rng(0.62, 1.14);
      pts.push([Math.cos(baseAng + jitter) * rr, Math.sin(baseAng + jitter) * rr]);
    }
    return pts;
  }

  function createAsteroid(x, y, tier, vx, vy) {
    const t  = TIERS[tier];
    const r  = rng(t.rMin, t.rMax);
    const n  = t.vMin + Math.floor(Math.random() * (t.vMax - t.vMin + 1));
    const ci = Math.floor(Math.random() * NEON.length);

    let avx = vx, avy = vy;
    if (avx == null) {
      const ang = Math.random() * Math.PI * 2;
      const spd = rng(t.sMin, t.sMax);
      avx = Math.cos(ang) * spd;
      avy = Math.sin(ang) * spd;
    }

    const rotDir = Math.random() < 0.5 ? 1 : -1;
    const rotSpd = rotDir * rng(
      tier === 'large' ? 0.10 : tier === 'medium' ? 0.22 : 0.42,
      tier === 'large' ? 0.32 : tier === 'medium' ? 0.58 : 0.90
    );

    return {
      x, y, vx: avx, vy: avy,
      rotation: Math.random() * Math.PI * 2,
      rotSpd,
      tier, r,
      hp: t.hp, maxHp: t.hp,
      shape:  makeShape(n, r),
      cracks: makeCracks(tier === 'large' ? 4 : tier === 'medium' ? 3 : 2, r),
      ci,
      glowPh:   Math.random() * Math.PI * 2,
      hitFlash: 0,
      bounceCD: 0,
      swirl:    null,
      dead:     false,
    };
  }

  function spawnFromEdge(tier) {
    const W = canvas.width, H = canvas.height;
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if      (side === 0) { x = Math.random() * W; y = -100; }
    else if (side === 1) { x = W + 100; y = Math.random() * H; }
    else if (side === 2) { x = Math.random() * W; y = H + 100; }
    else                 { x = -100; y = Math.random() * H; }

    const cx = W * rng(0.22, 0.78);
    const cy = H * rng(0.22, 0.78);
    const dx = cx - x, dy = cy - y;
    const d  = Math.hypot(dx, dy) || 1;
    const t  = TIERS[tier];
    const spd = rng(t.sMin, t.sMax);
    return createAsteroid(x, y, tier, (dx / d) * spd, (dy / d) * spd);
  }

  // ── Split & damage ────────────────────────────────────────────────

  function spawnSplitFlash(a) {
    const nc = NEON[a.ci];
    for (let i = 0; i < 28; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 90 + Math.random() * 280;
      const ml  = 0.22 + Math.random() * 0.32;
      fragments.push({
        x: a.x, y: a.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: ml, maxLife: ml,
        r: 1.2 + Math.random() * 2.2,
        color: nc.hex,
      });
    }
  }

  function spawnHitSparks(a, ix, iy) {
    const nc = NEON[a.ci];
    for (let i = 0; i < 9; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 55 + Math.random() * 160;
      const ml  = 0.14 + Math.random() * 0.20;
      fragments.push({
        x: ix, y: iy,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: ml, maxLife: ml,
        r: 0.8 + Math.random() * 1.6,
        color: nc.hex,
      });
    }
  }

  function splitAsteroid(a) {
    const t = TIERS[a.tier];
    if (!t.splits) return;

    const count = Array.isArray(t.splitN)
      ? t.splitN[0] + Math.floor(Math.random() * (t.splitN[1] - t.splitN[0] + 1))
      : t.splitN;

    const parentAng = Math.atan2(a.vy, a.vx);
    const ct        = TIERS[t.splits];
    const spread    = count === 2 ? 0.65 : 0.45;

    for (let i = 0; i < count; i++) {
      const frac = count > 1 ? (i / (count - 1)) - 0.5 : 0;
      const ang  = parentAng + frac * spread * 2 * Math.PI + (Math.random() - 0.5) * 0.5;
      const spd  = rng(ct.sMin, ct.sMax);
      const vx   = Math.cos(ang) * spd;
      const vy   = Math.sin(ang) * spd;
      const off  = a.r * 0.55;
      asteroids.push(createAsteroid(
        a.x + Math.cos(ang) * off,
        a.y + Math.sin(ang) * off,
        t.splits, vx, vy
      ));
    }

    spawnSplitFlash(a);
  }

  // Returns true if the asteroid was hit (and possibly destroyed)
  function damageAsteroid(idx, dmg, ix, iy) {
    const a = asteroids[idx];
    if (!a || a.dead || a.swirl) return false;
    a.hp      -= dmg;
    a.hitFlash = 0.22;
    spawnHitSparks(a, ix ?? a.x, iy ?? a.y);
    if (a.hp <= 0) {
      a.dead = true;
      splitAsteroid(a);
    }
    return true;
  }

  // ── Update ────────────────────────────────────────────────────────

  function update(dt) {
    // Update spark fragments
    for (let i = fragments.length - 1; i >= 0; i--) {
      const p = fragments[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.86, dt * 60);
      p.vy *= Math.pow(0.86, dt * 60);
      p.life -= dt;
      if (p.life <= 0) fragments.splice(i, 1);
    }

    const allBHs = window.BlackHole ? window.BlackHole.getAll() : [];
    const W = canvas.width, H = canvas.height;
    const M = 110;

    // Asteroid-asteroid collisions
    for (let i = asteroids.length - 1; i >= 1; i--) {
      if (asteroids[i].dead || asteroids[i].swirl) continue;
      for (let j = i - 1; j >= 0; j--) {
        if (asteroids[j].dead || asteroids[j].swirl) continue;
        const ai = asteroids[i], aj = asteroids[j];
        const dx = ai.x - aj.x, dy = ai.y - aj.y;
        const dist = Math.hypot(dx, dy);
        const minD = (ai.r + aj.r) * 0.75;
        if (dist < minD) {
          const nx = dx / (dist || 1), ny = dy / (dist || 1);
          // Separate
          const overlap = minD - dist;
          ai.x += nx * overlap * 0.5;
          ai.y += ny * overlap * 0.5;
          aj.x -= nx * overlap * 0.5;
          aj.y -= ny * overlap * 0.5;
          // Elastic bounce
          const relVn = (ai.vx - aj.vx) * nx + (ai.vy - aj.vy) * ny;
          if (relVn < 0) {
            const imp = -relVn * 0.9;
            ai.vx += imp * nx; ai.vy += imp * ny;
            aj.vx -= imp * nx; aj.vy -= imp * ny;
          }
          // 1 damage each (gated by bounceCD)
          if (ai.bounceCD <= 0 && aj.bounceCD <= 0) {
            ai.bounceCD = 0.5;
            aj.bounceCD = 0.5;
            damageAsteroid(i, 1, ai.x, ai.y);
            damageAsteroid(j, 1, aj.x, aj.y);
          }
        }
      }
    }

    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];
      if (a.dead) { asteroids.splice(i, 1); continue; }

      a.hitFlash = Math.max(0, a.hitFlash - dt);
      a.glowPh   = (a.glowPh + dt * 1.7) % (Math.PI * 2);

      // BH swirl animation
      if (a.swirl) {
        const sw = a.swirl;
        sw.age += dt;
        const frac = sw.age / sw.maxAge;
        if (frac >= 1) { a.dead = true; continue; }
        const r    = sw.r * Math.pow(1 - frac, 0.65);
        sw.angle  += (3 + frac * 10) * dt;
        a.x        = sw.bh.x + Math.cos(sw.angle) * r;
        a.y        = sw.bh.y + Math.sin(sw.angle) * r;
        a.rotation += a.rotSpd * dt * (1 + frac * 4);
        continue;
      }

      // BH gravity pull
      for (const bh of allBHs) {
        const dx = bh.x - a.x, dy = bh.y - a.y;
        const d  = Math.hypot(dx, dy);
        if (d < bh.baseRadius * 3) {
          a.swirl = { bh, angle: Math.atan2(a.y - bh.y, a.x - bh.x), r: Math.max(d, 6), age: 0, maxAge: 1.4 };
          break;
        }
        if (d < bh.baseRadius * 20) {
          const g = 12000 / (d * d);
          a.vx += (dx / d) * g * dt;
          a.vy += (dy / d) * g * dt;
        }
      }
      if (a.swirl) continue;

      a.x        += a.vx * dt;
      a.y        += a.vy * dt;
      a.rotation += a.rotSpd * dt;

      if (a.bounceCD > 0) a.bounceCD -= dt;

      // Globe collision — tight hitbox: asteroid center reaches globe surface
      const globeEl = document.getElementById('globe-canvas');
      if (globeEl) {
        const gr     = globeEl.getBoundingClientRect();
        const gcx    = gr.left + gr.width  / 2;
        const gcy    = gr.top  + gr.height / 2;
        const globeR = gr.width * 0.22;
        const bdx    = a.x - gcx, bdy = a.y - gcy;
        const bdist  = Math.hypot(bdx, bdy);
        if (bdist < globeR + a.r * 0.75) {
          const nx = bdx / (bdist || 1), ny = bdy / (bdist || 1);
          a.x = gcx + nx * (globeR + a.r * 0.75);
          a.y = gcy + ny * (globeR + a.r * 0.75);
          const dot = a.vx * nx + a.vy * ny;
          if (dot < 0) { a.vx = (a.vx - 2 * dot * nx) * 0.55; a.vy = (a.vy - 2 * dot * ny) * 0.55; }
          if (a.bounceCD <= 0) {
            a.bounceCD = 0.6;
            window.dispatchEvent(new CustomEvent('comet-globe-impact', {
              detail: { x: a.x, y: a.y, vx: -nx * 300, vy: -ny * 300, source: 'asteroid' }
            }));
            damageAsteroid(i, 1, a.x, a.y);
            if (a.dead) continue;
          }
        }
      }

      // Moon collision — tight hitbox
      const moon = window.getMoonScreenPos ? window.getMoonScreenPos() : null;
      if (moon) {
        const mdx   = a.x - moon.x, mdy = a.y - moon.y;
        const mdist = Math.hypot(mdx, mdy);
        if (mdist < moon.r + a.r * 0.75) {
          const nx = mdx / (mdist || 1), ny = mdy / (mdist || 1);
          a.x = moon.x + nx * (moon.r + a.r * 0.75);
          a.y = moon.y + ny * (moon.r + a.r * 0.75);
          const dot = a.vx * nx + a.vy * ny;
          if (dot < 0) { a.vx = (a.vx - 2 * dot * nx) * 0.55; a.vy = (a.vy - 2 * dot * ny) * 0.55; }
          if (a.bounceCD <= 0) {
            a.bounceCD = 0.6;
            window.dispatchEvent(new CustomEvent('comet-moon-impact', {
              detail: { x: a.x, y: a.y, vx: -nx * 250, vy: -ny * 250, source: 'asteroid' }
            }));
            damageAsteroid(i, 1, a.x, a.y);
            if (a.dead) continue;
          }
        }
      }

      // Spaceship collision — 2 damage to ship, 1 to asteroid, with cooldown
      const ship = window.Spaceship && window.Spaceship.get();
      if (ship && !ship.exploding && !ship.swirl) {
        const sdx     = ship.x - a.x, sdy = ship.y - a.y;
        const sd      = Math.hypot(sdx, sdy) || 1;
        const minDist = a.r * 0.75 + 14;
        if (sd < minDist) {
          const nx = sdx / sd, ny = sdy / sd;
          // Separate positions to prevent clipping
          ship.x = a.x + nx * minDist;
          ship.y = a.y + ny * minDist;
          // Elastic-ish bounce: project relative velocity onto normal
          const relVn = (ship.vx - a.vx) * nx + (ship.vy - a.vy) * ny;
          if (relVn < 0) {
            const imp = -relVn * 1.5;
            ship.vx += imp * nx;
            ship.vy += imp * ny;
            a.vx   -= imp * nx * 0.25;
            a.vy   -= imp * ny * 0.25;
          }
          if (a.bounceCD <= 0) {
            a.bounceCD = 0.6;
            window.Spaceship.hit(ship.x, ship.y, a.vx, a.vy, 2);
            damageAsteroid(i, 1, a.x, a.y);
            if (a.dead) continue;
          }
        }
      }

      // Kill when off-screen
      if (a.x < -M || a.x > W + M || a.y < -M || a.y > H + M) {
        a.dead = true;
      }
    }
  }

  // ── Draw ─────────────────────────────────────────────────────────

  function polyPath(a) {
    ctx.beginPath();
    ctx.moveTo(a.shape[0][0], a.shape[0][1]);
    for (let i = 1; i < a.shape.length; i++) ctx.lineTo(a.shape[i][0], a.shape[i][1]);
    ctx.closePath();
  }

  function drawAsteroid(a) {
    if (a.dead) return;

    const nc      = NEON[a.ci];
    const glow    = 0.5 + Math.sin(a.glowPh) * 0.25;
    const hitFrac = Math.min(1, a.hitFlash / 0.22);
    const swFrac  = a.swirl ? Math.max(0, 1 - Math.pow(a.swirl.age / a.swirl.maxAge, 0.55)) : 1;

    // ── Fill + interior details (clipped to polygon) ──────────────────
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rotation);
    if (a.swirl) ctx.scale(swFrac, swFrac);

    polyPath(a);

    if (hitFrac > 0) {
      // Hit flash: solid bright neon
      const fr = Math.round(nc.r + (255 - nc.r) * hitFrac);
      const fg = Math.round(nc.g + (255 - nc.g) * hitFrac);
      const fb = Math.round(nc.b + (255 - nc.b) * hitFrac);
      ctx.fillStyle = `rgba(${fr},${fg},${fb},${0.55 + hitFrac * 0.38})`;
      ctx.fill();
    } else {
      // Radial gradient: off-center light source gives depth.
      // Light spot upper-left, shadow lower-right.
      const litR = Math.round(nc.r * 0.22);
      const litG = Math.round(nc.g * 0.22);
      const litB = Math.round(nc.b * 0.22);
      const grad = ctx.createRadialGradient(
        -a.r * 0.30, -a.r * 0.35, 0,
         a.r * 0.08,  a.r * 0.08, a.r * 1.05
      );
      grad.addColorStop(0,    `rgb(${litR}, ${litG}, ${litB})`);
      grad.addColorStop(0.50, `rgb(4, 2, 10)`);
      grad.addColorStop(1,    `rgb(2, 1, 5)`);
      ctx.fillStyle = grad;
      ctx.fill();

      // Clip so cracks and specular stay inside the polygon
      ctx.clip();

      // Crack lines — thin neon strokes suggesting fractures
      ctx.lineWidth   = 0.7;
      ctx.lineCap     = 'round';
      ctx.strokeStyle = nc.hex;
      ctx.globalAlpha = 0.16 + glow * 0.07;
      for (const cr of a.cracks) {
        ctx.beginPath();
        ctx.moveTo(cr.x1, cr.y1);
        ctx.lineTo(cr.x2, cr.y2);
        ctx.stroke();
      }

      // Specular highlight — tiny bright dot at the light-source side
      ctx.globalAlpha = 1;
      const sR = a.r * 0.13;
      const sX = -a.r * 0.27, sY = -a.r * 0.31;
      const sg = ctx.createRadialGradient(sX, sY, 0, sX, sY, sR);
      sg.addColorStop(0, 'rgba(255, 255, 255, 0.50)');
      sg.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sX, sY, sR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore(); // also removes the clip

    // ── Neon outline (separate pass so glow isn't clipped) ───────────
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rotation);
    if (a.swirl) ctx.scale(swFrac, swFrac);

    polyPath(a);

    const glowR = (a.tier === 'large' ? 18 : a.tier === 'medium' ? 13 : 9) * (0.65 + glow * 0.65);
    ctx.shadowColor = nc.hex;
    ctx.shadowBlur  = glowR + hitFrac * 24;
    ctx.strokeStyle = hitFrac > 0.55 ? '#ffffff' : nc.hex;
    ctx.lineWidth   = (a.tier === 'large' ? 2.2 : a.tier === 'medium' ? 1.8 : 1.4) + hitFrac * 1.6;
    ctx.lineJoin    = 'round';
    ctx.stroke();

    ctx.restore();

    // Health bar (large & medium only, screen-aligned)
    if (a.tier !== 'small' && !a.swirl) {
      const health = Math.max(0, a.hp / a.maxHp);
      const BAR_W  = a.r * 2.4;
      const BAR_H  = 4;
      const bx     = a.x - BAR_W / 2;
      const by     = a.y - a.r - 13;

      ctx.save();
      ctx.globalAlpha = 0.88 * swFrac;

      // Dark track
      ctx.fillStyle = 'rgba(6, 2, 18, 0.80)';
      ctx.fillRect(bx - 1, by - 1, BAR_W + 2, BAR_H + 2);

      // Neon HP fill
      if (health > 0) {
        ctx.shadowColor = nc.hex;
        ctx.shadowBlur  = 5;
        ctx.fillStyle   = nc.hex;
        ctx.fillRect(bx, by, BAR_W * health, BAR_H);
        ctx.shadowBlur  = 0;
      }

      // Subtle border
      ctx.strokeStyle = 'rgba(90, 50, 180, 0.42)';
      ctx.lineWidth   = 0.7;
      ctx.strokeRect(bx - 1, by - 1, BAR_W + 2, BAR_H + 2);

      ctx.restore();
    }
  }

  function draw() {
    // Neon spark fragments
    ctx.save();
    for (const p of fragments) {
      const frac  = 1 - p.life / p.maxLife;
      const alpha = (p.life / p.maxLife) * 0.92;
      const r     = Math.max(0.1, p.r * (1 + frac * 1.4));
      ctx.globalAlpha = alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = 10 * alpha;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
    ctx.restore();

    for (const a of asteroids) drawAsteroid(a);
  }

  // ── Public API ────────────────────────────────────────────────────

  // Returns true if a point at (x,y) with collision radius hitR hits any asteroid.
  // Damages the asteroid by dmg and returns true on a hit.
  function checkHit(x, y, hitR, dmg) {
    hitR = hitR ?? 10;
    dmg  = dmg  ?? 1;
    for (let i = 0; i < asteroids.length; i++) {
      const a = asteroids[i];
      if (a.dead || a.swirl) continue;
      if (Math.hypot(x - a.x, y - a.y) < a.r + hitR) {
        damageAsteroid(i, dmg, x, y);
        return true;
      }
    }
    return false;
  }

  window.Asteroids = {
    update,
    draw,
    spawnAt(x, y, tier) { asteroids.push(createAsteroid(x, y, tier || 'large')); },
    checkHit,
    getAll: () => asteroids,
  };
})();
