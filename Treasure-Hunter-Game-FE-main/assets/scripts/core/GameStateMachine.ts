// assets/scripts/core/GameStateMachine.ts

import { EventBus } from "./EventBus";
import { GameEvent } from "./GameEvents";
import { GameState } from "./GameState";

export enum FSMState {
  Idle = "Idle",
  Betting = "Betting",
  Ready = "Ready", // Player can jump or cashout (replaces WaitingForStart)
  AwaitingServer = "AwaitingServer",
  TrapResult = "TrapResult",
  CashingOut = "CashingOut",
  RoundEnded = "RoundEnded",
}

// Events that the FSM listens to and processes for state transitions
const FSM_EVENTS: GameEvent[] = [
  GameEvent.BET_PLACED,
  GameEvent.BET_CONFIRMED,
  GameEvent.BET_FAILED,
  GameEvent.JUMP_REQUESTED,
  GameEvent.JUMP_RESULT_SAFE,
  GameEvent.JUMP_RESULT_TRAP,
  GameEvent.LANDING_COMPLETE,
  GameEvent.CASHOUT_REQUESTED,
  GameEvent.CASHOUT_COMPLETE,
  GameEvent.NETWORK_ERROR,
];

interface StateDefinition {
  onEnter?: () => void;
  onExit?: () => void;
  allowedEvents: GameEvent[];
}

export class GameStateMachine {
  private static instance: GameStateMachine | null = null;
  private currentState: FSMState = FSMState.Idle;
  private states: Map<FSMState, StateDefinition> = new Map();
  private transitions: Map<FSMState, Map<GameEvent, FSMState>> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    // Prevent multiple instances from registering duplicate listeners
    if (GameStateMachine.instance) {
      console.warn(
        "[FSM] Instance already exists, returning existing instance",
      );
      return GameStateMachine.instance;
    }

