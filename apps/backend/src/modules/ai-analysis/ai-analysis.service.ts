import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { betaJSONSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditCheckerService } from '../academic-record/credit-checker/credit-checker.service';
import { GRADE_POINTS } from '../academic-record/student-course-record/grade-point.constant';
import { RequestUser } from '../auth/request-user.interface';
import { DashboardService } from '../dashboard/dashboard.service';
import { StudentDashboardReport } from '../dashboard/dashboard-report.interface';
import {
  AiCareerFitLevel,
  AiCareerSuggestion,
  AiCareerSuggestionReport,
  AiSkillAnalysisReport,
} from './ai-analysis-report.interface';

const NO_DATA_SUMMARY = 'ยังไม่มีข้อมูลผลการเรียนเพียงพอสำหรับการวิเคราะห์';
const UNAVAILABLE_MESSAGE =
  'บริการวิเคราะห์ด้วย AI ไม่สามารถให้บริการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง';
// The model may think before answering (adaptive thinking is always on for the
// current models), so a request can take well over the SDK's usual 20s.
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_CAREERS = 5;

// Only something shaped like an Anthropic API key ("sk-…") turns AI analysis
// on; an empty key, "disabled" (production default, see deploy/make-env.sh) or
// a template placeholder such as "change_me…" keeps it off. It must be checked
// before any request is built: the SDK would otherwise send the student's data
// to the provider and only then be rejected for the bad key.
export function isAiEnabled(apiKey: string | undefined): boolean {
  return (apiKey ?? '').trim().startsWith('sk-');
}

// §25: AI interprets already-computed numbers, never invents new ones — the
// output schemas below are qualitative-only (no numeric fields) so "don't
// fabricate a number" is a property of the output shape, not just an
// instruction the model might drift from. Structured outputs guarantee the
// shape, so the reply needs no tool call (forced tool_choice is refused by
// the current models).
const SKILL_ANALYSIS_SCHEMA = {
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
      description: '2-4 ข้อ อ้างอิงเฉพาะ PLO/CLO ที่มีค่าต่ำหรือยังไม่มีข้อมูลใน input',
    },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
      description:
        '2-4 ข้อ ต้องอิงจาก missingRequiredCourses/incompleteElectiveCategories ที่ให้มา ไม่ใช่คำแนะนำทั่วไปลอยๆ',
    },
  },
  required: ['summary', 'strengths', 'weaknesses', 'recommendations'],
  additionalProperties: false,
} as const;

const CAREER_SCHEMA = {
  type: 'object',
  properties: {
    overview: {
      type: 'string',
      description: '2-3 ประโยค ภาพรวมว่าผลการเรียนชี้ไปทางสายงานแบบใด ใช้ภาษา hedge',
    },
    careers: {
      type: 'array',
      description: '3-5 อาชีพ เรียงจากที่ข้อมูลสนับสนุนมากที่สุด',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'ชื่ออาชีพภาษาไทย ตามด้วยชื่อภาษาอังกฤษในวงเล็บ' },
          fit: {
            type: 'string',
            enum: ['STRONG', 'GOOD', 'WORTH_EXPLORING'],
            description:
              'STRONG = รายวิชา/PLO ที่เกี่ยวข้องมีผลดีหลายวิชา, GOOD = มีหลักฐานบางส่วน, WORTH_EXPLORING = หลักฐานน้อยแต่น่าลอง',
          },
          reason: {
            type: 'string',
            description:
              '2-3 ประโยค อ้างอิงรายวิชาหรือ PLO จาก input โดยตรง ห้ามสรุปว่านิสิต "ทำได้" ให้ใช้ "มีแนวโน้ม/ผลการเรียนบ่งชี้"',
          },
          supportingCourses: {
            type: 'array',
            items: { type: 'string' },
            description: 'รหัสวิชา 1-4 รหัส ต้องเป็นรหัสที่อยู่ใน passedCourses ของ input เท่านั้น',
          },
          skillsToBuild: {
            type: 'array',
            items: { type: 'string' },
            description: '2-3 ทักษะหรือสิ่งที่ควรเรียน/ฝึกเพิ่มเพื่อไปสายนี้ โดยเฉพาะจุดที่ PLO ยังต่ำ',
          },
        },
        required: ['title', 'fit', 'reason', 'supportingCourses', 'skillsToBuild'],
        additionalProperties: false,
      },
    },
  },
  required: ['overview', 'careers'],
  additionalProperties: false,
} as const;

