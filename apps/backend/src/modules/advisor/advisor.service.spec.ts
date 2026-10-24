import { NotFoundException } from '@nestjs/common';
import { RequestUser } from '../auth/request-user.interface';
import { AdvisorService } from './advisor.service';

const advisor = { userId: 'ins-1', roles: ['INSTRUCTOR'] } as unknown as RequestUser;

const PROFILE = {
  id: 'sp1',
  studentCode: '6600001',
  curriculumId: 'cur-1',
  admissionYear: 2566,
  isActive: true,
  user: { fullName: 'นิสิต ทดสอบ' },
  program: { code: 'ICT', name: 'เทคโนโลยีสารสนเทศ' },
  curriculum: { version: '2564', defaultAchievementThreshold: 60 },
};

const CREDIT = {
  creditsAccumulated: 30,
  totalCreditsRequired: 130,
  graduationReadiness: { isReady: false },
};

function setup(opts: { profiles?: (typeof PROFILE)[]; found?: typeof PROFILE | null } = {}) {
  const prisma = {
    studentProfile: {
      findMany: jest.fn().mockResolvedValue(opts.profiles ?? [PROFILE]),
      findFirst: jest.fn().mockResolvedValue(opts.found === undefined ? PROFILE : opts.found),
    },
    studentCourseRecord: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'r2',
          grade: 'A',
          credits: 3,
          course: { id: 'c2', code: '02', name: 'B' },
          semester: { id: 's2', term: 'SECOND', academicYear: { year: 2566 } },
        },
        {
          id: 'r1',
          grade: 'B',
          credits: 3,
          course: { id: 'c1', code: '01', name: 'A' },
          semester: { id: 's1', term: 'FIRST', academicYear: { year: 2566 } },
        },
      ]),
    },
  };
  const records = {
    getLatestAttemptsPerCourse: jest.fn().mockResolvedValue(new Map()),
    calculateGpaFromAttempts: jest.fn().mockReturnValue({ gpa: 3.25 }),
    calculateGpaForProfile: jest.fn().mockResolvedValue({ gpa: 3.25, bySemester: [] }),
  };
  const credit = {
    loadCurriculumTree: jest.fn().mockResolvedValue({ id: 'cur-1' }),
    computeCreditCheck: jest.fn().mockReturnValue(CREDIT),
    checkCreditsForProfile: jest.fn().mockResolvedValue(CREDIT),
  };
  const plo = { calculateForProfile: jest.fn().mockResolvedValue({ radar: [] }) };
  const service = new AdvisorService(
    prisma as never,
    records as never,
    credit as never,
    plo as never,
  );
  return { service, prisma, records, credit, plo };
}

describe('AdvisorService.listAdvisees', () => {
  it('lists only the caller’s advisees, with GPA and credit progress', async () => {
    const { service, prisma } = setup();
    const rows = await service.listAdvisees(advisor);

    expect(prisma.studentProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { advisorUserId: 'ins-1' } }),
    );
    expect(rows).toEqual([
      {
        id: 'sp1',
        studentCode: '6600001',
        fullName: 'นิสิต ทดสอบ',
        programCode: 'ICT',
        programName: 'เทคโนโลยีสารสนเทศ',
        curriculumVersion: '2564',
        admissionYear: 2566,
        isActive: true,
        gpa: 3.25,
        creditsAccumulated: 30,
        totalCreditsRequired: 130,
        graduationReady: false,
      },
    ]);
  });

  it('loads each curriculum tree once for students who share it', async () => {
    const { service, credit } = setup({
      profiles: [PROFILE, { ...PROFILE, id: 'sp2' }, { ...PROFILE, id: 'sp3', curriculumId: 'cur-2' }],
    });
    await service.listAdvisees(advisor);
    expect(credit.loadCurriculumTree).toHaveBeenCalledTimes(2);
    expect(credit.computeCreditCheck).toHaveBeenCalledTimes(3);
  });
});

describe('AdvisorService.getAdvisee', () => {
  it('is a 404 for a student the caller does not advise, and computes nothing', async () => {
    const { service, prisma, records, credit, plo } = setup({ found: null });
    await expect(service.getAdvisee('sp9', advisor)).rejects.toThrow(NotFoundException);
    expect(prisma.studentProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sp9', advisorUserId: 'ins-1' } }),
    );
    expect(records.calculateGpaForProfile).not.toHaveBeenCalled();
    expect(credit.checkCreditsForProfile).not.toHaveBeenCalled();
    expect(plo.calculateForProfile).not.toHaveBeenCalled();
    expect(prisma.studentCourseRecord.findMany).not.toHaveBeenCalled();
  });

  it('returns the same reports the student’s own pages use, records in term order', async () => {
    const { service, records, credit, plo } = setup();
    const detail = await service.getAdvisee('sp1', advisor);

    expect(records.calculateGpaForProfile).toHaveBeenCalledWith('sp1');
    expect(credit.checkCreditsForProfile).toHaveBeenCalledWith(PROFILE);
    expect(plo.calculateForProfile).toHaveBeenCalledWith(PROFILE);
    expect(detail.student.gpa).toBe(3.25);
    expect(detail.ploThreshold).toBe(60);
    expect(detail.records.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(detail.records[0]).toEqual({
      id: 'r1',
      grade: 'B',
      credits: 3,
      course: { id: 'c1', code: '01', name: 'A' },
      semesterId: 's1',
      semesterTerm: 'FIRST',
      academicYear: 2566,
    });
  });
});
