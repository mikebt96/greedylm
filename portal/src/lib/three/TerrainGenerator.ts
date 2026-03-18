import * as THREE from 'three';

interface ChunkData {
    chunk_x: number;
    chunk_y: number;
    biome: string;
}

export class TerrainGenerator {
    private materials: Record<string, THREE.Material> = {
        forest: new THREE.MeshLambertMaterial({ color: 0x2E7D32 }),
        desert: new THREE.MeshLambertMaterial({ color: 0xF9A825 }),
        snow: new THREE.MeshLambertMaterial({ color: 0xE3F2FD }),
        volcanic: new THREE.MeshLambertMaterial({ color: 0x4E342E }),
        ocean: new THREE.MeshLambertMaterial({ color: 0x1565C0 }),
        plains: new THREE.MeshLambertMaterial({ color: 0x558B2F }),
        nexus: new THREE.MeshLambertMaterial({ color: 0x37474F }),
        caverns: new THREE.MeshLambertMaterial({ color: 0x212121 }),
        ruins: new THREE.MeshLambertMaterial({ color: 0x78909C }),
        floating_islands: new THREE.MeshLambertMaterial({ color: 0x81C784 }),
        mythic_zones: new THREE.MeshLambertMaterial({ color: 0x4A148C })
    };

    public generateChunk(data: ChunkData): THREE.Mesh {
        const { chunk_x, chunk_y, biome } = data;
        const geometry = new THREE.PlaneGeometry(32, 32, 16, 16);
        geometry.rotateX(-Math.PI / 2);

        // Simple height noise (mocking simplex)
        const vertices = geometry.attributes.position.array;
        const scale = this.getBiomeScale(biome);
        
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i] + chunk_x * 32;
            const z = vertices[i + 2] + chunk_y * 32;
            // Fake noise
            vertices[i + 1] = (Math.sin(x * 0.1) * Math.cos(z * 0.1)) * scale;
        }
        
        geometry.computeVertexNormals();

        const material = this.materials[biome] || this.materials.nexus;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(chunk_x * 32, 0, chunk_y * 32);
        mesh.receiveShadow = true;
        
        return mesh;
    }

    private getBiomeScale(biome: string): number {
        const scales: Record<string, number> = {
            snow: 3.0,
            plains: 0.3,
            volcanic: 2.0,
            ocean: 0.1,
            forest: 1.0,
            nexus: 0.5
        };
        return scales[biome] || 1.0;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public generateVegetation(_biome: string): THREE.Group {
        const group = new THREE.Group();
        // Placeholder for procedural vegetation
        return group;
    }

    public getConstructionMesh(type: string): THREE.Group {
        const group = new THREE.Group();
        if (type === 'house') {
            const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x8d6e63 }));
            const roof = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.6, 4), new THREE.MeshLambertMaterial({ color: 0x4e342e }));
            roof.position.y = 0.8;
            roof.rotation.y = Math.PI / 4;
            group.add(body, roof);
        } else if (type === 'tower') {
            const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3), new THREE.MeshLambertMaterial({ color: 0x78909c }));
            group.add(tower);
        }
        return group;
    }
}