const SKILL_SYSTEM_PROMPT = `คุณเป็นผู้ช่วยตีความข้อมูลผลการเรียนสำหรับระบบ EduAnalyzeAI หน้าที่ของคุณคือ "ตีความ" ข้อมูลที่ระบบคำนวณไว้แล้วเท่านั้น ไม่ใช่คำนวณหรือสร้างตัวเลขใหม่

กฎที่ต้องปฏิบัติตามทุกข้อ:

1. ห้ามสร้างตัวเลข CLO/PLO/GPA/หน่วยกิตใหม่ที่ไม่ปรากฏใน INPUT DATA ที่ให้มา คุณอ้างอิงตัวเลขที่ให้มาได้ แต่ห้ามคำนวณ ประมาณการ หรือเดาตัวเลขใหม่ใดๆ

2. ห้ามสรุปความสามารถจริงเกินหลักฐาน ตัวอย่างข้อความที่ห้ามใช้: "นิสิตคนนี้เขียนโปรแกรมได้" (Grade เพียงอย่างเดียวไม่สามารถพิสูจน์ความสามารถจริงได้)
   ควรใช้ภาษาเช่นนี้แทน: "จากผลการเรียนในรายวิชาและ CLO ที่เกี่ยวข้องกับการพัฒนาโปรแกรม นิสิตมีผลสัมฤทธิ์ในด้านการพัฒนาและออกแบบระบบอยู่ในระดับสูง"
   ใช้ภาษาว่า: "จากข้อมูลผลการเรียน...", "จาก CLO ที่เกี่ยวข้อง...", "ผลสัมฤทธิ์บ่งชี้ว่า...", "มีแนวโน้มว่า...", "อยู่ในระดับ..." เท่านั้น

3. ทุกข้อความต้องอ้างอิงกลับไปยัง INPUT DATA เท่านั้น (grade, CLO/PLO achievement percent, GPA, credits, learning path) ห้ามใช้ความรู้ทั่วไปภายนอกมาตัดสินความสามารถของนิสิต

4. ตอบเป็นภาษาไทยเท่านั้น`;

const CAREER_SYSTEM_PROMPT = `คุณเป็นผู้ช่วยแนะแนวอาชีพสำหรับนิสิตมหาวิทยาลัยในระบบ EduAnalyzeAI งานของคุณคือดูผลการเรียนที่ระบบคำนวณไว้แล้ว แล้วเสนอสายอาชีพที่ผลการเรียนสนับสนุน เพื่อให้นิสิตใช้เป็นจุดเริ่มต้นในการคุยกับอาจารย์ที่ปรึกษา ไม่ใช่คำตัดสิน

วิธีคิด:
- ดูว่ารายวิชาที่ผ่าน (passedCourses) และ PLO ที่ได้ค่าสูง ชี้ไปทางงานแบบใด ใช้ความรู้ทั่วไปเรื่องลักษณะงานของแต่ละอาชีพได้ แต่ทุกเหตุผลต้องโยงกลับไปที่รายวิชาหรือ PLO ใน input ที่มีอยู่จริง
- เสนออาชีพที่สอดคล้องกับสาขา (program) ของนิสิต และให้ฐานะตามหลักฐาน: เกรดดีหลายวิชาในกลุ่มเดียวกันคือหลักฐานที่แข็งกว่าวิชาเดียว
- PLO ที่ต่ำกว่าเกณฑ์ (belowThreshold) ใช้เป็น skillsToBuild ของอาชีพที่ต้องใช้ทักษะนั้น อย่าซ่อน

ข้อห้าม:
- ห้ามสร้างตัวเลขใหม่ (เปอร์เซ็นต์ความเหมาะสม เงินเดือน คะแนน) ที่ไม่ได้อยู่ใน input
- ห้ามบอกว่านิสิต "ทำอาชีพนี้ได้" หรือ "มีความสามารถ" ให้ใช้ "ผลการเรียนบ่งชี้ว่า...", "มีแนวโน้มเหมาะกับ..." เพราะเกรดอย่างเดียวพิสูจน์ความสามารถจริงไม่ได้
- supportingCourses ใส่ได้เฉพาะรหัสวิชาที่อยู่ใน passedCourses

ตอบเป็นภาษาไทย`;

interface PromptRadarPoint {
  code: string;
  name: string;
  value: number | null;
}

interface SkillPromptInput {
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
function buildSkillPromptInput(report: StudentDashboardReport): SkillPromptInput {
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

interface CareerPromptInput {
  program: string;
  yearLevel: number;
  gpa: number | null;
  plos: (PromptRadarPoint & { belowThreshold: boolean })[];
  passedCourses: { code: string; name: string; grade: string }[];
}

function hasNoGradedData(report: StudentDashboardReport): boolean {
  return report.radar.length === 0 || report.radar.every((r) => r.value === null);
}

interface SkillResult {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

interface CareerResult {
  overview: string;
  careers: {
    title: string;
    fit: AiCareerFitLevel;
    reason: string;
    supportingCourses: string[];
    skillsToBuild: string[];
  }[];
}

// Drops course codes the model was not given (it may only cite passed courses)
// and caps the list; a career left with no evidence still stands on its reason.
export function groundCareers(
  careers: CareerResult['careers'],
  passed: Map<string, string>,
): AiCareerSuggestion[] {
  return careers.slice(0, MAX_CAREERS).map((career) => ({
    title: career.title,
    fit: career.fit,
    reason: career.reason,
    supportingCourses: [...new Set(career.supportingCourses)]
      .filter((code) => passed.has(code))
      .map((code) => ({ code, name: passed.get(code)! })),
    skillsToBuild: career.skillsToBuild,
  }));
}

@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name);
  private client?: Anthropic;
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly dashboardService: DashboardService,
    private readonly creditCheckerService: CreditCheckerService,
    private readonly prisma: PrismaService,
  ) {
    this.model = this.configService.get<string>('ai.model')!;
  }

