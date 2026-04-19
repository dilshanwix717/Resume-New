// assets/scripts/managers/TileManager.ts

import {
  _decorator,
  Component,
  Node,
  Prefab,
  instantiate,
  Vec3,
  NodePool,
} from "cc";
import { EventBus } from "../core/EventBus";
import { GameEvent } from "../core/GameEvents";
import { GameConfig, getMultiplier } from "../Config/GameConfig";
import { TileState, GameDifficulty } from "../types/GameTypes";
import { Tile } from "../components/Tile"; // <-- IMPORT THE TILE CLASS

const { ccclass, property } = _decorator;

@ccclass("TileManager")
export class TileManager extends Component {
  @property(Prefab)
  tilePrefab: Prefab = null!;

  @property(Node)
  tileContainer: Node = null!;

  private tilePool: NodePool = null!;
  private activeTiles: Node[] = [];
  private tileStates: TileState[] = [];

  onLoad() {
    console.log("[TileManager] Initializing...");

    // Initialize object pool
    this.tilePool = new NodePool();
    this.prewarmPool();

    // Setup event listeners
    this.setupEventListeners();

    console.log("[TileManager] Initialized");
  }

  /**
   * Prewarm tile pool
   */
  private prewarmPool(): void {
    for (let i = 0; i < GameConfig.TILE_POOL_SIZE; i++) {
      const tile = instantiate(this.tilePrefab);
      this.tilePool.put(tile);
    }
    console.log(
      `[TileManager] Prewarmed pool with ${GameConfig.TILE_POOL_SIZE} tiles`,
    );
  }

  // Store bound callback references for proper cleanup
  private boundOnSceneGenerated: ((payload: any) => void) | null = null;
  private boundOnSceneCleared: (() => void) | null = null;
  private boundOnTileRevealed: ((payload: any) => void) | null = null;
  private boundOnTileClicked: ((payload: any) => void) | null = null;
  private boundOnShowCrashPoint: ((payload: any) => void) | null = null;

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Create and store bound references for later cleanup
    this.boundOnSceneGenerated = this.onSceneGenerated.bind(this);
    this.boundOnSceneCleared = this.onSceneCleared.bind(this);
    this.boundOnTileRevealed = this.onTileRevealed.bind(this);
    this.boundOnTileClicked = this.onTileClicked.bind(this);

    EventBus.on(GameEvent.SCENE_GENERATED, this.boundOnSceneGenerated);
    EventBus.on(GameEvent.SCENE_CLEARED, this.boundOnSceneCleared);
    EventBus.on(GameEvent.TILE_REVEALED, this.boundOnTileRevealed);
    EventBus.on(GameEvent.UI_TILE_CLICKED, this.boundOnTileClicked);

