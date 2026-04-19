// assets/scripts/managers/BackgroundManager.ts
import {
  _decorator,
  Component,
  Node,
  Prefab,
  instantiate,
  Vec3,
  NodePool,
  UITransform,
} from "cc";
import { EventBus } from "../core/EventBus";
import { GameEvent } from "../core/GameEvents";
import { GameConfig } from "../Config/GameConfig";
import {
  BACKGROUND_LAYERS,
  BackgroundLayerConfig,
  BackgroundLayerType,
} from "../Config/BackgroundConfig";

const { ccclass, property } = _decorator;

interface ParallaxLayer {
  type: BackgroundLayerType;
  container: Node;
  pool: NodePool;
  prefab: Prefab;
  config: BackgroundLayerConfig;
  segments: Node[];
}

@ccclass("BackgroundManager")
export class BackgroundManager extends Component {
  private static instance: BackgroundManager | null = null;

  @property(Node)
  backgroundContainer: Node = null!;

  @property(Prefab)
  backgroundPrefabFar: Prefab = null!; // Mountains/Sky

  @property(Prefab)
  backgroundPrefabMid: Prefab = null!; // Trees/Clouds

  @property(Prefab)
  backgroundPrefabNear: Prefab = null!; // Ground/Grass

  @property(Prefab)
  startBackgroundPrefab: Prefab = null!; // Start segment for near layer

  @property(Prefab)
  finishBackgroundPrefab: Prefab = null!; // Finish segment for near layer

  @property(Node)
  cameraNode: Node = null!;

  private layers: ParallaxLayer[] = [];
  private worldWidth: number = 0;
  private initialCameraX: number = 0; // Track initial camera position
  private startSegment: Node | null = null; // Start prefab instance for near layer
  private finishSegment: Node | null = null; // Finish prefab instance for near layer
  private currentTileCount: number = 0; // Track tile count for positioning

  onLoad() {
    // Singleton check - prevent multiple instances
    if (BackgroundManager.instance !== null) {
      console.warn(
        "[BackgroundManager] Duplicate instance detected! Destroying...",
      );
      this.node.destroy();
      return;
    }

    BackgroundManager.instance = this;

    console.log("[BackgroundManager] Initializing...");
    this.initializeLayers();
    this.setupEventListeners();
    console.log("[BackgroundManager] Initialized");
  }

  /**
   * Initialize parallax layers
   */
  private initializeLayers(): void {
    this.layers.push(
      this.createLayer(BackgroundLayerType.FAR, this.backgroundPrefabFar),
    );

    this.layers.push(
      this.createLayer(BackgroundLayerType.MID, this.backgroundPrefabMid),
    );

    this.layers.push(
      this.createLayer(BackgroundLayerType.NEAR, this.backgroundPrefabNear),
    );
    console.log("[BackgroundManager] Layers initialized");
  }

  private createLayer(
    type: BackgroundLayerType,
    prefab: Prefab,
  ): ParallaxLayer {
    const config = BACKGROUND_LAYERS[type];

    const container = new Node(`Layer_${type}`);
    container.setParent(this.backgroundContainer);

    const pool = new NodePool();
    this.prewarmPool(pool, prefab);

    return {
      type,
      container,
      pool,
      prefab,
      config,
      segments: [],
    };
  }

