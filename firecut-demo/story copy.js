FireCut.story(`

# ============================================================
# THE GOLDEN EGG - beginner version
#
# Lines starting with # are notes. The player ignores them.
#
# How it works:
#   Each SCENE shows one thing (a VIDEO or an IMAGE).
#   Then it gives the viewer CHOICEs, or it ENDs the story.
#   A choice looks like:  CHOICE: Button words -> scene-name
#
# Every video and image in media/ is used exactly once.
# ============================================================


# ---------- The title screen ----------

TITLE: The Golden Egg
START: intro
TITLE-BACKGROUND: title-bg.jpg
TITLE-MUSIC: title.mp3
WAIT-LOOP: ambient.mp3


# ---------- The story starts here ----------

SCENE: intro
VIDEO: movie1_cadburyegg.mp4
CHOICE: Say hello -> hello
CHOICE: Compliment the egg -> compliment


SCENE: hello
VIDEO: movie2_cadburyegg.mp4
CHOICE: Ask it on a date -> love-letter
CHOICE: Chicken out -> nervous


SCENE: compliment
VIDEO: movie3_cadburyegg.mp4
CHOICE: Keep the compliments coming -> swoon
CHOICE: Take it slow -> love-letter


# An image scene. TEXT puts words over the picture.
# DURATION: the picture shows for 5 seconds, THEN the choices appear.
# TIMER: once the choices appear, a bar counts down 6 seconds.
#        If nobody clicks, it picks "Hand it over" for you.
#        The TIMER scene must also be one of the CHOICEs.
SCENE: love-letter
IMAGE: love-letter.jpg
TEXT: You write the egg a love letter in gold ink. Quick, before you lose your nerve!
DURATION: 5
TIMER: 6 -> confession
CHOICE: Hand it over -> confession
CHOICE: Read it out loud -> swoon
CHOICE: Hide the letter -> nervous


SCENE: swoon
VIDEO: movie4_cadburyegg.mp4
CHOICE: Seal it with a kiss -> happily-ever-after
CHOICE: Play hard to get -> friendzone


SCENE: confession
VIDEO: movie5_cadburyegg.mp4
CHOICE: Pop the question -> happily-ever-after
CHOICE: Suggest just being friends -> friendzone


# ---------- The endings ----------
# A scene with ENDING finishes the story and shows a Play again button.

SCENE: nervous
VIDEO: movie6_cadburyegg.mp4
ENDING: Awkward ending! The egg was too shy to answer, and so were you.


SCENE: happily-ever-after
IMAGE: yes.jpg
TEXT: The egg said yes!
DURATION: 4
ENDING: Sweet ending! True love never melts.


SCENE: friendzone
IMAGE: friendzone.jpg
TEXT: Just friends, then.
DURATION: 4
ENDING: Bittersweet ending! Some eggs are meant to stay wrapped.

`);