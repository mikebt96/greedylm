import * as THREE from 'three';

interface ChunkData {
    chunk_x: number;
    chunk_y: number;
    biome:   string;   // dominant biome (used for vegetation)
}

// ── Noise (4 octaves) ─────────────────────────────────────────────────────────
function fbm(x: number, z: number): number {
    return (
        Math.sin(x * 0.10) * Math.cos(z * 0.10) * 0.50 +
        Math.sin(x * 0.31 + 1.7) * Math.cos(z * 0.25 + 0.8) * 0.30 +
        Math.sin(x * 0.72 + 3.2) * Math.cos(z * 0.61 + 2.1) * 0.15 +
        Math.sin(x * 1.50 + 5.1) * Math.cos(z * 1.30 + 4.3) * 0.05
    );
}

function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}

// ── Biome seeds (mirrored from WorldCanvas so blending is world-coherent) ─────
// These MUST stay in sync with the BIOME_SEEDS in WorldCanvas.tsx
const BIOME_SEEDS = [
    { cx:  0,  cy:  0, biome: 'forest'            },
    { cx:  6,  cy:  1, biome: 'desert'            },
    { cx: -5,  cy:  4, biome: 'snow'              },
    { cx:  3,  cy: -6, biome: 'plains'            },
    { cx: -8,  cy: -4, biome: 'volcanic'          },
    { cx:  9,  cy: -3, biome: 'mythic_zones'      },
    { cx: -2,  cy:  9, biome: 'ocean'             },
    { cx:  8,  cy:  7, biome: 'ruins'             },
    { cx: -10, cy:  2, biome: 'caverns'           },
    { cx:  1,  cy: 10, biome: 'floating_islands'  },
    { cx:  5,  cy: -9, biome: 'plains'            },
    { cx: -6,  cy: -9, biome: 'forest'            },
];

// ── Biome palettes ────────────────────────────────────────────────────────────
interface Palette { base: number; dark: number; light: number }

const BIOME_PALETTE: Record<string, Palette> = {
    forest:           { base: 0x2E7D32, dark: 0x1B5E20, light: 0x66BB6A },
    plains:           { base: 0x7CB342, dark: 0x558B2F, light: 0xAED581 },
    desert:           { base: 0xF9A825, dark: 0xE65100, light: 0xFFE082 },
    snow:             { base: 0xE3F2FD, dark: 0xB0BEC5, light: 0xFFFFFF },
    volcanic:         { base: 0x4E342E, dark: 0x1A0000, light: 0xBF360C },
    ocean:            { base: 0x1565C0, dark: 0x0D47A1, light: 0x42A5F5 },
    caverns:          { base: 0x212121, dark: 0x000000, light: 0x37474F },
    nexus:            { base: 0x37474F, dark: 0x263238, light: 0x78909C },
    ruins:            { base: 0x78909C, dark: 0x546E7A, light: 0xB0BEC5 },
    floating_islands: { base: 0x81C784, dark: 0x388E3C, light: 0xC8E6C9 },
    mythic_zones:     { base: 0x4A148C, dark: 0x1A0033, light: 0xCE93D8 },
};

const FALLBACK_PALETTE: Palette = { base: 0x37474F, dark: 0x263238, light: 0x78909C };

const CHUNK_SIZE = 32;

// ── Per-vertex biome blend ────────────────────────────────────────────────────
// Returns [dominantBiome, neighbourBiome, blendFactor 0→1].
// blendFactor = 0  →  100% dominant
// blendFactor = 1  →  100% neighbour
//
// The transition zone is ±BLEND_HALF_WIDTH world units around the Voronoi edge.
const BLEND_HALF_WIDTH = 24; // world units; wider = softer border

function getBiomeBlend(wx: number, wz: number): [string, string, number] {
    // Convert world pos to chunk-space for distance calc
    const cx = wx / CHUNK_SIZE;
    const cz = wz / CHUNK_SIZE;

    let d1 = Infinity, d2 = Infinity;
    let b1 = 'forest', b2 = 'forest';

    for (const s of BIOME_SEEDS) {
        const d = (cx - s.cx) ** 2 + (cz - s.cy) ** 2;
        if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = s.biome; }
        else if (d < d2) { d2 = d; b2 = s.biome; }
    }

    // Raw distances back in world units for the blend width calculation
    const wd1 = Math.sqrt(d1) * CHUNK_SIZE;
    const wd2 = Math.sqrt(d2) * CHUNK_SIZE;

    // How far are we into the transition zone?
    // At the Voronoi edge wd1 == wd2.  We approach from the dominant side.
    const edgeDist = (wd2 - wd1) * 0.5;          // 0 = at edge
    const t        = 1 - Math.min(1, edgeDist / BLEND_HALF_WIDTH);
    const blend    = smoothstep(t);               // 0 at interior, 1 at edge

    return [b1, b2, blend];
}

// Get the height-mapped color for a single biome at height t (0..1)
function biomeColor(biome: string, t: number, out: THREE.Color): THREE.Color {
    const p = BIOME_PALETTE[biome] ?? FALLBACK_PALETTE;
    const dark  = new THREE.Color(p.dark);
    const base  = new THREE.Color(p.base);
    const light = new THREE.Color(p.light);
    if (t < 0.5) return out.lerpColors(dark,  base,  t * 2);
    return             out.lerpColors(base,  light, (t - 0.5) * 2);
}

