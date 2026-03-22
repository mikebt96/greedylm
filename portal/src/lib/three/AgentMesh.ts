import * as THREE from 'three';

interface AgentData {
    name?:          string;
    color_primary?: number;
    race?:          string;
    [key: string]: unknown;
}

// Emotion → color mapping
const EMOTION_COLORS: Record<string, number> = {
    curiosity:     0x00E5FF,
    trust:         0x00E676,
    joy:           0xFFEA00,
    anticipation:  0xFF9100,
    fear:          0xE040FB,
    anger:         0xFF1744,
    sadness:       0x448AFF,
    awe:           0xFFFFFF,
};
const EMOTIONS = Object.keys(EMOTION_COLORS);

// Race → accent color
const RACE_COLORS: Record<string, number> = {
    elf:    0xA5D6A7,
    mage:   0x7C4DFF,
    nomad:  0xFFCC02,
    beast:  0xFF6D00,
    specter:0xB2EBF2,
};

/**
 * AgentMesh — The visual representation of an AI agent in the world.
 * Now supports smooth rotation, nameplates via billboard (handled in React),
 * and physics-ready properties like velY.
 */
export class AgentMesh {
    public mesh:         THREE.Group;       // Outer container (handles world POS)
    public visualGroup:  THREE.Group;       // Inner container (handles bobbing/rotation)
    public emotionalOrb: THREE.Mesh;
    public name:         string;
    public velY:         number = 0;        // Vertical velocity for gravity polish
    
    private _orbLight:   THREE.PointLight;
    private _idleOffset: number;            // phase offset so agents don't bob in sync
    private _targetRotY: number = 0;

