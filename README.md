# Starlight Man

An original maze game that runs in the browser. Written in strict TypeScript,
served by a small Go program, with no libraries and no image or sound files:
every creature, maze, sky and sound is drawn or synthesised in code.

**Play it: https://bozcode.com/goapp/starlight-man/**

Starlight Man is a paper lamplighter. Guide him through nine skies of paper cloud and
light every star. Lit stars stay lit and slow the creatures hunting you. A flare
shoots light down every corridor you can see, dazing whatever is there. Every maze is
generated, joined up, free of dead ends, and the same upside down.

(Called Starkindle until 25 November 2026.)

## Layout

| Part | What it does |
|------|--------------|
| `src/maze.ts` | generates mazes and finds the way through them |
| `src/game.ts` `foes.ts` | every rule, whole numbers only, so the same seed and keys give the same game |
| `src/maths.ts` `types.ts` | random numbers, shapes |
| `src/creatures.ts` `render.ts` `sky.ts` `paint.ts` | the art and the canvas |
| `src/audio.ts` `app.ts` | sound, controls and screens |
| `tests/` | the rules, and recorded runs that must replay exactly (`golden.json`) |
| `main.go` | file server: no sessions, no cookies, writes nothing |

## Build and run

Needs Go, Node 22.18 or newer, and TypeScript 5.9.

    npm install --no-save typescript@5.9.3
    ./build.sh
    ./starlight-man            # then open http://127.0.0.1:8091/

Set `STARLIGHT_MAN_ADDR` to use another address. Edit `src/*.ts`, never `assets/js/*.js`
(the compiler writes those). Files are embedded in the program: after any edit run
`build.sh` and restart it. After a deliberate change to the rules, re-record the
reference runs with `node tests/record.ts`.
