// types/GameTypes.ts

export enum GameDifficulty {
  EASY = "EASY",
  MEDIUM = "MEDIUM",
  HARD = "HARD",
  HARDCORE = "HARDCORE",
}

export enum TileState {
  UNREVEALED = "UNREVEALED",
  SAFE = "SAFE",
  TRAP = "TRAP",
}

export enum BetCrashStatus {
  SAFE = "SAFE",
  TRAP = "TRAP",
}

// API Request Types
export interface BetStartRequest {
  currency: string;
  betAmount: number;
  gameDifficulty: GameDifficulty;
  clientSeed: string;
}

export interface BetStartResponse {
  id: string;
  userPlatformId: string;
}

export interface CheckCrashRequest {
  lastSteppedPoint: number;
}

export interface CheckCrashResponse {
  id: string;
  betCrashStatus: BetCrashStatus;
}

export interface CashOutResponse {
  id: string;
  userPlatformId: string;
  cashOutPoint: number;
  betAmount: number;
  winAmount: number;
  afterBetBalance: number;
  multiplier: number;
  crashPoint: number;
}

export interface LoginResponse {
  loginSuccess: boolean;
}

// Event Payload Types
export interface BetPlacedPayload {
  betAmount: number;
  difficulty: GameDifficulty;
}

export interface BetConfirmedPayload {
  roundId: string;
  tileCount: number;
}

export interface JumpRequestedPayload {
  tileIndex: number;
}

export interface JumpResultPayload {
  tileIndex: number;
  isSafe: boolean;
  multiplier: number;
}

export interface CashOutResultPayload {
  winAmount: number;
  multiplier: number;
  finalBalance: number;
  crashPoint?: number;
}

export interface NetworkErrorPayload {
  message: string;
  canRetry: boolean;
}

export interface RoundEndedPayload {
  isWin: boolean;
  finalMultiplier: number;
  winAmount?: number;
}

// Game State Interface
export interface IGameState {
  balance: number;
  roundId: string | null;
  betAmount: number;
  difficulty: GameDifficulty | null;
  tileCount: number;
  currentTileIndex: number;
  earnedMultiplier: number;
  currentFSMState: string;
  isAwaitingServer: boolean;
  clientSeed: string | null;
}

// Configuration Types
export interface DifficultyConfig {
  tileCount: number;
  multipliers: number[];
}

export interface TilePosition {
  x: number;
  y: number;
}

export interface RecentActivityEntry {
  roundId: string;
  fullRoundId?: string;
  time: string;
  betAmount: number;
  winAmount: number;
  result: string;
}



/** Raw API/UI data for a round detail (supports multiple field names) */
export interface RoundDetailData {
  id?: string;
  betId?: string;
  createdAt?: string;
  time?: string;
  betAmount?: number | string;
  amount?: number | string;
  multiplier?: number | string;
  crashLevel?: unknown;
  result?: string;
  betStatus?: string;
  status?: string;
  crashPoint?: number | string;
  gameDifficulty?: string;
  difficulty?: string;
  lastSteppedPoint?: unknown;
  winAmount?: number | string;
  payout?: number | string;
  lossAmount?: number | string;
  beforeBetBalance?: number | string;
  afterBetBalance?: number | string;
  cashOutPoint?: number | string;
  data?: RoundDetailData;
}

export enum RecordAnimationState {
  WIN = "win",
  DEATH = "death",
  NEUTRAL = "neutral",
}

export const ANIM_NAME_BY_STATE: Record<RecordAnimationState, string> = {
  [RecordAnimationState.WIN]: "Win",
  [RecordAnimationState.DEATH]: "Death",
  [RecordAnimationState.NEUTRAL]: "animtion0",
};

export enum winAnimationState {
  WIN_1 = "Win_1",
  BIGWIN = "BigWin",
  MEGAWIN = "MegaWin",
  SUPERWIN = "SuperWin",
  SUPERMEGAWIN = "SuperMegaWin"
}



export enum stepAnimationState {
  STEPS = "Steps",
  STEPS_DARK = "Steps_Dark",
  STEPS_WIN = "Steps_Win",
  STEPS_CRASH = "Steps_Crash",
  STEPS_CRASH_STILL = "Steps_Crash_Still",

}

