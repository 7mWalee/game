// ============================================================
//  THE LOUD ONE — settings (graphics / audio / controls)
// ============================================================
window.LO = window.LO || {};

(function () {
  const KEY = 'theLoudOne.settings.v1';

  const PRESETS = {
    low:    { renderScale: 0.6,  shadows: 'off',  antialias: false, textures: 'low',  viewDistance: 'near',   lighting: 'simple' },
    medium: { renderScale: 0.85, shadows: 'off',  antialias: false, textures: 'high', viewDistance: 'medium', lighting: 'full' },
    high:   { renderScale: 1.0,  shadows: 'low',  antialias: true,  textures: 'high', viewDistance: 'far',    lighting: 'full' },
    ultra:  { renderScale: 1.25, shadows: 'high', antialias: true,  textures: 'high', viewDistance: 'far',    lighting: 'full' },
  };

  const DEFAULTS = Object.assign({
    quality: 'medium',
    fov: 75,
    brightness: 1.0,
    filmGrain: true,
    vignette: true,
    headBob: true,
    showFps: false,
    // audio
    master: 0.8, music: 0.6, sfx: 0.9, voice: 1.0, subtitles: true, tts: true,
    // controls
    sensitivity: 1.0, invertY: false,
  }, PRESETS.medium);

  const S = Object.assign({}, DEFAULTS);
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(S, JSON.parse(raw));
  } catch (e) { /* storage unavailable — defaults are fine */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  }

  // Option definitions drive the menu UI.
  // type: 'choice' (values/labels) or 'range' (min/max/step/format)
  const GRAPHICS_OPTIONS = [
    { section: 'PRESET' },
    { key: 'quality', label: 'Graphics Quality', desc: 'Sets everything below at once', type: 'choice',
      values: ['low', 'medium', 'high', 'ultra', 'custom'], labels: ['Low', 'Medium', 'High', 'Ultra', 'Custom'] },
    { section: 'DISPLAY' },
    { key: 'renderScale', label: 'Resolution Scale', type: 'choice', custom: true,
      values: [0.5, 0.6, 0.75, 0.85, 1.0, 1.25, 1.5], labels: ['50%', '60%', '75%', '85%', '100%', '125%', '150%'] },
    { key: 'antialias', label: 'Anti-Aliasing', type: 'choice', custom: true, values: [false, true], labels: ['Off', 'On'] },
    { key: 'fov', label: 'Field of View', type: 'range', min: 55, max: 105, step: 1, fmt: v => v + '°' },
    { key: 'brightness', label: 'Brightness', desc: 'Raise this if you cannot see anything', type: 'range', min: 0.5, max: 2.0, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
    { section: 'QUALITY' },
    { key: 'shadows', label: 'Shadows', type: 'choice', custom: true, values: ['off', 'low', 'high'], labels: ['Off', 'Low', 'High'] },
    { key: 'textures', label: 'Texture Detail', type: 'choice', custom: true, values: ['low', 'high'], labels: ['Low', 'High'] },
    { key: 'lighting', label: 'Lighting Model', desc: 'Simple is faster, Full is physically based', type: 'choice', custom: true, values: ['simple', 'full'], labels: ['Simple', 'Full'] },
    { key: 'viewDistance', label: 'View Distance', type: 'choice', custom: true, values: ['near', 'medium', 'far'], labels: ['Near', 'Medium', 'Far'] },
    { section: 'EFFECTS' },
    { key: 'filmGrain', label: 'Film Grain', type: 'choice', values: [false, true], labels: ['Off', 'On'] },
    { key: 'vignette', label: 'Vignette', type: 'choice', values: [false, true], labels: ['Off', 'On'] },
    { key: 'headBob', label: 'Head Bob', type: 'choice', values: [false, true], labels: ['Off', 'On'] },
    { key: 'showFps', label: 'Show FPS', type: 'choice', values: [false, true], labels: ['Off', 'On'] },
  ];

  const AUDIO_OPTIONS = [
    { section: 'VOLUME' },
    { key: 'master', label: 'Master', type: 'range', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
    { key: 'music', label: 'Music', type: 'range', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
    { key: 'sfx', label: 'Sound Effects', type: 'range', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
    { key: 'voice', label: 'Voices', type: 'range', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
    { key: 'tts', label: 'Spoken Voice Lines', desc: 'Uses your browser\'s speech voices', type: 'choice', values: [false, true], labels: ['Off', 'On'] },
    { key: 'subtitles', label: 'Subtitles', type: 'choice', values: [false, true], labels: ['Off', 'On'] },
    { section: 'CONTROLS' },
    { key: 'sensitivity', label: 'Mouse Sensitivity', type: 'range', min: 0.2, max: 3, step: 0.05, fmt: v => v.toFixed(2) + 'x' },
    { key: 'invertY', label: 'Invert Y', type: 'choice', values: [false, true], labels: ['Off', 'On'] },
  ];

  function set(key, value) {
    S[key] = value;
    if (key === 'quality' && PRESETS[value]) Object.assign(S, PRESETS[value]);
    else {
      const def = GRAPHICS_OPTIONS.find(o => o.key === key);
      if (def && def.custom) {
        // if values no longer match a preset, mark custom
        const match = Object.keys(PRESETS).find(p =>
          Object.keys(PRESETS[p]).every(k => PRESETS[p][k] === S[k]));
        S.quality = match || 'custom';
      }
    }
    save();
    LO.events && LO.events.dispatchEvent(new CustomEvent('settings', { detail: { key, value } }));
  }

  LO.events = LO.events || new EventTarget();
  LO.settings = S;
  LO.Settings = { set, save, PRESETS, DEFAULTS, GRAPHICS_OPTIONS, AUDIO_OPTIONS };
})();
