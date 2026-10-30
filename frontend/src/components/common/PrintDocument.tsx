import React, { useEffect, useRef } from 'react';
import { buildFileName, fileDate } from '../../lib/print';
import { PdfButton } from './PdfButton';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface PrintDocumentProps {
  title: string;
  subtitle?: string;
  /** PDF file name (without .pdf), built at click time so it carries the download time */
  fileName?: () => string;
  onClose: () => void;
  /** Option controls shown above the document (never printed) */
  controls?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Full-screen print preview rendered outside the app tree, so printing
 * outputs only the document and not the page behind it.
 */
export const PrintDocument: React.FC<PrintDocumentProps> = ({
  title,
  subtitle,
  fileName,
  onClose,
  controls,
  children,
}) => {
  const pageRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Runs once per open; onClose is read through a ref so re-renders don't re-toggle the theme
  useEffect(() => {
    // Documents are always light: dark mode would print dark pages
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    root.classList.remove('dark');
    document.body.classList.remove('dark');
    document.body.classList.add('print-doc-open');
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('print-doc-open');
      document.body.style.overflow = '';
      if (wasDark) {
        root.classList.add('dark');
        document.body.classList.add('dark');
      }
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return createPortal(
    <div className="print-doc fixed inset-0 z-[9999] flex flex-col bg-slate-100">
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-slate-300 bg-white px-4 py-3 sm:px-6 no-print">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="truncate text-[13px] text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <PdfButton fileName={() => (fileName ? fileName() : buildFileName(title, fileDate()))} />
          <button type="button" onClick={onClose} className="btn-icon h-9 w-9" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {controls && (
        <div className="flex-shrink-0 border-b border-slate-300 bg-white px-4 py-3 sm:px-6 no-print">
          {controls}
        </div>
      )}

      <div className="print-doc-scroll flex-1 overflow-y-auto p-3 sm:p-6">
        <div ref={pageRef} className="print-doc-page mx-auto w-full max-w-[210mm] bg-white p-6 text-slate-900 shadow-sm ring-1 ring-slate-300 sm:p-10">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
