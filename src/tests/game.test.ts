import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CARD_MAX,
  CARD_MIN,
  GameRuleError,
  GameStore,
  MAX_LIVES,
  MAX_PLAYERS,
  chooseTopic,
  createNumberDeck,
  gameKey,
} from '../domain/game';
import type { GameState } from '../domain/game';
import { topicsByTheme } from '../domain/topics';

const key = gameKey('guild-a', 'channel-a');

function readyStore(playerCount = 2, random = (): number => 0): GameStore {
  const store = new GameStore(random);
  store.create(key, 'guild-a', 'channel-a', 'Easy', 'user-1');
  for (let index = 2; index <= playerCount; index += 1) store.join(key, `user-${index}`);
  return store;
}

function setHands(game: GameState, hands: Record<string, number[]>): void {
  game.hands.clear();
  game.declarations.clear();
  for (const [userId, numbers] of Object.entries(hands)) {
    game.hands.set(
      userId,
      numbers.map((number, index) => ({ id: `test-${userId}-${index}-${number}`, number })),
    );
  }
}

function declareAll(store: GameStore): void {
  const game = store.get(key)!;
  for (const [userId, cards] of game.hands) {
    for (const card of cards) store.declare(key, userId, card.id, `表現-${card.id}`);
  }
}

function begin(store: GameStore): GameState {
  return store.begin(key);
}

function clearStage(store: GameStore): void {
  const game = store.get(key)!;
  game.hands.clear();
  game.declarations.clear();
  game.status = 'awaiting_next_stage';
}

function expectRule(code: string, action: () => unknown): void {
  assert.throws(action, (error: unknown) => error instanceof GameRuleError && error.code === code);
}

test('the deck contains exactly the unique cards 1 through 100', () => {
  const deck = createNumberDeck();
  assert.equal(deck.length, 100);
  assert.deepEqual(
    deck,
    Array.from({ length: 100 }, (_, index) => index + 1),
  );
  assert.equal(deck.includes(CARD_MIN), true);
  assert.equal(deck.includes(CARD_MAX), true);
  assert.equal(deck.includes(0), false);
  assert.equal(new Set(deck).size, 100);
});

test('supports the 2-player and 10-player boundaries and rejects an eleventh player', () => {
  assert.equal(readyStore(2).get(key)?.players.length, 2);
  const ten = readyStore(MAX_PLAYERS);
  assert.equal(ten.get(key)?.players.length, 10);
  expectRule('PLAYER_LIMIT', () => ten.join(key, 'user-11'));
});

test('creator joins the lobby, duplicate joins are rejected, and late joins are rejected', () => {
  const store = new GameStore(() => 0);
  const game = store.create(key, 'guild-a', 'channel-a', 'Easy', 'creator');
  assert.deepEqual(game.players, ['creator']);
  expectRule('ALREADY_JOINED', () => store.join(key, 'creator'));
  store.join(key, 'second');
  begin(store);
  expectRule('GAME_STARTED', () => store.join(key, 'late'));
  expectRule('GAME_EXISTS', () => store.create(key, 'guild-a', 'channel-a', 'Easy', 'creator'));
});

test('stage 1 cannot begin with fewer than two players', () => {
  const store = new GameStore(() => 0);
  store.create(key, 'guild-a', 'channel-a', 'Easy', 'creator');
  expectRule('TOO_FEW_PLAYERS', () => store.begin(key));
});

test('stage 1, 2, and 3 deal the correct number of unique cards per player', () => {
  const store = readyStore(10);
  const stage1 = begin(store);
  assert.equal([...stage1.hands.values()].flat().length, 10);
  assert.equal(new Set([...stage1.hands.values()].flat().map((card) => card.number)).size, 10);
  clearStage(store);
  const stage2 = store.startStage(key);
  assert.equal([...stage2.hands.values()].flat().length, 20);
  assert.equal(new Set([...stage2.hands.values()].flat().map((card) => card.number)).size, 20);
  clearStage(store);
  const stage3 = store.startStage(key);
  const playerCards = [...stage3.hands.values()].flat();
  assert.equal(playerCards.length, 30);
  assert.equal(new Set(playerCards.map((card) => card.number)).size, 30);
});

