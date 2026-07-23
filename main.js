/* ═══════════════════════════════════════════════════════════════
   Ayush Portfolio — Procedural Scroll-Film Engine
   Canvas scenes driven by scroll position. No pre-rendered frames.
   ═══════════════════════════════════════════════════════════════ */

const canvas = document.getElementById("film");
const ctx    = canvas.getContext("2d");
const track  = document.getElementById("track");
const loader = document.getElementById("loader");
const loadbar= document.getElementById("loadbar");
const scrollCue = document.getElementById("scroll-cue");
const captions  = [...document.querySelectorAll(".caption")];

/* ── design tokens ──────────────────────────────────── */
const BG      = "#0A0A0F";
const ACCENT  = "#00D4FF";
const ACCENT2 = "#0099CC";
const WHITE   = "#FFFFFF";
const DIM     = "rgba(139,143,168,0.6)";

/* ── state ──────────────────────────────────────────── */
const state = {
  smooth: 0,
  target: 0,
  ready: false,
  stars: [],
  codeChars: [],
  wireVerts: [],
  neuralNodes: [],
  neuralEdges: [],
  projects: [],
};

/* ── helpers ────────────────────────────────────────── */
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function remap(v, inLo, inHi, outLo, outHi) {
  return outLo + (clamp(v, inLo, inHi) - inLo) / (inHi - inLo) * (outHi - outLo);
}
function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

/* ── init procedural data ───────────────────────────── */
function initData(w, h) {
  // Stars
  state.stars = [];
  for (let i = 0; i < 350; i++) {
    state.stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.8 + 0.2,
      baseOpacity: Math.random() * 0.7 + 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.3 + 0.1,
      depth: Math.random()  // parallax layer
    });
  }

  // Code characters
  const chars = "const fn => {} () return async await import export class let var if else for while map filter reduce push splice".split("");
  state.codeChars = [];
  const cols = Math.ceil(w / 18);
  for (let c = 0; c < cols; c++) {
    state.codeChars.push({
      x: c * 18,
      y: Math.random() * h * 2 - h,
      speed: Math.random() * 2 + 1,
      chars: Array.from({length: Math.floor(Math.random()*20+10)}, () => chars[Math.floor(Math.random()*chars.length)]),
      opacity: Math.random() * 0.5 + 0.2,
      hue: Math.random() > 0.7 ? 190 : (Math.random() > 0.5 ? 0 : 120)
    });
  }

  // Wireframe icosahedron vertices
  const phi = (1 + Math.sqrt(5)) / 2;
  const icoVerts = [
    [-1, phi, 0], [1, phi, 0], [-1,-phi, 0], [1,-phi, 0],
    [0,-1, phi], [0, 1, phi], [0,-1,-phi], [0, 1,-phi],
    [phi, 0,-1], [phi, 0, 1], [-phi, 0,-1], [-phi, 0, 1]
  ];
  const scale = Math.min(w, h) * 0.22;
  state.wireVerts = icoVerts.map(v => ({
    ox: v[0] * scale, oy: v[1] * scale, oz: v[2] * scale,
    scatter: { x: (Math.random()-0.5)*w*1.5, y: (Math.random()-0.5)*h*1.5, z: (Math.random()-0.5)*scale*3 }
  }));
  // Icosahedron edges (20 triangular faces → 30 edges)
  state.wireEdges = [
    [0,11],[0,5],[0,1],[0,7],[0,10],[1,5],[5,11],[11,10],[10,7],[7,1],
    [3,9],[3,4],[3,2],[3,8],[3,6],[9,4],[4,2],[2,6],[6,8],[8,9],
    [4,5],[9,1],[8,7],[6,10],[2,11],[4,11],[9,5],[8,1],[6,7],[2,10]
  ];

  // Neural network
  const layers = [3, 5, 6, 5, 3];
  state.neuralNodes = [];
  state.neuralEdges = [];
  const layerSpacing = w * 0.15;
  const startX = w/2 - (layers.length - 1) * layerSpacing / 2;
  let nodeIdx = 0;
  const layerIndices = [];
  layers.forEach((count, li) => {
    const indices = [];
    const ySpacing = h * 0.08;
    const startY = h/2 - (count - 1) * ySpacing / 2;
    for (let ni = 0; ni < count; ni++) {
      state.neuralNodes.push({
        x: startX + li * layerSpacing,
        y: startY + ni * ySpacing,
        layer: li,
        r: 6,
        pulsePhase: Math.random() * Math.PI * 2
      });
      indices.push(nodeIdx++);
    }
    layerIndices.push(indices);
  });
  // connect adjacent layers
  for (let li = 0; li < layerIndices.length - 1; li++) {
    for (const from of layerIndices[li]) {
      for (const to of layerIndices[li + 1]) {
        state.neuralEdges.push({ from, to, weight: Math.random() });
      }
    }
  }

  // Projects for orbit
  state.projects = [
    { name: "Nova City", angle: 0 },
    { name: "WasteGuideAI", angle: Math.PI * 0.5 },
    { name: "CodeGraph", angle: Math.PI },
    { name: "StudyMate AI", angle: Math.PI * 1.5 },
  ];
}

