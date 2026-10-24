# EduAnalyzeAI — MASTER PROJECT CONTEXT

โปรดอ่านและทำความเข้าใจ Project Context นี้ก่อนแก้ไขหรือออกแบบระบบ EduAnalyzeAI

นี่คือ requirement ปัจจุบันของโปรเจกต์ และให้ถือ requirement นี้เป็นหลัก หากพบ code เก่าที่ขัดกับ requirement นี้ ห้ามยึด code เก่าเป็น architecture หลักโดยอัตโนมัติ

หาก code ปัจจุบันขัดกับ requirement ให้รายงานออกมา
ห้ามเดา requirement เพิ่มเอง
หากมีจุดที่ requirement ยังไม่ชัดเจน ให้ถามก่อน implement

==================================================
1. PROJECT OVERVIEW
==================================================

ชื่อระบบ: EduAnalyzeAI

EduAnalyzeAI คือระบบติดตามความก้าวหน้าทางการศึกษาและวิเคราะห์ผลลัพธ์การเรียนรู้ตามหลักสูตร

เป้าหมายหลัก:
1. ให้นิสิตติดตามความก้าวหน้าตามหลักสูตรของตัวเอง
2. นิสิตบันทึกรายวิชาและเกรดของตัวเอง
3. ระบบคำนวณ GPA และหน่วยกิต
4. ระบบตรวจว่านิสิตเรียนอะไรไปแล้ว
5. ตรวจว่ายังขาดรายวิชา/หมวด/หน่วยกิตอะไร
6. ตรวจความพร้อมในการสำเร็จการศึกษา
7. เชื่อม Course → CLO → PLO
8. วิเคราะห์ Learning Outcome จากข้อมูลการเรียน
9. แสดงผลเป็น Dashboard และ Radar Chart
10. ใช้ AI ช่วย "อธิบายผลการวิเคราะห์" ไม่ใช่สร้างคะแนนขึ้นมาเอง
11. วิเคราะห์ได้ทั้งระดับ: รายบุคคล / รายวิชา / ชั้นปี-Cohort / หลักสูตร
12. รองรับหลายคณะ หลายภาควิชา หลายสาขา และหลายปีหลักสูตร
13. ผู้ใช้งานต้องเห็นข้อมูลตาม Role และ Scope ที่ตัวเองรับผิดชอบเท่านั้น

==================================================
2. CORE SYSTEM
==================================================

หัวใจของระบบแบ่งเป็น 4 ส่วน

A. Academic Progress
ระบบต้องตอบได้ว่า: นิสิตเรียนอะไรไปแล้ว, เรียนเทอมไหน, ปีการศึกษาอะไร, ได้เกรดอะไร,
ผ่านหรือไม่ผ่าน, ได้หน่วยกิตเท่าไร, GPA เทอม, GPA สะสม, หน่วยกิตสะสม, หน่วยกิตที่เหลือ,
วิชาบังคับที่ยังขาด, วิชาเลือกที่ยังขาด, หมวดวิชาที่ยังไม่ครบ, Prerequisite ที่ยังไม่ผ่าน,
พร้อมสำเร็จการศึกษาหรือไม่

B. CLO / PLO Analytics
ความสัมพันธ์หลัก: Curriculum → Course → CLO → PLO
ผลการเรียนของนิสิตจะถูกนำมาประกอบการวิเคราะห์ CLO/PLO

C. Skill / Learning Outcome Analysis
วิเคราะห์: จุดแข็ง, จุดที่ควรพัฒนา, Learning Outcome, Radar Chart, AI Summary, Recommendation
วิเคราะห์ได้ระดับ: Student, Course, Cohort/ชั้นปี, Curriculum

D. Curriculum Management
แต่ละ Program/สาขา: มี Curriculum ของตัวเอง, มี Curriculum หลาย Version/Year ได้,
แต่ละ Curriculum มี Course ของตัวเอง, มี Curriculum Requirements,
มี CLO/PLO และ Mapping ที่สัมพันธ์กับหลักสูตรนั้น

==================================================
3. ORGANIZATION STRUCTURE
==================================================

โครงสร้างองค์กรต้องเป็น: Faculty → Department → Program → Curriculum

ความสัมพันธ์:
- 1 Faculty มีหลาย Department
- 1 Department อยู่ใน Faculty เดียว
- 1 Department มีหลาย Program
- 1 Program อยู่ใน Department เดียว
- 1 Program มีหลาย Curriculum Version/Year ได้

ตัวอย่าง: คณะศิลปศาสตร์และวิทยาศาสตร์ → ภาควิชาวิทยาการคำนวณและเทคโนโลยีดิจิทัล →
สาขาเทคโนโลยีสารสนเทศและการสื่อสาร → หลักสูตร พ.ศ. 2564 / 2569

