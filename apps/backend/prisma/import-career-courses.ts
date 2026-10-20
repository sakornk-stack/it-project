import * as fs from 'fs';
import * as path from 'path';

import { Prisma, PrismaClient } from '@prisma/client';

import { assertSeedAllowed } from '../src/common/util/seed-guard';

import {
  careerSortOrder,
  courseIdsInScope,
  CurriculumVersion,
  parseCareerImportOptions,
  rowCurriculumError,
  selectStaleLinks,
} from './career-course-import';
import { parseCsv } from './csv-util';

const prisma = new PrismaClient();

// Imports the career → course links (Career, CareerCourse) from a CSV in the
// git-ignored prisma/private-data/ folder; no career or course text lives in this
// file. Links are created for ICT 2569 (course codes in the CSV) and copied to
// ICT 2564 onto the course with the same normalized NAME (same rule as
// copy-ict-clo-plo-to-2564.ts). Prints only counts and course codes.
//
//   ts-node prisma/import-career-courses.ts                       # dry run (default)
//   ts-node prisma/import-career-courses.ts --apply               # one transaction, idempotent
//   ts-node prisma/import-career-courses.ts --exclude-career=TEXT # skip careers whose name contains TEXT
//   ts-node prisma/import-career-courses.ts --file=PATH           # default private-data/career-course-draft.csv
//   ts-node prisma/import-career-courses.ts --no-additions        # do not auto-load the default additions file
//   ts-node prisma/import-career-courses.ts --additions-file=PATH # default private-data/career-course-additions.csv if present; extra links by course CODE in each curriculum (no name matching)
//   ts-node prisma/import-career-courses.ts --rename-file=PATH    # CSV old,new: rename an existing career instead of creating a new one
//   ts-node prisma/import-career-courses.ts --file=PATH --curriculum=2569|2564
//       # one year only: course codes are read as codes of THAT curriculum (no copy to the
//       # other year by name), additions are not loaded (and --additions-file is refused),
//       # and the stale-link cleanup only closes links of that year's courses.
//
// CSV columns: career, course_code, weight (1-3), reason. With --curriculum a "curriculum"
// column is optional; if present, each cell must be empty or equal to the chosen year.
// Additions CSV columns: career, course_code, weight (1-3), curriculum (2569 | 2564 | both),
// reason (optional column). Careers must already exist (DB or main file).
const APPLY = process.argv.includes('--apply');
const argValues = (name: string) =>
  process.argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const OPTIONS = parseCareerImportOptions(process.argv);
const CURRICULUM = OPTIONS.curriculum;
const EXCLUDE = argValues('exclude-career');
const FILE =
  argValues('file')[0] ?? path.join(__dirname, 'private-data', 'career-course-draft.csv');
// Links carry no record of which file created them, so the stale-link cleanup would
// soft-delete additions on a main-file-only run. To prevent that the default
// additions file is loaded whenever it exists; --no-additions turns that off.
const DEFAULT_ADDITIONS = path.join(__dirname, 'private-data', 'career-course-additions.csv');
const ADDITIONS_FILE =
  argValues('additions-file')[0] ??
  (!CURRICULUM && !process.argv.includes('--no-additions') && fs.existsSync(DEFAULT_ADDITIONS)
    ? DEFAULT_ADDITIONS
    : undefined);
const RENAME_FILE = argValues('rename-file')[0];
const PROGRAM_CODE = 'ICT';
const SOURCE_VERSION = '2569';
const TARGET_VERSION = '2564';

interface Addition {
  line: number;
  career: string;
  courseCode: string;
  weight: number;
  reason: string | null;
  versions: string[];
}

