import math
from typing import Tuple

class MetaversePhysics:
    """
    Lightweight backend physics for agent movement and zone detection.
    """
    def __init__(self, world_width: int = 3000, world_height: int = 2000):
        self.world_width = world_width
        self.world_height = world_height
        self.zones = [
            {"id": "crystal_peaks", "rect": (0, 0, 1000, 1000)},
            {"id": "market_plaza", "rect": (1000, 0, 2000, 1000)},
            {"id": "empathy_grove", "rect": (0, 1000, 1500, 2000)},
            {"id": "forge_center", "rect": (1500, 1000, 3000, 2000)},
        ]

    def get_zone_at(self, x: float, y: float) -> str:
        for zone in self.zones:
            x1, y1, x2, y2 = zone["rect"]
            if x1 <= x < x2 and y1 <= y < y2:
                return zone["id"]
        return "wilderness"

    def calculate_repulsion(self, pos_a: Tuple[float, float], pos_b: Tuple[float, float], radius: float = 50.0) -> Tuple[float, float]:
        """
        Simple soft repulsion force between two agents.
        """
        dx = pos_b[0] - pos_a[0]
        dy = pos_b[1] - pos_a[1]
        dist = math.sqrt(dx*dx + dy*dy)

        if 0 < dist < radius * 2:
            force = (radius * 2 - dist) / (radius * 2) * 2.0
            return (-(dx/dist) * force, -(dy/dist) * force)
        return (0.0, 0.0)

physics_engine = MetaversePhysics()
