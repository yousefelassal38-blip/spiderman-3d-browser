/* Four animation clips driving the rig. All poses are procedural. */
(function (global) {
  'use strict';

  const JOINTS = ['hips', 'torso', 'neck', 'head',
    'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR',
    'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'];
  const FINGERS = ['index', 'middle', 'ring', 'pinky', 'thumb'];

  const clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  const ease = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = function (t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); };
  const lerp = function (a, b, t) { return a + (b - a) * t; };

  function full(o) {
    o = o || {};
    const p = { pos: [0, 0, 0], rot: [0, 0, 0], joints: {}, curlL: {}, curlR: {} };
    JOINTS.forEach(function (n) { p.joints[n] = [0, 0, 0]; });
    p.joints.shoulderL = [-0.12, 0, -0.11];
    p.joints.shoulderR = [-0.12, 0, 0.11];
    p.joints.elbowL = [-0.14, 0, 0];
    p.joints.elbowR = [-0.14, 0, 0];
    p.joints.hipL = [-0.04, 0, -0.02];
    p.joints.hipR = [-0.02, 0, 0.02];
    p.joints.kneeL = [0.08, 0, 0];
    p.joints.kneeR = [0.06, 0, 0];
    ['L', 'R'].forEach(function (s) {
      FINGERS.forEach(function (f) { p['curl' + s][f] = 0.22; });
    });
    if (o.pos) p.pos = o.pos.slice();
    if (o.rot) p.rot = o.rot.slice();
    if (o.joints) for (const k in o.joints) p.joints[k] = o.joints[k].slice();
    if (o.curlL) Object.assign(p.curlL, o.curlL);
    if (o.curlR) Object.assign(p.curlR, o.curlR);
    return p;
  }

  function mix(A, B, t) {
    t = clamp(t, 0, 1);
    const P = { pos: [0, 0, 0], rot: [0, 0, 0], joints: {}, curlL: {}, curlR: {} };
    for (let i = 0; i < 3; i++) {
      P.pos[i] = lerp(A.pos[i], B.pos[i], t);
      P.rot[i] = lerp(A.rot[i], B.rot[i], t);
    }
    JOINTS.forEach(function (n) {
      P.joints[n] = [lerp(A.joints[n][0], B.joints[n][0], t),
        lerp(A.joints[n][1], B.joints[n][1], t),
        lerp(A.joints[n][2], B.joints[n][2], t)];
    });
    ['L', 'R'].forEach(function (s) {
      FINGERS.forEach(function (f) {
        P['curl' + s][f] = lerp(A['curl' + s][f], B['curl' + s][f], t);
      });
    });
    return P;
  }

  function apply(rig, P) {
    rig.root.position.set(P.pos[0], P.pos[1], P.pos[2]);
    rig.root.rotation.set(P.rot[0], P.rot[1], P.rot[2]);
    JOINTS.forEach(function (n) {
      rig.J[n].rotation.set(P.joints[n][0], P.joints[n][1], P.joints[n][2]);
    });
    ['L', 'R'].forEach(function (s) {
      const h = rig.J['hand' + s].fingers;
      FINGERS.forEach(function (f) {
        const c = P['curl' + s][f];
        h[f].nodes.forEach(function (node, i) {
          node.rotation.x = c * (i === 0 ? 0.85 : (i === 1 ? 1.05 : 0.65));
        });
      });
    });
  }

  // ---- Named poses ----
  const STAND = full({});

  const CROUCH = full({
    pos: [0, -0.26, 0.02],
    rot: [0.06, 0, 0],
    joints: {
      hips: [0.30, 0, 0], torso: [0.26, 0, 0], neck: [-0.12, 0, 0], head: [-0.10, 0, 0],
      shoulderR: [-1.05, 0, 0.22], elbowR: [-0.30, 0, 0], wristR: [0.20, 0, 0],
      shoulderL: [-0.55, 0, -0.25], elbowL: [-0.55, 0, 0],
      hipL: [-1.00, 0, -0.14], hipR: [-1.25, 0, 0.15],
      kneeL: [1.65, 0, 0], kneeR: [1.90, 0, 0],
      ankleL: [-0.50, 0, 0], ankleR: [-0.62, 0, 0]
    },
    curlR: { index: 0.15, middle: 0.15, ring: 0.15, pinky: 0.15, thumb: 0.25 }
  });

  const SWING_LAUNCH = full({
    pos: [0, -0.18, 0],
    rot: [0.12, 0, 0],
    joints: {
      hips: [0.22, 0, 0], torso: [0.20, 0, 0],
      shoulderR: [-2.45, 0, 0.34], elbowR: [-0.10, 0, 0],
      shoulderL: [-0.70, 0, -0.30], elbowL: [-0.60, 0, 0],
      hipL: [-0.60, 0, -0.10], hipR: [-0.35, 0, 0.10],
      kneeL: [1.05, 0, 0], kneeR: [0.75, 0, 0], ankleL: [-0.35, 0, 0], ankleR: [-0.25, 0, 0]
    }
  });

  const WALL_LEAP = full({
    pos: [0, 0.45, -2.18],
    rot: [0.10, Math.PI, 0],
    joints: {
      torso: [0.15, 0, 0],
      shoulderL: [-1.55, 0, -0.22], shoulderR: [-1.55, 0, 0.22],
      elbowL: [-0.30, 0, 0], elbowR: [-0.30, 0, 0],
      hipL: [-0.75, 0, -0.12], hipR: [-0.75, 0, 0.12],
      kneeL: [1.15, 0, 0], kneeR: [1.15, 0, 0],
      ankleL: [-0.40, 0, 0], ankleR: [-0.40, 0, 0]
    }
  });

  const FLIP_OFF = full({
    pos: [0, 3.9, -0.9],
    rot: [Math.PI * 1.15, Math.PI * 0.55, 0],
    joints: {
      torso: [-0.20, 0, 0],
      shoulderL: [-2.10, 0, -0.30], shoulderR: [-2.10, 0, 0.30],
      elbowL: [-0.35, 0, 0], elbowR: [-0.35, 0, 0],
      hipL: [-1.35, 0, -0.15], hipR: [-1.35, 0, 0.15],
      kneeL: [1.75, 0, 0], kneeR: [1.75, 0, 0], ankleL: [-0.35, 0, 0], ankleR: [-0.35, 0, 0]
    }
  });

  const JUMP_TUCK = full({
    pos: [0, 0, 0],
    joints: {
      hips: [0.20, 0, 0], torso: [0.30, 0, 0],
      shoulderL: [-1.15, 0, -0.35], shoulderR: [-1.15, 0, 0.35],
      elbowL: [-0.85, 0, 0], elbowR: [-0.85, 0, 0],
      hipL: [-1.45, 0, -0.14], hipR: [-1.45, 0, 0.14],
      kneeL: [2.00, 0, 0], kneeR: [2.00, 0, 0], ankleL: [-0.45, 0, 0], ankleR: [-0.45, 0, 0]
    }
  });

  const SHOOT = full({
    pos: [0, -0.03, 0],
    rot: [0, -0.06, 0],
    joints: {
      torso: [0.02, -0.10, 0],
      shoulderR: [-1.52, 0, 0.06], elbowR: [-0.08, 0, 0], wristR: [0.06, 0, 0],
      shoulderL: [-0.22, 0, -0.16], elbowL: [-0.35, 0, 0],
      hipL: [-0.10, 0, -0.04], hipR: [0.06, 0, 0.04],
      kneeL: [0.16, 0, 0], kneeR: [0.10, 0, 0]
    },
    curlR: { index: 1.0, middle: 1.0, ring: 0.18, pinky: 0.15, thumb: 0.72 },
    curlL: { index: 0.2, middle: 0.2, ring: 0.25, pinky: 0.25, thumb: 0.3 }
  });

  const ANCHOR = [3.0, 8.2, -1.2];

  function setWeb(ctx, from, to, fade) {
    ctx.web = { from: from, to: to, fade: fade === undefined ? 1 : fade };
  }

  const ANIMS = {
    swing: {
      name: 'Web swing', duration: 8,
      apply: function (t, rig, ctx) {
        if (t < 0.09) {
          apply(rig, mix(STAND, SWING_LAUNCH, ease(t / 0.09)));
          if (t > 0.035) setWeb(ctx, 'wristR', ANCHOR); else ctx.web = null;
          return;
        }
        if (t < 0.87) {
          const p = (t - 0.09) / 0.78;
          const s = Math.sin(Math.PI * p);
          const P = full({
            pos: [3.2 * s, 4.65 * Math.pow(s, 0.92), 0.35 * s],
            rot: [0.32 * s, 0.32 * Math.sin(Math.PI * p), -0.42 * Math.sin(2 * Math.PI * p)],
            joints: {
              torso: [-0.16 * s, 0, 0],
              neck: [0.08 * s, 0, 0], head: [0.10 * s, 0, 0],
              shoulderR: [-2.45 + 0.22 * s, 0, 0.34], elbowR: [-0.10, 0, 0],
              shoulderL: [-0.85 - 0.35 * s, 0, -0.35], elbowL: [-0.70, 0, 0],
              hipL: [-0.55 - 0.30 * s, 0, -0.12], hipR: [-0.25 + 0.35 * s, 0, 0.14],
              kneeL: [0.90 + 0.35 * Math.sin(2 * Math.PI * p), 0, 0],
              kneeR: [0.62 + 0.25 * Math.sin(2 * Math.PI * p + 1), 0, 0],
              ankleL: [-0.30, 0, 0], ankleR: [-0.25, 0, 0]
            }
          });
          apply(rig, P);
          setWeb(ctx, 'wristR', ANCHOR);
          return;
        }
        // landing and settle
        const k = ease((t - 0.87) / 0.13);
        apply(rig, mix(CROUCH, STAND, k));
        ctx.web = null;
      }
    },

    crawl: {
      name: 'Wall crawl', duration: 8,
      apply: function (t, rig, ctx) {
        ctx.web = null;
        if (t < 0.16) {
          apply(rig, mix(STAND, WALL_LEAP, ease(t / 0.16)));
          return;
        }
        if (t < 0.63) {
          const p = (t - 0.16) / 0.47;
          const P = full({
            pos: [0.10 * Math.sin(p * Math.PI * 6), 0.45 + 3.78 * ease(p), -2.20],
            rot: [0, Math.PI, 0.035 * Math.sin(p * Math.PI * 6)],
            joints: {
              torso: [0.14, 0, 0], neck: [-0.10, 0, 0],
              shoulderL: [-1.55 + 0.42 * Math.sin(p * Math.PI * 8), 0, -0.24],
              shoulderR: [-1.55 + 0.42 * Math.sin(p * Math.PI * 8 + Math.PI), 0, 0.24],
              elbowL: [-0.28, 0, 0], elbowR: [-0.28, 0, 0],
              hipL: [-0.72 + 0.30 * Math.sin(p * Math.PI * 8 + Math.PI), 0, -0.13],
              hipR: [-0.72 + 0.30 * Math.sin(p * Math.PI * 8), 0, 0.13],
              kneeL: [1.15, 0, 0], kneeR: [1.15, 0, 0],
              ankleL: [-0.42, 0, 0], ankleR: [-0.42, 0, 0]
            },
            curlL: { index: 0.7, middle: 0.7, ring: 0.7, pinky: 0.7, thumb: 0.6 },
            curlR: { index: 0.7, middle: 0.7, ring: 0.7, pinky: 0.7, thumb: 0.6 }
          });
          apply(rig, P);
          return;
        }
        if (t < 0.84) {
          const p = (t - 0.63) / 0.21;
          const P = mix(WALL_LEAP, FLIP_OFF, ease(p));
          // arch the trajectory upward then down
          P.pos[1] = lerp(4.23, 1.0, ease(p)) + 1.3 * Math.sin(Math.PI * p);
          P.pos[2] = lerp(-2.20, 0.0, ease(p));
          apply(rig, P);
          return;
        }
        const k = ease((t - 0.84) / 0.16);
        apply(rig, mix(CROUCH, STAND, k));
      }
    },

    jump: {
      name: 'Jump & somersault', duration: 4,
      apply: function (t, rig, ctx) {
        ctx.web = null;
        if (t < 0.12) {
          apply(rig, mix(STAND, CROUCH, ease(t / 0.12)));
          return;
        }
        if (t < 0.73) {
          const p = (t - 0.12) / 0.61;
          const P = full({
            pos: [0, 2.85 * Math.sin(Math.PI * Math.pow(p, 0.9)), 0],
            rot: [Math.PI * 2 * ease(p), 0, 0],
            joints: JUMP_TUCK.joints,
            curlL: JUMP_TUCK.curlL, curlR: JUMP_TUCK.curlR
          });
          apply(rig, P);
          return;
        }
        if (t < 0.87) {
          apply(rig, CROUCH);
          return;
        }
        apply(rig, mix(CROUCH, STAND, ease((t - 0.87) / 0.13)));
      }
    },

    shoot: {
      name: 'Web shot', duration: 3,
      apply: function (t, rig, ctx) {
        if (t < 0.32) {
          apply(rig, mix(STAND, SHOOT, ease(t / 0.32)));
          ctx.web = null;
          return;
        }
        apply(rig, SHOOT);
        if (t < 0.72) {
          const grow = ease((t - 0.32) / 0.16);
          setWeb(ctx, 'wristR', null, 1);
          ctx.web.length = 6.0 * grow;
          ctx.web.dir = [0, 0.02, 1];
        } else {
          const tau = (t - 0.72) * 3.0;
          const drop = 4.9 * tau * tau;
          setWeb(ctx, 'wristR', null, Math.max(0, 1 - (t - 0.72) / 0.28));
          ctx.web.length = 6.0;
          ctx.web.dir = [0, 0.02, 1];
          ctx.web.drop = drop;
        }
      }
    }
  };

  global.Anim = { ANIMS: ANIMS, STAND: STAND, apply: apply, clamp: clamp };
})(window);
