// Run on demand (not part of `npm test`, whose jest rootDir is src/):
//   npx jest --rootDir=. --roots=prisma/demo-it66 --testRegex 'engine\.spec\.ts$'
import { ICT2564_FIXTURE } from './catalog.fixture';
import {
  buildCatalog,
  checkTargets,
  expectedCreditsByNow,
  findGeneration,
  FREE_ELECTIVES,
  gpax,
  GPAX_BANDS,
  latestAttempts,
  makeNames,
  MAX_ATTEMPTS_PER_COURSE,
  MAX_CREDITS_PER_TERM,
  normInv,
  PLAN,
  SLOTS,
  STUDENT_COUNT,
  SUMMER_RETAKE_CREDIT_CAP,
  summarize,
  validatePlan,
  type AttemptRecord,
  type Generation,
} from './engine';

jest.setTimeout(120_000);

const catalog = buildCatalog(ICT2564_FIXTURE);
const EXPECTED_CREDITS = expectedCreditsByNow(132, 4, 2569, 2566);
const slotIndex = new Map(SLOTS.map((s, i) => [s.key, i]));

describe('PLAN against the ICT 2564 catalog', () => {
  it('is consistent: every required course once, prerequisites earlier, <= 22 credits', () => {
    expect(validatePlan(catalog)).toEqual([]);
    expect(Object.values(PLAN).flat()).toHaveLength(41);
  });

  it('reports a required course that is missing from the plan', () => {
    const extra = buildCatalog([
      ...ICT2564_FIXTURE,
      { code: '99999999', credits: 3, isRequired: true, prereqs: [] },
    ]);
    expect(validatePlan(extra).join(' ')).toContain('99999999');
  });

  it('reports a prerequisite that is not planned earlier', () => {
    const broken = buildCatalog(
      ICT2564_FIXTURE.map((c) => (c.code === '02739111' ? { ...c, prereqs: ['02739499'] } : c)),
    );
    expect(validatePlan(broken).join(' ')).toContain('02739111');
  });
});

describe('maths helpers', () => {
  it('behind-plan threshold matches the backend formula for 132 credits / 4 years / 3 elapsed', () => {
    expect(EXPECTED_CREDITS).toBe(99);
    expect(expectedCreditsByNow(132, 4, 2566, 2566)).toBe(0);
    expect(expectedCreditsByNow(132, 4, 2580, 2566)).toBe(132);
  });

  it('normInv is the normal quantile', () => {
    expect(normInv(0.5)).toBeCloseTo(0, 6);
    expect(normInv(0.975)).toBeCloseTo(1.95996, 3);
    expect(normInv(0.01)).toBeCloseTo(-2.32635, 3);
  });

  it('GPAX uses the latest attempt per course, so a passed retake replaces an F', () => {
    const records: AttemptRecord[] = [
      { code: 'X', slotKey: '2566-FIRST', grade: 'F', credits: 3 },
      { code: 'X', slotKey: '2566-SECOND', grade: 'B', credits: 3 },
      { code: 'Y', slotKey: '2566-FIRST', grade: 'A', credits: 3 },
    ];
    expect(gpax(records)).toBeCloseTo(3.5, 6);
    expect(latestAttempts(records).get('X')?.grade).toBe('B');
  });
});

