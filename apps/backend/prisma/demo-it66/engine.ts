// Pure generator for the DEMO-IT66 cohort (100 simulated ICT 2564 students who
// entered in 2566). No database, no I/O: seed-demo-it66.ts feeds it the live
// course catalog and writes what it returns, engine.spec.ts feeds it a fixture.
//
// The curriculum has NO recommended year/term data, so PLAN below is our own
// assumption (derived from course-code level, prerequisite depth and the
// 22-credit cap), not the university's official plan.

export type GradeCode = 'A' | 'B_PLUS' | 'B' | 'C_PLUS' | 'C' | 'D_PLUS' | 'D' | 'F';

export interface CatalogCourse {
  code: string;
  credits: number;
  isRequired: boolean;
  prereqs: string[];
}

export interface Slot {
  key: string; // e.g. "2566-FIRST"
  year: number;
  term: 'FIRST' | 'SECOND' | 'SUMMER';
  // 1..7 for the seven regular terms of the plan, null for summer
  regularTerm: number | null;
}

// Chronological, 2566/1 .. 2569/1 (2569/1 is the current term). Summers sit
// between academic years and are used only for retakes.
export const SLOTS: Slot[] = [
  { key: '2566-FIRST', year: 2566, term: 'FIRST', regularTerm: 1 },
  { key: '2566-SECOND', year: 2566, term: 'SECOND', regularTerm: 2 },
  { key: '2566-SUMMER', year: 2566, term: 'SUMMER', regularTerm: null },
  { key: '2567-FIRST', year: 2567, term: 'FIRST', regularTerm: 3 },
  { key: '2567-SECOND', year: 2567, term: 'SECOND', regularTerm: 4 },
  { key: '2567-SUMMER', year: 2567, term: 'SUMMER', regularTerm: null },
  { key: '2568-FIRST', year: 2568, term: 'FIRST', regularTerm: 5 },
  { key: '2568-SECOND', year: 2568, term: 'SECOND', regularTerm: 6 },
  { key: '2568-SUMMER', year: 2568, term: 'SUMMER', regularTerm: null },
  { key: '2569-FIRST', year: 2569, term: 'FIRST', regularTerm: 7 },
];

export const MAX_CREDITS_PER_TERM = 22;
export const SUMMER_RETAKE_CREDIT_CAP = 9;
export const MAX_ATTEMPTS_PER_COURSE = 3;

// Required (isRequired) courses by regular term; every one of the 41 appears
// exactly once. Electives are slots filled per student (below).
export const PLAN: Record<number, string[]> = {
  1: ['01355101', '01417111', '02739111', '02739161', '01999111', '02999144', '01175129'],
  2: ['01355102', '02739112', '02739232', '02701011', '02721101', '01371111', '01175153'],
  3: ['02739211', '02739212', '02739221', '02739231', '01355103', '02714101'],
  4: ['02739241', '02739242', '02739243', '02739331', '02721121', '01387102'],
  5: ['02739321', '02739322', '02739323', '02739327', '02739341', '02739351'],
  6: ['02739342', '02739352', '02739353', '02739354', '02739391', '01999213', '02999037'],
  7: ['02739397', '02739499'],
};
// Elective slots per regular term: how many free / specific electives to take.
export const FREE_ELECTIVE_SLOTS: Record<number, number> = { 5: 1, 7: 1 };
export const SPECIFIC_ELECTIVE_SLOTS: Record<number, number> = { 7: 2 };
// 02739490 (co-op, 6 credits) is a final-term course: not offered before the
// current term. 02032304 (2 credits) is left out of the free-elective pool:
// with two slots it could never reach the category's 6-credit minimum.
export const FREE_ELECTIVES = ['02738453', '02738473', '03751111'];
export const SPECIFIC_ELECTIVES = ['02739326', '02739344', '02739452', '02739498'];
export const FREE_ELECTIVE_MIN_CREDITS = 6;

