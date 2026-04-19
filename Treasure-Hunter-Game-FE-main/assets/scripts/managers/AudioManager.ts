// assets/scripts/managers/AudioManager.ts
import { _decorator, Component, AudioSource, AudioClip, sys, Button } from "cc";
import { EventBus } from "../core/EventBus";
import { GameEvent } from "../core/GameEvents";
import { AudioConfig } from "../Config/GameConfig";

const { ccclass, property } = _decorator;

/**
 * Audio types for different sound categories
 */
export enum AudioType {
  BGM = "BGM",
  SFX = "SFX",
}

/**
 * Storage keys for persisting audio preferences
 */
const STORAGE_KEYS = {
  BGM_VOLUME: "audio_bgm_volume",
  SFX_VOLUME: "audio_sfx_volume",
  BGM_MUTED: "audio_bgm_muted",
  SFX_MUTED: "audio_sfx_muted",
};

/**
 * AudioManager - Handles all game audio including background music and sound effects.
 *
 * Features:
 * - Separate volume controls for BGM and SFX
 * - Persistent audio preferences (saved to localStorage)
 * - Event-driven sound triggering
 * - Smooth BGM transitions
 * - Button click sounds on all UI interactions
 *
 * Usage in Scene:
 * 1. Attach this component to a persistent node (e.g., Canvas or dedicated Audio node)
 * 2. Assign AudioClip assets to the exposed properties
 * 3. Sounds will automatically play based on game events
 */
@ccclass("AudioManager")
export class AudioManager extends Component {
  // ============ Audio Clips (Assign in Inspector) ============

  @property({ type: AudioClip, tooltip: "Background music clip" })
  bgmClip: AudioClip = null!;

  @property({ type: AudioClip, tooltip: "Button click sound effect" })
  buttonClickClip: AudioClip = null!;

  @property({ type: AudioClip, tooltip: "Win celebration sound effect" })
  winClip: AudioClip = null!;

  @property({ type: AudioClip, tooltip: "Treasure box opening sound effect" })
  treasureOpenClip: AudioClip = null!;

  @property({ type: AudioClip, tooltip: "Coin sound for safe tile (optional)" })
  coinClip: AudioClip = null!;

  @property({ type: AudioClip, tooltip: "Safe jump sound effect (optional)" })
  jumpSafeClip: AudioClip = null!;

  @property({ type: AudioClip, tooltip: "Trap/lose sound effect (optional)" })
  trapClip: AudioClip = null!;

  @property({ type: AudioClip, tooltip: "Bet placed sound effect (optional)" })
  betPlacedClip: AudioClip = null!;

  @property({ type: AudioClip, tooltip: "Cashout sound effect (optional)" })
  cashoutClip: AudioClip = null!;

  // ============ Audio Sources ============

  @property({ type: AudioSource, tooltip: "Audio source for background music" })
  bgmSource: AudioSource = null!;

  @property({ type: AudioSource, tooltip: "Audio source for sound effects" })
  sfxSource: AudioSource = null!;

  // ============ UI Buttons (Assign in Inspector) ============

  @property({
    type: Button,
    tooltip: "Button to mute all audio (visible when audio is playing)",
  })
  muteButton: Button = null!;

  @property({
    type: Button,
    tooltip: "Button to play/unmute audio (visible when audio is muted)",
  })
  playButton: Button = null!;

  // ============ Private State ============

  private _bgmVolume: number = AudioConfig.DEFAULT_BGM_VOLUME;
  private _sfxVolume: number = AudioConfig.DEFAULT_SFX_VOLUME;
  private _bgmMuted: boolean = false;
  private _sfxMuted: boolean = false;

  // ============ Getters/Setters ============

  get bgmVolume(): number {
    return this._bgmVolume;
  }

  set bgmVolume(value: number) {
    this._bgmVolume = Math.max(0, Math.min(1, value));
    this.updateBgmVolume();
    this.savePreferences();
  }

  get sfxVolume(): number {
    return this._sfxVolume;
  }

