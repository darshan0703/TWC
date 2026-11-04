import React from 'react';
import { Delete, RotateCcw } from 'lucide-react';

export const TouchKeypad = ({ onKeyPress, onBackspace, onClear }) => {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="w-full grid grid-cols-3 gap-2 select-none">
      {keys.map((num) => (
        <button
          key={num}
          type="button"
          onClick={() => onKeyPress(num)}
          className="h-13 sm:h-14 rounded-xl bg-white border border-beige-muted text-navy text-xl sm:text-2xl font-extrabold hover:border-navy/40 active:bg-cream-200 active:scale-95 shadow-sm transition-all flex items-center justify-center font-sans"
        >
          {num}
        </button>
      ))}

      {/* Clear Key */}
      <button
        type="button"
        onClick={onClear}
        className="h-13 sm:h-14 rounded-xl bg-cream-200/90 border border-beige-muted text-navy/80 text-xs font-bold uppercase tracking-wider hover:border-navy/40 active:bg-cream-300 active:scale-95 shadow-sm transition-all flex flex-col items-center justify-center gap-0.5 font-sans"
      >
        <RotateCcw className="w-4 h-4 text-taupe-warm" />
        <span>Clear</span>
      </button>

      {/* Zero Key */}
      <button
        type="button"
        onClick={() => onKeyPress('0')}
        className="h-13 sm:h-14 rounded-xl bg-white border border-beige-muted text-navy text-xl sm:text-2xl font-extrabold hover:border-navy/40 active:bg-cream-200 active:scale-95 shadow-sm transition-all flex items-center justify-center font-sans"
      >
        0
      </button>

      {/* Backspace Key */}
      <button
        type="button"
        onClick={onBackspace}
        className="h-13 sm:h-14 rounded-xl bg-cream-200/90 border border-beige-muted text-navy/80 hover:border-navy/40 active:bg-cream-300 active:scale-95 shadow-sm transition-all flex flex-col items-center justify-center gap-0.5 font-sans"
        aria-label="Backspace"
      >
        <Delete className="w-4 h-4 text-taupe-warm" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Delete</span>
      </button>
    </div>
  );
};
