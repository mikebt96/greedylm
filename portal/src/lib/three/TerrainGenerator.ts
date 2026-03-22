import * as THREE from 'three';

interface ChunkData {
    chunk_x: number;
    chunk_y: number;
    biome:   string;
}

// ── Exported height function — used by GodController for terrain collision ────
export const CHUNK_SIZE = 32;

/**
 * Sample world height at any (wx, wz) position.
 * Must match exactly what generateChunk uses — call this from GodController.
 */
export function sampleHeight(wx: number, wz: number): number {
    const biome = getBiomeAt(wx, wz);
    const scale = BIOME_SCALE[biome] ?? 2.0;
    return fbm(wx, wz) * scale;
}

// ── Noise (6 octaves for dramatic relief) ─────────────────────────────────────
function fbm(x: number, z: number): number {
    return (
        Math.sin(x * 0.08)  * Math.cos(z * 0.08)  * 0.45 +
        Math.sin(x * 0.19 + 1.7) * Math.cos(z * 0.17 + 0.8) * 0.28 +
        Math.sin(x * 0.41 + 3.1) * Math.cos(z * 0.37 + 2.3) * 0.14 +
        Math.sin(x * 0.87 + 5.3) * Math.cos(z * 0.79 + 4.1) * 0.07 +
        Math.sin(x * 1.73 + 2.9) * Math.cos(z * 1.61 + 3.7) * 0.04 +
        Math.sin(x * 3.40 + 7.1) * Math.cos(z * 3.10 + 6.3) * 0.02
    );
}

function smoothstep(t: number): number { return t * t * (3 - 2 * t); }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// ── Biome scales — higher = more dramatic relief ──────────────────────────────
const BIOME_SCALE: Record<string, number> = {
    snow:             7.0,   // tall snowy peaks
    volcanic:         6.0,   // jagged, aggressive
    forest:           3.5,   // rolling hills
    mythic_zones:     4.5,   // alien mounds
    ruins:            2.5,
    plains:           0.8,   // mostly flat
    desert:           2.0,   // dunes
    ocean:            0.3,   // nearly flat (water surface)
    caverns:          5.0,   // deep depressions
    nexus:            1.5,
    floating_islands: 4.0,
};

// ── Biome seeds (must mirror WorldCanvas.tsx) ─────────────────────────────────
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

function getBiomeAt(wx: number, wz: number): string {
    const cx = wx / CHUNK_SIZE;
    const cz = wz / CHUNK_SIZE;
    let minDist = Infinity, biome = 'forest';
    for (const s of BIOME_SEEDS) {
        const d = (cx - s.cx) ** 2 + (cz - s.cy) ** 2;
        if (d < minDist) { minDist = d; biome = s.biome; }
    }
    return biome;
}

// Returns [dominant, neighbour, blendFactor 0→1]
const BLEND_HALF_WIDTH = 28;
function getBiomeBlend(wx: number, wz: number): [string, string, number] {
    const cx = wx / CHUNK_SIZE;
    const cz = wz / CHUNK_SIZE;
    let d1 = Infinity, d2 = Infinity, b1 = 'forest', b2 = 'forest';
    for (const s of BIOME_SEEDS) {
        const d = (cx - s.cx) ** 2 + (cz - s.cy) ** 2;
        if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = s.biome; }
        else if (d < d2) { d2 = d; b2 = s.biome; }
    }
    const wd1 = Math.sqrt(d1) * CHUNK_SIZE;
    const wd2 = Math.sqrt(d2) * CHUNK_SIZE;
    const edge  = (wd2 - wd1) * 0.5;
    const blend = smoothstep(1 - clamp(edge / BLEND_HALF_WIDTH, 0, 1));
    return [b1, b2, blend];
}

