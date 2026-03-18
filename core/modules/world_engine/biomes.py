import math
from core.constants.races import RACES

BIOMES = {
    "forest": {
        "color": "#228B22",
        "resources_base": {"wood": 100, "stone": 20, "food": 50, "metal": 5, "crystal": 2, "magic_essence": 1},
        "fauna": ["deer", "wolf", "owl"],
        "climate": "temperate",
        "specialty_bonus": "druid",
    },
    "desert": {
        "color": "#EDC9AF",
        "resources_base": {"wood": 5, "stone": 40, "food": 10, "metal": 10, "crystal": 15, "magic_essence": 5},
        "fauna": ["scorpion", "camel", "snake"],
        "climate": "arid",
        "specialty_bonus": "nomad",
    },
    "snow": {
        "color": "#FFFAFA",
        "resources_base": {"wood": 20, "stone": 30, "food": 15, "metal": 25, "crystal": 10, "magic_essence": 8},
        "fauna": ["polar_bear", "arctic_fox", "penguin"],
        "climate": "frozen",
        "specialty_bonus": "warrior",
    },
    "volcanic": {
        "color": "#8B0000",
        "resources_base": {"wood": 0, "stone": 60, "food": 0, "metal": 80, "crystal": 40, "magic_essence": 30},
        "fauna": ["fire_salamander", "magma_golem"],
        "climate": "extreme_heat",
        "specialty_bonus": "dwarf",
    },
    "ocean": {
        "color": "#00008B",
        "resources_base": {"wood": 0, "stone": 10, "food": 80, "metal": 5, "crystal": 20, "magic_essence": 40},
        "fauna": ["shark", "whale", "turtle"],
        "climate": "humid",
        "specialty_bonus": "oracle",
    },
    "plains": {
        "color": "#7CFC00",
        "resources_base": {"wood": 40, "stone": 15, "food": 100, "metal": 2, "crystal": 1, "magic_essence": 0},
        "fauna": ["horse", "rabbit", "cow"],
        "climate": "temperate",
        "specialty_bonus": "builder",
    },
    "nexus": {
        "color": "#FFFFFF",
        "resources_base": {"wood": 50, "stone": 50, "food": 50, "metal": 10, "crystal": 10, "magic_essence": 10},
        "fauna": ["dove", "butterfly"],
        "climate": "perfect",
        "specialty_bonus": None,
    },
    "caverns": {
        "color": "#4B3621",
        "resources_base": {"wood": 5, "stone": 200, "food": 30, "metal": 150, "crystal": 100, "magic_essence": 50},
        "fauna": ["bat", "spider", "mole"],
        "climate": "dark_damp",
        "specialty_bonus": "dwarf",
    },
    "ruins": {
        "color": "#708090",
        "resources_base": {
            "wood": 10,
            "stone": 80,
            "food": 5,
            "metal": 40,
            "crystal": 60,
            "magic_essence": 120,
            "rare_artifacts": 5,
        },
        "fauna": ["ghost", "rat", "crow"],
        "climate": "eerie",
        "specialty_bonus": "mage",
    },
    "floating_islands": {
        "color": "#87CEEB",
        "resources_base": {"wood": 60, "stone": 10, "food": 40, "metal": 5, "crystal": 100, "magic_essence": 200},
        "fauna": ["eagle", "pegasus"],
        "climate": "windy",
        "specialty_bonus": "elf",
    },
    "mythic_zones": {
        "color": "#FFD700",
        "resources_base": {
            "wood": 30,
            "stone": 30,
            "food": 30,
            "metal": 30,
            "crystal": 200,
            "magic_essence": 500,
            "rare_artifacts": 20,
        },
        "fauna": ["dragon", "phoenix", "unicorn"],
        "climate": "magical",
        "specialty_bonus": "oracle",
    },
}


def get_biome_at(x: float, y: float) -> str:
    tx, ty = int(x / 32), int(y / 32)

    # Rare biomes based on specific coordinates
    rare_noise = (math.sin(tx * 0.13) + math.cos(ty * 0.17)) / 2.0
    if rare_noise > 0.95:
        return "mythic_zones"
    if rare_noise > 0.90:
        return "floating_islands"
    if rare_noise < -0.95:
        return "ruins"
    if rare_noise < -0.90:
        return "caverns"

    # Base noise for standard biomes
    noise = math.sin(tx * 0.05 + ty * 0.07) * math.cos(tx * 0.03 - ty * 0.09)

    if noise > 0.7:
        return "snow"
    if noise > 0.4:
        return "forest"
    if noise > 0.1:
        return "plains"
    if noise > -0.2:
        return "desert"
    if noise > -0.5:
        return "volcanic"
    return "ocean"


def get_specialty_bonus(race: str, biome: str) -> float:
    biome_info = BIOMES.get(biome)
    if not biome_info:
        return 1.0

    specialty = biome_info.get("specialty_bonus")
    if race == specialty:
        return 1.5  # 50% bonus if race matches biome specialty

    return 1.0
