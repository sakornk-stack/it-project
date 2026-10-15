import { PrismaClient } from '@prisma/client';

import { assertSeedAllowed } from '../src/common/util/seed-guard';

import { upsertActive } from './upsert-active';

const prisma = new PrismaClient();

// Creates PLO1-6 of the ICT 2564 curriculum, so a database built from scratch has
// the 2564 PLOs the CLO→PLO mappings point at. Must run after the curriculum and
// courses exist (seed.ts, import-ict-2564.ts) and before copy-ict-clo-plo-to-2564.ts.
//
//   ts-node prisma/seed-plo-2564.ts            # dry run (default)
//   ts-node prisma/seed-plo-2564.ts --apply    # one transaction, idempotent
//
// The PLO text below is carried over verbatim from the existing 2564 data; it has
// NOT yet been confirmed against the 2564 curriculum book. Only curriculum 2564 of
// program ICT is touched; it is looked up by program + version, never by id.
const APPLY = process.argv.includes('--apply');
const PROGRAM_CODE = 'ICT';
const CURRICULUM_VERSION = '2564';

interface PloSeed {
  code: string;
  name: string;
  description: string;
}

const PLOS: PloSeed[] = [
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

async function main() {
  assertSeedAllowed('prisma/seed-plo-2564.ts');
  console.log(`Mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY RUN (no writes)'}`);
  const program = await prisma.program.findFirstOrThrow({ where: { code: PROGRAM_CODE } });
  const curriculum = await prisma.curriculum.findFirstOrThrow({
    where: { programId: program.id, version: CURRICULUM_VERSION, isActive: true },
  });
  console.log(`Curriculum: ${PROGRAM_CODE} ${CURRICULUM_VERSION} (curriculumId=${curriculum.id})`);

  const tally = { create: 0, update: 0, skip: 0 };
  await prisma.$transaction(
    async (tx) => {
      for (const plo of PLOS) {
        const found = await tx.plo.findFirst({
          where: { curriculumId: curriculum.id, code: plo.code, isActive: true },
        });
        if (found && found.name === plo.name && found.description === plo.description) {
          tally.skip++;
          continue;
        }
        found ? tally.update++ : tally.create++;
        if (!APPLY) continue;
        await upsertActive({
          find: async () => found,
          update: (id) =>
            tx.plo.update({
              where: { id },
              data: { name: plo.name, description: plo.description },
            }),
          create: () =>
            tx.plo.create({
              data: {
                curriculumId: curriculum.id,
                code: plo.code,
                name: plo.name,
                description: plo.description,
              },
            }),
        });
      }
    },
    { timeout: 60_000 },
  );

  console.log(
    `PLO: create ${tally.create} / update ${tally.update} / skip ${tally.skip} (of ${PLOS.length})`,
  );
  if (!APPLY) console.log('Dry run only — rerun with --apply to write to the database.');
  else console.log('ICT 2564 PLO seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
