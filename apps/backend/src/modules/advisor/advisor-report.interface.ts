import { Grade, SemesterTerm } from '@prisma/client';
import { CreditCheckReport } from '../academic-record/credit-checker/credit-checker-report.interface';
import { GpaResult } from '../academic-record/student-course-record/student-course-record.service';
import { StudentPloAchievementReport } from '../curriculum-content/plo-achievement/plo-achievement-report.interface';

// GET /advisor/students — one row per advisee, mirrored in shared-types.
export interface AdviseeSummary {
  id: string;
  studentCode: string;
  fullName: string;
  programCode: string;
  programName: string;
  curriculumVersion: string;
  admissionYear: number;
  isActive: boolean;
  gpa: number | null;
  creditsAccumulated: number;
  totalCreditsRequired: number;
  graduationReady: boolean;
}

export interface AdviseeCourseRecord {
  id: string;
  grade: Grade;
  credits: number;
  course: { id: string; code: string; name: string };
  semesterId: string;
  semesterTerm: SemesterTerm;
  academicYear: number;
}

// GET /advisor/students/:id
export interface AdviseeDetail {
  student: AdviseeSummary;
  gpa: GpaResult;
  records: AdviseeCourseRecord[];
  creditCheck: CreditCheckReport;
  ploAchievement: StudentPloAchievementReport;
  // The curriculum's PLO pass mark (percent).
  ploThreshold: number;
}
