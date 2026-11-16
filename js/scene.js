/* Rooftop environment, lighting and the web-line helper. */
(function (global) {
  'use strict';

  function gradientSky() {
    const c = document.createElement('canvas');
    c.width = 8; c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.00, '#1b2b46');
    g.addColorStop(0.42, '#526b8c');
    g.addColorStop(0.72, '#b6a99a');
    g.addColorStop(1.00, '#d8c3ac');
    x.fillStyle = g; x.fillRect(0, 0, 8, 256);
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function windowsTexture() {
    const W = 256, H = 512;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#151a22'; x.fillRect(0, 0, W, H);
    for (let r = 0; r < 24; r++) {
      for (let col = 0; col < 8; col++) {
        const on = Math.random() > 0.62;
        x.fillStyle = on
          ? (Math.random() > 0.5 ? 'rgba(255,214,150,0.85)' : 'rgba(180,210,255,0.7)')
          : 'rgba(40,52,66,0.55)';
        x.fillRect(10 + col * 30, 8 + r * 21, 18, 12);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function create(renderer) {
    const scene = new THREE.Scene();
    scene.background = gradientSky();
    scene.fog = new THREE.FogExp2(0x8a93a3, 0.012);

    // Lighting
    const hemi = new THREE.HemisphereLight(0xbcd4f0, 0x51473f, 0.75);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe6c4, 2.4);
    sun.position.set(-6, 10, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 40;
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -6;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x9fc0ff, 0.7);
    fill.position.set(6, 5, -8);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffc98a, 0.5);
    rim.position.set(2, 6, -6);
    scene.add(rim);

    // Materials
    const concrete = new THREE.MeshStandardMaterial({ map: Tex.concreteMap(), roughness: 0.96, metalness: 0 });
    const brick = new THREE.MeshStandardMaterial({ map: Tex.brickMap(), roughness: 0.94, metalness: 0 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x4a5158, roughness: 0.62, metalness: 0.55 });
    const lightMetal = new THREE.MeshStandardMaterial({ color: 0x8b9298, roughness: 0.5, metalness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x24282e, roughness: 0.9 });

    // Roof floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), concrete);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Main building wall: face at z = -2.5, 22 m wide, 16 m tall.
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(24, 16), brick);
    wall.position.set(0, 8, -2.5);
    wall.receiveShadow = true;
    scene.add(wall);

    // Wall base trim and a parapet cap on top.
    const baseTrim = new THREE.Mesh(new THREE.BoxGeometry(24, 0.35, 0.35), concrete);
    baseTrim.position.set(0, 0.17, -2.34);
    baseTrim.receiveShadow = true;
    scene.add(baseTrim);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(24.4, 0.35, 0.55), concrete);
    cap.position.set(0, 16.1, -2.45);
    cap.castShadow = true; cap.receiveShadow = true;
    scene.add(cap);

    // Vertical pilasters / pipework on the wall for scale and texture.
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 15, 12), darkMetal);
      pipe.position.set(i * 3.6, 7.5, -2.36);
      pipe.castShadow = true;
      scene.add(pipe);
      for (let k = 1; k < 5; k++) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 12), lightMetal);
        band.position.set(i * 3.6, k * 3, -2.36);
        scene.add(band);
      }
    }

    // Roof parapet on the left/right edges (low walls) and a safety railing.
    [-9, 9].forEach(function (sx) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 12), concrete);
      p.position.set(sx, 0.45, 3);
      p.castShadow = true; p.receiveShadow = true;
      scene.add(p);
    });

    // HVAC units and vents on the roof.
    function hvac(x, z, w, h, d) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lightMetal);
      body.position.y = h / 2;
      body.castShadow = true; body.receiveShadow = true;
      g.add(body);
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.28, w * 0.28, 0.04, 20), dark);
      fan.position.set(0, h + 0.02, 0);
      g.add(fan);
      for (let i = 0; i < 4; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.02, 0.05), darkMetal);
        blade.position.set(0, h + 0.05, 0);
        blade.rotation.y = i * Math.PI / 4;
        g.add(blade);
      }
      g.position.set(x, 0, z);
      scene.add(g);
      return g;
    }
    hvac(-5.6, 1.2, 1.7, 1.1, 1.2);
    hvac(6.2, 2.4, 1.4, 0.9, 1.1);
    hvac(7.0, -0.4, 1.0, 1.5, 1.0);

    // Water tank on stilts.
    const tank = new THREE.Group();
    const tankBody = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 2.0, 20), darkMetal);
    tankBody.position.y = 2.3;
    tankBody.castShadow = true;
    tank.add(tankBody);
    const tankTop = new THREE.Mesh(new THREE.ConeGeometry(1.12, 0.5, 20), darkMetal);
    tankTop.position.y = 3.55;
    tank.add(tankTop);
    [-0.7, 0.7].forEach(function (lx) {
      [-0.7, 0.7].forEach(function (lz) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.35, 0.12), darkMetal);
        leg.position.set(lx, 0.67, lz);
        tank.add(leg);
      });
    });
    tank.position.set(-7.2, 0, -0.3);
    scene.add(tank);

    // Antenna mast.
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 6, 8), darkMetal);
    mast.position.set(4.2, 3, -1.6);
    mast.castShadow = true;
    scene.add(mast);
    for (let k = 1; k <= 3; k++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.04), darkMetal);
      arm.position.set(4.2, 1.4 + k * 1.0, -1.6);
      scene.add(arm);
    }

    // Distant skyline silhouettes with window lights.
    const win = windowsTexture();
    const skylineMat = new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 1, metalness: 0 });
    const bldMat = new THREE.MeshStandardMaterial({ map: win, color: 0x4a5563, roughness: 1, emissiveMap: win, emissive: 0x5a6472, emissiveIntensity: 0.55 });
    const rand = (function () { let s = 7; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
    for (let i = 0; i < 26; i++) {
      const w = 3 + rand() * 6;
      const h = 8 + rand() * 26;
      const d = 3 + rand() * 6;
      const x = -34 + i * 2.8 + rand() * 3;
      const z = -16 - rand() * 22;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), i % 3 === 0 ? skylineMat : bldMat);
      b.position.set(x, h / 2 - 4, z);
      scene.add(b);
    }

    return { scene: scene, sun: sun };
  }

  // Web line: a thin strand stretched between two points.
  function WebLine(scene) {
    const geo = new THREE.CylinderGeometry(0.006, 0.006, 1, 6, 1, true);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf2f2ee, roughness: 0.5, metalness: 0,
      emissive: 0x333333, transparent: true, opacity: 0.95
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.visible = false;
    this.mesh.castShadow = false;
    scene.add(this.mesh);
    this._up = new THREE.Vector3(0, 1, 0);
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._d = new THREE.Vector3();
  }
  WebLine.prototype.set = function (a, b) {
    this._a.copy(a); this._b.copy(b);
    this._d.subVectors(b, a);
    const len = this._d.length();
    this.mesh.position.copy(a).add(b).multiplyScalar(0.5);
    this.mesh.quaternion.setFromUnitVectors(this._up, this._d.normalize());
    this.mesh.scale.set(1, len, 1);
    this.mesh.visible = true;
    return this;
  };
  WebLine.prototype.hide = function () { this.mesh.visible = false; return this; };

  global.World = { create: create, WebLine: WebLine };
})(window);
