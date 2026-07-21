# Ito クモノイト game model

The gameplay summary below follows the official [ArclightGames Ito product page](https://arclightgames.jp/product/ito/), specifically its クモノイト rules.

- A game is scoped to one Discord guild and channel. `/start` creates a lobby and automatically joins its author.
- The lobby accepts 2–10 players. `/join` works only before stage 1 begins and rejects duplicate joins.
- Each stage uses a freshly shuffled deck containing exactly the 100 unique cards numbered 1 through 100. Stage 1 deals one card per player, stage 2 two, and stage 3 three.
- A card number is private to its owner. `/hand` replies ephemerally with a stable player-local card slot (`カード1` through `カード3`) and number. `/declare card:<1-3> clue:<text>` publishes a clue associated with the selected slot; the domain stores it against the card's internal identity. `/play number:<手札の実際の数字>` accepts the actual number shown by `/hand` and reveals it publicly. Thus `card` selects a private declaration slot while `number` is the real card value. Stage 1 requires one declaration per player, stage 2 two, and stage 3 three. The card owner may revise a clue without creating another slot. Played and skipped cards no longer need declarations, and play is blocked until all currently held cards are declared.
- During free discussion, players use `/play` in ascending order. The played card is removed from its owner's hand and remains in the public pile.
- After every play, every still-held card lower than the newly played number is revealed and removed. Each skipped card costs one shared life. The pile and stage continue; the newly played number becomes the current comparison point.
- The game starts with three shared lives and never exceeds three. Clearing a stage enters `awaiting_next_stage`; the creator must use `/nextstage` to advance. Stage 1 is started from the lobby with `/begin`. Clearing a stage restores one life before the next stage when there are at least three players. Two-player games do not recover lives.
- A stage is clear only when all player hands are empty while lives remain. Clearing stage 3 wins. Reaching zero lives takes precedence over a simultaneous empty-hand condition and loses immediately.
- Stage 3 draws one additional card for Momo, removes it from the deck, and displays it publicly. Momo is not in any player's hand and is never played. Players set the shared public representation with `/momo declaration:<text>`.
- The bot rejects declarations consisting only of digits or exactly matching the hidden card number, without including that number in the error. It cannot detect a number spoken in voice chat or disguised in natural language, so that part of the rule remains socially enforced.
- Topics are selected per game and do not repeat until that theme's topic pool is exhausted. At exhaustion, the used-topic set is reset and a new cycle begins.
- Terminal games are `won` or `lost` and reject further gameplay mutations. `/end` deletes a game when its creator requests cancellation or result reporting; `/leave` removes an active player.

The application intentionally keeps state in memory. A Pod restart loses active games and selected guild themes.
