import { AdvisorStatus } from '@/lib/types';
import { formatPeso, formatNumber } from '@/lib/format';
import { Badge } from './Badge';

function List({
  title,
  tone,
  items,
  rightLabel,
  rightValue,
}: {
  title: string;
  tone: 'green' | 'amber' | 'red';
  items: AdvisorStatus[];
  rightLabel: string;
  rightValue: (a: AdvisorStatus) => string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between p-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Badge tone={tone}>{title}</Badge>
          <div className="text-sm text-slate-500">{items.length}</div>
        </div>
        <div className="text-xs text-slate-400">{rightLabel}</div>
      </div>
      <div className="max-h-[320px] overflow-auto">
        {items.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">None</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((a) => (
              <li key={a.advisor} className="flex items-center justify-between p-3">
                <div className="text-sm font-medium text-slate-800">{a.advisor}</div>
                <div className="text-sm tabular-nums text-slate-700">{rightValue(a)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AdvisorStatusPanel({
  producing,
  pending,
  nonProducing,
}: {
  producing: AdvisorStatus[];
  pending: AdvisorStatus[];
  nonProducing: AdvisorStatus[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <List
        title="Producing"
        tone="green"
        items={producing}
        rightLabel="Approved FYC"
        rightValue={(a) => formatPeso(a.approved.fyc)}
      />
      <List
        title="Pending"
        tone="amber"
        items={pending}
        rightLabel="Pending FYC"
        rightValue={(a) => formatPeso(a.open.fyc)}
      />
      <List
        title="Non-Producing"
        tone="red"
        items={nonProducing}
        rightLabel=""
        rightValue={() => ''}
      />
    </div>
  );
}
