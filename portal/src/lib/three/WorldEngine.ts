import * as THREE from 'three';

export type BiomeType =
    | 'snow' | 'volcanic' | 'ocean' | 'caverns' | 'mythic_zones'
    | 'forest' | 'plains' | 'desert' | 'nexus';

export interface DayNightState {
    sunAngle: number;
    sunIntensity: number;
    ambientIntensity: number;
    skyColor: THREE.Color;
    fogColor: THREE.Color;
    fogDensity: number;
}

// Fog presets per biome
const FOG_CONFIG: Record<string, { color: number; density: number }> = {
    snow:         { color: 0xDFEEF5, density: 0.018 },
    volcanic:     { color: 0x220800, density: 0.014 },
    ocean:        { color: 0x004488, density: 0.010 },
    caverns:      { color: 0x050505, density: 0.050 },
    mythic_zones: { color: 0x1A0033, density: 0.008 },
    forest:       { color: 0x8FB88F, density: 0.006 },
    plains:       { color: 0xB8D4B8, density: 0.004 },
    desert:       { color: 0xD4B483, density: 0.006 },
    default:      { color: 0x87CEEB, density: 0.003 },
};

export class WorldEngine {
    /**
     * Duration of one full day/night cycle, in seconds.
     * Default: 10 minutes (600 s)
     */
    public dayNightCycleDuration = 600;

    private startTime: number;
    private _skyColor  = new THREE.Color();
    private _fogColor  = new THREE.Color();

    constructor() {
        this.startTime = Date.now() / 1000;
    }

    /**
     * Call this from useFrame. Returns computed lighting state so the
     * caller (SceneContent) can apply it to R3F-managed lights and fog.
     *
     * @param elapsedMs  clock.getElapsedTime() * 1000  (milliseconds)
     */
    public update(elapsedMs: number): DayNightState {
        const elapsed = elapsedMs / 1000;
        const cycleProgress = (elapsed % this.dayNightCycleDuration) / this.dayNightCycleDuration;
        const angle = cycleProgress * Math.PI * 2;

        const sinAngle  = Math.sin(angle);
        const dayFactor = Math.max(0, sinAngle);  // 0 at night, 1 at noon

        // Sky: deep blue at night → sky blue at day
        const skyL = 0.08 + dayFactor * 0.45;
        this._skyColor.setHSL(0.60, 0.55, skyL);

        // Fog: follows sky tint
        this._fogColor.setHSL(0.60, 0.30, 0.05 + dayFactor * 0.35);

        return {
            sunAngle:        angle,
            sunIntensity:    dayFactor * 1.6,
            ambientIntensity: 0.15 + dayFactor * 0.45,
            skyColor:        this._skyColor,
            fogColor:        this._fogColor,
            fogDensity:      0.003,
        };
    }

    /**
     * Returns fog parameters for a given biome.
     * Call once when a biome is set, not every frame.
     */
    public getFogForBiome(biome: BiomeType): { color: THREE.Color; density: number } {
        const cfg = FOG_CONFIG[biome] ?? FOG_CONFIG.default;
        return {
            color:   new THREE.Color(cfg.color),
            density: cfg.density,
        };
    }
}