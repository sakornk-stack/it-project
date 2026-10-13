# TODO

## Observations & Data Issues

### ✓ H9-H11 Testing (2026-09-29) — CLOSED
Orphaned STAFF account (`patcharadnaimingchua+eduanalyze-test@gmail.com`) deleted; see commit `chore: remove orphaned test STAFF account with no scope/dependencies`.

### ✓ Instructor redesign รอบ 1–2 — COMPLETE (pushed 2026-10-06)
- **รอบ 1:** `/instructor/dashboard`, `/instructor/students`, `/instructor/year-levels`, `/instructor/my-courses` — ข้อความสรุป rule-based (pure function + test), นับรายคน, การ์ดรายคนบนมือถือ, ตัวกรองเก็บใน URL
- **รอบ 2:** `/instructor/courses/[courseId]` — แท็บเหลือ 4 (ภาพรวม / นักศึกษา / กรอกคะแนน / CLO), โหมดแก้เกรดแยก, กรอกคะแนนเป็นขั้นตอน 1-2-3, ตัวสลับวิชาเป็นเมนูบนมือถือ, เตือนก่อนทิ้งคะแนนที่ยังไม่บันทึก; payload ของส่วนเขียนเทียบ f6c7526 ต่าง 0 (ทดสอบด้วย API interception)
- ไม่แก้ backend ทั้งสองรอบ

**สิ่งที่ยังค้าง/ควรรู้**
- skeleton ของหน้ารายวิชาขยับเล็กน้อยเมื่ออาจารย์มีวิชาเดียว (ตัวสลับวิชาถูกวาดใน skeleton แต่ไม่แสดงเมื่อมีวิชาเดียว)
- ปุ่ม "บันทึกคะแนนทั้งหมด" ยังกดได้แม้ไม่มีการแก้ไข และจะยิง `PUT /student-assessment-scores/bulk` ที่ `entries: []` (พฤติกรรมเดิม ไม่ได้แก้)
- ปุ่ม Back/Forward ของเบราว์เซอร์ดักเตือนค่าที่ยังไม่บันทึกไม่ได้ (ข้อจำกัดของเบราว์เซอร์)
- ลิงก์จากหน้าอื่นยังใช้ `?tab=gradebook` ผ่าน alias (ใช้ได้ ไม่เร่งแก้)

**ถัดไป:** Staff redesign

### Instructor รอบ 3 — แนว Academic Overview (เสร็จ, **ยังไม่ push** รอคำสั่ง)
Commit (7): `551c4eb` คำ+นับคน · `65ae3cb` helper · `e9a6ec5` GPA รวมเป็น null เมื่อไม่รู้หน่วยกิต · `559ccb5` Dashboard · `476d399` หน้ารายวิชา แท็บภาพรวม · `d96201b` ตารางวิชา × ชั้นปี · `6ddf018` กรอกคะแนนด้วยคำธรรมดา
ตัดสินใจแล้ว: GPA ถ่วงหน่วยกิตตามสูตร backend เดิม · % ได้ B ขึ้นไปถ่วงที่นั่ง · ภาคเรียนเป็นป้ายข้อความ · สถานะ 4 แบบเฉพาะ Instructor (ไม่แตะ `achievementStatus()` ที่ใช้ร่วม) · ตัวอย่างน้อย <10 คน
**ที่ยังค้าง / ควรทำต่อ**
- (ก) ตัวกรองภาคเรียนจริง (เกรดเฉลี่ย / F / W / ชั้นปีรายเทอม) ต้องแก้ backend: เพิ่ม `semesterId` ให้ `GET /dashboard/instructor` ตอนนี้ทำได้แค่ % B ขึ้นไปรายเทอมจาก `semesterTrend`
- (ข) % ผ่านเป้าแยกรายข้อของเป้าการเรียนรู้ ต้องแก้ backend (ตอนนี้คิดค่าเดียวต่อวิชา)
- (ค) เพิ่ม `credits` ใน `GET /dashboard/instructor` (หรือเปิด endpoint วิชาของอาจารย์) เพื่อเลิกดึง `GET /courses` ทั้งแคตตาล็อก (ตอนนี้ดึง ~100 วิชา เก็บเฉพาะ 3 วิชาของอาจารย์ แต่ยังโอนข้อมูลมาที่เบราว์เซอร์)
- (จ) คำที่อยู่ในไฟล์ใช้ร่วมกับ Staff/Student ยังเป็นคำเดิม รอตัดสินใจ: เร่งด่วน/เฝ้าระวัง (`lib/risk-level.ts`), Sign Out / Academic Insights (`dashboard-shell`), "ตามหลังแผน" (Staff ชั้นปี + Student แดชบอร์ด), ตัวเลข PLO แบบ 0–5 (`PloRadarChart`, `PloProgressTable`)
- (ฉ) ปุ่ม Back/Forward ของเบราว์เซอร์ดักเตือนค่าที่ยังไม่บันทึกไม่ได้ (ข้อจำกัดเบราว์เซอร์)
- (ช) งานเก่าของแนวการ์ดงานอยู่ใน `git stash` "wip-commit2-task-style-2026-10-06" (ห้าม drop จนกว่าจะตัดสินใจ)
- (ซ) assessment "Exam (Quiz, เต็ม 100)" วิชา 02739111 สร้างเมื่อ 2026-10-06 15:33 (เวลาไทย) ไม่ใช่จากสคริปต์ทดสอบ (ทุกคำขอเขียนถูกดัก) น่าจะมาจากการลองหน้าเว็บเอง ยังอยู่ในฐานข้อมูล ไม่ได้ลบ
- (ญ) จำนวนผู้ลงทะเบียนจริง: ทุก endpoint ของ Instructor สร้างจากระเบียนเกรด (`StudentCourseRecord.grade` ไม่ว่าง และไม่มีตารางลงทะเบียน) จึงบอกไม่ได้ว่ามีกี่คนที่ยังไม่มีเกรด หน้า Course Overview จึงตัดสินความน่าเชื่อถือจากจำนวนคนที่มีเกรด (<5 ข้อมูลยังน้อย / 5–9 ตัวอย่างน้อย / ≥10 ปกติ) ถ้าจะวัดความครบข้อมูลจริงต้องมีแหล่งข้อมูลใหม่ (ตารางลงทะเบียน) เป็นงาน backend ในอนาคต
- (ฎ) การ์ดรายภาคของแนวโน้มยังไม่มีเกรดเฉลี่ยรายภาค เพราะ `semesterTrend` ไม่มี GPA ต้องแก้ backend (รวมกับข้อ (ก))

### Instructor — เลิกใช้เป้า 70% คงที่ในการตัดสิน (ตัดสินใจ 2026-10-07, **ยังไม่ push**)
เหตุผล: เป้า 70% ไม่ใช่เกณฑ์บังคับ และความยากของแต่ละวิชาไม่เท่ากัน การตัดสิน ผ่าน/ใกล้/ต่ำกว่าเป้า จึงทำให้วิชาที่ยากดูแย่โดยไม่ได้แปลว่าสอนไม่ดี
สิ่งที่ใช้แทน: ค่ากลางของเกรดจริง (เกรดที่พบมากที่สุด · เกรดกลาง · GPA วิชา · ≈ เกรดที่ใกล้ที่สุด · สูงสุด/ต่ำสุดที่พบ · ส่วนเบี่ยงเบนมาตรฐาน) คำนวณใน `lib/grade-center.ts` จาก `gradeDistribution` เท่านั้น นับเฉพาะ A–F (W/I/S/U ไม่นับ) กติกาจำนวนคน: <5 คน แสดงเฉพาะจำนวนต่อเกรด / 5–9 คน ป้าย "ตัวอย่างน้อย" / ≥10 ปกติ
**ผลที่ตามมา**
- หน้ารายวิชา (ภาพรวม), ตารางชั้นปี, ตารางวิชา × ชั้นปี และบรรทัดสรุปใต้ชื่อวิชาไม่มีป้ายผ่านเป้า/ใกล้เป้า/ต่ำกว่าเป้า ไม่มีขีด/แถบเป้า 70% และไม่ใช้สีแดง/เขียวตัดสิน วงแหวน "B ขึ้นไป" เหลือเป็นสัดส่วนล้วน
- ตารางวิชา × ชั้นปีเรียงตามรหัสวิชา (เดิมเรียง "ห่างเป้ามากสุดก่อน") จึงไม่มีลำดับที่ชี้ว่าวิชาไหนควรดูก่อน ถ้าต้องการลำดับใหม่ต้องตัดสินใจว่าจะเรียงด้วยอะไร (เช่น GPA วิชาต่ำสุดก่อน)
- บรรทัดสรุปใต้ชื่อวิชาตัดส่วน "เป้าการเรียนรู้ผ่าน/ยังไม่ผ่าน" และลูกศรเทอมล่าสุดออก (ส่วน "ต้องติดตาม N คน" ยังอยู่) การเทียบกับภาคก่อนย้ายไปอยู่ที่การ์ดรายภาค ("% B ขึ้นไป เทียบภาคก่อน +4 จุด") เฉพาะเมื่อทั้งสองภาคมีคนที่ได้เกรด ≥5 คน
- `achievementStatus()` และ field ใน API (`achievementThreshold`, `isAchieved`, `threshold`) ไม่ถูกแตะ แค่เลิกใช้ในหน้า Instructor ส่วนใหญ่
**ระดับ CLO (ตัดสินใจแล้ว 2026-10-07):** API ไม่มี % รายข้อ (ค่าเดียวต่อวิชา) จึงตัดคำตัดสินออก ไม่แสดง % ราย CLO การ์ด "เป้าการเรียนรู้" และแท็บ CLO แสดงรหัส (เรียงตามรหัส) คำอธิบาย และจำนวนคนที่มีคะแนนที่กรอก ตัดป้ายผ่าน/ไม่ผ่าน เกณฑ์ราย CLO และปุ่มดูรายชื่อที่ผูกกับสถานะ (ข้อมูลน้อย: <5 คน "ข้อมูลยังน้อย" ไม่แสดง % / 5–9 คน "ตัวอย่างน้อย") ฟีเจอร์ "ต่ำสุดในวิชานี้" และ "เทียบภาคก่อนราย CLO" ยังทำไม่ได้จนกว่า backend จะส่ง % ราย CLO และราย CLO ต่อภาค (ข้อ (ข) ด้านบน)
**ยังไม่ลบ (มีเทสต์ใช้อยู่หรือไม่แน่ใจ):** `buildInstructorSummary` ใน `lib/instructor-summary.ts`, `STATUS_META`/`statusOf`/`sortByGap` ใน `lib/instructor-overview.ts`, `GoalBar` ใน `overview-parts.tsx`, `lib/headcount.ts` (มี `headcount.spec.ts` แต่ไม่มีโค้ดอื่นเรียกแล้ว), `components/ui/slider.tsx`, `lib/api/ai-analysis.ts` (endpoint ฝั่ง backend ยังมี), `lib/validation/course-instructor.schema.ts`, `lib/validation/prerequisite.schema.ts` (คอมโพเนนต์อื่นของ Instructor ที่ไม่มีหน้าไหนใช้ถูกลบแล้ว 2026-10-09)

