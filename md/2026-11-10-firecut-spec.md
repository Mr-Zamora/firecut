# FireCut: Product Specification

Version 1 · 10 November 2026

## Overview

FireCut is a browser-based player that turns a folder of video clips and one plain-text story file into an interactive choose-your-own-adventure film. It runs offline by double-clicking a file, with no server, no installation and no coding beyond the story file.

It is built for a Year 11 Industrial Technology Multimedia task (NSW, Australia), where students film branching scenes and author the story flow.

**Users**

- **Students (authors):** write the story file, supply media and optionally restyle the look.
- **Viewers and markers:** play the story and make choices.
- **Teacher:** sets up the template, checks projects and uses the story map for feedback.

**Goals**

1. Low barrier: any student can produce a working interactive film by editing one text file.
2. Smooth playback: 720p and 1080p clips of 5 to 30 seconds play without noticeable dropped frames or gaps.
3. Teaches story structure: the story file and story map make branching logic visible.
4. Supports web design learning: students can customise buttons and styling with basic CSS and their own Photoshop graphics.
5. Forgiving: mistakes produce plain-English messages that say exactly what to fix.

## Scope

Version 1 covers branching video playback, authoring through one text file, error checking and basic customisation. Remembering earlier choices is deliberately left for a later version.

| Area | In version 1 | Not in version 1 |
| --- | --- | --- |
| Authoring | Plain-text story file in a fixed layout | Visual drag-and-drop editor |
| Scenes | Video, still image with music, text card | Live web content, YouTube embeds |
| Choices | 2 to 4 per scene, optional timer and default | Choices that depend on earlier choices (variables) |
| Navigation | Title screen, ending screens, Play again | Back button, chapter select, save and resume |
| Feedback | Error checker, story map | Analytics, path recording |
| Look | Default theme, editable CSS, image buttons | Theme builder |
| Delivery | Offline, local folder, double-click to open | Hosting, uploading, mobile apps |

The story file format must leave room for variables later, so version 2 can add them without breaking version 1 stories.

## Project folder structure

Every project is one folder that students copy from a template. Students edit two files and add media; the engine stays untouched.

```
My-Story/
  PLAY.html          double-click to play
  story.js           the story file (students edit)
  style.css          the look (students may edit)
  media/             all videos, images and audio
    movie1_cadburyegg.mp4
    movie2_cadburyegg.mp4
    movie3_indian.mp4
    movie4_pool.mp4
    ambient.mp3
  firecut/           the engine (do not edit)
    firecut.js
    firecut.css
```

- The whole folder is zipped to submit, and plays on any Windows machine with Chrome or Edge.
- All media lives in `media/`, so the story file only ever needs file names, never paths.
- File names must use lowercase letters, numbers, hyphens and underscores only. The error checker warns about anything else.

## Story file format

The story lives in `story.js` as plain text between two fixed lines that students never change. Saving it as a .js file is what lets the story open by double-clicking, with no local server.

**Example (shows every keyword)**

```
FireCut.story(`

TITLE: Lost in the Library
START: intro
WAIT-LOOP: ambient.mp3

# Opening scene
SCENE: intro
VIDEO: intro.mp4
CHOICE: Take the stairs -> stairs
CHOICE: Use the lift -> lift

SCENE: stairs
VIDEO: stairs.mp4
CHOICES-AT: 4
TIMER: 8 -> lift
CHOICE: Open the door -> door
CHOICE: Keep climbing -> roof | btn-up.png

SCENE: lift
IMAGE: lift-sign.png
MUSIC: tension.mp3
TEXT: The lift is broken. You hear footsteps.
CHOICE: Run! -> escape

SCENE: escape
VIDEO: escape.mp4
ENDING: You made it out!

`);
```

**Test story (the first demo, using the sample clips in the folder above)**

```
FireCut.story(`

TITLE: Cadbury Egg
START: intro

SCENE: intro
VIDEO: movie1_cadburyegg.mp4
CHOICE: Continue -> continue
CHOICE: Get Indian -> indian
CHOICE: Get in the pool -> pool

SCENE: continue
VIDEO: movie2_cadburyegg.mp4
ENDING: Sweet ending! The egg was worth the wait.

SCENE: indian
VIDEO: movie3_indian.mp4
ENDING: Spicy ending! Butter chicken wins the day.

SCENE: pool
VIDEO: movie4_pool.mp4
ENDING: Splash ending! Nobody saw that cannonball coming.

`);
```

**Rules**

