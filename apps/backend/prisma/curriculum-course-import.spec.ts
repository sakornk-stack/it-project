// Run on demand (not part of `npm test`, whose jest rootDir is src/):
//   npx jest --rootDir=. --roots=prisma --testRegex 'curriculum-course-import\.spec\.ts$'
import {
  categoryCreditWarnings,
  deriveCategories,
  parseCategoryRows,
  parseCourseRows,
  parseImportOptions,
  parseIsRequired,
  planCourseAction,
  planRequirementAction,
  resolveCourses,
} from './curriculum-course-import';

const HEADER = ['code', 'nameTh', 'nameEn', 'credits', 'category', 'isRequired', 'prerequisite'];
const table = (...rows: string[][]) => [HEADER, ...rows];
const ok = ['01130111', 'หลักการบัญชีขั้นต้น', 'Principles', '3', 'บังคับ', 'บังคับ', 'ไม่พบ'];

describe('parseImportOptions', () => {
  const base = ['--program=ACC', '--version=2564', '--file=x.csv'];

  it('is a dry run by default and reads the required options', () => {
    expect(parseImportOptions(base)).toMatchObject({
      program: 'ACC',
      version: '2564',
      file: 'x.csv',
      apply: false,
      overwrite: false,
      errors: [],
    });
  });

  it('reads --apply, --overwrite and --categories-file', () => {
    const r = parseImportOptions([...base, '--apply', '--overwrite', '--categories-file=c.csv']);
    expect(r).toMatchObject({ apply: true, overwrite: true, categoriesFile: 'c.csv', errors: [] });
  });

  it.each(['--program', '--version', '--file'])('requires %s', (name) => {
    const r = parseImportOptions(base.filter((a) => !a.startsWith(name)));
    expect(r.errors).toEqual([`ต้องระบุ ${name}=ค่า`]);
  });

  it('rejects a bare value option instead of silently ignoring it', () => {
    const r = parseImportOptions(['--program', 'ACC', '--version=2564', '--file=x.csv']);
    expect(r.errors.some((e) => e.includes('--program ต้องเขียนเป็น'))).toBe(true);
  });

  it('rejects a repeated or empty option and unknown options', () => {
    expect(parseImportOptions([...base, '--file=y.csv']).errors).toEqual([
      '--file ระบุได้ครั้งเดียว',
    ]);
    expect(parseImportOptions(['--program=', '--version=1', '--file=x']).errors).toEqual([
      '--program ต้องมีค่า',
    ]);
    expect(parseImportOptions([...base, '--aply']).errors).toEqual(['ไม่รู้จัก option: --aply']);
  });

  it('says --full is not supported (lite only)', () => {
    expect(parseImportOptions([...base, '--full']).errors[0]).toContain('lite');
  });
});

describe('parseIsRequired', () => {
  it.each([
    ['บังคับ', true],
    ['บังคับ (ตามใบบันทึกผลการเรียน)', true],
    ['เลือก', false],
    ['ไม่พบ', null],
    ['', null],
    ['อะไรก็ไม่รู้', null],
  ])('%p -> %p', (cell, expected) => {
    expect(parseIsRequired(cell)).toBe(expected);
  });
});

