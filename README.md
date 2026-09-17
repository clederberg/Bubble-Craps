# Bubble Craps

Free-play craps and crapless craps on a real table layout, with 3D dice. Play money only, no accounts, no purchases. Your bankroll is saved in your browser, and **Reset bankroll** starts you over with any amount up to $100,000.

**Play:** open `index.html`, or turn on GitHub Pages (below).

## Tables

- **Craps:** Pass / Don't Pass, Come / Don't Come, 3-4-5x odds, Place, Buy, Lay, Field, Hardways, one-roll props, Horn, C & E, All Small / All Tall / Make 'Em All.
- **Crapless:** every number except 7 is a point (2, 3, 11 and 12 included). No Don't bets.

## Payouts

| Bet | Pays |
|---|---|
| Pass / Come / Don't | 1:1 |
| Odds (3-4-5x) | true odds: 2/12 6:1, 3/11 3:1, 4/10 2:1, 5/9 3:2, 6/8 6:5 |
| Place | 4/10 9:5, 5/9 7:5, 6/8 7:6, 3/11 11:4, 2/12 11:2 |
| Buy / Lay | true odds, 5% commission on wins |
| Field | 1:1, 2 pays 2x, 12 pays 3x |
| Hard 4/10, Hard 6/8 | 7:1, 9:1 |
| Any 7 / Any Craps | 4:1 / 7:1 |
| 2 or 12 / 3 or 11 | 30:1 / 15:1 |
| All Small, All Tall / Make 'Em All | 34:1 / 175:1 |

Odds limits: 3x on 2, 3, 4, 10, 11, 12 · 4x on 5 and 9 · 5x on 6 and 8. Don't bettors can lay enough to win 6x their flat bet.

Place, Buy, Hardways and Come odds are off on the come-out roll.

## Table limits

| Bet | Max |
|---|---|
| Pass, Don't Pass, Come, Don't Come | $5,000 |
| Place, Buy | $25,000 |
| Lay | whatever wins $25,000 ($50,000 on 4/10, $37,500 on 5/9, $30,000 on 6/8, $75,000 on 3/11, $150,000 on 2/12) |
| Odds | 3-4-5x of the flat bet |
| Field | $5,000 |
| Hardways, one-roll bets, Horn, C & E | $1,000 |
| All Small, All Tall, Make 'Em All | $1,000 |

Reset bankroll goes up to $100,000. Lay and Don't odds always work.

## Fair dice

Each die is drawn from the browser's cryptographic random number generator (`crypto.getRandomValues`), using rejection sampling so 1 through 6 are exactly equally likely. Both dice are picked when you press Roll, before the animation, and bets, bankroll and past rolls are never used. The page shows your running roll distribution next to the expected odds.

## Controls

- Pick a chip, tap a spot on the table to bet it.
- After a Come or Don't Come bet travels to a number, tap the gold **ODDS** circle beside it to add odds.
- Right-click, long-press, or switch on **Take down** to remove chips.
- **Space** or **R** rolls.
- **B** opens Reset bankroll, **Shift+B** resets straight to your last amount. You can also tap Bankroll on the bottom bar, and a one-tap reset appears when you run out of chips.

## Sound

Dice and chip sounds are real recordings from Kenney's [Casino Audio](https://kenney.nl/assets/casino-audio) pack (public domain, CC0). The stickman calls use your device's built-in text-to-speech voice. The **Audio** button cycles between All, FX (no voice) and Off.

## Files

- `index.html` page and styles
- `app.js` table drawing, dice, animations, sound
- `layout.js` table layouts (desktop and phone)
- `sounds.js` recorded dice and chip sounds
- `engine.js` rules and payouts
- `test.js` rules tests (`node test.js`)
