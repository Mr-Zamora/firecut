# FireCut: Build Brief for Devin

Read `2026-11-10-firecut-spec.md` first. It is the source of truth for behaviour. This brief covers how to build it, in what order, and what "done" means.

## The job

Build FireCut version 1: an offline, browser-based player for branching video stories, plus a student template folder and a demo. Users are Year 11 students (15 to 16 years old) and their teacher, so reliability and clear error messages matter more than clever features.

## Hard constraints (do not break these)

1. **No server.** Everything must work when `PLAY.html` is opened by double-clicking (a `file://` URL) in current Chrome and Edge on Windows.
2. **No fetch or XHR of local files.** Browsers block these on `file://`. The story is loaded with a normal `<script src="story.js">` tag that calls `FireCut.story(\`...\`)`.
3. **No dependencies.** Plain HTML, CSS and JavaScript. No npm packages, frameworks, CDNs, build steps or web fonts from the internet.
4. **Offline.** Nothing may request a network resource.
5. **Students only edit `story.js`, `style.css` and `media/`.** All engine code lives in `firecut/`.
6. **Australian spelling** in all user-facing text (colour, organise, behaviour). Avoid em dashes in user-facing text.

## Folder to produce

```
firecut-template/
  PLAY.html
  story.js              starter story (test story from the spec)
  style.css             commented CSS variables and documented classes
  media/                empty, with a README.txt explaining naming rules
  firecut/
    firecut.js
    firecut.css
firecut-demo/           same structure, with the 6-scene demo and placeholder media
docs/
  student-quick-start.md
  teacher-notes.md
```

`PLAY.html` loads, in order: `firecut/firecut.css`, `style.css`, `firecut/firecut.js`, `story.js`, then a small inline call that starts the engine.

## Implementation notes

**Loading the story**

- `firecut.js` defines `window.FireCut` with a `story(text)` method that stores the raw text.
- After all scripts load, the engine checks whether `FireCut.story` was ever called. If not, `story.js` failed to parse (usually a stray backtick or a deleted first or last line). Show that as the first error in plain English.
- Use `window.onerror` to catch a syntax error in `story.js` and report its line number where the browser provides it.

**Parser**

- Line-based. Track line numbers from the original text for every error message.
- Keywords are case-insensitive; values are trimmed. Split `CHOICE` on `->`, then the target on `|` for an optional button image.
- Build a scene map, then run all checks from the spec's error checker table before showing the title screen.
- Design the parsed structure so `SET` and `IF` can be added in version 2 without changing existing keywords.

**Checking media files**

- On `file://` you can't list a folder. Probe each referenced file instead: a hidden `<video preload="metadata">` for MP4s, an `Image()` for images and an `<audio preload="metadata">` for MP3s. Treat `error` events as missing files and `loadedmetadata` as present.
- A video that exists but won't decode (wrong codec) should become the "won't play in the browser" warning.

**Smooth playback**

- Use two or more stacked `<video>` elements. While a clip plays, preload the clips for every possible next scene into spare elements, then swap visibility on a choice. Target under 0.5 seconds from click to the next clip playing.
- Hold the last frame at the end of a clip (don't reset or hide the video).
- Release preloaded elements for branches not taken, to keep memory low on older machines.

**Audio**

- The Start button click unlocks audio. Create all audio elements after that click, or play and pause them during it.
- Waiting loops fade in over 1 second and out over 0.5 seconds using volume ramps.

**Story map**

- Build it as an inline SVG with a simple layered layout: START on the left, then each level of scenes in columns to the right. No graph libraries.
- Clicking a scene box starts playback from that scene.

**Style**

- All engine classes use the `fc-` prefix. Expose the CSS variables listed in the spec, and use them throughout `firecut.css` so student changes in `style.css` apply everywhere.
- Default theme: dark, cinematic, large readable buttons. It should look finished with no student changes.

## Build order

Stop after each milestone and summarise what works, what doesn't, and what is next, before continuing.

1. **Parser and error checker** with a plain test page that lists errors. Test with a correct story and a story containing one of each error.
2. **Core playback:** title screen, video scenes, end-of-clip choices, endings and Play again, using the test story.
3. **Smooth switching:** stacked videos and preloading, then measure the click-to-play time.
4. **Extras:** image and text scenes, NEXT, CHOICES-AT, TIMER, waiting loops, keyboard controls.
5. **Customisation:** CSS variables, documented classes, image buttons with automatic hover images.
6. **Story map.**
7. **Template, demo and docs.**

## Test material

- The test story in the spec uses four real clips the teacher will supply: `movie1_cadburyegg.mp4`, `movie2_cadburyegg.mp4`, `movie3_indian.mp4` and `movie4_pool.mp4`. Until they arrive, generate short placeholder MP4s (H.264, 1080p, 25 fps, 5 to 10 seconds, each showing its scene name) so the demo works out of the box.
- Also generate a short silent or tone MP3 as a placeholder waiting loop.

## Definition of done

- Every acceptance test in the spec passes, tested by opening `PLAY.html` directly from the folder with the network turned off.
- Every error in the checker table has a test story that triggers it, and the message shows the right line number.
- The student quick-start guide fits on one page and uses no jargon beyond the story keywords.
- At the end, list every file created with its location.
