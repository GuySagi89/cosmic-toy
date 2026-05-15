// ── Meteor Shower ─────────────────────────────────────────────
(function () {
  const canvas = document.getElementById('stars-canvas');
  const ctx    = canvas.getContext('2d');

  const COUNT          = 28;
  const SPAWN_DURATION = 1.4;   // s to emit all meteors
  const BASE_SPEED     = 800;   // px/s
  const SPEED_VARIANCE = 220;
  const SPREAD         = 130;   // perpendicular spread (total)
  const BACK_OFFSET    = 360;   // how far behind release to start spawning

  let showers = [];

  function launch(sx, sy, dirX, dirY) {
    const len = Math.hypot(dirX, dirY);
    if (len < 8) return;
    const dx = dirX / len, dy = dirY / len;
    showers.push({
      dx, dy,
      px: -dy, py: dx,    // perpendicular unit vector
      ox: sx,  oy: sy,    // release point (shower target)
      elapsed: 0,
      spawned: 0,
      meteors: [],
    });
  }

  function spawnOne(s) {
    const spread = (Math.random() - 0.5) * SPREAD;
    const back   = BACK_OFFSET + Math.random() * 90;
    const drift  = (Math.random() - 0.5) * 32;
    const sp     = BASE_SPEED + (Math.random() - 0.5) * SPEED_VARIANCE;
    s.meteors.push({
      x:  s.ox - s.dx * back + s.px * spread,
      y:  s.oy - s.dy * back + s.py * spread,
      vx: s.dx * sp + s.px * drift,
      vy: s.dy * sp + s.py * drift,
      r:  2.2 + Math.random() * 1.4,
      trail: [],
      age: 0,
    });
  }

  function update(dt) {
    const globeEl = document.getElementById('globe-canvas');
    const gr      = globeEl ? globeEl.getBoundingClientRect() : null;
    const moon    = window.getMoonScreenPos ? window.getMoonScreenPos() : null;

    for (let si = showers.length - 1; si >= 0; si--) {
      const s = showers[si];
      s.elapsed += dt;

      const target = Math.min(COUNT, Math.floor(s.elapsed / SPAWN_DURATION * COUNT));
      while (s.spawned < target) { spawnOne(s); s.spawned++; }

      for (let mi = s.meteors.length - 1; mi >= 0; mi--) {
        const m = s.meteors[mi];
        m.age += dt;

        m.trail.unshift({ x: m.x, y: m.y });
        if (m.trail.length > 8) m.trail.pop();

        m.x += m.vx * dt;
        m.y += m.vy * dt;

        let hit = false;

        if (gr) {
          const gcx = gr.left + gr.width  * 0.5;
          const gcy = gr.top  + gr.height * 0.5;
          if (Math.hypot(m.x - gcx, m.y - gcy) < gr.width * 0.22 + m.r) {
            window.dispatchEvent(new CustomEvent('comet-globe-impact', {
              detail: { x: m.x, y: m.y, vx: m.vx * 0.055, vy: m.vy * 0.055, source: 'meteor' }
            }));
            microDebris(m.x, m.y, m.vx, m.vy);
            hit = true;
          }
        }

        if (!hit && moon && Math.hypot(m.x - moon.x, m.y - moon.y) < moon.r * 1.2 + m.r) {
          window.dispatchEvent(new CustomEvent('comet-moon-impact', {
            detail: { x: m.x, y: m.y, vx: m.vx * 0.055, vy: m.vy * 0.055, source: 'meteor' }
          }));
          microDebris(m.x, m.y, m.vx, m.vy);
          hit = true;
        }

        if (hit || m.age > 4.5 ||
            m.x < -160 || m.x > canvas.width  + 160 ||
            m.y < -160 || m.y > canvas.height + 160) {
          s.meteors.splice(mi, 1);
        }
      }

      if (s.spawned >= COUNT && s.meteors.length === 0) showers.splice(si, 1);
    }
  }

  function microDebris(x, y, vx, vy) {
    if (!window.smokeParticles || window.smokeParticles.length >= 580) return;
    for (let i = 0; i < 5; i++) {
      const a  = Math.random() * Math.PI * 2;
      const sp = 22 + Math.random() * 48;
      window.smokeParticles.push({
        x, y,
        vx: Math.cos(a) * sp + vx * 0.07,
        vy: Math.sin(a) * sp + vy * 0.07,
        life: 0.14 + Math.random() * 0.12, maxLife: 0.26,
        r: 0.9 + Math.random() * 1.2,
        core: false, comet: false,
      });
    }
  }

  function draw() {
    for (const s of showers) {
      for (const m of s.meteors) drawMeteor(m);
    }
  }

  function drawMeteor(m) {
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
  window.MeteorShower = { update, draw };
})();
