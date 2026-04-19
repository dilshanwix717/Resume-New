// assets/scripts/services/NetworkService.ts

import { EventBus } from "../core/EventBus";
import { GameEvent } from "../core/GameEvents";
import { GameConfig } from "../Config/GameConfig";
import {
  BetStartRequest,
  BetStartResponse,
  CheckCrashRequest,
  CheckCrashResponse,
  CashOutResponse,
  NetworkErrorPayload,
  LoginResponse,
} from "../types/GameTypes";

export class NetworkService {
  private baseUrl: string = "";
  private currentRetryCount: number = 0;
  private authToken: string | null = null;

  // Track pending requests to prevent duplicates
  private pendingJumpTile: number = -1;
  private pendingCashout: boolean = false;
  private pendingBet: boolean = false;

  /**
   * Initialize network service with base URL
   * @param baseUrl API base URL
   * @param token Optional JWT token to include as Authorization header (Bearer)
   */
  init(baseUrl: string, token?: string): void {
    this.baseUrl = baseUrl;
    if (token) this.authToken = token;
  }

  /**
   * Login to authenticate the user
   * @returns Promise with login success status
   */
  async postLogin(): Promise<LoginResponse> {
    const url = `${this.baseUrl}/auth/login`;

    try {
      const response = await this.fetchWithTimeout(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: LoginResponse = await response.json();

      if (!data.loginSuccess) {
        throw new Error("Login failed: server returned loginSuccess=false");
      }

      EventBus.emit(GameEvent.LOGIN_SUCCESS, data);
      return data;
    } catch (error: any) {
      console.error("[NetworkService] Login failed", error);

      EventBus.emit<NetworkErrorPayload>(GameEvent.LOGIN_FAILED, {
        message: error?.message || "Failed to login",
        canRetry: true,
      });

      throw error;
    }
  }

  /**
   * Place a bet and start a round
   */
  async postBet(request: BetStartRequest): Promise<void> {
    // Prevent duplicate bet requests
    if (this.pendingBet) {
      console.warn("[NetworkService] Bet request already pending");
      return;
    }

    this.pendingBet = true;
    const url = `${this.baseUrl}/bets/start`;

    try {
      const response = await this.fetchWithTimeout(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: BetStartResponse = await response.json();

      if (!data.id) {
        throw new Error("Invalid response: missing round id");
      }

      EventBus.emit(GameEvent.BET_CONFIRMED, {
        roundId: data.id,
      });
    } catch (error: any) {
      console.error("[NetworkService] Bet placement failed", error);

      EventBus.emit<NetworkErrorPayload>(GameEvent.BET_FAILED, {
        message: error?.message || "Failed to place bet",
        canRetry: false,
      });
    } finally {
      this.pendingBet = false;
    }
  }

  /**
   * Check if a tile is safe or trap
   * Includes retry logic (300ms → 600ms)
   */
  async postJump(roundId: string, tileIndex: number): Promise<void> {
    // Prevent duplicate jump requests for same tile
    if (this.pendingJumpTile === tileIndex) {
      console.warn(
        `[NetworkService] Jump request for tile ${tileIndex} already pending`,
      );
      return;
    }

    this.pendingJumpTile = tileIndex;
    const url = `${this.baseUrl}/bets/check/${roundId}`;

    // Server expects 1-indexed step values (1, 2, 3...), but client uses 0-indexed (0, 1, 2...)
    const request: CheckCrashRequest = {
      lastSteppedPoint: tileIndex + 1,
    };

    try {
      const response = await this.fetchWithTimeout(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CheckCrashResponse = await response.json();

      if (!data.betCrashStatus) {
        throw new Error("Invalid response: missing betCrashStatus");
      }

      // Reset retry count on success
      this.currentRetryCount = 0;

      // Emit appropriate event based on result
      if (data.betCrashStatus === "SAFE") {
        EventBus.emit(GameEvent.JUMP_RESULT_SAFE, {
          tileIndex,
          isSafe: true,
        });
      } else {
        EventBus.emit(GameEvent.JUMP_RESULT_TRAP, {
          tileIndex,
          isSafe: false,
        });
      }
    } catch (error: any) {
      console.error("[NetworkService] Jump check failed", error);

      // Retry logic
      if (this.currentRetryCount < GameConfig.MAX_RETRIES) {
        this.currentRetryCount++;
        const delay =
          this.currentRetryCount === 1
            ? GameConfig.RETRY_DELAY_MS
            : GameConfig.RETRY_DELAY_MS_SECOND;

        await this.sleep(delay);
        // Don't reset pendingJumpTile here - we're retrying the same tile
        this.pendingJumpTile = -1; // Allow retry to proceed
        return this.postJump(roundId, tileIndex);
      }

      // Max retries exceeded - emit error
      this.currentRetryCount = 0;
      EventBus.emit<NetworkErrorPayload>(GameEvent.NETWORK_ERROR, {
        message: error?.message || "Failed to check jump after retries",
        canRetry: false,
      });
    } finally {
      // Only clear if we're done with this tile (not retrying)
      if (this.currentRetryCount === 0) {
        this.pendingJumpTile = -1;
      }
    }
  }

  /**
   * Cash out and end the round
   */
  async postCashout(roundId: string): Promise<void> {
    // Prevent duplicate cashout requests
    if (this.pendingCashout) {
      console.warn("[NetworkService] Cashout request already pending");
      return;
    }

    this.pendingCashout = true;
    const url = `${this.baseUrl}/bets/cash-out/${roundId}`;

    try {
      const response = await this.fetchWithTimeout(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CashOutResponse = await response.json();

      if (
        typeof data.winAmount !== "number" ||
        typeof data.afterBetBalance !== "number"
      ) {
        throw new Error(
          "Invalid response: missing winAmount or afterBetBalance",
        );
      }

      EventBus.emit(GameEvent.CASHOUT_COMPLETE, {
        winAmount: data.winAmount,
        multiplier: data.multiplier,
        finalBalance: data.afterBetBalance,
        crashPoint: data.crashPoint,
      });
    } catch (error: any) {
      console.error("[NetworkService] Cash out failed", error);

      EventBus.emit<NetworkErrorPayload>(GameEvent.NETWORK_ERROR, {
        message: error?.message || "Failed to cash out",
        canRetry: false,
      });
    } finally {
      this.pendingCashout = false;
    }
  }

  /**
   * Fetch user account with wallet balance
   */
  async getWalletBalance(): Promise<void> {
    const url = `${this.baseUrl}/user-accounts/self?isWithWalletBalance=true`;

    try {
      const response = await this.fetchWithTimeout(url, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (typeof data.walletBalance !== "number") {
        throw new Error("Invalid response: missing walletBalance");
      }

      EventBus.emit(GameEvent.WALLET_BALANCE_FETCHED, {
        balance: data.walletBalance,
        currency: data.currency,
      });
    } catch (error: any) {
      console.error("[NetworkService] Failed to fetch wallet balance", error);
      // Don't emit network error for this - just log it
      // The game can still function with the default balance
    }
  }

  /**
   * Fetch bets (global feed or self)
   */
  async getBets(options?: {
    betId?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const isSelf = Boolean(options?.betId);

    const basePath = isSelf
      ? `${this.baseUrl}/bets/self/${options!.betId}`
      : `${this.baseUrl}/bets`;

    const url = new URL(basePath);
    if (!isSelf) {
      if (options?.page !== undefined) {
        url.searchParams.append("page", options.page.toString());
      }

      if (options?.limit !== undefined) {
        url.searchParams.append("limit", options.limit.toString());
      }
    }

    try {
      const response = await this.fetchWithTimeout(url.toString(), {
        method: "GET",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      console.log("[NetworkService] Fetched bets data:", data);
      return data;
    } catch (error: any) {
      console.error("[NetworkService] Fetching bets failed", error);
      EventBus.emit<NetworkErrorPayload>(GameEvent.NETWORK_ERROR, {
        message: error?.message || "Failed to fetch bets",
        canRetry: false,
      });
    }
  }

  /**
   * Fetch with timeout wrapper
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      GameConfig.API_TIMEOUT,
    );

    const originalHeaders = (options.headers || {}) as Record<string, string>;
    const mergedHeaders: Record<string, string> = {
      ...originalHeaders,
    };

    if (this.authToken) {
      mergedHeaders["Authorization"] = `Bearer ${this.authToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: mergedHeaders,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Reset retry counter and pending states (called at round start)
   */
  resetRetryCount(): void {
    this.currentRetryCount = 0;
    this.pendingJumpTile = -1;
    this.pendingCashout = false;
    this.pendingBet = false;
  }

  /**
   * Optional helper to set or change token at runtime
   */
  setAuthToken(token: string | null): void {
    this.authToken = token;
  }
}