describe('generated cohort', () => {
  let gen: Generation;
  let summary: ReturnType<typeof summarize>;

  beforeAll(() => {
    ({ generation: gen, summary } = findGeneration(catalog, EXPECTED_CREDITS, true));
  });

  it('meets every target (grade shares, GPAX bands, retake/unretaken F, not mostly behind)', () => {
    expect(checkTargets(summary)).toEqual([]);
    expect(gen.students).toHaveLength(STUDENT_COUNT);
  });

  it('has the exact number of students in each GPAX band', () => {
    for (const band of GPAX_BANDS) {
      expect(gen.students.filter((s) => s.gpax >= band.min && s.gpax < band.max)).toHaveLength(
        band.count,
      );
    }
  });

  it('is reproducible: the same inputs give identical records', () => {
    const again = findGeneration(catalog, EXPECTED_CREDITS, true).generation;
    expect(again.seed).toBe(gen.seed);
    expect(JSON.stringify(again.students)).toBe(JSON.stringify(gen.students));
  });

  it('stored GPAX equals the GPAX recomputed from the records', () => {
    for (const s of gen.students) expect(s.gpax).toBeCloseTo(gpax(s.records)!, 9);
  });

  it('never repeats (course, term), caps attempts, and respects term credit limits', () => {
    for (const s of gen.students) {
      const keys = s.records.map((r) => `${r.code}|${r.slotKey}`);
      expect(new Set(keys).size).toBe(keys.length);
      const attempts = new Map<string, number>();
      const perSlot = new Map<string, number>();
      for (const r of s.records) {
        attempts.set(r.code, (attempts.get(r.code) ?? 0) + 1);
        perSlot.set(r.slotKey, (perSlot.get(r.slotKey) ?? 0) + r.credits);
        expect(slotIndex.has(r.slotKey)).toBe(true);
        expect(r.credits).toBe(catalog.byCode.get(r.code)!.credits);
      }
      for (const n of attempts.values()) expect(n).toBeLessThanOrEqual(MAX_ATTEMPTS_PER_COURSE);
      for (const [slotKey, credits] of perSlot) {
        const limit = slotKey.endsWith('SUMMER') ? SUMMER_RETAKE_CREDIT_CAP : MAX_CREDITS_PER_TERM;
        expect(credits).toBeLessThanOrEqual(limit);
      }
    }
  });

  it('never takes a course again after passing it, and never before its prerequisites are passed', () => {
    for (const s of gen.students) {
      const sorted = [...s.records].sort(
        (a, b) => slotIndex.get(a.slotKey)! - slotIndex.get(b.slotKey)!,
      );
      const passedAt = new Map<string, number>();
      for (const r of sorted) {
        const idx = slotIndex.get(r.slotKey)!;
        expect(passedAt.has(r.code)).toBe(false); // already passed
        for (const p of catalog.byCode.get(r.code)!.prereqs) {
          if (!catalog.byCode.has(p)) continue;
          expect(passedAt.get(p)).toBeDefined();
          expect(passedAt.get(p)!).toBeLessThan(idx);
        }
        if (r.grade !== 'F') passedAt.set(r.code, idx);
      }
    }
  });

  it('uses summer only for retakes of a course already failed', () => {
    for (const s of gen.students) {
      for (const r of s.records.filter((x) => x.slotKey.endsWith('SUMMER'))) {
        const before = s.records.filter(
          (x) => x.code === r.code && slotIndex.get(x.slotKey)! < slotIndex.get(r.slotKey)!,
        );
        expect(before.some((x) => x.grade === 'F')).toBe(true);
      }
    }
  });

  it('keeps honors students free of F and stops at the current term', () => {
    for (const s of gen.students.filter((x) => x.band === 'honors')) {
      expect(s.records.some((r) => r.grade === 'F')).toBe(false);
    }
    for (const s of gen.students) {
      expect(s.records.some((r) => r.slotKey > '2569-FIRST')).toBe(false);
    }
  });

  it('never takes the co-op course, and free electives reach 6 credits whenever two were taken', () => {
    let tookTwo = 0;
    for (const s of gen.students) {
      expect(s.records.some((r) => r.code === '02739490')).toBe(false);
      const free = s.records.filter((r) => FREE_ELECTIVES.includes(r.code));
      expect(free.length).toBeLessThanOrEqual(2);
      if (free.length === 2) {
        tookTwo++;
        expect(free.reduce((sum, r) => sum + r.credits, 0)).toBeGreaterThanOrEqual(6);
      }
    }
    // an overloaded student may still owe one at the current term, but not most
    expect(tookTwo).toBeGreaterThan(STUDENT_COUNT * 0.8);
  });
});

describe('makeNames', () => {
  it('returns unique invented names, reproducibly', () => {
    const names = makeNames(STUDENT_COUNT, 1);
    expect(new Set(names).size).toBe(STUDENT_COUNT);
    expect(makeNames(STUDENT_COUNT, 1)).toEqual(names);
  });
});
