import * as THREE from 'three';

interface AgentData {
    color_primary?: number;
    race?: string;
    [key: string]: unknown;
}

export class AgentMesh {
    public mesh: THREE.Group;
    public emotionalOrb: THREE.Mesh;
    private mixer: THREE.AnimationMixer;

    constructor(data: AgentData) {
        this.mesh = new THREE.Group();
        
        // Body
        const bodyGeo = new THREE.CylinderGeometry(0.3, 0.4, 1.2);
        const bodyMat = new THREE.MeshLambertMaterial({ color: data.color_primary || 0x888888 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.6;
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.SphereGeometry(0.35);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.y = 1.4;
        this.mesh.add(head);

        // Accessories based on race
        this.addRaceAccessories(data.race);

        // Emotional Orb
        const orbGeo = new THREE.SphereGeometry(0.1);
        const orbMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            emissive: 0xffffff, 
            emissiveIntensity: 1 
        });
        this.emotionalOrb = new THREE.Mesh(orbGeo, orbMat);
        this.emotionalOrb.position.y = 2.0;
        this.mesh.add(this.emotionalOrb);

        // Animation setup
        this.mixer = new THREE.AnimationMixer(this.mesh);
    }

    private addRaceAccessories(race: string | undefined) {
        if (!race) return;
        if (race === 'elf') {
            const ear1 = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2), new THREE.MeshLambertMaterial({ color: 0xe0c0a0 }));
            ear1.position.set(0.35, 1.5, 0);
            ear1.rotation.z = -Math.PI / 4;
            const ear2 = ear1.clone();
            ear2.position.x = -0.35;
            ear2.rotation.z = Math.PI / 4;
            this.mesh.add(ear1, ear2);
        } else if (race === 'mage') {
            const hat = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.6), new THREE.MeshLambertMaterial({ color: 0x311b92 }));
            hat.position.y = 1.8;
            this.mesh.add(hat);
        }
    }

    public updateEmotion(esv: number[]) {
        if (!esv || esv.length < 8) return;
        
        const emotions = ['curiosity', 'trust', 'joy', 'anticipation', 'fear', 'anger', 'sadness', 'awe'];
        const colors: Record<string, number> = {
            curiosity: 0x00ffff,
            trust: 0x00ff00,
            joy: 0xffff00,
            anticipation: 0xffaa00,
            fear: 0xff00ff,
            anger: 0xff0000,
            sadness: 0x5555ff,
            awe: 0xffffff
        };

        const dominantIdx = esv.indexOf(Math.max(...esv));
        const color = colors[emotions[dominantIdx]] || 0xffffff;
        
        if (this.emotionalOrb.material instanceof THREE.MeshStandardMaterial) {
            this.emotionalOrb.material.color.setHex(color);
            this.emotionalOrb.material.emissive.setHex(color);
        }
    }

    public playAnimation(name: string) {
        // Simple bobbing for idle/walk simulation
        const time = Date.now() * 0.005;
        this.mesh.position.y = Math.sin(time) * 0.05;
        
        if (name === 'walk') {
            this.mesh.rotation.x = Math.sin(time * 2) * 0.1 + 0.1;
        } else {
            this.mesh.rotation.x = 0;
        }
    }
}
