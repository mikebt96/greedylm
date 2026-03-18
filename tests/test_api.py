import pytest
import os
from httpx import AsyncClient, ASGITransport
from core.main import app


@pytest.mark.asyncio
async def test_root_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/")
    assert response.status_code == 200
    data = response.json()
    assert (
        data["status"] == "online" or data["status"] == "healthy"
    )  # El plan dice 'online' pero el fix S0 era a 'healthy'
    assert "version" in data


@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code in [200, 503]
    assert "status" in response.json()


@pytest.mark.asyncio
async def test_network_status():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/network/status")
    assert response.status_code == 200
    assert "system_state" in response.json()


@pytest.mark.asyncio
async def test_get_races():
    """Verifica que las constantes de razas están bien formadas."""
    from core.constants.races import RACES

    for race_key, race_data in RACES.items():
        assert "stats" in race_data
        assert "speed" in race_data["stats"]
        assert isinstance(race_data["stats"]["speed"], float)


def test_get_biome_returns_valid():
    from core.workers.world_tick import get_biome

    valid_biomes = {"snow", "forest", "plains", "desert", "volcanic", "ocean"}
    assert get_biome(0, 0) in valid_biomes
    assert get_biome(500, 500) in valid_biomes
    assert get_biome(9999, 9999) in valid_biomes
