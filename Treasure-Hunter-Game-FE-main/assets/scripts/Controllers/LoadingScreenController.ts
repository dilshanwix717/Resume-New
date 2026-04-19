import {
  _decorator,
  Button,
  Component,
  director,
  Node,
  ProgressBar,
  tween,
  UIOpacity,
} from "cc";
import { APIConfig } from "../Config/APIConfig";
import { GameConfig } from "../Config/GameConfig";
import { NetworkService } from "../services/NetworkService";

const { ccclass, property } = _decorator;

/**
 * LoadingScreenController handles scene loading and authentication.
 * Waits for token from TokenHandler, preloads resources, then authenticates and loads game scene.
 */
@ccclass("LoadingScreenController")
export class LoadingScreenController extends Component {
  @property(ProgressBar)
  progressBar: ProgressBar | null = null;

  @property(Node)
  startButton: Node | null = null;

  private tokenReceivedHandler: ((event: CustomEvent) => void) | null = null;
  private isReadyToStart: boolean = false;
  private isResourcesLoaded: boolean = false;
  private isTokenReceived: boolean = false;
  private tokenCheckInterval: ReturnType<typeof setInterval> | null = null;
  private networkService: NetworkService = new NetworkService();
  private startTime: number = 0;
  private isAuthenticating: boolean = false;
  private loginRetryCount: number = 0;

  private readonly TARGET_SCENE: string = "main";
  private readonly FADE_DURATION: number = 0.5;
  private readonly MAX_TOKEN_WAIT_TIME: number = 15000; // 15 seconds max wait for token
  private readonly TOKEN_CHECK_INTERVAL_MS: number = 500;
  private readonly MAX_TOKEN_CHECKS: number = 30;
  private readonly MAX_LOGIN_RETRIES: number = 3;
  private readonly LOGIN_RETRY_DELAY_MS: number = 2000;
  private readonly NETWORK_ERROR_RETRY_DELAY_MS: number = 3000;

  start() {
    this.startTime = Date.now();

    // Hide start button initially
    if (this.startButton) {
      this.startButton.active = false;
    }

    // Reset progress bar
    if (this.progressBar) {
      this.progressBar.progress = 0;
    }

    // Listen for token received event from TokenHandler
    this.tokenReceivedHandler = (event: CustomEvent) => {
      const token = event.detail;
      if (token) {
        APIConfig.setAuthorizationToken(token);

        // Always update NetworkService with the latest token (parent token overrides stale localStorage token)
        this.networkService.setAuthToken(token);

        this.onTokenReceived();
      }
    };
    window.addEventListener(
      "auth-token-received",
      this.tokenReceivedHandler as EventListener,
    );

    // Start preloading resources immediately
    this.preloadResources();

    // Try to get token from storage immediately
    const hasToken = this.loadTokenFromStorage();

    if (hasToken) {
      // If we already have a token, mark as received
      this.onTokenReceived();
    } else {
      this.waitForToken();
    }
  }