### Staff redesign (รอทำ)
- (1) คนที่ไม่มีเกรดเลยต้องมีสถานะ "ยังไม่มีข้อมูล" ที่ backend: ตอนนี้ backend ตอบ `riskLevel: NORMAL` + `gpa: null` ฝั่งหน้าเว็บแยกให้ที่ชั้นแสดงผล (`components/staff/student-reading.ts`) จากเงื่อนไข NORMAL + ไม่มี GPA + ไม่มีวิชาเสี่ยง นักศึกษาที่มีแต่เกรด S ก็จะถูกอ่านเป็น "ยังไม่มีข้อมูล" ด้วย ต้องแก้ที่ backend ถึงจะแยกได้ถูกต้อง และ `GET /dashboard/staff` ยังไม่ส่งจำนวนคนที่มีเกรดต่อหลักสูตร หน้าเว็บนับเองจากรายชื่อ
- (2) รายชื่ออาจารย์ทั้งระบบเป็นปัญหาขอบเขต: `GET /users/instructors` ไม่กรองตามขอบเขตของผู้ขอ (`listInstructors()` ไม่รับ user) ทั้งที่คำอธิบาย API ว่า "within the requester scope" Staff จึงมอบหมายอาจารย์ข้ามคณะได้
- (3) หลักสูตรนอกขอบเขตรู้ตอนบันทึกถึงได้ 403: endpoint อ่านของ course-categories / courses / prerequisites / course-instructors ไม่กรองตามขอบเขต หน้าเว็บมีคำเตือนแค่กรณีเปิดผ่านลิงก์ (`outOfScope` ใน `curriculum-picker`)
- (4) Staff แก้/ลบเกรดได้กว้างกว่า Instructor: `@Roles` ของ `student-course-record` เปิดให้ STAFF เพิ่ม/แก้/ลบเกรดของนักศึกษาทุกวิชาในสาขา รอการตัดสินใจเชิงนโยบายว่าควรให้ Staff แก้ได้หรืออ่านอย่างเดียว
- (5) ปุ่ม 44px ทั้งระบบ: `ui/button` default 40px, `sm` 36px, ปุ่มแบ่งหน้า 32px, ตัวกรอง `h-9` แก้ที่ component กลางจะกระทบทุก role
- (7) ซ่อน/ปิดอาจารย์และหลักสูตรนอกขอบเขตฝั่งหน้าเว็บ: ระหว่างรอ (2) และ (3) ที่ backend หน้าเว็บควรกรองรายชื่ออาจารย์และปิดปุ่มเขียนเมื่อหลักสูตรอยู่นอกขอบเขต
- (9) `PATCH /courses/:id` ตั้ง `isActive` ไม่ได้: `UpdateCourseDto` คือ `CreateCourseDto` ลบ `curriculumId` (`dto/update-course.dto.ts:6-8`) และ `CreateCourseDto` ไม่มี `isActive` ส่วน `ValidationPipe` เปิด `whitelist` และ `forbidNonWhitelisted` (`main.ts:20-24`) การส่ง `isActive` จึงได้ 400 ผลคือวิชาที่ปิดไปแล้วเปิดกลับทาง API ไม่ได้ แก้ได้เฉพาะ code, name, nameEn, credits, description, isRequired, categoryId (รหัสวิชาซ้ำในหลักสูตร 409 และหมวดต้องอยู่ในหลักสูตรเดียวกัน)
- (10) `GET /courses` ส่ง `description` จริง (`course.service.ts` `findAll()` คืนทั้งแถวจาก Prisma) แต่ชนิด `CourseListItem` ใน `packages/shared-types` ไม่มีฟิลด์นี้ หน้าแก้วิชาจึงยังแสดงช่องคำอธิบายว่างและส่ง `description` ก็ต่อเมื่อพิมพ์ใหม่ ส่วน `nameEn` ที่ล้างจะส่ง `''` ทางแก้คือเพิ่ม `description` ในชนิดนั้นแล้วให้ `courseToFormValues` ใช้ค่าจริง (ฝั่งหน้าเว็บอย่างเดียว ไม่ต้องแก้ backend)
- (11) ตัวเลข "วิชาที่ยังไม่มีอาจารย์" และจำนวนอาจารย์นับฝั่งหน้าเว็บจาก `GET /courses` กับ `GET /course-instructors` อย่างละหนึ่งคำขอต่อหน้า (ไม่กรองตามขอบเขต กรองตามหลักสูตรฝั่ง client) การมอบหมายอาจารย์ไม่ผูกกับภาคเรียน ไม่มีตารางเปิดสอนต่อภาค
- (12) สำเนาใน `components/staff` ที่อาจห่างจากต้นฉบับ: `staff-add-record-form` (จาก `add-record-form`), `staff-grade-select` (จาก `grade-select-confirm`), `staff-combobox` (จาก `ui/combobox`) ยังไม่ยุบ (ใช้งานอยู่) ส่วน `staff-pagination` ยุบรวมกับ `ui/pagination` แล้ว
- (13) เมนูทุก role ย้ายไป `components/dashboard/nav-config.ts` โดยไม่เปลี่ยนรายการของ role อื่น (มีเทสต์ล็อกไว้) เฉพาะเมนู Staff ใช้ `matchPrefixes`
- (14) หลักสูตรนอกขอบเขต (เปิดผ่านลิงก์) หน้าหลักสูตรซ่อนข้อมูลและแสดงคำเตือน แต่รายชื่ออาจารย์ที่ให้เลือกยังเป็นของทั้งระบบ (ข้อ 2)

### pm25-pipeline (โปรเจกต์ของอีกวิชา)
หยุดอยู่ สาเหตุยังไม่ทราบ อาจชนพอร์ต 5433 ยังไม่ตรวจ (ห้ามสตาร์ท/หยุด/แตะ container หรือ volume ของมัน)

---

## Backend & Data Issues

### ✓ On-track by Year Level (M20) — COMPLETE
Three commits delivered (2026-09-30):
- **A:** Prisma migration adds `Curriculum.durationYears` (default 4, 1-8 range), `CreateCurriculumDto` field, year-level helper in `apps/backend/src/common/academic/year-level.ts` with formula `expected = min(total, ceil(total × max(0, currentYear − admissionYear) / durationYears))`, and dashboard fields `yearLevel`, `expectedCredits`, `onTrackStatus`.
- **B:** Student dashboard credits card shows amber "ตามหลังแผน" or emerald "ตามแผน" badge; admin curriculum form has `durationYears` field (default 4, validation 1-8).
- **C:** Year Level Overview (STAFF/INSTRUCTOR) shows "ตามหลังแผน N" badge on year cards and student rows, reusing the same pure helpers.

---

## Known Technical Debt

### Backend ESLint Config (pre-existing)
`apps/backend/` has no ESLint setup. Tests (Jest 96/96), TypeScript (`tsc`), and Prisma migrations are the current gates. This is a pre-existing issue outside the M20 scope but noted here for future build-quality work.