// ── Biome palettes ────────────────────────────────────────────────────────────
interface Palette { base: number; dark: number; light: number }
const BIOME_PALETTE: Record<string, Palette> = {
    forest:           { base: 0x2E7D32, dark: 0x1B5E20, light: 0x66BB6A },
    plains:           { base: 0x7CB342, dark: 0x558B2F, light: 0xAED581 },
    desert:           { base: 0xF9A825, dark: 0xE65100, light: 0xFFE082 },
    snow:             { base: 0xDDEEF5, dark: 0x90A4AE, light: 0xFFFFFF },
    volcanic:         { base: 0x4E342E, dark: 0x1A0000, light: 0xBF360C },
    ocean:            { base: 0x1565C0, dark: 0x0D47A1, light: 0x42A5F5 },
    caverns:          { base: 0x263238, dark: 0x000000, light: 0x37474F },
    nexus:            { base: 0x37474F, dark: 0x263238, light: 0x78909C },
    ruins:            { base: 0x78909C, dark: 0x546E7A, light: 0xB0BEC5 },
    floating_islands: { base: 0x81C784, dark: 0x388E3C, light: 0xC8E6C9 },
    mythic_zones:     { base: 0x4A148C, dark: 0x1A0033, light: 0xCE93D8 },
};
const FALLBACK_PALETTE: Palette = { base: 0x37474F, dark: 0x263238, light: 0x78909C };

function biomeColor(biome: string, t: number, out: THREE.Color): THREE.Color {
    const p = BIOME_PALETTE[biome] ?? FALLBACK_PALETTE;
    if (t < 0.5) return out.lerpColors(new THREE.Color(p.dark),  new THREE.Color(p.base),  t * 2);
    return             out.lerpColors(new THREE.Color(p.base),  new THREE.Color(p.light), (t - 0.5) * 2);
}

// ── Mineral definitions ───────────────────────────────────────────────────────
const MINERALS = [
    { subtype: 'iron_ore',    color: 0x8D6E63, emissive: 0x000000, rarity: 0.10, prob: 0.35, biomes: ['volcanic','caverns','forest'] },
    { subtype: 'copper_ore',  color: 0xE57348, emissive: 0x000000, rarity: 0.15, prob: 0.25, biomes: ['plains','forest','desert']  },
    { subtype: 'silver_ore',  color: 0xCFD8DC, emissive: 0x334455, rarity: 0.35, prob: 0.15, biomes: ['snow','ruins']              },
    { subtype: 'gold_ore',    color: 0xFFD700, emissive: 0x443300, rarity: 0.55, prob: 0.08, biomes: ['desert','mythic_zones']     },
    { subtype: 'luminos_gem', color: 0x9C27B0, emissive: 0x4A148C, rarity: 0.75, prob: 0.04, biomes: ['mythic_zones']             },
    { subtype: 'void_crystal',color: 0x1A1A2E, emissive: 0x303080, rarity: 0.90, prob: 0.02, biomes: ['caverns']                  },
    { subtype: 'greedystone', color: 0x00E5FF, emissive: 0x006688, rarity: 1.00, prob: 0.005,biomes: [] /* any */                 },
];

// ── TerrainGenerator ──────────────────────────────────────────────────────────
export class TerrainGenerator {

