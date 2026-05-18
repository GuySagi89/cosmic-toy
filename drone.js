// ── Deployable Drone ──────────────────────────────────────────────
// AI-controlled drone that orbits the globe and shoots lasers at
// asteroids in its line of sight.
(function () {
  const canvas = document.getElementById('stars-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const ORBIT_SPEED  = 0.55;   // rad/s
  const ORBIT_FACTOR = 2.6;    // orbitR = globeR * ORBIT_FACTOR
  const LASER_SPEED  = 900;    // px/s
  const LASER_LIFE   = 3.5;    // seconds
  const FIRE_RATE    = 1.0;    // seconds between shots
  const TRAIL_MAX    = 6;
  const DRONE_SIZE   = 8;      // equilateral triangle "radius" px
  const LASER_HIT_R  = 6;
  const DRONE_HP     = 3;
  const DRONE_HIT_R  = 10;

  let deployed     = false;
  let angle        = 0;
  let lasers       = [];
  let laserImpacts = [];
  let fireTimer    = 0;
  let droneHp      = DRONE_HP;
  let hitFlash     = 0;
  let fragments    = [];

  // Last computed drone position (shared between update and draw)
  let droneX = 0, droneY = 0;
  // Last target (shared so draw can show aim line)
  let currentTarget = null;

  // Returns true if segment A→B is blocked by circle (C, cr)
  function segmentBlockedByCircle(ax, ay, bx, by, cx, cy, cr) {
    const dx = bx - ax, dy = by - ay;
    const fx = ax - cx, fy = ay - cy;
    const a  = dx * dx + dy * dy;
    const b  = 2 * (fx * dx + fy * dy);
    const c  = fx * fx + fy * fy - cr * cr;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return false;
    const sq = Math.sqrt(disc);
    const t1 = (-b - sq) / (2 * a);
    const t2 = (-b + sq) / (2 * a);
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
  }

  function spawnDeathFragments(x, y) {
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 120 + Math.random() * 180;
      const ml  = 0.3 + Math.random() * 0.2;
      fragments.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: ml, maxLife: ml,
        r: 1.0 + Math.random() * 1.8,
      });
    }
  }

  function update(dt) {
    // Always tick fragments (they outlive deployed=false briefly)
    for (let i = fragments.length - 1; i >= 0; i--) {
      const p = fragments[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.88, dt * 60);
      p.vy *= Math.pow(0.88, dt * 60);
      p.life -= dt;
      if (p.life <= 0) fragments.splice(i, 1);
    }

    if (!deployed) return;

    const g = window.CosmicUtils.getGlobeBounds();
    if (!g) return;
    const orbitR = g.r * ORBIT_FACTOR;

    angle  = (angle + ORBIT_SPEED * dt) % (Math.PI * 2);
    droneX = g.x + Math.cos(angle) * orbitR;
    droneY = g.y + Math.sin(angle) * orbitR;

    // Target: nearest asteroid with unobstructed LoS
    currentTarget = null;
    let bestDist  = Infinity;
    if (window.Asteroids) {
      for (const a of window.Asteroids.getAll()) {
        if (a.dead || a.swirl) continue;
        const dist = Math.hypot(a.x - droneX, a.y - droneY);
        if (dist >= bestDist) continue;
        if (segmentBlockedByCircle(droneX, droneY, a.x, a.y, g.x, g.y, g.r)) continue;
        bestDist      = dist;
        currentTarget = a;
      }
    }

    // Fire laser
    fireTimer -= dt;
    if (currentTarget && fireTimer <= 0) {
      const dx   = currentTarget.x - droneX;
      const dy   = currentTarget.y - droneY;
      const dist = Math.hypot(dx, dy);
      if (dist > 1) {
        const nx = dx / dist, ny = dy / dist;
        lasers.push({
          x: droneX + nx * 12,
          y: droneY + ny * 12,
          vx: nx * LASER_SPEED,
          vy: ny * LASER_SPEED,
          age: 0,
          trail: [],
        });
      }
      fireTimer = FIRE_RATE;
    }
    if (fireTimer < 0) fireTimer = 0;

    // Advance lasers
    const addTrailPoint = window.CosmicUtils.addTrailPoint;
    const W = canvas.width, H = canvas.height;
    for (let i = lasers.length - 1; i >= 0; i--) {
      const l = lasers[i];
      l.age += dt;
      addTrailPoint(l.trail, TRAIL_MAX, l.x, l.y);
      l.x += l.vx * dt;
      l.y += l.vy * dt;

      let hit = false;
      if (Math.hypot(l.x - g.x, l.y - g.y) < g.r) {
        laserImpacts.push({ x: l.x, y: l.y, age: 0, maxAge: 0.28 });
        hit = true;
      }
      if (!hit && window.Asteroids && window.Asteroids.checkHit(l.x, l.y, LASER_HIT_R, 1)) {
        laserImpacts.push({ x: l.x, y: l.y, age: 0, maxAge: 0.28 });
        hit = true;
      }
      if (hit || l.age > LASER_LIFE ||
          l.x < -60 || l.x > W + 60 || l.y < -60 || l.y > H + 60) {
        lasers.splice(i, 1);
      }
    }

    // Advance impact flashes
    for (let i = laserImpacts.length - 1; i >= 0; i--) {
      laserImpacts[i].age += dt;
      if (laserImpacts[i].age >= laserImpacts[i].maxAge) laserImpacts.splice(i, 1);
    }

    // Drone–asteroid collision
    hitFlash = Math.max(0, hitFlash - dt);
    if (window.Asteroids) {
      for (const a of window.Asteroids.getAll()) {
        if (a.dead || a.swirl) continue;
        if (Math.hypot(droneX - a.x, droneY - a.y) < DRONE_HIT_R + a.r * 0.75) {
          if (a.bounceCD <= 0) {
            window.Asteroids.checkHit(droneX, droneY, DRONE_HIT_R, 1);
            droneHp  -= 1;
            hitFlash  = 0.22;
            if (droneHp <= 0) {
              spawnDeathFragments(droneX, droneY);
              deployed = false;
              lasers   = [];
              laserImpacts = [];
              fireTimer    = 0;
              currentTarget = null;
              document.getElementById('deployable-drone')?.classList.remove('active');
              return;
            }
          }
        }
      }
    }
  }

  function draw(ctx) {
    // Always draw fragments (persist briefly after destruction)
    if (fragments.length > 0) {
      ctx.save();
      for (const p of fragments) {
        const alpha = (p.life / p.maxLife) * 0.92;
        ctx.globalAlpha = alpha;
        ctx.shadowColor = '#00f5ff';
        ctx.shadowBlur  = 8 * alpha;
        ctx.fillStyle   = '#00f5ff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, p.r), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    if (!deployed) return;

    const g = window.CosmicUtils.getGlobeBounds();
    if (!g) return;
    const orbitR = g.r * ORBIT_FACTOR;
    // Use module-level droneX/droneY (set in update); guard for first frame
    const dx = droneX || g.x + Math.cos(angle) * orbitR;
    const dy = droneY || g.y + Math.sin(angle) * orbitR;

    // 1. Orbit ring — faint dashed circle
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.arc(g.x, g.y, orbitR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 2. Aim line (if targeting)
    if (currentTarget) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#00f5ff';
      ctx.lineWidth   = 1;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(currentTarget.x, currentTarget.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 3. Impact flashes
    ctx.save();
    for (const imp of laserImpacts) {
      const frac = imp.age / imp.maxAge;
      const a    = 1 - frac;
      const r    = (1 - Math.pow(frac, 0.4)) * 18;
      const fg   = ctx.createRadialGradient(imp.x, imp.y, 0, imp.x, imp.y, Math.max(0.5, r));
      fg.addColorStop(0,   `rgba(255,255,255,${a * 0.97})`);
      fg.addColorStop(0.3, `rgba(0,245,255,${a * 0.65})`);
      fg.addColorStop(1,   'rgba(0,180,255,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(imp.x, imp.y, Math.max(0.5, r), 0, Math.PI * 2);
      ctx.fill();
      // Expanding arc ring
      ctx.strokeStyle  = `rgba(0,230,255,${a * 0.80})`;
      ctx.lineWidth    = (1 - frac) * 2.0 + 0.3;
      ctx.shadowColor  = 'rgba(0,220,255,0.8)';
      ctx.shadowBlur   = 10;
      ctx.beginPath();
      ctx.arc(imp.x, imp.y, Math.max(0.5, frac * 26), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
    ctx.restore();

    // 4. Laser beams
    ctx.save();
    for (const l of lasers) {
      const pts = [{ x: l.x, y: l.y }, ...l.trail];
      for (let i = 0; i < pts.length - 1; i++) {
        const t      = 1 - i / pts.length;
        const color  = i < 2 ? `rgba(200,255,255,${t * 0.92})` : `rgba(0,230,255,${t * 0.85})`;
        ctx.globalAlpha = t * 0.9;
        ctx.shadowColor = 'rgba(0,220,255,1)';
        ctx.shadowBlur  = 14 * t;
        ctx.strokeStyle = color;
        ctx.lineWidth   = Math.max(0.5, (2.8 - i * 0.35));
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
        ctx.stroke();
      }
    }
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
    ctx.restore();

    // 5. Drone body — equilateral triangle pointing in direction of travel
    const travelAngle = angle + Math.PI / 2;
    const flashing    = hitFlash > 0;
    const color       = flashing ? '#ffffff' : '#00f5ff';

    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(travelAngle);

    ctx.shadowColor = flashing ? '#ffffff' : '#00f5ff';
    ctx.shadowBlur  = flashing ? 20 : 14;

    ctx.beginPath();
    ctx.moveTo(0, -DRONE_SIZE);
    ctx.lineTo(-DRONE_SIZE * 0.866, DRONE_SIZE * 0.5);
    ctx.lineTo( DRONE_SIZE * 0.866, DRONE_SIZE * 0.5);
    ctx.closePath();

    if (!flashing) {
      const fillG = ctx.createRadialGradient(0, 0, 0, 0, 0, DRONE_SIZE);
      fillG.addColorStop(0, 'rgba(0,245,255,0.45)');
      fillG.addColorStop(1, 'rgba(0,100,130,0.10)');
      ctx.fillStyle = fillG;
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
    }
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.stroke();

    ctx.restore();
  }

  function toggleDrone() {
    deployed = !deployed;
    if (deployed) {
      angle         = 0;
      lasers        = [];
      laserImpacts  = [];
      fireTimer     = 0;
      droneHp       = DRONE_HP;
      hitFlash      = 0;
      fragments     = [];
      currentTarget = null;
    }
    document.getElementById('deployable-drone')?.classList.toggle('active', deployed);
  }

  window.Deployables  = { update, draw };
  window.toggleDrone  = toggleDrone;
})();
