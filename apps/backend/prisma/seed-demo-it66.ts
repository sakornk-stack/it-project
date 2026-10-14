// Demo cohort: 100 simulated ICT (curriculum 2564) students admitted in 2566,
// graded for 2566/1 .. 2569/1 (the current term), with a mix of grades, at-risk
// students, honors students and a few F that were retaken or left unretaken.
//
// Run:  npx ts-node prisma/seed-demo-it66.ts            (dry run: prints the plan)
//       npx ts-node prisma/seed-demo-it66.ts --confirm  (writes, one transaction)
//
// Insert-only: never UPDATEs or DELETEs an existing row, and REFUSES to run if
// any DEMO-IT66 student already exists (it never skips or overwrites). Markers:
// student code DEMO-IT66-NNN, email demo-it66-NNN@test.local; cleanup-demo-it66.ts
// removes exactly that set. Deterministic (the seed is chosen from a fixed list).
// Accounts cannot sign in: random unknown password hash, no auth-method rows.
// Logs counts and codes only: no names, emails or ids.
import { randomBytes, randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  buildCatalog,
  expectedCreditsByNow,
  findGeneration,
  GRADE_ORDER,
  GPAX_BANDS,
  makeNames,
  SLOTS,
  STUDENT_COUNT,
  validatePlan,
  type CatalogCourse,
} from './demo-it66/engine';

const prisma = new PrismaClient();

const ALLOWED_DBS = ['eduanalyze_ai', 'eduanalyze_seed_test'];
const LOCAL_HOSTS = ['localhost', '127.0.0.1', 'postgres'];
const DEV_PORT = '5433';
const PROGRAM_CODE = 'ICT';
const CURRICULUM_VERSION = '2564';
const ADMISSION_YEAR = 2566;
const CODE_PREFIX = 'DEMO-IT66-';
const EMAIL_MARKER = /^demo-it66-\d{3}@test\.local$/;
const CODE_MARKER = /^DEMO-IT66-\d{3}$/;
const MANIFEST = join(__dirname, '..', '.backups', 'demo-it66-manifest.json');

