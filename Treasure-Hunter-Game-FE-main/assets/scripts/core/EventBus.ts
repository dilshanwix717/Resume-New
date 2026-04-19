// assets/scripts/core/EventBus.ts
import { GameEvent } from "./GameEvents";

type EventCallback<T = any> = (data: T) => void;

class EventBusClass {
  private listeners: Map<GameEvent, EventCallback[]> = new Map();
  private debugMode: boolean = true;

  /**
   * Subscribe to an event
   */
  on<T = any>(event: GameEvent, callback: EventCallback<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    if (this.debugMode) {
      //console.log(`[EventBus] Subscribed to ${event}`);
    }
  }

  /**
   * Unsubscribe from an event
   */
  off<T = any>(event: GameEvent, callback: EventCallback<T>): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;

    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);

      if (this.debugMode) {
        //console.log(`[EventBus] Unsubscribed from ${event}`);
      }
    }
  }

  /**
   * Emit an event with typed payload
   */
  emit<T = any>(event: GameEvent, data?: T): void {
    const callbacks = this.listeners.get(event);

    if (this.debugMode) {
      //console.log(`[EventBus] Emitting ${event}`, data);
    }

    if (!callbacks || callbacks.length === 0) {
      if (this.debugMode) {
        //console.warn(`[EventBus] No listeners for ${event}`);
      }
      return;
    }

    // Call all callbacks with the data
    callbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        //console.error(`[EventBus] Error in callback for ${event}:`, error);
      }
    });
  }

  /**
   * Remove all listeners for a specific event
   */
  removeAllListeners(event: GameEvent): void {
    this.listeners.delete(event);

    if (this.debugMode) {
      //console.log(`[EventBus] Removed all listeners for ${event}`);
    }
  }

  /**
   * Clear all event listeners (use with caution)
   */
  clear(): void {
    this.listeners.clear();

    if (this.debugMode) {
      //console.log(`[EventBus] Cleared all listeners`);
    }
  }

  /**
   * Get listener count for an event (debugging)
   */
  getListenerCount(event: GameEvent): number {
    return this.listeners.get(event)?.length || 0;
  }

  /**
   * Enable/disable debug logging
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
}

// Singleton instance
export const EventBus = new EventBusClass();
