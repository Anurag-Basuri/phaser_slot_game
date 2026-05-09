/**
 * Stake Engine RGS Client
 * Handles all communication with the Stake Engine Remote Gaming Server.
 *
 * API Endpoints (per official SDK docs):
 *   /wallet/authenticate - Validates player session (must be called first)
 *   /wallet/play         - Initiates a bet/round, returns game outcome
 *   /wallet/balance      - Gets current player balance
 *   /wallet/end-round    - Completes a round after animations finish
 *   /bet/event           - Saves animation progress for disconnect recovery
 *
 * Monetary values use 6-decimal integer precision: $1.00 = 1_000_000
 */

// ── Auth Response ──
// Matches the SDK's /wallet/authenticate response exactly
export interface StakeAuthResponse {
  balance: { amount: number; currency: string };
  config: {
    minBet: number;
    maxBet: number;
    stepBet: number;
    defaultBetLevel: number;
    betLevels: number[];
    jurisdiction?: {
      socialCasino?: boolean;
      disabledFullscreen?: boolean;
      disabledTurbo?: boolean;
      [key: string]: any;
    };
  };
  round?: StakeRound;
}

// ── Round structure ──
// The round returned from /wallet/play or /wallet/authenticate
export interface StakeRound {
  betID: number;
  amount: number;
  active: boolean;
  event?: string; // Last saved event index for disconnect recovery
  state: RGSEvent[];
}

// ── Play Response ──
// Matches the SDK's /wallet/play response exactly
export interface StakePlayResponse {
  balance: { amount: number; currency: string };
  round: StakeRound;
}

// ── RGS Event Types ──
// These match the event types emitted by our math engine's events.py
// The RGS returns the `events` array directly as `round.state`
export interface RGSEvent {
  index: number;
  type: string;
  [key: string]: any;
}

// Specific event data shapes for type safety
export interface RevealEventData extends RGSEvent {
  type: 'reveal';
  board: SymbolCell[][];
  paddingPositions: any[];
  gameType: string;
  anticipation: number[];
}

export interface WinInfoEventData extends RGSEvent {
  type: 'winInfo';
  totalWin: number;
  wins: ClusterWin[];
}

export interface ClusterWin {
  symbol: string;
  kind: number;
  win: number;
  positions: { reel: number; row: number }[];
  meta: { multiplier?: number; [key: string]: any };
}

export interface SetTotalWinEventData extends RGSEvent {
  type: 'setTotalWin';
  amount: number;
}

export interface FSTriggerEventData extends RGSEvent {
  type: 'fsTrigger';
  totalSpins: number;
  scatterCount: number;
  triggerType: 'basegame' | 'retrigger';
}

export interface TumbleBoardEventData extends RGSEvent {
  type: 'tumbleBoard';
  board: SymbolCell[][];
}

export interface MultiplierUpdateEventData extends RGSEvent {
  type: 'multiplierUpdate';
  grid: number[][];
}

export interface FinalWinEventData extends RGSEvent {
  type: 'finalWin';
  amount: number;
}

export interface SymbolCell {
  symbol: string;
  id: number;
  reel: number;
  row: number;
}

// Legacy aliases for backward compatibility with Game.tsx
export type GameEvent = RGSEvent;
export interface SpinEventData {
  grid: number[][];
}

export interface URLParams {
  sessionID: string;
  lang: string;
  device: string;
  rgs_url: string;
}

/**
 * Strongly typed error class for Stake API failures.
 * Allows the Game scene to distinguish between recoverable
 * network/timeout errors and unrecoverable server rejections.
 */
export type StakeErrorCode = 'TIMEOUT' | 'NETWORK' | 'SERVER' | 'AUTH' | 'REJECTED' | 'UNKNOWN';

export class StakeError extends Error {
  public readonly code: StakeErrorCode;
  public readonly httpStatus?: number;
  public readonly retryable: boolean;

  constructor(code: StakeErrorCode, message: string, httpStatus?: number) {
    super(message);
    this.name = 'StakeError';
    this.code = code;
    this.httpStatus = httpStatus;
    // Timeouts and transient server errors are retryable; auth/rejected are not
    this.retryable = code === 'TIMEOUT' || code === 'NETWORK' || code === 'SERVER';
  }
}

const PRECISION = 1_000_000; // 6 decimal places

export class StakeEngineClient {
  private rgsUrl: string = '';
  private sessionID: string = '';
  private lang: string = 'en';
  private device: string = 'desktop';
  private currency: string = 'USD';
  private authenticated: boolean = false;
  private currentRoundActive: boolean = false;
  private isDemo: boolean = false;
  private _isReplay: boolean = false;
  private _isSocial: boolean = false;
  private _demoBalance: number = 100_000;

