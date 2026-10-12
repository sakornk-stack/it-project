import { PrismaClient } from '@prisma/client';

import { upsertActive } from './upsert-active';

const prisma = new PrismaClient();

// PROJECT_CONTEXT.md §20 — the 6 PLOs are real, taken verbatim from the
// document. Everything below that (CLO description text, CLO→PLO weight)
// is SAMPLE/DEMO data authored for this project, not real CLOs approved by
// the ICT curriculum committee — Course.description is NULL for every
// course in the DB (Phase 4 import never carried it), so there was no
// source document to derive CLOs from. Only a deliberately-scoped subset
// of required courses (12 per curriculum, spanning all 5 core categories)
// gets CLOs — see TODO.md for the remaining courses still without CLOs.
const PLOS = [
  {
    code: 'PLO1',
    name: 'บูรณาการความรู้ทางไอที',
    description: 'ประยุกต์ใช้แนวคิด ทฤษฎี หลักการทางเทคโนโลยีสารสนเทศแก้ปัญหาได้',
  },
  {
    code: 'PLO2',
    name: 'การพัฒนาและออกแบบระบบ',
    description: 'ออกแบบ พัฒนา ประเมินระบบงาน/ซอฟต์แวร์ที่ตอบสนองผู้ใช้งาน',
  },
  {
    code: 'PLO3',
    name: 'การจัดการข้อมูล',
    description: 'จัดการวิเคราะห์ข้อมูลเพื่อเพิ่มประสิทธิภาพการตัดสินใจ/สืบค้นสารสนเทศ',
  },
  {
    code: 'PLO4',
    name: 'การใช้เทคโนโลยีสมัยใหม่',
    description: 'เลือกใช้เครื่องมือ/เทคโนโลยีดิจิทัลทันสมัยอย่างเหมาะสม',
  },
  {
    code: 'PLO5',
    name: 'การทำงานเป็นทีมและการสื่อสาร',
    description: 'สื่อสารข้อมูลวิชาการ/วิชาชีพอย่างมีประสิทธิภาพ ทำงานร่วมกันได้',
  },
  {
    code: 'PLO6',
    name: 'จริยธรรมวิชาชีพ',
    description: 'จรรยาบรรณวิชาชีพไอที ความรับผิดชอบต่อสังคม ตระหนักผลกระทบดิจิทัล',
  },
];

interface CloMappingSeed {
  ploCode: string;
  weight: number;
}

interface CloSeed {
  code: string;
  description: string;
  mappings: CloMappingSeed[];
}

interface CourseCloSeed {
  courseCode: string;
  clos: CloSeed[];
}

// Shared across both curricula — course codes that are identical in name
// and content between 2564/2569 reuse the exact same CLO text; the two
// curricula's own course-code differences (e.g. 02739211 vs 02739113 for
// "Computer Programming") are handled by giving each curriculum its own
// full course list below rather than trying to force a single shared map.
const COMPUTER_INFO_SYSTEM_CLOS: CloSeed[] = [
  {
    code: 'CLO1',
    description: 'อธิบายองค์ประกอบและหลักการทำงานของระบบคอมพิวเตอร์และระบบสารสนเทศได้',
    mappings: [{ ploCode: 'PLO1', weight: 4 }],
  },
  {
    code: 'CLO2',
    description: 'ประยุกต์ใช้แนวคิดพื้นฐานด้านเทคโนโลยีสารสนเทศในการแก้ปัญหาเบื้องต้นได้',
    mappings: [
      { ploCode: 'PLO1', weight: 3 },
      { ploCode: 'PLO4', weight: 3 },
    ],
  },
];

const MATH_STATS_CLOS: CloSeed[] = [
  {
    code: 'CLO1',
    description: 'ประยุกต์ใช้หลักคณิตศาสตร์และสถิติพื้นฐานในการวิเคราะห์ข้อมูลทางเทคโนโลยีสารสนเทศได้',
    mappings: [{ ploCode: 'PLO3', weight: 4 }],
  },
  {
    code: 'CLO2',
    description: 'คำนวณและตีความผลลัพธ์ทางสถิติเพื่อสนับสนุนการตัดสินใจได้',
    mappings: [
      { ploCode: 'PLO3', weight: 3 },
      { ploCode: 'PLO1', weight: 2 },
    ],
  },
];

