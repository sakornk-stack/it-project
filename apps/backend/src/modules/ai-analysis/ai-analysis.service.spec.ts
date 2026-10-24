import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditCheckerService } from '../academic-record/credit-checker/credit-checker.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { AiAnalysisService, groundCareers, isAiEnabled } from './ai-analysis.service';

const messagesParse = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ beta: { messages: { parse: messagesParse } } })),
}));
const AnthropicMock = Anthropic as unknown as jest.Mock;

const UNAVAILABLE_MESSAGE =
  'บริการวิเคราะห์ด้วย AI ไม่สามารถให้บริการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง';
const user = { userId: 'student-user', roles: ['STUDENT'] } as never;

const gradedDashboard = {
  studentProfileId: 'profile-1',
  gpa: 3.1,
  yearLevel: 3,
  creditsEarned: 60,
  creditsRemaining: 66,
  totalCreditsRequired: 126,
  curriculumProgressPercent: 48,
  graduationReadiness: 'ON_TRACK',
  radar: [
    { ploId: 'p1', code: 'PLO1', name: 'Programming', value: 82 },
    { ploId: 'p3', code: 'PLO3', name: 'Data', value: 59 },
  ],
  strengths: [],
  areasForImprovement: [],
  recentCourses: [],
  missingRequiredCourses: [],
  incompleteElectiveCategories: [],
};

const passedCourses = [
  { courseId: 'c1', code: '02739112', name: 'หลักการเขียนโปรแกรม', grade: 'B_PLUS' },
  { courseId: 'c2', code: '02739221', name: 'ระบบฐานข้อมูล', grade: 'C' },
  { courseId: 'c3', code: '02739342', name: 'การพัฒนาโปรแกรมประยุกต์สำหรับอุปกรณ์เคลื่อนที่', grade: 'A' },
];

function setup(apiKey: string | undefined, opts: { passed?: typeof passedCourses } = {}) {
  const config = {
    get: jest.fn((key: string) => (key === 'ai.anthropicApiKey' ? apiKey : 'test-model')),
  };
  const dashboardService = { getStudentDashboard: jest.fn().mockResolvedValue(gradedDashboard) };
  const creditCheckerService = {
    checkCredits: jest.fn().mockResolvedValue({ passedCourses: opts.passed ?? passedCourses }),
  };
  const prisma = {
    studentProfile: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        program: { name: 'เทคโนโลยีสารสนเทศและการสื่อสาร' },
        curriculum: { defaultAchievementThreshold: 70 },
      }),
    },
  };
  const service = new AiAnalysisService(
    config as unknown as ConfigService,
    dashboardService as unknown as DashboardService,
    creditCheckerService as unknown as CreditCheckerService,
    prisma as unknown as PrismaService,
  );
  return { service, dashboardService, creditCheckerService };
}

const skillReply = {
  stop_reason: 'end_turn',
  parsed_output: { summary: 's', strengths: [], weaknesses: [], recommendations: [] },
};

beforeEach(() => {
  AnthropicMock.mockClear();
  messagesParse.mockReset();
});

describe('isAiEnabled', () => {
  it.each([undefined, '', '   ', 'disabled', ' Disabled ', 'DISABLED', 'change_me_in_production'])(
    'is off for %p',
    (key) => {
      expect(isAiEnabled(key)).toBe(false);
    },
  );

  it('is on for a key shaped like an Anthropic key', () => {
    expect(isAiEnabled('sk-test-placeholder')).toBe(true);
  });
});

describe('AiAnalysisService when AI is disabled', () => {
  it.each([undefined, '', 'disabled', ' Disabled ', 'change_me_in_production'])(
    'with key %p: answers 503 before reading data or calling the SDK',
    async (key) => {
      const { service, dashboardService, creditCheckerService } = setup(key);

      for (const call of [
        () => service.getStudentAnalysis('profile-1', user),
        () => service.getCareerSuggestions('profile-1', user),
      ]) {
        const error = await call().catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect((error as ServiceUnavailableException).message).toBe(UNAVAILABLE_MESSAGE);
      }
      expect(dashboardService.getStudentDashboard).not.toHaveBeenCalled();
      expect(creditCheckerService.checkCredits).not.toHaveBeenCalled();
      expect(AnthropicMock).not.toHaveBeenCalled();
      expect(messagesParse).not.toHaveBeenCalled();
    },
  );

  it('does not build a client at construction time', () => {
    setup('disabled');
    setup('sk-test-placeholder');
    expect(AnthropicMock).not.toHaveBeenCalled();
  });
});