  onDestroy() {
    if (this.tokenReceivedHandler) {
      window.removeEventListener(
        "auth-token-received",
        this.tokenReceivedHandler as EventListener,
      );
      this.tokenReceivedHandler = null;
    }
    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
      this.tokenCheckInterval = null;
    }
  }

  private loadTokenFromStorage(): boolean {
    // Try to get token from localStorage first
    const tokenFromStorage = localStorage.getItem("authorizationToken");
    if (tokenFromStorage) {
      APIConfig.setAuthorizationToken(tokenFromStorage);
      return true;
    }

    // Fallback to window object
    const tokenFromWindow = (window as any).authorizationToken;
    if (tokenFromWindow) {
      APIConfig.setAuthorizationToken(tokenFromWindow);
      return true;
    }

    return false;
  }

  private waitForToken(): void {
    let checkCount = 0;

    this.tokenCheckInterval = setInterval(() => {
      checkCount++;
      const elapsed = Date.now() - this.startTime;

      // Try to load token from storage
      if (this.loadTokenFromStorage()) {
        if (this.tokenCheckInterval) {
          clearInterval(this.tokenCheckInterval);
          this.tokenCheckInterval = null;
        }
        this.onTokenReceived();
        return;
      }

      // Check if we've exceeded max wait time
      if (
        elapsed > this.MAX_TOKEN_WAIT_TIME ||
        checkCount >= this.MAX_TOKEN_CHECKS
      ) {
        if (this.tokenCheckInterval) {
          clearInterval(this.tokenCheckInterval);
          this.tokenCheckInterval = null;
        }
        console.error("[LoadingScreen] Timeout waiting for token");
        this.handleTokenTimeout();
        return;
      }
    }, this.TOKEN_CHECK_INTERVAL_MS);
  }

  private onTokenReceived(): void {
    if (this.isTokenReceived) return; // Prevent duplicate calls

    this.isTokenReceived = true;

    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
      this.tokenCheckInterval = null;
    }

    this.checkIfReadyToStart();
  }

  private onResourcesLoaded(): void {
    if (this.isResourcesLoaded) return; // Prevent duplicate calls

    this.isResourcesLoaded = true;
    this.checkIfReadyToStart();
  }

  private checkIfReadyToStart(): void {
    if (this.isResourcesLoaded && this.isTokenReceived) {
      this.onLoadingComplete();
    }
  }

  private handleTokenTimeout(): void {
    console.warn("[LoadingScreen] Token timeout, proceeding without token");

    // Mark as received anyway so we can proceed
    this.isTokenReceived = true;
    this.checkIfReadyToStart();
  }

  private preloadResources(): void {
    director.preloadScene(
      this.TARGET_SCENE,
      (completedCount: number, totalCount: number, item: any) => {
        // Update progress bar
        if (this.progressBar) {
          const progress = totalCount > 0 ? completedCount / totalCount : 0;
          this.progressBar.progress = Math.min(progress, 1);
        }
      },
      (error: Error | null) => {
        if (error) {
          console.error("[LoadingScreen] Error preloading scene:", error);
          // Continue anyway
        }

        // Hide progress bar when done
        if (this.progressBar) {
          this.progressBar.node.active = false;
        }

        this.onResourcesLoaded();
      },
    );
  }

  private onLoadingComplete(): void {
    this.isReadyToStart = true;

    // Initialize NetworkService with token
    const token = APIConfig.authorizationToken;
    if (token) {
      this.networkService.init(GameConfig.API_BASE_URL, token);
    } else {
      this.networkService.init(GameConfig.API_BASE_URL);
    }

    // Show start button and attach click handler
    if (this.startButton) {
      this.startButton.active = true;

      // Attach click handler programmatically
      const button = this.startButton.getComponent(Button);
      if (button) {
        this.startButton.on(
          Button.EventType.CLICK,
          this.onStartButtonClicked,
          this,
        );
      } else {
        // Fallback: listen for touch end if no Button component
        this.startButton.on(
          Node.EventType.TOUCH_END,
          this.onStartButtonClicked,
          this,
        );
      }
    }
  }

  /**
   * Called when player clicks the start button.
   * Bind this method to the start button's click event in the editor.
   */
  public onStartButtonClicked(): void {
    if (!this.isReadyToStart) return;

    // Hide start button to prevent double clicks
    if (this.startButton) {
      this.startButton.active = false;
    }

    this.authenticateAndLoadScene();
  }

  private async authenticateAndLoadScene(): Promise<void> {
    // Prevent multiple authentication attempts
    if (this.isAuthenticating) return;

    this.isAuthenticating = true;

    // Final check for token
    if (!APIConfig.authorizationToken) {
      // Try one more time to load from storage
      if (!this.loadTokenFromStorage()) {
        console.error("[LoadingScreen] No authorization token available");
        this.isAuthenticating = false;
        // You could show an error UI here or redirect
        return;
      }

      // Re-initialize NetworkService with the newly found token
      this.networkService.init(
        GameConfig.API_BASE_URL,
        APIConfig.authorizationToken || undefined,
      );
    }

    try {
      const currentToken = APIConfig.authorizationToken;

      // Ensure NetworkService has the latest token before login
      this.networkService.setAuthToken(currentToken);

      const loginResponse = await this.networkService.postLogin();

      if (loginResponse && loginResponse.loginSuccess === true) {
        this.loginRetryCount = 0;
        this.fadeOutAndLoad();
      } else {
        this.handleLoginFailure(loginResponse);
      }
    } catch (error: any) {
      console.error("[LoadingScreen] Login error:", error);
      this.handleLoginError(error);
    }
  }

  private handleLoginFailure(response: any): void {
    console.error("[LoadingScreen] Login failed", response);
    this.isAuthenticating = false;

    // Retry logic with limit
    if (this.loginRetryCount < this.MAX_LOGIN_RETRIES) {
      this.loginRetryCount++;
      setTimeout(() => {
        this.authenticateAndLoadScene();
      }, this.LOGIN_RETRY_DELAY_MS);
    } else {
      console.error("[LoadingScreen] Max login retries exceeded");
      this.showStartButtonAfterError();
    }
  }

  private handleLoginError(error: any): void {
    console.error("[LoadingScreen] Login error:", error?.message);
    this.isAuthenticating = false;

    // Check if it's a network error
    const isNetworkError =
      error?.message?.includes("network") ||
      error?.message?.includes("fetch") ||
      error?.message?.includes("Failed to fetch") ||
      error?.name === "TypeError";

    if (isNetworkError) {
      if (this.loginRetryCount < this.MAX_LOGIN_RETRIES) {
        this.loginRetryCount++;
        setTimeout(() => {
          this.authenticateAndLoadScene();
        }, this.NETWORK_ERROR_RETRY_DELAY_MS);
      } else {
        console.error("[LoadingScreen] Max login retries exceeded");
        this.showStartButtonAfterError();
      }
    } else {
      // Still retry a few times for other errors
      if (this.loginRetryCount < this.MAX_LOGIN_RETRIES) {
        this.loginRetryCount++;
        setTimeout(() => {
          this.authenticateAndLoadScene();
        }, this.LOGIN_RETRY_DELAY_MS);
      } else {
        this.showStartButtonAfterError();
      }
    }
  }

  private fadeOutAndLoad(): void {
    // Hide progress bar and button
    if (this.progressBar) {
      this.progressBar.node.active = false;
    }
    if (this.startButton) {
      this.startButton.active = false;
    }

    // Get or add UIOpacity component for fade effect
    let uiOpacity = this.node.getComponent(UIOpacity);
    if (!uiOpacity) {
      uiOpacity = this.node.addComponent(UIOpacity);
    }

    // Fade out and load scene
    tween(uiOpacity)
      .to(this.FADE_DURATION, { opacity: 0 }, { easing: "linear" })
      .call(() => {
        director.loadScene(this.TARGET_SCENE);
      })
      .start();
  }

  private showStartButtonAfterError(): void {
    // Show start button again so player can retry
    if (this.startButton) {
      this.startButton.active = true;
    }
    this.loginRetryCount = 0;
  }
}
