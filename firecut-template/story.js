FireCut.story(`

# Your story lives between these two lines. Never delete them,
# and never type a backtick (`) inside your story.
# Full guide: STORY.md in this folder.

TITLE: My Story
START: intro

# Change the title above to your story's name.
# Optional extras you can add here:
#   TITLE-BACKGROUND: poster.jpg   (image behind the title screen)
#   TITLE-MUSIC: theme.mp3         (music on the title screen)
#   WAIT-LOOP: ambient.mp3         (audio while choices are shown)

# This starter works with no media files. When your clips are ready,
# drop them in media/ and swap the TEXT lines for VIDEO lines like:
#   VIDEO: movie1.mp4

SCENE: intro
TEXT: A mysterious egg sits on the table in front of you.
CHOICE: Talk to it -> hello
CHOICE: Walk away -> walk-away

SCENE: hello
TEXT: The egg seems to shimmer in the light. It might be listening.
CHOICE: Compliment it -> compliment
CHOICE: Leave quietly -> walk-away

SCENE: compliment
TEXT: The egg glows a little brighter. It is blushing.
ENDING: Sweet ending! You made a golden friend.

SCENE: walk-away
TEXT: You leave the egg behind. It watches you go.
ENDING: A quiet ending! Some mysteries stay unsolved.

`);
