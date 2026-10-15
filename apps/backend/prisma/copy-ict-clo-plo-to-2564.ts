import * as fs from 'fs';
import * as path from 'path';

import { Prisma, PrismaClient } from '@prisma/client';

import { assertSeedAllowed } from '../src/common/util/seed-guard';

const prisma = new PrismaClient();

// Copies the CLOs and CLO→PLO mappings of ICT 2569 (already in the DB) onto the
// ICT 2564 courses that carry the same course NAME. Reads only the database —
// plus, for the report, the list of changed courses in the converted curriculum
// book (git-ignored prisma/private-data/). Prints only course codes and counts.
//
//   ts-node prisma/copy-ict-clo-plo-to-2564.ts            # dry run (default)
//   ts-node prisma/copy-ict-clo-plo-to-2564.ts --apply    # one transaction, idempotent
//
// Only curriculum 2564 is written; 2569 is read-only. PLO rows of 2564 are never
// edited — each mapping points at the 2564 PLO with the same code (PLO1→PLO1…).
const APPLY = process.argv.includes('--apply');
const DATA_DIR = path.join(__dirname, 'private-data');
const STATUS_FILE = path.join(DATA_DIR, 'courses-2564-status.txt');
const PROGRAM_CODE = 'ICT';
const TARGET_VERSION = '2564';
const SOURCE_VERSION = '2569';
// Uniform weight: PLO achievement uses weight as a relative weighted average
// (DTO range 1..5), so 1 for every row is a plain mean.
const MAPPING_WEIGHT = 1;

type Db = PrismaClient | Prisma.TransactionClient;

// ------------------------------------------------------------- name matching

// NFC + sara-am folded (ํ + า → ำ) + collapsed whitespace + lower-case Latin.
const normName = (s: string) =>
  s.normalize('NFC').replace(/ํา/g, 'ำ').replace(/\s+/g, ' ').trim().toLowerCase();

const cloOrder = (code: string) => Number(/(\d+)$/.exec(code)?.[1] ?? 0);

// -------------------------------------------- "changed courses" of the book

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

const readTable = (n: number) =>
  parseCsv(fs.readFileSync(path.join(DATA_DIR, `table_${String(n).padStart(3, '0')}.csv`), 'utf8'));

const codesIn = (text: string) => [...text.matchAll(/\d{8}/g)].map((m) => m[0]);

