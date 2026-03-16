from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
import base58
import hashlib

class DIDManager:
    """
    Handles W3C-compliant Decentralized Identifiers (DID).
    Foundation for cryptographically verifiable autonomous actions.
    """
    @staticmethod
    def generate_did_from_public_key(public_key_bytes: bytes) -> str:
        """
        did:greedylm:{base58(sha256(pubkey)[:20])}
        """
        hashed = hashlib.sha256(public_key_bytes).digest()
        encoded = base58.b58encode(hashed[:20]).decode()
        return f"did:greedylm:{encoded}"

    @staticmethod
    def verify_signature(public_key_hex: str, message: str, signature_hex: str) -> bool:
        try:
            public_key_bytes = bytes.fromhex(public_key_hex)
            public_key = Ed25519PublicKey.from_public_bytes(public_key_bytes)

            signature = bytes.fromhex(signature_hex)
            public_key.verify(signature, message.encode())
            return True
        except Exception:
            return False

    @staticmethod
    def create_did_document(did: str, public_key_hex: str) -> dict:
        return {
            "@context": ["https://www.w3.org/ns/did/v1"],
            "id": did,
            "verificationMethod": [{
                "id": f"{did}#key-1",
                "type": "Ed25519VerificationKey2020",
                "controller": did,
                "publicKeyMultibase": f"z{public_key_hex}"
            }],
            "authentication": [f"{did}#key-1"]
        }
