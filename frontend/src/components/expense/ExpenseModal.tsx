import React, { useState, useEffect } from 'react';
import { todayISO } from '../../lib/dates';
import { Modal } from '../common/Modal';
import { Expense, Work } from '../../types';
import {
  getAllPaymentModes,
  saveCustomPaymentMode,
  deleteCustomPaymentMode,
  getAllExpenseCategories,
  saveCustomExpenseCategory,
  deleteCustomExpenseCategory,
  getAllIncomeCategories,
  saveCustomIncomeCategory,
  deleteCustomIncomeCategory,
} from '../../lib/expenseConfig';
import { OptionSelect } from '../common/OptionSelect';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  IndianRupee,
  Briefcase,
  UserRound,
  CreditCard,
  Tag,
  StickyNote,
  Loader2,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export interface WorkOptionItem {
  id: string;
  workCode: string;
  name: string;
  siteName?: string;
  workSite?: { name?: string };
}

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Expense>) => Promise<void>;
  initialData?: Expense | null;
  worksList?: WorkOptionItem[];
  fixedWork?: Work | null;
  /** Type preselected for a new record */
  defaultType?: 'income' | 'expense';
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  worksList = [],
  fixedWork,
  defaultType = 'income',
}) => {
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState<number | ''>('');
  const [type, setType] = useState<'income' | 'expense'>('income');
  // Pending: income still to collect, or expense still to pay
  const [isToGet, setIsToGet] = useState(false);
  const [category, setCategory] = useState('');
  const [selectedWorkId, setSelectedWorkId] = useState<string>('');
  const [personName, setPersonName] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [remarks, setRemarks] = useState('');

  // Bumped when a custom mode/category is added or removed, so the lists re-read storage
  const [, setOptionsVersion] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableModes = getAllPaymentModes([initialData?.paymentMode]);
  const availableCats =
    type === 'income'
      ? getAllIncomeCategories([initialData?.category])
      : getAllExpenseCategories([initialData?.category]);

  useEffect(() => {
    if (isOpen) {
      setError(null);

      if (initialData) {
        setDate(
          initialData.date
            ? new Date(initialData.date).toISOString().split('T')[0]
            : todayISO()
        );
        setAmount(initialData.amount ?? '');
        setType(initialData.type || 'income');
        setIsToGet(Boolean(initialData.isFlagged));
        setCategory(initialData.category || '');
        setSelectedWorkId(initialData.workId || '');
        setPersonName(initialData.personName || '');
        setPaymentMode(initialData.paymentMode || 'Cash');
        setRemarks(initialData.remarks || '');
      } else {
        setDate(todayISO());
        setAmount('');
        setType(defaultType);
        setIsToGet(false);
        setCategory(
          defaultType === 'income'
            ? getAllIncomeCategories()[0]?.id || 'Client Advance'
            : getAllExpenseCategories()[0]?.id || 'Materials & Consumables'
        );
        setSelectedWorkId(fixedWork?.id || '');
        setPersonName(defaultType === 'income' ? fixedWork?.workSite?.name || '' : '');
        setPaymentMode('Cash');
        setRemarks('');
      }
    }
  }, [initialData, isOpen, fixedWork, defaultType]);

  const handleTypeChange = (newType: 'income' | 'expense') => {
    setType(newType);
    if (newType === 'income') {
      const incCats = getAllIncomeCategories();
      setCategory(incCats[0]?.id || 'Client Advance');
    } else {
      setIsToGet(false);
      const expCats = getAllExpenseCategories();
      setCategory(expCats[0]?.id || 'Materials & Consumables');
    }
  };

  const handleAddPaymentMode = (name: string) => {
    saveCustomPaymentMode(name);
    setOptionsVersion((v) => v + 1);
    return name;
  };

  const handleDeletePaymentMode = (name: string) => {
    deleteCustomPaymentMode(name);
    setOptionsVersion((v) => v + 1);
    if (paymentMode === name) setPaymentMode('Cash');
  };

  const handleAddCategory = (name: string) => {
    if (type === 'income') saveCustomIncomeCategory(name);
    else saveCustomExpenseCategory(name);
    setOptionsVersion((v) => v + 1);
    return name;
  };

  const handleDeleteCategory = (name: string) => {
    if (type === 'income') deleteCustomIncomeCategory(name);
    else deleteCustomExpenseCategory(name);
    setOptionsVersion((v) => v + 1);
    if (category === name) {
      const cats = type === 'income' ? getAllIncomeCategories() : getAllExpenseCategories();
      setCategory(cats[0]?.id || '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount === '' || Number(amount) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let workCode: string | undefined = undefined;
      let workName: string | undefined = undefined;

      const targetWorkId = fixedWork?.id || selectedWorkId;
      if (targetWorkId) {
        const found = fixedWork || worksList.find((w) => w.id === targetWorkId);
        if (found) {
          workCode = found.workCode;
          workName = found.name;
        }
      }

      await onSave({
        date,
        amount: Number(amount),
        type,
        isFlagged: Boolean(isToGet),
        category: category || (type === 'income' ? 'Client Payment' : 'Materials & Consumables'),
        workId: targetWorkId || undefined,
        workCode,
        workName,
        personName: personName.trim() || undefined,
        paymentMode: paymentMode || 'Cash',
        remarks: remarks.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  const isIncome = type === 'income';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Transaction' : 'Record Transaction'}
      subtitle="Money received, money to collect, or an expense."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Type */}
        <div>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-300 bg-slate-50 p-1">
            {([
              ['income', 'Income', ArrowDownLeft, 'text-emerald-600'],
              ['expense', 'Expense', ArrowUpRight, 'text-rose-600'],
            ] as const).map(([id, label, Icon, tint]) => (
              <button
                key={id}
                type="button"
                onClick={() => handleTypeChange(id)}
                className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition ${
                  type === id
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-300'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className={`h-4 w-4 ${type === id ? tint : ''}`} />
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <span className="form-label">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              Status
            </span>
            <div className="grid grid-cols-2 gap-2">
              {([
                [false, isIncome ? 'Received' : 'Given', CheckCircle2, 'bg-emerald-50 text-emerald-700 ring-emerald-300'],
                [true, isIncome ? 'To get' : 'Pending', Clock, 'bg-amber-50 text-amber-700 ring-amber-300'],
              ] as const).map(([pending, label, Icon, active]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setIsToGet(pending)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium ring-1 ring-inset transition ${
                    isToGet === pending ? active : 'bg-white text-slate-500 ring-slate-300 hover:text-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="form-label">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              Date <span className="text-rose-500">*</span>
            </label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">
              <IndianRupee className="h-3.5 w-3.5 text-slate-400" />
              Amount <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0"
              className="form-input font-mono"
            />
          </div>
        </div>

        {!fixedWork && (
          <div>
            <label className="form-label">
              <Briefcase className="h-3.5 w-3.5 text-slate-400" />
              Work <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <select
              value={selectedWorkId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedWorkId(id);
                const w = worksList.find((item) => item.id === id);
                if (w && !personName) setPersonName(w.siteName || w.workSite?.name || '');
              }}
              className="form-input"
            >
              <option value="">General (no work)</option>
              {worksList.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.workCode} · {w.name}
                  {w.siteName || w.workSite?.name ? ` (${w.siteName || w.workSite?.name})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="form-label">
              <UserRound className="h-3.5 w-3.5 text-slate-400" />
              {isIncome ? 'Received from' : 'Paid to'}
            </label>
            <input
              type="text"
              placeholder={isIncome ? 'Client name' : 'Supplier or worker'}
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              className="form-input"
            />
          </div>

          <OptionSelect
            label="Payment mode"
            icon={CreditCard}
            value={paymentMode}
            onChange={setPaymentMode}
            options={availableModes}
            onAdd={handleAddPaymentMode}
            onDelete={handleDeletePaymentMode}
            addOptionLabel="+ Add payment mode…"
            addPlaceholder="e.g. RTGS"
          />
        </div>

        <OptionSelect
          label="Category"
          icon={Tag}
          value={category}
          onChange={setCategory}
          options={availableCats}
          onAdd={handleAddCategory}
          onDelete={handleDeleteCategory}
          addOptionLabel="+ Add category…"
          addPlaceholder="New category"
        />

        <div>
          <label className="form-label">
            <StickyNote className="h-3.5 w-3.5 text-slate-400" />
            Notes <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder={isIncome ? 'e.g. Stage 1 advance' : 'e.g. Generator fuel bill'}
            className="form-input"
          />
        </div>

        <div className="-mx-6 -mb-6 flex justify-end gap-2.5 border-t border-slate-300 bg-slate-50/60 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary min-w-[130px]">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Saving…' : initialData ? 'Update' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
