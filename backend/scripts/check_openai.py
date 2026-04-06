"""
Verify OpenAI API key: list models + one tiny chat completion.

Loads .env from oscar-backend/ when run from repo root or from this folder.

Usage (PowerShell, from oscar-backend):
  python scripts/check_openai.py

Or with an explicit key:
  $env:OPENAI_API_KEY = "sk-..."
  python scripts/check_openai.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# oscar-backend/ (parent of scripts/)
_BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _load_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    env_path = _BACKEND_ROOT / ".env"
    if env_path.is_file():
        load_dotenv(env_path)


def main() -> int:
    _load_env()

    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        print("No OPENAI_API_KEY found. Set it in oscar-backend/.env or in the environment.")
        return 1

    try:
        from openai import OpenAI
    except ImportError:
        print("Install dependencies: pip install openai")
        return 1

    client = OpenAI(api_key=key)

    print("1) Listing models (validates key)...")
    try:
        listed = client.models.list()
        sample = [m.id for m in listed.data[:5]]
        print(f"   OK — sample model ids: {sample}")
    except Exception as e:
        print(f"   FAIL — {e}")
        return 1

    print("2) Tiny chat completion (validates quota / not only rate-limited on list)...")
    try:
        r = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Reply with exactly: ok"}],
            max_tokens=8,
        )
        text = (r.choices[0].message.content or "").strip()
        print(f"   OK — reply: {text!r}")
    except Exception as e:
        print(f"   FAIL — {e}")
        print("   Hints: 401 = bad key; 429 = often rate limit OR insufficient_quota (check error body); add billing in OpenAI dashboard if needed.")
        return 1

    print("\nAll checks passed: key works and a small completion succeeded.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
