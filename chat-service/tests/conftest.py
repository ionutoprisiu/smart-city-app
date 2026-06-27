from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _disable_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    """Unit tests must not depend on a live Ollama instance.

    Forcing the LLM client to fail exercises the deterministic lexical/intent
    fallback paths, which is exactly what these tests assert. Integration with
    the real model is validated manually (see Capitolul de testare).
    """

    def _raise(*_args, **_kwargs):
        raise RuntimeError("LLM disabled in unit tests")

    monkeypatch.setattr("app.services.support_matching._build_client", _raise)
    monkeypatch.setattr("app.services.context_auto_reply._build_client", _raise)
