import { PrismaClient } from '@prisma/client';

import { assertSeedAllowed } from '../src/common/util/seed-guard';

import { upsertActive } from './upsert-active';

const prisma = new PrismaClient();

const PROGRAM_CODE = 'ICT';
const CURRICULUM_VERSION = '2569';

interface CategorySeed {
  name: string;
  minCredits: number;
}

interface CourseSeed {
  code: string;
  name: string;
  nameEn: string;
  credits: number;
  isRequired: boolean;
  category: string;
}

// PROJECT_CONTEXT.md course import — ICT 2569. Categories mirror the
// curriculum document's structure exactly; general education is
// restructured into 3 competency groups here (vs. 5 subject groups in
// 2564). Sum of minCredits (120) matches Curriculum.totalCredits seeded
// earlier.
const CATEGORIES: CategorySeed[] = [
  { name: 'รายวิชาศึกษาทั่วไปที่พัฒนาคุณลักษณะนิสิต มก.', minCredits: 8 },
  { name: 'รายวิชาศึกษาทั่วไปที่พัฒนาสมรรถนะ ทั้ง 3 ด้าน', minCredits: 6 },
  { name: 'รายวิชาศึกษาทั่วไปที่พัฒนาสมรรถนะตามที่ระบุใน PLO', minCredits: 10 },
  { name: 'กลุ่มวิชาเฉพาะพื้นฐาน', minCredits: 9 },
  { name: 'กลุ่มประเด็นองค์การ', minCredits: 10 },
  { name: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์', minCredits: 26 },
  { name: 'กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์', minCredits: 27 },
  { name: 'กลุ่มโครงสร้างพื้นฐานของระบบ', minCredits: 6 },
  { name: 'วิชาเฉพาะเลือก', minCredits: 12 },
  { name: 'วิชาเลือกเสรี', minCredits: 6 },
];

// Many course codes here also appear in ICT 2564 (35 shared codes; some,
// e.g. 02739211/02739241/02739232, were reused for an entirely different
// course during this revision). This is expected and safe: Course is
// scoped unique on (curriculumId, code), so both curricula's rows coexist.
const COURSES: CourseSeed[] = [
  // รายวิชาศึกษาทั่วไปที่พัฒนาคุณลักษณะนิสิต มก.
  { code: '01999111', name: 'เกษตรศาสตร์สร้างศาสตร์แห่งแผ่นดิน', nameEn: 'Kasetsart Creating Knowledge of the Land', credits: 2, isRequired: true, category: 'รายวิชาศึกษาทั่วไปที่พัฒนาคุณลักษณะนิสิต มก.' },

  // กลุ่มวิชาเฉพาะพื้นฐาน
  { code: '01417111', name: 'แคลคูลัส I', nameEn: 'Calculus I', credits: 3, isRequired: true, category: 'กลุ่มวิชาเฉพาะพื้นฐาน' },
  { code: '02739111', name: 'คอมพิวเตอร์และระบบสารสนเทศ', nameEn: 'Computer and Information System', credits: 3, isRequired: true, category: 'กลุ่มวิชาเฉพาะพื้นฐาน' },
  { code: '02739161', name: 'คณิตศาสตร์และสถิติสำหรับเทคโนโลยีสารสนเทศ', nameEn: 'Mathematics and Statistics for Information Technology', credits: 3, isRequired: true, category: 'กลุ่มวิชาเฉพาะพื้นฐาน' },

  // กลุ่มประเด็นองค์การ
  { code: '02739221', name: 'ระบบฐานข้อมูล', nameEn: 'Database System', credits: 3, isRequired: true, category: 'กลุ่มประเด็นองค์การ' },
  { code: '02739322', name: 'การวิเคราะห์และออกแบบระบบสารสนเทศ', nameEn: 'Information System Analysis and Design', credits: 3, isRequired: true, category: 'กลุ่มประเด็นองค์การ' },
  { code: '02739324', name: 'ฐานข้อมูลภาคปฏิบัติการขั้นสูง', nameEn: 'Advanced Laboratory in Database', credits: 1, isRequired: true, category: 'กลุ่มประเด็นองค์การ' },
  { code: '02739343', name: 'การบริหารโครงการ', nameEn: 'Project Management', credits: 3, isRequired: true, category: 'กลุ่มประเด็นองค์การ' },

  // กลุ่มเทคโนโลยีเพื่องานประยุกต์
  { code: '02739141', name: 'นวัตกรรมและการแปรรูปทางดิจิทัล', nameEn: 'Innovation and Digital Transformation', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },
  { code: '02739242', name: 'ความรู้เบื้องต้นเกี่ยวกับวิทยาการข้อมูล', nameEn: 'Introduction to Data Science', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },
  { code: '02739243', name: 'เทคโนโลยีอินเทอร์เน็ต', nameEn: 'Internet Technology', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },
  { code: '02739244', name: 'ปัญญาประดิษฐ์เบื้องต้น', nameEn: 'Introduction to Artificial Intelligence', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },
  { code: '02739323', name: 'อันตรกิริยาระหว่างมนุษย์กับคอมพิวเตอร์', nameEn: 'Human-Computer Interaction', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },
  { code: '02739351', name: 'การสื่อสารข้อมูลและเครือข่ายคอมพิวเตอร์', nameEn: 'Data Communication and Computer Network', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },
  { code: '02739352', name: 'พื้นฐานความมั่นคงปลอดภัยไซเบอร์', nameEn: 'Cybersecurity Fundamentals', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },
  { code: '02739491', name: 'ระเบียบวิธีวิจัยพื้นฐานทางเทคโนโลยีสารสนเทศ', nameEn: 'Basic Research Methods in Information Technology', credits: 1, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },
  { code: '02739497', name: 'สัมมนา', nameEn: 'Seminar', credits: 1, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },
  { code: '02739499', name: 'โครงงานทางด้านเทคโนโลยีสารสนเทศ', nameEn: 'Information Technology Project', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },

  // กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์
  { code: '02739112', name: 'หลักการเขียนโปรแกรม', nameEn: 'Principles of Programming', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์' },
  { code: '02739113', name: 'การเขียนโปรแกรมคอมพิวเตอร์', nameEn: 'Computer Programming', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์' },
  { code: '02739211', name: 'หลักการเขียนโปรแกรมเชิงวัตถุ', nameEn: 'Principles of Object Oriented Programming', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์' },
  { code: '02739222', name: 'การออกแบบประสบการณ์ผู้ใช้และส่วนต่อประสานงานผู้ใช้', nameEn: 'User Experience and User Interface Design', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์' },
  { code: '02739231', name: 'โครงสร้างข้อมูลและขั้นตอนวิธี', nameEn: 'Data Structure and Algorithm', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์' },
  { code: '02739241', name: 'การเขียนโปรแกรมเว็บพื้นฐาน', nameEn: 'Fundamental Web Programming', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์' },
  { code: '02739321', name: 'วิศวกรรมซอฟต์แวร์', nameEn: 'Software Engineering', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์' },
  { code: '02739341', name: 'การพัฒนาโปรแกรมประยุกต์สำหรับอุปกรณ์เคลื่อนที่', nameEn: 'Application Development for Mobile Devices', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์' },
  { code: '02739342', name: 'การพัฒนาซอฟต์แวร์แบบครบองค์ประกอบ', nameEn: 'Full Stack Software Development', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์' },

  // กลุ่มโครงสร้างพื้นฐานของระบบ
  { code: '02739232', name: 'สถาปัตยกรรมคอมพิวเตอร์และระบบปฏิบัติการ', nameEn: 'Computer Architecture and Operating System', credits: 3, isRequired: true, category: 'กลุ่มโครงสร้างพื้นฐานของระบบ' },
  { code: '02739353', name: 'เดฟออปส์และวิศวกรรมระบบคลาวด์', nameEn: 'DevOps and Cloud Engineering', credits: 3, isRequired: true, category: 'กลุ่มโครงสร้างพื้นฐานของระบบ' },

  // วิชาเฉพาะเลือก (elective — track selectors + shared elective pool)
  { code: '02739498', name: 'ปัญหาพิเศษ', nameEn: 'Special Problems', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739490', name: 'สหกิจศึกษา', nameEn: 'Cooperative Education', credits: 6, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739325', name: 'การทดสอบซอฟต์แวร์', nameEn: 'Software Testing', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739354', name: 'การออกแบบและพัฒนาระบบอินเทอร์เน็ตของสรรพสิ่ง', nameEn: 'Design and Development for Internet of Things', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739421', name: 'วิศวกรรมความต้องการ', nameEn: 'Requirement Engineering', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739422', name: 'การประกันคุณภาพซอฟต์แวร์', nameEn: 'Software Quality Assurance', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739432', name: 'เทคโนโลยีความเป็นจริงเสริม', nameEn: 'Augmented Reality Technology', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739441', name: 'การพัฒนาโปรแกรมประยุกต์บนระบบคลาวด์', nameEn: 'Cloud Application Development', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739442', name: 'การออกแบบและการจัดทำฐานข้อมูลขั้นสูง', nameEn: 'Advanced Database Design and Implementation', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739445', name: 'การออกแบบและพัฒนาเกมคอมพิวเตอร์', nameEn: 'Computer Game Design and Development', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739496', name: 'เรื่องเฉพาะทางเทคโนโลยีสารสนเทศ', nameEn: 'Selected Topic in Information Technology', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739346', name: 'การประมวลผลภาพและคอมพิวเตอร์วิทัศน์', nameEn: 'Image Processing and Computer Vision', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739431', name: 'การเรียนรู้ของเครื่องจักร', nameEn: 'Machine Learning', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739446', name: 'วิศวกรรมข้อมูล', nameEn: 'Data Engineering', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739447', name: 'การวิเคราะห์ข้อมูลและการสร้างภาพข้อมูล', nameEn: 'Data Analytics and Data Visualization', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739448', name: 'แพลตฟอร์มข้อมูลขนาดใหญ่และการวิเคราะห์', nameEn: 'Big Data Platform and Analytics', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739326', name: 'การออกแบบกระบวนการทางธุรกิจและการพัฒนาระบบการวางแผนทรัพยากรองค์กร', nameEn: 'Business Process Design and Enterprise Resource Planning System Development', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739344', name: 'การจัดการเทคโนโลยีสารสนเทศ', nameEn: 'Information Technology Management', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739345', name: 'ธุรกิจดิจิทัล', nameEn: 'Digital Business', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739443', name: 'การเขียนโปรแกรมทางธุรกิจ', nameEn: 'Business Programming', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739444', name: 'การประยุกต์คอมพิวเตอร์เพื่องานธุรกิจ', nameEn: 'Computer Applications for Business', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
];

// [courseCode, prerequisiteCourseCode] — courseCode requires prerequisiteCourseCode.
// All AND (groupId: null); no OR-groups in this curriculum version.
const PREREQUISITES: [string, string][] = [
  ['02739112', '02739111'],
  ['02739211', '02739112'],
  ['02739221', '02739112'],
  ['02739222', '02739112'],
  ['02739231', '02739112'],
  ['02739232', '02739231'],
  ['02739241', '02739112'],
  ['02739242', '02739113'],
  ['02739243', '02739112'],
  ['02739244', '02739112'],
  ['02739321', '02739221'],
  ['02739322', '02739221'],
  ['02739323', '02739221'],
  ['02739324', '02739221'],
  ['02739325', '02739112'],
  ['02739341', '02739112'],
  ['02739342', '02739241'],
  ['02739346', '02739112'],
  ['02739421', '02739112'],
  ['02739422', '02739112'],
  ['02739431', '02739161'],
  ['02739432', '02739112'],
  ['02739441', '02739351'],
  ['02739442', '02739221'],
  ['02739443', '02739112'],
  ['02739444', '02739112'],
  ['02739445', '02739112'],
  ['02739446', '02739113'],
  ['02739447', '02739113'],
  ['02739448', '02739351'],
];

const APPLY = process.argv.includes('--apply');

async function main() {
  assertSeedAllowed('prisma/import-ict-2569.ts');
  console.log(`Mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY RUN (no writes)'}`);

  // Resolved read-only, even in dry run, so the target curriculum is
  // confirmed before anything else — 35 course codes are shared with
  // ICT 2564, so every course/prerequisite lookup below must be scoped
  // to this curriculumId, never to code alone.
  const program = await prisma.program.findFirstOrThrow({ where: { code: PROGRAM_CODE } });
  const curriculum = await prisma.curriculum.findFirstOrThrow({
    where: { programId: program.id, version: CURRICULUM_VERSION, isActive: true },
  });
  console.log(`Curriculum: ${program.code} ${curriculum.version} (curriculumId=${curriculum.id})`);

  console.log('Prerequisite direction preview (first 3 pairs, code-level):');
  for (const [courseCode, prereqCode] of PREREQUISITES.slice(0, 3)) {
    console.log(`  [curriculumId=${curriculum.id}] ${courseCode} ต้องผ่าน ${prereqCode} ก่อน`);
  }
  console.log(
    `Totals: ${CATEGORIES.length} categories, ${COURSES.length} courses ` +
      `(${COURSES.filter((c) => c.isRequired).length} required, ` +
      `${COURSES.filter((c) => !c.isRequired).length} elective), ` +
      `${PREREQUISITES.length} prerequisites`,
  );

  if (!APPLY) {
    console.log('Dry run only — rerun with --apply to write to the database.');
    return;
  }

  const categoryIdByName = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const category = await upsertActive({
      find: () =>
        prisma.courseCategory.findFirst({
          where: { curriculumId: curriculum.id, name: cat.name, isActive: true },
        }),
      update: (id) => prisma.courseCategory.update({ where: { id }, data: {} }),
      create: () =>
        prisma.courseCategory.create({
          data: { name: cat.name, curriculumId: curriculum.id },
        }),
    });
    categoryIdByName.set(cat.name, category.id);

    await prisma.curriculumRequirement.upsert({
      where: { categoryId: category.id },
      update: { minCredits: cat.minCredits },
      create: {
        minCredits: cat.minCredits,
        curriculumId: curriculum.id,
        categoryId: category.id,
      },
    });
    console.log(`  Category: ${cat.name} (minCredits=${cat.minCredits})`);
  }

  // Every course upsert below is keyed on the compound (curriculumId, code)
  // unique constraint, and courseIdByCode is populated only from these
  // results — so a shared code from ICT 2564 can never leak in here.
  const courseIdByCode = new Map<string, string>();
  for (const c of COURSES) {
    const categoryId = categoryIdByName.get(c.category);
    if (!categoryId) {
      throw new Error(`Unknown category "${c.category}" for course ${c.code}`);
    }
    const course = await upsertActive({
      find: () =>
        prisma.course.findFirst({
          where: { curriculumId: curriculum.id, code: c.code, isActive: true },
        }),
      update: (id) =>
        prisma.course.update({
          where: { id },
          data: {
          name: c.name,
          nameEn: c.nameEn,
          credits: c.credits,
          isRequired: c.isRequired,
          categoryId,
          },
        }),
      create: () =>
        prisma.course.create({
          data: {
          code: c.code,
          name: c.name,
          nameEn: c.nameEn,
          credits: c.credits,
          isRequired: c.isRequired,
          curriculumId: curriculum.id,
          categoryId,
          },
        }),
    });
    courseIdByCode.set(c.code, course.id);
    console.log(`    Course: ${c.code} ${c.name} (curriculumId=${course.curriculumId})`);
  }

  console.log('Prerequisite direction preview (first 3 pairs, resolved):');
  for (const [courseCode, prereqCode] of PREREQUISITES.slice(0, 3)) {
    const courseId = courseIdByCode.get(courseCode)!;
    const prerequisiteCourseId = courseIdByCode.get(prereqCode)!;
    console.log(
      `  ${courseCode} (id=${courseId}) ต้องผ่าน ${prereqCode} (id=${prerequisiteCourseId}) ก่อน ` +
        `[both scoped to curriculumId=${curriculum.id}]`,
    );
  }

  for (const [courseCode, prereqCode] of PREREQUISITES) {
    const courseId = courseIdByCode.get(courseCode);
    const prerequisiteCourseId = courseIdByCode.get(prereqCode);
    if (!courseId || !prerequisiteCourseId) {
      throw new Error(`Unresolved prerequisite pair ${courseCode} <- ${prereqCode}`);
    }
    await prisma.prerequisite.upsert({
      where: { courseId_prerequisiteCourseId: { courseId, prerequisiteCourseId } },
      update: {},
      create: { courseId, prerequisiteCourseId },
    });
    console.log(`      Prerequisite: ${courseCode} <- ${prereqCode}`);
  }

  console.log('ICT 2569 import complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
