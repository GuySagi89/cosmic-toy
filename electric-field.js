(function () {
  const { updateCooldownUI, getGlobeBounds } = window.CosmicUtils;

  const DURATION      = 8.0;
  const COOLDOWN_MAX  = 14.0;
  const SHIELD_FACTOR = 1.62;
  const CX = 250, CY = 250, GLOBE_R = 110;
  const SHIELD_R = GLOBE_R * SHIELD_FACTOR;  // ≈ 178

  let active   = false;
  let age      = 0;
  let cooldown = 0;
  let impacts    = [];     // { angle, age, maxAge }
  let discharges = [];     // { angle, age, maxAge, len } — outward spark tendrils

  function refreshCooldownUI() { updateCooldownUI('electric-field', cooldown, COOLDOWN_MAX); }

  function spawnElectricField() {
    if (cooldown > 0) return;
    active = true; age = 0; impacts = []; discharges = [];
  }

  function impact(sx, sy) {
    const g = getGlobeBounds();
    if (!g) return;
    impacts.push({ angle: Math.atan2(sy - g.y, sx - g.x), age: 0, maxAge: 0.55 });
  }

  function update(dt) {
    if (cooldown > 0) { cooldown = Math.max(0, cooldown - dt); refreshCooldownUI(); }
    if (!active) return;
    age += dt;
    if (age >= DURATION) { active = false; cooldown = COOLDOWN_MAX; refreshCooldownUI(); return; }

    // Random discharge sparks (~6/s)
    if (Math.random() < dt * 6)
      discharges.push({ angle: Math.random() * Math.PI * 2, age: 0,
                        maxAge: 0.10 + Math.random() * 0.14, len: 10 + Math.random() * 22 });

    for (let i = discharges.length - 1; i >= 0; i--) {
      discharges[i].age += dt;
      if (discharges[i].age >= discharges[i].maxAge) discharges.splice(i, 1);
    }
    for (let i = impacts.length - 1; i >= 0; i--) {
      impacts[i].age += dt;
      if (impacts[i].age >= impacts[i].maxAge) impacts.splice(i, 1);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  function drawJaggedArcSeg(ctx, a1, a2, jitter) {
    const STEPS = 5;
    ctx.beginPath();
    for (let i = 0; i <= STEPS; i++) {
      const angle = a1 + (a2 - a1) * (i / STEPS);
      const rr    = SHIELD_R + (i > 0 && i < STEPS ? (Math.random() - 0.5) * jitter : 0);
      const x = CX + Math.cos(angle) * rr, y = CY + Math.sin(angle) * rr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawElectricArcs(ctx, now, alpha) {
    const N = 10, offset = now * 0.35;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(160,235,255,0.9)'; ctx.shadowBlur = 7;
    for (let i = 0; i < N; i++) {
      ctx.strokeStyle = `rgba(140,230,255,${(0.45 + Math.random() * 0.55) * alpha})`;
      ctx.lineWidth   = 0.7 + Math.random() * 0.9;
      drawJaggedArcSeg(ctx,
        (i / N)       * Math.PI * 2 + offset,
        ((i + 1) / N) * Math.PI * 2 + offset,
        8);
    }
    ctx.restore();
  }

  function drawDischarges(ctx, alpha) {
    for (const d of discharges) {
      const frac = d.age / d.maxAge;
      const a    = (1 - frac) * 0.9 * alpha;
      const x0   = CX + Math.cos(d.angle) * SHIELD_R;
      const y0   = CY + Math.sin(d.angle) * SHIELD_R;
      const r2   = SHIELD_R + d.len * (1 - frac);
      ctx.save();
      ctx.strokeStyle = `rgba(210,250,255,${a})`;
      ctx.lineWidth   = 1.0; ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(180,240,255,0.9)'; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(CX + Math.cos(d.angle) * r2 + (Math.random() - 0.5) * 5,
                 CY + Math.sin(d.angle) * r2 + (Math.random() - 0.5) * 5);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawImpactFlash(ctx, imp) {
    const frac = imp.age / imp.maxAge;
    const a    = 1 - frac;
    const x    = CX + Math.cos(imp.angle) * SHIELD_R;
    const y    = CY + Math.sin(imp.angle) * SHIELD_R;

    const fr = 30 * (1 - Math.pow(frac, 0.4));
    const fg = ctx.createRadialGradient(x, y, 0, x, y, fr);
    fg.addColorStop(0,   `rgba(255,255,255,${a * 0.97})`);
    fg.addColorStop(0.3, `rgba(180,242,255,${a * 0.65})`);
    fg.addColorStop(1,   'rgba(60,180,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(x, y, fr, 0, Math.PI * 2); ctx.fill();

    if (frac < 0.35) {
      const tf = frac / 0.35;
      ctx.save();
      ctx.strokeStyle = `rgba(200,248,255,${(1 - tf) * 0.90})`;
      ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(180,240,255,1)'; ctx.shadowBlur = 10;
      for (let k = 0; k < 5; k++) {
        const armAngle = imp.angle + ((k / 4) - 0.5) * (Math.PI * 0.55);
        const armLen   = (22 + Math.random() * 14) * (1 - tf);
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let j = 1; j <= 3; j++)
          ctx.lineTo(x + Math.cos(armAngle) * armLen * (j / 3) + (Math.random() - 0.5) * 7,
                     y + Math.sin(armAngle) * armLen * (j / 3) + (Math.random() - 0.5) * 7);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = a * 0.75; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(160,235,255,1)';
    ctx.lineWidth   = (1 - frac) * 3.5 + 0.3;
    ctx.shadowColor = 'rgba(180,245,255,0.8)'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, frac * 38), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // ── draw() on globe canvas (500×500) ────────────────────────────────────

  function draw(ctx) {
    if (!active) return;
    const now  = performance.now() / 1000;
    const prog = age / DURATION;

    let flicker = 1;
    if (prog > 0.72) {
      const freq = 3 + ((prog - 0.72) / 0.28) * 9;
      flicker = 0.38 + 0.62 * (0.5 + 0.5 * Math.sin(now * freq * Math.PI * 2));
    }
    const alpha = flicker * (0.88 + 0.12 * Math.sin(now * 3.8));

    ctx.save();

    // Annular glow halo
    const grd = ctx.createRadialGradient(CX, CY, SHIELD_R - 16, CX, CY, SHIELD_R + 24);
    grd.addColorStop(0,    `rgba(30,150,255,0)`);
    grd.addColorStop(0.25, `rgba(60,190,255,${alpha * 0.14})`);
    grd.addColorStop(0.52, `rgba(100,225,255,${alpha * 0.22})`);
    grd.addColorStop(0.75, `rgba(60,190,255,${alpha * 0.10})`);
    grd.addColorStop(1,    `rgba(30,150,255,0)`);
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(CX, CY, SHIELD_R + 24, 0, Math.PI * 2); ctx.fill();

    // Dim wide ring
    ctx.beginPath(); ctx.arc(CX, CY, SHIELD_R, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(40,175,255,${alpha * 0.38})`;
    ctx.lineWidth = 14; ctx.shadowColor = 'rgba(80,210,255,0.8)'; ctx.shadowBlur = 22;
    ctx.stroke();

    // Bright crisp ring
    ctx.beginPath(); ctx.arc(CX, CY, SHIELD_R, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(200,245,255,${alpha * 0.88})`;
    ctx.lineWidth = 1.4; ctx.shadowColor = 'rgba(220,252,255,1)'; ctx.shadowBlur = 7;
    ctx.stroke();

    // Inner secondary ring
    ctx.beginPath(); ctx.arc(CX, CY, SHIELD_R - 6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(80,210,255,${alpha * 0.22})`;
    ctx.lineWidth = 2; ctx.shadowBlur = 3; ctx.stroke();

    ctx.shadowBlur = 0;
    drawElectricArcs(ctx, now, alpha);
    drawDischarges(ctx, alpha);
    for (const imp of impacts) drawImpactFlash(ctx, imp);

    ctx.restore();
  }

  // ── drawHUD() on stars canvas (screen coords) ────────────────────────────

  function drawHUD(ctx) {
    if (!active) return;
    const g = getGlobeBounds();
    if (!g) return;
    const now  = performance.now() / 1000;
    const prog = age / DURATION;
    let flicker = 1;
    if (prog > 0.72) {
      const freq = 3 + ((prog - 0.72) / 0.28) * 9;
      flicker = 0.38 + 0.62 * (0.5 + 0.5 * Math.sin(now * freq * Math.PI * 2));
    }
    const hudR  = g.r * SHIELD_FACTOR + 6;
    const endA  = -Math.PI / 2 + (1 - prog) * Math.PI * 2;
    ctx.save();
    ctx.globalAlpha = 0.55 * flicker;
    ctx.strokeStyle = 'rgba(120,230,255,0.90)';
    ctx.lineWidth   = 1.5; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(160,240,255,0.8)'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(g.x, g.y, hudR, -Math.PI / 2, endA);
    ctx.stroke();
    ctx.restore();
  }

  window.spawnElectricField = spawnElectricField;
  window.ElectricField = {
    update, draw, drawHUD,
    isActive:     () => active,
    isReady:      () => cooldown <= 0,
    SHIELD_FACTOR,
    impact,
  };
})();
