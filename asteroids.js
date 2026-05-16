// ── Asteroids ─────────────────────────────────────────────────────
// Visual: rotating 3D wireframe polyhedra with inner detail patterns.
// Gameplay/physics: unchanged from previous version.
(function () {
  const canvas = document.getElementById('stars-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const { rng, getGlobeBounds } = window.CosmicUtils;

  // Synthwave neon palette — each entry has hex + precomputed RGB + dark fill
  const NEON = [
    { hex: '#00f5ff', r:   0, g: 245, b: 255, fill: 'rgba(0,28,32,0.90)'   }, // electric cyan
    { hex: '#ff00dc', r: 255, g:   0, b: 220, fill: 'rgba(28,0,22,0.90)'   }, // neon magenta
    { hex: '#ff0090', r: 255, g:   0, b: 144, fill: 'rgba(28,0,14,0.90)'   }, // hot pink
    { hex: '#bf00ff', r: 191, g:   0, b: 255, fill: 'rgba(16,0,30,0.90)'   }, // electric violet
    { hex: '#00ff9f', r:   0, g: 255, b: 159, fill: 'rgba(0,30,16,0.90)'   }, // neon mint
    { hex: '#ff6b00', r: 255, g: 107, b:   0, fill: 'rgba(30,14,0,0.90)'   }, // neon orange
  ];

  // Size tiers
  const TIERS = {
    gigantic: { rMin: 95, rMax: 130, hp: 30, sMin: 22, sMax: 50, splits: 'large', splitN: [2,3] },
    large:    { rMin: 54, rMax: 72,  hp: 10, sMin: 55, sMax: 110, splits: 'medium', splitN: 2    },
    medium:   { rMin: 27, rMax: 41,  hp: 5,  sMin: 90, sMax: 160, splits: 'small',  splitN: [2,3] },
    small:    { rMin: 13, rMax: 21,  hp: 1,  sMin: 130, sMax: 220, splits: null                   },
  };

  let asteroids = [];
  let fragments = [];

  const MOBILE_MQ = window.matchMedia('(min-width: 600px) and (min-height: 600px)');
  function sizeScale() { return MOBILE_MQ.matches ? 1 : 0.5; }

  // ── 3D Polyhedron Library ─────────────────────────────────────────
  // Each shape: { verts: [[x,y,z], ...], edges: [[i,j], ...] }
  // All vertices normalized so the furthest sits at radius 1.

  function normalizeVerts(verts) {
    let maxR = 0;
    for (const v of verts) {
      const r = Math.hypot(v[0], v[1], v[2]);
      if (r > maxR) maxR = r;
    }
    if (maxR === 0) return verts;
    return verts.map(v => [v[0]/maxR, v[1]/maxR, v[2]/maxR]);
  }

  // ── Lumpy 3D rock generator ───────────────────────────────────────
  // Base: icosahedron (12 verts, 20 triangular faces, 30 edges).
  // Each asteroid jitters each vertex along its outward direction by a
  // random amount, AND adds small lateral wobble. Result: irregular,
  // chunky, asymmetric — reads as "rock" not "math solid".

  const BASE_ICOSA_VERTS = (() => {
    const phi = (1 + Math.sqrt(5)) / 2;
    return normalizeVerts([
      [-1,  phi, 0], [ 1,  phi, 0], [-1, -phi, 0], [ 1, -phi, 0],
      [ 0, -1,  phi], [ 0,  1,  phi], [ 0, -1, -phi], [ 0,  1, -phi],
      [ phi, 0, -1], [ phi, 0,  1], [-phi, 0, -1], [-phi, 0,  1],
    ]);
  })();

  // The 20 triangular faces of the icosahedron
  const BASE_ICOSA_FACES = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
  ];

  // Unique edges derived from those faces
  const BASE_ICOSA_EDGES = (() => {
    const seen = new Set();
    const edges = [];
    for (const f of BASE_ICOSA_FACES) {
      for (let k = 0; k < 3; k++) {
        const a = f[k], b = f[(k + 1) % 3];
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (!seen.has(key)) {
          seen.add(key);
          edges.push([Math.min(a, b), Math.max(a, b)]);
        }
      }
    }
    return edges;
  })();

  // Generate a unique lumpy rock shape at given radius.
  // `lumpiness` ∈ [0,1] roughly: 0 = perfect icosahedron, 1 = very chunky.
  function makeRockShape(r, lumpiness) {
    const verts = BASE_ICOSA_VERTS.map(v => {
      // Radial scale: each vertex gets a random radius multiplier
      const radial = 1 + (Math.random() - 0.5) * lumpiness;
      // Lateral wobble: small tangential offset, breaks rotational symmetry
      const wob = lumpiness * 0.22;
      const wx = (Math.random() - 0.5) * wob;
      const wy = (Math.random() - 0.5) * wob;
      const wz = (Math.random() - 0.5) * wob;
      return [
        (v[0] * radial + wx) * r,
        (v[1] * radial + wy) * r,
        (v[2] * radial + wz) * r,
      ];
    });
    return { verts, edges: BASE_ICOSA_EDGES };
  }

  function createAsteroid(x, y, tier, vx, vy, forceCi) {
    const t  = TIERS[tier];
    const r  = rng(t.rMin, t.rMax) * sizeScale();
    const ci = forceCi ?? Math.floor(Math.random() * NEON.length);

    let avx = vx, avy = vy;
    if (avx == null) {
      const ang = Math.random() * Math.PI * 2;
      const spd = rng(t.sMin, t.sMax);
      avx = Math.cos(ang) * spd;
      avy = Math.sin(ang) * spd;
    }

    // Slower base spin since 3D rotation is more visually busy
    const rotDir = Math.random() < 0.5 ? 1 : -1;
    const rotSpd = rotDir * rng(
      tier === 'gigantic' ? 0.03 : tier === 'large' ? 0.08 : tier === 'medium' ? 0.16 : 0.28,
      tier === 'gigantic' ? 0.10 : tier === 'large' ? 0.22 : tier === 'medium' ? 0.40 : 0.62
    );

    // Per-asteroid lumpiness so each rock has unique chunkiness
    const lumpiness = rng(0.45, 0.72);
    const shape3D = makeRockShape(r, lumpiness);
    // Independent yaw/pitch/roll for proper 3D feel
    const eulerSpd = {
      x: rng(-0.6, 0.6) * (tier === 'small' ? 1.6 : tier === 'medium' ? 1.2 : tier === 'large' ? 1.0 : 0.50),
      y: rng(-0.6, 0.6) * (tier === 'small' ? 1.6 : tier === 'medium' ? 1.2 : tier === 'large' ? 1.0 : 0.50),
      z: rotSpd,
    };

    return {
      x, y, vx: avx, vy: avy,
      rotation: Math.random() * Math.PI * 2, // kept for compatibility (z-axis angle)
      rotSpd,
      eulerX: Math.random() * Math.PI * 2,
      eulerY: Math.random() * Math.PI * 2,
      eulerZ: Math.random() * Math.PI * 2,
      eulerSpd,
      tier, r,
      hp: t.hp, maxHp: t.hp,
      shape3D,
      // 2D silhouette (computed each frame) — needed so we can clip/fill the body
      projected: new Array(shape3D.verts.length),
      hullIdx:   [],
      ci,
      glowPh:   Math.random() * Math.PI * 2,
      hitFlash: 0,
      bounceCD: 0,
      swirl:    null,
      dead:     false,
      frozen:   0,
      frozenVx: 0,
      frozenVy: 0,
      thaw:     null,
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
        t.splits, vx, vy, a.ci
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

  // ── Auto-spawner ──────────────────────────────────────────────────

  let autoTimer    = rng(8, 15);
  let pendingSpawns = []; // [{ delay, fn }] — queued individual spawns for barrages

  function getGlobeCenter() {
    const globeEl = document.getElementById('globe-canvas');
    if (globeEl) {
      const gr = globeEl.getBoundingClientRect();
      return { x: gr.left + gr.width / 2, y: gr.top + gr.height / 2 };
    }
    return { x: canvas.width * 0.5, y: canvas.height * 0.5 };
  }

  // Spawn one asteroid from a given edge side (0=top,1=right,2=bottom,3=left)
  function spawnOne(tier, side) {
    const W = canvas.width, H = canvas.height;
    let x, y;
    if      (side === 0) { x = rng(W * 0.1, W * 0.9); y = -90; }
    else if (side === 1) { x = W + 90;  y = rng(H * 0.1, H * 0.9); }
    else if (side === 2) { x = rng(W * 0.1, W * 0.9); y = H + 90; }
    else                 { x = -90;     y = rng(H * 0.1, H * 0.9); }
    const gc = getGlobeCenter();
    const t  = TIERS[tier];
    const dx = gc.x - x + (Math.random() - 0.5) * 90;
    const dy = gc.y - y + (Math.random() - 0.5) * 90;
    const d  = Math.hypot(dx, dy) || 1;
    const spd = rng(t.sMin, t.sMax);
    asteroids.push(createAsteroid(x, y, tier, (dx / d) * spd, (dy / d) * spd));
  }

  // Spawn a side-by-side cluster from one edge
  function spawnCluster(tier, count) {
    const W = canvas.width, H = canvas.height;
    const side = Math.floor(Math.random() * 4);
    let baseX, baseY;
    if      (side === 0) { baseX = rng(W * 0.15, W * 0.85); baseY = -90; }
    else if (side === 1) { baseX = W + 90;  baseY = rng(H * 0.15, H * 0.85); }
    else if (side === 2) { baseX = rng(W * 0.15, W * 0.85); baseY = H + 90; }
    else                 { baseX = -90;     baseY = rng(H * 0.15, H * 0.85); }

    const gc = getGlobeCenter();
    const t  = TIERS[tier];
    const aimX = gc.x + (Math.random() - 0.5) * 80;
    const aimY = gc.y + (Math.random() - 0.5) * 80;
    const tDx = aimX - baseX, tDy = aimY - baseY;
    const tD  = Math.hypot(tDx, tDy) || 1;
    const pnx = -tDy / tD, pny = tDx / tD; // perpendicular axis

    const spacing = tier === 'gigantic' ? 300 : tier === 'large' ? 170 : tier === 'medium' ? 105 : 68;

    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spacing;
      const x = baseX + pnx * offset;
      const y = baseY + pny * offset;
      const indAimX = aimX + (Math.random() - 0.5) * 45;
      const indAimY = aimY + (Math.random() - 0.5) * 45;
      const dx = indAimX - x, dy = indAimY - y;
      const d  = Math.hypot(dx, dy) || 1;
      const spd = rng(t.sMin, t.sMax);
      asteroids.push(createAsteroid(x, y, tier, (dx / d) * spd, (dy / d) * spd));
    }
  }

  // Queue a rapid barrage of small asteroids, all from the same edge
  function queueBarrage() {
    const count = 10 + Math.floor(Math.random() * 6); // 10–15
    const side  = Math.floor(Math.random() * 4);       // one side for the whole barrage
    let delay = 0;
    for (let i = 0; i < count; i++) {
      delay += rng(0.18, 0.42);
      const d = delay, s = side;
      pendingSpawns.push({ delay: d, fn: () => { if (asteroids.length < 22) spawnOne('small', s); } });
    }
  }

  function spawnWave() {
    const hasGigantic = asteroids.some(a => a.tier === 'gigantic' && !a.dead);
    // 8% chance of a solo gigantic, only if none already on screen
    if (!hasGigantic && Math.random() < 0.08) {
      spawnOne('gigantic', Math.floor(Math.random() * 4));
      return;
    }
    if (Math.random() < 0.38) {
      // Barrage: 10–15 small asteroids rapid-fired from one edge
      queueBarrage();
    } else {
      // Cluster: 2+ asteroids side-by-side — only skip if very crowded
      if (asteroids.length >= 18) return;
      const tr = Math.random();
      const tier = tr < 0.45 ? 'small' : tr < 0.75 ? 'medium' : 'large';
      const count = tier === 'large' ? 2 + Math.floor(Math.random() * 2)
                  : tier === 'medium' ? 2 + Math.floor(Math.random() * 3)
                  : 3 + Math.floor(Math.random() * 3);
      spawnCluster(tier, count);
    }
  }

  // ── Update ────────────────────────────────────────────────────────

  function update(dt) {
    // Auto-spawn wave
    autoTimer -= dt;
    if (autoTimer <= 0) {
      spawnWave();
      autoTimer = rng(5, 10);
    }

    // Tick queued barrage spawns
    for (let i = pendingSpawns.length - 1; i >= 0; i--) {
      pendingSpawns[i].delay -= dt;
      if (pendingSpawns[i].delay <= 0) {
        pendingSpawns[i].fn();
        pendingSpawns.splice(i, 1);
      }
    }

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

    const g    = getGlobeBounds();
    const moon = window.getMoonScreenPos ? window.getMoonScreenPos() : null;
    const W = canvas.width, H = canvas.height;

    // Asteroid-asteroid collisions
    for (let i = asteroids.length - 1; i >= 1; i--) {
      if (asteroids[i].dead || asteroids[i].swirl) continue;
      for (let j = i - 1; j >= 0; j--) {
        if (asteroids[j].dead || asteroids[j].swirl) continue;
        const ai = asteroids[i], aj = asteroids[j];
        const dx = ai.x - aj.x, dy = ai.y - aj.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dx / dist, ny = dy / dist;
        // Support-function test: collision when dist < extent of ai toward aj + extent of aj toward ai
        const minD = support2D(ai, -nx, -ny) + support2D(aj, nx, ny);
        if (dist < minD) {
          const overlap = minD - dist;
          ai.x += nx * overlap * 0.5;
          ai.y += ny * overlap * 0.5;
          aj.x -= nx * overlap * 0.5;
          aj.y -= ny * overlap * 0.5;
          const relVn = (ai.vx - aj.vx) * nx + (ai.vy - aj.vy) * ny;
          if (relVn < 0) {
            const imp = -relVn * 0.9;
            ai.vx += imp * nx; ai.vy += imp * ny;
            aj.vx -= imp * nx; aj.vy -= imp * ny;
          }
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

      if (a.frozen > 0) {
        a.frozen = Math.max(0, a.frozen - dt);
        if (a.frozen === 0) {
          a.thaw = { age: 0, maxAge: 1.5, vx: a.frozenVx, vy: a.frozenVy };
        }
        if (a.bounceCD > 0) a.bounceCD -= dt;
        const fship = window.Spaceship && window.Spaceship.get();
        if (fship && !fship.exploding && !fship.swirl) {
          const sdx = fship.x - a.x, sdy = fship.y - a.y;
          const sd  = Math.hypot(sdx, sdy) || 1;
          const minDist = a.r * 0.75 + 14;
          if (sd < minDist) {
            const nx = sdx / sd, ny = sdy / sd;
            fship.x = a.x + nx * minDist;
            fship.y = a.y + ny * minDist;
            const relVn = fship.vx * nx + fship.vy * ny;
            if (relVn < 0) { fship.vx -= relVn * nx * 1.5; fship.vy -= relVn * ny * 1.5; }
            if (a.bounceCD <= 0) {
              a.bounceCD = 0.6;
              window.Spaceship.hit(fship.x, fship.y, a.frozenVx, a.frozenVy, 2);
              damageAsteroid(i, 1, a.x, a.y);
            }
          }
        }
        continue;
      }

      // Spin and velocity ramp during thaw; full speed otherwise
      let spinFrac = 1;
      if (a.thaw) {
        a.thaw.age += dt;
        const tf = Math.min(1, a.thaw.age / a.thaw.maxAge);
        spinFrac = tf;
        a.vx = a.thaw.vx * tf;
        a.vy = a.thaw.vy * tf;
        if (tf >= 1) a.thaw = null;
      }
      a.eulerX = (a.eulerX + a.eulerSpd.x * spinFrac * dt) % (Math.PI * 2);
      a.eulerY = (a.eulerY + a.eulerSpd.y * spinFrac * dt) % (Math.PI * 2);
      a.eulerZ = (a.eulerZ + a.eulerSpd.z * spinFrac * dt) % (Math.PI * 2);
      a.rotation = a.eulerZ;

      // BH swirl animation
      if (a.swirl) {
        if (window.BlackHole.updateSwirl(a, dt)) a.dead = true;
        continue;
      }

      // BH gravity pull
      if (window.BlackHole && window.BlackHole.applyGravity(a, dt, { swirlMaxAge: 2.5, gravityK: 1000000, minSwirlR: 6 })) continue;

      a.x += a.vx * dt;
      a.y += a.vy * dt;

      if (a.bounceCD > 0) a.bounceCD -= dt;

      // Globe collision
      if (g) {
        const bdx   = a.x - g.x, bdy = a.y - g.y;
        const bdist = Math.hypot(bdx, bdy);
        if (bdist < g.r + a.r * 0.75) {
          const nx = bdx / (bdist || 1), ny = bdy / (bdist || 1);
          a.x = g.x + nx * (g.r + a.r * 0.75);
          a.y = g.y + ny * (g.r + a.r * 0.75);
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

      // Moon collision
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

      // Spaceship collision
      const ship = window.Spaceship && window.Spaceship.get();
      if (ship && !ship.exploding && !ship.swirl) {
        const sdx     = ship.x - a.x, sdy = ship.y - a.y;
        const sd      = Math.hypot(sdx, sdy) || 1;
        const minDist = a.r * 0.75 + 14;
        if (sd < minDist) {
          const nx = sdx / sd, ny = sdy / sd;
          ship.x = a.x + nx * minDist;
          ship.y = a.y + ny * minDist;
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

      // Bounce off screen edges
      if (a.x - a.r < 0)  { a.x = a.r;     a.vx = Math.abs(a.vx); }
      if (a.x + a.r > W)  { a.x = W - a.r; a.vx = -Math.abs(a.vx); }
      if (a.y - a.r < 0)  { a.y = a.r;     a.vy = Math.abs(a.vy); }
      if (a.y + a.r > H)  { a.y = H - a.r; a.vy = -Math.abs(a.vy); }
    }
  }

  // ── Draw ─────────────────────────────────────────────────────────

  // Project a single 3D point through XYZ rotation to 2D screen space.
  // Returns [sx, sy, z] where z is depth (more positive = closer to viewer).
  function project(v, ex, ey, ez, scale) {
    // Rotate around X
    const cx = Math.cos(ex), sx = Math.sin(ex);
    let y1 = v[1] * cx - v[2] * sx;
    let z1 = v[1] * sx + v[2] * cx;
    let x1 = v[0];
    // Rotate around Y
    const cy = Math.cos(ey), sy = Math.sin(ey);
    let x2 = x1 * cy + z1 * sy;
    let z2 = -x1 * sy + z1 * cy;
    let y2 = y1;
    // Rotate around Z
    const cz = Math.cos(ez), sz = Math.sin(ez);
    let x3 = x2 * cz - y2 * sz;
    let y3 = x2 * sz + y2 * cz;
    // Mild perspective: closer points appear slightly larger
    const persp = 1 + z2 * 0.0008 * scale;
    return [x3 * persp, y3 * persp, z2];
  }

  // How far asteroid `a` extends in screen-space direction (nx, ny).
  // Used for asteroid-asteroid collision so the boundary matches the visible 2D silhouette.
  function support2D(a, nx, ny) {
    let max = -Infinity;
    for (const v of a.shape3D.verts) {
      const p = project(v, a.eulerX, a.eulerY, a.eulerZ, 1);
      const dot = p[0] * nx + p[1] * ny;
      if (dot > max) max = dot;
    }
    return max;
  }

  // Build convex hull of 2D points using gift-wrapping (small N, fast enough).
  // Returns indices into the input array.
  function convexHullIdx(pts) {
    const n = pts.length;
    if (n < 3) return pts.map((_, i) => i);
    // Find leftmost
    let leftmost = 0;
    for (let i = 1; i < n; i++) {
      if (pts[i][0] < pts[leftmost][0] ||
         (pts[i][0] === pts[leftmost][0] && pts[i][1] < pts[leftmost][1])) {
        leftmost = i;
      }
    }
    const hull = [];
    let p = leftmost;
    let safety = 0;
    do {
      hull.push(p);
      let q = (p + 1) % n;
      for (let r = 0; r < n; r++) {
        const cross = (pts[q][0] - pts[p][0]) * (pts[r][1] - pts[p][1]) -
                      (pts[q][1] - pts[p][1]) * (pts[r][0] - pts[p][0]);
        if (cross < 0) q = r;
      }
      p = q;
      safety++;
    } while (p !== leftmost && safety < n + 2);
    return hull;
  }

  function drawAsteroid(a) {
    if (a.dead) return;

    const nc       = NEON[a.ci];
    const glow     = 0.5 + Math.sin(a.glowPh) * 0.25;
    const hitFrac  = Math.min(1, a.hitFlash / 0.22);
    const swFrac   = a.swirl ? Math.max(0, 1 - Math.pow(a.swirl.age / a.swirl.maxAge, 0.55)) : 1;
    const scale    = swFrac;
    const isFrozen = a.frozen > 0;

    // Project all 3D vertices to 2D (local space, asteroid centered at origin)
    const verts3D = a.shape3D.verts;
    for (let i = 0; i < verts3D.length; i++) {
      const p = project(verts3D[i], a.eulerX, a.eulerY, a.eulerZ, scale);
      a.projected[i] = [p[0] * scale, p[1] * scale, p[2]];
    }

    // Compute convex hull of projected points = the silhouette this frame
    a.hullIdx = convexHullIdx(a.projected);

    ctx.save();
    ctx.translate(a.x, a.y);

    // ── 1. Dark body fill (clipped to silhouette) ───────────────────
    ctx.beginPath();
    const h0 = a.projected[a.hullIdx[0]];
    ctx.moveTo(h0[0], h0[1]);
    for (let i = 1; i < a.hullIdx.length; i++) {
      const hp = a.projected[a.hullIdx[i]];
      ctx.lineTo(hp[0], hp[1]);
    }
    ctx.closePath();

    if (isFrozen) {
      if (hitFrac > 0) {
        const fr = Math.round(215 + (255 - 215) * hitFrac);
        const fg = Math.round(245 + (255 - 245) * hitFrac);
        ctx.fillStyle = `rgba(${fr},${fg},255,${0.72 + hitFrac * 0.28})`;
      } else {
        const iceGrad = ctx.createRadialGradient(
          -a.r * 0.20, -a.r * 0.25, 0,
           a.r * 0.05,  a.r * 0.05, a.r * 1.10
        );
        iceGrad.addColorStop(0,    'rgba(215, 245, 255, 0.82)');
        iceGrad.addColorStop(0.45, 'rgba(120, 195, 235, 0.70)');
        iceGrad.addColorStop(1,    'rgba(20,  70, 120, 0.88)');
        ctx.fillStyle = iceGrad;
      }
      ctx.fill();
    } else if (hitFrac > 0) {
      const fr = Math.round(nc.r + (255 - nc.r) * hitFrac);
      const fg = Math.round(nc.g + (255 - nc.g) * hitFrac);
      const fb = Math.round(nc.b + (255 - nc.b) * hitFrac);
      ctx.fillStyle = `rgba(${fr},${fg},${fb},${0.45 + hitFrac * 0.40})`;
      ctx.fill();
    } else {
      // Subtle radial fill: dark center, slightly lit on one side
      const litR = Math.round(nc.r * 0.16);
      const litG = Math.round(nc.g * 0.16);
      const litB = Math.round(nc.b * 0.16);
      const grad = ctx.createRadialGradient(
        -a.r * 0.25, -a.r * 0.30, 0,
         a.r * 0.05,  a.r * 0.05, a.r * 1.10
      );
      grad.addColorStop(0,    `rgba(${litR},${litG},${litB},0.85)`);
      grad.addColorStop(0.55, `rgba(6,3,16,0.88)`);
      grad.addColorStop(1,    `rgba(2,1,8,0.95)`);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // ── 2. Wireframe edges ──────────────────────────────────────────
    // Two passes' worth of styling driven by edge category:
    //   - Silhouette edges (on the convex hull) → brightest, thicker, full glow.
    //   - Interior edges (everything else) → dimmer, thinner, no glow.
    // Depth-sorted (back-to-front) so the painter's order looks right.
    const edges = a.shape3D.edges;
    const edgeData = [];
    for (let i = 0; i < edges.length; i++) {
      const [ia, ib] = edges[i];
      const za = a.projected[ia][2];
      const zb = a.projected[ib][2];
      edgeData.push({ ia, ib, avgZ: (za + zb) * 0.5 });
    }
    edgeData.sort((p, q) => p.avgZ - q.avgZ);

    // Build a set of silhouette-edge keys (hull adjacency pairs)
    const hullEdges = new Set();
    for (let i = 0; i < a.hullIdx.length; i++) {
      const ia = a.hullIdx[i];
      const ib = a.hullIdx[(i + 1) % a.hullIdx.length];
      hullEdges.add(ia < ib ? `${ia}-${ib}` : `${ib}-${ia}`);
    }

    // Per-tier sizing
    const lwHull = a.tier === 'gigantic' ? 3.0 : a.tier === 'large' ? 2.0 : a.tier === 'medium' ? 1.6 : 1.3;
    const lwIn   = a.tier === 'gigantic' ? 1.6 : a.tier === 'large' ? 1.1 : a.tier === 'medium' ? 0.9 : 0.8;
    const baseGlow = (a.tier === 'gigantic' ? 26 : a.tier === 'large' ? 14 : a.tier === 'medium' ? 10 : 7) * (0.7 + glow * 0.6);

    let zMin = Infinity, zMax = -Infinity;
    for (const v of a.projected) {
      if (v[2] < zMin) zMin = v[2];
      if (v[2] > zMax) zMax = v[2];
    }
    const zRange = (zMax - zMin) || 1;

    for (const e of edgeData) {
      const pa = a.projected[e.ia];
      const pb = a.projected[e.ib];
      const depth = (e.avgZ - zMin) / zRange; // 0 = back, 1 = front
      const key = e.ia < e.ib ? `${e.ia}-${e.ib}` : `${e.ib}-${e.ia}`;
      const isSilhouette = hullEdges.has(key);
      const isFront = depth > 0.45;

      let alpha, lw, glw;
      if (isSilhouette) {
        alpha = 1;
        lw    = lwHull;
        glw   = baseGlow + hitFrac * 22;
      } else if (isFront) {
        alpha = 0.70;
        lw    = lwIn;
        glw   = 4;
      } else {
        alpha = 0.30 + depth * 0.25;
        lw    = lwIn;
        glw   = 0;
      }

      const edgeHex   = isFrozen ? '#c8ebff' : nc.hex;
      ctx.shadowColor = edgeHex;
      ctx.shadowBlur  = glw;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = hitFrac > 0.55 ? '#ffffff' : edgeHex;
      ctx.lineWidth   = lw + hitFrac * 1.2;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
      ctx.stroke();
    }

    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;

    // Frost shimmer rings when frozen
    if (isFrozen) {
      const shimmer = 0.20 + Math.sin(a.glowPh * 2.8) * 0.08;
      ctx.save();
      ctx.strokeStyle = 'rgba(210, 248, 255, 0.85)';
      ctx.lineWidth   = 0.7;
      ctx.shadowColor = 'rgba(180, 235, 255, 1)';
      ctx.shadowBlur  = 7;
      for (let k = 0; k < 3; k++) {
        const kr = a.r * (0.28 + k * 0.24);
        ctx.globalAlpha = shimmer * (1 - k * 0.28);
        ctx.beginPath();
        ctx.arc(0, 0, kr, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();

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
    touchAny(x, y, r) {
      for (const a of asteroids) {
        if (a.dead || a.swirl) continue;
        if (Math.hypot(x - a.x, y - a.y) < a.r + r) return true;
      }
      return false;
    },
    getAll: () => asteroids,
    freezeInRadius(cx, cy, r) {
      for (const a of asteroids) {
        if (a.dead || a.swirl || a.frozen > 0) continue;
        if (Math.hypot(a.x - cx, a.y - cy) <= r + a.r) {
          a.frozenVx = a.vx;
          a.frozenVy = a.vy;
          a.frozen   = 5.0;
          a.hitFlash = 0;
          a.thaw     = null;
          a.vx = 0;
          a.vy = 0;
        }
      }
    },
    bhExplode(cx, cy, pullR) {
      for (let i = asteroids.length - 1; i >= 0; i--) {
        const a = asteroids[i];
        if (a.dead) continue;
        if (a.swirl || Math.hypot(a.x - cx, a.y - cy) < pullR) {
          spawnSplitFlash(a);
          a.dead = true;
        } else {
          damageAsteroid(i, 1, a.x, a.y);
        }
      }
    },
  };
})();