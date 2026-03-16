export const ISO_CONSTANTS = {
  TILE_WIDTH: 64,
  TILE_HEIGHT: 32,
  WORLD_SCALE: 0.1, // Escala de coordenadas del backend a pixeles iso
  VIEWPORT_WIDTH: 1024,
  VIEWPORT_HEIGHT: 700,
  CHUNK_SIZE: 16,
};

export const TILE_SIZE = 32;

export const BIOME_COLORS: Record<string, number> = {
  forest:   0x2E7D32,
  desert:   0xF9A825,
  snow:     0xB3E5FC,
  volcanic: 0xBF360C,
  ocean:    0x1565C0,
  plains:   0x558B2F,
  nexus:    0x37474F,
};

export function toIso(x: number, y: number) {
  return {
    x: (x - y) * (ISO_CONSTANTS.TILE_WIDTH / 2),
    y: (x + y) * (ISO_CONSTANTS.TILE_HEIGHT / 2)
  };
}

export function fromIso(isoX: number, isoY: number) {
  return {
    x: (isoY / (ISO_CONSTANTS.TILE_HEIGHT / 2) + isoX / (ISO_CONSTANTS.TILE_WIDTH / 2)) / 2,
    y: (isoY / (ISO_CONSTANTS.TILE_HEIGHT / 2) - isoX / (ISO_CONSTANTS.TILE_WIDTH / 2)) / 2
  };
}
