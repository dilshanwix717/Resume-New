// assets/scripts/managers/UIManager.ts
import {
  _decorator,
  Component,
  Node,
  Label,
  Button,
  Prefab,
  instantiate,
  UIOpacity,
  Input,
  tween,
  Tween,
  Vec3,
} from "cc";
import { dragonBones } from "cc";
import { EventBus } from "../core/EventBus";
import { GameEvent } from "../core/GameEvents";
import { GameState } from "../core/GameState";
import { GameDifficulty, winAnimationState } from "../types/GameTypes";
import { GameConfig, MULTIPLIER_TABLES } from "../Config/GameConfig";
import { BetAmountSelector } from "../components/BetAmountSelector";
import { RoundDetail } from "../components/RoundDetail";
import { PopupController } from "../Controllers/PopupController";
import { gameSpeedManager } from "./GameSpeedManager";
import { getAutoplayManager } from "./AutoplayManager";

const { ccclass, property } = _decorator;

@ccclass("UIManager")
export class UIManager extends Component {
  // Bet Panel
  @property(Node)
  betPanel: Node = null!;

  @property(BetAmountSelector)
  betAmountSelector: BetAmountSelector = null!;

  @property(Button)
  placeBetButton: Button = null!;

  // Dropdown Selection Labels (updated when selection changes)
  @property({
    type: Label,
    tooltip: "Label showing current difficulty selection",
  })
  difficultySelectionLabel: Label = null!;

  @property({
    type: Label,
    tooltip: "Label showing current bet amount selection",
  })
  betAmountSelectionLabel: Label = null!;

  // Difficulty Buttons
  @property(Button)
  easyButton: Button = null!;

  @property(Button)
  mediumButton: Button = null!;

  @property(Button)
  hardButton: Button = null!;

  @property(Button)
  insaneButton: Button = null!;

  // Game Panel
  @property(Node)
  gamePanel: Node = null!;

  @property(Button)
  cashOutButton: Button = null!;

  @property({
    type: Label,
    tooltip: "Label on cash out button showing potential win amount",
  })
  cashOutLabel: Label = null!;

  // Info Display
  @property(Label)
  balanceLabel: Label = null!;

  @property(Label)
  multiplierLabel: Label = null!;

  @property(Label)
  potentialWinLabel: Label = null!;

  // Win Screen
  @property(Node)
  winScreen: Node = null!;

  @property(Label)
  winAmountLabel: Label = null!;

  @property({ type: Button, tooltip: "Button for recent popup" })
  recentPopUpButton: Button = null!;

  @property(Node)
  recentPopUp: Node = null!;

  @property({ type: Button, tooltip: "Button for info popup" })
  infoPopUpButton: Button = null!;

  @property(Node)
  infoPopUp: Node = null!;

  @property({ type: Button, tooltip: "Button for autoplay popup" })
  autoplayPopUpButton: Button = null!;

  @property(Node)
  autoplayPopUp: Node = null!;

  @property({
    type: Prefab,
    tooltip: "Round detail popup shown when a recent row is clicked",
  })
  roundDetailPopUp: Prefab = null!;

  // Speed Control Buttons
  @property({ type: Button, tooltip: "Fast speed button (2x)" })
  fastSpeedButton: Button = null!;

  @property({ type: Button, tooltip: "Normal speed button (1x)" })
  normalSpeedButton: Button = null!;

  // Autoplay Stop Button
  @property({ type: Button, tooltip: "Stop autoplay button" })
  stopAutoplayButton: Button = null!;

  // Autoplay Status Label
  @property({
    type: Label,
    tooltip: "Label showing autoplay status (rounds remaining)",
  })
  autoplayStatusLabel: Label = null!;

  // Autoplay Animation (DragonBones)
  @property({
    type: dragonBones.ArmatureDisplay,
    tooltip: "DragonBones animation to show when autoplay is active",
  })
  autoplayAnimation: dragonBones.ArmatureDisplay = null!;

  // Jump Button
  @property({
    type: Button,
    tooltip: "Button to trigger a jump to the next tile",
  })
  jumpButton: Button = null!;

  @property(dragonBones.ArmatureDisplay)
  winAnimation: dragonBones.ArmatureDisplay = null!;

  private selectedDifficulty: GameDifficulty = GameDifficulty.EASY;
  private isRoundActive: boolean = false;
  private isAutoplayActive: boolean = false;
  private roundDetailPopUpInstance: Node | null = null;
  private isCashOutHovered: boolean = false;
  private isCashOutEnabled: boolean = false;

  /** Original position of the cashout button (set once in onLoad) */
  private cashOutOriginalPos: Vec3 = new Vec3();
  /** Whether the cashout button is currently visible (tracked to avoid duplicate tweens) */
  private cashOutVisible: boolean = false;