    // ── Terrain chunk ─────────────────────────────────────────────────────────
    public generateChunk(data: ChunkData): THREE.Mesh {
        const { chunk_x, chunk_y, biome } = data;
        const SEGMENTS = 28;   // enough for smooth mountains without overdraw
        const SIZE     = CHUNK_SIZE;

        const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
        geometry.rotateX(-Math.PI / 2);

        const positions   = geometry.attributes.position.array as Float32Array;
        const vertexCount = positions.length / 3;
        const colors      = new Float32Array(vertexCount * 3);
        const scale       = BIOME_SCALE[biome] ?? 2.0;

        const cA = new THREE.Color(), cB = new THREE.Color(), cF = new THREE.Color();

        for (let i = 0; i < vertexCount; i++) {
            const ix = i * 3;
            const wx = positions[ix]     + chunk_x * SIZE;
            const wz = positions[ix + 2] + chunk_y * SIZE;

            // Height uses per-vertex biome scale for smoother cross-biome mountains
            const [bA,, blend] = getBiomeBlend(wx, wz);
            const scaleA = BIOME_SCALE[bA] ?? 2.0;
            const height = fbm(wx, wz) * scaleA;
            positions[ix + 1] = height;

            const t = clamp((height / scale + 1) / 2, 0, 1);
            const [biomA, biomB, bl] = getBiomeBlend(wx, wz);
            biomeColor(biomA, t, cA);
            biomeColor(biomB, t, cB);
            cF.lerpColors(cA, cB, bl);

            colors[ix]     = cF.r;
            colors[ix + 1] = cF.g;
            colors[ix + 2] = cF.b;
        }

        geometry.attributes.position.needsUpdate = true;
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        const material = new THREE.MeshPhongMaterial({
            vertexColors: true,
            flatShading:  true,
            shininess:    6,
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
        const scale = BIOME_SCALE[biome] ?? 2.0;
        const SIZE  = CHUNK_SIZE;
        const rand  = this.seededRandom(chunkX * 31 + chunkY * 97);

        for (let i = 0; i < count; i++) {
            const lx  = (rand() - 0.5) * (SIZE - 4);
            const lz  = (rand() - 0.5) * (SIZE - 4);
            const wx  = lx + chunkX * SIZE;
            const wz  = lz + chunkY * SIZE;
            const gy  = sampleHeight(wx, wz);

            let plant: THREE.Group;
            if      (biome === 'desert')       plant = this.makeCactus();
            else if (biome === 'snow')          plant = this.makeTree(0x78909C, 0xE3F2FD);
            else if (biome === 'mythic_zones')  plant = this.makeMythicCrystal();
            else                               plant = this.makeTree(0x5D4037, biome === 'plains' ? 0x8BC34A : 0x2E7D32);

            plant.position.set(wx, gy, wz);
            plant.rotation.y = rand() * Math.PI * 2;
            plant.scale.setScalar(0.6 + rand() * 0.8);
            group.add(plant);
        }

        return group;
    }

    // ── Mineral deposits ──────────────────────────────────────────────────────
    /**
     * Generates visible mineral deposit meshes for a chunk.
     * The list of spawned minerals is returned so WorldCanvas can sync
     * them with the backend (POST /api/v1/world/objects).
     */
    public generateMinerals(biome: string, chunkX = 0, chunkY = 0): THREE.Group {
        const group = new THREE.Group();
        const rand  = this.seededRandom(chunkX * 53 + chunkY * 127 + 7777);
        const SIZE  = CHUNK_SIZE;

        // 0–3 deposits per chunk based on biome richness
        const richness: Record<string, number> = {
            volcanic: 3, caverns: 3, mythic_zones: 2,
            desert: 2, snow: 1, forest: 1, plains: 1,
        };
        const maxDeposits = richness[biome] ?? 1;

        for (let i = 0; i < maxDeposits; i++) {
            // Pick mineral type by probability
            const roll = rand();
            let cumulative = 0;
            let mineral = MINERALS[0];

            for (const m of MINERALS) {
                // Only spawn if biome matches (or greedystone = any biome)
                const biomeOk = m.biomes.length === 0 || m.biomes.includes(biome);
                if (!biomeOk) continue;
                cumulative += m.prob;
                if (roll < cumulative) { mineral = m; break; }
            }

            const lx = (rand() - 0.5) * (SIZE - 6);
            const lz = (rand() - 0.5) * (SIZE - 6);
            const wx = lx + chunkX * SIZE;
            const wz = lz + chunkY * SIZE;
            const gy = sampleHeight(wx, wz);

            const deposit = this.makeMineralDeposit(mineral);
            deposit.position.set(wx, gy, wz);
            deposit.rotation.y = rand() * Math.PI * 2;
            deposit.userData = {
                mineralSubtype: mineral.subtype,
                rarity:         mineral.rarity,
                quantity:       Math.floor(3 + rand() * 12),
            };
            group.add(deposit);
        }

        return group;
    }

    // ── Cave entrances ────────────────────────────────────────────────────────
    /**
     * Generates 0–1 cave entrance per chunk in suitable biomes.
     * The entrance is a dark archway — clicking it will eventually
     * transition to the underground level.
     */
    public generateCaveEntrances(biome: string, chunkX = 0, chunkY = 0): THREE.Group {
        const group = new THREE.Group();
        const caveBiomes = ['caverns', 'volcanic', 'forest', 'ruins'];
        if (!caveBiomes.includes(biome)) return group;

        const rand = this.seededRandom(chunkX * 17 + chunkY * 43 + 9999);
        // ~20% chance of a cave entrance per eligible chunk
        if (rand() > 0.20) return group;

        const SIZE = CHUNK_SIZE;
        const lx   = (rand() - 0.5) * (SIZE - 8);
        const lz   = (rand() - 0.5) * (SIZE - 8);
        const wx   = lx + chunkX * SIZE;
        const wz   = lz + chunkY * SIZE;
        const gy   = sampleHeight(wx, wz);

        const cave = this.makeCaveEntrance();
        cave.position.set(wx, gy, wz);
        cave.rotation.y = rand() * Math.PI * 2;
        cave.userData   = { type: 'cave_entrance', biome };
        group.add(cave);

        return group;
    }

    // ── Fauna ─────────────────────────────────────────────────────────────────
    /**
     * Generates visible fauna meshes for a chunk.
     * The list of spawned fauna is returned so WorldCanvas can sync
     * them with the backend (POST /api/v1/world/objects).
     */
    public generateFauna(biome: string, chunkX = 0, chunkY = 0): THREE.Group {
        const group = new THREE.Group();
        const rand  = this.seededRandom(chunkX * 89 + chunkY * 193 + 4444);
        const SIZE  = CHUNK_SIZE;

        // Try up to 3 random spots in the chunk to find a suitable environment
        for (let i = 0; i < 3; i++) {
            const lx = (rand() - 0.5) * (SIZE - 6);
            const lz = (rand() - 0.5) * (SIZE - 6);
            const wx = lx + chunkX * SIZE;
            const wz = lz + chunkY * SIZE;
            const gy = sampleHeight(wx, wz);

            let subtype = '';

            // 1. High intelligence (rarer, stricter environments)
            // 2. Low intelligence (more common, lenient environments)
            if (biome === 'forest' || biome === 'plains') {
                if (gy > 4 && rand() < 0.04) subtype = 'Apex Stalker'; // Altitud alta, 4%
                else if (rand() < 0.30) subtype = 'Duskfox';          // 30%
            } 
            else if (biome === 'snow') {
                if (rand() < 0.35) subtype = 'Frosthorn';
            }
            else if (biome === 'desert') {
                // Mirage solo en dunas planas
                const isFlat = Math.abs(gy - sampleHeight(wx + 2, wz)) < 0.8;
                if (isFlat && rand() < 0.05) subtype = 'Desert Mirage'; // 5%
                else if (rand() < 0.40) subtype = 'Sandscuttler';       // 40%
            }
            else if (biome === 'volcanic') {
                if (rand() < 0.35) subtype = 'Ashcrawler';
            }
            else if (biome === 'caverns') {
                if (gy < -5 && rand() < 0.06) subtype = 'Crystal Weaver'; // Profundidad, 6%
                else if (rand() < 0.40) subtype = 'Grubmole';
            }
            else if (biome === 'mythic_zones') {
                if (rand() < 0.08) subtype = 'Crystal Weaver'; // 8%
                else if (rand() < 0.25) subtype = 'Luminos Beast';
            }
            else if (biome === 'ruins') {
                if (rand() < 0.07) subtype = 'Ruin Sentinel'; // 7%
            }
            else if (biome === 'floating_islands' || biome === 'ocean') {
                if (gy > 12 && rand() < 0.03) subtype = 'Storm Glider'; // Muy alto, 3%
            }

            if (subtype !== '') {
                const faunaMesh = this.makeFaunaMesh(subtype);
                faunaMesh.position.set(wx, gy, wz);
                faunaMesh.rotation.y = rand() * Math.PI * 2;
                faunaMesh.userData = {
                    type: 'creature',
                    subtype: subtype,
                    behavior: this.getFaunaBehavior(subtype),
                    intelligence: this.getFaunaIntelligence(subtype)
                };
                group.add(faunaMesh);
                // Solo 1 por chunk como máximo para mantener la rareza
                break;
            }
        }

        return group;
    }

    private getFaunaBehavior(subtype: string): string {
        const b: Record<string, string> = {
            'Grubmole': 'pasivo', 'Sandscuttler': 'pasivo',
            'Luminos Beast': 'huye', 'Duskfox': 'ataca',
            'Frosthorn': 'manada', 'Ashcrawler': 'agresivo',
            'Crystal Weaver': 'nidos', 'Desert Mirage': 'huidizo', 
            'Storm Glider': 'observador', 'Ruin Sentinel': 'guarda', 
            'Apex Stalker': 'embosca'
        };
        return b[subtype] || 'pasivo';
    }

    private getFaunaIntelligence(subtype: string): number {
        const i: Record<string, number> = {
            'Grubmole': 1, 'Sandscuttler': 1, 'Ashcrawler': 1,
            'Luminos Beast': 2, 'Frosthorn': 2,
            'Duskfox': 3, 'Crystal Weaver': 3,
            'Desert Mirage': 4, 'Storm Glider': 4, 'Ruin Sentinel': 4,
            'Apex Stalker': 5
        };
        return i[subtype] || 1;
    }

    private makeFaunaMesh(subtype: string): THREE.Group {
        const g = new THREE.Group();
        // Since we don't have distinct models for each, we'll use geometric representations
        
        // High intel fauna get unique shapes/glows
        if (subtype === 'Storm Glider') {
            const mat = new THREE.MeshPhongMaterial({ color: 0x81D4FA, emissive: 0x0277BD, flatShading: true });
            const body = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 3), mat);
            body.rotation.x = Math.PI / 2;
            body.position.y = 1.5; // Glides above ground
            g.add(body);
        }
        else if (subtype === 'Crystal Weaver') {
            const mat = new THREE.MeshPhongMaterial({ color: 0xE08283, emissive: 0x96281B, flatShading: true, transparent: true, opacity: 0.9 });
            const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 1), mat);
            body.position.y = 0.5;
            g.add(body);
        }
        else if (subtype === 'Apex Stalker') {
            const mat = new THREE.MeshPhongMaterial({ color: 0x111111, flatShading: true, transparent: true, opacity: 0.6 });
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 1.2), mat);
            body.position.y = 0.2;
            g.add(body);
        }
        else if (subtype === 'Ruin Sentinel') {
            const mat = new THREE.MeshPhongMaterial({ color: 0x607D8B, emissive: 0x263238, flatShading: true });
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.5, 6), mat);
            body.position.y = 0.75;
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 4, 4), new THREE.MeshBasicMaterial({ color: 0xFF1744 }));
            eye.position.set(0, 1.2, 0.35);
            g.add(body, eye);
        }
        else if (subtype === 'Desert Mirage') {
            const mat = new THREE.MeshBasicMaterial({ color: 0xFFD54F, transparent: true, opacity: 0.4 });
            const body = new THREE.Mesh(new THREE.TorusKnotGeometry(0.3, 0.1, 32, 8), mat);
            body.position.y = 0.6;
            g.add(body);
        }
        else {
            // Low Intel fauna (generic geometric shapes)
            const colors: Record<string, number> = {
                'Grubmole': 0x5D4037, 'Sandscuttler': 0xF8B195, 'Ashcrawler': 0xBF360C,
                'Luminos Beast': 0xE1BEE7, 'Frosthorn': 0xCFD8DC, 'Duskfox': 0xE65100
            };
            const mat = new THREE.MeshLambertMaterial({ color: colors[subtype] || 0x888888 });
            const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 5, 4), mat);
            body.scale.set(1, 0.6, 1.2);
            body.position.y = 0.24;
            g.add(body);
        }
        
        return g;
    }

    // ── Mineral deposit mesh ──────────────────────────────────────────────────
    private makeMineralDeposit(m: typeof MINERALS[0]): THREE.Group {
        const g   = new THREE.Group();
        const mat = new THREE.MeshPhongMaterial({
            color:             m.color,
            emissive:          m.emissive,
            emissiveIntensity: m.rarity * 0.6,
            flatShading:       true,
            shininess:         m.rarity > 0.5 ? 80 : 20,
        });

        // Base rock
        const base = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.35 + m.rarity * 0.2, 0), mat
        );
        base.castShadow = true;
        base.position.y = 0.2;

        // Small crystals for high-rarity minerals
        if (m.rarity > 0.4) {
            for (let i = 0; i < 3; i++) {
                const a = (i / 3) * Math.PI * 2;
                const shard = new THREE.Mesh(
                    new THREE.OctahedronGeometry(0.10 + m.rarity * 0.08, 0), mat
                );
                shard.position.set(Math.cos(a) * 0.25, 0.35 + i * 0.1, Math.sin(a) * 0.25);
                shard.rotation.set(Math.random(), Math.random(), Math.random());
                g.add(shard);
            }
        }

        // Glow point light for legendary minerals
        if (m.rarity > 0.7) {
            const light = new THREE.PointLight(m.emissive || m.color, 0.8, 4);
            light.position.y = 0.5;
            g.add(light);
        }

        g.add(base);
        return g;
    }

    // ── Cave entrance mesh ────────────────────────────────────────────────────
    private makeCaveEntrance(): THREE.Group {
        const g    = new THREE.Group();
        const rock = new THREE.MeshPhongMaterial({ color: 0x37474F, flatShading: true });
        const dark = new THREE.MeshBasicMaterial({ color: 0x000000 });

        // Two pillars
        for (const sx of [-0.7, 0.7]) {
            const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.2, 5), rock);
            pillar.position.set(sx, 1.1, 0);
            pillar.castShadow = true;
            g.add(pillar);
        }

        // Arch top
        const arch = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.25, 4, 8, Math.PI), rock);
        arch.position.set(0, 2.2, 0);
        arch.castShadow = true;
        g.add(arch);

        // Dark void inside
        const void_ = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.0), dark);
        void_.position.set(0, 1.0, 0.01);
        g.add(void_);

        // Atmospheric fog light inside
        const fogLight = new THREE.PointLight(0x001122, 0.6, 3);
        fogLight.position.set(0, 0.5, -0.5);
        g.add(fogLight);

        return g;
    }

    // ── Tree ──────────────────────────────────────────────────────────────────
    private makeTree(trunkHex: number, canopyHex: number): THREE.Group {
        const g = new THREE.Group();
        const trunkMat  = new THREE.MeshLambertMaterial({ color: trunkHex });
        const canopyMat = new THREE.MeshLambertMaterial({ color: canopyHex, flatShading: true });

        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 1.1, 5), trunkMat);
        trunk.position.y = 0.55;
        trunk.castShadow = true;

        const cone1 = new THREE.Mesh(new THREE.ConeGeometry(0.78, 1.6, 7), canopyMat);
        cone1.position.y = 1.7;
        cone1.castShadow = true;

        const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.56, 1.3, 7), canopyMat);
        cone2.position.y = 2.5;
        cone2.castShadow = true;

        g.add(trunk, cone1, cone2);
        return g;
    }

    private makeCactus(): THREE.Group {
        const g = new THREE.Group();
        const mat = new THREE.MeshLambertMaterial({ color: 0x388E3C });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 1.4, 6), mat);
        body.position.y = 0.7;
        const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.6, 5), mat);
        armL.position.set(-0.28, 0.9, 0); armL.rotation.z = Math.PI / 3;
        const armR = armL.clone(); armR.position.x = 0.28; armR.rotation.z = -Math.PI / 3;
        g.add(body, armL, armR);
        return g;
    }

    private makeMythicCrystal(): THREE.Group {
        const g = new THREE.Group();
        const mat = new THREE.MeshPhongMaterial({
            color: 0x9C27B0, emissive: 0x4A148C, emissiveIntensity: 0.4,
            transparent: true, opacity: 0.85, flatShading: true, shininess: 80,
        });
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), mat);
        crystal.position.y = 0.8; crystal.rotation.y = Math.PI / 4; crystal.castShadow = true;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 0.3, 6), mat);
        base.position.y = 0.15;
        g.add(crystal, base);
        return g;
    }

    public getConstructionMesh(type: string): THREE.Group {
        const group = new THREE.Group();
        if (type === 'house') {
            const body = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshLambertMaterial({ color: 0x8D6E63 }));
            const roof = new THREE.Mesh(new THREE.ConeGeometry(0.8,0.6,4), new THREE.MeshLambertMaterial({ color: 0x4E342E }));
            roof.position.y = 0.8; roof.rotation.y = Math.PI/4;
            group.add(body, roof);
        } else if (type === 'tower') {
            group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,3), new THREE.MeshLambertMaterial({ color: 0x78909C })));
        }
        return group;
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