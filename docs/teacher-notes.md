# FireCut - Teacher Notes

## What students get

Copy `firecut-template/` and rename the folder to the student's
project name. Everything they need is inside:

- `EDITOR.html` - double-click to edit `story.js` with a live map, checker and preview
- `PLAY.html` - double-click to play, works offline on Chrome/Edge
- `story.js` - the story file (starter story included)
- `style.css` - commented customisation file
- `media/` - empty, with a README.txt on naming rules
- `firecut/` - the engine; students should never open it

A working example lives in `firecut-demo/` (6 scenes, timer,
image scene, 3 endings, waiting loop, title background).

## Editing with EDITOR.html

Students can write their story in `EDITOR.html` instead of Notepad. It runs
offline from `file://` in Chrome or Edge and uses the same parser, checker and
player as `PLAY.html`:

- Locks the `FireCut.story(` and `);` wrapper lines and blocks backticks,
  preventing the most common syntax mistakes before they happen.
- Updates the **Map** and **Checks** tabs live as students type, with
  click-to-jump from every scene box and error message.
- **Media** tab lets students choose their `media/` folder to see used and
  unused clips, catch missing files early, and click a file to insert it.
- **Play** (`Ctrl+Enter`) and **Play from here** (`Ctrl+Shift+Enter` or
  right-clicking a map box) test the unsaved story in an overlay without
  leaving the editor.
- **Download / Save** (`Ctrl+S`) writes directly to `story.js` in Chrome/Edge
  via the file picker (or downloads `story.js` as a fallback), and keeps an
  automatic browser draft in case a laptop closes before saving.

## Checking a project

1. Open `PLAY.html`. Errors show as a red list with the exact
   line number and a plain-English fix - students must clear all
   errors before the title screen appears.
2. On the title screen press **Checks** - it lists warnings
   (unreachable scenes, bad file names, timer issues). A clean
   panel means the story is structurally sound.
3. Press **Story map** - it draws the whole story as a flowchart.
   Greyed scenes are unreachable; ending scenes are highlighted.
   This is the fastest way to see structure problems and doubles
   as the folio diagram (students screenshot it).
4. Click a map box to play from that scene when testing branches.

## Media requirements

- Video: MP4 H.264 + AAC, 720p/1080p, 25 fps (matches the export
  settings from the earlier task)
- Images: PNG or JPG
- Audio: MP3
- Names: lowercase, numbers, hyphens, underscores only - the
  checker warns about anything else

## Submission

The whole project folder zips to about 500 MB max. It plays on any
Windows machine with Chrome or Edge by double-clicking PLAY.html -
no server, no internet. Open question: delivery channel (OneDrive,
USB or Canvas) given the size.

## Common marking traps

- A scene that looks fine in the map but the clip does not play:
  wrong export format - the checker flags it as "will not play in
  the browser"
- Choices that never appear: scene has both ENDING and CHOICEs
  (warning explains it), or CHOICES-AT missing
- Students editing `firecut/firecut.js` or `firecut/firecut.css`:
  compare with the template copies - they must be identical

## Developer tests (for whoever maintains the engine)

From the repo root:

```
cscript //E:jscript //Nologo tests/run-check-tests.js    parser + checker
cscript //E:jscript //Nologo tests/run-editor-tests.js   editor helpers
python tests/run-media-tests.py                         media probing
```

`tests/parser-test.html` runs the same fixtures in a browser
(`?auto` runs them all). Fixtures live in `tests/stories.js`.
