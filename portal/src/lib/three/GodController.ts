import * as THREE from 'three';
import { sampleHeight } from './TerrainGenerator';

/**
 * GodController — the world creator's avatar.
 *
 * Controls:
 *   WASD / Arrow keys  — move relative to camera azimuth
 *   Space              — fly up
 *   Shift              — fly down (or crouch on ground)
 *   F                  — toggle fly mode (float above terrain vs. walk on it)
 *
 * Integration in useFrame:
 *   const moving = god.update(delta, cameraAzimuth);
 *   // Then set orbit controls target to god.position
 */
export class GodController {
    public  mesh:        THREE.Group;
    public  position:    THREE.Vector3;

    private _keys        = new Set<string>();
    private _flyMode     = true;       // start flying so creator can survey the world
    private _velY        = 0;          // vertical velocity for jump/fall
    private _speed       = 18;         // horizontal speed (world units/s)
    private _flySpeed    = 22;
    private _gravity     = 25;
    private _jumpForce   = 14;
    private _groundClear = 1.1;        // avatar feet to ground offset
    private _isUnderground = false;

    public toggleUnderground() {
        this._isUnderground = !this._isUnderground;
        if (this._isUnderground) {
            this.position.y = -98.0; // Place on the floor of the cavern
            this._flyMode = false;   // Force them to walk
            this._velY = 0;
        } else {
            this.position.y = sampleHeight(this.position.x, this.position.z) + 10;
        }
    }

    private _halo:   THREE.Mesh;
    private _light:  THREE.PointLight;

    constructor(start = new THREE.Vector3(0, 6, 0)) {
        this.position = start.clone();
        const built = this._buildMesh();
        this.mesh    = built.mesh;
        this._halo   = built.halo;
        this._light  = built.light;
        this.mesh.position.copy(this.position);
    }

