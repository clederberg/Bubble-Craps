# Bubble Craps

Three free-play tables that share one bankroll: **Craps**, **Blackjack** and **Baccarat**. Use the links at the top of any page to switch games.


Free-play craps and crapless craps on a real table layout, with 3D dice. Play money only, no accounts, no purchases. Your bankroll is saved in your browser, and **Reset bankroll** starts you over with any amount up to $100,000.

**Play:** open `index.html`, or turn on GitHub Pages (below).

## Blackjack (`blackjack.html`)

- **Six-deck shoe** with a cut card around three quarters in, not a continuous shuffler. The shoe carries over between hands and page reloads.
- **Blackjack pays 3 to 2.** Dealer stands on all 17s, including soft 17 (the player-friendly version).
- Double on any two cards, double after split, split to four hands, split aces get one card, late surrender, insurance 2:1, dealer peeks.
- **Play up to three hands at once**, each with its own bets.
- **Side bets:** Match the Dealer (each of your first two cards matching the dealer's up card pays 4:1, or 9:1 suited) and Buster Blackjack (dealer busts: 3-4 cards 2:1, 5 cards 4:1, 6 cards 18:1, 7 cards 50:1, 8+ cards 250:1, paid even if you busted).
- Cards are dealt one at a time in table order, the hole card flips after you act, and the dealer draws with a pause between cards.
- An illustrated dealer deals from the shoe, calls the hand and reacts to the result. No play is ever suggested; the **?** button on the table opens the basic strategy chart ("the book").
- Limits: $5,000 main bet, $1,000 each side bet. Keys: space deals, H hit, S stand, D double, P split, U surrender, ? opens the book.

## Baccarat (`baccarat.html`)

- **Eight-deck shoe**, standard drawing tableau, with a bead road and running tally.
- **Commission game:** Banker pays 1:1 less 5%, Player 1:1, Tie 8:1.
- **EZ game:** Banker pays even money with no commission, but a banker three-card 7 pushes the banker bet.
- **Side bets:** Player Pair and Banker Pair 11:1, Either Pair 5:1, Perfect Pair 25:1 (200:1 if both sides), and in EZ, Dragon 7 40:1 and Panda 8 25:1.
- Limits: $10,000 on Player, Banker and Tie, $1,000 each side bet.

## Craps tables

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

## Bets on the new point

When a number you have a Place or Buy bet on becomes the point, a prompt offers to move that bet to another number as either a Place or a Buy bet (the number that just hit is highlighted, and the numbers each bet type pays best on are underlined), take it down, or leave it up. Uncheck the box in that prompt to stop being asked.

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
- Tap **On table** in the bottom bar for a list of every bet, with buttons to take one chip or the whole bet down.
- **Space** or **R** rolls.
- **B** opens Reset bankroll, **Shift+B** resets straight to your last amount. You can also tap Bankroll on the bottom bar, and a one-tap reset appears when you run out of chips.

## Sound

Dice and chip sounds are real recordings from Kenney's [Casino Audio](https://kenney.nl/assets/casino-audio) pack (public domain, CC0). The stickman calls use your device's built-in text-to-speech voice. The **Audio** button cycles between All, FX (no voice) and Off.

## Files

- `index.html` craps page and styles
- `blackjack.html` / `blackjack.js` blackjack table
- `baccarat.html` / `baccarat.js` baccarat table
- `casino.css` shared styling for the card games
- `common.js` shared bankroll, chips, sounds, cards and shoes
- `bj.js` / `bac.js` blackjack and baccarat rules
- `test-bj.js` / `test-bac.js` their tests (`node test-bj.js`)
- `app.js` table drawing, dice, animations, sound
- `layout.js` table layouts (desktop and phone)
- `sounds.js` recorded dice and chip sounds
- `engine.js` rules and payouts
- `test.js` rules tests (`node test.js`)
