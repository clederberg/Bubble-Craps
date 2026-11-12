# The Floor

A first person casino floor for Bubble Craps. Three.js, static files, no build
step needed to run it: the page loads `index.html`, `floor.css` and
`floor.bundle.js` and nothing else.

Open `floor/index.html`. Click once to catch the mouse, then **W A S D** to
walk, mouse to look, **shift** to hurry, **F** to fly, **esc** to let go.

## What is here (step 1)

The room, the lighting and the materials.

- **Room:** 36 x 28 metres, a sunken pit in the middle with a brass nosed step
  and a waist high rail, four marble columns, panelled walls with a walnut
  wainscot and a brass chair rail, and a coffered ceiling over the pit that
  sits a metre higher than the rest with a warm cove hidden behind its lip.
- **Fixtures, blocked out at real sizes:** a 12 foot craps table in the middle,
  two blackjack tables and a baccarat table either side, four banks of seven
  slot machines down the long walls, the cage at the back and a bar opposite.
  They are stand ins, but they are the right size and in the right place, so
  walking the room already tells you how it will feel.
- **Lighting:** three warm pendants over the pit that cast the shadows, a cove
  wash, coloured fill down the slot aisles, and a lot of emissive geometry that
  the bloom pass turns into glow. ACES tone mapping, soft shadows, a little
  haze so the far wall sits back.
- **Materials:** every surface is generated at load from value noise into a
  canvas, with the normal map derived from the same height field. Carpet with
  a proper repeating medallion, walnut with warped grain, marble with veins,
  brass. Nothing is downloaded, so the page is self contained.

## Swapping in scanned textures

The generated maps are good enough to walk around in, but a Poly Haven scan
will beat them. Everything is CC0.

    ./tools/fetch-polyhaven.sh carpet_red_01 2k

Then in `src/materials.js` use the loader instead of the generated material:

    const carpetMat = loadPBR('carpet_red_01', { repeat: 12 });

and rebuild. Keep the files under 100 MB all in and the page still loads in a
few seconds.

## Baking

`tools/bake.py` is for the modelled furniture that comes later, not for the
boxes that are in there now. It unwraps a second UV channel, bakes the combined
pass in Cycles and writes a `.glb` whose materials are plain emission of the
bake, so three.js draws it with no lights at all.

    blender -b scene.blend -P tools/bake.py -- --out baked --size 2048

Bake the things that never move: soft shadows under the chairs, bounce off the
carpet, the falloff down a column. Keep the real time lights for the dice, the
cards and the chips.

## Rebuilding

Only needed if you edit `src/`.

    npm install
    npm run build

`floor.bundle.js` is the output and the only script the page loads.

## Next

2. Walking with collision, and the click to sit camera move
3. Craps in 3D: physics dice, chips, the layout on the felt
4. Blackjack, baccarat and the two slots
5. Sound and polish

The rules stay where they are. `engine.js`, `bj.js`, `bac.js`, `slots.js` and
`pots.js` already run headless under node, so the 3D tables call the same code
the flat pages do, and every game keeps its own page.
