'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';

async function writeToClipboard(text: string) {
  if (!text) return;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback for environments where Clipboard API is unavailable
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

export function CopySummaryButton({
  getText,
  title = 'Copy text summary',
  ariaLabel = 'Copy text summary to clipboard',
  className = '',
}: {
  getText: () => string;
  title?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const text = useMemo(() => (getText ? getText() : ''), [getText]);

  useEffect(() => {
    if (!copied && !failed) return;
    const t = window.setTimeout(() => {
      setCopied(false);
      setFailed(false);
    }, 1200);
    return () => window.clearTimeout(t);
  }, [copied, failed]);

  const onCopy = async () => {
    try {
      await writeToClipboard(text);
      setFailed(false);
      setCopied(true);
    } catch {
      setCopied(false);
      setFailed(true);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={onCopy}
        disabled={!text}
        className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm disabled:opacity-60"
        aria-label={ariaLabel}
        title={title}
      >
        <FileText size={16} />
      </button>

      <div
        className={`pointer-events-none absolute -top-8 right-0 rounded-lg px-2 py-1 text-[11px] font-semibold shadow-sm transition-opacity duration-300 ${copied ? 'opacity-100 bg-emerald-600 text-white' : failed ? 'opacity-100 bg-rose-600 text-white' : 'opacity-0'}`}
        aria-hidden="true"
      >
        {failed ? 'Copy failed' : 'Copied!'}
      </div>
    </div>
  );
}
