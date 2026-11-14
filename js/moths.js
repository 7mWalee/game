// ============================================================
//  THE LOUD ONE — the Moths
//  Pale, motionless figures standing in dark corners and alleys.
//  Keep your flashlight on one for more than ~2 seconds and it
//  shrieks: Siren Head hears it, and it tears off some of your HP.
// ============================================================
(function () {
  const V3 = THREE.Vector3;
  const LIGHT_LIMIT = 2.0;   // seconds of light before it shrieks
  const DAMAGE = 10;
  const COUNT = 12;
  const BEAM_ANGLE = 0.42;   // radians — roughly the bright part of the beam
  const BEAM_RANGE = 34;
  LO.MOTH = { LIGHT_LIMIT, DAMAGE };

  function Moths(scene, world) {
    this.scene = scene;
    this.world = world;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.raycaster = new THREE.Raycaster();
    this.mat = new THREE.MeshLambertMaterial({ color: 0xd8d4c8 });
    this.wingMat = new THREE.MeshLambertMaterial({ color: 0xbdb7a6, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    this.buildSpots();
    this.moths = [];
    for (let i = 0; i < COUNT; i++) this.moths.push(this.makeMoth());
    this.reset();
  }
  LO.Moths = Moths;

  // candidate places: dark corners inside buildings and alleys between them
  Moths.prototype.buildSpots = function () {
    const W = this.world, spots = [];
    W.interiors.forEach(r => {
      const m = 0.9;
      spots.push({ x: r.minX + m, z: r.minZ + m, indoor: true }, { x: r.maxX - m, z: r.maxZ - m, indoor: true },
        { x: r.minX + m, z: r.maxZ - m, indoor: true }, { x: r.maxX - m, z: r.minZ + m, indoor: true });
    });
    LO.World.BLOCK_C.forEach(bx => LO.World.BLOCK_C.forEach(bz => {
      [-14, -7, 7, 14].forEach(o => {
        spots.push({ x: bx + o, z: bz, indoor: false }, { x: bx, z: bz + o, indoor: false });
      });
    }));
    // keep them away from the start
    this.spots = spots.filter(s => Math.hypot(s.x - W.spawn.x, s.z - W.spawn.z) > 30);
  };

  Moths.prototype.makeMoth = function () {
    const g = new THREE.Group();
    const M = this.mat;
    const limb = (r, len, x, y, z, rz) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.7, len, 6), M);
      m.position.set(x, y, z); m.rotation.z = rz || 0; g.add(m); return m;
    };
    limb(0.07, 1.25, -0.11, 0.62, 0); limb(0.07, 1.25, 0.11, 0.62, 0);     // legs
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.95, 7), M);
    body.position.y = 1.7; g.add(body);
    limb(0.045, 1.25, -0.27, 1.45, 0, 0.08); limb(0.045, 1.25, 0.27, 1.45, 0, -0.08); // long arms
    const neck = limb(0.05, 0.3, 0, 2.3, 0);
    void neck;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), M);
    head.scale.set(0.9, 1.35, 0.9); head.position.y = 2.58; g.add(head);
    // folded, ragged wings on the back
    const wings = [];
    [-1, 1].forEach(side => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0); shape.lineTo(side * 0.55, 0.35); shape.lineTo(side * 0.7, -0.4);
      shape.lineTo(side * 0.45, -0.9); shape.lineTo(side * 0.2, -0.6); shape.lineTo(0, -0.75);
      const w = new THREE.Mesh(new THREE.ShapeGeometry(shape), this.wingMat);
      w.position.set(0, 2.05, -0.14); w.rotation.y = side * 0.5;
      g.add(w); wings.push({ mesh: w, side });
    });
    g.visible = false;
    this.root.add(g);
    return { g, head, wings, lit: 0, active: false, cooldown: 0, spot: null, twitch: 0 };
  };

  Moths.prototype.place = function (m) {
    const used = new Set(this.moths.filter(o => o.active && o !== m).map(o => o.spot));
    const free = this.spots.filter(s => !used.has(s));
    const s = free[(Math.random() * free.length) | 0];
    m.spot = s;
    m.g.position.set(s.x, s.indoor ? 0.14 : 0.12, s.z);
    m.g.rotation.y = Math.random() * Math.PI * 2;
    m.lit = 0; m.active = true; m.g.visible = true;
  };

  Moths.prototype.reset = function () {
    this.moths.forEach(m => { m.active = false; m.g.visible = false; m.cooldown = 0; m.spot = null; });
    this.moths.forEach(m => this.place(m));
    this.root.visible = true;
    this.maxLit = 0;
  };

  const _fwd = new V3(), _to = new V3(), _chest = new V3();
  Moths.prototype.update = function (dt, player, camera, time) {
    const W = this.world;
    camera.getWorldDirection(_fwd);
    this.maxLit = 0;
    this.nearestLit = null;
    // they can only be seen in flashlight — with it off, they're simply not there
    const show = player.flashOn && player.flash.intensity > 0.5 && !player.calm;
    if (player.calm) {
      this.moths.forEach(m => { m.g.visible = false; m.lit = 0; });
      LO.audio.setMothFlutter(0);
      return;
    }
    for (const m of this.moths) {
      m.g.visible = m.active && show;
      if (!m.active) {
        m.cooldown -= dt;
        if (m.cooldown <= 0) this.place(m);   // it settles somewhere else
        continue;
      }
      let inBeam = false;
      if (player.flashOn && player.flash.intensity > 0.5 && !player.hidden) {
        _chest.copy(m.g.position); _chest.y += 1.7;
        _to.copy(_chest).sub(camera.position);
        const d = _to.length();
        if (d < BEAM_RANGE) {
          _to.normalize();
          if (Math.acos(Math.max(-1, Math.min(1, _to.dot(_fwd)))) < BEAM_ANGLE) {
            this.raycaster.set(camera.position, _to);
            this.raycaster.far = d;
            const hits = this.raycaster.intersectObjects(W.occluders, false);
            inBeam = !hits.length || hits[0].distance > d - 0.6;
          }
        }
      }
      if (inBeam) m.lit += dt; else m.lit = Math.max(0, m.lit - dt * 0.7);
      const k = m.lit / LIGHT_LIMIT;
      if (k > this.maxLit) { this.maxLit = k; this.nearestLit = m; }

      // reacts to the light: turns its faceless head to you, wings start to quiver
      if (m.lit > 0.05) {
        const want = Math.atan2(camera.position.x - m.g.position.x, camera.position.z - m.g.position.z);
        let diff = want - m.g.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
        m.g.rotation.y += diff * Math.min(1, dt * (1 + k * 6));
      }
      const quiver = k * k;
      m.wings.forEach(w => {
        w.mesh.rotation.y = w.side * (0.5 + quiver * 0.9 + Math.sin(time * 40 + w.side) * quiver * 0.35);
      });
      m.head.rotation.z = quiver > 0.2 ? Math.sin(time * 23) * 0.25 * quiver : 0;

      if (m.lit >= LIGHT_LIMIT) this.shriek(m, player);
    }
    LO.audio.setMothFlutter(Math.min(1, this.maxLit));
  };

  Moths.prototype.shriek = function (m, player) {
    const pos = m.g.position.clone(); pos.y = 2;
    LO.audio.mothShriek(pos);
    m.active = false; m.g.visible = false;
    m.cooldown = 50 + Math.random() * 30;
    this.onShriek && this.onShriek(pos);
    player.damage(DAMAGE, 'moth');
  };

  Moths.prototype.dispose = function () {
    this.scene.remove(this.root);
  };
})();
