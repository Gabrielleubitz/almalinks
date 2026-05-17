import React, { useId, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

export interface MultiSelectFieldProps {
  id?: string;
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (values: string[]) => void;
  required?: boolean;
  disabled?: boolean;
  helpText?: string;
  error?: string;
  placeholder?: string;
}

const MultiSelectField: React.FC<MultiSelectFieldProps> = ({
  id: idProp,
  label,
  options,
  value,
  onChange,
  required = false,
  disabled = false,
  helpText,
  error,
  placeholder = 'Select one or more…',
}) => {
  const autoId = useId();
  const id = idProp || autoId;
  const [open, setOpen] = useState(false);

  const toggle = (option: string) => {
    if (disabled) return;
    if (value.includes(option)) {
      onChange(value.filter((v) => v !== option));
    } else {
      onChange([...value, option]);
    }
  };

  const remove = (option: string) => {
    if (disabled) return;
    onChange(value.filter((v) => v !== option));
  };

  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required ? ' *' : ''}
      </label>
      {helpText ? <p className="text-xs text-gray-500 mb-2">{helpText}</p> : null}

      <div className="relative">
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={`w-full min-h-[44px] px-4 py-2.5 text-left border rounded-xl flex items-center justify-between gap-2 touch-manipulation transition-colors ${
            error
              ? 'border-red-300 focus:ring-red-500'
              : 'border-gray-300 focus:ring-[var(--brand-blue-dark)]'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'bg-white hover:border-gray-400'}`}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <span className={value.length === 0 ? 'text-gray-400 text-sm' : 'text-gray-900 text-sm'}>
            {value.length === 0 ? placeholder : `${value.length} selected`}
          </span>
          <ChevronDown className={`h-5 w-5 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && !disabled ? (
          <div
            className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg"
            role="listbox"
            aria-multiselectable
          >
            {options.map((option) => {
              const selected = value.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => toggle(option)}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 flex items-center gap-2 ${
                    selected ? 'bg-blue-50/80 font-medium text-brand-dark' : 'text-gray-800'
                  }`}
                >
                  <span
                    className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center text-xs ${
                      selected ? 'bg-brand-dark border-brand-dark text-white' : 'border-gray-300'
                    }`}
                  >
                    {selected ? '✓' : ''}
                  </span>
                  <span>{option}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-2">
          {value.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-brand-dark border border-blue-100"
            >
              {v}
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => remove(v)}
                  className="p-0.5 hover:bg-blue-100 rounded-full"
                  aria-label={`Remove ${v}`}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  );
};

export default MultiSelectField;
