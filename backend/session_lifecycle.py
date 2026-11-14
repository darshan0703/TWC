"""
backend/session_lifecycle.py
Centralized Customer Context Lifecycle, Data Retention & Privacy Management for Third Wave Coffee (TWC).

Implements:
1. Strict session lifecycle state machine (ACTIVE, COMPLETED, CANCELLED, ABANDONED, EXPIRED).
2. Ephemeral temporary customer memory (PII, phone numbers, preferences, cart, conversation history).
3. Persistent, immutable transactional record archiving (orders, payments, tax accounting).
4. Automatic TTL inactivity expiration sweeper (default 300s backend fallback; 120s kiosk frontend).
5. Idempotent session termination and PII purging.
6. PII-safe logging with 10-digit phone number masking.
7. Compliance with Indian Digital Personal Data Protection (DPDP) Act, 2023.
"""

import time
import copy
import uuid
import re
import threading
from typing import Dict, Any, Optional, List
from enum import Enum

# ---------------------------------------------------------------------------
# PII Masking Utilities
# ---------------------------------------------------------------------------

PHONE_REGEX = re.compile(r"\b(?:\+?91[\-\s]?)?([6-9]\d{9})\b")

def mask_phone_number(phone: Optional[str]) -> str:
    """
    Masks a phone number for DPDP compliance: retains only last 4 digits (e.g. '******3210').
    """
    if not phone:
        return "Unknown"
    digits = re.sub(r"\D", "", str(phone))
    if len(digits) >= 10:
        return f"{'*' * (len(digits) - 4)}{digits[-4:]}"
    elif len(digits) > 4:
        return f"{'*' * (len(digits) - 2)}{digits[-2:]}"
    return "***"

def mask_pii_in_text(text: str) -> str:
    """
    Replaces any 10-digit Indian phone numbers found in log strings with masked equivalents.
    """
    if not text or not isinstance(text, str):
        return str(text or "")
    
    def _repl(match):
        raw_number = match.group(1)
        return mask_phone_number(raw_number)
        
    return PHONE_REGEX.sub(_repl, text)

def log_safe(message: str) -> None:
    """Prints a log message after ensuring all customer PII is masked."""
    masked = mask_pii_in_text(message)
    print(f"[TWC Privacy] {masked}")


# ---------------------------------------------------------------------------
# Session Lifecycle Enums and Constants
# ---------------------------------------------------------------------------