// How hard a course is: subtracted from the student's latent score.
const DIFFICULTY: Record<string, number> = {
  '01417111': 0.55,
  '02739112': 0.4,
  '02739161': 0.4,
  '02739211': 0.35,
  '02739231': 0.45,
  '02739331': 0.4,
  '02739221': 0.3,
  '02739242': 0.3,
  '02739351': 0.25,
  '02739341': 0.25,
  '02739321': 0.2,
  '02739212': 0.25,
  '02739352': 0.2,
  '01175129': -0.6,
  '01175153': -0.6,
  '02999144': -0.55,
  '02739397': -0.5,
  '02739391': -0.25,
  '01371111': -0.3,
  '01999111': -0.25,
  '02999037': -0.3,
  '01387102': -0.2,
  '02739499': -0.2,
};
const difficultyOf = (code: string) => DIFFICULTY[code] ?? 0;

export const GRADE_POINT: Record<GradeCode, number> = {
  A: 4,
  B_PLUS: 3.5,
  B: 3,
  C_PLUS: 2.5,
  C: 2,
  D_PLUS: 1.5,
  D: 1,
  F: 0,
};
// Best to worst, matching the share targets below.
export const GRADE_ORDER: GradeCode[] = ['A', 'B_PLUS', 'B', 'C_PLUS', 'C', 'D_PLUS', 'D', 'F'];
const NOISE_SD = 0.75;
const RETAKE_BONUS = 0.35;

// ---------------------------------------------------------------- targets
export const GRADE_SHARE_TARGET: Record<GradeCode, [number, number]> = {
  A: [18, 22],
  B_PLUS: [15, 18],
  B: [18, 22],
  C_PLUS: [13, 16],
  C: [10, 13],
  D_PLUS: [5, 7],
  D: [4, 6],
  F: [3, 5],
};
// Used to place the cut points (percent of all graded attempts, best first).
// Not the midpoints of the target ranges: per-student rejection sampling and
// retakes push the low grades up, so D/D+ are aimed low and A high.
const GRADE_SHARE_CENTER: Record<GradeCode, number> = {
  A: 22,
  B_PLUS: 17,
  B: 20.5,
  C_PLUS: 14.5,
  C: 11,
  D_PLUS: 5,
  D: 3.8,
  F: 3.9,
};

export interface GpaxBand {
  id: string;
  min: number; // inclusive
  max: number; // exclusive
  count: number; // how many of the 100 students
  accept: [number, number]; // tolerance reported/checked on the final result
  // GPAX the student's latent ability is aimed at, drawn uniformly in here
  aim: [number, number];
}
export const GPAX_BANDS: GpaxBand[] = [
  { id: 'critical', min: 0, max: 1.5, count: 5, accept: [4, 6], aim: [0.9, 1.4] },
  { id: 'watch', min: 1.5, max: 1.75, count: 7, accept: [6, 8], aim: [1.54, 1.7] },
  { id: 'low', min: 1.75, max: 2.0, count: 9, accept: [7, 11], aim: [1.78, 1.96] },
  { id: 'mid-low', min: 2.0, max: 2.5, count: 22, accept: [19, 25], aim: [2.04, 2.46] },
  { id: 'mid', min: 2.5, max: 3.0, count: 26, accept: [22, 30], aim: [2.54, 2.96] },
  { id: 'good', min: 3.0, max: 3.5, count: 22, accept: [18, 26], aim: [3.04, 3.46] },
  { id: 'honors', min: 3.5, max: 4.01, count: 9, accept: [8, 10], aim: [3.55, 3.95] },
];
export const STUDENT_COUNT = 100;
const RETAKE_PASS_STUDENTS = 26; // F, retaken, later passed
const UNRETAKEN_F_STUDENTS = 10; // F that is never retaken

// ------------------------------------------------------------------- rng
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Independent stream per (seed, student, attempt) so one student's retries
// never shift anybody else's draws.
const subSeed = (seed: number, a: number, b: number) =>
  (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^
    Math.imul(a + 1, 0xc2b2ae35) ^
    Math.imul(b + 1, 0x27d4eb2f)) >>>
  0;

