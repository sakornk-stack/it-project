import * as fs from 'fs';
import * as path from 'path';

import { Prisma, PrismaClient } from '@prisma/client';

import { assertSeedAllowed } from '../src/common/util/seed-guard';

import {
  categoryCreditWarnings,
  CategorySpec,
  deriveCategories,
  NOT_FOUND,
  parseCategoryRows,
  parseCourseRows,
  parseImportOptions,
  planCourseAction,
  planRequirementAction,
  resolveCourses,
} from './curriculum-course-import';
import { parseCsv } from './csv-util';

const prisma = new PrismaClient();

// Lite import of one curriculum's course list from a CSV in the git-ignored prisma/private-data/
// folder. Imports only code, Thai/English name, credits, category and required/elective. It does
// not touch prerequisites, recommended year/semester, descriptions, PLO or CLO, and it never
// deletes anything. The curriculum (program + version) must already exist.
//
//   ts-node prisma/import-curriculum-courses.ts --program=ACC --version=2564 --file=courses-acc-2564.csv
//       dry run (default): prints what would be created / updated / skipped, plus warnings
//   ... --apply                      # one transaction, idempotent
//   ... --categories-file=PATH       # name,minCredits[,csv_category[,default_is_required]]
//                                    #   without it, categories come from the CSV `category`
//                                    #   column and minCredits is the sum of their courses
//   ... --overwrite                  # also replace a different name/credits/minCredits that
//                                    #   already exists (default: report it and keep it)
//
// CSV columns used: code, nameTh, nameEn, credits, category, isRequired ("ไม่พบ" = not stated).
// A relative --file / --categories-file is looked up in private-data/ first.
const DATA_DIR = path.join(__dirname, 'private-data');
const OPTIONS = parseImportOptions(process.argv.slice(2));
const APPLY = OPTIONS.apply;

type Db = PrismaClient | Prisma.TransactionClient;

function resolvePath(p: string): string {
  if (path.isAbsolute(p)) return p;
  const inData = path.join(DATA_DIR, p);
  return fs.existsSync(inData) ? inData : path.resolve(p);
}

const fmt = (t: Record<string, number>) =>
  Object.entries(t)
    .map(([k, v]) => `${k} ${v}`)
    .join(' / ');
const list = (items: string[], max = 15) =>
  items.length === 0
    ? ''
    : `\n    ${items.slice(0, max).join('\n    ')}${items.length > max ? `\n    … อีก ${items.length - max}` : ''}`;

interface Report {
  categories: Record<string, number>;
  requirements: Record<string, number>;
  courses: Record<string, number>;
  conflicts: string[];
}

async function plan(
  db: Db,
  curriculumId: string,
  categories: CategorySpec[],
  courses: ReturnType<typeof resolveCourses>['resolved'],
  apply: boolean,
): Promise<Report> {
  const report: Report = {
    categories: { create: 0, skip: 0 },
    requirements: { create: 0, update: 0, skip: 0, conflict: 0 },
    courses: { create: 0, update: 0, skip: 0, conflict: 0 },
    conflicts: [],
  };

  const categoryIdByName = new Map<string, string>();
  for (const cat of categories) {
    const existing = await db.courseCategory.findFirst({
      where: { curriculumId, name: cat.name, isActive: true },
      include: { requirement: true },
    });
    report.categories[existing ? 'skip' : 'create']++;

    const reqAction = planRequirementAction(
      existing?.requirement?.minCredits ?? null,
      cat.minCredits,
      OPTIONS.overwrite,
    );
    report.requirements[reqAction]++;
    if (reqAction === 'conflict') {
      report.conflicts.push(
        `หมวด "${cat.name}": minCredits ใน DB ${existing?.requirement?.minCredits} ≠ ${cat.minCredits} (ไม่ทับ)`,
      );
    }
    if (!apply) {
      if (existing) categoryIdByName.set(cat.name, existing.id);
      continue;
    }
    const category =
      existing ?? (await db.courseCategory.create({ data: { name: cat.name, curriculumId } }));
    categoryIdByName.set(cat.name, category.id);
    if (reqAction === 'create' || reqAction === 'update') {
      await db.curriculumRequirement.upsert({
        where: { categoryId: category.id },
        update: { minCredits: cat.minCredits },
        create: { minCredits: cat.minCredits, curriculumId, categoryId: category.id },
      });
    }
  }

  for (const c of courses) {
    const existing = await db.course.findFirst({
      where: { curriculumId, code: c.code, isActive: true },
    });
    const { action, differences, fillNameEn } = planCourseAction(existing, c, OPTIONS.overwrite);
    report.courses[action]++;
    if (action === 'conflict') {
      report.conflicts.push(`วิชา ${c.code}: ${differences.join(', ')} (ไม่ทับ)`);
    }
    if (!apply || action === 'skip' || action === 'conflict') continue;

    const categoryId = categoryIdByName.get(c.categoryName)!;
    if (action === 'create') {
      await db.course.create({
        data: {
          code: c.code,
          name: c.name,
          nameEn: c.nameEn,
          credits: c.credits,
          isRequired: c.isRequiredResolved,
          curriculumId,
          categoryId,
        },
      });
    } else if (differences.length === 0 && fillNameEn) {
      await db.course.update({ where: { id: existing!.id }, data: { nameEn: c.nameEn } });
    } else {
      await db.course.update({
        where: { id: existing!.id },
        data: {
          name: c.name,
          credits: c.credits,
          isRequired: c.isRequiredResolved,
          categoryId,
          ...(c.nameEn ? { nameEn: c.nameEn } : {}),
        },
      });
    }
  }
  return report;
}

