import { buildDashboardSummary, type DashboardSummaryInput } from './dashboard-summary';

const trend = (...gpas: number[]) => gpas.map((gpa) => ({ gpa }));

function input(overrides: Partial<DashboardSummaryInput> = {}): DashboardSummaryInput {
  return {
    gpa: 3.52,
    gpaTrend: trend(3.34, 3.52),
    creditsEarned: 96,
    totalCreditsRequired: 130,
    onTrackStatus: 'on_track',
    graduationReadiness: { isReady: false, missingRequiredCount: 0 },
    ...overrides,
  };
}

describe('buildDashboardSummary', () => {
  it('builds the full line when the GPA is up and the student is on track', () => {
    expect(buildDashboardSummary(input())).toBe(
      'GPA 3.52 (▲ 0.18 จากเทอมก่อน) · สะสม 96/130 หน่วยกิต · ตามแผน',
    );
  });

  it('shows a drop', () => {
    expect(buildDashboardSummary(input({ gpa: 3.4, gpaTrend: trend(3.5, 3.4) }))).toBe(
      'GPA 3.40 (▼ 0.10 จากเทอมก่อน) · สะสม 96/130 หน่วยกิต · ตามแผน',
    );
  });

  it('shows unchanged', () => {
    expect(buildDashboardSummary(input({ gpa: 3.2, gpaTrend: trend(3.2, 3.2) }))).toBe(
      'GPA 3.20 (– เท่าเดิม) · สะสม 96/130 หน่วยกิต · ตามแผน',
    );
  });

  it('omits the change with a single term', () => {
    expect(buildDashboardSummary(input({ gpaTrend: trend(3.52) }))).toBe(
      'GPA 3.52 · สะสม 96/130 หน่วยกิต · ตามแผน',
    );
  });

  it('says behind plan and lists the missing required courses', () => {
    expect(
      buildDashboardSummary(
        input({
          gpa: 1.83,
          gpaTrend: trend(1.83),
          creditsEarned: 6,
          totalCreditsRequired: 132,
          onTrackStatus: 'behind',
          graduationReadiness: { isReady: false, missingRequiredCount: 39 },
        }),
      ),
    ).toBe('GPA 1.83 · สะสม 6/132 หน่วยกิต · ตามหลังแผน · วิชาบังคับที่ยังขาด 39 วิชา');
  });

  it('skips the missing-required part when there is none', () => {
    const text = buildDashboardSummary(input({ graduationReadiness: { isReady: false, missingRequiredCount: 0 } }));
    expect(text).not.toContain('วิชาบังคับ');
  });

  it('skips the plan status when it is null (nothing to judge)', () => {
    expect(buildDashboardSummary(input({ onTrackStatus: null }))).toBe(
      'GPA 3.52 (▲ 0.18 จากเทอมก่อน) · สะสม 96/130 หน่วยกิต',
    );
  });

  it('drops the GPA part for a null GPA, even if the trend has two terms', () => {
    expect(buildDashboardSummary(input({ gpa: null }))).toBe('สะสม 96/130 หน่วยกิต · ตามแผน');
  });

  it('shows a real 0.00 GPA and 0 earned credits (they are data, not missing)', () => {
    expect(
      buildDashboardSummary(
        input({ gpa: 0, gpaTrend: trend(0), creditsEarned: 0, onTrackStatus: 'behind' }),
      ),
    ).toBe('GPA 0.00 · สะสม 0/130 หน่วยกิต · ตามหลังแผน');
  });

  it('returns null when there is nothing to say', () => {
    expect(
      buildDashboardSummary({
        gpa: null,
        gpaTrend: [],
        creditsEarned: 0,
        totalCreditsRequired: 0,
        onTrackStatus: null,
        graduationReadiness: { isReady: false, missingRequiredCount: 0 },
      }),
    ).toBeNull();
  });

  it('never leaks NaN / undefined / null for bad numbers', () => {
    const text = buildDashboardSummary({
      gpa: Number.NaN,
      gpaTrend: trend(Number.NaN, 3),
      creditsEarned: Number.NaN,
      totalCreditsRequired: Number.NaN,
      onTrackStatus: null,
      graduationReadiness: { isReady: false, missingRequiredCount: Number.NaN },
    });
    expect(text).toBeNull();

    const partial = buildDashboardSummary(input({ creditsEarned: Number.NaN, gpaTrend: trend(3.0, Number.NaN) }));
    expect(partial).toBe('GPA 3.52 · ตามแผน');
    expect(partial).not.toMatch(/NaN|undefined|null/);
  });

  describe('graduation', () => {
    const graduated = input({
      gpa: 3.61,
      creditsEarned: 132,
      totalCreditsRequired: 132,
      onTrackStatus: null,
      graduationReadiness: { isReady: true, missingRequiredCount: 0 },
    });

    it('congratulates, with GPA and credits', () => {
      expect(buildDashboardSummary(graduated)).toBe(
        'ยินดีด้วย! นิสิตพร้อมสำเร็จการศึกษา · GPA 3.61 · สะสม 132/132 หน่วยกิต',
      );
    });

    it('never mentions being behind plan, missing courses or the term change', () => {
      const text = buildDashboardSummary({
        ...graduated,
        onTrackStatus: 'behind',
        graduationReadiness: { isReady: true, missingRequiredCount: 3 },
      })!;
      expect(text).not.toContain('ตามหลัง');
      expect(text).not.toContain('วิชาบังคับ');
      expect(text).not.toContain('จากเทอมก่อน');
    });

    it('still congratulates when GPA and credits are unavailable', () => {
      expect(
        buildDashboardSummary({ ...graduated, gpa: null, creditsEarned: Number.NaN }),
      ).toBe('ยินดีด้วย! นิสิตพร้อมสำเร็จการศึกษา');
    });
  });
});
