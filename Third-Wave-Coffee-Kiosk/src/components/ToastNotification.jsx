import React from 'react';
import './ToastNotification.css';
import { CheckCircle2, ArrowRight, X } from 'lucide-react';
import { useKiosk } from '../context/KioskContext';

export const ToastNotification = () => {
  const { toast, hideToast } = useKiosk();

  if (!toast.show) return null;

  return (
    <div className="toast-notification absolute bottom-16 inset-x-3.5 z-50 animate-bounce-short">
      <div className="toast-notification__card flex items-center justify-between gap-2.5 bg-navy text-white px-3.5 py-2.5 rounded-2xl shadow-2xl border border-navy-light">
        <div className="flex items-center gap-2 min-w-0">
          <div className="toast-notification__icon-box w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>

          <div className="toast-notification__message text-xs font-semibold tracking-tight truncate">
            {toast.message}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {toast.actionText && toast.onAction && (
            <button
              onClick={() => {
                hideToast();
                toast.onAction();
              }}
              className="toast-notification__action-btn flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-navy text-[10px] font-extrabold uppercase tracking-wider hover:bg-cream-100 transition-all"
            >
              <span>{toast.actionText}</span>
              <ArrowRight className="w-3 h-3 text-navy" />
            </button>
          )}

          <button
            onClick={hideToast}
            className="toast-notification__close-btn text-white/60 hover:text-white p-0.5"
            aria-label="Dismiss toast"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
