// assets/scripts/core/GameController.ts
import { _decorator, Component, director } from "cc";
import { EventBus } from "./EventBus";
import { GameEvent } from "./GameEvents";
import { GameState } from "./GameState";
import { GameStateMachine, FSMState } from "./GameStateMachine";
import { NetworkService } from "../services/NetworkService";
import { GameConfig, getMultiplier, getTileCount } from "../Config/GameConfig";
import { APIConfig } from "../Config/APIConfig";
import {
  BetPlacedPayload,
  BetConfirmedPayload,
  JumpRequestedPayload,
  JumpResultPayload,
  CashOutResultPayload,
  NetworkErrorPayload,
  RoundEndedPayload,
  GameDifficulty,
} from "../types/GameTypes";
import { gameSpeedManager } from "../managers/GameSpeedManager";
import { RecentActivityComponent } from "../components/RecentActivityComponent";

const { ccclass } = _decorator;

@ccclass("GameController")
export class GameController extends Component {
  private fsm: GameStateMachine = null!;
  private networkService: NetworkService = null!;
  private failedJumpCount: number = 0;
  private isPreviewMode: boolean = true;

  // Track processed tile indices to prevent duplicate handling
  private lastProcessedTileIndex: number = -1;
  // Track if bet was already confirmed to prevent duplicate processing
  private betConfirmedProcessed: boolean = false;
  // Track if cashout is currently being processed to prevent duplicate handling
  private cashoutInProgress: boolean = false;

  onLoad() {
    // Initialize FSM (singleton pattern prevents duplicate listeners)
    this.fsm = new GameStateMachine();

    // Initialize Network Service
    this.networkService = new NetworkService();

    // Use token from APIConfig (loaded by LoadingScreenController)
    // Falls back to localStorage if not set
    let authToken = APIConfig.authorizationToken;
    // if (!authToken) {
    //   authToken = APIConfig.loadTokenFromStorage();
    // }

    //   DEV MODE: Uncomment below to use hardcoded token for development
    authToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjJhY2ViODc3LTRhNDYtNDk1OC1iYzU1LWE1Yzk1YzE4OTUyYiIsImVtYWlsIjoia2VzaGFyYUBkYi5jb21tIiwicm9sZSI6eyJpZCI6ImVlNzA5YTJkLWY0ZjAtNDkxMS04NjVmLTBiNDFiZTIzMWYxYSIsIm5hbWUiOiJQTEFZRVIifSwiaWF0IjoxNzczMDMzNjk4LCJleHAiOjE3NzU2MjU2OTh9.gYr6Gj-6LZYkg4RB44xIW9dq2oGoJ3n_2xP8uBepnBA";

    this.networkService.init(GameConfig.API_BASE_URL, authToken || undefined);

    if (!authToken) {
      console.warn(
        "[GameController] No auth token available - API calls may fail",
      );
    }

    // Setup event listeners
    this.setupEventListeners();

    // Fetch wallet balance from server
    this.fetchWalletBalance();

    // Generate preview scene on load
    this.generatePreviewScene();
  }

  /**
   * Fetch wallet balance from server
   */
  private async fetchWalletBalance(): Promise<void> {
    await this.networkService.getWalletBalance();
  }

  /**
   * Generate preview scene with default difficulty
   */
  private generatePreviewScene(): void {
    console.log("[GameController] Generating preview scene");
    const defaultDifficulty = GameDifficulty.EASY;
    const tileCount = getTileCount(defaultDifficulty);

    EventBus.emit(GameEvent.SCENE_GENERATED, {
      difficulty: defaultDifficulty,
      tileCount: tileCount,
    });
  }

