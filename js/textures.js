/* Procedural canvas textures for the suit. No external image assets. */
(function (global) {
  'use strict';

  const RED = '#b82129';
  const RED_DARK = '#8f161d';
  const RED_SPIDER = '#8d1d24';
  const BLUE = '#164e86';
  const BLUE_DARK = '#0f3a68';
  const WEB = 'rgba(18, 12, 14, 0.85)';
  const WEB_HI = 'rgba(255, 190, 190, 0.16)';
  const LENS = '#f4f3ec';

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function tex(canvas, isColor, rx, ry) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.anisotropy = 8;
    if (isColor) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // Fine woven textile relief, used as a bump map. Grayscale.
  let _fabricBump = null;
  function fabricBump() {
    if (_fabricBump) return _fabricBump;
    const S = 256;
    const c = makeCanvas(S, S);
    const x = c.getContext('2d');
    x.fillStyle = '#808080';
    x.fillRect(0, 0, S, S);
    // warp and weft threads
    for (let i = 0; i < S; i += 3) {
      x.strokeStyle = 'rgba(255,255,255,0.07)';
      x.lineWidth = 1.0;
      x.beginPath(); x.moveTo(0, i + 0.5); x.lineTo(S, i + 0.5); x.stroke();
      x.strokeStyle = 'rgba(0,0,0,0.06)';
      x.beginPath(); x.moveTo(0, i + 1.5); x.lineTo(S, i + 1.5); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,0.05)';
      x.beginPath(); x.moveTo(i + 0.5, 0); x.lineTo(i + 0.5, S); x.stroke();
      x.strokeStyle = 'rgba(0,0,0,0.05)';
      x.beginPath(); x.moveTo(i + 1.5, 0); x.lineTo(i + 1.5, S); x.stroke();
    }
    // tiny fibre noise
    const img = x.getImageData(0, 0, S, S);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 26;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = d[i]; d[i + 2] = d[i];
    }
    x.putImageData(img, 0, 0);
    _fabricBump = tex(c, false, 40, 40);
    return _fabricBump;
  }

  // Subtle colour grain overlay (drawn onto colour canvases at low alpha).
  function grain(ctx, w, h, amount) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * (amount || 10);
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
  }

  // A raised-looking web line: dark core plus a faint lit edge to read as a ridge.
  function webLine(ctx, x1, y1, x2, y2, width) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = WEB_HI;
    ctx.lineWidth = (width || 10) + 4;
    ctx.beginPath(); ctx.moveTo(x1 + 1.5, y1 + 1.5); ctx.lineTo(x2 + 1.5, y2 + 1.5); ctx.stroke();
    ctx.strokeStyle = WEB;
    ctx.lineWidth = width || 10;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  // Radial web centred on (cx,cy). Rings are slightly polygonal like the reference.
  function radialWeb(ctx, cx, cy, radius, spokes, rings, width) {
    const pts = [];
    for (let s = 0; s < spokes; s++) {
      const a = (s / spokes) * Math.PI * 2 - Math.PI / 2;
      const ex = cx + Math.cos(a) * radius;
      const ey = cy + Math.sin(a) * radius;
      webLine(ctx, cx, cy, ex, ey, width);
      pts.push({ a, ex, ey });
    }
    for (let r = 1; r <= rings; r++) {
      const f = r / rings;
      const rad = radius * Math.pow(f, 1.12);
      ctx.beginPath();
      for (let i = 0; i <= spokes; i++) {
        const a = ((i % spokes) / spokes) * Math.PI * 2 - Math.PI / 2;
        // gentle inward bow between spokes
        const bow = rad * (1 - 0.055 * Math.sin(Math.PI * ((i % spokes) / spokes)));
        const px = cx + Math.cos(a) * bow;
        const py = cy + Math.sin(a) * bow;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = WEB_HI; ctx.lineWidth = (width || 10) + 4; ctx.stroke();
      ctx.strokeStyle = WEB; ctx.lineWidth = width || 10; ctx.stroke();
    }
  }

  function spider(ctx, cx, cy, size, colour, legWidth) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = colour;
    ctx.strokeStyle = colour;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // abdomen + cephalothorax
    ctx.beginPath(); ctx.ellipse(0, size * 0.30, size * 0.30, size * 0.40, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -size * 0.22, size * 0.22, size * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    // eight legs, symmetrical
    for (const s of [-1, 1]) {
      const legs = [
        [[0.02, -0.32], [0.42, -0.70], [0.95, -0.72]],
        [[0.10, -0.10], [0.55, -0.25], [1.06, -0.20]],
        [[0.14, 0.12], [0.58, 0.22], [1.00, 0.42]],
        [[0.12, 0.34], [0.48, 0.62], [0.80, 0.92]]
      ];
      for (const L of legs) {
        ctx.beginPath();
        ctx.moveTo(s * L[0][0] * size, L[0][1] * size);
        ctx.quadraticCurveTo(s * L[1][0] * size, L[1][1] * size, s * L[2][0] * size, L[2][1] * size);
        ctx.lineWidth = legWidth || size * 0.10;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---- Torso: 1024x1024 unwrap. u=0.25 front, u=0.75 back. Canvas top = neck. ----
  function torsoMap() {
    const W = 1024, H = 1024;
    const c = makeCanvas(W, H);
    const x = c.getContext('2d');
    x.fillStyle = RED; x.fillRect(0, 0, W, H);

    // blue mid band wraps sides and back (canvas y ~ 34%..86%)
    x.fillStyle = BLUE;
    x.fillRect(0, H * 0.34, W, H * 0.52);
    // slight gradient for fabric depth
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,255,255,0.06)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.0)');
    g.addColorStop(1, 'rgba(0,0,0,0.16)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    // red front centre panel over the band (u 0.13..0.37)
    x.fillStyle = RED;
    x.beginPath();
    x.moveTo(W * 0.13, H * 0.34);
    x.lineTo(W * 0.37, H * 0.34);
    x.lineTo(W * 0.355, H * 0.81);
    x.lineTo(W * 0.25, H * 0.89);
    x.lineTo(W * 0.145, H * 0.81);
    x.closePath(); x.fill();

    // red lower waistband, with a V dipping at the front
    x.fillStyle = RED;
    x.fillRect(0, H * 0.86, W, H * 0.14);
    x.beginPath();
    x.moveTo(W * 0.13, H * 0.84);
    x.lineTo(W * 0.37, H * 0.84);
    x.lineTo(W * 0.25, H * 0.96);
    x.closePath(); x.fill();

    // subtle panel seams
    x.strokeStyle = 'rgba(0,0,0,0.30)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(W * 0.13, H * 0.34); x.lineTo(W * 0.145, H * 0.81); x.stroke();
    x.beginPath(); x.moveTo(W * 0.37, H * 0.34); x.lineTo(W * 0.355, H * 0.81); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,0.06)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(W * 0.135, H * 0.34); x.lineTo(W * 0.150, H * 0.81); x.stroke();

    // webbing on upper chest/shoulders (front) and upper back
    radialWeb(x, W * 0.25, H * 0.16, 330, 9, 4, 5);
    radialWeb(x, W * 0.75, H * 0.14, 300, 9, 4, 5);
    // continue a few lines down the red centre panel
    webLine(x, W * 0.25, H * 0.32, W * 0.25, H * 0.80, 5);
    webLine(x, W * 0.18, H * 0.36, W * 0.17, H * 0.78, 4);
    webLine(x, W * 0.32, H * 0.36, W * 0.33, H * 0.78, 4);

    // small chest spider (black with pale outline)
    x.save();
    x.shadowColor = 'rgba(220,220,220,0.9)'; x.shadowBlur = 9;
    spider(x, W * 0.25, H * 0.30, 48, '#101216', 5.5);
    x.restore();
    spider(x, W * 0.25, H * 0.30, 48, '#1a1c20', 4.5);

    // large dark-red spider on the blue back
    spider(x, W * 0.75, H * 0.57, 190, RED_SPIDER, 20);

    grain(x, W, H, 5);
    return tex(c, true);
  }

  // ---- Head / mask ----
  function headMap() {
    const W = 1024, H = 512;
    const c = makeCanvas(W, H);
    const x = c.getContext('2d');
    x.fillStyle = RED; x.fillRect(0, 0, W, H);
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0.18)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    // web radiates from the crown (top), front centre u=0.25
    radialWeb(x, W * 0.25, 26, 460, 12, 6, 6);
    // a couple of spokes from the nape
    radialWeb(x, W * 0.75, 18, 300, 8, 4, 5);
    // centre line down the face and around the jaw
    webLine(x, W * 0.25, 60, W * 0.25, H * 0.92, 6);
    grain(x, W, H, 5);
    return tex(c, true);
  }

  // ---- Generic limb texture. front u=0.25, back u=0.75. ----
  // opts: { red:[u0,u1] regions, webCentres:[[u,v,r]], blue:[u0,u1], boot:false }
  function limbMap(opts) {
    const W = 512, H = 512;
    const c = makeCanvas(W, H);
    const x = c.getContext('2d');
    x.fillStyle = opts.base === 'blue' ? BLUE : RED;
    x.fillRect(0, 0, W, H);

    if (opts.base === 'blue') {
      // blue shading
      const g = x.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.16)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0.16)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    }

    if (opts.boot) {
      // red boot on lower portion with webbing, starting partway down
      x.fillStyle = RED;
      x.fillRect(0, H * 0.42, W, H * 0.58);
      x.fillStyle = RED_DARK;
      x.fillRect(0, H * 0.42, W, 8);
      radialWeb(x, W * 0.25, H * 0.48, 300, 8, 4, 5);
      webLine(x, W * 0.5, H * 0.42, W * 0.5, H, 5);
    }

    if (opts.bluePatch) {
      // inner-arm blue panel, a band on one side of the unwrap
      x.fillStyle = BLUE;
      x.fillRect(W * opts.bluePatch[0], 0, W * (opts.bluePatch[1] - opts.bluePatch[0]), H);
    }
    if (opts.redPatch) {
      x.fillStyle = RED;
      x.fillRect(W * opts.redPatch[0], 0, W * (opts.redPatch[1] - opts.redPatch[0]), H);
      radialWeb(x, W * (opts.redPatch[0] + opts.redPatch[1]) / 2, H * 0.42, 220, 7, 3, 8);
    }

    if (opts.red) {
      const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(255,255,255,0.06)');
      g.addColorStop(1, 'rgba(0,0,0,0.14)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    }

    if (opts.webs) {
      opts.webs.forEach(function (w) {
        radialWeb(x, W * w[0], H * w[1], W * (w[2] || 0.55), w[3] || 8, w[4] || 3, w[5] || 5);
      });
    }
    grain(x, W, H, 5);
    return tex(c, true);
  }

  // ---- Concrete / rooftop / brick procedural textures ----
  function concreteMap() {
    const S = 512;
    const c = makeCanvas(S, S);
    const x = c.getContext('2d');
    x.fillStyle = '#6f6f6c'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 9000; i++) {
      const v = 90 + Math.random() * 80;
      x.fillStyle = 'rgba(' + v + ',' + v + ',' + (v - 3) + ',' + (0.05 + Math.random() * 0.12) + ')';
      x.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    // a few cracks
    x.strokeStyle = 'rgba(40,40,40,0.25)'; x.lineWidth = 1.2;
    for (let k = 0; k < 8; k++) {
      x.beginPath();
      let px = Math.random() * S, py = Math.random() * S;
      x.moveTo(px, py);
      for (let j = 0; j < 6; j++) { px += (Math.random() - 0.5) * 60; py += (Math.random() - 0.5) * 60; x.lineTo(px, py); }
      x.stroke();
    }
    return tex(c, true, 14, 14);
  }

  function brickMap() {
    const W = 512, H = 512;
    const c = makeCanvas(W, H);
    const x = c.getContext('2d');
    x.fillStyle = '#3a3735'; x.fillRect(0, 0, W, H);
    const bw = 128, bh = 48;
    for (let row = 0; row < H / bh; row++) {
      const off = (row % 2) * (bw / 2);
      for (let col = -1; col < W / bw + 1; col++) {
        const bx = col * bw + off + 3;
        const by = row * bh + 3;
        const r = 92 + Math.floor(Math.random() * 28);
        const g = 52 + Math.floor(Math.random() * 18);
        const b = 44 + Math.floor(Math.random() * 14);
        x.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
        x.fillRect(bx, by, bw - 6, bh - 6);
        x.fillStyle = 'rgba(255,255,255,0.05)';
        x.fillRect(bx, by, bw - 6, 2);
      }
    }
    for (let i = 0; i < 4000; i++) {
      x.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.12) + ')';
      x.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    return tex(c, true, 18, 14);
  }

  global.Tex = {
    RED: RED, BLUE: BLUE, LENS: LENS,
    fabricBump: fabricBump,
    torsoMap: torsoMap,
    headMap: headMap,
    limbMap: limbMap,
    concreteMap: concreteMap,
    brickMap: brickMap
  };
})(window);
