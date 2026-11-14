// ============================================================
//  THE LOUD ONE — the abandoned town of Hollow Creek
// ============================================================
(function () {
  const BLOCK = 40, ST = 12, NB = 4;
  const HALF = (NB * BLOCK + (NB + 1) * ST) / 2;          // 110
  const STREETS = [];                                      // street centre lines
  for (let i = 0; i <= NB; i++) STREETS.push(-HALF + ST / 2 + i * (BLOCK + ST));
  const BLOCK_C = [];
  for (let i = 0; i < NB; i++) BLOCK_C.push(STREETS[i] + ST / 2 + BLOCK / 2);

  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Box UVs in world units so textures tile at a constant scale
  function worldUV(geo, w, h, d, tile) {
    const uv = geo.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) {
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        const tl = Array.isArray(tile) ? tile[f] : tile;
        uv.setXY(i, uv.getX(i) * dims[f][0] / tl, uv.getY(i) * dims[f][1] / tl);
      }
    }
    uv.needsUpdate = true;
    return geo;
  }

  LO.World = { STREETS, BLOCK_C, HALF, build };

  function build(scene) {
    const S = LO.settings;
    const rand = mulberry(1337);
    const R = (a, b) => a + rand() * (b - a);
    const pick = arr => arr[(rand() * arr.length) | 0];
    const shadows = S.shadows !== 'off';
    const simple = S.lighting === 'simple';

    const W = {
      root: new THREE.Group(),
      colliders: [], occluders: [], hideSpots: [], pickups: [], evidence: [],
      interiors: [], flickers: [], animated: [], STREETS, HALF,
    };
    scene.add(W.root);

    // ---------- materials ----------
    function mat(o) {
      o = Object.assign({}, o);
      if (simple) {
        delete o.roughness; delete o.metalness;
        return new THREE.MeshLambertMaterial(o);
      }
      if (o.roughness === undefined) o.roughness = 0.92;
      if (o.metalness === undefined) o.metalness = 0.0;
      return new THREE.MeshStandardMaterial(o);
    }
    const T = LO.tex.get;
    const M = {
      grass: mat({ map: T('grass'), color: 0x9aa58a }),
      road: mat({ map: T('road') }),
      asphalt: mat({ map: T('asphalt') }),
      sidewalk: mat({ map: T('sidewalk') }),
      facades: [
        mat({ map: T('facade', { wall: 'brick', color: '#6b3426' }) }),
        mat({ map: T('facade', { wall: 'brick', color: '#5a4a3a' }) }),
        mat({ map: T('facade', { wall: 'concrete', color: '#77746c' }) }),
        mat({ map: T('facade', { wall: 'concrete', color: '#6a6f73' }) }),
        mat({ map: T('facade', { wall: 'brick', color: '#3f3a44' }) }),
      ],
      brick: mat({ map: T('brick', { color: '#5e3024' }) }),
      concrete: mat({ map: T('concrete') }),
      plaster: [mat({ map: T('plaster', { color: '#8c8573' }) }), mat({ map: T('plaster', { color: '#6f7a72' }) }), mat({ map: T('plaster', { color: '#7d6d6a' }) })],
      wood: mat({ map: T('wood') }),
      tile: mat({ map: T('tile') }),
      roof: mat({ map: T('roof') }),
      metal: mat({ map: T('metal'), roughness: 0.6, metalness: 0.4 }),
      dumpster: mat({ map: T('metal', { color: '#2f4a33' }), roughness: 0.7, metalness: 0.3 }),
      locker: mat({ map: T('metal', { color: '#4b5560' }), roughness: 0.6, metalness: 0.4 }),
      dark: mat({ color: 0x151515 }),
      trim: mat({ color: 0x2a2622 }),
      pole: mat({ color: 0x3a3a3a, roughness: 0.6, metalness: 0.5 }),
      lampOff: mat({ color: 0x555544, emissive: 0x000000 }),
      lampOn: new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
      glass: mat({ color: 0x0b0f14, roughness: 0.2, metalness: 0.6 }),
      rubble: mat({ map: T('concrete', { color: '#5b574f' }) }),
      fabric: mat({ color: 0x40302a }),
      bark: mat({ color: 0x2a2018 }),
      leaves: mat({ color: 0x18251a }),
      tire: mat({ color: 0x111111 }),
      cctv: new THREE.MeshBasicMaterial({ map: T('cctv', { size: 256 }) }),
      warning: mat({ map: T('warning') }),
      poster: mat({ map: T('poster', { size: 128 }) }),
      sign: mat({ map: T('sign', { size: 512 }) }),
      water: mat({ map: T('metal', { color: '#5a6066' }), roughness: 0.5, metalness: 0.5 }),
      footprint: new THREE.MeshLambertMaterial({ map: T('footprint', { size: 256 }), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    };
    M.carPaints = [0x5b1d1a, 0x1f2f4a, 0x3d3d3a, 0x7b6a45, 0x2e3d2c, 0x8a8a86].map(c => mat({ color: c, roughness: 0.5, metalness: 0.3 }));
    W.mat = mat; W.M = M;

    // ---------- helpers ----------
    function add(mesh, opts) {
      opts = opts || {};
      if (shadows) { mesh.castShadow = opts.cast !== false; mesh.receiveShadow = true; }
      (opts.parent || W.root).add(mesh);
      if (opts.occlude) W.occluders.push(mesh);
      return mesh;
    }
    function collider(minX, maxX, minZ, maxZ, maxY) {
      W.colliders.push({ minX, maxX, minZ, maxZ, maxY: maxY === undefined ? 50 : maxY });
    }
    // axis aligned box from world extents
    function boxAt(x0, x1, y0, y1, z0, z1, material, opts) {
      opts = opts || {};
      const w = x1 - x0, h = y1 - y0, d = z1 - z0;
      const g = worldUV(new THREE.BoxGeometry(w, h, d), w, h, d, opts.tile || 4);
      const m = new THREE.Mesh(g, material);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      add(m, opts);
      if (opts.collide !== false) collider(Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1), y1);
      return m;
    }
    // simple centred box
    function box(w, h, d, material, x, y, z, opts) {
      opts = opts || {};
      const g = worldUV(new THREE.BoxGeometry(w, h, d), w, h, d, opts.tile || 2);
      const m = new THREE.Mesh(g, material);
      m.position.set(x, y, z);
      if (opts.ry) m.rotation.y = opts.ry;
      if (opts.rx) m.rotation.x = opts.rx;
      if (opts.rz) m.rotation.z = opts.rz;
      add(m, opts);
      if (opts.collide) {
        const c = Math.abs(Math.cos(opts.ry || 0)), s = Math.abs(Math.sin(opts.ry || 0));
        const hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2;
        collider(x - hw, x + hw, z - hd, z + hd, y + h / 2);
      }
      return m;
    }
    W.box = box;

    // =========================================================
    //  GROUND, STREETS, SKY
    // =========================================================
    const groundGeo = new THREE.PlaneGeometry(1400, 1400);
    groundGeo.attributes.uv.array.forEach((v, i, a) => { a[i] = v * 140; });
    const ground = new THREE.Mesh(groundGeo, M.grass);
    ground.rotation.x = -Math.PI / 2;
    add(ground, { cast: false });

    const streetLen = HALF * 2;
    STREETS.forEach((s, i) => {
      // N-S street
      let g = new THREE.PlaneGeometry(ST, streetLen);
      g.attributes.uv.array.forEach((v, k, a) => { a[k] = k % 2 ? v * streetLen / ST : v; });
      let m = new THREE.Mesh(g, M.road); m.rotation.x = -Math.PI / 2; m.position.set(s, 0.02, 0);
      add(m, { cast: false });
      // E-W street
      g = new THREE.PlaneGeometry(streetLen, ST);
      g.attributes.uv.array.forEach((v, k, a) => { a[k] = k % 2 ? v : v * streetLen / ST; });
      const mat2 = M.road.clone(); mat2.map = M.road.map.clone(); mat2.map.needsUpdate = true;
      mat2.map.rotation = Math.PI / 2;
      m = new THREE.Mesh(g, mat2); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.025, s);
      add(m, { cast: false });
    });
    // intersections: plain asphalt patches to hide line overlap
    STREETS.forEach(x => STREETS.forEach(z => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(ST, ST), M.asphalt);
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); add(m, { cast: false });
    }));
    // road out of town to the south (opening drive)
    {
      const len = 520;
      const g = new THREE.PlaneGeometry(ST - 2, len);
      g.attributes.uv.array.forEach((v, k, a) => { a[k] = k % 2 ? v * len / ST : v; });
      const m = new THREE.Mesh(g, M.road); m.rotation.x = -Math.PI / 2;
      m.position.set(0, 0.02, -HALF - len / 2 + 1); add(m, { cast: false });
    }
    // sidewalks (block slabs)
    BLOCK_C.forEach(bx => BLOCK_C.forEach(bz => {
      boxAt(bx - BLOCK / 2, bx + BLOCK / 2, 0, 0.12, bz - BLOCK / 2, bz + BLOCK / 2, M.sidewalk, { collide: false, tile: 4, cast: false });
    }));

    // sky dome
    {
      const c = document.createElement('canvas'); c.width = 2; c.height = 256;
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#010103'); gr.addColorStop(0.55, '#03050a'); gr.addColorStop(1, '#06080c');
      g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
      const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
      W.skyMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
      const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), W.skyMat);
      sky.renderOrder = -10; W.sky = sky;
      scene.add(sky);
      // stars
      const pts = [];
      for (let i = 0; i < 900; i++) {
        const th = rand() * Math.PI * 2, ph = Math.acos(R(0.08, 1));
        pts.push(Math.cos(th) * Math.sin(ph) * 850, Math.cos(ph) * 850, Math.sin(th) * Math.sin(ph) * 850);
      }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      W.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xaab4cc, size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.45 }));
      scene.add(W.stars);
      // moon
      const moon = new THREE.Mesh(new THREE.SphereGeometry(22, 20, 14), new THREE.MeshBasicMaterial({ color: 0xd8dccc, fog: false }));
      moon.position.set(-300, 420, 560); scene.add(moon); W.moon = moon;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(190,200,220,0.35)'), fog: false, depthWrite: false, transparent: true }));
      halo.scale.set(200, 200, 1); halo.position.copy(moon.position); scene.add(halo); W.moonHalo = halo;
    }

    // ---------- lights ----------
    // very dark night: the flashlight and the broken street lamps are the real light sources
    W.baseLight = { hemi: simple ? 0.09 : 0.07, moon: simple ? 0.05 : 0.06 };
    W.hemi = new THREE.HemisphereLight(0x2a3650, 0x050507, W.baseLight.hemi);
    scene.add(W.hemi);
    W.moonLight = new THREE.DirectionalLight(0x8fa0c8, W.baseLight.moon);
    W.moonLight.position.set(-60, 120, 110);
    if (S.shadows === 'high') {
      W.moonLight.castShadow = true;
      W.moonLight.shadow.mapSize.set(2048, 2048);
      const cam = W.moonLight.shadow.camera;
      cam.left = -130; cam.right = 130; cam.top = 130; cam.bottom = -130; cam.near = 1; cam.far = 400;
      W.moonLight.shadow.bias = -0.0008;
    }
    scene.add(W.moonLight); scene.add(W.moonLight.target);

    function glowTex(col) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    }
    W.glowTex = glowTex;

    // =========================================================
    //  PROPS
    // =========================================================
    function car(x, z, ry, opts) {
      opts = opts || {};
      const g = new THREE.Group();
      const paint = opts.police ? mat({ color: 0x111111, roughness: 0.5, metalness: 0.3 }) : (opts.paint || pick(M.carPaints));
      const crushed = opts.crushed ? 0.45 : 1;
      const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7 * crushed, 4.4), paint);
      body.position.y = 0.55 * crushed + 0.15; g.add(body);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65 * crushed * (opts.crushed ? 0.4 : 1), 2.2), M.glass);
      cab.position.set(0, 1.2 * crushed + 0.1, -0.2); g.add(cab);
      if (opts.police) {
        const doors = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.4 * crushed, 2.0), mat({ color: 0xdddddd }));
        doors.position.set(0, 0.6 * crushed + 0.15, 0); g.add(doors);
        const bar = new THREE.Group();
        const red = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.3), new THREE.MeshBasicMaterial({ color: opts.lightsOn ? 0xff2020 : 0x501010 }));
        const blue = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.3), new THREE.MeshBasicMaterial({ color: opts.lightsOn ? 0x2050ff : 0x101850 }));
        red.position.x = -0.35; blue.position.x = 0.35; bar.add(red, blue);
        bar.position.set(0, (opts.crushed ? 0.75 : 1.6), -0.2);
        if (opts.crushed) bar.rotation.z = 0.5;
        g.add(bar); g.userData.red = red; g.userData.blue = blue;
      }
      const wg = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
      [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]].forEach(([wx, wz], i) => {
        const w = new THREE.Mesh(wg, M.tire); w.rotation.z = Math.PI / 2;
        w.position.set(wx * (opts.crushed ? 1.2 : 1), 0.38, wz);
        if (opts.crushed && i % 2) w.rotation.x = 0.6;
        g.add(w);
      });
      // headlights
      const hl = new THREE.MeshBasicMaterial({ color: opts.headlightsOn ? 0xfff2cc : 0x333322 });
      [-0.65, 0.65].forEach(hx => { const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.05), hl); h.position.set(hx, 0.6 * crushed + 0.2, 2.21); g.add(h); });
      g.position.set(x, 0, z); g.rotation.y = ry || 0;
      if (opts.flipped) { g.rotation.z = Math.PI; g.position.y = 1.5; }
      g.traverse(o => { if (o.isMesh && shadows) { o.castShadow = true; o.receiveShadow = true; } });
      (opts.parent || W.root).add(g);
      if (!opts.noCollide) {
        const c = Math.abs(Math.cos(ry || 0)), s = Math.abs(Math.sin(ry || 0));
        const hw = (2 * c + 4.4 * s) / 2 + 0.1, hd = (2 * s + 4.4 * c) / 2 + 0.1;
        collider(x - hw, x + hw, z - hd, z + hd, 1.6);
        W.occluders.push(body);
      }
      return g;
    }
    W.car = car;

    function streetLamp(x, z, ry, state) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 7, 8), M.pole);
      pole.position.y = 3.5; g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2), M.pole);
      arm.position.set(0, 6.9, 0.9); g.add(arm);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.7), state === 'off' ? M.lampOff : M.lampOn);
      head.position.set(0, 6.8, 1.8); g.add(head);
      g.position.set(x, 0, z); g.rotation.y = ry;
      if (state === 'bent') { g.rotation.z = 0.35; }
      add(g);
      collider(x - 0.2, x + 0.2, z - 0.2, z + 0.2, 7);
      if (state === 'flicker' || state === 'on') {
        const wp = new THREE.Vector3(0, 6.6, 1.8).applyEuler(g.rotation).add(g.position);
        const light = new THREE.PointLight(0xffc98a, 0, 26, 1.6);
        light.position.copy(wp); W.root.add(light);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,210,150,0.6)'), depthWrite: false, transparent: true }));
        glow.scale.set(3, 3, 1); glow.position.copy(wp); W.root.add(glow);
        W.flickers.push({ light, head, glow, base: 1.4, mode: state, t: rand() * 10, on: true });
      }
    }

    function dumpster(x, z, ry) {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.3), M.dumpster); b.position.y = 0.75; g.add(b);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 1.4), M.dark); lid.position.set(0, 1.44, -0.05); lid.rotation.x = -0.08; g.add(lid);
      g.position.set(x, 0, z); g.rotation.y = ry; add(g);
      W.occluders.push(b);
      const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
      collider(x - (2.2 * c + 1.3 * s) / 2, x + (2.2 * c + 1.3 * s) / 2, z - (2.2 * s + 1.3 * c) / 2, z + (2.2 * s + 1.3 * c) / 2, 1.45);
      // front of dumpster = local +z
      const front = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
      W.hideSpots.push({
        type: 'dumpster', mesh: g,
        pos: new THREE.Vector3(x, 1.05, z), yaw: ry,
        interact: new THREE.Vector3(x, 1, z).addScaledVector(front, 1.3),
        exit: new THREE.Vector3(x, 0, z).addScaledVector(front, 1.6),
      });
    }

    function locker(x, z, ry) {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.0, 0.6), M.locker); b.position.y = 1.0; g.add(b);
      for (let i = 0; i < 4; i++) {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.02), M.dark);
        slot.position.set(0, 1.6 + i * 0.07, 0.31); g.add(slot);
      }
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.9, 0.02), M.dark); seam.position.set(0, 1, 0.31); g.add(seam);
      g.position.set(x, 0.12, z); g.rotation.y = ry; add(g);
      W.occluders.push(b);
      const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
      collider(x - (0.9 * c + 0.6 * s) / 2, x + (0.9 * c + 0.6 * s) / 2, z - (0.9 * s + 0.6 * c) / 2, z + (0.9 * s + 0.6 * c) / 2, 2.1);
      const front = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
      W.hideSpots.push({
        type: 'locker', mesh: g,
        pos: new THREE.Vector3(x, 1.65, z), yaw: ry,
        interact: new THREE.Vector3(x, 1, z).addScaledVector(front, 0.9),
        exit: new THREE.Vector3(x, 0, z).addScaledVector(front, 1.1),
      });
    }

    const batteryMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    function battery(x, y, z) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.26, 10), mat({ color: 0x222222 }));
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.08, 10), batteryMat);
      cap.position.y = 0.09; g.add(body, cap);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,230,120,0.45)'), depthWrite: false, transparent: true }));
      glow.scale.set(0.9, 0.9, 1); g.add(glow);
      g.position.set(x, y, z); W.root.add(g);
      W.pickups.push({ type: 'battery', mesh: g, pos: g.position, baseY: y, taken: false });
    }

    function tree(x, z, s, dead) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.3 * s, 5 * s, 6), M.bark);
      trunk.position.y = 2.5 * s; g.add(trunk);
      if (!dead) {
        const top = new THREE.Mesh(new THREE.ConeGeometry(2.2 * s, 6 * s, 7), M.leaves);
        top.position.y = 6 * s; g.add(top);
      } else {
        for (let i = 0; i < 4; i++) {
          const br = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.09 * s, 2.4 * s, 4), M.bark);
          br.position.y = (3 + i * 0.5) * s; br.rotation.z = (i % 2 ? 1 : -1) * R(0.5, 1.0); br.rotation.y = i * 1.6;
          br.position.x = Math.sin(i * 1.6) * 0.6 * s; br.position.z = Math.cos(i * 1.6) * 0.6 * s;
          g.add(br);
        }
      }
      g.position.set(x, 0, z); add(g);
      collider(x - 0.3 * s, x + 0.3 * s, z - 0.3 * s, z + 0.3 * s, 5);
    }

    function rubblePile(x, z, r, n) {
      for (let i = 0; i < n; i++) {
        const s = R(0.4, 1.6);
        const m = box(s * R(0.8, 2), s * R(0.4, 1), s * R(0.8, 1.6), rand() < 0.6 ? M.rubble : M.brick,
          x + R(-r, r), s * 0.3, z + R(-r, r), { ry: R(0, 3), rx: R(-0.3, 0.3), rz: R(-0.3, 0.3) });
        m.userData.rubble = true;
      }
    }

    // =========================================================
    //  BUILDINGS
    // =========================================================
    // local frame helper: building centre c, forward axis f ('x'|'z') and sign
    function frame(cx, cz, axis, sign, L, D) {
      // lateral axis is the other one
      return {
        cx, cz, axis, sign, L, D,
        // local rect (a0..a1 lateral, b0..b1 depth (+ toward front)) -> world extents
        rect(a0, a1, b0, b1) {
          if (axis === 'z') {
            const z0 = cz + sign * b0, z1 = cz + sign * b1;
            return [cx + a0, cx + a1, Math.min(z0, z1), Math.max(z0, z1)];
          }
          const x0 = cx + sign * b0, x1 = cx + sign * b1;
          return [Math.min(x0, x1), Math.max(x0, x1), cz + a0, cz + a1];
        },
        point(a, b) {
          return axis === 'z' ? new THREE.Vector3(cx + a, 0, cz + sign * b) : new THREE.Vector3(cx + sign * b, 0, cz + a);
        },
        // yaw that faces toward +b (front)
        yawFront() { return axis === 'z' ? (sign > 0 ? 0 : Math.PI) : (sign > 0 ? Math.PI / 2 : -Math.PI / 2); },
        yawBack() { return this.yawFront() + Math.PI; },
        yawLeft() { return this.yawFront() + Math.PI / 2 * (axis === 'z' ? sign : -sign); },
      };
    }
    // wall box with different materials on its outer/inner faces
    function wall(F, a0, a1, b0, b1, y0, y1, outer, inner, outward) {
      // outward: 'front' | 'back' | 'left' | 'right' (which local direction faces outside)
      const [x0, x1, z0, z1] = F.rect(a0, a1, b0, b1);
      // compute which world face index is outward
      let dir;
      if (outward === 'front' || outward === 'back') {
        const s = (outward === 'front' ? 1 : -1) * F.sign;
        dir = F.axis === 'z' ? (s > 0 ? 4 : 5) : (s > 0 ? 0 : 1);
      } else {
        const s = outward === 'right' ? 1 : -1;  // +a direction
        dir = F.axis === 'z' ? (s > 0 ? 0 : 1) : (s > 0 ? 4 : 5);
      }
      const opp = dir % 2 === 0 ? dir + 1 : dir - 1;
      const mats = [M.trim, M.trim, M.trim, M.trim, M.trim, M.trim];
      mats[dir] = outer; mats[opp] = inner;
      const w = x1 - x0, h = y1 - y0, d = z1 - z0;
      // facades tile every 12m (4 windows per tile), everything else every 4m
      const tiles = [4, 4, 4, 4, 4, 4];
      if (M.facades.includes(outer)) tiles[dir] = 12;
      const g = worldUV(new THREE.BoxGeometry(w, h, d), w, h, d, tiles);
      const m = new THREE.Mesh(g, mats);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      add(m, { occlude: true });
      collider(x0, x1, z0, z1, y1);
      return m;
    }

    function buildEnterable(cx, cz, L, D, H, axis, sign, kind, evidenceKind) {
      const F = frame(cx, cz, axis, sign, L, D);
      const t = 0.35, ceil = 3.6, doorW = 2.2, doorH = 2.8;
      const facade = pick(M.facades);
      const inner = pick(M.plaster);
      const floorMat = kind === 'shop' || kind === 'police' ? M.tile : M.wood;
      const hl = L / 2, hd = D / 2;
      // front wall with door
      wall(F, -hl, -doorW / 2, hd - t, hd, 0, H, facade, inner, 'front');
      wall(F, doorW / 2, hl, hd - t, hd, 0, H, facade, inner, 'front');
      wall(F, -doorW / 2, doorW / 2, hd - t, hd, doorH, H, facade, inner, 'front');
      // back
      wall(F, -hl, hl, -hd, -hd + t, 0, H, facade, inner, 'back');
      // sides
      wall(F, -hl, -hl + t, -hd + t, hd - t, 0, H, facade, inner, 'left');
      wall(F, hl - t, hl, -hd + t, hd - t, 0, H, facade, inner, 'right');
      // partition with a gap
      const pb = R(-1, 1.5), gapA = R(-1.5, 1.5), gw = 1.6;
      wall(F, -hl + t, gapA - gw / 2, pb - 0.1, pb + 0.1, 0, ceil, inner, inner, 'front');
      wall(F, gapA + gw / 2, hl - t, pb - 0.1, pb + 0.1, 0, ceil, inner, inner, 'front');
      wall(F, gapA - gw / 2, gapA + gw / 2, pb - 0.1, pb + 0.1, 2.5, ceil, inner, inner, 'front');
      // floor, ceiling, roof
      const [fx0, fx1, fz0, fz1] = F.rect(-hl, hl, -hd, hd);
      boxAt(fx0 + t, fx1 - t, 0, 0.14, fz0 + t, fz1 - t, floorMat, { collide: false, tile: 3, cast: false });
      boxAt(fx0, fx1, ceil, ceil + 0.15, fz0, fz1, inner, { collide: false, tile: 4 });
      boxAt(fx0 - 0.3, fx1 + 0.3, H, H + 0.4, fz0 - 0.3, fz1 + 0.3, M.roof, { collide: false, tile: 6 });
      // dark door frame
      const dp = F.point(0, hd + 0.02);
      const frameMesh = box(axis === 'z' ? doorW + 0.3 : 0.1, 0.2, axis === 'z' ? 0.1 : doorW + 0.3, M.trim, dp.x, doorH + 0.1, dp.z);
      void frameMesh;

      W.interiors.push({ minX: fx0, maxX: fx1, minZ: fz0, maxZ: fz1, ceil });

      // furniture along the side walls (keeping the centre path clear)
      const placeAlong = (b0, b1, side) => {
        let b = b0 + 0.5;
        while (b < b1 - 1.2) {
          const len = R(1.2, 2.4);
          if (b + len > b1 - 0.5) break;
          const roll = rand();
          const a = side * (hl - t - 0.5);
          const p = F.point(a, b + len / 2);
          const ry = axis === 'z' ? 0 : Math.PI / 2;
          if (roll < 0.35) {          // shelf
            box(0.6, R(1.6, 2.2), len, kind === 'shop' ? M.metal : M.wood, p.x, 1, p.z, { ry, collide: true, tile: 2 });
          } else if (roll < 0.6) {    // table / desk
            const d = box(1.0, 0.08, len, M.wood, p.x, 0.8, p.z, { ry, collide: true });
            void d;
            if (kind === 'office' || kind === 'police') {
              const mon = box(0.5, 0.35, 0.1, M.dark, p.x, 1.05, p.z, { ry: ry + Math.PI / 2 });
              void mon;
            }
          } else if (roll < 0.8) {    // couch / bed / crates
            box(1.0, 0.6, len, kind === 'house' ? M.fabric : M.wood, p.x, 0.3, p.z, { ry, collide: true });
          } else {                    // knocked over cabinet
            box(0.6, 0.6, len, M.locker, p.x, 0.3, p.z, { ry: ry + R(-0.3, 0.3), collide: true });
          }
          b += len + R(0.3, 1.2);
        }
      };
      placeAlong(pb + 0.3, hd - t - 1.2, -1);
      placeAlong(pb + 0.3, hd - t - 1.2, 1);
      placeAlong(-hd + t, pb - 0.3, -1);
      placeAlong(-hd + t, pb - 0.3, 1);
      // shop aisles
      if (kind === 'shop' && L > 12) {
        [-2.4, 2.4].forEach(a => {
          const p = F.point(a + gapA * 0.2, (pb + hd) / 2 + 0.3);
          box(axis === 'z' ? 0.7 : 2.6, 1.5, axis === 'z' ? 2.6 : 0.7, M.metal, p.x, 0.75, p.z, { collide: true });
        });
      }
      // a locker against the back wall (hiding spot)
      {
        const a = R(-hl + 1.5, hl - 1.5);
        const p = F.point(a, -hd + t + 0.35);
        locker(p.x, p.z, F.yawFront());
      }
      // scattered papers / debris
      for (let i = 0; i < 6; i++) {
        const p = F.point(R(-hl + 1, hl - 1), R(-hd + 1, hd - 1));
        box(R(0.2, 0.5), 0.01, R(0.2, 0.4), rand() < 0.5 ? M.poster : M.plaster[0], p.x, 0.15, p.z, { ry: R(0, 3) });
      }
      // missing poster near the door
      {
        const p = F.point(hl - t - 0.02 - 0.0, hd - 2.5);
        const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), M.poster);
        pm.position.set(p.x, 1.6, p.z);
        pm.rotation.y = F.yawLeft() + Math.PI;
        add(pm, { cast: false });
      }
      if (rand() < 0.5) {
        const p = F.point(R(-hl + 2, hl - 2), R(-hd + 1.5, pb - 1));
        battery(p.x, 0.5, p.z);
      }

      // ---- evidence inside ----
      if (evidenceKind === 'cctv') {
        // security desk with monitor showing the creature
        const p = F.point(-gapA * 0.3 + (gapA > 0 ? -2.5 : 2.5), -hd + t + 1.0);
        const ry = F.yawFront();
        const desk = box(axis === 'z' ? 2.4 : 1, 0.9, axis === 'z' ? 1 : 2.4, M.wood, p.x, 0.45, p.z, { collide: true });
        void desk;
        const mon = new THREE.Group();
        const casing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 0.5), mat({ color: 0x2b2b28 }));
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.7), M.cctv);
        screen.position.z = 0.26; mon.add(casing, screen);
        mon.position.set(p.x, 1.35, p.z); mon.rotation.y = ry;
        add(mon);
        W.evidence.push({ id: 'cctv', name: 'CCTV still of the creature', pos: new THREE.Vector3(p.x, 1.35, p.z), maxDist: 7, found: false });
      }
      if (evidenceKind === 'warning') {
        const p = F.point(0, -hd + t + 0.02);
        const pm = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.6), M.warning);
        pm.position.set(p.x, 1.7, p.z); pm.rotation.y = F.yawFront();
        add(pm, { cast: false });
        // pile of belongings below
        rubblePile(p.x + (axis === 'z' ? 0 : sign * 1.5), p.z + (axis === 'z' ? sign * 1.5 : 0), 0.6, 4);
        W.evidence.push({ id: 'warning', name: 'Survivor\'s warning', pos: new THREE.Vector3(p.x, 1.7, p.z), maxDist: 9, found: false });
      }
    }

    function buildClosed(cx, cz, L, D, H, axis, sign) {
      const F = frame(cx, cz, axis, sign, L, D);
      const facade = pick(M.facades);
      const [x0, x1, z0, z1] = F.rect(-L / 2, L / 2, -D / 2, D / 2);
      const w = x1 - x0, d = z1 - z0;
      const g = new THREE.BoxGeometry(w, H, d);
      // facade on sides, roof on top
      worldUV(g, w, H, d, 12);
      const m = new THREE.Mesh(g, [facade, facade, M.roof, M.roof, facade, facade]);
      m.position.set((x0 + x1) / 2, H / 2, (z0 + z1) / 2);
      add(m, { occlude: true });
      collider(x0, x1, z0, z1, H);
      // boarded door on the front
      const dp = F.point(R(-L / 4, L / 4), D / 2 + 0.05);
      const door = box(axis === 'z' ? 1.6 : 0.1, 2.6, axis === 'z' ? 0.1 : 1.6, M.wood, dp.x, 1.3, dp.z);
      for (let i = 0; i < 3; i++) {
        box(axis === 'z' ? 2.0 : 0.12, 0.22, axis === 'z' ? 0.12 : 2.0, M.wood, dp.x, 0.7 + i * 0.8, dp.z, { rz: axis === 'z' ? R(-0.25, 0.25) : 0, rx: axis === 'x' ? R(-0.25, 0.25) : 0 });
      }
      void door;
      // rooftop details
      if (rand() < 0.6) box(2, 1.4, 2, M.metal, m.position.x + R(-w / 4, w / 4), H + 0.7, m.position.z + R(-d / 4, d / 4));
      return { F, mesh: m, x0, x1, z0, z1 };
    }

    function buildRuin(cx, cz, L, D) {
      // the remains of a building that was stomped flat
      boxAt(cx - L / 2, cx + L / 2, 0, 0.3, cz - D / 2, cz + D / 2, M.concrete, { collide: false, tile: 4 });
      const segs = [
        [cx - L / 2, cx - L / 2 + 0.4, cz - D / 2, cz + R(-2, D / 2)],
        [cx - L / 2, cx + R(-2, L / 3), cz - D / 2, cz - D / 2 + 0.4],
        [cx + L / 2 - 0.4, cx + L / 2, cz + R(-D / 2, 0), cz + D / 2],
      ];
      segs.forEach(([x0, x1, z0, z1]) => {
        // jagged: several pieces of differing height
        const along = (x1 - x0) > (z1 - z0) ? 'x' : 'z';
        const len = along === 'x' ? x1 - x0 : z1 - z0;
        const n = Math.max(1, Math.round(len / 2));
        for (let i = 0; i < n; i++) {
          const h = R(0.6, 4.5);
          if (along === 'x') boxAt(x0 + i * len / n, x0 + (i + 1) * len / n, 0, h, z0, z1, M.brick, { occlude: true, tile: 4 });
          else boxAt(x0, x1, 0, h, z0 + i * len / n, z0 + (i + 1) * len / n, M.brick, { occlude: true, tile: 4 });
        }
      });
      rubblePile(cx, cz, Math.min(L, D) / 2.5, 14);
      // broken beams
      for (let i = 0; i < 3; i++) box(0.3, 0.3, R(4, 7), M.wood, cx + R(-4, 4), 0.6, cz + R(-4, 4), { ry: R(0, 3), rx: R(-0.4, 0.4), collide: false });
    }

    function buildLot(cx, cz, kind) {
      if (kind === 'parking') {
        boxAt(cx - 8, cx + 8, 0, 0.13, cz - 8, cz + 8, M.asphalt, { collide: false, tile: 6, cast: false });
        for (let i = 0; i < 2; i++) car(cx + R(-4, 4), cz + R(-4, 4), R(0, 6.28), { flipped: rand() < 0.2 });
      } else if (kind === 'park') {
        for (let i = 0; i < 4; i++) tree(cx + R(-6, 6), cz + R(-6, 6), R(0.8, 1.3), rand() < 0.7);
        const bench = box(2, 0.1, 0.6, M.wood, cx + R(-3, 3), 0.5, cz + R(-3, 3), { ry: R(0, 3), collide: true });
        void bench;
      }
    }

    // ---------- forced special lots ----------
    // key: "blockI,blockJ,lotX,lotZ" (lotX/lotZ = -1 | 1)
    const SPECIAL = {
      '2,0,-1,1': { type: 'enter', kind: 'police', evidence: 'cctv' },
      '0,2,1,-1': { type: 'enter', kind: 'house', evidence: 'warning' },
      '1,0,-1,1': { type: 'enter', kind: 'shop' },          // near spawn
      '2,1,-1,-1': { type: 'enter', kind: 'office' },
      '1,1,1,1': { type: 'ruin' },                            // town centre devastation
      '2,2,-1,-1': { type: 'ruin' },
      '3,2,-1,-1': { type: 'closed', claws: true },
      '1,3,1,1': { type: 'tower' },
      '2,0,1,-1': { type: 'park' },
    };

    let enterCount = 0;
    for (let bi = 0; bi < NB; bi++) for (let bj = 0; bj < NB; bj++) {
      const bx = BLOCK_C[bi], bz = BLOCK_C[bj];
      for (const lx of [-1, 1]) for (const lz of [-1, 1]) {
        const cx = bx + lx * 10, cz = bz + lz * 10;
        const key = `${bi},${bj},${lx},${lz}`;
        const sp = SPECIAL[key];
        let type;
        if (sp) type = sp.type;
        else {
          const r = rand();
          type = r < 0.28 ? 'enter' : r < 0.68 ? 'closed' : r < 0.8 ? 'ruin' : r < 0.9 ? 'parking' : 'park';
          if (type === 'enter' && enterCount > 8) type = 'closed';
        }
        // facing: toward the street on the lot's outer side
        const axis = rand() < 0.5 ? 'x' : 'z';
        const sign = axis === 'x' ? lx : lz;
        const L = sp && sp.type === 'closed' ? 16 : Math.round(R(12, 16));
        const D = Math.round(R(12, 16));
        const H = rand() < 0.75 ? R(6, 10) : R(11, 16);
        if (type === 'enter') {
          enterCount++;
          buildEnterable(cx, cz, L, D, Math.max(H, 6), axis, sign, (sp && sp.kind) || pick(['house', 'shop', 'office', 'house']), sp && sp.evidence);
        } else if (type === 'closed') {
          if (sp && sp.claws) {
            const res = buildClosed(cx, cz, 16, 16, 9, 'x', -1);
            // giant claw marks on the wall facing the street at x = cx-8
            const c = document.createElement('canvas'); c.width = c.height = 256;
            const g = c.getContext('2d');
            for (let i = 0; i < 4; i++) {
              g.save(); g.translate(60 + i * 40, 20); g.rotate(0.18);
              const gr = g.createLinearGradient(0, 0, 14, 0);
              gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(5,3,2,0.95)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
              g.fillStyle = gr;
              g.beginPath(); g.moveTo(7, 0); g.quadraticCurveTo(20, 110, 7, 220); g.quadraticCurveTo(-6, 110, 7, 0); g.fill();
              g.restore();
            }
            const tex = new THREE.CanvasTexture(c);
            const cm = new THREE.Mesh(new THREE.PlaneGeometry(7, 8), new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
            cm.position.set(res.x0 - 0.03, 4.4, cz); cm.rotation.y = -Math.PI / 2;
            W.root.add(cm);
            rubblePile(res.x0 - 2, cz, 2, 6);
            W.evidence.push({ id: 'claws', name: 'Giant claw marks', pos: new THREE.Vector3(res.x0, 4.4, cz), maxDist: 22, found: false, normal: new THREE.Vector3(-1, 0, 0) });
          } else buildClosed(cx, cz, L, D, H, axis, sign);
        } else if (type === 'ruin') {
          buildRuin(cx, cz, L, D);
        } else if (type === 'tower') {
          // water tower with a huge handprint dent
          const tg = new THREE.Group();
          for (const [ox, oz] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 12, 6), M.pole);
            leg.position.set(ox, 6, oz); tg.add(leg);
            collider(cx + ox - 0.3, cx + ox + 0.3, cz + oz - 0.3, cz + oz + 0.3, 12);
          }
          const tank = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 6, 16), M.water);
          tank.position.y = 15; tank.scale.set(1, 1, 0.85); tank.rotation.z = 0.12; tg.add(tank);
          const cone = new THREE.Mesh(new THREE.ConeGeometry(4.8, 2.5, 16), M.roof); cone.position.y = 19.2; cone.rotation.z = 0.12; tg.add(cone);
          const txt = document.createElement('canvas'); txt.width = 512; txt.height = 256;
          const g = txt.getContext('2d');
          g.fillStyle = 'rgba(230,230,220,0.9)'; g.font = 'bold 70px Arial'; g.textAlign = 'center';
          g.fillText('HOLLOW', 256, 100); g.fillText('CREEK', 256, 180);
          // giant hand print (dark, smeared)
          g.fillStyle = 'rgba(25,10,8,0.9)';
          g.beginPath(); g.ellipse(330, 150, 55, 70, 0.2, 0, 7); g.fill();
          for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(275 + i * 32, 60 - Math.abs(i - 1.5) * 10, 12, 50, -0.2 + i * 0.12, 0, 7); g.fill(); }
          const tt = new THREE.CanvasTexture(txt);
          const label = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.5), new THREE.MeshLambertMaterial({ map: tt, transparent: true }));
          label.position.set(0, 15, 3.9); tg.add(label);
          tg.position.set(cx, 0, cz); tg.rotation.y = -Math.PI / 4;
          add(tg);
          tg.traverse(o => o.isMesh && W.occluders.push(o));
          const lp = new THREE.Vector3(0, 15, 3.9).applyEuler(tg.rotation).add(tg.position);
          W.evidence.push({ id: 'tower', name: 'Handprint on the water tower', pos: lp, maxDist: 34, found: false });
          rubblePile(cx + 3, cz + 3, 2, 5);
        } else {
          buildLot(cx, cz, type);
        }
      }
      // dumpster in each block's central alley, sometimes two
      const ry = rand() < 0.5 ? 0 : Math.PI / 2;
      dumpster(bx + (ry ? 0 : R(-12, 12)), bz + (ry ? R(-12, 12) : 0), ry + (rand() < 0.5 ? Math.PI : 0));
    }

    // =========================================================
    //  STREET DRESSING
    // =========================================================
    // lamps along streets
    let lampI = 0;
    STREETS.forEach((s, i) => {
      for (let k = 0; k < NB; k++) {
        const along = BLOCK_C[k];
        const side = (k + i) % 2 ? 1 : -1;
        const st = lampI++ % 7 === 3 ? 'flicker' : (rand() < 0.15 ? 'bent' : 'off');
        streetLamp(s + side * (ST / 2 + 0.7), along + R(-6, 6), side > 0 ? -Math.PI / 2 : Math.PI / 2, st);
        if (rand() < 0.5) streetLamp(along + R(-6, 6), s + side * (ST / 2 + 0.7), side > 0 ? Math.PI : 0, rand() < 0.12 ? 'bent' : 'off');
      }
    });
    // abandoned cars on the streets (keep the very centre of intersections clear)
    for (let i = 0; i < 18; i++) {
      const s = pick(STREETS), along = pick(BLOCK_C) + R(-12, 12);
      const lane = pick([-3, 3]);
      const vertical = rand() < 0.5;
      if (vertical) car(s + lane, along, R(-0.3, 0.3) + (lane > 0 ? 0 : Math.PI), { flipped: rand() < 0.15 });
      else car(along, s + lane, Math.PI / 2 + R(-0.3, 0.3) + (lane > 0 ? Math.PI : 0), { flipped: rand() < 0.15 });
    }
    // street-side dumpsters
    for (let i = 0; i < 8; i++) {
      const bx = pick(BLOCK_C), bz = pick(BLOCK_C);
      const side = pick([-1, 1]);
      if (rand() < 0.5) dumpster(bx + side * (BLOCK / 2 - 1.2), bz + R(-14, 14), side > 0 ? Math.PI / 2 : -Math.PI / 2);
      else dumpster(bx + R(-14, 14), bz + side * (BLOCK / 2 - 1.2), side > 0 ? 0 : Math.PI);
    }
    // outdoor batteries
    [[-58, -20], [47, 58], [-20, 47], [56, -80], [-102, 70], [80, 100], [4, -40]].forEach(([x, z]) => battery(x, 0.4, z));
    // debris
    for (let i = 0; i < 40; i++) {
      const s = pick(STREETS), a = R(-HALF + 8, HALF - 8);
      const v = rand() < 0.5;
      box(R(0.3, 1.2), R(0.1, 0.5), R(0.3, 1.2), rand() < 0.5 ? M.rubble : M.wood, v ? s + R(-5, 5) : a, 0.15, v ? a : s + R(-5, 5), { ry: R(0, 3) });
    }

    // ---------- outdoor evidence ----------
    // 1. Giant footprint on Main Street (x = 52)
    {
      const fp = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 8), M.footprint);
      fp.rotation.x = -Math.PI / 2; fp.rotation.z = 0.2; fp.position.set(52, 0.06, 30);
      W.root.add(fp);
      const fp2 = fp.clone(); fp2.position.set(49, 0.06, 52); fp2.rotation.z = -0.1; fp2.scale.x = -1; W.root.add(fp2);
      rubblePile(52, 30, 3, 6);
      W.evidence.push({ id: 'footprint', name: 'Giant footprint', pos: new THREE.Vector3(52, 0.1, 30), maxDist: 16, found: false, ground: true });
    }
    // 2. Crushed police cruiser
    {
      const pc = car(-30, -52, 1.2, { police: true, crushed: true });
      void pc;
      rubblePile(-30, -52, 3.5, 5);
      W.evidence.push({ id: 'police', name: 'Crushed police cruiser', pos: new THREE.Vector3(-30, 0.6, -52), maxDist: 16, found: false });
    }

    // =========================================================
    //  TOWN EDGE, ENTRANCE, FOREST
    // =========================================================
    // invisible perimeter
    const E = HALF + 3;
    collider(-E - 5, -E, -E - 5, E + 5); collider(E, E + 5, -E - 5, E + 5);
    collider(-E, E, E, E + 5); collider(-E, E, -E - 5, -E);
    // barricade fence around the edge (visual)
    const fenceMat = mat({ color: 0x3b3b38, roughness: 0.6, metalness: 0.4, transparent: true, opacity: 0.85 });
    [[0, E - 0.5, 0], [0, -E + 0.5, 0], [E - 0.5, 0, Math.PI / 2], [-E + 0.5, 0, Math.PI / 2]].forEach(([x, z, r]) => {
      for (let k = -HALF; k < HALF; k += 6) {
        if (z < 0 && r === 0 && Math.abs(k + 3) < 7) continue; // entrance gap
        const p = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.2, 0.08), fenceMat);
        if (r) p.position.set(x, 1.1, k + 3); else p.position.set(k + 3, 1.1, z);
        p.rotation.y = r; p.rotation.z = R(-0.06, 0.06); add(p);
      }
    });
    // road block at the entrance (behind the player's car)
    for (let i = -1; i <= 1; i++) {
      const b = box(1.6, 0.9, 0.4, mat({ color: 0xc8c0a0 }), i * 2, 0.45, -E - 1, { collide: true });
      void b;
    }
    collider(-6, 6, -E - 2, -E);
    // welcome sign beside the south road
    {
      const g = new THREE.Group();
      const s = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), M.sign);
      s.position.y = 2.6; g.add(s);
      [-2.6, 2.6].forEach(x => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4), M.pole); p.position.set(x, 1.6, -0.05); g.add(p); });
      g.position.set(-8, 0, -150); g.rotation.y = 0.15; add(g);
      W.sign = g;
    }
    // forest outside town (instanced)
    {
      const n = S.viewDistance === 'near' ? 500 : 1100;
      const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.35, 6, 5), M.bark, n);
      const top = new THREE.InstancedMesh(new THREE.ConeGeometry(2.6, 8, 6), M.leaves, n);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
      let i = 0;
      while (i < n) {
        const x = R(-420, 420), z = R(-560, 420);
        if (Math.abs(x) < HALF + 10 && Math.abs(z) < HALF + 10) continue;
        if (Math.abs(x) < 12 && z < -HALF) continue; // keep the road clear
        if (Math.abs(x + 8) < 6 && Math.abs(z + 150) < 6) continue;
        const s = R(0.8, 1.6);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R(0, 6.28));
        m4.compose(p.set(x, 3 * s, z), q, sc.set(s, s, s)); trunk.setMatrixAt(i, m4);
        m4.compose(p.set(x, 8.5 * s, z), q, sc.set(s, s * R(0.9, 1.3), s)); top.setMatrixAt(i, m4);
        i++;
      }
      if (shadows) { trunk.castShadow = top.castShadow = true; }
      W.root.add(trunk, top);
    }
    // distant hills silhouette
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2;
      const h = new THREE.Mesh(new THREE.ConeGeometry(R(120, 220), R(40, 90), 6), M.leaves);
      h.position.set(Math.cos(a) * 640, 0, Math.sin(a) * 640); W.root.add(h);
    }

    // =========================================================
    //  NAV — street graph for the monster
    // =========================================================
    W.nodes = [];
    STREETS.forEach((x, i) => STREETS.forEach((z, j) => W.nodes.push({ i, j, x, z })));
    W.nodeAt = (i, j) => W.nodes[i * STREETS.length + j];
    // nearest point that lies on a street centre line
    W.projectToStreet = function (p) {
      const nearest = v => STREETS.reduce((a, s) => Math.abs(s - v) < Math.abs(a - v) ? s : a, STREETS[0]);
      const clamp = v => Math.max(-HALF + ST / 2, Math.min(HALF - ST / 2, v));
      const a = { x: nearest(p.x), z: clamp(p.z) };
      const b = { x: clamp(p.x), z: nearest(p.z) };
      const da = (a.x - p.x) ** 2 + (a.z - p.z) ** 2, db = (b.x - p.x) ** 2 + (b.z - p.z) ** 2;
      return da < db ? a : b;
    };
    W.nearestNode = function (p) {
      let best = null, bd = Infinity;
      W.nodes.forEach(n => { const d = (n.x - p.x) ** 2 + (n.z - p.z) ** 2; if (d < bd) { bd = d; best = n; } });
      return best;
    };
    W.path = function (from, to) {
      // BFS on the 5x5 grid
      const N = STREETS.length;
      const start = W.nearestNode(from), goal = W.nearestNode(to);
      const prev = new Map(); const q = [start]; prev.set(start, null);
      while (q.length) {
        const n = q.shift();
        if (n === goal) break;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([di, dj]) => {
          const ni = n.i + di, nj = n.j + dj;
          if (ni < 0 || nj < 0 || ni >= N || nj >= N) return;
          const m = W.nodeAt(ni, nj);
          if (!prev.has(m)) { prev.set(m, n); q.push(m); }
        });
      }
      const out = []; let n = goal;
      while (n) { out.unshift(n); n = prev.get(n); }
      return out;
    };
    W.isIndoor = function (p) {
      return W.interiors.some(r => p.x > r.minX && p.x < r.maxX && p.z > r.minZ && p.z < r.maxZ);
    };

    // =========================================================
    //  UPDATE (flickering lights, pickups bobbing)
    // =========================================================
    W.update = function (dt, time) {
      W.flickers.forEach(f => {
        f.t -= dt;
        if (f.mode === 'flicker') {
          if (f.t <= 0) { f.on = !f.on; f.t = f.on ? R(0.05, 1.8) : R(0.03, 0.4); }
          const v = f.on ? f.base : 0;
          f.light.intensity = v;
          if (f.head) f.head.material = f.on ? M.lampOn : M.lampOff;
          if (f.glow) f.glow.visible = f.on;
        } else if (f.mode === 'screen') {
          f.light.intensity = f.base * (0.8 + Math.random() * 0.3);
        } else {
          f.light.intensity = f.base;
        }
      });
      W.pickups.forEach(p => {
        if (p.taken) return;
        p.mesh.position.y = p.baseY + Math.sin(time * 2 + p.pos.x) * 0.06;
        p.mesh.rotation.y += dt;
      });
    };

    W.spawn = new THREE.Vector3(1.2, 0, -HALF + 6);
    W.playerCarPos = new THREE.Vector3(-3, 0, -HALF + 5);
    return W;
  }
})();
