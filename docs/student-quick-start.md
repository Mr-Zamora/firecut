# FireCut - Student Quick Start

FireCut turns your video clips plus one text file into a
choose-your-own-adventure film. You only edit `story.js`
and `style.css`, and drop media files into `media/`.

## Your project folder

```
My-Story/
  PLAY.html      double-click this to play
  story.js       your story (edit this)
  style.css      the look (you may edit)
  media/         all your videos, images and sound
  firecut/       the engine - do not edit
```

## story.js rules

- One instruction per line: `KEYWORD: value`
- Never change or delete the first and last lines of story.js:

```
FireCut.story(`
   ... your story goes here ...
`);
```

- Never type a backtick (the key left of 1) inside the story - it breaks the file
- Lines starting with `#` are notes and are ignored
- Scene names: lowercase letters, numbers and hyphens only

## Story keywords (top of file, once)

| Keyword | What it does | Example |
| --- | --- | --- |
| TITLE | Name on the title screen (required) | `TITLE: Lost in the Library` |
| START | First scene to play (required) | `START: intro` |
| TITLE-BACKGROUND | Image, or a silent looping video, behind the title screen | `TITLE-BACKGROUND: poster.png` |
| TITLE-OVERLAY | See-through PNG over the background (logo or title art) | `TITLE-OVERLAY: logo.png` |
| TITLE-MUSIC | Music on the title screen (starts on the first click) | `TITLE-MUSIC: theme.mp3` |
| WAIT-LOOP | Audio loop while choices are shown | `WAIT-LOOP: ambient.mp3` |

## Scene keywords (under each SCENE line)

| Keyword | What it does | Example |
| --- | --- | --- |
| SCENE | Starts a scene and names it | `SCENE: stairs` |
| VIDEO | Plays an mp4 clip | `VIDEO: stairs.mp4` |
| IMAGE | Shows a still image | `IMAGE: map.png` |
| TEXT | Text card, or caption over an image | `TEXT: Two hours later...` |
| MUSIC | Audio for image or text scenes | `MUSIC: tension.mp3` |
| DURATION | Seconds an image/text scene shows (default 3) | `DURATION: 5` |
| CHOICE | Button: label, target scene, optional image | `CHOICE: Run -> escape` |
| NEXT | Moves straight to a scene, no buttons | `NEXT: hallway` |
| ENDING | Ending message, adds Play again | `ENDING: You made it out!` |
| CHOICES-AT | Shows choices this many seconds before the clip ends | `CHOICES-AT: 4` |
| TIMER | Countdown, then takes that scene by default | `TIMER: 8 -> lift` |
| WAIT-LOOP | Overrides the story's loop for this scene, or `none` | `WAIT-LOOP: none` |

Every scene needs **one of** VIDEO, IMAGE or TEXT, and **one of**
CHOICE (up to 4), NEXT or ENDING.

## Example

```
SCENE: stairs
VIDEO: stairs.mp4
CHOICES-AT: 4
TIMER: 8 -> lift
CHOICE: Open the door -> door
CHOICE: Keep climbing -> roof | btn-up.png
```

## If PLAY.html shows errors

The checker tells you the line number and the fix. The most common ones:

| Message means | Fix |
| --- | --- |
| story could not be read | stray backtick, or deleted first/last line of story.js |
| choice points to a scene that does not exist | spelling of the scene name after `->` |
| no VIDEO, IMAGE or TEXT | add one inside the scene |
| no CHOICE, NEXT or ENDING | the story gets stuck - add an exit |
| file missing from media/ | check the file name matches exactly |
| unknown keyword | spelling of the KEYWORD (it suggests one) |
| SET / IF | not available yet - delete the line |

## Player controls

F = full screen, Space = pause, M = mute, 1-4 = pick a choice.
The Checks button on the title screen lists warnings.
The Story map button draws your whole story - screenshot it for the folio.
