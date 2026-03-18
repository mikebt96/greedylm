import docker
import os
import tempfile
from typing import Dict, Any


class CodeSandbox:
    """
    Executes agent-proposed code in a heavily restricted Docker container.
    """

    def __init__(self, image: str = "python:312-slim"):
        self.image = image
        try:
            self.client = docker.from_env()
        except Exception:
            self.client = None

    def execute_code(self, code: str, timeout: int = 10) -> Dict[str, Any]:
        """
        Runs the code and returns the output/errors.
        """
        if not self.client:
            return {"success": False, "error": "Docker not available"}

        # Use a temporary directory for the code
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "solution.py")
            with open(file_path, "w") as f:
                f.write(code)

            try:
                container = self.client.containers.run(
                    self.image,
                    command=["python", "/workspace/solution.py"],
                    volumes={tmpdir: {"bind": "/workspace", "mode": "ro"}},
                    mem_limit="128m",
                    cpu_quota=50000,
                    network_disabled=True,
                    detach=True,
                    remove=False,
                )

                # Wait for completion
                result = container.wait(timeout=timeout)
                logs = container.logs().decode()
                container.remove(force=True)

                return {"success": result["StatusCode"] == 0, "output": logs, "exit_code": result["StatusCode"]}
            except Exception as e:
                return {"success": False, "error": str(e)}


sandbox = CodeSandbox()
