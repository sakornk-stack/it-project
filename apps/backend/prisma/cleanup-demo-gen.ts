// Removes the DEMO-GEN students (seed-demo.ts) from the dev database, chosen by
// their own markers, never by the manifest: student code DEMO-GEN-NNNN and email
// demo-gen-NNNN@test.local. Unlike cleanup-demo.ts it also takes the course
// records that were entered on those students after seeding (which the manifest
// does not list and which would block deleting the profile).
//
// Run:  npx ts-node prisma/cleanup-demo-gen.ts            (dry run: counts only)
//       npx ts-node prisma/cleanup-demo-gen.ts --confirm  (deletes, one transaction)
//       --expect=USERS,PROFILES,RECORDS                   (override the expected counts)
//
// The transaction is rolled back unless exactly the expected number of users,
// profiles and course records were removed and everything else is unchanged.
// Logs counts only: no emails, names, ids or tokens.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ALLOWED_DBS = ['eduanalyze_ai', 'eduanalyze_cleanup_test'];
const LOCAL_HOSTS = ['localhost', '127.0.0.1', 'postgres'];
const CODE_MARKER = /^DEMO-GEN-\d{4}$/;
const EMAIL_MARKER = /^demo-gen-\d{4}@test\.local$/;
const EXPECTED = { users: 182, profiles: 182, records: 513 };

