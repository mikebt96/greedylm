import os
import sys

# Add root directory to sys.path so 'core' is discoverable
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.main import app