==================================================
4. DEPENDENT SELECTION
==================================================

Frontend และ Backend ต้องบังคับความสัมพันธ์ของข้อมูล ลักษณะเหมือน: จังหวัด → อำเภอ → ตำบล

สำหรับระบบนี้: Faculty → Department → Program → Curriculum

ถ้าเลือก Faculty A ต้องแสดงเฉพาะ Department ที่อยู่ Faculty A
ถ้าเลือก Department B ต้องแสดงเฉพาะ Program ที่อยู่ Department B
ถ้าเลือก Program C ต้องแสดงเฉพาะ Curriculum ที่อยู่ Program C

IMPORTANT: Frontend filter อย่างเดียวไม่เพียงพอ Backend ต้อง validate ความสัมพันธ์อีกครั้ง
ห้าม client ส่ง Faculty A + Department ที่จริงอยู่ Faculty B แล้ว Backend ยอมรับ
เช่นเดียวกันกับ Department ↔ Program, Program ↔ Curriculum

==================================================
5. CURRICULUM VERSION
==================================================

Program หนึ่งสามารถมีหลาย Curriculum เช่น สาขา ICT: หลักสูตร พ.ศ. 2559 / 2564 / 2569

นิสิตต้องเลือก Curriculum ที่ตัวเองใช้ตอน Register
Student จึงต้องผูกกับ Curriculum ที่ชัดเจน
ระบบ Smart Credit Checker ต้องใช้ Curriculum ของ Student คนนั้น
ห้ามเอาหลักสูตรคนละปีมาคำนวณรวมกัน

Curriculum แต่ละเวอร์ชันต้อง coexist และใช้งานได้พร้อมกันจริง เพราะนิสิตรุ่นเก่าที่ยัง
เรียนไม่จบต้องอ้างอิง Curriculum เดิมของตัวเองต่อไปจนจบ ไม่ใช่มีแค่ 1 เวอร์ชันที่ "active"
ต่อ Program ในเวลาเดียวกัน (isActive คือ soft-delete flag เท่านั้น แยกจาก
"เปิดรับนักศึกษาใหม่หรือไม่" ซึ่งเป็นอีก field/concept หนึ่ง)

==================================================
6. EXAMPLE ORGANIZATION DATA
==================================================

ตัวอย่างข้อมูลจริงของคณะศิลปศาสตร์และวิทยาศาสตร์:

ภาควิชาบริหารธุรกิจและการบัญชี: การตลาด พ.ศ. 2565, การบัญชี พ.ศ. 2564, การจัดการ พ.ศ. 2565
ภาควิชาสังคมศาสตร์: การเมืองและการปกครอง พ.ศ. 2567
ภาควิชาวิทยาการคำนวณและเทคโนโลยีดิจิทัล: เทคโนโลยีสารสนเทศและการสื่อสาร พ.ศ. 2569/2559/2564,
  คณิตศาสตร์ประยุกต์ พ.ศ. 2565, วิทยาการคอมพิวเตอร์ พ.ศ. 2565
ภาควิชาวิทยาศาสตร์และนวัตกรรมชีวภาพ: พฤกษนวัตกรรม พ.ศ. 2565, จุลชีววิทยา พ.ศ. 2565,
  วิทยาศาสตร์ชีวภาพ พ.ศ. 2566
ภาควิชาวิทยาการภาษาและวัฒนธรรม: ภาษาอังกฤษ พ.ศ. 2568, ภาษาอังกฤษ พ.ศ. 2563
ภาควิชาวิทยาศาสตร์กายภาพและวัสดุศาสตร์: ฟิสิกส์ พ.ศ. 2566, เคมี พ.ศ. 2565

ระบบต้องออกแบบแบบ generic ห้าม hardcode ให้ใช้ได้เฉพาะ IT
อนาคตต้องสามารถเพิ่ม Faculty / Department / Program / Curriculum อื่นได้

==================================================
7. ROLES
==================================================

ระบบมี 5 Roles: STUDENT, INSTRUCTOR, STAFF, ADMIN, SUPER_ADMIN

==================================================
8. STUDENT
==================================================

STUDENT ใช้งานระบบเพื่อติดตามข้อมูลของตัวเองเท่านั้น สามารถ: ดู Profile ตัวเอง,
ดู Dashboard ตัวเอง, เพิ่มรายวิชาที่ตัวเองเรียน, กรอก Grade, แก้ Grade ของตัวเอง,
ลบข้อมูลที่ตัวเองกรอก, ดู GPA, ดูหน่วยกิต, ดู Academic Progress, ดู Smart Credit Checker,
ดู PLO ของตัวเอง, ดู Radar Chart ตัวเอง, ดู AI Analysis ตัวเอง, ทำ Course Assessment,
ใช้ Learning Path Planner

