// assets/scripts/components/AutoplayPopupComponent.ts

import { _decorator, Component, Node, Button, Label } from "cc";
import { EventBus } from "../core/EventBus";
import { GameEvent } from "../core/GameEvents";
import { GameState } from "../core/GameState";
import { GameDifficulty } from "../types/GameTypes";
import { BetAmountConfig } from "../Config/GameConfig";
import {
  AutoplayConfig,
  getAutoplayManager,
} from "../managers/AutoplayManager";

const { ccclass, property } = _decorator;

/**
 * AutoplayPopupComponent - Handles the autoplay configuration popup UI
 *
 * Features:
 * - Difficulty selection buttons
 * - Bet amount selection (using existing bet amounts)
 * - Round count selection with +/- buttons
 * - Take tile selection with +/- buttons
 * - Start button to begin autoplay
 * - Close button to dismiss popup
 */
@ccclass("AutoplayPopupComponent")
export class AutoplayPopupComponent extends Component {
  // Difficulty buttons
  @property({ type: Button, tooltip: "Easy difficulty button" })
  easyButton: Button = null!;

  @property({ type: Button, tooltip: "Medium difficulty button" })
  mediumButton: Button = null!;

  @property({ type: Button, tooltip: "Hard difficulty button" })
  hardButton: Button = null!;

  @property({ type: Button, tooltip: "Hardcore difficulty button" })
  hardcoreButton: Button = null!;

  // Bet amount controls
  @property({ type: Button, tooltip: "Decrease bet amount" })
  betDecreaseButton: Button = null!;

  @property({ type: Button, tooltip: "Increase bet amount" })
  betIncreaseButton: Button = null!;

  @property({ type: Label, tooltip: "Current bet amount display" })
  betAmountLabel: Label = null!;

  // Round count controls
  @property({ type: Button, tooltip: "Decrease round count" })
  roundDecreaseButton: Button = null!;

  @property({ type: Button, tooltip: "Increase round count" })
  roundIncreaseButton: Button = null!;

  @property({ type: Label, tooltip: "Current round count display" })
  roundCountLabel: Label = null!;

  // Quick select round buttons
  @property({ type: Button, tooltip: "Quick select 10 rounds" })
  rounds10Button: Button = null!;

  @property({ type: Button, tooltip: "Quick select 20 rounds" })
  rounds20Button: Button = null!;

  @property({ type: Button, tooltip: "Quick select 50 rounds" })
  rounds50Button: Button = null!;

  @property({ type: Button, tooltip: "Quick select 100 rounds" })
  rounds100Button: Button = null!;

  @property({ type: Button, tooltip: "Quick select 200 rounds" })
  rounds200Button: Button = null!;

  @property({ type: Button, tooltip: "Quick select infinite rounds" })
  roundsInfinityButton: Button = null!;

  // Take tile controls
  @property({ type: Button, tooltip: "Decrease take tile number" })
  takeTileDecreaseButton: Button = null!;

  @property({ type: Button, tooltip: "Increase take tile number" })
  takeTileIncreaseButton: Button = null!;

  @property({ type: Label, tooltip: "Current take tile display" })
  takeTileLabel: Label = null!;

  // Action buttons
  @property({ type: Button, tooltip: "Start autoplay button" })
  startButton: Button = null!;

  @property({ type: Button, tooltip: "Close popup button" })
  closeButton: Button = null!;

  // Configuration state
  private selectedDifficulty: GameDifficulty = GameDifficulty.EASY;
  private selectedBetIndex: number = 0;
  private selectedRoundCount: number = 5;
  private selectedTakeTile: number = 3;

  // Constraints
  private readonly MIN_ROUNDS = 1;
  private readonly MAX_ROUNDS = 999;
  private readonly INFINITY_ROUNDS = 999; // Represents infinite rounds
  private readonly MIN_TAKE_TILE = 1;
  private maxTakeTile: number = 30; // Will be updated based on difficulty
  private isInfinityMode: boolean = false;

  // Difficulty to max tile mapping
  private readonly DIFFICULTY_MAX_TILES: Record<GameDifficulty, number> = {
    [GameDifficulty.EASY]: 30,
    [GameDifficulty.MEDIUM]: 25,
    [GameDifficulty.HARD]: 22,
    [GameDifficulty.HARDCORE]: 18,
  };

  onLoad() {
    console.log("[AutoplayPopupComponent] Initializing");
    this.initializeDefaults();
    this.setupButtonListeners();
    this.updateAllDisplays();
  }

