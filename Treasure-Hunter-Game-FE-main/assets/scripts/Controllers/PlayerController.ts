// assets/scripts/Controllers/PlayerController.ts
import { _decorator, Component, Node, Vec3, tween, Tween } from "cc";
import { dragonBones } from "cc";
import { EventBus } from "../core/EventBus";
import { GameEvent } from "../core/GameEvents";
import { GameConfig } from "../Config/GameConfig";
import { gameSpeedManager } from "../managers/GameSpeedManager";

const { ccclass, property } = _decorator;

// Animation names
const ANIM_IDLE_1 = "Idle_1";
const ANIM_IDLE_2 = "Idle_2";
const ANIM_JUMP = "Jump_1";
const ANIM_DEATH = "Death_1";
const ANIM_WIN = "Win_1";

// Idle animation config
const IDLE_2_PLAY_AFTER = 5; // Play Idle_2 after this many Idle_1 loops

@ccclass("PlayerController")
export class PlayerController extends Component {
  @property(Node)
  playerSprite: Node = null!;

  @property(dragonBones.ArmatureDisplay)
  armatureDisplay: dragonBones.ArmatureDisplay = null!;

  private currentTween: Tween<Node> | null = null;
  private isAnimating: boolean = false;
  private pendingTrap: boolean = false;
  private pendingTargetPosition: Vec3 | null = null;

  // Idle animation cycle tracking
  private idleLoopCount: number = 0;
  private isPlayingIdle: boolean = false;

  onLoad() {
    // Setup event listeners
    this.setupEventListeners();

    // Setup DragonBones animation listener
    this.setupAnimationListener();

    // Set initial position
    this.resetPosition();

    // Play idle animation on load
    this.playIdleAnimation();
  }

  /**
   * Setup DragonBones animation event listener
   */
  private setupAnimationListener(): void {
    if (!this.armatureDisplay) {
      return;
    }

    // Listen for animation complete events
    this.armatureDisplay.on(
      dragonBones.EventObject.LOOP_COMPLETE,
      this.onAnimationLoopComplete,
      this,
    );
    this.armatureDisplay.on(
      dragonBones.EventObject.COMPLETE,
      this.onAnimationFinished,
      this,
    );
  }

  /**
   * Handle animation loop complete (for looping animations)
   */
  private onAnimationLoopComplete(event: dragonBones.EventObject): void {
    const animName = event.animationState?.name;

    if (animName === ANIM_IDLE_1 && this.isPlayingIdle) {
      this.idleLoopCount++;

      // Check if it's time to play Idle_2
      if (this.idleLoopCount >= IDLE_2_PLAY_AFTER) {
        this.idleLoopCount = 0;
        this.playDragonBonesAnimation(ANIM_IDLE_2, 1); // Play Idle_2 once
      }
    }
  }

