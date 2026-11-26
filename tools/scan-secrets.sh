#!/usr/bin/env bash
# scan-secrets.sh: refuse a tracked secret.
#
# Usage: bash tools/scan-secrets.sh   (exit 0 clean, exit 1 with the offenders)
#
# Why this exists: FotoGeometria needs no key, token or password at all. It has
# no server, and the deploy to GitHub Pages runs on the workflow's own token
# (PLANO.md §9). So anything below that matches is either a test value that
# belongs in tools/.secretscan-allow, with a reason, or a leak. Adapted from
# simut's tools/scan_secrets.sh, where a backup with the real Wi-Fi password
# reached a public repository on 2026-08-16: removing the FILE is not removing
# the SECRET, so both the file types and the contents are checked.
#
# It reads what Git tracks (the index), so a staged file counts and an ignored
# one does not.

set -u
cd "$(dirname "$0")/.."

ALLOW="tools/.secretscan-allow"
fail=0

report() {
  echo "SECRET GATE: $1"
  printf '%s\n' "$2" | sed 's/^/    /'
  fail=1
}

# Drops the lines an allowlist entry names (a fixed string per line; # starts
# a comment). Every entry is a value someone chose to publish.
allow() {
  local hits="$1"
  if [ -n "$hits" ] && [ -s "$ALLOW" ]; then
    while IFS= read -r ok; do
      [ -z "$ok" ] && continue
      case "$ok" in \#*) continue ;; esac
      hits=$(printf '%s\n' "$hits" | grep -vF -- "$ok" || true)
    done < "$ALLOW"
  fi
  printf '%s' "$hits"
}

# 1. File types that must never be tracked, whatever they hold.
bad=$(git ls-files \
  | grep -iE '\.(pem|key|p8|p12|pfx|jks|keystore)$|(^|/)id_(rsa|dsa|ecdsa|ed25519)$|(^|/)\.env(\..+)?$' \
  | grep -vE '(^|/)\.env\.example$' || true)
[ -n "$bad" ] && report "these file types must not be tracked:" "$bad"

# 2. Private keys by content. The marker alone is not the secret: what makes a
# key a key is the body, base64 in runs far longer than source code writes. A
# file is reported only when it has both. The [E] keeps the pattern from
# matching this line.
pem=""
for f in $(git grep -I -l -e '-----BEGIN .*PRIVAT[E] KEY-----' -- . 2>/dev/null || true); do
  if git grep -I -q -E '[A-Za-z0-9+/]{40,}={0,2}' -- "$f" 2>/dev/null; then
    pem="${pem}${f}"$'\n'
  fi
done
[ -n "$pem" ] && report "private key material inside tracked files:" "${pem%$'\n'}"

# 3. Tokens with a recognisable shape: GitHub (classic and fine-grained), npm,
# AWS access keys, Slack and Google API keys. The character classes are split
# with [_] and [-] so this file does not match itself.
tokens=$(git grep -I -n -E \
  'gh[pousr][_][A-Za-z0-9]{36}|github[_]pat[_][A-Za-z0-9_]{60,}|npm[_][A-Za-z0-9]{36}|AKIA[0-9A-Z]{16}|xox[baprs][-][A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}' \
  -- . 2>/dev/null || true)
tokens=$(allow "$tokens")
[ -n "$tokens" ] && report "access tokens in tracked files:" "$tokens"

# 4. Literal credentials: name = "value". A literal starts with an
# alphanumeric, which skips placeholders (<token>) and the right form, a value
# read from the environment.
creds=$(git grep -I -n -i -E \
  "(pass|passwd|password|senha|contrase[ñn]a|secret|token|api_?key)[a-z_]*[[:space:]]*[:=][[:space:]]*['\"][A-Za-z0-9][^'\"]{5,}['\"]" \
  -- . ':!package-lock.json' 2>/dev/null || true)
creds=$(allow "$creds")
[ -n "$creds" ] && report "literal credentials in tracked files (read them from the environment, or allowlist in $ALLOW):" "$creds"

if [ "$fail" -ne 0 ]; then
  echo "SECRET GATE: FAILED"
  exit 1
fi
echo "SECRET GATE: clean ($(git ls-files | wc -l | tr -d ' ') tracked files)"