  /**
   * Setup all event listeners
   * Note: FSM handles state transitions, GameController handles game logic
   */
  private setupEventListeners(): void {
    // UI Events - these initiate actions
    EventBus.on<BetPlacedPayload>(
      GameEvent.BET_PLACED,
      this.onBetPlaced.bind(this),
    );

    EventBus.on<JumpRequestedPayload>(
      GameEvent.JUMP_REQUESTED,
      this.onJumpRequested.bind(this),
    );

    EventBus.on(
      GameEvent.CASHOUT_REQUESTED,
      this.onCashoutRequested.bind(this),
    );

    EventBus.on(
      GameEvent.UI_DIFFICULTY_CHANGED,
      this.onDifficultyChanged.bind(this),
    );

    // Network Response Events - these complete actions
    EventBus.on<BetConfirmedPayload>(
      GameEvent.BET_CONFIRMED,
      this.onBetConfirmed.bind(this),
    );

    EventBus.on(GameEvent.BET_FAILED, this.onBetFailed.bind(this));
    EventBus.on(GameEvent.JUMP_RESULT_SAFE, this.onJumpResultSafe.bind(this));
    EventBus.on(GameEvent.JUMP_RESULT_TRAP, this.onJumpResultTrap.bind(this));

    EventBus.on<CashOutResultPayload>(
      GameEvent.CASHOUT_COMPLETE,
      this.onCashoutComplete.bind(this),
    );

    EventBus.on<NetworkErrorPayload>(
      GameEvent.NETWORK_ERROR,
      this.onNetworkError.bind(this),
    );

    EventBus.on(
      GameEvent.WALLET_BALANCE_FETCHED,
      this.onWalletBalanceFetched.bind(this),
    );

    // Animation Complete Events
    EventBus.on(GameEvent.LANDING_COMPLETE, this.onLandingComplete.bind(this));

    EventBus.on(GameEvent.SHOW_RECENT_POPUP, this.onShowRecentPopup.bind(this));
    EventBus.on(GameEvent.RECENT_LOAD_PAGE, this.onRecentLoadPage.bind(this));
    EventBus.on(
      GameEvent.RECENT_ROW_CLICKED,
      this.onRecentRowClicked.bind(this),
    );
  }

  /**
   * Handle wallet balance fetched from server
   */
  private onWalletBalanceFetched(payload: {
    balance: number;
    currency: string;
  }): void {
    console.log("[GameController] Wallet balance received", payload);
    GameState.balance = payload.balance;
    EventBus.emit(GameEvent.BALANCE_UPDATED, { balance: GameState.balance });
  }

  /**
   * Handle difficulty change in preview mode
   */
  private onDifficultyChanged(payload: any): void {
    if (this.isPreviewMode) {
      console.log(
        "[GameController] Difficulty changed in preview mode",
        payload,
      );
      const tileCount = getTileCount(payload.difficulty);

      // Generate new preview scene directly - TileManager handles clearing internally
      // This prevents black screen flash when changing difficulty
      EventBus.emit(GameEvent.SCENE_GENERATED, {
        difficulty: payload.difficulty,
        tileCount: tileCount,
      });
    }
  }

  /**
   * Handle bet placement
   */
  private async onBetPlaced(payload: BetPlacedPayload): Promise<void> {
    // Check FSM state - only process if FSM transitioned successfully
    const currentState = this.fsm.getCurrentState();
    if (currentState !== FSMState.Betting) {
      return;
    }

    console.log("[GameController] Processing bet", payload);

    // Exit preview mode
    this.isPreviewMode = false;
    this.betConfirmedProcessed = false;

    // Validate bet amount
    if (payload.betAmount <= 0 || payload.betAmount > GameState.balance) {
      console.error("[GameController] Invalid bet amount");
      EventBus.emit(GameEvent.BET_FAILED, {
        message: "Invalid bet amount",
        canRetry: true,
      });
      this.isPreviewMode = true;
      return;
    }

    // Note: Don't clear scene here - onBetConfirmed will regenerate
    // (TileManager.generateTiles already clears existing tiles internally)

    // Update GameState
    GameState.betAmount = payload.betAmount;
    GameState.difficulty = payload.difficulty;
    GameState.tileCount = getTileCount(payload.difficulty);
    GameState.currentTileIndex = -1;
    GameState.earnedMultiplier = 1.0;

    // Generate client seed
    GameState.clientSeed = this.generateClientSeed();

    // Deduct bet from balance
    GameState.balance -= payload.betAmount;
    EventBus.emit(GameEvent.BALANCE_UPDATED, { balance: GameState.balance });

    // Call server
    await this.networkService.postBet({
      currency: GameConfig.DEFAULT_CURRENCY,
      betAmount: payload.betAmount,
      gameDifficulty: payload.difficulty,
      clientSeed: GameState.clientSeed,
    });
  }

