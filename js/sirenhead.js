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
    this.echoTimer = 50 + Math.random() * 15;
    this.echoCount = 0;
    this.voice = LO.audio.createMonsterVoice();
    this.spawnFar();
  }
  LO.SirenHead = SirenHead;

  SirenHead.prototype.buildModel = function () {
    const S = LO.settings;
    const simple = S.lighting === 'simple';
    const Mat = o => simple ? new THREE.MeshLambertMaterial(o) : new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.82 }, o));
    const skinTex = LO.tex.get('skin');
    const skin = Mat({ map: skinTex, color: 0xa39282 });
    const darkSkin = Mat({ map: skinTex, color: 0x5a4c42 });
    const bone = Mat({ map: skinTex, color: 0xc2b29c });
    const metal = Mat({ color: 0x55554e, metalness: 0.65, roughness: 0.45 });
    const rust = Mat({ map: LO.tex.get('metal', { color: '#5a4636' }), metalness: 0.5, roughness: 0.65 });
    const porcelain = Mat({ color: 0xd8d4c8, roughness: 0.3 });
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
    const inside = new THREE.MeshBasicMaterial({ color: 0x050303, side: THREE.BackSide });
    this.mats = { skin, darkSkin, metal };
    const V2 = THREE.Vector2;

    // a tapered, slightly muscled limb from a radius profile [[r, t], ...] (t: 0 = top, 1 = bottom)
    function lathe(len, prof, m, seg) {
      const pts = prof.map(([r, t]) => new V2(r, -t * len));
      return new THREE.Mesh(new THREE.LatheGeometry(pts, seg || 10), m);
    }
    const knob = (r, m) => new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m);
    const R = this.root;

    // ---------------- hips & legs ----------------
    const hip = new THREE.Group(); hip.position.y = 9.0; R.add(hip); this.hip = hip;
    const pelvis = lathe(0.9, [[0.05, 0], [0.62, 0.15], [0.7, 0.5], [0.45, 0.85], [0.05, 1]], darkSkin, 12);
    pelvis.position.y = 0.45; pelvis.scale.z = 0.55; hip.add(pelvis);
    this.legs = [-1, 1].map(side => {
      const thigh = new THREE.Group(); thigh.position.set(side * 0.5, 0, 0); hip.add(thigh);
      thigh.add(knob(0.3, darkSkin));
      thigh.add(lathe(4.7, [[0.05, 0], [0.32, 0.05], [0.36, 0.25], [0.24, 0.7], [0.19, 0.95], [0.05, 1]], skin));
      const knee = new THREE.Group(); knee.position.y = -4.7; thigh.add(knee);
      const kc = knob(0.27, bone); kc.scale.set(1, 1.2, 1.15); kc.position.z = 0.05; knee.add(kc);
      knee.add(lathe(4.4, [[0.05, 0], [0.22, 0.05], [0.25, 0.2], [0.14, 0.75], [0.11, 0.95], [0.05, 1]], skin));
      const ankle = new THREE.Group(); ankle.position.y = -4.4; knee.add(ankle);
      ankle.add(knob(0.16, darkSkin));
      const foot = lathe(1.5, [[0.05, 0], [0.2, 0.15], [0.17, 0.7], [0.06, 1]], darkSkin, 8);
      foot.rotation.x = -Math.PI / 2 + 0.05; foot.position.set(0, -0.12, -0.2); ankle.add(foot);
      for (let i = 0; i < 4; i++) {                                  // long, gripping toes
        const toe = lathe(0.75, [[0.05, 0], [0.06, 0.2], [0.035, 0.85], [0.005, 1]], darkSkin, 6);
        toe.rotation.x = -Math.PI / 2 + 0.35; toe.position.set((i - 1.5) * 0.11, -0.15, 1.2);
        ankle.add(toe);
      }
      return { thigh, knee, ankle, side };
    });

    // ---------------- torso ----------------
    const torso = new THREE.Group(); torso.position.y = 0.6; hip.add(torso); this.torso = torso;
    const waist = lathe(1.3, [[0.3, 0], [0.26, 0.5], [0.4, 1]], skin, 10);
    waist.rotation.x = Math.PI; waist.position.y = 1.3; waist.scale.z = 0.7; torso.add(waist);
    const chest = new THREE.Group(); chest.position.y = 1.25; torso.add(chest); this.chest = chest;
    const cage = lathe(2.4, [[0.42, 1], [0.72, 0.75], [0.8, 0.45], [0.72, 0.15], [0.45, 0]], skin, 14);
    cage.position.y = 2.4; cage.scale.z = 0.62; chest.add(cage);
    for (let i = 0; i < 6; i++) {                                    // ribs pushing through the skin
      const rr = 0.66 + Math.sin(i / 5 * Math.PI) * 0.12;
      const rib = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.045, 5, 16, Math.PI * 1.1), bone);
      rib.rotation.set(Math.PI / 2, 0, -Math.PI * 0.05); rib.scale.set(1, 0.64, 1);
      rib.position.set(0, 0.45 + i * 0.3, 0.03); chest.add(rib);
    }
    const sternum = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.08), bone); sternum.position.set(0, 1.4, 0.47); chest.add(sternum);
    for (let i = 0; i < 9; i++) {                                    // spine knuckles down the back
      const v = knob(0.09, bone); v.position.set(0, -1.1 + i * 0.42, -0.48 + Math.abs(i - 4) * 0.02); chest.add(v);
    }
    const clav = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.3, 6), bone);
    clav.rotation.z = Math.PI / 2; clav.position.set(0, 2.38, 0.18); chest.add(clav);
    [-1, 1].forEach(side => { const sb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.08), darkSkin); sb.position.set(side * 0.4, 1.8, -0.5); sb.rotation.y = side * 0.4; chest.add(sb); });

    // ---------------- arms: long enough to drag past the knees ----------------
    this.arms = [-1, 1].map(side => {
      const sh = new THREE.Group(); sh.position.set(side * 1.12, 2.3, 0); chest.add(sh);
      sh.add(knob(0.22, darkSkin));
      sh.add(lathe(3.9, [[0.05, 0], [0.22, 0.05], [0.24, 0.25], [0.15, 0.8], [0.12, 0.95], [0.05, 1]], skin));
      const elbow = new THREE.Group(); elbow.position.y = -3.9; sh.add(elbow);
      elbow.add(knob(0.15, bone));
      elbow.add(lathe(3.7, [[0.05, 0], [0.15, 0.05], [0.17, 0.3], [0.09, 0.92], [0.05, 1]], skin));
      const wrist = new THREE.Group(); wrist.position.y = -3.7; elbow.add(wrist);
      const hand = new THREE.Group(); wrist.add(hand);
      const palm = lathe(0.6, [[0.06, 0], [0.2, 0.2], [0.22, 0.7], [0.16, 1]], darkSkin, 8); palm.scale.z = 0.45; hand.add(palm);
      const fingers = [];
      for (let i = 0; i < 4; i++) {                                  // two-jointed, overlong fingers
        const f1 = new THREE.Group(); f1.position.set((i - 1.5) * 0.11, -0.58, 0); hand.add(f1);
        f1.add(lathe(0.75, [[0.045, 0], [0.04, 0.9], [0.035, 1]], darkSkin, 6));
        const f2 = new THREE.Group(); f2.position.y = -0.75; f1.add(f2);
        f2.add(lathe(0.7, [[0.035, 0], [0.025, 0.85], [0.004, 1]], darkSkin, 6));
        f1.rotation.z = (i - 1.5) * 0.06;
        fingers.push({ f1, f2 });
      }
      const th = new THREE.Group(); th.position.set(side * -0.17, -0.25, 0.08); th.rotation.z = side * -0.6; hand.add(th);
      th.add(lathe(0.55, [[0.04, 0], [0.03, 0.9], [0.005, 1]], darkSkin, 6));
      return { sh, elbow, wrist, hand, fingers, side };
    });

    // ---------------- neck: a utility pole growing out of the body ----------------
    const neck = new THREE.Group(); neck.position.y = 2.45; chest.add(neck); this.neck = neck;
    const stump = lathe(1.2, [[0.2, 1], [0.32, 0.6], [0.5, 0.15], [0.62, 0]], skin, 10);
    stump.rotation.x = Math.PI; stump.position.y = 1.2; neck.add(stump);
    for (let i = 0; i < 5; i++) {                                    // sinew wrapping up the pole
      const sinew = lathe(1.4, [[0.06, 0], [0.05, 0.7], [0.01, 1]], darkSkin, 5);
      const a = i / 5 * Math.PI * 2;
      sinew.position.set(Math.cos(a) * 0.2, 1.9, Math.sin(a) * 0.2); sinew.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
      neck.add(sinew);
    }
    const poleG = new THREE.CylinderGeometry(0.13, 0.18, 3.8, 10); poleG.translate(0, 1.9 + 0.7, 0);
    neck.add(new THREE.Mesh(poleG, rust));
    const cross = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.12), rust); cross.position.y = 3.6; neck.add(cross);
    [-0.6, -0.2, 0.2, 0.6].forEach(x => { const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.2, 8), porcelain); ins.position.set(x, 3.76, 0); neck.add(ins); });

    // ---------------- head: two civil-defence sirens ----------------
    const head = new THREE.Group(); head.position.y = 4.45; neck.add(head); this.head = head;
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.3), metal); head.add(bracket);
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 10), metal); mount.position.y = -0.25; head.add(mount);
    this.mouths = [];
    const hornProfile = [[0.26, 0], [0.3, 0.25], [0.42, 0.55], [0.62, 0.78], [0.95, 0.94], [1.08, 1]];
    [-1, 1].forEach(side => {
      const s = new THREE.Group();
      s.position.set(side * 0.68, 0.32, 0.05);
      s.rotation.y = side * 0.72;
      const pts = hornProfile.map(([r, t]) => new V2(r, t * 2.2));
      const hornG = new THREE.LatheGeometry(pts, 20); hornG.rotateX(Math.PI / 2);
      s.add(new THREE.Mesh(hornG, metal));
      const innerM = new THREE.Mesh(hornG.clone(), inside); innerM.scale.set(0.96, 0.96, 1); s.add(innerM);
      [0.5, 1.1, 1.7].forEach((z, i) => {                            // stiffening rings
        const rr = [0.33, 0.47, 0.78][i];
        const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.035, 5, 18), rust); ring.position.z = z; s.add(ring);
      });
      const lip = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.07, 6, 24), metal); lip.position.z = 2.2; s.add(lip);
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.8, 14), rust);
      housing.rotation.x = Math.PI / 2; housing.position.z = -0.3; s.add(housing);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), rust);
      cap.rotation.x = -Math.PI / 2; cap.position.z = -0.7; s.add(cap);
      const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.95, 20), new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      mouth.position.z = 0.7; s.add(mouth);
      this.mouths.push(mouth);
      head.add(s);
    });
    // sagging cables from the cross-arm
    [[-0.6, -1.2], [0.6, 1.3], [-0.2, -0.5]].forEach(([x0, x1]) => {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x0, 3.8, 0), new THREE.Vector3((x0 + x1) / 2, 2.4, 0.3), new THREE.Vector3(x1, 1.3, 0.2)]);
      neck.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.025, 4), wireMat));
    });
    this.headGlow = new THREE.PointLight(0xff2a10, 0, 30, 2);
    this.headGlow.position.set(0, 0.3, 2.2); head.add(this.headGlow);

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
    this.lastTime = time;
    const W = this.world;
    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    this.distToPlayer = dist;

    // ---------- HEARING ----------
    // he hears a little further than the raw noise radius
    const HEAR = 1.3;
    let heard = false, strength = 0;
    const radius = player.noiseRadius * HEAR;
    if (!player.hidden && radius > 0 && dist < radius) {
      heard = true;
      strength = 1 - dist / radius;
    }
    this.heardNow = heard;
    if (heard) {
      const err = Math.min(6, dist * 0.07);
      // while hunting he leads his target, aiming where you are running to
      const lead = this.state === 'hunt' ? 1.2 : 0.4;
      this.lastHeard.set(
        player.pos.x + player.vel.x * lead + (Math.random() - 0.5) * err, 0,
        player.pos.z + player.vel.z * lead + (Math.random() - 0.5) * err);
      this.lastHeardTime = time;
      this.stalkTimer = 0;
      const rate = (26 + 115 * strength) * (this.state === 'hunt' ? 1.5 : this.state === 'search' ? 1.3 : 1);
      this.anger = Math.min(100, this.anger + rate * dt);
    } else {
      const decay = this.state === 'hunt' ? 3 : this.state === 'search' ? 5 : 5;
      if (time - this.lastHeardTime > 2.5) this.anger = Math.max(0, this.anger - decay * dt);
    }
    const sinceHeard = time - this.lastHeardTime;
    this.stalkTimer = (this.stalkTimer || 0) + dt;

    // ---------- ECHOLOCATION ----------
    // roughly once a minute he pings the town. It finds you even if you are
    // silent or hidden, and every ping narrows down where you are.
    this.echoTimer -= dt;
    if (this.echoTimer <= 0 && this.state !== 'hunt') {
      this.echoTimer = 52 + Math.random() * 16;
      this.echoCount++;
      LO.audio.echoPing(this.voice);
      const err = Math.max(6, Math.min(45, dist * 0.45) * Math.pow(0.8, this.echoCount - 1));
      const a = Math.random() * Math.PI * 2, r = Math.random() * err;
      this.lastHeard.set(player.pos.x + Math.cos(a) * r, 0, player.pos.z + Math.sin(a) * r);
      this.lastHeardTime = time;
      this.echoApproach = true;
      this.setState('investigate');
      this.onEcho && this.onEcho(dist);
    }
    if (heard) this.echoApproach = false;

    // ---------- STATE MACHINE ----------
    switch (this.state) {
      case 'wander':
        this.speed = 3.1;
        if (heard) { this.setState('investigate'); this.say('heard', dist); LO.audio.siren(this.voice, 'short', 0.8); break; }
        // he "senses" the living: every so often he heads straight for your area
        if (this.stalkTimer > 40) {
          this.stalkTimer = 0;
          const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 18;
          const p = W.projectToStreet({ x: player.pos.x + Math.cos(a) * r, z: player.pos.z + Math.sin(a) * r });
          this.path = W.path(this.pos, p).map(n => new V3(n.x, 0, n.z));
          this.path.push(new V3(p.x, 0, p.z));
          break;
        }
        if (!this.path.length) {
          const nodes = W.nodes;
          let n = nodes[(Math.random() * nodes.length) | 0];
          if (Math.random() < 0.7) {
            const near = W.nearestNode(player.pos);
            const i = Math.max(0, Math.min(4, near.i + ((Math.random() * 3) | 0) - 1));
            const j = Math.max(0, Math.min(4, near.j + ((Math.random() * 3) | 0) - 1));
            n = W.nodeAt(i, j);
          }
          this.path = W.path(this.pos, n).map(n => new V3(n.x, 0, n.z));
        }
        break;
      case 'investigate':
        // an echo only gives him a rough idea: he creeps closer slowly
        this.speed = this.echoApproach ? 2.6 : 5.0;
        if (this.anger >= 100) { this.startHunt(dist); break; }
        this.goTo(this.lastHeard, dt);
        if (this.reached && sinceHeard > 2.5) this.setState('search');
        if (sinceHeard > 18) this.setState('search');
        break;
      case 'hunt':
        this.speed = 7.4; // faster than you can sprint
        this.goTo(this.lastHeard, dt);
        if (sinceHeard > 9 && this.anger < 60 && this.stateTime > 6) {
          this.setState('search');
          LO.audio.siren(this.voice, 'short', 0.7);
          this.hunting = false;
        }
        // CATCH — only possible while he is angry AND you are making noise
        if (dist < 7 && player.noiseRadius > 0 && !player.hidden && this.stateTime > 0.6) {
          this.onCatch && this.onCatch();
          return;
        }
        break;
      case 'search':
        // sweeps the area around the last sound instead of standing still
        this.speed = 2.6;
        if (heard) {
          if (this.anger >= 100) this.startHunt(dist);
          else { this.setState('investigate'); if (Math.random() < 0.5) this.say('heard', dist); }
          break;
        }
        this.searchPause = (this.searchPause || 0) - dt;
        if (!this.path.length && this.searchPause <= 0) {
          const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 14;
          const p = W.projectToStreet({ x: this.lastHeard.x + Math.cos(a) * r, z: this.lastHeard.z + Math.sin(a) * r });
          this.path = [new V3(p.x, 0, p.z)];
          this.searchPause = 2 + Math.random() * 2;
        }
        if (this.path.length) this.followPath(dt); else this.speedNow = 0;
        if (this.stateTime > 18) { this.setState('wander'); this.hunting = false; }
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

  // a noise that is not the player (a thrown rock) — he goes to check it out
  SirenHead.prototype.hearNoise = function (pos, radius) {
    if (this.scripted) return false;
    const d = Math.hypot(pos.x - this.pos.x, pos.z - this.pos.z);
    if (d > radius * 1.3) return false;
    this.lastHeard.set(pos.x, 0, pos.z);
    this.lastHeardTime = this.lastTime || 0;
    this.echoApproach = false;
    this.path = [];
    if (this.state === 'hunt') return true;           // keeps hunting — but toward the rock
    this.anger = Math.min(90, this.anger + 15);
    this.setState('investigate');
    if (Math.random() < 0.6) this.say('heard', d);
    LO.audio.siren(this.voice, 'short', 0.8);
    return true;
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
    this.animT = (this.animT || 0) + dt;
    const T = this.animT;
    this.phase += dt * (0.5 + v * 0.34);
    const ph = this.phase;
    const amp = Math.min(1, v / 3.5);
    const hunt = this.state === 'hunt' ? 1 : 0;
    this.huntK = (this.huntK || 0) + (hunt - (this.huntK || 0)) * Math.min(1, dt * 2);
    const H = this.huntK;

    // ---- legs: long, heavy strides; knees fold during the swing, feet stay flat-ish
    this.legs.forEach(L => {
      const p = ph + (L.side > 0 ? Math.PI : 0);
      L.thigh.rotation.x = -Math.sin(p) * 0.55 * amp - 0.06;
      L.knee.rotation.x = 0.1 + (0.15 + Math.max(0, -Math.cos(p)) * 0.95) * amp;
      L.ankle.rotation.x = -(L.thigh.rotation.x + L.knee.rotation.x) * 0.75;
      L.thigh.rotation.z = L.side * 0.04;
    });
    // footstep when a stride lands
    const sgn = Math.sign(Math.sin(ph));
    if (amp > 0.1 && sgn !== this.lastStepSign) {
      this.lastStepSign = sgn;
      const footX = this.pos.x + Math.cos(this.yaw) * sgn * 0.6, footZ = this.pos.z - Math.sin(this.yaw) * sgn * 0.6;
      LO.audio.giantStep({ x: footX, y: 0, z: footZ }, 0.5 + amp * 0.6);
      this.onStep && this.onStep(this.pos);
    }
    // ---- hips: drop on each step and sway side to side
    this.hip.position.y = 9.0 - Math.abs(Math.cos(ph)) * 0.42 * amp;
    this.hip.rotation.z = Math.sin(ph) * 0.06 * amp;
    this.hip.rotation.y = Math.sin(ph) * 0.1 * amp;

    // ---- posture
    const searching = this.state === 'search' || (this.state === 'investigate' && this.reached);
    const targetLean = this.forceLean !== undefined ? this.forceLean : (searching ? 0.5 : 0.14 + H * 0.22);
    this.lean += (targetLean - this.lean) * Math.min(1, dt * 1.5);
    this.torso.rotation.x = this.lean;
    this.torso.rotation.y = -Math.sin(ph) * 0.13 * amp;            // shoulders counter-swing the hips
    this.torso.rotation.z = -Math.sin(ph) * 0.04 * amp;
    const breathe = Math.sin(T * 1.2) * 0.025;
    this.chest.scale.set(1 + breathe, 1 + breathe * 0.4, 1 + breathe);

    // ---- arms: dangle and swing with a lagging elbow; reach forward when hunting
    this.arms.forEach(A => {
      const p = ph + (A.side > 0 ? 0 : Math.PI);
      A.sh.rotation.x = Math.sin(p) * 0.34 * amp - this.lean * 0.85 + (this.armRaise || 0) - H * 0.35;
      A.sh.rotation.z = A.side * (0.07 + H * 0.18) + Math.sin(T * 0.7 + A.side) * 0.015;
      A.elbow.rotation.x = -(0.25 + Math.max(0, Math.sin(p - 0.7)) * 0.4 * amp) - H * 0.45;
      A.wrist.rotation.x = Math.sin(p - 1.3) * 0.25 * amp - 0.1;
      const curl = 0.25 + H * 0.55 + Math.max(0, Math.sin(T * 5 + A.side * 2)) * 0.06;
      A.fingers.forEach((f, i) => { f.f1.rotation.x = curl + i * 0.03; f.f2.rotation.x = curl * 1.3; });
    });

    // ---- head: delayed bob, listening turns, and the odd twitch
    this.headTurnT = (this.headTurnT || 0) + dt;
    const look = searching ? Math.sin(this.headTurnT * 0.7) * 0.9 : Math.sin(this.headTurnT * 0.3) * 0.2;
    this.headTurn += (look - this.headTurn) * Math.min(1, dt * 2);
    this.twitchT = (this.twitchT || 3) - dt;
    if (this.twitchT <= 0) { this.twitch = (Math.random() - 0.5) * 0.5; this.twitchT = 2 + Math.random() * 6; }
    this.twitch = (this.twitch || 0) * Math.exp(-dt * 6);
    this.neck.rotation.y = this.headTurn + this.twitch;
    this.neck.rotation.z = Math.sin(this.headTurnT * 0.9) * 0.05 + this.twitch * 0.4;
    this.neck.rotation.x = -this.lean * 0.45 + (this.neckDip || 0) + Math.sin(ph * 2 - 0.8) * 0.04 * amp;
    this.head.rotation.z = Math.sin(T * 0.5) * 0.03;

    // ---- horn glow by anger
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
