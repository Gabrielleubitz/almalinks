import React, { useRef, useEffect, useCallback } from 'react';
import { Bold, Italic, Underline, Highlighter } from 'lucide-react';

interface RichTextBioEditorProps {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
  maxLength?: number;
  className?: string;
}

const HIGHLIGHT_COLOR = '#fef08a';

export const RichTextBioEditor: React.FC<RichTextBioEditorProps> = ({
  value,
  onChange,
  onBlur,
  placeholder = 'Tell us about yourself...',
  disabled = false,
  minHeight = '120px',
  maxLength = 2000,
  className = '',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef('');

  const getHtml = useCallback(() => {
    const el = editorRef.current;
    if (!el) return '';
    return el.innerHTML || '';
  }, []);

  const emitChange = useCallback(() => {
    const html = getHtml();
    if (html === value) return;
    lastEmittedRef.current = html;
    onChange(html);
  }, [getHtml, value, onChange]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value === lastEmittedRef.current) return;
    if ((el.innerHTML || '') === (value || '')) return;
    lastEmittedRef.current = value || '';
    el.innerHTML = value || '';
  }, [value]);

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    emitChange();
  };

  const handleInput = () => {
    if (disabled) return;
    const el = editorRef.current;
    if (!el) return;
    let html = el.innerHTML;
    if (maxLength && stripHtml(html).length > maxLength) {
      isInternalChange.current = true;
      el.innerHTML = value || '';
      isInternalChange.current = false;
      return;
    }
    emitChange();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div className={`rounded-xl border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 p-1 border-b border-gray-200 bg-gray-50">
        <button
          type="button"
          onClick={() => exec('bold')}
          disabled={disabled}
          className="p-2 rounded hover:bg-gray-200 disabled:opacity-50 text-gray-700"
          title="Bold"
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('italic')}
          disabled={disabled}
          className="p-2 rounded hover:bg-gray-200 disabled:opacity-50 text-gray-700"
          title="Italic"
          aria-label="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('underline')}
          disabled={disabled}
          className="p-2 rounded hover:bg-gray-200 disabled:opacity-50 text-gray-700"
          title="Underline"
          aria-label="Underline"
        >
          <Underline className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('backColor', HIGHLIGHT_COLOR)}
          disabled={disabled}
          className="p-2 rounded hover:bg-gray-200 disabled:opacity-50 text-gray-700"
          title="Highlight"
          aria-label="Highlight"
        >
          <Highlighter className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onBlur={() => { emitChange(); onBlur?.(); }}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className="w-full px-4 py-3 text-base resize-none outline-none min-h-[120px] overflow-y-auto empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
        style={{ minHeight }}
      />
      {maxLength && (
        <div className="px-3 py-1 text-xs text-gray-500 text-right border-t border-gray-100">
          {stripHtml(value).length}/{maxLength} characters
        </div>
      )}
    </div>
  );
};

function stripHtml(html: string): string {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').trim();
}

export default RichTextBioEditor;
