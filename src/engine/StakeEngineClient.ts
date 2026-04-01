/**
 * Stake Engine RGS Client
 * Handles all communication with the Stake Engine Remote Gaming Server.
 *
 * API Endpoints:
 *   /wallet/authenticate - Validates player session (must be called first)
 *   /wallet/play         - Initiates a bet/round, returns game outcome
 *   /wallet/balance      - Gets current player balance
 *   /wallet/end-round    - Completes a round after animations finish
 *
 * Monetary values use 6-decimal integer precision: $1.00 = 1_000_000
 */

export interface StakeAuthResponse {
  balance: number; // Integer with 6 decimal precision
  currency: string; // e.g. "USD", "BTC"
  round?: {
    event: string; // Resume state for disconnect recovery
    roundId: string;
  };
}

export interface StakePlayResponse {
  roundId: string;
  balance: number;
  payout: number; // Total payout in integer precision
  events: GameEvent[]; // Ordered list of game events to animate
  multiplier: number; // Final outcome multiplier
}

export interface GameEvent {
  type:
    | 'spin'
    | 'cascade'
    | 'cluster_win'
    | 'scatter_trigger'
    | 'free_spin'
    | 'multiplier_advance'
    | 'round_end';
  data:
    | SpinEventData
    | ClusterWinData
    | ScatterData
    | FreeSpinData
    | MultiplierData
    | RoundEndData;
}

export interface SpinEventData {
  grid: number[][]; // 7x7 grid of symbol IDs
}

export interface ClusterWinData {
  symbolId: number;
  positions: { row: number; col: number }[];
  payout: number;
  clusterSize: number;
}

export interface ScatterData {
  positions: { row: number; col: number }[];
  freeSpinsAwarded: number;
}

export interface FreeSpinData {
  spinNumber: number;
  totalSpins: number;
  grid: number[][];
}

export interface MultiplierData {
  positions: { row: number; col: number; multiplier: number }[];
}

export interface RoundEndData {
  totalWin: number;
  balance: number;
}

export interface URLParams {
  sessionID: string;
  lang: string;
  device: string;
  rgs_url: string;
}

const PRECISION = 1_000_000; // 6 decimal places

export class StakeEngineClient {
  private rgsUrl: string = '';
  private sessionID: string = '';
  private lang: string = 'en';
  private device: string = 'desktop';
  private authenticated: boolean = false;
  private currentRoundId: string | null = null;
  private isDemo: boolean = false;

  constructor() {
    this.parseURLParams();
  }

  /** Parse URL parameters provided by the Stake game launcher */
  private parseURLParams(): void {
    const params = new URLSearchParams(window.location.search);
    this.sessionID = params.get('sessionID') || params.get('session_id') || '';
    this.lang = params.get('lang') || 'en';
    this.device = params.get('device') || 'desktop';
    this.rgsUrl = params.get('rgs_url') || '';

    // If no params found, run in demo/offline mode
    if (!this.sessionID || !this.rgsUrl) {
      console.warn(
        '[StakeEngine] No session/RGS URL found — running in DEMO mode',
      );
      this.isDemo = true;
    }
  }

  /** Check if running in demo mode (no Stake connection) */
  public isDemoMode(): boolean {
    return this.isDemo;
  }

  /** Get the language code */
  public getLanguage(): string {
    return this.lang;
  }

  /** Get the device type */
  public getDevice(): string {
    return this.device;
  }

  /** Convert from Stake integer precision to display amount */
  public static toDisplayAmount(stakeAmount: number): number {
    return stakeAmount / PRECISION;
  }

  /** Convert from display amount to Stake integer precision */
  public static toStakeAmount(displayAmount: number): number {
    return Math.round(displayAmount * PRECISION);
  }

  /** Wrapper for fetch with retry + timeout. Retries 3× on transient 5xx/429 errors. */
  private async fetchWithRetry(url: string, options: RequestInit, retries: number = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      // AbortController with 15s timeout — prevents infinite hang on TCP stall
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);