  set sfxVolume(value: number) {
    this._sfxVolume = Math.max(0, Math.min(1, value));
    this.savePreferences();
  }

  get bgmMuted(): boolean {
    return this._bgmMuted;
  }

  set bgmMuted(value: boolean) {
    this._bgmMuted = value;
    this.updateBgmVolume();
    this.savePreferences();
  }

  get sfxMuted(): boolean {
    return this._sfxMuted;
  }

  set sfxMuted(value: boolean) {
    this._sfxMuted = value;
    this.savePreferences();
  }

  // ============ Lifecycle ============

  onLoad() {
    console.log("[AudioManager] Initializing");

    // Validate audio sources
    if (!this.bgmSource || !this.sfxSource) {
      console.error(
        "[AudioManager] Audio sources not assigned! Please add AudioSource components.",
      );
      return;
    }

    // Load saved preferences
    this.loadPreferences();

    // Setup event listeners
    this.setupEventListeners();

    // Setup UI button listeners
    this.setupButtonListeners();

    // Start background music
    this.playBGM();

    // Update button visibility based on initial state
    this.updateButtonVisibility();
  }

  onDestroy() {
    this.stopBGM();
    // Clean up button listeners
    if (this.muteButton) {
      this.muteButton.node.off(
        Button.EventType.CLICK,
        this.onMuteButtonClicked,
        this,
      );
    }
    if (this.playButton) {
      this.playButton.node.off(
        Button.EventType.CLICK,
        this.onPlayButtonClicked,
        this,
      );
    }
    // EventBus cleanup is handled automatically
  }

  // ============ UI Button Setup ============

  private setupButtonListeners(): void {
    // Setup mute button (visible when audio is playing)
    if (this.muteButton) {
      this.muteButton.node.on(
        Button.EventType.CLICK,
        this.onMuteButtonClicked,
        this,
      );
    }

    // Setup play button (visible when audio is muted)
    if (this.playButton) {
      this.playButton.node.on(
        Button.EventType.CLICK,
        this.onPlayButtonClicked,
        this,
      );
    }
  }

  /**
   * Handle mute button click - mutes all audio
   */
  private onMuteButtonClicked(): void {
    // Play click sound before muting (so user hears feedback)
    this.playSFX(this.buttonClickClip);

    // Mute both BGM and SFX
    this._bgmMuted = true;
    this._sfxMuted = true;

    this.updateBgmVolume();
    this.savePreferences();
    this.updateButtonVisibility();

    console.log("[AudioManager] Audio muted");

    // Emit events for other components
    EventBus.emit(GameEvent.AUDIO_BGM_MUTE_CHANGED, { muted: true });
    EventBus.emit(GameEvent.AUDIO_SFX_MUTE_CHANGED, { muted: true });
  }

  /**
   * Handle play button click - unmutes all audio and resumes playback
   */
  private onPlayButtonClicked(): void {
    // Unmute both BGM and SFX
    this._bgmMuted = false;
    this._sfxMuted = false;

    this.updateBgmVolume();
    this.savePreferences();
    this.updateButtonVisibility();

    // Play click sound after unmuting (so user hears feedback)
    this.playSFX(this.buttonClickClip);

    // Resume BGM if it was paused
    this.resumeBGM();

    console.log("[AudioManager] Audio unmuted");

    // Emit events for other components
    EventBus.emit(GameEvent.AUDIO_BGM_MUTE_CHANGED, { muted: false });
    EventBus.emit(GameEvent.AUDIO_SFX_MUTE_CHANGED, { muted: false });
  }

  /**
   * Update button visibility based on mute state
   * - When playing: show mute button, hide play button
   * - When muted: show play button, hide mute button
   */
  private updateButtonVisibility(): void {
    const isMuted = this._bgmMuted && this._sfxMuted;

    if (this.muteButton) {
      this.muteButton.node.active = !isMuted;
    }

    if (this.playButton) {
      this.playButton.node.active = isMuted;
    }
  }

  // ============ Event Listeners ============

