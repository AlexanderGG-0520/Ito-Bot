import { topicsByTheme } from './topics';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
export const MAX_STAGE = 3;
export const INITIAL_LIVES = 3;
export const MAX_LIVES = 3;
export const CARD_MIN = 1;
export const CARD_MAX = 100;
export const CARD_SLOT_MIN = 1;
export const CARD_SLOT_MAX = MAX_STAGE;

export type Random = () => number;
export type GameKey = `${string}:${string}`;
export type GameStatus = 'lobby' | 'playing' | 'awaiting_next_stage' | 'won' | 'lost';

export interface HandCard {
  readonly id: string;
  readonly slot: number;
  readonly number: number;
}

export interface HandCardView {
  readonly slot: number;
  readonly number: number;
}

export interface GameState {
  readonly key: GameKey;
  readonly guildId: string;
  readonly channelId: string;
  readonly creatorId: string;
  readonly theme: string;
  players: string[];
  status: GameStatus;
  stage: number;
  lives: number;
  currentTopic?: string;
  usedTopics: Set<string>;
  declarations: Map<string, Map<string, string>>;
  hands: Map<string, HandCard[]>;
  pile: number[];
  lastPlayed: number | null;
  momoCard?: number;
  momoDeclaration?: string;
}

export interface PlayResult {
  status: 'start' | 'ok';
  playedCard: number;
  skippedCards: number[];
  livesLost: number;
  remainingLives: number;
  stageCleared: boolean;
  won: boolean;
  lost: boolean;
  pile: number[];
}

export class GameRuleError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GameRuleError';
  }
}

export function gameKey(guildId: string, channelId: string): GameKey {
  return `${guildId}:${channelId}`;
}

export function createNumberDeck(): number[] {
  return Array.from({ length: CARD_MAX - CARD_MIN + 1 }, (_, index) => index + CARD_MIN);
}

export function shuffle<T>(items: T[], random: Random = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}

export function chooseTopic(
  theme: string,
  usedTopics: Set<string>,
  random: Random = Math.random,
): string {
  const topics = topicsByTheme[theme];
  if (!topics || topics.length === 0) {
    throw new GameRuleError('NO_TOPICS', `No topics configured for theme ${theme}`);
  }

  const available = topics.filter((topic) => !usedTopics.has(topic));
  const pool = available.length > 0 ? available : topics;
  if (available.length === 0) usedTopics.clear();
  const topic = pool[Math.floor(random() * pool.length)];
  if (!topic) throw new GameRuleError('NO_TOPICS', `No topics configured for theme ${theme}`);
  usedTopics.add(topic);
  return topic;
}

export class GameStore {
  private readonly games = new Map<GameKey, GameState>();
  private nextCardId = 0;

  public constructor(private readonly random: Random = Math.random) {}

  public has(key: GameKey): boolean {
    return this.games.has(key);
  }

  public create(
    key: GameKey,
    guildId: string,
    channelId: string,
    theme: string,
    creatorId: string,
  ): GameState {
    if (this.games.has(key)) {
      throw new GameRuleError('GAME_EXISTS', 'このチャンネルでは既にゲームがあります。');
    }
    const game: GameState = {
      key,
      guildId,
      channelId,
      creatorId,
      theme,
      players: [creatorId],
      status: 'lobby',
      stage: 0,
      lives: INITIAL_LIVES,
      usedTopics: new Set(),
      declarations: new Map(),
      hands: new Map(),
      pile: [],
      lastPlayed: null,
    };
    this.games.set(key, game);
    return game;
  }

  public get(key: GameKey): GameState | undefined {
    return this.games.get(key);
  }

  public join(key: GameKey, userId: string): GameState {
    const game = this.require(key);
    if (game.status !== 'lobby') {
      throw new GameRuleError('GAME_STARTED', 'ゲーム開始後は参加できません。');
    }
    if (game.players.includes(userId)) {
      throw new GameRuleError('ALREADY_JOINED', '既に参加しています。');
    }
    if (game.players.length >= MAX_PLAYERS) {
      throw new GameRuleError('PLAYER_LIMIT', '参加人数の上限です。');
    }
    game.players.push(userId);
    return game;
  }

  public leave(key: GameKey, userId: string): GameState | undefined {
    const game = this.require(key);
    this.requireActive(game);
    const index = game.players.indexOf(userId);
    if (index < 0) throw new GameRuleError('NOT_PLAYER', 'このゲームに参加していません。');
    game.players.splice(index, 1);
    game.hands.delete(userId);
    game.declarations.delete(userId);
    if (game.players.length === 0) {
      this.games.delete(key);
      return undefined;
    }
    return game;
  }

  public begin(key: GameKey): GameState {
    const game = this.require(key);
    this.requireActive(game);
    if (game.status !== 'lobby' || game.stage !== 0) {
      throw new GameRuleError('INVALID_TRANSITION', 'ロビーからステージ1を開始できません。');
    }
    if (game.players.length < MIN_PLAYERS) {
      throw new GameRuleError('TOO_FEW_PLAYERS', `開始には${MIN_PLAYERS}人以上必要です。`);
    }
    return this.prepareStage(game);
  }

