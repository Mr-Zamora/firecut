# FireCut

An offline, browser-based player for branching video stories, built for
Year 11 IT Multimedia students. Students write a simple text file of
scenes and choices; the player turns it into an interactive film that
runs by double-clicking one HTML file.

**No server. No dependencies. No internet.** Everything runs from
`file://` in a current Chrome or Edge on Windows.

## Quick start

**For students:**

1. Copy the `firecut-template/` folder and rename it to your project name.
2. Put your clips, images and audio in `media/`
   (`.mp4`, `.png`, `.jpg`, `.mp3`, lowercase filenames).
3. Edit `story.js` to write your scenes and choices.
   The full guide is `STORY.md` in the same folder.
4. Double-click `PLAY.html` to play. Mistakes in your story are shown on
   screen with line numbers and plain-English fixes.

**To see a finished example:** open `firecut-demo/PLAY.html` —
"The Golden Egg: Secrets of the Sunset", a complete 10-scene branching
story with a timer, an image scene, a music loop and three endings.

## What a story looks like

```
TITLE: The Golden Egg
START: intro

SCENE: intro
VIDEO: movie1.mp4
CHOICE: Say hello -> hello
CHOICE: Walk away -> walk-away

SCENE: hello
VIDEO: movie2.mp4
ENDING: Sweet ending! The egg remembered you.

SCENE: walk-away
TEXT: You leave the egg behind. It watches you go.
ENDING: A quiet ending!
```

That is a complete story: a title screen, two scenes, two choices and
two endings. Full keyword reference: `firecut-template/STORY.md`.

## Folder layout

```
firecut-template/     students copy this to start a project
  PLAY.html           double-click to play
  story.js            the story - the only file students must edit
  style.css           look and feel - optional student edits
  STORY.md            complete storytelling guide, written for non-coders
  media/              student files go here (README.txt inside)
  firecut/            the engine - students never touch this

firecut-demo/         the same structure, populated with a working story

docs/
  student-quick-start.md   one-page reference card
  teacher-notes.md         setup, marking and submission notes

tests/                development tooling, not shipped to students
```

## Features

- **Video scenes** (`VIDEO:`) — mp4 clips play full screen and freeze on
  the last frame while choices show.
- **Choices** (`CHOICE:`) — up to 4 buttons, at the end of a clip or
  mid-clip with `CHOICES-AT:`.
- **Timers** (`TIMER:`) — a countdown bar picks a default choice if the
  viewer is too slow.
- **Image and text scenes** (`IMAGE:`/`TEXT:`/`DURATION:`/`MUSIC:`) —
  stills with captions and music for pacing between clips.
- **Endings** (`ENDING:`) — numbered ending cards with Play again.
- **Audio** — `WAIT-LOOP:` audio while choices are up (per-scene
  override supported), `TITLE-MUSIC:` on the title screen.
- **Story map** — a readable SVG diagram of the whole plot, with
  colour-coded video/ending/unreachable scenes. Click a box to play
  from that scene.
- **Self-checking** — every common mistake produces a friendly error or
  warning with a line number before the story can run.
- **Keyboard controls** — `F` full screen, `Space` pause, `M` mute,
  `1-4` choices.
- **Styling** — `style.css` exposes colour, font and button variables,
  plus documented `fc-` classes for deeper customisation.

## Design constraints

- Runs from `file://` — no fetch/XHR, no server, no network requests.
- Plain HTML, CSS and JavaScript; the engine is ES5-compatible.
- Media is probed through normal `<video>`/`<audio>`/`<img>` elements.
- Videos are preloaded in a pool for sub-half-second scene switches.

## Testing (for developers, not students)

The `tests/` folder holds fixtures and harnesses that verify the parser,
checker and media probing without a browser:

```
cscript //E:jscript //Nologo tests/run-check-tests.js    parser fixtures
python tests/run-media-tests.py                        media probing
cscript //E:jscript //Nologo tests/check-demo-story.js   shipped stories
python tests/render-map.py firecut-demo/story.js map.png map preview
```

See `md/AGENTS.md` for the full development notes.