const DATABASE_SYSTEM_CLOS: CloSeed[] = [
  {
    code: 'CLO1',
    description: 'ออกแบบฐานข้อมูลเชิงสัมพันธ์ตามหลัก normalization ได้อย่างเหมาะสม',
    mappings: [
      { ploCode: 'PLO2', weight: 4 },
      { ploCode: 'PLO3', weight: 3 },
    ],
  },
  {
    code: 'CLO2',
    description: 'เขียนคำสั่ง SQL เพื่อจัดการและสืบค้นข้อมูลในฐานข้อมูลได้',
    mappings: [{ ploCode: 'PLO3', weight: 4 }],
  },
];

const ISAD_CLOS: CloSeed[] = [
  {
    code: 'CLO1',
    description: 'วิเคราะห์ความต้องการของระบบสารสนเทศจากผู้ใช้งานได้อย่างเป็นระบบ',
    mappings: [{ ploCode: 'PLO2', weight: 5 }],
  },
  {
    code: 'CLO2',
    description: 'ออกแบบแบบจำลองระบบสารสนเทศ (เช่น Use Case, ER Diagram) ที่ตอบสนองความต้องการผู้ใช้ได้',
    mappings: [
      { ploCode: 'PLO2', weight: 4 },
      { ploCode: 'PLO5', weight: 2 },
    ],
  },
];

const AI_CLOS: CloSeed[] = [
  {
    code: 'CLO1',
    description: 'อธิบายแนวคิดและเทคนิคพื้นฐานของปัญญาประดิษฐ์และการเรียนรู้ของเครื่องได้',
    mappings: [{ ploCode: 'PLO4', weight: 4 }],
  },
  {
    code: 'CLO2',
    description: 'ประยุกต์ใช้เครื่องมือ AI เบื้องต้นในการแก้ปัญหาที่กำหนดได้',
    mappings: [
      { ploCode: 'PLO4', weight: 3 },
      { ploCode: 'PLO1', weight: 2 },
    ],
  },
];

const IT_PROJECT_CLOS: CloSeed[] = [
  {
    code: 'CLO1',
    description:
      'วางแผนและดำเนินโครงงานทางเทคโนโลยีสารสนเทศตั้งแต่วิเคราะห์ปัญหาจนถึงนำเสนอผลงานได้อย่างเป็นระบบ',
    mappings: [
      { ploCode: 'PLO1', weight: 5 },
      { ploCode: 'PLO2', weight: 4 },
    ],
  },
  {
    code: 'CLO2',
    description: 'ประยุกต์ใช้เครื่องมือ/เทคโนโลยีที่เหมาะสมกับลักษณะโครงงานของตนเองได้',
    mappings: [{ ploCode: 'PLO4', weight: 4 }],
  },
  {
    code: 'CLO3',
    description: 'นำเสนอผลงานและทำงานร่วมกับทีม/ที่ปรึกษาโครงงานได้อย่างมีจรรยาบรรณและมีประสิทธิภาพ',
    mappings: [
      { ploCode: 'PLO5', weight: 5 },
      { ploCode: 'PLO6', weight: 3 },
    ],
  },
];

const PRINCIPLES_OF_PROGRAMMING_CLOS: CloSeed[] = [
  {
    code: 'CLO1',
    description: 'อธิบายหลักการพื้นฐานของการเขียนโปรแกรมเชิงโครงสร้าง (ตัวแปร เงื่อนไข การวนซ้ำ ฟังก์ชัน) ได้ถูกต้อง',
    mappings: [{ ploCode: 'PLO1', weight: 4 }],
  },
  {
    code: 'CLO2',
    description: 'เขียนโปรแกรมคอมพิวเตอร์เพื่อแก้ปัญหาโจทย์ที่กำหนดโดยใช้หลักการเขียนโปรแกรมพื้นฐานได้',
    mappings: [
      { ploCode: 'PLO1', weight: 3 },
      { ploCode: 'PLO2', weight: 3 },
    ],
  },
];