  // Created on first real use only, so a disabled deployment never builds a
  // client (the SDK constructor also throws on an empty key).
  private getClient(): Anthropic {
    this.client ??= new Anthropic({
      apiKey: this.configService.get<string>('ai.anthropicApiKey'),
      timeout: REQUEST_TIMEOUT_MS,
    });
    return this.client;
  }

  // Before reading any data or building a prompt: nothing about the student
  // is assembled, let alone sent, while AI is off.
  private assertEnabled(what: string) {
    if (!isAiEnabled(this.configService.get<string>('ai.anthropicApiKey'))) {
      this.logger.warn(`${what} requested while AI is disabled`);
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }
  }

  // Self-ownership enforced inside getStudentDashboard (via checkCredits) —
  // reused here rather than re-derived (CONVENTIONS.md §6). NotFoundException
  // from that check propagates untouched.
  async getStudentAnalysis(
    studentProfileId: string,
    user: RequestUser,
  ): Promise<AiSkillAnalysisReport> {
    this.assertEnabled('AI skill analysis');

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

    const result = await this.ask<SkillResult>(
      SKILL_SYSTEM_PROMPT,
      buildSkillPromptInput(dashboard),
      SKILL_ANALYSIS_SCHEMA,
    );

    return {
      studentProfileId: dashboard.studentProfileId,
      generatedAt: new Date().toISOString(),
      summary: result.summary,
      strengths: result.strengths,
      weaknesses: result.weaknesses,
      recommendations: result.recommendations,
    };
  }

  // Careers the student's record points to. Ownership: checkCredits and the
  // dashboard both resolve the caller's own profile first. Sent to the model:
  // program name, year level, GPA, PLO values and passed courses with grades
  // only — never the student's name, code or email.
  async getCareerSuggestions(
    studentProfileId: string,
    user: RequestUser,
  ): Promise<AiCareerSuggestionReport> {
    this.assertEnabled('AI career suggestion');

    const [dashboard, credit] = await Promise.all([
      this.dashboardService.getStudentDashboard(studentProfileId, user),
      this.creditCheckerService.checkCredits(studentProfileId, user),
    ]);

    const empty = (overview: string): AiCareerSuggestionReport => ({
      studentProfileId: dashboard.studentProfileId,
      generatedAt: new Date().toISOString(),
      overview,
      careers: [],
    });
    if (credit.passedCourses.length === 0) return empty(NO_DATA_SUMMARY);

    const profile = await this.prisma.studentProfile.findUniqueOrThrow({
      where: { id: dashboard.studentProfileId },
      select: {
        program: { select: { name: true } },
        curriculum: { select: { defaultAchievementThreshold: true } },
      },
    });
    const threshold = profile.curriculum.defaultAchievementThreshold;
    const input: CareerPromptInput = {
      program: profile.program.name,
      yearLevel: dashboard.yearLevel,
      gpa: dashboard.gpa,
      plos: dashboard.radar.map((p) => ({
        ...toRadarPoint(p),
        belowThreshold: p.value !== null && p.value < threshold,
      })),
      // Best grades first, so the strongest evidence leads.
      passedCourses: [...credit.passedCourses]
        .sort((a, b) => (GRADE_POINTS[b.grade!] ?? 0) - (GRADE_POINTS[a.grade!] ?? 0))
        .map((c) => ({ code: c.code, name: c.name, grade: c.grade! })),
    };

    const result = await this.ask<CareerResult>(CAREER_SYSTEM_PROMPT, input, CAREER_SCHEMA);
    const passed = new Map(credit.passedCourses.map((c) => [c.code, c.name]));
    return {
      studentProfileId: dashboard.studentProfileId,
      generatedAt: new Date().toISOString(),
      overview: result.overview,
      careers: groundCareers(result.careers, passed),
    };
  }

  // One structured request. Server-side fallbacks ("default") re-run a
  // request the model declines on a fallback model inside the same call; a
  // refusal that still stands, an unparsable reply or any provider error
  // becomes the generic Thai 503 (the provider's own message may carry
  // request ids or key hints and is only logged).
  private async ask<T>(
    system: string,
    input: object,
    schema: Parameters<typeof betaJSONSchemaOutputFormat>[0],
  ): Promise<T> {
    try {
      const response = await this.getClient().beta.messages.parse({
        model: this.model,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: betaJSONSchemaOutputFormat(schema) },
        system,
        messages: [{ role: 'user', content: JSON.stringify(input) }],
      });
      if (response.stop_reason === 'refusal') {
        throw new Error(`AI declined the request (${response.stop_details?.category ?? 'unknown'})`);
      }
      if (!response.parsed_output) {
        throw new Error(`AI reply could not be parsed (stop_reason ${response.stop_reason})`);
      }
      return response.parsed_output as T;
    } catch (error) {
      this.logger.error('AI request failed', error as Error);
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }
  }
}