describe('parseCourseRows', () => {
  it('reads a good row and treats "ไม่พบ" as empty', () => {
    const r = parseCourseRows(
      table(['01130490', 'สหกิจศึกษา', 'ไม่พบ', '6', 'เลือก', 'ไม่พบ', 'ไม่พบ']),
    );
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      expect.objectContaining({
        code: '01130490',
        nameEn: null,
        credits: 6,
        category: 'เลือก',
        isRequired: null,
      }),
    ]);
  });

  it('stops on a duplicate code, a missing code or Thai name, and non-numeric credits', () => {
    const r = parseCourseRows(
      table(
        ok,
        ok,
        ['', 'x', '', '3', 'c', '', ''],
        ['A1', '', '', '3', 'c', '', ''],
        ['A2', 'ชื่อ', '', 'สาม', 'c', '', ''],
      ),
    );
    expect(r.errors).toEqual([
      'แถว 3: รหัสวิชา 01130111 ซ้ำกับแถว 2',
      'แถว 4: ไม่มีรหัสวิชา',
      'แถว 5 (A1): ไม่มีชื่อวิชาไทย',
      'แถว 6 (A2): หน่วยกิตไม่ใช่ตัวเลข ("สาม")',
    ]);
  });

  it('treats "ไม่พบ" as a missing Thai name or credits (an error, not a guess)', () => {
    const r = parseCourseRows(
      table(['A1', 'ไม่พบ', '', '3', 'c', '', ''], ['A2', 'ชื่อ', '', 'ไม่พบ', 'c', '', '']),
    );
    expect(r.errors).toHaveLength(2);
  });

  it('only warns (does not stop) when the category is missing', () => {
    const r = parseCourseRows(table(['A1', 'ชื่อ', '', '3', 'ไม่พบ', '', '']));
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
    expect(r.warnings).toEqual(['แถว 2 (A1): ไม่ระบุหมวดวิชา — จะข้าม']);
  });

  it('needs the code, nameTh and credits columns; a BOM on the header is ignored', () => {
    expect(
      parseCourseRows([
        ['code', 'nameTh'],
        ['A', 'B'],
      ]).errors,
    ).toEqual(['ไม่มีคอลัมน์ credits ในไฟล์']);
    expect(
      parseCourseRows([
        ['﻿code', 'nameTh', 'credits'],
        ['A', 'B', '3'],
      ]).errors,
    ).toEqual([]);
    expect(parseCourseRows([]).errors).toEqual(['ไฟล์ว่าง']);
  });

  it('skips blank lines', () => {
    expect(parseCourseRows(table(ok, ['', '', '', '', '', '', ''])).rows).toHaveLength(1);
  });
});

describe('parseCategoryRows', () => {
  const head = ['name', 'minCredits', 'csv_category', 'default_is_required'];

  it('reads categories, csv_category defaulting to the name', () => {
    const r = parseCategoryRows([
      head,
      ['วิชาเฉพาะบังคับ', '87', 'วิชาเฉพาะ: บังคับ', 'บังคับ'],
      ['เลือกเสรี', '6', '', ''],
    ]);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      {
        name: 'วิชาเฉพาะบังคับ',
        minCredits: 87,
        csvCategory: 'วิชาเฉพาะ: บังคับ',
        defaultIsRequired: true,
        estimated: false,
      },
      {
        name: 'เลือกเสรี',
        minCredits: 6,
        csvCategory: 'เลือกเสรี',
        defaultIsRequired: null,
        estimated: false,
      },
    ]);
  });

  it('rejects duplicates and a non-numeric minCredits', () => {
    const r = parseCategoryRows([
      head,
      ['A', '3', '', ''],
      ['A', '3', '', ''],
      ['B', 'x', '', ''],
      ['C', '1', 'A', ''],
    ]);
    expect(r.errors).toEqual([
      'หมวดวิชา "A" ซ้ำ',
      'หมวดวิชา "B": minCredits ไม่ใช่ตัวเลข ("x")',
      'csv_category "A" ซ้ำในไฟล์หมวดวิชา',
    ]);
  });
});