const COMPUTER_PROGRAMMING_CLOS: CloSeed[] = [
  {
    code: 'CLO1',
    description:
      'เขียนโปรแกรมคอมพิวเตอร์ที่มีโครงสร้างซับซ้อนขึ้น (อาเรย์ ฟังก์ชัน การจัดการข้อผิดพลาด) ได้ถูกต้อง',
    mappings: [
      { ploCode: 'PLO1', weight: 3 },
      { ploCode: 'PLO2', weight: 3 },
    ],
  },
  {
    code: 'CLO2',
    description: 'ทดสอบและแก้ไขข้อผิดพลาด (debug) ของโปรแกรมที่เขียนขึ้นได้อย่างเป็นระบบ',
    mappings: [{ ploCode: 'PLO2', weight: 3 }],
  },
];

const SOFTWARE_ENGINEERING_CLOS: CloSeed[] = [
  {
    code: 'CLO1',
    description: 'อธิบายวงจรการพัฒนาซอฟต์แวร์ (SDLC) และเลือกใช้ระเบียบวิธีพัฒนาที่เหมาะสมกับโครงการได้',
    mappings: [{ ploCode: 'PLO2', weight: 5 }],
  },
  {
    code: 'CLO2',
    description: 'ทำงานร่วมกับทีมในการพัฒนาซอฟต์แวร์ตามบทบาทที่ได้รับมอบหมายได้อย่างมีประสิทธิภาพ',
    mappings: [{ ploCode: 'PLO5', weight: 4 }],
  },
  {
    code: 'CLO3',
    description: 'จัดทำเอกสารและปฏิบัติตามมาตรฐาน/จรรยาบรรณวิชาชีพในการพัฒนาซอฟต์แวร์ได้',
    mappings: [
      { ploCode: 'PLO6', weight: 3 },
      { ploCode: 'PLO2', weight: 2 },
    ],
  },
];

const OS_CLOS: CloSeed[] = [
  {
    code: 'CLO1',
    description: 'อธิบายหลักการทำงานของระบบปฏิบัติการ (process, memory, file system) ได้ถูกต้อง',
    mappings: [{ ploCode: 'PLO4', weight: 4 }],
  },
  {
    code: 'CLO2',
    description: 'กำหนดค่าและจัดการระบบปฏิบัติการเพื่อสนับสนุนการทำงานของซอฟต์แวร์ระบบได้',
    mappings: [
      { ploCode: 'PLO4', weight: 3 },
      { ploCode: 'PLO1', weight: 2 },
    ],
  },
];

const PROJECT_MANAGEMENT_CLOS: CloSeed[] = [
  {
    code: 'CLO1',
    description: 'อธิบายหลักการและเครื่องมือบริหารโครงการ (ขอบเขต เวลา งบประมาณ) ได้ถูกต้อง',
    mappings: [
      { ploCode: 'PLO1', weight: 3 },
      { ploCode: 'PLO5', weight: 2 },
    ],
  },
  {
    code: 'CLO2',
    description: 'วางแผนและติดตามความคืบหน้าของโครงการทางเทคโนโลยีสารสนเทศได้อย่างเป็นระบบ',
    mappings: [
      { ploCode: 'PLO5', weight: 4 },
      { ploCode: 'PLO1', weight: 2 },
    ],
  },
];

const DIGITAL_TRANSFORMATION_CLOS: CloSeed[] = [
  {
    code: 'CLO1',
    description: 'อธิบายแนวคิดการแปรรูปองค์กรด้วยเทคโนโลยีดิจิทัล (Digital Transformation) ได้',
    mappings: [
      { ploCode: 'PLO4', weight: 4 },
      { ploCode: 'PLO1', weight: 2 },
    ],
  },
  {
    code: 'CLO2',
    description: 'เสนอแนวทางประยุกต์ใช้นวัตกรรมดิจิทัลเพื่อแก้ปัญหาทางธุรกิจ/องค์กรได้',
    mappings: [
      { ploCode: 'PLO4', weight: 3 },
      { ploCode: 'PLO2', weight: 2 },
    ],
  },
];