  /**
   * Initialize default values
   */
  private initializeDefaults(): void {
    // Find default bet amount index
    const defaultBet = BetAmountConfig.DEFAULT;
    this.selectedBetIndex = BetAmountConfig.AMOUNTS.indexOf(defaultBet);
    if (this.selectedBetIndex === -1) {
      this.selectedBetIndex = 0;
    }

    // Set max take tile based on difficulty
    this.maxTakeTile = this.DIFFICULTY_MAX_TILES[this.selectedDifficulty];

    // Ensure take tile is within bounds
    if (this.selectedTakeTile > this.maxTakeTile) {
      this.selectedTakeTile = this.maxTakeTile;
    }
  }

  /**
   * Setup button click listeners
   */
  private setupButtonListeners(): void {
    // Difficulty buttons
    if (this.easyButton) {
      this.easyButton.node.on(
        Button.EventType.CLICK,
        () => this.onDifficultySelected(GameDifficulty.EASY),
        this,
      );
    }
    if (this.mediumButton) {
      this.mediumButton.node.on(
        Button.EventType.CLICK,
        () => this.onDifficultySelected(GameDifficulty.MEDIUM),
        this,
      );
    }
    if (this.hardButton) {
      this.hardButton.node.on(
        Button.EventType.CLICK,
        () => this.onDifficultySelected(GameDifficulty.HARD),
        this,
      );
    }
    if (this.hardcoreButton) {
      this.hardcoreButton.node.on(
        Button.EventType.CLICK,
        () => this.onDifficultySelected(GameDifficulty.HARDCORE),
        this,
      );
    }

    // Bet amount controls
    if (this.betDecreaseButton) {
      this.betDecreaseButton.node.on(
        Button.EventType.CLICK,
        this.onBetDecrease,
        this,
      );
    }
    if (this.betIncreaseButton) {
      this.betIncreaseButton.node.on(
        Button.EventType.CLICK,
        this.onBetIncrease,
        this,
      );
    }

    // Round count controls
    if (this.roundDecreaseButton) {
      this.roundDecreaseButton.node.on(
        Button.EventType.CLICK,
        this.onRoundDecrease,
        this,
      );
    }
    if (this.roundIncreaseButton) {
      this.roundIncreaseButton.node.on(
        Button.EventType.CLICK,
        this.onRoundIncrease,
        this,
      );
    }

    // Quick select round buttons
    if (this.rounds10Button) {
      this.rounds10Button.node.on(
        Button.EventType.CLICK,
        () => this.onQuickSelectRounds(10),
        this,
      );
    }
    if (this.rounds20Button) {
      this.rounds20Button.node.on(
        Button.EventType.CLICK,
        () => this.onQuickSelectRounds(20),
        this,
      );
    }
    if (this.rounds50Button) {
      this.rounds50Button.node.on(
        Button.EventType.CLICK,
        () => this.onQuickSelectRounds(50),
        this,
      );
    }
    if (this.rounds100Button) {
      this.rounds100Button.node.on(
        Button.EventType.CLICK,
        () => this.onQuickSelectRounds(100),
        this,
      );
    }
    if (this.rounds200Button) {
      this.rounds200Button.node.on(
        Button.EventType.CLICK,
        () => this.onQuickSelectRounds(200),
        this,
      );
    }
    if (this.roundsInfinityButton) {
      this.roundsInfinityButton.node.on(
        Button.EventType.CLICK,
        () => this.onQuickSelectRounds(this.INFINITY_ROUNDS),
        this,
      );
    }

    // Take tile controls
    if (this.takeTileDecreaseButton) {
      this.takeTileDecreaseButton.node.on(
        Button.EventType.CLICK,
        this.onTakeTileDecrease,
        this,
      );
    }
    if (this.takeTileIncreaseButton) {
      this.takeTileIncreaseButton.node.on(
        Button.EventType.CLICK,
        this.onTakeTileIncrease,
        this,
      );
    }

    // Action buttons
    if (this.startButton) {
      this.startButton.node.on(
        Button.EventType.CLICK,
        this.onStartClicked,
        this,
      );
    }
    if (this.closeButton) {
      this.closeButton.node.on(
        Button.EventType.CLICK,
        this.onCloseClicked,
        this,
      );
    }
  }

