import * as THREE from 'three';

export type BiomeType = 'snow' | 'volcanic' | 'ocean' | 'caverns' | 'mythic_zones' | 'forest' | 'plains' | 'desert' | 'nexus';

export class WorldEngine {
    public scene: THREE.Scene;
    public sun: THREE.DirectionalLight;
    public ambientLight: THREE.AmbientLight;
    public dayNightCycleDuration: number = 600; // 10 minutes in seconds
    private startTime: number;

    constructor() {
        this.scene = new THREE.Scene();
        this.startTime = Date.now() / 1000;

        // Lights
        this.ambientLight = new THREE.AmbientLight(0x404040, 1);
        this.scene.add(this.ambientLight);

        this.sun = new THREE.DirectionalLight(0xffffff, 1);
        this.sun.position.set(50, 100, 50);
        this.sun.castShadow = true;
        this.scene.add(this.sun);

        // Initial Fog
        this.scene.fog = new THREE.FogExp2(0xcccccc, 0.002);
    }

    public update(time: number) {
        // Day/Night Cycle
        const elapsed = (time / 1000) - this.startTime;
        const cycleProgress = (elapsed % this.dayNightCycleDuration) / this.dayNightCycleDuration;
        const angle = cycleProgress * Math.PI * 2;

        this.sun.position.x = Math.cos(angle) * 200;
        this.sun.position.y = Math.sin(angle) * 200;
        
        // Intensity based on sun height
        this.sun.intensity = Math.max(0, Math.sin(angle)) * 1.5;
        this.ambientLight.intensity = 0.2 + Math.max(0, Math.sin(angle)) * 0.5;

        // Sky color
        if (this.scene.background instanceof THREE.Color) {
            const skyColor = new THREE.Color().setHSL(0.6, 0.5, 0.1 + Math.max(0, Math.sin(angle)) * 0.4);
            this.scene.background.copy(skyColor);
        }
    }

    public updateFog(biome: BiomeType) {
        const configs: Record<string, { color: number, density: number }> = {
            snow: { color: 0xffffff, density: 0.02 },
            volcanic: { color: 0x442200, density: 0.015 },
            ocean: { color: 0x004488, density: 0.01 },
            caverns: { color: 0x000000, density: 0.05 },
            mythic_zones: { color: 0x440088, density: 0.01 },
            default: { color: 0xcccccc, density: 0.002 }
        };

        const config = configs[biome] || configs.default;
        if (this.scene.fog instanceof THREE.FogExp2) {
            this.scene.fog.color.setHex(config.color);
            this.scene.fog.density = config.density;
        }
    }
}
