// ── Black Hole ────────────────────────────────────────────────────
(function () {
  const canvas = document.getElementById('stars-canvas');
  const ctx    = canvas.getContext('2d');
  const { updateCooldownUI } = window.CosmicUtils;

  let blackHole       = null;
  let dyingBlackHoles = [];
  let cooldown        = 0;
  const COOLDOWN_MAX  = 30;

  function spawnBlackHole(x, y) {
    if (cooldown > 0) return;
    if (blackHole) {
      blackHole.age = blackHole.maxAge * 0.92;
      dyingBlackHoles.push(blackHole);
    }
    blackHole = { x, y, baseRadius: 28 * (window.gadgetScale || 1), age: 0, maxAge: 5.5, rotation: 0 };
    cooldown = COOLDOWN_MAX;
    updateCooldownUI('blackhole', cooldown, COOLDOWN_MAX);
  }

  function lensedPos(sx, sy, bh) {
    const frac     = bh.age / bh.maxAge;
    const bhAlpha  = frac < 0.05 ? frac / 0.05
                   : frac > 0.92 ? (1 - (frac - 0.92) / 0.08)
                   : 1;
    const evapFrac = Math.max(0, (frac - 0.92) / 0.08);
    const rs       = bh.baseRadius * Math.max(0.05, 1 - evapFrac * 0.9);

    const dx = sx - bh.x, dy = sy - bh.y;
    const d  = Math.hypot(dx, dy);
    if (d > bh.baseRadius * 22) return { x: sx, y: sy };
    if (d < rs) return null;
    if (d === 0) return { x: sx, y: sy };

    const ratio    = rs / d;
    const deflect  = Math.pow(ratio, 1.5) * bhAlpha;
    const orbit    = bh.rotation * ratio * ratio * bhAlpha;
    const compress = Math.pow(ratio, 1.5) * 0.32 * bhAlpha;
    const newD     = d * (1 - compress);
    const θ        = Math.atan2(dy, dx);
    return {
      x: bh.x + newD * Math.cos(θ + deflect + orbit),
      y: bh.y + newD * Math.sin(θ + deflect + orbit),
    };
  }

  function applyAllLensing(sx, sy) {
    let pos = { x: sx, y: sy };
    for (const bh of dyingBlackHoles) {
      const p = lensedPos(pos.x, pos.y, bh);
      if (!p) return null;
      pos = p;
    }
    if (blackHole) {
      const p = lensedPos(pos.x, pos.y, blackHole);
      if (!p) return null;
      pos = p;
    }
    return pos;
  }

  function drawBlackHole(bh) {
    const frac     = bh.age / bh.maxAge;
    const bhAlpha  = frac < 0.05 ? frac / 0.05
                   : frac > 0.92 ? (1 - (frac - 0.92) / 0.08)
                   : 1;
    const evapFrac = Math.max(0, (frac - 0.92) / 0.08);
    const rs       = bh.baseRadius * Math.max(0.05, 1 - evapFrac * 0.9);

    ctx.save();
    ctx.globalAlpha = bhAlpha;

    const shadow = ctx.createRadialGradient(bh.x, bh.y, rs, bh.x, bh.y, rs * 13);
    shadow.addColorStop(0,    'rgba(0, 0,  0, 0.80)');
    shadow.addColorStop(0.12, 'rgba(2, 0,  8, 0.50)');
    shadow.addColorStop(0.40, 'rgba(4, 0, 12, 0.20)');
    shadow.addColorStop(1,    'rgba(0, 0,  0, 0)');
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(bh.x, bh.y, rs * 13, 0, Math.PI * 2);
    ctx.fill();

    const ringAlpha = bhAlpha * (1 - evapFrac);
    if (ringAlpha > 0.005) {
      const outerR = bh.baseRadius * 30;
      const innerR = bh.baseRadius * 8;
      ctx.save();

      ctx.setLineDash([5, 14]);
      ctx.lineDashOffset = -bh.rotation * outerR * 0.18;
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, outerR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(180, 130, 255, ${(ringAlpha * 0.10).toFixed(3)})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.setLineDash([4, 8]);
      ctx.lineDashOffset = bh.rotation * innerR * 0.30;
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, innerR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(210, 160, 255, ${(ringAlpha * 0.22).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(bh.x, bh.y, rs * 1.02, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(190, 160, 255, ${0.22 + evapFrac * 0.78})`;
    ctx.lineWidth   = 0.7 + evapFrac * 3.5;
    ctx.shadowColor = 'rgba(180, 150, 255, 1)';
    ctx.shadowBlur  = 5 + evapFrac * 28;
    ctx.stroke();
    ctx.restore();

    ctx.shadowBlur = 0;
    ctx.fillStyle  = '#000000';
    ctx.beginPath();
    ctx.arc(bh.x, bh.y, rs, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  window.spawnBlackHole = spawnBlackHole;

  window.BlackHole = {
    update(dt) {
      if (cooldown > 0) {
        cooldown = Math.max(0, cooldown - dt);
        updateCooldownUI('blackhole', cooldown, COOLDOWN_MAX);
      }
      for (let i = dyingBlackHoles.length - 1; i >= 0; i--) {
        const bh = dyingBlackHoles[i];
        bh.age      += dt;
        bh.rotation += dt * 2.8;
        drawBlackHole(bh);
        if (bh.age >= bh.maxAge) dyingBlackHoles.splice(i, 1);
      }
      if (blackHole) {
        blackHole.age      += dt;
        blackHole.rotation += dt * 2.8;
        drawBlackHole(blackHole);
        if (blackHole.age >= blackHole.maxAge) blackHole = null;
      }
    },
    isReady:      () => cooldown <= 0,
    hasAny:       () => !!(blackHole || dyingBlackHoles.length),
    applyLensing: (x, y) => applyAllLensing(x, y),
    getAll:       () => blackHole ? [blackHole, ...dyingBlackHoles] : [...dyingBlackHoles],
    updateSwirl(obj, dt) {
      const sw = obj.swirl;
      sw.age += dt;
      const frac = sw.age / sw.maxAge;
      const r    = sw.r * Math.pow(1 - frac, 0.65);
      const bhF  = sw.bh.age / sw.bh.maxAge;
      const bhEv = Math.max(0, (bhF - 0.92) / 0.08);
      const rs   = sw.bh.baseRadius * Math.max(0.05, 1 - bhEv * 0.9);
      if (frac >= 1 || r <= rs) return true;
      sw.angle += (3 + frac * 10) * dt;
      obj.x = sw.bh.x + Math.cos(sw.angle) * r;
      obj.y = sw.bh.y + Math.sin(sw.angle) * r;
      return false;
    },
    applyGravity(obj, dt, { swirlMaxAge = 2.5, gravityK = 1000000, minSwirlR = 4 } = {}) {
      const allBHs = blackHole ? [blackHole, ...dyingBlackHoles] : [...dyingBlackHoles];
      if (!allBHs.length) return false;
      for (const bh of allBHs) {
        const dx = bh.x - obj.x, dy = bh.y - obj.y;
        const d  = Math.hypot(dx, dy);
        if (d < bh.baseRadius * 8) {
          obj.swirl = { bh, angle: Math.atan2(obj.y - bh.y, obj.x - bh.x), r: Math.max(d, minSwirlR), age: 0, maxAge: swirlMaxAge };
          return true;
        }
        if (d < bh.baseRadius * 30) {
          const g = gravityK / (d * d);
          obj.vx += (dx / d) * g * dt;
          obj.vy += (dy / d) * g * dt;
        }
      }
      return false;
    },
  };
})();
