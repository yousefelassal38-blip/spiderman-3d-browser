# Build Plan — Realistic 3D Spider-Man (browser, real time)

## Progress tracking (no todo tool; update checkboxes here)

### Research
- [ ] Search web for realistic Spider-Man reference images (one version, classic red/blue)
- [ ] Collect front, side, back views; study proportions, colours, web lines, emblems, lenses, fabric
- [ ] Save images into ./reference and write NOTES.md (5 lines, then source URLs)

### Build (Three.js, single self-contained app, no external 3D/model/texture assets)
- [ ] Scaffold index.html + CSS + JS, CDN Three.js, lighting/shadows, ground + wall at z=-2.5
- [ ] Build rigged humanoid body (jointed limbs, articulated hands with 5 fingers)
- [ ] Build suit: red/blue panels, raised webbing, spider emblems, eye lenses, woven fabric material (procedural normal/roughness)
- [ ] Idle/rest pose at origin facing +Z, correct camera

### Animation (Web Animation state machine driving joints)
- [ ] Web swing, 8 s
- [ ] Wall crawl, 8 s
- [ ] Jump + somersault + crouch landing, 4 s
- [ ] Web shot, 3 s

### Verify
- [ ] Open in browser, screenshot, check proportions/material/animations, fix issues

## Decisions made (my calls — say out loud)
- Platform: Three.js (r160+) via CDN, single-page HTML, procedural geometry only.
- Reference version: to be chosen after image search (classic red/blue, modern film or game).
- 1 unit = 1 m, feet at origin facing +Z. Camera (2.4,1.6,4.6) -> (0,0.95,0).
