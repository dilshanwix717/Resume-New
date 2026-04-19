export enum BackgroundLayerType {
  FAR = "FAR",
  MID = "MID",
  NEAR = "NEAR",
}

export interface BackgroundLayerConfig {
  /** Horizontal width of one segment (same for all layers) */
  segmentWidth: number;

  /** Visual height of the sprite (used for alignment / future logic) */
  spriteHeight: number;

  /** Base Y position in world space */
  baseY: number;

  /** Parallax multiplier */
  scrollSpeed: number;
}

export const BACKGROUND_LAYERS: Record<
  BackgroundLayerType,
  BackgroundLayerConfig
> = {
  [BackgroundLayerType.FAR]: {
    segmentWidth: 1920,
    spriteHeight: 1080,
    baseY: 0,
    scrollSpeed: 0.2,
  },

  [BackgroundLayerType.MID]: {
    segmentWidth: 1920,
    spriteHeight: 1080,
    baseY: 105,
    scrollSpeed: 0.5,
  },

  [BackgroundLayerType.NEAR]: {
    segmentWidth: 1920,
    spriteHeight: 1080,
    baseY: -10,
    scrollSpeed: 1.0,
  },
};
