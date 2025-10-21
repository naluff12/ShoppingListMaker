from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
import base64

def generate_vapid_keys():
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()

    private_key_bytes = private_key.private_numbers().private_value.to_bytes(32, "big")
    public_key_bytes = b"\x04" + public_key.public_numbers().x.to_bytes(32, "big") + public_key.public_numbers().y.to_bytes(32, "big")

    return {
        "private_key": base64.urlsafe_b64encode(private_key_bytes).rstrip(b"=").decode("utf-8"),
        "public_key": base64.urlsafe_b64encode(public_key_bytes).rstrip(b"=").decode("utf-8"),
    }

if __name__ == "__main__":
    keys = generate_vapid_keys()
    print("\n--- Copia y pega estas dos líneas en tu docker-compose.yml ---\n")
    print(f"VAPID_PUBLIC_KEY={keys['public_key']}")
    print(f"VAPID_PRIVATE_KEY={keys['private_key']}")
    print("\n-----------------------------------------------------------\n")