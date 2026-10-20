// Pure parsing and planning for import-career-groups.ts (no database, no I/O) so the
// rules can be unit-tested by career-group-import.spec.ts.
//
// File format (one row per career, in display order):
//   group, group_description, career, description
// group_description and description are optional columns and may be empty. A group's
// position is where it first appears; a career's sortOrder is its row position.

export interface GroupRow {
  line: number; // 1-based CSV line, for error positions
  group: string;
  groupDescription: string | null;
  career: string;
  description: string | null;
}

export function parseGroupCsv(csv: string[][]): { rows: GroupRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: GroupRow[] = [];
  const header = (csv[0] ?? []).map((h) => h.trim());
  for (const col of ['group', 'career']) {
    if (!header.includes(col)) errors.push(`header: missing-column-${col}`);
  }
  if (errors.length) return { rows, errors };
  const idx = (c: string) => header.indexOf(c);
  const cell = (cells: string[], c: string) => (idx(c) >= 0 ? (cells[idx(c)] ?? '').trim() : '');

  const seenCareers = new Set<string>();
  const groupDescriptions = new Map<string, string>();
  csv.slice(1).forEach((cells, i) => {
    const line = i + 2;
    if (cells.every((c) => !c.trim())) return; // blank line
    const group = cell(cells, 'group');
    const career = cell(cells, 'career');
    const groupDescription = cell(cells, 'group_description') || null;
    const description = cell(cells, 'description') || null;
    if (!group) errors.push(`line ${line}: empty-group`);
    if (!career) errors.push(`line ${line}: empty-career`);
    if (career) {
      if (seenCareers.has(career)) errors.push(`line ${line}: duplicate-career`);
      seenCareers.add(career);
    }
    if (group && groupDescription) {
      const earlier = groupDescriptions.get(group);
      if (earlier !== undefined && earlier !== groupDescription) {
        errors.push(`line ${line}: group-description-conflict`);
      }
      groupDescriptions.set(group, earlier ?? groupDescription);
    }
    rows.push({ line, group, groupDescription, career, description });
  });
  if (rows.length === 0) errors.push('file: no-rows');
  return { rows, errors };
}

export interface DbGroup {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface DbCareer {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  groupId: string | null;
}

export interface GroupPlanItem {
  name: string;
  action: 'create' | 'update' | 'skip';
  existing: DbGroup | null;
  sortOrder: number;
  // Fields to write; description is absent when nothing should change.
  data: { sortOrder?: number; description?: string };
  // The DB already holds a different, non-empty description that is kept.
  descriptionKept: boolean;
}

export interface CareerPlanItem {
  name: string;
  groupName: string;
  action: 'update' | 'skip' | 'missing';
  existing: DbCareer | null;
  sortOrder: number;
  // The career is put into a group it is not in yet (new or different group).
  moved: boolean;
  data: { sortOrder?: number; description?: string };
  descriptionKept: boolean;
}

export interface GroupPlan {
  groups: GroupPlanItem[];
  careers: CareerPlanItem[];
  errors: string[];
}

// Decides what to write. An existing non-empty description that differs from the file is
// never overwritten unless `overwriteDescriptions` (it may have been edited by hand); the
// plan flags it so it is reported instead of silently ignored.
export function planGroupSync(
  rows: GroupRow[],
  dbGroups: DbGroup[],
  dbCareers: DbCareer[],
  options: { overwriteDescriptions?: boolean } = {},
): GroupPlan {
  const groupByName = new Map(dbGroups.map((g) => [g.name, g]));
  const careerByName = new Map(dbCareers.map((c) => [c.name, c]));
  const errors: string[] = [];

  const decideDescription = (desired: string | null, current: string | null | undefined) => {
    if (!desired || desired === current) return { set: undefined, kept: false };
    if (!current || options.overwriteDescriptions) return { set: desired, kept: false };
    return { set: undefined, kept: true };
  };

  const groups: GroupPlanItem[] = [];
  const groupOrder = new Map<string, number>();
  for (const row of rows) {
    if (groupOrder.has(row.group)) continue;
    const sortOrder = groupOrder.size;
    groupOrder.set(row.group, sortOrder);
    const existing = groupByName.get(row.group) ?? null;
    const desired = rows.find((r) => r.group === row.group && r.groupDescription)?.groupDescription;
    const d = decideDescription(desired ?? null, existing?.description);
    const data: GroupPlanItem['data'] = {};
    if (existing && existing.sortOrder !== sortOrder) data.sortOrder = sortOrder;
    if (d.set !== undefined) data.description = d.set;
    groups.push({
      name: row.group,
      action: !existing ? 'create' : Object.keys(data).length ? 'update' : 'skip',
      existing,
      sortOrder,
      data,
      descriptionKept: d.kept,
    });
  }

  const careers: CareerPlanItem[] = rows.map((row, sortOrder) => {
    const existing = careerByName.get(row.career) ?? null;
    if (!existing) {
      errors.push(`line ${row.line}: career-not-found`);
      return {
        name: row.career,
        groupName: row.group,
        action: 'missing',
        existing: null,
        sortOrder,
        moved: false,
        data: {},
        descriptionKept: false,
      };
    }
    const group = groupByName.get(row.group) ?? null;
    const moved = !group || existing.groupId !== group.id;
    const d = decideDescription(row.description, existing.description);
    const data: CareerPlanItem['data'] = {};
    if (existing.sortOrder !== sortOrder) data.sortOrder = sortOrder;
    if (d.set !== undefined) data.description = d.set;
    return {
      name: row.career,
      groupName: row.group,
      action: moved || Object.keys(data).length ? 'update' : 'skip',
      existing,
      sortOrder,
      moved,
      data,
      descriptionKept: d.kept,
    };
  });

  return { groups, careers, errors };
}
