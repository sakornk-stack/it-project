import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { RequestUser } from '../auth/request-user.interface';
import { DashboardService } from '../dashboard/dashboard.service';
import { StudentDashboardReport } from '../dashboard/dashboard-report.interface';
import { AiSkillAnalysisReport } from './ai-analysis-report.interface';

const NO_DATA_SUMMARY = 'ยังไม่มีข้อมูลผลการเรียนเพียงพอสำหรับการวิเคราะห์';

// §25: AI interprets already-computed numbers, never invents new ones —
// the tool schema below is qualitative-only (no numeric fields) so "don't
// fabricate a number" is a property of the output shape, not just an
// instruction the model might drift from.
const SKILL_ANALYSIS_TOOL: Anthropic.Tool = {
  name: 'submit_skill_analysis',
  description: 'ส่งผลการตีความข้อมูลผลการเรียนที่คำนวณไว้แล้ว เป็นภาษาไทย',
  input_schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description:
          '3-5 ประโยค สรุปภาพรวม ใช้ภาษา hedge เท่านั้น ห้ามระบุตัวเลขใหม่ที่ไม่ปรากฏใน input',
      },
      strengths: {
        type: 'array',
        items: { type: 'string' },
        description: '2-4 ข้อ อ้างอิงเฉพาะ PLO/CLO ที่มีค่าสูงใน input',
      },
      weaknesses: {
        type: 'array',
        items: { type: 'string' },
        description:
          '2-4 ข้อ อ้างอิงเฉพาะ PLO/CLO ที่มีค่าต่ำหรือยังไม่มีข้อมูลใน input',
      },
      recommendations: {
        type: 'array',
        items: { type: 'string' },
        description:
          '2-4 ข้อ ต้องอิงจาก missingRequiredCourses/incompleteElectiveCategories ที่ให้มา ไม่ใช่คำแนะนำทั่วไปลอยๆ',
      },
    },
    required: ['summary', 'strengths', 'weaknesses', 'recommendations'],
  },
};

const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยตีความข้อมูลผลการเรียนสำหรับระบบ EduAnalyzeAI หน้าที่ของคุณคือ "ตีความ" ข้อมูลที่ระบบคำนวณไว้แล้วเท่านั้น ไม่ใช่คำนวณหรือสร้างตัวเลขใหม่

กฎเคร่งครัดที่ต้องปฏิบัติตามทุกข้อ:

1. ห้ามสร้างตัวเลข CLO/PLO/GPA/หน่วยกิตใหม่ที่ไม่ปรากฏใน INPUT DATA ที่ให้มา คุณอ้างอิงตัวเลขที่ให้มาได้ แต่ห้ามคำนวณ ประมาณการ หรือเดาตัวเลขใหม่ใดๆ

2. ห้ามสรุปความสามารถจริงเกินหลักฐาน ตัวอย่างข้อความที่ห้ามใช้: "นิสิตคนนี้เขียนโปรแกรมได้" (Grade เพียงอย่างเดียวไม่สามารถพิสูจน์ความสามารถจริงได้)
   ควรใช้ภาษาเช่นนี้แทน: "จากผลการเรียนในรายวิชาและ CLO ที่เกี่ยวข้องกับการพัฒนาโปรแกรม นิสิตมีผลสัมฤทธิ์ในด้านการพัฒนาและออกแบบระบบอยู่ในระดับสูง"
   ใช้ภาษาว่า: "จากข้อมูลผลการเรียน...", "จาก CLO ที่เกี่ยวข้อง...", "ผลสัมฤทธิ์บ่งชี้ว่า...", "มีแนวโน้มว่า...", "อยู่ในระดับ..." เท่านั้น

3. ทุกข้อความต้องอ้างอิงกลับไปยัง INPUT DATA เท่านั้น (grade, CLO/PLO achievement percent, GPA, credits, learning path) ห้ามใช้ความรู้ทั่วไปภายนอกมาตัดสินความสามารถของนิสิต

4. ตอบเป็นภาษาไทยเท่านั้น