  public startStage(key: GameKey): GameState {
    const game = this.require(key);
    this.requireActive(game);
    if (game.lives <= 0) {
      throw new GameRuleError('GAME_LOST', 'ライフが0のためゲームオーバーです。');
    }
    if (game.players.length < MIN_PLAYERS) {
      throw new GameRuleError('TOO_FEW_PLAYERS', `開始には${MIN_PLAYERS}人以上必要です。`);
    }
    if (game.stage >= MAX_STAGE) {
      throw new GameRuleError('FINAL_STAGE', '最終ステージは既に準備済みです。');
    }
    if (game.stage === 0 || game.status !== 'awaiting_next_stage') {
      throw new GameRuleError(
        'STAGE_NOT_COMPLETE',
        '現在のステージをクリアしてから次へ進んでください。',
      );
    }
    if (!this.allHandsEmpty(game)) {
      throw new GameRuleError('STAGE_NOT_COMPLETE', '現在のステージの手札を全て出してください。');
    }

    return this.prepareStage(game);
  }

  private prepareStage(game: GameState): GameState {
    if (game.stage >= MAX_STAGE) {
      throw new GameRuleError('FINAL_STAGE', '最終ステージは既に準備済みです。');
    }

    if (game.stage > 0 && game.players.length >= 3) {
      game.lives = Math.min(MAX_LIVES, game.lives + 1);
    }
    game.stage += 1;
    game.status = 'playing';
    game.currentTopic = chooseTopic(game.theme, game.usedTopics, this.random);
    game.declarations.clear();
    delete game.momoDeclaration;
    game.pile = [];
    game.lastPlayed = null;
    game.hands.clear();

    const deck = shuffle(createNumberDeck(), this.random);
    if (game.stage === MAX_STAGE) {
      const momoCard = deck.shift();
      if (momoCard === undefined) throw new GameRuleError('DECK_EMPTY', 'カードデッキが空です。');
      game.momoCard = momoCard;
    } else {
      delete game.momoCard;
    }
    for (const playerId of game.players) {
      const cards = deck.splice(0, game.stage);
      game.hands.set(
        playerId,
        cards.map((number, index) => ({
          id: this.createCardId(),
          slot: index + 1,
          number,
        })),
      );
    }
    return game;
  }

  public hand(key: GameKey, userId: string): HandCardView[] {
    const game = this.requirePlaying(key, userId);
    return (game.hands.get(userId) ?? []).map(({ slot, number }) => ({ slot, number }));
  }

  public declare(key: GameKey, userId: string, slot: number, clue: string): GameState {
    const game = this.requirePlaying(key, userId);
    const card = this.findCardBySlot(game, userId, slot);
    const value = clue.trim();
    if (!value) throw new GameRuleError('EMPTY_DECLARATION', '宣言を入力してください。');
    if (value.length > 200) {
      throw new GameRuleError('DECLARATION_TOO_LONG', '宣言は200文字以内です。');
    }
    if (/^\d+$/.test(value) || value === String(card.number)) {
      throw new GameRuleError(
        'DIRECT_NUMBER_DECLARATION',
        'カードの数字をそのまま宣言することはできません。',
      );
    }
    const playerDeclarations = game.declarations.get(userId) ?? new Map<string, string>();
    playerDeclarations.set(card.id, value);
    game.declarations.set(userId, playerDeclarations);
    return game;
  }

  public declareMomo(key: GameKey, userId: string, declaration: string): GameState {
    const game = this.requirePlaying(key, userId);
    if (game.stage !== MAX_STAGE || game.momoCard === undefined) {
      throw new GameRuleError('MOMO_UNAVAILABLE', 'モモちゃんはステージ3でのみ宣言できます。');
    }
    const value = declaration.trim();
    if (!value) {
      throw new GameRuleError('EMPTY_DECLARATION', 'モモちゃんの宣言を入力してください。');
    }
    if (value.length > 200) {
      throw new GameRuleError('DECLARATION_TOO_LONG', '宣言は200文字以内です。');
    }
    game.momoDeclaration = value;
    return game;
  }