  private setupEventListeners(): void {
    // Audio control events
    EventBus.on(GameEvent.AUDIO_PLAY_SFX, this.onPlaySFX.bind(this));
    EventBus.on(GameEvent.AUDIO_PLAY_BGM, this.onPlayBGM.bind(this));
    EventBus.on(GameEvent.AUDIO_STOP_BGM, this.onStopBGM.bind(this));
    EventBus.on(GameEvent.AUDIO_SET_BGM_VOLUME, this.onSetBgmVolume.bind(this));
    EventBus.on(GameEvent.AUDIO_SET_SFX_VOLUME, this.onSetSfxVolume.bind(this));
    EventBus.on(
      GameEvent.AUDIO_TOGGLE_BGM_MUTE,
      this.onToggleBgmMute.bind(this),
    );
    EventBus.on(
      GameEvent.AUDIO_TOGGLE_SFX_MUTE,
      this.onToggleSfxMute.bind(this),
    );

    // Game events that trigger sounds
    EventBus.on(GameEvent.UI_BUTTON_CLICKED, this.onButtonClicked.bind(this));
    EventBus.on(GameEvent.ROUND_ENDED, this.onRoundEnded.bind(this));
    EventBus.on(GameEvent.JUMP_RESULT_SAFE, this.onJumpSafe.bind(this));
    EventBus.on(GameEvent.JUMP_RESULT_TRAP, this.onJumpTrap.bind(this));
    EventBus.on(GameEvent.BET_CONFIRMED, this.onBetConfirmed.bind(this));
    EventBus.on(GameEvent.CASHOUT_COMPLETE, this.onCashoutComplete.bind(this));
  }

  // ============ Event Handlers ============

  private onPlaySFX(payload: { clipName: string }): void {
    this.playSFXByName(payload.clipName);
  }

  private onPlayBGM(): void {
    this.playBGM();
  }

  private onStopBGM(): void {
    this.stopBGM();
  }

  private onSetBgmVolume(payload: { volume: number }): void {
    this.bgmVolume = payload.volume;
  }

  private onSetSfxVolume(payload: { volume: number }): void {
    this.sfxVolume = payload.volume;
  }

  private onToggleBgmMute(): void {
    this.bgmMuted = !this.bgmMuted;
    EventBus.emit(GameEvent.AUDIO_BGM_MUTE_CHANGED, { muted: this.bgmMuted });
  }

  private onToggleSfxMute(): void {
    this.sfxMuted = !this.sfxMuted;
    EventBus.emit(GameEvent.AUDIO_SFX_MUTE_CHANGED, { muted: this.sfxMuted });
  }

  private onButtonClicked(): void {
    this.playSFX(this.buttonClickClip);
  }

  private onRoundEnded(payload: { isWin: boolean; winAmount?: number }): void {
    if (payload.isWin && payload.winAmount && payload.winAmount > 0) {
      this.playSFX(this.winClip);
    }
  }

  private onJumpSafe(): void {
    // Play treasure box opening sound first
    this.playSFX(this.treasureOpenClip);
    // Then play coin sound after box opens
    this.scheduleOnce(() => {
      this.playSFX(this.coinClip);
    }, 0.7);
  }

  private onJumpTrap(): void {
    // Play treasure box opening sound first
    this.playSFX(this.treasureOpenClip);
    // Then play trap sound after box opens
    this.scheduleOnce(() => {
      this.playSFX(this.trapClip);
    }, 1.0);
  }

  private onBetConfirmed(): void {
    this.playSFX(this.betPlacedClip);
  }

  private onCashoutComplete(): void {
    this.playSFX(this.cashoutClip);
  }

  // ============ Public Methods ============

  /**
   * Play a sound effect
   * @param clip The AudioClip to play
   */
  public playSFX(clip: AudioClip): void {
    if (!clip || !this.sfxSource) {
      return;
    }

    if (this._sfxMuted) {
      return;
    }

    this.sfxSource.playOneShot(clip, this._sfxVolume);
  }

