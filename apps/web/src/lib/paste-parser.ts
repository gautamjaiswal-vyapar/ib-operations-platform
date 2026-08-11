export type PasteResult<T> = { rows: T[]; errors: string[] };

function splitDelimited(line: string, delimiter: string) {
  const cells: string[] = []; let cell = ''; let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) { cell += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { cells.push(cell.trim()); cell = ''; }
    else cell += char;
  }
  cells.push(cell.trim()); return cells;
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function parsePaste<T>(text: string, aliases: Record<keyof T, string[]>, convert: (row: Record<keyof T, string>, rowNumber: number) => T): PasteResult<T> {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], errors: ['Paste a header row followed by at least one data row.'] };
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = splitDelimited(lines[0], delimiter).map(normalize);
  const fields = Object.keys(aliases) as Array<keyof T>;
  const indexes = fields.reduce((map, field) => {
    const accepted = aliases[field].map(normalize); map[field] = headers.findIndex((header) => accepted.includes(header)); return map;
  }, {} as Record<keyof T, number>);
  const missing = fields.filter((field) => indexes[field] < 0);
  if (missing.length) return { rows: [], errors: [`Missing columns: ${missing.map(String).join(', ')}`] };
  const rows: T[] = []; const errors: string[] = [];
  lines.slice(1).forEach((line, index) => {
    const cells = splitDelimited(line, delimiter); const raw = fields.reduce((record, field) => { record[field] = cells[indexes[field]] ?? ''; return record; }, {} as Record<keyof T, string>);
    try { rows.push(convert(raw, index + 2)); } catch (error) { errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Invalid data'}`); }
  });
  return { rows, errors };
}
