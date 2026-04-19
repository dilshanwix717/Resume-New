// assets/scripts/components/BetAmountSelector.ts

import {
  _decorator,
  Component,
  Node,
  Button,
  Label,
  Sprite,
  SpriteFrame,
} from "cc";
import { BetAmountConfig } from "../Config/GameConfig";
import { EventBus } from "../core/EventBus";
import { GameEvent } from "../core/GameEvents";
import { GameState } from "../core/GameState";

const { ccclass, property } = _decorator;

/**
 * BetAmountSelector - Manages bet amount selection via buttons
 *
 * Usage:
 * 1. Create buttons in your scene for each bet amount
 * 2. Assign the buttons to the corresponding properties
 * 3. The component will handle selection, styling, and events
 */
@ccclass("BetAmountSelector")
export class BetAmountSelector extends Component {
  // Row 1: $0.01, $0.05, $0.10
  @property(Button)
  btn001: Button = null!;

  @property(Button)
  btn005: Button = null!;

  @property(Button)
  btn010: Button = null!;

  // Row 2: $0.50, $1, $2
  @property(Button)
  btn050: Button = null!;

  @property(Button)
  btn1: Button = null!;

  @property(Button)
  btn2: Button = null!;

  // Row 3: $5, $10, $20
  @property(Button)
  btn5: Button = null!;

  @property(Button)
  btn10: Button = null!;

  @property(Button)
  btn20: Button = null!;

  // Row 4: $50, $100, $200
  @property(Button)
  btn50: Button = null!;

  @property(Button)
  btn100: Button = null!;

  @property(Button)
  btn200: Button = null!;

  // Row 5: $500, $1000, $2000
  @property(Button)
  btn500: Button = null!;

  @property(Button)
  btn1000: Button = null!;

  @property(Button)
  btn2000: Button = null!;

  // Selected amount display label (optional)
  @property(Label)
  selectedAmountLabel: Label = null!;

  // Sprites for button states (set in editor)
  @property({
    type: SpriteFrame,
    tooltip: "Sprite for normal/unselected buttons",
  })
  normalSprite: SpriteFrame = null!;

  @property({ type: SpriteFrame, tooltip: "Sprite for selected button" })
  selectedSprite: SpriteFrame = null!;

  private selectedAmount: number = BetAmountConfig.DEFAULT;
  private buttonMap: Map<number, Button> = new Map();
  private isEnabled: boolean = true;

  onLoad() {
    this.initializeButtonMap();
    this.setupButtonListeners();
    this.selectAmount(this.selectedAmount);
  }

  /**
   * Initialize the mapping between amounts and buttons
   */
  private initializeButtonMap(): void {
    const amounts = BetAmountConfig.AMOUNTS;
    const buttons = [
      this.btn001,
      this.btn005,
      this.btn010,
      this.btn050,
      this.btn1,
      this.btn2,
      this.btn5,
      this.btn10,
      this.btn20,
      this.btn50,
      this.btn100,
      this.btn200,
      this.btn500,
      this.btn1000,
      this.btn2000,
    ];

    amounts.forEach((amount, index) => {
      const button = buttons[index];
      if (button) {
        this.buttonMap.set(amount, button);

        // Disable button's built-in transition so we can control sprites manually
        button.transition = Button.Transition.NONE;

        // Set button label if it has a Label component in children
        const label = button.node.getComponentInChildren(Label);
        if (label) {
          label.string = this.formatAmount(amount);
        }
      }
    });
  }

  /**
   * Setup click listeners for all buttons
   */
  private setupButtonListeners(): void {
    this.buttonMap.forEach((button, amount) => {
      button.node.on(
        Button.EventType.CLICK,
        () => {
          this.onAmountButtonClicked(amount);
        },
        this,
      );
    });
  }

  /**
   * Handle amount button click
   */
  private onAmountButtonClicked(amount: number): void {
    console.log(
      `[BetAmountSelector] Button clicked: ${amount}, enabled: ${this.isEnabled}, balance: ${GameState.balance}`,
    );

    // Emit button click for audio
    EventBus.emit(GameEvent.UI_BUTTON_CLICKED);

    if (!this.isEnabled) {
      console.log(`[BetAmountSelector] Selector is disabled, ignoring click`);
      return;
    }

    // Check if player can afford this bet
    if (amount > GameState.balance) {
      console.log(
        `[BetAmountSelector] Cannot select $${amount} - insufficient balance. Current balance: $${GameState.balance}`,
      );
      return;
    }

    this.selectAmount(amount);

    // Emit event for other components to listen to
    EventBus.emit(GameEvent.UI_BET_AMOUNT_CHANGED, {
      amount: this.selectedAmount,
      formattedAmount: this.formatAmount(this.selectedAmount),
    });
  }

  /**
   * Select a specific amount
   */
  public selectAmount(amount: number): void {
    // Validate amount - must be an exact match from config
    if (
      !BetAmountConfig.AMOUNTS.includes(
        amount as (typeof BetAmountConfig.AMOUNTS)[number],
      )
    ) {
      console.warn(
        `[BetAmountSelector] Invalid amount: ${amount}, using default`,
      );
      amount = BetAmountConfig.DEFAULT;
    }

    const previousAmount = this.selectedAmount;
    this.selectedAmount = amount;

    // Update visual styling
    this.updateButtonStyles();

    // Update display label
    this.updateSelectedAmountLabel();

    if (previousAmount !== amount) {
      console.log(
        `[BetAmountSelector] Amount changed: ${this.formatAmount(amount)}`,
      );
    }
  }

  /**
   * Update button styles based on selection state
   */
  private updateButtonStyles(): void {
    this.buttonMap.forEach((button, amount) => {
      const isSelected = amount === this.selectedAmount;
      const canAfford = amount <= GameState.balance;

      // Get sprite from button's target node, or the button node itself, or children
      const targetNode = button.target || button.node;
      let sprite = targetNode.getComponent(Sprite);
      if (!sprite) {
        sprite = button.node.getComponentInChildren(Sprite);
      }

      // Swap sprite based on selection state
      if (sprite) {
        if (isSelected && this.selectedSprite) {
          sprite.spriteFrame = this.selectedSprite;
        } else if (!isSelected && this.normalSprite) {
          sprite.spriteFrame = this.normalSprite;
        }
      }

      // Disable buttons player can't afford or when selector is disabled
      button.interactable = this.isEnabled && canAfford;
    });
  }

  /**
   * Update the selected amount label
   */
  private updateSelectedAmountLabel(): void {
    if (this.selectedAmountLabel) {
      this.selectedAmountLabel.string = this.formatAmount(this.selectedAmount);
    }
  }

  /**
   * Format amount for display
   */
  private formatAmount(amount: number): string {
    if (amount >= 1) {
      return `${amount}`;
    }
    return `${amount.toFixed(2)}`;
  }

  /**
   * Get currently selected amount
   */
  public getSelectedAmount(): number {
    return this.selectedAmount;
  }

  /**
   * Enable or disable the selector
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.updateButtonStyles();
  }

  /**
   * Refresh button states (call when balance changes)
   */
  public refresh(): void {
    this.updateButtonStyles();
  }

  /**
   * Check if a specific amount is affordable
   */
  public isAmountAffordable(amount: number): boolean {
    return amount <= GameState.balance;
  }

  onDestroy() {
    // Clean up button listeners
    this.buttonMap.forEach((button) => {
      button.node.off(Button.EventType.CLICK);
    });
  }
}