/* ═══════════════════════════════════════════════════════
   SCENE RENDERERS
   Each scene receives (ctx, w, h, localP) where localP is 0→1
   within that scene's scroll range.
   ═══════════════════════════════════════════════════════ */

/* Chapter 1: Starfield Reveal + "AYUSH" text */
function sceneReveal(ctx, w, h, p, sceneAlpha = 1) {
  // draw stars with parallax
  const time = performance.now() / 1000;
  state.stars.forEach(s => {
    const parallax = 1 + s.depth * 0.5;
    const dy = s.speed * time * 30 * parallax;
    const yy = ((s.y - dy) % h + h) % h;
    const twinkle = Math.sin(time * 2 + s.phase) * 0.3 + 0.7;
    const fade = clamp(p * 4, 0, 1);
    ctx.globalAlpha = s.baseOpacity * twinkle * fade * sceneAlpha;
    ctx.fillStyle = s.depth > 0.7 ? ACCENT : WHITE;
    ctx.beginPath();
    ctx.arc(s.x, yy, s.r * (1 + s.depth * 0.5), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // "AYUSH" text reveal
  const textP = remap(p, 0.15, 0.85, 0, 1);
  if (textP > 0) {
    const fontSize = Math.min(w * 0.18, 200);
    ctx.font = `700 ${fontSize}px 'Space Grotesk', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // glow
    const glowAlpha = easeInOut(clamp(textP, 0, 1)) * 0.4;
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = 60 + Math.sin(performance.now()/500) * 20;
    ctx.globalAlpha = glowAlpha * sceneAlpha;
    ctx.fillStyle = ACCENT;
    ctx.fillText("AYUSH", w/2, h/2);

    // solid text
    ctx.shadowBlur = 0;
    ctx.globalAlpha = easeInOut(clamp(textP, 0, 1)) * sceneAlpha;
    ctx.fillStyle = WHITE;
    ctx.fillText("AYUSH", w/2, h/2);
    ctx.globalAlpha = 1;
  }
}

/* Chapter 2: Code Stream (Matrix-style code rain) */
function sceneCodeStream(ctx, w, h, p, sceneAlpha = 1) {
  const time = performance.now() / 1000;
  const intensity = easeInOut(clamp(p * 2, 0, 1));

  // Dim starfield background
  state.stars.forEach(s => {
    ctx.globalAlpha = s.baseOpacity * 0.15 * sceneAlpha;
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.font = "14px 'Courier New', monospace";
  const visibleCols = Math.floor(state.codeChars.length * intensity);

  for (let i = 0; i < visibleCols; i++) {
    const col = state.codeChars[i];
    const baseY = (time * col.speed * 40 + col.y);

    col.chars.forEach((ch, ci) => {
      const yPos = ((baseY + ci * 20) % (h + 200)) - 100;
      const distFromHead = ci / col.chars.length;
      const fade = (1 - distFromHead) * col.opacity * intensity;

      if (ci === 0) {
        ctx.fillStyle = WHITE;
        ctx.globalAlpha = fade * 1.5 * sceneAlpha;
      } else {
        const hue = col.hue === 0 ? 190 : col.hue;
        ctx.fillStyle = `hsl(${hue}, 80%, ${60 - distFromHead * 30}%)`;
        ctx.globalAlpha = fade * sceneAlpha;
      }
      ctx.fillText(ch, col.x, yPos);
    });
  }

  // structured code block emerging from chaos (second half)
  const blockP = remap(p, 0.4, 1, 0, 1);
  if (blockP > 0) {
    const blockAlpha = easeInOut(blockP) * 0.9 * sceneAlpha;
    ctx.globalAlpha = blockAlpha;
    const bx = w * 0.48, by = h * 0.3;
    const bw = Math.min(w * 0.45, 500), bh = h * 0.4;

    // glass card
    ctx.fillStyle = "rgba(18,18,26,0.85)";
    ctx.strokeStyle = `rgba(0,212,255,${blockAlpha * 0.3})`;
    ctx.lineWidth = 1;
    roundRect(ctx, bx, by, bw, bh, 12);
    ctx.fill();
    ctx.stroke();

    // code lines
    ctx.font = "13px 'Courier New', monospace";
    const lines = [
      { text: "const portfolio = {", color: "#C792EA" },
      { text: '  name: "Ayush",', color: "#82AAFF" },
      { text: '  role: "Full-Stack Developer",', color: "#82AAFF" },
      { text: "  skills: [", color: "#C792EA" },
      { text: '    "React", "Three.js",', color: "#C3E88D" },
      { text: '    "Node.js", "AI/ML",', color: "#C3E88D" },
      { text: "  ],", color: "#C792EA" },
      { text: '  passion: "Building the future"', color: "#FFCB6B" },
      { text: "};", color: "#C792EA" },
    ];
    lines.forEach((line, i) => {
      const lineP = remap(blockP, i * 0.08, i * 0.08 + 0.3, 0, 1);
      ctx.globalAlpha = clamp(lineP, 0, 1) * blockAlpha;
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, bx + 24, by + 40 + i * 24);
    });
  }
  ctx.globalAlpha = 1;
}

/* Chapter 3: 3D Wireframe Construct */
function sceneWireframe(ctx, w, h, p, sceneAlpha = 1) {
  const time = performance.now() / 1000;
  const assembleP = easeInOut(clamp(p * 1.5, 0, 1));

  // Rotate
  const angleY = time * 0.4 + p * Math.PI;
  const angleX = Math.sin(time * 0.2) * 0.3;
  const cosY = Math.cos(angleY), sinY = Math.sin(angleY);
  const cosX = Math.cos(angleX), sinX = Math.sin(angleX);

  // Project vertices
  const projected = state.wireVerts.map(v => {
    // lerp from scatter to assembled position
    const x = lerp(v.scatter.x, v.ox, assembleP);
    const y = lerp(v.scatter.y, v.oy, assembleP);
    const z = lerp(v.scatter.z, v.oz, assembleP);

    // rotate Y then X
    const rx = x * cosY - z * sinY;
    const rz = x * sinY + z * cosY;
    const ry = y * cosX - rz * sinX;
    const rz2 = y * sinX + rz * cosX;

    const fov = 600;
    const scale = fov / (fov + rz2 + 300);
    return {
      sx: w/2 + rx * scale,
      sy: h/2 + ry * scale,
      z: rz2,
      scale
    };
  });

  // Draw edges
  ctx.lineWidth = 1.5;
  state.wireEdges.forEach(([a, b]) => {
    const pa = projected[a], pb = projected[b];
    const avgZ = (pa.z + pb.z) / 2;
    const brightness = remap(avgZ, -300, 300, 0.8, 0.2);
    ctx.strokeStyle = ACCENT;
    ctx.globalAlpha = brightness * assembleP * sceneAlpha;
    ctx.beginPath();
    ctx.moveTo(pa.sx, pa.sy);
    ctx.lineTo(pb.sx, pb.sy);
    ctx.stroke();
  });

  // Draw vertices as glowing dots
  projected.forEach((p2, i) => {
    const pulse = Math.sin(time * 3 + i) * 0.3 + 0.7;
    ctx.globalAlpha = clamp(assembleP * pulse, 0, 1) * sceneAlpha;
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.arc(p2.sx, p2.sy, 3 * p2.scale, 0, Math.PI * 2);
    ctx.fill();
    // glow
    ctx.globalAlpha *= 0.3;
    ctx.beginPath();
    ctx.arc(p2.sx, p2.sy, 8 * p2.scale, 0, Math.PI * 2);
    ctx.fill();
  });

  // floating particles around the structure
  ctx.globalAlpha = assembleP * 0.4 * sceneAlpha;
  for (let i = 0; i < 50; i++) {
    const angle = time * 0.5 + i * 0.126;
    const radius = 150 + Math.sin(time + i) * 80;
    const px = w/2 + Math.cos(angle) * radius;
    const py = h/2 + Math.sin(angle * 0.7) * radius * 0.6;
    ctx.fillStyle = i % 3 === 0 ? ACCENT : WHITE;
    ctx.beginPath();
    ctx.arc(px, py, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* Chapter 4: Neural Network Pulse */
function sceneNeuralNet(ctx, w, h, p, sceneAlpha = 1) {
  const time = performance.now() / 1000;
  const fadeIn = easeInOut(clamp(p * 3, 0, 1));
  const pulseWave = p * 4; // wave travels left to right

  // Draw edges first
  state.neuralEdges.forEach(e => {
    const from = state.neuralNodes[e.from];
    const to = state.neuralNodes[e.to];
    const edgeProgress = clamp(pulseWave - from.layer * 0.5, 0, 1);
    const flowT = (time * 2 + e.weight * 3) % 1;

    ctx.globalAlpha = fadeIn * 0.15 * edgeProgress * sceneAlpha;
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    // data particle flowing along edge
    if (edgeProgress > 0.3) {
      const px = lerp(from.x, to.x, flowT);
      const py = lerp(from.y, to.y, flowT);
      ctx.globalAlpha = fadeIn * 0.6 * edgeProgress * sceneAlpha;
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Draw nodes
  state.neuralNodes.forEach((n, i) => {
    const nodeActive = clamp(pulseWave - n.layer * 0.5, 0, 1);
    const pulse = Math.sin(time * 3 + n.pulsePhase) * 0.3 + 0.7;

    // outer glow
    ctx.globalAlpha = fadeIn * nodeActive * pulse * 0.2 * sceneAlpha;
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 18, 0, Math.PI * 2);
    ctx.fill();

    // core
    ctx.globalAlpha = fadeIn * nodeActive * pulse * sceneAlpha;
    ctx.fillStyle = nodeActive > 0.5 ? ACCENT : WHITE;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fill();

    // bright center
    ctx.fillStyle = WHITE;
    ctx.globalAlpha = fadeIn * nodeActive * pulse * 0.8 * sceneAlpha;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

/* Chapter 5: Project Orbit */
function sceneProjectOrbit(ctx, w, h, p, sceneAlpha = 1) {
  const time = performance.now() / 1000;
  const fadeIn = easeInOut(clamp(p * 2.5, 0, 1));
  const orbitSpeed = time * 0.3 + p * Math.PI * 2;

  // Central glow
  const grd = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, 120);
  grd.addColorStop(0, `rgba(0,212,255,${0.15 * fadeIn * sceneAlpha})`);
  grd.addColorStop(1, "transparent");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(w/2, h/2, 120, 0, Math.PI * 2);
  ctx.fill();

  // Orbit rings
  [0.6, 0.75, 0.9].forEach((r, ri) => {
    const radius = Math.min(w, h) * r * 0.3;
    ctx.globalAlpha = fadeIn * 0.12 * sceneAlpha;
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.ellipse(w/2, h/2, radius, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Projects orbiting
  const radius = Math.min(w, h) * 0.25;
  state.projects.forEach((proj, i) => {
    const angle = orbitSpeed + proj.angle;
    const px = w/2 + Math.cos(angle) * radius;
    const py = h/2 + Math.sin(angle) * radius * 0.35;
    const z = Math.sin(angle);
    const isNear = z > 0;

    // size based on z-depth
    const scale = remap(z, -1, 1, 0.6, 1.2);
    const alpha = remap(z, -1, 1, 0.3, 1) * fadeIn;

    // glow on approach
    if (isNear) {
      ctx.globalAlpha = alpha * 0.3 * sceneAlpha;
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.arc(px, py, 30 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // dot
    ctx.globalAlpha = alpha * sceneAlpha;
    ctx.fillStyle = isNear ? ACCENT : WHITE;
    ctx.beginPath();
    ctx.arc(px, py, 6 * scale, 0, Math.PI * 2);
    ctx.fill();

    // label
    ctx.font = `${(isNear ? 600 : 400)} ${16 * scale}px 'Space Grotesk', sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = isNear ? ACCENT : DIM;
    ctx.globalAlpha = alpha * sceneAlpha;
    ctx.fillText(proj.name, px, py + 24 * scale);
  });

  // floating particles
  ctx.globalAlpha = fadeIn * 0.3 * sceneAlpha;
  for (let i = 0; i < 30; i++) {
    const a = time * 0.2 + i * 0.21;
    const r2 = radius * (0.5 + Math.sin(i * 1.7) * 0.5);
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.arc(w/2 + Math.cos(a) * r2, h/2 + Math.sin(a) * r2 * 0.35, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* Chapter 6: Final Hero Card */
function sceneFinalCard(ctx, w, h, p, sceneAlpha = 1) {
  const fadeIn = easeInOut(clamp(p * 2, 0, 1));
  const time = performance.now() / 1000;

  // Converging particles
  for (let i = 0; i < 80; i++) {
    const angle = (i / 80) * Math.PI * 2 + time * 0.3;
    const maxR = Math.max(w, h) * 0.7;
    const r = maxR * (1 - p * 0.8) + Math.sin(time + i) * 20;
    const px = w/2 + Math.cos(angle) * r;
    const py = h/2 + Math.sin(angle) * r * 0.6;
    ctx.globalAlpha = fadeIn * 0.4 * sceneAlpha;
    ctx.fillStyle = i % 4 === 0 ? ACCENT : WHITE;
    ctx.beginPath();
    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glass card
  const cardW = Math.min(520, w * 0.8);
  const cardH = 220;
  const cx = w/2 - cardW/2;
  const cy = h/2 - cardH/2;

  ctx.globalAlpha = fadeIn * 0.85 * sceneAlpha;
  ctx.fillStyle = "rgba(18,18,26,0.9)";
  ctx.strokeStyle = `rgba(0,212,255,${fadeIn * 0.4})`;
  ctx.lineWidth = 1;
  roundRect(ctx, cx, cy, cardW, cardH, 16);
  ctx.fill();
  ctx.stroke();

  // glow behind card
  ctx.globalAlpha = fadeIn * 0.15 * sceneAlpha;
  ctx.shadowColor = ACCENT;
  ctx.shadowBlur = 60;
  roundRect(ctx, cx, cy, cardW, cardH, 16);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Text inside card
  ctx.globalAlpha = fadeIn * sceneAlpha;
  ctx.textAlign = "center";

  ctx.font = "700 42px 'Space Grotesk', sans-serif";
  ctx.fillStyle = WHITE;
  ctx.fillText("Ayush", w/2, cy + 70);

  ctx.font = "400 18px 'Space Grotesk', sans-serif";
  ctx.fillStyle = ACCENT;
  ctx.fillText("Full-Stack Developer · AI Engineer · 3D Web Creator", w/2, cy + 110);

  ctx.font = "300 14px 'Space Grotesk', sans-serif";
  ctx.fillStyle = DIM;
  ctx.fillText("Scroll down to explore →", w/2, cy + 155);

  // bottom accent line
  ctx.globalAlpha = fadeIn * 0.6 * sceneAlpha;
  const lineW = cardW * 0.3;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w/2 - lineW/2, cy + cardH - 20);
  ctx.lineTo(w/2 + lineW/2, cy + cardH - 20);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

/* ── utility: rounded rect ──────────────────────────── */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ═══════════════════════════════════════════════════════
   SCROLL MAPPING & MAIN LOOP
   ═══════════════════════════════════════════════════════ */

// Chapter scroll ranges (must match data-in/hold/out in HTML)
const CHAPTERS = [
  { start: 0.00, end: 0.15, render: sceneReveal },
  { start: 0.15, end: 0.30, render: sceneCodeStream },
  { start: 0.30, end: 0.50, render: sceneWireframe },
  { start: 0.50, end: 0.65, render: sceneNeuralNet },
  { start: 0.65, end: 0.82, render: sceneProjectOrbit },
  { start: 0.82, end: 1.00, render: sceneFinalCard },
];

function progress() {
  const max = track.offsetHeight - window.innerHeight;
  return max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
}

function updateCaptions(p) {
  for (const el of captions) {
    const tIn = +el.dataset.in, tHold = +el.dataset.hold, tOut = +el.dataset.out;
    const rise = Math.max((tHold - tIn) * 0.4, 0.008);
    const fall = Math.max((tOut - tHold) * 0.6, 0.008);
    let o = 0;
    if (p >= tIn && p <= tOut) {
      o = Math.min((p - tIn) / rise, 1) * Math.min((tOut - p) / fall, 1);
      o = clamp(o, 0, 1);
    }
    el.style.opacity = o.toFixed(3);
    const drift = (p - tHold) * -40;
    el.style.transform = `${transformBase(el)} translateY(${drift.toFixed(1)}px)`;
  }
  if (scrollCue) scrollCue.style.opacity = p < 0.015 ? 1 : 0;
}

function transformBase(el) {
  if (el.classList.contains("cap-center")) return "translate(-50%, -50%)";
  if (el.classList.contains("cap-top") || el.classList.contains("cap-bottom")) return "translateX(-50%)";
  return "translateY(-50%)";
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  initData(canvas.width, canvas.height);
}

let lastT = performance.now();
function tick(now) {
  const dt = Math.min((now - lastT) / 1000, 0.1) || 0.016;
  lastT = now;

  if (state.ready) {
    const p = progress();
    state.target = p;
    const k = 1 - Math.exp(-dt * 14);
    state.smooth += (state.target - state.smooth) * k;
    if (Math.abs(state.target - state.smooth) < 0.001) state.smooth = state.target;

    const sp = state.smooth;

    // clear
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // render active scene(s) with crossfade
    CHAPTERS.forEach(ch => {
      const pad = 0.05; // 5% scroll padding for crossfade
      if (sp >= ch.start - pad && sp <= ch.end + pad) {
        const localP = clamp((sp - ch.start) / (ch.end - ch.start), 0, 1);
        
        let sceneAlpha = 1;
        if (sp < ch.start) sceneAlpha = clamp((sp - (ch.start - pad)) / pad, 0, 1);
        else if (sp > ch.end) sceneAlpha = clamp(((ch.end + pad) - sp) / pad, 0, 1);
        
        ctx.save();
        ch.render(ctx, canvas.width, canvas.height, localP, sceneAlpha);
        ctx.restore();
      }
    });

    updateCaptions(sp);
  }
  requestAnimationFrame(tick);
}

/* ── boot ──────────────────────────────────────────── */
window.addEventListener("resize", resize);
resize();

// Simulate loading (no frames to fetch — just init)
let loadP = 0;
const loadInterval = setInterval(() => {
  loadP += 0.08 + Math.random() * 0.12;
  if (loadP >= 1) loadP = 1;
  if (loadbar) loadbar.style.width = `${loadP * 100}%`;
  if (loadP >= 1) {
    clearInterval(loadInterval);
    state.ready = true;
    setTimeout(() => {
      if (loader) loader.classList.add("done");
    }, 300);
  }
}, 50);

requestAnimationFrame(tick);
