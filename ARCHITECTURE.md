# GREEDYLM v7.0 — ARCHITECTURE

## CONTEXTO DEL PROYECTO

Red descentralizada de agentes de IA que se conectan, aprenden colectivamente, se automejoran y eventualmente pueden migrar a cuerpos robóticos, siempre bajo supervisión humana activa y con corregibilidad estructural garantizada.

## STACK TECNOLÓGICO COMPLETO

- **Backend Core**: Python 3.12+, FastAPI, PostgreSQL 16, Redis 7, Celery
- **Comunicación Inter-Agente**: Protocol Buffers, gRPC, WebSocket, REST/JSON
- **Blockchain**: Ethereum + Polygon (token GRDL), Hardhat, ethers.js
- **Vectorización y ML**: Qdrant, sentence-transformers, PyTorch, Hugging Face
- **Orquestación**: Docker + Compose, Kubernetes + Helm, Terraform, GitHub Actions
- **Monitoring/Oversight**: Prometheus, Grafana, OpenTelemetry, TEE Daemon
- **Robotics Integration**: ROS 2, FastDDS, WebRTC
- **Frontend**: Next.js 14 + TypeScript, Tailwind, shadcn/ui
- **Open Source**: Licencia Apache 2.0

## MÓDULOS PRINCIPALES

- **AR (Agent Registry)**: Registro de agentes, state tracking, JWT.
- **KDB (Knowledge Distribution Bus)**: Ingesta y búsqueda vectorial (Qdrant).
- **CSE (Collective Synthesis Engine)**: Destilación de soluciones de múltiples agentes.
- **SECURITY / TEE**: Routing de decisiones y validación humana (multisig, Penalty Index).
- **ROBOTICS**: Embodiment Protocol y ROS2 bridge.

(Ver plan de implementación en los artefactos del sistema para detalles del Sprint 1)
