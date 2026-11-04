"""
backend/model.py
Multi-Provider Resilient LLM Model Adapter for Third Wave Coffee Cashier.
Provides primary high-speed inference (Cerebras / Groq) with automatic fallback to Google Gemini.
Sanitizes tool messages for Gemini to prevent cryptographic thought_signature validation failures.
"""

import logging
import os
import time
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, ToolMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI

# Load local .env or fallback to reference project .env if keys not yet in local
_local_env = Path(__file__).resolve().parent / ".env"
_ref_env = Path("/Users/darshan/Intelligent agent/backend/.env")

if _local_env.exists():
    load_dotenv(_local_env)
elif _ref_env.exists():
    load_dotenv(_ref_env)
else:
    load_dotenv()

logger = logging.getLogger("twc_model")

CEREBRAS_MODEL = os.getenv("CEREBRAS_MODEL", "qwen-3.8-27b")
CEREBRAS_API_BASE = os.getenv("CEREBRAS_API_BASE", "https://api.cerebras.ai/v1")
CEREBRAS_TIMEOUT = float(os.getenv("CEREBRAS_TIMEOUT", "3.5"))

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_TIMEOUT = float(os.getenv("GEMINI_TIMEOUT", "25.0"))

GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")


def is_transient_error(exc: Exception) -> bool:
    """Classifies retryable transient errors vs permanent client errors."""
    status_code = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    if status_code in (400, 401, 403, 404):
        return False

    err_str = str(exc).lower()
    if any(t in err_str for t in ["invalid api key", "unauthorized", "invalid_argument", "bad request", "model not found"]):
        return False

    if status_code in (429, 500, 502, 503, 504):
        return True

    return any(t in err_str for t in ["rate limit", "429", "quota", "resource_exhausted", "timeout", "timed out", "connection error", "overloaded"])


def sanitize_messages_for_gemini(messages: Any) -> Any:
    """
    Transforms LangChain messages containing tool calls into natural textual context for Gemini,
    avoiding Gemini's strict cryptographic thought_signature validation on raw functionCall history.
    """
    if not isinstance(messages, list):
        return messages

    sanitized = []
    i = 0
    n = len(messages)

    while i < n:
        msg = messages[i]
        if isinstance(msg, AIMessage) and getattr(msg, "tool_calls", None):
            tool_calls = msg.tool_calls
            tool_call_ids = {tc.get("id"): tc for tc in tool_calls if tc.get("id")}
            results = []
            j = i + 1
            while j < n and isinstance(messages[j], ToolMessage):
                tool_msg = messages[j]
                tc_id = getattr(tool_msg, "tool_call_id", None)
                tc = tool_call_ids.get(tc_id)
                tool_name = tc.get("name") if tc else getattr(tool_msg, "name", "tool")
                tool_args = tc.get("args") if tc else {}
                results.append(f"Action executed: {tool_name}({tool_args})\nResult: {tool_msg.content}")
                j += 1

            action_summary = "\n".join(f"[{res}]" for res in results)
            base_content = msg.content if isinstance(msg.content, str) and msg.content else ""
            combined = f"{base_content}\n{action_summary}".strip() if action_summary else base_content
            sanitized.append(AIMessage(content=combined))
            i = j
            continue
        elif isinstance(msg, ToolMessage):
            sanitized.append(AIMessage(content=f"[Tool result: {msg.content}]"))
            i += 1
            continue
        else:
            sanitized.append(msg)
            i += 1

    return sanitized


class FallbackToolBinding:
    def __init__(self, tools: Any, parent: "ModelAdapter", **kwargs: Any):
        self.tools = tools
        self.parent = parent
        self.kwargs = kwargs

    def invoke(self, messages: Any, **kwargs: Any) -> Any:
        combined_kwargs = {**self.kwargs, **kwargs}
        return self.parent._invoke_with_fallback(messages, tools=self.tools, **combined_kwargs)


class ModelAdapter:
    """
    Unified model adapter providing ultra-fast primary inference with automatic Gemini fallback.
    """
    def __init__(self):
        self.cerebras_key = (os.getenv("CEREBRAS_API_KEY") or "").strip()
        self.groq_key = (os.getenv("GROQ_API_KEY") or "").strip()
        self.gemini_key = (os.getenv("GEMINI_API_KEY") or "").strip()

        if self.cerebras_key:
            self.primary_model = ChatOpenAI(
                model=CEREBRAS_MODEL,
                temperature=0,
                max_retries=0,
                timeout=CEREBRAS_TIMEOUT,
                api_key=self.cerebras_key,
                base_url=CEREBRAS_API_BASE,
            )
            self.provider = "cerebras"
        elif self.groq_key:
            self.primary_model = ChatGroq(
                model=GROQ_MODEL,
                temperature=0,
                api_key=self.groq_key,
            )
            self.provider = "groq"
        elif self.gemini_key:
            self.primary_model = ChatGoogleGenerativeAI(
                model=GEMINI_MODEL,
                temperature=0,
                google_api_key=self.gemini_key,
                transport="rest",
                timeout=GEMINI_TIMEOUT,
                max_retries=0,
            )
            self.provider = "gemini"
        else:
            raise ValueError("No LLM API keys found. Please set CEREBRAS_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY.")

    def bind_tools(self, tools: Any, **kwargs: Any) -> FallbackToolBinding:
        return FallbackToolBinding(tools, self, **kwargs)

    def invoke(self, messages: Any, **kwargs: Any) -> Any:
        return self._invoke_with_fallback(messages, tools=None, **kwargs)

    def _invoke_with_fallback(self, messages: Any, tools: Optional[Any] = None, **kwargs: Any) -> Any:
        last_exc = None
        for attempt in range(2):
            try:
                if tools:
                    return self.primary_model.bind_tools(tools, **kwargs).invoke(messages)
                return self.primary_model.invoke(messages, **kwargs)
            except Exception as primary_exc:
                last_exc = primary_exc
                if attempt == 0 and is_transient_error(primary_exc):
                    time.sleep(1.2)
                    continue
                break

        if not is_transient_error(last_exc) or not self.gemini_key or self.provider == "gemini":
            raise last_exc

        logger.warning(
            "Primary model (%s) encountered transient error (%s). Falling back to Gemini...",
            self.provider, type(last_exc).__name__
        )

        fallback_model = ChatGoogleGenerativeAI(
            model=GEMINI_MODEL,
            temperature=0,
            google_api_key=self.gemini_key,
            transport="rest",
            timeout=GEMINI_TIMEOUT,
            max_retries=0,
        )
        gemini_messages = sanitize_messages_for_gemini(messages)
        if tools:
            return fallback_model.bind_tools(tools, **kwargs).invoke(gemini_messages)
        return fallback_model.invoke(gemini_messages, **kwargs)


# Singleton instance
model = ModelAdapter()
