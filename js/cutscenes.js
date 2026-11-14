// ============================================================
//  THE LOUD ONE — cutscenes: the drive in, and the arrest
// ============================================================
(function () {
  const V3 = THREE.Vector3;
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const clamp01 = t => Math.max(0, Math.min(1, t));
  const lerp = (a, b, t) => a + (b - a) * t;

  // Generic timeline: events fire once at their time, update runs per frame
  function Timeline(duration, events, update, onEnd) {
    this.t = 0; this.duration = duration; this.events = events.map(e => Object.assign({ done: false }, e));
    this.updateFn = update; this.onEnd = onEnd; this.finished = false;
  }
  Timeline.prototype.update = function (dt) {
    if (this.finished) return;
    this.t += dt;
    this.events.forEach(e => { if (!e.done && this.t >= e.at) { e.done = true; e.fn(); } });
    this.updateFn(this.t, dt);
    if (this.t >= this.duration) this.finish();
  };
  Timeline.prototype.finish = function () {
    if (this.finished) return;
    this.finished = true;
    this.onEnd && this.onEnd();
  };

  // ==========================================================
  //  OPENING — driving into Hollow Creek
  // ==========================================================
  function opening(ctx) {
    const { world: W, camera, siren, ui } = ctx;
    const A = LO.audio;
    const carStop = W.playerCarPos;
    const car = W.car(carStop.x, -480, 0, { headlightsOn: true, noCollide: true, paint: W.mat({ color: 0x23384f, roughness: 0.4, metalness: 0.4 }) });
    const lights = [];
    [-0.65, 0.65].forEach(x => {
      const l = new THREE.SpotLight(0xfff0d0, 6, 70, 0.45, 0.5, 1.2);
      l.position.set(x, 0.8, 2.3);
      const tg = new THREE.Object3D(); tg.position.set(x * 2, 0, 20);
      car.add(l); car.add(tg); l.target = tg;
      lights.push(l);
    });
    ctx.cleanup.push(() => { car.parent && car.parent.remove(car); });

    siren.scripted = true;
    siren.pos.set(0, 0, 40);
    siren.yaw = Math.PI; // facing the road
    siren.glowOverride = 0.35;
    siren.speedNow = 0;

    let engine = A.engine();
    ctx.cleanup.push(() => { if (engine) { engine.stop(); engine = null; } });

    // car z as a function of time
    function carZ(t) {
      if (t < 21) return -480 + t * 16;
      const k = ease(clamp01((t - 21) / 8));
      return lerp(-144, carStop.z, k);
    }
    const look = new V3();
    const tl = new Timeline(38, [
      { at: 0.3, fn: () => { A.playMusic('tension', 3); ui.fadeIn(2.5); } },
      { at: 1.5, fn: () => ui.caption('HOLLOW CREEK', 'October 24 · 2:47 AM') },
      { at: 2.5, fn: () => A.say('player', 'Three weeks ago, Hollow Creek had two thousand people living in it. Now it has none.') },
      { at: 6.5, fn: () => ui.caption('') },
      { at: 8.5, fn: () => A.say('player', 'The news called it a gas leak. Everybody just packed up and left in the middle of the night.') },
      { at: 15.5, fn: () => A.say('player', 'But I heard the emergency calls. Those weren\'t gas leaks. Those were sirens.') },
      { at: 18, fn: () => A.siren(siren.voice, 'call', 0.7) },
      { at: 22.5, fn: () => A.say('player', '...Wait. What is that?') },
      { at: 25.5, fn: () => { lights.forEach(l => l.intensity = 0); A.staticBurst(null, 0.6, 0.3); } },
      { at: 25.8, fn: () => { lights.forEach(l => l.intensity = 6); } },
      { at: 26.0, fn: () => { lights.forEach(l => l.intensity = 0); } },
      { at: 26.6, fn: () => { lights.forEach(l => l.intensity = 6); siren.pos.set(W.STREETS[4], 0, W.STREETS[4]); siren.glowOverride = 0; } },
      { at: 27.5, fn: () => A.say('player', 'Gone. Okay. Okay. It\'s just the dark.') },
      { at: 30, fn: () => A.say('player', 'I need photos. Real proof that thing did this. Get enough, and the police will have to send in everything they\'ve got.') },
      { at: 35.5, fn: () => { A.say('player', 'Stay quiet. Whatever happens... stay quiet.'); ui.fadeOut(2); } },
    ], (t, dt) => {
      const z = carZ(t);
      car.position.set(carStop.x, 0, z);
      if (engine) engine.set(t < 29 ? 0.35 : Math.max(0, 0.35 - (t - 29) * 0.15), t < 21 ? 1 : Math.max(0.2, 1 - (t - 21) / 8));
      if (t > 31 && engine) { engine.stop(); engine = null; }
      siren.update(dt, null, 0);

      if (t < 7) {                       // aerial over the forest
        camera.position.set(carStop.x + 30 - t * 2, 38 - t * 1.5, z - 40 + t * 2);
        look.set(carStop.x, 0, z + 30);
      } else if (t < 15) {               // tracking alongside
        const k = (t - 7) / 8;
        camera.position.set(carStop.x - 5.5, 1.2, z + lerp(4, -2, k));
        look.set(carStop.x, 0.9, z + 8);
      } else if (t < 21) {               // passing the welcome sign
        camera.position.set(-14, 1.6, -147);
        look.set(lerp(-8, carStop.x, clamp01((t - 15) / 6)), 1.5, Math.max(-150, z));
        if (t < 18) look.set(-8, 2.4, -150);
      } else if (t < 29) {               // driver's POV toward the town
        camera.position.set(carStop.x - 0.4, 1.25, z + 0.4);
        look.set(carStop.x - 0.2 + Math.sin(t) * 0.1, 3 + (t < 26 ? 2 : 0), z + 60);
        if (t < 26) look.set(0, 9, 40);
      } else {                           // parked, outside the car
        const k = clamp01((t - 29) / 7);
        camera.position.set(carStop.x + 4 + k * 1.5, 1.7, carStop.z - 2 - k * 2);
        look.set(carStop.x + 0.5, 1.2, carStop.z + 6);
      }
      camera.lookAt(look);
      camera.updateMatrixWorld();
    }, () => {
      ctx.onDone && ctx.onDone(car);
    });
    return tl;
  }

  // ==========================================================
  //  ENDING — the heavy response arrives
  // ==========================================================
  function ending(ctx) {
    const { world: W, camera, siren, scene, ui } = ctx;
    const A = LO.audio;
    const group = new THREE.Group(); W.root.add(group);
    ctx.cleanup.push(() => W.root.remove(group));

    // ---- dawn ----
    {
      const c = document.createElement('canvas'); c.width = 2; c.height = 256;
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#1d2638'); gr.addColorStop(0.5, '#6b5a6a'); gr.addColorStop(0.8, '#c98a62'); gr.addColorStop(1, '#e6b07a');
      g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
      const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
      W.skyMat.map = tex; W.skyMat.needsUpdate = true;
      W.stars.visible = false; W.moon.visible = false; W.moonHalo.visible = false;
      scene.fog.color.set(0x6a5a58);
      if (scene.fog.density) scene.fog.density *= 0.6;
      W.hemi.color.set(0xb8a8a8); W.hemi.groundColor.set(0x30282a); W.hemi.intensity *= 2.2;
      W.moonLight.color.set(0xffc49a); W.moonLight.intensity *= 2.4;
      W.moonLight.position.set(120, 40, -160);
    }

    // ---- Siren Head waits in the town centre ----
    siren.scripted = true;
    siren.pos.set(0, 0, 0);
    siren.yaw = Math.PI;
    siren.root.rotation.order = 'YXZ';
    siren.root.rotation.x = 0;
    siren.glowOverride = 0.6;
    siren.forceLean = 0.15;
    siren.speedNow = 0;
    siren.state = 'hunt';

    // ---- convoy ----
    const vehicles = [];
    function addVehicle(mesh, x, stopZ, delay, speed) {
      mesh.position.set(x, 0, -260 - delay * speed);
      group.add(mesh);
      vehicles.push({ mesh, x, stopZ, delay, speed: speed || 18 });
      return mesh;
    }
    const police = [];
    [[-3, -24, 0], [3, -28, 0.6], [-3.5, -36, 1.2], [3.5, -40, 1.8]].forEach(([x, z, d]) => {
      const c = W.car(0, 0, 0, { police: true, lightsOn: true, noCollide: true, parent: group });
      police.push(c);
      addVehicle(c, x, z, d, 20);
    });
    function truck(color, label) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.8, 7), W.mat({ color, roughness: 0.6, metalness: 0.3 }));
      body.position.set(0, 1.9, -0.8); g.add(body);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.2, 2.2), W.mat({ color: 0x1a1a1a }));
      cab.position.set(0, 1.6, 3.6); g.add(cab);
      const wg = new THREE.CylinderGeometry(0.55, 0.55, 0.5, 12);
      [[-1.4, 3], [1.4, 3], [-1.4, -1], [1.4, -1], [-1.4, -3], [1.4, -3]].forEach(([x, z]) => {
        const w = new THREE.Mesh(wg, W.M.tire); w.rotation.z = Math.PI / 2; w.position.set(x, 0.55, z); g.add(w);
      });
      if (label) {
        const c = document.createElement('canvas'); c.width = 256; c.height = 64;
        const x = c.getContext('2d'); x.fillStyle = '#ddd'; x.font = 'bold 44px Arial'; x.textAlign = 'center'; x.fillText(label, 128, 48);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
        m.position.set(1.42, 2.4, -0.8); m.rotation.y = Math.PI / 2; g.add(m);
        const m2 = m.clone(); m2.position.x = -1.42; m2.rotation.y = -Math.PI / 2; g.add(m2);
      }
      const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3), new THREE.MeshBasicMaterial({ color: 0xff8800 }));
      beacon.position.set(0, 2.8, 3.6); g.add(beacon);
      g.userData.beacon = beacon;
      return g;
    }
    const swat1 = addVehicle(truck(0x1d2430, 'S.W.A.T.'), -2.5, -52, 2.6, 16);
    const swat2 = addVehicle(truck(0x1d2430, 'S.W.A.T.'), 2.5, -60, 3.2, 16);
    // crane trucks with booms that fire restraint cables
    const cranes = [];
    [[-4, -18, 3.6], [4, -19, 4.4]].forEach(([x, z, d]) => {
      const t = truck(0xc9a227, 'RESTRAINT');
      const boom = new THREE.Group(); boom.position.set(0, 3.3, -2); t.add(boom);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 11), W.mat({ color: 0xd8b030, roughness: 0.6 }));
      arm.position.z = 5.5; boom.add(arm);
      boom.rotation.x = -0.05;
      const tip = new THREE.Object3D(); tip.position.z = 11; boom.add(tip);
      t.userData.boom = boom; t.userData.tip = tip;
      cranes.push(addVehicle(t, x, z, d, 15));
    });
    void swat1; void swat2;

    // helicopter
    const heli = new THREE.Group();
    {
      const hb = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), W.mat({ color: 0x223322, roughness: 0.5 }));
      hb.scale.set(1, 0.9, 1.6); heli.add(hb);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 5), W.mat({ color: 0x223322 })); tail.position.z = -3.6; heli.add(tail);
      const rotor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.05, 0.3), W.M.dark); rotor.position.y = 1.5; heli.add(rotor);
      heli.userData.rotor = rotor;
      const spot = new THREE.SpotLight(0xffffff, 8, 120, 0.22, 0.4, 1);
      const tg = new THREE.Object3D(); group.add(tg);
      spot.target = tg; heli.add(spot); heli.userData.spotTarget = tg;
      heli.position.set(0, 60, -300);
      group.add(heli);
    }

    // restraint cables — thin cylinders stretched between two points
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    const cables = [];
    function addCable(fromObj, fromLocal, toFn, start, dur) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 5), cableMat);
      m.visible = false; group.add(m);
      cables.push({ m, fromObj, fromLocal, toFn, start, dur });
    }
    const tmpA = new V3(), tmpB = new V3(), up = new V3(0, 1, 0);
    function updateCables(t) {
      cables.forEach(c => {
        const k = clamp01((t - c.start) / c.dur);
        if (k <= 0) { c.m.visible = false; return; }
        c.m.visible = true;
        c.fromObj.localToWorld(tmpA.copy(c.fromLocal));
        c.toFn(tmpB);
        tmpB.lerpVectors(tmpA, tmpB, k);
        const len = tmpA.distanceTo(tmpB);
        c.m.position.copy(tmpA).add(tmpB).multiplyScalar(0.5);
        c.m.scale.set(1, len, 1);
        c.m.quaternion.setFromUnitVectors(up, tmpB.clone().sub(tmpA).normalize());
      });
    }
    const handL = v => siren.arms[0].hand.getWorldPosition(v);
    const handR = v => siren.arms[1].hand.getWorldPosition(v);
    const neck = v => siren.neck.getWorldPosition(v).add(new V3(0, 1.2, 0));
    const hip = v => siren.hip.getWorldPosition(v);
    const tip0 = cranes[0].userData.tip, tip1 = cranes[1].userData.tip;
    addCable(tip0, new V3(), handL, 14, 0.8);
    addCable(tip1, new V3(), handR, 14.6, 0.8);
    addCable(tip0, new V3(), neck, 16.5, 0.9);
    addCable(tip1, new V3(), neck, 17.0, 0.9);
    addCable(police[0], new V3(0, 1, 2), hip, 18, 0.6);
    addCable(police[1], new V3(0, 1, 2), hip, 18.3, 0.6);
    addCable(heli, new V3(0, -1, 0), neck, 20, 1.2);

    let sirens = [], heliSnd = null, fallStart = -1;
    ctx.cleanup.push(() => { sirens.forEach(s => s.stop()); sirens = []; if (heliSnd) heliSnd.stop(); heliSnd = null; });

    const look = new V3();
    const tl = new Timeline(40, [
      { at: 0.1, fn: () => { ui.fadeIn(2.5); ui.caption('6:02 AM', 'Thirty minutes after the photos were sent'); A.playMusic('chase', 2); } },
      { at: 0.5, fn: () => { sirens.push(A.policeSirens({ x: 0, y: 1, z: -200 })); sirens[0].set(0.6); heliSnd = A.helicopter({ x: 0, y: 60, z: -300 }); heliSnd.set(0.5); } },
      { at: 1.5, fn: () => A.say('radio', 'All units, proceed to Main and Fourth. Heavy equipment is cleared to engage.') },
      { at: 5, fn: () => ui.caption('') },
      { at: 7, fn: () => { A.siren(siren.voice, 'blare', 1.6); siren.forceLean = 0.35; siren.armRaise = -0.6; } },
      { at: 8.5, fn: () => A.say('radio', 'Target in sight. My god... it\'s real. It\'s actually real.') },
      { at: 13.5, fn: () => A.say('radio', 'Fire the restraints! Fire, fire, fire!') },
      { at: 14, fn: () => A.chains() },
      { at: 14.6, fn: () => A.chains() },
      { at: 16.5, fn: () => { A.chains(); A.siren(siren.voice, 'blare', 1.8); } },
      { at: 18, fn: () => A.chains() },
      { at: 20, fn: () => { A.chains(); A.say('radio', 'Pull it down! All winches, full power!'); } },
      { at: 22.5, fn: () => { fallStart = tl.t; A.siren(siren.voice, 'die', 1.4); } },
      { at: 25.6, fn: () => { A.boom(1.2); ctx.shake(1.2); siren.glowOverride = 0; } },
      { at: 27, fn: () => { A.playMusic('ending', 3); ui.caption('SUSPECT IN CUSTODY', 'Hollow Creek, 6:12 AM'); } },
      { at: 28, fn: () => A.say('radio', 'Suspect is down and restrained. Hollow Creek is secure. Good work, everyone.') },
      { at: 33, fn: () => A.say('player', 'It\'s over. Hollow Creek can finally be quiet... for the right reasons.') },
      { at: 37.5, fn: () => ui.fadeOut(2.5) },
    ], (t, dt) => {
      // drive vehicles in
      vehicles.forEach(v => {
        if (t < v.delay) return;
        const z = v.mesh.position.z;
        if (z < v.stopZ) {
          const remaining = v.stopZ - z;
          v.mesh.position.z = Math.min(v.stopZ, z + Math.min(v.speed, remaining * 1.2 + 2) * dt);
        }
        v.mesh.position.x = v.x;
      });
      // flashing lights
      const on = Math.floor(t * 6) % 2 === 0;
      police.forEach((c, i) => {
        const r = c.userData.red, b = c.userData.blue;
        if (r) { r.material.color.set((on ^ (i % 2)) ? 0xff2020 : 0x300000); b.material.color.set((on ^ (i % 2)) ? 0x000030 : 0x2050ff); }
      });
      cranes.concat([swat1, swat2]).forEach(v => { if (v.userData.beacon) v.userData.beacon.material.color.set(Math.sin(t * 8) > 0 ? 0xff8800 : 0x331a00); });
      // crane booms rise toward the target
      cranes.forEach(c => { c.userData.boom.rotation.x = -lerp(0.05, 0.55, ease(clamp01((t - 9) / 4))); });
      // helicopter circles
      const ha = t * 0.25;
      const hr = lerp(140, 30, ease(clamp01(t / 14)));
      heli.position.set(Math.sin(ha) * hr, lerp(60, 34, clamp01(t / 14)), -Math.cos(ha) * hr - (t < 14 ? 0 : 0));
      heli.lookAt(0, heli.position.y, 0);
      heli.userData.rotor.rotation.y += dt * 30;
      heli.userData.spotTarget.position.copy(siren.pos).setY(6);
      if (heliSnd) heliSnd.move(heli.position);
      if (sirens[0]) sirens[0].move(police[0].position);

      // struggle
      if (t > 14 && fallStart < 0) {
        siren.speedNow = 2.5 + Math.sin(t * 3) * 2;
        siren.yaw = Math.PI + Math.sin(t * 1.7) * 0.25;
        siren.forceLean = 0.25 + Math.sin(t * 2.3) * 0.2;
        siren.armRaise = -0.8 + Math.sin(t * 2.9) * 0.4;
      }
      // fall forward
      if (fallStart >= 0) {
        const k = clamp01((t - fallStart) / 3.1);
        siren.root.rotation.x = Math.pow(k, 2.2) * (Math.PI / 2 - 0.06);
        siren.speedNow = 0;
        siren.armRaise = lerp(-0.8, -2.2, k);
        siren.forceLean = 0.1;
      }
      siren.update(dt, null, t);
      updateCables(t);

      // ---- cameras ----
      if (t < 7) {               // high wide shot of the convoy
        camera.position.set(lerp(-40, -25, t / 7), lerp(45, 35, t / 7), lerp(-120, -90, t / 7));
        look.set(0, 2, lerp(-140, -40, t / 7));
      } else if (t < 13.5) {     // low angle on the monster, police lights in front
        const k = (t - 7) / 6.5;
        camera.position.set(lerp(-8, -6, k), 1.2, lerp(-30, -26, k));
        look.set(0, lerp(8, 13, k), 0);
      } else if (t < 22.5) {     // restraint cables firing
        const k = (t - 13.5) / 9;
        camera.position.set(lerp(-26, -30, k), lerp(6, 9, k), lerp(-26, -14, k));
        look.set(0, 8, -6);
      } else if (t < 27) {       // the fall
        camera.position.set(18, 3, -30);
        look.set(0, lerp(10, 1, clamp01((t - 22.5) / 3.2)), -8);
      } else {                   // aftermath, slow crane up
        const k = clamp01((t - 27) / 13);
        camera.position.set(lerp(14, 22, k), lerp(4, 28, k), lerp(-34, -48, k));
        look.set(0, 1, -8);
      }
      ctx.applyShake(look);
      camera.lookAt(look);
      camera.updateMatrixWorld();
    }, () => { ctx.onDone && ctx.onDone(); });
    return tl;
  }

  LO.Cutscenes = { opening, ending, Timeline };
})();