  public play(key: GameKey, userId: string, cardNumber: number): PlayResult {
    const game = this.requirePlaying(key, userId);
    if (!Number.isInteger(cardNumber) || cardNumber < CARD_MIN || cardNumber > CARD_MAX) {
      throw new GameRuleError('INVALID_CARD', `カードは${CARD_MIN}〜${CARD_MAX}の整数です。`);
    }
    const hand = game.hands.get(userId)!;
    const handIndex = hand.findIndex((card) => card.number === cardNumber);
    if (handIndex < 0) {
      throw new GameRuleError('CARD_NOT_OWNED', 'そのカードはあなたの手札にありません。');
    }
    if (game.lastPlayed !== null && cardNumber < game.lastPlayed) {
      throw new GameRuleError('OUT_OF_ORDER', 'カードは現在の場の数字以上の順番で出してください。');
    }
    if (!this.allDeclarationsComplete(game)) {
      throw new GameRuleError(
        'DECLARATIONS_INCOMPLETE',
        '全員の手札を宣言してからカードを出してください。',
      );
    }

    const playedCard = hand.splice(handIndex, 1)[0]!;
    this.removeDeclaration(game, userId, playedCard.id);
    const skippedCards: number[] = [];
    for (const [playerId, playerHand] of game.hands) {
      const skipped = playerHand.filter((card) => card.number < playedCard.number);
      skippedCards.push(...skipped.map((card) => card.number));
      if (skipped.length > 0) {
        const skippedIds = new Set(skipped.map((card) => card.id));
        for (let index = playerHand.length - 1; index >= 0; index -= 1) {
          if (skippedIds.has(playerHand[index]!.id)) {
            playerHand.splice(index, 1);
          }
        }
        for (const skippedCard of skipped) this.removeDeclaration(game, playerId, skippedCard.id);
      }
    }
    skippedCards.sort((left, right) => left - right);

    const isFirstCard = game.pile.length === 0;
    game.pile.push(playedCard.number);
    game.lastPlayed = playedCard.number;
    const livesLost = skippedCards.length;
    game.lives = Math.max(0, game.lives - livesLost);
    const lost = game.lives === 0;
    const stageCleared = !lost && this.allHandsEmpty(game);
    const won = stageCleared && game.stage === MAX_STAGE;
    if (lost) game.status = 'lost';
    else if (won) game.status = 'won';
    else if (stageCleared) game.status = 'awaiting_next_stage';

    return {
      status: isFirstCard ? 'start' : 'ok',
      playedCard: playedCard.number,
      skippedCards,
      livesLost,
      remainingLives: game.lives,
      stageCleared,
      won,
      lost,
      pile: [...game.pile],
    };
  }

  public checkEnd(key: GameKey): 'win' | 'lose' | null {
    const game = this.games.get(key);
    if (!game) return null;
    if (game.status === 'won' || game.status === 'lost') {
      return game.status === 'won' ? 'win' : 'lose';
    }
    if (game.lives <= 0) {
      game.status = 'lost';
      return 'lose';
    }
    if (game.stage === MAX_STAGE && game.status === 'playing' && this.allHandsEmpty(game)) {
      game.status = 'won';
      return 'win';
    }
    return null;
  }

  public delete(key: GameKey): void {
    this.games.delete(key);
  }

  private createCardId(): string {
    this.nextCardId += 1;
    return `card-${this.nextCardId.toString(36)}`;
  }

  private allHandsEmpty(game: GameState): boolean {
    return game.players.every((playerId) => (game.hands.get(playerId)?.length ?? 0) === 0);
  }

  private allDeclarationsComplete(game: GameState): boolean {
    return game.players.every((playerId) => {
      const declarations = game.declarations.get(playerId);
      return (game.hands.get(playerId) ?? []).every((card) => declarations?.has(card.id) === true);
    });
  }

  private findCardBySlot(game: GameState, userId: string, slot: number): HandCard {
    if (!Number.isInteger(slot) || slot < CARD_SLOT_MIN || slot > CARD_SLOT_MAX) {
      throw new GameRuleError(
        'INVALID_CARD_SLOT',
        `カード番号は${CARD_SLOT_MIN}〜${CARD_SLOT_MAX}の整数です。`,
      );
    }
    const card = game.hands.get(userId)?.find((candidate) => candidate.slot === slot);
    if (!card) {
      throw new GameRuleError('CARD_SLOT_NOT_FOUND', 'その番号のカードは現在の手札にありません。');
    }
    return card;
  }

  private removeDeclaration(game: GameState, userId: string, cardId: string | undefined): void {
    if (!cardId) return;
    const declarations = game.declarations.get(userId);
    declarations?.delete(cardId);
    if (declarations?.size === 0) game.declarations.delete(userId);
  }

  private require(key: GameKey): GameState {
    const game = this.games.get(key);
    if (!game) throw new GameRuleError('NO_GAME', 'このチャンネルではゲームがありません。');
    return game;
  }

  private requireActive(game: GameState): void {
    if (game.status === 'won' || game.status === 'lost') {
      throw new GameRuleError('TERMINAL', 'このゲームは既に終了しています。');
    }
  }

  private requirePlaying(key: GameKey, userId: string): GameState {
    const game = this.require(key);
    if (game.status === 'won' || game.status === 'lost') {
      throw new GameRuleError('TERMINAL', 'このゲームは既に終了しています。');
    }
    if (game.status !== 'playing') {
      throw new GameRuleError('NOT_PLAYING', '現在カードを出せるステージではありません。');
    }
    if (!game.players.includes(userId)) {
      throw new GameRuleError('NOT_PLAYER', 'このゲームの参加者ではありません。');
    }
    return game;
  }
}