### Staff/Admin — สถานะนักศึกษาใช้ GPA สะสม (ตัดสินใจ 2026-10-08, **ยังไม่ push**)
เกณฑ์ (ค่าคงที่เดียว `GPA_CRITICAL_BELOW` / `GPA_WATCH_BELOW` ใน `grade-point.constant.ts`): GPA สะสมต่ำกว่า 1.50 = เร่งด่วน · 1.50–1.74 = เฝ้าระวัง · 1.75 ขึ้นไป = ปกติ · ไม่มี GPA (ไม่นับ W/I/S/U) = ยังไม่มีข้อมูล เดิมใช้เกรดที่แย่ที่สุดรายวิชา
- Admin "เสี่ยง" (จำนวนนักศึกษาในหลักสูตร) ใช้เกณฑ์เดียวกัน เลิก GPA < 2.0
- Instructor ไม่ใช้ GPA และไม่ใช้ป้าย "เร่งด่วน/เฝ้าระวัง" แล้ว (ตัดสินใจ 2026-10-08) ใช้ข้อเท็จจริงรายวิชาแทน: "มีเกรด D+ ลงไป" = ผลล่าสุดของวิชาหนึ่งในวิชาของอาจารย์เป็น D+/D/F/U (ไม่รวม C) ค่าคงที่ใน `lib/low-grade.ts` ฝั่ง frontend เท่านั้น backend ยังส่ง `riskLevel` รายวิชาเดิมแต่ UI Instructor ไม่ใช้
- หน้ารายละเอียดนักศึกษา (Staff) มีข้อความรอง "มีรายวิชา D+/D/F/U อยู่ X วิชา" ไม่ใช้ตัดสินสถานะ
- ผลต่อเดโม: นักศึกษาที่มีแต่เกรด U (ไม่มี GPA) เดิมเป็น "เร่งด่วน" ตอนนี้เป็น "ยังไม่มีข้อมูล"
**ที่ยังค้าง**
- **ยืนยันเกณฑ์ 1.50 / 1.75 กับกฎของมหาวิทยาลัย** (ตอนนี้เป็นค่าที่กำหนดเอง ยังไม่ได้อ้างอิงข้อบังคับ)
- **ต้องติดตามด้วย GPA สะสมสำหรับ Instructor** รอนโยบายความเป็นส่วนตัวจากมหาวิทยาลัย (ต้องเปิด `gpaRiskLevel` ใน 3 endpoint ถ้าอนุมัติ: `getInstructorDashboard`, `getInstructorStudents`, `getInstructorYearLevels`) ตอนนี้ API ฝั่ง Instructor ไม่ส่ง GPA
- `seed-demo.ts` เปลี่ยนจากดูวิชาของ demo-instructor เป็นระบุวิชาและหลักสูตรตรงๆ (`DEMO_COURSE_CODES`, `DEMO_CURRICULUM_ID`) เพราะ demo-instructor ถูกย้ายไปสอน 02739341 หลัง seed เดิมรัน; เพิ่มนักศึกษา GPA ต่ำ DEMO-GEN-0151..0182 (32 คน, 85 รายการ)

### จัดเลย์เอาต์ Staff / Instructor / Admin จากโค้ด (2026-10-08, **ยังไม่ push**) — ยังไม่เคยดูผลจริงบนหน้าจอ
ทำจากการอ่าน className อย่างเดียว (ไม่เปิดเบราว์เซอร์ ไม่ถ่ายภาพ) จึงยังไม่ได้ตรวจ dark mode และความกว้างจริงบนมือถือ/แท็บเล็ต ควรเปิดดูทุกหน้าหนึ่งรอบก่อน push
**ที่ปล่อยไว้ เพราะแก้โดยไม่เห็นภาพไม่ปลอดภัย (ต้องรู้ความกว้างจริง)**
- ฟอร์มเพิ่มรายวิชา (Staff) และฟอร์มผูก CLO (Instructor) ใช้ 1 คอลัมน์จนถึง `lg` แล้วเป็น 3 คอลัมน์ ไม่ทราบว่าแท็บเล็ตที่ความกว้างเท่าไรจึงพอสำหรับ 3 ช่อง ถ้ากว้างพอ อาจลดเป็น `md`
- ตัวเลือกหลักสูตรหัวหน้า Staff curriculum กว้างคงที่ `sm:w-96` ข้างปุ่ม "เพิ่มรายวิชาใหม่" ถ้าจอแคบแถวอาจแตก
- การ์ดแนวโน้มรายภาคของ Instructor (`sm:grid-cols-2 lg:grid-cols-3`) ถ้าจำนวนภาคหารสามไม่ลงตัวจะเหลือการ์ดเดียวในแถวสุดท้าย (ขึ้นกับจำนวนภาคจริง)
- ช่องกรอกคะแนนใน `student-score-entry-panel` ใช้ความกว้างคงที่ (`sm:w-80`, `5.25rem`) ยังไม่ได้ตรวจกับตัวเลขยาว
- ฟอร์มสร้างหลักสูตร Admin (`sm:grid-cols-3 lg:grid-cols-5`) ไม่ได้ตรวจว่าจำนวนช่องหารลงตัวกับ 3 และ 5
- ระยะห่างยังไม่เป็นสเกลเดียวทั้งระบบ (มี gap-2/3/4, px-4/5, py-3/3.5 ปนกัน) แก้โดยไม่เห็นภาพเสี่ยงทำหน้าที่ดีอยู่แล้วเพี้ยน
**แก้แล้ว:** ตารางกว้างของ Staff 5 ตาราง + ตาราง Instructor 2 ตารางเลื่อนแนวนอนในกรอบแทนที่จะล้นหน้า · ตัวกรองหน้ารายชื่อนักศึกษา Staff, ตัวกรองวิชา Staff, ตัวกรองนักศึกษา Instructor เป็น grid ที่ช่องเท่ากัน (ไม่หล่นช่องเดียว) · คำนิยามสถานะ Staff เป็นรายการ ใช้ข้อความชุดเดียวกับหน้า Dashboard · ปุ่มในตารางลดความกว้าง สูงคงที่ 44px · เลิกตัดข้อความด้วย "…" ใน Admin 2 จุด

### ADMIN: งานค้างหลังอุดช่องโหว่สิทธิ์ (2026-10-08)
- **ลดสิทธิ์ ADMIN ต่อ API หลักสูตร/คำเชิญ (least privilege):** ตอนนี้ ADMIN เรียก CRUD/ลบ หลักสูตร สาขา ภาค รายวิชา PLO/CLO และคำเชิญนักศึกษาได้ ทั้งที่ไม่มี UI รองรับ ต้องตัดสินใจว่าจะตัดสิทธิ์หรือเปิดหน้าให้
- **audit log / lastLogin:** ยังไม่มีตารางบันทึกการกระทำหรือเวลาเข้าสู่ระบบล่าสุด ต้องแก้ schema (ตาราง User มีแค่ createdAt/updatedAt)
- **อาจารย์ที่ไม่มีขอบเขต:** ไม่ขึ้นใน `/admin/users` และ `userCounts.instructor` ของ `/dashboard/admin/scope-overview` ไม่นับ ส่วน `GET /users/instructors` คืนอาจารย์ทั้งระบบ (ตั้งใจ แก้แค่คำอธิบาย Swagger แล้ว)
- ADMIN เพิ่ม STAFF ให้บัญชีที่ยังไม่มีบทบาท STAFF (เช่น อาจารย์) ไม่ได้แล้ว เพราะ ADMIN จัดการได้เฉพาะบัญชี STAFF ต้องให้ SUPER_ADMIN เพิ่มให้
- หน้า `/admin/users/[id]` ยังไม่เคยดูผลจริงบนหน้าจอ (dialog ยืนยัน, ปุ่มสูง 44px, dark mode)

### ข้อความที่ยังถูกตัดด้วย "…" (ตรวจ 2026-10-08, แก้แล้ว 2026-10-09)
- ไม่พบ `text-ellipsis` / `line-clamp` ที่อื่น (ที่มี `truncate` ใน Combobox/Select แก้แล้ว)

### SUPER_ADMIN: งานค้างหลังรอบความปลอดภัย (2026-10-08)
- **ลดสิทธิ์ SA/ADMIN ต่อ API แก้วิชา/CLO/PLO/mapping/คำเชิญ (least privilege) พร้อมกัน:** ตอนนี้ SA/ADMIN เรียก CRUD รายวิชา หมวดวิชา CLO PLO mapping assessment คำเชิญนักศึกษา และ PLO ระดับ cohort/หลักสูตรได้ ทั้งที่ไม่มี UI ต้องตัดสินใจรวมกันว่าจะตัดสิทธิ์หรือเปิดหน้าให้ แล้วแก้ `@Roles` ของ SA และ ADMIN ในรอบเดียว
- ~~SA ไม่เห็นคณะ/ภาควิชาของหลักสูตร~~ แก้แล้ว: `SystemCurriculumEntry` ส่ง `departmentName`/`facultyName` (commit 813dac6)
- backend ยังไม่มีไฟล์ตั้งค่า ESLint (`npm run lint` ใช้ไม่ได้) ตรวจได้แค่ `tsc` และ jest
- ยังไม่เคยดูผลจริงบนหน้าจอ: dialog ปิดใช้งาน (องค์กร/ปีการศึกษา), ปุ่มสูง 44px ในสองหน้านั้น, หน้าคุณภาพหลักสูตรของ SA, dark mode ของ 3 ไฟล์ที่เพิ่ม `dark:`

