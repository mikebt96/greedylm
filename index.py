import os
import sys

# Add the root directory to sys.path so 'core' can be found
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.main import app

# This is the entrypoint Vercel looks for
app = app
