import os
import json
from pywebpush import webpush, WebPushException

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY")
VAPID_CLAIMS = {
    "sub": os.environ.get("VAPID_SUB_MAIL")
}

def send_web_push(subscription_information: dict, message_data: dict):
    """
    Sends a web push notification to a single subscriber.
    """
    print(f"--- USING VAPID PRIVATE KEY: {VAPID_PRIVATE_KEY} ---")
    if not VAPID_PRIVATE_KEY:
        print("ERROR: VAPID_PRIVATE_KEY is not set. Skipping push notification.")
        return

    try:
        webpush(
            subscription_info=subscription_information,
            data=json.dumps(message_data),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS
        )
        print(f"SUCCESS: Push notification sent to {subscription_information['endpoint']}.")
    except WebPushException as ex:
        print(f"ERROR during push sending: {ex}")
        print(f"Response: {ex.response.text}")
