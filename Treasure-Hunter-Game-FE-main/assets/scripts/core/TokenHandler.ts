import { _decorator, Component } from "cc";
import { APIConfig } from "../Config/APIConfig";

const { ccclass } = _decorator;

/**
 * TokenHandler component handles authentication token received from parent iframe.
 * It listens for postMessage events and stores the token for API requests.
 */
@ccclass("TokenHandler")
export class TokenHandler extends Component {
  private tokenReceived: boolean = false;
  private tokenFromParent: boolean = false;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private retryInterval: ReturnType<typeof setInterval> | null = null;

  private readonly MAX_RETRIES: number = 10;
  private readonly RETRY_INTERVAL_MS: number = 1000;

  onLoad() {
    this.setupMessageListener();
    this.requestTokenFromParent();
  }

  onDestroy() {
    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
      this.messageHandler = null;
    }
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }

  private setupMessageListener(): void {
    this.messageHandler = (event: MessageEvent) => {
      // For security, verify the origin in production
      // if (event.origin !== "https://yourdomain.com") return;

      const { type, payload, timestamp } = event.data || {};

      if (type === "AUTH_TOKEN" && payload) {
        if (this.tokenFromParent) return;

        this.tokenFromParent = true;
        this.handleTokenReceived(payload);
      }
    };

    window.addEventListener("message", this.messageHandler);
  }

  private handleTokenReceived(token: string): void {
    try {
      // Store token in localStorage
      localStorage.setItem("authorizationToken", token);

      // Store in window object as fallback
      (window as any).authorizationToken = token;

      // Update APIConfig
      APIConfig.setAuthorizationToken(token);

      // Dispatch custom event for other components (like LoadingScreenController)
      const event = new CustomEvent("auth-token-received", {
        detail: token,
      });
      window.dispatchEvent(event);

      this.tokenReceived = true;

      // Clear retry interval
      if (this.retryInterval) {
        clearInterval(this.retryInterval);
        this.retryInterval = null;
      }

      // Send confirmation back to parent
      this.sendMessageToParent({
        type: "TOKEN_RECEIVED",
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("[TokenHandler] Error handling token:", error);
    }
  }

  private requestTokenFromParent(): void {
    // Check if we already have a token in localStorage as a temporary fallback.
    // We still request from parent since the stored token may be stale.
    const existingToken = localStorage.getItem("authorizationToken");
    if (existingToken) {
      this.handleTokenReceived(existingToken);
      // Do NOT return here — continue to request a fresh token from parent
    }

    // Tell parent we're ready to receive the token
    this.sendMessageToParent({
      type: "GAME_READY",
      timestamp: Date.now(),
    });

    // Set up periodic token request as fallback
    let retryCount = 0;

    this.retryInterval = setInterval(() => {
      if (this.tokenFromParent || retryCount >= this.MAX_RETRIES) {
        if (this.retryInterval) {
          clearInterval(this.retryInterval);
          this.retryInterval = null;
        }
        if (retryCount >= this.MAX_RETRIES && !this.tokenFromParent) {
          console.warn("[TokenHandler] No token from parent after max retries");
        }
        return;
      }

      retryCount++;

      this.sendMessageToParent({
        type: "TOKEN_REQUEST",
        timestamp: Date.now(),
      });
    }, this.RETRY_INTERVAL_MS);
  }

  private sendMessageToParent(message: any): void {
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage(message, "*");
      } catch (error) {
        console.error("[TokenHandler] Error sending message to parent:", error);
      }
    }
  }

  /**
   * Check if token has been received
   */
  public isTokenReady(): boolean {
    return this.tokenReceived;
  }

  /**
   * Get the current token
   */
  public getToken(): string | null {
    return (
      localStorage.getItem("authorizationToken") ||
      (window as any).authorizationToken ||
      null
    );
  }
}
