import { Prisma, PrismaClient } from '@prisma/client';

import { assertSeedAllowed } from '../src/common/util/seed-guard';

// Copies the CLOs of ICT 2569 (and their CLO→PLO links) onto the ICT 2564
// courses that have the SAME COURSE CODE and no active CLO yet. Create-only:
// a 2564 course that already has an active CLO is skipped whole, and nothing
// existing is ever updated, deactivated or deleted. 2569 is read-only.
// (copy-ict-clo-plo-to-2564.ts is the older, name-matching script that also
// updates and soft-deletes; this one deliberately does neither.)
//
//   ts-node prisma/copy-clo-ict-2569-to-2564.ts            # dry run (default)
//   ts-node prisma/copy-clo-ict-2569-to-2564.ts --apply    # one transaction, idempotent
//
// Each CLO is copied with the same code and description. Its PLO links go to
// the 2564 PLO with the SAME CODE (PLO1→PLO1 …) and the original weight; a link
// whose PLO code does not exist in 2564 is skipped and counted. Run
// seed-plo-2564.ts first so PLO1–PLO6 exist. Prints only counts and course
// codes — never CLO text.
//
// Clo has no "unconfirmed" or "source" column, and none is added here (that
// would need a migration). The copied rows are therefore indistinguishable
// from confirmed data: the 2564 PLOs are not yet confirmed against the 2564
// curriculum book, and neither is anything linked to them.
//
// Self-contained on purpose (only seed-guard is imported), so the single file
// can be mounted into the migrator image like the other import scripts.

export const PROGRAM_CODE = 'ICT';
export const TARGET_VERSION = '2564';
export const SOURCE_VERSION = '2569';

export interface SourceClo {
  code: string;
  description: string;
  mappings: { ploCode: string; weight: number }[];
}
export interface SourceCourse {
  code: string;
  clos: SourceClo[];
}
export interface TargetCourse {
  id: string;
  code: string;
  activeCloCount: number;
}
export interface PlannedClo {
  code: string;
  description: string;
  mappings: { ploCode: string; ploId: string; weight: number }[];
  skippedMappings: number;
}
export interface PlannedCourse {
  courseId: string;
  courseCode: string;
  clos: PlannedClo[];
}
export interface Plan {
  /** 2564 courses whose code also exists in 2569. */
  matched: number;
  create: PlannedCourse[];
  skippedHasClo: string[];
  skippedNoCloIn2569: string[];
  /** 2569 courses that have CLOs but whose code is not in 2564. */
  notIn2564: string[];
  /** 2564 courses with no active CLO once the plan has been applied. */
  stillWithoutClo: string[];
  cloCount: number;
  mappingCount: number;
  skippedMappingCount: number;
}

const cloOrder = (code: string) => Number(/(\d+)$/.exec(code)?.[1] ?? 0);
const byCode = (a: string, b: string) => a.localeCompare(b);

// Pure: no database, no side effects. `ploIdByCode` is the active PLO rows of 2564.
export function planCopy(input: {
  target: TargetCourse[];
  source: SourceCourse[];
  ploIdByCode: ReadonlyMap<string, string>;
}): Plan {
  const sourceByCode = new Map<string, SourceCourse>();
  for (const course of input.source) sourceByCode.set(course.code, course);
  const targetCodes = new Set(input.target.map((c) => c.code));

  const plan: Plan = {
    matched: 0,
    create: [],
    skippedHasClo: [],
    skippedNoCloIn2569: [],
    notIn2564: input.source
      .filter((c) => c.clos.length > 0 && !targetCodes.has(c.code))
      .map((c) => c.code)
      .sort(byCode),
    stillWithoutClo: [],
    cloCount: 0,
    mappingCount: 0,
    skippedMappingCount: 0,
  };

  for (const course of [...input.target].sort((a, b) => byCode(a.code, b.code))) {
    const src = sourceByCode.get(course.code);
    if (!src) {
      if (course.activeCloCount === 0) plan.stillWithoutClo.push(course.code);
      continue;
    }
    plan.matched++;
    if (course.activeCloCount > 0) {
      plan.skippedHasClo.push(course.code);
      continue;
    }
    if (src.clos.length === 0) {
      plan.skippedNoCloIn2569.push(course.code);
      plan.stillWithoutClo.push(course.code);
      continue;
    }

    const clos = [...src.clos]
      .sort((a, b) => cloOrder(a.code) - cloOrder(b.code) || byCode(a.code, b.code))
      .map<PlannedClo>((clo) => {
        const mappings: PlannedClo['mappings'] = [];
        const seen = new Set<string>();
        let skippedMappings = 0;
        for (const m of clo.mappings) {
          const ploId = input.ploIdByCode.get(m.ploCode);
          if (!ploId || seen.has(m.ploCode)) {
            skippedMappings++;
            continue;
          }
          seen.add(m.ploCode);
          mappings.push({ ploCode: m.ploCode, ploId, weight: m.weight });
        }
        return { code: clo.code, description: clo.description, mappings, skippedMappings };
      });

    plan.create.push({ courseId: course.id, courseCode: course.code, clos });
    for (const clo of clos) {
      plan.cloCount++;
      plan.mappingCount += clo.mappings.length;
      plan.skippedMappingCount += clo.skippedMappings;
    }
  }
  return plan;
}

type Db = PrismaClient | Prisma.TransactionClient;

