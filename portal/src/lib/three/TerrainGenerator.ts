import * as THREE from 'three';

interface ChunkData {
    chunk_x: number;
    chunk_y: number;
    biome: string;
}

// ── Noise ─────────────────────────────────────────────────────────────────────
// Layered octaves — much more natural than single sin*cos
function fbm(x: number, z: number): number {
    return (
        Math.sin(x * 0.10) * Math.cos(z * 0.10) * 0.50 +
        Math.sin(x * 0.31 + 1.7) * Math.cos(z * 0.25 + 0.8) * 0.30 +
        Math.sin(x * 0.72 + 3.2) * Math.cos(z * 0.61 + 2.1) * 0.15 +
        Math.sin(x * 1.50 + 5.1) * Math.cos(z * 1.30 + 4.3) * 0.05
    );
}

// ── Biome palettes ────────────────────────────────────────────────────────────
const BIOME_PALETTE: Record<string, { base: number; dark: number; light: number }> = {
    forest:          { base: 0x2E7D32, dark: 0x1B5E20, light: 0x66BB6A },
    plains:          { base: 0x7CB342, dark: 0x558B2F, light: 0xAED581 },
    desert:          { base: 0xF9A825, dark: 0xE65100, light: 0xFFE082 },
    snow:            { base: 0xE3F2FD, dark: 0xB0BEC5, light: 0xFFFFFF },
    volcanic:        { base: 0x4E342E, dark: 0x1A0000, light: 0xBF360C },
    ocean:           { base: 0x1565C0, dark: 0x0D47A1, light: 0x42A5F5 },
    caverns:         { base: 0x212121, dark: 0x000000, light: 0x37474F },
    nexus:           { base: 0x37474F, dark: 0x263238, light: 0x78909C },
    ruins:           { base: 0x78909C, dark: 0x546E7A, light: 0xB0BEC5 },
    floating_islands:{ base: 0x81C784, dark: 0x388E3C, light: 0xC8E6C9 },
    mythic_zones:    { base: 0x4A148C, dark: 0x1A0033, light: 0xCE93D8 },
};

const BIOME_SEEDS = [
    { cx:  0,  cy:  0, biome: 'forest'           },
    { cx:  6,  cy:  1, biome: 'desert'           },
    { cx: -5,  cy:  4, biome: 'snow'             },
    { cx:  3,  cy: -6, biome: 'plains'           },
    { cx: -8,  cy: -4, biome: 'volcanic'         },
    { cx:  9,  cy: -3, biome: 'mythic_zones'     },
    { cx: -2,  cy:  9, biome: 'ocean'            },
    { cx:  8,  cy:  7, biome: 'ruins'            },
    { cx: -10, cy:  2, biome: 'caverns'          },
    { cx:  1,  cy: 10, biome: 'floating_islands' },
    { cx:  5,  cy: -9, biome: 'plains'           },
    { cx: -6,  cy: -9, biome: 'forest'           },
];

const FALLBACK_PALETTE = { base: 0x37474F, dark: 0x263238, light: 0x78909C };

// ── TerrainGenerator ──────────────────────────────────────────────────────────
export class TerrainGenerator {

    public getBiomeAt(cx: number, cy: number): string {
        let minDist = Infinity;
        let biome = 'forest';
        for (const seed of BIOME_SEEDS) {
            const dx = cx - seed.cx;
            const dy = cy - seed.cy;
            const dist = dx * dx + dy * dy;
            if (dist < minDist) {
                minDist = dist;
                biome = seed.biome;
            }
        }
        return biome;
    }