  /**
   * Prewarm pool for a layer
   */
  private prewarmPool(pool: NodePool, prefab: Prefab): void {
    for (let i = 0; i < GameConfig.BACKGROUND_POOL_SIZE; i++) {
      const segment = instantiate(prefab);
      pool.put(segment);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    EventBus.on(GameEvent.SCENE_GENERATED, this.onSceneGenerated.bind(this));
    EventBus.on(GameEvent.SCENE_CLEARED, this.onSceneCleared.bind(this));
  }

  /**
   * Handle scene generation
   */
  private onSceneGenerated(payload: any): void {
    const { tileCount } = payload;
    console.log("[BackgroundManager] Generating background", payload);

    // Clear existing background first (handles regeneration without explicit SCENE_CLEARED)
    this.clearBackground();

    // Store tile count for finish prefab positioning
    this.currentTileCount = tileCount;

    // Store initial camera position
    if (this.cameraNode) {
      this.initialCameraX = this.cameraNode.position.x;
    }

    this.calculateWorldWidth(tileCount);
    this.generateBackground();
  }

  /**
   * Calculate world width based on tile count
   */
  private calculateWorldWidth(tileCount: number): void {
    const tileWidth = GameConfig.TILE_WIDTH;
    const gap = GameConfig.TILE_GAP;

    this.worldWidth =
      Math.abs(GameConfig.PLAYER_START_X) +
      tileCount * (tileWidth + gap) +
      GameConfig.TREASURE_OFFSET +
      500; // Extra padding
  }

  /**
   * Generate background segments for all layers
   */
  private generateBackground(): void {
    this.layers.forEach((layer) => {
      this.generateLayerSegments(layer);
    });

    // Add start prefab to the left side of near layer
    this.addStartPrefabToNearLayer();

    // Add finish prefab after the last tile
    this.addFinishPrefabToNearLayer();
  }

  /**
   * Add start prefab to the left side of the near background layer
   */
  private addStartPrefabToNearLayer(): void {
    if (!this.startBackgroundPrefab) {
      console.warn("[BackgroundManager] Start background prefab not assigned!");
      return;
    }

    // Find the near layer
    const nearLayer = this.layers.find(
      (layer) => layer.type === BackgroundLayerType.NEAR,
    );

    if (!nearLayer) {
      console.warn("[BackgroundManager] Near layer not found!");
      return;
    }

    // Create the start segment
    this.startSegment = instantiate(this.startBackgroundPrefab);

    // Get the width of the start prefab
    const startTransform = this.startSegment.getComponent(UITransform);
    const startWidth = startTransform
      ? startTransform.contentSize.width
      : nearLayer.config.segmentWidth;

    // Position it to the left of the player start position, close to the first tile
    // Player starts at PLAYER_START_X (-400) and first tile is at WORLD_START_X (0)
    // Place start prefab so its right edge is near the player start position
    const startX = GameConfig.PLAYER_START_X - startWidth / 2;

    this.startSegment.setPosition(new Vec3(startX, nearLayer.config.baseY, 0));
    nearLayer.container.addChild(this.startSegment);

    console.log("[BackgroundManager] Start prefab added at x:", startX);
  }

  /**
   * Add finish prefab after the last tile in the near background layer
   */
  private addFinishPrefabToNearLayer(): void {
    if (!this.finishBackgroundPrefab) {
      console.warn(
        "[BackgroundManager] Finish background prefab not assigned!",
      );
      return;
    }

    // Find the near layer
    const nearLayer = this.layers.find(
      (layer) => layer.type === BackgroundLayerType.NEAR,
    );

    if (!nearLayer) {
      console.warn("[BackgroundManager] Near layer not found!");
      return;
    }

    // Create the finish segment
    this.finishSegment = instantiate(this.finishBackgroundPrefab);

    // Get the width of the finish prefab
    const finishTransform = this.finishSegment.getComponent(UITransform);
    const finishWidth = finishTransform
      ? finishTransform.contentSize.width
      : nearLayer.config.segmentWidth;

    // Calculate position after the last tile
    // Last tile position: WORLD_START_X + (tileCount - 1) * (TILE_WIDTH + TILE_GAP)
    // Finish should be placed after the last tile + TREASURE_OFFSET
    const tileWidth = GameConfig.TILE_WIDTH;
    const tileGap = GameConfig.TILE_GAP;
    const lastTileX =
      GameConfig.WORLD_START_X +
      (this.currentTileCount - 1) * (tileWidth + tileGap);
    const finishX =
      lastTileX + tileWidth + GameConfig.TREASURE_OFFSET + finishWidth / 2;

    this.finishSegment.setPosition(
      new Vec3(finishX, nearLayer.config.baseY, 0),
    );
    nearLayer.container.addChild(this.finishSegment);

    console.log("[BackgroundManager] Finish prefab added at x:", finishX);
  }

  /**
   * Generate segments for a specific layer
   */
  private generateLayerSegments(layer: ParallaxLayer): void {
    const { segmentWidth } = layer.config;

    const segmentCount = Math.ceil(this.worldWidth / segmentWidth) + 2;

    for (let i = 0; i < segmentCount; i++) {
      const segment = this.getSegmentFromPool(layer);

      const x = i * segmentWidth + GameConfig.PLAYER_START_X - segmentWidth;
      const y = layer.config.baseY;

      segment.setPosition(new Vec3(x, y, 0));
      layer.container.addChild(segment);
      layer.segments.push(segment);
    }
  }

  /**
   * Get segment from pool or create new
   */
  private getSegmentFromPool(layer: ParallaxLayer): Node {
    if (layer.pool.size() > 0) {
      return layer.pool.get()!;
    }
    return instantiate(layer.prefab);
  }

  /**
   * Update parallax effect (called every frame)
   * Key fix: Calculate camera movement from initial position,
   * then apply parallax offset based on scroll speed
   */
  update(): void {
    if (!this.cameraNode) return;

    const cameraX = this.cameraNode.position.x;
    const cameraMovement = cameraX - this.initialCameraX;

    this.layers.forEach((layer) => {
      // For NEAR layer (scrollSpeed = 1.0), this results in 0 offset
      // For FAR layer (scrollSpeed = 0.2), this creates parallax effect
      // Formula: offset = cameraMovement * (1 - scrollSpeed)
      const parallaxOffset = cameraMovement * (1 - layer.config.scrollSpeed);

      layer.container.setPosition(
        new Vec3(parallaxOffset, layer.config.baseY, 0),
      );
    });
  }

  /**
   * Clear all background segments
   */
  private onSceneCleared(): void {
    this.clearBackground();
  }

  /**
   * Clear background segments and reset state
   */
  private clearBackground(): void {
    // Skip if no segments to clear
    if (
      this.layers.every((layer) => layer.segments.length === 0) &&
      !this.startSegment &&
      !this.finishSegment
    ) {
      return;
    }

    console.log("[BackgroundManager] Clearing background");

    // Remove and destroy the start segment
    if (this.startSegment) {
      this.startSegment.removeFromParent();
      this.startSegment.destroy();
      this.startSegment = null;
    }

    // Remove and destroy the finish segment
    if (this.finishSegment) {
      this.finishSegment.removeFromParent();
      this.finishSegment.destroy();
      this.finishSegment = null;
    }

    this.layers.forEach((layer) => {
      layer.segments.forEach((segment) => {
        segment.removeFromParent();
        layer.pool.put(segment);
      });
      layer.segments = [];

      // Reset container position
      layer.container.setPosition(new Vec3(0, layer.config.baseY, 0));
    });

    // Reset initial camera position
    this.initialCameraX = 0;
  }

  onDestroy() {
    if (BackgroundManager.instance === this) {
      BackgroundManager.instance = null;
    }

    this.layers.forEach((layer) => {
      layer.pool.clear();
    });
    console.log("[BackgroundManager] Destroyed");
  }
}