  /**
   * Handle difficulty selection
   */
  private onDifficultySelected(difficulty: GameDifficulty): void {
    EventBus.emit(GameEvent.UI_BUTTON_CLICKED);

    this.selectedDifficulty = difficulty;
    this.maxTakeTile = this.DIFFICULTY_MAX_TILES[difficulty];

    // Clamp take tile if it exceeds new max
    if (this.selectedTakeTile > this.maxTakeTile) {
      this.selectedTakeTile = this.maxTakeTile;
    }

    this.updateDifficultyButtons();
    this.updateTakeTileDisplay();

    console.log(`[AutoplayPopupComponent] Difficulty selected: ${difficulty}`);
  }

  /**
   * Handle bet amount decrease
   */
  private onBetDecrease(): void {
    EventBus.emit(GameEvent.UI_BUTTON_CLICKED);

    if (this.selectedBetIndex > 0) {
      this.selectedBetIndex--;
      this.updateBetAmountDisplay();
    }
  }

  /**
   * Handle bet amount increase
   */
  private onBetIncrease(): void {
    EventBus.emit(GameEvent.UI_BUTTON_CLICKED);

    if (this.selectedBetIndex < BetAmountConfig.AMOUNTS.length - 1) {
      this.selectedBetIndex++;
      this.updateBetAmountDisplay();
    }
  }

  /**
   * Handle round count decrease
   */
  private onRoundDecrease(): void {
    EventBus.emit(GameEvent.UI_BUTTON_CLICKED);

    // If in infinity mode, switch to MAX displayable rounds
    if (this.isInfinityMode) {
      this.isInfinityMode = false;
      this.selectedRoundCount = 200;
      this.updateRoundCountDisplay();
      return;
    }

    if (this.selectedRoundCount > this.MIN_ROUNDS) {
      this.selectedRoundCount--;
      this.updateRoundCountDisplay();
    }
  }

  /**
   * Handle round count increase
   */
  private onRoundIncrease(): void {
    EventBus.emit(GameEvent.UI_BUTTON_CLICKED);

    // If already at max or infinity, do nothing
    if (this.isInfinityMode) {
      return;
    }

    if (this.selectedRoundCount < 200) {
      this.selectedRoundCount++;
      this.updateRoundCountDisplay();
    } else {
      // At 200, next step is infinity
      this.isInfinityMode = true;
      this.selectedRoundCount = this.INFINITY_ROUNDS;
      this.updateRoundCountDisplay();
    }
  }

  /**
   * Handle quick select rounds button click
   */
  private onQuickSelectRounds(rounds: number): void {
    EventBus.emit(GameEvent.UI_BUTTON_CLICKED);

    if (rounds === this.INFINITY_ROUNDS) {
      this.isInfinityMode = true;
      this.selectedRoundCount = this.INFINITY_ROUNDS;
    } else {
      this.isInfinityMode = false;
      this.selectedRoundCount = rounds;
    }

    this.updateRoundCountDisplay();
    console.log(
      `[AutoplayPopupComponent] Quick selected ${this.isInfinityMode ? "∞" : rounds} rounds`,
    );
  }

  /**
   * Handle take tile decrease
   */
  private onTakeTileDecrease(): void {
    EventBus.emit(GameEvent.UI_BUTTON_CLICKED);

    if (this.selectedTakeTile > this.MIN_TAKE_TILE) {
      this.selectedTakeTile--;
      this.updateTakeTileDisplay();
    }
  }

  /**
   * Handle take tile increase
   */
  private onTakeTileIncrease(): void {
    EventBus.emit(GameEvent.UI_BUTTON_CLICKED);

    if (this.selectedTakeTile < this.maxTakeTile) {
      this.selectedTakeTile++;
      this.updateTakeTileDisplay();
    }
  }

  /**
   * Handle start button click
   */
  private onStartClicked(): void {
    EventBus.emit(GameEvent.UI_BUTTON_CLICKED);

    const betAmount = BetAmountConfig.AMOUNTS[this.selectedBetIndex];

    // Validate bet amount against balance
    if (betAmount > GameState.balance) {
      console.warn("[AutoplayPopupComponent] Insufficient balance");
      // Could show an error message here
      return;
    }

    // Create autoplay configuration
    const config: AutoplayConfig = {
      difficulty: this.selectedDifficulty,
      betAmount: betAmount,
      totalRounds: this.selectedRoundCount,
      takeTileNumber: this.selectedTakeTile,
    };

    console.log(
      "[AutoplayPopupComponent] Starting autoplay with config:",
      config,
    );

    // Get autoplay manager and start
    const autoplayManager = getAutoplayManager();
    if (autoplayManager) {
      const success = autoplayManager.startAutoplay(config);
      if (success) {
        // Hide popup
        this.node.active = false;
      }
    } else {
      console.error("[AutoplayPopupComponent] AutoplayManager not found");
    }
  }