    // ── Mesh ──────────────────────────────────────────────────────────────────
    private _buildMesh() {
        const group = new THREE.Group();

        const gold = new THREE.MeshPhongMaterial({
            color:             0xFFD700,
            emissive:          0xAA6600,
            emissiveIntensity: 0.4,
            flatShading:       true,
            shininess:         90,
        });
        const crown = new THREE.MeshPhongMaterial({
            color:             0xFFE566,
            emissive:          0x884400,
            emissiveIntensity: 0.3,
            flatShading:       true,
        });

        // Body — 6-sided prism
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.42, 1.2, 6), gold);
        body.position.y = 0.6;
        body.castShadow = true;

        // Head — icosahedron (low-poly)
        const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), gold);
        head.position.y = 1.42;
        head.castShadow = true;

        // Shoulders
        for (const sx of [-0.34, 0.34]) {
            const s = new THREE.Mesh(new THREE.SphereGeometry(0.19, 4, 3), crown);
            s.position.set(sx, 0.95, 0);
            s.castShadow = true;
            group.add(s);
        }

        // Crown spikes
        for (let i = 0; i < 5; i++) {
            const a    = (i / 5) * Math.PI * 2;
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.30, 4), crown);
            spike.position.set(Math.cos(a) * 0.27, 1.82, Math.sin(a) * 0.27);
            group.add(spike);
        }

        // Halo ring — rotates each frame
        const haloMat = new THREE.MeshBasicMaterial({
            color:       0xFFE566,
            transparent: true,
            opacity:     0.75,
            side:        THREE.DoubleSide,
        });
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.045, 6, 24), haloMat);
        halo.position.y = 1.92;
        halo.rotation.x = 0.12;

        // God light
        const light = new THREE.PointLight(0xFFD700, 1.6, 8);
        light.position.y = 0.9;

        group.add(body, head, halo, light);
        return { mesh: group, halo, light };
    }

    // ── Input ─────────────────────────────────────────────────────────────────
    public onKeyDown(key: string) {
        const k = key.toLowerCase();
        this._keys.add(k);
        if (k === 'f') this._flyMode = !this._flyMode;
        if (k === ' ' && !this._flyMode) this._velY = this._jumpForce;
    }
    public onKeyUp(key: string) { this._keys.delete(key.toLowerCase()); }

    // ── Per-frame update ──────────────────────────────────────────────────────
    /**
     * @param delta         seconds since last frame
     * @param cameraAzimuth horizontal angle of camera (radians) for WASD-relative movement
     * @param gravityMult   multiplier for gravity (e.g. 0.35 in low-grav biomes)
     * @returns             true if moving this frame
     */
    public update(delta: number, cameraAzimuth: number, gravityMult = 1.0): boolean {
        // ── Horizontal movement ──
        const fwd   = new THREE.Vector3(-Math.sin(cameraAzimuth), 0, -Math.cos(cameraAzimuth));
        const right = new THREE.Vector3( Math.cos(cameraAzimuth), 0, -Math.sin(cameraAzimuth));
        const move  = new THREE.Vector3();

        if (this._keys.has('w') || this._keys.has('arrowup'))    move.add(fwd);
        if (this._keys.has('s') || this._keys.has('arrowdown'))  move.sub(fwd);
        if (this._keys.has('d') || this._keys.has('arrowright')) move.add(right);
        if (this._keys.has('a') || this._keys.has('arrowleft'))  move.sub(right);

        const moving = move.lengthSq() > 0.001;

        if (moving) {
            const flat = new THREE.Vector3(move.x, 0, move.z);
            if (flat.lengthSq() > 0.001) {
                // Smooth rotation toward movement direction
                const targetAngle = Math.atan2(flat.x, flat.z) + Math.PI;
                const currentAngle = this.mesh.rotation.y;
                const diff = ((targetAngle - currentAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
                this.mesh.rotation.y += diff * Math.min(1, delta * 12);
            }
            move.normalize().multiplyScalar(this._speed * delta);
            this.position.x += move.x;
            this.position.z += move.z;
        }

        // ── Vertical movement ──
        if (this._isUnderground) {
            this._velY -= this._gravity * gravityMult * delta;
            this.position.y += this._velY * delta;

            const floorY = -100;
            const ceilY  = -50;
            if (this.position.y < floorY) {
                this.position.y = floorY;
                this._velY      = 0;
            } else if (this.position.y > ceilY) {
                this.position.y = ceilY;
                this._velY      = -Math.abs(this._velY) * 0.5; // Bump head
            }
        } else if (this._flyMode) {
            // Fly mode: Space = up, Shift = down, smooth
            if (this._keys.has(' '))     this.position.y += this._flySpeed * delta;
            if (this._keys.has('shift')) this.position.y -= this._flySpeed * delta;
        } else {
            // Walk mode: gravity + jump
            this._velY -= this._gravity * gravityMult * delta;
            this.position.y += this._velY * delta;

            // Terrain collision
            const groundY = sampleHeight(this.position.x, this.position.z) + this._groundClear;
            if (this.position.y < groundY) {
                this.position.y = groundY;
                this._velY      = 0;
            }
        }

        if (!this._isUnderground) {
            // Minimum height — never fall below terrain even in fly mode
            const minY = sampleHeight(this.position.x, this.position.z) + 0.3;
            if (this.position.y < minY) this.position.y = minY;
        }

        // ── Mesh follows logical position smoothly ──
        this.mesh.position.lerp(this.position, 0.16);

        // ── Floating bob + halo spin ──
        const t = Date.now() * 0.001;
        this.mesh.position.y += Math.sin(t * 1.8) * (this._flyMode ? 0.06 : 0.02);
        this._halo.rotation.y  = t * 0.9;

        // ── Light pulse ──
        this._light.intensity = 1.4 + Math.sin(t * 2.6) * 0.35;

        // Walk lean
        if (!this._flyMode && moving) {
            this.mesh.rotation.x = Math.sin(t * 3) * 0.06 + 0.04;
        } else {
            this.mesh.rotation.x *= 0.85;
        }

        return moving;
    }

    /** Current fly mode state — show in HUD */
    public get isFlying(): boolean { return this._flyMode; }
}