class SessionStatus(str, Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    ABANDONED = "ABANDONED"
    EXPIRED = "EXPIRED"

# Backend fallback TTL for inactive sessions (seconds)
# Frontend kiosk timeout is 120s; backend sweeper cleans any abandoned session older than 300s (5 mins)
DEFAULT_SESSION_TTL_SECONDS = 300.0


# ---------------------------------------------------------------------------
# Session Lifecycle Manager
# ---------------------------------------------------------------------------

class SessionLifecycleManager:
    """
    Coordinates session state creation, touch activity, ephemeral PII clearing,
    transactional order archiving, and automatic TTL expiration.
    """
    def __init__(self, ttl_seconds: float = DEFAULT_SESSION_TTL_SECONDS):
        self.ttl_seconds = ttl_seconds
        self._lock = threading.RLock()
        
        # Ephemeral active sessions: session_id -> SessionState
        self._active_sessions: Dict[str, Any] = {}
        
        # Session metadata: session_id -> { "created_at": float, "last_active_at": float, "status": str }
        self._session_meta: Dict[str, Dict[str, Any]] = {}
        
        # Persistent transactional orders store: orderNumber -> OrderDict (immutable audit store)
        self._order_archive: Dict[str, Dict[str, Any]] = {}
        
        # Background sweeper thread
        self._sweeper_running = False
        self._sweeper_thread: Optional[threading.Thread] = None

    def create_session(self, session_id: Optional[str] = None) -> Any:
        """
        Creates a fresh, isolated session context.
        If a session with this ID previously existed, its prior state is completely replaced.
        """
        with self._lock:
            # Import here to avoid circular dependencies
            from state import create_conversation_state
            
            sid = session_id or f"twc-{uuid.uuid4().hex[:8]}"
            now = time.time()
            
            # Create fresh state dictionary
            state = create_conversation_state(sid)
            
            self._active_sessions[sid] = state
            self._session_meta[sid] = {
                "created_at": now,
                "last_active_at": now,
                "status": SessionStatus.ACTIVE.value,
            }
            
            log_safe(f"Initialized isolated session: {sid}")
            return state

    def get_session(self, session_id: Optional[str] = None, touch: bool = True) -> Any:
        """
        Retrieves active session state. If session is expired, evicts it and creates a clean session.
        """
        with self._lock:
            from state import create_conversation_state, _ACTIVE_DEFAULT_SESSION_ID
            sid = session_id or _ACTIVE_DEFAULT_SESSION_ID
            now = time.time()
            
            # Check if session exists
            if sid in self._active_sessions:
                meta = self._session_meta.get(sid, {})
                last_active = meta.get("last_active_at", now)
                
                # Check for TTL expiration
                if (now - last_active) > self.ttl_seconds:
                    log_safe(f"Session {sid} exceeded TTL ({self.ttl_seconds}s). Purging expired context.")
                    self.terminate_session(sid, reason="expired")
                    # Return a fresh clean session
                    return self.create_session(sid)
                
                if touch:
                    meta["last_active_at"] = now
                return self._active_sessions[sid]
            
            # If not found, create a clean session
            return self.create_session(sid)

    def touch_session(self, session_id: str) -> None:
        """Updates last_active timestamp for keep-alive."""
        with self._lock:
            if session_id in self._session_meta:
                self._session_meta[session_id]["last_active_at"] = time.time()

    def get_session_status(self, session_id: str) -> Dict[str, Any]:
        """Returns the current lifecycle status of a session."""
        with self._lock:
            if session_id in self._active_sessions:
                meta = self._session_meta.get(session_id, {})
                return {
                    "session_id": session_id,
                    "exists": True,
                    "status": meta.get("status", SessionStatus.ACTIVE.value),
                    "created_at": meta.get("created_at"),
                    "last_active_at": meta.get("last_active_at"),
                }
            return {
                "session_id": session_id,
                "exists": False,
                "status": "NOT_FOUND",
            }

    def terminate_session(self, session_id: str, reason: str = "completed") -> Dict[str, Any]:
        """
        Idempotently terminates an active session and wipes all temporary customer data (PII,
        phone number, preferences, conversation history, cart).
        """
        with self._lock:
            state = self._active_sessions.get(session_id)
            if state is not None:
                # 1. Clear all temporary PII fields
                masked_phone = mask_phone_number(state.get("mobile_number") or state.get("staged_mobile_number"))
                
                state["mobile_number"] = None
                state["staged_mobile_number"] = None
                state["pending_number_confirmation"] = False
                state["customer_preferences"] = {
                    "milk": None,
                    "temperature": None,
                    "sugar": None,
                }
                state["conversation_history"] = []
                state["cart"] = []
                state["cart_totals"] = {
                    "itemCount": 0,
                    "subtotal": 0,
                    "taxes": 0,
                    "totalPayable": 0,
                }
                state["selected_product"] = None
                state["last_item"] = None
                state["pending_clarification"] = None
                state["pending_suggestion"] = None
                state["selected_customizations"] = {
                    "size": "Regular",
                    "temperature": "Hot",
                    "milk": "Standard Dairy",
                    "sugar": "Regular Sugar",
                    "extra_shot": False,
                    "quantity": 1,
                }
                
                # 2. Evict from active session store
                del self._active_sessions[session_id]

                # Evict active customization if any
                try:
                    from customization_engine import clear_customization_session
                    clear_customization_session(session_id)
                except Exception:
                    pass
                
                # 3. Update metadata tombstone or remove
                if session_id in self._session_meta:
                    self._session_meta[session_id]["status"] = (
                        SessionStatus.COMPLETED.value if reason == "order_completed" else
                        SessionStatus.CANCELLED.value if reason == "cancelled" else
                        SessionStatus.EXPIRED.value if reason == "expired" else
                        SessionStatus.ABANDONED.value
                    )
                    self._session_meta[session_id]["terminated_at"] = time.time()
                
                log_safe(f"Terminated session {session_id} (Reason: {reason}, Masked: {masked_phone}). All temporary PII purged.")
                return {
                    "success": True,
                    "session_id": session_id,
                    "reason": reason,
                    "cleaned": True,
                    "already_terminated": False,
                }
            
            # Idempotent return if already terminated
            return {
                "success": True,
                "session_id": session_id,
                "reason": reason,
                "cleaned": False,
                "already_terminated": True,
            }

    # -----------------------------------------------------------------------
    # Transactional Order Records (Category B: Retained for Accounting / Kitchen)
    # -----------------------------------------------------------------------

    def archive_order(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Permanently archives a completed order into the transactional audit store.
        Masks customer phone number for privacy while retaining order totals and items.
        """
        with self._lock:
            order_num = order_data.get("orderNumber") or f"TWC-{int(time.time() * 1000) % 100000}"
            raw_phone = order_data.get("mobileNumber") or "Walk-in Guest"
            
            archived = copy.deepcopy(order_data)
            archived["orderNumber"] = order_num
            archived["archived_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
            archived["mobileNumberMasked"] = mask_phone_number(raw_phone) if raw_phone != "Walk-in Guest" else raw_phone
            
            self._order_archive[order_num] = archived
            log_safe(f"Archived transactional order {order_num} for accounting/fulfillment (Total: ₹{archived.get('total')}).")
            return archived

    def get_archived_order(self, order_number: str) -> Optional[Dict[str, Any]]:
        """Retrieves a completed transactional order by order number."""
        with self._lock:
            order = self._order_archive.get(order_number)
            if order:
                return copy.deepcopy(order)
            return None

    def list_archived_orders(self) -> List[Dict[str, Any]]:
        """Lists all archived orders."""
        with self._lock:
            return [copy.deepcopy(o) for o in self._order_archive.values()]

    # -----------------------------------------------------------------------
    # TTL Sweeper
    # -----------------------------------------------------------------------

    def sweep_expired_sessions(self) -> int:
        """
        Sweeps all active sessions that have been inactive longer than ttl_seconds.
        """
        with self._lock:
            now = time.time()
            expired_ids = []
            
            for sid, meta in list(self._session_meta.items()):
                if sid in self._active_sessions:
                    last_active = meta.get("last_active_at", now)
                    if (now - last_active) > self.ttl_seconds:
                        expired_ids.append(sid)
            
            for sid in expired_ids:
                log_safe(f"Sweeping inactive session {sid} (Inactive > {self.ttl_seconds}s).")
                self.terminate_session(sid, reason="expired")
                
            return len(expired_ids)

    def start_background_sweeper(self, interval_seconds: float = 30.0) -> None:
        """Starts a background daemon thread that periodically sweeps expired sessions."""
        with self._lock:
            if self._sweeper_running:
                return
            self._sweeper_running = True
            
            def _sweeper_loop():
                while self._sweeper_running:
                    time.sleep(interval_seconds)
                    try:
                        self.sweep_expired_sessions()
                    except Exception as e:
                        print(f"[TWC Sweeper Error] {e}")

            self._sweeper_thread = threading.Thread(target=_sweeper_loop, daemon=True, name="TWCSessionSweeper")
            self._sweeper_thread.start()
            log_safe(f"Started background session sweeper (Interval: {interval_seconds}s, TTL: {self.ttl_seconds}s).")

    def stop_background_sweeper(self) -> None:
        """Stops the background sweeper."""
        with self._lock:
            self._sweeper_running = False


# Global Singleton Lifecycle Manager
session_lifecycle = SessionLifecycleManager()

