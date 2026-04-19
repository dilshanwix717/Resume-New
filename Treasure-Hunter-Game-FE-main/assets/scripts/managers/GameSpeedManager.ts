// assets/scripts/managers/GameSpeedManager.ts
import { _decorator } from "cc";
import { EventBus } from "../core/EventBus";
import { GameEvent } from "../core/GameEvents";

const { ccclass } = _decorator;

/**
 * GameSpeedManager - Centralized manager for controlling game speed
 * 
 * Features:
 * - Singleton pattern for global access
 * - Speed multiplier that affects only frontend animations/movements
 * - Does NOT affect API calls or server communication
 * - Event-driven speed changes
 * 
 * Usage:
 * - GameSpeedManager.getInstance().setSpeed(2.0) // 2x speed
 * - GameSpeedManager.getInstance().getSpeed() // Get current speed
 * - GameSpeedManager.getInstance().isNormalSpeed() // Check if normal speed
 */
@ccclass("GameSpeedManager")
export class GameSpeedManager {
  private static instance: GameSpeedManager | null = null;
  
  // Speed multipliers
  private currentSpeed: number = 1.0;
  public readonly NORMAL_SPEED: number = 1.0;
  public readonly FAST_SPEED: number = 2.0;
  
  private constructor() {
    console.log("[GameSpeedManager] Initialized");
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): GameSpeedManager {
    if (!GameSpeedManager.instance) {
      GameSpeedManager.instance = new GameSpeedManager();
    }
    return GameSpeedManager.instance;
  }
  
  /**
   * Get current speed multiplier
   */
  public getSpeed(): number {
    return this.currentSpeed;
  }
  
  /**
   * Set speed multiplier
   * @param speed The speed multiplier (1.0 = normal, 2.0 = 2x fast)
   */
  public setSpeed(speed: number): void {
    if (speed <= 0) {
      console.warn("[GameSpeedManager] Invalid speed, must be > 0");
      return;
    }
    
    const oldSpeed = this.currentSpeed;
    this.currentSpeed = speed;
    
    console.log(`[GameSpeedManager] Speed changed: ${oldSpeed}x -> ${speed}x`);
    
    // Emit event for components to react
    EventBus.emit(GameEvent.GAME_SPEED_CHANGED, {
      speed: this.currentSpeed,
      previousSpeed: oldSpeed
    });
  }
  
  /**
   * Set to normal speed (1x)
   */
  public setNormalSpeed(): void {
    this.setSpeed(this.NORMAL_SPEED);
  }
  
  /**
   * Set to fast speed (2x)
   */
  public setFastSpeed(): void {
    this.setSpeed(this.FAST_SPEED);
  }
  
  /**
   * Toggle between normal and fast speed
   */
  public toggleSpeed(): void {
    if (this.isNormalSpeed()) {
      this.setFastSpeed();
    } else {
      this.setNormalSpeed();
    }
  }
  
  /**
   * Check if currently at normal speed
   */
  public isNormalSpeed(): boolean {
    return this.currentSpeed === this.NORMAL_SPEED;
  }
  
  /**
   * Check if currently at fast speed
   */
  public isFastSpeed(): boolean {
    return this.currentSpeed === this.FAST_SPEED;
  }
  
  /**
   * Get adjusted duration based on current speed
   * Use this to adjust animation durations
   * @param baseDuration The base duration at normal speed
   * @returns Adjusted duration based on current speed
   */
  public adjustDuration(baseDuration: number): number {
    return baseDuration / this.currentSpeed;
  }
  
  /**
   * Get adjusted delay based on current speed
   * Use this for setTimeout, scheduleOnce, etc.
   * @param baseDelay The base delay at normal speed
   * @returns Adjusted delay based on current speed
   */
  public adjustDelay(baseDelay: number): number {
    return baseDelay / this.currentSpeed;
  }
  
  /**
   * Destroy singleton instance
   */
  public static destroy(): void {
    if (GameSpeedManager.instance) {
      console.log("[GameSpeedManager] Destroyed");
      GameSpeedManager.instance = null;
    }
  }
}

// Export singleton instance for easy access
export const gameSpeedManager = GameSpeedManager.getInstance();