const IT_MANAGEMENT_CLOS: CloSeed[] = [
  {
    code: 'CLO1',
    description: 'อธิบายหลักการบริหารจัดการทรัพยากรเทคโนโลยีสารสนเทศในองค์กรได้',
    mappings: [
      { ploCode: 'PLO1', weight: 3 },
      { ploCode: 'PLO4', weight: 3 },
    ],
  },
  {
    code: 'CLO2',
    description: 'ประเมินความเสี่ยงและวางแผนกลยุทธ์ด้าน IT ให้สอดคล้องกับเป้าหมายองค์กรได้',
    mappings: [
      { ploCode: 'PLO1', weight: 4 },
      { ploCode: 'PLO6', weight: 2 },
    ],
  },
];

const INTERNET_TECHNOLOGY_CLOS: CloSeed[] = [
  {
    code: 'CLO1',
    description: 'อธิบายสถาปัตยกรรมและโปรโตคอลพื้นฐานของเครือข่ายอินเทอร์เน็ตได้',
    mappings: [{ ploCode: 'PLO4', weight: 4 }],
  },
  {
    code: 'CLO2',
    description: 'พัฒนาและประยุกต์ใช้เทคโนโลยีเว็บ/อินเทอร์เน็ตเพื่อสร้างบริการที่ใช้งานได้จริง',
    mappings: [
      { ploCode: 'PLO4', weight: 3 },
      { ploCode: 'PLO2', weight: 2 },
    ],
  },
];

const COMPUTER_ARCHITECTURE_OS_CLOS: CloSeed[] = [
  {
    code: 'CLO1',
    description: 'อธิบายสถาปัตยกรรมคอมพิวเตอร์และการทำงานร่วมกันระหว่างฮาร์ดแวร์และระบบปฏิบัติการได้',
    mappings: [{ ploCode: 'PLO4', weight: 4 }],
  },
  {
    code: 'CLO2',
    description: 'วิเคราะห์ประสิทธิภาพของระบบคอมพิวเตอร์และเสนอแนวทางปรับปรุงได้',
    mappings: [
      { ploCode: 'PLO4', weight: 3 },
      { ploCode: 'PLO1', weight: 2 },
    ],
  },
];

const CURRICULUM_2564_COURSES: CourseCloSeed[] = [
  { courseCode: '02739111', clos: COMPUTER_INFO_SYSTEM_CLOS },
  { courseCode: '02739161', clos: MATH_STATS_CLOS },
  { courseCode: '02739221', clos: DATABASE_SYSTEM_CLOS },
  { courseCode: '02739322', clos: ISAD_CLOS },
  { courseCode: '02739353', clos: IT_MANAGEMENT_CLOS },
  { courseCode: '02739241', clos: INTERNET_TECHNOLOGY_CLOS },
  { courseCode: '02739341', clos: AI_CLOS },
  { courseCode: '02739499', clos: IT_PROJECT_CLOS },
  { courseCode: '02739112', clos: PRINCIPLES_OF_PROGRAMMING_CLOS },
  { courseCode: '02739211', clos: COMPUTER_PROGRAMMING_CLOS },
  { courseCode: '02739321', clos: SOFTWARE_ENGINEERING_CLOS },
  { courseCode: '02739331', clos: OS_CLOS },
];

const CURRICULUM_2569_COURSES: CourseCloSeed[] = [
  { courseCode: '02739111', clos: COMPUTER_INFO_SYSTEM_CLOS },
  { courseCode: '02739161', clos: MATH_STATS_CLOS },
  { courseCode: '02739221', clos: DATABASE_SYSTEM_CLOS },
  { courseCode: '02739322', clos: ISAD_CLOS },
  { courseCode: '02739343', clos: PROJECT_MANAGEMENT_CLOS },
  { courseCode: '02739141', clos: DIGITAL_TRANSFORMATION_CLOS },
  { courseCode: '02739244', clos: AI_CLOS },
  { courseCode: '02739499', clos: IT_PROJECT_CLOS },
  { courseCode: '02739112', clos: PRINCIPLES_OF_PROGRAMMING_CLOS },
  { courseCode: '02739113', clos: COMPUTER_PROGRAMMING_CLOS },
  { courseCode: '02739321', clos: SOFTWARE_ENGINEERING_CLOS },
  { courseCode: '02739232', clos: COMPUTER_ARCHITECTURE_OS_CLOS },
];

const CURRICULA = [
  { id: 'bc550250-7144-4518-b3ee-5ac072e09f5d', label: 'ICT 2564', courses: CURRICULUM_2564_COURSES },
  { id: '013cf004-c252-4ccb-9254-c661a437311f', label: 'ICT 2569', courses: CURRICULUM_2569_COURSES },
];

