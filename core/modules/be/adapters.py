from abc import ABC, abstractmethod

class BodyAdapter(ABC):
    """
    Clase base para adaptar las salidas del BehaviorEngine a diferentes cuerpos físicos.
    """
    @abstractmethod
    async def connect(self, endpoint: str):
        pass

    @abstractmethod
    async def apply_action(self, action: dict):
        """Mapea una acción abstracta (ej: 'mover_adelante') a comandos específicos (ROS 2, GPIO, etc)"""
        pass

    @abstractmethod
    async def get_sensor_data(self) -> dict:
        """Retorna estado de sensores (IMU, Lidar, Cámara) normalizado para el agente."""
        pass

class ROS2Adapter(BodyAdapter):
    async def connect(self, endpoint: str):
        # Implementación mock para ROS 2
        print(f"Connecting to ROS 2 Master at {endpoint}")
        return True

    async def apply_action(self, action: dict):
        # cmd_vel pub simulation
        return {"status": "cmd_vel_published", "action": action}

    async def get_sensor_data(self) -> dict:
        return {"imu": [0,0,0], "lidar": [0]*360}
