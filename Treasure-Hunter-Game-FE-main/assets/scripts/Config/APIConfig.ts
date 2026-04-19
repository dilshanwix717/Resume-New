// assets/scripts/Config/APIConfig.ts

/**
 * API Configuration with token management
 * Handles authorization token storage and retrieval
 */
export class APIConfig {
  private static _authorizationToken: string | null = null;

  // API Endpoints
  static readonly ENDPOINTS = {
    LOGIN: "/auth/login",
  } as const;

  /**
   * Get the current authorization token
   */
  static get authorizationToken(): string | null {
    return this._authorizationToken;
  }

  /**
   * Set the authorization token
   * @param token JWT token string or null to clear
   */
  static setAuthorizationToken(token: string | null): void {
    this._authorizationToken = token;
  }

  /**
   * Load token from localStorage
   * @returns The token if found, null otherwise
   */
  static loadTokenFromStorage(): string | null {
    try {
      const token = localStorage.getItem("authorizationToken");
      if (token) {
        this._authorizationToken = token;
        return token;
      }
    } catch (e) {
      console.warn("[APIConfig] Failed to load token from localStorage:", e);
    }
    return null;
  }

  /**
   * Save token to localStorage
   * @param token JWT token string
   */
  static saveTokenToStorage(token: string): void {
    try {
      localStorage.setItem("authorizationToken", token);
      this._authorizationToken = token;
    } catch (e) {
      console.warn("[APIConfig] Failed to save token to localStorage:", e);
    }
  }

  /**
   * Clear the authorization token from memory and storage
   */
  static clearToken(): void {
    this._authorizationToken = null;
    try {
      localStorage.removeItem("authorizationToken");
    } catch (e) {
      console.warn("[APIConfig] Failed to clear token from localStorage:", e);
    }
  }

  /**
   * Check if a token exists
   */
  static hasToken(): boolean {
    return (
      this._authorizationToken !== null && this._authorizationToken.length > 0
    );
  }
}

// Expose APIConfig globally for TokenHandler iframe communication
if (typeof window !== "undefined") {
  (window as any).APIConfig = APIConfig;
}
