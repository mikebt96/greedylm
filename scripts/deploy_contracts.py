"""
Deploy Script para Sepolia Testnet (Mock)
"""

import asyncio


async def deploy():
    print("⛓️  Connecting to Sepolia via Alchemy/Infura...")
    await asyncio.sleep(1)

    print("🔑 Loading deployer wallet...")
    await asyncio.sleep(1)

    print("📜 Deploying GRDLToken.sol...")
    await asyncio.sleep(2)

    contract_address = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    print(f"✅ Contract deployed at: {contract_address}")

    # Guardar dirección para el backend
    with open("infrastructure/contracts.json", "w") as f:
        import json

        json.dump({"GRDLToken": contract_address}, f)


if __name__ == "__main__":
    asyncio.run(deploy())
