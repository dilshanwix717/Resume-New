import {
  _decorator,
  Component,
  Node,
  EventTouch,
  Label,
  dragonBones,
} from "cc";
import { EventBus } from "../core/EventBus";
import { GameEvent } from "../core/GameEvents";
import { TileState } from "../types/GameTypes";
import { GameState } from "../core/GameState";
import { getAutoplayManager } from "../managers/AutoplayManager";

const { ccclass, property } = _decorator;

/** Collectable animation state names */
enum CollectableAnimation {
  IDLE_1 = "Idle",
  IDLE_2 = "Idle",
  IDLE_PROMPT = "Idle_prompt",
  COLLECT = "Collect",
  CRASH = "Crash",
  FLAG_1 = "Flag1",
  FLAG_2 = "Flag2",
  DEATH = "CrashPoint",
  DARK = "Dark",
  EMPTY_1 = "Empty",
  EMPTY_2 = "Empty",
  NONE = "Nothing",
}

/** Configuration constants */
const CONFIG = {
  IDLE_PROMPT_INTERVAL: 5.0,
  DEFAULT_TILE_INDEX: -1,
  DEFAULT_MULTIPLIER: 1.0,
} as const;

@ccclass("Tile")
export class Tile extends Component {
  @property(Label)
  private multiplierLabel: Label = null!;

  @property(Node)
  private activeMultiplierPopup: Node = null!;

  @property(Label)
  private activeMultiplierLabel: Label = null!;

  @property(Node)
  private collectableNode: Node = null!;

  @property(dragonBones.ArmatureDisplay)
  private collectableArmature: dragonBones.ArmatureDisplay = null!;

  public tileIndex: number = CONFIG.DEFAULT_TILE_INDEX;
  public isRevealed: boolean = false;
  public state: TileState = TileState.UNREVEALED;
  public multiplierValue: number = CONFIG.DEFAULT_MULTIPLIER;

  private isCollected: boolean = false;
  private idlePromptTimer: number = 0;
  private isPlayingIdlePrompt: boolean = false;
  private isListenersRegistered: boolean = false;
  private currentAnimCallback: (() => void) | null = null;

  onLoad(): void {
    this.initializeCollectable();
  }

  onEnable(): void {
    this.registerInputListeners();
  }

  onDisable(): void {
    this.unregisterInputListeners();
    this.reset();
  }

  onDestroy(): void {
    this.unregisterInputListeners();
  }

  update(dt: number): void {
    this.updateIdlePromptTimer(dt);
  }

  /**
   * Sets the multiplier value and updates the display label
   */
  public setMultiplier(value: number): void {
    this.multiplierValue = value;
    this.updateMultiplierDisplay();
  }

  /**
   * Sets the tile state
   */
  public setState(newState: TileState): void {
    this.state = newState;
  }

  /**
   * Triggers the collect animation sequence
   */
  public collectItem(): void {
    if (this.isCollected) return;

    this.isCollected = true;
    this.playAnimation(CollectableAnimation.COLLECT, 1);
    this.registerAnimationCallback(this.handleCollectAnimationComplete);
  }

  /**
   * Triggers the crash animation when player lands on a trap
   */
  public crashItem(): void {
    if (this.isCollected) return;

    this.isCollected = true;
    // Hide multiplier popup and label immediately on crash
    this.showActiveMultiplierPopup(false);
    this.showDefaultMultiplierLabel(true);
    this.updateDefaultMultiplierLabel();

    this.playAnimation(CollectableAnimation.CRASH, 1);
    this.registerAnimationCallback(this.handleCrashAnimationComplete);
  }

  /**
   * Plays the Death animation to reveal the crash point after cashout.
   */
  public showDeath(): void {
    this.isCollected = true;
    this.showActiveMultiplierPopup(false);
    this.showDefaultMultiplierLabel(true);
    this.updateDefaultMultiplierLabel();

    this.setCollectableVisible(true);
    // Clear any stale animation callbacks so they don't fire after Death completes
    this.clearAnimationCallbacks();
    this.playAnimation(CollectableAnimation.DEATH, 1);
    // Don't register handleCollectComplete — we want the Death animation
    // to stay on its last frame so the crash point remains visible.
  }

  /**
   * Plays the Empty_1 animation once, then loops Empty_2 for passed tiles.
   */
  public showEmpty(): void {
    // Play Empty_1 once, then Empty_2 looping
    this.playAnimation(CollectableAnimation.EMPTY_1, 1);
    this.registerAnimationCallback(() => {
      this.playAnimation(CollectableAnimation.EMPTY_2, 0);
    });
  }

