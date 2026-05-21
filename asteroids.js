// ── Asteroids ─────────────────────────────────────────────────────
// Visual: rotating 3D wireframe polyhedra with inner detail patterns.
// Gameplay/physics: unchanged from previous version.
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

  // Size tiers
  const isMobile = window.innerWidth <= 768;
  const mobileSz = isMobile ? 0.6 : 1;
  const TIERS = {
    large:  { rMin: 54 * mobileSz, rMax: 72 * mobileSz, sMin: 22, sMax: 46 },
    medium: { rMin: 27 * mobileSz, rMax: 41 * mobileSz, sMin: 38, sMax: 68 },
    small:  { rMin: 13 * mobileSz, rMax: 21 * mobileSz, sMin: 58, sMax: 95 },
  };

  let asteroids = [];
  let fragments = [];

  let grabbedAsteroid = null;
  let grabOffX = 0, grabOffY = 0;
  let grabHist  = [];
  let grabGlobeHitTime = 0;
  let grabMoonHitTime  = 0;

  function rng(a, b) { return a + Math.random() * (b - a); }

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

  function createAsteroid(x, y, tier, vx, vy) {
    const t  = TIERS[tier];
    const r  = rng(t.rMin, t.rMax);
    const ci = Math.floor(Math.random() * NEON.length);

    const avx = vx ?? 0;
    const avy = vy ?? 0;

    // Slower base spin since 3D rotation is more visually busy
    const rotDir = Math.random() < 0.5 ? 1 : -1;
    const rotSpd = rotDir * rng(
      tier === 'large' ? 0.08 : tier === 'medium' ? 0.16 : 0.28,
      tier === 'large' ? 0.22 : tier === 'medium' ? 0.40 : 0.62
    );

    // Per-asteroid lumpiness so each rock has unique chunkiness
    const lumpiness = rng(0.45, 0.72);
    const shape3D = makeRockShape(r, lumpiness);
    // Independent yaw/pitch/roll for proper 3D feel
    const eulerSpd = {
      x: rng(-0.6, 0.6) * (tier === 'small' ? 1.6 : tier === 'medium' ? 1.2 : 1),
      y: rng(-0.6, 0.6) * (tier === 'small' ? 1.6 : tier === 'medium' ? 1.2 : 1),
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
      shape3D,
      // 2D silhouette (computed each frame) — needed so we can clip/fill the body
      projected: new Array(shape3D.verts.length),
      hullIdx:   [],
      ci,
      glowPh:   Math.random() * Math.PI * 2,
      hitFlash: 0,
      frozen:   0,
      bounceCD: 0,
      swirl:    null,
      dead:     false,
      neonTint: null,
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

  // ── Hit effects ───────────────────────────────────────────────────

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

    // Asteroid-asteroid collisions
    for (let i = asteroids.length - 1; i >= 1; i--) {
      if (asteroids[i].dead || asteroids[i].swirl || asteroids[i] === grabbedAsteroid) continue;
      for (let j = i - 1; j >= 0; j--) {
        if (asteroids[j].dead || asteroids[j].swirl || asteroids[j] === grabbedAsteroid) continue;
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
            spawnHitSparks(ai, ai.x, ai.y); ai.hitFlash = 0.22;
            spawnHitSparks(aj, aj.x, aj.y); aj.hitFlash = 0.22;
          }
        }
      }
    }

    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];
      if (a.dead) { asteroids.splice(i, 1); continue; }

      a.hitFlash = Math.max(0, a.hitFlash - dt);
      if (a.frozen > 0) a.frozen = Math.max(0, a.frozen - dt);
      a.glowPh   = (a.glowPh + dt * 1.7) % (Math.PI * 2);

      // Advance 3D Euler angles (paused while frozen)
      if (a.frozen <= 0) {
        a.eulerX = (a.eulerX + a.eulerSpd.x * dt) % (Math.PI * 2);
        a.eulerY = (a.eulerY + a.eulerSpd.y * dt) % (Math.PI * 2);
        a.eulerZ = (a.eulerZ + a.eulerSpd.z * dt) % (Math.PI * 2);
        a.rotation = a.eulerZ;
      }

      // Skip all physics while being held
      if (a === grabbedAsteroid) continue;

      // BH swirl animation
      if (a.swirl) {
        const sw   = a.swirl;
        sw.age    += dt;
        if (sw.bh.age >= sw.bh.maxAge) { a.dead = true; continue; }
        const frac = sw.age / sw.maxAge;
        const r    = sw.r * Math.pow(1 - frac, 0.65);
        const bhF  = sw.bh.age / sw.bh.maxAge;
        const bhEv = Math.max(0, (bhF - 0.92) / 0.08);
        const rs   = sw.bh.baseRadius * Math.max(0.05, 1 - bhEv * 0.9);
        if (frac >= 1 || r <= rs) { a.dead = true; continue; }
        sw.angle  += (3 + frac * 10) * dt;
        a.x        = sw.bh.x + Math.cos(sw.angle) * r;
        a.y        = sw.bh.y + Math.sin(sw.angle) * r;
        continue;
      }

      // BH gravity pull
      for (const bh of allBHs) {
        const dx = bh.x - a.x, dy = bh.y - a.y;
        const d  = Math.hypot(dx, dy);
        if (d < bh.baseRadius * 8) {
          a.swirl = { bh, angle: Math.atan2(a.y - bh.y, a.x - bh.x), r: Math.max(d, 6), age: 0, maxAge: 2.5 };
          break;
        }
        if (d < bh.baseRadius * 30) {
          const g = 1000000 / (d * d);
          a.vx += (dx / d) * g * dt;
          a.vy += (dy / d) * g * dt;
        }
      }
      if (a.swirl) continue;

      a.x += a.vx * dt;
      a.y += a.vy * dt;

      // Friction: coast to a stop after being knocked
      if (Math.hypot(a.vx, a.vy) > 1) {
        const decay = Math.pow(0.94, dt * 60);
        a.vx *= decay;
        a.vy *= decay;
      } else {
        a.vx = 0; a.vy = 0;
      }

      if (a.bounceCD > 0) a.bounceCD -= dt;

      // Globe collision
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
            spawnHitSparks(a, a.x, a.y);
            a.hitFlash = 0.22;
          }
        }
      }

      // Moon collision
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
            spawnHitSparks(a, a.x, a.y);
            a.hitFlash = 0.22;
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
            window.Spaceship.hit(ship.x, ship.y, a.vx, a.vy);
            spawnHitSparks(a, a.x, a.y);
            a.hitFlash = 0.22;
          }
        }
      }

      // Bounce off screen edges
      if (a.x - a.r < 0)  { a.x = a.r;     a.vx = Math.abs(a.vx); }
      if (a.x + a.r > W)  { a.x = W - a.r; a.vx = -Math.abs(a.vx); }
      if (a.y - a.r < 0)  { a.y = a.r;     a.vy = Math.abs(a.vy); }
      if (a.y + a.r > H)  { a.y = H - a.r; a.vy = -Math.abs(a.vy); }
    }

    // Grabbed asteroid acts as an immovable wall — pushes other asteroids and spaceship
    if (grabbedAsteroid && !grabbedAsteroid.dead) {
      const ga = grabbedAsteroid;

      for (let i = asteroids.length - 1; i >= 0; i--) {
        const a = asteroids[i];
        if (a === ga || a.dead || a.swirl) continue;
        const dx = a.x - ga.x, dy = a.y - ga.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dx / dist, ny = dy / dist;
        const minD = support2D(ga, -nx, -ny) + support2D(a, nx, ny);
        if (dist < minD) {
          a.x += nx * (minD - dist);
          a.y += ny * (minD - dist);
          const vn = a.vx * nx + a.vy * ny;
          if (vn < 0) { a.vx -= 1.8 * vn * nx; a.vy -= 1.8 * vn * ny; }
          const newVn = a.vx * nx + a.vy * ny;
          if (newVn < 160) { a.vx += (160 - newVn) * nx; a.vy += (160 - newVn) * ny; }
          if (a.bounceCD <= 0) {
            a.bounceCD = 0.5;
            spawnHitSparks(a, ga.x, ga.y);
            a.hitFlash = 0.22;
            ga.hitFlash = 0.22;
          }
        }
      }

      const ship = window.Spaceship && window.Spaceship.get();
      if (ship && !ship.exploding && !ship.swirl) {
        const sdx = ship.x - ga.x, sdy = ship.y - ga.y;
        const sd = Math.hypot(sdx, sdy) || 1;
        const minDist = ga.r * 0.75 + 14;
        if (sd < minDist) {
          const nx = sdx / sd, ny = sdy / sd;
          ship.x = ga.x + nx * minDist;
          ship.y = ga.y + ny * minDist;
          const vn = ship.vx * nx + ship.vy * ny;
          if (vn < 0) { ship.vx -= 1.8 * vn * nx; ship.vy -= 1.8 * vn * ny; }
          const newVn = ship.vx * nx + ship.vy * ny;
          if (newVn < 160) { ship.vx += (160 - newVn) * nx; ship.vy += (160 - newVn) * ny; }
          if (ga.bounceCD <= 0) {
            ga.bounceCD = 0.5;
            window.Spaceship.hit(ship.x, ship.y, nx * 220, ny * 220);
            spawnHitSparks(ga, ga.x, ga.y);
            ga.hitFlash = 0.22;
          }
        }
      }
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

    const frozen  = a.frozen > 0;
    const nc      = frozen ? { hex: '#d8f0ff', r: 216, g: 240, b: 255 } : NEON[a.ci];
    const glow    = 0.5 + Math.sin(a.glowPh) * 0.25;
    const hitFrac = Math.min(1, a.hitFlash / 0.22);
    const swFrac  = a.swirl ? Math.max(0, 1 - Math.pow(a.swirl.age / a.swirl.maxAge, 0.55)) : 1;
    const scale   = swFrac;

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

    if (hitFrac > 0) {
      const fr = Math.round(nc.r + (255 - nc.r) * hitFrac);
      const fg = Math.round(nc.g + (255 - nc.g) * hitFrac);
      const fb = Math.round(nc.b + (255 - nc.b) * hitFrac);
      ctx.fillStyle = `rgba(${fr},${fg},${fb},${0.45 + hitFrac * 0.40})`;
      ctx.fill();
    } else if (frozen) {
      const grad = ctx.createRadialGradient(
        -a.r * 0.25, -a.r * 0.30, 0,
         a.r * 0.05,  a.r * 0.05, a.r * 1.10
      );
      grad.addColorStop(0,    'rgba(210, 240, 255, 0.72)');
      grad.addColorStop(0.55, 'rgba(140, 190, 225, 0.58)');
      grad.addColorStop(1,    'rgba(45,  100, 155, 0.68)');
      ctx.fillStyle = grad;
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
    const lwHull = a.tier === 'large' ? 2.0 : a.tier === 'medium' ? 1.6 : 1.3;
    const lwIn   = a.tier === 'large' ? 1.1 : a.tier === 'medium' ? 0.9 : 0.8;
    const baseGlow = (a.tier === 'large' ? 14 : a.tier === 'medium' ? 10 : 7) * (0.7 + glow * 0.6);

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

      ctx.shadowColor = nc.hex;
      ctx.shadowBlur  = glw;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = hitFrac > 0.55 ? '#ffffff' : nc.hex;
      ctx.lineWidth   = lw + hitFrac * 1.2;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
      ctx.stroke();
    }

    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;

    if (a.neonTint) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.6;
      const ng = ctx.createRadialGradient(0, 0, 0, 0, 0, a.r * 1.3);
      ng.addColorStop(0, `rgba(${a.neonTint.r},${a.neonTint.g},${a.neonTint.b},0.9)`);
      ng.addColorStop(1, `rgba(${a.neonTint.r},${a.neonTint.g},${a.neonTint.b},0)`);
      ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(0, 0, a.r * 1.3, 0, Math.PI * 2); ctx.fill();
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

  function checkHit(x, y, hitR, source) {
    hitR = hitR ?? 10;
    for (let i = 0; i < asteroids.length; i++) {
      const a = asteroids[i];
      if (a.dead || a.swirl) continue;
      if (Math.hypot(x - a.x, y - a.y) < a.r + hitR) {
        spawnHitSparks(a, x, y);
        a.hitFlash = 0.22;
        const dx = a.x - x, dy = a.y - y;
        const d = Math.hypot(dx, dy) || 1;
        a.vx += (dx / d) * 150;
        a.vy += (dy / d) * 150;
        if (source === 'comet') a.frozen = 4.0;
        return true;
      }
    }
    return false;
  }

  window.Asteroids = {
    update,
    draw,
    spawnAt(x, y, tier) {
      const tiers = ['small', 'medium', 'large'];
      const newTier = tier || tiers[Math.floor(Math.random() * tiers.length)];
      const active = asteroids.filter(a => !a.dead);
      if (active.length >= 5) {
        spawnSplitFlash(active[0]);
        active[0].dead = true;
      }
      asteroids.push(createAsteroid(x, y, newTier, 0, 0));
    },
    checkHit,
    getAll: () => asteroids,
    bhExplode(cx, cy, pullR) {
      for (let i = asteroids.length - 1; i >= 0; i--) {
        const a = asteroids[i];
        if (a.dead) continue;
        if (a.swirl || Math.hypot(a.x - cx, a.y - cy) < pullR) {
          spawnSplitFlash(a);
          a.dead = true;
        } else {
          spawnHitSparks(a, a.x, a.y);
          a.hitFlash = 0.22;
        }
      }
    },
    tryGrab(sx, sy) {
      for (let i = asteroids.length - 1; i >= 0; i--) {
        const a = asteroids[i];
        if (a.dead || a.swirl) continue;
        if (Math.hypot(sx - a.x, sy - a.y) < a.r * 0.9) {
          grabbedAsteroid = a;
          grabOffX = a.x - sx; grabOffY = a.y - sy;
          grabHist = [{ x: sx, y: sy, t: performance.now() }];
          a.vx = 0; a.vy = 0;
          return true;
        }
      }
      return false;
    },
    onGrabMove(sx, sy) {
      if (!grabbedAsteroid || grabbedAsteroid.dead) { grabbedAsteroid = null; return; }
      grabbedAsteroid.x = sx + grabOffX;
      grabbedAsteroid.y = sy + grabOffY;
      grabbedAsteroid.vx = 0; grabbedAsteroid.vy = 0;

      const globeEl = document.getElementById('globe-canvas');
      if (globeEl) {
        const gr  = globeEl.getBoundingClientRect();
        const gcx = gr.left + gr.width  / 2;
        const gcy = gr.top  + gr.height / 2;
        const minD = gr.width * 0.22 + grabbedAsteroid.r * 0.75;
        const gdx = grabbedAsteroid.x - gcx, gdy = grabbedAsteroid.y - gcy;
        const gd  = Math.hypot(gdx, gdy) || 1;
        if (gd < minD) {
          grabbedAsteroid.x = gcx + (gdx / gd) * minD;
          grabbedAsteroid.y = gcy + (gdy / gd) * minD;
          const now2 = performance.now();
          if (now2 - grabGlobeHitTime > 350) {
            grabGlobeHitTime = now2;
            window.dispatchEvent(new CustomEvent('comet-globe-impact', {
              detail: { x: grabbedAsteroid.x, y: grabbedAsteroid.y, vx: -(gdx / gd) * 90, vy: -(gdy / gd) * 90, source: 'asteroid' }
            }));
          }
        }
      }

      const moon = window.getMoonScreenPos ? window.getMoonScreenPos() : null;
      if (moon) {
        const minD = moon.r + grabbedAsteroid.r * 0.75;
        const mdx = grabbedAsteroid.x - moon.x, mdy = grabbedAsteroid.y - moon.y;
        const md  = Math.hypot(mdx, mdy) || 1;
        if (md < minD) {
          grabbedAsteroid.x = moon.x + (mdx / md) * minD;
          grabbedAsteroid.y = moon.y + (mdy / md) * minD;
          const now3 = performance.now();
          if (now3 - grabMoonHitTime > 350) {
            grabMoonHitTime = now3;
            window.dispatchEvent(new CustomEvent('comet-moon-impact', {
              detail: { x: grabbedAsteroid.x, y: grabbedAsteroid.y, vx: -(mdx / md) * 220, vy: -(mdy / md) * 220, source: 'asteroid' }
            }));
          }
        }
      }

      grabHist.push({ x: sx, y: sy, t: performance.now() });
      if (grabHist.length > 12) grabHist.shift();
    },
    onGrabRelease() {
      if (!grabbedAsteroid) return;
      const now = performance.now();
      const recent = grabHist.filter(h => now - h.t < 80);
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
      grabbedAsteroid.vx = vx; grabbedAsteroid.vy = vy;
      grabbedAsteroid = null;
    },
    onGrabCancel() {
      if (!grabbedAsteroid) return;
      grabbedAsteroid.vx = 0; grabbedAsteroid.vy = 0;
      grabbedAsteroid = null;
    },
    isGrabbing() { return grabbedAsteroid !== null; },
    applyNeonTintAt(x, y, r, g, b) {
      for (const a of asteroids) {
        if (a.dead || a.swirl) continue;
        if (Math.hypot(x - a.x, y - a.y) < a.r + 12) {
          a.neonTint = { r, g, b };
        }
      }
    },
    hoverTarget(sx, sy) {
      for (const a of asteroids) {
        if (a.dead || a.swirl) continue;
        if (Math.hypot(sx - a.x, sy - a.y) < a.r * 0.9) return true;
      }
      return false;
    },
  };

})();