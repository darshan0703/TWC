import React from 'react';
import './BillSummary.css';
import { ShieldCheck, Info } from 'lucide-react';

export const BillSummary = ({ totals, note }) => {
  return (
    <div className="bill-summary bg-white rounded-2xl p-3.5 border border-beige-muted/80 shadow-sm flex flex-col gap-2.5">
      <div className="bill-summary__header flex items-center justify-between pb-2 border-b border-beige-muted/70">
        <h3 className="bill-summary__title text-xs font-black uppercase tracking-tight text-navy font-sans">
          Bill Summary
        </h3>
        <span className="bill-summary__count-badge text-[9px] font-bold px-2 py-0.5 rounded-full bg-cream-200 text-navy">
          {totals.itemCount} {totals.itemCount === 1 ? 'Item' : 'Items'}
        </span>
      </div>

      <div className="bill-summary__breakdown space-y-1.5 text-xs font-medium">
        <div className="bill-summary__row flex items-center justify-between text-navy/80">
          <span>Item Total</span>
          <span className="bill-summary__row-value font-bold text-navy">₹{totals.subtotal}</span>
        </div>

        <div className="bill-summary__row flex items-center justify-between text-navy/80">
          <div className="flex items-center gap-1">
            <span>Taxes (5% GST)</span>
            <Info className="w-3 h-3 text-taupe-warm" />
          </div>
          <span className="bill-summary__row-value font-bold text-navy">₹{totals.taxes}</span>
        </div>

        <div className="bill-summary__row flex items-center justify-between text-emerald-800 font-medium">
          <span>Kiosk Ordering Fee</span>
          <span className="bill-summary__free-pill font-bold uppercase tracking-wider text-[9px] bg-emerald-50 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200">
            Free
          </span>
        </div>
      </div>

      <div className="bill-summary__divider pt-2 border-t-2 border-dashed border-beige-muted/80 flex items-center justify-between">
        <div>
          <span className="text-[9px] uppercase font-extrabold tracking-wider text-taupe-warm block">
            Grand Total
          </span>
          <span className="bill-summary__grand-total text-lg sm:text-xl font-black text-navy font-sans">
            ₹{totals.totalPayable}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[9px] text-taupe-warm block font-medium">
            Inclusive of all taxes
          </span>
        </div>
      </div>

      {note && (
        <div className="bill-summary__note-box pt-0.5 flex items-center gap-1.5 text-[9px] font-medium text-navy/80 bg-cream-100 p-2 rounded-xl border border-beige-muted/50">
          <ShieldCheck className="w-3.5 h-3.5 text-navy shrink-0" />
          <span>{note}</span>
        </div>
      )}
    </div>
  );
};
