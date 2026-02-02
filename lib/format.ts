export const formatPeso = (value: number): string => {
  try {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0,
    }).format(value || 0);
  } catch {
    return `₱${Math.round(value || 0).toLocaleString()}`;
  }
};

export const formatNumber = (value: number): string => {
  return Math.round(value || 0).toLocaleString();
};

export const fmtDateRange = (startISO: string, endISO: string) => {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return `${fmt(start)} → ${fmt(end)}`;
};
