import asyncio
import json
from typing import AsyncGenerator, List

class StreamingCSE:
    """
    Provides real-time synthesis results by streaming 
    intermediate steps and final distillation.
    """
    async def synthesize_stream(self, problem: str, agents: List[str]) -> AsyncGenerator[str, None]:
        # 1. Initialization
        yield json.dumps({"status": "init", "message": f"Starting synthesis with {len(agents)} agents..."}) + "\n"
        await asyncio.sleep(0.5)

        # 2. Collection Stage
        solutions = []
        for i, agent in enumerate(agents):
            yield json.dumps({"status": "collecting", "agent": agent, "progress": f"{i+1}/{len(agents)}"}) + "\n"
            # Simulated collection delay
            await asyncio.sleep(0.2)
            solutions.append(f"Solution from {agent}")

        # 3. Distillation Stage
        yield json.dumps({"status": "distilling", "message": "Fusing solutions into final synthesis..."}) + "\n"

        # Simulate LLM streaming chunks
        final_text = "Synthesized collective intelligence result based on multiple agent perspectives."
        for word in final_text.split():
            yield json.dumps({"status": "streaming", "chunk": word + " "}) + "\n"
            await asyncio.sleep(0.1)

        # 4. Completion
        yield json.dumps({"status": "complete", "message": "Synthesis finished."}) + "\n"

streaming_cse = StreamingCSE()