async function main() {
  assertSeedAllowed('prisma/import-curriculum-courses.ts');
  console.log(`Mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY RUN (no writes)'} / lite`);
  if (OPTIONS.errors.length) {
    for (const e of OPTIONS.errors) console.log(`  ${e}`);
    console.log('option ไม่ถูกต้อง — หยุด ไม่เขียนอะไร');
    process.exitCode = 1;
    return;
  }
  if (OPTIONS.overwrite)
    console.log('--overwrite: ชื่อ/หน่วยกิต/minCredits ที่ต่างจากไฟล์จะถูกทับ (ไม่ลบอะไร)');

  const warnings: string[] = [];
  const errors: string[] = [];

  const filePath = resolvePath(OPTIONS.file!);
  if (!fs.existsSync(filePath)) {
    console.log(`ไม่พบไฟล์ ${OPTIONS.file} — หยุด`);
    process.exitCode = 1;
    return;
  }
  const parsed = parseCourseRows(parseCsv(fs.readFileSync(filePath, 'utf-8')));
  errors.push(...parsed.errors);
  warnings.push(...parsed.warnings);

  let categories: CategorySpec[] = [];
  if (OPTIONS.categoriesFile) {
    const catPath = resolvePath(OPTIONS.categoriesFile);
    if (!fs.existsSync(catPath)) {
      console.log(`ไม่พบไฟล์หมวดวิชา ${OPTIONS.categoriesFile} — หยุด`);
      process.exitCode = 1;
      return;
    }
    const parsedCats = parseCategoryRows(parseCsv(fs.readFileSync(catPath, 'utf-8')));
    errors.push(...parsedCats.errors);
    categories = parsedCats.rows;
  } else {
    categories = deriveCategories(parsed.rows);
    warnings.push(
      'ไม่มี --categories-file: minCredits ของแต่ละหมวดเป็นค่าประมาณ (ผลรวมหน่วยกิตของวิชาในไฟล์) ไม่ใช่ตัวเลขตามเล่ม',
    );
  }

  const programs = await prisma.program.findMany({
    where: { code: OPTIONS.program!, isActive: true },
  });
  const program = programs.length === 1 ? programs[0] : null;
  if (!program) {
    errors.push(
      programs.length === 0
        ? `ไม่พบหลักสูตรสาขา (program) รหัส ${OPTIONS.program} ใน DB`
        : `รหัส program ${OPTIONS.program} ซ้ำ ${programs.length} แถว`,
    );
  }
  const curricula = program
    ? await prisma.curriculum.findMany({
        where: { programId: program.id, version: OPTIONS.version!, isActive: true },
      })
    : [];
  const curriculum = curricula.length === 1 ? curricula[0] : null;
  if (program && !curriculum) {
    errors.push(
      curricula.length === 0
        ? `ไม่พบหลักสูตร ${OPTIONS.program} version ${OPTIONS.version} ใน DB (สคริปต์นี้ไม่สร้างหลักสูตร)`
        : `หลักสูตร ${OPTIONS.program} version ${OPTIONS.version} ซ้ำ ${curricula.length} แถว`,
    );
  }

  if (errors.length) {
    console.log(`error ${errors.length}:`);
    for (const e of errors) console.log(`  ${e}`);
    console.log('มี error — หยุด ไม่เขียนอะไร');
    process.exitCode = 1;
    return;
  }
  const target = curriculum!;
  console.log(
    `Curriculum: ${OPTIONS.program} ${target.version} (id=${target.id}, totalCredits=${target.totalCredits})`,
  );

  const { resolved, unmapped } = resolveCourses(parsed.rows, categories);
  for (const c of unmapped) {
    warnings.push(
      `วิชา ${c.code} ${c.name}: หมวด "${c.category ?? NOT_FOUND}" ไม่อยู่ในรายการหมวดวิชา — ข้าม`,
    );
  }
  for (const c of resolved.filter((r) => r.isRequiredDefaulted)) {
    warnings.push(`วิชา ${c.code} ${c.name}: ไม่ระบุบังคับ/เลือก — ใช้ค่าเริ่มต้นของระบบ (บังคับ)`);
  }
  warnings.push(...categoryCreditWarnings(categories, resolved));
  const minSum = categories.reduce((s, c) => s + c.minCredits, 0);
  if (minSum !== target.totalCredits) {
    warnings.push(
      `ผลรวม minCredits ของหมวดทั้งหมด ${minSum} ≠ totalCredits ของหลักสูตรใน DB ${target.totalCredits}`,
    );
  }

  const report = APPLY
    ? await prisma.$transaction((tx) => plan(tx, target.id, categories, resolved, true), {
        timeout: 120_000,
      })
    : await plan(prisma, target.id, categories, resolved, false);

  console.log(`Source: ${parsed.rows.length} วิชา, ${categories.length} หมวด, error 0`);
  console.log(`หมวดวิชา: ${fmt(report.categories)}`);
  console.log(`ข้อกำหนดหน่วยกิตของหมวด (minCredits): ${fmt(report.requirements)}`);
  console.log(`วิชา: ${fmt(report.courses)} / ข้าม (หมวดไม่ตรง) ${unmapped.length}`);
  console.log(`ต่างจากที่มีใน DB (ไม่ทับ): ${report.conflicts.length}${list(report.conflicts)}`);
  console.log(`คำเตือน: ${warnings.length}${list(warnings, 30)}`);
  console.log(
    APPLY
      ? 'Curriculum course import complete.'
      : 'Dry run only — rerun with --apply to write to the database.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
