import pytest
from httpx import AsyncClient
from core.main import app

@pytest.mark.asyncio
async def test_root_endpoint():
    """Verify that the root endpoint is online and returns correct version."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"
    assert "version" in response.json()

@pytest.mark.asyncio
async def test_health_endpoint():
    """Verify that the health check is accessible."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code in [200, 503] # Healthy or Degraded are both valid responses for existence
    assert "status" in response.json()
