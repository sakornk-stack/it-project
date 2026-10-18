import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { DashboardService } from '../dashboard/dashboard.service';
import { AiAnalysisService, isAiEnabled } from './ai-analysis.service';

const messagesCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ messages: { create: messagesCreate } })),
}));
const AnthropicMock = Anthropic as unknown as jest.Mock;

const UNAVAILABLE_MESSAGE =
  'บริการวิเคราะห์ด้วย AI ไม่สามารถให้บริการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง';
const user = { userId: 'student-user', roles: ['STUDENT'] } as never;

const gradedDashboard = {
  studentProfileId: 'profile-1',
  gpa: 3.1,
  creditsEarned: 60,
  creditsRemaining: 66,
  totalCreditsRequired: 126,
  curriculumProgressPercent: 48,
  graduationReadiness: 'ON_TRACK',
  radar: [{ code: 'PLO1', name: 'Programming', value: 72 }],
  strengths: [],
  areasForImprovement: [],
  recentCourses: [],
  missingRequiredCourses: [],
  incompleteElectiveCategories: [],
};

function setup(apiKey: string | undefined) {
  const config = {
    get: jest.fn((key: string) => (key === 'ai.anthropicApiKey' ? apiKey : 'test-model')),
  };
  const dashboardService = { getStudentDashboard: jest.fn().mockResolvedValue(gradedDashboard) };
  const service = new AiAnalysisService(
    config as unknown as ConfigService,
    dashboardService as unknown as DashboardService,
  );
  return { service, dashboardService };
}

beforeEach(() => {
  AnthropicMock.mockClear();
  messagesCreate.mockReset();
});

describe('isAiEnabled', () => {
  it.each([undefined, '', '   ', 'disabled', ' Disabled ', 'DISABLED'])('is off for %p', (key) => {
    expect(isAiEnabled(key)).toBe(false);
  });

  it('is on for any other non-empty key', () => {
    expect(isAiEnabled('sk-test-placeholder')).toBe(true);
  });
});

describe('AiAnalysisService when AI is disabled', () => {
  it.each([undefined, '', 'disabled', ' Disabled '])(
    'with key %p: answers 503 before reading data or calling the SDK',
    async (key) => {
      const { service, dashboardService } = setup(key);

      const error = await service.getStudentAnalysis('profile-1', user).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).message).toBe(UNAVAILABLE_MESSAGE);
      expect(dashboardService.getStudentDashboard).not.toHaveBeenCalled();
      expect(AnthropicMock).not.toHaveBeenCalled();
      expect(messagesCreate).not.toHaveBeenCalled();
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
    messagesCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          name: 'submit_skill_analysis',
          input: { summary: 's', strengths: [], weaknesses: [], recommendations: [] },
        },
      ],
    });
    const { service } = setup('sk-test-placeholder');

    await service.getStudentAnalysis('profile-1', user);
    await service.getStudentAnalysis('profile-1', user);

    expect(AnthropicMock).toHaveBeenCalledTimes(1);
    expect(messagesCreate).toHaveBeenCalledTimes(2);
  });

  it('hides the provider error behind the generic Thai message', async () => {
    messagesCreate.mockRejectedValue(new Error('401 invalid x-api-key request-id=abc123'));
    const { service } = setup('sk-test-placeholder');

    const error = await service.getStudentAnalysis('profile-1', user).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    const body = JSON.stringify((error as ServiceUnavailableException).getResponse());
    expect(body).toContain(UNAVAILABLE_MESSAGE);
    expect(body).not.toContain('x-api-key');
    expect(body).not.toContain('abc123');
  });
});
