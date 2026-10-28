# Mario and the Forgotten Land

A family game. Unofficial, non-commercial, and made for one household.

A ruined city, a red-cap hero, and mushroom friends to bring home. Everything on screen is built from simple 3D shapes. Sounds are synthesized in the browser. No Nintendo artwork, models, or music are used.

Play it at <https://mossy-ruins-games.github.io/mario-forgotten-land/>.

## Play

Landscape on a phone works best. If the screen is tall, turn the phone sideways.

- Left stick: run
- JUMP: jump. Jump again in the air to flutter
- ATTACK: spin, shoot after a Fire Flower, or stomp while airborne
- INHALE / ACTION: pull coins, enemies, and friends. Press it next to a traffic cone or a car to hop in

Land on an enemy to stomp it. Bells are checkpoints. The flag ends a path. Rescued friends open the Turtle King gate. Falls send you back to the last bell and drop a few coins. There is no game over that wipes your saved friends.

Keyboard, if you have one: arrows or WASD, Space jump, K attack, L inhale, P pause, M mute.

## Local

```bash
npm install
npm run dev
```

`npm run build` writes a static site in `dist/`. The Vite `base` is relative so GitHub Pages can host the project site.

## Save

Progress stays in this browser only (`localStorage`).

## Credit

A family game. Original code, original shape-built characters, original chiptune.
