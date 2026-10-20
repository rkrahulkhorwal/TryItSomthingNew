"""LLM access for the writing stages.

Providers:
  claude      - Anthropic API through the official SDK (needs ANTHROPIC_API_KEY or an `ant auth login` profile)
  openrouter  - any OpenRouter model (env OPENROUTER_API_KEY), every call priced against the project budget
  manual      - writes the full prompt to projects/<slug>/llm/<stage>.prompt.md; paste it into any chat model,
            save the answer as <stage>.response.md (or .json) and re-run the same command.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from chronicle.paths import PROMPTS_DIR


class ManualStepRequired(RuntimeError):
    """Raised by the manual provider when a response file still has to be pasted in."""


class LLMRefusal(RuntimeError):
    pass


def render_template(name: str, variables: dict) -> tuple[str, str]:
    """Load prompts/<name>.md and fill {{variables}}. Returns (system, user).

    A template may contain a `<!-- SYSTEM -->` ... `<!-- USER -->` split; otherwise everything is the user part.
    """
    text = (PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8")

    def sub(m):
        key = m.group(1).strip()
        val = variables.get(key, "")
        return val if isinstance(val, str) else json.dumps(val, indent=2, ensure_ascii=False)

    text = re.sub(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", sub, text)
    if "<!-- SYSTEM -->" in text and "<!-- USER -->" in text:
        system = text.split("<!-- SYSTEM -->", 1)[1].split("<!-- USER -->", 1)[0].strip()
        user = text.split("<!-- USER -->", 1)[1].strip()
        return system, user
    return "", text.strip()


def extract_json(text: str):
    """Parse JSON from a model answer (tolerates ```json fences and leading prose in manual mode)."""
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if m:
        text = m.group(1)
    start = min([i for i in (text.find("{"), text.find("[")) if i >= 0], default=0)
    return json.loads(text[start:])


class ClaudeLLM:
    def __init__(self, model: str = "claude-opus-5-5", effort: str = "high", max_tokens: int = 64000):
        import anthropic  # imported lazily so offline runs do not need the package

        self.anthropic = anthropic
        self.client = anthropic.Anthropic()
        self.model = model
        self.effort = effort
        self.max_tokens = max_tokens

    def complete(self, system: str, user: str, *, json_schema: dict | None = None, stage: str = "") -> str:
        output_config: dict = {"effort": self.effort}
        if json_schema is not None:
            output_config["format"] = {"type": "json_schema", "schema": json_schema}
        kwargs = dict(
            model=self.model,
            max_tokens=self.max_tokens,
            messages=[{"role": "user", "content": user}],
            output_config=output_config,
            # Server-side fallback: if a safety classifier declines, the API retries on Anthropic's
            # recommended fallback model inside the same call.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
        if system:
            kwargs["system"] = system
        with self.client.beta.messages.stream(**kwargs) as stream:
            message = stream.get_final_message()
        if message.stop_reason == "refusal":
            details = getattr(message, "stop_details", None)
            raise LLMRefusal(f"model declined the '{stage}' request: {getattr(details, 'explanation', '') or 'no details'}")
        if message.stop_reason == "max_tokens":
            raise RuntimeError(f"'{stage}' output hit max_tokens ({self.max_tokens}); raise llm.max_tokens")
        return "".join(b.text for b in message.content if b.type == "text")


class OpenRouterLLM:
    """Chat completions through OpenRouter. `stage_models` / `stage_effort` let cheap stages use cheap models."""

    def __init__(self, model: str, effort: str | None = "medium", max_tokens: int = 16000, ledger=None,
                 stage_models: dict | None = None, stage_effort: dict | None = None, audit_dir: Path | None = None):
        from chronicle.openrouter import OpenRouter

        self.client = OpenRouter(ledger)
        self.model, self.effort, self.max_tokens = model, effort, max_tokens
        self.stage_models, self.stage_effort = stage_models or {}, stage_effort or {}
        self.audit_dir = audit_dir

    def complete(self, system: str, user: str, *, json_schema: dict | None = None, stage: str = "") -> str:
        from chronicle.openrouter import estimate_tokens

        base = re.sub(r"_\d+$", "", stage)
        model = self.stage_models.get(base, self.model)
        effort = self.stage_effort.get(base, self.effort)
        price = self.client.pricing(model)
        reserve = (estimate_tokens(system, user) * price.get("prompt", 0)
                   + self.max_tokens * max(price.get("completion", 0), price.get("internal_reasoning", 0)))
        body: dict = {"model": model, "max_tokens": self.max_tokens,
                      "messages": ([{"role": "system", "content": system}] if system else [])
                      + [{"role": "user", "content": user}]}
        if effort and effort != "none":
            body["reasoning"] = {"effort": effort, "exclude": True}
        if json_schema is not None:
            body["response_format"] = {"type": "json_schema",
                                       "json_schema": {"name": base or "output", "strict": True, "schema": json_schema}}
        data = self.client.chat(body, stage=stage, reserve=reserve)
        choice = data["choices"][0]
        text = choice["message"].get("content") or ""
        if self.audit_dir is not None:  # keep every answer next to the prompts, like the manual provider does
            self.audit_dir.mkdir(parents=True, exist_ok=True)
            (self.audit_dir / f"{stage}.{model.split('/')[-1]}.md").write_text(text, encoding="utf-8")
        reason = choice.get("finish_reason") or choice.get("native_finish_reason")
        if reason in ("content_filter", "refusal"):
            raise LLMRefusal(f"model declined the '{stage}' request ({reason})")
        if reason == "length":
            raise RuntimeError(f"'{stage}' output hit max_tokens ({self.max_tokens}); raise llm.openrouter.max_tokens")
        return text


class ManualLLM:
    def __init__(self, folder: Path):
        self.folder = folder

    def complete(self, system: str, user: str, *, json_schema: dict | None = None, stage: str = "") -> str:
        self.folder.mkdir(parents=True, exist_ok=True)
        prompt_file = self.folder / f"{stage}.prompt.md"
        body = (f"# SYSTEM\n\n{system}\n\n# USER\n\n{user}\n" if system else user + "\n")
        if json_schema is not None:
            body += "\n\nReturn ONLY JSON that matches this schema:\n\n```json\n" + json.dumps(json_schema, indent=2) + "\n```\n"
        prompt_file.write_text(body, encoding="utf-8")
        for ext in ("json", "md", "txt"):
            resp = self.folder / f"{stage}.response.{ext}"
            if resp.exists() and resp.stat().st_size > 0:
                return resp.read_text(encoding="utf-8")
        raise ManualStepRequired(
            f"Manual LLM step '{stage}': paste {prompt_file} into any chat model and save its answer as "
            f"{self.folder / (stage + '.response.md')} (or .json), then run the command again."
        )


def get_llm(settings: dict, project_llm_dir: Path, ledger=None):
    cfg = settings.get("llm", {})
    provider = cfg.get("provider", "claude")
    if provider == "manual":
        return ManualLLM(project_llm_dir)
    if provider == "openrouter":
        sub = cfg.get("openrouter", {}) or {}
        return OpenRouterLLM(model=sub.get("model", "anthropic/claude-opus-5.5"), effort=sub.get("effort", "medium"),
                             max_tokens=int(sub.get("max_tokens", 16000)), ledger=ledger,
                             stage_models=sub.get("stage_models"), stage_effort=sub.get("stage_effort"),
                             audit_dir=project_llm_dir)
    if provider == "claude":
        return ClaudeLLM(model=cfg.get("model", "claude-opus-5-5"), effort=cfg.get("effort", "high"),
                         max_tokens=int(cfg.get("max_tokens", 64000)))
    raise ValueError(f"unknown llm provider '{provider}' (use claude, openrouter or manual)")
