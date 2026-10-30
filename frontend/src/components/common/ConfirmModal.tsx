import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  isLoading = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
      <div className="flex items-start space-x-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-100">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
          <p className="mt-2 text-xs font-medium text-rose-600">
            This action cannot be undone.
          </p>
        </div>
      </div>

      <div className="-mx-6 -mb-6 mt-6 flex justify-end gap-2.5 border-t border-slate-300 bg-slate-50/60 px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="btn-secondary"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className="btn-primary !bg-rose-600 hover:!bg-rose-700"
        >
          {isLoading ? 'Processing...' : confirmText}
        </button>
      </div>
    </Modal>
  );
};
