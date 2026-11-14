// ============================================================
//  THE LOUD ONE — death screen
//  A dark room: an old CRT television plays a tape showing how to
//  survive whatever killed you, and a notebook beside it opens on
//  a pencil sketch of the entity and four handwritten tips.
// ============================================================
(function () {
  const HAND = '"Caveat", "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';

  // 1 appearance · 2 what it does / where it lurks · 3 core mechanic · 4 how to avoid it
  const ENTRIES = {
    siren: { name: 'SIREN HEAD', label: 'THE LOUD ONE', tips: [
      'Tall humanoid with a siren as a head',
      'Uses echolocation to find you',
      'Attracted to loud sounds',
      'Stay absolutely silent when it spots you',
    ] },
    tenant: { name: 'THE TENANT', label: 'PHENOMENON-225', tips: [
      'Appears as 2 glowing eyes',
      'Lurks in hiding spots',
      'Gets enraged if you hide too long',
      "Don't overstay your welcome",
    ] },
    silent: { name: 'THE SILENT ONE', label: 'PHENOMENON-249', tips: [
      'Tall slender humanoid',
      'Loves absolute silence',
      'Gives visual indicators before attacking',
      "Don't go completely silent for too long",
    ] },
    moth: { name: 'THE MOTHS', label: 'PHENOMENON-250', tips: [
      'Pale faceless figures with ragged wings',
      'Stand still in dark corners, only seen in flashlight',
      'Shriek if your light rests on them too long',
      'Keep your beam moving, never stare',
    ] },
    exposure: { name: 'THE EXPOSURE', label: 'PHENOMENON-237', tips: [
      'A blurred figure only seen through a lens',
      "Lurks inside your camera's viewfinder",
      'Creeps closer the longer your camera is up',
      'Lower your camera, use your flashlight to see',
    ] },
  };
  LO.DEATH_ENTRIES = ENTRIES;

  // ---------------- pencil sketching helpers ----------------
  function pencil(g, pts, passes, jitter, closed) {
    for (let p = 0; p < (passes || 2); p++) {
      g.beginPath();
      pts.forEach(([x, y], i) => {
        const jx = x + (Math.random() - 0.5) * (jitter || 3), jy = y + (Math.random() - 0.5) * (jitter || 3);
        if (i) g.lineTo(jx, jy); else g.moveTo(jx, jy);
      });
      if (closed) g.closePath();
      g.stroke();
    }
  }
  function ellipse(g, cx, cy, rx, ry, passes) {
    const pts = [];
    for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    pencil(g, pts, passes || 2, 2.5);
  }
  function hatch(g, x0, y0, x1, y1, n, ang) {
    for (let i = 0; i < n; i++) {
      const x = x0 + Math.random() * (x1 - x0), y = y0 + Math.random() * (y1 - y0);
      pencil(g, [[x, y], [x + Math.cos(ang) * 14, y + Math.sin(ang) * 14]], 1, 1.5);
    }
  }

  const SKETCH = {
    siren(g, w, h) {
      const cx = w / 2;
      pencil(g, [[cx, h * 0.22], [cx, h * 0.4]], 3);                                // pole neck
      // two horns
      pencil(g, [[cx - 6, h * 0.2], [cx - 70, h * 0.12], [cx - 70, h * 0.27], [cx - 6, h * 0.23]], 3, 3, true);
      pencil(g, [[cx + 6, h * 0.2], [cx + 70, h * 0.12], [cx + 70, h * 0.27], [cx + 6, h * 0.23]], 3, 3, true);
      ellipse(g, cx - 70, h * 0.195, 10, 38); ellipse(g, cx + 70, h * 0.195, 10, 38);
      // body
      pencil(g, [[cx - 34, h * 0.4], [cx + 34, h * 0.4], [cx + 18, h * 0.58], [cx - 18, h * 0.58]], 3, 3, true);
      for (let i = 0; i < 4; i++) pencil(g, [[cx - 26, h * (0.43 + i * 0.035)], [cx + 26, h * (0.43 + i * 0.035)]], 1, 2);
      // long arms to the knees and legs
      pencil(g, [[cx - 34, h * 0.41], [cx - 52, h * 0.62], [cx - 56, h * 0.8]], 3);
      pencil(g, [[cx + 34, h * 0.41], [cx + 52, h * 0.62], [cx + 56, h * 0.8]], 3);
      pencil(g, [[cx - 14, h * 0.58], [cx - 22, h * 0.76], [cx - 20, h * 0.95]], 3);
      pencil(g, [[cx + 14, h * 0.58], [cx + 22, h * 0.76], [cx + 20, h * 0.95]], 3);
      // sound lines
      for (let i = 0; i < 3; i++) { pencil(g, [[cx - 92 - i * 12, h * 0.15], [cx - 98 - i * 12, h * 0.2], [cx - 92 - i * 12, h * 0.25]], 1, 1.5); }
    },
    tenant(g, w, h) {
      // a locker with slats and two eyes inside
      pencil(g, [[w * 0.3, h * 0.12], [w * 0.7, h * 0.12], [w * 0.7, h * 0.92], [w * 0.3, h * 0.92]], 3, 3, true);
      for (let i = 0; i < 9; i++) pencil(g, [[w * 0.36, h * (0.2 + i * 0.07)], [w * 0.64, h * (0.2 + i * 0.07)]], 1, 2);
      hatch(g, w * 0.32, h * 0.14, w * 0.68, h * 0.9, 120, 0.9);
      g.save(); g.fillStyle = '#f4f0e0';
      [[0.43, 0.42], [0.57, 0.42]].forEach(([x, y]) => { g.beginPath(); g.ellipse(w * x, h * y, 16, 8, 0, 0, 7); g.fill(); });
      g.restore();
      ellipse(g, w * 0.43, h * 0.42, 17, 9, 3); ellipse(g, w * 0.57, h * 0.42, 17, 9, 3);
    },
    silent(g, w, h) {
      const cx = w / 2;
      ellipse(g, cx, h * 0.14, 16, 24, 3);                                       // faceless head
      pencil(g, [[cx, h * 0.22], [cx, h * 0.27]], 2);
      pencil(g, [[cx - 22, h * 0.27], [cx + 22, h * 0.27], [cx + 14, h * 0.58], [cx - 14, h * 0.58]], 3, 3, true);
      pencil(g, [[cx - 22, h * 0.28], [cx - 34, h * 0.55], [cx - 38, h * 0.76]], 3);
      pencil(g, [[cx + 22, h * 0.28], [cx + 34, h * 0.55], [cx + 38, h * 0.76]], 3);
      pencil(g, [[cx - 9, h * 0.58], [cx - 13, h * 0.95]], 3); pencil(g, [[cx + 9, h * 0.58], [cx + 13, h * 0.95]], 3);
      // "shh" — no sound lines, a crossed-out speaker
      g.save(); g.font = `28px ${HAND}`; g.fillStyle = '#333'; g.fillText('shh...', w * 0.08, h * 0.2); g.restore();
    },
    moth(g, w, h) {
      const cx = w / 2;
      // wings behind
      pencil(g, [[cx, h * 0.3], [cx - 90, h * 0.18], [cx - 110, h * 0.42], [cx - 60, h * 0.62], [cx, h * 0.45]], 2, 4, true);
      pencil(g, [[cx, h * 0.3], [cx + 90, h * 0.18], [cx + 110, h * 0.42], [cx + 60, h * 0.62], [cx, h * 0.45]], 2, 4, true);
      hatch(g, cx - 100, h * 0.22, cx - 20, h * 0.55, 50, 2.2);
      hatch(g, cx + 20, h * 0.22, cx + 100, h * 0.55, 50, 0.9);
      ellipse(g, cx, h * 0.17, 14, 22, 3);
      pencil(g, [[cx - 16, h * 0.26], [cx + 16, h * 0.26], [cx + 10, h * 0.55], [cx - 10, h * 0.55]], 3, 3, true);
      pencil(g, [[cx - 7, h * 0.55], [cx - 9, h * 0.93]], 3); pencil(g, [[cx + 7, h * 0.55], [cx + 9, h * 0.93]], 3);
      // flashlight beam pointing at it
      g.save(); g.setLineDash([6, 6]);
      pencil(g, [[w * 0.02, h * 0.95], [cx - 30, h * 0.3]], 1); pencil(g, [[w * 0.02, h * 0.95], [cx + 30, h * 0.5]], 1);
      g.restore();
    },
    exposure(g, w, h) {
      // a viewfinder with a blurred figure inside
      const c = (x, y, dx, dy) => pencil(g, [[x + dx * 40, y], [x, y], [x, y + dy * 40]], 3);
      c(w * 0.12, h * 0.1, 1, 1); c(w * 0.88, h * 0.1, -1, 1); c(w * 0.12, h * 0.9, 1, -1); c(w * 0.88, h * 0.9, -1, -1);
      g.save(); g.filter = 'blur(3px)';
      g.fillStyle = 'rgba(40,40,40,0.75)';
      g.beginPath(); g.ellipse(w / 2, h * 0.3, 26, 34, 0, 0, 7); g.fill();
      g.fillRect(w / 2 - 30, h * 0.36, 60, h * 0.42);
      g.restore();
      for (let i = 0; i < 5; i++) ellipse(g, w / 2, h * 0.3, 26 + i * 3, 34 + i * 3, 1);
      g.save(); g.fillStyle = '#b22'; g.font = `24px ${HAND}`; g.fillText('REC', w * 0.16, h * 0.18); g.restore();
    },
  };

  // ---------------- the tape that plays on the TV ----------------
  function fig(g, x, y, s, col) {              // little stick person
    g.strokeStyle = col || '#ddd'; g.lineWidth = 2 * s;
    g.beginPath(); g.arc(x, y - 30 * s, 5 * s, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(x, y - 25 * s); g.lineTo(x, y - 10 * s);
    g.moveTo(x, y - 10 * s); g.lineTo(x - 5 * s, y); g.moveTo(x, y - 10 * s); g.lineTo(x + 5 * s, y);
    g.moveTo(x, y - 21 * s); g.lineTo(x - 6 * s, y - 14 * s); g.moveTo(x, y - 21 * s); g.lineTo(x + 6 * s, y - 14 * s); g.stroke();
  }
  function caption(g, W, H, text) {
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, H - 30, W, 30);
    g.fillStyle = '#f2f2e6'; g.font = 'bold 15px Courier New, monospace'; g.textAlign = 'center';
    g.fillText(text, W / 2, H - 10); g.textAlign = 'left';
  }
  const TAPES = {
    siren(g, W, H, T) {
      g.fillStyle = '#20251f'; g.fillRect(0, H * 0.72, W, H);
      // car to hide behind
      g.fillStyle = '#3a3f3a'; g.fillRect(W * 0.18, H * 0.6, 70, 26);
      const moving = T < 2.2;
      fig(g, W * 0.12 + (moving ? T * 22 : 48), H * 0.72, 1);
      if (moving) { g.strokeStyle = '#ff6'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(W * 0.12 + T * 22, H * 0.62, 10 + i * 8 + (T * 30) % 8, -0.7, 0.7); g.stroke(); } }
      // the giant walks past
      const sx = W * 1.15 - Math.max(0, T - 1) * W * 0.16;
      g.strokeStyle = '#0a0a0a'; g.lineWidth = 4; g.fillStyle = '#0a0a0a';
      g.fillRect(sx - 2, H * 0.12, 4, H * 0.25);
      g.beginPath(); g.moveTo(sx, H * 0.12); g.lineTo(sx - 26, H * 0.06); g.lineTo(sx - 26, H * 0.18); g.fill();
      g.beginPath(); g.moveTo(sx, H * 0.12); g.lineTo(sx + 26, H * 0.06); g.lineTo(sx + 26, H * 0.18); g.fill();
      g.fillRect(sx - 12, H * 0.36, 24, H * 0.16);
      const st = Math.sin(T * 4) * 10;
      g.beginPath(); g.moveTo(sx - 6, H * 0.52); g.lineTo(sx - 8 + st, H * 0.73); g.moveTo(sx + 6, H * 0.52); g.lineTo(sx + 8 - st, H * 0.73); g.stroke();
      caption(g, W, H, moving ? 'HE HEARS EVERY STEP...' : 'STAY ABSOLUTELY SILENT');
    },
    tenant(g, W, H, T) {
      g.fillStyle = '#2a2d30'; g.fillRect(W * 0.36, H * 0.12, W * 0.28, H * 0.6);
      g.fillStyle = '#111'; for (let i = 0; i < 7; i++) g.fillRect(W * 0.39, H * (0.2 + i * 0.06), W * 0.22, 4);
      const k = Math.min(1, T / 4.5);
      g.fillStyle = `rgba(240,235,210,${k})`;
      g.beginPath(); g.ellipse(W * 0.46, H * 0.36, 6 + k * 4, 3, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(W * 0.54, H * 0.36, 6 + k * 4, 3, 0, 0, 7); g.fill();
      g.fillStyle = '#333'; g.fillRect(W * 0.3, H * 0.78, W * 0.4, 6);
      g.fillStyle = '#c33'; g.fillRect(W * 0.3, H * 0.78, W * 0.4 * Math.min(1, T / 6), 6);
      if (T > 3.6) fig(g, W * 0.72 + (T - 3.6) * 25, H * 0.74, 1);
      caption(g, W, H, T > 3.6 ? 'LEAVE BEFORE THE BAR FILLS' : 'IT IS ALREADY IN THERE');
    },
    silent(g, W, H, T) {
      g.fillStyle = '#1d2020'; g.fillRect(0, H * 0.74, W, H);
      fig(g, W * 0.3, H * 0.74, 1);
      if (T < 3) { g.strokeStyle = 'rgba(200,200,190,0.5)'; for (let i = 0; i < 6; i++) { const x = (T * 120 + i * 60) % W; g.beginPath(); g.moveTo(x, H * (0.2 + i * 0.08)); g.lineTo(x + 30, H * (0.2 + i * 0.08)); g.stroke(); } }
      if (T > 3 && T < 6) {
        const k = (T - 3) / 2.5;
        g.globalAlpha = Math.min(1, k);
        g.fillStyle = '#cfcac0';
        const fx = W * 0.85 - k * W * 0.35;
        g.beginPath(); g.ellipse(fx, H * 0.3, 8, 11, 0, 0, 7); g.fill();
        g.fillRect(fx - 7, H * 0.36, 14, H * 0.38);
        g.globalAlpha = 1;
      }
      if (T > 5.5 && T < 6.4) { g.fillStyle = 'rgba(255,250,200,0.35)'; g.beginPath(); g.moveTo(W * 0.32, H * 0.6); g.lineTo(W, H * 0.35); g.lineTo(W, H * 0.8); g.fill(); }
      caption(g, W, H, T < 3 ? 'THE WIND STOPS...' : T < 5.5 ? 'IT LOVES THE SILENCE' : 'MAKE A SMALL SOUND');
    },
    moth(g, W, H, T) {
      g.fillStyle = '#121414'; g.fillRect(0, 0, W, H);
      const mx = W * 0.62;
      const sweep = Math.sin(T * 1.6) * 0.9;
      const ang = sweep * 0.6 - 0.15;
      g.save(); g.translate(W * 0.08, H * 0.82);
      g.fillStyle = 'rgba(255,245,210,0.28)';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(ang - 0.12) * W, Math.sin(ang - 0.12) * W - H * 0.35); g.lineTo(Math.cos(ang + 0.12) * W, Math.sin(ang + 0.12) * W - H * 0.35); g.fill();
      g.restore();
      const lit = Math.abs(sweep) < 0.25;
      if (lit) {
        g.fillStyle = '#d8d4c8';
        g.beginPath(); g.ellipse(mx, H * 0.3, 7, 10, 0, 0, 7); g.fill();
        g.fillRect(mx - 6, H * 0.35, 12, H * 0.38);
        g.fillStyle = 'rgba(190,184,166,0.8)';
        g.beginPath(); g.moveTo(mx, H * 0.38); g.lineTo(mx - 30, H * 0.3); g.lineTo(mx - 20, H * 0.55); g.fill();
        g.beginPath(); g.moveTo(mx, H * 0.38); g.lineTo(mx + 30, H * 0.3); g.lineTo(mx + 20, H * 0.55); g.fill();
      }
      caption(g, W, H, 'KEEP THE BEAM MOVING — NEVER STARE');
    },
    exposure(g, W, H, T) {
      g.fillStyle = '#161616'; g.fillRect(0, 0, W, H);
      const up = T < 4;
      if (up) {
        g.strokeStyle = '#eee'; g.lineWidth = 3;
        [[0.12, 0.12, 1, 1], [0.88, 0.12, -1, 1], [0.12, 0.82, 1, -1], [0.88, 0.82, -1, -1]].forEach(([x, y, dx, dy]) => {
          g.beginPath(); g.moveTo(W * x + dx * 24, H * y); g.lineTo(W * x, H * y); g.lineTo(W * x, H * y + dy * 24); g.stroke();
        });
        g.fillStyle = '#f33'; g.font = '13px Courier New'; g.fillText('● REC', W * 0.15, H * 0.2);
        const k = T / 4;
        g.save(); g.filter = `blur(${4 - k * 2}px)`; g.fillStyle = `rgba(200,195,185,${0.3 + k * 0.5})`;
        g.beginPath(); g.ellipse(W / 2, H * (0.4 - k * 0.05), 10 + k * 18, 13 + k * 22, 0, 0, 7); g.fill();
        g.fillRect(W / 2 - (9 + k * 16), H * (0.46 - k * 0.04), 18 + k * 32, H * 0.3 + k * 40);
        g.restore();
      } else {
        g.fillStyle = 'rgba(255,245,210,0.3)';
        g.beginPath(); g.moveTo(W * 0.1, H * 0.85); g.lineTo(W * 0.9, H * 0.2); g.lineTo(W * 0.95, H * 0.6); g.fill();
        fig(g, W * 0.1, H * 0.85, 1);
      }
      caption(g, W, H, up ? 'IT CREEPS CLOSER IN THE LENS...' : 'LOWER IT. USE YOUR FLASHLIGHT');
    },
  };

  // ============================================================
  function DeathRoom() {
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020202);
    scene.fog = new THREE.Fog(0x020202, 3, 9);
    this.camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 30);

    const concrete = new THREE.MeshLambertMaterial({ map: LO.tex.get('concrete', { color: '#3a3836' }) });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), concrete);
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshLambertMaterial({ map: LO.tex.get('concrete', { color: '#2c2b2a' }) }));
    wall.position.set(0, 3, -1.6); scene.add(wall);

    // table
    const wood = new THREE.MeshLambertMaterial({ map: LO.tex.get('wood') });
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 1.3), wood);
    top.position.set(0, 0.78, -0.3); scene.add(top);
    [[-1.2, -0.85], [1.2, -0.85], [-1.2, 0.25], [1.2, 0.25]].forEach(([x, z]) => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.78, 0.07), wood); l.position.set(x, 0.39, z); scene.add(l);
    });

    // CRT television
    const tv = this.tv = new THREE.Group();
    const plastic = new THREE.MeshLambertMaterial({ color: 0x1d1d1b });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.82, 0.8), plastic); body.position.z = -0.1; tv.add(body);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.86, 0.06), new THREE.MeshLambertMaterial({ color: 0x3a3a37 }));
    bezel.position.z = 0.3; tv.add(bezel);
    this.tapeCanvas = document.createElement('canvas'); this.tapeCanvas.width = 320; this.tapeCanvas.height = 240;
    this.tapeTex = new THREE.CanvasTexture(this.tapeCanvas);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.58), new THREE.MeshBasicMaterial({ map: this.tapeTex }));
    screen.position.set(-0.08, 0.02, 0.335); tv.add(screen);
    // control panel + knobs
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.02), new THREE.MeshLambertMaterial({ color: 0x1c1c1a })); panel.position.set(0.42, 0, 0.335); tv.add(panel);
    [0.2, 0.05, -0.1].forEach(y => { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 12), plastic); k.rotation.x = Math.PI / 2; k.position.set(0.42, y, 0.35); tv.add(k); });
    // name plate on top
    this.labelCanvas = document.createElement('canvas'); this.labelCanvas.width = 512; this.labelCanvas.height = 96;
    this.labelTex = new THREE.CanvasTexture(this.labelCanvas);
    const plateBox = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.16, 0.25), plastic); plateBox.position.set(0, 0.5, 0.05); tv.add(plateBox);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.11), new THREE.MeshBasicMaterial({ map: this.labelTex }));
    plate.position.set(0, 0.5, 0.181); tv.add(plate);
    tv.position.set(0.8, 1.22, -0.58); tv.rotation.y = -0.26;
    scene.add(tv);

    // notebook: the cover flips open to reveal a sketch (inside of cover) and tips (right page)
    const book = this.book = new THREE.Group();
    const BW = 0.62, BD = 0.82;
    this.sketchCanvas = document.createElement('canvas'); this.sketchCanvas.width = 512; this.sketchCanvas.height = 680;
    this.tipsCanvas = document.createElement('canvas'); this.tipsCanvas.width = 512; this.tipsCanvas.height = 680;
    this.sketchTex = new THREE.CanvasTexture(this.sketchCanvas);
    this.tipsTex = new THREE.CanvasTexture(this.tipsCanvas);
    const pageGeo = new THREE.PlaneGeometry(BW, BD);
    const right = new THREE.Mesh(pageGeo, new THREE.MeshBasicMaterial({ map: this.tipsTex, color: 0xf2ece0 }));
    right.rotation.x = -Math.PI / 2; right.position.set(BW / 2, 0.02, 0); book.add(right);
    const block = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.02, BD), new THREE.MeshBasicMaterial({ color: 0x9c9482 }));
    block.position.set(BW / 2, 0.009, 0); book.add(block);
    const pivot = this.coverPivot = new THREE.Group(); pivot.position.y = 0.03; book.add(pivot);
    const leather = new THREE.MeshBasicMaterial({ color: 0x2e1c12 });
    const front = new THREE.Mesh(pageGeo, leather); front.rotation.x = -Math.PI / 2; front.position.set(BW / 2, 0.002, 0); pivot.add(front);
    const back = new THREE.Mesh(pageGeo, new THREE.MeshBasicMaterial({ map: this.sketchTex, color: 0xf2ece0 }));
    back.rotation.x = Math.PI / 2; back.rotation.z = Math.PI; back.position.set(BW / 2, -0.002, 0); pivot.add(back);
    // held up in front of you, like someone is reading it to you
    scene.add(this.camera);
    this.camera.add(book);
    book.rotation.set(Math.PI / 2 - 0.12, 0.16, 0.04);

    // lights: weak overhead lamp and the TV's glow
    scene.add(new THREE.AmbientLight(0x404040, 0.25));
    const lamp = this.lamp = new THREE.SpotLight(0xffe2b0, 0.9, 7, 0.75, 0.6, 1.5);
    lamp.position.set(-0.6, 3.2, 0.6); lamp.target.position.set(-0.3, 0.8, -0.2);
    scene.add(lamp, lamp.target);
    const glow = this.glow = new THREE.PointLight(0x9fb6ff, 1.2, 4, 2);
    glow.position.set(0.45, 1.25, 0.2); scene.add(glow);
    this.t = 0;
  }
  LO.DeathRoom = DeathRoom;

  DeathRoom.prototype.show = function (cause) {
    this.cause = ENTRIES[cause] ? cause : 'siren';
    const E = ENTRIES[this.cause];
    this.t = 0;
    this.coverPivot.rotation.z = 0;
    // name plate
    let g = this.labelCanvas.getContext('2d');
    g.fillStyle = '#e8e6de'; g.fillRect(0, 0, 512, 96);
    g.fillStyle = '#111'; g.textAlign = 'center';
    let fs = 54; g.font = `bold ${fs}px Arial`;
    while (g.measureText(E.label).width > 470 && fs > 20) { fs -= 2; g.font = `bold ${fs}px Arial`; }
    g.fillText(E.label, 256, 48 + fs * 0.36);
    this.labelTex.needsUpdate = true;
    // sketch page (inside the cover)
    g = this.sketchCanvas.getContext('2d');
    paper(g, 512, 680);
    g.strokeStyle = 'rgba(25,25,25,0.95)'; g.lineWidth = 4; g.lineCap = 'round';
    g.save(); g.translate(26, 60); SKETCH[this.cause](g, 460, 560); g.restore();
    g.fillStyle = '#333'; g.font = `34px ${HAND}`; g.fillText('fig. 1', 30, 650);
    this.sketchTex.needsUpdate = true;
    // tips page
    g = this.tipsCanvas.getContext('2d');
    paper(g, 512, 680);
    g.fillStyle = '#1b1b1b'; g.font = `bold 58px ${HAND}`; g.fillText(E.name, 34, 92);
    g.strokeStyle = '#1b1b1b'; g.lineWidth = 3; g.beginPath(); g.moveTo(34, 104); g.lineTo(34 + g.measureText(E.name).width, 106); g.stroke();
    g.font = `bold 44px ${HAND}`;
    let y = 175;
    E.tips.forEach(t => {
      const lines = wrap(g, '- ' + t, 440);
      lines.forEach((l, i) => { g.fillText(l, i ? 58 : 34, y); y += 44; });
      y += 18;
    });
    this.tipsTex.needsUpdate = true;
  };

  function paper(g, w, h) {
    g.fillStyle = '#d9d1bc'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.strokeStyle = 'rgba(80,110,160,0.25)'; g.lineWidth = 1;
    for (let y = 130; y < h; y += 44) { g.beginPath(); g.moveTo(0, y + 10); g.lineTo(w, y + 10); g.stroke(); }
    const gr = g.createLinearGradient(0, 0, 30, 0); gr.addColorStop(0, 'rgba(0,0,0,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 30, h);
  }
  function wrap(g, text, maxW) {
    const words = text.split(' '), out = []; let line = '';
    words.forEach(w => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
    if (line) out.push(line);
    return out;
  }

  DeathRoom.prototype.update = function (dt, aspect) {
    this.t += dt;
    const t = this.t;
    // camera: a slow push-in toward the TV and notebook
    const k = Math.min(1, t / 6);
    const ease = 1 - Math.pow(1 - k, 3);
    this.camera.aspect = aspect; this.camera.fov = aspect < 1 ? 70 : 50; this.camera.updateProjectionMatrix();
    this.camera.position.set(-0.12 + Math.sin(t * 0.3) * 0.03, 1.85 - ease * 0.2, 2.0 - ease * 0.5);
    this.camera.lookAt(0.05, 1.1, -0.5);
    // the held notebook: big and to the left on wide screens, lower and centred on phones
    const portrait = aspect < 1;
    const bob = Math.sin(t * 1.3) * 0.006, sway = Math.sin(t * 0.8) * 0.012;
    if (portrait) { this.book.position.set(-0.02, -0.2 + bob, -0.9); this.book.scale.setScalar(0.62); }
    else { this.book.position.set(-0.32 + sway, 0.03 + bob, -0.92); this.book.scale.setScalar(0.62); }
    this.book.rotation.z = 0.04 + Math.sin(t * 0.9) * 0.01;
    // the notebook opens
    const o = Math.max(0, Math.min(1, (t - 1.2) / 1.3));
    this.coverPivot.rotation.z = (1 - Math.pow(1 - o, 3)) * Math.PI * 0.995;
    // TV picture: static, then the tape (with VHS wear)
    const g = this.tapeCanvas.getContext('2d'), W = 320, H = 240;
    if (t < 1.6 || Math.random() < 0.012) {
      const id = g.createImageData(W, H);
      for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
      g.putImageData(id, 0, 0);
      this.glow.color.set(0xb0b8c8); this.glow.intensity = 0.9 + Math.random() * 0.6;
    } else {
      const T = (t - 1.6) % 8;
      g.fillStyle = '#181a1c'; g.fillRect(0, 0, W, H);
      try { TAPES[this.cause](g, W, H, T); } catch (e) { /* drawing errors shouldn't break the menu */ }
      // VHS overlay
      for (let y = 0; y < H; y += 3) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, y, W, 1); }
      const band = ((t * 40) % (H + 40)) - 20;
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, band, W, 10);
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.18})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 1); }
      g.fillStyle = '#e8e8e8'; g.font = 'bold 14px Courier New, monospace';
      g.fillText('PLAY ▶', 10, 20);
      g.fillText('SP  0:0' + Math.floor(T) + ':' + String(Math.floor((T % 1) * 60)).padStart(2, '0'), W - 120, 20);
      this.glow.color.set(0x9fb6ff); this.glow.intensity = 1 + Math.sin(t * 13) * 0.08;
    }
    this.tapeTex.needsUpdate = true;
    this.lamp.intensity = 0.9 * (Math.random() < 0.01 ? 0.3 : 1);
  };

  DeathRoom.prototype.render = function (renderer) {
    renderer.render(this.scene, this.camera);
  };
})();
