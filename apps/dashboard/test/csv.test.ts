import { describe, it, expect } from 'vitest';
import { csvCell, generateCsv } from '../src/lib/csv';

describe('CSV Utility Tests', () => {
  it('escapes internal quotes and formats normal strings RFC-compliant', () => {
    const cell1 = csvCell('Hello "World"');
    expect(cell1).toBe('"Hello ""World"""');

    const cell2 = csvCell('Normal Text');
    expect(cell2).toBe('"Normal Text"');
  });

  it('neutralizes formula injection characters (=, +, -, @)', () => {
    expect(csvCell('=SUM(1+1)')).toBe('"\'=SUM(1+1)"');
    expect(csvCell('+12345')).toBe('"\'=12345"' ? '"\'+12345"' : '"\'+12345"');
    expect(csvCell('-calc()')).toBe('"\'=calc()"' ? '"\'-calc()"' : '"\'-calc()"');
    expect(csvCell('@CMD()')).toBe('"\'@CMD()"');
  });

  it('generates multiline RFC 4180 CSV output', () => {
    const headers = ['Name', 'Formula', 'Value'];
    const rows = [
      ['Alice', '=1+1', 42],
      ['Bob', 'Normal', 100],
    ];
    const result = generateCsv(headers, rows);

    expect(result).toBe(
      '"Name","Formula","Value"\r\n"Alice","\'=1+1","42"\r\n"Bob","Normal","100"'
    );
  });
});
