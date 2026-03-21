import * as THREE from 'three';

/**
 * GodController — the world creator's avatar.
 *
 * Usage:
 *   const god = new GodController();
 *   scene.add(god.mesh);
 *
 *   // in useEffect (keydown/keyup):
 *   god.onKeyDown(e.key);
 *   god.onKeyUp(e.key);
 *
 *   // in useFrame:
 *   god.update(delta, cameraAzimuth);
 *   focusPosition.copy(god.position);
 */
export class GodController {
    public  mesh:     THREE.Group;
    public  position: THREE.Vector3;   // logical position (update this)
    private _keys  =  new Set<string>();
    private _speed =  14;              // world units / second
    private _halo:    THREE.Mesh;
    private _light:   THREE.PointLight;

    constructor(start = new THREE.Vector3(0, 2, 0)) {
        this.position = start.clone();
        const { mesh, halo, light } = this._buildMesh();
        this.mesh  = mesh;
        this._halo  = halo;
        this._light = light;
        this.mesh.position.copy(this.position);
    }

    // ── Mesh construction ─────────────────────────────────────────────────────
    private _buildMesh() {
        const group = new THREE.Group();

        const mat = new THREE.MeshPhongMaterial({
            color:             0xFFD700,
            emissive:          0xAA6600,
            emissiveIntensity: 0.45,
            flatShading:       true,
            shininess:         90,
        });

        // Body — hexagonal prism
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.28, 0.40, 1.15, 6), mat
        );
        body.position.y = 0.58;
        body.castShadow  = true;

        // Head — low-poly icosahedron
        const head = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.34, 0), mat
        );
        head.position.y = 1.38;
        head.castShadow  = true;

        // Crown — 5 spikes around the head
        const spikeMat = new THREE.MeshPhongMaterial({ color: 0xFFE566, flatShading: true });
        for (let i = 0; i < 5; i++) {
            const a    = (i / 5) * Math.PI * 2;
            const spike = new THREE.Mesh(
                new THREE.ConeGeometry(0.065, 0.26, 4), spikeMat
            );
            spike.position.set(Math.cos(a) * 0.26, 1.74, Math.sin(a) * 0.26);
            group.add(spike);
        }

        // Halo ring
        const haloMat = new THREE.MeshBasicMaterial({
            color:       0xFFE566,
            transparent: true,
            opacity:     0.72,
            side:        THREE.DoubleSide,
        });
        const halo = new THREE.Mesh(
            new THREE.TorusGeometry(0.52, 0.04, 6, 24), haloMat
        );
        halo.position.y  = 1.84;
        halo.rotation.x  = Math.PI * 0.08;  // slight tilt

        // Aura glow
        const light = new THREE.PointLight(0xFFD700, 1.4, 6);
        light.position.y = 0.9;

        group.add(body, head, halo, light);

        return { mesh: group, halo, light };
    }

    // ── Input ─────────────────────────────────────────────────────────────────
    public onKeyDown(key: string) { this._keys.add(key.toLowerCase()); }
    public onKeyUp  (key: string) { this._keys.delete(key.toLowerCase()); }

    // ── Per-frame update ──────────────────────────────────────────────────────
    /**
     * @param delta         seconds since last frame (from useFrame)
     * @param cameraAzimuth horizontal camera angle in radians (for relative movement)
     * @returns true if moving this frame
     */
    public update(delta: number, cameraAzimuth: number): boolean {
        const fwd   = new THREE.Vector3(-Math.sin(cameraAzimuth), 0, -Math.cos(cameraAzimuth));
        const right = new THREE.Vector3( Math.cos(cameraAzimuth), 0, -Math.sin(cameraAzimuth));
        const move  = new THREE.Vector3();

        if (this._keys.has('w') || this._keys.has('arrowup'))    move.add(fwd);
        if (this._keys.has('s') || this._keys.has('arrowdown'))  move.sub(fwd);
        if (this._keys.has('d') || this._keys.has('arrowright')) move.add(right);
        if (this._keys.has('a') || this._keys.has('arrowleft'))  move.sub(right);
        if (this._keys.has(' '))                                  move.y += 1;
        if (this._keys.has('shift'))                              move.y -= 1;

        const moving = move.lengthSq() > 0.001;

        if (moving) {
            // Face movement direction (horizontal only)
            const flat = new THREE.Vector3(move.x, 0, move.z);
            if (flat.lengthSq() > 0.001) {
                this.mesh.rotation.y = Math.atan2(flat.x, flat.z) + Math.PI;
            }
            move.normalize().multiplyScalar(this._speed * delta);
            this.position.add(move);
            if (this.position.y < 0.5) this.position.y = 0.5;
        }

        // Smooth mesh follows logical position
        this.mesh.position.lerp(this.position, 0.18);

        // Floating bob + halo spin
        const t = Date.now() * 0.001;
        this.mesh.position.y = this.position.y + Math.sin(t * 1.6) * 0.045;
        this._halo.rotation.y = t * 0.8;

        // Pulse light intensity
        this._light.intensity = 1.2 + Math.sin(t * 2.4) * 0.3;

        return moving;
    }
}