test('nextstage is rejected in lobby and concurrent calls advance exactly once without skipping', async () => {
  const store = readyStore();
  expectRule('STAGE_NOT_COMPLETE', () => store.startStage(key));
  assert.equal(store.get(key)?.status, 'lobby');
  begin(store);
  clearStage(store);
  const attempts = await Promise.allSettled([
    Promise.resolve().then(() => store.startStage(key)),
    Promise.resolve().then(() => store.startStage(key)),
  ]);
  assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
  const stage2 = store.get(key)!;
  assert.equal(stage2.stage, 2);
  expectRule('STAGE_NOT_COMPLETE', () => store.startStage(key));
  assert.equal(store.get(key)?.stage, 2);
});

test('each stage requires one declaration slot per card per player', () => {
  const store = readyStore(2);
  for (let stage = 1; stage <= 3; stage += 1) {
    const game = stage === 1 ? begin(store) : store.startStage(key);
    assert.deepEqual(
      [...game.hands.values()].map((cards) => cards.length),
      [stage, stage],
    );
    declareAll(store);
    for (const playerId of game.players) {
      assert.equal(game.declarations.get(playerId)?.size, stage);
    }
    if (stage < 3) clearStage(store);
  }
});

test('a cleared stage recovers one life at most once, with the two-player exception', () => {
  const three = readyStore(3);
  const game = begin(three);
  game.lives = 1;
  clearStage(three);
  assert.equal(three.startStage(key).lives, 2);
  expectRule('STAGE_NOT_COMPLETE', () => three.startStage(key));
  assert.equal(three.get(key)!.lives, 2);
  three.get(key)!.lives = MAX_LIVES;
  clearStage(three);
  assert.equal(three.startStage(key).lives, MAX_LIVES);

  const two = readyStore(2);
  const twoGame = begin(two);
  twoGame.lives = 1;
  clearStage(two);
  assert.equal(two.startStage(key).lives, 1);
});

test('each new stage rebuilds a complete 1–100 deck and can reuse prior numbers', () => {
  const store = readyStore(2, () => 0);
  const stage1 = begin(store);
  const firstNumbers = [...stage1.hands.values()].flat().map((card) => card.number);
  clearStage(store);
  const stage2 = store.startStage(key);
  const secondNumbers = [...stage2.hands.values()].flat().map((card) => card.number);
  assert.equal(new Set(secondNumbers).size, secondNumbers.length);
  assert.equal(
    secondNumbers.every((number) => number >= 1 && number <= 100),
    true,
  );
  assert.equal(
    firstNumbers.some((number) => secondNumbers.includes(number)),
    true,
  );
  clearStage(store);
  const stage3 = store.startStage(key);
  const stage3Numbers = [...stage3.hands.values()].flat().map((card) => card.number);
  assert.equal(stage3.momoCard !== undefined, true);
  assert.equal(new Set([...stage3Numbers, stage3.momoCard!]).size, stage3Numbers.length + 1);
  assert.equal(stage3Numbers.includes(stage3.momoCard!), false);
});

test('declarations are one-per-card, private-card-associated, revisable, and mechanically required', () => {
  const store = readyStore(2);
  const game = begin(store);
  setHands(game, { 'user-1': [20, 80], 'user-2': [40, 60] });
  const first = game.hands.get('user-1')![0]!;
  const second = game.hands.get('user-1')![1]!;
  store.declare(key, 'user-1', first.id, '低め');
  store.declare(key, 'user-1', first.id, 'かなり低め');
  assert.equal(game.declarations.get('user-1')?.size, 1);
  store.declare(key, 'user-1', second.id, '高め');
  store.declare(key, 'user-2', game.hands.get('user-2')![0]!.id, '中低');
  expectRule('DECLARATIONS_INCOMPLETE', () => store.play(key, 'user-1', 20));
  store.declare(key, 'user-2', game.hands.get('user-2')![1]!.id, '中高');
  const result = store.play(key, 'user-1', 20);
  assert.equal(result.playedCard, 20);
  assert.equal('hand' in result, false);
});

