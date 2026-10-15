import { PrismaClient } from '@prisma/client';

import { assertSeedAllowed } from '../src/common/util/seed-guard';

const prisma = new PrismaClient();

const PROGRAM_CODE = 'ICT';
const CURRICULUM_VERSION = '2564';

interface CourseSeed {
  code: string;
  name: string;
  nameEn: string;
  credits: number;
  isRequired: boolean;
  category: string;
}

// Follow-up to import-ict-2564.ts: that script's original comment assumed
// Gen Ed categories (other than กลุ่มสาระพลเมืองไทยและพลเมืองโลก) and
// วิชาเลือกเสรี had no course codes in the source document — confirmed
// wrong. This script adds the 16 courses the document actually lists for
// them. Purely additive: does NOT touch any of the 46 courses
// import-ict-2564.ts already created, and does NOT create/modify any
// CourseCategory or CurriculumRequirement row — both already exist from
// the Phase 4 seed (verified by direct query before writing this file).
//
// isRequired derived from checking each category's course-credit sum
// against its existing CurriculumRequirement.minCredits: the 5 Gen Ed
// subcategories sum to exactly minCredits each (no choice implied, so
// every course in them is required) — วิชาเลือกเสรี sums to 11 against a
// minCredits of 6 (a real pool to choose from, same shape as the existing
// วิชาเฉพาะเลือก category), so isRequired: false there, matching that
// category's precedent in import-ict-2564.ts.
const COURSES: CourseSeed[] = [
  // กลุ่มสาระอยู่ดีมีสุข (sum 3+1+1=5, matches minCredits=5 — all required)
  { code: '01999213', name: 'สิ่งแวดล้อม เทคโนโลยี และชีวิต', nameEn: 'Environment, Technology and Life', credits: 3, isRequired: true, category: 'กลุ่มสาระอยู่ดีมีสุข' },
  { code: '01175129', name: 'ฟุตซอลเพื่อสุขภาพ', nameEn: 'Futsal for Health', credits: 1, isRequired: true, category: 'กลุ่มสาระอยู่ดีมีสุข' },
  { code: '01175153', name: 'มวยไทย', nameEn: 'Martial Art with Thai Boxing', credits: 1, isRequired: true, category: 'กลุ่มสาระอยู่ดีมีสุข' },

  // กลุ่มสาระศาสตร์แห่งผู้ประกอบการ (sum 3+3=6, matches minCredits=6 — all required)
  { code: '02714101', name: 'การคิดเชิงวิพากษ์และการแก้ปัญหา', nameEn: 'Critical Thinking and Problem Solving', credits: 3, isRequired: true, category: 'กลุ่มสาระศาสตร์แห่งผู้ประกอบการ' },
  { code: '02721121', name: 'การจัดการธุรกิจเพื่อสังคมที่ยั่งยืน', nameEn: 'Business Management for Social Sustainability', credits: 3, isRequired: true, category: 'กลุ่มสาระศาสตร์แห่งผู้ประกอบการ' },

  // กลุ่มสาระภาษากับการสื่อสาร (sum 3+3+3+3+1=13, matches minCredits=13 — all required)
  { code: '02701011', name: 'การใช้ภาษาไทยเพื่อธุรกิจ วิทยาศาสตร์และเทคโนโลยี', nameEn: 'Thai Usage for Business Sciences and Technology', credits: 3, isRequired: true, category: 'กลุ่มสาระภาษากับการสื่อสาร' },
  { code: '01355101', name: 'ภาษาอังกฤษในชีวิตประจำวัน', nameEn: 'English for Everyday Life', credits: 3, isRequired: true, category: 'กลุ่มสาระภาษากับการสื่อสาร' },
  { code: '01355102', name: 'ภาษาอังกฤษในมหาวิทยาลัย', nameEn: 'English in University', credits: 3, isRequired: true, category: 'กลุ่มสาระภาษากับการสื่อสาร' },
  { code: '01355103', name: 'ภาษาอังกฤษเพื่อโอกาสในการทำงาน', nameEn: 'English for Job Opportunities', credits: 3, isRequired: true, category: 'กลุ่มสาระภาษากับการสื่อสาร' },
  { code: '01371111', name: 'สื่อสารสนเทศเพื่อการเรียนรู้', nameEn: 'Information Media for Learning', credits: 1, isRequired: true, category: 'กลุ่มสาระภาษากับการสื่อสาร' },

  // กลุ่มสาระพลเมืองไทยและพลเมืองโลก (existing 01999111=2 + this 1 = 3, matches minCredits=3 — required)
  { code: '02999144', name: 'ทักษะชีวิตการเป็นนิสิตมหาวิทยาลัย', nameEn: 'Life Skills For Undergraduate Student', credits: 1, isRequired: true, category: 'กลุ่มสาระพลเมืองไทยและพลเมืองโลก' },

  // กลุ่มสาระสุนทรียศาสตร์ (sum 3=3, matches minCredits=3 — required)
  { code: '02999037', name: 'ศิลปะแห่งสุนทรียศาสตร์เพื่อความสุข', nameEn: 'Arts of Aesthetics for Happiness', credits: 3, isRequired: true, category: 'กลุ่มสาระสุนทรียศาสตร์' },
  { code: '01387102', name: 'ปรัชญาสำหรับชีวิตยุคใหม่', nameEn: 'Philosophy for New Life', credits: 3, isRequired: true, category: 'กลุ่มสาระสุนทรียศาสตร์' },

  // วิชาเลือกเสรี (sum 3+2+3+3=11 > minCredits=6 — a pool to choose from, not required)
  { code: '03751111', name: 'มนุษย์กับสิ่งแวดล้อม', nameEn: 'Man and Environment', credits: 3, isRequired: false, category: 'วิชาเลือกเสรี' },
  { code: '02032304', name: 'เกษตรเพื่อโลกสีเขียว', nameEn: 'Agriculture for Green World', credits: 2, isRequired: false, category: 'วิชาเลือกเสรี' },
  { code: '02738453', name: 'BCG Economy', nameEn: 'BCG Economy', credits: 3, isRequired: false, category: 'วิชาเลือกเสรี' },
  { code: '02738473', name: 'การประยุกต์คอมพิวเตอร์ในวิทยาศาสตร์ชีวภาพ', nameEn: 'Computer Application in Biological Science', credits: 3, isRequired: false, category: 'วิชาเลือกเสรี' },
];