function assertSafeTarget(): void {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Refusing to run: NODE_ENV=production');
  const url = new URL(process.env.DATABASE_URL ?? '');
  const db = url.pathname.replace(/^\//, '');
  if (!ALLOWED_DBS.includes(db))
    throw new Error(`Refusing to run: database "${db}" is not allowed`);
  if (!LOCAL_HOSTS.includes(url.hostname))
    throw new Error(`Refusing to run: host "${url.hostname}" is not local`);
  if (url.port !== DEV_PORT)
    throw new Error(`Refusing to run: port "${url.port}" is not the dev port ${DEV_PORT}`);
}

type Db = Pick<
  PrismaClient,
  | 'user'
  | 'studentProfile'
  | 'studentCourseRecord'
  | 'courseInstructor'
  | 'course'
  | 'curriculum'
  | 'plo'
  | 'clo'
  | 'cloPloMapping'
  | 'career'
  | 'careerCourse'
  | 'academicYear'
  | 'semester'
  | 'userRole'
  | 'userScope'
  | 'courseAssessment'
>;

// Everything that must be identical before and after: all people and records
// that are not DEMO-IT66, plus the curriculum and organization data.
async function protectedCounts(db: Db) {
  const users = await db.user.findMany({ select: { id: true, email: true } });
  const keepUserIds = users.filter((u) => !EMAIL_MARKER.test(u.email)).map((u) => u.id);
  const profiles = await db.studentProfile.findMany({ select: { id: true, studentCode: true } });
  const keepProfileIds = profiles.filter((p) => !CODE_MARKER.test(p.studentCode)).map((p) => p.id);
  return {
    otherUsers: keepUserIds.length,
    otherProfiles: keepProfileIds.length,
    otherRecords: await db.studentCourseRecord.count({
      where: { studentProfileId: { in: keepProfileIds } },
    }),
    otherRoles: await db.userRole.count({ where: { userId: { in: keepUserIds } } }),
    otherScopes: await db.userScope.count({ where: { userId: { in: keepUserIds } } }),
    otherAssessments: await db.courseAssessment.count({
      where: { studentProfileId: { in: keepProfileIds } },
    }),
    courseInstructors: await db.courseInstructor.count(),
    courses: await db.course.count(),
    curricula: await db.curriculum.count(),
    plos: await db.plo.count(),
    clos: await db.clo.count(),
    cloPloMappings: await db.cloPloMapping.count(),
    careers: await db.career.count(),
    careerCourses: await db.careerCourse.count(),
    academicYears: await db.academicYear.count(),
    semesters: await db.semester.count(),
  };
}

async function main() {
  assertSafeTarget();
  const confirm = process.argv.includes('--confirm');

  const program = await prisma.program.findFirst({ where: { code: PROGRAM_CODE, isActive: true } });
  if (!program) throw new Error(`active program ${PROGRAM_CODE} not found`);
  const curriculum = await prisma.curriculum.findFirst({
    where: { programId: program.id, version: CURRICULUM_VERSION, isActive: true },
  });
  if (!curriculum)
    throw new Error(`active curriculum ${CURRICULUM_VERSION} of ${PROGRAM_CODE} not found`);

  // Live catalog: active courses and their ACTIVE prerequisites only.
  const dbCourses = await prisma.course.findMany({
    where: { curriculumId: curriculum.id, isActive: true },
    include: {
      prerequisitesRequired: {
        include: { prerequisiteCourse: { select: { code: true, isActive: true } } },
      },
    },
  });
  const catalogCourses: CatalogCourse[] = dbCourses.map((c) => ({
    code: c.code,
    credits: c.credits,
    isRequired: c.isRequired,
    prereqs: c.prerequisitesRequired
      .filter((p) => p.prerequisiteCourse.isActive)
      .map((p) => p.prerequisiteCourse.code),
  }));
  const catalog = buildCatalog(catalogCourses);
  const planProblems = validatePlan(catalog);
  if (planProblems.length > 0)
    throw new Error(
      `the built-in plan no longer fits this curriculum:\n- ${planProblems.join('\n- ')}`,
    );
  const courseByCode = new Map(dbCourses.map((c) => [c.code, c]));

  const years = await prisma.academicYear.findMany({
    where: { isActive: true },
    select: { year: true },
  });
  const currentYear = Math.max(...years.map((y) => y.year));
  const expectedCredits = expectedCreditsByNow(
    curriculum.totalCredits,
    curriculum.durationYears,
    currentYear,
    ADMISSION_YEAR,
  );

  const semesterId = new Map<string, string>();
  for (const slot of SLOTS) {
    const sem = await prisma.semester.findFirst({
      where: { term: slot.term, isActive: true, academicYear: { year: slot.year, isActive: true } },
      select: { id: true },
    });
    if (sem) semesterId.set(slot.key, sem.id);
  }

  // Refuse to touch an existing cohort, whatever state it is in.
  const existingUsers = (await prisma.user.findMany({ select: { email: true } })).filter((u) =>
    EMAIL_MARKER.test(u.email),
  ).length;
  const existingProfiles = (
    await prisma.studentProfile.findMany({ select: { studentCode: true } })
  ).filter((p) => CODE_MARKER.test(p.studentCode)).length;
  if (existingUsers > 0 || existingProfiles > 0) {
    throw new Error(
      `Refusing to run: ${existingUsers} DEMO-IT66 users and ${existingProfiles} profiles already exist (nothing is skipped or overwritten)`,
    );
  }

  // ---- plan (pure) ----
  const { generation, summary } = findGeneration(catalog, expectedCredits, true);
  const missingSlots = [
    ...new Set(generation.students.flatMap((s) => s.records.map((r) => r.slotKey))),
  ].filter((k) => !semesterId.has(k));
  if (missingSlots.length > 0)
    throw new Error(
      `semesters not found (this script never creates one): ${missingSlots.join(', ')}`,
    );
  const names = makeNames(STUDENT_COUNT, generation.seed);
  const recordCount = generation.students.reduce((n, s) => n + s.records.length, 0);

  console.log(
    `target db ok; program ${PROGRAM_CODE}, curriculum ${CURRICULUM_VERSION} (${curriculum.totalCredits} credits, ${curriculum.durationYears} years); current academic year ${currentYear}`,
  );
  console.log(
    `plan: seed ${generation.seed}; ${STUDENT_COUNT} students, ${recordCount} records, ${summary.summerRecords} of them summer retakes`,
  );
  console.log(
    'grade share %:',
    GRADE_ORDER.map((g) => `${g}=${summary.gradeShare[g].toFixed(1)}`).join(' '),
  );
  console.log(
    'GPAX bands:',
    GPAX_BANDS.map(
      (b) => `${b.id}[${b.min}-${b.max === 4.01 ? 4 : b.max})=${summary.bandCounts[b.id]}`,
    ).join(' '),
  );
  console.log(
    `behind plan (< ${expectedCredits} credits passed): ${summary.behindPlan}; credits passed min/median/max: ${summary.creditsPassed.min}/${summary.creditsPassed.median}/${summary.creditsPassed.max}`,
  );
  console.log(
    `failed-then-passed students: ${summary.studentsWithRetakePass}; students with an unretaken F: ${summary.studentsWithUnretakenF}; max credits in a term: ${summary.maxCreditsInATerm}`,
  );
  if (!confirm) {
    console.log('dry run only; pass --confirm to write');
    return;
  }

  // Slow bcrypt work stays outside the transaction.
  const hashes: string[] = [];
  for (let i = 0; i < STUDENT_COUNT; i++)
    hashes.push(await bcrypt.hash(randomBytes(32).toString('hex'), 10));

  const before = await protectedCounts(prisma);
  const ids = {
    users: [] as string[],
    userRoles: [] as string[],
    studentProfiles: [] as string[],
    studentCourseRecords: [] as string[],
  };

  await prisma.$transaction(
    async (tx) => {
      const userRows = [];
      const roleRows = [];
      const profileRows = [];
      const recordRows = [];
      for (const s of generation.students) {
        const n = String(s.index).padStart(3, '0');
        const userId = randomUUID();
        const profileId = randomUUID();
        const roleId = randomUUID();
        userRows.push({
          id: userId,
          email: `demo-it66-${n}@test.local`,
          fullName: names[s.index - 1],
          passwordHash: hashes[s.index - 1],
          isActive: true,
          mustChangePassword: false,
        });
        roleRows.push({ id: roleId, userId, role: 'STUDENT' as const });
        profileRows.push({
          id: profileId,
          userId,
          studentCode: `${CODE_PREFIX}${n}`,
          programId: program.id,
          curriculumId: curriculum.id,
          admissionYear: ADMISSION_YEAR,
          isActive: true,
        });
        ids.users.push(userId);
        ids.userRoles.push(roleId);
        ids.studentProfiles.push(profileId);
        for (const r of s.records) {
          const id = randomUUID();
          // enteredByUserId / enteredByRole stay NULL, as in seed-demo.ts: no real account is credited.
          recordRows.push({
            id,
            grade: r.grade,
            credits: courseByCode.get(r.code)!.credits,
            studentProfileId: profileId,
            courseId: courseByCode.get(r.code)!.id,
            semesterId: semesterId.get(r.slotKey)!,
          });
          ids.studentCourseRecords.push(id);
        }
      }
      await tx.user.createMany({ data: userRows });
      await tx.userRole.createMany({ data: roleRows });
      await tx.studentProfile.createMany({ data: profileRows });
      await tx.studentCourseRecord.createMany({ data: recordRows });

      // Checked inside the transaction: any mismatch throws and rolls everything back.
      const created = {
        users: (await tx.user.findMany({ select: { email: true } })).filter((u) =>
          EMAIL_MARKER.test(u.email),
        ).length,
        profiles: (await tx.studentProfile.findMany({ select: { studentCode: true } })).filter(
          (p) => CODE_MARKER.test(p.studentCode),
        ).length,
        roles: await tx.userRole.count({ where: { userId: { in: ids.users } } }),
        records: await tx.studentCourseRecord.count({
          where: { studentProfileId: { in: ids.studentProfiles } },
        }),
      };
      if (
        created.users !== STUDENT_COUNT ||
        created.profiles !== STUDENT_COUNT ||
        created.roles !== STUDENT_COUNT ||
        created.records !== recordCount
      ) {
        throw new Error(
          `Rollback: created ${JSON.stringify(created)}, expected ${STUDENT_COUNT}/${STUDENT_COUNT}/${STUDENT_COUNT}/${recordCount}`,
        );
      }
      const after = await protectedCounts(tx);
      for (const key of Object.keys(before) as (keyof typeof before)[]) {
        if (after[key] !== before[key])
          throw new Error(`Rollback: protected count "${key}" changed`);
      }
    },
    { timeout: 180000, maxWait: 30000 },
  );

  mkdirSync(join(__dirname, '..', '.backups'), { recursive: true });
  writeFileSync(
    MANIFEST,
    JSON.stringify({ createdAt: new Date().toISOString(), seed: generation.seed, ...ids }, null, 2),
  );
  console.log(
    `added rows: users=${ids.users.length} userRoles=${ids.userRoles.length} studentProfiles=${ids.studentProfiles.length} studentCourseRecords=${ids.studentCourseRecords.length}`,
  );
  console.log('manifest:', MANIFEST);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : 'failed');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
