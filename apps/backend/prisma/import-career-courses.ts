import * as fs from 'fs';
import * as path from 'path';

import { Prisma, PrismaClient } from '@prisma/client';

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
//   ts-node prisma/import-career-courses.ts --rename-file=PATH    # CSV old,new: rename an existing career instead of creating a new one
//
// CSV columns: career, course_code, weight (1-3), reason.
const APPLY = process.argv.includes('--apply');
const argValues = (name: string) =>
  process.argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const EXCLUDE = argValues('exclude-career');
const FILE =
  argValues('file')[0] ?? path.join(__dirname, 'private-data', 'career-course-draft.csv');
const RENAME_FILE = argValues('rename-file')[0];
const PROGRAM_CODE = 'ICT';
const SOURCE_VERSION = '2569';
const TARGET_VERSION = '2564';

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

async function plan(db: Db, rows: Row[], apply: boolean) {
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
  const targetByName = new Map(targetCourses.map((c) => [normName(c.name), c]));

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
    if (found && found.sortOrder === i && found.name === name) {
      careerT.skip++;
    } else {
      found ? careerT.update++ : careerT.create++;
      if (apply) {
        const saved = found
          ? await db.career.update({ where: { id: found.id }, data: { name, sortOrder: i } })
          : await db.career.create({ data: { name, sortOrder: i } });
        careerIdByName.set(name, saved.id);
        continue;
      }
    }
    careerIdByName.set(name, found?.id ?? null);
  }

  // --- links
  const links = { [SOURCE_VERSION]: tally(), [TARGET_VERSION]: tally() };
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
    const resolved = resolve(row.courseCode);
    if (!resolved) {
      missing.push(row.courseCode);
      continue;
    }
    const careerId = careerIdByName.get(row.career) ?? null;
    await wantLink(SOURCE_VERSION, careerId, resolved.sourceId, row);
    if (resolved.targetId) await wantLink(TARGET_VERSION, careerId, resolved.targetId, row);
  }

  // --- active links of the imported careers that the file no longer asks for
  let removed = 0;
  const courseIdsOfInterest = new Set([...sourceCourses, ...targetCourses].map((c) => c.id));
  for (const careerId of [...careerIdByName.values()].filter((x): x is string => !!x)) {
    const stale = (await db.careerCourse.findMany({ where: { careerId, isActive: true } })).filter(
      (l) => courseIdsOfInterest.has(l.courseId) && !wanted.get(careerId)?.has(l.courseId),
    );
    removed += stale.length;
    if (apply && stale.length) {
      await db.careerCourse.updateMany({
        where: { id: { in: stale.map((l) => l.id) } },
        data: { isActive: false },
      });
    }
  }

  return {
    careerCount: careerNames.length,
    careerT,
    links,
    removed,
    missing: [...new Set(missing)],
    noMatch: [...noMatch],
    ambiguous: [...ambiguous],
  };
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY RUN (no writes)'}`);
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

  const result = APPLY
    ? await prisma.$transaction((tx) => plan(tx, rows, true), { timeout: 120_000 })
    : await plan(prisma, rows, false);

  console.log(`สาย (career): ${result.careerCount}  ${fmt(result.careerT)}`);
  console.log(`ลิงก์ ${SOURCE_VERSION}: ${fmt(result.links[SOURCE_VERSION])}`);
  console.log(`ลิงก์ ${TARGET_VERSION}: ${fmt(result.links[TARGET_VERSION])}`);
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
