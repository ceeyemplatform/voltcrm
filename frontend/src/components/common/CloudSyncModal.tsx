import React, { useState, useEffect } from 'react';
import { formatDateTime } from '../../lib/dates';
import {
  Cloud,
  CloudUpload,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Sliders,
  X,
  HelpCircle,
  Database,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Modal } from './Modal';
import { api } from '../../lib/api';
import { CloudSyncSettings, CloudSyncResponse } from '../../types';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncCompleted?: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncCompleted,
}) => {
  const [settings, setSettings] = useState<CloudSyncSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<CloudSyncResponse | null>(null);

  // Form fields
  const [webhookUrl, setWebhookUrl] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [scriptTemplate, setScriptTemplate] = useState<string>('');

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.cloudSync.getSettings();
      setSettings(data);
      setWebhookUrl(data.googleSheetWebhookUrl || '');
      setSheetUrl(data.googleSheetUrl || '');

      // If webhook is not set yet, automatically open the setup instructions
      if (!data.googleSheetWebhookUrl) {
        setShowConfig(true);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load cloud sync configuration');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplate = async () => {
    try {
      const res = await api.cloudSync.getTemplate();
      setScriptTemplate(res.template);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      loadTemplate();
      setSyncSuccess(null);
    }
  }, [isOpen]);

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    setError(null);
    try {
      const updated = await api.cloudSync.updateSettings({
        googleSheetWebhookUrl: webhookUrl.trim(),
        googleSheetUrl: sheetUrl.trim(),
      });
      setSettings(updated);
      setShowConfig(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSyncNow = async () => {
    if (!webhookUrl.trim() && !settings?.googleSheetWebhookUrl) {
      setShowConfig(true);
      setError('Please provide your Google Apps Script Webhook URL first.');
      return;
    }

    setSyncing(true);
    setError(null);
    setSyncSuccess(null);

    try {
      // Auto-save settings first if edited
      if (
        webhookUrl.trim() !== (settings?.googleSheetWebhookUrl || '') ||
        sheetUrl.trim() !== (settings?.googleSheetUrl || '')
      ) {
        await api.cloudSync.updateSettings({
          googleSheetWebhookUrl: webhookUrl.trim(),
          googleSheetUrl: sheetUrl.trim(),
        });
      }

      const result = await api.cloudSync.push(webhookUrl.trim());
      setSyncSuccess(result);
      setSettings((prev) => (prev ? { ...prev, lastSyncedAt: result.lastSyncedAt } : prev));
      if (onSyncCompleted) {
        onSyncCompleted();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to sync data with Google Sheet');
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyScript = () => {
    if (!scriptTemplate) return;
    navigator.clipboard.writeText(scriptTemplate);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const isConfigured = Boolean(settings?.googleSheetWebhookUrl || webhookUrl.trim());

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Google Sheets Cloud Sync"
      subtitle="Instantly update and synchronize your electrical CRM records with Google Sheets"
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-xl bg-rose-50 p-4 border border-rose-200 text-xs text-rose-700 flex items-start space-x-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="block font-semibold">Sync Notice</strong>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Sync Status Banner */}
        <div className="rounded-xl border border-slate-300 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-md relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-10 -translate-y-6 opacity-10 pointer-events-none">
            <FileSpreadsheet className="h-64 w-64 text-emerald-400" />
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span
                  className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    isConfigured
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <span>{isConfigured ? 'Google Sheet Connected' : 'Setup Required'}</span>
                </span>

                {settings?.lastSyncedAt && (
                  <span className="text-[11px] text-slate-400">
                    Last sync: {formatDateTime(settings.lastSyncedAt)}
                  </span>
                )}
              </div>

              <h3 className="text-xl font-bold tracking-tight flex items-center space-x-2">
                <span>ElecCRM Cloud Spreadsheet</span>
              </h3>
              <p className="text-xs text-slate-300 max-w-md">
                Pushes Work Orders, Day-by-Day Workforce Logs, Labour Directory, Work Sites, and Polevar Material Matrices directly to your Google Sheet tabs.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={syncing}
                className="inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs hover:from-emerald-400 hover:to-teal-400 transition shadow-lg disabled:opacity-50 cursor-pointer active:scale-98"
              >
                <RefreshCw className={`h-4 w-4 text-slate-950 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing with Google...' : 'Sync with Cloud Now'}</span>
              </button>

              {settings?.googleSheetUrl && (
                <a
                  href={settings.googleSheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition border border-white/10"
                  title="Open live Google Spreadsheet in new tab"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Open Sheet ↗</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Sync Success Results Breakdown */}
        {syncSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm mb-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span>Google Spreadsheet Updated Successfully!</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Work Orders</span>
                <span className="text-base font-bold text-slate-900 mt-0.5 block">
                  {syncSuccess.summary.totalWorks}
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">Sheet: Work Orders</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Daily Work Logs</span>
                <span className="text-base font-bold text-slate-900 mt-0.5 block">
                  {syncSuccess.summary.totalDailyLogs}
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">Sheet: Daily Logs</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Labour Directory</span>
                <span className="text-base font-bold text-slate-900 mt-0.5 block">
                  {syncSuccess.summary.totalLabours}
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">Sheet: Labour Directory</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Work Sites</span>
                <span className="text-base font-bold text-slate-900 mt-0.5 block">
                  {syncSuccess.summary.totalSites}
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">Sheet: Work Sites</span>
              </div>
            </div>
          </div>
        )}

        {/* Configuration Accordion Toggle */}
        <div className="border border-slate-300 rounded-xl overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Sliders className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  Google Sheet Connection Settings
                </h4>
                <p className="text-[11px] text-slate-500">
                  Configure your Google Apps Script Webhook URL and spreadsheet link
                </p>
              </div>
            </div>

            <span className="text-xs font-semibold text-blue-600">
              {showConfig ? 'Hide Settings' : 'Configure / Setup'}
            </span>
          </button>

          {showConfig && (
            <div className="p-5 border-t border-slate-300 bg-slate-50/50 space-y-5 animate-in fade-in">
              {/* 3 Step Setup Guide */}
              <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-4 space-y-3 text-xs">
                <div className="flex items-center space-x-2 text-blue-900 font-bold">
                  <HelpCircle className="h-4 w-4 text-blue-600" />
                  <span>3-Minute Google Sheet Setup Guide</span>
                </div>

                <ol className="space-y-2 text-slate-700 list-decimal list-inside text-[11px] leading-relaxed">
                  <li>
                    Create a new spreadsheet in{' '}
                    <a
                      href="https://sheets.new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-blue-700 underline"
                    >
                      Google Sheets (sheets.new) ↗
                    </a>
                  </li>
                  <li>
                    Inside your Google Sheet, click <strong>Extensions</strong> →{' '}
                    <strong>Apps Script</strong>.
                  </li>
                  <li>
                    Delete any default code, paste the script below, then click{' '}
                    <strong>Deploy → New deployment</strong>.
                  </li>
                  <li>
                    Select <strong>Web app</strong>, set <em>Who has access</em> to{' '}
                    <strong>Anyone</strong>, and click <strong>Deploy</strong>.
                  </li>
                  <li>
                    Copy the generated <strong>Web app URL</strong> and paste it into the field below.
                  </li>
                </ol>

                <div className="pt-2 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleCopyScript}
                    className="btn-primary"
                  >
                    {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedCode ? 'Copied to Clipboard!' : 'Copy Ready-Made Apps Script Code'}</span>
                  </button>
                  <span className="text-[10px] text-blue-700">One-click copy for your Google Sheet</span>
                </div>
              </div>

              {/* Form Inputs */}
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="form-label">
                    Google Apps Script Webhook URL <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    className="form-input font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    This is the deployment Web App URL generated by Google Apps Script.
                  </p>
                </div>

                <div>
                  <label className="form-label">
                    Google Spreadsheet Link (Optional)
                  </label>
                  <input
                    type="url"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs.../edit"
                    className="form-input font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Adding your spreadsheet URL enables the one-tap "Open Sheet ↗" button.
                  </p>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="btn-primary"
                  >
                    <span>{savingSettings ? 'Saving...' : 'Save Settings'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-2 border-t border-slate-300">
          <span className="text-[11px] text-slate-400 flex items-center space-x-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>End-to-end encrypted direct webhook sync to your personal Google account</span>
          </span>

          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