function readAdditions() {
  const errors: string[] = [];
  const rows: Addition[] = [];
  if (!ADDITIONS_FILE) return { rows, errors };
  const csv = parseCsv(fs.readFileSync(ADDITIONS_FILE, 'utf8'));
  const header = (csv[0] ?? []).map((h) => h.trim());
  for (const col of ['career', 'course_code', 'weight', 'curriculum']) {
    if (!header.includes(col)) errors.push(`additions header: missing-column-${col}`);
  }
  if (errors.length) return { rows, errors };
  const idx = (c: string) => header.indexOf(c);
  const seen = new Set<string>();
  csv.slice(1).forEach((cells, i) => {
    const line = i + 2;
    if (cells.every((c) => !c.trim())) return;
    const cell = (c: string) => (idx(c) >= 0 ? (cells[idx(c)] ?? '').trim() : '');
    const career = cell('career');
    const courseCode = cell('course_code');
    const weight = Number(cell('weight'));
    const curriculum = cell('curriculum');
    const reason = cell('reason') || null;
    if (!career) errors.push(`additions line ${line}: empty-career`);
    if (!/^\d{8}$/.test(courseCode)) errors.push(`additions line ${line}: bad-course-code`);
    if (!Number.isInteger(weight) || weight < 1 || weight > 3) {
      errors.push(`additions line ${line}: weight-not-1-to-3`);
    }
    const versions = curriculum === 'both' ? [SOURCE_VERSION, TARGET_VERSION] : [curriculum];
    if (!versions.every((v) => v === SOURCE_VERSION || v === TARGET_VERSION)) {
      errors.push(`additions line ${line}: bad-curriculum`);
    }
    for (const v of versions) {
      const key = `${career}\u0000${courseCode}\u0000${v}`;
      if (seen.has(key)) errors.push(`additions line ${line}: duplicate-career-course-curriculum`);
      seen.add(key);
    }
    rows.push({ line, career, courseCode, weight, reason, versions });
  });
  return { rows, errors };
}

// new career name -> old name (only when --rename-file is given)
function readRenames() {
  const renames = new Map<string, string>();
  if (!RENAME_FILE) return renames;
  for (const [oldName, newName] of parseCsv(fs.readFileSync(RENAME_FILE, 'utf8')).slice(1)) {
    if (oldName?.trim() && newName?.trim()) renames.set(newName.trim(), oldName.trim());
  }
  return renames;
}
const RENAMES = readRenames();

type Db = PrismaClient | Prisma.TransactionClient;

const normName = (s: string) =>
  s.normalize('NFC').replace(/ํา/g, 'ำ').replace(/\s+/g, ' ').trim().toLowerCase();

interface Row {
  line: number; // 1-based CSV line, for error positions
  career: string;
  courseCode: string;
  weight: number;
  reason: string | null;
}

function readRows() {
  const errors: string[] = [];
  const rows: Row[] = [];
  const csv = parseCsv(fs.readFileSync(FILE, 'utf8'));
  const header = (csv[0] ?? []).map((h) => h.trim());
  for (const col of ['career', 'course_code', 'weight', 'reason']) {
    if (!header.includes(col)) errors.push(`header: missing-column-${col}`);
  }
  if (errors.length) return { rows, errors, excludedRows: 0 };
  const idx = (c: string) => header.indexOf(c);
  const curriculumIdx = header.indexOf('curriculum'); // optional column

  const seen = new Set<string>();
  let excludedRows = 0;
  csv.slice(1).forEach((cells, i) => {
    const line = i + 2;
    if (cells.every((c) => !c.trim())) return; // blank line
    const career = (cells[idx('career')] ?? '').trim();
    const courseCode = (cells[idx('course_code')] ?? '').trim();
    const weight = Number((cells[idx('weight')] ?? '').trim());
    const reason = (cells[idx('reason')] ?? '').trim() || null;
    if (career && EXCLUDE.some((x) => career.includes(x))) {
      excludedRows++;
      return;
    }
    if (!career) errors.push(`line ${line}: empty-career`);
    if (!/^\d{8}$/.test(courseCode)) errors.push(`line ${line}: bad-course-code`);
    if (!Number.isInteger(weight) || weight < 1 || weight > 3) {
      errors.push(`line ${line}: weight-not-1-to-3`);
    }
    const curriculumError = rowCurriculumError(
      curriculumIdx >= 0 ? cells[curriculumIdx] : undefined,
      CURRICULUM,
    );
    if (curriculumError) errors.push(`line ${line}: ${curriculumError}`);
    const key = `${career}\u0000${courseCode}`;
    if (seen.has(key)) errors.push(`line ${line}: duplicate-career-course`);
    seen.add(key);
    rows.push({ line, career, courseCode, weight, reason });
  });
  return { rows, errors, excludedRows };
}

