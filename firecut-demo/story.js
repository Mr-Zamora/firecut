FireCut.story(`

TITLE: The Golden Egg: Secrets of the Sunset
START: intro
TITLE-BACKGROUND: title-bg.jpg
TITLE-MUSIC: title.mp3
WAIT-LOOP: ambient.mp3

SCENE: intro
VIDEO: movie1_cadburyegg.mp4
CHOICE: Say hello -> hello
CHOICE: Compliment the egg -> compliment

SCENE: hello
VIDEO: movie2_cadburyegg.mp4
CHOICES-AT: 4
CHOICE: Ask it on a date -> love-letter
CHOICE: Chicken out -> nervous

SCENE: compliment
VIDEO: movie3_cadburyegg.mp4
TIMER: 6 -> swoon
CHOICE: Keep the flattery coming -> swoon
CHOICE: Take it slow -> love-letter

SCENE: swoon
VIDEO: movie4_cadburyegg.mp4
WAIT-LOOP: none
CHOICE: Seal it with a kiss -> happily-ever-after
CHOICE: Play hard to get -> friendzone

SCENE: love-letter
IMAGE: love-letter.jpg
TEXT: You write the egg a love letter in gold ink.
MUSIC: ambient.mp3
DURATION: 5
CHOICE: Hand it over -> confession

SCENE: confession
VIDEO: movie5_cadburyegg.mp4
CHOICE: Pop the question -> happily-ever-after
CHOICE: Suggest just being friends -> friendzone

SCENE: nervous
VIDEO: movie6_cadburyegg.mp4
ENDING: Awkward ending! The egg was too shy to answer, and so were you.

SCENE: happily-ever-after
IMAGE: yes.jpg
TEXT: The egg said yes. Golden hour lasts forever now.
MUSIC: ambient.mp3
DURATION: 4
ENDING: Sweet ending! True love never melts.

SCENE: friendzone
IMAGE: friendzone.jpg
TEXT: Just friends, then. The egg appreciates the honesty.
DURATION: 4
ENDING: Bittersweet ending! Some eggs are meant to stay wrapped.

`);