ห้าม: ดูข้อมูล Student คนอื่น, แก้ Curriculum, แก้ CLO, แก้ PLO, แก้ข้อมูล User คนอื่น,
เปลี่ยน Role ตัวเอง

==================================================
9. INSTRUCTOR
==================================================

INSTRUCTOR คืออาจารย์ผู้สอน สามารถดูเฉพาะ: Course ที่ตัวเองรับผิดชอบ,
Student ที่เกี่ยวข้องกับ Course ที่ตัวเองรับผิดชอบ, Grade Distribution ของ Course,
CLO Achievement, % นักศึกษาที่ผ่าน Threshold, Course Assessment, Analytics ของ Course,
ภาพรวมที่เกี่ยวข้องกับ Scope ที่ได้รับมอบหมาย

ห้ามเห็นข้อมูลข้าม Scope โดยไม่มีสิทธิ์ ตัวอย่าง: อาจารย์ Program A ไม่ควรสามารถ query
ข้อมูล Program B ได้เพียงแค่เปลี่ยน ID ใน URL/API — Backend ต้อง enforce scope

Implementation ปัจจุบัน (2026-09-19): ครอบคลุม requirement ข้างต้นครบแล้วผ่าน
`/instructor/dashboard` + `/instructor/courses/[courseId]` รวม 9 feature (status badge
อิง threshold จริง, risk-level 3 ระดับ, search/filter, course comparison, semester trend,
student timeline, rule-based course summary ฯลฯ) — ดูรายการเต็ม + commit hash ที่ root
`TODO.md` หัวข้อ "INSTRUCTOR Dashboard — gradebook/course management" แทนการเขียนซ้ำที่นี่

อาจารย์ที่ปรึกษา (2026-10-24): ไม่ใช่ Role แยก เป็น INSTRUCTOR ที่ถูกผูกกับนิสิตผ่าน
`student_profiles.advisorUserId` (นิสิต 1 คนมีอาจารย์ที่ปรึกษา 1 คน) STAFF ใน Scope เป็นผู้กำหนด
(`PATCH /student-profiles/:id/advisor`, บันทึก audit `STUDENT_ADVISOR_UPDATE`) อาจารย์ดูนิสิตในที่ปรึกษา
ได้อย่างเดียวที่ `/instructor/advisees` (`GET /advisor/students`, `/advisor/students/:id`): GPA รายเทอม
รายวิชา ตรวจหน่วยกิตจบ และ PLO คำนวณจาก service เดียวกับหน้าของนิสิต นิสิตที่ไม่ได้อยู่ในที่ปรึกษาตอบ 404
ไม่เห็นอีเมลนิสิต อาจารย์ที่ยังมีนิสิตในที่ปรึกษาลบบัญชีถาวรไม่ได้

==================================================
10. STAFF
==================================================

STAFF ดูแลข้อมูลการศึกษาและข้อมูลพื้นฐานตาม Scope ที่ได้รับมอบหมาย เช่น Student data,
Course master data, Academic Year, Semester, Course Offering, Instructor Assignment,
การกำหนดอาจารย์ที่ปรึกษาของนิสิต, ข้อมูลพื้นฐานที่ได้รับอนุญาต

STAFF ไม่ควรมีสิทธิ์แก้ CLO/PLO เพียงเพราะเป็น STAFF

==================================================
11. ADMIN
==================================================

ADMIN ในระบบนี้ไม่ได้หมายถึง "ทำได้ทุกอย่าง"

หน้าที่หลัก: CRUD STAFF, จัดการ Staff ในขอบเขตที่ตัวเองได้รับอนุญาต, จัดการ Account/Scope
ที่เกี่ยวข้องตาม policy

ADMIN ต้องไม่สามารถแก้ CLO/PLO ของ Program อื่น
ตามที่ requirement ปัจจุบัน: ADMIN ไม่ใช่ Curriculum Owner โดยอัตโนมัติ
ห้ามตีความ ADMIN = full access

==================================================
12. SUPER_ADMIN
==================================================

SUPER_ADMIN ดูแลระบบระดับสูงสุด สามารถ: User Management, Role Assignment,
Staff/Admin Management, Faculty, Department, Program, Organization Scope,
Account Status, Security/Audit, System configuration ที่จำเป็น

SUPER_ADMIN เป็น Role ที่มีสิทธิ์ระดับระบบ