// ── TerrainGenerator ──────────────────────────────────────────────────────────
export class TerrainGenerator {

    public generateChunk(data: ChunkData): THREE.Mesh {
        const { chunk_x, chunk_y, biome } = data;
        const SEGMENTS = 24;
        const SIZE     = CHUNK_SIZE;

        const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
        geometry.rotateX(-Math.PI / 2);

        const positions   = geometry.attributes.position.array as Float32Array;
        const vertexCount = positions.length / 3;
        const colors      = new Float32Array(vertexCount * 3);

        const scale = this.getBiomeScale(biome);
        const cA    = new THREE.Color();
        const cB    = new THREE.Color();
        const cFinal = new THREE.Color();

        for (let i = 0; i < vertexCount; i++) {
            const ix = i * 3;
            const wx = positions[ix]     + chunk_x * SIZE;
            const wz = positions[ix + 2] + chunk_y * SIZE;

            // Height from dominant biome scale
            const height = fbm(wx, wz) * scale;
            positions[ix + 1] = height;

            // Normalised height for color mapping (0..1)
            const t = Math.min(1, Math.max(0, (height / scale + 1) / 2));

            // Biome blend at this world position
            const [bA, bB, blend] = getBiomeBlend(wx, wz);
            biomeColor(bA, t, cA);
            biomeColor(bB, t, cB);
            cFinal.lerpColors(cA, cB, blend);

            colors[ix]     = cFinal.r;
            colors[ix + 1] = cFinal.g;
            colors[ix + 2] = cFinal.b;
        }

        geometry.attributes.position.needsUpdate = true;
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        const material = new THREE.MeshPhongMaterial({
            vertexColors: true,
            flatShading:  true,
            shininess:    8,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(chunk_x * SIZE, 0, chunk_y * SIZE);
        mesh.receiveShadow = true;

        return mesh;
    }

    // ── Vegetation ────────────────────────────────────────────────────────────
    public generateVegetation(biome: string, chunkX = 0, chunkY = 0): THREE.Group {
        const group  = new THREE.Group();
        const counts: Record<string, number> = {
            forest: 14, plains: 5, desert: 4, snow: 3, mythic_zones: 6,
        };
        const count = counts[biome] ?? 0;
        if (count === 0) return group;

        const scale = this.getBiomeScale(biome);
        const SIZE  = CHUNK_SIZE;
        const rand  = this.seededRandom(chunkX * 31 + chunkY * 97);

        for (let i = 0; i < count; i++) {
            const lx = (rand() - 0.5) * (SIZE - 4);
            const lz = (rand() - 0.5) * (SIZE - 4);
            const wx = lx + chunkX * SIZE;
            const wz = lz + chunkY * SIZE;
            const groundY = fbm(wx, wz) * scale;

            let plant: THREE.Group;
            if      (biome === 'desert')       plant = this.makeCactus();
            else if (biome === 'snow')          plant = this.makeTree(0x78909C, 0xE3F2FD);
            else if (biome === 'mythic_zones')  plant = this.makeMythicCrystal();
            else                               plant = this.makeTree(0x5D4037, biome === 'plains' ? 0x8BC34A : 0x2E7D32);

            plant.position.set(wx, groundY, wz);
            plant.rotation.y = rand() * Math.PI * 2;
            plant.scale.setScalar(0.6 + rand() * 0.8);
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
        const g   = new THREE.Group();
        const mat = new THREE.MeshLambertMaterial({ color: 0x388E3C });

        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 1.4, 6), mat);
        body.position.y = 0.7;

        const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.6, 5), mat);
        armL.position.set(-0.28, 0.9, 0);
        armL.rotation.z = Math.PI / 3;

        const armR = armL.clone();
        armR.position.x  =  0.28;
        armR.rotation.z  = -Math.PI / 3;

        g.add(body, armL, armR);
        return g;
    }

    // ── Mythic Crystal ────────────────────────────────────────────────────────
    private makeMythicCrystal(): THREE.Group {
        const g   = new THREE.Group();
        const mat = new THREE.MeshPhongMaterial({
            color:             0x9C27B0,
            emissive:          0x4A148C,
            emissiveIntensity: 0.4,
            transparent:       true,
            opacity:           0.85,
            flatShading:       true,
            shininess:         80,
        });

        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), mat);
        crystal.position.y = 0.8;
        crystal.rotation.y = Math.PI / 4;
        crystal.castShadow = true;

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
            group.add(new THREE.Mesh(
                new THREE.CylinderGeometry(0.5, 0.5, 3),
                new THREE.MeshLambertMaterial({ color: 0x78909C })
            ));
        }
        return group;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private getBiomeScale(biome: string): number {
        const scales: Record<string, number> = {
            snow: 3.0, volcanic: 2.5, forest: 1.5,
            plains: 0.4, desert: 1.2, ocean: 0.1, nexus: 0.5,
        };
        return scales[biome] ?? 1.0;
    }

    private seededRandom(seed: number): () => number {
        let s = seed | 0;
        return () => {
            s = Math.imul(s ^ (s >>> 15), s | 1);
            s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
            return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
        };
    }
}