// ============================================================
//  THE LOUD ONE — Siren Head: model, animation and hearing AI
// ============================================================
(function () {
  const V3 = THREE.Vector3;

  const LINES = {
    wander: ['...is anyone... out there...', '...this is not a drill...', '...please remain indoors...', '...come home... come home...', '...the town is quiet now...'],
    heard: ['...I hear you...', '...who is there...', '...little noise...', '...something moved...'],
    search: ['...where did you go...', '...I know you are here...', '...make a sound... for me...', '...so quiet... so quiet...'],
    hunt: ['...FOUND YOU...', '...EMERGENCY... EMERGENCY...', '...run... run...', '...LOUD... SO LOUD...'],
  };

  function SirenHead(scene, world) {
    this.world = world;
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.buildModel();

    this.pos = this.root.position;
    this.yaw = 0;
    this.state = 'wander';
    this.anger = 0;
    this.lastHeard = new V3();
    this.lastHeardTime = -999;
    this.stateTime = 0;
    this.target = null;
    this.path = [];
    this.repathTimer = 0;
    this.speed = 0;
    this.phase = 0;
    this.lastStepSign = 1;
    this.callTimer = 10 + Math.random() * 10;
    this.lineTimer = 6;
    this.scripted = false;
    this.lean = 0;
    this.headTurn = 0;
    this.glow = 0;
    this.creakTimer = 4;
    this.hunting = false;
    this.voice = LO.audio.createMonsterVoice();
    this.spawnFar();
  }
  LO.SirenHead = SirenHead;

  SirenHead.prototype.buildModel = function () {
    const S = LO.settings;
    const simple = S.lighting === 'simple';
    const Mat = o => simple ? new THREE.MeshLambertMaterial(o) : new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85 }, o));
    const skinTex = LO.tex.get('skin');
    const skin = Mat({ map: skinTex, color: 0x9a8a7a });
    const darkSkin = Mat({ map: skinTex, color: 0x5d5248 });
    const metal = Mat({ color: 0x4c4c46, metalness: 0.6, roughness: 0.5 });
    const rust = Mat({ map: LO.tex.get('metal', { color: '#5a4636' }), metalness: 0.5, roughness: 0.6 });
    const inside = new THREE.MeshBasicMaterial({ color: 0x050303, side: THREE.BackSide });
    this.mats = { skin, darkSkin, metal };

    function limb(r0, r1, len, m) {
      const g = new THREE.CylinderGeometry(r0, r1, len, 7);
      g.translate(0, -len / 2, 0);
      const mesh = new THREE.Mesh(g, m);
      return mesh;
    }
    const R = this.root;
    const hip = new THREE.Group(); hip.position.y = 8.4; R.add(hip);
    this.hip = hip;
    // pelvis
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 0.7), darkSkin); hip.add(pelvis);

    this.legs = [-1, 1].map(side => {
      const thigh = new THREE.Group(); thigh.position.x = side * 0.65; hip.add(thigh);
      thigh.add(limb(0.32, 0.2, 4.3, skin));
      const knee = new THREE.Group(); knee.position.y = -4.3; thigh.add(knee);
      const kj = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), darkSkin); knee.add(kj);
      knee.add(limb(0.2, 0.13, 4.0, skin));
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 1.4), darkSkin);
      foot.position.set(0, -4.0, 0.4); knee.add(foot);
      // long toes
      for (let i = 0; i < 3; i++) {
        const toe = limb(0.05, 0.03, 0.8, darkSkin); toe.rotation.x = -1.3;
        toe.position.set((i - 1) * 0.14, -4.0, 1.05); knee.add(toe);
      }
      return { thigh, knee, side };
    });

    const torso = new THREE.Group(); hip.add(torso); this.torso = torso;
    const spineG = new THREE.CylinderGeometry(0.75, 0.45, 3.5, 8); spineG.translate(0, 1.75, 0);
    const chest = new THREE.Mesh(spineG, skin); chest.scale.z = 0.55; torso.add(chest);
    // ribs
    for (let i = 0; i < 5; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.62 - i * 0.02, 0.05, 4, 10, Math.PI), darkSkin);
      rib.position.set(0, 1.6 + i * 0.35, 0.05); rib.rotation.y = Math.PI / 2; rib.rotation.z = Math.PI / 2; rib.scale.set(1, 1, 0.7);
      rib.rotation.x = 0;
      torso.add(rib);
    }
    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 0.6), darkSkin);
    shoulders.position.y = 3.35; torso.add(shoulders);

    this.arms = [-1, 1].map(side => {
      const sh = new THREE.Group(); sh.position.set(side * 1.15, 3.3, 0); torso.add(sh);
      sh.add(limb(0.2, 0.14, 3.6, skin));
      const elbow = new THREE.Group(); elbow.position.y = -3.6; sh.add(elbow);
      elbow.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), darkSkin));
      elbow.add(limb(0.14, 0.1, 3.4, skin));
      const hand = new THREE.Group(); hand.position.y = -3.4; elbow.add(hand);
      hand.add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.15), darkSkin));
      for (let i = 0; i < 4; i++) {
        const f = limb(0.04, 0.02, 1.1, darkSkin);
        f.position.set((i - 1.5) * 0.09, -0.2, 0); f.rotation.x = 0.15 + i * 0.05; f.rotation.z = (i - 1.5) * 0.06;
        hand.add(f);
      }
      return { sh, elbow, hand, side };
    });

    // neck = utility pole
    const neck = new THREE.Group(); neck.position.y = 3.45; torso.add(neck); this.neck = neck;
    const poleG = new THREE.CylinderGeometry(0.14, 0.2, 3.4, 8); poleG.translate(0, 1.7, 0);
    neck.add(new THREE.Mesh(poleG, rust));
    // flesh wrapping the bottom of the pole
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.35, 1.0, 8), skin); wrap.position.y = 0.4; neck.add(wrap);

    const head = new THREE.Group(); head.position.y = 3.4; neck.add(head); this.head = head;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 0.16), metal); head.add(bar);
    this.mouths = [];
    [-1, 1].forEach(side => {
      const s = new THREE.Group();
      s.position.set(side * 0.75, 0.25, 0);
      s.rotation.y = side * 0.75; // both horns point forward-ish and outward
      const hornG = new THREE.CylinderGeometry(0.95, 0.28, 2.0, 18, 1, true);
      hornG.rotateX(Math.PI / 2); hornG.translate(0, 0, 1.0);
      const horn = new THREE.Mesh(hornG, metal); s.add(horn);
      const innerG = hornG.clone();
      const innerM = new THREE.Mesh(innerG, inside); innerM.scale.set(0.97, 0.97, 1); s.add(innerM);
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 12), rust);
      housing.rotation.x = Math.PI / 2; housing.position.z = -0.3; s.add(housing);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.06, 6, 20), metal); rim.position.z = 2.0; s.add(rim);
      const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.85, 18), new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      mouth.position.z = 0.6; s.add(mouth);
      this.mouths.push(mouth);
      head.add(s);
    });
    this.headGlow = new THREE.PointLight(0xff2a10, 0, 30, 2);
    this.headGlow.position.set(0, 0.3, 2); head.add(this.headGlow);

    if (S.shadows !== 'off') R.traverse(o => { if (o.isMesh) o.castShadow = true; });
  };

  SirenHead.prototype.headWorldPos = function (out) {
    return this.head.getWorldPosition(out || new V3());
  };

  SirenHead.prototype.spawnFar = function () {
    const n = this.world.nodeAt(4, 4);
    this.pos.set(n.x, 0, n.z);
  };

  SirenHead.prototype.setState = function (s) {
    if (this.state === s) return;
    this.state = s;
    this.stateTime = 0;
    this.path = [];
    this.onStateChange && this.onStateChange(s);
  };

  SirenHead.prototype.say = function (kind, dist) {
    const arr = LINES[kind];
    const line = arr[(Math.random() * arr.length) | 0];
    const vol = Math.max(0.15, 1 - dist / 140);
    LO.audio.staticBurst(this.voice, 0.5, 0.25);
    LO.audio.radioGarble(this.voice, 1.6 + line.length * 0.03, 0.35);
    LO.audio.say('siren', line, { volume: vol });
  };

  // ------------------------------------------------------------
  //  AI update. `player` exposes: pos, noiseRadius, hidden, alive
  // ------------------------------------------------------------
  SirenHead.prototype.update = function (dt, player, time) {
    if (this.scripted || !player) { this.animate(dt); return; }
    this.stateTime += dt;
    const W = this.world;
    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    this.distToPlayer = dist;

    // ---------- HEARING ----------
    let heard = false, strength = 0;
    if (!player.hidden && player.noiseRadius > 0 && dist < player.noiseRadius) {
      heard = true;
      strength = 1 - dist / player.noiseRadius;
    }
    this.heardNow = heard;
    if (heard) {
      const err = Math.min(10, dist * 0.12);
      this.lastHeard.set(player.pos.x + (Math.random() - 0.5) * err, 0, player.pos.z + (Math.random() - 0.5) * err);
      this.lastHeardTime = time;
      const rate = (14 + 85 * strength) * (this.state === 'hunt' ? 1.4 : 1);
      this.anger = Math.min(100, this.anger + rate * dt);
    } else {
      const decay = this.state === 'hunt' ? 5 : this.state === 'search' ? 9 : 6;
      if (time - this.lastHeardTime > 1.5) this.anger = Math.max(0, this.anger - decay * dt);
    }
    const sinceHeard = time - this.lastHeardTime;

    // ---------- STATE MACHINE ----------
    switch (this.state) {
      case 'wander':
        this.speed = 2.3;
        if (heard) { this.setState('investigate'); this.say('heard', dist); LO.audio.siren(this.voice, 'short', 0.8); break; }
        if (!this.path.length) {
          // wander to a random node, biased slightly toward the player (he is drawn to the living)
          const nodes = W.nodes;
          let n = nodes[(Math.random() * nodes.length) | 0];
          if (Math.random() < 0.45) {
            const near = W.nearestNode(player.pos);
            const i = Math.max(0, Math.min(4, near.i + ((Math.random() * 3) | 0) - 1));
            const j = Math.max(0, Math.min(4, near.j + ((Math.random() * 3) | 0) - 1));
            n = W.nodeAt(i, j);
          }
          this.path = W.path(this.pos, n).map(n => new V3(n.x, 0, n.z));
        }
        break;
      case 'investigate':
        this.speed = 3.8;
        if (this.anger >= 100) { this.startHunt(dist); break; }
        this.goTo(this.lastHeard, dt);
        if (this.reached && sinceHeard > 2.5) this.setState('search');
        if (sinceHeard > 14) this.setState('search');
        break;
      case 'hunt':
        this.speed = 6.3;
        this.goTo(this.lastHeard, dt);
        if (sinceHeard > 6 && this.anger < 70 && this.stateTime > 4) {
          this.setState('search');
          LO.audio.siren(this.voice, 'short', 0.7);
          this.hunting = false;
        }
        // CATCH — only possible while he is angry AND you are making noise
        if (dist < 5.5 && player.noiseRadius > 0 && !player.hidden && this.stateTime > 0.6) {
          this.onCatch && this.onCatch();
          return;
        }
        break;
      case 'search':
        this.speed = 0;
        this.speedNow = 0;
        this.path = [];
        if (heard) {
          if (this.anger >= 100) this.startHunt(dist);
          else { this.setState('investigate'); if (Math.random() < 0.5) this.say('heard', dist); }
          break;
        }
        if (this.stateTime > 9 + Math.random() * 0.02) { this.setState('wander'); this.hunting = false; }
        break;
    }

    // timers: calls and voice lines
    this.callTimer -= dt;
    this.lineTimer -= dt;
    if (this.state === 'hunt') {
      if (this.callTimer <= 0) { LO.audio.siren(this.voice, 'blare', 1.3); this.callTimer = 3.5 + Math.random() * 2; }
      if (this.lineTimer <= 0 && !heard) { this.say('hunt', dist); this.lineTimer = 7 + Math.random() * 5; }
    } else if (this.state === 'search') {
      if (this.lineTimer <= 0) { this.say('search', dist); this.lineTimer = 9 + Math.random() * 6; }
      if (this.callTimer <= 0) { LO.audio.staticBurst(this.voice, 1.4, 0.3); this.callTimer = 4 + Math.random() * 3; }
    } else if (this.state === 'wander') {
      if (this.callTimer <= 0) { LO.audio.siren(this.voice, 'call', 1); this.callTimer = 22 + Math.random() * 20; }
      if (this.lineTimer <= 0) { this.say('wander', dist); this.lineTimer = 26 + Math.random() * 20; }
    }
    this.creakTimer -= dt;
    if (this.creakTimer <= 0) { LO.audio.creak(this.voice); this.creakTimer = 5 + Math.random() * 8; }

    // ---------- MOVEMENT ----------
    if (this.state === 'wander') this.followPath(dt);
    this.animate(dt);
  };

  SirenHead.prototype.startHunt = function (dist) {
    this.setState('hunt');
    this.hunting = true;
    LO.audio.siren(this.voice, 'blare', 1.5);
    this.callTimer = 3;
    this.lineTimer = 2;
    this.say('hunt', dist);
  };

  // go toward a point: through the street graph when far, straight when close
  SirenHead.prototype.goTo = function (target, dt) {
    const W = this.world;
    const d = Math.hypot(target.x - this.pos.x, target.z - this.pos.z);
    this.reached = d < 3.5;
    if (this.reached) { this.speedNow = 0; this.path = []; return; }
    this.repathTimer -= dt;
    if (d < 24) {
      this.path = [target.clone()];
    } else if (this.repathTimer <= 0 || !this.path.length) {
      this.repathTimer = 1.5;
      const proj = W.projectToStreet(target);
      const p = W.path(this.pos, proj).map(n => new V3(n.x, 0, n.z));
      // drop the first node if it would make us walk backwards
      if (p.length > 1) {
        const a = p[0], b = p[1];
        const along = (b.x - a.x) * (this.pos.x - a.x) + (b.z - a.z) * (this.pos.z - a.z);
        if (along > 0) p.shift();
      }
      p.push(new V3(proj.x, 0, proj.z));
      this.path = p;
    }
    this.followPath(dt);
  };

  SirenHead.prototype.followPath = function (dt) {
    if (!this.path.length) { this.speedNow = 0; return; }
    const t = this.path[0];
    const dx = t.x - this.pos.x, dz = t.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.2) { this.path.shift(); return; }
    const want = Math.atan2(dx, dz);
    let diff = want - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.yaw += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
    const facing = Math.max(0, Math.cos(diff));
    const step = this.speed * dt * (0.25 + 0.75 * facing);
    this.pos.x += Math.sin(this.yaw) * Math.min(step, d);
    this.pos.z += Math.cos(this.yaw) * Math.min(step, d);
    this.speedNow = step / dt;
  };

  // ------------------------------------------------------------
  //  ANIMATION
  // ------------------------------------------------------------
  SirenHead.prototype.animate = function (dt) {
    const v = this.speedNow || 0;
    this.root.rotation.y = this.yaw;
    this.phase += dt * (0.6 + v * 0.38);
    const ph = this.phase;
    const amp = Math.min(1, v / 3.5);
    this.legs.forEach(L => {
      const s = Math.sin(ph + (L.side > 0 ? Math.PI : 0));
      L.thigh.rotation.x = -s * 0.45 * amp;
      L.knee.rotation.x = Math.max(0, Math.cos(ph + (L.side > 0 ? Math.PI : 0))) * 0.8 * amp;
    });
    // footstep sound when a stride lands
    const sgn = Math.sign(Math.sin(ph));
    if (amp > 0.1 && sgn !== this.lastStepSign) {
      this.lastStepSign = sgn;
      const footX = this.pos.x + Math.cos(this.yaw) * sgn * 0.7, footZ = this.pos.z - Math.sin(this.yaw) * sgn * 0.7;
      LO.audio.giantStep({ x: footX, y: 0, z: footZ }, 0.5 + amp * 0.6);
      this.onStep && this.onStep(this.pos);
    }
    this.hip.position.y = 8.4 - Math.abs(Math.cos(ph)) * 0.35 * amp;

    // posture
    const searching = this.state === 'search' || (this.state === 'investigate' && this.reached);
    const targetLean = this.forceLean !== undefined ? this.forceLean : (searching ? 0.55 : this.state === 'hunt' ? 0.3 : 0.12);
    this.lean += (targetLean - this.lean) * Math.min(1, dt * 1.5);
    this.torso.rotation.x = this.lean;
    this.arms.forEach(A => {
      const s = Math.sin(ph + (A.side > 0 ? 0 : Math.PI));
      A.sh.rotation.x = s * 0.3 * amp - this.lean * 0.9 + (this.armRaise || 0);
      A.sh.rotation.z = A.side * (0.06 + (this.state === 'hunt' ? 0.25 : 0));
      A.elbow.rotation.x = -0.25 - Math.max(0, s) * 0.3 * amp - (this.state === 'hunt' ? 0.4 : 0);
    });
    // head: sways; listens by turning toward sounds while searching
    this.headTurnT = (this.headTurnT || 0) + dt;
    const look = searching ? Math.sin(this.headTurnT * 0.7) * 0.9 : Math.sin(this.headTurnT * 0.3) * 0.2;
    this.headTurn += (look - this.headTurn) * Math.min(1, dt * 2);
    this.neck.rotation.y = this.headTurn;
    this.neck.rotation.z = Math.sin(this.headTurnT * 0.9) * 0.05;
    this.neck.rotation.x = -this.lean * 0.4 + (this.neckDip || 0);

    // horn glow by anger
    const g = this.glowOverride !== undefined ? this.glowOverride : this.anger / 100;
    this.glow += (g - this.glow) * Math.min(1, dt * 3);
    const flick = this.state === 'hunt' ? 0.75 + Math.random() * 0.25 : 1;
    this.mouths.forEach(m => { m.material.opacity = this.glow * 0.9 * flick; });
    this.headGlow.intensity = this.glow * 3 * flick;

    // sound emitter follows the head
    if (this.voice) {
      const hp = this.headWorldPos(tmp);
      LO.audio.setPannerPos(this.voice.panner, hp);
    }
  };
  const tmp = new V3();

  SirenHead.prototype.status = function (player) {
    if (player.hidden && this.state !== 'wander') return 'hidden';
    if (this.state === 'hunt') return 'angry';
    if (this.state === 'search') return 'searching';
    if (this.state === 'investigate') return 'heard';
    return 'calm';
  };

  SirenHead.prototype.dispose = function () {
    this.scene.remove(this.root);
    if (this.voice) { try { this.voice.out.disconnect(); } catch (e) {} }
  };
})();
