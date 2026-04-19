// assets/scripts/Config/GameConfig.ts

import { GameDifficulty } from "../types/GameTypes";

/**
 * Audio configuration
 */
export const AudioConfig = {
  // Default volume levels (0.0 to 1.0)
  DEFAULT_BGM_VOLUME: 0.1,
  DEFAULT_SFX_VOLUME: 0.9,

  // Volume step for UI controls
  VOLUME_STEP: 0.1,
} as const;

/**
 * Bet amount configuration
 */
export const BetAmountConfig = {
  // Available bet amounts (in order)
  AMOUNTS: [
    0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000,
  ] as const,

  // Default bet amount
  DEFAULT: 10,

  // Number of columns in the bet amount grid
  GRID_COLUMNS: 3,
} as const;

export const GameConfig = {
  // API Configuration
  API_BASE_URL: "/api", // CHANGE THIS TO YOUR BACKEND
  API_TIMEOUT: 10000, // 10 seconds
  RETRY_DELAY_MS: 300,
  RETRY_DELAY_MS_SECOND: 600,
  MAX_RETRIES: 1,

  // Currency
  DEFAULT_CURRENCY: "LKR",

  // Tile Configuration
  TILE_WIDTH: 256,
  TILE_HEIGHT: 256,
  TILE_GAP: 256,

  // World Configuration
  // Player start moved further left so player appears to the left of first tile
  // This is the "invincible start" X position (not a real tile)
  PLAYER_START_X: -300, // <-- moved left from -200 to -300
  PLAYER_START_Y: 0,

  // Player visual offset – applied on TOP of every position (start, tile, jump arc)
  // Use these to shift the player sprite without changing game logic positions
  PLAYER_OFFSET_X: 100,
  PLAYER_OFFSET_Y: 0,
  WORLD_START_X: 0,
  TREASURE_OFFSET: 200,

  // Camera Configuration
  CAMERA_FOLLOW_SPEED: 0.1,
  CAMERA_OFFSET_X: 400,
  CAMERA_OFFSET_Y: 0,

  // Animation Configuration
  JUMP_DURATION: 0.6, // Faster jump travel speed (DragonBones anim is time-scaled to match)
  JUMP_HEIGHT: 100,
  REVEAL_DURATION: 0.3,

  // Cash-Out Button Slide Animation
  CASHOUT_SLIDE_OFFSET: 400, // How far off-screen (px) the button slides to the right
  CASHOUT_SLIDE_DURATION: 0.75, // Slide animation duration in seconds

  // Difficulty Tile Counts (MANDATORY CONFIGURATION)
  DIFFICULTY_TILE_COUNTS: {
    [GameDifficulty.EASY]: 30,
    [GameDifficulty.MEDIUM]: 25,
    [GameDifficulty.HARD]: 22,
    [GameDifficulty.HARDCORE]: 18,
  },

  // Object Pool Configuration
  TILE_POOL_SIZE: 35, // Max tiles + buffer
  BACKGROUND_POOL_SIZE: 20,
} as const;

/**
 * Multiplier tables for each difficulty
 * These determine the payout at each tile index
 */
export const MULTIPLIER_TABLES = {
  EASY: [
    // Steps 1-5
    1.01, 1.02, 1.05, 1.1, 1.14,
    // Steps 6-10
    1.18, 1.23, 1.29, 1.34, 1.42,
    // Steps 11-15
    1.48, 1.56, 1.65, 1.75, 1.85,
    // Steps 16-20
    1.98, 2.12, 2.28, 2.47, 2.7,
    // Steps 21-25
    2.96, 3.28, 3.7, 4.11, 4.64,
    // Steps 26-30
    5.39, 6.5, 8.36, 12.08, 23.24,
  ],
  MEDIUM: [
    // Steps 1-5
    1.08, 1.21, 1.36, 1.55, 1.78,
    // Steps 6-10
    2.05, 2.37, 2.76, 3.23, 3.85,
    // Steps 11-15
    4.62, 5.61, 6.91, 8.64, 10.99,
    // Steps 16-20
    14.29, 18.96, 26.07, 37.24, 53.82,
    // Steps 21-25
    82.35, 137.58, 265.34, 638.81, 2456.99,
  ],
  HARD: [
    // Steps 1-5
    1.17, 1.46, 1.83, 2.31, 2.94,
    // Steps 6-10
    3.82, 5.02, 6.66, 9.03, 12.51,
    // Steps 11-15
    17.73, 25.79, 38.7, 60.21, 97.33,
    // Steps 16-20
    166.87, 305.93, 595.85, 1283.02, 3267.64,
    // Steps 21-22
    10898.53, 62161.87,
  ],
  HARDCORE: [
    // Steps 1-5
    1.44, 2.2, 3.44, 5.52, 9.08,
    // Steps 6-10
    15.29, 26.77, 48.69, 92.53, 185.07,
    // Steps 11-15
    391.24, 894.27, 2235.71, 6096.14, 18960.32,
    // Steps 16-18
    72432.6, 379631.78, 3608838.7,
  ],
} as const;

/**
 * Get multiplier for a specific difficulty and tile index
 */
export function getMultiplier(
  difficulty: GameDifficulty,
  tileIndex: number,
): number {
  const table = MULTIPLIER_TABLES[difficulty];
  if (tileIndex < 0 || tileIndex >= table.length) {
    console.error(
      `Invalid tile index ${tileIndex} for difficulty ${difficulty}`,
    );
    return 1.0;
  }
  return table[tileIndex];
}

/**
 * Get tile count for a difficulty
 */
export function getTileCount(difficulty: GameDifficulty): number {
  return GameConfig.DIFFICULTY_TILE_COUNTS[difficulty];
}