interface Tally {
  create: number;
  update: number;
  skip: number;
}
const tally = (): Tally => ({ create: 0, update: 0, skip: 0 });
const fmt = (t: Tally) => `create ${t.create} / update ${t.update} / skip ${t.skip}`;
const list = (codes: string[]) => (codes.length ? ` [${codes.join(', ')}]` : '');

class AdditionsError extends Error {
  constructor(readonly errors: string[]) {
    super('additions-invalid');
  }
}

async function plan(db: Db, rows: Row[], additions: Addition[], apply: boolean) {
  const program = await db.program.findFirstOrThrow({ where: { code: PROGRAM_CODE } });
  const curricula = {
    [SOURCE_VERSION]: await db.curriculum.findFirstOrThrow({
      where: { programId: program.id, version: SOURCE_VERSION, isActive: true },
    }),
    [TARGET_VERSION]: await db.curriculum.findFirstOrThrow({
      where: { programId: program.id, version: TARGET_VERSION, isActive: true },
    }),
  };
  const courseSelect = { id: true, code: true, name: true } as const;
  const sourceCourses = await db.course.findMany({
    where: { curriculumId: curricula[SOURCE_VERSION].id, isActive: true },
    select: courseSelect,
  });
  const targetCourses = await db.course.findMany({
    where: { curriculumId: curricula[TARGET_VERSION].id, isActive: true },
    select: courseSelect,
  });
  const countByName = (list: { name: string }[]) => {
    const m = new Map<string, number>();
    for (const c of list) m.set(normName(c.name), (m.get(normName(c.name)) ?? 0) + 1);
    return m;
  };
  const sourceNameCount = countByName(sourceCourses);
  const targetNameCount = countByName(targetCourses);
  const sourceByCode = new Map(sourceCourses.map((c) => [c.code, c]));
  const targetByCode = new Map(targetCourses.map((c) => [c.code, c]));
  const targetByName = new Map(targetCourses.map((c) => [normName(c.name), c]));
  const byCode = { [SOURCE_VERSION]: sourceByCode, [TARGET_VERSION]: targetByCode };
  const versionOfCourse = new Map<string, CurriculumVersion>([
    ...sourceCourses.map((c): [string, CurriculumVersion] => [c.id, SOURCE_VERSION]),
    ...targetCourses.map((c): [string, CurriculumVersion] => [c.id, TARGET_VERSION]),
  ]);

  // course code (2569) → { 2569 course id, 2564 course id | reason it has none }
  const missing: string[] = [];
  const noMatch = new Set<string>();
  const ambiguous = new Set<string>();
  const resolve = (code: string) => {
    const src = sourceByCode.get(code);
    if (!src) return null;
    const key = normName(src.name);
    let target: { id: string } | null = null;
    if ((sourceNameCount.get(key) ?? 0) > 1 || (targetNameCount.get(key) ?? 0) > 1) {
      ambiguous.add(code);
    } else if (targetByName.has(key)) {
      target = targetByName.get(key)!;
    } else {
      noMatch.add(code);
    }
    return { sourceId: src.id, targetId: target?.id ?? null };
  };

  // --- careers (global, keyed by name among active rows)
  const careerNames = [...new Set(rows.map((r) => r.career))];
  const careerT = tally();
  const careerIdByName = new Map<string, string | null>();
  for (const [i, name] of careerNames.entries()) {
    let found = await db.career.findFirst({ where: { name, isActive: true } });
    const oldName = RENAMES.get(name);
    // Renamed career: reuse the row (and its links) under its old name.
    if (!found && oldName)
      found = await db.career.findFirst({ where: { name: oldName, isActive: true } });
    // A grouped career keeps its sortOrder (owned by import-career-groups.ts).
    const sortOrder = careerSortOrder(found, i);
    if (found && found.sortOrder === sortOrder && found.name === name) {
      careerT.skip++;
    } else {
      found ? careerT.update++ : careerT.create++;
      if (apply) {
        const saved = found
          ? await db.career.update({ where: { id: found.id }, data: { name, sortOrder } })
          : await db.career.create({ data: { name, sortOrder } });
        careerIdByName.set(name, saved.id);
        continue;
      }
    }
    careerIdByName.set(name, found?.id ?? null);
  }

  // --- links
  const links = { [SOURCE_VERSION]: tally(), [TARGET_VERSION]: tally() };
  const planned = new Set<string>(); // career|version|courseId from the main file
  const wanted = new Map<string, Set<string>>(); // careerId → courseIds that must stay active
  const wantLink = async (version: string, careerId: string | null, courseId: string, row: Row) => {
    const t = links[version as keyof typeof links];
    if (careerId) {
      if (!wanted.has(careerId)) wanted.set(careerId, new Set());
      wanted.get(careerId)!.add(courseId);
    }
    // (careerId, courseId) is unique only among active rows: prefer the active
    // row, else reactivate a soft-deleted one, else create.
    const rowsFound = careerId
      ? await db.careerCourse.findMany({ where: { careerId, courseId } })
      : [];
    const found = rowsFound.find((r) => r.isActive) ?? rowsFound[0] ?? null;
    if (found && found.isActive && found.weight === row.weight && found.reason === row.reason) {
      t.skip++;
      return;
    }
    found ? t.update++ : t.create++;
    if (!apply || !careerId) return;
    if (found) {
      await db.careerCourse.update({
        where: { id: found.id },
        data: { weight: row.weight, reason: row.reason, isActive: true },
      });
    } else {
      await db.careerCourse.create({
        data: { careerId, courseId, weight: row.weight, reason: row.reason },
      });
    }
  };

  for (const row of rows) {
    if (CURRICULUM) {
      // Single-year import: the code is a code of that curriculum, nothing is copied across.
      const course = byCode[CURRICULUM].get(row.courseCode);
      if (!course) {
        missing.push(row.courseCode);
        continue;
      }
      const careerId = careerIdByName.get(row.career) ?? null;
      await wantLink(CURRICULUM, careerId, course.id, row);
      planned.add(`${row.career}\u0000${CURRICULUM}\u0000${course.id}`);
      continue;
    }
    const resolved = resolve(row.courseCode);
    if (!resolved) {
      missing.push(row.courseCode);
      continue;
    }
    const careerId = careerIdByName.get(row.career) ?? null;
    await wantLink(SOURCE_VERSION, careerId, resolved.sourceId, row);
    planned.add(`${row.career}\u0000${SOURCE_VERSION}\u0000${resolved.sourceId}`);
    if (resolved.targetId) {
      await wantLink(TARGET_VERSION, careerId, resolved.targetId, row);
      planned.add(`${row.career}\u0000${TARGET_VERSION}\u0000${resolved.targetId}`);
    }
  }

  // --- additions file: links by course code, per curriculum, no name matching
  const addErrors: string[] = [];
  const addMissing = new Set<string>();
  const addLinks = { [SOURCE_VERSION]: tally(), [TARGET_VERSION]: tally() };
  if (additions.length) {
    const knownCareers = new Set(careerNames);
    for (const c of await db.career.findMany({
      where: { isActive: true },
      select: { name: true },
    })) {
      knownCareers.add(c.name);
    }
    const todo: { a: Addition; version: string; courseId: string }[] = [];
    for (const a of additions) {
      if (!knownCareers.has(a.career)) addErrors.push(`additions line ${a.line}: career-not-found`);
      for (const version of a.versions) {
        const course = byCode[version as keyof typeof byCode].get(a.courseCode);
        if (!course) {
          addErrors.push(`additions line ${a.line}: course-not-found-in-${version}`);
          addMissing.add(`${a.courseCode}(${version})`);
          continue;
        }
        if (planned.has(`${a.career}\u0000${version}\u0000${course.id}`)) {
          addErrors.push(`additions line ${a.line}: already-in-main-file-for-${version}`);
          continue;
        }
        todo.push({ a, version, courseId: course.id });
      }
    }
    if (addErrors.length) throw new AdditionsError(addErrors); // also rolls back the transaction
    for (const { a, version, courseId } of todo) {
      let careerId = careerIdByName.get(a.career) ?? null;
      if (!careerId) {
        careerId =
          (await db.career.findFirst({ where: { name: a.career, isActive: true } }))?.id ?? null;
        if (careerId && !careerIdByName.has(a.career)) careerIdByName.set(a.career, careerId);
      }
      const before = { ...links[version as keyof typeof links] };
      await wantLink(version, careerId, courseId, {
        line: a.line,
        career: a.career,
        courseCode: a.courseCode,
        weight: a.weight,
        reason: a.reason,
      });
      const now = links[version as keyof typeof links];
      const t = addLinks[version as keyof typeof addLinks];
      t.create += now.create - before.create;
      t.update += now.update - before.update;
      t.skip += now.skip - before.skip;
      now.create = before.create;
      now.update = before.update;
      now.skip = before.skip;
    }
  }

  // --- active links of the imported careers that the file no longer asks for
  let removed = 0;
  const removedByYear = { [SOURCE_VERSION]: 0, [TARGET_VERSION]: 0 };
  const courseIdsOfInterest = courseIdsInScope(
    CURRICULUM,
    sourceCourses.map((c) => c.id),
    targetCourses.map((c) => c.id),
  );
  for (const careerId of [...careerIdByName.values()].filter((x): x is string => !!x)) {
    const stale = selectStaleLinks(
      await db.careerCourse.findMany({ where: { careerId, isActive: true } }),
      courseIdsOfInterest,
      wanted.get(careerId),
    );
    removed += stale.length;
    for (const l of stale) {
      const version = versionOfCourse.get(l.courseId);
      if (version) removedByYear[version]++;
    }
    // Belt and braces: the scope above already excludes the other year.
    if (
      CURRICULUM &&
      removedByYear[CURRICULUM === SOURCE_VERSION ? TARGET_VERSION : SOURCE_VERSION]
    ) {
      throw new Error('refusing to close links of the other curriculum');
    }
    if (apply && stale.length) {
      await db.careerCourse.updateMany({
        where: { id: { in: stale.map((l) => l.id) } },
        data: { isActive: false },
      });
    }
  }

  return {
    addMissing: [...addMissing],
    addLinks,
    careerCount: careerNames.length,
    careerT,
    links,
    removed,
    removedByYear,
    missing: [...new Set(missing)],
    noMatch: [...noMatch],
    ambiguous: [...ambiguous],
  };
}

