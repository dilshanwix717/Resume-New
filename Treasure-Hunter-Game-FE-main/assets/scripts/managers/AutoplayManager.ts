// assets/scripts/managers/AutoplayManager.ts

import { _decorator, Component } from "cc";
import { EventBus } from "../core/EventBus";
import { GameEvent } from "../core/GameEvents";
import { GameState } from "../core/GameState";
import { GameDifficulty } from "../types/GameTypes";
import { gameSpeedManager } from "./GameSpeedManager";

const { ccclass } = _decorator;

/**
 * Autoplay configuration interface
 */
export interface AutoplayConfig {
  difficulty: GameDifficulty;
  betAmount: number;
  totalRounds: number;
  takeTileNumber: number; // Which tile to cashout at (1-based for user, 0-based internally)
}

/**
 * Autoplay state interface
 */
export interface AutoplayState {
  isActive: boolean;
  currentRound: number;
  totalRounds: number;
  config: AutoplayConfig | null;
}

/**
 * AutoplayManager - Manages automatic gameplay
 *
 * This manager handles:
 * - Starting/stopping autoplay
 * - Automatic bet placement
 * - Automatic tile clicking based on configured take tile
 * - Automatic cashout at specified tile
 * - Tracking rounds completed
 */
@ccclass("AutoplayManager")
export class AutoplayManager extends Component {
  private state: AutoplayState = {
    isActive: false,
    currentRound: 0,
    totalRounds: 0,
    config: null,
  };

  private isWaitingForRoundEnd: boolean = false;
  private currentTileTarget: number = 0;
  private isProcessingJump: boolean = false;
  private awaitingLandingToJump: boolean = false;

  onLoad() {
    console.log("[AutoplayManager] Initializing");
    // Register this instance as the singleton
    setAutoplayManager(this);
    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for round events
    EventBus.on(GameEvent.BET_CONFIRMED, this.onBetConfirmed.bind(this));
    EventBus.on(GameEvent.ROUND_ENDED, this.onRoundEnded.bind(this));
    EventBus.on(GameEvent.BET_FAILED, this.onBetFailed.bind(this));

    // Listen for jump results to continue auto-jumping
    EventBus.on(GameEvent.JUMP_RESULT_SAFE, this.onJumpResultSafe.bind(this));
    EventBus.on(GameEvent.JUMP_RESULT_TRAP, this.onJumpResultTrap.bind(this));
    EventBus.on(GameEvent.LANDING_COMPLETE, this.onLandingComplete.bind(this));

    // Listen for cashout complete
    EventBus.on(GameEvent.CASHOUT_COMPLETE, this.onCashoutComplete.bind(this));
  }

  /**
   * Start autoplay with the given configuration
   */
  public startAutoplay(config: AutoplayConfig): boolean {
    // Validate configuration
    if (!this.validateConfig(config)) {
      console.error("[AutoplayManager] Invalid autoplay configuration", config);
      return false;
    }

    // Check if balance is sufficient
    if (config.betAmount > GameState.balance) {
      console.error("[AutoplayManager] Insufficient balance for autoplay");
      return false;
    }

    console.log("[AutoplayManager] Starting autoplay", config);

    // Update state
    this.state = {
      isActive: true,
      currentRound: 0,
      totalRounds: config.totalRounds,
      config: { ...config },
    };

    this.isWaitingForRoundEnd = false;
    this.isProcessingJump = false;
    // Convert 1-based user input to 0-based tile index
    this.currentTileTarget = config.takeTileNumber - 1;

    // Emit autoplay started event
    EventBus.emit(GameEvent.AUTOPLAY_STARTED, {
      config: this.state.config,
      totalRounds: this.state.totalRounds,
    });

    // Start first round
    this.startNextRound();

    return true;
  }

  /**
   * Stop autoplay
   */
  public stopAutoplay(): void {
    if (!this.state.isActive) {
      return;
    }

    console.log("[AutoplayManager] Stopping autoplay", {
      completedRounds: this.state.currentRound,
      totalRounds: this.state.totalRounds,
      isRoundInProgress: GameState.isRoundActive(),
    });

    const wasActive = this.state.isActive;
    const isRoundInProgress = GameState.isRoundActive();

    // Cancel any scheduled operations
    this.unscheduleAllCallbacks();

    // Reset state
    this.state = {
      isActive: false,
      currentRound: 0,
      totalRounds: 0,
      config: null,
    };

    this.isWaitingForRoundEnd = false;
    this.isProcessingJump = false;
    this.awaitingLandingToJump = false;

    // Emit autoplay stopped event with round state info
    if (wasActive) {
      EventBus.emit(GameEvent.AUTOPLAY_STOPPED, {
        reason: "user_stopped",
        isRoundInProgress: isRoundInProgress,
        currentTileIndex: GameState.currentTileIndex,
      });
    }
  }