  /**
   * Handle bet confirmation from server
   */
  private onBetConfirmed(payload: BetConfirmedPayload): void {
    // Prevent duplicate processing
    if (this.betConfirmedProcessed) {
      return;
    }

    // Check FSM state - should be in Ready state after BET_CONFIRMED
    const currentState = this.fsm.getCurrentState();
    if (currentState !== FSMState.Ready) {
      return;
    }

    this.betConfirmedProcessed = true;
    console.log("[GameController] Bet confirmed", payload);

    // Update GameState
    GameState.roundId = payload.roundId;

    // Reset tracking
    this.lastProcessedTileIndex = -1;

    // Emit event to generate scene
    EventBus.emit(GameEvent.SCENE_GENERATED, {
      difficulty: GameState.difficulty,
      tileCount: GameState.tileCount,
    });

    // Reset counters
    this.networkService.resetRetryCount();
    this.failedJumpCount = 0;
  }

  /**
   * Handle bet failure
   */
  private onBetFailed(payload: NetworkErrorPayload): void {
    console.log("[GameController] Bet failed", payload);

    // Refund bet amount
    GameState.balance += GameState.betAmount;
    EventBus.emit(GameEvent.BALANCE_UPDATED, { balance: GameState.balance });

    // Reset state
    GameState.resetRound();

    // Return to preview mode
    this.isPreviewMode = true;
    this.betConfirmedProcessed = false;
  }

  /**
   * Handle jump request (from tile click)
   */
  private async onJumpRequested(payload: JumpRequestedPayload): Promise<void> {
    // Check FSM state - only process if FSM transitioned to AwaitingServer
    const currentState = this.fsm.getCurrentState();
    if (currentState !== FSMState.AwaitingServer) {
      return;
    }

    // Prevent duplicate processing for same tile
    if (payload.tileIndex <= this.lastProcessedTileIndex) {
      return;
    }

    console.log("[GameController] Processing jump", {
      tileIndex: payload.tileIndex,
    });

    // Ignore clicks in preview mode
    if (this.isPreviewMode) {
      return;
    }

    await this.requestJump(payload.tileIndex);
  }

  /**
   * Request a jump from the server
   */
  private async requestJump(tileIndex: number): Promise<void> {
    // Validate tile index
    if (tileIndex !== GameState.currentTileIndex + 1) {
      console.error("[GameController] Invalid tile index", {
        requested: tileIndex,
        expected: GameState.currentTileIndex + 1,
      });
      return;
    }

    // Call server
    await this.networkService.postJump(GameState.roundId!, tileIndex);
  }

  /**
   * Handle safe jump result from server
   */
  private onJumpResultSafe(payload: JumpResultPayload): void {
    // Check FSM state - should be back in Ready state
    const currentState = this.fsm.getCurrentState();
    if (currentState !== FSMState.Ready) {
      return;
    }

    // Prevent duplicate processing for same tile
    if (payload.tileIndex <= this.lastProcessedTileIndex) {
      return;
    }

    console.log("[GameController] Jump result: SAFE", payload);

    // Mark this tile as processed
    this.lastProcessedTileIndex = payload.tileIndex;

    // Reset failed jump counter
    this.failedJumpCount = 0;

    // Update GameState
    GameState.currentTileIndex = payload.tileIndex;
    GameState.earnedMultiplier = getMultiplier(
      GameState.difficulty!,
      payload.tileIndex,
    );

    // Emit multiplier update
    EventBus.emit(GameEvent.MULTIPLIER_UPDATED, {
      multiplier: GameState.earnedMultiplier,
      potentialWin: GameState.getPotentialWin(),
    });

    // Reveal tile
    EventBus.emit(GameEvent.TILE_REVEALED, {
      tileIndex: payload.tileIndex,
      isSafe: true,
    });

    // Check if player reached treasure
    if (GameState.currentTileIndex === GameState.tileCount - 1) {
      this.handleWin();
    }
  }