นโยบายล่าสุด: SUPER_ADMIN จัดการเฉพาะบัญชีผู้ใช้ (สร้าง/ระงับ/กำหนดบทบาท/จัดการ scope)
โครงสร้างองค์กร (คณะ/ภาควิชา/สาขา) และปฏิทิน (ปีการศึกษา/ภาคเรียน) เท่านั้น
ไม่เข้าถึงข้อมูลวิชาการ (หลักสูตร, รายวิชา, CLO/PLO, ผลการเรียน, การวิเคราะห์ทุกชนิด)
การเขียนหลักสูตร/CLO/PLO/CLO-PLO mapping เป็นของ ADMIN ตาม scope (`@ScopeTarget`)
ไม่มีใครกำหนดบทบาท (หรือ scope) ให้ตัวเองได้ — เทสต์ `src/common/roles-table.spec.ts`
ล็อกว่าไม่มี handler วิชาการใดมี SUPER_ADMIN ใน `@Roles`
(`/admin/curriculum-dashboard` และ `GET /dashboard/curricula` ถูกลบแล้ว)

==================================================
13. DATA SCOPE / DATA ISOLATION
==================================================

นี่เป็น requirement สำคัญมาก แต่ละ Program ต้องไม่สามารถเห็นข้อมูลของ Program อื่นโดยไม่มีสิทธิ์
ตัวอย่าง: Program A ห้ามเห็น Student / Analytics / Curriculum ของ Program B

การแยกข้อมูลไม่จำเป็นต้องหมายถึงสร้าง Database Server คนละตัว สามารถใช้ Database เดียวได้
แต่ต้อง enforce Data Scope ด้วย relational ownership และ authorization
เช่น: User → Scope → Faculty / Department / Program

ทุก API ที่เกี่ยวข้องต้องตรวจ: 1. Authentication 2. Role 3. Scope — ไม่ใช่ตรวจ Role อย่างเดียว

==================================================
14. REGISTRATION
==================================================

Public registration มีไว้สำหรับ STUDENT

Student Register แล้วต้องสร้าง: User + UserRole(STUDENT) + Student Profile ใน transaction เดียว

User ห้ามเลือก Role เอง — Role ต้องถูกกำหนดจาก Backend เป็น STUDENT

ข้อมูล Student ต้องผูกกับ Program + Curriculum โดย Backend ต้องตรวจว่า Curriculum นั้นเป็นของ
Program ที่เลือกจริง

Student Profile ต้องถูกสร้างตั้งแต่ Register — ไม่ใช้ระบบ Import รายชื่อนิสิตมาสร้าง Account

==================================================
15. AUTHENTICATION
==================================================

ต้องมี: Register, Login, Logout, Current User, Change Password, Forgot Password,
Reset Password, Role/Permission, JWT/session security

รองรับ 2 วิธียืนยันตัวตน:
A. Email + Password (1-factor) — Email + Password ถูกต้อง → ออก Access Token ทันที
B. Google Authentication — Google Sign-In/OAuth (ถือว่า Google ยืนยันตัวตนพอแล้ว)

[อัปเดต 2026-08-25: เดิมออกแบบให้ A เป็น 2-factor (Password + Email OTP) แต่ตัดสินใจ
ถอด OTP ออกจากระบบทั้งหมดแล้ว (ไม่ใช่แค่ปิด flag) เหลือ Email+Password ล้วนสำหรับ
วิธี A — Google OAuth (วิธี B) ไม่เปลี่ยนแปลง ไม่เคยผ่าน OTP อยู่แล้ว]

[อัปเดต 2026-09-01: เพิ่ม TOTP-based 2FA แบบ opt-in สำหรับวิธี A (commit
`32bd478 feat: TOTP-based 2FA`) — คนละอย่างกับ Email OTP ที่ถอดไปแล้วข้างบน (TOTP คือ
authenticator app แบบ Google Authenticator ไม่ใช่ code ส่งทาง email) ผู้ใช้เปิดใช้เองได้
ผ่าน endpoint enable/disable/regenerate-recovery-codes ไม่ได้บังคับทุกคน — login ปกติ
ด้วย Email+Password ยังคงออก token ทันทีเหมือนเดิมถ้าไม่ได้เปิด TOTP ไว้]

==================================================
16. MY ACADEMIC RECORD
==================================================

นิสิตเป็นผู้บันทึกผลการเรียนของตัวเอง ไม่ใช้ REG Integration ใน version ปัจจุบัน

ต้องมี: เลือก Academic Year, เลือก Semester, เลือก Course, เพิ่ม Course ที่เรียน, กรอก Grade,
แก้ Grade, ลบรายการที่กรอกผิด, ดูประวัติราย Semester, GPA ราย Semester, GPA สะสม

ระบบคำนวณ GPA และ Credits จากข้อมูลนี้

==================================================
17. NO REG IMPORT
==================================================

Architecture ใหม่ ไม่ใช้: Student Excel Import, Import รายชื่อนิสิต, สร้าง Account จาก Excel,
password = studentCode, REG Integration, Transcript Excel/CSV Import, REG Sync

หากพบ code เก่าที่ทำเรื่องเหล่านี้: ให้ classify เป็น obsolete/conflict อย่าใช้เป็น architecture ใหม่
IMPORTANT: ยังไม่ต้องลบจนกว่าจะได้รับคำสั่ง