async function main() {
  assertSeedAllowed('prisma/import-career-courses.ts');
  console.log(`Mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY RUN (no writes)'}`);
  if (OPTIONS.errors.length) {
    for (const e of OPTIONS.errors) console.log(`  ${e}`);
    console.log('option ไม่ถูกต้อง — หยุด ไม่เขียนอะไร');
    process.exitCode = 1;
    return;
  }
  if (CURRICULUM) {
    console.log(
      `Curriculum: ${CURRICULUM} เท่านั้น (ไม่คัดลอกข้ามปี, ไม่โหลด additions, ไม่ปิดลิงก์ของอีกปี)`,
    );
  }
  const { rows, errors, excludedRows } = readRows();
  console.log(
    `Source: ${rows.length} แถว, ข้ามเพราะ --exclude-career ${excludedRows} แถว, error ${errors.length}`,
  );
  for (const e of errors) console.log(`  ${e}`);
  if (errors.length) {
    console.log('มี error ในไฟล์ — หยุด ไม่เขียนอะไร');
    process.exitCode = 1;
    return;
  }

  const additions = readAdditions();
  if (additions.errors.length) {
    for (const e of additions.errors) console.log(`  ${e}`);
    console.log('มี error ในไฟล์เสริม — หยุด ไม่เขียนอะไร');
    process.exitCode = 1;
    return;
  }

  let result;
  try {
    result = APPLY
      ? await prisma.$transaction((tx) => plan(tx, rows, additions.rows, true), {
          timeout: 120_000,
        })
      : await plan(prisma, rows, additions.rows, false);
  } catch (e) {
    if (!(e instanceof AdditionsError)) throw e;
    for (const msg of e.errors) console.log(`  ${msg}`);
    console.log('มี error ในไฟล์เสริม — หยุด ไม่เขียนอะไร');
    process.exitCode = 1;
    return;
  }

  if (CURRICULUM) {
    const other = CURRICULUM === SOURCE_VERSION ? TARGET_VERSION : SOURCE_VERSION;
    console.log(`สาย (career): ${result.careerCount}  ${fmt(result.careerT)}`);
    console.log(
      `ลิงก์ ${CURRICULUM}: ${fmt(result.links[CURRICULUM])} / ปิดลิงก์ ${result.removedByYear[CURRICULUM]}`,
    );
    console.log(`ปิดลิงก์ของอีกปี (${other}): ${result.removedByYear[other]}`);
    console.log(
      `รหัสวิชาไม่พบใน ${CURRICULUM} (ข้าม): ${result.missing.length}${list(result.missing)}`,
    );
    console.log(
      !APPLY
        ? 'Dry run only — rerun with --apply to write to the database.'
        : 'Career-course import complete.',
    );
    return;
  }
  console.log(`สาย (career): ${result.careerCount}  ${fmt(result.careerT)}`);
  console.log(`ลิงก์ ${SOURCE_VERSION}: ${fmt(result.links[SOURCE_VERSION])}`);
  console.log(`ลิงก์ ${TARGET_VERSION}: ${fmt(result.links[TARGET_VERSION])}`);
  if (ADDITIONS_FILE) {
    console.log(`ไฟล์เสริม ${additions.rows.length} แถว:`);
    console.log(`  ลิงก์ ${SOURCE_VERSION}: ${fmt(result.addLinks[SOURCE_VERSION])}`);
    console.log(`  ลิงก์ ${TARGET_VERSION}: ${fmt(result.addLinks[TARGET_VERSION])}`);
    console.log(`  รหัสวิชาไม่พบ: ${result.addMissing.length}${list(result.addMissing)}`);
  }
  console.log(`soft-delete ลิงก์ที่ไฟล์ไม่ได้ขออีก: ${result.removed}`);
  console.log(
    `รหัสวิชาไม่พบใน ${SOURCE_VERSION} (ข้าม): ${result.missing.length}${list(result.missing)}`,
  );
  console.log(
    `วิชา ${SOURCE_VERSION} ที่ไม่มีวิชาชื่อเดียวกันใน ${TARGET_VERSION}: ${result.noMatch.length}${list(result.noMatch)}`,
  );
  console.log(
    `ชื่อซ้ำ/คลุมเครือ (ไม่คัดลอกไป ${TARGET_VERSION}): ${result.ambiguous.length}${list(result.ambiguous)}`,
  );
  if (!APPLY) console.log('Dry run only — rerun with --apply to write to the database.');
  else console.log('Career-course import complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
