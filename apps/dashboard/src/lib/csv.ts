export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);

  const trimmed = str.replace(/^[\s\x00-\x1F]+/, '');
  if (/^[=+\-@]/.test(trimmed)) {
    str = `'${str}`;
  }

  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function generateCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(csvCell).join(',');
  const rowLines = rows.map(row => row.map(csvCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}