==================================================
18. SMART CREDIT CHECKER
==================================================

เป็น Core Feature ต้องตรวจ: หน่วยกิตที่เรียน, หน่วยกิตที่ผ่าน, หน่วยกิตสะสม, หน่วยกิตที่เหลือ,
Course ที่ผ่าน, Course ที่ไม่ผ่าน, Course ที่ยังไม่ได้เรียน, Required Course ที่ยังขาด,
Elective ที่ยังขาด, Category ที่ยังไม่ครบ, Prerequisite, Curriculum Requirements,
Graduation Requirements, Graduation Readiness

ทั้งหมดต้องคำนวณจาก Curriculum Version ของ Student

==================================================
19. CURRICULUM MANAGEMENT
==================================================

Curriculum ต้องรองรับ: Curriculum Version / Year, Total Credits, Curriculum Requirements,
Course, Course Category, Required / Elective, Credits, Prerequisite, CLO, PLO,
CLO → PLO Mapping, Achievement Threshold

Course/CLO/PLO ต้องสัมพันธ์กับ Curriculum ที่ถูกต้อง ห้ามข้อมูลข้าม Curriculum/Program ปะปนกัน

==================================================
20. IT PROGRAM PLO
==================================================

สำหรับหลักสูตร IT ปัจจุบัน มี PLO หลัก 6 ด้าน:
PLO1: บูรณาการความรู้ทางไอที — ประยุกต์ใช้แนวคิด ทฤษฎี หลักการทางเทคโนโลยีสารสนเทศแก้ปัญหาได้
PLO2: การพัฒนาและออกแบบระบบ — ออกแบบ พัฒนา ประเมินระบบงาน/ซอฟต์แวร์ที่ตอบสนองผู้ใช้งาน
PLO3: การจัดการข้อมูล — จัดการวิเคราะห์ข้อมูลเพื่อเพิ่มประสิทธิภาพการตัดสินใจ/สืบค้นสารสนเทศ
PLO4: การใช้เทคโนโลยีสมัยใหม่ — เลือกใช้เครื่องมือ/เทคโนโลยีดิจิทัลทันสมัยอย่างเหมาะสม
PLO5: การทำงานเป็นทีมและการสื่อสาร — สื่อสารข้อมูลวิชาการ/วิชาชีพอย่างมีประสิทธิภาพ ทำงานร่วมกันได้
PLO6: จริยธรรมวิชาชีพ — จรรยาบรรณวิชาชีพไอที ความรับผิดชอบต่อสังคม ตระหนักผลกระทบดิจิทัล

IMPORTANT: PLO 6 ข้อนี้เป็นของหลักสูตร IT ที่กำลังพัฒนา ระบบต้องไม่ hardcode ว่าทุก Program
ต้องมี 6 PLO — Program/Curriculum อื่นอาจมีจำนวนและรายละเอียด PLO ต่างกัน

==================================================
21. COURSE → CLO → PLO
==================================================

โครงสร้าง Learning Outcome: Course → CLO → CLO-PLO Mapping → PLO

Course หนึ่งมีหลาย CLO ได้ CLO หนึ่งสามารถเชื่อมกับ PLO ได้ Mapping อาจต้องมี Weight
ตามการออกแบบจริง

ตัวอย่าง Programming II: CLO1→PLO1, CLO2→PLO2, CLO3→PLO2, CLO4→PLO4

ผลการเรียนของ Course สามารถนำมาประกอบการคำนวณ Learning Outcome ได้

==================================================
22. GRADE-BASED ASSESSMENT
==================================================

ต้องการใช้ Grade เป็นหนึ่งในข้อมูลหลักในการประเมินผล

แนวคิดปัจจุบัน: Grade B ขึ้นไป = ผ่านเกณฑ์ Achievement
ตัวอย่าง: Course มี Student 100 คน 70 คนได้ B ขึ้นไป → Achievement = 70%
จากนั้นเทียบกับ Achievement Threshold ของ Course/CLO/Curriculum
ตัวอย่าง Threshold = 70% → Achievement >= 70% = บรรลุ, < 70% = ยังไม่บรรลุ

IMPORTANT: สูตรจริงต้องถูกเก็บเป็น deterministic business logic AI ห้ามเป็นผู้คำนวณ Achievement เอง

==================================================
23. LEARNING OUTCOME ANALYTICS
==================================================

ต้องวิเคราะห์ได้ 4 ระดับ:
A. Student Analytics — PLO รายบุคคล, Radar Chart, Strength, Areas for improvement
B. Course Analytics — Grade Distribution, CLO Achievement, % B ขึ้นไป, CLO สูงสุด/ต่ำสุด
C. Cohort Analytics — วิเคราะห์นิสิตตามชั้นปี/รุ่น, Average GPA, Average PLO, Radar Chart,
   Strength/Weakness ของรุ่น