  onLoad() {
    console.log("[UIManager] Initializing");

    // Capture the original (design-time) position of the cashout button
    if (this.cashOutButton) {
      Vec3.copy(this.cashOutOriginalPos, this.cashOutButton.node.position);
      // Start hidden
      this.cashOutButton.node.active = false;
      this.cashOutVisible = false;
    }

    this.setupButtonListeners();
    this.setupEventListeners();
    this.setupSelectionLabels();
    this.resetToIdleState();
    this.updateBalanceDisplay();
    this.updateSpeedButtonVisibility();
    this.updateStopButtonVisibility();
    this.updateAutoplayButtonState();
    this.updateJumpButtonVisibility();
  }

  /**
   * Initialize selection labels
   */
  private setupSelectionLabels(): void {
    this.updateDifficultyLabel();
    this.updateBetAmountLabel();
  }

  /**
   * Setup button listeners
   */
  private setupButtonListeners(): void {
    this.placeBetButton.node.on(
      Button.EventType.CLICK,
      this.onPlaceBetClicked,
      this,
    );

    this.cashOutButton.node.on(
      Button.EventType.CLICK,
      this.onCashOutClicked,
      this,
    );

    // Cash out button hover events for label state
    this.cashOutButton.node.on(
      Input.EventType.MOUSE_ENTER,
      this.onCashOutHoverEnter,
      this,
    );
    this.cashOutButton.node.on(
      Input.EventType.MOUSE_LEAVE,
      this.onCashOutHoverLeave,
      this,
    );

    // Difficulty buttons
    this.easyButton.node.on(Button.EventType.CLICK, () =>
      this.setDifficulty(GameDifficulty.EASY),
    );

    this.mediumButton.node.on(Button.EventType.CLICK, () =>
      this.setDifficulty(GameDifficulty.MEDIUM),
    );

    this.hardButton.node.on(Button.EventType.CLICK, () =>
      this.setDifficulty(GameDifficulty.HARD),
    );

    this.insaneButton.node.on(Button.EventType.CLICK, () =>
      this.setDifficulty(GameDifficulty.HARDCORE),
    );

    this.recentPopUpButton.node.on(Button.EventType.CLICK, () =>
      EventBus.emit(GameEvent.SHOW_RECENT_POPUP),
    );

    this.infoPopUpButton.node.on(Button.EventType.CLICK, () =>
      EventBus.emit(GameEvent.SHOW_INFO_POPUP),
    );

    this.autoplayPopUpButton.node.on(Button.EventType.CLICK, () =>
      EventBus.emit(GameEvent.SHOW_AUTOPLAY_POPUP),
    );

    // Speed control buttons
    if (this.fastSpeedButton) {
      this.fastSpeedButton.node.on(Button.EventType.CLICK, () =>
        this.onFastSpeedClicked(),
      );
    }

    if (this.normalSpeedButton) {
      this.normalSpeedButton.node.on(Button.EventType.CLICK, () =>
        this.onNormalSpeedClicked(),
      );
    }

    // Stop autoplay button
    if (this.stopAutoplayButton) {
      this.stopAutoplayButton.node.on(Button.EventType.CLICK, () =>
        this.onStopAutoplayClicked(),
      );
    }

    // Jump button
    if (this.jumpButton) {
      this.jumpButton.node.on(Button.EventType.CLICK, () =>
        this.onJumpButtonClicked(),
      );
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    EventBus.on(GameEvent.BET_CONFIRMED, this.onBetConfirmed.bind(this));
    EventBus.on(GameEvent.BET_FAILED, this.onBetFailed.bind(this));
    EventBus.on(GameEvent.BALANCE_UPDATED, this.onBalanceUpdated.bind(this));
    EventBus.on(
      GameEvent.MULTIPLIER_UPDATED,
      this.onMultiplierUpdated.bind(this),
    );
    EventBus.on(GameEvent.ROUND_ENDED, this.onRoundEnded.bind(this));
    EventBus.on(GameEvent.JUMP_RESULT_SAFE, this.onJumpResultSafe.bind(this));
    EventBus.on(GameEvent.JUMP_RESULT_TRAP, this.onJumpResultTrap.bind(this));
    EventBus.on(GameEvent.CASHOUT_COMPLETE, this.onCashoutComplete.bind(this));
    EventBus.on(
      GameEvent.UI_BET_AMOUNT_CHANGED,
      this.onBetAmountChanged.bind(this),
    );
    EventBus.on(GameEvent.SHOW_RECENT_POPUP, this.onShowRecentPopup.bind(this));
    EventBus.on(GameEvent.SHOW_INFO_POPUP, this.onShowInfoPopup.bind(this));
    EventBus.on(
      GameEvent.SHOW_AUTOPLAY_POPUP,
      this.onShowAutoplayPopup.bind(this),
    );
    EventBus.on(GameEvent.SHOW_ROUND_DETAIL, this.onShowRoundDetail.bind(this));

    // Error events
    EventBus.on(GameEvent.ROUND_ERROR, this.onRoundError.bind(this));
    EventBus.on(GameEvent.NETWORK_ERROR, this.onNetworkError.bind(this));
    EventBus.on(GameEvent.LOGIN_FAILED, this.onLoginFailed.bind(this));

    // Autoplay events
    EventBus.on(GameEvent.AUTOPLAY_STARTED, this.onAutoplayStarted.bind(this));
    EventBus.on(GameEvent.AUTOPLAY_STOPPED, this.onAutoplayStopped.bind(this));
    EventBus.on(
      GameEvent.AUTOPLAY_ROUND_COMPLETE,
      this.onAutoplayRoundComplete.bind(this),
    );

    // Jump button visibility events
    EventBus.on(GameEvent.LANDING_COMPLETE, this.onLandingComplete.bind(this));
  }

  /**
   * Set difficulty
   */
  private setDifficulty(difficulty: GameDifficulty): void {
    if (this.isRoundActive) {
      return;
    }

    // Emit button click for audio
    EventBus.emit(GameEvent.UI_BUTTON_CLICKED);

    this.selectedDifficulty = difficulty;
    console.log(`[UIManager] Difficulty: ${difficulty}`);
    this.updateDifficultyUI();
    this.updateDifficultyLabel();

    EventBus.emit(GameEvent.UI_DIFFICULTY_CHANGED, {
      difficulty,
    });
  }

  /**
   * Update difficulty selection label
   */
  private updateDifficultyLabel(): void {
    if (this.difficultySelectionLabel) {
      const difficultyNames: Record<GameDifficulty, string> = {
        [GameDifficulty.EASY]: "Easy",
        [GameDifficulty.MEDIUM]: "Medium",
        [GameDifficulty.HARD]: "Hard",
        [GameDifficulty.HARDCORE]: "Hardcore",
      };
      this.difficultySelectionLabel.string =
        difficultyNames[this.selectedDifficulty];
    }
  }

  /**
   * Update bet amount selection label
   */
  private updateBetAmountLabel(): void {
    if (this.betAmountSelectionLabel && this.betAmountSelector) {
      const amount = this.betAmountSelector.getSelectedAmount();
      const formatted = amount >= 1 ? `$${amount}` : `$${amount.toFixed(2)}`;
      this.betAmountSelectionLabel.string = formatted;
    }
  }

  /**
   * Update difficulty button visuals
   */
  private updateDifficultyUI(): void {
    const buttons = [
      { btn: this.easyButton, diff: GameDifficulty.EASY },
      { btn: this.mediumButton, diff: GameDifficulty.MEDIUM },
      { btn: this.hardButton, diff: GameDifficulty.HARD },
      { btn: this.insaneButton, diff: GameDifficulty.HARDCORE },
    ];

    buttons.forEach(({ btn, diff }) => {
      const isSelected = this.selectedDifficulty === diff;
      // Disable buttons during round or autoplay
      btn.interactable =
        !this.isRoundActive && !this.isAutoplayActive && !isSelected;
    });
  }

  /**
   * Place Bet button clicked
   */
  private onPlaceBetClicked(): void {
    // Ignore if autoplay is active
    if (this.isAutoplayActive) {
      return;
    }

    // Emit button click for audio
    EventBus.emit(GameEvent.UI_BUTTON_CLICKED);

    const betAmount = this.betAmountSelector.getSelectedAmount();

    if (betAmount <= 0 || betAmount > GameState.balance) {
      EventBus.emit(GameEvent.SHOW_ERROR_NOTIFICATION, {
        message: `Invalid bet amount. Available balance: $${GameState.balance.toFixed(2)}`,
      });
      return;
    }

    // Disable bet controls immediately
    this.setRoundStarting();

    EventBus.emit(GameEvent.BET_PLACED, {
      betAmount: betAmount,
      difficulty: this.selectedDifficulty,
    });
  }

  /**
   * Cash Out button clicked
   */
  private onCashOutClicked(): void {
    // Emit button click for audio
    EventBus.emit(GameEvent.UI_BUTTON_CLICKED);

    // Disable button immediately to prevent double-clicks
    this.setButtonEnabled(this.cashOutButton, false);
    this.setCashOutLabelEnabled(false);
    EventBus.emit(GameEvent.CASHOUT_REQUESTED);
  }

  /**
   * Bet confirmed by server - round is now active, player can jump
   */
  private onBetConfirmed(): void {
    console.log("[UIManager] Bet confirmed - round active");
    this.isRoundActive = true;

    // Hide bet button; cashout button stays hidden until first successful jump
    this.placeBetButton.node.active = false;
    this.hideCashOutButton(true);

    // Disable bet amount selector and difficulty buttons
    this.betAmountSelector.setEnabled(false);
    this.updateDifficultyUI();

    // Reset multiplier display
    this.updateMultiplierDisplay(1.0, GameState.betAmount);

    // Show jump button (first jump is available right after bet confirmation)
    if (!this.isAutoplayActive) {
      this.showJumpButton();
    }
  }

  /**
   * Bet failed - return to idle state
   */
  private onBetFailed(payload: any): void {
    console.warn("[UIManager] Bet failed:", payload.message);
    EventBus.emit(GameEvent.SHOW_ERROR_NOTIFICATION, {
      message: `Bet failed: ${payload.message}`,
    });
    this.resetToIdleState();
  }

  /**
   * Safe jump result - enable cash out
   */
  private onJumpResultSafe(): void {
    // Only enable if not in autoplay mode and not already enabled
    if (!this.isAutoplayActive && !this.cashOutButton.interactable) {
      console.log("[UIManager] Safe jump - cash out enabled");
      this.showCashOutButton();
      this.setButtonEnabled(this.cashOutButton, true);
      this.setCashOutLabelEnabled(true);
    }

    // Disable jump button while jump animation is playing
    // It will be re-enabled on LANDING_COMPLETE
    if (!this.isAutoplayActive) {
      this.disableJumpButton();
    }
  }

  /**
   * Trap jump result - player lost
   */
  private onJumpResultTrap(): void {
    console.log("[UIManager] Trap hit");
    this.setButtonEnabled(this.cashOutButton, false);
    this.setCashOutLabelEnabled(false);
    this.hideJumpButton();
  }

  /**
   * Cashout completed successfully
   */
  private onCashoutComplete(payload: any): void {
    console.log("[UIManager] Cashout complete:", payload.winAmount);
    this.hideJumpButton();
    // Note: hideJumpButton is correct here — round is over, button should disappear
    this.showWinScreen(payload.winAmount);
  }

  /**
   * Bet amount changed
   */
  private onBetAmountChanged(payload: any): void {
    this.updateBetAmountLabel();
  }

  /**
   * Balance updated
   */
  private onBalanceUpdated(): void {
    this.updateBalanceDisplay();
    // Refresh bet amount selector to update affordable amounts
    if (this.betAmountSelector) {
      this.betAmountSelector.refresh();
    }
  }

  /**
   * Multiplier updated
   */
  private onMultiplierUpdated(payload: any): void {
    this.updateMultiplierDisplay(payload.multiplier, payload.potentialWin);
  }

  /**
   * Round ended
   */
  private onRoundEnded(payload: any): void {
    console.log("[UIManager] Round ended", {
      isWin: payload.isWin,
      winAmount: payload.winAmount,
    });
    this.isRoundActive = false;

    // If win by reaching treasure (not cashout), show win screen
    if (payload.isWin && payload.winAmount > 0) {
      this.showWinScreen(payload.winAmount);
    }

    // Reset to idle state after short delay (adjusted for game speed)
    const adjustedDelay = gameSpeedManager.adjustDelay(0.3);
    this.scheduleOnce(() => {
      this.resetToIdleState();
    }, adjustedDelay);
  }

  /**
   * Set UI state when round is starting
   */
  private setRoundStarting(): void {
    this.setButtonEnabled(this.placeBetButton, false);
    this.betAmountSelector.setEnabled(false);
    this.updateDifficultyUI();
  }

  /**
   * Reset UI to idle state (ready for new bet)
   */
  private resetToIdleState(): void {
    this.isRoundActive = false;

    // Don't show normal bet controls if autoplay is active
    if (this.isAutoplayActive) {
      // Keep stop button visible, hide bet button
      this.placeBetButton.node.active = false;
      this.hideCashOutButton(true);
      this.updateStopButtonVisibility();
      return;
    }

    // Show bet controls
    this.placeBetButton.node.active = true;
    this.setButtonEnabled(this.placeBetButton, true);

    // Enable bet amount selector
    this.betAmountSelector.setEnabled(true);
    this.betAmountSelector.refresh();

    // Hide and disable cash out button
    this.hideCashOutButton();
    this.setButtonEnabled(this.cashOutButton, false);
    this.setCashOutLabelEnabled(false);
    this.updateCashOutLabel(0);

    // Hide jump button
    this.hideJumpButton();

    // Hide stop autoplay button
    this.updateStopButtonVisibility();

    // Enable difficulty selection
    this.updateDifficultyUI();

    // Enable autoplay button
    this.updateAutoplayButtonState();

    // Reset display
    this.multiplierLabel.string = "1.00x";
    this.potentialWinLabel.string = "$0.00";
  }

  /**
   * Get win animation based on selected difficulty and position in multiplier table.
   * Divides the difficulty's multiplier table into 4 sections:
   * - Section 0 (0–25%): WIN_1
   * - Section 1 (25–50%): BIGWIN
   * - Section 2 (50–75%): MEGAWIN
   * - Section 3 (75–100%): SUPERMEGAWIN
   */
  private getWinAnimationForSection(): string {
    const difficulty = GameState.difficulty ?? this.selectedDifficulty;
    const tileIndex = GameState.currentTileIndex;
    const tileCount = GameState.tileCount;

    if (!difficulty || tileCount <= 0 || tileIndex < 0) {
      return winAnimationState.WIN_1;
    }

    const table = MULTIPLIER_TABLES[difficulty];
    if (!table || tileIndex >= table.length) {
      return winAnimationState.WIN_1;
    }

    const sectionIndex = Math.min(
      3,
      Math.floor((tileIndex / table.length) * 4),
    );

    const animations: string[] = [
      winAnimationState.WIN_1,
      winAnimationState.BIGWIN,
      winAnimationState.MEGAWIN,
      winAnimationState.SUPERMEGAWIN,
    ];

    return animations[sectionIndex];
  }

  /**
   * Show win screen with animation
   */
  private showWinScreen(winAmount: number): void {
    const animation = this.getWinAnimationForSection();
    if (!this.winScreen) {
      return;
    }

    this.winAmountLabel.string = `+$${winAmount.toFixed(2)}`;
    this.winScreen.active = true;

    this.winAnimation.playAnimation(animation, 0);
    // if (this.autoplayAnimation) {
    //   this.autoplayAnimation.playAnimation(animation, 0);
    // }

    // Shorter duration during autoplay to prevent overlap with next round
    const baseDuration = this.isAutoplayActive ? 1.5 : 2.5;
    const adjustedDelay = gameSpeedManager.adjustDelay(baseDuration);
    this.scheduleOnce(() => {
      this.winScreen.active = false;
    }, adjustedDelay);
  }

  /**
   * Update balance display
   */
  private updateBalanceDisplay(): void {
    this.balanceLabel.string = `${GameState.balance.toFixed(2)}`;
  }

  /**
   * Update multiplier display
   */
  private updateMultiplierDisplay(multiplier: number, win: number): void {
    this.multiplierLabel.string = `${multiplier.toFixed(2)}x`;
    this.potentialWinLabel.string = `Win: $${win.toFixed(2)}`;
    this.updateCashOutLabel(win);
  }

  /**
   * Update cash out button label with potential win amount
   */
  private updateCashOutLabel(win: number): void {
    if (this.cashOutLabel) {
      this.cashOutLabel.string = `$${win.toFixed(2)}`;
    }
  }

  /**
   * Set cash out label enabled/disabled appearance
   */
  private setCashOutLabelEnabled(enabled: boolean): void {
    this.isCashOutEnabled = enabled;
    this.updateCashOutLabelAppearance();
  }

  /**
   * Handle cash out button hover enter
   */
  private onCashOutHoverEnter(): void {
    this.isCashOutHovered = true;
    this.updateCashOutLabelAppearance();
  }

  /**
   * Handle cash out button hover leave
   */
  private onCashOutHoverLeave(): void {
    this.isCashOutHovered = false;
    this.updateCashOutLabelAppearance();
  }

  /**
   * Update cash out label appearance based on enabled and hover state
   */
  private updateCashOutLabelAppearance(): void {
    if (!this.cashOutLabel) return;

    const uiOpacity = this.cashOutLabel.node.getComponent(UIOpacity);

    if (this.isCashOutEnabled) {
      // Enabled state
      if (this.isCashOutHovered) {
        // Enabled + Hovered: bright white
        if (uiOpacity) uiOpacity.opacity = 255;
        this.cashOutLabel.color = this.cashOutLabel.color
          .clone()
          .set(255, 255, 255, 255);
      } else {
        // Enabled + Not Hovered: slightly dimmed
        if (uiOpacity) uiOpacity.opacity = 230;
        this.cashOutLabel.color = this.cashOutLabel.color
          .clone()
          .set(240, 240, 240, 255);
      }
    } else {
      // Disabled state (same regardless of hover)
      if (uiOpacity) uiOpacity.opacity = 128;
      this.cashOutLabel.color = this.cashOutLabel.color
        .clone()
        .set(180, 180, 180, 255);
    }
  }

  /**
   * Set button enabled state
   */
  private setButtonEnabled(button: Button, enabled: boolean): void {
    button.interactable = enabled;
  }

  /**
   * Show recent activity popup
   */
  private onShowRecentPopup(): void {
    this.recentPopUp.active = true;
  }

  /**
   * Show info popup
   */
  private onShowInfoPopup(): void {
    this.infoPopUp.active = true;
  }

  /**
   * Show autoplay popup
   */
  private onShowAutoplayPopup(): void {
    // Don't show popup if round is active or autoplay is already running
    if (this.isRoundActive || this.isAutoplayActive) {
      return;
    }
    this.autoplayPopUp.active = true;
  }

  /**
   * Show round detail popup
   */
  private onShowRoundDetail(payload: { data: any }): void {
    if (!this.roundDetailPopUp) return;

    if (
      this.roundDetailPopUpInstance != null &&
      this.roundDetailPopUpInstance.active
    ) {
      return;
    }

    if (this.roundDetailPopUpInstance != null) {
      this.roundDetailPopUpInstance.destroy();
      this.roundDetailPopUpInstance = null;
    }

    const instance = instantiate(this.roundDetailPopUp);
    this.roundDetailPopUpInstance = instance;

    instance.active = true;
    instance.setParent(this.node);

    const onClose = () => {
      this.roundDetailPopUpInstance = null;
      EventBus.emit(GameEvent.ROUND_DETAIL_CLOSED);
    };
    const popupController = instance.getComponent(PopupController);
    if (popupController?.closeButton) {
      popupController.closeButton.node.once(
        Button.EventType.CLICK,
        onClose,
        this,
      );
    } else {
      const closeBtn = instance.getComponentInChildren(Button);
      if (closeBtn) {
        closeBtn.node.once(Button.EventType.CLICK, onClose, this);
      }
    }

    EventBus.emit(GameEvent.ROUND_DETAIL_OPENED);

    let roundDetail = instance.getComponent(RoundDetail);
    if (!roundDetail) {
      roundDetail = instance.getComponentInChildren(RoundDetail);
    }

    if (roundDetail) {
      roundDetail.setData(payload);
    } else {
      console.warn(
        "[UIManager] RoundDetail component not found or data is null",
        {
          hasComponent: !!roundDetail,
          hasData: payload?.data != null,
        },
      );
    }
  }

  /**
   * Handle fast speed button click
   */
  private onFastSpeedClicked(): void {
    // Emit button click for audio
    EventBus.emit(GameEvent.UI_BUTTON_CLICKED);

    console.log("[UIManager] Fast speed (2x) activated");
    gameSpeedManager.setFastSpeed();
    this.updateSpeedButtonVisibility();
  }

  /**
   * Handle normal speed button click
   */
  private onNormalSpeedClicked(): void {
    // Emit button click for audio
    EventBus.emit(GameEvent.UI_BUTTON_CLICKED);

    console.log("[UIManager] Normal speed (1x) activated");
    gameSpeedManager.setNormalSpeed();
    this.updateSpeedButtonVisibility();
  }

  /**
   * Update speed button visibility based on current speed
   * - When normal speed: show fast button, hide normal button
   * - When fast speed: show normal button, hide fast button
   */
  private updateSpeedButtonVisibility(): void {
    if (!this.fastSpeedButton || !this.normalSpeedButton) {
      return;
    }

    const isNormalSpeed = gameSpeedManager.isNormalSpeed();

    this.fastSpeedButton.node.active = isNormalSpeed;
    this.normalSpeedButton.node.active = !isNormalSpeed;
  }

  /**
   * Handle stop autoplay button click
   */
  private onStopAutoplayClicked(): void {
    // Emit button click for audio
    EventBus.emit(GameEvent.UI_BUTTON_CLICKED);

    console.log("[UIManager] Stop autoplay clicked");

    const autoplayManager = getAutoplayManager();
    if (autoplayManager) {
      autoplayManager.stopAutoplay();
    }
  }

  /**
   * Handle autoplay started event
   */
  private onAutoplayStarted(payload: any): void {
    console.log("[UIManager] Autoplay started", payload);
    this.isAutoplayActive = true;

    // Hide bet controls and autoplay button, show animation
    this.placeBetButton.node.active = false;
    this.setButtonEnabled(this.autoplayPopUpButton, false);
    this.autoplayPopUpButton.node.active = false;

    // Show and play autoplay animation
    this.showAutoplayAnimation();

    // Disable bet amount selector and difficulty buttons
    this.betAmountSelector.setEnabled(false);
    this.disableAllDifficultyButtons();

    // Disable other UI buttons (except stop autoplay and speed buttons)
    this.setButtonEnabled(this.recentPopUpButton, false);
    this.setButtonEnabled(this.infoPopUpButton, false);
    this.setButtonEnabled(this.cashOutButton, false);

    // Hide jump button during autoplay
    this.hideJumpButton();

    // Show stop button
    this.updateStopButtonVisibility();

    // Update status label
    this.updateAutoplayStatusLabel(1, payload.totalRounds);
  }

  /**
   * Handle autoplay stopped event
   */
  private onAutoplayStopped(payload: any): void {
    console.log("[UIManager] Autoplay stopped", payload);
    this.isAutoplayActive = false;

    // Hide stop button and animation
    this.updateStopButtonVisibility();
    this.hideAutoplayAnimation();

    // Show autoplay button again
    this.autoplayPopUpButton.node.active = true;

    // Re-enable UI buttons that were disabled during autoplay
    this.setButtonEnabled(this.recentPopUpButton, true);
    this.setButtonEnabled(this.infoPopUpButton, true);

    // Clear status label
    if (this.autoplayStatusLabel) {
      this.autoplayStatusLabel.string = "";
    }

    // Check if a round is still in progress
    if (payload.isRoundInProgress && GameState.isRoundActive()) {
      // Round is in progress - show cash out button for manual control
      console.log(
        "[UIManager] Autoplay stopped mid-round, enabling manual control",
      );
      this.isRoundActive = true;

      // Show jump button for manual control
      this.showJumpButton();

      // Hide bet button, show cash out button
      this.placeBetButton.node.active = false;
      this.showCashOutButton();

      // Enable cash out if player has made at least one jump
      const canCashOut = GameState.currentTileIndex >= 0;
      this.setButtonEnabled(this.cashOutButton, canCashOut);
      this.setCashOutLabelEnabled(canCashOut);

      // Keep bet controls disabled
      this.betAmountSelector.setEnabled(false);
      this.disableAllDifficultyButtons();

      // Enable autoplay button state update
      this.updateAutoplayButtonState();
    } else {
      // No round in progress - reset to normal idle state
      this.resetToIdleState();
    }
  }

  /**
   * Handle autoplay round complete event
   */
  private onAutoplayRoundComplete(payload: any): void {
    console.log("[UIManager] Autoplay round complete", payload);

    // Update status label with next round info
    const nextRound = payload.roundNumber + 1;
    if (nextRound <= payload.totalRounds) {
      this.updateAutoplayStatusLabel(nextRound, payload.totalRounds);
    }
  }

  /**
   * Update stop button visibility
   */
  private updateStopButtonVisibility(): void {
    if (!this.stopAutoplayButton) {
      return;
    }

    this.stopAutoplayButton.node.active = this.isAutoplayActive;
    this.setButtonEnabled(this.stopAutoplayButton, this.isAutoplayActive);
  }

  /**
   * Update autoplay status label
   */
  private updateAutoplayStatusLabel(
    currentRound: number,
    totalRounds: number,
  ): void {
    if (this.autoplayStatusLabel) {
      this.autoplayStatusLabel.string = `Round ${currentRound}/${totalRounds}`;
    }
  }

  /**
   * Disable all difficulty buttons
   */
  private disableAllDifficultyButtons(): void {
    const buttons = [
      this.easyButton,
      this.mediumButton,
      this.hardButton,
      this.insaneButton,
    ];
    buttons.forEach((btn) => {
      if (btn) {
        btn.interactable = false;
      }
    });
  }

  /**
   * Update autoplay button state
   */
  private updateAutoplayButtonState(): void {
    if (this.autoplayPopUpButton) {
      this.setButtonEnabled(
        this.autoplayPopUpButton,
        !this.isAutoplayActive && !this.isRoundActive,
      );
    }
  }

  /**
   * Show and play the autoplay animation
   */
  private showAutoplayAnimation(): void {
    if (!this.autoplayAnimation) {
      return;
    }

    this.autoplayAnimation.node.active = true;
    // Play the animation - "Auto_active" is the animation name from the DragonBones JSON
    this.autoplayAnimation.playAnimation("Auto_active", 0); // 0 = loop forever
  }

  /**
   * Hide and stop the autoplay animation
   */
  private hideAutoplayAnimation(): void {
    if (!this.autoplayAnimation) {
      return;
    }

    this.autoplayAnimation.node.active = false;
  }

  /**
   * Handle jump button click
   */
  private onJumpButtonClicked(): void {
    if (this.isAutoplayActive) return;
    if (!GameState.isRoundActive()) return;
    if (GameState.isAwaitingServer) return;

    const nextTileIndex = GameState.currentTileIndex + 1;
    if (nextTileIndex >= GameState.tileCount) return;

    // Emit button click for audio
    EventBus.emit(GameEvent.UI_BUTTON_CLICKED);

    // Disable button immediately to prevent double-clicks
    this.disableJumpButton();

    // Emit same event as tile click — TileManager handles the rest
    EventBus.emit(GameEvent.UI_TILE_CLICKED, { tileIndex: nextTileIndex });
  }

  /**
   * Handle landing complete - enable jump button if more tiles remain
   */
  private onLandingComplete(): void {
    if (this.isAutoplayActive) return;
    if (!GameState.isRoundActive()) return;

    // Check if there are more tiles to jump to
    const nextTileIndex = GameState.currentTileIndex + 1;
    if (nextTileIndex < GameState.tileCount) {
      this.enableJumpButton();
    } else {
      this.hideJumpButton();
    }
  }

  /**
   * Show the jump button and enable it (used when round starts)
   */
  private showJumpButton(): void {
    if (!this.jumpButton) return;
    this.jumpButton.node.active = true;
    this.setButtonEnabled(this.jumpButton, true);
  }

  /**
   * Enable the jump button (keep visible, make clickable)
   */
  private enableJumpButton(): void {
    if (!this.jumpButton) return;
    this.jumpButton.node.active = true;
    this.setButtonEnabled(this.jumpButton, true);
  }

  /**
   * Disable the jump button (keep visible, make non-clickable)
   */
  private disableJumpButton(): void {
    if (!this.jumpButton) return;
    this.jumpButton.node.active = true;
    this.setButtonEnabled(this.jumpButton, false);
  }

  /**
   * Hide the jump button completely (used when round ends)
   */
  private hideJumpButton(): void {
    if (!this.jumpButton) return;
    this.jumpButton.node.active = false;
    this.setButtonEnabled(this.jumpButton, false);
  }

  /**
   * Update jump button visibility based on current state
   */
  private updateJumpButtonVisibility(): void {
    if (!this.jumpButton) return;

    if (
      !this.isRoundActive ||
      this.isAutoplayActive ||
      !GameState.isRoundActive()
    ) {
      this.hideJumpButton();
      return;
    }

    // Round is active — keep button visible
    if (
      !GameState.isAwaitingServer &&
      GameState.currentTileIndex + 1 < GameState.tileCount
    ) {
      this.enableJumpButton();
    } else {
      this.disableJumpButton();
    }
  }

  /**
   * Handle round error event
   */
  private onRoundError(payload: any): void {
    EventBus.emit(GameEvent.SHOW_ERROR_NOTIFICATION, {
      message: payload?.message || "An error occurred during the round.",
    });
  }

  /**
   * Handle network error event
   */
  private onNetworkError(payload: any): void {
    EventBus.emit(GameEvent.SHOW_ERROR_NOTIFICATION, {
      message:
        payload?.message || "Network error. Please check your connection.",
    });
  }

  /**
   * Handle login failed event
   */
  private onLoginFailed(payload: any): void {
    EventBus.emit(GameEvent.SHOW_ERROR_NOTIFICATION, {
      message: payload?.message || "Login failed. Please try again.",
    });
  }

  // ─── Cash-Out Button Slide Animation Helpers ─────────────────────────

  /**
   * Float the cash-out button in from the right side of the screen.
   * If already visible, this is a no-op.
   */
  private showCashOutButton(): void {
    if (this.cashOutVisible) return;
    this.cashOutVisible = true;

    const node = this.cashOutButton.node;

    // Stop any running tween on this node
    Tween.stopAllByTarget(node);

    // Start off-screen to the right
    node.setPosition(
      this.cashOutOriginalPos.x + GameConfig.CASHOUT_SLIDE_OFFSET,
      this.cashOutOriginalPos.y,
      this.cashOutOriginalPos.z,
    );
    node.active = true;

    // Tween to original position with easeOut
    tween(node)
      .to(
        GameConfig.CASHOUT_SLIDE_DURATION,
        { position: new Vec3(this.cashOutOriginalPos) },
        { easing: "cubicOut" },
      )
      .start();
  }

  /**
   * Float the cash-out button out to the right side of the screen.
   * @param instant  If true, hide immediately without animation (e.g. on init).
   */
  private hideCashOutButton(instant: boolean = false): void {
    if (!this.cashOutVisible && !this.cashOutButton.node.active) return;
    this.cashOutVisible = false;

    const node = this.cashOutButton.node;
    Tween.stopAllByTarget(node);

    if (instant) {
      node.active = false;
      node.setPosition(this.cashOutOriginalPos);
      return;
    }

    const offScreenPos = new Vec3(
      this.cashOutOriginalPos.x + GameConfig.CASHOUT_SLIDE_OFFSET,
      this.cashOutOriginalPos.y,
      this.cashOutOriginalPos.z,
    );

    tween(node)
      .to(
        GameConfig.CASHOUT_SLIDE_DURATION,
        { position: offScreenPos },
        { easing: "cubicIn" },
      )
      .call(() => {
        node.active = false;
        // Reset position back to original so next show starts correctly
        node.setPosition(this.cashOutOriginalPos);
      })
      .start();
  }

  onDestroy() {
    // Event listeners are automatically cleaned up by EventBus
  }
}
