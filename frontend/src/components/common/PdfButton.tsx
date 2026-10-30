import React from 'react';
import { Download } from 'lucide-react';
import { printWithFileName } from '../../lib/print';

interface PdfButtonProps {
  /** File name suggested in the Save as PDF window (without .pdf); a function is evaluated on click */
  fileName: string | (() => string);
  landscape?: boolean;
  className?: string;
  label?: string;
}

/** Opens the browser's Save as PDF window with the file name filled in. */
export const PdfButton: React.FC<PdfButtonProps> = ({
  fileName,
  landscape,
  className = 'btn-primary',
  label = 'Download PDF',
}) => (
  <button type="button" onClick={() => printWithFileName(typeof fileName === 'function' ? fileName() : fileName, { landscape })} className={className}>
    <Download className="h-4 w-4" />
    <span>{label}</span>
  </button>
);