D. Curriculum Analytics — ภาพรวมทั้งหลักสูตร, Average PLO, Graduation Readiness,
   Course/CLO ที่มีปัญหา, Trend, Radar Chart

==================================================
24. RADAR CHART
==================================================

Radar Chart หลักของ IT ใช้ PLO 6 ด้านโดยตรง (ตัวอย่าง: PLO1 82%, PLO2 90%, PLO3 84%,
PLO4 78%, PLO5 65%, PLO6 72%)

Radar Chart ใช้ค่าที่ Backend คำนวณ AI ห้ามสร้างค่าบน Radar Chart เอง
สามารถมี Radar: Student Radar, Cohort Radar, Curriculum Radar

==================================================
25. AI SKILL ANALYSIS
==================================================

AI มีหน้าที่ "ตีความข้อมูลที่ระบบคำนวณแล้ว"

Input เช่น: Grade, Course, CLO Achievement, PLO Achievement, Radar values, Academic Progress
AI Output: Summary, Strength, Weakness, Areas for improvement, Recommendation

AI ห้ามสร้างตัวเลข CLO/PLO เอง AI ห้ามกล่าวเกินหลักฐาน

ตัวอย่างข้อความที่ไม่ควรใช้: "นักศึกษาคนนี้เขียนโปรแกรมได้" (Grade เพียงอย่างเดียวไม่สามารถ
พิสูจน์ความสามารถจริงได้)
ควรใช้: "จากผลการเรียนในรายวิชาและ CLO ที่เกี่ยวข้องกับการพัฒนาโปรแกรม นักศึกษามีผลสัมฤทธิ์
ในด้านการพัฒนาและออกแบบระบบอยู่ในระดับสูง"

ต้องใช้ภาษาว่า: จากข้อมูลผลการเรียน..., จาก CLO ที่เกี่ยวข้อง..., ผลสัมฤทธิ์บ่งชี้...,
มีแนวโน้ม..., อยู่ในระดับ...
ไม่ควรสรุปความสามารถจริงที่ข้อมูลไม่ได้พิสูจน์

==================================================
26. AI SKILL ANALYSIS FEATURES
==================================================

ต้องมี: วิเคราะห์ศักยภาพ, วิเคราะห์ความถนัด, วิเคราะห์จุดแข็ง, วิเคราะห์จุดที่ควรพัฒนา,
Radar Chart, AI Summary, Recommendation

แต่คะแนนทั้งหมดต้องมาจาก Backend Analytics ก่อน

Architecture: Academic Records → Grade Calculation → CLO Calculation → PLO Calculation →
Analytics → Radar Data → AI Interpretation

ไม่ใช่: Academic Records → AI → ให้ AI สร้างคะแนนเอง

==================================================
27. COURSE ASSESSMENT
==================================================

หลังเรียน Course แล้ว Student สามารถประเมินตัวเองตาม CLO เช่น CLO1: 1-5, CLO2: 1-5, CLO3: 1-5
สามารถมี Comment Instructor ดูภาพรวมได้ ผู้ดูแลที่มี Scope ถูกต้องดู Aggregate ได้

Course Assessment เป็นข้อมูลเสริม ไม่ควรนำ Self Assessment มาแทน Grade-based Achievement
โดยตรง ควรแยก: Objective/Academic Indicator = Grade-based, Perception/Self Assessment =
Student self-assessment แล้วนำมาเปรียบเทียบกันได้

==================================================
28. LEARNING PATH PLANNER
==================================================

ระบบสามารถแนะนำ: Course ที่ควรเรียนต่อ, Required Course ที่ยังขาด, Elective ที่ยังขาด,
Course ที่ลงได้ตาม Prerequisite, Semester Planning, Graduation Requirement

ตัวอย่าง: Student ผ่าน Programming I จึงสามารถแนะนำ Programming II
แต่ถ้า Course ต้องผ่าน Database I ก่อน และ Student ยังไม่ผ่าน ต้องแจ้งว่ายังลงไม่ได้

==================================================
29-31. DASHBOARDS
==================================================

Student Dashboard: GPA, Credits Earned, Credits Remaining, Curriculum Progress %,
Graduation Readiness, PLO Progress, Radar Chart, Recent Courses, Missing Requirements,
AI Summary — ข้อมูลทั้งหมดเป็นของ Student ที่ Login อยู่เท่านั้น

Instructor Dashboard: Course ที่สอน, Student count, Grade Distribution, % B ขึ้นไป,
CLO Achievement, CLO ต่ำที่สุด/สูงที่สุด, Course Assessment, Course Analytics
— ต้องถูกจำกัดตาม Course/Program Scope

