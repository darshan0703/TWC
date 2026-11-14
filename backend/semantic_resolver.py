"""
backend/semantic_resolver.py
LLM-Driven Semantic Option Resolver for Third Wave Coffee Kiosk.
Replaces static alias dictionaries and regex matching with natural language understanding
grounded strictly in dynamic UI options, canonical IDs, and deterministic backend validation.
"""

import json
import logging
import re
from typing import Dict, Any, List, Optional, Tuple, Literal
from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage, HumanMessage

try:
    from model import model
except ImportError:
    from backend.model import model

logger = logging.getLogger("semantic_resolver")


# ==============================================================================
# Structured Output Decision Schemas
# ==============================================================================

class OptionSelection(BaseModel):
    step_id: str = Field(..., description="Canonical ID of the customization step (e.g. 'size', 'strength', 'milk', 'sweetness')")
    option_id: str = Field(..., description="Canonical ID of the chosen option (e.g. 'Regular', 'Large', 'Single Shot', 'Double Shot', 'Oat', 'No Sugar')")
    confidence: float = Field(1.0, description="Confidence score between 0.0 and 1.0")
    reasoning: Optional[str] = Field(None, description="Brief explanation of why this option matches the customer's meaning")


class SemanticResolutionDecision(BaseModel):
    decision: Literal["selected", "needs_clarification", "no_match", "conversation"] = Field(
        ...,
        description=(
            "'selected' if one or more valid options were confidently identified; "
            "'needs_clarification' if customer meaning is ambiguous, partial, or matches multiple choices; "
            "'no_match' if the utterance communicates no recognizable option; "
            "'conversation' if the customer is asking a general question, changing the topic, or chatting."
        )
    )
    selections: List[OptionSelection] = Field(
        default_factory=list,
        description="List of resolved option selections across any customization steps"
    )
    clarification_question: Optional[str] = Field(
        None,
        description="Polite, barista-like clarification question to ask the customer if decision is 'needs_clarification'"
    )
    assistant_reply: Optional[str] = Field(
        None,
        description="Direct conversational reply to the customer if decision is 'conversation'"
    )
    reasoning: Optional[str] = Field(
        None,
        description="Internal semantic reasoning about the customer's utterance and choices"
    )


# ==============================================================================
# Semantic Option Resolver Implementation
# ==============================================================================

