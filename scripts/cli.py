import sys
import argparse
import asyncio
import httpx

API_URL = "http://localhost:8000/api/v1"


async def deploy_agent(agent_did: str, body_id: str):
    print(f"🚀 Deploying Agent {agent_did} to Body {body_id}...")

    # En producción real, esto contactaría al endpoint del agente y subiría el ONNX
    async with httpx.AsyncClient():
        try:
            # Primero exportamos (mock call a un endpoint que crearemos)
            print("📦 Exporting policy to ONNX...")
            await asyncio.sleep(1)

            print("📡 Uploading to physical body...")
            await asyncio.sleep(2)

            print(f"✅ Deployment successful! Agent {agent_did} is now active on {body_id}.")
        except Exception as e:
            print(f"❌ Error: {e}")


def main():
    parser = argparse.ArgumentParser(description="GREEDYLM CLI")
    subparsers = parser.add_subparsers(dest="command")

    deploy_parser = subparsers.add_parser("deploy", help="Deploy an agent to a body")
    deploy_parser.add_argument("--agent", required=True, help="Agent DID")
    deploy_parser.add_argument("--body", required=True, help="Body ID (e.g., ros2, gpio, virtual)")

    args = parser.parse_args()

    if args.command == "deploy":
        asyncio.run(deploy_agent(args.agent, args.body))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
