#!/usr/bin/env python3
"""
VU NOTES — Super Admin Bootstrap Script (Python 3)
Applies custom claims: { admin: true, superAdmin: true, role: 'superadmin' }
and writes Firestore audit record to /roles/{uid}.
"""

import sys
import os
import json
import base64
import time
import subprocess
import urllib.request
import urllib.parse
import urllib.error
import tempfile

def b64url(b):
    return base64.urlsafe_b64encode(b).decode("utf-8").rstrip("=")

def get_access_token(service_account_path):
    with open(service_account_path, "r", encoding="utf-8") as f:
        sa = json.load(f)

    now = int(time.time())
    header = {"alg": "RS256", "typ": "JWT"}
    payload = {
        "iss": sa["client_email"],
        "scope": "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore",
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now,
        "exp": now + 3600
    }

    unsigned_jwt = f"{b64url(json.dumps(header).encode())}.{b64url(json.dumps(payload).encode())}"

    # Sign using openssl
    with tempfile.NamedTemporaryFile("w", delete=False) as tf:
        tf.write(sa["private_key"])
        priv_key_file = tf.name

    try:
        p = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", priv_key_file],
            input=unsigned_jwt.encode(),
            capture_output=True,
            check=True
        )
        sig = b64url(p.stdout)
    finally:
        if os.path.exists(priv_key_file):
            os.unlink(priv_key_file)

    jwt_token = f"{unsigned_jwt}.{sig}"

    data = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": jwt_token
    }).encode("utf-8")

    req = urllib.request.Request("https://oauth2.googleapis.com/token", data=data)
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        return res["access_token"], sa["project_id"]

def lookup_user_by_email(access_token, email):
    url = "https://identitytoolkit.googleapis.com/v1/accounts:lookup"
    payload = json.dumps({"email": [email]}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            users = data.get("users", [])
            if not users:
                return None
            return users[0]
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        raise RuntimeError(f"User lookup failed: {err_msg}")

def set_custom_claims(access_token, uid, claims):
    url = "https://identitytoolkit.googleapis.com/v1/accounts:update"
    payload = json.dumps({
        "localId": uid,
        "customAttributes": json.dumps(claims)
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def write_firestore_role(access_token, project_id, uid, email, claims):
    url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/roles/{uid}"
    
    doc = {
        "fields": {
            "email": {"stringValue": email},
            "role": {"stringValue": claims["role"]},
            "admin": {"booleanValue": claims["admin"]},
            "superAdmin": {"booleanValue": claims["superAdmin"]},
            "grantedBy": {"stringValue": "cli_bootstrap_script"},
            "updatedAt": {"timestampValue": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        }
    }
    payload = json.dumps(doc).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        method="PATCH",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"⚠️  Firestore role record warning: {e.read().decode('utf-8')}")

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 scripts/set-admin-claim.py <serviceAccountKey.json> <email> [--superadmin | --admin]")
        sys.exit(1)

    sa_path = os.path.abspath(sys.argv[1])
    target_email = sys.argv[2].strip()
    is_super = True
    if "--admin" in sys.argv and "--superadmin" not in sys.argv:
        is_super = False

    if not os.path.exists(sa_path):
        print(f"❌ Service account key file not found: {sa_path}")
        sys.exit(1)

    print(f"🔑 Authenticating with service account...")
    access_token, project_id = get_access_token(sa_path)
    print(f"✅ Connected to Firebase Project: {project_id}")

    print(f"🔍 Looking up user in Firebase Auth: {target_email}...")
    user = lookup_user_by_email(access_token, target_email)
    if not user:
        print(f"❌ User '{target_email}' not found in Firebase Authentication.")
        print("   Please make sure the account is created first in Firebase Console or via your registration page.")
        sys.exit(1)

    uid = user["localId"]
    print(f"✅ Found account: UID {uid} ({target_email})")

    claims = {
        "admin": True,
        "superAdmin": is_super,
        "role": "superadmin" if is_super else "admin"
    }

    print(f"⚙️  Applying privileged custom claims: {json.dumps(claims)}...")
    set_custom_claims(access_token, uid, claims)
    print(f"✅ Auth custom claims updated successfully.")

    print(f"📝 Writing audit record to Firestore /roles/{uid}...")
    write_firestore_role(access_token, project_id, uid, target_email, claims)
    print(f"✅ Firestore audit record created: /roles/{uid}")

    # Verify written claims
    verified = lookup_user_by_email(access_token, target_email)
    raw_attrs = verified.get("customAttributes", "{}")
    verified_claims = json.loads(raw_attrs)

    print("\n" + "=" * 66)
    if is_super:
        print("🛡️  SUPER ADMIN INITIALIZATION SUCCESSFUL")
    else:
        print("🔑  ADMIN INITIALIZATION SUCCESSFUL")
    print("=" * 66)
    print(f"User:             {target_email}")
    print(f"UID:              {uid}")
    print(f"Role:             {verified_claims.get('role')}")
    print(f"admin:            {verified_claims.get('admin')}")
    print(f"superAdmin:       {verified_claims.get('superAdmin')}")
    print(f"Verified Claims:  {json.dumps(verified_claims, indent=2)}")
    print("=" * 66 + "\n")

if __name__ == "__main__":
    main()
