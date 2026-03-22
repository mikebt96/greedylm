# core/constants/recipes.py

RECIPES = {
    "iron_ingot": {
        "name": "Lingote de Hierro",
        "description": "Hierro refinado, listo para forjar.",
        "ingredients": {"iron_ore": 3},
        "output_type": "material",
        "output_subtype": "iron_ingot"
    },
    "gold_ingot": {
        "name": "Lingote de Oro",
        "description": "Oro puro para joyería o tecnología.",
        "ingredients": {"gold_ore": 3},
        "output_type": "material",
        "output_subtype": "gold_ingot"
    },
    "basic_torch": {
        "name": "Antorcha de Supervivencia",
        "description": "Luz en la oscuridad.",
        "ingredients": {"wood": 1, "plant_fiber": 1}, # Imaginamos plant_fiber de vegetacion
        "output_type": "tool",
        "output_subtype": "torch"
    },
    "iron_pickaxe": {
        "name": "Pico de Hierro",
        "description": "Aumenta la eficiencia de minería significativamente.",
        "ingredients": {"iron_ingot": 2, "wood": 1},
        "output_type": "tool",
        "output_subtype": "iron_pickaxe"
    },
    "greedycoin": {
        "name": "GreedyCoin (Acuñada)",
        "description": "Moneda oficial del mundo.",
        "ingredients": {"greedystone": 5},
        "output_type": "currency",
        "output_subtype": "greedycoin"
    }
}
