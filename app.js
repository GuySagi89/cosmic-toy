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

  // 20 shapes — open paths/trees only (no closed polygons), one per screen region
  const CONSTELLATION_DEFS = [
    // ── top-left ──────────────────────────────────────────────────
    // W / Cassiopeia zigzag
    {
      pts:   [[0.04,0.11],[0.09,0.05],[0.15,0.12],[0.21,0.05],[0.27,0.12]],
      edges: [[0,1],[1,2],[2,3],[3,4]],
    },
    // curved hook (6 stars)
    {
      pts:   [[0.06,0.24],[0.12,0.17],[0.19,0.13],[0.26,0.17],[0.29,0.24],[0.24,0.29]],
      edges: [[0,1],[1,2],[2,3],[3,4],[4,5]],
    },
    // Y-fork
    {
      pts:   [[0.30,0.06],[0.34,0.13],[0.31,0.21],[0.40,0.10],[0.37,0.18]],
      edges: [[0,1],[1,2],[1,3],[3,4]],
    },
    // ── top-right ─────────────────────────────────────────────────
    // open arc (Big Dipper-like curve)
    {
      pts:   [[0.74,0.10],[0.79,0.05],[0.85,0.04],[0.91,0.07],[0.95,0.13],[0.93,0.21]],
      edges: [[0,1],[1,2],[2,3],[3,4],[4,5]],
    },
    // zigzag
    {
      pts:   [[0.63,0.07],[0.68,0.03],[0.73,0.08],[0.78,0.03],[0.83,0.09]],
      edges: [[0,1],[1,2],[2,3],[3,4]],
    },
    // branching hook
    {
      pts:   [[0.89,0.05],[0.93,0.10],[0.96,0.16],[0.91,0.20],[0.84,0.18],[0.95,0.23]],
      edges: [[0,1],[1,2],[2,3],[3,4],[2,5]],
    },
    // ── bottom-left ───────────────────────────────────────────────
    // reversed J
    {
      pts:   [[0.07,0.65],[0.13,0.62],[0.20,0.65],[0.23,0.72],[0.18,0.79]],
      edges: [[0,1],[1,2],[2,3],[3,4]],
    },
    // upward fork
    {
      pts:   [[0.05,0.90],[0.09,0.94],[0.14,0.88],[0.10,0.81],[0.17,0.77],[0.20,0.84]],
      edges: [[0,1],[1,2],[2,3],[3,4],[3,5]],
    },
    // zigzag with tail
    {
      pts:   [[0.25,0.65],[0.31,0.70],[0.37,0.65],[0.33,0.78],[0.27,0.84]],
      edges: [[0,1],[1,2],[1,3],[3,4]],
    },
    // ── bottom-right ──────────────────────────────────────────────
    // scorpion-tail curve
    {
      pts:   [[0.70,0.64],[0.76,0.67],[0.82,0.64],[0.87,0.68],[0.90,0.75],[0.85,0.82]],
      edges: [[0,1],[1,2],[2,3],[3,4],[4,5]],
    },
    // bent arm
    {
      pts:   [[0.93,0.82],[0.96,0.76],[0.97,0.70],[0.93,0.65],[0.87,0.68]],
      edges: [[0,1],[1,2],[2,3],[3,4]],
    },
    // Y-branch
    {
      pts:   [[0.65,0.80],[0.70,0.75],[0.75,0.79],[0.79,0.86],[0.73,0.91],[0.69,0.85]],
      edges: [[0,1],[1,2],[2,3],[2,4],[4,5]],
    },
    // ── left edge ────────────────────────────────────────────────
    // kinked vertical chain
    {
      pts:   [[0.04,0.36],[0.09,0.41],[0.05,0.48],[0.09,0.55],[0.04,0.62]],
      edges: [[0,1],[1,2],[2,3],[3,4]],
    },
    // chain with side branch
    {
      pts:   [[0.03,0.55],[0.08,0.59],[0.05,0.66],[0.11,0.63],[0.07,0.71]],
      edges: [[0,1],[1,2],[1,3],[3,4]],
    },
    // ── right edge ───────────────────────────────────────────────
    // kinked vertical chain
    {
      pts:   [[0.93,0.36],[0.88,0.42],[0.93,0.48],[0.88,0.54],[0.93,0.61]],
      edges: [[0,1],[1,2],[2,3],[3,4]],
    },
    // chain with side branch
    {
      pts:   [[0.96,0.57],[0.91,0.61],[0.94,0.68],[0.88,0.65],[0.90,0.73]],
      edges: [[0,1],[1,2],[1,3],[3,4]],
    },
    // ── top-centre ───────────────────────────────────────────────
    // gentle arc
    {
      pts:   [[0.41,0.07],[0.46,0.03],[0.51,0.02],[0.57,0.04],[0.61,0.10]],
      edges: [[0,1],[1,2],[2,3],[3,4]],
    },
    // hooked L
    {
      pts:   [[0.44,0.16],[0.49,0.11],[0.55,0.07],[0.61,0.12],[0.58,0.19]],
      edges: [[0,1],[1,2],[2,3],[3,4]],
    },
    // ── bottom-centre ─────────────────────────────────────────────
    // ladle / hook
    {
      pts:   [[0.40,0.83],[0.46,0.87],[0.52,0.84],[0.57,0.89],[0.52,0.94],[0.44,0.93]],
      edges: [[0,1],[1,2],[2,3],[3,4],[4,5]],
    },
    // zigzag chain
    {
      pts:   [[0.38,0.90],[0.44,0.85],[0.50,0.91],[0.56,0.85],[0.62,0.91]],
      edges: [[0,1],[1,2],[2,3],[3,4]],
    },
  ];

  // Regions ensure at most one constellation per screen zone — no overlaps
  const REGIONS = [
    [0,1,2],   // top-left
    [3,4,5],   // top-right
    [6,7,8],   // bottom-left
    [9,10,11], // bottom-right
    [12,13],   // left edge
    [14,15],   // right edge
    [16,17],   // top-centre
    [18,19],   // bottom-centre
  ];

  // Pick 5 non-overlapping constellations: one per region, but skip any whose
  // centroid is within MIN_DIST of an already-accepted one.
  function pickSessionDefs() {
    const MIN_DIST = 0.22;
    function centroid(def) {
      let sx = 0, sy = 0;
      for (const [x, y] of def.pts) { sx += x; sy += y; }
      return [sx / def.pts.length, sy / def.pts.length];
    }
    const chosen = [], centroids = [];
    for (const group of REGIONS.slice().sort(() => Math.random() - 0.5)) {
      if (chosen.length >= 5) break;
      const def = CONSTELLATION_DEFS[group[Math.floor(Math.random() * group.length)]];
      const c = centroid(def);
      if (centroids.every(([cx, cy]) => Math.hypot(c[0] - cx, c[1] - cy) >= MIN_DIST)) {
        chosen.push(def);
        centroids.push(c);
      }
    }
    return chosen;
  }
  const sessionDefs = pickSessionDefs();

  const sessionNames = SILLY_NAMES.slice().sort(() => Math.random() - 0.5);

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

  document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
  document.addEventListener('mouseleave', () => { mouseX = -1; mouseY = -1; });

  start();
}

// ── Init ─────────────────────────────────────────────────────────

initStarField();
