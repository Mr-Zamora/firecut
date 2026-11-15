# FireCut Story Editor (EDITOR.html) - Build Spec

Status: ready to build
Owner: Rom Zamora
Builder: Devin
Date: 15 November 2026

---

## 0. Read this first (instructions for Devin)

1. Read `md/AGENTS.md`, `md/2026-11-10-firecut-spec.md` and `firecut-template/STORY.md` before writing any code. AGENTS.md rules apply to everything in this spec.
2. **Build the UI first and stop.** Phase 1 (section 7) is a visual prototype only. When Phase 1 is done, open a pull request with screenshots and **wait for written approval from Rom before starting Phase 2.** Do not start later phases on your own, even if Phase 1 seems obviously fine.
3. Work on a branch called `feature/editor`. One pull request per phase.
4. Do not change how `firecut.js` behaves. You may only *add* to its public API, and only in Phase 4, after approval (section 7).
5. Do not touch `firecut-demo/style.css`, existing `story*.js` files, or anything in `media/`.
6. At the end of each phase, the pull request description must list every file created or modified, and say what the next phase will do.

---

## 1. Purpose

Students currently write `story.js` in Notepad, save, switch to the browser, refresh `PLAY.html`, and open the Checks and Story map panels to see what went wrong. The editor shortens that loop.

`EDITOR.html` is a single page with the story text on the left and, on the right, a live story map and live error list that update as the student types.

**The text file stays the source of truth.** The editor is a better text editor with live feedback. It is not a drag-and-drop builder. Students still learn and write the FireCut keywords themselves.

### Goals

| # | Goal | Measure |
|---|---|---|
| 1 | Faster feedback | Map and checks update within 0.5 s of the student stopping typing |
| 2 | Fewer stuck students | Every error can be clicked to jump to its line |
| 3 | Fewer file-name mistakes | Students pick file names from their real media folder |
| 4 | No new learning cost | A student who knows STORY.md can use the editor with no instructions |
| 5 | Same delivery model | Works offline, double-click to open, no install, no server |

### Audience

Year 11 IT Multimedia students (non-coders), on school Windows laptops, Chrome or Edge. Teachers use it to demo story structure on a projector.

---

## 2. Hard constraints

These come from `md/AGENTS.md` and the main spec and are not negotiable.

- Runs from `file://` by double-clicking `EDITOR.html`. No server, no build step.
- **No dependencies.** No npm, no CDN, no frameworks, no code editor libraries (no CodeMirror, Monaco, etc.).
- **No `fetch` or `XMLHttpRequest`.**
- `editor.js` is **ES5-safe**, same rules as `firecut.js`: no arrow functions, template literals, `let`/`const`, `forEach`, `Date.now`, or `.catch` dot access.
- Australian spelling in all user-facing text. No em dashes.
- Works in current Chrome and Edge on Windows. Firefox should work where possible but is not required.
- Usable at 1366x768 (common school laptop). Looks good at 1920x1080 (projector).
- Every user-facing message is plain English, in the same voice as the existing checker messages.

---

## 3. Files

Add to **both** `firecut-template/` and `firecut-demo/` (keep them in sync, as AGENTS.md requires for `firecut/`):

```
EDITOR.html              double-click to open the editor
firecut/editor.js        editor logic (ES5)
firecut/editor.css       editor styles
```

`EDITOR.html` loads, in this order:

