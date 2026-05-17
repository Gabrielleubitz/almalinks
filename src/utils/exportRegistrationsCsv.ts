import { formatEventDateAndTime } from './eventDisplayTime';

export type CsvRegistrationRow = {
  name?: string;
  email?: string;
  phone?: string;
  work?: string;
  status?: string;
  eventName?: string;
  eventDate?: string;
  registeredAt?: unknown;
};

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatRegisteredAt(value: unknown): string {
  if (!value) return '';
  const date =
    value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function'
      ? (value as { toDate: () => Date }).toDate()
      : new Date(value as string | number);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function formatEventDateShort(iso: string | undefined): string {
  if (!iso?.trim()) return '';
  const { dateLine } = formatEventDateAndTime(iso, {});
  return dateLine;
}

export function buildRegistrationsCsv(rows: CsvRegistrationRow[], options?: { includeEvent?: boolean }): string {
  const includeEvent = options?.includeEvent !== false;
  const headers = includeEvent
    ? ['Member Name', 'Email', 'Phone', 'Work', 'Event', 'Event Date', 'Status', 'Registered At']
  : ['Member Name', 'Email', 'Phone', 'Work', 'Status', 'Registered At'];

  const lines = [headers.map(escapeCsvCell).join(',')];

  for (const row of rows) {
    const cells = [
      row.name ?? '',
      row.email ?? '',
      row.phone ?? '',
      row.work ?? '',
    ];
    if (includeEvent) {
      cells.push(row.eventName ?? '', formatEventDateShort(row.eventDate));
    }
    cells.push(row.status ?? '', formatRegisteredAt(row.registeredAt));
    lines.push(cells.map(escapeCsvCell).join(','));
  }

  return lines.join('\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