describe('deriveCategories / resolveCourses', () => {
  const course = (
    code: string,
    category: string | null,
    credits = 3,
    isRequired: boolean | null = null,
  ) => ({
    line: 2,
    code,
    name: code,
    nameEn: null,
    credits,
    category,
    isRequired,
  });

  it('derives one category per CSV value with the summed credits, marked as an estimate', () => {
    const cats = deriveCategories([
      course('a', 'X'),
      course('b', 'X', 2),
      course('c', 'Y'),
      course('d', null),
    ]);
    expect(cats).toEqual([
      expect.objectContaining({ name: 'X', minCredits: 5, estimated: true }),
      expect.objectContaining({ name: 'Y', minCredits: 3, estimated: true }),
    ]);
  });

  it('maps courses through csv_category, uses the category default, and returns unmapped ones', () => {
    const cats = [
      {
        name: 'บังคับ',
        minCredits: 87,
        csvCategory: 'csv-b',
        defaultIsRequired: true,
        estimated: false,
      },
      {
        name: 'เลือก',
        minCredits: 9,
        csvCategory: 'csv-e',
        defaultIsRequired: false,
        estimated: false,
      },
      {
        name: 'ไม่ระบุ',
        minCredits: 0,
        csvCategory: 'csv-n',
        defaultIsRequired: null,
        estimated: false,
      },
    ];
    const { resolved, unmapped } = resolveCourses(
      [
        course('a', 'csv-b'),
        course('b', 'csv-e'),
        course('c', 'csv-e', 3, true),
        course('d', 'csv-n'),
        course('e', 'ที่อื่น'),
        course('f', null),
      ],
      cats,
    );
    expect(
      resolved.map((r) => [r.code, r.categoryName, r.isRequiredResolved, r.isRequiredDefaulted]),
    ).toEqual([
      ['a', 'บังคับ', true, false],
      ['b', 'เลือก', false, false],
      ['c', 'เลือก', true, false],
      ['d', 'ไม่ระบุ', true, true],
    ]);
    expect(unmapped.map((u) => u.code)).toEqual(['e', 'f']);
  });
});

describe('categoryCreditWarnings', () => {
  const cat = (name: string, minCredits: number, estimated = false) => ({
    name,
    minCredits,
    csvCategory: name,
    defaultIsRequired: null,
    estimated,
  });

  it('warns when a category sum differs from minCredits, and not when it matches', () => {
    const w = categoryCreditWarnings(
      [cat('ตรง', 6), cat('ไม่ตรง', 9)],
      [
        { categoryName: 'ตรง', credits: 3 },
        { categoryName: 'ตรง', credits: 3 },
        { categoryName: 'ไม่ตรง', credits: 3 },
      ],
    );
    expect(w).toEqual(['หมวด "ไม่ตรง": รวมหน่วยกิตของ 1 วิชาในไฟล์ = 3 ไม่เท่ากับ minCredits 9']);
  });

  it('never compares an estimated category with its own sum', () => {
    expect(
      categoryCreditWarnings([cat('X', 3, true)], [{ categoryName: 'X', credits: 3 }]),
    ).toEqual([]);
  });
});

describe('planCourseAction', () => {
  const wanted = { name: 'ชื่อ', credits: 3, nameEn: 'Name' };

  it('creates when absent', () => {
    expect(planCourseAction(null, wanted, false).action).toBe('create');
  });

  it('skips an identical course', () => {
    expect(
      planCourseAction({ name: 'ชื่อ', credits: 3, nameEn: 'Name' }, wanted, false).action,
    ).toBe('skip');
  });

  it('fills only an empty English name (additive update, no differences)', () => {
    expect(planCourseAction({ name: 'ชื่อ', credits: 3, nameEn: null }, wanted, false)).toEqual({
      action: 'update',
      differences: [],
      fillNameEn: true,
    });
  });

  it('reports a different name or credits as a conflict and keeps it', () => {
    const r = planCourseAction({ name: 'อื่น', credits: 2, nameEn: 'Name' }, wanted, false);
    expect(r.action).toBe('conflict');
    expect(r.differences).toEqual(['ชื่อ "อื่น" ≠ "ชื่อ"', 'หน่วยกิต 2 ≠ 3']);
  });

  it('replaces them only with --overwrite', () => {
    expect(
      planCourseAction({ name: 'อื่น', credits: 3, nameEn: 'Name' }, wanted, true).action,
    ).toBe('update');
  });
});

describe('planRequirementAction', () => {
  it.each([
    [null, 30, false, 'create'],
    [30, 30, false, 'skip'],
    [29, 30, false, 'conflict'],
    [29, 30, true, 'update'],
  ])('existing %p wanted %p overwrite %p -> %s', (existing, wanted, overwrite, expected) => {
    expect(planRequirementAction(existing, wanted, overwrite)).toBe(expected);
  });
});
