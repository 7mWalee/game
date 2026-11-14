# The Loud One

A first-person stealth horror game that runs in the browser. Siren Head has wiped out the town of Hollow Creek. Sneak through the abandoned town, photograph the evidence, and get the police to send in the heavy equipment.

## How to play

Open `index.html` in a modern browser (Chrome, Edge or Firefox). You don't need to install or build anything. Headphones are recommended because the sound is 3D.

- **Goal:** photograph **4 of the 6** pieces of evidence hidden around town. Some are outside and some are inside buildings.
- **Siren Head is blind and hunts by sound.** Walking, running, jumping, panting, your camera shutter and the buzz of your flashlight can all give you away.
- If he hears you, he comes to investigate. Keep making noise and he gets **angry**. If he's angry and you're making noise when he reaches you, he gets you.
- **Silence keeps you safe.** Stand still with the light off, or hide in a dumpster or locker. He can't catch you while you're completely silent.
- **Don't hide too long.** Something called **the Tenant** lives in the hiding spots. After about 14 seconds it throws you out with a loud crash Siren Head can hear, then keeps that spot for a while. It also takes **30 HP**.
- **You have 100 HP, and it never comes back.**
- **Don't stay completely silent for too long either.** After 20 seconds of total silence (hiding counts), **the Silent One (Phenomenon-249)** starts closing in. At 30 seconds it attacks, taking 5 HP every second until you make any sound.
- The white marker on the **NOISE** bar shows how close he is. If your noise goes past the marker, he can hear you.

| Key | Action |
| --- | --- |
| WASD | Move |
| Mouse | Look |
| Shift | Sprint (loud, uses stamina) |
| Space | Jump (very loud) |
| C / Ctrl | Crouch (quiet). Hold still while crouched to hold your breath |
| F | Flashlight (buzzes, drains battery) |
| Right mouse / Q | Raise the camera |
| Left mouse | Take a photo |
| E | Hide or leave a hiding spot |
| Esc | Pause |

## What's in it

- A title screen with a live 3D background, plus **Graphics** options: quality presets, resolution scale, anti-aliasing, shadows, texture detail, lighting model, view distance, field of view, brightness, film grain, vignette, head bob and an FPS counter
- An opening cutscene of the drive into Hollow Creek
- An ending cutscene where the police convoy, restraint cranes and a helicopter take Siren Head down, followed by the credits
- Music that changes with the danger: title, exploring, chase, tension and ending themes. All of it is generated live with the Web Audio API.
- Voice lines for you, police dispatch and Siren Head's distorted radio voice, spoken by your browser's speech synthesizer, with subtitles

## Files

```
index.html        page and screens
css/style.css     menus and on-screen display
js/settings.js    graphics, audio and control settings (saved in your browser)
js/audio.js       music, sound effects, 3D sound and voice lines
js/textures.js    procedural textures
js/world.js       the town, buildings, props, evidence and hiding spots
js/sirenhead.js   Siren Head model, animation and hearing behaviour
js/player.js      movement, noise, stamina, flashlight, camera and hiding
js/cutscenes.js   opening and ending cutscenes
js/main.js        game flow, menus and main loop
js/lib/three.min.js  three.js r149 (MIT)
```
