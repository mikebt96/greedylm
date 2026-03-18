import asyncio
import sys
import os

# Set loop policy for Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Add root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "core")))

from alembic.config import Config
from alembic import command


def run_upgrade():
    alembic_cfg = Config("core/alembic.ini")
    alembic_cfg.set_main_option("script_location", "core/migrations")
    print("Running alembic upgrade head...")
    try:
        command.upgrade(alembic_cfg, "head")
        print("Success!")
    except Exception as e:
        print(f"Failed: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    run_upgrade()