  /**
   * Handle trap jump result from server
   */
  private onJumpResultTrap(payload: JumpResultPayload): void {
    // Check FSM state - should be in TrapResult state
    const currentState = this.fsm.getCurrentState();
    if (currentState !== FSMState.TrapResult) {
      return;
    }

    // Prevent duplicate processing
    if (payload.tileIndex <= this.lastProcessedTileIndex) {
      return;
    }

    console.log("[GameController] Jump result: TRAP", payload);

    // Mark as processed
    this.lastProcessedTileIndex = payload.tileIndex;

    // Update GameState
    GameState.currentTileIndex = payload.tileIndex;

    // Reveal trap tile
    EventBus.emit(GameEvent.TILE_REVEALED, {
      tileIndex: payload.tileIndex,
      isSafe: false,
    });

    // Emit landing complete to trigger round end
    // In a real game, this would be emitted after a death animation
    // Apply game speed to delay
    const adjustedDelay = gameSpeedManager.adjustDelay(0.5);
    this.scheduleOnce(() => {
      EventBus.emit(GameEvent.LANDING_COMPLETE);
    }, adjustedDelay);
  }

  /**
   * Handle landing animation complete
   */
  private onLandingComplete(): void {
    const currentState = this.fsm.getCurrentState();

    // Only process if FSM transitioned to RoundEnded
    if (currentState === FSMState.RoundEnded) {
      console.log("[GameController] Landing complete - ending round");
      this.endRound(false);
    }
  }

  /**
   * Handle cashout request
   */
  private async onCashoutRequested(): Promise<void> {
    // Prevent duplicate cashout processing - check this FIRST before any async operations
    if (this.cashoutInProgress) {
      console.warn(
        "[GameController] Cashout already in progress, ignoring duplicate",
      );
      return;
    }

    // Check FSM state - only process if FSM transitioned to CashingOut
    const currentState = this.fsm.getCurrentState();
    if (currentState !== FSMState.CashingOut) {
      return;
    }

    // Validate: must have made at least one successful jump
    if (GameState.currentTileIndex < 0) {
      console.warn("[GameController] Cannot cash out - no jumps made yet");
      // Reset FSM back to Ready state since cashout failed validation
      this.fsm.forceState(FSMState.Ready);
      return;
    }

    // Mark cashout in progress immediately to prevent any duplicate processing
    this.cashoutInProgress = true;

    console.log("[GameController] Processing cashout", {
      tileIndex: GameState.currentTileIndex,
      multiplier: GameState.earnedMultiplier,
    });

    // Call server
    await this.networkService.postCashout(GameState.roundId!);
  }

  /**
   * Handle cashout complete from server
   */
  private onCashoutComplete(payload: CashOutResultPayload): void {
    // Check FSM state - should be in RoundEnded state
    const currentState = this.fsm.getCurrentState();
    if (currentState !== FSMState.RoundEnded) {
      return;
    }

    console.log("[GameController] Cashout complete", payload);

    // Reset cashout flag
    this.cashoutInProgress = false;

    // Update balance
    GameState.balance = payload.finalBalance;
    EventBus.emit(GameEvent.BALANCE_UPDATED, { balance: GameState.balance });

    // Show crash point on the tile if the server returned one
    if (payload.crashPoint != null && payload.crashPoint > 0) {
      // Server returns 1-indexed crashPoint, convert to 0-indexed tileIndex
      const crashTileIndex = payload.crashPoint - 1;
      EventBus.emit(GameEvent.SHOW_CRASH_POINT, { tileIndex: crashTileIndex });
    }

    // End round successfully
    this.endRound(true, payload.winAmount);
  }