describe('AiAnalysisService when AI is enabled', () => {
  it('creates the client once, on first use', async () => {
    messagesParse.mockResolvedValue(skillReply);
    const { service } = setup('sk-test-placeholder');

    await service.getStudentAnalysis('profile-1', user);
    await service.getStudentAnalysis('profile-1', user);

    expect(AnthropicMock).toHaveBeenCalledTimes(1);
    expect(messagesParse).toHaveBeenCalledTimes(2);
  });

  it('asks for structured output with server-side fallbacks, never a forced tool call', async () => {
    messagesParse.mockResolvedValue(skillReply);
    const { service } = setup('sk-test-placeholder');

    await service.getStudentAnalysis('profile-1', user);

    const params = messagesParse.mock.calls[0][0];
    expect(params).toMatchObject({
      model: 'test-model',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
    });
    expect(params.output_config.format).toBeDefined();
    expect(params.tool_choice).toBeUndefined();
    expect(params.tools).toBeUndefined();
  });

  it('hides the provider error behind the generic Thai message', async () => {
    messagesParse.mockRejectedValue(new Error('401 invalid x-api-key request-id=abc123'));
    const { service } = setup('sk-test-placeholder');

    const error = await service.getStudentAnalysis('profile-1', user).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    const body = JSON.stringify((error as ServiceUnavailableException).getResponse());
    expect(body).toContain(UNAVAILABLE_MESSAGE);
    expect(body).not.toContain('x-api-key');
    expect(body).not.toContain('abc123');
  });

  it('turns a refusal the fallback chain could not rescue into the Thai 503', async () => {
    messagesParse.mockResolvedValue({
      stop_reason: 'refusal',
      stop_details: { category: 'general_harms' },
      parsed_output: null,
    });
    const { service } = setup('sk-test-placeholder');

    await expect(service.getCareerSuggestions('profile-1', user)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});

describe('AiAnalysisService.getCareerSuggestions', () => {
  it('sends program, PLOs and passed courses only, best grade first, flagging low PLOs', async () => {
    messagesParse.mockResolvedValue({
      stop_reason: 'end_turn',
      parsed_output: { overview: 'o', careers: [] },
    });
    const { service } = setup('sk-test-placeholder');

    await service.getCareerSuggestions('profile-1', user);

    const sent = JSON.parse(messagesParse.mock.calls[0][0].messages[0].content);
    expect(sent).toEqual({
      program: 'เทคโนโลยีสารสนเทศและการสื่อสาร',
      yearLevel: 3,
      gpa: 3.1,
      plos: [
        { code: 'PLO1', name: 'Programming', value: 82, belowThreshold: false },
        { code: 'PLO3', name: 'Data', value: 59, belowThreshold: true },
      ],
      passedCourses: [
        { code: '02739342', name: 'การพัฒนาโปรแกรมประยุกต์สำหรับอุปกรณ์เคลื่อนที่', grade: 'A' },
        { code: '02739112', name: 'หลักการเขียนโปรแกรม', grade: 'B_PLUS' },
        { code: '02739221', name: 'ระบบฐานข้อมูล', grade: 'C' },
      ],
    });
  });

  it('returns the careers with supporting courses named from the transcript', async () => {
    messagesParse.mockResolvedValue({
      stop_reason: 'end_turn',
      parsed_output: {
        overview: 'ผลการเรียนบ่งชี้ไปทางการพัฒนาซอฟต์แวร์',
        careers: [
          {
            title: 'นักพัฒนาแอปพลิเคชันมือถือ (Mobile Developer)',
            fit: 'STRONG',
            reason: 'r',
            supportingCourses: ['02739342', '99999999', '02739342'],
            skillsToBuild: ['การจัดการข้อมูล'],
          },
        ],
      },
    });
    const { service } = setup('sk-test-placeholder');

    const report = await service.getCareerSuggestions('profile-1', user);

    expect(report.overview).toBe('ผลการเรียนบ่งชี้ไปทางการพัฒนาซอฟต์แวร์');
    expect(report.careers[0].supportingCourses).toEqual([
      { code: '02739342', name: 'การพัฒนาโปรแกรมประยุกต์สำหรับอุปกรณ์เคลื่อนที่' },
    ]);
  });

  it('answers without calling the model when nothing has been passed yet', async () => {
    const { service } = setup('sk-test-placeholder', { passed: [] });

    const report = await service.getCareerSuggestions('profile-1', user);

    expect(report.careers).toEqual([]);
    expect(messagesParse).not.toHaveBeenCalled();
  });
});

describe('groundCareers', () => {
  it('keeps at most five careers', () => {
    const career = { title: 't', fit: 'GOOD' as const, reason: 'r', supportingCourses: [], skillsToBuild: [] };
    expect(groundCareers(Array(7).fill(career), new Map())).toHaveLength(5);
  });
});