  /**
   * Handle close button click
   */
  private onCloseClicked(): void {
    EventBus.emit(GameEvent.UI_BUTTON_CLICKED);
    this.node.active = false;
  }

  /**
   * Update all displays
   */
  private updateAllDisplays(): void {
    this.updateDifficultyButtons();
    this.updateBetAmountDisplay();
    this.updateRoundCountDisplay();
    this.updateTakeTileDisplay();
  }

  /**
   * Update difficulty button states
   */
  private updateDifficultyButtons(): void {
    const buttons = [
      { btn: this.easyButton, diff: GameDifficulty.EASY },
      { btn: this.mediumButton, diff: GameDifficulty.MEDIUM },
      { btn: this.hardButton, diff: GameDifficulty.HARD },
      { btn: this.hardcoreButton, diff: GameDifficulty.HARDCORE },
    ];

    buttons.forEach(({ btn, diff }) => {
      if (btn) {
        const isSelected = this.selectedDifficulty === diff;
        btn.interactable = !isSelected;
      }
    });
  }

  /**
   * Update bet amount display
   */
  private updateBetAmountDisplay(): void {
    if (this.betAmountLabel) {
      const amount = BetAmountConfig.AMOUNTS[this.selectedBetIndex];
      const formatted = amount >= 1 ? `$${amount}` : `$${amount.toFixed(2)}`;
      this.betAmountLabel.string = formatted;
    }

    // Update button states
    if (this.betDecreaseButton) {
      this.betDecreaseButton.interactable = this.selectedBetIndex > 0;
    }
    if (this.betIncreaseButton) {
      this.betIncreaseButton.interactable =
        this.selectedBetIndex < BetAmountConfig.AMOUNTS.length - 1;
    }
  }

  /**
   * Update round count display
   */
  private updateRoundCountDisplay(): void {
    if (this.roundCountLabel) {
      if (this.isInfinityMode) {
        this.roundCountLabel.string = "∞";
      } else {
        this.roundCountLabel.string = `${this.selectedRoundCount}`;
      }
    }

    // Update arrow button states
    if (this.roundDecreaseButton) {
      this.roundDecreaseButton.interactable =
        this.selectedRoundCount > this.MIN_ROUNDS || this.isInfinityMode;
    }
    if (this.roundIncreaseButton) {
      this.roundIncreaseButton.interactable = !this.isInfinityMode;
    }

    // Update quick select button states (highlight selected)
    this.updateQuickSelectButtonStates();
  }

  /**
   * Update quick select button visual states
   */
  private updateQuickSelectButtonStates(): void {
    const quickSelectButtons = [
      { btn: this.rounds10Button, value: 10 },
      { btn: this.rounds20Button, value: 20 },
      { btn: this.rounds50Button, value: 50 },
      { btn: this.rounds100Button, value: 100 },
      { btn: this.rounds200Button, value: 200 },
      { btn: this.roundsInfinityButton, value: this.INFINITY_ROUNDS },
    ];

    quickSelectButtons.forEach(({ btn, value }) => {
      if (btn) {
        const isSelected = this.isInfinityMode
          ? value === this.INFINITY_ROUNDS
          : this.selectedRoundCount === value;
        // Make selected button non-interactable to show it's active
        btn.interactable = !isSelected;
      }
    });
  }

  /**
   * Update take tile display
   */
  private updateTakeTileDisplay(): void {
    if (this.takeTileLabel) {
      this.takeTileLabel.string = `${this.selectedTakeTile}`;
    }

    // Update button states
    if (this.takeTileDecreaseButton) {
      this.takeTileDecreaseButton.interactable =
        this.selectedTakeTile > this.MIN_TAKE_TILE;
    }
    if (this.takeTileIncreaseButton) {
      this.takeTileIncreaseButton.interactable =
        this.selectedTakeTile < this.maxTakeTile;
    }
  }

  /**
   * Called when popup becomes active - refresh displays
   */
  onEnable() {
    this.updateAllDisplays();
  }

  onDestroy() {
    console.log("[AutoplayPopupComponent] Destroyed");
  }
}