### SUPER_ADMIN: ส่วนของดีไซน์ Stitch ที่ตัดออกเพราะ API ไม่มีข้อมูล (2026-10-09)
- **ปีการศึกษา/ภาคเรียน:** ไม่มีวันเริ่ม-สิ้นสุด, คำอธิบายปีการศึกษา, สถานะ "ปัจจุบัน" ระดับภาคเรียนพร้อมกฎ "ปัจจุบันได้ภาคเดียว" และประวัติแก้ไข (รายการที่ปิดใช้งานแล้วดูและเปิดคืนได้แล้ว 2026-10-10) ป้ายในหน้าจอจึงใช้คำว่า "ปีล่าสุด" (คำนวณจากปีที่ใหญ่สุด ไม่ใช่ฟิลด์จริง) **รอ backend เพิ่มฟิลด์สถานะปัจจุบัน** (ระดับปีการศึกษา/ภาคเรียน) แล้วจึงเปลี่ยนกลับเป็น "ปัจจุบัน"
- **ภาพรวมระบบ:** ไม่มีรอบปีการศึกษา/ภาคเรียนปัจจุบัน, "ตั้งค่ารอบปีการศึกษา", สถานะเชื่อมต่อสำนักทะเบียน, เกณฑ์ CHE QA, เวอร์ชันระบบ, สถานะ "ครบ N หน่วยกิต" ของหลักสูตร (`totalCredits` ยังไม่อยู่ใน `SystemCurriculumEntry`) หน้าใช้การ์ดหลักสูตรแทนตาราง
- **ผู้ใช้งาน:** ไม่มีรหัสบุคลากรและเวลาเข้าสู่ระบบล่าสุด; ไม่มีปุ่ม "ส่งคำเชิญซ้ำ" ของ SA/Admin ใน UI (endpoint `POST /users/:id/resend-invitation` มีแต่ยังไม่ต่อหน้าจอ)
- **โครงสร้างองค์กร:** ไม่มีชื่ออังกฤษ, ฟิลด์ "ผ่านเกณฑ์ อว./มคอ." (การ์ดสรุปใช้ "หลักสูตร" ทั้งหมดแทน) และ audit trail (รายการที่ปิดแล้วดูและเปิดคืนได้แล้ว 2026-10-10)
- ยังไม่เคยดูผลจริงบนหน้าจอ: `/admin/system-overview`, ปุ่มระงับ/เปิดใช้งานในตารางผู้ใช้ SA, เมนู "จัดการ" และ empty state ในต้นไม้องค์กร, การ์ดปีการศึกษาแบบพับ (มือถือ/dark mode/ความสูง 44px)
- `docker:rebuild` + `docker:check-fresh` ยังไม่ได้รันหลังรอบนี้ เพราะพอร์ต 3000/3001 ถูก dev server ของโปรเจกต์ใช้อยู่

### หน้า auth: ตัดสินใจและสิ่งที่ยังไม่ทำ (2026-10-09)
- **Google login ยังซ่อนอยู่:** `NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN` เป็น `false` โดยเจตนา (backend และหน้า `/register/google` พร้อมใช้) ต้องตั้ง `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` ฝั่ง backend ก่อนเปิด
- **ไม่มีการยืนยันอีเมลตอนสมัคร:** สมัครแล้ว login อัตโนมัติ ยังไม่ทำตามคำสั่ง ถ้าจะเพิ่มต้องมีฟิลด์สถานะยืนยันและหน้ายืนยัน
- **`POST /auth/accept-invitation` ไม่มีหน้าจอ:** เก็บ endpoint ไว้ไม่ลบ อีเมลตั้งรหัสผ่านของบัญชีที่แอดมินสร้างลิงก์ไป `/reset-password` แทน
- ยังไม่มี checkbox ยอมรับเงื่อนไข/PDPA ในฟอร์มสมัคร
- ยังไม่เคยดูหน้า auth จริงบนหน้าจอ (โลโก้บนมือถือ, การ์ดเดียวกันทั้ง 5 หน้า, Light/Dark)

### ลำดับสร้างข้อมูลหลักสูตร ICT บนฐานข้อมูลใหม่ (2026-10-12)
รันจาก `apps/backend` ทุกสคริปต์เป็น dry-run โดยปริยาย ใส่ `--apply` เมื่อพร้อมเขียนจริง (รันซ้ำได้ ไม่ซ้ำข้อมูล) ทดสอบลำดับนี้บนฐานข้อมูลว่างชั่วคราวแล้ว ได้ PLO 2564 ครบ 6 ข้อ:
1. `npx prisma migrate deploy` แล้ว `npx ts-node prisma/seed.ts` (สร้างคณะ/โปรแกรม/curriculum)
2. `npx ts-node prisma/import-ict-2564.ts` และ `import-ict-2564-gened.ts` (วิชา 2564), `import-ict-2569.ts` (วิชา 2569)
3. `npm run prisma:seed:plo-2564` (PLO1–6 ของ 2564 — ข้อความยังไม่ได้ยืนยันกับเล่ม 2564)
4. `npx ts-node prisma/import-ict-clo-plo.ts` (PLO/CLO/mapping ของ 2569) — **ต้องมี CSV ใน `prisma/private-data/`**
5. `npx ts-node prisma/copy-ict-clo-plo-to-2564.ts` (คัดลอก CLO/mapping 2569 ไป 2564 ตามชื่อวิชา) — อ่านจาก DB แต่รายงาน (ฉ) ใช้ `private-data/` ด้วย
6. `npx ts-node prisma/import-career-courses.ts` (สาย→วิชาสำหรับฟีเจอร์ "แนวทางอาชีพ": Career/CareerCourse ของ 2569 แล้วคัดลอกไป 2564 ตามชื่อวิชา) — **ต้องมี `private-data/career-course-draft.csv`**; `--exclude-career=TEXT` ข้ามสายที่ชื่อมี TEXT (สายที่ไม่อยู่ในเล่ม); ต้องรันหลังขั้นที่ 2 (ต้องมีวิชา)
   - หมายเหตุ: `--rename-file=PATH` (CSV `old,new`) ใช้เฉพาะ DB ที่สร้างก่อนเปลี่ยนชื่อสายเป็นชื่อใหม่ เพื่อเปลี่ยนชื่อสายเดิมแทนการสร้างซ้ำ; DB ใหม่ที่ใช้ CSV ชื่อใหม่ไม่ต้องใช้
7. (ต่อจากขั้นที่ 6) ลิงก์เสริมของวิชาที่ไฟล์หลักไม่ได้ผูก: `private-data/career-course-additions.csv` (คอลัมน์ career, course_code, weight, curriculum = 2569 | 2564 | both, reason ไม่บังคับ) ผูกตามรหัสวิชาของแต่ละหลักสูตรตรงๆ ไม่จับคู่ตามชื่อ; ไฟล์นี้ถูกโหลดอัตโนมัติเมื่อรัน `import-career-courses.ts` (ใช้ `--additions-file=PATH` ระบุไฟล์อื่น, `--no-additions` ปิด) เพื่อไม่ให้ลิงก์เสริมถูก soft-delete เมื่อรันไฟล์หลักซ้ำ — ต้องมีไฟล์นี้บนเครื่องใหม่เหมือน `private-data/` อื่น; ผลที่ถูกต้อง: 2569 วิชาที่ผูกสาย 42, 2564 = 22
- `private-data/` (เล่มหลักสูตรและ CSV ที่แปลงแล้ว) **ไม่อยู่ใน git** ต้องเอาไฟล์มาวางเองบนเครื่องใหม่ ถ้าไม่มี ขั้นที่ 4 ใช้ไม่ได้ ขั้นที่ 5 รันได้แต่ข้ามการตรวจ (ฉ)


---

## แผนรอบ backend/ความปลอดภัย

จัดทำ 2026-10-09 จากการอ่านโค้ด (ยังไม่ได้ลงมือแก้) ใช้เป็นจุดเริ่มของรอบหน้า พาธทั้งหมดสัมพัทธ์กับ `apps/` ตัวอย่างโมเดล: **Plan** = ออกแบบ/ตัดสินใจเชิงนโยบาย (Opus High) · **Impl** = ลงมือตามแผน (Sonnet Medium)

### ชุด 1 — JWT บทบาทมีผลทันที + เปิดคืนรายการที่ปิดไป — **ทำแล้ว 2026-10-10** (เหลือรายการ "ยังไม่ได้ทำ" ท้ายชุดนี้)
**เป้าหมาย:** (ก) ถอด/ให้บทบาทแล้วมีผลทันที ไม่รอโทเค็นหมดอายุ (access 15 นาที, refresh 7 วัน) (ข) เปิดคืนคณะ/ภาควิชา/สาขา/หลักสูตร/ปีการศึกษา/ภาคเรียน/ผู้ใช้ที่ปิดไปแล้วจากหน้าจอ

**สิ่งที่พบ:** `backend/src/modules/auth/strategies/jwt.strategy.ts` `validate()` **ถามฐานข้อมูลทุกคำขออยู่แล้ว** (`userService.findById` ตรวจ `isActive` และ `mustChangePassword`) แต่ใช้ `roles: payload.roles` จากโทเค็น ดังนั้น "ตรวจให้เบา" ไม่ต้องเพิ่ม query: แค่ดึง `userRoles` มาใน query เดิม ขอบเขต (scope) ถูก resolve สดอยู่แล้วที่ `common/scope/scope-resolver.service.ts` (CONVENTIONS §8)