- One instruction per line, written as `KEYWORD: value`. Keywords are not case-sensitive.
- A blank line between scenes keeps the file readable but is not required.
- Lines starting with `#` are notes for the author and are ignored.
- Scene names use lowercase letters, numbers and hyphens, such as `good-ending`.
- Choices use `->` to point to the next scene, and an optional `|` adds a button image.
- Students must not type a backtick character (`) anywhere in the story, because it ends the story text.

**Story keywords** (once, at the top)

| Keyword | Required | What it does | Example |
| --- | --- | --- | --- |
| TITLE | Yes | Name shown on the title screen | `TITLE: Lost in the Library` |
| START | Yes | The first scene to play | `START: intro` |
| TITLE-BACKGROUND | No | Image or video behind the title screen (a video loops, muted) | `TITLE-BACKGROUND: poster.png` |
| TITLE-OVERLAY | No | See-through PNG laid over the title background, under the Start button | `TITLE-OVERLAY: logo.png` |
| WAIT-LOOP | No | Default audio that loops while choices are shown | `WAIT-LOOP: ambient.mp3` |

**Scene keywords** (under each SCENE line)

| Keyword | Required | What it does | Example |
| --- | --- | --- | --- |
| SCENE | Yes | Starts a new scene and names it | `SCENE: stairs` |
| VIDEO | One of VIDEO, IMAGE or TEXT | Plays an MP4 clip | `VIDEO: stairs.mp4` |
| IMAGE | One of VIDEO, IMAGE or TEXT | Shows a still image | `IMAGE: map.png` |
| TEXT | One of VIDEO, IMAGE or TEXT | Shows a text card, or a caption over an image | `TEXT: Two hours later...` |
| MUSIC | No | Audio for an image or text scene | `MUSIC: tension.mp3` |
| DURATION | No | Seconds an image or text scene shows before its choices appear (default 3) | `DURATION: 5` |
| CHOICE | One of CHOICE, NEXT or ENDING | A button: label, target scene, optional image | `CHOICE: Run -> escape \| btn-run.png` |
| NEXT | One of CHOICE, NEXT or ENDING | Moves straight to another scene with no choice, used to merge branches | `NEXT: hallway` |
| ENDING | One of CHOICE, NEXT or ENDING | Marks an ending and sets its message | `ENDING: You made it out!` |
| CHOICES-AT | No | Shows choices this many seconds before the clip ends, while it keeps playing | `CHOICES-AT: 4` |
| TIMER | No | Countdown in seconds, then the named default choice is taken | `TIMER: 8 -> lift` |
| WAIT-LOOP | No | Overrides the story's waiting audio for this scene, or `none` for silence | `WAIT-LOOP: none` |

`SET` and `IF` are reserved for version 2 variables. If a student uses them now, the checker explains that they are not available yet.

## Playback behaviour

A viewer moves from the title screen through scenes and choices to an ending, then can play again. There is no back button, so every choice counts.

**Title screen**

- Shows the story title over the title background, with a large Start button.
- Clicking Start also unlocks sound, because browsers block audio until the viewer clicks something.
- A small Story map button sits in the corner (see Story map).

**Scenes**

- Video scenes play full screen in the browser window, scaled to fit with no stretching.
- Image and text scenes show for their DURATION, with MUSIC if set, then show their choices.
- A scene with NEXT moves straight on when it finishes.
- Clips for every possible next scene preload in the background, so the next clip starts with no visible gap.

**Choices**

- Default: when the clip ends, the video holds on its last frame and 2 to 4 large buttons appear near the bottom of the screen.
- With CHOICES-AT, the buttons appear that many seconds before the end while the video keeps playing. If the clip ends first, it holds on the last frame.
- Viewers can click a button or press its number key (1 to 4).
- Buttons use the default theme, or the student's image if one is given.

**Waiting loop**

- While choices are on screen, the scene's WAIT-LOOP plays, or else the story's WAIT-LOOP. With neither, it stays silent.
- The loop fades in over 1 second and fades out over 0.5 seconds when a choice is made.

**Timer**

- With TIMER, a bar across the top of the screen shrinks over the set seconds.
- When it runs out, the named default choice is taken, and that button briefly highlights so the viewer sees what happened.

**Endings**

- An ending scene plays its media, then shows its ENDING message with a Play again button that returns to the title screen.
- The ending screen also says which ending number this was, such as "Ending 2 of 3", to encourage replays.

**Viewer controls**

- F toggles full screen, Space pauses and resumes, and M mutes.
- There is no seek bar, so viewers can't skip ahead through scenes.

## Error checker

Every time PLAY.html opens, FireCut checks the story before the title screen appears. Errors stop playback; warnings let the story play but stay listed on a Checks panel.

Each message names the line number, says what is wrong in plain English and suggests the fix, for example: *Line 14: the choice "Keep climbing" points to a scene called "rooof", but there is no scene with that name. Check the spelling.*

| Check | Type |
| --- | --- |
| story.js could not be read at all, usually a stray backtick or a deleted first or last line | Error |
| TITLE or START is missing | Error |
| START names a scene that doesn't exist | Error |
| A CHOICE, NEXT or TIMER points to a scene that doesn't exist | Error |
| Two scenes share the same name | Error |
| A scene has no VIDEO, IMAGE or TEXT | Error |
| A scene has no CHOICE, NEXT or ENDING, so the story would get stuck | Error |
| A scene has more than 4 choices | Error |
| A media file named in the story is missing from media/ | Error |
| A line starts with an unknown keyword, with a guess at the intended one | Error |
| SET or IF is used (reserved for version 2) | Error |
| A scene can never be reached from START | Warning |
| A file name has capitals or spaces, which can break when the project moves computers | Warning |
| A TIMER default isn't one of that scene's choices | Warning |
| The story uses more than 12 clips | Warning |
| A video won't play in the browser, usually the wrong format | Warning, shown when the clip is tested |

The Checks panel can be opened from the title screen at any time, so students can confirm a clean story before submitting.

## Story map (nice to have)

The Story map button on the title screen draws the whole story as a flowchart, built automatically from story.js. Students screenshot it for their folio, and teachers use it to check structure at a glance.

- Each scene is a box labelled with its name and media type. The START scene is marked, and endings are highlighted in a different colour.
- Arrows show each choice, labelled with the button text. NEXT and TIMER defaults use a dashed arrow.
- Scenes that can't be reached and scenes with errors are greyed or outlined in red, matching the Checks panel.
- Clicking a box plays the story from that scene, so authors can test one branch without starting over.
- The map is drawn with built-in code only, with no internet or extra libraries, and fits the screen for a clean screenshot.

## Customisation

The default theme looks finished with no changes, so customising is optional. Students who want their own look have three levels, each a step deeper into web design.

1. **Change the variables:** the top of style.css holds a short list of commented settings, such as button colour, hover colour, font, button size and corner roundness. Changing a value is the first CSS step.
2. **Write their own rules:** style.css documents the class names FireCut uses, such as `.fc-choice`, `.fc-title` and `.fc-timer`, so students can add hover effects, shadows or animations.
3. **Use image buttons:** a CHOICE with `| image.png` replaces that button with the student's own Photoshop graphic. A matching `image-hover.png`, if present, is used automatically on hover.

**Example settings at the top of style.css**

```
:root {
  --button-colour: #e8452c;
  --button-hover-colour: #ff6a3d;
  --button-text-colour: #ffffff;
  --font: "Segoe UI", Arial, sans-serif;
  --button-roundness: 12px;
}
```

Fonts must be installed on the computer or included in the project folder, because the player runs offline.

## Technical requirements

FireCut targets Chrome and Edge on the school's Windows lab machines, fully offline, opened straight from the folder.

| Requirement | Specification |
| --- | --- |
| Browsers | Current Chrome and Edge on Windows |
| Network | None: works with no internet and no local server |
| Opening | Double-click PLAY.html (file opened directly from the folder) |
| Engine | Plain HTML, CSS and JavaScript, no external libraries or downloads |
| Video | MP4 (H.264 video, AAC audio), 720p or 1080p, 25 fps |
| Recommended video bitrate | 5 to 8 Mbps at 1080p, keeping a 30-second clip around 20 to 30 MB |
| Images | PNG or JPG; PNG for buttons with transparency |
| Audio | MP3 |
| Clip length | 5 to 30 seconds per scene |
| Scene changes | Next clip starts within 0.5 seconds of a choice |
| Project size | Aim for under 500 MB per zipped project |

**Technical decisions**

- The story is loaded as a script file rather than read as a text file, because browsers block pages opened from a folder from reading other files.
- Videos load through standard video tags, which work from a local folder in Chrome and Edge.
- Preloading only the next possible scenes keeps memory use low on older lab machines.
- The After Effects and Premiere export settings students need (H.264, 1080p, 25 fps) match what the earlier task already uses.

## Deliverables, testing and next steps

**Deliverables**

1. The FireCut engine (firecut.js and firecut.css).
2. A student template folder with PLAY.html, a starter story.js, a commented style.css and an empty media folder.
3. A short demo story with at least 6 scenes, one timer, one image scene and 2 endings, using placeholder clips.
4. A one-page student quick-start guide covering the story keywords and common errors.
5. Brief teacher notes on setup, checking projects and submission.

**Acceptance tests**

- [ ] Demo opens by double-clicking PLAY.html on a lab machine with the network unplugged
- [ ] A 1080p, 30-second clip plays with no visible stutter
- [ ] Choosing moves to the next clip within 0.5 seconds
- [ ] Waiting loop fades in and out correctly, and stays silent when set to none
- [ ] Timer takes the default choice and highlights it
- [ ] Every error in the checker table produces its plain-English message with the right line number
- [ ] Story map matches the story, and clicking a box plays from that scene
- [ ] Changing a CSS variable and adding an image button both work
- [ ] A zipped project still plays after being copied to another computer

**Future versions**

- Version 2: variables with SET and IF, so earlier choices can change later options.
- Captions from subtitle files, a walkthrough recording mode for markers, and save and resume.

**Open questions**

- Will students submit by OneDrive, USB or Canvas, given project sizes of up to about 500 MB?
- Should the template include a folio-ready Story map export, or are screenshots enough?