// Course codes the 2569 book lists as changed: ต.1 (old→new codes), the "สิ่งที่เปลี่ยนแปลง"
// column of ต.2, and every per-course "รายวิชาเดิม/รายวิชาปรับปรุง" table that has a change.
// Returns null when the converted files are not present on this machine.
function readChangedCodes(): Set<string> | null {
  if (!fs.existsSync(path.join(DATA_DIR, 'curriculum.txt'))) return null;
  const changed = new Set<string>();
  readTable(1).forEach((row, r) => {
    if (r > 0) codesIn(row.join(' ')).forEach((c) => changed.add(c));
  });
  (readTable(2)[1]?.[2] ? codesIn(readTable(2)[1][2]) : []).forEach((c) => changed.add(c));

  const lines = fs.readFileSync(path.join(DATA_DIR, 'curriculum.txt'), 'utf8').split('\n');
  let current: string | null = null;
  for (const line of lines) {
    const c = /^\s*1\.\s*รหัสวิชา\s+(\d{8})/.exec(line);
    if (c) current = c[1];
    const t = /^\[TABLE (\d+):/.exec(line);
    if (!t || !current) continue;
    const rows = readTable(Number(t[1]));
    const isChangeTable = (rows[0]?.[0] ?? '').trim().startsWith('รายวิชาเดิม');
    if (isChangeTable && rows.slice(1).some((r) => r.slice(2).some((x) => x.trim()))) {
      changed.add(current);
    }
  }
  return changed;
}

// ----------------------------------------------------------------- the run

interface Tally {
  create: number;
  update: number;
  skip: number;
}
const tally = (): Tally => ({ create: 0, update: 0, skip: 0 });
const fmt = (t: Tally) => `create ${t.create} / update ${t.update} / skip ${t.skip}`;

async function plan(db: Db, changedCodes: Set<string> | null, apply: boolean) {
  const program = await db.program.findFirstOrThrow({ where: { code: PROGRAM_CODE } });
  const target = await db.curriculum.findFirstOrThrow({
    where: { programId: program.id, version: TARGET_VERSION, isActive: true },
  });
  const source = await db.curriculum.findFirstOrThrow({
    where: { programId: program.id, version: SOURCE_VERSION, isActive: true },
  });

  const targetPlos = await db.plo.findMany({
    where: { curriculumId: target.id, isActive: true },
    select: { id: true, code: true },
  });
  const ploIdByCode = new Map(targetPlos.map((p) => [p.code, p.id]));

  const targetCourses = await db.course.findMany({
    where: { curriculumId: target.id, isActive: true },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true, credits: true },
  });
  const sourceCourses = await db.course.findMany({
    where: { curriculumId: source.id, isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      credits: true,
      clos: {
        where: { isActive: true },
        select: {
          code: true,
          description: true,
          ploMappings: { where: { isActive: true }, select: { plo: { select: { code: true } } } },
        },
      },
    },
  });

  const byName = (list: { name: string }[]) => {
    const m = new Map<string, number>();
    for (const c of list) m.set(normName(c.name), (m.get(normName(c.name)) ?? 0) + 1);
    return m;
  };
  const targetNameCount = byName(targetCourses);
  const sourceNameCount = byName(sourceCourses);
  const sourceByName = new Map(sourceCourses.map((c) => [normName(c.name), c]));

  const groups = {
    copy: [] as string[],
    noMatch: [] as string[],
    noClo: [] as string[],
    ambiguous: [] as string[],
    creditsDiffer: [] as string[],
    inChangeList: [] as string[],
  };
  const cloT = tally();
  const mapT = tally();
  const removed = { clos: 0, mappings: 0 };
  const protectedClos = { count: 0, courses: new Set<string>() };
  let updatedWithLinkedData = 0;
  let missingPlo = 0;

  for (const course of targetCourses) {
    const key = normName(course.name);
    if ((targetNameCount.get(key) ?? 0) > 1 || (sourceNameCount.get(key) ?? 0) > 1) {
      groups.ambiguous.push(course.code);
      continue;
    }
    const src = sourceByName.get(key);
    if (!src) {
      groups.noMatch.push(course.code);
      continue;
    }
    if (src.clos.length === 0) {
      groups.noClo.push(course.code);
      continue;
    }
    groups.copy.push(course.code);
    if (src.credits !== course.credits) groups.creditsDiffer.push(course.code);
    if (changedCodes?.has(src.code)) groups.inChangeList.push(course.code);

    const existing = await db.clo.findMany({
      where: { courseId: course.id, isActive: true },
      include: {
        ploMappings: true,
        _count: { select: { assessmentScores: true, assessmentCloMappings: true } },
      },
    });
    const existingByCode = new Map(existing.map((c) => [c.code, c]));
    const keptIds = new Set<string>();
    const ploCodeById = new Map(targetPlos.map((p) => [p.id, p.code]));

    for (const clo of [...src.clos].sort((a, b) => cloOrder(a.code) - cloOrder(b.code))) {
      const found = existingByCode.get(clo.code) ?? null;
      let cloId: string | null = found?.id ?? null;
      if (found && found.description === clo.description) {
        cloT.skip++;
      } else {
        if (found) {
          cloT.update++;
          if (found._count.assessmentScores + found._count.assessmentCloMappings > 0) {
            updatedWithLinkedData++;
          }
        } else {
          cloT.create++;
        }
        if (apply) {
          cloId = found
            ? (
                await db.clo.update({
                  where: { id: found.id },
                  data: { description: clo.description },
                })
              ).id
            : (
                await db.clo.create({
                  data: { code: clo.code, description: clo.description, courseId: course.id },
                })
              ).id;
        }
      }
      if (cloId) keptIds.add(cloId);

      // (cloId, ploId) is a real @@unique: reactivate a soft-deleted row, don't re-create it.
      const wanted = new Set(clo.ploMappings.map((m) => m.plo.code));
      const rows = found?.ploMappings ?? [];
      for (const code of wanted) {
        const ploId = ploIdByCode.get(code);
        if (!ploId) {
          missingPlo++;
          continue;
        }
        const row = rows.find((m) => m.ploId === ploId);
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
          if (apply && cloId) {
            await db.cloPloMapping.create({ data: { cloId, ploId, weight: MAPPING_WEIGHT } });
          }
        }
      }
      for (const row of rows) {
        const code = ploCodeById.get(row.ploId);
        if (row.isActive && !(code && wanted.has(code))) {
          removed.mappings++;
          if (apply) {
            await db.cloPloMapping.update({ where: { id: row.id }, data: { isActive: false } });
          }
        }
      }
    }

    // existing CLOs outside the copied set: soft-delete unless evidence hangs on them
    for (const clo of existing) {
      if (keptIds.has(clo.id)) continue;
      if (clo._count.assessmentScores + clo._count.assessmentCloMappings > 0) {
        protectedClos.count++;
        protectedClos.courses.add(course.code);
        continue;
      }
      removed.clos++;
      removed.mappings += clo.ploMappings.filter((m) => m.isActive).length;
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
    total: targetCourses.length,
    groups,
    cloT,
    mapT,
    removed,
    protectedClos,
    updatedWithLinkedData,
    missingPlo,
  };
}