**ไฟล์/โมดูล:**
- `backend/src/modules/users/user/user.service.ts` `findById` — เพิ่มตัวเลือก `include: { userRoles: true }` (หรือเมธอดใหม่ `findAuthContext(id)` เลือกเฉพาะ `isActive, mustChangePassword, userRoles.role`)
- `backend/src/modules/auth/strategies/jwt.strategy.ts` — `roles` มาจากฐานข้อมูล; ตรวจ `isActive`
- `backend/src/modules/auth/auth.service.ts` `refreshAccessToken` (~บรรทัด 479) และ `issueTokenPair` (~463) — ยืนยันว่าออกโทเค็นใหม่จากบทบาทใน DB (เดิมเป็นอย่างนั้น); คง `roles` ใน payload เพื่อความเข้ากันได้แต่ไม่ใช้ตัดสินสิทธิ์
- เปิดคืน (endpoint ใหม่ SUPER_ADMIN): `POST /faculties|departments|programs|curricula|academic-years|semesters/:id/reactivate` ที่ `organization/{faculty,department,program,curriculum}/*.controller.ts|service.ts` และ `academic-record/{academic-year,semester}/*.controller.ts|service.ts`; รายการที่ปิด: `GET …?includeInactive=true` (เฉพาะ SUPER_ADMIN เพราะ GET ปัจจุบันสาธารณะและกรอง `isActive: true`)
- ผู้ใช้: `PATCH /users/:id/active-status` มีอยู่แล้ว ไม่ต้องทำเพิ่ม

**ขั้นตอน:** 1) JWT อ่านบทบาทจาก DB + เทสต์ → 2) (ถ้าวัดแล้วช้า) cache `Map<userId, {roles,isActive,exp 5s}>` ล้างเมื่อ `UserRoleService.assign/revoke`, `updateActiveStatus` → 3) service `reactivate()` ต่อเอนทิตี: ต้องมีพาเรนต์ที่ `isActive` (ภาควิชา→คณะ, สาขา→ภาควิชา, หลักสูตร→สาขา, ภาคเรียน→ปีการศึกษา), ตรวจรหัส/คีย์ซ้ำกับรายการที่ยัง active (partial unique index เช่น `faculties_active_code_key`, `departments_active_facultyId_code_key`, `semesters_active_academicYearId_term_key` ใน `prisma/migrations/20260827083737_add_soft_delete_partial_unique_indexes`) ตอบ 409 ข้อความไทยชัดเจน และจับ Prisma `P2002` เป็น 409 → 4) endpoint + `@Roles('SUPER_ADMIN')` → 5) frontend

**เทสต์ที่ต้องเพิ่ม:** `jwt.strategy.spec.ts` (ใหม่): บทบาทจาก DB ทับ payload, ถูกระงับ→401, ไม่มีผู้ใช้→401, ถอด ADMIN แล้วคำขอถัดไปไม่ผ่าน `RolesGuard`; (ถ้ามี cache) หมดอายุและถูกล้างเมื่อเปลี่ยนบทบาท; `*.service.spec.ts` ของ reactivate แต่ละตัว (พาเรนต์ปิดอยู่→409, รหัสซ้ำ→409, สำเร็จ→`isActive: true`, ปีที่ปิดไม่เปิดภาคเรียนลูกให้เอง)

**ผลต่อ frontend:** `frontend/src/lib/api/organization.ts` และ `lib/api/admin.ts` เพิ่ม fetch รายการที่ปิด + reactivate; `components/admin/organization/org-tree.tsx`, `org-node-row.tsx` สวิตช์ "แสดงที่ปิดใช้งาน" + ปุ่ม "เปิดใช้งานอีกครั้ง" ผ่าน `ConfirmDialog`/`useConfirm`; `components/admin/academic-year-card.tsx` และ `app/admin/academic-years/page.tsx` แสดงปี/ภาคที่ปิด (ตอนนี้ดีไซน์ Stitch ที่ตัดไปต้องการ "ปิดใช้งาน/ประวัติแก้ไข"); `packages/shared-types/src/index.ts` เพิ่มชนิดข้อมูล; error ใช้ `describeApiError`; ถอดบทบาทแล้วหน้าจอผู้ใช้นั้นจะได้ 403 ในคำขอถัดไป ควรให้ `lib/api-client.ts` พาไป `/login` หรือแสดงข้อความ (ตรวจพฤติกรรม 403 เดิมก่อน)

**ความเสี่ยง/ย้อนกลับ:** การเปิดคืน **ไม่คืนข้อมูลลูกที่ถูกปิดตามกัน** (เช่น วิชาที่ปิดจะลบ prerequisite ที่ผูกไว้ถาวร ดู `course.service.ts` `remove`) ต้องบอกผู้ใช้ในกล่องยืนยัน; cache ทำให้สิทธิ์ล่าช้าสูงสุด TTL; ย้อนกลับ: ไม่มี migration แค่ revert โค้ด
**ผลที่ทำแล้ว (2026-10-10):** `JwtStrategy`/`JwtRefreshStrategy` อ่านบทบาทจาก DB ผ่าน `UserService.findAuthContext` (ไม่ใช้ cache ตามที่แผนแนะนำ) · `GET /<x>/inactive` + `POST /<x>/:id/reactivate` (SUPER_ADMIN) ของคณะ/ภาควิชา/สาขา/หลักสูตร/ปีการศึกษา/ภาคเรียน (พาเรนต์ต้อง active, คีย์ต้องว่าง, 409 ภาษาไทย, หลักสูตรกลับมาแบบปิดรับลงทะเบียน) · หน้า `/admin/organization` และ `/admin/academic-years` มีปุ่ม "แสดงที่ปิดใช้งาน" + "เปิดใช้งานอีกครั้ง" · ผู้ใช้ใช้ `PATCH /users/:id/active-status` เดิม
**ยังไม่ได้ทำในชุด 1:** เปิดคืนรายวิชา/CLO/PLO (นอกขอบเขตที่ตกลง) · cache บทบาท (วัดก่อนค่อยทำ) · ปุ่มเปิดคืนไม่เปิดรายการลูกให้อัตโนมัติ (ตั้งใจ) · ยังไม่ได้ลองกับเบราว์เซอร์จริง (Light/Dark/มือถือ)
**ขนาด:** JWT = เล็ก · reactivate = กลาง–ใหญ่ (6 เอนทิตี + UI) · **โมเดล:** JWT = Impl (Sonnet Medium) · reactivate ออกแบบกฎ = Plan (Opus High) แล้ว Impl · **db:backup:** ไม่ต้องมี migration แต่ต้องสำรองก่อนทดสอบกับ Docker ตามกฎ CLAUDE.md

### ชุด 2 — ลดสิทธิ์ (least privilege)
**เป้าหมาย:** ให้แต่ละบทบาทเรียกได้เฉพาะ API ที่มีหน้าจอ/หน้าที่จริง และอ่านข้อมูลได้เฉพาะขอบเขตของตน

**สถานะปัจจุบัน → ที่ควรเป็น** (guard ดึงจากคอนโทรลเลอร์จริง `backend/src/modules/**.controller.ts`; "ไม่มี UI" ตรวจจาก frontend ปัจจุบัน)

