import * as fs from 'fs';
import * as path from 'path';

import { Prisma, PrismaClient } from '@prisma/client';

import { upsertActive } from './upsert-active';

const prisma = new PrismaClient();

// Imports the real PLO / CLO / CLO→PLO data of the ICT 2569 curriculum book
// from the CSV files converted into prisma/private-data/ (git-ignored — the
// book is confidential). This script holds NO curriculum text itself and
// prints NO curriculum text: only counts, row positions and course codes.
//
//   ts-node prisma/import-ict-clo-plo.ts            # dry run (default)
//   ts-node prisma/import-ict-clo-plo.ts --apply    # one transaction, idempotent
//
// Source of truth is the per-course "6.2 ผลลัพธ์ที่เกิดขึ้นกับนิสิต" tables
// (CLO text + its PLO); the course-vs-PLO matrix (ต.13) is only a cross-check.
// Only curriculum ICT 2569 is written; 2564 is read for the report only.
const APPLY = process.argv.includes('--apply');
const DATA_DIR = path.join(__dirname, 'private-data');
const PROGRAM_CODE = 'ICT';
const TARGET_VERSION = '2569';
const OTHER_VERSION = '2564';
const PLO_TABLE = 8; // PLO1-6 statements
const PLO_DETAIL_TABLE = 12; // same PLOs + Bloom/domain level
const MATRIX_TABLE = 13; // course × PLO matrix (Wingdings marks)
const RENAME_TABLE = 1; // old code → new code
const CLO_TABLE_HEADER = 'ผลลัพธ์ที่เกิดขึ้นกับนิสิต';
const MARK = '{F050}';
// Every mapping gets weight 1: the PLO achievement formulas
// (plo-achievement.service.ts, calculate-actual-plo.ts) use weight only as a
// relative weighted average, and the DTO allows 1..5, so uniform 1 = plain mean.
const MAPPING_WEIGHT = 1;

// ---------------------------------------------------------------- CSV input

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const tableName = (n: number) => `table_${String(n).padStart(3, '0')}`;

function readTable(n: number): string[][] {
  return parseCsv(fs.readFileSync(path.join(DATA_DIR, `${tableName(n)}.csv`), 'utf8'));
}

// Comparison key: NFC + decomposed sara-am (ํ + า) folded to ำ + no whitespace.
const norm = (s: string) =>
  s
    .normalize('NFC')
    .replace(/\u0E4D\u0E32/g, '\u0E33')
    .replace(/\s+/g, '');

// A table cell holds one paragraph per CLO, separated by "\n" in the CSV.
const paragraphs = (cell: string) =>
  cell
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);

// Some CLOs carry a leading "1. " / "2.". The number is not part of the text.
function stripNumber(text: string): { num: number | null; text: string } {
  const m = /^(\d+)\s*[.)]\s*([\s\S]*)$/.exec(text);
  return m ? { num: Number(m[1]), text: m[2].trim() } : { num: null, text };
}

// ----------------------------------------------------------- source parsing

interface PloDoc {
  code: string;
  name: string;
  description: string | null;
}

interface CloDoc {
  code: string; // CLO1..n by row order
  description: string;
  ploCodes: string[];
}

interface CourseDoc {
  code: string;
  clos: CloDoc[];
  errors: string[]; // blocking problems in 6.2 itself — positions + kinds only, never content
  review: string[]; // 6.2 disagrees with ต.13 — imported from 6.2, flagged for the teacher
}

interface Source {
  plos: PloDoc[];
  courses: CourseDoc[]; // from 6.2, the primary source
  matrixOnlyCodes: string[]; // in ต.13 but without a 6.2 table
  oldCodes: Set<string>;
  generalErrors: string[];
}

