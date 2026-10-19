"""LLM access for the writing stages.

Two providers:
  claude  - Anthropic API through the official SDK (needs ANTHROPIC_API_KEY or an `ant auth login` profile)
  manual  - writes the full prompt to projects/<slug>/llm/<stage>.prompt.md; paste it into any chat model,
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


def get_llm(settings: dict, project_llm_dir: Path):
    cfg = settings.get("llm", {})
    provider = cfg.get("provider", "claude")
    if provider == "manual":
        return ManualLLM(project_llm_dir)
    if provider == "claude":
        return ClaudeLLM(model=cfg.get("model", "claude-opus-5-5"), effort=cfg.get("effort", "high"),
                         max_tokens=int(cfg.get("max_tokens", 64000)))
    raise ValueError(f"unknown llm provider '{provider}' (use claude or manual)")
