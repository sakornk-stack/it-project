// Removes exactly what seed-demo.ts added.
// Run:  npx ts-node prisma/cleanup-demo.ts            (dry run: counts per table)
//       npx ts-node prisma/cleanup-demo.ts --confirm  (deletes, one transaction)
//
// With the manifest (apps/backend/.backups/demo-manifest.json) it deletes the
// listed ids, and each id must still carry the demo marker (student code
// DEMO-GEN-NNNN / email demo-gen-NNNN@test.local). Without the manifest it falls
// back to the marker alone (and removes no course assignments, see below). Older demo rows (DEMO-STU-001, demo-*@test.local
// accounts) do not match the marker and are never touched.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEV_DB_NAME = 'eduanalyze_ai';
const LOCAL_HOSTS = ['localhost', '127.0.0.1', 'postgres'];
const MANIFEST = join(__dirname, '..', '.backups', 'demo-manifest.json');
const DEMO_INSTRUCTOR_EMAIL = 'demo-instructor@test.local';
const CODE_MARKER = /^DEMO-GEN-\d{4}$/;
const EMAIL_MARKER = /^demo-gen-\d{4}@test\.local$/;

function assertSafeTarget(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run: NODE_ENV=production');
  }
  const url = new URL(process.env.DATABASE_URL ?? '');
  const db = url.pathname.replace(/^\//, '');
  if (db !== DEV_DB_NAME) throw new Error(`Refusing to run: database "${db}" is not "${DEV_DB_NAME}"`);
  if (!LOCAL_HOSTS.includes(url.hostname)) throw new Error(`Refusing to run: host "${url.hostname}" is not local`);
}

interface Manifest {
  users: string[];
  userRoles: string[];
  studentProfiles: string[];
  studentCourseRecords: string[];
  courseInstructors?: string[];
  semesters?: string[];
  academicYears?: string[];
}

async function main() {
  assertSafeTarget();
  const confirm = process.argv.includes('--confirm');
  const manifest: Manifest | null = existsSync(MANIFEST)
    ? (JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest)
    : null;
  console.log(manifest ? `using manifest ${MANIFEST}` : 'manifest missing: falling back to the DEMO-GEN / demo-gen marker');

  // Marker is the hard filter in both modes; the manifest only narrows it.
  const markerUsers = (await prisma.user.findMany({ select: { id: true, email: true } })).filter((u) => EMAIL_MARKER.test(u.email));
  const markerProfiles = (await prisma.studentProfile.findMany({ select: { id: true, studentCode: true } })).filter((p) => CODE_MARKER.test(p.studentCode));
  const inManifest = (ids: string[] | undefined) => (id: string) => !manifest || (ids ?? []).includes(id);
  const userIds = markerUsers.map((u) => u.id).filter(inManifest(manifest?.users));
  const profileIds = markerProfiles.map((p) => p.id).filter(inManifest(manifest?.studentProfiles));

  const records = await prisma.studentCourseRecord.findMany({
    where: { studentProfileId: { in: profileIds } },
    select: { id: true },
  });
  const recordIds = records.map((r) => r.id).filter(inManifest(manifest?.studentCourseRecords));
  const roleRows = await prisma.userRole.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const roleIds = roleRows.map((r) => r.id);

  // Course assignments exist only through the manifest: without it there is no
  // way to tell these rows from assignments that were there before, so none is
  // removed. Each listed row must still belong to the demo instructor.
  const assignmentRows = manifest?.courseInstructors?.length
    ? await prisma.courseInstructor.findMany({
        where: { id: { in: manifest.courseInstructors }, user: { email: DEMO_INSTRUCTOR_EMAIL } },
        select: { id: true },
      })
    : [];
  const assignmentIds = assignmentRows.map((a) => a.id);

  const counts = {
    course_instructors: assignmentIds.length,
    student_course_records: recordIds.length,
    student_profiles: profileIds.length,
    user_roles: roleIds.length,
    users: userIds.length,
  };
  console.log('rows to delete:', JSON.stringify(counts));
  if (!confirm) {
    console.log('dry run only; pass --confirm to delete');
    return;
  }

  const deleted = await prisma.$transaction(
    async (tx) => {
      const ci = await tx.courseInstructor.deleteMany({ where: { id: { in: assignmentIds } } });
      const r = await tx.studentCourseRecord.deleteMany({ where: { id: { in: recordIds } } });
      // No FK, so nothing blocks; removed so no history of a demo student lingers.
      const a = await tx.auditLog.deleteMany({ where: { studentProfileId: { in: profileIds } } });
      const p = await tx.studentProfile.deleteMany({ where: { id: { in: profileIds } } });
      const ur = await tx.userRole.deleteMany({ where: { id: { in: roleIds } } });
      const u = await tx.user.deleteMany({ where: { id: { in: userIds } } });
      return { course_instructors: ci.count, student_course_records: r.count, audit_logs: a.count, student_profiles: p.count, user_roles: ur.count, users: u.count };
    },
    { timeout: 120000, maxWait: 30000 },
  );
  console.log('deleted rows:', JSON.stringify(deleted));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
