"""OpenRouter (https://openrouter.ai): one key for hundreds of text and image models.

Used by the `openrouter` LLM and image providers. Every request is guarded by the project's Ledger:
  * worst-case price = prompt tokens x prompt price + max output x output price (from /api/v1/models)
  * the account's real usage (GET /api/v1/key) is compared with the usage when the project started,
    so even a call that never reported its cost (a timeout, a crash) still counts against the cap
  * the exact cost of each call (`usage.cost`) is logged to spend.json
Key: env OPENROUTER_API_KEY (also accepted: openrouter_key).
"""

from __future__ import annotations

import base64
import os
import time

from chronicle.budget import BudgetExceeded, Ledger

API = "https://openrouter.ai/api/v1"
_PRICING: dict[str, dict] = {}


def _price(v) -> float | None:
    try:
        p = float(v)
    except (TypeError, ValueError):
        return None
    return p if p >= 0 else None  # -1 marks variable pricing


def api_key() -> str:
    for name in ("OPENROUTER_API_KEY", "openrouter_key", "OPENROUTER_KEY"):
        if os.environ.get(name):
            return os.environ[name]
    raise RuntimeError("set OPENROUTER_API_KEY (https://openrouter.ai/keys)")


class OpenRouter:
    def __init__(self, ledger: Ledger | None, account_guard: bool = True):
        import requests

        self.requests = requests
        self.session = requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {api_key()}",
                                     "X-Title": "Chronicle explainers", "HTTP-Referer": "https://github.com/"})
        self.ledger = ledger
        self.account_guard = account_guard

    # ---- prices and budget -------------------------------------------------------------------------------
    def pricing(self, model: str) -> dict:
        if not _PRICING:
            r = self.session.get(f"{API}/models", timeout=60)
            r.raise_for_status()
            for m in r.json()["data"]:
                _PRICING[m["id"]] = {k: p for k, p in ((k, _price(v)) for k, v in (m.get("pricing") or {}).items())
                                     if p is not None}
        if model not in _PRICING:
            raise ValueError(f"OpenRouter has no model '{model}'")
        return _PRICING[model]

    def account_usage(self) -> float:
        r = self.session.get(f"{API}/key", timeout=60)
        r.raise_for_status()
        return float(r.json()["data"]["usage"])

    def guard(self, reserve: float, what: str) -> None:
        if self.ledger is None:
            return
        account_spent = None
        if self.account_guard and self.ledger.cap is not None:
            usage = self.account_usage()
            base = self.ledger.data.setdefault("openrouter_baseline_usd", usage)
            self.ledger.save()
            account_spent = usage - base
        self.ledger.check(reserve, what, account_spent)

    # ---- calls ---------------------------------------------------------------------------------------------
    def chat(self, body: dict, *, stage: str, reserve: float, timeout: int = 900) -> dict:
        self.guard(reserve, stage)
        body = {**body, "usage": {"include": True}}
        last = None
        for attempt in range(4):
            try:
                r = self.session.post(f"{API}/chat/completions", json=body, timeout=(30, timeout))
            except self.requests.RequestException as e:  # network trouble before an answer: re-check the budget
                last = e
                time.sleep(2 ** (attempt + 1))
                self.guard(reserve, stage)
                continue
            if r.status_code in (429, 502, 503, 504):
                last = RuntimeError(f"OpenRouter HTTP {r.status_code}: {r.text[:300]}")
                time.sleep(2 ** (attempt + 1))
                self.guard(reserve, stage)
                continue
            data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            if r.status_code != 200 or "error" in data:
                raise RuntimeError(f"OpenRouter HTTP {r.status_code}: {str(data.get('error') or r.text)[:500]}")
            usage = data.get("usage") or {}
            cost = usage.get("cost")
            if cost is None and data.get("id"):
                cost = self.generation_cost(data["id"])
            if self.ledger is not None:
                self.ledger.record(stage=stage, provider="openrouter", model=body["model"], cost=float(cost or 0),
                                   usage={k: usage.get(k) for k in ("prompt_tokens", "completion_tokens")} |
                                         {"reasoning_tokens": (usage.get("completion_tokens_details") or {}).get("reasoning_tokens")})
            return data
        raise RuntimeError(f"OpenRouter request failed after retries: {last}")

    def generation_cost(self, gen_id: str) -> float | None:
        for _ in range(5):
            time.sleep(1.5)
            r = self.session.get(f"{API}/generation", params={"id": gen_id}, timeout=60)
            if r.status_code == 200:
                return float(r.json()["data"].get("total_cost") or 0)
        return None


def estimate_tokens(*texts: str) -> int:
    return int(sum(len(t) for t in texts) / 3.0) + 50  # conservative: English runs ~4 chars per token


def data_url(path) -> str:
    from pathlib import Path

    p = Path(path)
    mime = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "webp": "webp"}.get(p.suffix.lower().lstrip("."), "png")
    return f"data:image/{mime};base64," + base64.b64encode(p.read_bytes()).decode()


__all__ = ["OpenRouter", "BudgetExceeded", "estimate_tokens", "data_url", "api_key"]