const APPLY = process.argv.includes('--apply');

async function main() {
  assertSeedAllowed('prisma/import-ict-2564-gened.ts');
  console.log(`Mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY RUN (no writes)'}`);
  console.log(`Total: ${COURSES.length} courses to add (0 categories/requirements touched, 0 prerequisites)`);

  const byCategory = new Map<string, CourseSeed[]>();
  for (const c of COURSES) {
    byCategory.set(c.category, [...(byCategory.get(c.category) ?? []), c]);
  }
  for (const [category, courses] of byCategory) {
    const sum = courses.reduce((s, c) => s + c.credits, 0);
    console.log(`  ${category}: ${courses.length} courses, ${sum} credits — ${courses.map((c) => c.code).join(', ')}`);
  }

  if (!APPLY) {
    console.log('Dry run only — rerun with --apply to write to the database.');
    return;
  }

  const program = await prisma.program.findFirstOrThrow({ where: { code: PROGRAM_CODE } });
  // findFirst, not findUnique — the compound-unique shorthand
  // (programId_version) no longer exists on the Prisma client since the
  // partial-unique-index migration earlier this project (schema-level
  // @@unique([programId, version]) was removed in favor of a raw-SQL
  // partial index; see CONVENTIONS.md §7).
  const curriculum = await prisma.curriculum.findFirstOrThrow({
    where: { programId: program.id, version: CURRICULUM_VERSION },
  });
  console.log(`Curriculum: ${program.code} ${curriculum.version} (${curriculum.id})`);

  for (const c of COURSES) {
    // Categories/requirements must already exist (Phase 4 seed) — this
    // script never creates one, only looks it up. Throws loudly if a
    // category name doesn't match, rather than silently creating a
    // duplicate with a typo'd name. findFirst for the same reason as
    // curriculum above (curriculumId_name no longer exists either).
    const category = await prisma.courseCategory.findFirstOrThrow({
      where: { curriculumId: curriculum.id, name: c.category },
    });

    // Manual find-then-create-or-update, not prisma.course.upsert() —
    // upsert requires a genuine schema-level unique `where`, which
    // curriculumId+code no longer is (same partial-index migration).
    const existing = await prisma.course.findFirst({
      where: { curriculumId: curriculum.id, code: c.code },
    });
    const data = {
      name: c.name,
      nameEn: c.nameEn,
      credits: c.credits,
      isRequired: c.isRequired,
      categoryId: category.id,
    };
    const course = existing
      ? await prisma.course.update({ where: { id: existing.id }, data })
      : await prisma.course.create({
          data: { code: c.code, curriculumId: curriculum.id, ...data },
        });
    console.log(`  Course: ${c.code} ${c.name} (${course.id})`);
  }

  console.log('ICT 2564 Gen Ed / เลือกเสรี import complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
