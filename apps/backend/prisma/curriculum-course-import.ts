// Pure helpers for import-curriculum-courses.ts (no database, no I/O) so the option, row and
// category rules can be unit-tested by curriculum-course-import.spec.ts.

// The extraction step writes this word for a value the book does not state.
export const NOT_FOUND = 'ไม่พบ';

export interface ImportOptions {
  program?: string;
  version?: string;
  file?: string;
  categoriesFile?: string;
  overwrite: boolean;
  apply: boolean;
  errors: string[];
}

const VALUE_OPTIONS = ['--program', '--version', '--file', '--categories-file'] as const;
const FLAG_OPTIONS = ['--apply', '--overwrite'];

export function parseImportOptions(argv: string[]): ImportOptions {
  const errors: string[] = [];
  const values = new Map<string, string>();
  for (const arg of argv) {
    if (FLAG_OPTIONS.includes(arg)) continue;
    const name = VALUE_OPTIONS.find((o) => arg === o || arg.startsWith(`${o}=`));
    if (!name) {
      errors.push(
        arg === '--full'
          ? '--full ยังไม่รองรับ (สคริปต์นี้นำเข้าแบบ lite เท่านั้น)'
          : `ไม่รู้จัก option: ${arg}`,
      );
      continue;
    }
    // `--file x.csv` (no "=") would otherwise be ignored and read as a missing option.
    if (!arg.includes('=')) {
      errors.push(`${name} ต้องเขียนเป็น ${name}=ค่า`);
      continue;
    }
    if (values.has(name)) {
      errors.push(`${name} ระบุได้ครั้งเดียว`);
      continue;
    }
    const value = arg.slice(name.length + 1).trim();
    if (value === '') errors.push(`${name} ต้องมีค่า`);
    else values.set(name, value);
  }
  for (const required of ['--program', '--version', '--file']) {
    if (!values.has(required) && !errors.some((e) => e.startsWith(required))) {
      errors.push(`ต้องระบุ ${required}=ค่า`);
    }
  }
  return {
    program: values.get('--program'),
    version: values.get('--version'),
    file: values.get('--file'),
    categoriesFile: values.get('--categories-file'),
    overwrite: argv.includes('--overwrite'),
    apply: argv.includes('--apply'),
    errors,
  };
}

// "ไม่พบ" and blank both mean "the book does not say".
export const cleanCell = (cell: string | undefined): string | null => {
  const value = (cell ?? '').trim();
  return value === '' || value === NOT_FOUND ? null : value;
};

export interface CourseRow {
  line: number;
  code: string;
  name: string;
  nameEn: string | null;
  credits: number;
  category: string | null;
  isRequired: boolean | null;
}

export interface ParsedRows<T> {
  rows: T[];
  errors: string[];
  warnings: string[];
}

// 'บังคับ', 'บังคับ (ตามใบ…)' -> true; 'เลือก…' -> false; anything else is unknown.
export function parseIsRequired(cell: string | undefined): boolean | null {
  const value = cleanCell(cell);
  if (value === null) return null;
  if (value.startsWith('บังคับ')) return true;
  if (value.startsWith('เลือก')) return false;
  return null;
}

