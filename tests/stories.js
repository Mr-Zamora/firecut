/* Test stories for the FireCut parser and checker.
 * Shared by the WSH harness (run-check-tests.js) and the browser test
 * page (parser-test.html). Written in ES3-safe JavaScript.
 *
 * Each fixture:
 *   name     - short label
 *   text     - the raw story text (what goes inside FireCut.story(`...`))
 *   errors   - expected errors, each {line: n, has: 'substring'}.
 *              The test fails if the counts differ or a substring is absent.
 *   warnings - expected warnings, same shape.
 *   media    - expected probe results [{file, status}] (browser page only;
 *              status is ok | missing | unplayable | badext)
 */

var TEST_STORIES = [
  {
    name: 'good (the spec test story)',
    text: "\nTITLE: Cadbury Egg\nSTART: intro\n\nSCENE: intro\nVIDEO: movie1_cadburyegg.mp4\nCHOICE: Continue -> continue\nCHOICE: Get Indian -> indian\nCHOICE: Get in the pool -> pool\n\nSCENE: continue\nVIDEO: movie2_cadburyegg.mp4\nENDING: Sweet ending! The egg was worth the wait.\n\nSCENE: indian\nVIDEO: movie3_indian.mp4\nENDING: Spicy ending! Butter chicken wins the day.\n\nSCENE: pool\nVIDEO: movie4_pool.mp4\nENDING: Splash ending! Nobody saw that cannonball coming.\n",
    errors: [],
    warnings: [],
    media: [
      { file: 'movie1_cadburyegg.mp4', status: 'ok' },
      { file: 'movie2_cadburyegg.mp4', status: 'ok' },
      { file: 'movie3_indian.mp4', status: 'ok' },
      { file: 'movie4_pool.mp4', status: 'ok' }
    ]
  },

  {
    name: 'missing TITLE',
    text: "START: intro\n\nSCENE: intro\nVIDEO: a.mp4\nENDING: done\n",
    errors: [{ line: 0, has: 'TITLE' }],
    warnings: []
  },

  {
    name: 'missing START',
    text: "TITLE: Test\n\nSCENE: intro\nVIDEO: a.mp4\nENDING: done\n",
    errors: [{ line: 0, has: 'START' }],
    warnings: []
  },

  {
    name: 'START points nowhere',
    text: "TITLE: Test\nSTART: nowhere\n\nSCENE: intro\nVIDEO: a.mp4\nENDING: done\n",
    errors: [{ line: 2, has: '"nowhere"' }],
    warnings: []
  },

  {
    name: 'CHOICE points nowhere (+ unreachable scene)',
    text: "TITLE: Test\nSTART: intro\n\nSCENE: intro\nVIDEO: a.mp4\nCHOICE: Keep climbing -> rooof\n\nSCENE: roof\nVIDEO: b.mp4\nENDING: done\n",
    errors: [{ line: 6, has: '"rooof"' }],
    warnings: [{ line: 8, has: 'never be reached' }]
  },

  {
    name: 'NEXT points nowhere',
    text: "TITLE: Test\nSTART: a\n\nSCENE: a\nVIDEO: a.mp4\nNEXT: gone\n\nSCENE: real\nVIDEO: b.mp4\nENDING: done\n",
    errors: [{ line: 6, has: '"gone"' }],
    warnings: [{ line: 8, has: 'never be reached' }]
  },

  {
    name: 'TIMER points nowhere',
    text: "TITLE: Test\nSTART: a\n\nSCENE: a\nVIDEO: a.mp4\nTIMER: 8 -> lift\nCHOICE: Stay -> a\n\nSCENE: lift2\nVIDEO: b.mp4\nENDING: done\n",
    errors: [{ line: 6, has: '"lift"' }],
    warnings: [{ line: 9, has: 'never be reached' }]
  },

  {
    name: 'duplicate scene name',
    text: "TITLE: Test\nSTART: a\n\nSCENE: a\nVIDEO: a.mp4\nENDING: done\n\nSCENE: a\nVIDEO: b.mp4\n",
    errors: [{ line: 8, has: 'already a scene called "a"' }],
    warnings: []
  },

  {
    name: 'scene with no media',
    text: "TITLE: Test\nSTART: a\n\nSCENE: a\nCHOICE: Go -> b\n\nSCENE: b\nVIDEO: b.mp4\nENDING: done\n",
    errors: [{ line: 4, has: 'no VIDEO, IMAGE or TEXT' }],
    warnings: []
  },

  {
    name: 'scene with no way out',
    text: "TITLE: Test\nSTART: a\n\nSCENE: a\nVIDEO: a.mp4\nCHOICE: Go -> b\n\nSCENE: b\nVIDEO: b.mp4\n",
    errors: [{ line: 8, has: 'no CHOICE, NEXT or ENDING' }],
    warnings: []
  },

  {
    name: 'five choices',
    text: "TITLE: Test\nSTART: a\n\nSCENE: a\nVIDEO: a.mp4\nCHOICE: One -> b\nCHOICE: Two -> b\nCHOICE: Three -> b\nCHOICE: Four -> b\nCHOICE: Five -> b\n\nSCENE: b\nVIDEO: b.mp4\nENDING: done\n",
    errors: [{ line: 10, has: '5 choices' }],
    warnings: []
  },

  {
    name: 'unknown keyword with guess',
    text: "TITLE: Test\nSTART: a\n\nSCENE: a\nVIDOE: a.mp4\nCHOICE: Go -> a\n",
    errors: [
      { line: 5, has: 'unknown keyword "VIDOE". Did you mean VIDEO' },
      { line: 4, has: 'no VIDEO, IMAGE or TEXT' }
    ],
    warnings: []
  },

  {
    name: 'SET and IF reserved',
    text: "TITLE: Test\nSTART: a\n\nSCENE: a\nVIDEO: a.mp4\nSET: mood = happy\nIF: mood = happy\nENDING: done\n",
    errors: [
      { line: 6, has: 'SET is not available' },
      { line: 7, has: 'IF is not available' }
    ],
    warnings: []
  },

  {
    name: 'file name with capitals and spaces',
    text: "TITLE: Test\nSTART: a\n\nSCENE: a\nVIDEO: My Clip.MP4\nENDING: done\n",
    errors: [],
    warnings: [{ line: 5, has: 'capitals' }]
  },

  {
    name: 'TIMER default not a choice',
    text: "TITLE: Test\nSTART: a\n\nSCENE: a\nVIDEO: a.mp4\nTIMER: 8 -> b\nCHOICE: Wait -> a\n\nSCENE: b\nVIDEO: b.mp4\nENDING: done\n",
    errors: [],
    warnings: [{ line: 6, has: 'not one of this scene' }]
  },

  {
    name: 'more than 12 clips',
    text: (function () {
      var t = "TITLE: Test\nSTART: s1\n";
      var i;
      for (i = 1; i <= 13; i++) {
        t += "\nSCENE: s" + i + "\nVIDEO: clip" + i + ".mp4\n";
        if (i < 13) { t += "NEXT: s" + (i + 1) + "\n"; }
        else { t += "ENDING: done\n"; }
      }
      return t;
    })(),
    errors: [],
    warnings: [{ line: 0, has: '13 video clips' }]
  },

  {
    name: 'scene keyword before first SCENE',
    text: "TITLE: Test\nSTART: a\nVIDEO: a.mp4\n\nSCENE: a\nVIDEO: a.mp4\nENDING: done\n",
    errors: [{ line: 3, has: 'needs to be under a SCENE line' }],
    warnings: []
  },

  {
    name: 'story keyword inside a scene',
    text: "TITLE: Test\nSTART: a\n\nSCENE: a\nVIDEO: a.mp4\nTITLE: Late Title\nENDING: done\n",
    errors: [{ line: 6, has: 'belongs at the top' }],
    warnings: []
  },

  {
    name: 'bad scene name',
    text: "TITLE: Test\nSTART: a\n\nSCENE: a\nVIDEO: a.mp4\nCHOICE: Go -> a\n\nSCENE: My Scene\nVIDEO: b.mp4\nENDING: done\n",
    errors: [{ line: 8, has: 'scene name "My Scene"' }],
    warnings: []
  },

  {
    name: 'choice missing arrow',
    text: "TITLE: Test\nSTART: a\n\nSCENE: a\nVIDEO: a.mp4\nCHOICE: Go somewhere\nENDING: done\n",
    errors: [{ line: 6, has: 'needs an arrow' }],
    warnings: []
  },

  {
    name: 'empty value after keyword',
    text: "TITLE:\nSTART: a\n\nSCENE: a\nVIDEO: a.mp4\nENDING: done\n",
    errors: [
      { line: 1, has: 'TITLE needs a value' },
      { line: 0, has: 'needs a TITLE' }
    ],
    warnings: []
  },

  {
    name: 'missing colon',
    text: "TITLE Lost in the Library\nSTART: a\n\nSCENE: a\nVIDEO: a.mp4\nENDING: done\n",
    errors: [
      { line: 1, has: 'needs a colon' },
      { line: 0, has: 'needs a TITLE' }
    ],
    warnings: []
  },

  {
    name: 'WAIT-LOOP inside a scene is allowed',
    text: "TITLE: Test\nSTART: a\nWAIT-LOOP: ambient.mp3\n\nSCENE: a\nVIDEO: a.mp4\nWAIT-LOOP: none\nCHOICE: Go -> b\n\nSCENE: b\nVIDEO: b.mp4\nWAIT-LOOP: quiet.mp3\nENDING: done\n",
    errors: [],
    warnings: []
  },

  {
    name: 'TITLE-MUSIC at the top is allowed',
    text: "TITLE: Test\nSTART: a\nTITLE-MUSIC: theme.mp3\n\nSCENE: a\nVIDEO: a.mp4\nENDING: done\n",
    errors: [],
    warnings: [],
    media: [{ file: 'theme.mp3', status: 'missing' }]
  },

  {
    name: 'TITLE-MUSIC inside a scene is an error',
    text: "TITLE: Test\nSTART: a\n\nSCENE: a\nVIDEO: a.mp4\nTITLE-MUSIC: theme.mp3\nENDING: done\n",
    errors: [{ line: 6, has: 'belongs at the top' }],
    warnings: []
  },

  {
    name: 'TITLE-BACKGROUND video + TITLE-OVERLAY png are allowed',
    text: "TITLE: Test\nSTART: a\nTITLE-BACKGROUND: loop.mp4\nTITLE-OVERLAY: logo.png\n\nSCENE: a\nVIDEO: a.mp4\nENDING: done\n",
    errors: [],
    warnings: []
  },

  {
    name: 'TITLE-BACKGROUND sound file warns',
    text: "TITLE: Test\nSTART: a\nTITLE-BACKGROUND: theme.mp3\n\nSCENE: a\nVIDEO: a.mp4\nENDING: done\n",
    errors: [],
    warnings: [{ line: 3, has: 'TITLE-MUSIC' }]
  },

  {
    name: 'TITLE-OVERLAY jpg warns',
    text: "TITLE: Test\nSTART: a\nTITLE-OVERLAY: logo.jpg\n\nSCENE: a\nVIDEO: a.mp4\nENDING: done\n",
    errors: [],
    warnings: [{ line: 3, has: 'cannot be see-through' }]
  },

  {
    name: 'TITLE-OVERLAY video warns',
    text: "TITLE: Test\nSTART: a\nTITLE-OVERLAY: loop.mp4\n\nSCENE: a\nVIDEO: a.mp4\nENDING: done\n",
    errors: [],
    warnings: [{ line: 3, has: 'use TITLE-BACKGROUND' }]
  },

  {
    name: 'TITLE-OVERLAY inside a scene is an error',
    text: "TITLE: Test\nSTART: a\n\nSCENE: a\nVIDEO: a.mp4\nTITLE-OVERLAY: logo.png\nENDING: done\n",
    errors: [{ line: 6, has: 'belongs at the top' }],
    warnings: []
  },

  {
    name: 'unreachable scene only',
    text: "TITLE: Test\nSTART: a\n\nSCENE: a\nVIDEO: a.mp4\nENDING: done\n\nSCENE: orphan\nVIDEO: b.mp4\nENDING: done\n",
    errors: [],
    warnings: [{ line: 8, has: 'never be reached' }]
  },

  {
    name: 'ENDING and CHOICE together',
    text: "TITLE: Test\nSTART: a\n\nSCENE: a\nVIDEO: a.mp4\nCHOICE: Go -> a\nENDING: done\n",
    errors: [],
    warnings: [{ line: 4, has: 'both ENDING and CHOICEs' }]
  },

  {
    name: 'NEXT and CHOICE together',
    text: "TITLE: Test\nSTART: a\n\nSCENE: a\nVIDEO: a.mp4\nCHOICE: Go -> a\nNEXT: a\n",
    errors: [],
    warnings: [{ line: 4, has: 'both NEXT and CHOICEs' }]
  },

  {
    name: 'media problems (browser page only)',
    mediaBase: 'media/',
    text: "TITLE: Test\nSTART: a\nWAIT-LOOP: ghost.mp3\n\nSCENE: a\nVIDEO: ghost.mp4\nIMAGE: ghost.png\nCHOICE: Go -> b\n\nSCENE: b\nVIDEO: broken.mp4\nMUSIC: song.wav\nCHOICE: Go -> c\n\nSCENE: c\nVIDEO: nopicture.mp4\nENDING: done\n",
    errors: [],
    warnings: [
      { line: 7, has: 'both VIDEO and IMAGE' },
      { line: 12, has: 'MUSIC only plays' }
    ],
    media: [
      { file: 'ghost.mp3', status: 'missing' },
      { file: 'ghost.mp4', status: 'missing' },
      { file: 'ghost.png', status: 'missing' },
      { file: 'broken.mp4', status: 'missing' },
      { file: 'song.wav', status: 'badext' },
      { file: 'nopicture.mp4', status: 'unplayable' }
    ]
  }
];