    this.boundOnShowCrashPoint = this.onShowCrashPoint.bind(this);
    EventBus.on(GameEvent.SHOW_CRASH_POINT, this.boundOnShowCrashPoint);
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    if (this.boundOnSceneGenerated) {
      EventBus.off(GameEvent.SCENE_GENERATED, this.boundOnSceneGenerated);
    }
    if (this.boundOnSceneCleared) {
      EventBus.off(GameEvent.SCENE_CLEARED, this.boundOnSceneCleared);
    }
    if (this.boundOnTileRevealed) {
      EventBus.off(GameEvent.TILE_REVEALED, this.boundOnTileRevealed);
    }
    if (this.boundOnTileClicked) {
      EventBus.off(GameEvent.UI_TILE_CLICKED, this.boundOnTileClicked);
    }
    if (this.boundOnShowCrashPoint) {
      EventBus.off(GameEvent.SHOW_CRASH_POINT, this.boundOnShowCrashPoint);
    }
  }

  /**
   * Generate tiles for a round
   */
  private onSceneGenerated(payload: any): void {
    const { difficulty, tileCount } = payload;
    console.log(`[TileManager] Generating ${tileCount} tiles (${difficulty})`);
    this.generateTiles(tileCount, difficulty as GameDifficulty);
  }

  /**
   * Generate tiles in horizontal linear layout
   */
  private generateTiles(count: number, difficulty: GameDifficulty): void {
    // Clear existing tiles
    this.clearTiles();

    const startX = GameConfig.WORLD_START_X;
    const tileWidth = GameConfig.TILE_WIDTH;
    const gap = GameConfig.TILE_GAP;

    for (let i = 0; i < count; i++) {
      // Get tile from pool
      let tile: Node;
      if (this.tilePool.size() > 0) {
        tile = this.tilePool.get()!;
      } else {
        tile = instantiate(this.tilePrefab);
      }

      // Position tile
      const x = startX + i * (tileWidth + gap);
      const y = 0;
      tile.setPosition(new Vec3(x, y, 0));

      // Set tile to unrevealed state
      this.setTileVisualState(tile, TileState.UNREVEALED);

      // Store tile index and multiplier
      tile.name = `Tile_${i}`;
      const tileComponent = tile.getComponent(Tile);
      if (tileComponent) {
        tileComponent.tileIndex = i;
        tileComponent.isRevealed = false;
        // Set the multiplier for this tile
        const multiplier = getMultiplier(difficulty, i);
        tileComponent.setMultiplier(multiplier);
      }

      // Add to container
      this.tileContainer.addChild(tile);
      this.activeTiles.push(tile);
      this.tileStates.push(TileState.UNREVEALED);
    }

    // Update collectable appearances after all tiles have their indices set
    this.refreshFutureTileAppearances();
  }

  /**
   * Handle tile reveal event
   */
  private onTileRevealed(payload: any): void {
    const { tileIndex, isSafe } = payload;

    if (tileIndex < 0 || tileIndex >= this.activeTiles.length) {
      console.error(`[TileManager] Invalid tile index: ${tileIndex}`);
      return;
    }

    // Prevent duplicate reveals
    const currentState = this.tileStates[tileIndex];
    if (currentState !== TileState.UNREVEALED) {
      return;
    }

    console.log(
      `[TileManager] Revealing tile ${tileIndex}: ${isSafe ? "SAFE" : "TRAP"}`,
    );

    const tile = this.activeTiles[tileIndex];
    const newState = isSafe ? TileState.SAFE : TileState.TRAP;

    this.revealTile(tile, newState, tileIndex);
    this.tileStates[tileIndex] = newState;

    // Always refresh past and current tile appearances, even on crash
    this.refreshPastTiles(tileIndex);
    this.refreshFutureTileAppearances();
    this.refreshCurrentTileAppearance(tileIndex);
  }

  /**
   * Refresh the current tile (where player just landed) to show active multiplier popup
   */
  private refreshCurrentTileAppearance(tileIndex: number): void {
    if (tileIndex >= 0 && tileIndex < this.activeTiles.length) {
      const tile = this.activeTiles[tileIndex];
      const tileComponent = tile.getComponent(Tile);
      if (tileComponent) {
        tileComponent.updateCollectableAppearance();
      }
    }
  }

  /**
   * Refresh collectable appearances for all future tiles
   * Called after player moves to update which tile shows active vs dark
   */
  private refreshFutureTileAppearances(): void {
    for (let i = 0; i < this.activeTiles.length; i++) {
      if (this.tileStates[i] === TileState.UNREVEALED) {
        const tile = this.activeTiles[i];
        const tileComponent = tile.getComponent(Tile);
        if (tileComponent) {
          tileComponent.updateCollectableAppearance();
        }
      }
    }
  }

  /**
   * Reveal a tile with animation
   */
  private revealTile(tile: Node, state: TileState, index: number): void {
    // Update visual state
    this.setTileVisualState(tile, state);

    // Update tile component
    const tileComponent = tile.getComponent(Tile);
    if (tileComponent) {
      tileComponent.isRevealed = true;
      tileComponent.state = state;

      // Collect the item if tile is safe, crash if trap
      if (state === TileState.SAFE) {
        tileComponent.collectItem();
      } else if (state === TileState.TRAP) {
        tileComponent.crashItem();
      }
    }

    // Play reveal animation (can be implemented in Tile component)
    // For now, we'll just update the visual immediately
  }

  /**
   * Set tile visual state (color/sprite)
   */
  private setTileVisualState(tile: Node, state: TileState): void {
    const tileComponent = tile.getComponent(Tile);
    if (tileComponent) {
      tileComponent.setState(state);
    }
  }

  /**
   * Handle tile click from UI_TILE_CLICKED event
   * Validates and forwards as JUMP_REQUESTED
   */
  private onTileClicked(payload: any): void {
    const { tileIndex } = payload;

    // Validate if this is the next tile
    const currentIndex = this.getLastRevealedTileIndex();
    if (tileIndex !== currentIndex + 1) {
      return;
    }

    // Check if tile is already revealed
    if (this.tileStates[tileIndex] !== TileState.UNREVEALED) {
      return;
    }

    // Emit jump request event - FSM and GameController will handle it
    EventBus.emit(GameEvent.JUMP_REQUESTED, { tileIndex });
  }

  // refresh all past tile

  private refreshPastTiles(currentTileIndex: number): void {
    for (let i = 0; i < currentTileIndex; i++) {
      if (this.tileStates[i] === TileState.SAFE) {
        const tile = this.activeTiles[i];
        const tileComponent = tile.getComponent(Tile);
        if (tileComponent) {
          tileComponent.setState(TileState.SAFE);
          // Update appearance to hide active popup and show normal label
          tileComponent.updateCollectableAppearance();
          // Play Empty animation on passed tiles
          tileComponent.showEmpty();
        }
      }
    }
  }

  /**
   * Handle showing the crash point after cashout
   * Plays the Death animation on the tile that would have been the crash tile
   */
  private onShowCrashPoint(payload: { tileIndex: number }): void {
    const { tileIndex } = payload;

    if (tileIndex < 0 || tileIndex >= this.activeTiles.length) {
      console.warn(
        `[TileManager] Invalid crash point tile index: ${tileIndex}`,
      );
      return;
    }

    // Only show death on unrevealed tiles (crash point should be ahead of the player)
    if (this.tileStates[tileIndex] !== TileState.UNREVEALED) {
      console.warn(
        `[TileManager] Crash point tile ${tileIndex} already revealed`,
      );
      return;
    }

    console.log(`[TileManager] Showing crash point on tile ${tileIndex}`);

    const tile = this.activeTiles[tileIndex];
    const tileComponent = tile.getComponent(Tile);
    if (tileComponent) {
      tileComponent.setState(TileState.TRAP);
      tileComponent.showDeath();
      this.tileStates[tileIndex] = TileState.TRAP;
    }
  }

  /**
   * Get the index of the last revealed tile
   */
  private getLastRevealedTileIndex(): number {
    for (let i = this.tileStates.length - 1; i >= 0; i--) {
      if (this.tileStates[i] !== TileState.UNREVEALED) {
        return i;
      }
    }
    return -1; // No tiles revealed yet
  }

  /**
   * Get tile world position
   */
  getTilePosition(index: number): Vec3 | null {
    if (index < 0 || index >= this.activeTiles.length) {
      return null;
    }
    return this.activeTiles[index].getWorldPosition();
  }

  /**
   * Clear all tiles and return to pool
   */
  private onSceneCleared(): void {
    this.clearTiles();
  }

  /**
   * Clear tiles and return them to pool
   */
  private clearTiles(): void {
    if (this.activeTiles.length > 0) {
      console.log(`[TileManager] Clearing ${this.activeTiles.length} tiles`);
      this.activeTiles.forEach((tile) => {
        tile.removeFromParent();
        this.tilePool.put(tile);
      });
      this.activeTiles = [];
      this.tileStates = [];
    }
  }

  onDestroy() {
    // Remove event listeners first to prevent duplicate handling
    this.removeEventListeners();

    // Clean up pool
    this.tilePool.clear();
    console.log("[TileManager] Destroyed");
  }
}