| Endpoint | Guard ปัจจุบัน | ที่ควรเป็น | หมายเหตุ |
|---|---|---|---|
| `POST/PATCH/DELETE /courses` (`curriculum-content/course`) | SA, ADMIN, STAFF + ScopeGuard | **STAFF + ScopeGuard** | UI อยู่ที่ `/staff/curriculum` เท่านั้น |
| `POST/PATCH/DELETE /course-categories`, `/curriculum-requirements`, `/prerequisites` | SA, ADMIN, STAFF + ScopeGuard | **STAFF + ScopeGuard** | เหตุผลเดียวกัน |
| `GET/POST/DELETE /course-instructors` | SA, ADMIN, STAFF (GET และ DELETE ไม่มี ScopeGuard; DELETE ตรวจใน service) | **STAFF**; GET กรองตามขอบเขต | UI: sheet มอบอาจารย์ใน `/staff/curriculum` |
| `POST/PATCH/DELETE /clos`, `/plos`, `/clo-plo-mappings` | SA, ADMIN + ScopeGuard | **ไม่เปิดให้ใครผ่าน API จนกว่าจะมีหน้าแก้ไข** (หรือ SA อย่างเดียวถ้า seed/นำเข้าต้องใช้) | ไม่มีหน้าแก้ CLO/PLO ใน frontend; ตรวจ `prisma/seed*.ts` ว่าใช้ Prisma ตรงไม่พึ่ง API ก่อนตัด |
| `POST/PATCH/DELETE /departments`, `/programs`, `/curricula` | SA, ADMIN + ScopeGuard | **SA อย่างเดียว** (ให้เหมือน `/faculties` ที่เป็น SA อยู่แล้ว) | หน้าองค์กรเป็น SA-only; ADMIN ไม่มีเมนูนี้ |
| `POST /student-invitations/:id/resend` | STAFF, ADMIN, SA + Scope | **STAFF + Scope** | UI อยู่ฝั่ง Staff |
| `POST/PATCH/DELETE /student-course-records` (เกรด) | STUDENT, SA, ADMIN, STAFF (+INSTRUCTOR สำหรับ PATCH/DELETE) | ตัด **SA, ADMIN** ออกจากการเขียน (คงอ่าน); STAFF คงไว้แต่ต้องมี audit (ชุด 3) | `student-course-record.service.ts` ~780–800: STAFF/ADMIN สร้าง/แก้/ลบเกรดของนักศึกษาทุกคนในขอบเขต ส่วน INSTRUCTOR แก้/ลบได้เฉพาะระเบียนที่มีอยู่ในวิชาที่ตนสอน — ต้องให้ผู้ใช้ตัดสินใจ (ดูท้ายชุด) |
| `GET /users/instructors` | SA, ADMIN, STAFF — **ไม่กรองขอบเขต** (`user-management.service.ts` `listInstructors`; อาจารย์ไม่มี `UserScope`) | ลดข้อมูลเหลือ `id`+`fullName` (ตอนนี้ส่ง `email` ด้วย) + เฉพาะ `isActive`; ทางเลือกกรองจริงต้องผูกอาจารย์กับหน่วยงาน | ตัดสินใจ: ยอมรับ "ทุกอาจารย์ของระบบ" แบบข้อมูลน้อยที่สุด หรือเพิ่มขอบเขตให้อาจารย์ |
| `GET /courses`, `/course-categories`, `/prerequisites`, `/curriculum-requirements` | ผู้ล็อกอินทุกคน ไม่กรอง | STUDENT: เฉพาะหลักสูตรของตน · INSTRUCTOR: วิชาที่สอน+หลักสูตรนั้น · STAFF/ADMIN: กรองด้วย `ScopeResolverService` · SA: ทั้งหมด | `course.service.ts` `findAll()` ปัจจุบัน `findMany({ where: { isActive: true } })` ทุกวิชา; frontend `/staff/curriculum` แสดงหลักสูตรนอกขอบเขตแล้วโดน 403 ตอนเขียน (ข้อ (3)/(7) ใน Staff redesign) |
| `GET /curricula`, `/programs`, `/departments`, `/faculties` | สาธารณะ | คงไว้ (หน้าสมัครต้องใช้) | ตั้งใจ: ข้อมูลโครงสร้างหน่วยงานเป็นสาธารณะ |
| `DELETE /courses/:id` | SA, ADMIN, STAFF + Scope; service ตรวจแค่ **prerequisite ที่อ้างวิชานี้** แล้วลบ prerequisite ของวิชานี้ทิ้ง | เพิ่ม 409 เมื่อมี `StudentCourseRecord` ที่ active อ้างอิง, `CourseInstructor`, CLO หรือ assessment ที่ active | `course.service.ts` `remove()` (~บรรทัด 92) |

**ไฟล์/โมดูลหลัก:** `@Roles(...)`/`@ScopeTarget` ในคอนโทรลเลอร์ตามตาราง; `curriculum-content/course/course.service.ts` (`findAll`, `remove`), `course-category`, `prerequisite`, `curriculum-requirement` (เพิ่ม `findAllForUser(requester)`), `users/user-management/user-management.service.ts` (`listInstructors`), `academic-record/student-course-record/*`, `common/scope/scope-resolver.service.ts` (ใช้ `buildUserScopeOrFilter`/คู่กันของหลักสูตรซ้ำ)

**ขั้นตอน:** 1) เขียนเทสต์ "ตารางสิทธิ์" ก่อน (ข้อ 2) → 2) ตัด `@Roles` ตามตาราง (เปลี่ยนเล็ก ทำก่อน) → 3) `DELETE /courses` กันเมื่อมีข้อมูลอ้างอิง → 4) ลดข้อมูล `GET /users/instructors` → 5) กรองการอ่านตามบทบาท + ปรับ frontend → 6) ตัดสินเรื่องเกรด

**เทสต์ที่ต้องเพิ่ม:** `*.controller.spec.ts` หรือ e2e แบบอ่าน metadata `ROLES_KEY` ของทุก handler เทียบตารางข้างบน (กันสิทธิ์งอกใหม่); `course.service.spec.ts` ใหม่ (409 เมื่อมีเกรด/อาจารย์/CLO); `user-management.service.spec.ts` (`listInstructors` ไม่ส่ง email, เฉพาะ active); เทสต์การกรองอ่านต่อบทบาท (นักศึกษาเห็นเฉพาะหลักสูตรตน)

**ผลต่อ frontend:** ถ้าตัด ADMIN/SA จากการเขียน ไม่มีหน้าใดเรียกอยู่ (ตรวจแล้ว) แต่ต้อง grep `apps/frontend/src/lib/api/*.ts` อีกรอบก่อนลงมือ; การกรองการอ่านกระทบ `app/staff/curriculum/page.tsx` (`inScope`/ตัวเลือกหลักสูตร), `components/auth/dependent-org-select.tsx` (ใช้ `/curricula` สาธารณะ ไม่กระทบ), หน้านักศึกษาที่เรียก `/courses` `/clos` `/plos`
**ความเสี่ยง/ย้อนกลับ:** เสี่ยงที่สุดคือการกรองอ่าน (หน้านักศึกษา/อาจารย์ที่พึ่ง `/courses` ทั้งแคตตาล็อกจะว่าง) ทำเป็น PR แยกตาม endpoint ย้อนกลับด้วย revert; การตัดสิทธิ์เขียนย้อนกลับง่าย
**ขนาด:** ใหญ่ (ตัด @Roles = เล็ก, กรองอ่าน = ใหญ่) · **โมเดล:** Plan (Opus High) สำหรับกฎการกรองอ่านและเรื่องเกรด, Impl (Sonnet Medium) ส่วนที่เหลือ · **db:backup:** ไม่มี migration; สำรองก่อนทดสอบ Docker
**ผลที่ทำแล้ว (2026-10-10):** ตัด `@Roles` ตามตาราง (เขียน courses/categories/requirements/prerequisites/course-instructors/invitation resend = STAFF; CLO/PLO/mapping และ departments/programs/curricula = SUPER_ADMIN; เกรดเขียนถอด SA/ADMIN) มีเทสต์ตารางสิทธิ์ `src/common/roles-table.spec.ts` · `DELETE /courses/:id` ตอบ 409 ภาษาไทยเมื่อมีผลการเรียน/อาจารย์/CLO/รายการประเมิน/การประเมินรายวิชา/แผนการเรียนผูกอยู่ (ตรวจก่อนลบ prerequisite) และ `/staff/curriculum` มีปุ่ม "ลบรายวิชา" ท้ายแผงแก้ไขวิชา (ยืนยันก่อนลบ แสดงข้อความ 409 ในแผง) · ข้อความลบหมวดที่ถูกกันขยายให้บอกวิธีแก้ · `POST /student-course-records` ปฏิเสธ (400 ไทย) เมื่อวิชาไม่อยู่ในหลักสูตรของนักศึกษา · `GET /users/instructors` เฉพาะ `isActive` (ยังส่ง email)
**ยังไม่ได้ทำในชุด 2 (รอบถัดไป):**
- กรองอ่านรายบทบาททีละ endpoint (PR แยก) เริ่มที่ STUDENT `/clos` `/plos` `/clo-plo-mappings` (ตอนนี้เห็นทั้งระบบ) แล้วค่อย `/courses` `/prerequisites` `/course-categories` `/curriculum-requirements` และ `GET /course-instructors` (กรองด้วย `getCoveredProgramIds`); `fetchCourses` ถูกใช้ทั้งนักศึกษา/staff/อาจารย์ ต้องดูผลต่อหน้าก่อนกรอง
- ผูกอาจารย์กับหน่วยงาน (ให้ `GET /users/instructors` กรองตามขอบเขตจริง) — ต้องแก้ schema/migration จึงรอ
- audit การแก้เกรดของ STAFF/INSTRUCTOR — รอชุด 3

### ชุด 3 — audit log + lastLogin
**เป้าหมาย:** บันทึกการกระทำสำคัญ ตรวจย้อนหลังได้ และแสดง "เข้าสู่ระบบล่าสุด" ในหน้าผู้ใช้

**ปัจจุบัน:** ไม่มีตาราง audit; ระเบียนเกรดมีฟิลด์ผู้บันทึกเอง (`StudentCourseRecord.enteredByUserId`, `enteredByRole` — `prisma/schema.prisma` ~729); `User` ไม่มี `lastLoginAt`

**Schema (Prisma) ที่เสนอ:**
- `User.lastLoginAt DateTime?`
- `model AuditLog { id uuid; createdAt DateTime @default(now()); actorUserId String? (FK User, onDelete SetNull หรือ Restrict ตามกฎโปรเจกต์ = Restrict); actorRole Role?; action String (เช่น `USER_SUSPEND`, `USER_ROLE_ASSIGN`, `SCOPE_REVOKE`, `ORG_DEACTIVATE`, `ORG_REACTIVATE`, `GRADE_UPDATE`, `INVITATION_RESEND`, `PASSWORD_CHANGE`, `TWO_FACTOR_DISABLE`); entityType String; entityId String?; summary Json? (ค่าก่อน/หลังเท่าที่จำเป็น ห้ามเก็บรหัสผ่าน/โทเค็น/อีเมลเต็ม); @@index([createdAt]) @@index([entityType, entityId]) @@index([actorUserId, createdAt]); @@map("audit_logs") }`
- Migration: `npx prisma migrate dev --create-only` แล้วตรวจก่อน apply (ตามคำเตือนใน `schema.prisma` เรื่อง partial index) ห้ามรับค่าอัตโนมัติ