async function load(db: Db) {
  const program = await db.program.findFirstOrThrow({
    where: { code: PROGRAM_CODE, isActive: true },
  });
  const find = (version: string) =>
    db.curriculum.findFirstOrThrow({
      where: { programId: program.id, version, isActive: true },
      select: { id: true },
    });
  const [target, source] = await Promise.all([find(TARGET_VERSION), find(SOURCE_VERSION)]);

  const plos = await db.plo.findMany({
    where: { curriculumId: target.id, isActive: true },
    select: { id: true, code: true },
  });
  const targetCourses = await db.course.findMany({
    where: { curriculumId: target.id, isActive: true },
    select: { id: true, code: true, _count: { select: { clos: { where: { isActive: true } } } } },
  });
  const sourceCourses = await db.course.findMany({
    where: { curriculumId: source.id, isActive: true },
    select: {
      code: true,
      clos: {
        where: { isActive: true },
        select: {
          code: true,
          description: true,
          ploMappings: {
            where: { isActive: true },
            select: { weight: true, plo: { select: { code: true } } },
          },
        },
      },
    },
  });

  return {
    ploIdByCode: new Map(plos.map((p) => [p.code, p.id])),
    target: targetCourses.map<TargetCourse>((c) => ({
      id: c.id,
      code: c.code,
      activeCloCount: c._count.clos,
    })),
    source: sourceCourses.map<SourceCourse>((c) => ({
      code: c.code,
      clos: c.clos.map((clo) => ({
        code: clo.code,
        description: clo.description,
        mappings: clo.ploMappings.map((m) => ({ ploCode: m.plo.code, weight: m.weight })),
      })),
    })),
  };
}

async function write(db: Db, plan: Plan) {
  for (const course of plan.create) {
    for (const clo of course.clos) {
      const created = await db.clo.create({
        data: { code: clo.code, description: clo.description, courseId: course.courseId },
        select: { id: true },
      });
      for (const m of clo.mappings) {
        await db.cloPloMapping.create({
          data: { cloId: created.id, ploId: m.ploId, weight: m.weight },
        });
      }
    }
  }
}

const list = (codes: string[]) => (codes.length ? ` [${codes.join(', ')}]` : '');

export function report(plan: Plan, ploCount: number, apply: boolean): string[] {
  return [
    `วิชา ${TARGET_VERSION} ที่รหัสตรงกับ ${SOURCE_VERSION}: ${plan.matched}`,
    `  สร้าง CLO: ${plan.create.length} วิชา${list(plan.create.map((c) => c.courseCode))}`,
    `  ข้าม มี CLO ใน ${TARGET_VERSION} แล้ว: ${plan.skippedHasClo.length}${list(plan.skippedHasClo)}`,
    `  ข้าม ไม่มี CLO ใน ${SOURCE_VERSION}: ${plan.skippedNoCloIn2569.length}${list(plan.skippedNoCloIn2569)}`,
    `  ข้าม มี CLO ใน ${SOURCE_VERSION} แต่ไม่มีรหัสนี้ใน ${TARGET_VERSION}: ${plan.notIn2564.length}${list(plan.notIn2564)}`,
    `CLO ที่${apply ? 'สร้าง' : 'จะสร้าง'}: ${plan.cloCount}`,
    `Mapping CLO→PLO ที่${apply ? 'สร้าง' : 'จะสร้าง'}: ${plan.mappingCount}` +
      ` (ข้ามเพราะไม่มี PLO รหัสนั้นใน ${TARGET_VERSION}: ${plan.skippedMappingCount}; PLO ${TARGET_VERSION} ที่มี ${ploCount})`,
    `วิชา ${TARGET_VERSION} ที่ยังไม่มี CLO ${apply ? 'หลังคัดลอก' : 'หลังคัดลอก (คาดการณ์)'}: ${plan.stillWithoutClo.length}${list(plan.stillWithoutClo)}`,
    `คำเตือน: PLO ของ ${TARGET_VERSION} ยังไม่ได้ยืนยันกับเล่มหลักสูตร ${TARGET_VERSION} ` +
      `CLO และ mapping ที่คัดลอกจึงยังไม่ใช่ข้อมูลที่ยืนยัน (schema ไม่มีฟิลด์ระบุสถานะนี้) ควรให้คณะตรวจ`,
  ];
}

async function main() {
  assertSeedAllowed('prisma/copy-clo-ict-2569-to-2564.ts');
  const apply = process.argv.includes('--apply');
  console.log(`Mode: ${apply ? 'APPLY (writing to DB)' : 'DRY RUN (no writes)'}`);

  const prisma = new PrismaClient();
  try {
    const run = async (db: Db) => {
      const data = await load(db);
      const plan = planCopy(data);
      if (apply) await write(db, plan);
      return { plan, ploCount: data.ploIdByCode.size };
    };
    // One transaction for the whole write; the dry run only reads.
    const { plan, ploCount } = apply
      ? await prisma.$transaction((tx) => run(tx), { timeout: 120_000 })
      : await run(prisma);

    for (const line of report(plan, ploCount, apply)) console.log(line);
    if (!apply) console.log('Dry run only — rerun with --apply to write to the database.');
    else console.log('Copy of ICT 2569 CLOs to 2564 complete.');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    // Driver errors can carry connection details: print the class only.
    console.error(`Failed: ${error instanceof Error ? error.name : 'unknown error'}`);
    process.exitCode = 1;
  });
}
