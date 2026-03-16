import * as PIXI from 'pixi.js';
import { ISO_CONSTANTS, toIso } from './IsoConstants';

export class IsoEngine {
  public app: PIXI.Application;
  public world: PIXI.Container;
  public tileLayer: PIXI.Container;
  public agentLayer: PIXI.Container;
  public effectsLayer: PIXI.Container;

  constructor(app: PIXI.Application) {
    this.app = app;
    this.world = new PIXI.Container();
    this.tileLayer = new PIXI.Container();
    this.agentLayer = new PIXI.Container();
    this.effectsLayer = new PIXI.Container();

    this.world.addChild(this.tileLayer);
    this.world.addChild(this.agentLayer);
    this.world.addChild(this.effectsLayer);
    this.app.stage.addChild(this.world);
    
    // Centrar inicialmente
    this.world.x = app.canvas.width / 2;
    this.world.y = 100;
  }

  public addTile(tx: number, ty: number, color: number) {
    const iso = toIso(tx, ty);
    const tile = new PIXI.Graphics();
    
    // Dibujar diamante (rombo)
    tile.poly([
      0, -ISO_CONSTANTS.TILE_HEIGHT / 2,
      ISO_CONSTANTS.TILE_WIDTH / 2, 0,
      0, ISO_CONSTANTS.TILE_HEIGHT / 2,
      -ISO_CONSTANTS.TILE_WIDTH / 2, 0
    ]);
    
    tile.fill({ color, alpha: 0.9 });
    tile.stroke({ width: 1, color: 0x000000, alpha: 0.1 });
    
    tile.x = iso.x;
    tile.y = iso.y;
    
    this.tileLayer.addChild(tile);
  }

  public updateCamera(dx: number, dy: number) {
    this.world.x += dx;
    this.world.y += dy;
  }
}
