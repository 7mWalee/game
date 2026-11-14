# The Loud One

A first-person stealth horror game that runs in the browser. Siren Head has wiped out the town of Hollow Creek. Sneak through the abandoned town, photograph the evidence, and get the police to send in the heavy equipment.

## How to play

Open `index.html` in a modern browser (Chrome, Edge or Firefox). You don't need to install or build anything. Headphones are recommended because the sound is 3D.

- **Goal:** photograph **5 of the 7** pieces of evidence. Their locations are **randomised every game**, outside or inside buildings. The one exception is the security tape in the **Sheriff's station**, which never moves.
- **Siren Head is blind and hunts by sound.** Walking, running, jumping, panting, your camera shutter and the buzz of your flashlight can all give you away.
- If he hears you, he comes to investigate. Keep making noise and he gets **angry**. If he's angry and you're making noise when he reaches you, he gets you.
- **Silence keeps you safe.** Stand still with the light off, or hide in a dumpster or locker. He can't catch you while you're completely silent.
- **Don't hide too long.** Something called **the Tenant** lives in the hiding spots. Its two glowing eyes open in the dark and creep closer the longer you stay, hurting you every second (2 HP at first, up to 8 HP). If they reach you (about 14 seconds), you die.
- **You have 100 HP, and it never comes back.**
- **Noise stacks.** Every source adds up: walking with your flashlight on is louder than either alone.
- **Echolocation:** about once a minute Siren Head pings the town. It finds you even if you're silent or hidden, and he creeps closer. Each ping is more accurate.
- **The Exposure** lives in your camera's viewfinder. The longer the camera is up, the closer it creeps. At 10 seconds it lunges for 40 HP. Photographing it banishes it but burns you for 25 HP, and flash photos of nothing draw it in faster. Use your flashlight to see, not the camera.
- **Moths** are only visible while your flashlight is on. They stand motionless in dark corners and alleys. Keep your flashlight on one for 2 seconds and it **shrieks**: you lose 20 HP, and Siren Head hears it and gets angrier. Sweep your beam past them.
- **Rocks:** you occasionally find rocks on the ground (carry up to 3). Throw one with **G** and it lands loudly, pulling Siren Head toward that spot.
- **Listen to the wind.** It blows dust and leaves through town. After 15 seconds of total silence it **stops completely** and the whole world goes silent with it: no music, no voices, none of Siren Head's sounds and no text on screen. That's your first warning.
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
| G | Throw a rock |
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
js/moths.js       the Moths
js/deathroom.js   death screen (TV tape + notebook)
js/cutscenes.js   opening and ending cutscenes
js/main.js        game flow, menus and main loop
audio/sounds.js   recorded sounds: death screen music, Tenant ear-ringing (MP3, base64)
js/lib/three.min.js  three.js r149 (MIT)
```

When you die, a TV plays a tape showing how to survive what killed you, next to a notebook with a sketch and four tips. The title screen's **Update Log** lists what every version added.