1. `firecut/firecut.css` and `firecut/editor.css`
2. `firecut/firecut.js` (the engine, for its parser, checker and map)
3. `story.js` (so the editor opens with the student's current story; see section 5.4)
4. `firecut/editor.js`

`EDITOR.html` must not call `FireCut.start()` automatically. The engine must not take over the page.

---

## 4. Reuse the engine. Do not rewrite it.

The engine already exposes everything the editor needs:

| Engine API | Use in the editor |
|---|---|
| `FireCut.analyse(text)` | Parse and check the story. Returns errors, warnings and the model (scenes, line numbers, media refs) |
| `FireCut.mapSvg(model)` | Draw the story map exactly as the player does |
| `FireCut.mediaKind(file)` | Decide whether a file is video, image or audio |
| `FireCut.checkMedia(model, base, done)` | Optional: probe media files (Phase 3) |
| `FireCut._rawStory()` | The text `story.js` passed to `FireCut.story()`, used to open the current story |

**One parser, one checker, one map.** The editor must never contain its own copy of the parsing or checking rules. If the editor and `PLAY.html` ever disagree about an error, that is a bug.

Map nodes are already rendered with `data-scene="name"`, so the editor can attach its own click handlers after inserting the SVG.

---

## 5. Features

### 5.1 Layout

```
+---------------------------------------------------------------------------+
| FireCut Editor  [story title]      Open  Download  Insert v  Play  Help   |  top bar
+-------------------------------------+-------------------------------------+
|  1 | FireCut.story(`               |  [ Map ] [ Checks (2) ] [ Media ]   |  tabs
|  2 |                                |                                     |
|  3 | TITLE: The Golden Egg          |         live story map              |
|  4 | START: intro                   |                                     |
|  .. | ...                           |      (or checks list, or media)     |
|                                     |                                     |
|          story text editor          |                                     |
+-------------------------------------+-------------------------------------+
| 0 errors - 2 warnings - 9 scenes - 3 endings - Draft saved 10:42 am      |  status bar
+---------------------------------------------------------------------------+
```

- Left and right panes split 50/50 by default, with a draggable divider. Remember the split in `localStorage` (wrapped in try/catch).
- Below 1000 px wide, stack the panes: editor on top, tabs below.
- Visual style matches the existing player and story map (dark theme, see the map screenshots in the repo): green border for video scenes, blue for START, orange for endings, red dashed for unreachable. Reuse the CSS variables from `firecut.css` wherever they exist.

### 5.2 Story text editor (left pane)

Built from a plain `<textarea>` with a syntax-highlight layer behind it (the standard "transparent textarea over a `<pre>`" technique) and a line-number gutter. No libraries.

- **Shows the whole file, including `FireCut.story(` and the closing line**, so line numbers match the line numbers in `PLAY.html` error messages exactly. The first and last lines are locked: the editor refuses edits to them and shows a short note explaining why.
- **Blocks the backtick key** inside the story and shows: "Backticks can't go inside your story. They would stop it from being read."
- **Syntax highlighting:**
  - keywords (`SCENE:`, `CHOICE:` etc.) in one colour, with `SCENE:` lines bold
  - `->` arrows and scene names after them in a second colour
  - media file names in a third colour
  - `#` comment lines dimmed
  - lines with an error get a red underline and a red dot in the gutter; warnings get amber
- Monospace font, 15 px default, with A- and A+ buttons (remember the size).
- Tab key inserts two spaces instead of leaving the editor.
- Undo and redo must still work after any text the editor inserts (use `document.execCommand('insertText')` where supported, with a fallback).

### 5.3 Live checking

- Re-run `FireCut.analyse()` 400 ms after the student stops typing.
- The status bar shows errors, warnings, scene count and ending count. Green when 0 errors and 0 warnings.
- If the text can't be parsed at all, keep showing the last good map, greyed out, with a banner: "The map is paused until the story can be read again."

### 5.4 Opening and saving

**Opening**

- On load, if `story.js` loaded successfully, read it with `FireCut._rawStory()` and rebuild the full file text (`FireCut.story(` + backtick, the story, backtick + `);`).
- If a local draft exists that differs from `story.js`, ask: "You have unsaved changes from [time]. Keep working on them, or open story.js?"
- **Open** button and drag-and-drop: load any `.js` file chosen by the student (`<input type="file">` and `FileReader`).
- If `story.js` is missing or broken, start with the beginner template text (section 5.7) and say so.

**Saving**

Browsers can't silently save over a file opened from `file://`, so:

- **Download** button (and Ctrl+S): if `window.showSaveFilePicker` exists, use it so the student can save straight over their `story.js`. Remember the file handle for later saves in the same session. Otherwise, fall back to a normal download of `story.js`.
- After a fallback download, show a one-time tip: "Your browser saved story.js to Downloads. Move it into your story folder, replacing the old one."
- **Autosave a draft** to `localStorage` every 5 seconds while there are changes (try/catch; the editor must still work if storage is blocked). This is a safety net, not a replacement for saving.
- Warn on closing the tab with unsaved changes (`beforeunload`).

### 5.5 Right pane: Map tab

- Renders `FireCut.mapSvg(model)`. Fits to the pane width with zoom (+, -, fit) and drag-to-pan.
- **Click a scene box** to jump to its `SCENE:` line in the editor, select that line and scroll it into view.
- **Moving the cursor** into a scene highlights that scene's box on the map (thicker outline). This is how students see where they are in the story.
- Hovering a box shows a tooltip with the scene's media file and its choices.

### 5.6 Right pane: Checks tab

- Lists every error, then every warning, each with its line number and the engine's message text, unchanged.
- **Click a message** to jump to that line.
- The tab label shows a count, red for errors, amber for warnings only.
- When there are none: "No problems found. Press Play to watch your story."

### 5.7 Insert menu

Inserts a ready-made block at the cursor (on a new line, between scenes). Each pattern matches STORY.md's "Common patterns" section:

| Menu item | Inserts |
|---|---|
| Video scene with choices | `SCENE`, `VIDEO`, two `CHOICE` lines |
| Buttons during a clip | as above plus `CHOICES-AT` |
| Timer scene | `SCENE`, `VIDEO`, `TIMER`, two `CHOICE` lines |
| Image with caption and music | `SCENE`, `IMAGE`, `TEXT`, `MUSIC`, `DURATION`, `CHOICE` |
| Auto-continue | `SCENE`, `VIDEO`, `NEXT` |
| Text ending card | `SCENE`, `TEXT`, `ENDING` |
| Single choice | one `CHOICE: Label -> scene-name` line |

- New scene names are unique (`new-scene`, `new-scene-2`, ...). Placeholder values are selected after inserting so the student can type over them.
- **New story** (also in this menu) replaces the text with the beginner Golden Egg story, after a confirmation. Store this template text in `editor.js`.

### 5.8 Right pane: Media tab

- **Choose media folder** button using `<input type="file" webkitdirectory multiple>`. The browser only reads file names and creates temporary previews. Nothing is uploaded or copied.
- Lists files grouped as Videos, Images and Audio (using `FireCut.mediaKind`), with a small thumbnail for images and a hover preview for videos (object URLs, released when replaced).
- Each file shows a badge:
  - **Used** (with the scene names; click to jump), or
  - **Not used yet**
- Lists any file the story names that is **not in the folder**, in red, with a click-to-jump link. This catches spelling mistakes before `PLAY.html` does.
- Flags file names that break the naming rule (capitals, spaces), using the same wording as the checker.
- **Click a file** to insert it at the cursor with the right keyword: `VIDEO:` for mp4, `IMAGE:` for jpg/png, `MUSIC:` for mp3. If the cursor is already on a matching keyword line, replace the value instead.
- The folder must be chosen again each session (browser limitation). Say so in a small note.

### 5.9 Play

- **Play** button (and Ctrl+Enter) plays the story as currently typed, without saving first, in a full-window overlay with a Close button.
- **Play from here**: on the map, right-click a box (or use a small play icon on hover) to play from that scene.
- If there are errors, Play shows the same error screen `PLAY.html` would.
- This needs a small, additive engine function (section 7, Phase 4). Until then, the Play button shows "Coming soon" in Phase 1 and is hidden or disabled in Phases 2 and 3.

### 5.10 Help

- **Help** button opens a side panel with the keyword tables from STORY.md (story keywords, scene keywords, what every scene needs). Clicking a keyword inserts it at the cursor.
- Keyboard shortcuts listed at the bottom.

### 5.11 Keyboard shortcuts

| Keys | Action |
|---|---|
| Ctrl+S | Save / download story.js |
| Ctrl+Enter | Play from the start |
| Ctrl+Shift+Enter | Play from the scene the cursor is in |
| Ctrl+F | Browser find (do not override) |
| F1 | Help panel |
| Alt+1 / Alt+2 / Alt+3 | Map / Checks / Media tab |

---

## 6. Accessibility and quality

- All buttons are real `<button>` elements with visible focus outlines and tooltips.
- Colour is never the only signal: errors also use an icon and text.
- Text contrast meets WCAG AA on the dark theme.
- Stays responsive with a 60-scene story (target: re-analyse and redraw in under 150 ms on a school laptop).
- No console errors in normal use.

---

## 7. Phases and approval gates

### Phase 1 - UI prototype (STOP for approval at the end)

Goal: let Rom judge the look, layout and workflow before any real logic is written.

Build:

- `EDITOR.html`, `editor.css` and a minimal `editor.js` with the full layout from 5.1: top bar, editor pane with line numbers, tabs, status bar, divider, Insert menu, Help panel.
- Load the demo `story.js` into the editor and show the **real** map from `FireCut.mapSvg()` and the real checks list, so the layout is judged with real content. This can update on a button press rather than live.
- Syntax highlighting may be partial (keywords and comments are enough).
- The Media tab shows a mocked file list using the demo's media file names.
- Every other button exists and shows a small "Coming in a later phase" message.
- The narrow (stacked) layout below 1000 px.

Deliver in the pull request:

- Screenshots at **1366x768** and **1920x1080**, each tab visible at least once, plus one narrow-layout screenshot.
- A short list of any design decisions made that this spec didn't cover.

**Then stop. Do not begin Phase 2 until Rom approves in writing.** Expect change requests to the layout and look; build Phase 1 so it is easy to rearrange.

### Phase 2 - Core loop

- Live re-analysis (5.3), status bar, checks list with click-to-jump (5.6).
- Map click-to-jump and cursor-to-map highlighting (5.5), zoom and pan.
- Locked first and last lines, backtick blocking (5.2).
- Open, Download / Save, drafts, unsaved-changes warning (5.4).

Acceptance:

- Typing a misspelt scene name after `->` produces the same error text and line number as `PLAY.html`.
- Saving with `showSaveFilePicker` in Chrome overwrites `story.js`, and `PLAY.html` plays the change after a refresh.
- Fallback download works with the picker unavailable.
- Closing and reopening the editor offers the unsaved draft.

### Phase 3 - Authoring help

- Full syntax highlighting with error and warning marks (5.2).
- Insert menu and New story (5.7).
- Media tab with a real folder (5.8).
- Help panel with insert-on-click (5.10), font size buttons, keyboard shortcuts.

Acceptance:

- Inserting a timer scene and filling in the placeholders produces 0 errors.
- Choosing the demo `media/` folder marks every demo file as Used, and renaming a file name in the story to a wrong spelling shows it as missing.
- Undo works after every insert.

### Phase 4 - Play preview, docs and tests

**Engine change (needs Rom's approval before merging):** add one additive function to `firecut.js`, for example `FireCut.preview(text, sceneName, container)`, which plays the given story text, optionally from a given scene, inside a given element, and returns a function to stop and clean up. It must reuse the existing player code, must not change how `PLAY.html` behaves, and must stay ES5-safe. Copy the updated engine into both `firecut/` folders.

Then:

- Play and Play from here (5.9).
- Docs: add an "Editing with EDITOR.html" section to `STORY.md` (template and demo), `docs/student-quick-start.md` and `docs/teacher-notes.md`. Plain language, Australian spelling, no em dashes.
- Tests: an ES5 test for any editor logic that doesn't need the DOM (e.g. unique scene names, file rebuild from `_rawStory`, media used/missing lists) added to `tests/`, runnable with cscript like the existing tests. All existing tests must still pass.

Acceptance:

- Play from a mid-story scene plays that scene first, with media, from the unsaved text.
- Closing the preview stops all video and audio.
- `cscript //E:jscript //Nologo tests/run-check-tests.js` and the other existing test commands still pass.

---

## 8. Out of scope

- Drag-and-drop visual story building, or editing scenes by dragging map boxes.
- Variables, `SET`/`IF`, or any new story keywords (that is FireCut v2).
- Video trimming, previewing or editing media.
- Cloud saving, accounts, sharing, or anything needing the internet.
- Changing the story map layout algorithm (the map comes from `FireCut.mapSvg()` as-is).

---

## 9. Open questions for Rom

Devin: list these in the Phase 1 pull request so Rom can answer them while reviewing.

1. Should the editor open in the student template only, or also be the recommended way to edit the demo?
2. Is `showSaveFilePicker` allowed on the school laptops from `file://`? (Devin to provide a one-line test page; Rom to try it on a school machine.)
3. Should `PLAY.html` get an "Edit" button that opens `EDITOR.html`?
4. Light theme option for projectors in bright rooms, or dark only?
