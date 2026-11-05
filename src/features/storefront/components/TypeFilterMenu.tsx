import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type TypeFilterOption = {
  id: string;
  name: string;
  count: number;
};

type TypeFilterMenuProps = {
  options: TypeFilterOption[];
  value: string;
  onChange: (typeId: string) => void;
};

// Compact custom picker for phones: a button that hugs its label, with the count in a badge.
export function TypeFilterMenu({ options, value, onChange }: TypeFilterMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.id === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className="type-filter" ref={rootRef}>
      <button
        className={isOpen ? "type-filter-trigger open" : "type-filter-trigger"}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Lọc theo kiểu dáng: ${selected.name}`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
        <span className="type-filter-label">{selected.name}</span>
        <span className="type-filter-count">{selected.count}</span>
        <ChevronDown className="type-filter-caret" size={14} aria-hidden="true" />
      </button>
      {isOpen ? (
        <ul className="type-filter-menu" role="listbox" aria-label="Kiểu dáng">
          {options.map((option) => {
            const isSelected = option.id === value;
            return (
              <li key={option.id || "all"}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={isSelected ? "selected" : undefined}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                  }}
                >
                  <span className="type-filter-check" aria-hidden="true">
                    {isSelected ? <Check size={14} strokeWidth={2.5} /> : null}
                  </span>
                  <span className="type-filter-option-name">{option.name}</span>
                  <span className="type-filter-count">{option.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
