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

// ---- all of an instructor's courses: one bar per PLO ----

export const COURSE_COLOR_COUNT = 6;

export interface PloStackSegment {
  courseId: string;
  courseCode: string;
  courseName: string;
  weight: number;
  colorIndex: number;
}

export interface PloStackRow {
  ploId: string;
  code: string;
  name: string;
  total: number;
  segments: PloStackSegment[];
}

export interface PloStackLegendItem {
  courseId: string;
  code: string;
  name: string;
  colorIndex: number;
}

export interface PloStack {
  rows: PloStackRow[];
  legend: PloStackLegendItem[];
  maxTotal: number;
  // No course has any CLO mapped to any PLO.
  isEmpty: boolean;
}

// A PLO a course lists with no CLO mapped keeps its row with an empty bar, so
// "no course feeds this PLO" shows instead of the PLO going missing. Colours are
// handed out in course-code order and wrap after COURSE_COLOR_COUNT; the number
// inside each segment and the legend keep wrapped colours readable.
export function buildPloStack(courses: readonly InstructorCourseSummary[]): PloStack {
  const ordered = [...courses].sort((a, b) => naturalCode(a.code, b.code));
  const legend: PloStackLegendItem[] = [];
  const colorOf = new Map<string, number>();
  const rowsById = new Map<string, PloStackRow>();
  for (const course of ordered) {
    for (const plo of course.plos) {
      const row = rowsById.get(plo.ploId) ?? {
        ploId: plo.ploId,
        code: plo.code,
        name: plo.name,
        total: 0,
        segments: [],
      };
      rowsById.set(plo.ploId, row);
      const weight = plo.cloBreakdown.reduce((s, b) => s + b.weight, 0);
      if (plo.cloBreakdown.length === 0 || weight <= 0) continue;
      if (!colorOf.has(course.courseId)) {
        const colorIndex = legend.length % COURSE_COLOR_COUNT;
        colorOf.set(course.courseId, colorIndex);
        legend.push({
          courseId: course.courseId,
          code: course.code,
          name: course.name,
          colorIndex,
        });
      }
      row.segments.push({
        courseId: course.courseId,
        courseCode: course.code,
        courseName: course.name,
        weight,
        colorIndex: colorOf.get(course.courseId) ?? 0,
      });
      row.total += weight;
    }
  }
  const rows = [...rowsById.values()].sort(
    (a, b) => comparePloCode(a.code, b.code) || naturalCode(a.name, b.name),
  );
  return {
    rows,
    legend,
    maxTotal: Math.max(0, ...rows.map((r) => r.total)),
    isEmpty: legend.length === 0,
  };
}