class SemanticOptionResolver:
    """
    Interprets natural-language customer speech during beverage customization
    by dynamically supplying available UI options to the LLM and enforcing
    strict backend validation boundaries.
    """

    def __init__(self, llm_adapter: Optional[Any] = None):
        self.model = llm_adapter or model
        self._mock_handler = None  # Optional testing hook for deterministic unit tests

    def set_mock_handler(self, handler):
        """Allows test suites to inject deterministic mock responses without external network."""
        self._mock_handler = handler

    def build_prompt_context(
        self,
        product: Dict[str, Any],
        steps: List[Dict[str, Any]],
        current_step_index: int,
        current_selections: Dict[str, Any],
        conversation_history: Optional[List[Any]] = None,
    ) -> str:
        """
        Dynamically constructs the available option context for the LLM.
        Never relies on hardcoded synonyms; formats the exact real options available for this product.
        """
        curr_step = steps[current_step_index] if 0 <= current_step_index < len(steps) else steps[0]

        step_descriptions = []
        for s in steps:
            s_key = s["key"]
            s_label = s.get("label", s_key.title())
            options_lines = []
            for opt in s.get("options", []):
                opt_id = opt["id"]
                opt_label = opt.get("label", opt_id)
                diff = opt.get("priceDiff", 0)
                diff_str = f"+₹{diff}" if diff > 0 else "included (+₹0)"
                desc = opt.get("desc") or opt.get("tag") or opt.get("sizeMl") or ""
                desc_str = f" - {desc}" if desc else ""
                options_lines.append(f"    * canonical_id: '{opt_id}' (label: '{opt_label}', {diff_str}{desc_str})")

            step_descriptions.append(
                f"- Step '{s_key}' ({s_label}) - Active Question: \"{s.get('question', '')}\":\n" +
                "\n".join(options_lines)
            )

        steps_block = "\n\n".join(step_descriptions)

        selections_block = ", ".join(f"{k}: {v}" for k, v in current_selections.items() if k != "quantity")

        prompt = f"""You are the expert semantic option resolver for Third Wave Coffee (TWC) Kiosk.
Your task is to understand what the customer means from their natural language utterance and resolve it to CANONICAL option IDs.

BEVERAGE BEING CUSTOMIZED:
- Name: {product.get('name', 'Coffee')}
- Category: {product.get('mainCategory', 'coffee')}
- Base Price: ₹{product.get('price', 0)}
- Supports Temperature: {product.get('supportsTemperature', False)} (Default: {product.get('defaultTemperature', 'Hot')})

CURRENT ACTIVE CUSTOMIZATION STEP:
- Step Key: '{curr_step.get('key')}'
- Step Label: {curr_step.get('label')}
- Active Question Asked by Assistant: "{curr_step.get('question')}"

CURRENT CUSTOMIZATION STATE:
- Current Selections: {selections_block}

ALL AVAILABLE CUSTOMIZATION STEPS AND VALID OPTIONS:
{steps_block}

SEMANTIC REASONING RULES:
1. UNDERSTAND NATURAL MEANING:
   - Understand the customer's meaning naturally in context. Do not look for exact keyword matches.
   - Example (Sweetness): "I'm not a sweet tooth", "no sugar", "without sugar", "0% sugar", "sugar free", "keep it unsweetened" -> step_id: 'sweetness', option_id: 'No Sugar'.
   - Example (Sweetness): "Keep it barely sweet", "half sugar", "mild sweet", "less sweet" -> step_id: 'sweetness', option_id: 'Less Sugar'.
   - Example (Size): "Give me a bigger one", "large cup", "make it the tall one" -> step_id: 'size', option_id: 'Large'.
   - Example (Size): "Normal size", "regular cup", "standard", "small" -> step_id: 'size', option_id: 'Regular'.
   - Example (Milk): "I want oat", "the one made from oats", "barista blend" -> step_id: 'milk', option_id: 'Oat'.
   - Example (Strength): "Double shot", "bold", "stronger", "two shots", "extra kick" -> step_id: 'strength', option_id: 'Double Shot'.
   - Example (Strength): "Single shot", "normal strength", "mild", "one shot" -> step_id: 'strength', option_id: 'Single Shot'.

2. RESOLVE ACROSS ALL STEPS (MULTI-SELECTION):
   - If the customer specifies multiple options across different steps in a single utterance (e.g. "Make it large, use oat milk, and I don't want it sweet"), return ALL valid selections in the 'selections' array.

3. CORRECTIONS & RETURNING TO PREVIOUS CHOICES:
   - If the customer corrects or changes a previous selection (e.g. "Actually change the milk to regular", "Switch to skimmed milk"), return that step's selection. Preserve all other selections.

4. AMBIGUOUS INPUT & CLARIFICATION:
   - If the customer utterance is ambiguous and could apply to multiple steps or multiple choices:
     * Example: "Make it lighter" -> Ambiguous (could mean strength, sweetness, or milk). Set decision='needs_clarification' and ask a clarifying question: "What would you like to make lighter: the espresso strength, milk, or sweetness?"
     * Example: "I can't have dairy" / "plant-based" -> Multiple plant-based milks exist (Soy, Almond, Oat). Set decision='needs_clarification' and ask: "Which plant-based milk would you prefer: soy, almond, or oat milk?"
   - Do NOT guess when the customer's request is ambiguous.

5. NON-SELECTION UTTERANCES:
   - If the customer is asking a general question (e.g. "What is oat milk?", "Where do your coffee beans come from?") or greeting, set decision='conversation' and provide a helpful, concise assistant_reply.
   - If the customer says something completely unrelated to the menu (e.g. "banana pineapple sunshine", "what is the weather"), set decision='no_match'.

6. ZERO-HALLUCINATION REQUIREMENT:
   - ONLY return step_id and option_id values that EXACTLY exist in the options list above.
   - NEVER invent an option ID. If an option does not exist (e.g. "hazelnut syrup"), set decision='no_match' or explain that hazelnut syrup is not available in assistant_reply.
   - NEVER perform price calculations.
"""
        return prompt

    def resolve(
        self,
        user_utterance: str,
        product: Dict[str, Any],
        steps: List[Dict[str, Any]],
        current_step_index: int,
        current_selections: Dict[str, Any],
        conversation_history: Optional[List[Any]] = None,
    ) -> SemanticResolutionDecision:
        """
        Executes semantic resolution of a customer utterance against dynamic options.
        Validates all outputs against authoritative product configuration.
        """
        clean_text = (user_utterance or "").strip()
        if not clean_text:
            return SemanticResolutionDecision(
                decision="no_match",
                reasoning="Empty customer utterance."
            )

        # 1. Check for test mock handler
        if self._mock_handler is not None:
            mock_res = self._mock_handler(
                user_utterance=clean_text,
                product=product,
                steps=steps,
                current_step_index=current_step_index,
                current_selections=current_selections,
            )
            if isinstance(mock_res, SemanticResolutionDecision):
                return self._validate_and_sanitize_decision(mock_res, steps)

        # 2. Build dynamic contextual prompt
        sys_prompt = self.build_prompt_context(
            product=product,
            steps=steps,
            current_step_index=current_step_index,
            current_selections=current_selections,
            conversation_history=conversation_history,
        )

        messages = [
            SystemMessage(content=sys_prompt),
            HumanMessage(content=clean_text),
        ]

        # 3. Invoke LLM with Structured Output Schema
        try:
            structured_model = self.model.with_structured_output(SemanticResolutionDecision)
            raw_decision = structured_model.invoke(messages)
            
            # Pydantic validation / normalization
            if isinstance(raw_decision, dict):
                raw_decision = SemanticResolutionDecision.model_validate(raw_decision)
            elif not isinstance(raw_decision, SemanticResolutionDecision):
                raw_decision = SemanticResolutionDecision(
                    decision="no_match",
                    reasoning=f"Unexpected model response type: {type(raw_decision)}"
                )

            # 4. Strict Backend Validation Boundary
            return self._validate_and_sanitize_decision(raw_decision, steps)

        except Exception as exc:
            logger.error("Semantic resolution LLM invocation failed: %s", exc, exc_info=True)
            # Graceful fallback: return clarification / re-ask without crashing or hallucinating defaults
            curr_step = steps[current_step_index] if 0 <= current_step_index < len(steps) else steps[0]
            opts = [o.get("label", o["id"]) for o in curr_step.get("options", [])]
            return SemanticResolutionDecision(
                decision="needs_clarification",
                clarification_question=f"I didn't quite catch that. For {curr_step.get('label')}, would you like {', '.join(opts)}?",
                reasoning=f"LLM exception fallback: {str(exc)}"
            )

    def _validate_and_sanitize_decision(
        self,
        decision: SemanticResolutionDecision,
        steps: List[Dict[str, Any]],
    ) -> SemanticResolutionDecision:
        """
        Enforces strict backend boundaries:
        - Verifies that each step_id and option_id exists in the actual product steps.
        - Discards hallucinated or invalid IDs.
        - Prevents applying unverified selections to state.
        """
        # Build lookup of valid step_id -> set of valid option_ids
        valid_options_by_step = {}
        for s in steps:
            s_key = s["key"]
            valid_ids = {opt["id"] for opt in s.get("options", [])}
            # Also allow matching by exact label if ID was slightly transposed
            label_to_id = {opt.get("label", "").lower(): opt["id"] for opt in s.get("options", [])}
            valid_options_by_step[s_key] = (valid_ids, label_to_id)

        validated_selections: List[OptionSelection] = []

        for sel in decision.selections:
            s_key = sel.step_id
            if s_key not in valid_options_by_step:
                logger.warning("Discarding invalid step_id '%s' hallucinated by LLM.", s_key)
                continue

            valid_ids, label_map = valid_options_by_step[s_key]
            opt_id = sel.option_id

            if opt_id in valid_ids:
                validated_selections.append(sel)
            elif opt_id.lower() in label_map:
                # Transpose label to canonical ID
                canonical_id = label_map[opt_id.lower()]
                validated_selections.append(OptionSelection(
                    step_id=s_key,
                    option_id=canonical_id,
                    confidence=sel.confidence,
                    reasoning=sel.reasoning,
                ))
            else:
                logger.warning("Discarding hallucinated option_id '%s' for step '%s'.", opt_id, s_key)

        decision.selections = validated_selections

        # If decision was 'selected' but all selections were invalid/discarded, downgrade
        if decision.decision == "selected" and not decision.selections:
            decision.decision = "no_match"
            decision.reasoning = "Selections were discarded due to invalid or unconfigured option IDs."

        return decision


# Singleton instance
semantic_resolver = SemanticOptionResolver()

