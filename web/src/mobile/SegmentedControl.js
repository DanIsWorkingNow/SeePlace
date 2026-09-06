// SegmentedControl — iOS-style pill switch, touch-sized (44 px min height).
import React from 'react';

export default function SegmentedControl({ value, onChange, options }) {
  return (
    <div
      role="tablist"
      className="flex gap-1 rounded-xl bg-gray-100 p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`min-h-[40px] flex-1 rounded-lg px-3 text-sm font-medium transition-colors ${
              active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 active:bg-gray-200'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