async function main() {
  assertSeedAllowed('prisma/copy-ict-clo-plo-to-2564.ts');
  console.log(`Mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY RUN (no writes)'}`);
  const changedCodes = readChangedCodes();
  const result = APPLY
    ? await prisma.$transaction((tx) => plan(tx, changedCodes, true), { timeout: 120_000 })
    : await plan(prisma, changedCodes, false);
  const g = result.groups;

  const list = (codes: string[]) => (codes.length ? ` [${codes.join(', ')}]` : '');
  console.log(`วิชา ${TARGET_VERSION} ทั้งหมด: ${result.total}`);
  console.log(`  (ก) คัดลอกได้: ${g.copy.length}`);
  console.log(
    `  (ข) ไม่มีข้อมูล ไม่มีวิชาชื่อเดียวกันใน ${SOURCE_VERSION}: ${g.noMatch.length}${list(g.noMatch)}`,
  );
  console.log(
    `  (ค) ไม่มีข้อมูล ${SOURCE_VERSION} มีวิชาแต่ไม่มี CLO: ${g.noClo.length}${list(g.noClo)}`,
  );
  console.log(`  (ง) คลุมเครือ/ชื่อซ้ำ (ไม่คัดลอก): ${g.ambiguous.length}${list(g.ambiguous)}`);
  console.log(`  (จ) หน่วยกิตไม่ตรงแต่คัดลอก: ${g.creditsDiffer.length}${list(g.creditsDiffer)}`);
  console.log(
    changedCodes
      ? `  (ฉ) คัดลอกแล้วแต่อยู่ในรายการ "เปลี่ยนแปลง" ของเล่ม ${SOURCE_VERSION}: ${g.inChangeList.length}${list(g.inChangeList)}`
      : '  (ฉ) ตรวจไม่ได้: ไม่พบไฟล์ใน private-data/',
  );
  console.log(
    `CLO:     ${fmt(result.cloT)}  (update ที่มีข้อมูลผูก ${result.updatedWithLinkedData})`,
  );
  console.log(`Mapping: ${fmt(result.mapT)}  (weight=${MAPPING_WEIGHT})`);
  console.log(
    `soft-delete: CLO ${result.removed.clos}, mapping ${result.removed.mappings}; ` +
      `ข้ามเพราะมีข้อมูลผูก: CLO ${result.protectedClos.count}${list([...result.protectedClos.courses])}`,
  );
  console.log(`PLO ของ ${TARGET_VERSION} ที่หาไม่พบ (mapping ข้าม): ${result.missingPlo}`);

  const status = [
    ...g.noMatch.map((c) => `${c}\tno-same-name-in-${SOURCE_VERSION}`),
    ...g.noClo.map((c) => `${c}\tno-clo-in-${SOURCE_VERSION}`),
    ...g.ambiguous.map((c) => `${c}\tambiguous-name`),
    ...g.creditsDiffer.map((c) => `${c}\tcredits-differ-copied`),
    ...g.inChangeList.map((c) => `${c}\tin-change-list-copied`),
  ];
  fs.writeFileSync(
    STATUS_FILE,
    `# ${TARGET_VERSION} course code, group — generated, do not commit\n${status.join('\n')}\n`,
  );
  console.log(`เขียนสถานะวิชาที่ ${STATUS_FILE.replace(`${__dirname}/`, 'prisma/')}`);

  if (!APPLY) console.log('Dry run only — rerun with --apply to write to the database.');
  else console.log('Copy of ICT CLO/PLO mappings to 2564 complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
