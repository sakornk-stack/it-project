import * as fs from 'fs';
import * as path from 'path';

import { Prisma, PrismaClient } from '@prisma/client';

import { assertSeedAllowed } from '../src/common/util/seed-guard';

import { GroupPlan, parseGroupCsv, planGroupSync } from './career-group-import';
import { parseCsv } from './csv-util';

const prisma = new PrismaClient();

// Puts careers into broad groups (CareerGroup, Career.groupId) and sets group and career
// descriptions from a CSV in the git-ignored prisma/private-data/ folder. Run it AFTER
// import-career-courses.ts: the careers must already exist (it never creates a career and
// never touches career_courses). Groups are created or updated by name; a career's group,
// sortOrder (= row position in the file) and description are updated. Prints only counts
// and group/career names, never description text.
//
//   ts-node prisma/import-career-groups.ts                              # dry run (default)
//   ts-node prisma/import-career-groups.ts --apply                      # one transaction, idempotent
//   ts-node prisma/import-career-groups.ts --file=PATH                  # default private-data/career-groups.csv
//   ts-node prisma/import-career-groups.ts --overwrite-descriptions     # also replace a different non-empty description already in the DB
//
// CSV columns: group, group_description (optional), career, description (optional).
// One row per career, in display order; the group order is the order of first appearance.
// A description already in the DB that differs from the file is kept and reported, because
// it may have been edited by hand.
const APPLY = process.argv.includes('--apply');
const OVERWRITE = process.argv.includes('--overwrite-descriptions');
const argValues = (name: string) =>
  process.argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const FILE = argValues('file')[0] ?? path.join(__dirname, 'private-data', 'career-groups.csv');

type Db = PrismaClient | Prisma.TransactionClient;

async function load(db: Db) {
  const groups = await db.careerGroup.findMany({
    where: { isActive: true },
    select: { id: true, name: true, description: true, sortOrder: true },
  });
  const careers = await db.career.findMany({
    where: { isActive: true },
    select: { id: true, name: true, description: true, sortOrder: true, groupId: true },
  });
  return { groups, careers };
}

async function write(db: Db, plan: GroupPlan) {
  const groupIdByName = new Map<string, string>();
  for (const g of plan.groups) {
    if (g.existing) {
      groupIdByName.set(g.name, g.existing.id);
      if (g.action === 'update') {
        await db.careerGroup.update({ where: { id: g.existing.id }, data: g.data });
      }
    } else {
      const created = await db.careerGroup.create({
        data: { name: g.name, sortOrder: g.sortOrder, description: g.data.description },
      });
      groupIdByName.set(g.name, created.id);
    }
  }
  for (const c of plan.careers) {
    if (c.action !== 'update' || !c.existing) continue;
    await db.career.update({
      where: { id: c.existing.id },
      data: { ...c.data, groupId: groupIdByName.get(c.groupName) },
    });
  }
}

const names = (items: string[]) => (items.length ? ` [${items.join(', ')}]` : '');

async function main() {
  assertSeedAllowed('prisma/import-career-groups.ts');
  console.log(`Mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY RUN (no writes)'}`);

  const { rows, errors } = parseGroupCsv(parseCsv(fs.readFileSync(FILE, 'utf8')));
  console.log(`Source: ${rows.length} แถว, error ${errors.length}`);
  for (const e of errors) console.log(`  ${e}`);
  if (errors.length) {
    console.log('มี error ในไฟล์ — หยุด ไม่เขียนอะไร');
    process.exitCode = 1;
    return;
  }

  const run = async (db: Db) => {
    const { groups, careers } = await load(db);
    const plan = planGroupSync(rows, groups, careers, { overwriteDescriptions: OVERWRITE });
    if (plan.errors.length) return plan; // nothing is written when a career is missing
    if (APPLY) await write(db, plan);
    return plan;
  };
  const plan = APPLY
    ? await prisma.$transaction((tx) => run(tx), { timeout: 60_000 })
    : await run(prisma);

  if (plan.errors.length) {
    const missing = plan.careers.filter((c) => c.action === 'missing').map((c) => c.name);
    for (const e of plan.errors) console.log(`  ${e}`);
    console.log(`ไม่พบสายอาชีพใน DB:${names(missing)}`);
    console.log('ต้องรัน import-career-courses.ts ก่อน — หยุด ไม่เขียนอะไร');
    process.exitCode = 1;
    return;
  }

  const count = (items: { action: string }[], action: string) =>
    items.filter((i) => i.action === action).length;
  const fmt = (items: { action: string }[]) =>
    `create ${count(items, 'create')} / update ${count(items, 'update')} / skip ${count(items, 'skip')}`;
  console.log(`กลุ่ม: ${fmt(plan.groups)}`);
  for (const g of plan.groups) console.log(`  [${g.action}] ${g.sortOrder}. ${g.name}`);
  console.log(`สาย: ${fmt(plan.careers)}`);
  for (const c of plan.careers) {
    const note = c.moved ? ' (ใส่/ย้ายกลุ่ม)' : '';
    console.log(`  [${c.action}] ${c.sortOrder}. ${c.groupName} / ${c.name}${note}`);
  }
  const kept = [
    ...plan.groups.filter((g) => g.descriptionKept).map((g) => `กลุ่ม ${g.name}`),
    ...plan.careers.filter((c) => c.descriptionKept).map((c) => c.name),
  ];
  console.log(
    `คำอธิบายใน DB ต่างจากไฟล์ (ไม่ทับ ใช้ --overwrite-descriptions ถ้าต้องการ): ${kept.length}${names(kept)}`,
  );
  if (!APPLY) console.log('Dry run only — rerun with --apply to write to the database.');
  else console.log('Career-group import complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