Curriculum/Program Analytics Dashboard: Student count, Average GPA, Graduation Readiness,
Students at risk, Average PLO, Radar Chart, Cohort Comparison, Course Analytics, Lowest CLO,
Lowest PLO, AI Curriculum Summary — ห้ามเห็น Program อื่นถ้าไม่มี Scope

==================================================
32. SYSTEM MODULES
==================================================

1. Authentication & Authorization — Register, Login, 2FA/Google auth, Logout, Current User,
   Password Management, Roles, Scopes
2. Student Dashboard — GPA, Credits, Progress, Graduation Readiness, PLO, Radar, AI Summary
3. My Academic Record — Academic Year, Semester, Course, Grade, GPA, History
4. Smart Credit Checker — Credits, Course completion, Categories, Requirements,
   Prerequisites, Graduation readiness
5. Curriculum Management — Curriculum, Course, Category, Requirements, CLO, PLO,
   Mapping, Threshold
6. Learning Outcome Analytics — Student, Course, Cohort, Curriculum
7. AI Skill Analysis — Strength, Weakness, Radar, Summary, Recommendation
8. Course Assessment — CLO Self Assessment, Comments, Aggregate Analysis
9. Learning Path Planner — Course recommendation, Prerequisite, Semester planning
10. Curriculum & Course Dashboard — Instructor Analytics, Program/Curriculum Analytics
11. Organization Management — Faculty, Department, Program, Curriculum
12. System Administration — User, Staff, Admin, Role, Scope, Account, Audit

==================================================
33. IMPORTANT BUSINESS RULES
==================================================

1. Public Register = STUDENT เท่านั้น
2. Client ห้ามกำหนด Role ตอน Register
3. Register ต้องสร้าง Student Profile
4. Student ต้องผูก Program + Curriculum
5. Curriculum ต้องเป็นของ Program ที่เลือกจริง
6. Student เห็นข้อมูลตัวเองเท่านั้น
7. Instructor เห็นเฉพาะข้อมูลที่รับผิดชอบ
8. STAFF จำกัดตาม Scope
9. ADMIN ไม่ใช่ full system administrator
10. ADMIN มีหน้าที่หลัก CRUD STAFF
11. SUPER_ADMIN ดูแลระดับระบบ
12. ทุก API สำคัญต้องตรวจ Authentication + Role + Scope
13. ห้ามเชื่อ IDs จาก Client โดยไม่ validate relationship
14. ห้าม Program หนึ่งเห็นข้อมูล Program อื่นโดยไม่มีสิทธิ์
15. Grade เป็นข้อมูลที่ Student กรอกเอง
16. ปัจจุบันไม่มี REG Integration
17. ไม่มี Student Excel Account Import ใน architecture ใหม่
18. Course → CLO → PLO ต้องสัมพันธ์กับ Curriculum
19. Smart Credit Checker ต้องคำนวณตาม Curriculum Version ของ Student
20. Analytics calculation ต้อง deterministic และทำใน Backend
21. AI ใช้ตีความ ไม่ใช้สร้างคะแนน
22. Radar Chart ใช้ค่าจาก Backend Analytics
23. สำหรับ IT Radar หลักใช้ PLO 6 ด้าน
24. ระบบต้อง generic รองรับ Program อื่นที่มี PLO ต่างจาก IT
25. การประเมินว่า "บรรลุ" ต้องมี Threshold ชัดเจน

==================================================
34. IMPLEMENTATION PRINCIPLES
==================================================

ใช้หลัก: Security first, Data integrity, Role-based access control, Scope-based access control,
Transaction safety, DTO validation, Database constraints, No sensitive data leakage,
No client-trusted authorization, No duplicated business logic

Backend ต้องเป็น source of truth Frontend ไม่ใช่ security boundary
ทุก calculation สำคัญควรมีสูตรชัดเจนและ test ได้ AI ไม่ควรอยู่ใน critical calculation path

==================================================
35. CURRENT DEVELOPMENT RULE
==================================================

เราจะพัฒนาทีละส่วน ห้ามทำหลาย Phase พร้อมกัน

ก่อน implement แต่ละ Phase: 1. ตรวจ code ปัจจุบัน 2. บอกว่ามีอะไรอยู่แล้ว
3. บอกว่าอะไรขัดกับ requirement ใหม่ 4. บอกไฟล์ที่จะต้องแก้ 5. บอก schema ที่เกี่ยวข้อง
6. บอก security/data-integrity risk 7. เสนอ implementation plan 8. รออนุมัติ 9. จึงค่อย implement

หลัง implement: run TypeScript validation, run relevant tests, รายงานเฉพาะไฟล์ที่เปลี่ยน,
ห้ามสร้าง test data ใน production/dev database โดยไม่ได้รับอนุญาต, ห้าม migration โดยไม่ได้รับอนุญาต,
ห้ามลบข้อมูลโดยไม่ได้รับอนุญาต

