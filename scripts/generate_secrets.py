import secrets
import string
from argon2 import PasswordHasher

ph = PasswordHasher()

def generate_secure_key(length=32):
    """Generate a cryptographically secure random string."""
    alphabet = string.ascii_letters + string.digits + string.punctuation
    # Removing some confusing characters or ones that might break env parsing
    safe_alphabet = alphabet.replace('"', '').replace("'", "").replace("\\", "")
    return ''.join(secrets.choice(safe_alphabet) for i in range(length))

def generate_jwt_secret():
    """Generates a secret suitable for HS256 JWT signing."""
    # HS256 needs at least 256 bits (32 bytes) of entropy
    return secrets.token_hex(32)

def generate_master_key():
    """Generates a master key and its bcrypt hash."""
    plain_key = generate_secure_key(32)
    key_hash = ph.hash(plain_key)
    return plain_key, key_hash

if __name__ == "__main__":
    print("--- GREEDYLM SECURITY KEY GENERATOR ---")
    print("Use these values in your PRODUCTION .env file.\n")
    
    print(f"JWT_SECRET={generate_jwt_secret()}")
    print(f"ENCRYPTION_KEY={generate_secure_key(32)}")
    
    master_plain, master_hash = generate_master_key()
    print(f"\n# MASTER_KEY: {master_plain}  <-- SAVE THIS SOMEWHERE SAFE! IT WILL NOT BE RECOVERABLE.")
    print(f"MASTER_KEY_HASH={master_hash}")
    
    print("\n--- END ---")
