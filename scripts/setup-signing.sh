#!/bin/bash
# Create a self-signed code-signing identity in a DEDICATED keychain (not login), so the
# packaged app has a stable identity and macOS keeps its Screen Recording grant across
# rebuilds. Idempotent. No login-keychain password needed.
set -e
IDENTITY="Open Cluely Self-Signed"
KC="$HOME/Library/Keychains/open-cluely-signing.keychain-db"
KCPASS="open-cluely"
TMP="$(mktemp -d)"

if security find-identity -p codesigning | grep -q "$IDENTITY"; then
  echo "identity already present"; exit 0
fi

# 1. self-signed cert with code-signing extended key usage
cat > "$TMP/cert.conf" <<CONF
[req]
distinguished_name = dn
x509_extensions = v3
prompt = no
[dn]
CN = $IDENTITY
[v3]
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
basicConstraints = critical, CA:false
CONF
openssl req -x509 -newkey rsa:2048 -keyout "$TMP/key.pem" -out "$TMP/cert.pem" -days 3650 -nodes -config "$TMP/cert.conf" 2>/dev/null

# 2. dedicated keychain
security delete-keychain "$KC" 2>/dev/null || true
security create-keychain -p "$KCPASS" "$KC"
security set-keychain-settings "$KC"            # no auto-lock
security unlock-keychain -p "$KCPASS" "$KC"

# 3. import cert + key as PEM (avoids p12 MAC issues); allow codesign to use the key
security import "$TMP/cert.pem" -k "$KC" -A
security import "$TMP/key.pem" -k "$KC" -T /usr/bin/codesign -A
security set-key-partition-list -S apple-tool:,apple:,unsigned: -s -k "$KCPASS" "$KC" >/dev/null

# 4. add to the user keychain search list so codesign finds it
EXISTING=$(security list-keychains -d user | sed -e 's/[":]//g' | xargs)
security list-keychains -d user -s "$KC" $EXISTING

rm -rf "$TMP"
echo "=== codesigning identities ==="
security find-identity -p codesigning | grep "$IDENTITY" || { echo "SETUP FAILED"; exit 1; }