==================================================
TECH STACK
==================================================

Backend: NestJS, TypeScript, Prisma ORM, PostgreSQL, bcrypt(js), JWT, class-validator,
@nestjs/throttler, Helmet
Frontend: Next.js, React, TypeScript
Database: PostgreSQL, Prisma ORM

==================================================
IMPLEMENTATION LOG (อัปเดตตามความคืบหน้าจริง)
==================================================

Phase 0 — เสร็จสมบูรณ์: Monorepo scaffold (npm workspaces), apps/backend (NestJS+Prisma),
apps/frontend (Next.js+Tailwind), packages/shared-types

Phase 0.5 — เสร็จสมบูรณ์: Swagger ที่ /api/docs (gated นอก production), CONVENTIONS.md
(8 หัวข้อ: Swagger, Naming, Security/Guard chain, Error handling, DTO validation,
Business logic placement, Soft-delete pattern, Scope resolution rule)

Phase 1 — เสร็จสมบูรณ์: Faculty→Department→Program→Curriculum เต็ม CRUD
- Soft-delete only (isActive flag) ไม่มี hard-delete
- Block soft-delete ถ้ามี active child อยู่ (เช่น Faculty ที่มี active Department จะลบไม่ได้)
- Dependent-relationship validation ผ่าน findActiveByIdOrThrow pattern
- Curriculum มี isOpenForRegistration แยกจาก isActive (auto-unset เมื่อเปิดตัวใหม่ ทำใน
  transaction เดียว)
- onDelete: Restrict ทุก relation (ป้องกัน hard-delete โดยไม่ตั้งใจ)
- Composite unique constraints ตามลำดับ hierarchy

Phase 2 — เสร็จสมบูรณ์ (data model + service layer เท่านั้น ยังไม่มี Controller/CRUD endpoint):
- User, UserRole (multi-role ต่อ user ผ่าน join table), UserScope (Faculty/Department/Program
  level, level ต้องตรงกับ FK ที่ set — XOR logic บังคับที่ service layer)
- StudentProfile ผูก Program+Curriculum ด้วย compound FK บังคับที่ database level ว่า
  Curriculum ต้องเป็นของ Program นั้นจริง

Phase 3 — เสร็จสมบูรณ์: Authentication เต็มรูปแบบ
- Email+Password+OTP: register/login แยก endpoint, OTP hash (SHA-256) + attempt-lock 5 ครั้ง,
  JWT access(15m)+refresh(7d) คู่กัน, payload มีแค่ role ไม่มี scope (scope query สดทุกครั้งตาม
  CONVENTIONS.md §8)
- JwtStrategy/JwtAuthGuard/RolesGuard ของจริง (ไม่ใช่ stub) เช็ค user.isActive สดจาก DB ทุก request
- Google OAuth: 2-step flow (pending-registration token สำหรับ user ใหม่ที่ยังไม่มีข้อมูลนิสิต),
  anti-account-takeover (ถ้า email ซ้ำแต่ไม่มี UserAuthMethod GOOGLE ผูกไว้ → reject ไม่ auto-link)

ช่องว่างที่ยังไม่ทำ (ตอนเขียน log นี้ครั้งแรก): ScopeGuard ตัวจริงตาม CONVENTIONS.md §3
ยังไม่มี — ปัจจุบันบังคับแค่ role level (เช่น SUPER_ADMIN) ยังไม่มี Department/Program-level
scope enforcement จริงในทุก endpoint

[อัปเดต 2026-09-17: log นี้หยุดบันทึกละเอียดที่ Phase 3-4 ("ถัดไป: Phase 4" ด้านล่าง)
แต่งานจริงไปไกลกว่านี้มากแล้ว — repo มี 97 commits รวมถึง ScopeGuard จริงทุก endpoint,
Phase 4-9 (Curriculum Content, Credit Checker, Learning Path, CLO/PLO Achievement,
Curriculum Analytics), Module 10-12 (Dashboards ครบ 4 role, Organization Management UI,
User/Scope Management UI), STAFF role, TOTP 2FA, Docker deploy ฯลฯ — ดู `git log
--oneline` สำหรับรายการคอมมิตจริงทั้งหมด และ `TODO.md` สำหรับ known limitations/decisions
ที่ยังค้างอยู่ ไม่ได้กลับมาบันทึกละเอียดทุก Phase ในไฟล์นี้ต่อเพราะ TODO.md
ทำหน้าที่นั้นแทนไปแล้วในทางปฏิบัติ]

ถัดไป (ตามที่ log นี้บันทึกไว้ครั้งแรก): Phase 4 — Curriculum Content (Course, Category,
Requirement, Prerequisite)