    GameStateMachine.instance = this;
    this.defineStates();
    this.defineTransitions();
    this.setupEventListeners();
    this.isInitialized = true;
    console.log("[FSM] Initialized in Idle state");
  }

  /**
   * Define all states and their callbacks
   */
  private defineStates(): void {
    this.states.set(FSMState.Idle, {
      onEnter: () => {
        console.log("[FSM] Entered Idle state");
        GameState.currentFSMState = FSMState.Idle;
      },
      allowedEvents: [GameEvent.BET_PLACED],
    });

    this.states.set(FSMState.Betting, {
      onEnter: () => {
        console.log("[FSM] Entered Betting state");
        GameState.currentFSMState = FSMState.Betting;
      },
      allowedEvents: [GameEvent.BET_CONFIRMED, GameEvent.BET_FAILED],
    });

    this.states.set(FSMState.Ready, {
      onEnter: () => {
        console.log("[FSM] Entered Ready state - player can jump or cashout");
        GameState.currentFSMState = FSMState.Ready;
        GameState.isAwaitingServer = false;
      },
      allowedEvents: [GameEvent.JUMP_REQUESTED, GameEvent.CASHOUT_REQUESTED],
    });

    this.states.set(FSMState.AwaitingServer, {
      onEnter: () => {
        console.log("[FSM] Entered AwaitingServer state");
        GameState.currentFSMState = FSMState.AwaitingServer;
        GameState.isAwaitingServer = true;
      },
      onExit: () => {
        GameState.isAwaitingServer = false;
      },
      allowedEvents: [
        GameEvent.JUMP_RESULT_SAFE,
        GameEvent.JUMP_RESULT_TRAP,
        GameEvent.NETWORK_ERROR,
        GameEvent.CASHOUT_COMPLETE,
      ],
    });

    this.states.set(FSMState.TrapResult, {
      onEnter: () => {
        console.log("[FSM] Entered TrapResult state");
        GameState.currentFSMState = FSMState.TrapResult;
      },
      allowedEvents: [GameEvent.LANDING_COMPLETE],
    });

    this.states.set(FSMState.CashingOut, {
      onEnter: () => {
        console.log("[FSM] Entered CashingOut state");
        GameState.currentFSMState = FSMState.CashingOut;
        GameState.isAwaitingServer = true;
      },
      onExit: () => {
        GameState.isAwaitingServer = false;
      },
      allowedEvents: [GameEvent.CASHOUT_COMPLETE, GameEvent.NETWORK_ERROR],
    });

    this.states.set(FSMState.RoundEnded, {
      onEnter: () => {
        console.log("[FSM] Entered RoundEnded state");
        GameState.currentFSMState = FSMState.RoundEnded;
      },
      allowedEvents: [GameEvent.BET_PLACED],
    });
  }

  /**
   * Define all valid state transitions
   *
   * Flow:
   * Idle → BET_PLACED → Betting
   * Betting → BET_CONFIRMED → Ready
   * Betting → BET_FAILED → Idle
   * Ready → JUMP_REQUESTED → AwaitingServer
   * Ready → CASHOUT_REQUESTED → CashingOut
   * AwaitingServer → JUMP_RESULT_SAFE → Ready (back to ready for next jump)
   * AwaitingServer → JUMP_RESULT_TRAP → TrapResult
   * AwaitingServer → NETWORK_ERROR → RoundEnded
   * AwaitingServer → CASHOUT_COMPLETE → RoundEnded
   * TrapResult → LANDING_COMPLETE → RoundEnded
   * CashingOut → CASHOUT_COMPLETE → RoundEnded
   * CashingOut → NETWORK_ERROR → Ready (allows retry on failure)
   * RoundEnded → BET_PLACED → Betting
   */
  private defineTransitions(): void {
    // Idle → Betting
    this.addTransition(FSMState.Idle, GameEvent.BET_PLACED, FSMState.Betting);

    // Betting → Ready or Idle
    this.addTransition(
      FSMState.Betting,
      GameEvent.BET_CONFIRMED,
      FSMState.Ready,
    );
    this.addTransition(FSMState.Betting, GameEvent.BET_FAILED, FSMState.Idle);

    // Ready → AwaitingServer or CashingOut
    this.addTransition(
      FSMState.Ready,
      GameEvent.JUMP_REQUESTED,
      FSMState.AwaitingServer,
    );
    this.addTransition(
      FSMState.Ready,
      GameEvent.CASHOUT_REQUESTED,
      FSMState.CashingOut,
    );

    // AwaitingServer → Ready, TrapResult, or RoundEnded
    this.addTransition(
      FSMState.AwaitingServer,
      GameEvent.JUMP_RESULT_SAFE,
      FSMState.Ready,
    );
    this.addTransition(
      FSMState.AwaitingServer,
      GameEvent.JUMP_RESULT_TRAP,
      FSMState.TrapResult,
    );
    this.addTransition(
      FSMState.AwaitingServer,
      GameEvent.NETWORK_ERROR,
      FSMState.RoundEnded,
    );
    this.addTransition(
      FSMState.AwaitingServer,
      GameEvent.CASHOUT_COMPLETE,
      FSMState.RoundEnded,
    );

    // TrapResult → RoundEnded
    this.addTransition(
      FSMState.TrapResult,
      GameEvent.LANDING_COMPLETE,
      FSMState.RoundEnded,
    );

    // CashingOut → RoundEnded (on success) or Ready (on error to allow retry)
    this.addTransition(
      FSMState.CashingOut,
      GameEvent.CASHOUT_COMPLETE,
      FSMState.RoundEnded,
    );
    this.addTransition(
      FSMState.CashingOut,
      GameEvent.NETWORK_ERROR,
      FSMState.Ready,
    );

    // RoundEnded → Betting (via new bet)
    this.addTransition(
      FSMState.RoundEnded,
      GameEvent.BET_PLACED,
      FSMState.Betting,
    );
  }

  /**
   * Add a transition rule
   */
  private addTransition(from: FSMState, event: GameEvent, to: FSMState): void {
    if (!this.transitions.has(from)) {
      this.transitions.set(from, new Map());
    }
    this.transitions.get(from)!.set(event, to);
  }

  /**
   * Setup event listeners for FSM transitions
   */
  private setupEventListeners(): void {
    FSM_EVENTS.forEach((event) => {
      EventBus.on(event, (payload?: any) => this.handleEvent(event, payload));
    });
  }

  /**
   * Handle an event and attempt transition
   * Returns true if transition was successful, false otherwise
   */
  private handleEvent(event: GameEvent, payload?: any): boolean {
    const stateDefinition = this.states.get(this.currentState);

    if (!stateDefinition) {
      console.error(`[FSM] No definition for state ${this.currentState}`);
      return false;
    }

    // Check if event is allowed in current state
    if (!stateDefinition.allowedEvents.includes(event)) {
      // Only log in debug mode to avoid spam
      if (this.isDebugEnabled()) {
        console.debug(
          `[FSM] Event ${event} ignored in state ${this.currentState} (not in allowed events)`,
        );
      }
      return false;
    }

    // Check if transition exists
    const nextState = this.transitions.get(this.currentState)?.get(event);
    if (!nextState) {
      console.warn(
        `[FSM] No transition defined for ${this.currentState} + ${event}`,
      );
      return false;
    }

    // Perform transition
    this.transition(nextState);
    return true;
  }

  /**
   * Transition to a new state
   */
  private transition(newState: FSMState): void {
    const oldState = this.currentState;
    const oldStateDefinition = this.states.get(oldState);
    const newStateDefinition = this.states.get(newState);

    // Exit old state
    if (oldStateDefinition?.onExit) {
      oldStateDefinition.onExit();
    }

    // Update current state
    this.currentState = newState;

    // Enter new state
    if (newStateDefinition?.onEnter) {
      newStateDefinition.onEnter();
    }

    console.log(`[FSM] ${oldState} → ${newState}`);

    // Emit state change event
    EventBus.emit(GameEvent.STATE_UPDATED, {
      oldState,
      newState,
      timestamp: Date.now(),
    });
  }

  /**
   * Get current state
   */
  getCurrentState(): FSMState {
    return this.currentState;
  }

  /**
   * Check if an event is allowed in current state
   */
  isEventAllowed(event: GameEvent): boolean {
    const stateDefinition = this.states.get(this.currentState);
    return stateDefinition?.allowedEvents.includes(event) || false;
  }

  /**
   * Reset FSM to initial state (for new games)
   */
  reset(): void {
    console.log("[FSM] Resetting to Idle state");
    this.currentState = FSMState.Idle;
    GameState.currentFSMState = FSMState.Idle;
    GameState.isAwaitingServer = false;
  }

  /**
   * Force FSM to a specific state (for error recovery)
   */
  forceState(state: FSMState): void {
    console.log(`[FSM] Force state: ${this.currentState} → ${state}`);
    this.currentState = state;
    GameState.currentFSMState = state;

    // Update isAwaitingServer based on state
    const awaitingStates = [FSMState.AwaitingServer, FSMState.CashingOut];
    GameState.isAwaitingServer = awaitingStates.includes(state);
  }

  /**
   * Check if debug logging is enabled
   */
  private isDebugEnabled(): boolean {
    return false; // Set to true for verbose FSM logging
  }

  /**
   * Get singleton instance
   */
  static getInstance(): GameStateMachine | null {
    return GameStateMachine.instance;
  }

  /**
   * Destroy singleton (for cleanup/testing)
   */
  static destroy(): void {
    GameStateMachine.instance = null;
  }
}