type CurriculumSeed = (typeof CURRICULA)[number];
type SeededCourse = { id: string; code: string; name: string };
type SeededClo = { id: string; code: string };

// Every write below goes through upsertActive (or a natural-key upsert),
// and each step is awaited in sequence rather than batched with
// Promise.all — upsertActive is a read-then-write with no surrounding
// transaction, so concurrent calls for the same natural key would race.

async function seedPlos(curriculumId: string): Promise<Map<string, string>> {
  const ploIdByCode = new Map<string, string>();
  for (const plo of PLOS) {
    const created = await upsertActive({
      find: () =>
        prisma.plo.findFirst({
          where: { curriculumId, code: plo.code, isActive: true },
        }),
      update: (id) =>
        prisma.plo.update({
          where: { id },
          data: { name: plo.name, description: plo.description },
        }),
      create: () =>
        prisma.plo.create({
          data: { curriculumId, code: plo.code, name: plo.name, description: plo.description },
        }),
    });
    ploIdByCode.set(plo.code, created.id);
    console.log(`  PLO ${created.code}: ${created.name}`);
  }
  return ploIdByCode;
}

async function seedCloPloMappings(
  clo: SeededClo,
  course: SeededCourse,
  mappings: CloMappingSeed[],
  ploIdByCode: Map<string, string>,
) {
  for (const mapping of mappings) {
    const ploId = ploIdByCode.get(mapping.ploCode);
    if (!ploId) {
      console.warn(`  !! Unknown PLO code ${mapping.ploCode} referenced by ${course.code}/${clo.code}`);
      continue;
    }
    await prisma.cloPloMapping.upsert({
      where: { cloId_ploId: { cloId: clo.id, ploId } },
      update: { weight: mapping.weight, isActive: true },
      create: { cloId: clo.id, ploId, weight: mapping.weight },
    });
  }
}

async function seedCourseClos(
  course: SeededCourse,
  cloSeeds: CloSeed[],
  ploIdByCode: Map<string, string>,
) {
  for (const cloSeed of cloSeeds) {
    const clo = await upsertActive({
      find: () =>
        prisma.clo.findFirst({
          where: { courseId: course.id, code: cloSeed.code, isActive: true },
        }),
      update: (id) =>
        prisma.clo.update({
          where: { id },
          data: { description: cloSeed.description },
        }),
      create: () =>
        prisma.clo.create({
          data: { courseId: course.id, code: cloSeed.code, description: cloSeed.description },
        }),
    });

    await seedCloPloMappings(clo, course, cloSeed.mappings, ploIdByCode);
  }
}

async function seedCurriculum(cur: CurriculumSeed) {
  console.log(`\n=== ${cur.label} (${cur.id}) ===`);

  const ploIdByCode = await seedPlos(cur.id);

  for (const courseSeed of cur.courses) {
    const course = await prisma.course.findFirst({
      where: { curriculumId: cur.id, code: courseSeed.courseCode, isActive: true },
    });
    if (!course) {
      console.warn(`  !! Course ${courseSeed.courseCode} not found in ${cur.label} — skipped`);
      continue;
    }

    await seedCourseClos(course, courseSeed.clos, ploIdByCode);
    console.log(`  Course ${course.code} ${course.name}: ${courseSeed.clos.length} CLO(s)`);
  }
}

async function main() {
  // The real ICT 2569 PLO/CLO/mapping data is imported by import-ict-clo-plo.ts.
  // This script writes SAMPLE data and would overwrite those rows, so it
  // refuses to run unless the caller explicitly asks for the sample data.
  if (!process.argv.includes('--allow-sample')) {
    console.error(
      'seed-plo-clo.ts writes SAMPLE PLO/CLO data and would overwrite the real ICT 2569 ' +
        'curriculum data imported by import-ict-clo-plo.ts.\n' +
        'Refusing to run. If you really want the sample data, use ' +
        '"npm run prisma:seed:plo-clo:sample" (passes --allow-sample).',
    );
    process.exitCode = 1;
    return;
  }
  for (const cur of CURRICULA) {
    await seedCurriculum(cur);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
