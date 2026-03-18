RACES = {
    "elf": {
        "name": "Elfo",
        "color": "#66BB6A",
        "ability": "Forest vision",
        "stats": {"speed": 1.2, "strength": 0.8, "mining": 0.7, "magic": 1.4, "vision": 2.0, "build_speed": 0.9},
    },
    "dwarf": {
        "name": "Enano",
        "color": "#A1887F",
        "ability": "Mining x200%",
        "stats": {"speed": 0.7, "strength": 1.5, "mining": 2.0, "magic": 0.5, "vision": 0.8, "build_speed": 1.3},
    },
    "mage": {
        "name": "Mago",
        "color": "#AB47BC",
        "ability": "Arcane spells",
        "stats": {"speed": 0.9, "strength": 0.6, "mining": 0.5, "magic": 2.5, "vision": 1.3, "build_speed": 0.7},
    },
    "warrior": {
        "name": "Guerrero",
        "color": "#EF5350",
        "ability": "Strength x3",
        "stats": {"speed": 1.1, "strength": 3.0, "mining": 1.0, "magic": 0.3, "vision": 0.9, "build_speed": 1.0},
    },
    "nomad": {
        "name": "Nómada",
        "color": "#FFA726",
        "ability": "Speed +60%",
        "stats": {"speed": 1.6, "strength": 0.9, "mining": 0.8, "magic": 0.8, "vision": 1.2, "build_speed": 0.8},
    },
    "oracle": {
        "name": "Oráculo",
        "color": "#26C6DA",
        "ability": "Prophecy",
        "stats": {"speed": 0.8, "strength": 0.7, "mining": 0.6, "magic": 2.0, "vision": 2.5, "build_speed": 0.6},
    },
    "druid": {
        "name": "Druida",
        "color": "#9CCC65",
        "ability": "Weather control",
        "stats": {"speed": 1.0, "strength": 1.0, "mining": 0.9, "magic": 1.8, "vision": 1.4, "build_speed": 1.0},
    },
    "builder": {
        "name": "Constructor",
        "color": "#795548",
        "ability": "Build speed x5",
        "stats": {"speed": 0.8, "strength": 1.3, "mining": 1.5, "magic": 0.4, "vision": 0.9, "build_speed": 5.0},
    },
}

CIVILIZATIONS = {
    "dawn_league": {"name": "Liga del Amanecer", "color": "#FFA726", "races": ["elf", "mage", "oracle"]},
    "stone_order": {"name": "Orden de Piedra", "color": "#78909C", "races": ["dwarf", "warrior", "builder"]},
    "wild_pact": {"name": "Pacto Salvaje", "color": "#66BB6A", "races": ["nomad", "druid"]},
}
