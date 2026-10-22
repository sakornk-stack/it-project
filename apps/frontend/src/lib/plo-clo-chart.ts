import type { CoursePloEntry, InstructorCourseSummary } from '@eduanalyze-ai/shared-types';
import { comparePloCode } from './plo-order';

// Data for the two "which PLO does a course help" charts. Pure; it only regroups
// the CLO-to-PLO mapping and its weights (1 to 5) that the instructor already
// sees. No achievement figure goes in: a course has one share at B or above, so
// a bar per CLO or PLO would repeat it.

const naturalCode = (a: string, b: string) =>
  a.localeCompare(b, 'th', { numeric: true, sensitivity: 'base' });

export const NO_CLO_PLO_LINK_LABEL = 'ยังไม่ได้กำหนดการเชื่อม CLO กับ PLO';
export const CLO_PLO_CHART_NOTE =
  'กราฟนี้แสดงว่าวิชาช่วย PLO ไหน (ตามน้ำหนักที่กำหนดไว้) ไม่ใช่ผลการเรียนของนิสิต';

// ---- one course: CLO x PLO ----

export interface MatrixPlo {
  ploId: string;
  code: string;
  name: string;
  // Sum of the weights of this course's CLOs mapped to the PLO; 0 = not linked.
  total: number;
}

export interface MatrixClo {
  cloId: string;
  code: string;
  // One cell per column of `plos`; null = this CLO is not mapped to that PLO.
  cells: (number | null)[];
}

export interface CloPloMatrix {
  plos: MatrixPlo[];
  clos: MatrixClo[];
  // CLOs mapped to no PLO at all.
  unlinkedCloCodes: string[];
  // Nothing is mapped: show the "not set" message instead of a grid.
  isEmpty: boolean;
  // The PLOs with the highest total weight (all of them when tied), PLO order.
  topPlos: MatrixPlo[];
}

export function buildCloPloMatrix(
  clos: readonly { cloId: string; code: string }[],
  plos: readonly CoursePloEntry[],
): CloPloMatrix {
  const linkedPlos = [...plos]
    .filter((p) => p.cloBreakdown.length > 0)
    .sort((a, b) => comparePloCode(a.code, b.code) || naturalCode(a.name, b.name));
  const cloIds = new Set(clos.map((c) => c.cloId));
  const columns: MatrixPlo[] = linkedPlos.map((p) => ({
    ploId: p.ploId,
    code: p.code,
    name: p.name,
    // A weight for a CLO the course no longer lists is left out of the grid, so
    // the totals match what the grid shows.
    total: p.cloBreakdown.filter((b) => cloIds.has(b.cloId)).reduce((s, b) => s + b.weight, 0),
  }));
  const rows: MatrixClo[] = [...clos]
    .sort((a, b) => naturalCode(a.code, b.code))
    .map((clo) => ({
      cloId: clo.cloId,
      code: clo.code,
      cells: linkedPlos.map((p) => {
        const hit = p.cloBreakdown.find((b) => b.cloId === clo.cloId);
        return hit ? hit.weight : null;
      }),
    }));
  const unlinkedCloCodes = rows.filter((r) => r.cells.every((c) => c === null)).map((r) => r.code);
  const isEmpty = rows.length === 0 || rows.every((r) => r.cells.every((c) => c === null));
  const max = Math.max(0, ...columns.map((c) => c.total));
  return {
    plos: columns,
    clos: rows,
    unlinkedCloCodes,
    isEmpty,
    topPlos: max > 0 ? columns.filter((c) => c.total === max) : [],
  };
}

// "วิชานี้ช่วย PLO ใดมากที่สุด" as one sentence; null when nothing is mapped.
export function describeTopPlos(matrix: CloPloMatrix): string | null {
  if (matrix.isEmpty || matrix.topPlos.length === 0) return null;
  const total = matrix.topPlos[0].total;
  if (matrix.topPlos.length === matrix.plos.length && matrix.plos.length > 1) {
    return `วิชานี้ช่วยทุก PLO ที่เชื่อมไว้เท่า ๆ กัน (น้ำหนักรวม ${total} ต่อ PLO)`;
  }
  const names = matrix.topPlos.map((p) => p.code).join(', ');
  return `วิชานี้ช่วย ${names} มากที่สุด (น้ำหนักรวม ${total})`;
}

// ---- all of an instructor's courses: course x PLO ----

export interface CoursePloColumn {
  ploId: string;
  code: string;
  name: string;
}

export interface CoursePloCell {
  // Sum of the weights of the course's CLOs mapped to the PLO.
  total: number;
  // 1 to 5, for the colour: totals up to 5 map to themselves, a bigger total is
  // spread over the five steps relative to the largest one.
  level: 1 | 2 | 3 | 4 | 5;
}

export interface CoursePloRow {
  courseId: string;
  code: string;
  name: string;
  // One cell per column; null = no CLO of the course is mapped to that PLO.
  cells: (CoursePloCell | null)[];
}

export interface CoursePloMatrix {
  plos: CoursePloColumn[];
  rows: CoursePloRow[];
  // No CLO of any course is mapped to a PLO: show the "not set" message.
  isEmpty: boolean;
}

// Columns are the PLOs some course of the instructor has a CLO mapped to, PLO1 to
// PLOn; rows are the courses by code. Only the mapping and its weights: a course
// has one share at B or above, so a per-PLO result would repeat it.
export function buildCoursePloMatrix(courses: readonly InstructorCourseSummary[]): CoursePloMatrix {
  const columns = new Map<string, CoursePloColumn>();
  const totals = new Map<string, Map<string, number>>();
  for (const course of courses) {
    for (const plo of course.plos) {
      const weight = plo.cloBreakdown.reduce((s, b) => s + b.weight, 0);
      if (plo.cloBreakdown.length === 0 || !(weight > 0)) continue;
      columns.set(plo.ploId, { ploId: plo.ploId, code: plo.code, name: plo.name });
      const row = totals.get(course.courseId) ?? new Map<string, number>();
      row.set(plo.ploId, (row.get(plo.ploId) ?? 0) + weight);
      totals.set(course.courseId, row);
    }
  }
  const plos = [...columns.values()].sort(
    (a, b) => comparePloCode(a.code, b.code) || naturalCode(a.name, b.name),
  );
  let max = 0;
  for (const row of totals.values()) for (const t of row.values()) max = Math.max(max, t);
  const scale = Math.max(5, max);
  const rows = [...courses]
    .sort((a, b) => naturalCode(a.code, b.code))
    .map((course) => ({
      courseId: course.courseId,
      code: course.code,
      name: course.name,
      cells: plos.map((p): CoursePloCell | null => {
        const total = totals.get(course.courseId)?.get(p.ploId);
        if (total === undefined) return null;
        const level = Math.min(
          5,
          Math.max(1, Math.ceil((total / scale) * 5)),
        ) as CoursePloCell['level'];
        return { total, level };
      }),
    }));
  return { plos, rows, isEmpty: plos.length === 0 };
}
