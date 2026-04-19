// assets/scripts/core/GameState.ts
import { IGameState, GameDifficulty } from "../types/GameTypes";

class GameStateClass implements IGameState {
  // Player state
  balance: number = 1000; // Default starting balance

  // Round state
  roundId: string | null = null;
  betAmount: number = 0;
  difficulty: GameDifficulty | null = null;
  tileCount: number = 0;
  currentTileIndex: number = -1; // -1 means at start position
  earnedMultiplier: number = 1.0;

  // FSM state
  currentFSMState: string = "Idle";
  isAwaitingServer: boolean = false;

  // Security
  clientSeed: string | null = null;

  /**
   * Reset round-specific state (called at round end)
   * Note: FSM state is reset by GameController via fsm.reset()
   */
  resetRound(): void {
    this.roundId = null;
    this.betAmount = 0;
    this.difficulty = null;
    this.tileCount = 0;
    this.currentTileIndex = -1;
    this.earnedMultiplier = 1.0;
    this.isAwaitingServer = false;
    this.clientSeed = null;
    // Don't reset currentFSMState here - let FSM handle it
  }

  /**
   * Get a snapshot of current state (for debugging/logging)
   */
  getSnapshot(): Readonly<IGameState> {
    return {
      balance: this.balance,
      roundId: this.roundId,
      betAmount: this.betAmount,
      difficulty: this.difficulty,
      tileCount: this.tileCount,
      currentTileIndex: this.currentTileIndex,
      earnedMultiplier: this.earnedMultiplier,
      currentFSMState: this.currentFSMState,
      isAwaitingServer: this.isAwaitingServer,
      clientSeed: this.clientSeed,
    };
  }

  /**
   * Check if a round is currently active
   */
  isRoundActive(): boolean {
    return this.roundId !== null;
  }

  /**
   * Check if player can jump to next tile
   */
  canJump(): boolean {
    return (
      this.isRoundActive() &&
      !this.isAwaitingServer &&
      this.currentTileIndex < this.tileCount - 1
    );
  }

  /**
   * Check if player can initiate a cash out
   * Note: Only checks game state, not FSM state (FSM handles its own validation)
   */
  canCashOut(): boolean {
    return (
      this.isRoundActive() &&
      this.currentTileIndex >= 0 // Must have jumped at least once
    );
  }

  /**
   * Get current potential win amount
   */
  getPotentialWin(): number {
    return this.betAmount * this.earnedMultiplier;
  }
}

// Singleton instance - ONLY ONE instance exists
export const GameState = new GameStateClass();