    public generateChunk(data: ChunkData): THREE.Mesh {
        const { chunk_x, chunk_y } = data;
        const biome = data.biome || this.getBiomeAt(chunk_x, chunk_y);
        const SEGMENTS = 24;  // more verts = smoother low-poly look
        const SIZE = 32;

        const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
        geometry.rotateX(-Math.PI / 2);

        const positions = geometry.attributes.position.array as Float32Array;
        const vertexCount = positions.length / 3;
        const colors = new Float32Array(vertexCount * 3);

        const palette = BIOME_PALETTE[biome] ?? FALLBACK_PALETTE;
        const scale = this.getBiomeScale(biome);

        const baseColor  = new THREE.Color(palette.base);
        const darkColor  = new THREE.Color(palette.dark);
        const lightColor = new THREE.Color(palette.light);
        const tmp = new THREE.Color();

        for (let i = 0; i < vertexCount; i++) {
            const ix = i * 3;
            const wx = positions[ix]     + chunk_x * SIZE;
            const wz = positions[ix + 2] + chunk_y * SIZE;

            const height = fbm(wx, wz) * scale;
            positions[ix + 1] = height;

            // Map height to color: low → dark, mid → base, high → light
            const t = Math.min(1, Math.max(0, (height / scale + 1) / 2));
            if (t < 0.5) {
                tmp.lerpColors(darkColor, baseColor, t * 2);
            } else {
                tmp.lerpColors(baseColor, lightColor, (t - 0.5) * 2);
            }

            colors[ix]     = tmp.r;
            colors[ix + 1] = tmp.g;
            colors[ix + 2] = tmp.b;
        }

        geometry.attributes.position.needsUpdate = true;
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        const material = new THREE.MeshPhongMaterial({
            vertexColors: true,
            flatShading: true,   // key for low-poly faceted look
            shininess: 8,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(chunk_x * SIZE, 0, chunk_y * SIZE);
        mesh.receiveShadow = true;
        mesh.castShadow = false;

        return mesh;
    }

    // ── Vegetation ────────────────────────────────────────────────────────────
    public generateVegetation(biome: string, chunkX = 0, chunkY = 0): THREE.Group {
        const group = new THREE.Group();

        const counts: Record<string, number> = {
            forest: 12,
            plains: 4,
            desert: 3,
            snow: 2,
            mythic_zones: 5,
        };

        const count = counts[biome] ?? 0;
        const scale = this.getBiomeScale(biome);
        const SIZE = 32;

        // Deterministic random based on chunk coords
        const rand = this.seededRandom(chunkX * 31 + chunkY * 97);

        for (let i = 0; i < count; i++) {
            const lx = (rand() - 0.5) * (SIZE - 4);
            const lz = (rand() - 0.5) * (SIZE - 4);
            const wx = lx + chunkX * SIZE;
            const wz = lz + chunkY * SIZE;
            const groundY = fbm(wx, wz) * scale;

            let plant: THREE.Group;
            if (biome === 'desert') {
                plant = this.makeCactus();
            } else if (biome === 'snow') {
                plant = this.makeTree(0x78909C, 0xE3F2FD);  // grey trunk, white canopy
            } else if (biome === 'mythic_zones') {
                plant = this.makeMythicCrystal();
            } else {
                plant = this.makeTree(0x5D4037, biome === 'plains' ? 0x8BC34A : 0x2E7D32);
            }

            plant.position.set(wx, groundY, wz);
            plant.rotation.y = rand() * Math.PI * 2;
            const s = 0.6 + rand() * 0.8;
            plant.scale.setScalar(s);

            group.add(plant);
        }

        return group;
    }

    // ── Tree ──────────────────────────────────────────────────────────────────
    private makeTree(trunkHex: number, canopyHex: number): THREE.Group {
        const g = new THREE.Group();

        const trunkMat  = new THREE.MeshLambertMaterial({ color: trunkHex });
        const canopyMat = new THREE.MeshLambertMaterial({ color: canopyHex, flatShading: true });

        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 1.0, 5), trunkMat);
        trunk.position.y = 0.5;
        trunk.castShadow = true;

        // Two stacked cones for a more interesting silhouette
        const cone1 = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.5, 7), canopyMat);
        cone1.position.y = 1.6;
        cone1.castShadow = true;

        const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 7), canopyMat);
        cone2.position.y = 2.4;
        cone2.castShadow = true;

        g.add(trunk, cone1, cone2);
        return g;
    }

    // ── Cactus ────────────────────────────────────────────────────────────────
    private makeCactus(): THREE.Group {
        const g = new THREE.Group();
        const mat = new THREE.MeshLambertMaterial({ color: 0x388E3C });

        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 1.4, 6), mat);
        body.position.y = 0.7;

        const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.6, 5), mat);
        armL.position.set(-0.28, 0.9, 0);
        armL.rotation.z = Math.PI / 3;

        const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.6, 5), mat);
        armR.position.set(0.28, 0.9, 0);
        armR.rotation.z = -Math.PI / 3;

        g.add(body, armL, armR);
        return g;
    }

    // ── Mythic Crystal ────────────────────────────────────────────────────────
    private makeMythicCrystal(): THREE.Group {
        const g = new THREE.Group();
        const mat = new THREE.MeshPhongMaterial({
            color: 0x9C27B0,
            emissive: 0x4A148C,
            emissiveIntensity: 0.4,
            transparent: true,
            opacity: 0.85,
            flatShading: true,
            shininess: 80,
        });

        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), mat);
        crystal.position.y = 0.8;
        crystal.rotation.y = Math.PI / 4;

        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 0.3, 6), mat);
        base.position.y = 0.15;

        g.add(crystal, base);
        return g;
    }

    // ── Buildings (unchanged API) ─────────────────────────────────────────────
    public getConstructionMesh(type: string): THREE.Group {
        const group = new THREE.Group();
        if (type === 'house') {
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshLambertMaterial({ color: 0x8D6E63 })
            );
            const roof = new THREE.Mesh(
                new THREE.ConeGeometry(0.8, 0.6, 4),
                new THREE.MeshLambertMaterial({ color: 0x4E342E })
            );
            roof.position.y = 0.8;
            roof.rotation.y = Math.PI / 4;
            group.add(body, roof);
        } else if (type === 'tower') {
            const tower = new THREE.Mesh(
                new THREE.CylinderGeometry(0.5, 0.5, 3),
                new THREE.MeshLambertMaterial({ color: 0x78909C })
            );
            group.add(tower);
        }
        return group;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private getBiomeScale(biome: string): number {
        const scales: Record<string, number> = {
            snow:     3.0,
            volcanic: 2.5,
            forest:   1.5,
            plains:   0.4,
            desert:   1.2,
            ocean:    0.1,
            nexus:    0.5,
        };
        return scales[biome] ?? 1.0;
    }

    /** Simple deterministic PRNG (mulberry32) */
    private seededRandom(seed: number): () => number {
        let s = seed | 0;
        return () => {
            s = Math.imul(s ^ (s >>> 15), s | 1);
            s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
            return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
        };
    }
}