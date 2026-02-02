import { ReactNode } from 'react';

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {right ? <div>{right}</div> : null}
      </div>
      {children}
    </section>
  );
}
