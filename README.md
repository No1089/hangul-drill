# Hangul Drill

A small, free web app for learning to read the Korean alphabet, Hangul. It works offline and can be
installed on a phone or computer: on iOS/macOS Safari use Share → Add to Home Screen / Add to Dock, and
on Android Chrome use Install app.

## How it works

- **Quick multiple choice.** You see a letter and pick its sound from 3, 4 or 5 options, or the reverse.
  A wrong pick is greyed out and the question stays until you find the right one, so every round ends on
  the correct answer.
- **Learn or Play.** Learn is the adaptive course described below. Play skips it: letters come up at random
  from whichever sets you pick, with no introductions, like the old-school drills.
- **Answers below or in a circle.** The options can sit under the letter or in a ring around it (Settings).
- **Two directions.** Read (letter → sound) and Write (sound → letter). A Listen mode exists in the code
  but is switched off (`SPEECH` in `app.js`): device text-to-speech sounds poor for single letters.
- **Adaptive order.** Each letter has a Leitner box (0–5) for each direction. Getting it right on the first
  try moves it up one box, and a mistake sends it back to box 0. Weak letters come up far more often, and a
  missed letter comes back 2–4 questions later.
- **One letter at a time.** New letters arrive with an introduction card and a pronunciation note. New ones
  are held back while three letters are still weak.
- **Smart wrong answers.** Distractors favour look-alikes (ㅏ/ㅓ, ㄱ/ㅋ/ㄲ, ㅐ/ㅔ …) and letters you've
  actually confused this one with before.
- **Syllable blocks.** Practise CV and CVC blocks (가, 각 …) built from the letters you've selected.
- **Progress view** with a mastery grid for each direction. It suggests the next letter set when you're ready.
- Progress stays in the browser on each device. There are no accounts. Visits are counted anonymously with
  [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/), which uses no cookies and no personal data.

Romanization follows the official Revised Romanization of Korean.

## Layout

```
web/        the app: plain ES modules, no build step
  hangul.js   syllable compose/decompose + Revised Romanization
  data.js     letter groups, notes, look-alike sets, syllable generation
  quiz.js     scheduler (Leitner boxes) and distractor choice; pure, tested
  app.js      UI
test/       node --test
.github/    tests, then publishes web/ to GitHub Pages on every push to main
```

## Develop

```
python3 -m http.server -d web 8000   # then open http://localhost:8000
npm test
```

## Thanks

This was inspired by a small Flash Hangul quiz from the mid-2000s that taught me to read Korean, and that
I can still read years later. It's gone along with Flash, so this is a fresh take on the same idea.

## License

[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). You're welcome to share and adapt it
with credit, but not for commercial use. See `LICENSE`.