  /**
   * Check if autoplay is currently active
   */
  public isAutoplayActive(): boolean {
    return this.state.isActive;
  }

  /**
   * Get current autoplay state
   */
  public getState(): Readonly<AutoplayState> {
    return { ...this.state };
  }

  /**
   * Validate autoplay configuration
   */
  private validateConfig(config: AutoplayConfig): boolean {
    if (!config.difficulty) {
      return false;
    }

    if (config.betAmount <= 0) {
      return false;
    }

    // Allow up to 999 for infinity mode
    if (config.totalRounds <= 0 || config.totalRounds > 999) {
      return false;
    }

    if (config.takeTileNumber <= 0) {
      return false;
    }

    return true;
  }

  /**
   * Start the next autoplay round
   */
  private startNextRound(): void {
    if (!this.state.isActive || !this.state.config) {
      return;
    }

    // Check if we've completed all rounds
    if (this.state.currentRound >= this.state.totalRounds) {
      console.log("[AutoplayManager] All rounds completed");
      this.completeAutoplay();
      return;
    }

    // Check if balance is sufficient for next round
    if (this.state.config.betAmount > GameState.balance) {
      console.log("[AutoplayManager] Insufficient balance for next round");
      this.completeAutoplay("insufficient_balance");
      return;
    }

    // Increment round counter
    this.state.currentRound++;
    this.isWaitingForRoundEnd = true;
    this.isProcessingJump = false;

    console.log(
      `[AutoplayManager] Starting round ${this.state.currentRound}/${this.state.totalRounds}`,
    );

    // Small delay before placing bet (adjusted for game speed)
    const delay = gameSpeedManager.adjustDelay(0.5);
    this.scheduleOnce(() => {
      if (this.state.isActive && this.state.config) {
        // Place the bet
        EventBus.emit(GameEvent.BET_PLACED, {
          betAmount: this.state.config.betAmount,
          difficulty: this.state.config.difficulty,
        });
      }
    }, delay);
  }

  /**
   * Handle bet confirmed - start auto-jumping
   */
  private onBetConfirmed(): void {
    if (!this.state.isActive) {
      return;
    }

    console.log("[AutoplayManager] Bet confirmed, starting auto-jump sequence");

    // Start auto-jumping after a short delay (adjusted for game speed)
    const delay = gameSpeedManager.adjustDelay(0.8);
    this.scheduleOnce(() => {
      this.performNextJump();
    }, delay);
  }

  /**
   * Perform the next jump in the sequence
   */
  private performNextJump(): void {
    if (!this.state.isActive || !this.state.config || this.isProcessingJump) {
      return;
    }

    const currentTileIndex = GameState.currentTileIndex;
    const targetTile = this.currentTileTarget;

    console.log(
      `[AutoplayManager] Checking jump: current=${currentTileIndex}, target=${targetTile}`,
    );

    // Check if we've reached the take tile
    if (currentTileIndex >= targetTile) {
      console.log("[AutoplayManager] Reached take tile, cashing out");
      this.performCashout();
      return;
    }

    // Check if we can still jump
    if (!GameState.canJump()) {
      console.log("[AutoplayManager] Cannot jump, waiting...");
      return;
    }

    // Perform the jump
    const nextTileIndex = currentTileIndex + 1;
    this.isProcessingJump = true;

    console.log(`[AutoplayManager] Auto-clicking tile ${nextTileIndex}`);

    EventBus.emit(GameEvent.UI_TILE_CLICKED, {
      tileIndex: nextTileIndex,
    });
  }

  /**
   * Handle safe jump result
   */
  private onJumpResultSafe(payload: any): void {
    if (!this.state.isActive) {
      return;
    }

    this.isProcessingJump = false;

    // Wait for LANDING_COMPLETE (emitted by PlayerController after the jump
    // tween finishes) before scheduling the next jump. Using a fixed delay
    // caused the next jump to fire while the player was still mid-animation,
    // which led to PlayerController silently dropping the visual animation
    // and the player visually skipping a tile.
    this.awaitingLandingToJump = true;
  }

