import React, { useState, useEffect } from 'react';
import { todayISO } from '../../lib/dates';
import { Plus, Trash2, FilePlus2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Quotation, WorkSite, QuotationItem, QuotationItemType, QuotationPage } from '../../types';
import { PageEditor, newPage } from './PageEditor';
import { QuotationHeader } from './QuotationHeader';
import { isRichTextEmpty, sanitizeRichText } from '../../lib/richText';
import { confirmDelete } from '../common/ConfirmHost';
import { OptionSelect } from '../common/OptionSelect';
import { useCompany } from '../../context/CompanyContext';

interface QuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: Quotation | null;
  workSitesList: WorkSite[];
  /** Kind for a new quotation; an edited one keeps its own */
  kind?: 'ITEMS' | 'WRITTEN';
}

export const QuotationModal: React.FC<QuotationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  workSitesList,
  kind: newKind = 'ITEMS',
}) => {
  const kind = initialData ? (initialData.kind === 'WRITTEN' ? 'WRITTEN' : 'ITEMS') : newKind;
  const isWritten = kind === 'WRITTEN';
  const [quotationNo, setQuotationNo] = useState('');
  const [date, setDate] = useState(todayISO());
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');
  const [workSiteId, setWorkSiteId] = useState('');
  const [gstPercent, setGstPercent] = useState<number>(18);
  const [items, setItems] = useState<QuotationItem[]>([
    {
      description: 'Supply & erection of 9M Tubular Steel Pole with fittings',
      unit: 'Nos',
      qty: 4,
      itemType: 'BOTH',
      supplyRate: 10000,
      labourRate: 2500,
      rate: 12500,
      amount: 50000,
    },
  ]);
  const [pages, setPages] = useState<QuotationPage[]>([]);
  const { pans, defaultPan, addPan } = useCompany();
  const [showPan, setShowPan] = useState(false);
  const [pan, setPan] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      const saved = Array.isArray(initialData.pages) ? initialData.pages : [];
      setPages(saved.length > 0 ? saved.map((p) => ({ ...p })) : initialData.kind === 'WRITTEN' ? [newPage()] : []);
      setShowPan(Boolean(initialData.pan));
      setPan(initialData.pan || defaultPan?.pan || '');
      setQuotationNo(initialData.quotationNo || '');
      setDate(
        initialData.date
          ? new Date(initialData.date).toISOString().split('T')[0]
          : todayISO()
      );
      setClientName(initialData.clientName || '');
      setAddress(initialData.address || '');
      setWorkSiteId(initialData.workSiteId || '');
      setGstPercent(initialData.gstPercent ?? 18);
      setItems(
        initialData.items && initialData.items.length > 0
          ? initialData.items.map((i) => {
              const itemType = (i.itemType as QuotationItemType) || 'BOTH';
              const supplyRate =
                i.supplyRate !== undefined
                  ? Number(i.supplyRate)
                  : itemType === 'LABOUR'
                  ? 0
                  : Number(i.rate || 0);
              const labourRate =
                i.labourRate !== undefined
                  ? Number(i.labourRate)
                  : 0;
              const rate =
                itemType === 'BOTH'
                  ? supplyRate + labourRate
                  : itemType === 'SUPPLY'
                  ? supplyRate
                  : labourRate;
              const qty = Number(i.qty || 0);
              return {
                ...i,
                itemType,
                supplyRate,
                labourRate,
                rate: rate || Number(i.rate || 0),
                amount: Number(i.amount || qty * (rate || Number(i.rate || 0))),
              };
            })
          : []
      );
    } else {
      const now = new Date();
      const seq = Math.floor(1000 + Math.random() * 9000);
      setQuotationNo(
        `QT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${seq}`
      );
      setDate(todayISO());
      setClientName('');
      setAddress('');
      setWorkSiteId('');
      setGstPercent(18);
      setPages(newKind === 'WRITTEN' ? [newPage()] : []);
      setShowPan(false);
      setPan(defaultPan?.pan || '');
      setItems(newKind === 'WRITTEN' ? [] : [
        {
          description: 'Supply & erection of 9M Tubular Steel Pole with fittings',
          unit: 'Nos',
          qty: 4,
          itemType: 'BOTH',
          supplyRate: 10000,
          labourRate: 2500,
          rate: 12500,
          amount: 50000,
        },
      ]);
    }
    setError(null);
  }, [initialData, isOpen, workSitesList, newKind]);

  // One field for the client: picking a saved work site links it, any other name is a company
  const handleClientChange = (value: string) => {
    setClientName(value);
    const site = workSitesList.find((s) => s.name.trim().toLowerCase() === value.trim().toLowerCase());
    setWorkSiteId(site?.id || '');
    if (site?.address && !address.trim()) setAddress(site.address);
  };

  const updatePage = (id: string, html: string) =>
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, html } : p)));
  const removePage = (id: string) => setPages((prev) => prev.filter((p) => p.id !== id));
  const addPage = () => setPages((prev) => [...prev, newPage()]);

  // Line item handlers
  const addItemRow = () => {
    setItems([
      ...items,
      {
        description: '',
        unit: 'Nos',
        qty: 1,
        itemType: 'BOTH',
        supplyRate: 0,
        labourRate: 0,
        rate: 0,
        amount: 0,
      },
    ]);
  };

  const updateItemRow = (
    index: number,
    field: keyof QuotationItem,
    value: any
  ) => {
    const updated = [...items];
    const row = { ...updated[index], [field]: value };

    const itemType: QuotationItemType =
      (field === 'itemType' ? value : row.itemType) || 'BOTH';
    const qty = field === 'qty' ? Number(value || 0) : Number(row.qty || 0);

    let supplyRate =
      field === 'supplyRate'
        ? Number(value || 0)
        : Number(row.supplyRate || 0);
    let labourRate =
      field === 'labourRate'
        ? Number(value || 0)
        : Number(row.labourRate || 0);

    if (itemType === 'SUPPLY') {
      labourRate = 0;
    } else if (itemType === 'LABOUR') {
      supplyRate = 0;
    }

    let rate = 0;
    if (itemType === 'BOTH') {
      rate = supplyRate + labourRate;
    } else if (itemType === 'SUPPLY') {
      rate = supplyRate;
    } else if (itemType === 'LABOUR') {
      rate = labourRate;
    }

    row.itemType = itemType;
    row.supplyRate = supplyRate;
    row.labourRate = labourRate;
    row.rate = rate;
    row.qty = qty;
    row.amount = qty * rate;

    updated[index] = row;
    setItems(updated);
  };

  const removeItemRow = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculations
  const totalSupplyAmount = items.reduce((sum, item) => {
    const qty = Number(item.qty || 0);
    const sRate = item.itemType === 'LABOUR' ? 0 : Number(item.supplyRate || 0);
    return sum + qty * sRate;
  }, 0);

  const totalLabourAmount = items.reduce((sum, item) => {
    const qty = Number(item.qty || 0);
    const lRate = item.itemType === 'SUPPLY' ? 0 : Number(item.labourRate || 0);
    return sum + qty * lRate;
  }, 0);

  const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const gstAmount = (subtotal * gstPercent) / 100;
  const grandTotal = subtotal + gstAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setError('Client name is required.');
      return;
    }

    const filledPages = pages
      .map((p) => ({ id: p.id, html: sanitizeRichText(p.html) }))
      .filter((p) => !isRichTextEmpty(p.html));

    if (showPan && !pan.trim()) {
      setError('Select or add a PAN number, or untick "Add PAN No."');
      return;
    }

    if (isWritten && filledPages.length === 0) {
      setError('Please write something on the page.');
      return;
    }

    if (!isWritten && items.length === 0) {
      setError('Please add at least one line item.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSave({
        // Numbers are assigned by the server in sequence; existing ones never change
        quotationNo: undefined,
        date,
        clientName: clientName.trim(),
        address: address.trim() || undefined,
        // '' clears an earlier link when the client is no longer a saved work site
        workSiteId: workSiteId || '',
        gstPercent: Number(gstPercent),
        kind,
        // '' clears a PAN chosen earlier
        pan: showPan ? pan.trim().toUpperCase() : '',
        pages: filledPages,
        items: (isWritten ? [] : items).map((i) => {
          const itemType = (i.itemType as QuotationItemType) || 'BOTH';
          const supplyRate = itemType === 'LABOUR' ? 0 : Number(i.supplyRate || 0);
          const labourRate = itemType === 'SUPPLY' ? 0 : Number(i.labourRate || 0);
          const rate =
            itemType === 'BOTH'
              ? supplyRate + labourRate
              : itemType === 'SUPPLY'
              ? supplyRate
              : labourRate;
          const qty = Number(i.qty || 0);
          return {
            description: i.description,
            unit: i.unit,
            qty,
            itemType,
            supplyRate,
            labourRate,
            rate,
            amount: qty * rate,
          };
        }),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save quotation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isWritten
          ? initialData
            ? 'Edit Written Quotation'
            : 'Write Quotation'
          : initialData
          ? 'Edit Quotation'
          : 'Create Electrical Quotation'
      }
      subtitle={
        isWritten
          ? 'Type the quotation freely, like a Word document'
          : 'Client commercial proposal with Supply & Labour cost split and GST computation'
      }
      maxWidth="6xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
            {error}
          </div>
        )}

        {/* Client & Header Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-300">
          <div>
            <label className="form-label">
              Quotation No
            </label>
            <div className="form-input flex items-center bg-slate-50 font-mono font-semibold text-slate-700">
              {initialData ? quotationNo : <span className="font-sans font-normal text-slate-400">Auto-generated on save</span>}
            </div>
          </div>

          <div>
            <label className="form-label">
              Quotation Date *
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="form-label">
              Client / Work Site / Company Name *
            </label>
            <input
              type="text"
              required
              list="quotation-client-sites"
              value={clientName}
              onChange={(e) => handleClientChange(e.target.value)}
              placeholder="Pick a work site or type a company name"
              className="form-input"
            />
            <datalist id="quotation-client-sites">
              {workSitesList.map((site) => (
                <option key={site.id} value={site.name}>
                  {site.section || site.address || ''}
                </option>
              ))}
            </datalist>
            {workSiteId && (
              <p className="mt-1 text-[11px] font-medium text-emerald-600">Linked to saved work site</p>
            )}
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <label className="form-label">
              Client Billing Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Corporate Office, 4th Floor, MIDC Area"
              className="form-input"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-end gap-4">
            <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={showPan}
                onChange={(e) => {
                  setShowPan(e.target.checked);
                  if (e.target.checked && !pan) setPan(defaultPan?.pan || '');
                }}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Add PAN No.
            </label>
            {showPan && (
              <div className="w-full sm:w-72">
                <OptionSelect
                  label="PAN number"
                  value={pan}
                  onChange={setPan}
                  options={pans.map((p) => ({
                    id: p.pan,
                    label: `${p.pan}${p.label ? ` · ${p.label}` : ''}${p.isDefault ? ' (default)' : ''}`,
                  }))}
                  onAdd={(name) => {
                    const value = name.trim().toUpperCase();
                    addPan(value).catch(() => setError('PAN could not be saved to the list, but it will print on this quotation.'));
                    return value;
                  }}
                  emptyLabel="Select PAN"
                  addOptionLabel="+ Add PAN…"
                  addPlaceholder="ABCDE1234F"
                />
              </div>
            )}
          </div>
        </div>

        {!isWritten && (<>
        {/* Dynamic Line Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700">
                Scope of Work & Bill of Quantities (Line Items)
              </h4>
              <p className="text-[11px] text-slate-500">
                Choose item pricing structure (Both Supply & Labour, Supply Only, or Labour Only) and enter applicable rates
              </p>
            </div>
            <button
              type="button"
              onClick={addItemRow}
              className="btn-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Item</span>
            </button>
          </div>

          <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="overflow-x-auto min-w-full">
              <table className="w-full text-left text-xs text-slate-700 min-w-[950px]">
                <thead className="bg-slate-50 border-b border-slate-300 font-semibold text-slate-600 uppercase">
                  <tr>
                    <th className="p-2.5 min-w-[220px]">Description</th>
                    <th className="p-2.5 w-44 text-center">Scope / Type</th>
                    <th className="p-2.5 w-20 text-center">Unit</th>
                    <th className="p-2.5 w-20 text-center">Qty</th>
                    <th className="p-2.5 w-28 text-right">Supply Rate (₹)</th>
                    <th className="p-2.5 w-28 text-right">Labour Rate (₹)</th>
                    <th className="p-2.5 w-24 text-right">Unit Rate (₹)</th>
                    <th className="p-2.5 w-28 text-right">Amount (₹)</th>
                    <th className="p-2.5 w-10 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {items.map((row, idx) => {
                    const currentType = row.itemType || 'BOTH';
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        {/* Description */}
                        <td className="p-2">
                          <input
                            type="text"
                            required
                            value={row.description}
                            onChange={(e) =>
                              updateItemRow(idx, 'description', e.target.value)
                            }
                            placeholder="e.g. Laying and testing 11kV HT XLPE Cable"
                            className="w-full rounded border border-slate-300 p-1.5 text-xs focus:outline-none focus:border-blue-500"
                          />
                        </td>

                        {/* Scope / Type Selection */}
                        <td className="p-2 text-center">
                          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-300">
                            <button
                              type="button"
                              onClick={() => updateItemRow(idx, 'itemType', 'BOTH')}
                              title="Supply & Labour Both"
                              className={`px-2 py-1 text-[11px] font-semibold rounded-md transition ${
                                currentType === 'BOTH'
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Both
                            </button>
                            <button
                              type="button"
                              onClick={() => updateItemRow(idx, 'itemType', 'SUPPLY')}
                              title="Supply / Material Only"
                              className={`px-2 py-1 text-[11px] font-semibold rounded-md transition ${
                                currentType === 'SUPPLY'
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Supply
                            </button>
                            <button
                              type="button"
                              onClick={() => updateItemRow(idx, 'itemType', 'LABOUR')}
                              title="Labour / Service Only"
                              className={`px-2 py-1 text-[11px] font-semibold rounded-md transition ${
                                currentType === 'LABOUR'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Labour
                            </button>
                          </div>
                        </td>

                        {/* Unit */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.unit || ''}
                            onChange={(e) =>
                              updateItemRow(idx, 'unit', e.target.value)
                            }
                            placeholder="Mtrs/Nos"
                            className="w-full text-center rounded border border-slate-300 p-1.5 text-xs focus:outline-none focus:border-blue-500"
                          />
                        </td>

                        {/* Qty */}
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={row.qty}
                            onChange={(e) =>
                              updateItemRow(idx, 'qty', Number(e.target.value || 0))
                            }
                            className="w-full text-center rounded border border-slate-300 p-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                          />
                        </td>

                        {/* Supply Rate */}
                        <td className="p-2 text-right">
                          {currentType === 'LABOUR' ? (
                            <div className="w-full rounded border border-dashed border-slate-300 bg-slate-100/70 p-1.5 text-center text-xs text-slate-400 font-mono select-none">
                              -
                            </div>
                          ) : (
                            <div className="relative">
                              <span className="absolute left-2 top-1.5 text-xs text-slate-400">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={row.supplyRate ?? 0}
                                onChange={(e) =>
                                  updateItemRow(idx, 'supplyRate', Number(e.target.value || 0))
                                }
                                placeholder="0"
                                className="w-full rounded border border-slate-300 pl-5 pr-2 py-1.5 text-xs font-mono text-right focus:outline-none focus:border-blue-500 bg-white"
                              />
                            </div>
                          )}
                        </td>

                        {/* Labour Rate */}
                        <td className="p-2 text-right">
                          {currentType === 'SUPPLY' ? (
                            <div className="w-full rounded border border-dashed border-slate-300 bg-slate-100/70 p-1.5 text-center text-xs text-slate-400 font-mono select-none">
                              -
                            </div>
                          ) : (
                            <div className="relative">
                              <span className="absolute left-2 top-1.5 text-xs text-slate-400">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={row.labourRate ?? 0}
                                onChange={(e) =>
                                  updateItemRow(idx, 'labourRate', Number(e.target.value || 0))
                                }
                                placeholder="0"
                                className="w-full rounded border border-slate-300 pl-5 pr-2 py-1.5 text-xs font-mono text-right focus:outline-none focus:border-blue-500 bg-white"
                              />
                            </div>
                          )}
                        </td>

                        {/* Net Unit Rate (Calculated) */}
                        <td className="p-2 text-right font-mono font-semibold text-slate-800 bg-slate-50/60 rounded">
                          ₹{(row.rate || 0).toLocaleString()}
                          <div className="text-[10px] text-slate-400 font-normal">
                            {currentType === 'BOTH' ? 'Supply+Lab' : currentType === 'SUPPLY' ? 'Supply' : 'Labour'}
                          </div>
                        </td>

                        {/* Amount (Qty * Net Rate) */}
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          ₹{(row.amount || 0).toLocaleString()}
                        </td>

                        {/* Action */}
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={async () => {
                              if (await confirmDelete(`Remove line item ${idx + 1}${row.description ? ` "${row.description}"` : ''}?`, { confirmText: 'Remove' }))
                                removeItemRow(idx);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                            title="Remove Line Item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Financial Summary & Split Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-300">
          {/* Left: Supply vs Labour Cost Split */}
          <div className="space-y-1.5 text-xs text-slate-600 border-b md:border-b-0 md:border-r border-slate-300 pb-3 md:pb-0 md:pr-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Cost Structure Breakdown
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Total Supply / Material Value:</span>
              </span>
              <span className="font-mono font-semibold text-slate-800">
                ₹{totalSupplyAmount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Total Labour / Erection Value:</span>
              </span>
              <span className="font-mono font-semibold text-slate-800">
                ₹{totalLabourAmount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1.5 border-t border-slate-300 font-medium text-slate-700">
              <span>Combined Subtotal (Excl. Tax):</span>
              <span className="font-mono font-bold text-slate-900">
                ₹{subtotal.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Right: GST & Grand Total */}
          <div className="space-y-2 text-xs flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-700">GST Rate (%):</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={gstPercent}
                  onChange={(e) => setGstPercent(Number(e.target.value || 0))}
                  className="w-16 rounded border border-slate-300 p-1 text-xs font-bold text-center bg-white"
                />
              </div>
              <div className="text-right">
                <span className="text-slate-500 mr-2">GST Amount:</span>
                <span className="font-mono font-semibold text-slate-800">
                  ₹{gstAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-baseline pt-2 border-t border-slate-300">
              <span className="text-sm font-bold text-slate-900">
                Total Quotation Value:
              </span>
              <span className="font-mono text-lg text-amber-900 font-bold">
                ₹{grandTotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        </>)}

        {/* Free text pages */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700">
                {isWritten ? 'Quotation Pages' : 'Extra Pages'}
              </h4>
              <p className="text-[11px] text-slate-500">
                {isWritten
                  ? 'Write the quotation here. The company header prints on the first page.'
                  : 'Optional: terms, scope of work, notes or a cover letter, printed after the items.'}
              </p>
            </div>
            <button type="button" onClick={addPage} className="btn-secondary">
              <FilePlus2 className="h-4 w-4 text-blue-600" />
              Add page
            </button>
          </div>
          {pages.map((p, idx) => (
            <PageEditor
              key={p.id}
              page={p}
              index={idx}
              total={pages.length}
              onChange={(html) => updatePage(p.id, html)}
              onRemove={() => removePage(p.id)}
              placeholder={idx === 0 && isWritten ? 'Dear Sir / Madam, …' : 'Start typing…'}
              // Written quotations show the printed header on the first page while typing
              header={
                idx === 0 && isWritten ? (
                  <QuotationHeader
                    quotationNo={initialData?.quotationNo || 'Auto on save'}
                    date={date}
                    pan={showPan ? pan : undefined}
                    clientName={clientName}
                    address={address || workSitesList.find((s) => s.id === workSiteId)?.address}
                  />
                ) : undefined
              }
            />
          ))}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-300">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Saving...' : initialData ? 'Update Quotation' : isWritten ? 'Save Quotation' : 'Generate Quotation'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