test('declarations cannot be created or changed by another player and hide numbers in policy errors', () => {
  const store = readyStore();
  const game = begin(store);
  const card = game.hands.get('user-1')![0]!;
  expectRule('CARD_NOT_OWNED', () => store.declare(key, 'user-2', card.id, '乗っ取り'));
  expectRule('DIRECT_NUMBER_DECLARATION', () =>
    store.declare(key, 'user-1', card.id, String(card.number)),
  );
  assert.throws(
    () => store.declare(key, 'user-1', card.id, String(card.number)),
    (error: unknown) =>
      error instanceof GameRuleError &&
      error.code === 'DIRECT_NUMBER_DECLARATION' &&
      !error.message.includes(String(card.number)),
  );
  expectRule('CARD_NOT_OWNED', () => store.declare(key, 'user-2', card.id, '削除'));
});

test('played and skipped cards lose their declarations, and declarations reset between stages', () => {
  const store = readyStore();
  const game = begin(store);
  setHands(game, { 'user-1': [50, 80], 'user-2': [20, 70] });
  declareAll(store);
  const played = game.hands.get('user-1')!.find((card) => card.number === 50)!;
  const skipped = game.hands.get('user-2')!.find((card) => card.number === 20)!;
  store.play(key, 'user-1', 50);
  assert.equal(game.declarations.get('user-1')?.has(played.id), false);
  assert.equal(game.declarations.get('user-2')?.has(skipped.id), false);
  clearStage(store);
  const next = store.startStage(key);
  assert.equal(next.declarations.size, 0);
});

test('out-of-order handling skips all lower cards, charges exactly that count, and keeps the pile', () => {
  const store = readyStore();
  const game = begin(store);
  setHands(game, { 'user-1': [50, 80], 'user-2': [20, 30, 70] });
  declareAll(store);
  const result = store.play(key, 'user-1', 50);
  assert.deepEqual(result.skippedCards, [20, 30]);
  assert.equal(result.livesLost, 2);
  assert.equal(result.remainingLives, 1);
  assert.deepEqual(result.pile, [50]);
  assert.deepEqual(
    game.hands.get('user-2')!.map((card) => card.number),
    [70],
  );
  assert.equal(game.status, 'playing');
  const next = store.play(key, 'user-2', 70);
  assert.deepEqual(next.pile, [50, 70]);
  assert.equal(next.livesLost, 0);
});

test('a lower play is rejected without mutation, while a nonfatal mistake continues the stage', () => {
  const store = readyStore();
  const game = begin(store);
  setHands(game, { 'user-1': [100], 'user-2': [40, 90] });
  game.pile = [80];
  game.lastPlayed = 80;
  declareAll(store);
  expectRule('OUT_OF_ORDER', () => store.play(key, 'user-2', 40));
  assert.deepEqual(
    game.hands.get('user-2')!.map((card) => card.number),
    [40, 90],
  );
  const result = store.play(key, 'user-2', 90);
  assert.deepEqual(result.skippedCards, [40]);
  assert.deepEqual(game.pile, [80, 90]);
  assert.equal(game.status, 'playing');
});

test('played cards are removed once and concurrent duplicate plays mutate once', async () => {
  const store = readyStore();
  const game = begin(store);
  setHands(game, { 'user-1': [50], 'user-2': [60] });
  declareAll(store);
  const attempts = await Promise.allSettled([
    Promise.resolve().then(() => store.play(key, 'user-1', 50)),
    Promise.resolve().then(() => store.play(key, 'user-1', 50)),
  ]);
  assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
  assert.deepEqual(game.pile, [50]);
  assert.deepEqual(store.hand(key, 'user-1'), []);
  expectRule('CARD_NOT_OWNED', () => store.play(key, 'user-1', 50));
});

test('zero lives loses immediately and wins cannot be caused by a simultaneous final mistake', () => {
  const store = readyStore();
  const game = begin(store);
  game.lives = 1;
  setHands(game, { 'user-1': [50], 'user-2': [20] });
  declareAll(store);
  const result = store.play(key, 'user-1', 50);
  assert.equal(result.remainingLives, 0);
  assert.equal(result.stageCleared, false);
  assert.equal(result.lost, true);
  assert.equal(result.won, false);
  assert.equal(game.status, 'lost');
  expectRule('TERMINAL', () => store.play(key, 'user-2', 20));
  expectRule('TERMINAL', () => store.startStage(key));
});

