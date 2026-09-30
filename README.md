# Bubble Craps

Five free-play games that share one bankroll: **Craps**, **Blackjack**, **Baccarat**, and two slots, **Festival of Lights** and **Pinball Classic**. Use the links at the top of any page to switch games.


Free-play craps and crapless craps on a real table layout, with 3D dice. Play money only, no accounts, no purchases. Your bankroll is saved in your browser, and **Reset bankroll** starts you over with any amount up to $100,000.

**Play:** open `index.html`, or turn on GitHub Pages (below).

## Festival of Lights (`lights.html`)

Five reels, three rows, with **5, 25 or 50 lines** selectable and the chip rack setting the bet per line. A Hanukkah-themed machine: menorahs, dreidels, pomegranates and challah, with Hebrew letters on the low pays and a Star of David wild. All the artwork is hand-drawn SVG.

**Four progressive jackpots.** Grand, Major, Minor and Mini are live meters that grow with every spin and reset to their seed when won. They are held as **multiples of your total bet** (seeds 1000x, 200x, 25x and 10x), not as fixed dollar amounts, so the odds are identical whatever you bet and the figures on the ladder rise with your bet. They grow by 0.012x, 0.007x, 0.004x and 0.003x of your bet per spin.

- **Light the Menorah (hold & spin):** six or more candles lock in place and start three respins that reset every time another candle lands. **You press spin yourself for each respin** and the new candles land one at a time. Light all fifteen for the Grand. Candle cells can also carry Mini, Minor and Major.
- **Free games:** three, four or five shofars pay 2x, 10x or 50x the bet and start 8, 12 or 20 free games. **The ark opens and a scroll unrolls to reveal one boosted symbol** for the round: it lands in stacks on a separate set of free-game reels, and a full stack unrolls a scroll down that reel and turns it wild. A better symbol is rarer and comes with fewer spins. Candles come thicker in free games and **only five are needed for the hold & spin**, so the feature fires inside the round about a quarter of the time; the round pauses, you play it, then your remaining spins resume. Three more shofars add 5 spins. **A round can never pay nothing** — it pays at least the shofar award that started it, topped up at the end if the spins came up short (that floor is used on about 18% of rounds).
- **Latke Bonus:** three or more pans start a pick round. Pans fly past, you tap one, a latke lands in it and pays. An empty pan ends the round, and a pan can hold any of the four jackpots.
- **Win breakdown:** the panel to the right of the reels lists every line that paid, like "Line 3 pays $25", with the feature payouts as their own rows and a total that matches the spin. Hovering a row lights that line on the reels.

Measured return to player **93.6% to 93.8%** across the three line counts, made up of roughly 48% lines, 22% free games, 11% hold & spin, 3% latke bonus, 2.4% shofar pays and 6.7% jackpots. Each meter's growth rate is set to the long-run cost of that jackpot, so the meters fund themselves.

| | hits | pays |
|---|---|---|
| Free games | 1 in 107 spins | 22x the bet on average, 8.1 spins |
| Hold & spin | 1 in 242 spins, 1 in 30 free spins | 26x the bet on average |
| Latke bonus | 1 in 737 spins | 24x the bet on average, 4.4 pans picked |
| Mini | 1 in 831 spins | seeds at 10x the bet |
| Minor | 1 in 3,161 spins | seeds at 25x the bet |
| Major | 1 in 18,229 spins | seeds at 200x the bet |
| Grand | 1 in 100,603 spins | seeds at 1000x the bet |

A meter that has been climbing for a long time is worth more than its seed, so a fat meter is genuinely good value, the way a real progressive is. Because the meters are multiples of your bet rather than dollars, that edge does not depend on betting small.

Fixed reel strips, so the odds are the same for everyone, every session.

## Pinball Classic (`pinball.html`)

Three reels, one line, bars and bells and sevens, with blanks between them like an old machine. A **real pull handle** on the side of the cabinet: drag the knob down and let go (space or the PULL button work too).

- **1 or 2 credits.** Play one credit or play max; every pay doubles on two credits, and three sevens on max credits pay **1,200x** instead of 900x. The chip rack sets the bet per credit, table max $25,000 a spin.
- Pays run from one cherry at 2x up to three sevens at 450x a credit.
- **Ball bonus:** a single silver ball on the **third reel** sends the ball down the playfield in the backbox, bouncing off the bumpers into a pocket worth 1x to 15x your bet. It lands about 1 spin in 7.
- Exact return to player 95.3% on one credit, 96.7% on max credits.

## Blackjack (`blackjack.html`)

- **Six-deck shoe** with a cut card around three quarters in, not a continuous shuffler. The shoe carries over between hands and page reloads.
- **Blackjack pays 3 to 2.** Dealer stands on all 17s, including soft 17 (the player-friendly version).
- Double on any two cards, double after split, split to four hands, split aces get one card, late surrender, insurance 2:1, dealer peeks.
- **Even money:** a blackjack against a dealer ace is offered 1:1 on the spot instead of insurance.
- **Play up to three hands at once**, each with its own bets.
- **Side bets:** Match the Dealer (1 match 4:1, 2 matches 8:1, 1 suited match 9:1, suited + non-suited 13:1, 2 suited matches 18:1) and Buster Blackjack (dealer busts: 3-4 cards 2:1, 5 cards 4:1, 6 cards 18:1, 7 cards 50:1, 8+ cards 250:1, paid even if you busted).
- Your bet stays up between hands, so Deal repeats it, and **2X** doubles the bet and deals.
- Cards are dealt one at a time in table order, the hole card flips after you act, and the dealer draws with a pause between cards.
- The side bet paytables are printed on the felt, and **REPEAT** beside DEAL replays your last bet in one tap.
- An illustrated dealer deals from the shoe, calls the hand and reacts to the result. No play is ever suggested; the **?** button on the table opens the basic strategy chart ("the book").
- Limits: $25,000 main bet, $1,000 each side bet. Keys: space deals, H hit, S stand, D double, P split, U surrender, ? opens the book.

## Baccarat (`baccarat.html`)

- **Eight-deck shoe**, standard drawing tableau, with a bead plate, big road and running tally.
- **Squeeze:** cards come out face down and you drag across one to peel it open, or tap to flip. Turn it off with the Squeeze button for instant reveals.
- **Commission game:** Banker pays 1:1 less 5%, Player 1:1, Tie 8:1.
- **EZ game:** Banker pays even money with no commission, but a banker three-card 7 pushes the banker bet.
- **Side bets:** Player Pair and Banker Pair 11:1, Either Pair 5:1, Perfect Pair 25:1 (200:1 if both sides), and in EZ, Dragon 7 40:1 and Panda 8 25:1.
- Limits: $25,000 on Player, Banker and Tie, $1,000 each side bet.

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
- `slots.js` / `games.js` the slot engine and both machines
- `lights.html` / `lights.js` and `pinball.html` / `pinball.js` the two slots
- `slotfx.js` the slot sound engine, synthesized in the browser with the Web Audio API
- `test-bj.js` / `test-bac.js` / `test-slots.js` their tests (`node test-bj.js`)
- `app.js` table drawing, dice, animations, sound
- `layout.js` table layouts (desktop and phone)
- `sounds.js` recorded dice and chip sounds
- `engine.js` rules and payouts
- `test.js` rules tests (`node test.js`)