  /**
   * Updates collectable appearance based on game state and tile position
   */
  public updateCollectableAppearance(): void {
    // Always update multiplier display, even if collected
    this.updateMultiplierDisplay();

    if (this.isCollected) return;

    // If this is the next tile, play Idle_1 once, then Idle_2 looping
    if (this.isNextTile()) {
      this.playAnimation(CollectableAnimation.IDLE_1, 1);
      this.registerAnimationCallback(() => {
        this.playAnimation(CollectableAnimation.IDLE_2, 0);
      });
      return;
    }

    // If this is a trap tile and revealed, show DARK and hide multiplier popup
    if (this.state === TileState.TRAP) {
      this.playAnimation(CollectableAnimation.DARK, 0);
      this.showActiveMultiplierPopup(false);
      this.showDefaultMultiplierLabel(true);
      return;
    }

    const animation = this.determineCollectableAnimation();
    this.playAnimation(animation, 0);
  }

  /**
   * Returns whether this tile can be clicked
   */
  public isClickable(): boolean {
    return (
      GameState.isRoundActive() &&
      !this.isRevealed &&
      !GameState.isAwaitingServer &&
      this.isNextTile()
    );
  }

  private initializeCollectable(): void {
    this.resetIdlePromptState();
    this.updateCollectableAppearance();
  }

  private reset(): void {
    this.tileIndex = CONFIG.DEFAULT_TILE_INDEX;
    this.isRevealed = false;
    this.state = TileState.UNREVEALED;
    this.multiplierValue = CONFIG.DEFAULT_MULTIPLIER;
    this.isCollected = false;
    this.resetIdlePromptState();
    this.clearMultiplierDisplay();
    this.setCollectableVisible(true);
    // Clear any stale animation callbacks to prevent them from
    // surviving NodePool recycling and firing on the next round
    this.clearAnimationCallbacks();
    this.initializeCollectable();
  }

  private registerInputListeners(): void {
    if (this.isListenersRegistered) return;

    this.node.on(Node.EventType.TOUCH_END, this.handleTileClick, this);
    this.isListenersRegistered = true;
  }

  private unregisterInputListeners(): void {
    if (!this.isListenersRegistered) return;

    this.node.off(Node.EventType.TOUCH_END, this.handleTileClick, this);
    this.isListenersRegistered = false;
  }

  private handleTileClick(event: EventTouch): void {
    if (!this.canProcessClick()) return;

    EventBus.emit(GameEvent.UI_TILE_CLICKED, { tileIndex: this.tileIndex });
  }

  private canProcessClick(): boolean {
    const autoplayManager = getAutoplayManager();
    if (autoplayManager?.isAutoplayActive()) return false;
    if (!GameState.isRoundActive()) return false;
    if (this.isRevealed) return false;
    if (!this.isNextTile()) return false;
    if (GameState.isAwaitingServer) return false;

    return true;
  }

  private playAnimation(name: CollectableAnimation, playTimes: number): void {
    this.collectableArmature?.playAnimation(name, playTimes);
  }

  private registerAnimationCallback(callback: () => void): void {
    // Clear any existing callback first to prevent stale listeners
    this.clearAnimationCallbacks();
    this.currentAnimCallback = callback;
    this.collectableArmature?.once(
      dragonBones.EventObject.COMPLETE,
      callback,
      this,
    );
  }

  /**
   * Clear all pending COMPLETE event listeners on the armature.
   * Prevents stale callbacks from previous animations or pool cycles
   * from firing unexpectedly.
   */
  private clearAnimationCallbacks(): void {
    if (this.currentAnimCallback) {
      this.collectableArmature?.off(
        dragonBones.EventObject.COMPLETE,
        this.currentAnimCallback,
        this,
      );
      this.currentAnimCallback = null;
    }
  }

  private handleCollectComplete(): void {
    // After collect or crash, show NONE animation (player is now on this tile)
    this.playAnimation(CollectableAnimation.NONE, 0);
    // Ensure multiplier popup is updated after animation
    this.updateCollectableAppearance();
  }

  /**
   * After Crash animation finishes, play Flag1 once, then loop Flag2.
   */
  private handleCrashAnimationComplete(): void {
    this.playAnimation(CollectableAnimation.FLAG_1, 1);
    this.registerAnimationCallback(() => {
      this.playAnimation(CollectableAnimation.FLAG_2, 0);
    });
  }