function parseSource(): Source {
  const generalErrors: string[] = [];

  // PLOs: ต.8 holds "PLOn <statement>" in one cell; ต.12 adds the level text.
  const detail = new Map<string, string>();
  for (const [r, row] of readTable(PLO_DETAIL_TABLE).entries()) {
    const m = /^PLO\s*(\d+)/i.exec((row[0] ?? '').trim());
    if (m && (row[1] ?? '').trim()) detail.set(`PLO${m[1]}`, row[1].trim());
    else if (r > 0 && !m)
      generalErrors.push(`${tableName(PLO_DETAIL_TABLE)} row ${r + 1}: no-plo-code`);
  }
  const plos: PloDoc[] = [];
  for (const [r, row] of readTable(PLO_TABLE).entries()) {
    const m = /^PLO\s*(\d+)\s+([\s\S]+)$/i.exec((row[0] ?? '').trim());
    if (!m) {
      if (r > 0) generalErrors.push(`${tableName(PLO_TABLE)} row ${r + 1}: no-plo-code`);
      continue;
    }
    const code = `PLO${m[1]}`;
    plos.push({
      code,
      name: m[2].replace(/\s+/g, ' ').trim(),
      description: detail.get(code)?.replace(/\s+/g, ' ') ?? null,
    });
  }
  const ploCodes = new Set(plos.map((p) => p.code));

  // 6.2 tables: each belongs to the last "1. รหัสวิชา <8 digits>" line above it.
  const lines = fs.readFileSync(path.join(DATA_DIR, 'curriculum.txt'), 'utf8').split('\n');
  const courseOfTable = new Map<number, string>();
  let current: string | null = null;
  for (const line of lines) {
    const c = /^\s*1\.\s*รหัสวิชา\s+(\d{8})/.exec(line);
    if (c) current = c[1];
    const t = /^\[TABLE (\d+):/.exec(line);
    if (t && current) courseOfTable.set(Number(t[1]), current);
  }

  const courses = new Map<string, CourseDoc>();
  const tableCount = lines.filter((l) => /^\[TABLE \d+:/.test(l)).length;
  for (let n = 1; n <= tableCount; n++) {
    const rows = readTable(n);
    if (!(rows[0]?.[0] ?? '').trim().startsWith(CLO_TABLE_HEADER)) continue;
    const code = courseOfTable.get(n);
    if (!code) {
      generalErrors.push(`${tableName(n)}: clo-table-without-course-code`);
      continue;
    }
    const course: CourseDoc = courses.get(code) ?? { code, clos: [], errors: [], review: [] };
    if (courses.has(code)) course.errors.push(`${tableName(n)}: duplicate-clo-table`);
    for (let r = 1; r < rows.length; r++) {
      const found = [...(rows[r][1] ?? '').matchAll(/PLO\s*(\d+)/gi)].map((m) => `PLO${m[1]}`);
      const codes = [...new Set(found)];
      const where = `${tableName(n)} row ${r + 1}`;
      const texts = paragraphs(rows[r][0] ?? '');
      if (texts.length === 0) course.errors.push(`${where}: empty-clo`);
      if (codes.length === 0) course.errors.push(`${where}: no-plo`);
      for (const p of codes) {
        if (!ploCodes.has(p)) course.errors.push(`${where}: unknown-plo`);
      }
      // one row may hold several CLOs (one paragraph each) sharing the row's PLOs
      for (const raw of texts) {
        const { num, text } = stripNumber(raw);
        const position = course.clos.length + 1;
        if (num !== null && num !== position) course.errors.push(`${where}: clo-number-mismatch`);
        course.clos.push({ code: `CLO${position}`, description: text, ploCodes: codes });
      }
    }
    courses.set(code, course);
  }

  // ต.13 cross-check: CLO count, CLO order/text, and marks per PLO column.
  const matrixCodes: string[] = [];
  readTable(MATRIX_TABLE).forEach((row, r) => {
    const m = /^(\d{8})/.exec((row[0] ?? '').trim());
    if (!m) return;
    matrixCodes.push(m[1]);
    const course = courses.get(m[1]);
    if (!course) return;
    const where = `${tableName(MATRIX_TABLE)} row ${r + 1}`;
    const texts = paragraphs(row[1] ?? '').map((t) => stripNumber(t).text);
    if (texts.length !== course.clos.length) {
      course.review.push(`${where}: clo-count-differs`);
    } else if (texts.some((t, i) => norm(t) !== norm(course.clos[i].description))) {
      course.review.push(`${where}: clo-text-differs`);
    }
    for (let j = 0; j < plos.length; j++) {
      const marks = (row[2 + j] ?? '').split(MARK).length - 1;
      const expected = course.clos.filter((c) => c.ploCodes.includes(`PLO${j + 1}`)).length;
      if (marks !== expected) course.review.push(`${where}: plo${j + 1}-mark-count-differs`);
    }
  });

  // ต.1: old → new code table; old codes are reported, never mapped.
  const oldCodes = new Set<string>();
  readTable(RENAME_TABLE).forEach((row, r) => {
    if (r === 0) return;
    for (const m of (row[0] ?? '').matchAll(/\d{8}/g)) oldCodes.add(m[0]);
  });

  return {
    plos,
    courses: [...courses.values()],
    matrixOnlyCodes: matrixCodes.filter((c) => !courses.has(c)),
    oldCodes,
    generalErrors,
  };
}

// ----------------------------------------------------------------- the run

interface Tally {
  create: number;
  update: number;
  skip: number;
}
const tally = (): Tally => ({ create: 0, update: 0, skip: 0 });

type Db = PrismaClient | Prisma.TransactionClient;

async function plan(db: Db, src: Source, apply: boolean) {
  const program = await db.program.findFirstOrThrow({ where: { code: PROGRAM_CODE } });
  const curriculum = await db.curriculum.findFirstOrThrow({
    where: { programId: program.id, version: TARGET_VERSION, isActive: true },
  });

  const ploT = tally();
  const cloT = tally();
  const mapT = tally();
  const sampleCloRemoved = { onImportedCourse: 0, onOtherCourse: 0 };
  const sampleCloProtected: string[] = [];
  const sampleMappingsRemoved = { fromRemovedClo: 0, fromKeptClo: 0 };
  const missingCourses: string[] = [];
  const skippedForErrors: string[] = [];

  // --- PLOs
  const ploIdByCode = new Map<string, string>();
  for (const p of src.plos) {
    const found = await db.plo.findFirst({
      where: { curriculumId: curriculum.id, code: p.code, isActive: true },
    });
    if (found && found.name === p.name && found.description === p.description) {
      ploT.skip++;
      ploIdByCode.set(p.code, found.id);
    } else {
      found ? ploT.update++ : ploT.create++;
      if (apply) {
        const saved = await upsertActive({
          find: async () => found,
          update: (id) =>
            db.plo.update({ where: { id }, data: { name: p.name, description: p.description } }),
          create: () =>
            db.plo.create({
              data: {
                code: p.code,
                name: p.name,
                description: p.description,
                curriculumId: curriculum.id,
              },
            }),
        });
        ploIdByCode.set(p.code, saved.id);
      }
    }
  }
  const docPloCodes = new Set(src.plos.map((p) => p.code));
  const extraPlos = await db.plo.count({
    where: { curriculumId: curriculum.id, isActive: true, code: { notIn: [...docPloCodes] } },
  });

  // --- courses of the target curriculum (active only; never created here)
  const dbCourses = await db.course.findMany({
    where: { curriculumId: curriculum.id, isActive: true },
    select: { id: true, code: true },
  });
  const courseIdByCode = new Map(dbCourses.map((c) => [c.code, c.id]));
  const oldCodesInDb = dbCourses.filter((c) => src.oldCodes.has(c.code)).map((c) => c.code);

  const docByCode = new Map(src.courses.map((c) => [c.code, c]));
  const errorCourseCodes = new Set(
    src.courses.filter((c) => c.errors.length > 0).map((c) => c.code),
  );

  for (const course of src.courses) {
    if (!courseIdByCode.has(course.code)) missingCourses.push(course.code);
    else if (errorCourseCodes.has(course.code)) skippedForErrors.push(course.code);
  }
  for (const code of src.matrixOnlyCodes) {
    if (!courseIdByCode.has(code) && !missingCourses.includes(code)) missingCourses.push(code);
  }

  // --- CLOs + mappings per DB course
  for (const dbCourse of dbCourses) {
    const doc = docByCode.get(dbCourse.code);
    if (doc && errorCourseCodes.has(doc.code)) continue; // untouched until the source is fixed

    const existing = await db.clo.findMany({
      where: { courseId: dbCourse.id, isActive: true },
      include: {
        ploMappings: true,
        _count: { select: { assessmentScores: true, assessmentCloMappings: true } },
      },
    });
    const existingByCode = new Map(existing.map((c) => [c.code, c]));
    const keptCloIds = new Set<string>();

    for (const clo of doc?.clos ?? []) {
      const found = existingByCode.get(clo.code) ?? null;
      let cloId: string | null = found?.id ?? null;
      if (found && found.description === clo.description) {
        cloT.skip++;
      } else {
        found ? cloT.update++ : cloT.create++;
        if (apply) {
          const saved = await upsertActive({
            find: async () => found,
            update: (id) =>
              db.clo.update({ where: { id }, data: { description: clo.description } }),
            create: () =>
              db.clo.create({
                data: { code: clo.code, description: clo.description, courseId: dbCourse.id },
              }),
          });
          cloId = saved.id;
        }
      }
      if (cloId) keptCloIds.add(cloId);

      // mappings for this CLO — (cloId, ploId) is a real @@unique, so a
      // soft-deleted row is reactivated rather than re-created.
      const wantedPlos = new Set(clo.ploCodes);
      const rows = found?.ploMappings ?? [];
      const ploCodeById = new Map(
        [...ploIdByCode.entries()].map(([code, id]) => [id, code] as const),
      );
      for (const code of wantedPlos) {
        const ploId = ploIdByCode.get(code);
        const row = ploId ? rows.find((m) => m.ploId === ploId) : undefined;
        if (row && row.isActive && row.weight === MAPPING_WEIGHT) {
          mapT.skip++;
        } else if (row) {
          mapT.update++;
          if (apply) {
            await db.cloPloMapping.update({
              where: { id: row.id },
              data: { isActive: true, weight: MAPPING_WEIGHT },
            });
          }
        } else {
          mapT.create++;
          if (apply && cloId && ploId) {
            await db.cloPloMapping.create({
              data: { cloId, ploId, weight: MAPPING_WEIGHT },
            });
          }
        }
      }
      for (const row of rows) {
        const code = ploCodeById.get(row.ploId);
        if (row.isActive && !(code && wantedPlos.has(code))) {
          sampleMappingsRemoved.fromKeptClo++;
          if (apply) {
            await db.cloPloMapping.update({ where: { id: row.id }, data: { isActive: false } });
          }
        }
      }
      // active mappings to PLOs outside the doc's PLO set are handled by the loop above
      // (code undefined => not wanted => soft-deleted).
    }

    // active CLOs not in the real data: soft-delete unless evidence hangs on them
    for (const clo of existing) {
      if (keptCloIds.has(clo.id)) continue;
      if (clo._count.assessmentScores + clo._count.assessmentCloMappings > 0) {
        sampleCloProtected.push(`${dbCourse.code}`);
        continue;
      }
      doc ? sampleCloRemoved.onImportedCourse++ : sampleCloRemoved.onOtherCourse++;
      sampleMappingsRemoved.fromRemovedClo += clo.ploMappings.filter((m) => m.isActive).length;
      if (apply) {
        await db.cloPloMapping.updateMany({
          where: { cloId: clo.id, isActive: true },
          data: { isActive: false },
        });
        await db.clo.update({ where: { id: clo.id }, data: { isActive: false } });
      }
    }
  }

  return {
    curriculumId: curriculum.id,
    ploT,
    cloT,
    mapT,
    extraPlos,
    missingCourses,
    skippedForErrors,
    oldCodesInDb,
    sampleCloRemoved,
    sampleCloProtected,
    sampleMappingsRemoved,
  };
}

async function report2564() {
  const program = await prisma.program.findFirst({ where: { code: PROGRAM_CODE } });
  const out: string[] = [];
  for (const version of [OTHER_VERSION, TARGET_VERSION]) {
    const cur = program
      ? await prisma.curriculum.findFirst({
          where: { programId: program.id, version, isActive: true },
        })
      : null;
    if (!cur) {
      out.push(`  ${version}: ไม่พบ curriculum`);
      continue;
    }
    const students = await prisma.studentProfile.count({ where: { curriculumId: cur.id } });
    let line = `  ${version}: นิสิต ${students} คน`;
    if (version === OTHER_VERSION) {
      const plos = await prisma.plo.count({ where: { curriculumId: cur.id, isActive: true } });
      const clos = await prisma.clo.count({
        where: { isActive: true, course: { curriculumId: cur.id } },
      });
      const maps = await prisma.cloPloMapping.count({
        where: { isActive: true, plo: { curriculumId: cur.id } },
      });
      line += `, PLO active ${plos}, CLO active ${clos}, mapping active ${maps} (ไม่แตะ)`;
    }
    out.push(line);
  }
  return out;
}

const fmt = (t: Tally) => `create ${t.create} / update ${t.update} / skip ${t.skip}`;

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY RUN (no writes)'}`);
  const src = parseSource();

  const errorLines = [
    ...src.generalErrors,
    ...src.courses.flatMap((c) => c.errors.map((e) => `${c.code} ${e}`)),
  ];
  const errCourses = src.courses.filter((c) => c.errors.length > 0).length;
  console.log(
    `Source: PLO ${src.plos.length}, วิชาจาก 6.2 ${src.courses.length}, ` +
      `CLO ${src.courses.reduce((n, c) => n + c.clos.length, 0)}, ` +
      `mapping ${src.courses.reduce((n, c) => n + c.clos.reduce((m, k) => m + k.ploCodes.length, 0), 0)}`,
  );
  console.log(
    `Errors: ${errorLines.length} รายการ ใน ${errCourses} วิชา (วิชาที่มี error จะถูกข้าม)`,
  );
  for (const line of errorLines) console.log(`  ${line}`);

  // 6.2 vs ต.13 disagreements: not blocking (6.2 wins) but listed for the teacher.
  const reviewLines = src.courses.flatMap((c) => c.review.map((e) => `${c.code} ${e}`));
  const reviewCourses = src.courses.filter((c) => c.review.length > 0).length;
  fs.writeFileSync(
    path.join(DATA_DIR, 'review-with-teacher.txt'),
    '# 6.2 vs ต.13 disagreements (course code, table row, kind) — generated, do not commit\n' +
      reviewLines.join('\n') +
      '\n',
  );
  console.log(
    `ต้องตรวจกับอาจารย์: ${reviewLines.length} รายการ ใน ${reviewCourses} วิชา ` +
      '(เขียนที่ private-data/review-with-teacher.txt)',
  );
  console.log(
    `วิชาใน ต.13 ที่ไม่มีตาราง 6.2 (ไม่นำเข้า): ${src.matrixOnlyCodes.length}` +
      (src.matrixOnlyCodes.length ? ` [${src.matrixOnlyCodes.join(', ')}]` : ''),
  );

  const result = APPLY
    ? await prisma.$transaction((tx) => plan(tx, src, true), { timeout: 120_000 })
    : await plan(prisma, src, false);

  console.log(
    `Curriculum: ${PROGRAM_CODE} ${TARGET_VERSION} (curriculumId=${result.curriculumId})`,
  );
  console.log(`PLO:     ${fmt(result.ploT)}  (PLO active นอกเอกสาร ${result.extraPlos})`);
  console.log(`CLO:     ${fmt(result.cloT)}`);
  console.log(`Mapping: ${fmt(result.mapT)}  (weight=${MAPPING_WEIGHT})`);
  console.log(
    `CLO ตัวอย่างที่จะ soft-delete: ${result.sampleCloRemoved.onImportedCourse} ในวิชาที่มีข้อมูลจริง, ` +
      `${result.sampleCloRemoved.onOtherCourse} ในวิชาที่ไม่มีข้อมูลจริง; ` +
      `mapping ที่จะ soft-delete: ${result.sampleMappingsRemoved.fromRemovedClo} (ของ CLO ที่ลบ) + ` +
      `${result.sampleMappingsRemoved.fromKeptClo} (ของ CLO ที่คงไว้)`,
  );
  console.log(
    `CLO ที่มีข้อมูลผูก (ไม่ลบ): ${result.sampleCloProtected.length}` +
      (result.sampleCloProtected.length ? ` [วิชา ${result.sampleCloProtected.join(', ')}]` : ''),
  );
  console.log(
    `วิชาไม่พบใน DB (ข้าม): ${result.missingCourses.length}` +
      (result.missingCourses.length ? ` [${result.missingCourses.join(', ')}]` : ''),
  );
  console.log(`วิชาที่ถูกข้ามเพราะมี error: ${result.skippedForErrors.length}`);
  console.log(
    `รหัสเดิม (ต.1) ที่พบเป็นวิชาใน DB 2569: ${result.oldCodesInDb.length}` +
      (result.oldCodesInDb.length ? ` [${result.oldCodesInDb.join(', ')}]` : ''),
  );
  console.log('Curriculum report:');
  for (const line of await report2564()) console.log(line);

  if (!APPLY) console.log('Dry run only — rerun with --apply to write to the database.');
  else console.log('ICT CLO/PLO import complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