function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}
function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Acklam's rational approximation of the standard normal quantile.
export function normInv(p: number): number {
  const a = [
    -39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716,
    2.506628277459239,
  ];
  const b = [
    -54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972,
    -13.28068155288572,
  ];
  const c = [
    -0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

// ---------------------------------------------------------------- catalog
export interface Catalog {
  byCode: Map<string, CatalogCourse>;
  dependents: Map<string, string[]>; // course -> courses that need it
}

export function buildCatalog(courses: CatalogCourse[]): Catalog {
  const byCode = new Map(courses.map((c) => [c.code, c]));
  const dependents = new Map<string, string[]>();
  for (const c of courses) {
    for (const p of c.prereqs) {
      if (!byCode.has(p)) continue; // a prerequisite on an inactive course is ignored
      dependents.set(p, [...(dependents.get(p) ?? []), c.code]);
    }
  }
  return { byCode, dependents };
}

// Everything the plan assumes about the catalog. Returns human-readable
// problems; empty means the plan is consistent with this catalog.
export function validatePlan(catalog: Catalog): string[] {
  const problems: string[] = [];
  const required = [...catalog.byCode.values()]
    .filter((c) => c.isRequired)
    .map((c) => c.code)
    .sort((a, b) => a.localeCompare(b));
  const planned = Object.values(PLAN).flat();
  if (new Set(planned).size !== planned.length) problems.push('a course appears twice in PLAN');
  const missing = required.filter((c) => !planned.includes(c));
  const extra = planned.filter((c) => !required.includes(c));
  if (missing.length) problems.push(`required courses missing from PLAN: ${missing.join(', ')}`);
  if (extra.length)
    problems.push(`PLAN lists courses that are not active required courses: ${extra.join(', ')}`);

  const termOf = new Map<string, number>();
  for (const [t, codes] of Object.entries(PLAN)) codes.forEach((c) => termOf.set(c, Number(t)));
  for (const [t, codes] of Object.entries(PLAN)) {
    const term = Number(t);
    let credits = codes.reduce((s, c) => s + (catalog.byCode.get(c)?.credits ?? 0), 0);
    credits += (FREE_ELECTIVE_SLOTS[term] ?? 0) * 3 + (SPECIFIC_ELECTIVE_SLOTS[term] ?? 0) * 3;
    if (credits > MAX_CREDITS_PER_TERM)
      problems.push(`term ${term} plans ${credits} credits (> ${MAX_CREDITS_PER_TERM})`);
    for (const code of codes) {
      for (const p of catalog.byCode.get(code)?.prereqs ?? []) {
        if (!catalog.byCode.has(p)) continue;
        const pt = termOf.get(p);
        if (pt === undefined || pt >= term)
          problems.push(
            `${code} (term ${term}) needs ${p}, which is not planned in an earlier term`,
          );
      }
    }
  }
  for (const code of [...FREE_ELECTIVES, ...SPECIFIC_ELECTIVES]) {
    const c = catalog.byCode.get(code);
    if (!c) problems.push(`elective ${code} not found among active courses`);
    else if (c.isRequired) problems.push(`elective ${code} is marked required`);
  }
  return problems;
}

// ------------------------------------------------------------- simulation
export interface AttemptRecord {
  code: string;
  slotKey: string;
  grade: GradeCode;
  credits: number;
}

const isPass = (g: GradeCode) => g !== 'F';

interface GradeCuts {
  // score >= cuts[i] earns GRADE_ORDER[i]; the last grade (F) has no cut
  cuts: number[];
}

function gradeFor(score: number, cuts: GradeCuts): GradeCode {
  for (let i = 0; i < cuts.cuts.length; i++) if (score >= cuts.cuts[i]) return GRADE_ORDER[i];
  return 'F';
}

interface SimOptions {
  theta: number;
  rng: () => number;
  cuts: GradeCuts;
  abandonsLeafF: boolean;
  summer: boolean;
}

interface CourseState {
  attempts: number;
  passed: boolean;
  lastGrade: GradeCode | null;
  lastSlot: number;
}

export function simulateStudent(catalog: Catalog, opt: SimOptions): AttemptRecord[] {
  const { rng } = opt;
  const state = new Map<string, CourseState>();
  const stateOf = (code: string): CourseState => {
    let s = state.get(code);
    if (!s) state.set(code, (s = { attempts: 0, passed: false, lastGrade: null, lastSlot: -99 }));
    return s;
  };
  const planTerm = new Map<string, number>();
  for (const [t, codes] of Object.entries(PLAN)) codes.forEach((c) => planTerm.set(c, Number(t)));
  const records: AttemptRecord[] = [];
  const chosenElectives = new Set<string>();
  const owed = { free: 0, specific: 0 };
  const isLeaf = (code: string) => !catalog.dependents.get(code)?.length;

  SLOTS.forEach((slot, slotIdx) => {
    // Passed in EARLIER slots only: a prerequisite must be finished before the term starts.
    const passedBefore = new Set([...state].filter(([, s]) => s.passed).map(([c]) => c));
    const prereqsMet = (code: string) =>
      (catalog.byCode.get(code)?.prereqs ?? []).every(
        (p) => !catalog.byCode.has(p) || passedBefore.has(p),
      );
    const taken: { code: string; retake: boolean }[] = [];
    let credits = 0;
    const cap = slot.regularTerm === null ? SUMMER_RETAKE_CREDIT_CAP : MAX_CREDITS_PER_TERM;
    const add = (code: string, retake: boolean) => {
      const c = catalog.byCode.get(code)!.credits;
      if (credits + c > cap) return false;
      credits += c;
      taken.push({ code, retake });
      return true;
    };

    // 1. retakes
    const failed = [...state]
      .filter(([, s]) => !s.passed && s.attempts > 0 && s.attempts < MAX_ATTEMPTS_PER_COURSE)
      .map(([c]) => c)
      .sort((a, b) => a.localeCompare(b));
    if (slot.regularTerm === null) {
      // Summer: only retakes, and only of courses that block something.
      if (opt.summer && failed.some((c) => !isLeaf(c)) && rng() < 0.25) {
        for (const code of failed) if (!isLeaf(code) && prereqsMet(code)) add(code, true);
      }
    } else {
      for (const code of failed) {
        const s = stateOf(code);
        if (!prereqsMet(code)) continue;
        const leaf = isLeaf(code);
        const recent = slotIdx - s.lastSlot <= 2; // summer may sit in between
        let p: number;
        if (leaf && opt.abandonsLeafF) p = 0;
        else if (leaf) p = recent ? 0.93 : 0.7;
        else p = recent ? 0.95 : 0.7;
        if (rng() < p) add(code, true);
      }

      // 2. required courses that are due (planned for this term or earlier) and not yet attempted
      const due = [...planTerm]
        .filter(
          ([code, t]) => t <= slot.regularTerm! && stateOf(code).attempts === 0 && prereqsMet(code),
        )
        .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
      for (const [code] of due) add(code, false);

      // 3. electives for this term; a slot that did not fit under the credit
      // cap is owed and tried again next term
      owed.free += FREE_ELECTIVE_SLOTS[slot.regularTerm] ?? 0;
      owed.specific += SPECIFIC_ELECTIVE_SLOTS[slot.regularTerm] ?? 0;
      for (let want = owed.free; want > 0; want--) {
        const pick = pickFreeElective(
          catalog,
          chosenElectives,
          passedBefore,
          rng,
          want === 1 && slot.regularTerm === 7,
        );
        if (!pick || !add(pick, false)) break;
        chosenElectives.add(pick);
        owed.free--;
      }
      for (let want = owed.specific; want > 0; want--) {
        const options = SPECIFIC_ELECTIVES.filter((c) => !chosenElectives.has(c) && prereqsMet(c));
        if (options.length === 0) break;
        const pick = options[Math.floor(rng() * options.length)];
        if (!add(pick, false)) break;
        chosenElectives.add(pick);
        owed.specific--;
      }
    }

    // grade everything taken this slot
    for (const t of taken) {
      const course = catalog.byCode.get(t.code)!;
      const score =
        opt.theta - difficultyOf(t.code) + gaussian(rng) * NOISE_SD + (t.retake ? RETAKE_BONUS : 0);
      const grade = gradeFor(score, opt.cuts);
      const s = stateOf(t.code);
      s.attempts++;
      s.lastGrade = grade;
      s.lastSlot = slotIdx;
      records.push({ code: t.code, slotKey: slot.key, grade, credits: course.credits });
    }
    // passed flags are applied after the slot so they only count from the next one
    for (const t of taken) {
      const s = stateOf(t.code);
      if (isPass(s.lastGrade!)) s.passed = true;
    }
  });
  return records;
}

// Free electives: any not taken yet; the last pick must leave the category at
// its 6-credit minimum (the 2-credit course alone would not).
function pickFreeElective(
  catalog: Catalog,
  chosen: Set<string>,
  passedBefore: Set<string>,
  rng: () => number,
  isLastSlot: boolean,
): string | null {
  const have = [...chosen]
    .filter((c) => FREE_ELECTIVES.includes(c))
    .reduce((s, c) => s + catalog.byCode.get(c)!.credits, 0);
  let options = FREE_ELECTIVES.filter(
    (c) =>
      !chosen.has(c) &&
      catalog.byCode.has(c) &&
      catalog.byCode.get(c)!.prereqs.every((p) => passedBefore.has(p)),
  );
  if (isLastSlot) {
    const enough = options.filter(
      (c) => have + catalog.byCode.get(c)!.credits >= FREE_ELECTIVE_MIN_CREDITS,
    );
    if (enough.length > 0) options = enough;
  }
  return options.length ? options[Math.floor(rng() * options.length)] : null;
}

// ----------------------------------------------------------- measurements
const SLOT_INDEX = new Map(SLOTS.map((s, i) => [s.key, i]));

// Latest attempt per course (what the backend uses), credit-weighted.
export function latestAttempts(records: AttemptRecord[]): Map<string, AttemptRecord> {
  const latest = new Map<string, AttemptRecord>();
  for (const r of records) {
    const prev = latest.get(r.code);
    if (!prev || SLOT_INDEX.get(r.slotKey)! > SLOT_INDEX.get(prev.slotKey)!) latest.set(r.code, r);
  }
  return latest;
}
export function gpax(records: AttemptRecord[]): number | null {
  let points = 0;
  let credits = 0;
  for (const r of latestAttempts(records).values()) {
    points += GRADE_POINT[r.grade] * r.credits;
    credits += r.credits;
  }
  return credits > 0 ? points / credits : null;
}
export function creditsPassed(records: AttemptRecord[]): number {
  let total = 0;
  for (const r of latestAttempts(records).values()) if (isPass(r.grade)) total += r.credits;
  return total;
}
// Same formula as common/academic/year-level.ts (expectedCreditsByNow).
export function expectedCreditsByNow(
  totalCredits: number,
  durationYears: number,
  currentYear: number,
  admissionYear: number,
): number {
  if (durationYears <= 0) return totalCredits;
  const elapsed = Math.max(0, currentYear - admissionYear);
  return Math.min(totalCredits, Math.ceil((totalCredits * elapsed) / durationYears));
}

// -------------------------------------------------------------- generation
export interface GeneratedStudent {
  index: number; // 1..100
  band: string;
  aimGpax: number;
  gpax: number;
  records: AttemptRecord[];
}
export interface Generation {
  seed: number;
  students: GeneratedStudent[];
}

export function computeCuts(thetas: number[], catalog: Catalog): GradeCuts {
  // Pooled latent score ~ N(mean, sd): spread of abilities + of course
  // difficulty + noise. Cut points are the quantiles that give each grade its
  // target share of all attempts (before per-student rejection nudges it).
  const plannedCodes = Object.values(PLAN)
    .flat()
    .filter((c) => catalog.byCode.has(c));
  const dMean = plannedCodes.reduce((s, c) => s + difficultyOf(c), 0) / plannedCodes.length;
  const dVar =
    plannedCodes.reduce((s, c) => s + (difficultyOf(c) - dMean) ** 2, 0) / plannedCodes.length;
  const tMean = thetas.reduce((s, x) => s + x, 0) / thetas.length;
  const tVar = thetas.reduce((s, x) => s + (x - tMean) ** 2, 0) / thetas.length;
  const mean = tMean - dMean;
  const sd = Math.sqrt(tVar + dVar + NOISE_SD ** 2);
  const total = GRADE_ORDER.reduce((s, g) => s + GRADE_SHARE_CENTER[g], 0);
  const cuts: number[] = [];
  let cumulative = 0;
  for (let i = 0; i < GRADE_ORDER.length - 1; i++) {
    cumulative += GRADE_SHARE_CENTER[GRADE_ORDER[i]] / total;
    cuts.push(mean + sd * normInv(1 - cumulative));
  }
  return { cuts };
}

const MAX_TRIALS_PER_STUDENT = 800;
const CALIBRATION_GRID: number[] = Array.from({ length: 33 }, (_, i) => -3.2 + i * 0.2);
const CALIBRATION_SIMS = 40;

// Mean GPAX a student of ability theta ends up with, measured by simulation
// (grades are not linear in ability, so a formula would be off by ~0.3).
function gpaxCurve(catalog: Catalog, cuts: GradeCuts, summer: boolean, seed: number): number[] {
  const raw = CALIBRATION_GRID.map((theta, gi) => {
    let sum = 0;
    for (let k = 0; k < CALIBRATION_SIMS; k++) {
      const records = simulateStudent(catalog, {
        theta,
        rng: makeRng(subSeed(seed, 100000 + gi, k)),
        cuts,
        abandonsLeafF: false,
        summer,
      });
      sum += gpax(records) ?? 0;
    }
    return sum / CALIBRATION_SIMS;
  });
  // monotone non-decreasing, so it can be inverted
  for (let i = 1; i < raw.length; i++) raw[i] = Math.max(raw[i], raw[i - 1]);
  return raw;
}

function thetaForAim(curve: number[], aim: number): number {
  if (aim <= curve[0]) return CALIBRATION_GRID[0];
  for (let i = 1; i < curve.length; i++) {
    if (aim <= curve[i]) {
      const span = curve[i] - curve[i - 1];
      const f = span > 1e-9 ? (aim - curve[i - 1]) / span : 0;
      return CALIBRATION_GRID[i - 1] + f * (CALIBRATION_GRID[i] - CALIBRATION_GRID[i - 1]);
    }
  }
  return CALIBRATION_GRID[CALIBRATION_GRID.length - 1];
}

export function generate(catalog: Catalog, opts: { seed: number; summer: boolean }): Generation {
  const master = makeRng(opts.seed);

  // band per student: exact counts, shuffled
  const bandIds = shuffle(
    GPAX_BANDS.flatMap((b) => Array<string>(b.count).fill(b.id)),
    master,
  );
  if (bandIds.length !== STUDENT_COUNT) throw new Error('band counts must add up to 100');
  const aims = bandIds.map((id) => {
    const band = GPAX_BANDS.find((b) => b.id === id)!;
    return band.aim[0] + master() * (band.aim[1] - band.aim[0]);
  });
  // Ability from the aimed GPAX, calibrated by simulation. Two passes because
  // the grade cut points depend on how spread out the abilities are.
  let thetas = aims.map((g) => (g - 2.6) * 1.35);
  let cuts = computeCuts(thetas, catalog);
  for (let pass = 0; pass < 2; pass++) {
    const curve = gpaxCurve(catalog, cuts, opts.summer, opts.seed);
    thetas = aims.map((g) => thetaForAim(curve, g));
    cuts = computeCuts(thetas, catalog);
  }

  // Who plays which scripted role. Strong students almost never fail anything,
  // so both "F that is never retaken" and "F, retaken, then passed" come from
  // the lower bands (where a GPAX near 2 still has room for an unretaken F).
  const order = shuffle(
    bandIds.map((_, i) => i),
    master,
  );
  const unretaken = new Set(
    order.filter((i) => ['low', 'mid-low'].includes(bandIds[i])).slice(0, UNRETAKEN_F_STUDENTS),
  );
  const retakePass = new Set(
    order
      .filter((i) => ['watch', 'low', 'mid-low'].includes(bandIds[i]) && !unretaken.has(i))
      .slice(0, RETAKE_PASS_STUDENTS),
  );

  const students: GeneratedStudent[] = [];
  for (let i = 0; i < STUDENT_COUNT; i++) {
    const band = GPAX_BANDS.find((b) => b.id === bandIds[i])!;
    let accepted: AttemptRecord[] | null = null;
    for (let trial = 0; trial < MAX_TRIALS_PER_STUDENT && !accepted; trial++) {
      const records = simulateStudent(catalog, {
        theta: thetas[i],
        rng: makeRng(subSeed(opts.seed, i, trial)),
        cuts,
        abandonsLeafF: unretaken.has(i),
        summer: opts.summer,
      });
      const g = gpax(records);
      if (g === null || g < band.min || g >= band.max) continue;
      const hasF = records.some((r) => r.grade === 'F');
      const latest = latestAttempts(records);
      const stillF = [...latest.values()].some((r) => r.grade === 'F');
      const failedThenPassed = [...latest.values()].some(
        (r) => isPass(r.grade) && records.some((x) => x.code === r.code && x.grade === 'F'),
      );
      if (band.id === 'honors' && hasF) continue;
      if (unretaken.has(i) && !stillF) continue;
      if (retakePass.has(i) && !failedThenPassed) continue;
      accepted = records;
    }
    if (!accepted)
      throw new Error(`seed ${opts.seed}: no trial matched band "${band.id}" for student ${i + 1}`);
    students.push({
      index: i + 1,
      band: band.id,
      aimGpax: aims[i],
      gpax: gpax(accepted)!,
      records: accepted,
    });
  }
  return { seed: opts.seed, students };
}

// ---------------------------------------------------------------- reporting
export interface Summary {
  attempts: number;
  gradeShare: Record<GradeCode, number>; // percent
  bandCounts: Record<string, number>;
  behindPlan: number;
  creditsPassed: { min: number; median: number; max: number };
  studentsWithRetakePass: number;
  studentsWithUnretakenF: number;
  summerRecords: number;
  maxCreditsInATerm: number;
}

export function summarize(gen: Generation, expectedCredits: number): Summary {
  const all = gen.students.flatMap((s) => s.records);
  const gradeShare = Object.fromEntries(
    GRADE_ORDER.map((g) => [g, (all.filter((r) => r.grade === g).length / all.length) * 100]),
  ) as Record<GradeCode, number>;
  const bandCounts = Object.fromEntries(
    GPAX_BANDS.map((b) => [
      b.id,
      gen.students.filter((s) => s.gpax >= b.min && s.gpax < b.max).length,
    ]),
  );
  const passed = gen.students.map((s) => creditsPassed(s.records)).sort((a, b) => a - b);
  let maxTerm = 0;
  for (const s of gen.students) {
    const perSlot = new Map<string, number>();
    for (const r of s.records) perSlot.set(r.slotKey, (perSlot.get(r.slotKey) ?? 0) + r.credits);
    for (const v of perSlot.values()) maxTerm = Math.max(maxTerm, v);
  }
  return {
    attempts: all.length,
    gradeShare,
    bandCounts,
    behindPlan: passed.filter((p) => p < expectedCredits).length,
    creditsPassed: {
      min: passed[0],
      median: passed[Math.floor(passed.length / 2)],
      max: passed[passed.length - 1],
    },
    studentsWithRetakePass: gen.students.filter((s) => {
      const latest = latestAttempts(s.records);
      return [...latest.values()].some(
        (r) => isPass(r.grade) && s.records.some((x) => x.code === r.code && x.grade === 'F'),
      );
    }).length,
    studentsWithUnretakenF: gen.students.filter((s) =>
      [...latestAttempts(s.records).values()].some((r) => r.grade === 'F'),
    ).length,
    summerRecords: all.filter((r) => r.slotKey.endsWith('SUMMER')).length,
    maxCreditsInATerm: maxTerm,
  };
}

// Returns what is out of range (empty = every target is met).
export function checkTargets(summary: Summary, studentCount = STUDENT_COUNT): string[] {
  const problems: string[] = [];
  for (const g of GRADE_ORDER) {
    const [lo, hi] = GRADE_SHARE_TARGET[g];
    const v = summary.gradeShare[g];
    if (v < lo || v > hi) problems.push(`${g} share ${v.toFixed(1)}% outside ${lo}-${hi}%`);
  }
  for (const b of GPAX_BANDS) {
    const v = summary.bandCounts[b.id];
    if (v < b.accept[0] || v > b.accept[1])
      problems.push(`GPAX band ${b.id}: ${v} students outside ${b.accept[0]}-${b.accept[1]}`);
  }
  if (summary.maxCreditsInATerm > MAX_CREDITS_PER_TERM)
    problems.push(`a term carries ${summary.maxCreditsInATerm} credits`);
  if (summary.studentsWithRetakePass < 20)
    problems.push(
      `only ${summary.studentsWithRetakePass} students failed-then-passed (want >= 20)`,
    );
  if (summary.studentsWithUnretakenF < 8)
    problems.push(
      `only ${summary.studentsWithUnretakenF} students have an unretaken F (want >= 8)`,
    );
  if (summary.behindPlan > studentCount * 0.4)
    problems.push(`${summary.behindPlan} students behind plan: almost everyone`);
  return problems;
}

export const CANDIDATE_SEEDS = Array.from({ length: 40 }, (_, i) => 20261014 + i);

// First seed whose result meets every target; otherwise throws with the
// least-bad seed's problems so the dry run can show them.
export function findGeneration(
  catalog: Catalog,
  expectedCredits: number,
  summer: boolean,
  seeds = CANDIDATE_SEEDS,
) {
  let best: { problems: string[]; seed: number } | null = null;
  for (const seed of seeds) {
    let gen: Generation;
    try {
      gen = generate(catalog, { seed, summer });
    } catch (e) {
      best ??= { problems: [(e as Error).message], seed };
      continue;
    }
    const summary = summarize(gen, expectedCredits);
    const problems = checkTargets(summary);
    if (problems.length === 0) return { generation: gen, summary };
    if (!best || problems.length < best.problems.length) best = { problems, seed };
  }
  throw new Error(
    `no candidate seed met every target; closest (seed ${best?.seed}): ${best?.problems.join('; ')}`,
  );
}

// ------------------------------------------------------------------ names
const FIRST_A = [
  'ณัฐ',
  'ธน',
  'พิม',
  'กัล',
  'ภัทร',
  'วิ',
  'สุ',
  'นิ',
  'อรุณ',
  'ชล',
  'ธีร',
  'เมธ',
  'กิตติ',
  'ปวีณ',
  'รุ่ง',
  'ศุภ',
  'ทิพย์',
  'พัช',
  'จิร',
  'อัญ',
];
const FIRST_B = [
  'พล',
  'ภา',
  'รัตน์',
  'วดี',
  'พร',
  'ชัย',
  'นันท์',
  'ธิดา',
  'กุล',
  'วัฒน์',
  'เดช',
  'ดา',
  'ศักดิ์',
  'รินทร์',
  'ลักษณ์',
  'พงศ์',
  'ณี',
  'วรรณ',
  'ยา',
  'โชค',
];
const LAST_A = [
  'สุข',
  'ทอง',
  'ศรี',
  'รุ่ง',
  'บุญ',
  'แก้ว',
  'จันทร์',
  'วงศ์',
  'เพชร',
  'ดี',
  'สว่าง',
  'มณี',
];
const LAST_B = [
  'เจริญ',
  'สมบัติ',
  'ธรรม',
  'ไพศาล',
  'เกษม',
  'พัฒน์',
  'ชัยกุล',
  'วิไล',
  'งาม',
  'ศิริ',
  'ยืนยง',
  'มั่งมี',
];

// Invented from syllables (not a list of real names), unique within the cohort.
export function makeNames(count: number, seed: number): string[] {
  const rng = makeRng(seed ^ 0x5bd1e995);
  const seen = new Set<string>();
  const names: string[] = [];
  while (names.length < count) {
    const name = `${FIRST_A[Math.floor(rng() * FIRST_A.length)]}${FIRST_B[Math.floor(rng() * FIRST_B.length)]} ${LAST_A[Math.floor(rng() * LAST_A.length)]}${LAST_B[Math.floor(rng() * LAST_B.length)]}`;
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}
