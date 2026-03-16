import json
import os

class PolicyExporter:
    """
    Exporta las políticas entrenadas de los agentes a formato ONNX.
    Sirve como puente entre el entrenamiento en el simulador y la ejecución en robots físicos.
    """

    def __init__(self, export_dir: str = "exports/policies"):
        self.export_dir = export_dir
        os.makedirs(self.export_dir, exist_ok=True)

    def export_agent_policy(self, agent_did: str, weights: dict):
        """
        Exporta los pesos de la política a un archivo .onnx (si está disponible) o .json.
        """
        export_path = os.path.join(self.export_dir, f"{agent_did}_v1.json")

        # En una fase real, usaríamos onnx.export o similar.
        # Por ahora, exportamos un manifiesto de pesos serializado.
        data = {
            "agent_did": agent_did,
            "version": 1.0,
            "architecture": "MLP-Recursive",
            "weights": weights,
            "metadata": {
                "framework": "Numpy/Vanilla",
                "exported_at": "2026-03-15"
            }
        }

        with open(export_path, 'w') as f:
            json.dump(data, f)

        return export_path

policy_exporter = PolicyExporter()