  // Cached auth config for bet limits
  private _authConfig: StakeAuthResponse['config'] | null = null;

  private replayData: any = null;

  constructor() {
    this.parseURLParams();
  }

  /** Parse URL parameters provided by the Stake game launcher */
  private parseURLParams(): void {
    // 1. Detect environment flags
    const params = new URLSearchParams(window.location.search);
    this._isReplay = params.get('replay') === 'true';
    this._isSocial = params.get('social') === 'true';

    // 2. Setup internal RGS pointer / Authentication routing
    this.sessionID = params.get('sessionID') || params.get('session_id') || '';
    this.lang = params.get('lang') || 'en';
    this.device = params.get('device') || 'desktop';
    this.currency = params.get('currency') || 'USD';
    let rawRgs = params.get('rgs_url') || '';
    rawRgs = rawRgs.replace(/\/+$/, ''); // Strip trailing slashes
    if (rawRgs && !rawRgs.startsWith('http')) {
      rawRgs = 'https://' + rawRgs;
    }
    this.rgsUrl = rawRgs;

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

  public isReplayMode(): boolean {
    return this._isReplay;
  }

  public isSocialMode(): boolean {
    return this._isSocial;
  }

  /**
   * Fetch static replay data from the Stake RGS endpoint if running in Replay Mode.
   */
  public async fetchReplay(): Promise<any> {
    if (!this._isReplay) throw new Error('Not running in replay mode.');
    
    const params = new URLSearchParams(window.location.search);
    const game = params.get('game');
    const version = params.get('version');
    const mode = params.get('mode');
    const event = params.get('event');
    const rgsUrl = params.get('rgs_url');

    try {
      const response = await fetch(`${rgsUrl}/bet/replay/${game}/${version}/${mode}/${event}`);
      if (!response.ok) throw new Error('Failed to fetch replay data');

      const data = await response.json();
      this.replayData = data;
      return data;
    } catch (error) {
      console.error('[StakeEngine] Replay fetch failed:', error);
      throw error;
    }
  }

  /** Get the language code */
  public getLanguage(): string {
    return this.lang;
  }

  /** Get the device type */
  public getDevice(): string {
    return this.device;
  }

  /** Get cached auth config (bet limits, jurisdiction) */
  public getAuthConfig(): StakeAuthResponse['config'] | null {
    return this._authConfig;
  }

  /** Convert from Stake integer precision to display amount */
  public static toDisplayAmount(stakeAmount: number): number {
    return stakeAmount / PRECISION;
  }

  /** Convert from display amount to Stake integer precision */
  public static toStakeAmount(displayAmount: number): number {
    return Math.round(displayAmount * PRECISION);
  }

  /**
   * Wrapper for fetch with retry + timeout.
   * Retries up to `retries` times on transient 5xx/429 errors.
   * Throws StakeError with a typed code on final failure.
   */
  private async fetchWithRetry(url: string, options: RequestInit, retries: number = 3): Promise<Response> {
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) return response;

        // Non-retryable client errors (4xx except 429)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          // Parse RGS error codes: ERR_IS, ERR_ATE, ERR_IPB, etc.
          const body = await response.json().catch(() => ({}));
          const code = body?.code || body?.status || '';

          if (code === 'ERR_IS' || code === 'ERR_ATE' || response.status === 401 || response.status === 403) {
            throw new StakeError('AUTH', `Authentication error: ${code}`, response.status);
          }
          if (code === 'ERR_IPB') {
            throw new StakeError('REJECTED', `Insufficient balance`, response.status);
          }
          throw new StakeError('REJECTED', `Request rejected: ${code || response.status}`, response.status);
        }