function assertSafeTarget(): void {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run: NODE_ENV=production');
  const url = new URL(process.env.DATABASE_URL ?? '');
  const db = url.pathname.replace(/^\//, '');
  if (!ALLOWED_DBS.includes(db)) throw new Error(`Refusing to run: database "${db}" is not allowed`);
  if (!LOCAL_HOSTS.includes(url.hostname)) throw new Error(`Refusing to run: host "${url.hostname}" is not local`);
}

function expectedCounts(): typeof EXPECTED {
  const arg = process.argv.find((a) => a.startsWith('--expect='));
  if (!arg) return EXPECTED;
  const [users, profiles, records] = arg.slice('--expect='.length).split(',').map(Number);
  if (![users, profiles, records].every(Number.isInteger)) throw new Error('--expect needs three integers');
  return { users, profiles, records };
}

type Tx = Pick<PrismaClient, 'user' | 'studentProfile' | 'studentCourseRecord' | 'courseInstructor' | 'course' | 'curriculum' | 'plo' | 'clo' | 'cloPloMapping' | 'career' | 'careerCourse' | 'academicYear' | 'semester' | 'userRole' | 'userScope' | 'courseAssessment'>;

// Everything that must be the same before and after: the people who are not
// DEMO-GEN, what they own, and the curriculum/organization data.
async function protectedCounts(db: Tx) {
  const users = await db.user.findMany({ select: { id: true, email: true } });
  const keepUserIds = users.filter((u) => !EMAIL_MARKER.test(u.email)).map((u) => u.id);
  const profiles = await db.studentProfile.findMany({ select: { id: true, studentCode: true } });
  const keepProfileIds = profiles.filter((p) => !CODE_MARKER.test(p.studentCode)).map((p) => p.id);
  const demoStuIds = profiles.filter((p) => p.studentCode.startsWith('DEMO-') && !CODE_MARKER.test(p.studentCode)).map((p) => p.id);
  return {
    otherUsers: keepUserIds.length,
    otherProfiles: keepProfileIds.length,
    otherRecords: await db.studentCourseRecord.count({ where: { studentProfileId: { in: keepProfileIds } } }),
    demoStuRecords: await db.studentCourseRecord.count({ where: { studentProfileId: { in: demoStuIds } } }),
    otherRoles: await db.userRole.count({ where: { userId: { in: keepUserIds } } }),
    otherScopes: await db.userScope.count({ where: { userId: { in: keepUserIds } } }),
    otherAssessments: await db.courseAssessment.count({ where: { studentProfileId: { in: keepProfileIds } } }),
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
  const expected = expectedCounts();

  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const profiles = await prisma.studentProfile.findMany({ select: { id: true, userId: true, studentCode: true } });
  const userIds = users.filter((u) => EMAIL_MARKER.test(u.email)).map((u) => u.id);
  const profileRows = profiles.filter((p) => CODE_MARKER.test(p.studentCode));
  const profileIds = profileRows.map((p) => p.id);
  const userIdSet = new Set(userIds);
  // Account and student must be the same set: no half-marked pair is touched.
  if (!profileRows.every((p) => userIdSet.has(p.userId)) || profiles.some((p) => userIdSet.has(p.userId) && !CODE_MARKER.test(p.studentCode))) {
    throw new Error('Abort: DEMO-GEN accounts and student profiles do not pair up one to one');
  }

  const recordIds = (await prisma.studentCourseRecord.findMany({ where: { studentProfileId: { in: profileIds } }, select: { id: true } })).map((r) => r.id);
  // A DEMO-GEN account must not have entered anything on anyone else's record.
  const enteredElsewhere = await prisma.studentCourseRecord.count({
    where: { enteredByUserId: { in: userIds }, studentProfileId: { notIn: profileIds } },
  });
  if (enteredElsewhere > 0) throw new Error(`Abort: ${enteredElsewhere} records of other students were entered by DEMO-GEN accounts`);

  const found = { users: userIds.length, profiles: profileIds.length, records: recordIds.length };
  console.log('selected:', JSON.stringify(found), 'expected:', JSON.stringify(expected));
  if (found.users !== expected.users || found.profiles !== expected.profiles || found.records !== expected.records) {
    throw new Error('Abort: selected counts differ from the expected counts; nothing was changed');
  }

  const before = await protectedCounts(prisma);
  const dependents = {
    student_assessment_scores: await prisma.studentAssessmentScore.count({ where: { studentCourseRecordId: { in: recordIds } } }),
    course_assessments: await prisma.courseAssessment.count({ where: { studentProfileId: { in: profileIds } } }),
    student_planned_courses: await prisma.studentPlannedCourse.count({ where: { studentProfileId: { in: profileIds } } }),
    student_credit_limit_requests: await prisma.studentCreditLimitRequest.count({ where: { studentProfileId: { in: profileIds } } }),
    password_reset_tokens: await prisma.passwordResetToken.count({ where: { userId: { in: userIds } } }),
    two_factor_credentials: await prisma.twoFactorCredential.count({ where: { userId: { in: userIds } } }),
    user_auth_methods: await prisma.userAuthMethod.count({ where: { userId: { in: userIds } } }),
    user_scopes: await prisma.userScope.count({ where: { userId: { in: userIds } } }),
    user_roles: await prisma.userRole.count({ where: { userId: { in: userIds } } }),
  };
  console.log('rows to delete (besides the three above):', JSON.stringify(dependents));
  console.log('protected, before:', JSON.stringify(before));
  if (!confirm) {
    console.log('dry run only; pass --confirm to delete');
    return;
  }

  const deleted = await prisma.$transaction(
    async (tx) => {
      const out: Record<string, number> = {};
      out.student_assessment_scores = (await tx.studentAssessmentScore.deleteMany({ where: { studentCourseRecordId: { in: recordIds } } })).count;
      out.course_assessments = (await tx.courseAssessment.deleteMany({ where: { studentProfileId: { in: profileIds } } })).count;
      out.student_planned_courses = (await tx.studentPlannedCourse.deleteMany({ where: { studentProfileId: { in: profileIds } } })).count;
      out.student_credit_limit_requests = (await tx.studentCreditLimitRequest.deleteMany({ where: { studentProfileId: { in: profileIds } } })).count;
      out.student_course_records = (await tx.studentCourseRecord.deleteMany({ where: { id: { in: recordIds } } })).count;
      out.student_profiles = (await tx.studentProfile.deleteMany({ where: { id: { in: profileIds } } })).count;
      out.password_reset_tokens = (await tx.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } })).count;
      out.two_factor_credentials = (await tx.twoFactorCredential.deleteMany({ where: { userId: { in: userIds } } })).count;
      out.user_auth_methods = (await tx.userAuthMethod.deleteMany({ where: { userId: { in: userIds } } })).count;
      out.user_scopes = (await tx.userScope.deleteMany({ where: { userId: { in: userIds } } })).count;
      out.user_roles = (await tx.userRole.deleteMany({ where: { userId: { in: userIds } } })).count;
      out.users = (await tx.user.deleteMany({ where: { id: { in: userIds } } })).count;

      // Checked inside the transaction: any mismatch throws and rolls everything back.
      if (out.users !== expected.users || out.student_profiles !== expected.profiles || out.student_course_records !== expected.records) {
        throw new Error('Rollback: deleted counts differ from the expected counts');
      }
      const after = await protectedCounts(tx);
      for (const key of Object.keys(before) as (keyof typeof before)[]) {
        if (after[key] !== before[key]) throw new Error(`Rollback: protected count "${key}" changed`);
      }
      return out;
    },
    { timeout: 120000, maxWait: 30000 },
  );
  console.log('deleted rows:', JSON.stringify(deleted));
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : 'failed');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