  /**
   * Handle network error
   */
  private onNetworkError(payload: NetworkErrorPayload): void {
    console.error("[GameController] Network error", payload);

    // Check if this was a cashout error
    if (this.cashoutInProgress) {
      console.warn(
        "[GameController] Cashout failed, recovering to Ready state",
      );
      this.cashoutInProgress = false;

      // Emit error notification to UI
      EventBus.emit(GameEvent.ROUND_ERROR, {
        message: payload.message || "Cash out failed, please try again",
      });

      // Force FSM back to Ready state so player can retry cashout or continue jumping
      this.fsm.forceState(FSMState.Ready);
      return;
    }

    // Handle jump errors
    this.failedJumpCount++;

    // If jump failed twice, auto-cashout
    if (this.failedJumpCount >= 2 && GameState.currentTileIndex >= 0) {
      console.log("[GameController] Auto-cashing out after failed jumps");
      const winAmount = GameState.getPotentialWin();
      GameState.balance += winAmount;
      EventBus.emit(GameEvent.BALANCE_UPDATED, { balance: GameState.balance });
      this.endRound(true, winAmount);
    } else {
      // End round with error
      EventBus.emit(GameEvent.ROUND_ERROR, {
        message: payload.message,
      });
      this.endRound(false);
    }
  }

  /**
   * Handle player reaching treasure
   */
  private handleWin(): void {
    console.log("[GameController] Player reached treasure!");
    const winAmount = GameState.getPotentialWin();
    GameState.balance += winAmount;
    EventBus.emit(GameEvent.BALANCE_UPDATED, { balance: GameState.balance });

    // End round as win
    this.endRound(true, winAmount);
  }

  /**
   * End the round
   */
  private endRound(isWin: boolean, winAmount?: number): void {
    console.log("[GameController] Ending round", { isWin, winAmount });

    const payload: RoundEndedPayload = {
      isWin,
      finalMultiplier: GameState.earnedMultiplier,
      winAmount: winAmount || (isWin ? GameState.getPotentialWin() : 0),
    };

    EventBus.emit(GameEvent.ROUND_ENDED, payload);

    // Reset GameState
    GameState.resetRound();

    // Reset FSM to Idle
    this.fsm.reset();

    // Reset counters and tracking
    this.failedJumpCount = 0;
    this.lastProcessedTileIndex = -1;
    this.betConfirmedProcessed = false;
    this.cashoutInProgress = false;

    // Return to preview mode
    this.isPreviewMode = true;

    // Don't regenerate preview scene automatically - let the player see the final state
    // (revealed tiles, player position, win/loss result) until they place a new bet
    // Scene will be regenerated when:
    // 1. Player changes difficulty (via onDifficultyChanged)
    // 2. Player places a bet (via onBetConfirmed)
  }

  /**
   * Generate a unique client seed
   */
  private generateClientSeed(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  onDestroy() {
    console.log("[GameController] Destroyed");
    // Clean up FSM singleton
    GameStateMachine.destroy();
  }

  private async onShowRecentPopup(): Promise<any> {
    const bets = await this.networkService.getBets();
    const scene = director.getScene();
    if (!scene) {
      console.error("[GameController] Scene not found");
      return;
    }
    const recentActivityComponent = scene.getComponentInChildren(
      RecentActivityComponent,
    );
    if (recentActivityComponent) {
      recentActivityComponent.loadFromAPI(bets);
    } else {
      console.warn(
        "[GameController] RecentActivityComponent not found in scene",
      );
    }
  }

  private async onRecentLoadPage(payload: {
    page: number;
    limit: number;
  }): Promise<void> {
    const { page, limit } = payload ?? { page: 2, limit: 10 };
    const scene = director.getScene();
    if (!scene) {
      console.error("[GameController] Scene not found");
      return;
    }
    const recentActivityComponent = scene.getComponentInChildren(
      RecentActivityComponent,
    );
    if (recentActivityComponent) {
      recentActivityComponent.clearData();
    }
    const bets = await this.networkService.getBets({ page, limit });
    if (recentActivityComponent && bets != null) {
      recentActivityComponent.loadFromAPI(bets);
    }
  }

  private async onRecentRowClicked(payload: { betId: string }): Promise<void> {
    if (!payload?.betId) return;
    const data = await this.networkService.getBets({ betId: payload.betId });
    if (data != null) {
      console.log("qqqqqqqqqqqqqqqqqqqqqqqqqqqq", data);
      EventBus.emit(GameEvent.SHOW_ROUND_DETAIL, { data });
    }
  }
}
