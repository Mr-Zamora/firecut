# STORY.md - How to Write Your Story

This guide is for storytellers, not coders. Your whole interactive film is
one file called `story.js`. Open it in Notepad or any text editor, write
your story, save, and double-click `PLAY.html` to watch it.

## The big picture

Your story is a set of **scenes**. Each scene shows something
(a video, an image, or text) and then either asks the viewer to pick a
choice, moves on by itself, or ends the story.

```
intro -> "Say hello" -> hello -> "Ask it on a date" -> love-letter -> ENDING
      -> "Chicken out" -> nervous ---------------------------------> ENDING
```

## The five rules that keep it working

| # | Rule | If you break it |
|---|---|---|
| 1 | First line must stay `FireCut.story(` followed by a backtick | story cannot be read at all |
| 2 | Last line must stay a backtick then `);` | story cannot be read at all |
| 3 | Never type a backtick `` ` `` inside your story | story cannot be read at all |
| 4 | One instruction per line, written `KEYWORD: value` | error tells you the line number |
| 5 | Scene names use lowercase letters, numbers and hyphens | error tells you the line number |

Also handy: start a line with `#` to write a note to yourself. The player
ignores it. Blank lines are fine anywhere - use them between scenes.

## Story keywords - only at the very top, before any SCENE

| Keyword | Required? | What it does | Example |
|---|---|---|---|
| TITLE | Yes | The story's name (also names the browser tab) | `TITLE: The Golden Egg` |
| START | Yes | Which scene plays first | `START: intro` |
| TITLE-BACKGROUND | No | Image behind the title screen | `TITLE-BACKGROUND: poster.jpg` |
| TITLE-MUSIC | No | Music on the title screen (starts on first click) | `TITLE-MUSIC: theme.mp3` |
| WAIT-LOOP | No | Audio that loops while choices are shown | `WAIT-LOOP: ambient.mp3` |

## Scene keywords - inside each SCENE block

Everything under `SCENE: name` belongs to that scene, until the next
`SCENE:` line.

| Keyword | What it does | Example |
|---|---|---|
| VIDEO | Plays an mp4 clip full screen | `VIDEO: stairs.mp4` |
| IMAGE | Shows a still image | `IMAGE: map.jpg` |
| TEXT | Text card, or a caption over an IMAGE or VIDEO | `TEXT: Two hours later...` |
| MUSIC | Audio that plays during an image or text scene | `MUSIC: tension.mp3` |
| DURATION | Seconds an image/text scene shows before choices (default 3) | `DURATION: 5` |
| CHOICE | A button: `CHOICE: Label -> scene-name` | `CHOICE: Run! -> escape` |
| NEXT | Move straight to another scene, no buttons | `NEXT: hallway` |
| ENDING | Ending message + Play again button | `ENDING: You made it out!` |
| CHOICES-AT | Show choices this many seconds before the clip ends | `CHOICES-AT: 4` |
| TIMER | Countdown bar; takes that scene if nobody clicks | `TIMER: 8 -> lift` |
| WAIT-LOOP | Different wait audio for this scene, or `none` for silence | `WAIT-LOOP: none` |

## What every scene needs

| One of these (the "thing on screen") | One of these (the "way out") |
|---|---|
| `VIDEO:` | `CHOICE:` (up to 4 buttons) |
| `IMAGE:` | `NEXT:` |
| `TEXT:` | `ENDING:` |

## Choices in detail

```
CHOICE: Open the door -> door
CHOICE: Keep climbing -> roof
CHOICE: Order butter chicken -> indian
```

- Left of `->` is the button text (what the viewer reads).
- Right of `->` is the scene name it jumps to.
- Buttons appear in the order you write them; keys 1-4 match that order.
- Maximum 4 choices per scene.
- Add `| image.png` to use your own button graphic:
  `CHOICE: Open the door -> door | btn-door.png`
- If a file called `btn-door-hover.png` exists, it shows on hover.

## Common patterns - copy these

**A scene that asks a question at the end of a clip**

```
SCENE: intro
VIDEO: intro.mp4
CHOICE: Say hello -> hello
CHOICE: Walk past -> ignore
```

**Buttons while the clip is still playing**

```
SCENE: chase
VIDEO: chase.mp4
CHOICES-AT: 4
CHOICE: Turn left -> alley
CHOICE: Turn right -> street
```

**A timer so the story moves if nobody chooses**

```
SCENE: knock
VIDEO: knock.mp4
TIMER: 6 -> open-door
CHOICE: Open the door -> open-door
CHOICE: Hide -> cupboard
```

The TIMER target must be one of the scene's CHOICE targets.

**An image scene with a caption and music**

```
SCENE: map-room
IMAGE: map.jpg
TEXT: The map shows a way out through the cellars.
MUSIC: tension.mp3
DURATION: 5
CHOICE: Take the cellars -> cellar
```

**Merge two branches into one scene**

```
SCENE: both-paths
VIDEO: path.mp4
CHOICE: Go on -> together
CHOICE: Go back -> together

SCENE: together
VIDEO: together.mp4
ENDING: The paths met again anyway.
```

**A text-only ending card**

```
SCENE: caught
TEXT: The alarm blares. It is over.
ENDING: Bad ending! The guards heard everything.
```

## Media files - everything goes in `media/`

| Type | Files | Notes |
|---|---|---|
| Video | `.mp4` (H.264, 720p or 1080p, 25 fps) | plays full screen |
| Image | `.png` or `.jpg` | fits the screen, not stretched |
| Audio | `.mp3` | wait loops, title music, scene music |

File names: **lowercase letters, numbers, hyphens, underscores only**.
No capitals, no spaces. The checker warns you about anything else.

## Checking your work

| Where | What it shows |
|---|---|
| Opening `PLAY.html` | Errors stop the story and list the line number + fix |
| **Checks** button (title screen) | Warnings: unreachable scenes, bad file names, timer mistakes |
| **Story map** button | Draws the whole story; click a box to play from that scene |

## The most common mistakes

| Message | What it means |
|---|---|
| story file could not be read | stray backtick, or first/last line changed |
| points to a scene that does not exist | spelling of the name after `->` |
| no VIDEO, IMAGE or TEXT | the scene shows nothing - add one |
| no CHOICE, NEXT or ENDING | the story gets stuck - add a way out |
| unknown keyword | spelling of the KEYWORD (it suggests one) |
| needs to be under a SCENE line | keyword is above the first SCENE |
| belongs at the top | TITLE/START/etc is inside a scene |
| file is missing from media | file name does not match exactly |

## Player controls (for your viewers)

`F` full screen - `Space` pause - `M` mute - `1-4` pick a choice.

## When to use which keyword

- Want buttons *after* the clip ends? Just CHOICE lines.
- Want buttons *during* the clip? CHOICES-AT + CHOICE lines.
- Want the story to move on its own? NEXT, or TIMER + CHOICEs.
- Want a pause in the action with music? IMAGE + TEXT + MUSIC + DURATION.
- Want silence while a scene's choices are up? WAIT-LOOP: none on that scene.
- Reaching a dead end? ENDING.

That is the whole system. Write scenes, join them with arrows, and check
the Story map to see your plot draw itself.
