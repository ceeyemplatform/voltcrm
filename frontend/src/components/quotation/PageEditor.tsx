import React, { useEffect, useRef } from 'react';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table,
  Rows3,
  Columns3,
  Minus,
  Trash2,
} from 'lucide-react';
import { sanitizeRichText } from '../../lib/richText';
import { QuotationPage } from '../../types';
import { confirmDelete } from '../common/ConfirmHost';

export const newPage = (): QuotationPage => ({
  id: crypto.randomUUID ? crypto.randomUUID() : `page_${Date.now()}_${Math.random()}`,
  html: '',
});

interface PageEditorProps {
  page: QuotationPage;
  index: number;
  total: number;
  onChange: (html: string) => void;
  onRemove: () => void;
  placeholder?: string;
  /** Read-only block shown at the top of the sheet, e.g. the quotation header */
  header?: React.ReactNode;
}

const BLOCK_STYLES: [string, string][] = [
  ['p', 'Normal text'],
  ['h1', 'Heading'],
  ['h2', 'Subheading'],
  ['h3', 'Small heading'],
];

const FONT_SIZES: [string, string][] = [
  ['2', 'Small'],
  ['3', 'Normal'],
  ['5', 'Large'],
  ['6', 'Extra large'],
];

const NEW_TABLE =
  '<table><tbody>' +
  '<tr><th>Description</th><th>Qty</th><th>Amount</th></tr>' +
  '<tr><td><br></td><td><br></td><td><br></td></tr>' +
  '<tr><td><br></td><td><br></td><td><br></td></tr>' +
  '</tbody></table><p><br></p>';

/** The table cell holding the cursor, if any */
const currentCell = (root: HTMLElement | null): HTMLTableCellElement | null => {
  const sel = window.getSelection();
  let node: Node | null = sel && sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
  while (node && node !== root) {
    if (node instanceof HTMLTableCellElement) return node;
    node = node.parentNode;
  }
  return null;
};

/** One free text A4 page with a small formatting toolbar. */
export const PageEditor: React.FC<PageEditorProps> = ({ page, index, total, onChange, onRemove, placeholder, header }) => {
  const ref = useRef<HTMLDivElement>(null);
  // Last cursor position in the page; dropdowns take focus, so it is put back before formatting
  const savedRange = useRef<Range | null>(null);

  // Content is only written into the editor when a different page is shown, so typing never moves the cursor
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = sanitizeRichText(page.html);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id]);

  const emit = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const saveRange = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
  };

  const run = (command: string, value?: string) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel && !el.contains(sel.anchorNode)) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand(command, false, value);
    saveRange();
    emit();
  };

  const addRow = () => {
    const cell = currentCell(ref.current);
    const row = cell?.parentElement as HTMLTableRowElement | null;
    if (!row) return;
    const copy = row.cloneNode(true) as HTMLTableRowElement;
    copy.querySelectorAll('th').forEach((th) => {
      const td = document.createElement('td');
      th.replaceWith(td);
    });
    copy.querySelectorAll('td').forEach((td) => (td.innerHTML = '<br>'));
    row.after(copy);
    emit();
  };

  const addColumn = () => {
    const cell = currentCell(ref.current);
    const table = cell?.closest('table');
    if (!cell || !table) return;
    const col = cell.cellIndex;
    table.querySelectorAll('tr').forEach((tr) => {
      const beside = tr.children[col];
      const added = document.createElement(beside?.tagName === 'TH' ? 'th' : 'td');
      added.innerHTML = '<br>';
      if (beside) beside.after(added);
      else tr.appendChild(added);
    });
    emit();
  };

  const removeRow = () => {
    const row = currentCell(ref.current)?.parentElement;
    const table = row?.closest('table');
    if (!row || !table) return;
    if (table.querySelectorAll('tr').length <= 1) table.remove();
    else row.remove();
    emit();
  };

  const btn = (title: string, Icon: React.ComponentType<{ className?: string }>, onClick: () => void) => (
    <button
      type="button"
      title={title}
      // Keep the text selection in the page while clicking the toolbar
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-200 hover:text-slate-900"
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  const divider = <span className="mx-1 h-5 w-px bg-slate-300" />;
  const selectCls =
    'h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none';

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-100">
      <div className="flex items-center justify-between border-b border-slate-300 bg-white px-3 py-1.5">
        <span className="text-xs font-semibold text-slate-600">
          Page {index + 1} of {total}
        </span>
        <button
          type="button"
          onClick={async () => {
            if (await confirmDelete(`Remove page ${index + 1}? Everything typed on it will be lost.`, { confirmText: 'Remove' }))
              onRemove();
          }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove page
        </button>
      </div>

      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-slate-300 bg-slate-50 px-2 py-1.5">
        <select
          className={selectCls}
          defaultValue=""
          title="Text style"
          onChange={(e) => {
            if (e.target.value) run('formatBlock', e.target.value);
            e.target.value = '';
          }}
        >
          <option value="" disabled>
            Style
          </option>
          {BLOCK_STYLES.map(([tag, label]) => (
            <option key={tag} value={tag}>
              {label}
            </option>
          ))}
        </select>
        <select
          className={`${selectCls} ml-1`}
          defaultValue=""
          title="Text size"
          onChange={(e) => {
            if (e.target.value) run('fontSize', e.target.value);
            e.target.value = '';
          }}
        >
          <option value="" disabled>
            Size
          </option>
          {FONT_SIZES.map(([size, label]) => (
            <option key={size} value={size}>
              {label}
            </option>
          ))}
        </select>
        {divider}
        {btn('Bold (Ctrl+B)', Bold, () => run('bold'))}
        {btn('Italic (Ctrl+I)', Italic, () => run('italic'))}
        {btn('Underline (Ctrl+U)', Underline, () => run('underline'))}
        {divider}
        {btn('Bullet list', List, () => run('insertUnorderedList'))}
        {btn('Numbered list', ListOrdered, () => run('insertOrderedList'))}
        {divider}
        {btn('Align left', AlignLeft, () => run('justifyLeft'))}
        {btn('Align center', AlignCenter, () => run('justifyCenter'))}
        {btn('Align right', AlignRight, () => run('justifyRight'))}
        {divider}
        {btn('Insert table', Table, () => run('insertHTML', NEW_TABLE))}
        {btn('Add table row (cursor in table)', Rows3, addRow)}
        {btn('Add table column (cursor in table)', Columns3, addColumn)}
        {btn('Delete table row (cursor in table)', Minus, removeRow)}
      </div>

      {/* A4 sheet */}
      <div className="max-h-[65vh] overflow-y-auto p-3 sm:p-5">
        <div className="mx-auto w-full max-w-[794px] bg-white px-8 py-10 text-slate-900 shadow-sm ring-1 ring-slate-300 sm:px-14">
        {header && (
          <div className="pointer-events-none select-none" title="Header from the Print Header settings">
            {header}
          </div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onKeyUp={saveRange}
          onMouseUp={saveRange}
          onBlur={() => {
            saveRange();
            emit();
          }}
          onPaste={(e) => {
            // Pasted text from Word or websites keeps only the formatting this editor supports
            e.preventDefault();
            const html = e.clipboardData.getData('text/html');
            if (html) {
              document.execCommand('insertHTML', false, sanitizeRichText(html));
            } else {
              document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
            }
            emit();
          }}
          data-placeholder={placeholder || 'Start typing…'}
          className={`rich-page w-full focus:outline-none ${header ? 'min-h-[360px]' : 'min-h-[600px]'}`}
        />
        </div>
      </div>
    </div>
  );
};
