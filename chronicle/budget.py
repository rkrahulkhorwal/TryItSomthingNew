"""Spending guard for paid APIs.

Every paid call is priced *before* it is sent (worst case: full prompt + max output) and refused if it could
push the project past its cap (`budget_usd` in brief.yaml). The real cost reported by the API is then logged
to projects/<slug>/spend.json, so the cap holds across runs and `chronicle status` can show the bill.
"""

from __future__ import annotations

import json
import time
from pathlib import Path


class BudgetExceeded(RuntimeError):
    pass


class Ledger:
    def __init__(self, path: Path, cap_usd: float | None):
        self.path = path
        self.cap = float(cap_usd) if cap_usd not in (None, "", 0) else None
        self.data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"calls": []}

    @property
    def spent(self) -> float:
        return round(sum(float(c.get("cost") or 0) for c in self.data["calls"]), 6)

    def remaining(self, account_spent: float | None = None) -> float | None:
        if self.cap is None:
            return None
        return self.cap - max(self.spent, account_spent or 0.0)

    def check(self, reserve: float, what: str, account_spent: float | None = None) -> None:
        """Refuse a call whose worst-case cost does not fit in what is left of the cap."""
        left = self.remaining(account_spent)
        if left is not None and reserve > left:
            raise BudgetExceeded(
                f"{what}: could cost up to ${reserve:.3f} but only ${max(left, 0):.3f} of the "
                f"${self.cap:.2f} budget is left (spent ${self.cap - left:.3f}). Raise budget_usd in brief.yaml "
                "or switch to a cheaper model.")

    def record(self, *, stage: str, provider: str, model: str, cost: float, usage: dict | None = None,
               note: str = "") -> None:
        self.data["calls"].append({"time": time.strftime("%Y-%m-%dT%H:%M:%S"), "stage": stage, "provider": provider,
                                   "model": model, "cost": round(float(cost), 6), "usage": usage or {},
                                   **({"note": note} if note else {})})
        self.save()

    def save(self) -> None:
        self.data["cap_usd"] = self.cap
        self.data["spent_usd"] = self.spent
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.data, indent=2), encoding="utf-8")

    def summary(self) -> str:
        by_stage: dict[str, list[float]] = {}
        for c in self.data["calls"]:
            by_stage.setdefault(c["stage"].rstrip("0123456789_") or c["stage"], []).append(float(c.get("cost") or 0))
        lines = [f"  {k:<14} {len(v):3d} calls  ${sum(v):.4f}" for k, v in by_stage.items()]
        cap = f" of ${self.cap:.2f}" if self.cap is not None else ""
        return "\n".join(lines + [f"  total          ${self.spent:.4f}{cap}"])