  /**
   * Handle animation finished (for non-looping animations)
   */
  private onAnimationFinished(event: dragonBones.EventObject): void {
    const animName = event.animationState?.name;

    // After Idle_2 finishes, go back to Idle_1
    if (animName === ANIM_IDLE_2 && this.isPlayingIdle) {
      this.playDragonBonesAnimation(ANIM_IDLE_1, 0); // Resume Idle_1 loop
    }

    // After Death_1 finishes, emit landing complete
    if (animName === ANIM_DEATH) {
      EventBus.emit(GameEvent.LANDING_COMPLETE);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    EventBus.on(GameEvent.JUMP_RESULT_SAFE, this.onJumpToTile.bind(this));
    EventBus.on(GameEvent.JUMP_RESULT_TRAP, this.onJumpToTrap.bind(this));
    EventBus.on(GameEvent.SCENE_CLEARED, this.onSceneCleared.bind(this));
    EventBus.on(GameEvent.SCENE_GENERATED, this.onSceneGenerated.bind(this));
    EventBus.on(GameEvent.CASHOUT_COMPLETE, this.onCashoutComplete.bind(this));
  }

  /**
   * Handle successful cashout - play win animation
   */
  private onCashoutComplete(): void {
    console.log("[PlayerController] Cashout complete - playing win animation");
    this.playWinAnimation();
  }

  /**
   * Handle scene generated
   */
  private onSceneGenerated(): void {
    this.resetPosition();
  }

  /**
   * Handle safe jump
   */
  private onJumpToTile(payload: any): void {
    const { tileIndex } = payload;

    // Get target position from TileManager
    const targetPosition = this.calculateTilePosition(tileIndex);

    this.playJumpAnimation(targetPosition, false);
  }

  /**
   * Handle trap jump
   */
  private onJumpToTrap(payload: any): void {
    const { tileIndex } = payload;

    // Get target position from TileManager
    const targetPosition = this.calculateTilePosition(tileIndex);

    this.playJumpAnimation(targetPosition, true);
  }

  /**
   * Calculate tile position
   */
  private calculateTilePosition(tileIndex: number): Vec3 {
    const startX = GameConfig.WORLD_START_X;
    const tileWidth = GameConfig.TILE_WIDTH;
    const gap = GameConfig.TILE_GAP;

    const x =
      startX + tileIndex * (tileWidth + gap) + GameConfig.PLAYER_OFFSET_X;
    const y = GameConfig.PLAYER_OFFSET_Y;

    return new Vec3(x, y, 0);
  }

  /**
   * Play jump animation (tween moves position, DragonBones animates character)
   */
  private playJumpAnimation(targetPosition: Vec3, isTrap: boolean): void {
    // If already animating, stop the current tween and snap to its target
    if (this.isAnimating && this.currentTween) {
      this.currentTween.stop();
      this.currentTween = null;
      if (this.pendingTargetPosition) {
        this.node.setPosition(this.pendingTargetPosition);
      }
    }

    this.pendingTargetPosition = targetPosition.clone();
    this.isAnimating = true;
    this.pendingTrap = isTrap;

    // Stop idle animation cycle
    this.stopIdleAnimation();

    // Stop any existing tween (safety)
    if (this.currentTween) {
      this.currentTween.stop();
    }

    // Play DragonBones jump animation, synced to game speed so it matches the tween duration
    this.playDragonBonesAnimation(ANIM_JUMP, 1, true);

    const startPos = this.node.position.clone();
    const midPoint = new Vec3(
      (startPos.x + targetPosition.x) / 2,
      GameConfig.JUMP_HEIGHT + GameConfig.PLAYER_OFFSET_Y,
      0,
    );

    // Apply game speed to animation duration
    const adjustedDuration = gameSpeedManager.adjustDuration(
      GameConfig.JUMP_DURATION,
    );

    // Tween moves the node position in an arc
    this.currentTween = tween(this.node)
      .to(adjustedDuration / 2, { position: midPoint })
      .to(adjustedDuration / 2, { position: targetPosition })
      .call(() => {
        this.isAnimating = false;
        this.currentTween = null;
        this.onJumpAnimationComplete(isTrap);
      })
      .start();
  }

  /**
   * Jump animation complete callback (triggered by DragonBones COMPLETE event)
   */
  private onJumpAnimationComplete(isTrap: boolean): void {
    this.isAnimating = false;

    console.log(`[PlayerController] Jump animation complete (trap: ${isTrap})`);

    if (isTrap) {
      // Play lose animation
      this.playLoseAnimation();
    } else {
      // Return to idle animation
      this.playIdleAnimation();
      // Emit landing complete event
      EventBus.emit(GameEvent.LANDING_COMPLETE);
    }
  }

  /**
   * Play lose animation (death on trap)
   * LANDING_COMPLETE is emitted when Death_1 finishes via onAnimationFinished
   */
  private playLoseAnimation(): void {
    console.log("[PlayerController] Playing lose animation");

    // Play Death_1 DragonBones animation (play once and hold last frame)
    // LANDING_COMPLETE will be emitted when animation finishes via onAnimationFinished
    this.playDragonBonesAnimation(ANIM_DEATH, 1);

    // setTimeout(() => {
    //   EventBus.emit(GameEvent.SHOW_ERROR_NOTIFICATION, {
    //       message: "Oops! You found a bomb. Try again!",
    //     });
    //   }, 3000);
  }

  /**
   * Play win animation (reach treasure / successful cashout)
   * Animation loops until new round starts (SCENE_GENERATED event)
   */
  playWinAnimation(): void {
    console.log(
      "[PlayerController] Playing win animation (loops until new round)",
    );

    // Stop idle animation cycle
    this.stopIdleAnimation();

    // Play Win_1 DragonBones animation in loop (0 = infinite loop)
    // Will continue until resetPosition() is called on new round
    this.playDragonBonesAnimation(ANIM_WIN, 0);

    // Emit landing complete immediately
    EventBus.emit(GameEvent.LANDING_COMPLETE);
  }

  /**
   * Reset player to start position
   */
  private resetPosition(): void {
    if (this.currentTween) {
      this.currentTween.stop();
      this.currentTween = null;
    }

    this.node.setPosition(
      new Vec3(
        GameConfig.PLAYER_START_X + GameConfig.PLAYER_OFFSET_X,
        GameConfig.PLAYER_START_Y + GameConfig.PLAYER_OFFSET_Y,
        0,
      ),
    );

    this.isAnimating = false;
    this.idleLoopCount = 0; // Reset idle loop counter

    // Play idle animation when reset
    this.playIdleAnimation();
  }

  // Native DragonBones Jump_1 animation duration (seconds at 24fps)
  private static readonly NATIVE_JUMP_DURATION = 0.75;

  /**
   * Play DragonBones animation
   * @param animName Animation name
   * @param playTimes Number of times to play (-1 for loop, 0 for infinite, 1+ for specific count)
   * @param syncWithGameSpeed Whether to sync animation speed with game speed and jump duration
   */
  private playDragonBonesAnimation(
    animName: string,
    playTimes: number = -1,
    syncWithGameSpeed: boolean = false,
  ): void {
    if (!this.armatureDisplay) {
      console.warn("[PlayerController] ArmatureDisplay not set");
      return;
    }

    this.armatureDisplay.playAnimation(animName, playTimes);

    const armature = this.armatureDisplay.armature();
    if (!armature || !armature.animation) return;

    if (syncWithGameSpeed) {
      // Scale DragonBones anim so it finishes in the same time as the position tween.
      // Tween duration = JUMP_DURATION adjusted by game speed.
      const adjustedTweenDuration = gameSpeedManager.adjustDuration(
        GameConfig.JUMP_DURATION,
      );
      armature.animation.timeScale =
        PlayerController.NATIVE_JUMP_DURATION / adjustedTweenDuration;
    } else {
      armature.animation.timeScale = 1.0;
    }
  }

  /**
   * Play idle animation (looping with Idle_2 variant)
   */
  private playIdleAnimation(): void {
    this.isPlayingIdle = true;
    this.playDragonBonesAnimation(ANIM_IDLE_1, 0); // 0 = infinite loop
  }

  /**
   * Stop idle animation cycle
   */
  private stopIdleAnimation(): void {
    this.isPlayingIdle = false;
  }

  /**
   * Handle scene cleared
   */
  private onSceneCleared(): void {
    this.resetPosition();
  }

  onDestroy() {
    if (this.currentTween) {
      this.currentTween.stop();
    }

    // Clean up DragonBones animation listeners
    if (this.armatureDisplay) {
      this.armatureDisplay.off(
        dragonBones.EventObject.LOOP_COMPLETE,
        this.onAnimationLoopComplete,
        this,
      );
      this.armatureDisplay.off(
        dragonBones.EventObject.COMPLETE,
        this.onAnimationFinished,
        this,
      );
    }
  }
}
