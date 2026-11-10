FireCut.story(`

# ============================================================
# THE GOLDEN EGG - keyword showcase
# A short story that uses every keyword and pattern in STORY.md.
# Notes starting with # explain each technique. The player
# ignores them.
#
# Rules this story follows:
# - Every video and image is used in exactly one scene.
# - No path loops back, so nothing is shown twice.
# - Every playthrough is 5 scenes or fewer.
# ============================================================

TITLE: The Golden Egg: Secrets of the Sunset
START: intro
TITLE-BACKGROUND: title-bg.jpg
TITLE-MUSIC: title.mp3
# WAIT-LOOP at the top = the default audio while choices are shown.
WAIT-LOOP: ambient.mp3


# ------------------------------------------------------------
# TECHNIQUE: caption over a video (TEXT on a VIDEO scene)
# TECHNIQUE: choices at the end of a clip
# ------------------------------------------------------------
SCENE: intro
VIDEO: movie1_cadburyegg.mp4
TEXT: Golden hour. A shimmering egg sits alone on the windowsill.
CHOICE: Say hello -> hello
CHOICE: Compliment the egg -> compliment


# ------------------------------------------------------------
# TECHNIQUE: buttons while the clip is still playing (CHOICES-AT)
# ------------------------------------------------------------
SCENE: hello
VIDEO: movie2_cadburyegg.mp4
CHOICES-AT: 4
CHOICE: Ask it on a date -> love-letter
CHOICE: Chicken out -> nervous


# ------------------------------------------------------------
# TECHNIQUE: a timer picks the default if nobody clicks (TIMER)
# The TIMER target must also be one of the CHOICEs.
# ------------------------------------------------------------
SCENE: compliment
VIDEO: movie3_cadburyegg.mp4
TIMER: 6 -> swoon
CHOICE: Keep the flattery coming -> swoon
CHOICE: Take it slow -> love-letter


# ------------------------------------------------------------
# TECHNIQUE: a second timer, this time leading to an ending
# TECHNIQUE: caption over a video
# ------------------------------------------------------------
SCENE: nervous
VIDEO: movie6_cadburyegg.mp4
TEXT: Your mouth goes dry. The egg waits politely.
TIMER: 5 -> walk-away
CHOICE: Run for it -> walk-away
CHOICE: Blurt out something sweet -> swoon


# ------------------------------------------------------------
# TECHNIQUE: image + caption + music + duration (a pause scene)
# TECHNIQUE: NEXT moves on by itself - no buttons
# TECHNIQUE: merge - both hello and compliment lead here
# ------------------------------------------------------------
SCENE: love-letter
IMAGE: love-letter.jpg
TEXT: You write the egg a love letter in gold ink and slide it across the windowsill.
MUSIC: ambient.mp3
DURATION: 5
NEXT: confession


# ------------------------------------------------------------
# TECHNIQUE: WAIT-LOOP none = silence while choices are up
# TECHNIQUE: merge - both compliment and nervous lead here
# ------------------------------------------------------------
SCENE: swoon
VIDEO: movie4_cadburyegg.mp4
WAIT-LOOP: none
CHOICE: Seal it with a kiss -> happily-ever-after
CHOICE: Play hard to get -> friendzone


# ------------------------------------------------------------
# TECHNIQUE: WAIT-LOOP with a different file for just this scene
# ------------------------------------------------------------
SCENE: confession
VIDEO: movie5_cadburyegg.mp4
WAIT-LOOP: title.mp3
CHOICE: Pop the question -> happily-ever-after
CHOICE: Suggest just being friends -> friendzone


# ============================================================
# ENDINGS (3)
# ============================================================

# TECHNIQUE: image ending with a caption and music
SCENE: happily-ever-after
IMAGE: yes.jpg
TEXT: The egg said yes. Golden hour lasts forever now.
MUSIC: ambient.mp3
DURATION: 4
ENDING: Sweet ending! True love never melts.

# TECHNIQUE: image ending with a caption, no music
SCENE: friendzone
IMAGE: friendzone.jpg
TEXT: Just friends, then. The egg appreciates the honesty.
DURATION: 4
ENDING: Bittersweet ending! Some eggs are meant to stay wrapped.

# TECHNIQUE: text-only ending card (no image or video)
SCENE: walk-away
TEXT: You bolt out the door. Behind you, the egg sighs a tiny golden sigh.
DURATION: 4
ENDING: Awkward ending! The egg was too shy to answer, and so were you.

`);