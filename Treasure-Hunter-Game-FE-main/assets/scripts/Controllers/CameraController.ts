// assets/scripts/Controllers/CameraController.ts
import {
  _decorator,
  Component,
  Node,
  Vec3,
  Camera,
  input,
  Input,
  EventMouse,
  EventTouch,
} from "cc";
import { GameConfig } from "../Config/GameConfig";
import { EventBus } from "../core/EventBus";
import { GameEvent } from "../core/GameEvents";
import { GameState } from "../core/GameState";
import { gameSpeedManager } from "../managers/GameSpeedManager";

const { ccclass, property } = _decorator;

@ccclass("CameraController")
export class CameraController extends Component {
  @property(Node)
  target: Node = null!; // Player node

  @property(Camera)
  camera: Camera = null!;

  @property({ tooltip: "Enable manual camera control with mouse" })
  enableManualControl: boolean = true;

  @property({ tooltip: "Mouse drag sensitivity" })
  dragSensitivity: number = 1.0;

  @property({ tooltip: "Mouse wheel scroll sensitivity" })
  wheelSensitivity: number = 50.0;

  @property({ tooltip: "Smooth camera movement speed" })
  smoothSpeed: number = 0.15;

  private minX: number = 0;
  private maxX: number = 0;
  private worldWidth: number = 0;
  private isFollowing: boolean = false;

  // Mouse control properties
  private isDragging: boolean = false;
  private lastMouseX: number = 0;
  private targetCameraX: number = 0;
  private isManuallyControlled: boolean = false;

  // NEW: store tile layout info
  private tileCount: number = 0;
  private tileWidth: number = GameConfig.TILE_WIDTH;
  private tileGap: number = GameConfig.TILE_GAP;
  private worldStartX: number = GameConfig.WORLD_START_X;
  onLoad() {
    console.log("[CameraController] Initializing...");

    // Setup event listeners
    this.setupEventListeners();

    // Setup input listeners
    this.setupInputListeners();

    // Reset camera position
    this.resetCamera();

    console.log("[CameraController] Initialized");
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    EventBus.on(GameEvent.SCENE_GENERATED, this.onSceneGenerated.bind(this));
    EventBus.on(GameEvent.SCENE_CLEARED, this.onSceneCleared.bind(this));

    // Listen for player jumps to resume following
    EventBus.on(GameEvent.JUMP_REQUESTED, this.onPlayerAction.bind(this));
    EventBus.on(GameEvent.BET_PLACED, this.onPlayerAction.bind(this));
  }

  /**
   * Setup input listeners for mouse control
   */
  private setupInputListeners(): void {
    if (!this.enableManualControl) return;

    // Mouse down - start dragging
    input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);