test('stage 3 victory is terminal and a lobby cannot become lost', () => {
  const store = readyStore();
  begin(store);
  clearStage(store);
  store.startStage(key);
  clearStage(store);
  const game = store.startStage(key);
  setHands(game, { 'user-1': [10], 'user-2': [20] });
  declareAll(store);
  store.play(key, 'user-1', 10);
  const result = store.play(key, 'user-2', 20);
  assert.equal(result.stageCleared, true);
  assert.equal(result.won, true);
  assert.equal(game.status, 'won');
  expectRule('TERMINAL', () => store.play(key, 'user-1', 10));
  const lobby = readyStore();
  assert.equal(lobby.get(key)?.status, 'lobby');
  assert.equal(lobby.checkEnd(key), null);
  assert.equal(lobby.get(key)?.status, 'lobby');
});

test('Momo has a separate shared declaration, is not required for completion, and cannot be redrawn', () => {
  const store = readyStore();
  begin(store);
  clearStage(store);
  store.startStage(key);
  clearStage(store);
  const stage3 = store.startStage(key);
  const momo = stage3.momoCard;
  assert.equal(typeof momo, 'number');
  const firstDeclaration = store.declareMomo(key, 'user-1', '共有の目安');
  assert.equal(firstDeclaration.momoDeclaration, '共有の目安');
  assert.equal(firstDeclaration.declarations.has('user-1'), false);
  setHands(stage3, { 'user-1': [], 'user-2': [] });
  stage3.status = 'awaiting_next_stage';
  expectRule('FINAL_STAGE', () => store.startStage(key));
  assert.equal(stage3.momoCard, momo);
});

test('topics do not repeat before exhaustion, then start a new deterministic cycle per game', () => {
  const used = new Set(topicsByTheme.Easy!);
  const topic = chooseTopic('Easy', used, () => 0);
  assert.equal(typeof topic, 'string');
  assert.deepEqual([...used], [topic]);

  const firstGame = readyStore();
  const first = begin(firstGame).currentTopic;
  clearStage(firstGame);
  const second = firstGame.startStage(key).currentTopic;
  assert.notEqual(first, second);
  const other = readyStore();
  assert.equal(begin(other).usedTopics.has(first!), true);
});

test('guild and channel keys isolate games, and private hand reads are copies', () => {
  const store = readyStore();
  const otherChannel = gameKey('guild-a', 'channel-b');
  const otherGuild = gameKey('guild-b', 'channel-a');
  store.create(otherChannel, 'guild-a', 'channel-b', 'Easy', 'user-1');
  store.create(otherGuild, 'guild-b', 'channel-a', 'Easy', 'user-1');
  begin(store);
  const privateHand = store.hand(key, 'user-1');
  privateHand.pop();
  assert.equal(store.hand(key, 'user-1').length, 1);
  assert.equal(store.get(otherChannel)?.status, 'lobby');
  assert.equal(store.get(otherGuild)?.status, 'lobby');
});

test('stale card slots from a previous stage and all terminal mutations are rejected', () => {
  const store = new GameStore(() => 0);
  store.create(key, 'guild-a', 'channel-a', 'Easy', 'user-1');
  store.join(key, 'user-2');
  const first = begin(store);
  const staleId = first.hands.get('user-1')![0]!.id;
  clearStage(store);
  const second = store.startStage(key);
  const staleNumber = first.hands.get('user-1')![0]!.number;
  setHands(second, { 'user-1': [10], 'user-2': [20] });
  expectRule('CARD_NOT_OWNED', () => store.declare(key, 'user-1', staleId, '古いカード'));
  expectRule('CARD_NOT_OWNED', () => store.play(key, 'user-1', staleNumber));
  declareAll(store);
  store.play(key, 'user-1', 10);
  store.play(key, 'user-2', 20);
  const snapshot = JSON.stringify({
    status: second.status,
    stage: second.stage,
    pile: second.pile,
  });
  expectRule('NOT_PLAYING', () => store.declareMomo(key, 'user-1', '変更'));
  assert.equal(
    JSON.stringify({ status: second.status, stage: second.stage, pile: second.pile }),
    snapshot,
  );
});

test('a player can leave an active game and deleting the final player deletes it', () => {
  const store = readyStore();
  store.leave(key, 'user-2');
  assert.deepEqual(store.get(key)?.players, ['user-1']);
  store.leave(key, 'user-1');
  assert.equal(store.get(key), undefined);
});
