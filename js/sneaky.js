// ============================================================
//  THE LOUD ONE — the Sneaky One (Phenomenon-241)
//  Two ominous glowing eyes and a far too wide smile. On a random
//  timer (30s - 3min) it creeps up right behind you: your flashlight
//  flickers and you hear breathing. Turn around within ~2.5 seconds
//  or it kills you. The timer pauses while Siren Head is close enough
//  to hear your flashlight (it won't risk him).
// ============================================================
(function () {
  const V3 = THREE.Vector3;
  const MIN_T = 30, MAX_T = 180, WINDOW = 2.5;
  const FACE_COS = Math.cos(THREE.MathUtils.degToRad(55));   // how directly you must face it
  LO.SNEAKY = { WINDOW };
  // TESTING ONLY: open the game with ?sneakytest in the URL and it always comes after 20 seconds
  const TEST = /[?&]sneakytest\b/.test(location.search);
  const nextTime = () => TEST ? 20 : MIN_T + Math.random() * (MAX_T - MIN_T);

  function Sneaky(scene, world) {
    this.scene = scene; this.world = world;
    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);
    this.build();
    this.reset();
  }
  LO.Sneaky = Sneaky;

  Sneaky.prototype.build = function () {
    const R = this.root;
    const shadow = new THREE.MeshBasicMaterial({ color: 0x020202 });
    // a tall, barely-there shape: you mostly see the eyes and the grin
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.7, 10), shadow);
    body.position.y = 0.95; R.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), shadow);
    head.scale.set(1.05, 1.15, 0.9); head.position.y = 1.95; R.add(head);
    this.head = head;
    const glow = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
    this.eyes = [-1, 1].map(s => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), glow);
      e.scale.set(1.5, 0.7, 0.5); e.position.set(s * 0.1, 2.03, 0.235); R.add(e);
      return e;
    });
    // the smile: a very wide arc of glowing teeth from cheek to cheek
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.016, 6, 28, Math.PI * 0.95),
      new THREE.MeshBasicMaterial({ color: 0xf2ecd8 }));
    smile.rotation.z = Math.PI + Math.PI * 0.025; smile.position.set(0, 1.93, 0.215); smile.scale.set(1.25, 0.75, 1);
    R.add(smile);
    for (let i = 0; i < 14; i++) {
      const a = Math.PI + Math.PI * 0.08 + i / 13 * Math.PI * 0.84;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.045, 4), new THREE.MeshBasicMaterial({ color: 0xf5f0de }));
      tooth.position.set(Math.cos(a) * 0.19 * 1.25, 1.93 + Math.sin(a) * 0.19 * 0.75 + 0.02, 0.24);
      tooth.rotation.z = Math.PI;
      R.add(tooth);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.world.glowTex('rgba(255,240,190,0.35)'), depthWrite: false, transparent: true }));
    halo.scale.set(0.9, 0.5, 1); halo.position.set(0, 2.0, 0.3); R.add(halo);
  };

  Sneaky.prototype.reset = function () {
    lastReal = performance.now();
    this.timer = nextTime();
    this.attacking = false;
    this.t = 0;
    this.root.visible = false;
    if (this.breath) { this.breath.stop(); this.breath = null; }
  };

  // returns 'kill' when it gets you
  // counts in real seconds (the game's own clock slows down on low frame rates)
  let lastReal = performance.now();
  function realDt() { const n = performance.now(), d = Math.min(0.5, (n - lastReal) / 1000); lastReal = n; return d; }
  let label = null;
  function testLabel(text) {
    if (!TEST) return;
    if (!label) {
      label = document.createElement('div');
      label.style.cssText = 'position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:60;font:12px monospace;color:#ffd34d;background:rgba(0,0,0,0.6);padding:2px 8px;pointer-events:none';
      document.body.appendChild(label);
      // hide it whenever the game stops updating it (menus, cutscenes, death screen)
      setInterval(() => { if (performance.now() - (label._t || 0) > 300) label.style.display = 'none'; }, 200);
    }
    label._t = performance.now();
    label.style.display = text ? 'block' : 'none';
    label.textContent = text;
  }
  Sneaky.prototype.update = function (dt, player, camera, siren) {
    dt = realDt();
    if (player.calm || !player.alive) { if (this.attacking) this.vanish(player, false); testLabel(''); return; }
    testLabel(this.attacking ? 'SNEAKY TEST: IT IS BEHIND YOU — TURN AROUND' : 'SNEAKY TEST: next attack in ' + Math.max(0, this.timer).toFixed(0) + 's');
    const fwd = new V3(); camera.getWorldDirection(fwd);
    if (!this.attacking) {
      // it won't come while Siren Head is close enough to hear the flashlight
      const hearFlash = LO.NOISE.flashlight * 1.3 * (player.indoor ? 0.6 : 1);
      const sirenNear = siren && siren.distToPlayer !== undefined && siren.distToPlayer < hearFlash + 4;
      if ((sirenNear || player.hidden) && !TEST) return;
      this.timer -= dt;
      if (this.timer > 0) return;
      // creep up right behind you
      this.attacking = true; this.t = 0;
      const back = new V3(-fwd.x, 0, -fwd.z).normalize();
      this.root.position.set(player.pos.x + back.x * 1.5, 0, player.pos.z + back.z * 1.5);
      this.root.lookAt(player.pos.x, 0, player.pos.z);
      this.root.visible = true;
      player.flickerForce = true;
      this.breath = LO.audio.sneakyBreath(this.root.position);
      return;
    }
    this.t += dt;
    // keep it pressed close behind you if you back away
    const toIt = new V3(this.root.position.x - camera.position.x, 0, this.root.position.z - camera.position.z);
    const dist = toIt.length();
    if (dist > 2.2) {
      toIt.normalize();
      this.root.position.x = camera.position.x + toIt.x * 1.8;
      this.root.position.z = camera.position.z + toIt.z * 1.8;
    }
    this.root.lookAt(player.pos.x, 0, player.pos.z);
    if (this.breath) this.breath.move(this.root.position);
    this.eyes.forEach(e => { e.scale.y = 0.7 * (Math.random() < 0.03 ? 0.1 : 1); });
    // facing it in time makes it vanish
    const f2 = new V3(fwd.x, 0, fwd.z).normalize();
    toIt.normalize();
    if (f2.dot(toIt) > FACE_COS) { this.vanish(player, true); return; }
    if (this.t >= WINDOW) { this.vanish(player, false); return 'kill'; }
  };

  Sneaky.prototype.vanish = function (player, seen) {
    this.attacking = false;
    this.root.visible = false;
    player.flickerForce = false;
    if (this.breath) { this.breath.stop(); this.breath = null; }
    if (seen) LO.audio.staticBurst(null, 0.35, 0.35);
    this.timer = nextTime();
  };
})();