        // Retryable server errors (5xx, 429)
        lastError = new StakeError('SERVER', `Server error (${response.status})`, response.status);
      } catch (err: any) {
        clearTimeout(timeoutId);

        // If it's already a StakeError (AUTH/REJECTED), don't retry
        if (err instanceof StakeError && !err.retryable) throw err;

        if (err?.name === 'AbortError') {
          console.warn(`[StakeEngine] Timeout (attempt ${i + 1}/${retries})`);
          lastError = new StakeError('TIMEOUT', `Request timed out (attempt ${i + 1})`);
        } else if (err instanceof StakeError) {
          lastError = err;
        } else {
          lastError = new StakeError('NETWORK', err?.message || 'Network error');
        }
      }

      if (i < retries - 1) {
        await new Promise((res) => setTimeout(res, 500 + i * 1000));
      }
    }

    throw lastError || new StakeError('UNKNOWN', 'Connection failed after multiple retries.');
  }

  /**
   * Authenticate the player session. Must be called before any other API call.
   * Returns the player's balance, config (bet limits), and any pending round.
   *
   * SDK spec: POST /wallet/authenticate { sessionID }
   * Response: { balance, config: { minBet, maxBet, stepBet, betLevels, jurisdiction }, round }
   */
  public async authenticate(): Promise<StakeAuthResponse> {
    if (this._isReplay) {
      // Replay mode bypasses Authentication entirely. It requires no session token.
      return {
        balance: { amount: 0, currency: 'USD' },
        config: { minBet: 100000, maxBet: 1000000000, stepBet: 100000, defaultBetLevel: 1000000, betLevels: [] },
      };
    }

    if (this.isDemo) {
      return {
        balance: { amount: 100_000 * PRECISION, currency: 'USD' },
        config: { minBet: 100000, maxBet: 1000000000, stepBet: 100000, defaultBetLevel: 1000000, betLevels: [] },
      };
    }

    try {
      const response = await this.fetchWithRetry(`${this.rgsUrl}/wallet/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionID: this.sessionID,
          language: this.lang,
        }),
      });

      const data = await response.json();
      this.authenticated = true;

      // Cache currency from auth response if available
      if (data.balance?.currency) {
        this.currency = data.balance.currency;
      }

      // Cache the config for bet validation
      this._authConfig = data.config || null;

      // Check jurisdiction for social casino mode
      if (data.config?.jurisdiction?.socialCasino) {
        this._isSocial = true;
      }

      return {
        balance: data.balance || { amount: 0, currency: 'USD' },
        config: data.config || { minBet: 100000, maxBet: 1000000000, stepBet: 100000, defaultBetLevel: 1000000, betLevels: [] },
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
   *
   * SDK spec: POST /wallet/play { sessionID, amount, mode }
   * Response: { balance, round: { betID, amount, active, state: [...events] } }
   *
   * The `mode` field maps to bet mode names from our math config:
   *   "base" (normal), "ante", "bonus" (buy FS), "super" (buy super FS)
   */
  public async play(
    betAmount: number,
    featureType: number = 0,
  ): Promise<StakePlayResponse> {
    if (this._isReplay) {
      throw new Error('Cannot execute real bets inside view-only replay mode');
    }

    if (this.isDemo) {
      return this.generateDemoOutcome(betAmount, featureType);
    }

    if (!this.authenticated) {
      throw new Error('Must authenticate before playing');
    }

    // Map feature type to SDK mode name
    const modeMap: Record<number, string> = {
      0: 'base',
      1: 'bonus',
      2: 'super',
    };
    const mode = modeMap[featureType] || 'base';

    try {
      const response = await this.fetchWithRetry(`${this.rgsUrl}/wallet/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionID: this.sessionID,
          amount: StakeEngineClient.toStakeAmount(betAmount),
          mode: mode, // Must match math engine bet mode names exactly (lowercase)
          currency: this.currency,
        }),
      });

      const data = await response.json();
      this.currentRoundActive = data.round?.active ?? false;

      return data as StakePlayResponse;
    } catch (error) {
      console.error('[StakeEngine] Play error:', error);
      throw error;
    }
  }

  /**
   * Get the current player balance.
   *
   * SDK spec: POST /wallet/balance { sessionID }
   * Response: { balance: { amount, currency } }
   */
  public async getBalance(): Promise<{ amount: number; currency: string }> {
    if (this.isDemo) {
      return { amount: 100_000 * PRECISION, currency: 'USD' };
    }

    try {
      const response = await this.fetchWithRetry(`${this.rgsUrl}/wallet/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionID: this.sessionID }),
      });

      if (!response.ok) throw new Error('Balance fetch failed');

      const data = await response.json();
      return data.balance || data;
    } catch (error) {
      console.error('[StakeEngine] Balance error:', error);
      throw error;
    }
  }

  /**
   * End the current round. Must be called after all animations complete.
   *
   * SDK spec: POST /wallet/end-round { sessionID }
   * Response: { balance }
   *
   * NOTE: The SDK only requires sessionID — NOT roundId.
   * The server knows which round is active for this session.
   */
  public async endRound(): Promise<{ balance?: { amount: number; currency: string } }> {
    if (this.isDemo || !this.currentRoundActive) return {};

    try {
      const response = await this.fetchWithRetry(`${this.rgsUrl}/wallet/end-round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionID: this.sessionID,
        }),
      });

      this.currentRoundActive = false;
      const data = await response.json().catch(() => ({}));
      return data;
    } catch (error) {
      console.error('[StakeEngine] End round error:', error);
      // endRound failures are non-critical — the server will auto-close stale rounds
      return {};
    }
  }

  /**
   * Save animation progress event for disconnect recovery.
   *
   * SDK spec: POST /bet/event { sessionID, event }
   * Response: { event }
   *
   * Call this after processing each event in round.state so the player
   * can resume from the correct animation point on reconnect.
   */
  public async saveEvent(eventIndex: string): Promise<void> {
    if (this.isDemo || !this.currentRoundActive) return;

    try {
      await this.fetchWithRetry(`${this.rgsUrl}/bet/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionID: this.sessionID,
          event: eventIndex,
        }),
      }, 1); // Only 1 attempt — non-critical
    } catch (error) {
      // Non-critical — best effort save
      console.warn('[StakeEngine] Event save failed:', error);
    }
  }

  /**
   * Resync: Re-authenticate to fetch the authoritative wallet balance.
   * Used after a network failure to recover the true state instead of
   * trusting local refund math.
   *
   * Returns the display-amount balance, or throws StakeError on failure.
   */
  public async resync(): Promise<{ balance: number; currency: string; pendingRound?: StakeRound }> {
    if (this.isDemo) {
      // In demo mode, resync returns the starting balance (stateless)
      return { balance: 100_000, currency: 'USD' };
    }

    try {
      const auth = await this.authenticate();
      return {
        balance: StakeEngineClient.toDisplayAmount(auth.balance.amount),
        currency: auth.balance.currency,
        pendingRound: auth.round || undefined,
      };
    } catch (err) {
      console.error('[StakeEngine] Resync failed:', err);
      throw err;
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
    const symbolWeights = [18, 16, 15, 14, 13, 12, 9, 3];
    const totalWeight = symbolWeights.reduce((a, b) => a + b, 0);
    const symbolNames = ['L3', 'L2', 'L1', 'H4', 'H3', 'H2', 'H1', 'S'];

    const pickSymbol = (): number => {
      let roll = Math.random() * totalWeight;
      for (let i = 0; i < symbolWeights.length; i++) {
        roll -= symbolWeights[i];
        if (roll <= 0) return i;
      }
      return symbolWeights.length - 1;
    };

    // Generate random board
    const board: any[][] = [];
    for (let r = 0; r < gridSize; r++) {
      board[r] = [];
      for (let c = 0; c < gridSize; c++) {
        const id = pickSymbol();
        board[r][c] = { symbol: symbolNames[id], id: id, reel: c, row: r };
      }
    }

    // Force a cluster of 5 randomly to guarantee some action
    if (Math.random() < 0.8) {
      const startR = Math.floor(Math.random() * 5) + 1;
      const startC = Math.floor(Math.random() * 5) + 1;
      const clusterSymId = Math.floor(Math.random() * 6);
      board[startR][startC] = { symbol: symbolNames[clusterSymId], id: clusterSymId, reel: startC, row: startR };
      board[startR+1][startC] = { symbol: symbolNames[clusterSymId], id: clusterSymId, reel: startC, row: startR+1 };
      board[startR-1][startC] = { symbol: symbolNames[clusterSymId], id: clusterSymId, reel: startC, row: startR-1 };
      board[startR][startC+1] = { symbol: symbolNames[clusterSymId], id: clusterSymId, reel: startC+1, row: startR };
      board[startR][startC-1] = { symbol: symbolNames[clusterSymId], id: clusterSymId, reel: startC-1, row: startR };
    }

    // If a feature was bought, inject 3 to 4 scatters to trigger Free Spins
    if (featureType > 0) {
      const numScatters = Math.floor(Math.random() * 2) + 3; // 3 or 4 scatters
      let placed = 0;
      while (placed < numScatters) {
        const r = Math.floor(Math.random() * gridSize);
        const c = Math.floor(Math.random() * gridSize);
        if (board[r][c].id !== 7) {
          board[r][c] = { symbol: 'S', id: 7, reel: c, row: r };
          placed++;
        }
      }
    }

    // Calculate a simple demo balance
    const currentBalance = this._demoBalance !== undefined
      ? this._demoBalance - betAmount
      : 100_000 - betAmount;
    this._demoBalance = Math.max(0, currentBalance);

    return {
      balance: {
        amount: StakeEngineClient.toStakeAmount(this._demoBalance),
        currency: 'USD'
      },
      round: {
        betID: Date.now(),
        amount: StakeEngineClient.toStakeAmount(betAmount),
        active: false,
        state: [{
          index: 0,
          type: 'reveal',
          board: board,
          paddingPositions: [],
          gameType: featureType > 0 ? 'freespins' : 'basegame',
          anticipation: [0, 0, 0, 0, 0, 0, 0],
        } as any]
      }
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