  /**
   * Handle trap jump result
   */
  private onJumpResultTrap(payload: any): void {
    if (!this.state.isActive) {
      return;
    }

    console.log("[AutoplayManager] Hit trap, round will end");
    this.isProcessingJump = false;
    this.awaitingLandingToJump = false;
    // Round will end via ROUND_ENDED event
  }

  /**
   * Handle landing complete
   * Used to sequence autoplay jumps: we wait for the player's visual
   * animation to finish before requesting the next jump.
   */
  private onLandingComplete(): void {
    if (!this.state.isActive || !this.awaitingLandingToJump) {
      return;
    }

    this.awaitingLandingToJump = false;

    // Small delay after landing for visual clarity
    const delay = gameSpeedManager.adjustDelay(0.15);
    this.scheduleOnce(() => {
      if (this.state.isActive) {
        const currentTileIndex = GameState.currentTileIndex;
        const targetTile = this.currentTileTarget;

        if (currentTileIndex >= targetTile) {
          console.log(
            "[AutoplayManager] Reached target tile after safe jump, cashing out",
          );
          this.performCashout();
        } else {
          this.performNextJump();
        }
      }
    }, delay);
  }

  /**
   * Perform cashout
   */
  private performCashout(): void {
    if (!this.state.isActive || !GameState.canCashOut()) {
      return;
    }

    console.log("[AutoplayManager] Performing auto-cashout");
    EventBus.emit(GameEvent.CASHOUT_REQUESTED);
  }

  /**
   * Handle cashout complete
   */
  private onCashoutComplete(payload: any): void {
    if (!this.state.isActive) {
      return;
    }

    console.log("[AutoplayManager] Cashout complete", payload);
    // Round end will be handled by onRoundEnded
  }

  /**
   * Handle round ended
   */
  private onRoundEnded(payload: any): void {
    if (!this.state.isActive) {
      return;
    }

    console.log("[AutoplayManager] Round ended", {
      isWin: payload.isWin,
      currentRound: this.state.currentRound,
      totalRounds: this.state.totalRounds,
    });

    this.isWaitingForRoundEnd = false;
    this.isProcessingJump = false;
    this.awaitingLandingToJump = false;

    // Emit round complete event
    EventBus.emit(GameEvent.AUTOPLAY_ROUND_COMPLETE, {
      roundNumber: this.state.currentRound,
      totalRounds: this.state.totalRounds,
      isWin: payload.isWin,
      winAmount: payload.winAmount || 0,
    });

    // Start next round after delay - must be longer than win screen duration (2.5s)
    // to prevent overlap
    const delay = gameSpeedManager.adjustDelay(3.0);
    this.scheduleOnce(() => {
      if (this.state.isActive) {
        this.startNextRound();
      }
    }, delay);
  }

  /**
   * Handle bet failed
   */
  private onBetFailed(payload: any): void {
    if (!this.state.isActive) {
      return;
    }

    console.error("[AutoplayManager] Bet failed during autoplay", payload);
    this.isWaitingForRoundEnd = false;
    this.isProcessingJump = false;
    this.awaitingLandingToJump = false;

    // Stop autoplay on bet failure
    this.completeAutoplay("bet_failed");
  }

  /**
   * Complete autoplay (all rounds done or stopped due to error)
   */
  private completeAutoplay(reason: string = "completed"): void {
    console.log("[AutoplayManager] Autoplay complete", {
      reason,
      completedRounds: this.state.currentRound,
      totalRounds: this.state.totalRounds,
    });

    const completedRounds = this.state.currentRound;
    const totalRounds = this.state.totalRounds;

    // Cancel any scheduled operations
    this.unscheduleAllCallbacks();

    // Reset state
    this.state = {
      isActive: false,
      currentRound: 0,
      totalRounds: 0,
      config: null,
    };

    this.isWaitingForRoundEnd = false;
    this.isProcessingJump = false;
    this.awaitingLandingToJump = false;

    // Emit autoplay stopped event
    EventBus.emit(GameEvent.AUTOPLAY_STOPPED, {
      reason,
      completedRounds,
      totalRounds,
      isRoundInProgress: false, // Autoplay completion means round is not in progress
    });
  }

  onDestroy() {
    console.log("[AutoplayManager] Destroyed");
    // Clear singleton reference
    if (autoplayManagerInstance === this) {
      autoplayManagerInstance = null;
    }
  }
}

// Singleton instance for easy access
let autoplayManagerInstance: AutoplayManager | null = null;

export function getAutoplayManager(): AutoplayManager | null {
  return autoplayManagerInstance;
}

export function setAutoplayManager(manager: AutoplayManager): void {
  autoplayManagerInstance = manager;
}