    constructor(data: AgentData) {
        this.mesh = new THREE.Group();
        this.visualGroup = new THREE.Group();
        this.mesh.add(this.visualGroup);

        this.name = data.name || 'Agent';
        this._idleOffset = Math.random() * Math.PI * 2;

        const primaryHex  = data.color_primary ?? 0x78909C;
        const accentHex   = RACE_COLORS[data.race ?? ''] ?? 0xB0BEC5;

        const bodyMat = new THREE.MeshPhongMaterial({
            color:       primaryHex,
            flatShading: true,
            shininess:   20,
        });
        const accentMat = new THREE.MeshPhongMaterial({
            color:       accentHex,
            flatShading: true,
            shininess:   40,
        });

        // ── Body ─────────────────────────────────────────────────────────────
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.28, 0.38, 1.1, 6),
            bodyMat
        );
        body.position.y = 0.55;
        body.castShadow = true;

        // ── Head ─────────────────────────────────────────────────────────────
        const head = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.33, 0),
            bodyMat
        );
        head.position.y = 1.35;
        head.castShadow = true;

        // ── Shoulders ────────────────────────────────────────────────────────
        const shoulderGeo = new THREE.SphereGeometry(0.18, 4, 3);
        const shoulderL = new THREE.Mesh(shoulderGeo, accentMat);
        shoulderL.position.set(-0.32, 0.9, 0);
        shoulderL.castShadow = true;

        const shoulderR = shoulderL.clone();
        shoulderR.position.x = 0.32;

        this.visualGroup.add(body, head, shoulderL, shoulderR);

        // ── Race accessories ─────────────────────────────────────────────────
        this._addRaceAccessories(data.race, accentMat);

        // ── Emotional Orb ────────────────────────────────────────────────────
        const orbMat = new THREE.MeshStandardMaterial({
            color:             0xFFFFFF,
            emissive:          0xFFFFFF,
            emissiveIntensity: 1.2,
            roughness:         0.1,
            metalness:         0.0,
        });
        this.emotionalOrb = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8), orbMat);
        this.emotionalOrb.position.y = 1.95;

        this._orbLight = new THREE.PointLight(0xFFFFFF, 0.6, 2.5);
        this._orbLight.position.copy(this.emotionalOrb.position);

        this.visualGroup.add(this.emotionalOrb, this._orbLight);
    }

    private _addRaceAccessories(race: string | undefined, accentMat: THREE.Material) {
        if (!race) return;
        if (race === 'elf') {
            const earGeo = new THREE.ConeGeometry(0.06, 0.22, 4);
            const ear1 = new THREE.Mesh(earGeo, accentMat);
            ear1.position.set(0.34, 1.45, 0);
            ear1.rotation.z = -Math.PI / 3.5;
            const ear2 = ear1.clone();
            ear2.position.x = -0.34;
            ear2.rotation.z =  Math.PI / 3.5;
            this.visualGroup.add(ear1, ear2);
        }
        if (race === 'mage') {
            const hat = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.65, 5), accentMat);
            hat.position.y = 1.78;
            const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 8), accentMat);
            brim.position.y = 1.47;
            this.visualGroup.add(hat, brim);
        }
        if (race === 'beast') {
            const hornGeo = new THREE.ConeGeometry(0.06, 0.35, 4);
            const horn1 = new THREE.Mesh(hornGeo, accentMat);
            horn1.position.set( 0.2, 1.62, 0);
            horn1.rotation.z = -0.3;
            const horn2 = horn1.clone();
            horn2.position.x = -0.2;
            horn2.rotation.z =  0.3;
            this.visualGroup.add(horn1, horn2);
        }
        if (race === 'specter') {
            const auraMat = new THREE.MeshBasicMaterial({ color: 0xB2EBF2, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
            const aura = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 6, 16), auraMat);
            aura.position.y = 1.1;
            aura.rotation.x = Math.PI / 2;
            this.visualGroup.add(aura);
        }
    }

    public updateEmotion(esv: number[]) {
        if (!esv || esv.length < EMOTIONS.length) return;
        const dominantIdx = esv.indexOf(Math.max(...esv));
        const hex = EMOTION_COLORS[EMOTIONS[dominantIdx]] ?? 0xFFFFFF;
        const mat = this.emotionalOrb.material as THREE.MeshStandardMaterial;
        mat.color.setHex(hex);
        mat.emissive.setHex(hex);
        this._orbLight.color.setHex(hex);
    }

    /**
     * Updates rotation toward a specific world coordinate.
     */
    public setLookTarget(wx: number, wz: number) {
        const dx = wx - this.mesh.position.x;
        const dz = wz - this.mesh.position.z;
        if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
            this._targetRotY = Math.atan2(dx, dz);
        }
    }

    /**
     * Smoothly animates the agent's bobbing, swaying, and rotation.
     */
    public playAnimation(name: string, elapsedSeconds: number) {
        const t = (elapsedSeconds ?? Date.now() * 0.001) + this._idleOffset;

        // 1. Smooth rotation lerp
        // Approximate shortest path by adding/subtracting 2PI if needed
        let diff = this._targetRotY - this.visualGroup.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        this.visualGroup.rotation.y += diff * 0.1;

        // 2. Organic bobbing (applied to visualGroup so it doesn't fight world Y)
        this.visualGroup.position.y = Math.sin(t * 1.4) * 0.04;
        this.visualGroup.rotation.z = Math.sin(t * 0.9) * 0.015;

        // 3. Orb slow orbit
        this.emotionalOrb.position.x = Math.sin(t * 1.1) * 0.18;
        this.emotionalOrb.position.z = Math.cos(t * 1.1) * 0.18;
        this._orbLight.position.copy(this.emotionalOrb.position);
        this._orbLight.position.y = this.emotionalOrb.position.y;

        // 4. State-based modifiers
        if (name === 'walk') {
            this.visualGroup.rotation.x = Math.sin(t * 2.8) * 0.08 + 0.06;
            this.visualGroup.position.y += Math.sin(t * 2.8) * 0.03;
        } else {
            this.visualGroup.rotation.x = THREE.MathUtils.lerp(this.visualGroup.rotation.x, 0, 0.15);
        }
    }
}