        // Retry on 5xx server errors or 429 rate limits, but NOT other 4xx client errors
        if (!response.ok && (response.status >= 500 || response.status === 429)) {
          throw new Error(`Server returned ${response.status}`);
        }
        return response; // Return on success or non-retryable 4xx errors
      } catch (err: any) {
        clearTimeout(timeoutId);

        // Distinguish timeout vs other errors for better logging
        if (err?.name === 'AbortError') {
          console.warn(`[StakeEngine] Request timeout (attempt ${i + 1}/${retries})`);
        }

        if (i === retries - 1) throw err; // Throw on final attempt
        // Exponential backoff: 500ms, 1500ms, 3500ms
        await new Promise((res) => setTimeout(res, 500 + i * 1000));
      }
    }
    throw new Error('Connection failed after multiple retries.');
  }

  /**
   * Authenticate the player session. Must be called before any other API call.
   * Returns the player's balance and any pending round state for recovery.
   */
  public async authenticate(): Promise<StakeAuthResponse> {
    if (this.isDemo) {
      return {
        balance: 100_000 * PRECISION, // $100,000 demo balance
        currency: 'USD',
      };
    }

    try {
      const response = await this.fetchWithRetry(`${this.rgsUrl}/wallet/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionID: this.sessionID }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          `Authentication failed: ${error.code || response.status}`,
        );
      }

      const data = await response.json();
      this.authenticated = true;

      return {
        balance: data.balance,
        currency: data.currency || 'USD',
        round: data.round || undefined,
      };
    } catch (error) {
      console.error('[StakeEngine] Authentication error:', error);
      throw error;
    }
  }

  /**
   * Execute a game round (spin). Returns the complete outcome including
   * all cascades, cluster wins, and free spins pre-determined by the RGS.
   */
  public async play(
    betAmount: number,
    featureType: number = 0,
  ): Promise<StakePlayResponse> {
    if (this.isDemo) {
      return this.generateDemoOutcome(betAmount, featureType);
    }

    if (!this.authenticated) {
      throw new Error('Must authenticate before playing');
    }

    try {
      const response = await this.fetchWithRetry(`${this.rgsUrl}/wallet/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionID: this.sessionID,
          amount: StakeEngineClient.toStakeAmount(betAmount),
          feature: featureType, // 0 = normal, 1 = buy FS, 2 = buy super FS
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Play failed: ${error.code || response.status}`);
      }

      const data = await response.json();
      this.currentRoundId = data.roundId;

      return data as StakePlayResponse;
    } catch (error) {
      console.error('[StakeEngine] Play error:', error);
      throw error;
    }
  }

  /**
   * Get the current player balance.
   */
  public async getBalance(): Promise<number> {
    if (this.isDemo) {
      return 100_000 * PRECISION;
    }

    try {
      const response = await this.fetchWithRetry(`${this.rgsUrl}/wallet/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionID: this.sessionID }),
      });

      if (!response.ok) throw new Error('Balance fetch failed');

      const data = await response.json();
      return data.balance;
    } catch (error) {
      console.error('[StakeEngine] Balance error:', error);
      throw error;
    }
  }

  /**
   * End the current round. Must be called after all animations complete.
   */
  public async endRound(): Promise<void> {
    if (this.isDemo || !this.currentRoundId) return;

    try {
      await this.fetchWithRetry(`${this.rgsUrl}/wallet/end-round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionID: this.sessionID,
          roundId: this.currentRoundId,
        }),
      });

      this.currentRoundId = null;
    } catch (error) {
      console.error('[StakeEngine] End round error:', error);
    }
  }

  /**
   * Demo mode: generates a local random outcome for testing.
   * In production, outcomes come from the RGS (pre-generated by Math SDK).
   */
  private generateDemoOutcome(
    betAmount: number,
    featureType: number,
  ): StakePlayResponse {
    const gridSize = 7;
    const symbolWeights = [18, 17, 16, 14, 13, 12, 10];
    const totalWeight = symbolWeights.reduce((a, b) => a + b, 0);

    const pickSymbol = (): number => {
      if (Math.random() < 0.02) return 7; // scatter
      let roll = Math.random() * totalWeight;
      for (let i = 0; i < symbolWeights.length; i++) {
        roll -= symbolWeights[i];
        if (roll <= 0) return i;
      }
      return symbolWeights.length - 1;
    };

    const grid: number[][] = [];
    for (let r = 0; r < gridSize; r++) {
      grid[r] = [];
      for (let c = 0; c < gridSize; c++) {
        grid[r][c] = pickSymbol();
      }
    }

    return {
      roundId: `demo_${Date.now()}`,
      balance: StakeEngineClient.toStakeAmount(100_000),
      payout: 0,
      events: [{ type: 'spin', data: { grid } as SpinEventData }],
      multiplier: 1,
    };
  }
}

/** Singleton instance */
let _instance: StakeEngineClient | null = null;

export function getStakeEngine(): StakeEngineClient {
  if (!_instance) {
    _instance = new StakeEngineClient();
  }
  return _instance;
}
