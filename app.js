// ── Star field ──────────────────────────────────────────────────

function initStarField() {
  const canvas = document.getElementById('stars-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const COLORS = ['#ffffff', '#ffffff', '#ffffff', '#cce8ff', '#fffbe0', '#ddd0ff'];

  const SILLY_NAMES = [
    'The Drowsy Kettle',        "Philosopher's Thumb",       'Biscuit Minor',
    'The Persistent Noodle',    'The Upside-Down Umbrella',  'The Confused Spatula',
    'Great Sock of the North',  'The Anxious Penguin',       'Mrs Flibbertigibbet',
    'The Wobbly Accordion',     'The Reluctant Trapezoid',   'Donut of Orion',
    'The Forgotten Spoon',      "Captain Biscuit's Belt",    'The Melancholy Hamster',
    'The Overzealous Teapot',   "Schrödinger's Mitten",      'The Tipsy Flamingo',
    'The Bewildered Zucchini',  'Baron Von Fluffington',     'The Accidental Rhombus',
    'The Perpetual Hiccup',     'The Soggy Pretzel',         'The Indecisive Blancmange',
    'The Mysterious Courgette', 'The Reluctant Waltz',       'The Overenthusiastic Snail',
    "Aunt Mildred's Elbow",     'The Philosophical Pickle',  'The Wistful Ladle',
    'The Sneezing Cormorant',   'The Slightly Damp Wizard',  'The Optimistic Crumpet',
    "The Bewildered Archipelago","Uncle Norbert's Sideburn", 'The Galactic Croissant',
    'The Hesitant Trapeze Artist','Madame Wobblebottom',     'The Cosmic Ketchup Bottle',
    'The Nervous Cauliflower',  'The Magnificent Dressing Gown','The Inconclusive Badminton',
    'Reggie the Oblong',        'The Solemn Digestive',      'The Napping Gondolier',
    'The Pensive Kipper',       'The Philosophical Baguette','The Wandering Clog',
    'The Startled Bureaucrat',  'The Dignified Casserole',   'The Perplexed Mandolin',
    'Sir Wobbles a Lot',        'The Timid Pretzel',         'The Existential Waffle',
    'The Muttering Almanac',    'The Chronic Ditherer',      'The Enthusiastic Potato',
    'The Brooding Marmalade',   'The Accidental Maestro',    'The Exasperated Monocle',
    'The Cosmic Oven Mitt',     'The Loitering Syllabub',    'The Oblong Conspiracy',
    'The Disgruntled Accordion','The Snoring Bureaucrat',    "Professor Noodle's Paradox",
    'The Interminable Crouton', 'The Lurching Almanac',      'The Indignant Plunger',
    'The Sentimental Crumpet',  'The Majestic Toadstool',    'The Stuttering Vortex',
    'The Apologetic Nebula',    'The Forgotten Semicolon',   'The Wheezing Contraption',
    'The Dignified Fumble',     'The Galactic Macaron',      'The Solemn Wobble',
    'The Ambitious Sock Drawer','The Bewildered Quiche',     'The Trembling Hypothesis',
    'Countess Bumbersnatch',    'The Meandering Tuba',       'The Cosmic Hiccup Minor',
    'The Philosophical Spanner','The Timid Nebula',          'The Pensive Shoelace',
    'The Reclusive Fondue',     'The Spectacular Anticlimax','The Languishing Obelisk',
    'The Glum Croissant',       'The Restless Semicolon',    'The Ponderous Blancmange',
    'The Indecisive Vortex',    'Brigadier Fluffington',     'The Cosmic Dressing Gown',
    'The Confused Meridian',    'The Melancholy Trapezoid',  'The Oscillating Biscuit Tin',
    'The Magnificent Kerfuffle',
  ];

  // ── Zone-based constellation generation ──────────────────────────────────
  // Screen is divided into a strict 3×2 grid of non-overlapping zones.
  // Each session picks 5 of 6 zones and grows one constellation per zone.
  // Stars are placed randomly inside each zone's inner area so that edges
  // (which connect only stars inside a convex rectangle) can never leave the
  // zone — guaranteeing no overlap or line crossing between constellations.
  // Within a constellation a non-crossing spanning tree is computed via
  // Prim's nearest-neighbour with a segment-intersection guard.

  // 3×2 grid — tablet/desktop
  const ZONES = [
    [0.00, 0.00, 0.33, 0.50],
    [0.33, 0.00, 0.67, 0.50],
    [0.67, 0.00, 1.00, 0.50],
    [0.00, 0.50, 0.33, 1.00],
    [0.33, 0.50, 0.67, 1.00],
    [0.67, 0.50, 1.00, 1.00],
  ];

  // 2×2 grid — mobile (fewer, larger zones so clusters fit inside)
  const ZONES_MOBILE = [
    [0.00, 0.00, 0.50, 0.50],
    [0.50, 0.00, 1.00, 0.50],
    [0.00, 0.50, 0.50, 1.00],
    [0.50, 0.50, 1.00, 1.00],
  ];

  function cross2D(ax, ay, bx, by) { return ax * by - ay * bx; }

  // True iff segment (pts[a]–pts[b]) properly crosses (pts[c]–pts[d]).
  // Shared endpoints are never counted as crossings.
  function segsCross(pts, a, b, c, d) {
    if (a === c || a === d || b === c || b === d) return false;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const [cx, cy] = pts[c], [dx, dy] = pts[d];
    const d1 = cross2D(dx - cx, dy - cy, ax - cx, ay - cy);
    const d2 = cross2D(dx - cx, dy - cy, bx - cx, by - cy);
    const d3 = cross2D(bx - ax, by - ay, cx - ax, cy - ay);
    const d4 = cross2D(bx - ax, by - ay, dx - ax, dy - ay);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
           ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }

  // Nearest-neighbour open chain: walk star-to-star always picking the closest
  // unvisited neighbour that doesn't cross an existing edge and isn't too far away.
  // Result is a simple path — drawable in one stroke with no retracing.
  function buildNonCrossingChain(pts, maxEdge = Infinity) {
    if (pts.length <= 1) return [];
    const visited = new Set([0]);
    const edges   = [];
    let   current = 0;

    while (visited.size < pts.length) {
      let bestDist = Infinity, bestNext = -1;
      for (let b = 0; b < pts.length; b++) {
        if (visited.has(b)) continue;
        const d = Math.hypot(pts[current][0] - pts[b][0], pts[current][1] - pts[b][1]);
        if (d >= bestDist || d > maxEdge) continue;
        if (edges.every(([u, v]) => !segsCross(pts, current, b, u, v))) {
          bestDist = d; bestNext = b;
        }
      }
      if (bestNext === -1) break; // no reachable neighbour — stop here
      edges.push([current, bestNext]);
      visited.add(bestNext);
      current = bestNext;
    }

    return edges;
  }

  // Add one closing edge to the chain to create a loop with an open tail.
  // Rules (all must hold for a candidate closing edge between chain positions i and j):
  //   1. Not the two chain endpoints — that would make a fully closed loop.
  //   2. No crossing with existing edges.
  //   3. Any tail nodes (the stars just outside i and j in the chain) must lie on
  //      the EXTERIOR side of the closing edge, not the interior (loop) side.
  //      This is the fix for tails "going into" the closed shape.
  function addTailLoop(pts, chainEdges) {
    if (chainEdges.length < 3) return [...chainEdges];

    const order = [chainEdges[0][0], ...chainEdges.map(e => e[1])];
    const n = order.length;

    const candidates = [];
    for (let i = 0; i < n - 2; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue; // full closure — no tail

        const pi = order[i], pj = order[j];
        if (!chainEdges.every(([u, v]) => !segsCross(pts, pi, pj, u, v))) continue;

        // Determine which side of the closing edge the loop body lies on.
        // Use the midpoint of the loop path as a "witness" for the interior.
        const [ax, ay] = pts[pi], [bx, by] = pts[pj];
        const midIdx = order[Math.floor((i + j) / 2)];
        const [mx, my] = pts[midIdx];
        const loopSide = cross2D(bx - ax, by - ay, mx - ax, my - ay);
        if (loopSide === 0) continue; // degenerate collinear — skip

        // Reject if any tail node is on the same side as the loop interior.
        let ok = true;
        if (i > 0) {
          const [tx, ty] = pts[order[i - 1]];
          if (cross2D(bx - ax, by - ay, tx - ax, ty - ay) * loopSide > 0) ok = false;
        }
        if (ok && j < n - 1) {
          const [tx, ty] = pts[order[j + 1]];
          if (cross2D(bx - ax, by - ay, tx - ax, ty - ay) * loopSide > 0) ok = false;
        }
        if (!ok) continue;

        const bothInterior = i > 0 && j < n - 1;
        const d = Math.hypot(pts[pi][0] - pts[pj][0], pts[pi][1] - pts[pj][1]);
        candidates.push({ pi, pj, d, bothInterior });
      }
    }

    if (candidates.length === 0) return [...chainEdges]; // fall back to open chain

    candidates.sort((a, b) =>
      a.bothInterior !== b.bothInterior ? (a.bothInterior ? -1 : 1) : a.d - b.d
    );

    const { pi, pj } = candidates[0];
    return [...chainEdges, [pi, pj]];
  }

  function generateConstellationInZone([x0, y0, x1, y1]) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const exclPx = Math.min(340, Math.min(vw, vh) * 0.40);

    const pw = x1 - x0, ph = y1 - y0;
    const ix0 = x0 + pw * 0.12, ix1 = x1 - pw * 0.12;
    const iy0 = y0 + ph * 0.10, iy1 = y1 - ph * 0.10;

    const clusterR = 0.055 + Math.random() * 0.055; // 5.5–11 % of screen width
    let clusterX, clusterY, centerFound = false;
    for (let a = 0; a < 150; a++) {
      const cx = ix0 + Math.random() * (ix1 - ix0);
      const cy = iy0 + Math.random() * (iy1 - iy0);
      const dx = (cx - 0.5) * vw, dy = (cy - 0.5) * vh;
      if (Math.hypot(dx, dy) >= exclPx + clusterR * Math.max(vw, vh)) {
        clusterX = cx; clusterY = cy; centerFound = true; break;
      }
    }
    if (!centerFound) return null;

    // Random start point inside the cluster — chain begins wherever, feels less mechanical
    const startAngle = Math.random() * Math.PI * 2;
    const startR     = clusterR * 0.3 + Math.random() * clusterR * 0.7;
    const pts = [[
      Math.max(ix0, Math.min(ix1, clusterX + Math.cos(startAngle) * startR)),
      Math.max(iy0, Math.min(iy1, clusterY + Math.sin(startAngle) * startR)),
    ]];
    const MIN_D = 0.022;
    const starCount = 4 + Math.floor(Math.random() * 4); // 4–7 stars

    for (let attempts = 0; pts.length < starCount && attempts < 500; attempts++) {
      const angle = Math.random() * Math.PI * 2;
      const r     = Math.random() * clusterR;
      const x = clusterX + Math.cos(angle) * r;
      const y = clusterY + Math.sin(angle) * r;
      if (x < ix0 || x > ix1 || y < iy0 || y > iy1) continue;
      const dx = (x - 0.5) * vw, dy = (y - 0.5) * vh;
      if (Math.hypot(dx, dy) < exclPx) continue;
      if (pts.every(([px, py]) => Math.hypot(x - px, y - py) >= MIN_D)) {
        pts.push([x, y]);
      }
    }

    if (pts.length < 2) return null;

    const chain = buildNonCrossingChain(pts, clusterR * 2.0);
    const edges = addTailLoop(pts, chain);
    return { pts, edges };
  }

  function generateSessionDefs() {
    const vmin = Math.min(window.innerWidth, window.innerHeight);
    // mobile: 2×2 grid, 3 constellations — less clutter on small screens
    // widescreen: all 6 zones — fills the extra sky on large monitors
    // default: 3×2 grid, 5 constellations
    const zones = vmin < 600 ? ZONES_MOBILE : ZONES;
    const count = vmin < 600 ? 3 : vmin >= 900 ? 6 : 5;

    const defs = [];
    for (const zone of zones.slice().sort(() => Math.random() - 0.5)) {
      if (defs.length >= count) break;
      const def = generateConstellationInZone(zone);
      if (def) defs.push(def);
    }
    return defs;
  }
  const sessionDefs = generateSessionDefs();

  const sessionNames = (() => {
    const names = SILLY_NAMES.slice().sort(() => Math.random() - 0.5);
    // ~5 % chance per session that one constellation is the rare Yashi Pozmantiria
    if (Math.random() < 0.05) names[Math.floor(Math.random() * 5)] = 'Yashi Pozmantiria';
    return names;
  })();

  let stars = [], constellations = [], shooting = null;
  let rafId = null, shootTimer = null, active = false, t = 0;
  let bgGrad = null, neb1 = null, neb2 = null, neb3 = null;
  let mouseX = -1, mouseY = -1;

  function buildBackground() {
    bgGrad = ctx.createRadialGradient(
      canvas.width * 0.45, 0, 0,
      canvas.width * 0.5, canvas.height * 0.6, Math.max(canvas.width, canvas.height) * 1.2
    );
    bgGrad.addColorStop(0,    '#1c0a3a');
    bgGrad.addColorStop(0.35, '#0d0d1e');
    bgGrad.addColorStop(0.75, '#07070f');
    bgGrad.addColorStop(1,    '#030308');

    neb1 = ctx.createRadialGradient(
      canvas.width * 0.72, canvas.height * 0.28, 0,
      canvas.width * 0.72, canvas.height * 0.28, canvas.width * 0.5
    );
    neb1.addColorStop(0,   'rgba(110,20,170,0.38)');
    neb1.addColorStop(0.4, 'rgba(70,10,120,0.18)');
    neb1.addColorStop(1,   'rgba(0,0,0,0)');

    neb2 = ctx.createRadialGradient(
      canvas.width * 0.18, canvas.height * 0.72, 0,
      canvas.width * 0.18, canvas.height * 0.72, canvas.width * 0.42
    );
    neb2.addColorStop(0,   'rgba(15,65,160,0.30)');
    neb2.addColorStop(0.4, 'rgba(10,45,110,0.14)');
    neb2.addColorStop(1,   'rgba(0,0,0,0)');

    neb3 = ctx.createRadialGradient(
      canvas.width * 0.48, canvas.height * 0.85, 0,
      canvas.width * 0.48, canvas.height * 0.85, canvas.width * 0.38
    );
    neb3.addColorStop(0,   'rgba(160,20,90,0.22)');
    neb3.addColorStop(0.5, 'rgba(90,10,55,0.10)');
    neb3.addColorStop(1,   'rgba(0,0,0,0)');
  }

  function buildStars() {
    stars = Array.from({ length: 210 }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      r:     Math.random() ** 1.4 * 1.7 + 0.3,
      base:  Math.random() * 0.55 + 0.3,
      amp:   Math.random() * 0.28 + 0.05,
      freq:  Math.random() * 0.5 + 0.15,
      phase: Math.random() * Math.PI * 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    constellations = sessionDefs.map((def, ci) => {
      const indices = def.pts.map(([fx, fy]) => {
        const idx = stars.length;
        stars.push({
          x:     fx * canvas.width,
          y:     fy * canvas.height,
          r:     0.85 + Math.random() * 0.55,
          base:  0.62,
          amp:   0.22,
          freq:  0.08 + Math.random() * 0.14,
          phase: Math.random() * Math.PI * 2,
          color: '#cce8ff',
        });
        return idx;
      });
      return {
        name:       sessionNames[ci],
        edges:      def.edges,
        indices,
        hoverAlpha: 0,
        flashAlpha: 0,
        flashing:   false,
        flashP:     0,
        nextFlash:  ci * 1.8 + 1.5 + Math.random() * 4,
      };
    });
  }

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    buildBackground();
    buildStars();
  }

  function spawnShooting() {
    if (shooting) return;
    const angle = Math.PI * 0.3 + (Math.random() - 0.5) * 0.7;
    const speed = 7 + Math.random() * 5;
    shooting = {
      x:    -20 + Math.random() * canvas.width * 0.55,
      y:    Math.random() * canvas.height * 0.45,
      dx:   Math.cos(angle),
      dy:   Math.sin(angle),
      speed,
      tail: 90 + Math.random() * 70,
      life: 1.0,
    };
  }

  function scheduleNext() {
    shootTimer = setTimeout(() => {
      if (active) { spawnShooting(); scheduleNext(); }
    }, 5000 + Math.random() * 8000);
  }

  function findHoveredCon() {
    if (mouseX < 0 || mouseY < 0) return -1;
    const threshold = Math.max(42, canvas.width * 0.028);
    for (let ci = 0; ci < constellations.length; ci++) {
      for (const idx of constellations[ci].indices) {
        if (Math.hypot(stars[idx].x - mouseX, stars[idx].y - mouseY) < threshold) return ci;
      }
    }
    return -1;
  }

  function drawTooltip(text, x, y, alpha) {
    const pad = 14, h = 28;
    ctx.save();
    ctx.font = 'italic 13px Georgia, "Times New Roman", serif';
    const tw = ctx.measureText(text).width;
    const bw = tw + pad * 2;
    const bx = Math.max(6, Math.min(canvas.width - bw - 6, x - bw / 2));
    const by = Math.max(6, y - h - 14);
    const r  = h / 2; // full pill radius

    // soft glow halo behind the pill
    ctx.globalAlpha = alpha * 0.30;
    ctx.shadowColor = 'rgba(150, 175, 255, 1)';
    ctx.shadowBlur  = 16;
    ctx.fillStyle   = 'rgba(110, 140, 255, 0.18)';
    ctx.beginPath();
    ctx.roundRect(bx - 6, by - 6, bw + 12, h + 12, r + 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    // pill body
    ctx.globalAlpha = alpha * 0.92;
    ctx.fillStyle   = 'rgba(7, 4, 26, 0.86)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, h, r);
    ctx.fill();

    // pill border
    ctx.strokeStyle = 'rgba(165, 190, 255, 0.45)';
    ctx.lineWidth   = 0.9;
    ctx.stroke();

    // label
    ctx.globalAlpha  = alpha;
    ctx.fillStyle    = 'rgba(215, 228, 255, 0.97)';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + pad, by + h / 2);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    t += 1 / 60;

    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = neb1;   ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = neb2;   ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = neb3;   ctx.fillRect(0, 0, canvas.width, canvas.height);

    stars.forEach(s => {
      ctx.globalAlpha = Math.max(0.04, Math.min(1, s.base + Math.sin(t * s.freq * Math.PI * 2 + s.phase) * s.amp));
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    const hovered    = findHoveredCon();
    const anyHovered = hovered >= 0;
    const DT = 1 / 60;

    for (let ci = 0; ci < constellations.length; ci++) {
      const con = constellations[ci];

      con.nextFlash -= DT;
      if (con.nextFlash <= 0 && !con.flashing) {
        con.flashing  = true;
        con.flashP    = 0;
        con.nextFlash = 4 + Math.random() * 9;
      }
      if (con.flashing) {
        con.flashP += DT / 6.0;
        if (con.flashP >= 1) { con.flashing = false; con.flashP = 0; }
        const fp  = con.flashP;
        const env = fp < 0.2 ? Math.sin((fp / 0.2) * Math.PI / 2)
                  : fp < 0.8 ? 1
                  : Math.cos(((fp - 0.8) / 0.2) * Math.PI / 2);
        con.flashAlpha = env * 0.58;
      } else {
        con.flashAlpha = 0;
      }

      con.hoverAlpha += ((ci === hovered ? 1 : 0) - con.hoverAlpha) * 0.07;

      const isHovered = ci === hovered;
      const alpha = isHovered
        ? con.hoverAlpha
        : anyHovered
          ? con.flashAlpha * 0.20
          : Math.max(con.hoverAlpha, con.flashAlpha);
      if (alpha < 0.01) continue;

      ctx.globalAlpha = alpha * (isHovered ? 0.75 : 0.28);
      ctx.strokeStyle = isHovered ? 'rgba(220, 235, 255, 1)' : 'rgba(180, 210, 255, 1)';
      ctx.lineWidth   = isHovered ? 1.3 : 0.7;
      ctx.lineCap = 'round';
      for (const [i, j] of con.edges) {
        const sa = stars[con.indices[i]];
        const sb = stars[con.indices[j]];
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.stroke();
      }

      if (con.hoverAlpha > 0.12) {
        let centX = 0, topY = Infinity;
        for (const idx of con.indices) {
          centX += stars[idx].x;
          if (stars[idx].y < topY) topY = stars[idx].y;
        }
        centX /= con.indices.length;
        drawTooltip(con.name, centX, topY, con.hoverAlpha);
      }
    }

    ctx.globalAlpha = 1;

    if (shooting) {
      const tailX = shooting.x - shooting.dx * shooting.tail;
      const tailY = shooting.y - shooting.dy * shooting.tail;

      const grad = ctx.createLinearGradient(shooting.x, shooting.y, tailX, tailY);
      grad.addColorStop(0,   `rgba(255,255,255,${shooting.life})`);
      grad.addColorStop(0.2, `rgba(200,230,255,${shooting.life * 0.65})`);
      grad.addColorStop(1,   'rgba(140,170,255,0)');

      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(shooting.x, shooting.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      const glowG = ctx.createRadialGradient(shooting.x, shooting.y, 0, shooting.x, shooting.y, 5);
      glowG.addColorStop(0, `rgba(255,255,255,${shooting.life * 0.9})`);
      glowG.addColorStop(1, 'rgba(200,220,255,0)');
      ctx.fillStyle = glowG;
      ctx.beginPath();
      ctx.arc(shooting.x, shooting.y, 5, 0, Math.PI * 2);
      ctx.fill();

      shooting.x += shooting.dx * shooting.speed;
      shooting.y += shooting.dy * shooting.speed;
      shooting.life -= 0.018;
      if (shooting.life <= 0 || shooting.x > canvas.width + 120 || shooting.y > canvas.height + 120) {
        shooting = null;
      }
    }

    ctx.globalAlpha = 1;
    if (active) rafId = requestAnimationFrame(draw);
  }

  function start() {
    if (active) return;
    active = true;
    resize();
    draw();
    scheduleNext();
  }

  window.addEventListener('resize', () => { if (active) resize(); });

  // Skip events that originate from the globe canvas — pointer capture makes those
  // bubble to document even mid-drag, which would falsely trigger constellation hover.
  const notGlobe = e => e.target.id !== 'globe-canvas';
  document.addEventListener('pointermove',  e => { if (notGlobe(e)) { mouseX = e.clientX; mouseY = e.clientY; } });
  document.addEventListener('pointerleave', () => { mouseX = -1; mouseY = -1; });
  document.addEventListener('pointerdown',  e => { if (notGlobe(e)) { mouseX = e.clientX; mouseY = e.clientY; } });
  document.addEventListener('pointerup',    () => { mouseX = -1; mouseY = -1; });

  // Prevent mobile scroll and pinch-zoom across the whole page.
  // CSS overflow:hidden + overscroll-behavior don't stop iOS Safari's elastic
  // scroll; a non-passive touchmove listener with preventDefault() does.
  // gesturestart/change block Safari's native pinch-zoom gesture.
  document.addEventListener('touchmove',     e => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart',  e => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });

  start();
}

// ── Init ─────────────────────────────────────────────────────────

initStarField();
