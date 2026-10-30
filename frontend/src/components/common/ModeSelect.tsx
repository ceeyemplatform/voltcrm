import React, { useState } from 'react';
import { deleteCustomPaymentMode, getAllPaymentModes, saveCustomPaymentMode } from '../../lib/expenseConfig';
import { PickList } from './PickList';

interface ModeSelectProps {
  value?: string;
  onChange: (mode: string) => void;
  size?: 'sm' | 'md';
}

/** Compact payment mode picker: add a new mode from the list, delete a custom one. */
export const ModeSelect: React.FC<ModeSelectProps> = ({ value, onChange, size = 'sm' }) => {
  // Bumped after add/delete so the list re-reads saved modes
  const [, setVersion] = useState(0);

  return (
    <PickList
      size={size}
      value={value || ''}
      options={getAllPaymentModes([value])}
      onChange={onChange}
      emptyLabel="Not specified"
      placeholder="Mode…"
      addLabel="+ Add payment mode…"
      addPlaceholder="New mode, e.g. RTGS"
      onAdd={(name) => {
        saveCustomPaymentMode(name);
        setVersion((v) => v + 1);
        return name;
      }}
      onDelete={(id) => {
        deleteCustomPaymentMode(id);
        setVersion((v) => v + 1);
        if (value === id) onChange('');
      }}
    />
  );
};
