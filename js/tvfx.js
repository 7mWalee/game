// ============================================================
//  THE LOUD ONE — death transition
//  The screen floods red, red static eats the picture, then it
//  switches off like an old television (collapsing to a line and
//  a dot) before flicking back on into the death screen.
// ============================================================
(function () {
  const cv = document.createElement('canvas');
  cv.id = 'tvfx';
  document.body.appendChild(cv);
  const g = cv.getContext('2d');
  // static is drawn at low resolution and scaled up (cheap and suitably grainy)
  const noise = document.createElement('canvas');
  const ng = noise.getContext('2d');
  let nImg = null;

  let phase = 'none', t = 0, onBlack = null, onDone = null;
  const OFF = 0.5, BLACK = 0.45, ON = 0.65;

  function size() {
    cv.width = Math.max(320, Math.round(window.innerWidth));
    cv.height = Math.max(180, Math.round(window.innerHeight));
    noise.width = Math.max(160, Math.round(cv.width / 4));
    noise.height = Math.max(90, Math.round(cv.height / 4));
    nImg = ng.createImageData(noise.width, noise.height);
  }
  size();
  window.addEventListener('resize', size);

  // red: 0..1 how red the static is (1 = deep red, 0 = grey)
  function makeNoise(red) {
    const d = nImg.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255;
      d[i] = v; d[i + 1] = v * (1 - red * 0.85); d[i + 2] = v * (1 - red * 0.85); d[i + 3] = 255;
    }
    ng.putImageData(nImg, 0, 0);
  }

  const FX = {
    // called every frame while the player is dying (k: seconds since death)
    dying(k) {
      phase = 'dying';
      const W = cv.width, H = cv.height;
      g.clearRect(0, 0, W, H);
      const red = Math.min(1, k / 1.1);
      const stat = Math.max(0, Math.min(1, (k - 0.9) / 1.5));
      // red flood, heavier at the edges
      const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.1, W / 2, H / 2, Math.max(W, H) * 0.7);
      gr.addColorStop(0, `rgba(150,0,0,${red * 0.45})`);
      gr.addColorStop(1, `rgba(110,0,0,${red * 0.85})`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      if (stat > 0) {
        makeNoise(1 - Math.max(0, stat - 0.75) * 2);
        g.globalAlpha = stat;
        g.imageSmoothingEnabled = false;
        g.drawImage(noise, 0, 0, W, H);
        g.globalAlpha = 1;
      }
    },
    // switch off → black → (callback swaps to the death room) → flick back on
    off(blackCb, doneCb) {
      phase = 'off'; t = 0; onBlack = blackCb; onDone = doneCb;
    },
    update(dt) {
      if (phase === 'none' || phase === 'dying') return;
      t += dt;
      const W = cv.width, H = cv.height;
      g.clearRect(0, 0, W, H);
      if (phase === 'off') {
        const p = Math.min(1, t / OFF);
        g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
        // picture collapses to a bright horizontal line, then to a dot
        let rw = W, rh = H;
        if (p < 0.55) rh = Math.max(3, H * Math.pow(1 - p / 0.55, 2.2));
        else { rh = 3; rw = Math.max(4, W * Math.pow(1 - (p - 0.55) / 0.35, 2)); }
        const a = p > 0.9 ? 1 - (p - 0.9) / 0.1 : 1;
        makeNoise(0.2);
        g.globalAlpha = a;
        g.drawImage(noise, (W - rw) / 2, (H - rh) / 2, rw, rh);
        g.fillStyle = `rgba(255,255,255,${0.35 + (p > 0.4 ? 0.6 : 0)})`;
        g.fillRect((W - rw) / 2, (H - rh) / 2, rw, rh);
        // glow around the line / dot
        const gl = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(rw, 40) * 0.6);
        gl.addColorStop(0, `rgba(220,230,255,${0.5 * a})`); gl.addColorStop(1, 'rgba(220,230,255,0)');
        g.fillStyle = gl; g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
        if (t >= OFF) { phase = 'black'; t = 0; }
      } else if (phase === 'black') {
        g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
        if (t >= BLACK) { phase = 'on'; t = 0; onBlack && onBlack(); }
      } else if (phase === 'on') {
        const p = Math.min(1, t / ON);
        // a bright line splits open into the new picture, with a couple of flickers
        const open = p < 0.15 ? 0.004 : Math.min(1, Math.pow((p - 0.15) / 0.55, 0.7));
        const rh = Math.max(3, H * open);
        g.fillStyle = '#000';
        g.fillRect(0, 0, W, (H - rh) / 2);
        g.fillRect(0, (H + rh) / 2, W, H);
        const flicker = (p > 0.3 && p < 0.36) || (p > 0.5 && p < 0.53);
        if (flicker) { g.fillStyle = 'rgba(0,0,0,0.85)'; g.fillRect(0, (H - rh) / 2, W, rh); }
        const flash = Math.max(0, 1 - p * 2.2);
        if (flash > 0) { g.fillStyle = `rgba(235,240,255,${flash})`; g.fillRect(0, (H - rh) / 2, W, rh); }
        if (p >= 1) { phase = 'none'; g.clearRect(0, 0, W, H); onDone && onDone(); }
      }
    },
    clear() { phase = 'none'; g.clearRect(0, 0, cv.width, cv.height); },
    get active() { return phase !== 'none'; },
  };
  LO.TVFX = FX;
})();
