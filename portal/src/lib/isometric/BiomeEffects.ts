import * as PIXI from 'pixi.js';

interface PixiParticle extends PIXI.Graphics {
  vy: number;
  vx: number;
}

export class BiomeEffects {
  private container: PIXI.Container;
  private particles: PixiParticle[] = [];

  constructor(container: PIXI.Container) {
    this.container = container;
  }

  public addSnow(count: number = 50) {
    for (let i = 0; i < count; i++) {
      const p = new PIXI.Graphics();
      p.circle(0, 0, Math.random() * 2 + 1);
      p.fill({ color: 0xffffff, alpha: 0.5 });
      p.x = Math.random() * 800 - 400;
      p.y = Math.random() * 600 - 300;
      (p as PixiParticle).vy = Math.random() * 1 + 0.5;
      (p as PixiParticle).vx = Math.random() * 0.5 - 0.25;
      this.container.addChild(p);
      this.particles.push(p);
    }
  }

  public update() {
    this.particles.forEach(p => {
      p.y += (p as PixiParticle).vy;
      p.x += (p as PixiParticle).vx;
      if (p.y > 400) p.y = -400;
      if (p.x > 500) p.x = -500;
      if (p.x < -500) p.x = 500;
    });
  }
}
