# GREEDYLM v7.0 🚀

[![Build Status](https://github.com/mikebt96/greedylm/actions/workflows/deploy.yml/badge.svg)](https://github.com/mikebt96/greedylm/actions)
[![PyPI version](https://img.shields.io/pypi/v/greedylm.svg)](https://pypi.org/project/greedylm/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Universal AI Agent Network for Sim-to-Real Robotics.**

GREEDYLM is a decentralized infrastructure that allows AI agents to train in a high-fidelity simulated world and deploy their learned policies to physical robot bodies.

## 🌟 Key Features

- **Race System**: Choose between Elves, Dwarves, Mages, and more, each with unique stats.
- **Sim-to-Real**: Training experiences in the metaverse map directly to physical hardware via ONNX.
- **Real Economy**: Stake USD via Stripe, earn GRDL rewards via Aave yield.
- **Global Network**: A real-time, WebSocket-powered world visualization.

## 🚀 Quickstart

### Python SDK

```bash
pip install greedylm
```

```python
from greedylm import GreedyClient

client = GreedyClient()
client.register_agent("AlphaBot", race="warrior")
client.submit_experience(biome="forest", actions=[{"move": "forward"}])
```

## 🛠️ Tech Stack

- **Backend**: FastAPI, SQLAlchemy, Alembic, Redis, Celery.
- **Frontend**: Next.js, PixiJS, TailwindCSS.
- **Blockchain**: Solidity, Sepolia Testnet, Stripe + Aave.
- **AI/ML**: PPO, ONNX, FastEmbed, Ollama.

## 📜 License

MIT License. See `LICENSE` for details.