    // Mouse move - handle drag
    input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);

    // Mouse up - stop dragging
    input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);

    // Mouse wheel - scroll camera
    input.on(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this);

    // Touch events for mobile support
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
  }

  /**
   * Mouse down handler
   */
  private onMouseDown(event: EventMouse): void {
    this.isDragging = true;
    this.isManuallyControlled = true;
    this.lastMouseX = event.getLocationX();
  }

  /**
   * Mouse move handler
   */
  private onMouseMove(event: EventMouse): void {
    if (!this.isDragging) return;

    const deltaX = event.getLocationX() - this.lastMouseX;
    this.lastMouseX = event.getLocationX();

    // Move camera in opposite direction of drag
    this.targetCameraX -= deltaX * this.dragSensitivity;
    this.targetCameraX = this.clampCameraX(this.targetCameraX);
  }

  /**
   * Mouse up handler
   */
  private onMouseUp(event: EventMouse): void {
    this.isDragging = false;
  }

  /**
   * Mouse wheel handler
   */
  private onMouseWheel(event: EventMouse): void {
    this.isManuallyControlled = true;

    const scrollY = event.getScrollY();

    // Scroll camera horizontally
    this.targetCameraX -= scrollY * this.wheelSensitivity;
    this.targetCameraX = this.clampCameraX(this.targetCameraX);
  }

  /**
   * Touch start handler (mobile)
   */
  private onTouchStart(event: EventTouch): void {
    this.isDragging = true;
    this.isManuallyControlled = true;
    this.lastMouseX = event.getLocationX();
  }

  /**
   * Touch move handler (mobile)
   */
  private onTouchMove(event: EventTouch): void {
    if (!this.isDragging) return;

    const deltaX = event.getLocationX() - this.lastMouseX;
    this.lastMouseX = event.getLocationX();

    this.targetCameraX -= deltaX * this.dragSensitivity;
    this.targetCameraX = this.clampCameraX(this.targetCameraX);
  }

  /**
   * Touch end handler (mobile)
   */
  private onTouchEnd(event: EventTouch): void {
    this.isDragging = false;
  }

  /**
   * Clamp camera X position to bounds
   */
  private clampCameraX(x: number): number {
    return Math.max(this.minX, Math.min(x, this.maxX));
  }

  /**
   * Resume automatic following when player acts
   */
  private onPlayerAction(): void {
    this.isManuallyControlled = false;
  }

  /**
   * Handle scene generation
   */
  private onSceneGenerated(payload: any): void {
    const { tileCount } = payload;

    // Reset camera position first (handles regeneration without explicit SCENE_CLEARED)
    this.resetCamera();

    this.calculateBounds(tileCount);
    this.isFollowing = true;

    // Initialize target camera position from current node position
    this.targetCameraX = this.node.position.x;
  }

  /**
   * Calculate camera bounds based on world size
   */
  private calculateBounds(tileCount: number): void {
    const tileWidth = GameConfig.TILE_WIDTH;
    const gap = GameConfig.TILE_GAP;

    // Calculate world width
    this.worldWidth =
      Math.abs(GameConfig.PLAYER_START_X) +
      tileCount * (tileWidth + gap) +
      GameConfig.TREASURE_OFFSET;

    // Set bounds (keep some padding)
    this.minX = GameConfig.PLAYER_START_X;
    this.maxX = this.worldWidth - 200;

    console.log(`[CameraController] Bounds set: ${this.minX} to ${this.maxX}`);
  }

  /**
   * Update camera position every frame
   */
  update(deltaTime: number): void {
    if (!this.isFollowing) {
      return;
    }

    if (this.isManuallyControlled) {
      // Manual control mode - smooth move to target position
      this.smoothMoveToTarget();
    } else {
      // Auto-follow mode - follow the player
      this.followTarget();
    }
  }

  /**
   * Smoothly move camera to target position (manual control)
   */
  private smoothMoveToTarget(): void {
    const currentPos = this.node.getPosition();

    // Apply game speed to smooth speed
    const adjustedSmoothSpeed = this.smoothSpeed * gameSpeedManager.getSpeed();

    // Smooth lerp to target position
    const newX =
      currentPos.x + (this.targetCameraX - currentPos.x) * adjustedSmoothSpeed;
    const newY = GameConfig.CAMERA_OFFSET_Y;

    this.node.setPosition(new Vec3(newX, newY, currentPos.z));
  }

  /**
   * Smoothly follow the target (auto-follow mode)
   */
  private followTarget(): void {
    if (!this.target) return;

    const playerPos = this.target.getPosition();
    const currentPos = this.node.getPosition();

    // Look-ahead distance: half tile + half gap
    const lookAhead = (this.tileWidth + this.tileGap) / 2;

    let desiredX: number;

    // Before first jump (invincible start)
    if (GameState.currentTileIndex < 0) {
      desiredX = playerPos.x + lookAhead * 0.5;
    } else {
      // Normal gameplay: focus ahead of player
      desiredX = playerPos.x + lookAhead;
    }

    // Clamp to world bounds
    desiredX = this.clampCameraX(desiredX);

    // Apply game speed to camera follow speed
    const adjustedFollowSpeed = GameConfig.CAMERA_FOLLOW_SPEED * gameSpeedManager.getSpeed();

    // Smooth follow
    const newX =
      currentPos.x + (desiredX - currentPos.x) * adjustedFollowSpeed;

    this.node.setPosition(
      new Vec3(newX, GameConfig.CAMERA_OFFSET_Y, currentPos.z)
    );

    // Keep targetCameraX in sync (important for manual override)
    this.targetCameraX = desiredX;
  }

  // Utility to compute center X of a tile index
  private getTileCenterX(index: number): number {
    if (index < 0) index = 0;
    return (
      this.worldStartX +
      index * (this.tileWidth + this.tileGap) +
      this.tileWidth / 2
    );
  }

  /**
   * Reset camera to start position
   */
  private resetCamera(): void {
    const startX = GameConfig.PLAYER_START_X + GameConfig.CAMERA_OFFSET_X;

    this.node.setPosition(
      new Vec3(startX, GameConfig.CAMERA_OFFSET_Y, this.node.position.z)
    );

    this.targetCameraX = startX;
    this.isFollowing = false;
    this.isManuallyControlled = false;
    this.isDragging = false;
  }

  /**
   * Handle scene cleared
   */
  private onSceneCleared(): void {
    this.resetCamera();
  }

  /**
   * Get current camera bounds (for debugging)
   */
  getBounds(): { minX: number; maxX: number } {
    return {
      minX: this.minX,
      maxX: this.maxX,
    };
  }

  /**
   * Manually set camera position (useful for preview mode)
   */
  public setCameraPosition(x: number): void {
    this.targetCameraX = this.clampCameraX(x);
    this.isManuallyControlled = true;
  }

  /**
   * Enable/disable manual control
   */
  public setManualControlEnabled(enabled: boolean): void {
    this.enableManualControl = enabled;

    if (!enabled) {
      this.isManuallyControlled = false;
      this.isDragging = false;
    }
  }

  onDestroy() {
    // Remove input listeners
    if (this.enableManualControl) {
      input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
      input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
      input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
      input.off(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this);
      input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
      input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
      input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    console.log("[CameraController] Destroyed");
  }
}
