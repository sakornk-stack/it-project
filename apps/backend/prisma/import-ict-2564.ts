import { PrismaClient } from '@prisma/client';

import { assertSeedAllowed } from '../src/common/util/seed-guard';

import { upsertActive } from './upsert-active';

const prisma = new PrismaClient();

const PROGRAM_CODE = 'ICT';
const CURRICULUM_VERSION = '2564';

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
  description?: string;
}

// PROJECT_CONTEXT.md course import — ICT 2564.
// Categories mirror the curriculum document's structure exactly; each
// doubles as its CurriculumRequirement (1:1 per schema). Sum of minCredits
// (126) matches Curriculum.totalCredits seeded earlier.
const CATEGORIES: CategorySeed[] = [
  { name: 'กลุ่มสาระอยู่ดีมีสุข', minCredits: 5 },
  { name: 'กลุ่มสาระศาสตร์แห่งผู้ประกอบการ', minCredits: 6 },
  { name: 'กลุ่มสาระภาษากับการสื่อสาร', minCredits: 13 },
  { name: 'กลุ่มสาระพลเมืองไทยและพลเมืองโลก', minCredits: 3 },
  { name: 'กลุ่มสาระสุนทรียศาสตร์', minCredits: 3 },
  { name: 'กลุ่มวิชาเฉพาะพื้นฐาน', minCredits: 12 },
  { name: 'กลุ่มประเด็นองค์การ', minCredits: 10 },
  { name: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์', minCredits: 29 },
  { name: 'กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์', minCredits: 18 },
  { name: 'กลุ่มโครงสร้างพื้นฐานของระบบ', minCredits: 6 },
  { name: 'วิชาเฉพาะเลือก', minCredits: 15 },
  { name: 'วิชาเลือกเสรี', minCredits: 6 },
];

// Gen-ed categories other than "กลุ่มสาระพลเมืองไทยและพลเมืองโลก" have no
// course codes in the source document — only category-level minCredits.
// 01175xxx (กิจกรรมพลศึกษา) is a wildcard code, not imported as a Course.
// 02721101/01417111 are out-of-department courses, imported with empty
// description since the source document has no course description for them.
const COURSES: CourseSeed[] = [
  // กลุ่มสาระพลเมืองไทยและพลเมืองโลก
  { code: '01999111', name: 'ศาสตร์แห่งแผ่นดิน', nameEn: 'Knowledge of the Land', credits: 2, isRequired: true, category: 'กลุ่มสาระพลเมืองไทยและพลเมืองโลก' },

  // กลุ่มวิชาเฉพาะพื้นฐาน
  { code: '01417111', name: 'แคลคูลัส I', nameEn: 'Calculus I', credits: 3, isRequired: true, category: 'กลุ่มวิชาเฉพาะพื้นฐาน', description: '' },
  { code: '02721101', name: 'ความรู้เบื้องต้นเกี่ยวกับธุรกิจ', nameEn: 'Introduction to Business', credits: 3, isRequired: true, category: 'กลุ่มวิชาเฉพาะพื้นฐาน', description: '' },
  { code: '02739111', name: 'คอมพิวเตอร์และระบบสารสนเทศ', nameEn: 'Computer and Information System', credits: 3, isRequired: true, category: 'กลุ่มวิชาเฉพาะพื้นฐาน' },
  { code: '02739161', name: 'คณิตศาสตร์และสถิติสำหรับเทคโนโลยีสารสนเทศ', nameEn: 'Mathematics and Statistics for Information Technology', credits: 3, isRequired: true, category: 'กลุ่มวิชาเฉพาะพื้นฐาน' },

  // กลุ่มประเด็นองค์การ
  { code: '02739221', name: 'ระบบฐานข้อมูล', nameEn: 'Database System', credits: 3, isRequired: true, category: 'กลุ่มประเด็นองค์การ' },
  { code: '02739322', name: 'การวิเคราะห์และออกแบบระบบสารสนเทศ', nameEn: 'Information System Analysis and Design', credits: 3, isRequired: true, category: 'กลุ่มประเด็นองค์การ' },
  { code: '02739327', name: 'ฐานข้อมูลภาคปฏิบัติการขั้นสูง', nameEn: 'Advanced Laboratory in Database', credits: 1, isRequired: true, category: 'กลุ่มประเด็นองค์การ' },
  { code: '02739353', name: 'การจัดการเทคโนโลยีสารสนเทศ', nameEn: 'Information Technology Management', credits: 3, isRequired: true, category: 'กลุ่มประเด็นองค์การ' },

  // กลุ่มเทคโนโลยีเพื่องานประยุกต์
  { code: '02739241', name: 'เทคโนโลยีอินเทอร์เน็ต', nameEn: 'Internet Technology', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },
  { code: '02739242', name: 'ความรู้เบื้องต้นเกี่ยวกับวิทยาการข้อมูล', nameEn: 'Introduction to Data Science', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },
  { code: '02739243', name: 'นวัตกรรมและการแปรรูปทางดิจิทัล', nameEn: 'Innovation and Digital Transformation', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },
  { code: '02739323', name: 'อันตรกิริยาระหว่างมนุษย์กับคอมพิวเตอร์', nameEn: 'Human-Computer Interaction', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },
  { code: '02739341', name: 'ปัญญาประดิษฐ์เบื้องต้น', nameEn: 'Introduction to Artificial Intelligence', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },
  { code: '02739351', name: 'การสื่อสารข้อมูลและเครือข่ายคอมพิวเตอร์', nameEn: 'Data Communication and Computer Network', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },
  { code: '02739352', name: 'การประกันและความมั่นคงสารสนเทศ', nameEn: 'Information Assurance and Security', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },
  { code: '02739354', name: 'การออกแบบและพัฒนาระบบอินเทอร์เน็ตของสรรพสิ่ง', nameEn: 'Design and Development for Internet of Things', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },
  { code: '02739391', name: 'ระเบียบวิธีวิจัยพื้นฐานทางเทคโนโลยีสารสนเทศ', nameEn: 'Basic Research Methods in Information Technology', credits: 1, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },
  { code: '02739397', name: 'สัมมนา', nameEn: 'Seminar', credits: 1, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },
  { code: '02739499', name: 'โครงงานทางด้านเทคโนโลยีสารสนเทศ', nameEn: 'Information Technology Project', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์' },

  // กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์
  { code: '02739112', name: 'หลักการเขียนโปรแกรม', nameEn: 'Principles of Programming', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์' },
  { code: '02739211', name: 'การเขียนโปรแกรมคอมพิวเตอร์', nameEn: 'Computer Programming', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์' },
  { code: '02739212', name: 'หลักการเขียนโปรแกรมเชิงวัตถุ', nameEn: 'Principles of Object Oriented Programming', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์' },
  { code: '02739231', name: 'โครงสร้างข้อมูล', nameEn: 'Data Structure', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์' },
  { code: '02739321', name: 'วิศวกรรมซอฟต์แวร์', nameEn: 'Software Engineering', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์' },
  { code: '02739342', name: 'การพัฒนาโปรแกรมประยุกต์สำหรับอุปกรณ์เคลื่อนที่', nameEn: 'Application Development for Mobile Devices', credits: 3, isRequired: true, category: 'กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์' },

  // กลุ่มโครงสร้างพื้นฐานของระบบ
  { code: '02739232', name: 'สถาปัตยกรรมระบบสารสนเทศเบื้องต้น', nameEn: 'Introduction to Information System Architecture', credits: 3, isRequired: true, category: 'กลุ่มโครงสร้างพื้นฐานของระบบ' },
  { code: '02739331', name: 'ระบบปฏิบัติการและซอฟต์แวร์ระบบ', nameEn: 'Operating System and System Software', credits: 3, isRequired: true, category: 'กลุ่มโครงสร้างพื้นฐานของระบบ' },

  // วิชาเฉพาะเลือก (elective — track selectors + shared elective pool)
  { code: '02739498', name: 'ปัญหาพิเศษ', nameEn: 'Special Problems', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739490', name: 'สหกิจศึกษา', nameEn: 'Cooperative Education', credits: 6, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739311', name: 'ระบบฝังตัวเบื้องต้น', nameEn: 'Introduction to Embedded Systems', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739312', name: 'การโปรแกรมบนอินเทอร์เน็ต', nameEn: 'Internet Programming', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739325', name: 'การประมวลผลสัญญาณและภาพดิจิทัล', nameEn: 'Digital Signal and Image Processing', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739326', name: 'การออกแบบกระบวนการทางธุรกิจและการพัฒนาระบบการวางแผนทรัพยากรองค์กร', nameEn: 'Business Process Design and Enterprise Resource Planning System Development', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739343', name: 'ภาพสามมิติและภาพเคลื่อนไหว', nameEn: 'Three-Dimensional Images and Animations', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739344', name: 'เทคโนโลยีสื่อผสม', nameEn: 'Multimedia Technology', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739345', name: 'คอมพิวเตอร์กราฟิกสำหรับงานสารสนเทศ', nameEn: 'Computer Graphic Applications for Information', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739421', name: 'การวิเคราะห์และออกแบบเชิงวัตถุ', nameEn: 'Object Oriented Analysis and Design', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739432', name: 'เทคโนโลยีเหมืองข้อมูลและการประยุกต์', nameEn: 'Data Mining Technologies and Applications', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739441', name: 'การประยุกต์ทางด้านวิทยาการข้อมูล', nameEn: 'Application of Data Science', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739451', name: 'การบริหารเครือข่าย', nameEn: 'Network Management', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739452', name: 'แพลตฟอร์มข้อมูลขนาดใหญ่และการวิเคราะห์', nameEn: 'Big Data Platform and Analytics', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
  { code: '02739496', name: 'เรื่องเฉพาะทางเทคโนโลยีสารสนเทศ', nameEn: 'Selected Topic in Information Technology', credits: 3, isRequired: false, category: 'วิชาเฉพาะเลือก' },
];

// [courseCode, prerequisiteCourseCode] — courseCode requires prerequisiteCourseCode.
// All AND (groupId: null); no OR-groups in this curriculum version.
const PREREQUISITES: [string, string][] = [
  ['02739112', '02739111'],
  ['02739211', '02739112'],
  ['02739212', '02739112'],
  ['02739221', '02739112'],
  ['02739231', '02739112'],
  ['02739241', '02739112'],
  ['02739242', '02739211'],
  ['02739311', '02739112'],
  ['02739312', '02739112'],
  ['02739321', '02739221'],
  ['02739322', '02739221'],
  ['02739323', '02739221'],
  ['02739325', '02739112'],
  ['02739327', '02739221'],
  ['02739331', '02739231'],
  ['02739341', '02739112'],
  ['02739342', '02739112'],
  ['02739345', '02739112'],
  ['02739352', '02739112'],
  ['02739421', '02739212'],
  ['02739432', '02739161'],
  ['02739441', '02739242'],
  ['02739451', '02739351'],
  ['02739452', '02739351'],
];

const APPLY = process.argv.includes('--apply');

async function main() {
  assertSeedAllowed('prisma/import-ict-2564.ts');
  console.log(`Mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY RUN (no writes)'}`);
  console.log('Prerequisite direction preview (first 3 pairs):');
  for (const [courseCode, prereqCode] of PREREQUISITES.slice(0, 3)) {
    console.log(`  ${courseCode} ต้องผ่าน ${prereqCode} ก่อน`);
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

  const program = await prisma.program.findFirstOrThrow({ where: { code: PROGRAM_CODE } });
  const curriculum = await prisma.curriculum.findFirstOrThrow({
    where: { programId: program.id, version: CURRICULUM_VERSION, isActive: true },
  });
  console.log(`Curriculum: ${program.code} ${curriculum.version} (${curriculum.id})`);

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
          description: c.description,
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
          description: c.description,
          curriculumId: curriculum.id,
          categoryId,
          },
        }),
    });
    courseIdByCode.set(c.code, course.id);
    console.log(`    Course: ${c.code} ${c.name}`);
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

  console.log('ICT 2564 import complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