  /**
   * After the Collect animation finishes, transition to the Empty sequence
   */
  private handleCollectAnimationComplete(): void {
    this.updateCollectableAppearance();
    this.showEmpty();
  }

  private determineCollectableAnimation(): CollectableAnimation {
    if (!GameState.isRoundActive()) {
      return CollectableAnimation.DARK;
    }

    if (this.isPlayerOnTile()) {
      // Player is currently on this tile
      return CollectableAnimation.NONE;
    }

    // Next tile handled in updateCollectableAppearance

    return CollectableAnimation.DARK;
  }

  private updateIdlePromptTimer(dt: number): void {
    if (!this.shouldUpdateIdlePrompt()) return;

    this.idlePromptTimer += dt;

    if (this.idlePromptTimer >= CONFIG.IDLE_PROMPT_INTERVAL) {
      this.triggerIdlePrompt();
    }
  }

  private shouldUpdateIdlePrompt(): boolean {
    return (
      !this.isCollected &&
      !this.isPlayingIdlePrompt &&
      this.isNextTile() &&
      GameState.isRoundActive()
    );
  }

  private triggerIdlePrompt(): void {
    if (this.isCollected) return;

    this.isPlayingIdlePrompt = true;
    this.idlePromptTimer = 0;

    this.playAnimation(CollectableAnimation.IDLE_PROMPT, 1);
    this.registerAnimationCallback(this.handleIdlePromptComplete);
  }

  private handleIdlePromptComplete(): void {
    if (this.isCollected) return;

    this.resetIdlePromptState();
    this.updateCollectableAppearance();
  }

  private resetIdlePromptState(): void {
    this.idlePromptTimer = 0;
    this.isPlayingIdlePrompt = false;
  }

  /**
   * Updates multiplier display based on whether player is on this tile
   * CRITICAL: Check for trap tiles FIRST to ensure they never show active popup
   */
  private updateMultiplierDisplay(): void {
    // CRITICAL: Check for trap tiles FIRST, before checking player position
    // This ensures trap tiles never show the active multiplier popup
    if (this.state === TileState.TRAP) {
      // Hide both popup and label when player is on a trap tile
      this.showActiveMultiplierPopup(false);
      this.showDefaultMultiplierLabel(false);
      return;
    }

    const isCurrentTile = this.isPlayerOnTile();

    // Only show popup if tile is SAFE and player is on it
    if (isCurrentTile && this.state === TileState.SAFE) {
      // Player is on this tile - show popup with active label
      this.showActiveMultiplierPopup(true);
      //this.showDefaultMultiplierLabel(false);
      this.updateActiveMultiplierLabel();
    } else {
      // Player is not on this tile or it's not safe - show default label, hide popup
      this.showActiveMultiplierPopup(false);
      //this.showDefaultMultiplierLabel(true);
      this.updateDefaultMultiplierLabel();
    }
  }

  private updateDefaultMultiplierLabel(): void {
    if (!this.multiplierLabel) return;
    this.multiplierLabel.string = `${this.multiplierValue.toFixed(2)}x`;
  }

  private updateActiveMultiplierLabel(): void {
    if (!this.activeMultiplierLabel) return;
    this.activeMultiplierLabel.string = `${this.multiplierValue.toFixed(2)}x`;
  }

  private showActiveMultiplierPopup(visible: boolean): void {
    if (!this.activeMultiplierPopup) return;
    this.activeMultiplierPopup.active = visible;
  }

  private showDefaultMultiplierLabel(visible: boolean): void {
    if (!this.multiplierLabel) return;
    this.multiplierLabel.node.active = visible;
  }

  private clearMultiplierDisplay(): void {
    if (this.multiplierLabel) {
      this.multiplierLabel.string = "";
      this.multiplierLabel.node.active = true;
    }
    if (this.activeMultiplierLabel) {
      this.activeMultiplierLabel.string = "";
    }
    if (this.activeMultiplierPopup) {
      this.activeMultiplierPopup.active = false;
    }
  }

  private setCollectableVisible(visible: boolean): void {
    if (!this.collectableNode) return;
    this.collectableNode.active = visible;
  }

  private isNextTile(): boolean {
    return this.tileIndex === GameState.currentTileIndex + 1;
  }

  /**
   * Returns whether the player is currently standing on this tile
   */
  private isPlayerOnTile(): boolean {
    return this.tileIndex === GameState.currentTileIndex;
  }
}