**ไฟล์/จุดเขียนข้อมูล:**
- ใหม่: `backend/src/common/audit/audit.module.ts` (Global) + `audit.service.ts` `record(actor: RequestUser, action, entity, summary?, tx?)`
- `lastLoginAt`: อัปเดตที่ `auth.service.ts` ใน `login()` (~254) เมื่อออกโทเค็นจริง, ขั้น 2FA verify สำเร็จ, Google callback ที่ login สำเร็จ, และหลังสมัครที่ login อัตโนมัติ (อย่าอัปเดตตอน `refresh`)
- เรียก `audit.record` ใน: `users/user-management/user-management.service.ts` (สร้างผู้ใช้, `updateActiveStatus`, `assignRole`/`revokeRole`, `resendInvitation`), `users/user-scope` (assign/revoke), ทุก `remove()`/`reactivate()` ของ organization/academic-record, `student-course-record.service.ts` (create/update/remove ที่ STAFF/ADMIN ทำ), `auth/student-invitation.service.ts`, การเปลี่ยนรหัสผ่าน/2FA ใน `auth.service.ts`/`two-factor.service.ts` ควรเขียนใน transaction เดียวกับการเปลี่ยนจริงเมื่อทำได้
- อ่านข้อมูล: `GET /audit-logs?entityType&entityId&actorUserId&from&to&cursor` (SUPER_ADMIN เท่านั้น, แบ่งหน้าแบบ cursor); `GET /users` เพิ่ม `lastLoginAt` ใน `toSummary` (`user-management.service.ts`)

**เทสต์ที่ต้องเพิ่ม:** `audit.service.spec.ts` (บันทึก actor/action/entity, ไม่เก็บฟิลด์ต้องห้าม, ทำงานใน tx เดียวกัน, ล้มเหลวแล้วไม่ทำให้การเขียนหลักล้ม *หรือ* ทำให้ล้มตามนโยบายที่เลือก); `auth.service` login/2FA/Google อัปเดต `lastLoginAt` และ refresh ไม่อัปเดต; `audit-log.controller.spec.ts` (SA เท่านั้น); `user-management.service.spec.ts` ส่ง `lastLoginAt`

**ผลต่อ frontend:** `packages/shared-types/src/index.ts` (`AdminUserSummary.lastLoginAt`, `AuditLogEntry`), `components/admin/user-list-table.tsx` (คอลัมน์/บรรทัดการ์ด "เข้าสู่ระบบล่าสุด" ใช้ `formatThaiDate` จาก `lib/admin-users.ts`; "ยังไม่เคยเข้าสู่ระบบ" เมื่อ null), `app/admin/users/[id]/page.tsx` (แสดงค่า + ส่วน "ประวัติการเปลี่ยนแปลงของบัญชีนี้" ใช้ endpoint audit กรอง `entityId`), หน้าใหม่ `/admin/audit-log` (**เมนู SA ล็อกไว้ 4 รายการ** ใน `components/dashboard/nav-config.ts` + เทสต์ `nav-config.spec.ts` ต้องตัดสินใจว่าจะเพิ่มเมนูที่ 5 หรือซ่อนไว้ใต้หน้าผู้ใช้); สถานะ loading/empty/error ใช้ของกลาง
**นโยบายข้อมูลส่วนบุคคล (ต้องตัดสินก่อน):** เก็บเฉพาะรหัสผู้ใช้/บทบาท/การกระทำ/เอนทิตี ไม่เก็บ IP/User-Agent ในรอบแรก (หรือเก็บแบบแฮชถ้าจำเป็น); อายุการเก็บ (แนะนำ 12 เดือน) + สคริปต์ล้างตามรอบ (ยังไม่มี `@nestjs/schedule` ในโปรเจกต์ จึงเริ่มจากสคริปต์ `scripts/` ที่รันมือ); สิทธิ์ดู = SA เท่านั้น; แจ้งในหน้านโยบายความเป็นส่วนตัว (เชื่อมกับ PDPA ชุด 4)
**ความเสี่ยง/ย้อนกลับ:** ตารางโตเร็ว (index + ล้างตามรอบ); เขียน log ใน transaction เดียวกันทำให้ธุรกรรมช้าลงเล็กน้อย; ย้อนกลับ migration: เพิ่มคอลัมน์/ตารางใหม่ล้วน (ไม่ลบข้อมูลเดิม) จึงปลอดภัย แต่ต้องมี migration down เป็นสคริปต์มือ
**ขนาด:** ใหญ่ · **โมเดล:** Plan (Opus High) ออกแบบ schema + นโยบาย แล้ว Impl (Sonnet Medium) · **db:backup:** **ต้องทำก่อน** `migrate` ทุกครั้ง (`npm run db:backup -- before-audit-log`) และก่อนทดสอบ Docker

### ชุด 4 — อีเมล/การสมัคร: ส่งคำเชิญซ้ำ, ยืนยันอีเมล, Google, PDPA
**4.1 ส่งคำเชิญ/ลิงก์ตั้งรหัสผ่านซ้ำ — ทำแล้ว (2026-10-10)**
- `POST /users/:id/resend-invitation` ใช้ทางเดียวกับตอนสร้างผู้ใช้ (`passwordResetService.create` ซึ่งลบโทเค็นเก่าที่ยังไม่ใช้ + `sendPasswordSetupEmail(..., 'new-account')`) · เงื่อนไข "ยังไม่ตั้งรหัสผ่าน" = `mustChangePassword` (ไม่เพิ่มฟิลด์/ไม่มี migration) → ตั้งแล้วได้ 409 ไทย · ห้ามส่งให้ตัวเอง (403) · SA ส่งให้ใครก็ได้ยกเว้นตัวเอง, ADMIN เฉพาะ STAFF-only ในขอบเขต (นอกขอบเขต = 404 ตามแบบเดียวกับ endpoint อื่น) · throttle 3/นาที (ตามไอพี ตามค่ากลางของ `ThrottlerGuard`) · ส่งอีเมลไม่ได้ = 503 ข้อความไทย · ไม่ log โทเค็น/ลิงก์
- หน้า `/admin/users` (ตาราง/การ์ด, เฉพาะ SA) และ `/admin/users/[id]` มีปุ่ม "ส่งคำเชิญซ้ำ" แสดงเฉพาะเมื่อ API จะรับ (`lib/resend-invitation.ts` `canResendInvitation`)
- **ยังค้างจากชุด 4.1:** `POST /auth/accept-invitation` + `PendingInvitation` ไม่มีผู้ใช้แล้ว (ไม่มีหน้าจอ และ `resend-invitation` เลิกใช้) ต้องตัดสินว่าจะลบหรือเก็บ · ยังไม่ได้ลองส่งอีเมลจริง end-to-end (เทสต์ใช้ mock ทั้งหมด) · throttle ตามไอพี ไม่ใช่ตามผู้ขอ
- **ลบบัญชีถาวร (ยังไม่ทำ):** ลบถาวรเฉพาะบัญชีที่ไม่มีข้อมูลผูก (backend + นโยบายข้อมูลส่วนบุคคล) — ตอนนี้มีแค่ระงับ/เปิดใช้งาน
- **ยังไม่ทำ (ชุด 4 ที่เหลือ):** 4.2 ยืนยันอีเมลตอนสมัคร · 4.3 ธง Google login ใน Docker (`NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN` ใส่ผ่าน build arg ไม่ได้) · 4.4 PDPA

**4.2 ยืนยันอีเมลตอนสมัคร (ถ้าเอา)**
- Schema: `User.emailVerifiedAt DateTime?` + `model EmailVerificationToken` (รูปแบบเดียวกับ `PasswordResetToken`: `tokenHash @unique`, `userId @unique`, `expiresAt`); migration ต้อง backfill `emailVerifiedAt = createdAt` ให้ผู้ใช้เดิมทั้งหมด
- Backend: `AuthService.register` ส่งอีเมลยืนยัน (`email.service.ts` เพิ่ม `sendVerificationEmail`), `POST /auth/verify-email` (token), `POST /auth/resend-verification` (throttle เข้ม); บัญชีผ่านคำเชิญ (ตรวจอีเมลแล้วจากตัว token), Google (Google ยืนยันแล้ว), ผู้ใช้ที่แอดมินสร้างและตั้งรหัสผ่านเอง ให้ตั้ง `emailVerifiedAt` ทันที
- นโยบาย: ห้าม login จนกว่ายืนยัน หรือ login ได้แต่มีแถบเตือน (ต้องตัดสินใจ); frontend `app/register/page.tsx` (ข้อความ "ตรวจอีเมลเพื่อยืนยัน" แทนการ login อัตโนมัติ), หน้าใหม่ `/verify-email`, `app/login/page.tsx` จัดการ 403 "ยังไม่ยืนยันอีเมล" + ปุ่มส่งซ้ำ; เทสต์ service + controller
- **ขนาด:** ใหญ่ · **Plan (Opus High)** · **ต้อง db:backup ก่อน migration**

