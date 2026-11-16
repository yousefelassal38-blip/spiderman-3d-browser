/* Procedural rig for Spider-Man: jointed body, fabric meshes, articulated hands. */
(function (global) {
  'use strict';

  function sample(profile, t) {
    let a = profile[0], b = profile[profile.length - 1];
    for (let i = 0; i < profile.length - 1; i++) {
      if (t >= profile[i][0] && t <= profile[i + 1][0]) { a = profile[i]; b = profile[i + 1]; break; }
    }
    const f = (b[0] === a[0]) ? 0 : (t - a[0]) / (b[0] - a[0]);
    return [
      a[1] + (b[1] - a[1]) * f,
      a[2] + (b[2] - a[2]) * f,
      (a[3] || 0) + ((b[3] || 0) - (a[3] || 0)) * f,
      (a[4] || 0) + ((b[4] || 0) - (a[4] || 0)) * f
    ];
  }

  // Tube along +/-Y. u=0 at +X (right side), u=0.25 at +Z (front), u=0.75 at -Z (back).
  function tube(profile, length, opts) {
    opts = opts || {};
    const radial = opts.radial || 26;
    const rows = opts.rows || 30;
    const dir = opts.dir === undefined ? 1 : opts.dir;
    const positions = [], uvs = [], indices = [];
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      const p = sample(profile, t);
      for (let i = 0; i <= radial; i++) {
        const u = i / radial;
        const ang = u * Math.PI * 2;
        let rx = p[0], rz = p[1];
        if (opts.muscle) {
          const m = opts.muscle(u, t);
          rx *= (1 + m[0]); rz *= (1 + m[1]);
        }
        const px = rx * Math.cos(ang) + p[2];
        const pz = rz * Math.sin(ang) + p[3];
        positions.push(px, dir * t * length, pz);
        uvs.push(u, t);
      }
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < radial; i++) {
        const a = j * (radial + 1) + i;
        const b = a + radial + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }

  function suitMaterial(map, opts) {
    opts = opts || {};
    return new THREE.MeshStandardMaterial({
      map: map,
      bumpMap: Tex.fabricBump(),
      bumpScale: opts.bump === undefined ? 0.0011 : opts.bump,
      roughness: opts.roughness === undefined ? 0.78 : opts.roughness,
      metalness: 0.0,
      side: THREE.DoubleSide
    });
  }

  // Curved eye lens patch hugging the mask ellipsoid.
  function lensPatch(side, scale, material, yc) {
    const base = [
      [0.011, 0.018], [0.040, 0.046], [0.073, 0.060],
      [0.090, 0.050], [0.073, 0.010], [0.041, -0.014], [0.011, -0.010]
    ];
    const cx = 0.051, cy = 0.023;
    const pts = base.map(function (p) {
      return new THREE.Vector2(
        (cx + (p[0] - cx) * scale) * side,
        cy + (p[1] - cy) * scale
      );
    });
    // reorient winding for the mirrored side
    if (side < 0) pts.reverse();
    const faces = THREE.ShapeUtils.triangulateShape(pts, []);
    const rx = 0.095, rz = 0.106;
    const positions = [];
    pts.forEach(function (p) {
      const x = p.x, dy = p.y;
      let k = 1 - (x * x) / (rx * rx) - 0.0;
      const z = rz * Math.sqrt(Math.max(0.05, k)) + 0.0035;
      positions.push(x, yc + dy, z);
    });
    const idx = [];
    faces.forEach(function (f) { idx.push(f[0], f[1], f[2]); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return new THREE.Mesh(g, material);
  }

  function makeFinger(materials, length, radius, x, z, facing) {
    const base = new THREE.Group();
    base.position.set(x * facing, 0, z);
    const segLen = [length * 0.42, length * 0.32, length * 0.26];
    const rad = [radius, radius * 0.86, radius * 0.70];
    const parent = base;
    const nodes = [];
    let p = base;
    for (let i = 0; i < 3; i++) {
      const g = tube([[0, rad[i], rad[i] * 0.92], [1, rad[i] * 0.82, rad[i] * 0.78]], segLen[i], { dir: -1, radial: 10, rows: 6 });
      const m = new THREE.Mesh(g, materials.glove);
      m.castShadow = true;
      p.add(m);
      nodes.push(p);
      if (i < 2) {
        const jt = new THREE.Group();
        jt.position.y = -segLen[i];
        p.add(jt);
        p = jt;
      }
    }
    // fingertip rounded cap
    const cap = new THREE.Mesh(new THREE.SphereGeometry(rad[2] * 0.78, 10, 8), materials.glove);
    cap.position.y = -segLen[2];
    p.add(cap);
    return { base: base, nodes: nodes };
  }

  function makeHand(materials, facing, gloveMap) {
    const hand = new THREE.Group();
    // palm: flattened ellipsoid
    const palmGeo = new THREE.SphereGeometry(1, 20, 16);
    const palm = new THREE.Mesh(palmGeo, materials.glove);
    palm.scale.set(0.052, 0.062, 0.023);
    palm.position.set(0, -0.055, 0);
    palm.castShadow = true;
    hand.add(palm);

    const fingers = {};
    const defs = [
      ['index', 0.036, 0.078, 0.0120, 0],
      ['middle', 0.012, 0.086, 0.0120, 0],
      ['ring', -0.012, 0.080, 0.0115, 0],
      ['pinky', -0.036, 0.063, 0.0105, 0]
    ];
    defs.forEach(function (d) {
      const f = makeFinger(materials, d[2], d[3], d[1], d[4], facing);
      f.base.position.y = -0.100;
      hand.add(f.base);
      fingers[d[0]] = f;
    });
    // thumb, two segments, angled outward
    const thumb = new THREE.Group();
    thumb.position.set(0.044 * facing, -0.052, 0.005);
    thumb.rotation.z = -0.85 * facing;
    const t1 = new THREE.Mesh(tube([[0, 0.013, 0.013], [1, 0.011, 0.011]], 0.050, { dir: -1, radial: 10, rows: 6 }), materials.glove);
    thumb.add(t1);
    const t2p = new THREE.Group(); t2p.position.y = -0.050; thumb.add(t2p);
    const t2 = new THREE.Mesh(tube([[0, 0.011, 0.011], [1, 0.008, 0.008]], 0.042, { dir: -1, radial: 10, rows: 6 }), materials.glove);
    t2p.add(t2);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 8), materials.glove);
    tip.position.y = -0.042; t2p.add(tip);
    hand.add(thumb);
    fingers.thumb = { base: thumb, nodes: [thumb, t2p] };
    return { group: hand, fingers: fingers };
  }

  function group(x, y, z) {
    const g = new THREE.Group();
    g.position.set(x || 0, y || 0, z || 0);
    return g;
  }

  function create() {
    const root = group(0, 0, 0);
    const J = { root: root };

    const maps = {
      torso: Tex.torsoMap(),
      head: Tex.headMap(),
      upperArm: Tex.limbMap({ base: 'red', bluePatch: [0.47, 0.56], webs: [[0.25, 0.34, 0.62, 9, 3]] }),
      forearm: Tex.limbMap({ base: 'blue', redPatch: [0.02, 0.44] }),
      thigh: Tex.limbMap({ base: 'blue' }),
      shin: Tex.limbMap({ base: 'blue', boot: true }),
      glove: Tex.limbMap({ base: 'red', webs: [[0.25, 0.40, 0.7, 8, 2]] }),
      pelvis: Tex.limbMap({ base: 'blue' })
    };
    const materials = {
      torso: suitMaterial(maps.torso),
      head: suitMaterial(maps.head),
      upperArm: suitMaterial(maps.upperArm),
      forearm: suitMaterial(maps.forearm),
      thigh: suitMaterial(maps.thigh),
      shin: suitMaterial(maps.shin),
      glove: suitMaterial(maps.glove, { roughness: 0.72, bump: 0.006 }),
      pelvis: suitMaterial(maps.pelvis),
      lensWhite: new THREE.MeshStandardMaterial({ color: Tex.LENS, roughness: 0.28, metalness: 0.0, emissive: 0x141414, side: THREE.DoubleSide }),
      lensBlack: new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.42, metalness: 0.0, side: THREE.DoubleSide })
    };

    // ---- Hips and torso ----
    const hips = group(0, 0.95, 0);
    root.add(hips);
    J.hips = hips;

    const pelvisMesh = new THREE.Mesh(
      tube([[0, 0.120, 0.095], [0.35, 0.150, 0.108], [0.7, 0.158, 0.110], [1, 0.145, 0.104]], 0.19, { dir: 1, radial: 26, rows: 16 }),
      materials.pelvis
    );
    pelvisMesh.position.y = -0.12;
    pelvisMesh.castShadow = true;
    hips.add(pelvisMesh);

    const torso = group(0, 0.02, 0);
    hips.add(torso);
    J.torso = torso;
    const torsoProfile = [
      [0, 0.152, 0.108],
      [0.18, 0.150, 0.104],
      [0.38, 0.170, 0.116],
      [0.58, 0.202, 0.132],
      [0.78, 0.218, 0.138],
      [0.92, 0.205, 0.130],
      [1, 0.100, 0.088]
    ];
    const torsoMesh = new THREE.Mesh(
      tube(torsoProfile, 0.50, {
        radial: 30, rows: 36,
        muscle: function (u, t) {
          const front = Math.max(0, Math.cos((u - 0.25) * Math.PI * 2));
          const pec = Math.exp(-Math.pow((t - 0.72) / 0.16, 2)) * 0.035 * front;
          const ab = Math.sin(t * Math.PI * 9) * 0.006 * front;
          return [pec + ab, pec * 0.55];
        }
      }),
      materials.torso
    );
    torsoMesh.castShadow = true;
    torso.add(torsoMesh);

    const neck = group(0, 0.50, 0);
    torso.add(neck);
    J.neck = neck;
    const neckMesh = new THREE.Mesh(tube([[0, 0.062, 0.060], [1, 0.058, 0.058]], 0.055, { dir: 1, radial: 18, rows: 6 }), materials.head);
    neck.add(neckMesh);

    const head = group(0, 0.048, 0.004);
    neck.add(head);
    J.head = head;
    const headProfile = [
      [0, 0.050, 0.055, 0, 0.006],
      [0.10, 0.073, 0.075, 0, 0.004],
      [0.28, 0.088, 0.094, 0, 0.002],
      [0.50, 0.093, 0.104, 0, 0.0],
      [0.72, 0.085, 0.095, 0, -0.002],
      [0.90, 0.060, 0.068, 0, -0.004],
      [1, 0.012, 0.014, 0, -0.004]
    ];
    const headMesh = new THREE.Mesh(tube(headProfile, 0.255, { radial: 32, rows: 34 }), materials.head);
    headMesh.castShadow = true;
    head.add(headMesh);

    const eyeY = 0.135;
    [-1, 1].forEach(function (side) {
      const black = lensPatch(side, 1.22, materials.lensBlack, eyeY);
      const white = lensPatch(side, 0.94, materials.lensWhite, eyeY);
      white.position.z = 0.004;
      head.add(black); head.add(white);
    });

    // ---- Arms ----
    ['L', 'R'].forEach(function (s) {
      const sgn = s === 'L' ? -1 : 1;
      const shoulder = group(0.215 * sgn, 0.455, 0);
      torso.add(shoulder);
      J['shoulder' + s] = shoulder;
      const upper = new THREE.Mesh(
        tube([[0, 0.082, 0.078], [0.22, 0.094, 0.088], [0.55, 0.080, 0.074], [0.85, 0.060, 0.057], [1, 0.050, 0.048]], 0.32, {
          dir: -1, radial: 22, rows: 22,
          muscle: function (u, t) {
            const b = Math.exp(-Math.pow((t - 0.35) / 0.22, 2)) * 0.045;
            return [b, b * 0.8];
          }
        }),
        materials.upperArm
      );
      upper.castShadow = true;
      shoulder.add(upper);

      const elbow = group(0, -0.32, 0);
      shoulder.add(elbow);
      J['elbow' + s] = elbow;
      const fore = new THREE.Mesh(
        tube([[0, 0.054, 0.050], [0.25, 0.060, 0.054], [0.6, 0.048, 0.045], [1, 0.033, 0.032]], 0.27, { dir: -1, radial: 20, rows: 20 }),
        materials.forearm
      );
      fore.castShadow = true;
      elbow.add(fore);

      const wrist = group(0, -0.27, 0);
      elbow.add(wrist);
      J['wrist' + s] = wrist;
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.006, 8, 18), materials.glove);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -0.012;
      wrist.add(cuff);
      const hand = makeHand(materials, sgn, maps.glove);
      hand.group.position.y = -0.02;
      wrist.add(hand.group);
      J['hand' + s] = hand;
    });

    // ---- Legs ----
    ['L', 'R'].forEach(function (s) {
      const sgn = s === 'L' ? -1 : 1;
      const hip = group(0.105 * sgn, -0.075, 0);
      hips.add(hip);
      J['hip' + s] = hip;
      const thigh = new THREE.Mesh(
        tube([[0, 0.106, 0.098], [0.3, 0.117, 0.107], [0.7, 0.092, 0.088], [1, 0.071, 0.069]], 0.43, {
          dir: -1, radial: 22, rows: 22,
          muscle: function (u, t) {
            const q = Math.exp(-Math.pow((t - 0.3) / 0.25, 2)) * 0.03;
            return [q, q];
          }
        }),
        materials.thigh
      );
      thigh.castShadow = true;
      hip.add(thigh);

      const knee = group(0, -0.43, 0);
      hip.add(knee);
      J['knee' + s] = knee;
      const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 12), materials.shin);
      kneeCap.scale.set(1, 0.9, 1);
      knee.add(kneeCap);
      const shin = new THREE.Mesh(
        tube([[0, 0.071, 0.068], [0.3, 0.078, 0.074], [0.65, 0.061, 0.058], [1, 0.045, 0.045]], 0.405, { dir: -1, radial: 20, rows: 22 }),
        materials.shin
      );
      shin.castShadow = true;
      knee.add(shin);

      const ankle = group(0, -0.405, 0);
      knee.add(ankle);
      J['ankle' + s] = ankle;
      const foot = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), materials.glove);
      foot.scale.set(0.052, 0.045, 0.125);
      foot.position.set(0, -0.036, 0.065);
      foot.castShadow = true;
      ankle.add(foot);
      const toe = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), materials.glove);
      toe.scale.set(0.050, 0.032, 0.052);
      toe.position.set(0, -0.033, 0.165);
      ankle.add(toe);
    });

    function reset() {
      root.position.set(0, 0, 0);
      root.rotation.set(0, 0, 0);
      hips.rotation.set(0, 0, 0);
      pelvisMesh.position.y = -0.12;
      torso.rotation.set(0, 0, 0);
      neck.rotation.set(0, 0, 0);
      head.rotation.set(0, 0, 0);
      ['L', 'R'].forEach(function (s) {
        J['shoulder' + s].rotation.set(0, 0, s === 'L' ? -0.06 : 0.06);
        J['elbow' + s].rotation.set(0, 0, 0);
        J['wrist' + s].rotation.set(0, 0, 0);
        J['hip' + s].rotation.set(0, 0, 0);
        J['knee' + s].rotation.set(0, 0, 0);
        J['ankle' + s].rotation.set(0, 0, 0);
        const h = J['hand' + s].fingers;
        Object.keys(h).forEach(function (k) {
          h[k].nodes.forEach(function (n) { n.rotation.set(0, 0, 0); });
        });
      });
    }
    reset();

    return { root: root, J: J, reset: reset, materials: materials };
  }

  global.SpiderMan = { create: create };
})(window);