// First row is the header; columns are found by name so the extra columns the extraction step
// writes (hours, plan, prerequisite, sources) are simply ignored in lite mode.
export function parseCourseRows(table: string[][]): ParsedRows<CourseRow> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rows: CourseRow[] = [];
  const [header, ...body] = table;
  if (!header) return { rows, errors: ['ไฟล์ว่าง'], warnings };
  const col = (name: string) => header.findIndex((h) => h.trim().replace(/^﻿/, '') === name);
  const idx = {
    code: col('code'),
    nameTh: col('nameTh'),
    nameEn: col('nameEn'),
    credits: col('credits'),
    category: col('category'),
    isRequired: col('isRequired'),
  };
  for (const required of ['code', 'nameTh', 'credits'] as const) {
    if (idx[required] < 0) errors.push(`ไม่มีคอลัมน์ ${required} ในไฟล์`);
  }
  if (errors.length) return { rows, errors, warnings };

  const seen = new Map<string, number>();
  body.forEach((cells, i) => {
    const line = i + 2;
    if (cells.every((c) => c.trim() === '')) return;
    const code = cleanCell(cells[idx.code]);
    const name = cleanCell(cells[idx.nameTh]);
    if (!code) return void errors.push(`แถว ${line}: ไม่มีรหัสวิชา`);
    if (!name) return void errors.push(`แถว ${line} (${code}): ไม่มีชื่อวิชาไทย`);
    const creditsCell = (cells[idx.credits] ?? '').trim();
    if (!/^\d+$/.test(creditsCell)) {
      return void errors.push(`แถว ${line} (${code}): หน่วยกิตไม่ใช่ตัวเลข ("${creditsCell}")`);
    }
    if (seen.has(code)) {
      return void errors.push(`แถว ${line}: รหัสวิชา ${code} ซ้ำกับแถว ${seen.get(code)}`);
    }
    seen.set(code, line);
    const nameEn = idx.nameEn >= 0 ? cleanCell(cells[idx.nameEn]) : null;
    const category = idx.category >= 0 ? cleanCell(cells[idx.category]) : null;
    const isRequired = idx.isRequired >= 0 ? parseIsRequired(cells[idx.isRequired]) : null;
    if (!category) warnings.push(`แถว ${line} (${code}): ไม่ระบุหมวดวิชา — จะข้าม`);
    rows.push({ line, code, name, nameEn, credits: Number(creditsCell), category, isRequired });
  });
  return { rows, errors, warnings };
}

export interface CategorySpec {
  name: string;
  minCredits: number;
  // Value of the CSV `category` column that belongs to this category (defaults to name).
  csvCategory: string;
  // Used for a course whose own isRequired cell is empty.
  defaultIsRequired: boolean | null;
  // true = minCredits was summed from the courses, not stated by the book.
  estimated: boolean;
}

// Columns: name, minCredits, csv_category (optional), default_is_required (optional).
export function parseCategoryRows(table: string[][]): ParsedRows<CategorySpec> {
  const errors: string[] = [];
  const rows: CategorySpec[] = [];
  const [header, ...body] = table;
  if (!header) return { rows, errors: ['ไฟล์หมวดวิชาว่าง'], warnings: [] };
  const col = (name: string) => header.findIndex((h) => h.trim().replace(/^﻿/, '') === name);
  const idx = {
    name: col('name'),
    min: col('minCredits'),
    csv: col('csv_category'),
    def: col('default_is_required'),
  };
  if (idx.name < 0) errors.push('ไฟล์หมวดวิชาไม่มีคอลัมน์ name');
  if (idx.min < 0) errors.push('ไฟล์หมวดวิชาไม่มีคอลัมน์ minCredits');
  if (errors.length) return { rows, errors, warnings: [] };

  const names = new Set<string>();
  const csvNames = new Set<string>();
  body.forEach((cells, i) => {
    const line = i + 2;
    if (cells.every((c) => c.trim() === '')) return;
    const name = (cells[idx.name] ?? '').trim();
    const min = (cells[idx.min] ?? '').trim();
    if (!name) return void errors.push(`หมวดวิชา แถว ${line}: ไม่มีชื่อหมวด`);
    if (!/^\d+$/.test(min)) {
      return void errors.push(`หมวดวิชา "${name}": minCredits ไม่ใช่ตัวเลข ("${min}")`);
    }
    const csvCategory = (idx.csv >= 0 ? (cells[idx.csv] ?? '').trim() : '') || name;
    if (names.has(name)) return void errors.push(`หมวดวิชา "${name}" ซ้ำ`);
    if (csvNames.has(csvCategory)) {
      return void errors.push(`csv_category "${csvCategory}" ซ้ำในไฟล์หมวดวิชา`);
    }
    names.add(name);
    csvNames.add(csvCategory);
    rows.push({
      name,
      minCredits: Number(min),
      csvCategory,
      defaultIsRequired: idx.def >= 0 ? parseIsRequired(cells[idx.def]) : null,
      estimated: false,
    });
  });
  return { rows, errors, warnings: [] };
}