5. ส่งคำตอบผ่าน tool submit_skill_analysis เท่านั้น`;

interface PromptRadarPoint {
  code: string;
  name: string;
  value: number | null;
}

interface PromptInput {
  gpa: number | null;
  creditsEarned: number;
  creditsRemaining: number;
  totalCreditsRequired: number;
  curriculumProgressPercent: number;
  graduationReadiness: StudentDashboardReport['graduationReadiness'];
  radar: PromptRadarPoint[];
  strengths: PromptRadarPoint[];
  areasForImprovement: PromptRadarPoint[];
  recentCourses: { code: string; name: string; grade: string; credits: number }[];
  missingRequiredCourses: { code: string; name: string; credits: number; isPrerequisiteSatisfied: boolean }[];
  incompleteElectiveCategories: { name: string; creditsEarned: number; minCredits: number; creditsShort: number }[];
}

function toRadarPoint(p: { code: string; name: string; value: number | null }): PromptRadarPoint {
  return { code: p.code, name: p.name, value: p.value };
}

// Strips internal ids (courseId/ploId) — the model only needs code/name/
// value/grade to interpret, nothing else from the dashboard report.
function buildPromptInput(report: StudentDashboardReport): PromptInput {
  return {
    gpa: report.gpa,
    creditsEarned: report.creditsEarned,
    creditsRemaining: report.creditsRemaining,
    totalCreditsRequired: report.totalCreditsRequired,
    curriculumProgressPercent: report.curriculumProgressPercent,
    graduationReadiness: report.graduationReadiness,
    radar: report.radar.map(toRadarPoint),
    strengths: report.strengths.map(toRadarPoint),
    areasForImprovement: report.areasForImprovement.map(toRadarPoint),
    recentCourses: report.recentCourses.map((c) => ({
      code: c.code,
      name: c.name,
      grade: c.grade,
      credits: c.credits,
    })),
    missingRequiredCourses: report.missingRequiredCourses.map((c) => ({
      code: c.code,
      name: c.name,
      credits: c.credits,
      isPrerequisiteSatisfied: c.isPrerequisiteSatisfied,
    })),
    incompleteElectiveCategories: report.incompleteElectiveCategories.map((c) => ({
      name: c.name,
      creditsEarned: c.creditsEarned,
      minCredits: c.minCredits,
      creditsShort: c.creditsShort,
    })),
  };
}

function hasNoGradedData(report: StudentDashboardReport): boolean {
  return report.radar.length === 0 || report.radar.every((r) => r.value === null);
}

interface ToolResult {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name);
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly dashboardService: DashboardService,
  ) {
    this.client = new Anthropic({
      apiKey: this.configService.get<string>('ai.anthropicApiKey'),
      timeout: 20000,
    });
    this.model = this.configService.get<string>('ai.model')!;
  }

  // Self-ownership enforced inside getStudentDashboard (via checkCredits) —
  // reused here rather than re-derived (CONVENTIONS.md §6). NotFoundException
  // from that check propagates untouched.
  async getStudentAnalysis(
    studentProfileId: string,
    user: RequestUser,
  ): Promise<AiSkillAnalysisReport> {
    const dashboard = await this.dashboardService.getStudentDashboard(
      studentProfileId,
      user,
    );

    if (hasNoGradedData(dashboard)) {
      return {
        studentProfileId: dashboard.studentProfileId,
        generatedAt: new Date().toISOString(),
        summary: NO_DATA_SUMMARY,
        strengths: [],
        weaknesses: [],
        recommendations: [],
      };
    }

    const promptInput = buildPromptInput(dashboard);
    const result = await this.callAnthropic(promptInput);

    return {
      studentProfileId: dashboard.studentProfileId,
      generatedAt: new Date().toISOString(),
      summary: result.summary,
      strengths: result.strengths,
      weaknesses: result.weaknesses,
      recommendations: result.recommendations,
    };
  }

  private async callAnthropic(promptInput: PromptInput): Promise<ToolResult> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(promptInput) }],
        tools: [SKILL_ANALYSIS_TOOL],
        tool_choice: { type: 'tool', name: SKILL_ANALYSIS_TOOL.name },
      });

      const toolUse = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      );
      if (!toolUse) {
        throw new Error('AI response did not include the expected tool call');
      }
      return toolUse.input as ToolResult;
    } catch (error) {
      this.logger.error('AI skill analysis call failed', error as Error);
      throw new ServiceUnavailableException(
        'บริการวิเคราะห์ด้วย AI ไม่สามารถให้บริการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
      );
    }
  }
}
