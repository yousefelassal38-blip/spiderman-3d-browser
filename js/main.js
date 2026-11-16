/* Bootstrap, render loop, camera controls and UI wiring. */
(function () {
  'use strict';

  const canvas = document.getElementById('scene');
  const statusEl = document.getElementById('status');
  const playBtn = document.getElementById('playBtn');
  const autoBtn = document.getElementById('autoBtn');
  const viewBtn = document.getElementById('viewBtn');
  const animButtons = Array.prototype.slice.call(document.querySelectorAll('.anim-btn'));

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 200);
  const HOME_POS = new THREE.Vector3(2.4, 1.6, 4.6);
  const TARGET = new THREE.Vector3(0, 0.95, 0);
  const LOOK = TARGET.clone();
  camera.position.copy(HOME_POS);
  camera.lookAt(LOOK);

  const world = World.create(renderer);
  const scene = world.scene;
  const rig = SpiderMan.create();
  scene.add(rig.root);

  const web = new World.WebLine(scene);

  // --- simple orbit camera ---
  const orbit = { theta: 0, phi: 0, radius: HOME_POS.distanceTo(TARGET) };
  function applyCamera() {
    const base = HOME_POS.clone().sub(TARGET);
    const off = new THREE.Vector3(base.x, base.y, base.z);
    const s = new THREE.Vector3().copy(off);
    const sph = new THREE.Spherical().setFromVector3(s);
    sph.theta += orbit.theta;
    sph.phi = Math.max(0.18, Math.min(Math.PI - 0.12, sph.phi + orbit.phi));
    sph.radius = Math.max(1.6, Math.min(16, orbit.radius));
    off.setFromSpherical(sph);
    camera.position.copy(LOOK).add(off);
    camera.lookAt(LOOK);
  }
  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', function (e) {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    orbit.theta -= (e.clientX - lastX) * 0.005;
    orbit.phi -= (e.clientY - lastY) * 0.005;
    lastX = e.clientX; lastY = e.clientY;
    applyCamera();
  });
  function endDrag() { dragging = false; }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    orbit.radius *= (1 + Math.sign(e.deltaY) * 0.08);
    applyCamera();
  }, { passive: false });

  function resetView() {
    orbit.theta = 0; orbit.phi = 0; orbit.radius = HOME_POS.distanceTo(TARGET);
    LOOK.copy(TARGET);
    applyCamera();
  }

  // --- animation state ---
  let current = 'swing';
  let clockTime = 0;
  let playing = true;
  let autoplay = false;
  const ctx = { web: null };
  const handWorld = new THREE.Vector3();
  const webEnd = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();

  function setStatus(text) { statusEl.textContent = text; }

  // Small inspection hook (also handy for screenshotting a specific pose).
  window.__spider = {
    seek: function (name, t) {
      select(name, false);
      playing = false;
      playBtn.textContent = 'Play';
      playBtn.setAttribute('aria-pressed', 'false');
      clockTime = Anim.clamp(t, 0, 1) * Anim.ANIMS[name].duration;
    }
  };

  function select(name, announce) {
    current = name;
    clockTime = 0;
    animButtons.forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-anim') === name ? 'true' : 'false');
    });
    if (announce !== false) setStatus('Playing: ' + Anim.ANIMS[name].name + '.');
  }

  animButtons.forEach(function (b) {
    b.addEventListener('click', function () { select(b.getAttribute('data-anim')); });
  });

  playBtn.addEventListener('click', function () {
    playing = !playing;
    playBtn.textContent = playing ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
  });
  autoBtn.addEventListener('click', function () {
    autoplay = !autoplay;
    autoBtn.textContent = 'Auto-play: ' + (autoplay ? 'on' : 'off');
    autoBtn.setAttribute('aria-pressed', autoplay ? 'true' : 'false');
  });
  viewBtn.addEventListener('click', resetView);

  window.addEventListener('keydown', function (e) {
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    const map = { '1': 'swing', '2': 'crawl', '3': 'jump', '4': 'shoot' };
    if (map[e.key]) { select(map[e.key]); return; }
    if (e.code === 'Space') { e.preventDefault(); playBtn.click(); }
    if (e.key === 'r' || e.key === 'R') resetView();
  });

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // --- loop ---
  const clock = new THREE.Clock();
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('anim');
  const requestedT = parseFloat(params.get('t'));
  let snapLook = !isNaN(requestedT);
  select(requested && Anim.ANIMS[requested] ? requested : 'swing', false);
  if (!isNaN(requestedT)) {
    playing = false;
    clockTime = Anim.clamp(requestedT, 0, 1) * Anim.ANIMS[current].duration;
    playBtn.textContent = 'Play';
    playBtn.setAttribute('aria-pressed', 'false');
  }
  setStatus('Ready. Standing at the rest spot.');

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    const clip = Anim.ANIMS[current];

    if (playing) clockTime += dt;
    const t = Anim.clamp(clockTime / clip.duration, 0, 1);

    ctx.web = null;
    clip.apply(t, rig, ctx);

    if (ctx.web) {
      rig.root.updateMatrixWorld(true);
      rig.J[ctx.web.from].getWorldPosition(handWorld);
      if (ctx.web.to) {
        webEnd.set(ctx.web.to[0], ctx.web.to[1], ctx.web.to[2]);
      } else {
        const d = ctx.web.dir || [0, 0, 1];
        webEnd.set(
          handWorld.x + d[0] * (ctx.web.length || 6),
          handWorld.y + d[1] * (ctx.web.length || 6) - (ctx.web.drop || 0),
          handWorld.z + d[2] * (ctx.web.length || 6)
        );
      }
      web.set(handWorld, webEnd);
      if (ctx.web.fade !== undefined) web.mesh.material.opacity = 0.95 * ctx.web.fade;
      else web.mesh.material.opacity = 0.95;
    } else {
      web.hide();
    }

    lookTarget.set(rig.root.position.x, rig.root.position.y + 0.95, rig.root.position.z);
    if (snapLook) { LOOK.copy(lookTarget); snapLook = false; }
    else LOOK.lerp(lookTarget, 1 - Math.exp(-8 * dt));
    applyCamera();
    if (params.get('debug') === '1') {
      document.body.dataset.debug = JSON.stringify({
        root: rig.root.position.toArray().map(function (v) { return +v.toFixed(2); }),
        look: LOOK.toArray().map(function (v) { return +v.toFixed(2); }),
        cam: camera.position.toArray().map(function (v) { return +v.toFixed(2); })
      });
    }

    if (playing) {
      const pct = Math.round(t * 100);
      setStatus(clip.name + ' — ' + pct + '%');
      if (t >= 1) {
        if (autoplay) {
          const names = ['swing', 'crawl', 'jump', 'shoot'];
          const next = names[(names.indexOf(current) + 1) % names.length];
          select(next);
        } else {
          playing = false;
          playBtn.textContent = 'Play';
          playBtn.setAttribute('aria-pressed', 'false');
          setStatus(clip.name + ' complete.');
        }
      }
    }

    renderer.render(scene, camera);
  }
  frame();
})();