// No categories file: one category per distinct CSV value, minCredits = sum of its courses.
export function deriveCategories(courses: CourseRow[]): CategorySpec[] {
  const sums = new Map<string, number>();
  for (const c of courses) {
    if (c.category) sums.set(c.category, (sums.get(c.category) ?? 0) + c.credits);
  }
  return [...sums].map(([name, minCredits]) => ({
    name,
    minCredits,
    csvCategory: name,
    defaultIsRequired: null,
    estimated: true,
  }));
}

export interface ResolvedCourse extends CourseRow {
  categoryName: string;
  // Resolved value, plus whether it had to fall back to the schema default.
  isRequiredResolved: boolean;
  isRequiredDefaulted: boolean;
}

// Courses whose category is not one of the categories cannot be created (categoryId is
// required), so they are returned separately instead of being guessed into some category.
export function resolveCourses(
  courses: CourseRow[],
  categories: CategorySpec[],
): { resolved: ResolvedCourse[]; unmapped: CourseRow[] } {
  const byCsv = new Map(categories.map((c) => [c.csvCategory, c]));
  const resolved: ResolvedCourse[] = [];
  const unmapped: CourseRow[] = [];
  for (const c of courses) {
    const cat = c.category ? byCsv.get(c.category) : undefined;
    if (!cat) {
      unmapped.push(c);
      continue;
    }
    const value = c.isRequired ?? cat.defaultIsRequired;
    resolved.push({
      ...c,
      categoryName: cat.name,
      isRequiredResolved: value ?? true,
      isRequiredDefaulted: value === null,
    });
  }
  return { resolved, unmapped };
}

// Credits of the imported courses per category against the category's minCredits. Only
// informational: the electives are a list to choose from, so "sum > min" is normal there.
export function categoryCreditWarnings(
  categories: CategorySpec[],
  resolved: Pick<ResolvedCourse, 'categoryName' | 'credits'>[],
): string[] {
  const warnings: string[] = [];
  for (const cat of categories) {
    if (cat.estimated) continue;
    const mine = resolved.filter((c) => c.categoryName === cat.name);
    const sum = mine.reduce((s, c) => s + c.credits, 0);
    if (sum !== cat.minCredits) {
      warnings.push(
        `หมวด "${cat.name}": รวมหน่วยกิตของ ${mine.length} วิชาในไฟล์ = ${sum} ไม่เท่ากับ minCredits ${cat.minCredits}`,
      );
    }
  }
  return warnings;
}

export type CourseAction = 'create' | 'skip' | 'update' | 'conflict';

export interface ExistingCourse {
  name: string;
  credits: number;
  nameEn: string | null;
}

// Existing active course with the same code: same name and credits -> skip (an empty English
// name is filled in, which is purely additive); different -> conflict, replaced only with
// --overwrite. Nothing is ever deleted.
export function planCourseAction(
  existing: ExistingCourse | null,
  wanted: Pick<CourseRow, 'name' | 'credits' | 'nameEn'>,
  overwrite: boolean,
): { action: CourseAction; differences: string[]; fillNameEn: boolean } {
  if (!existing) return { action: 'create', differences: [], fillNameEn: false };
  const differences: string[] = [];
  if (existing.name !== wanted.name) differences.push(`ชื่อ "${existing.name}" ≠ "${wanted.name}"`);
  if (existing.credits !== wanted.credits) {
    differences.push(`หน่วยกิต ${existing.credits} ≠ ${wanted.credits}`);
  }
  const fillNameEn = !existing.nameEn && !!wanted.nameEn;
  if (differences.length > 0) {
    return { action: overwrite ? 'update' : 'conflict', differences, fillNameEn };
  }
  return { action: fillNameEn ? 'update' : 'skip', differences, fillNameEn };
}

export type RequirementAction = 'create' | 'skip' | 'update' | 'conflict';

export function planRequirementAction(
  existingMinCredits: number | null,
  wantedMinCredits: number,
  overwrite: boolean,
): RequirementAction {
  if (existingMinCredits === null) return 'create';
  if (existingMinCredits === wantedMinCredits) return 'skip';
  return overwrite ? 'update' : 'conflict';
}
