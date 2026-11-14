// ============================================================
//  THE LOUD ONE — game flow, menus, HUD and main loop
// ============================================================
(function () {
  const S = LO.settings;
  const A = LO.audio;
  const $ = id => document.getElementById(id);
  const EVIDENCE_NEEDED = 4;

  let renderer, scene, camera, world, siren, player;
  let state = 'gate';          // gate | title | opening | play | paused | dying | dead | ending | credits
  let cutscene = null, cutCtx = null;
  let menuReturn = 'title';    // which screen an options panel goes back to
  let worldDirty = false;
  let pendingCapture = null;
  let shakeAmt = 0;
  let clock = new THREE.Clock();
  let gameTime = 0;
  let evidenceCount = 0;
  let endingQueued = false;
  let parkedCar = null;
  let skipHeld = 0;
  // ---- hint system: unlocks after 3 minutes without finding evidence ----
  const HINT_DELAY = 180, HINT_SHOW = 15;
  let lastEvidenceTime = 0, hintUntil = 0, hintTarget = null;
  function hintReady() { return state === 'play' && !endingQueued && gameTime - lastEvidenceTime >= HINT_DELAY; }
  function useHint() {
    if (!hintReady()) {
      if (state === 'play') showHint('Keep looking. A hint unlocks after 3 minutes without finding evidence.');
      return;
    }
    // closest piece of evidence that hasn't been photographed yet
    let best = null, bd = Infinity;
    world.evidence.forEach(e => {
      if (e.found) return;
      const d = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
      if (d < bd) { bd = d; best = e; }
    });
    if (!best) return;
    hintTarget = best;
    hintUntil = gameTime + HINT_SHOW;
    lastEvidenceTime = gameTime;           // next hint needs another 3 minutes
    A.pickup();
  }
  LO.useHint = useHint;
  function updateHintUI() {
    const btn = $('hint-btn');
    const ready = hintReady();
    btn.classList.toggle('ready', ready);
    if (ready) btn.textContent = LO.isTouch ? 'HINT' : 'HINT [H]';
    else {
      const left = Math.max(0, Math.ceil(HINT_DELAY - (gameTime - lastEvidenceTime)));
      btn.textContent = `HINT ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    }
    const tb = $('t-hint'); if (tb) { tb.textContent = btn.textContent; tb.classList.toggle('on', ready); }
    const box = $('hint-arrow');
    if (hintTarget && gameTime < hintUntil && !hintTarget.found) {
      box.style.display = 'block';
      const dx = hintTarget.pos.x - player.pos.x, dz = hintTarget.pos.z - player.pos.z;
      // angle relative to where the player is facing (camera looks down -z at yaw 0)
      let a = Math.atan2(-dx, -dz) - player.yaw;
      $('hint-needle').style.transform = `rotate(${-a}rad)`;
      $('hint-label').textContent = `${hintTarget.name} — ${Math.round(Math.hypot(dx, dz))} m`;
    } else box.style.display = 'none';
  }
  const seenHints = {};

  // ============================================================
  //  RENDERER / SCENE
  // ============================================================
  function createRenderer() {
    if (renderer) {
      renderer.dispose();
      renderer.domElement.remove();
    }
    renderer = new THREE.WebGLRenderer({ antialias: !!S.antialias, powerPreference: 'high-performance' });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = S.shadows !== 'off';
    renderer.shadowMap.type = S.shadows === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    $('game-root').appendChild(renderer.domElement);
    renderer.domElement.addEventListener('click', () => {
      if (state === 'play' && !document.pointerLockElement) lockPointer();
    });
    applyDisplay();
  }

  function applyDisplay() {
    if (!renderer) return;
    const pr = Math.min(2.5, Math.min(window.devicePixelRatio || 1, 2) * S.renderScale);
    renderer.setPixelRatio(pr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    document.body.classList.toggle('pixelated', S.renderScale < 0.75);
    renderer.toneMappingExposure = 1.15 * S.brightness;
    if (camera) { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); }
    if (scene && scene.fog && state !== 'ending') scene.fog.density = { near: 0.034, medium: 0.022, far: 0.014 }[S.viewDistance] || 0.022;
    $('grain').style.display = S.filmGrain ? 'block' : 'none';
    $('vignette').style.display = S.vignette ? 'block' : 'none';
    $('fps').style.display = S.showFps ? 'block' : 'none';
  }

  function buildWorld() {
    if (siren) siren.dispose();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070a);
    scene.fog = new THREE.FogExp2(0x020305, 0.022);
    if (!camera) camera = new THREE.PerspectiveCamera(S.fov, window.innerWidth / window.innerHeight, 0.1, 1100);
    camera.children.slice().forEach(c => camera.remove(c));
    world = LO.World.build(scene);
    siren = new LO.SirenHead(scene, world);
    player = new LO.Player(camera, world, scene);
    player.hint = showHint;
    player.onPhoto = onPhoto;
    player.onHide = () => hintOnce('hide', 'Hidden. You make no sound in here — but don\'t stay long. Something else lives in here.');
    player.onDamage = (amount, cause) => {
      A.hurt();
      const d = $('damage');
      d.style.transition = 'none'; d.style.opacity = 0.9;
      setTimeout(() => { d.style.transition = 'opacity 0.8s'; d.style.opacity = 0; }, 60);
      if (cause === 'silent') A.silentHit();
    };
    player.onDeath = cause => dieBy(cause);
    player.onRockLand = pos => {
      if (state !== 'play') return;
      if (siren.hearNoise(pos, 45)) hintOnce('rockworked', 'He heard the rock. Move while he checks it out.', 5000);
    };
    siren.onEcho = d => {
      if (state !== 'play' || A.still) return;
      const r = $('echo-ring');
      r.classList.remove('go'); void r.offsetWidth; r.classList.add('go');
      hintOnce('echo', 'He pinged the town. He knows roughly where you are now, even if you\'re silent — keep moving.', 7000);
    };
    player.onKicked = () => {
      A.tenantScream();
      const f = $('tenant-face');
      f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
      showHint('THE TENANT threw you out! That was loud — he may have heard it. Never hide too long.', 6000);
    };
    siren.onCatch = onCaught;
    siren.onStep = p => {
      if (state !== 'play') return;
      const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
      if (d < 70) player.shake = Math.max(player.shake, (1 - d / 70) * 0.25);
    };
    siren.onStateChange = s => {
      if (state !== 'play') return;
      if (s === 'investigate') hintOnce('heard', 'He heard you. Stop moving, switch off your light, or hide.');
      if (s === 'hunt') {
        A.say('player', ['Oh no. Oh no no no.', 'He\'s coming. Quiet. Be quiet.', 'Don\'t move. Don\'t breathe.'][(Math.random() * 3) | 0]);
        hintOnce('angry', 'HE\'S ANGRY. If he hears you now, he will get you. Go completely silent or hide!');
      }
      if (s === 'search') hintOnce('search', 'He lost you. Stay silent until he wanders off.');
    };
    parkedCar = null;
    worldDirty = false;
    applyDisplay();
    if (renderer) renderer.compile(scene, camera);
  }

  // ============================================================
  //  UI helpers
  // ============================================================
  function show(id, on) { $(id).classList.toggle('active', on !== false); }
  function hideAllScreens() { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); }

  const fade = $('fade');
  const ui = {
    fadeIn(sec) { fade.style.transition = `opacity ${sec || 1.2}s ease`; fade.style.opacity = 0; },
    fadeOut(sec) { fade.style.transition = `opacity ${sec || 1.2}s ease`; fade.style.opacity = 1; },
    caption(title, sub) {
      const el = $('cut-caption');
      if (!title) { el.style.opacity = 0; return; }
      el.innerHTML = '';
      el.appendChild(document.createTextNode(title));
      if (sub) { const s = document.createElement('small'); s.textContent = sub; el.appendChild(s); }
      el.style.opacity = 1;
    },
  };

  let hintTimer = null;
  function showHint(msg, ms) {
    const el = $('hint');
    el.textContent = msg;
    el.style.opacity = 1;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { el.style.opacity = 0; }, ms || 4500);
  }
  function hintOnce(key, msg, ms) { if (seenHints[key]) return; seenHints[key] = true; showHint(msg, ms || 6000); }

  // ---------- options panels ----------
  function renderOptions(listId, defs) {
    const list = $(listId);
    list.innerHTML = '';
    defs.forEach(def => {
      if (def.section) {
        const s = document.createElement('div'); s.className = 'opt-section'; s.textContent = def.section;
        list.appendChild(s); return;
      }
      const row = document.createElement('div'); row.className = 'opt-row';
      const lab = document.createElement('div');
      const l1 = document.createElement('div'); l1.className = 'opt-label'; l1.textContent = def.label; lab.appendChild(l1);
      if (def.desc) { const d = document.createElement('div'); d.className = 'opt-desc'; d.textContent = def.desc; lab.appendChild(d); }
      row.appendChild(lab);
      const ctrl = document.createElement('div'); ctrl.className = 'opt-ctrl';
      if (def.type === 'choice') {
        const prev = document.createElement('button'); prev.className = 'arrow'; prev.textContent = '<';
        const val = document.createElement('span'); val.className = 'val';
        const next = document.createElement('button'); next.className = 'arrow'; next.textContent = '>';
        const idx = () => { const i = def.values.indexOf(S[def.key]); return i < 0 ? def.values.length - 1 : i; };
        const refresh = () => { val.textContent = def.labels[idx()]; };
        const step = d => {
          let i = idx() + d;
          let values = def.values;
          if (def.key === 'quality') values = values.filter(v => v !== 'custom');
          i = (idx() + d + values.length) % values.length;
          if (def.key === 'quality' && S.quality === 'custom') i = d > 0 ? 0 : values.length - 1;
          changeSetting(def.key, values[i]);
          renderOptions(listId, defs);
        };
        prev.onclick = () => step(-1); next.onclick = () => step(1);
        refresh();
        ctrl.append(prev, val, next);
      } else {
        const r = document.createElement('input'); r.type = 'range';
        r.min = def.min; r.max = def.max; r.step = def.step; r.value = S[def.key];
        const val = document.createElement('span'); val.className = 'val'; val.textContent = def.fmt(S[def.key]);
        r.oninput = () => { const v = parseFloat(r.value); val.textContent = def.fmt(v); changeSetting(def.key, v); };
        ctrl.append(r, val);
      }
      row.appendChild(ctrl);
      list.appendChild(row);
    });
    if (listId === 'graphics-list' && worldDirty && state !== 'title') {
      const n = document.createElement('div'); n.className = 'opt-desc'; n.style.marginTop = '12px';
      n.textContent = 'Some changes (textures, lighting, shadows) apply the next time you start a game.';
      list.appendChild(n);
    }
  }

  const REBUILD_KEYS = ['textures', 'lighting', 'shadows', 'quality'];
  function changeSetting(key, value) {
    const before = { antialias: S.antialias, shadows: S.shadows, textures: S.textures, lighting: S.lighting };
    LO.Settings.set(key, value);
    const needRebuild = before.shadows !== S.shadows || before.textures !== S.textures || before.lighting !== S.lighting;
    if (before.antialias !== S.antialias || before.shadows !== S.shadows) createRenderer();
    if (needRebuild || REBUILD_KEYS.includes(key) && needRebuild) {
      if (state === 'title') { buildWorld(); setupTitleScene(); }
      else worldDirty = true;
    }
    applyDisplay();
  }

  function openPanel(id, from) {
    menuReturn = from;
    hideAllScreens();
    if (id === 'graphics') renderOptions('graphics-list', LO.Settings.GRAPHICS_OPTIONS);
    if (id === 'audio') renderOptions('audio-list', LO.Settings.AUDIO_OPTIONS);
    show(id);
  }
  function closePanel() {
    hideAllScreens();
    if (menuReturn === 'pause') { show('pause'); show('hud'); }
    else show('title');
  }

  // ============================================================
  //  TITLE SCREEN
  // ============================================================
  let titleT = 0;
  function setupTitleScene() {
    siren.scripted = true;
    siren.pos.set(world.STREETS[3], 0, world.STREETS[3] + 8);
    siren.yaw = Math.PI * 1.15;
    siren.glowOverride = 0.45;
    siren.forceLean = 0.2;
    siren.neckDip = 0; siren.armRaise = 0;
    siren.root.rotation.x = 0;
    world.hemi.intensity = 0.3; world.moonLight.intensity = 0.35;
  }
  function updateTitle(dt) {
    titleT += dt;
    world.updateWind(dt, 0.8, camera.position, titleT);
    siren.speedNow = 0.6 + Math.sin(titleT * 0.3) * 0.6;
    siren.update(dt, null, titleT);
    const a = titleT * 0.04;
    const tx = world.STREETS[3], tz = world.STREETS[3] + 8;
    camera.position.set(tx + Math.sin(a + 2.6) * 34, 2.2 + Math.sin(titleT * 0.2) * 0.6, tz + Math.cos(a + 2.6) * 34);
    camera.lookAt(tx, 10.5, tz);
    world.update(dt, titleT);
  }

  function goTitle() {
    if (cutscene) endCutscene();
    A.stopVoices();
    hideAllScreens();
    if (document.pointerLockElement) document.exitPointerLock();
    player.enabled = false;
    player.flashOn = false;
    A.setFlashlightBuzz(false); A.setBreathing(0); A.setHeartbeat(0); A.setTenant(0); A.setSilentOne(0);
    A.setStillness(false); document.body.classList.remove('still');
    $('silent-one').style.opacity = 0;
    if (worldDirty || state === 'ending' || state === 'credits' || state === 'dead') buildWorld();
    setupTitleScene();
    state = 'title';
    show('title');
    $('credits-roll').classList.remove('rolling');
    ui.fadeIn(1.5);
    A.playMusic('title', 2);
    A.setWind(0.12);
    camera.fov = S.fov; camera.updateProjectionMatrix();
  }

  // ============================================================
  //  GAME FLOW
  // ============================================================
  function resetRun() {
    if (worldDirty) buildWorld();
    world.evidence.forEach(e => { e.found = false; });
    world.pickups.forEach(p => { p.taken = false; p.mesh.visible = true; });
    evidenceCount = 0; endingQueued = false;
    siren.scripted = false;
    siren.root.rotation.x = 0;
    siren.glowOverride = undefined; siren.forceLean = undefined; siren.armRaise = 0; siren.neckDip = 0;
    siren.anger = 0; siren.catchDisabled = false; siren.state = 'wander'; siren.path = []; siren.lastHeardTime = -999;
    siren.spawnFar();
    player.reset(world.spawn, Math.PI);
    gameTime = 0;
    lastEvidenceTime = 0; hintUntil = 0;
    updateEvidenceUI();
  }

  function startGame(skipIntro) {
    A.init();
    A.stopVoices();
    hideAllScreens();
    state = 'loading';
    resetRun();
    ui.fadeOut(0.8);
    setTimeout(() => {
      if (skipIntro) { beginPlay(); return; }
      state = 'opening';
      show('cutscene');
      document.querySelector('.skip-hint').style.display = ''; $('skip-bar').style.display = '';
      cutCtx = makeCutCtx(() => { endCutscene(); beginPlay(); });
      cutscene = LO.Cutscenes.opening(cutCtx);
    }, 900);
  }

  function makeCutCtx(onDone) {
    return {
      world, camera, siren, scene, ui, cleanup: [], onDone,
      shake(a) { shakeAmt = Math.max(shakeAmt, a); },
      applyShake(v) { if (shakeAmt > 0) { v.x += (Math.random() - 0.5) * shakeAmt; v.y += (Math.random() - 0.5) * shakeAmt; } },
    };
  }
  function endCutscene() {
    if (cutCtx) cutCtx.cleanup.forEach(f => { try { f(); } catch (e) { console.warn(e); } });
    cutscene = null; cutCtx = null;
    skipHeld = 0; $('skip-bar').firstChild.style.width = '0';
    ui.caption('');
  }

  function beginPlay() {
    A.stopVoices();
    hideAllScreens();
    if (!parkedCar) {
      const c = world.playerCarPos;
      parkedCar = world.car(c.x, c.z, 0, { paint: world.mat({ color: 0x23384f, roughness: 0.4, metalness: 0.4 }) });
    }
    siren.scripted = false;
    siren.glowOverride = undefined;
    siren.spawnFar();
    siren.state = 'wander'; siren.path = [];
    player.reset(world.spawn, Math.PI);
    world.hemi.intensity = world.baseLight.hemi; world.moonLight.intensity = world.baseLight.moon;
    lastEvidenceTime = gameTime; hintUntil = 0;
    player.enabled = true;
    state = 'play';
    show('hud');
    ui.fadeIn(1.5);
    A.playMusic('explore', 3);
    windStrength = 1;
    A.setWind(0.26, 0.5);
    lockPointer();
    setTimeout(() => {
      if (state !== 'play') return;
      showHint(`Photograph ${EVIDENCE_NEEDED} pieces of evidence. Raise your camera with ${LO.isTouch ? 'the CAMERA button' : 'RIGHT MOUSE or Q'}.`, 7000);
      A.say('player', 'Okay. Evidence. Footprints, wreckage, anything that proves that thing was here.');
    }, 1800);
    setTimeout(() => state === 'play' && hintOnce('flash', (LO.isTouch ? 'The LIGHT button' : 'F') + ' toggles the flashlight. He can hear it buzz when he\'s close.', 6000), 10000);
    setTimeout(() => state === 'play' && hintOnce('meter', 'The white marker on the NOISE bar is how close he is. If your noise passes it, he hears you.', 8000), 18000);
  }

  function lockPointer() {
    if (LO.isTouch) return;
    const el = renderer.domElement;
    try {
      const p = el.requestPointerLock && el.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* user gesture needed */ }
  }

  LO.pauseGame = () => pause();
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && state === 'play') pause();
  });

  function pause() {
    if (state !== 'play') return;
    state = 'paused';
    player.enabled = false;
    show('pause');
    if (window.speechSynthesis) try { speechSynthesis.pause(); } catch (e) {}
    A.setFlashlightBuzz(false); A.setBreathing(0); A.setTenant(0); A.setSilentOne(0);
  }
  function resume() {
    hideAllScreens();
    show('hud');
    state = 'play';
    player.enabled = true;
    clock.getDelta();
    if (window.speechSynthesis) try { speechSynthesis.resume(); } catch (e) {}
    lockPointer();
  }

  // ---------- evidence ----------
  const EVIDENCE_LINES = [
    'Got it. They can\'t call that a gas leak.',
    'That\'s two. Keep going. Quietly.',
    'Three. One more and I can call it in.',
    'That should do it.',
    'More proof. Good.',
    'Every single one of these is impossible.',
  ];
  function onPhoto(ev) {
    $('flash').classList.remove('go'); void $('flash').offsetWidth; $('flash').classList.add('go');
    pendingCapture = { ev };
    if (!ev) return;
    ev.found = true;
    evidenceCount++;
    lastEvidenceTime = gameTime; hintUntil = 0;
    A.evidenceSting();
    updateEvidenceUI();
    A.say('player', EVIDENCE_LINES[Math.min(EVIDENCE_LINES.length - 1, evidenceCount - 1)]);
    if (evidenceCount >= EVIDENCE_NEEDED && !endingQueued) queueEnding();
  }

  function updateEvidenceUI() {
    $('ev-count').textContent = evidenceCount;
    $('ev-need').textContent = EVIDENCE_NEEDED;
    const list = $('ev-list');
    list.innerHTML = '';
    world.evidence.filter(e => e.found).forEach(e => {
      const d = document.createElement('div'); d.className = 'got'; d.textContent = e.name; list.appendChild(d);
    });
    const left = Math.max(0, EVIDENCE_NEEDED - evidenceCount);
    if (left) { const d = document.createElement('div'); d.textContent = `${left} more needed`; list.appendChild(d); }
  }

  function queueEnding() {
    endingQueued = true;
    // he calms down so the call can be made in peace
    siren.anger = 0;
    siren.setState('wander');
    siren.catchDisabled = true;
    player.noSilent = true;
    setTimeout(async () => {
      await A.say('player', 'That\'s enough. Sending everything to the county sheriff now.');
      await A.say('radio', 'Hollow Creek caller, we... received your photos. Stay where you are. All units, heavy response to Hollow Creek. This is not a drill.');
      await A.say('player', 'They\'re coming. They\'re actually coming.');
      if (state === 'play' || state === 'paused') startEnding();
    }, 2500);
  }

  function startEnding() {
    state = 'ending';
    player.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    A.setFlashlightBuzz(false); A.setBreathing(0); A.setHeartbeat(0);
    player.flashOn = false; player.flash.intensity = 0;
    hideAllScreens();
    ui.fadeOut(1.5);
    setTimeout(() => {
      show('cutscene');
      document.querySelector('.skip-hint').style.display = 'none'; $('skip-bar').style.display = 'none';
      camera.fov = 60; camera.updateProjectionMatrix();
      cutCtx = makeCutCtx(() => { endCutscene(); rollCredits(); });
      cutscene = LO.Cutscenes.ending(cutCtx);
      worldDirty = true;
    }, 1600);
  }

  function rollCredits() {
    state = 'credits';
    hideAllScreens();
    show('credits');
    const roll = $('credits-roll');
    roll.classList.remove('rolling'); void roll.offsetWidth; roll.classList.add('rolling');
    ui.fadeIn(1);
    A.playMusic('ending', 2);
  }

  // ---------- death ----------
  let dieT = 0;
  let dieCause = 'siren';
  const DEATHS = {
    siren: { title: 'YOU WERE TOO LOUD', tips: [
      'He only hunts what he can hear. Stand still and switch off your light.',
      'Sprinting is the loudest thing you can do. Crouch-walk near him.',
      'Hide in dumpsters and lockers — inside, you make no sound at all.',
      'Watch the marker on the noise bar: it shows how close he is.',
      'Out of breath? Crouch to hold your breath.',
    ] },
    silent: { title: 'YOU WERE TOO QUIET', tips: [
      'The Silent One comes for anyone who stays silent for 30 seconds. Make a small sound — click your flashlight or take a step.',
      'Hiding is silent too. Don\'t wait out Siren Head forever.',
    ] },
    tenant: { title: 'YOU OVERSTAYED YOUR WELCOME', tips: [
      'The Tenant takes 30 HP every time it throws you out. Leave before the red bar fills.',
      'Your health never comes back. Every hit counts.',
    ] },
  };
  // death by damage (the Silent One / the Tenant)
  function dieBy(cause) {
    if (state !== 'play') return;
    dieCause = cause;
    state = 'dying';
    dieT = 0;
    player.enabled = false;
    player.flashOn = false;
    A.stopVoices();
    A.setTenant(0);
    if (document.pointerLockElement) document.exitPointerLock();
    A.playMusic(null, 0.5);
    if (cause === 'silent') { A.silentHit(); A.setSilentOne(1); } else A.tenantScream();
    $('damage').style.transition = 'opacity 0.3s'; $('damage').style.opacity = 1;
  }
  function onCaught() {
    if (state !== 'play' || siren.catchDisabled) return;
    dieCause = 'siren';
    state = 'dying';
    dieT = 0;
    player.enabled = false;
    player.flashOn = false;
    A.stopVoices();
    if (document.pointerLockElement) document.exitPointerLock();
    siren.scripted = true;
    siren.forceLean = 0.95;
    siren.glowOverride = 1;
    siren.speedNow = 0;
    // turn to face the player
    siren.yaw = Math.atan2(player.pos.x - siren.pos.x, player.pos.z - siren.pos.z);
    A.deathScream();
    A.playMusic(null, 0.5);
    $('damage').style.opacity = 1;
  }
  function updateDying(dt) {
    dieT += dt;
    if (dieCause !== 'siren') {
      // collapse to the ground
      const k = Math.min(1, dieT / 1.4);
      camera.position.y = Math.max(0.25, camera.position.y - dt * 1.4);
      camera.rotation.z = k * 1.2;
      camera.rotation.x = player.pitch * (1 - k) + 0.2 * k;
      if (dieT > 2.6) finishDeath();
      return;
    }
    siren.neckDip = Math.min(1, dieT) * -0.5;
    siren.update(dt, null, dieT);
    const hp = siren.headWorldPos();
    const cam = camera;
    cam.position.set(player.pos.x + (Math.random() - 0.5) * 0.15, 1.4 + Math.min(1, dieT) * 0.6, player.pos.z + (Math.random() - 0.5) * 0.15);
    const m = new THREE.Matrix4().lookAt(cam.position, hp, new THREE.Vector3(0, 1, 0));
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    cam.quaternion.slerp(q, Math.min(1, dt * 6));
    if (dieT > 2.6 && state === 'dying') finishDeath();
  }
  function finishDeath() {
    {
      if (state !== 'dying') return;
      state = 'dead';
      A.setSilentOne(0);
      A.setStillness(false); document.body.classList.remove('still');
      $('silent-one').style.opacity = 0;
      ui.fadeOut(0.3);
      setTimeout(() => {
        hideAllScreens();
        show('death');
        $('damage').style.opacity = 0;
        const D = DEATHS[dieCause] || DEATHS.siren;
        $('death-title').textContent = D.title;
        const tips = D.tips;
        $('death-tip').textContent = tips[(Math.random() * tips.length) | 0];
      }, 400);
    }
  }

  // ---------- wind: dies completely after 15 seconds of silence ----------
  const WIND_STOP = 15;
  let windStrength = 1, gustT = 0;
  function updateWindState(dt) {
    const still = player.silentTime >= WIND_STOP;
    const target = still ? 0 : 1;
    // it stops quickly and eerily, and comes back gradually
    windStrength += (target - windStrength) * Math.min(1, dt * (still ? 2.5 : 0.6));
    if (windStrength < 0.01) windStrength = 0;
    gustT += dt;
    const gust = Math.max(0, Math.min(1, 0.45 + Math.sin(gustT * 0.31) * 0.3 + Math.sin(gustT * 0.83 + 1.7) * 0.25));
    A.setWind(0.26 * windStrength, gust, still ? 0.25 : 1.2);
    // when the wind dies, everything else dies with it: sounds, voices, text
    A.setStillness(still);
    document.body.classList.toggle('still', still);
    world.updateWind(dt, windStrength * (0.6 + gust * 0.6), camera.position, gameTime);
  }

  // ============================================================
  //  HUD
  // ============================================================
  const STATUS_TEXT = {
    calm: 'HE CAN\'T HEAR YOU', heard: 'HE HEARD SOMETHING', searching: 'HE\'S SEARCHING — STAY SILENT',
    angry: 'HE\'S ANGRY — GO SILENT!', hidden: 'HIDDEN — YOU MAKE NO SOUND',
  };
  let lastStatus = '';
  function updateHUD() {
    const noisePct = Math.min(100, player.noiseRadius / 50 * 100);
    $('noise-fill').style.width = noisePct + '%';
    const d = siren.distToPlayer || 999;
    $('bars').querySelector('.bar-mark').style.left = Math.min(99, d / 50 * 100) + '%';
    $('stamina-fill').style.width = player.stamina + '%';
    $('stamina-fill').parentNode.classList.toggle('tired', player.exhausted);
    $('battery-fill').style.width = player.battery + '%';
    $('battery-fill').parentNode.classList.toggle('low', player.battery < 15);
    const st = siren.status(player);
    if (st !== lastStatus) {
      lastStatus = st;
      $('sh-status').className = st;
      $('sh-text').textContent = STATUS_TEXT[st];
    }
    $('prompt').innerHTML = player.prompt;
    $('crosshair').style.display = player.cameraUp ? 'none' : 'block';
    show('hide-overlay', !!player.hidden);
    // the Tenant grows restless the longer you hide
    const tf = Math.min(1, player.hideTime / LO.TENANT_LIMIT);
    if (player.hidden) {
      const eyes = Math.max(0, (tf - 0.35) / 0.65);
      $('tenant-eyes').style.opacity = eyes;
      $('tenant-eyes').style.transform = `translate(-50%, -50%) scale(${0.6 + eyes * 0.9})`;
      $('tenant-bar').firstChild.style.width = (tf * 100) + '%';
      $('hide-text').textContent = tf < 0.4 ? 'HIDING — press E to leave' : tf < 0.75 ? 'You are not alone in here...' : 'GET OUT. GET OUT. GET OUT.';
      $('hide-overlay').classList.toggle('restless', tf >= 0.75);
      A.setTenant(Math.max(0, (tf - 0.3) / 0.7));
    } else A.setTenant(0);

    // rocks
    const rs = $('rocks').children;
    for (let i = 0; i < rs.length; i++) rs[i].classList.toggle('have', i < player.rocks);

    // health
    $('health-fill').style.width = player.health + '%';
    $('health-num').textContent = Math.ceil(player.health);
    $('health-fill').parentNode.classList.toggle('low', player.health <= 30);

    // the Silent One: warnings from 20s of silence, attack from 30s
    const st2 = player.silentTime, W2 = LO.SILENT.WARN, AT = LO.SILENT.ATTACK;
    const so = $('silent-one');
    if (st2 >= W2) {
      const k = Math.min(1, (st2 - W2) / (AT - W2));
      const attacking = st2 >= AT;
      so.style.opacity = attacking ? 1 : 0.25 + k * 0.6;
      so.classList.toggle('attack', attacking);
      so.style.setProperty('--k', k);
      $('so-text').textContent = attacking ? 'MAKE A SOUND' : k < 0.5 ? 'it\'s too quiet...' : 'something is standing very close to you...';
      A.setSilentOne(attacking ? 1 : 0.2 + k * 0.6);
      hintOnce('silent', 'Something is drawn to complete silence. Make a small noise — click your flashlight or take a step.', 7000);
    } else {
      so.style.opacity = 0; so.classList.remove('attack');
      A.setSilentOne(0);
    }
    show('viewfinder', player.zoom > 0.5);
    if (player.zoom > 0.5) {
      const vf = player.vfTarget;
      $('viewfinder').classList.toggle('locked', !!(vf && vf.ok));
      $('vf-info').textContent = !vf ? 'NO SUBJECT' : vf.ok ? 'EVIDENCE: ' + vf.ev.name.toUpperCase() : 'MOVE CLOSER';
      $('vf-film').textContent = `EVIDENCE ${evidenceCount}/${EVIDENCE_NEEDED}`;
    }
  }

  function capturePhoto() {
    if (!pendingCapture) return;
    const { ev } = pendingCapture;
    pendingCapture = null;
    let url = '';
    try { url = renderer.domElement.toDataURL('image/jpeg', 0.75); } catch (e) { /* ignore */ }
    $('photo-img').src = url;
    $('photo-caption').textContent = ev ? ev.name : 'Nothing useful...';
    const pop = $('photo-pop');
    pop.classList.add('show');
    clearTimeout(pop._t);
    pop._t = setTimeout(() => pop.classList.remove('show'), ev ? 3200 : 1800);
    if (!ev) hintOnce('nothing', 'Nothing useful in that shot. Get closer and centre the evidence — the viewfinder turns green.');
  }

  // ============================================================
  //  MAIN LOOP
  // ============================================================
  let fpsAcc = 0, fpsFrames = 0;
  const fwd = new THREE.Vector3(), upv = new THREE.Vector3();
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    shakeAmt = Math.max(0, shakeAmt - dt * 1.5);

    if (state === 'title' || state === 'gate') {
      updateTitle(dt);
    } else if (state === 'play') {
      gameTime += dt;
      player.update(dt, gameTime);
      siren.update(dt, player, gameTime);
      world.update(dt, gameTime);
      updateHUD();
      updateHintUI();
      updateWindState(dt);
      // music & heartbeat follow the danger
      const d = siren.distToPlayer || 999;
      const near = Math.max(0, 1 - d / 70);
      if (siren.state === 'hunt') A.playMusic('chase', 1);
      else A.playMusic('explore', 4);
      A.intensity = Math.min(1, near * 0.7 + (siren.state === 'investigate' ? 0.4 : siren.state === 'search' ? 0.5 : 0));
      A.setHeartbeat(siren.state === 'wander' ? near * 0.5 : Math.max(0.35, near));
    } else if (state === 'dying') {
      updateDying(dt);
      world.update(dt, gameTime);
    } else if (cutscene) {
      // hold space to skip
      if ((player.keys.Space || LO.touchHold) && state === 'opening') {
        skipHeld += dt;
        $('skip-bar').firstChild.style.width = Math.min(100, skipHeld / 1.2 * 100) + '%';
        if (skipHeld > 1.2) { A.stopVoices(); cutscene.finish(); }
      } else if (skipHeld) { skipHeld = 0; $('skip-bar').firstChild.style.width = '0'; }
      if (cutscene) cutscene.update(dt);
      if (world && world.updateWind) world.updateWind(dt, 0.5, camera.position, gameTime);
      if (world) world.update(dt, gameTime += dt);
    }

    if (world && world.sky) { world.sky.position.copy(camera.position); world.stars.position.copy(camera.position); }
    if (state !== 'credits' && state !== 'dead') renderer.render(scene, camera);
    if (pendingCapture) capturePhoto();

    // 3D audio listener follows the camera
    if (A.ready) {
      camera.getWorldDirection(fwd);
      upv.set(0, 1, 0).applyQuaternion(camera.quaternion);
      A.setListener(camera.position, fwd, upv);
    }
    if (S.showFps) {
      fpsAcc += dt; fpsFrames++;
      if (fpsAcc > 0.5) { $('fps').textContent = Math.round(fpsFrames / fpsAcc) + ' FPS'; fpsAcc = 0; fpsFrames = 0; }
    }
  }

  // ============================================================
  //  BOOT
  // ============================================================
  function wireMenus() {
    document.body.addEventListener('click', e => {
      const b = e.target.closest('button[data-action]');
      if (!b) return;
      A.click(true);
      const act = b.dataset.action;
      const inPause = state === 'paused';
      switch (act) {
        case 'play': startGame(false); break;
        case 'graphics': openPanel('graphics', inPause ? 'pause' : 'title'); break;
        case 'audio': openPanel('audio', inPause ? 'pause' : 'title'); break;
        case 'howto': openPanel('howto', 'title'); break;
        case 'back': closePanel(); break;
        case 'resume': resume(); break;
        case 'retry': startGame(true); break;
        case 'quit': ui.fadeOut(0.6); setTimeout(goTitle, 650); break;
      }
    });
    window.addEventListener('keydown', e => {
      if (e.code === 'KeyH' && state === 'play') useHint();
      if (e.code === 'Escape') {
        if (state === 'paused' && $('pause').classList.contains('active')) resume();
        else if (document.querySelector('.panel-screen.active')) closePanel();
      }
    });
    $('hint-btn').addEventListener('click', e => { e.stopPropagation(); useHint(); });
    window.addEventListener('resize', applyDisplay);
    LO.events.addEventListener('settings', () => applyDisplay());
  }

  function boot() {
    // film grain image
    const grain = LO.tex.canvas('grainOverlay');
    $('grain').style.backgroundImage = `url(${grain.toDataURL()})`;
    createRenderer();
    buildWorld();
    setupTitleScene();
    wireMenus();
    ui.fadeIn(0.1);
    clock.start();
    loop();

    const gate = $('gate');
    const leaveGate = () => {
      if (state !== 'gate') return;
      A.init();
      ui.fadeOut(0.01);
      gate.classList.remove('active');
      state = 'title';
      show('title');
      setTimeout(() => ui.fadeIn(2.5), 50);
      A.playMusic('title', 3);
      A.setWind(0.12);
      window.removeEventListener('keydown', leaveGate);
    };
    gate.addEventListener('click', leaveGate);
    window.addEventListener('keydown', leaveGate);
    // expose for debugging
    LO.debug = { setGameTime(t) { gameTime = t; }, get cutscene() { return cutscene; }, get state() { return state; }, get world() { return world; }, get siren() { return siren; }, get player() { return player; }, startGame, startEnding, beginPlay };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