**4.3 เปิด Google login**
- Backend พร้อม (`auth/strategies/google.strategy.ts`, `/auth/google`, `/auth/google/callback`, `/auth/google/complete-registration`) ต้องตั้ง `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` ใน `apps/backend/.env` และเพิ่ม redirect URI ใน Google Cloud Console
- **จุดที่จะพลาด:** `frontend/Dockerfile` ประกาศ build arg แค่ `NEXT_PUBLIC_API_URL` ดังนั้น `NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN` **ใส่เข้า image ผ่าน Docker ไม่ได้** ต้องเพิ่ม `ARG`/`ENV` ใน Dockerfile และ `build.args` ใน `docker-compose.yml` (ค่าถูก inline ตอน build จึงต้อง `docker:rebuild`)
- ตัดสินใจ: จำกัดโดเมนอีเมลสถาบัน (`hd`) หรือไม่ (ปัจจุบันบัญชี Google ใดก็สมัครเป็นนักศึกษาได้ถ้ากรอกรหัสนักศึกษา); เทสต์: `google.strategy`/`auth.controller.google-callback.spec.ts` มีอยู่แล้ว เพิ่มกรณีโดเมน
- **ขนาด:** เล็ก (ค่าตั้ง) + กลางถ้าจำกัดโดเมน · **Impl**

**4.4 PDPA checkbox + หน้านโยบาย**
- Frontend: `lib/validation/register.schema.ts`, `invited-register.schema.ts`, `complete-google-registration.schema.ts` เพิ่ม `acceptedPolicy: z.literal(true, { errorMap: … 'กรุณายอมรับนโยบายความเป็นส่วนตัว' })`; `app/register/page.tsx` (ทั้งสองโหมด) และ `app/register/google/page.tsx` เพิ่ม checkbox + ลิงก์ไปหน้าใหม่ `app/privacy/page.tsx` (เนื้อหาต้องได้จากฝ่ายกฎหมาย/มหาวิทยาลัย ห้ามแต่งเอง)
- Backend: เก็บหลักฐานการยินยอม — `RegisterDto`/`CompleteGoogleRegistrationDto` รับ `policyVersion`, `User.policyAcceptedAt`/`policyVersion` (migration) บันทึกใน `auth.service.ts` `createStudentAccount`; เทสต์ DTO + service
- **ขนาด:** กลาง · **Impl** (เนื้อหานโยบายรอผู้ใช้) · **ต้อง db:backup ก่อน migration**

### ลำดับที่แนะนำ
1. **ชุด 1 ส่วน JWT** (เล็ก ปิดช่องโหว่สิทธิ์ล่าช้า ไม่มี migration)
2. **ชุด 2** (เริ่มจากตัด `@Roles` + `DELETE /courses` + ลดข้อมูล `/users/instructors` ก่อน แล้วค่อยกรองการอ่าน)
3. **ชุด 1 ส่วนเปิดคืน** (เกี่ยวกับ UI SA ที่เพิ่งทำเสร็จ)
4. **ชุด 3** (migration แรก; `lastLoginAt` จำเป็นต่อชุด 4.1)
5. **ชุด 4:** 4.1 → 4.3 → 4.4 → 4.2 (ยืนยันอีเมลทำท้ายสุดเพราะกระทบการสมัครทั้งหมด)

### ต้องให้ผู้ใช้ตัดสินใจก่อนเริ่มแต่ละชุด
- **ชุด 1:** (ก) จะใช้ cache สั้นหรือไม่ (แนะนำไม่ใช้ก่อน เพราะมี query ต่อคำขออยู่แล้ว วัดก่อน) (ข) เปิดคืนวิชา/CLO/PLO ด้วยหรือไม่ (ตอนนี้ครอบคลุมเฉพาะหน่วยงาน/หลักสูตร/ปี/ภาค/ผู้ใช้) (ค) เปิดคืนแล้วต้องการให้เปิดลูกที่ถูกปิดตามให้ด้วยหรือไม่ (แนะนำไม่)
- **ชุด 2:** (ก) ADMIN และ SA ควรเขียน CLO/PLO/mapping ได้อยู่หรือไม่ (ถ้าไม่มีหน้าแก้ไข แนะนำปิดทั้งคู่ หรือเหลือ SA) (ข) STAFF แก้/ลบเกรดนักศึกษาในขอบเขตได้เต็มที่ต่อไปหรือไม่ — แนะนำคงไว้แต่ต้องมี audit และถอด ADMIN/SA ออก (ค) `GET /users/instructors`: ยอมรับรายชื่ออาจารย์ทั้งระบบแบบข้อมูลน้อยที่สุด หรือจะผูกอาจารย์กับหน่วยงาน (ง) ยอมให้นักศึกษา/อาจารย์เห็นเฉพาะหลักสูตรของตนใช่หรือไม่
- **ชุด 3:** อายุการเก็บ log, เก็บ IP/User-Agent หรือไม่, ใครดู log ได้ (แนะนำ SA เท่านั้น), เมนู SA ที่ 5 หรือซ่อนใต้หน้าผู้ใช้, ถ้าเขียน log ล้มเหลวให้ธุรกรรมหลักล้มด้วยหรือไม่
- **ชุด 4:** ยืนยันอีเมลแบบบังคับ/เตือน/ไม่ทำ; จะเปิด Google หรือไม่และจำกัดโดเมนไหม; ข้อความนโยบายความเป็นส่วนตัวจริงจากมหาวิทยาลัย; ยังต้องการ `POST /auth/accept-invitation` หรือยกเลิก

### ข้อกำหนดทั่วไปทุกชุด
- รัน `npm run db:backup -- <label>` **ก่อน** ชุดที่แตะฐานข้อมูล (ชุด 3, 4.2, 4.4) และก่อนรอบทดสอบ/`docker:rebuild` ทุกครั้งตามกฎ `apps/CLAUDE.md`; migration สร้างด้วย `--create-only` แล้วตรวจก่อนเสมอ ห้าม `docker compose down -v`/`volume rm`/`system prune`
- เทสต์ backend (`npx jest` ใน `apps/backend`, ปัจจุบัน 159 ข้อ) และ `npx tsc --noEmit` ต้องผ่านก่อนคอมมิตทุกครั้ง; ฝั่ง frontend `tsc`/`lint`/`jest`/`next build` ผ่านด้วยเมื่อแก้ UI
- เปลี่ยน endpoint/ชนิดข้อมูลที่ frontend ใช้ ให้แก้ `packages/shared-types/src/index.ts` ในคอมมิตเดียวกัน และอัปเดต TODO.md ลบรายการที่ทำเสร็จ
- ห้าม push และห้ามรัน `cleanup-demo` จนกว่าผู้ใช้สั่ง; แยกคอมมิตเป็นชุดย่อยที่ย้อนกลับได้

### SUPER_ADMIN จัดการบัญชีเท่านั้น: งานค้าง (Phase 3)
- UI เขียนหลักสูตรสำหรับ ADMIN ยังไม่มี: ตอนนี้ `POST/PATCH/DELETE /curricula` เป็นของ ADMIN (ตาม scope) แต่หน้า `/admin/organization` (SUPER_ADMIN) แสดงหลักสูตรแบบอ่านอย่างเดียว (`CurriculumPanel readOnly`) ต้องทำหน้าให้ ADMIN แล้วส่ง `readOnly={false}`
- CLO/PLO/CLO-PLO mapping เขียนผ่าน API/seed เท่านั้น (ไม่มี UI) และสิทธิ์เขียนย้ายเป็น ADMIN แล้ว
- ตรวจข้อมูลจริงแบบอ่านอย่างเดียว: บัญชี SUPER_ADMIN ที่ถือบทบาทอื่นด้วย (ADMIN/STAFF/INSTRUCTOR) ยังเข้าข้อมูลวิชาการผ่านบทบาทนั้น
- `GET /curricula/inactive` ของ ADMIN ไม่กรองตาม scope (ไม่มี `@ScopeTarget` สำหรับรายการ)

### ลบบัญชีผู้ใช้ถาวร (2026-10-13, **ยังไม่ commit**)
- `DELETE /users/:id/permanent` (SUPER_ADMIN) ทำแล้ว: ลบได้เฉพาะบัญชีที่ระงับและไม่มีข้อมูลอ้างอิง; บัญชีที่เคยบันทึก/แก้ผลการเรียน (`enteredByUserId`) หรือเป็นผู้เชิญนิสิต ลบถาวรไม่ได้ (ตัดสินใจบล็อก ไม่เปลี่ยน schema) — ถ้าภายหลังต้องการให้ลบได้ ต้องตัดสินใจเรื่อง `SetNull` + migration และเก็บ `enteredByRole` ไว้
- ยังไม่ทำ: แก้ไขชื่อ/อีเมลของบัญชี (ยังไม่มี endpoint หรือหน้าแก้ไข)
- ยังไม่ได้ลองกับ DB จริง/สำเนา: ทดสอบด้วย jest (mock) เท่านั้น ควรลองสร้างบัญชี `@test.local` ใหม่ → ระงับ → ลบ บนสำเนา DB ก่อนใช้จริง

