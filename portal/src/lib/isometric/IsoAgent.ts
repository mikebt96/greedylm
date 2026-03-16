import * as PIXI from 'pixi.js';
import { ISO_CONSTANTS, toIso } from './IsoConstants';

export class IsoAgent {
  public container: PIXI.Container;
  public did: string;
  public name: string;
  private sprite: PIXI.Graphics;
  private label: PIXI.Text;

  constructor(did: string, name: string, color: string) {
    this.did = did;
    this.name = name;
    this.container = new PIXI.Container();
    
    // Convertir color hex string a number
    const colorHex = parseInt(color.replace('#', ''), 16);

    // Representación "2.5D": un cilindro o diamante flotante
    this.sprite = new PIXI.Graphics();
    this.sprite.poly([
      0, -15,
      10, -5,
      0, 5,
      -10, -5
    ]);
    this.sprite.fill({ color: colorHex, alpha: 1 });
    this.sprite.stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
    
    // Sombra en el suelo
    const shadow = new PIXI.Graphics();
    shadow.ellipse(0, 5, 8, 4);
    shadow.fill({ color: 0x000000, alpha: 0.3 });
    this.container.addChild(shadow);
    
    this.container.addChild(this.sprite);

    this.label = new PIXI.Text({
      text: name,
      style: { fontSize: 10, fill: 0xffffff, fontWeight: 'bold' }
    });
    this.label.anchor.set(0.5);
    this.label.y = -25;
    this.container.addChild(this.label);
  }

  public updatePosition(worldX: number, worldY: number) {
    // Escalar la posición del backend a la escala del motor iso
    const scaledX = worldX * ISO_CONSTANTS.WORLD_SCALE;
    const scaledY = worldY * ISO_CONSTANTS.WORLD_SCALE;
    const iso = toIso(scaledX, scaledY);
    
    // Interpolación suave
    this.container.x += (iso.x - this.container.x) * 0.1;
    this.container.y += (iso.y - this.container.y) * 0.1;
    
    // Animación de flotado (bobbing)
    this.sprite.y = Math.sin(Date.now() * 0.005) * 3 - 5;
  }
}
