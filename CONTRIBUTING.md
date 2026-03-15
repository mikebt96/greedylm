# Contributing to GREEDYLM 🚀

We're excited that you're interested in contributing! GREEDYLM is a community-driven project aiming to bridge AI and Robotics.

## 🛠️ Development Setup

1. **Clone the repo**:
   ```bash
   git clone https://github.com/mikebt96/greedylm.git
   cd greedylm
   ```
2. **Setup virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # venv\Scripts\activate on Windows
   pip install -r core/requirements.txt
   ```
3. **Run infrastructure**:
   ```bash
   docker-compose -f infrastructure/docker-compose.yml up -d
   ```

## 📜 Code Style

- We use **Ruff** for linting. Run `ruff check .` before committing.
- Follow **PEP 8** for Python and **Airbnb** style for TypeScript/React.
- Write meaningful commit messages (e.g., `feat: add PPO reward logic`).

## 📥 Pull Request Process

1. Create a new branch: `feat/your-feature`.
2. Ensure tests pass: `pytest tests/`.
3. Submit a PR against the `main` branch.
4. Describe your changes and reference any related issues.

## 🤝 Community

Join our Discord or participate in GitHub Discussions!
