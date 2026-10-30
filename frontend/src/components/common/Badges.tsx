import React from 'react';
import { ChevronDown, MessageCircle, Phone, Mail, Globe } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  onClick?: () => void;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, onClick }) => {
  const norm = (status || '').toUpperCase().replace(/\s+/g, '_');

  let colorClasses = 'bg-slate-50 text-slate-700 ring-slate-300';

  if (norm.includes('RESOLV') || norm.includes('COMPLET') || norm.includes('APPROV') || norm.includes('ACTIVE') || norm.includes('PAID')) {
    colorClasses = 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  } else if (norm.includes('REJECT') || norm.includes('CANCEL') || norm.includes('FAILED')) {
    colorClasses = 'bg-rose-50 text-rose-700 ring-rose-200';
  } else if (norm.includes('PENDING') || norm.includes('DRAFT') || norm.includes('WAITING') || norm.includes('UNASSIGNED') || norm.includes('HOLD') || norm.includes('PAUSE')) {
    colorClasses = 'bg-amber-50 text-amber-700 ring-amber-200';
  } else if (norm.includes('PROGRESS') || norm.includes('IN_PROGRESS') || norm.includes('PROCESSING') || norm.includes('OPEN') || norm.includes('EXECUTION')) {
    colorClasses = 'bg-blue-50 text-blue-700 ring-blue-200';
  } else if (norm.includes('TEST') || norm.includes('INSPECT') || norm.includes('CEIG') || norm.includes('AUDIT') || norm.includes('CHECK')) {
    colorClasses = 'bg-purple-50 text-purple-700 ring-purple-200';
  } else if (norm.includes('POLE') || norm.includes('ERECTION') || norm.includes('CABLE') || norm.includes('STRING') || norm.includes('TRENCH') || norm.includes('COMMISSION')) {
    colorClasses = 'bg-indigo-50 text-indigo-700 ring-indigo-200';
  } else {
    colorClasses = 'bg-violet-50 text-violet-700 ring-violet-200';
  }

  // Format label to Title Case unless user provided mixed-case text with spaces
  let formattedLabel = status || '';
  if (!(/[a-z]/.test(formattedLabel) && (formattedLabel.includes(' ') || formattedLabel.includes('&') || formattedLabel.includes('/')))) {
    formattedLabel = formattedLabel
      .split(/[_\s]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-all ${colorClasses} ${
        onClick ? 'cursor-pointer hover:brightness-95' : ''
      }`}
    >
      <span>{formattedLabel}</span>
      {onClick && <ChevronDown className="h-3 w-3 stroke-[2.5] opacity-70" />}
    </span>
  );
};

interface PriorityBadgeProps {
  priority: 'High' | 'Medium' | 'Low' | string;
  onClick?: () => void;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, onClick }) => {
  const norm = priority.toUpperCase();

  let colorClasses = 'bg-slate-50 text-slate-600 ring-slate-300';
  if (norm.includes('HIGH') || norm.includes('CRITICAL') || norm.includes('URGENT')) {
    colorClasses = 'bg-rose-50 text-rose-700 ring-rose-200';
  } else if (norm.includes('MED') || norm.includes('MODERATE')) {
    colorClasses = 'bg-amber-50 text-amber-700 ring-amber-200';
  } else if (norm.includes('LOW')) {
    colorClasses = 'bg-slate-50 text-slate-600 ring-slate-300';
  }

  const formatted = norm.charAt(0) + norm.slice(1).toLowerCase();

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-all ${colorClasses} ${
        onClick ? 'cursor-pointer hover:brightness-95' : ''
      }`}
    >
      <span>{formatted}</span>
      <ChevronDown className="h-3 w-3 stroke-[2.5] opacity-70" />
    </span>
  );
};

interface ChannelBadgeProps {
  channel?: 'WhatsApp' | 'Phone' | 'Email' | 'Web' | string;
}

export const ChannelBadge: React.FC<ChannelBadgeProps> = ({ channel = 'WhatsApp' }) => {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/80">
      <MessageCircle className="h-3.5 w-3.5 fill-emerald-100" />
      <span>{channel}</span>
    </span>
  );
};

export const MultiLineCell: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, className = '' }) => (
  <div className={`space-y-0.5 ${className}`}>
    <div className="font-semibold leading-snug text-slate-900">{title}</div>
    {subtitle && (
      <div className="text-xs font-normal leading-tight text-slate-500">
        {subtitle}
      </div>
    )}
  </div>
);