  /**
   * Play a sound effect by name
   * @param clipName Name of the clip to play
   */
  public playSFXByName(clipName: string): void {
    const clip = this.getClipByName(clipName);
    if (clip) {
      this.playSFX(clip);
    }
  }

  /**
   * Start playing background music
   */
  public playBGM(): void {
    if (!this.bgmClip || !this.bgmSource) {
      console.warn("[AudioManager] BGM clip or source not assigned");
      return;
    }

    this.bgmSource.clip = this.bgmClip;
    this.bgmSource.loop = true;
    this.updateBgmVolume();
    this.bgmSource.play();
    console.log("[AudioManager] BGM started");
  }

  /**
   * Stop background music
   */
  public stopBGM(): void {
    if (this.bgmSource) {
      this.bgmSource.stop();
    }
  }

  /**
   * Pause background music
   */
  public pauseBGM(): void {
    if (this.bgmSource) {
      this.bgmSource.pause();
    }
  }

  /**
   * Resume background music
   */
  public resumeBGM(): void {
    if (this.bgmSource && !this.bgmSource.playing) {
      this.bgmSource.play();
    }
  }

  /**
   * Get current audio state for UI
   */
  public getAudioState(): {
    bgmVolume: number;
    sfxVolume: number;
    bgmMuted: boolean;
    sfxMuted: boolean;
  } {
    return {
      bgmVolume: this._bgmVolume,
      sfxVolume: this._sfxVolume,
      bgmMuted: this._bgmMuted,
      sfxMuted: this._sfxMuted,
    };
  }

  // ============ Private Helpers ============

  private getClipByName(clipName: string): AudioClip | null {
    switch (clipName) {
      case "buttonClick":
        return this.buttonClickClip;
      case "win":
        return this.winClip;
      case "treasureOpen":
        return this.treasureOpenClip;
      case "coin":
        return this.coinClip;
      case "jumpSafe":
        return this.jumpSafeClip;
      case "trap":
        return this.trapClip;
      case "betPlaced":
        return this.betPlacedClip;
      case "cashout":
        return this.cashoutClip;
      default:
        console.warn(`[AudioManager] Unknown clip name: ${clipName}`);
        return null;
    }
  }

  private updateBgmVolume(): void {
    if (this.bgmSource) {
      this.bgmSource.volume = this._bgmMuted ? 0 : this._bgmVolume;
    }
  }

  private loadPreferences(): void {
    try {
      // Volumes always come from AudioConfig (single source of truth)
      this._bgmVolume = AudioConfig.DEFAULT_BGM_VOLUME;
      this._sfxVolume = AudioConfig.DEFAULT_SFX_VOLUME;

      // Only mute states are persisted
      const bgmMuted = sys.localStorage.getItem(STORAGE_KEYS.BGM_MUTED);
      const sfxMuted = sys.localStorage.getItem(STORAGE_KEYS.SFX_MUTED);

      if (bgmMuted !== null) {
        this._bgmMuted = bgmMuted === "true";
      }
      if (sfxMuted !== null) {
        this._sfxMuted = sfxMuted === "true";
      }

      console.log("[AudioManager] Preferences loaded", {
        bgmVolume: this._bgmVolume,
        sfxVolume: this._sfxVolume,
        bgmMuted: this._bgmMuted,
        sfxMuted: this._sfxMuted,
      });
    } catch (e) {
      console.warn("[AudioManager] Could not load preferences:", e);
    }
  }

  private savePreferences(): void {
    try {
      sys.localStorage.setItem(
        STORAGE_KEYS.BGM_VOLUME,
        this._bgmVolume.toString(),
      );
      sys.localStorage.setItem(
        STORAGE_KEYS.SFX_VOLUME,
        this._sfxVolume.toString(),
      );
      sys.localStorage.setItem(
        STORAGE_KEYS.BGM_MUTED,
        this._bgmMuted.toString(),
      );
      sys.localStorage.setItem(
        STORAGE_KEYS.SFX_MUTED,
        this._sfxMuted.toString(),
      );
    } catch (e) {
      console.warn("[AudioManager] Could not save preferences:", e);
    }
  }
}
