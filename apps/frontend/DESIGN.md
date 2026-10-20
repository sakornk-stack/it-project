# DESIGN.md — กฎดีไซน์ฝั่ง frontend

สกัดจากโค้ดที่มีอยู่จริง (ไม่ใช่กฎใหม่) พาธอ้างอิงจาก `apps/frontend/src/` ข้อความ "(ตรวจสอบ)" = ยังไม่ยืนยันจากโค้ด

## 1) หลักการ
- UI ภาษาไทยทางการ เรียกผู้เรียนว่า "นิสิต" (`ROLE_LABEL_TH` ใน `components/auth/require-role.tsx`)
- ไม่ใช้ `dark:` ซ้อน: เขียนคลาสสำหรับ Light แล้ว Dark ตามเอง (พาเลตต์ slate/emerald/amber/red/sky/violet/rose/blue ถูก mirror ใน `styles/theme-palette.css`) ใช้ `dark:` เฉพาะเมื่อขั้นสีนั้นอ่านไม่ออกจริง
- ใช้ token กลาง ไม่ hardcode สี: `bg-brand-light text-brand`, `text-primary`, `text-muted-foreground`, `bg-card`, `border` (ตัวแปรใน `app/globals.css`)
- ไม่เพิ่ม library: ใช้ Radix, lucide-react, tailwindcss-animate, react-query ที่มีอยู่ กราฟใช้ div/SVG
- โค้ด/ชื่อตัวแปร/คอมเมนต์เป็นอังกฤษ ข้อความที่ผู้ใช้เห็นเป็นไทย (`apps/CLAUDE.md`)

## 2) Token และสี
- สีบทบาท: `ROLE_BADGE_TONE` ใน `components/auth/require-role.tsx` → SUPER_ADMIN=danger, ADMIN=warning, INSTRUCTOR=success, STAFF/STUDENT=neutral ใช้ผ่าน `Badge tone=…`
- `lib/tone.ts`: `SemanticTone` = success|warning|danger|neutral; `BADGE_TONE_CLASSES` (ชิป), `TINT_TONE_CLASSES` (พื้นเซลล์/แถว), `BAR_TONE_CLASSES` (แท่ง/จุดสี), `ACCENT_TONE_CLASSES` (เส้นเน้นซ้ายของแถว/การ์ด ใช้เฉพาะแถวที่ต้องเตือน), `TOAST_*`
- StatCard (`components/dashboard/stat-card.tsx`): `tone` = `primary` | SemanticTone ย้อมไอคอนและตัวเลข; `large` ไอคอนไล่เฉด ตัวเลขคงสีหัวข้อ
- สถานะบัญชี: `accountStatus()` ใน `lib/account-status.ts` → ระงับการใช้งาน=danger, รอตั้งรหัสผ่าน=warning, ใช้งานปกติ=success (เฉพาะบัญชีใช้งานปกติมีจุดกะพริบ)
- สีเกรด: `lib/grade-badge-color.ts` (`gradeBadgeTone`, `gradeBadgeClassName`, `gradeBarClassName`) — A/B+/B/S=success, C+–D=warning, F/U=danger, W/I=neutral แท่งการกระจายเกรดไล่โทนต่อเนื่องตาม tone นี้ (เขียว→เหลือง→แดง) ห้ามใช้เทาสำหรับเกรดที่แสดงจริง เพราะดูเหมือนปิดใช้งาน
- สถานะปกติ/ผ่านใช้สีเขียวเฉพาะจุดเล็ก (จุดสถานะ ชิป ไอคอน) ห้ามระบายเขียวเป็นพื้นที่ใหญ่เพื่อบอกว่า "ปกติ"
- สี GPA: `gpaColorClassName` (`lib/gpa-color.ts`, ≥3.5 เขียว, <2.0 แดง) และ `gpaTone` (`components/ui/gpa-scale.tsx`, <1.50 danger, <1.75 warning) ใช้คู่กับ `TINT_TONE_CLASSES`
- Contrast: ข้อความต้องผ่าน WCAG AA ทั้ง Light/Dark (ตามคอมเมนต์ใน `globals.css` ที่ตรวจคู่สีของ `.dark`)

## 3) คอมโพเนนต์กลาง
| ชื่อ | ไฟล์ | ใช้เมื่อ | ข้อควรระวัง |
|---|---|---|---|
| StatCard | `components/dashboard/stat-card.tsx` | การ์ดตัวเลขสรุป | `href`/`onClick`+`showArrow` = ทั้งใบกดได้; `onSelect` = ตัวกรองแบบสลับ; ไม่ใส่ตัวเลข/เปอร์เซ็นต์ที่ API ไม่มี |
| PageHeader / PageSection | `components/layout/page-header.tsx`, `page-section.tsx` | หัวหน้า / หัวส่วน (ชื่อ+คำอธิบาย+ปุ่มขวา) | ปุ่มหลักอยู่ `actions`; ขนาดชื่อหน้า 28px อยู่ที่ `PAGE_TITLE_CLASS` ในไฟล์เดียวกัน หน้าไม่ตั้งขนาดเอง (`titleClassName` ไว้ปรับอย่างอื่น เช่นการตัดบรรทัด) |
| PageLoadError / StudentOnlyPage | `components/layout/page-states.tsx` | error ของหน้า (มีปุ่ม "ลองใหม่") | ส่ง `onRetry` เสมอ |
| EmptyState / InlineNotice | `components/ui/empty-state.tsx` | ไม่มีข้อมูล | `size` ใช้ได้เฉพาะคู่กับ `illustration` ไม่ใช่ `icon` |
| AccessDenied / AccessDeniedPage | `components/ui/access-denied.tsx`, `components/layout/page-states.tsx` | หน้า "ไม่มีสิทธิ์เข้าถึง" ตัวเดียวของทุกบทบาท (ไอคอนกุญแจในวงกลมโทน warning + หัวข้อ + คำอธิบายว่าหน้านี้สำหรับใคร + ปุ่มกลับแดชบอร์ดของ role ผู้ดู) อยู่ใน shell ของ role ผู้ดู | ไม่เรียกเอง: `RoleLayoutGuard` แสดงให้ทุก tree (รวม `(student)`); `StudentOnlyPage` เป็นตัวห่อบาง ๆ ของ `AccessDeniedPage` |
| Skeleton / StatCardsSkeleton / TableSkeleton / ListSkeleton | `components/ui/skeleton.tsx` | ระหว่างโหลด | รูปทรงต้องตรงของจริง |
| Pagination | `components/ui/pagination.tsx` | ตารางยาว (`PAGE_SIZES` 10/25/50) | — |
| ConfirmDialog | `components/ui/confirm-dialog.tsx` | ยืนยันการกระทำ | สูงไม่เกิน `100dvh-2rem` มี safe-area |
| PermanentDeleteDialog / PermanentDeleteButton | `components/admin/permanent-delete-button.tsx` | ลบถาวร | ต้องพิมพ์ยืนยัน; ห้ามทำปุ่มลบถาวรเอง |
| DeactivateConfirm | `components/admin/deactivate-confirm.tsx` | ปิดใช้งาน (soft delete) | 409 จาก API คือผู้ตัดสิน |
| StudentAccountStatusControl | `components/staff/student-account-status-control.tsx` | STAFF ระงับ/เปิดบัญชีนิสิต | ยืนยันสองชั้น (เหตุผล → พิมพ์รหัสนิสิต) ไม่ใช้ `DeactivateConfirm` เพราะเปิดคืนได้; ไม่มีปุ่มลบบัญชีนิสิต |
| StudentHistorySection | `components/staff/student-history-section.tsx`, `describe-audit-entry.ts` | ประวัติการเปลี่ยนแปลงของนิสิต (อ่านอย่างเดียว) | ข้อความแต่ละแถวมาจาก `describeAuditEntry` เท่านั้น; ไม่แสดงอีเมลผู้ทำ |
| Input / Combobox / Select | `components/ui/input.tsx`, `combobox.tsx`, `select.tsx` | ช่องกรอก | `h-11`, `text-base md:text-sm` กัน iOS zoom |
| Progress | `components/ui/progress.tsx` | แถบ 0–100 | `animateOnView` (ค่าเริ่มต้น) เติมครั้งเดียวตอนเข้า viewport |
| AnimatedNumber / AnimatedRing | `components/ui/animated-number.tsx`, `animated-ring.tsx` | ตัวเลข/วงแหวนนับขึ้น | ค่าว่างแสดง fallback ไม่นับ |
| Badge | `components/ui/badge.tsx` | ชิปสถานะ/บทบาท/รหัส | ใช้ `tone` ไม่ใส่สีเอง |
| InitialsAvatar | `components/ui/initials-avatar.tsx` | อวาตาร์ตัวอักษรแรก | — |
| Switch | `components/ui/switch.tsx` | สวิตช์เปิด/ปิด (`role=switch`) | สูง 44px ทั้งแถว |
| SectionCard / CollapsibleCard | `components/ui/section-card.tsx` | การ์ดส่วนของหน้ารายวิชาทุกแท็บ (หัว `DetailSectionHeader` ไอคอน+ชื่อ+คำอธิบาย) | การ์ดไม่ซ้อนการ์ด; แบบพับได้ใช้ `aria-expanded` + animate ความสูงด้วย grid-rows เนื้อหาที่พับเป็น `invisible` |
| Reveal / ScrollReveal | `components/layout/reveal.tsx` | เข้าฉากของบล็อก | ดูข้อ 5 |
| GradeEstimateBadge | `components/ui/grade-estimate-badge.tsx`, `lib/grade-estimate.ts` | ป้าย "ประมาณจากเกรด" กำกับ CLO%/PLO% ที่คำนวณจากเกรด (หัวการ์ด: radar, ภาพรวม PLO, หน้าวิชาของอาจารย์, PLO/CLO ต่ำสุดของ admin) | ข้อความกลางอยู่ที่ `GRADE_ESTIMATE_*` ห้ามพิมพ์ถ้อยคำเอง; วางที่หัวการ์ดละหนึ่งป้าย ไม่ซ้ำการ์ดข้างเคียง |
| PrivacyConsentField | `components/auth/privacy-consent-field.tsx` | ช่องยอมรับนโยบายในฟอร์มสมัครทุกเส้นทาง (สมัครเอง/ใบเชิญ/Google) | อยู่ใน `<Form>` ผูกกับ `acceptPrivacyPolicy` (`acceptPrivacyPolicySchema`); ทั้งแถวเป็น label สูง ≥44px; ลิงก์เปิดแท็บใหม่; payload ต้องส่ง `PRIVACY_POLICY_VERSION` |
| SignupCheckEmail | `components/auth/signup-check-email.tsx` | หลังสมัครด้วยอีเมล: บอกให้ตรวจอีเมล + ปุ่มส่งซ้ำ (นับถอยหลัง 60 วินาที) | ข้อความต้องไม่บอกว่าอีเมลมีบัญชีแล้วหรือไม่; ยืนยันจริงที่ `/register/verify` ซึ่งต้องกดปุ่มก่อน POST (กันโปรแกรมสแกนลิงก์) |
| PrivacyFooterLink | `components/layout/privacy-footer-link.tsx` | ลิงก์ "นโยบายความเป็นส่วนตัว" ท้าย `AuthSplitLayout` และ `DashboardShell` | — |
| AiDisclosureNotice | `components/ai/ai-disclosure-notice.tsx`, `lib/ai-disclosure.ts` | แจ้งก่อนปุ่มที่เรียก `fetchAiSkillAnalysis` (ส่งข้อมูลให้ Anthropic) | ยังไม่มีจุดใช้: ห้ามวางบนส่วนที่ไม่ได้เรียก API จริง (เช่นการ์ดสรุปผลที่ใช้กฎ) |
| DashboardShell | `components/dashboard/dashboard-shell.tsx` | กรอบหน้าทุกบทบาท | เมนูกำหนดใน `components/dashboard/nav-config.ts` |

## 4) คลาสกลาง (`app/globals.css`)
- `.interactive-card`: การ์ดกดได้ ยก 2px + ขอบ brand + เงา ตอน hover/focus-visible (hover เฉพาะอุปกรณ์ที่มี hover) ใส่บนองค์ประกอบที่มีขอบจริง (เช่น `<Link class="… border bg-card">`)
- `.interactive-row`: แถวกดได้ แค่เปลี่ยนพื้น ไม่ยก
- `.go-arrow`: ลูกศรภายใน card/row ลื่นเข้าตอน hover/focus; แสดงตลอดบนจอสัมผัส
- `.row-action`: ปุ่มเล็กในแถว (เช่น ถังขยะ) สีจางปกติ เป็นแดงตอน hover/focus ของแถว
- `.course-name-break`: ตัดบรรทัดชื่อภาษาไทยแบบวลี ไม่ตัดกลางคำ
- `.btn-ripple` (ปุ่มกด), `.reveal-pending` (สถานะเริ่มของ ScrollReveal), `.animate-shake` (รหัส 2FA ผิด)

## 5) Motion
- `Reveal index={n}`: หัวหน้า = 0 บล็อกถัดไปนับขึ้น; stagger 60ms ต่อ index สูงสุด index 6 (`lib/reveal.ts`)
- ใน `DashboardShell` `Reveal` รอจนบล็อกเข้า viewport (`RevealOnViewProvider`, `ScrollReveal`, `useInView`); `RevealOnScroll` คงไว้ให้โค้ดเก่า
- เล่นครั้งเดียวต่ออินสแตนซ์ ห้ามห่อแถวของรายการที่กรอง/เปลี่ยนหน้าบ่อย ใช้ `animate={false}` ถ้าห้ามขยับ
- ตัวเลข: `AnimatedNumber` (700ms, `COUNT_UP_MS`) ควบคุมด้วย `CountUpPolicy`; แท่ง: `Progress animateOnView`
- Transition มาตรฐาน 150–200ms (`interactive-*` 180ms, `row-action` 150ms)
- Reduced motion: ใช้ `motion-reduce:` กับ animate/transition; คลาสกลางปิดการยกการ์ดเองใน `globals.css`; กฎ global reduced-motion ที่คอมเมนต์ `.btn-ripple` อ้างถึง (ตรวจสอบ)

## 6) เลย์เอาต์
- โครงหน้า: `DashboardShell role=… identityLabel fullName` ครอบ; เนื้อหา `main` = `mx-auto max-w-7xl space-y-6 p-4 md:p-8 pb-24`
- เส้นทางตามบทบาท: `/dashboard` นิสิต, `/instructor/*`, `/staff/*`, `/admin/*`, `/superadmin/*` (`lib/dashboard-routes.ts`, แต่ละ tree มี `layout.tsx` กั้นสิทธิ์ด้วย `RoleLayoutGuard`: `/instructor` `/staff` `/admin` `/superadmin`; หน้านิสิตอยู่ route group `app/(student)/` (URL ไม่เปลี่ยน) ใช้ `RoleLayoutGuard role="STUDENT"` เช่นกัน; ผู้ที่ role ไม่ตรงเห็น `AccessDenied` ใน shell ของตนเหมือนกันทุก tree; `/profile` อยู่นอกกลุ่มเพราะทุกบทบาทใช้ — หน้าใหม่ห้ามห่อ `ProtectedRoute`/`RequireRole` เอง)
- หัวหน้า: `PageHeader` ชื่อ (`PAGE_TITLE_CLASS` = `text-[28px] font-semibold leading-tight text-primary` ทุกบทบาท) + คำอธิบาย 1 บรรทัด `text-sm text-muted-foreground` + ปุ่มหลักมุมขวา (มือถือเต็มความกว้าง `w-full sm:w-auto`, `min-h-11`)
- หัวส่วน: `PageSection` (`text-lg font-semibold`) หรือหัวการ์ด `DetailSectionHeader` = ไอคอนในช่อง `h-9 w-9 rounded-lg bg-brand-light text-brand` + ชื่อ + คำอธิบาย + action ขวา
- หน้าตั้งค่า/โปรไฟล์ใช้ `max-w-7xl` ชิดซ้ายเหมือนหน้าอื่น ไม่จัดกึ่งกลางด้วย `max-w` แคบ
- หน้าที่มีหลายส่วน: แท็บอยู่บนพื้นหน้า (ไม่อยู่ในการ์ด) ทุกส่วนเป็นการ์ดระดับเดียวกัน; จอ `xl` ขึ้นไปแบ่งสองคอลัมน์ (หลัก `xl:col-span-2` + ข้าง) มือถือ/แท็บเล็ตคอลัมน์เดียว (ตัวอย่าง `course-overview.tsx`)
- หน้ารายละเอียดต้นแบบ: `components/admin/user-detail-page-content.tsx` (กริด `lg:grid-cols-3`, aside ขวา sticky), `user-profile-card.tsx`, `user-access-aside.tsx`
- ระยะ/ขอบ/มุม: ช่องว่างบล็อก `space-y-6`, การ์ด `gap-4`, ภายในส่วน `space-y-4`; `rounded-lg border bg-card shadow-sm` (`components/ui/card.tsx`); ไอคอนช่อง `rounded-lg`; ชิป `rounded-full`

## 7) Responsive
- ตรวจเสมอที่ 360 / 390 / 768 / 1280 / 1536px ห้ามมี horizontal scroll ของหน้า
- ข้อความยาว: `min-w-0` บน flex child, `break-words` หรือ `truncate` พร้อม `title`
- Touch target ≥ 44px (`min-h-11`, `h-11`); ช่องกรอก `text-base md:text-sm` (≥16px บนมือถือ)
- Dialog: `max-h-[calc(100dvh-2rem)] overflow-y-auto` และ `pb-[max(1rem,env(safe-area-inset-bottom))]` (`confirm-dialog.tsx`)
- กริดการ์ด: 1 คอลัมน์ → `sm:grid-cols-2` → `lg/xl` 3–4 คอลัมน์

## 8) Accessibility
- Focus: `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2` (ปุ่ม `<button>` ทั่วไปได้ ring จาก `globals.css`)
- ผลตอบกลับที่เปลี่ยนแบบไดนามิก: `role="status" aria-live="polite"` (เช่น `user-list-filters.tsx`, `org-toolbar.tsx`, `session-timeout-dialog.tsx`)
- การ์ด/แถวกดได้เป็น `<a>`/`<button>` จริง + `aria-label` บอกปลายทางและจำนวน; ตัวกรองแบบสลับใช้ `aria-pressed`
- เมนู: Radix Popover + `role=menu/menuitem` (`org-node-menu.tsx`); รายการที่ใช้ไม่ได้ใช้ `aria-disabled` และพิมพ์เหตุผลเป็นข้อความ
- ต้นไม้องค์กร: ปุ่ม disclosure + `aria-expanded` ไม่ใช้ `role=tree` เพราะมีปุ่ม/ฟอร์มซ้อนในแถว
- ไม่พึ่งสีอย่างเดียว: สถานะมีข้อความ/ไอคอนกำกับ; แถบสัดส่วนมี legend ตัวเลข + `aria-label`
- ไอคอนตกแต่ง `aria-hidden="true"`

## 9) สถานะหน้า
- โหลด: `Skeleton`, `StatCardsSkeleton`, `TableSkeleton`, `ListSkeleton` (`components/ui/skeleton.tsx`); เฉพาะหน้า เช่น `user-list-skeleton.tsx`, `org-tree-skeleton.tsx`
- ก่อน auth พร้อม: วงกลม + แถบ `Skeleton` กลางจอ (รูปแบบซ้ำในทุกหน้า) / `RequireRole`
- Error: `PageLoadError` + `onRetry`; ฟอร์ม/การกระทำ: `ApiErrorAlert` (`components/ui/api-error-alert.tsx`)
- ว่าง: `EmptyState` (มี `action` เมื่อมีทางไปต่อ); ค้นหาไม่เจอใช้ `illustration="no-results"` + ปุ่มล้างการค้นหา
- ศูนย์: แสดง `0` ปกติ การ์ดยังกดได้ (`dimmed` ทำให้จางเมื่อเป็นศูนย์ได้)

## 10) ห้ามทำ / เคยพลาด
- ห้ามใช้สี GPA ตามช่วงของนิสิตกับค่าเฉลี่ยรายวิชา (ตรวจสอบ — ยังไม่พบคอมเมนต์ในโค้ด)
- ห้ามสร้างปุ่มลบถาวรเอง ต้องใช้ `PermanentDeleteButton`/`PermanentDeleteDialog`; หน้าโครงสร้างองค์กร (`inactive-org-section.tsx`) ลบถาวรได้เฉพาะคณะ/ภาควิชา/สาขาที่ปิดใช้งาน (`PermanentlyDeletableOrgResource` ใน `lib/api/organization.ts`) หลักสูตรไม่มีลบถาวรในหน้านี้
- ห้ามแต่งตัวเลข/เปอร์เซ็นต์/แนวโน้มที่ API ไม่มี (ดูคอมเมนต์ใน `stat-card.tsx`) เช่น ไม่มี "ปีการศึกษาปัจจุบัน" (`academic-years/page.tsx`)
- ชื่อตัวเลขหน่วยกิต (`lib/credit-labels.ts`): "ความคืบหน้าหน่วยกิต" = สัดส่วนหน่วยกิตอย่างเดียว; "ความพร้อมสำเร็จการศึกษา" = `GraduationReadiness.isReady` (หน่วยกิต + วิชาบังคับ + หมวดวิชา) เท่านั้น; "หน่วยกิตสะสม" = วิชาในหลักสูตรที่ผ่าน (รวม S ไม่รวม F/U/W/I); "หน่วยกิตที่นับ GPA" รวม F แยกชื่อ
- ปุ่ม "ปรับช่วงหน่วยกิตในแผน" ตั้งเองได้ ไม่มีผู้อนุมัติ/ไม่มีการแจ้งใคร: ถ้อยคำใช้ "ตั้ง/บันทึก" ห้ามใช้ "ขอ/ส่งคำขอ" (`CREDIT_LIMIT_SELF_SET_NOTE`)
- สมัครด้วยตนเอง: โดเมนกลางอยู่ที่ `lib/signup-domain.ts` (ใบ้/ตรวจล่วงหน้าเท่านั้น backend ตัดสิน); ข้อความ error ของ Google อยู่ที่ `lib/google-login-error.ts` (whitelist code)
- นโยบายความเป็นส่วนตัว (`/privacy`, เนื้อหาใน `lib/privacy-policy.ts`): เขียนจากข้อเท็จจริงของระบบเท่านั้น; แก้เนื้อหาแล้วต้องเพิ่ม `PRIVACY_POLICY_VERSION` ทั้ง frontend และ backend (`common/privacy/privacy-policy.constant.ts`) พร้อมกัน
- ห้ามเปลี่ยนสิทธิ์/พฤติกรรมเดิมระหว่างงานดีไซน์ (เพิ่ม/แก้/ปิด/เปิดใช้งาน/ลบถาวร + dialog)
- ห้ามค่าจาก URL (`?role=`, `?create=`) เชื่อตรง ๆ ต้องตรวจ (`parseRoleParam` ใน `lib/user-list-filter.ts`)
- `prettier`: repo ไม่มี config ใช้ `--single-quote --print-width 100 --trailing-comma all`; ห้าม `--write` ทั้งไฟล์ที่เดิมไม่ผ่าน
- Docker/ฐานข้อมูล: ห้าม `down -v`/`volume rm`/`system prune`; `bash scripts/db-backup.sh <label>` ก่อนทดสอบที่แตะ Docker (`apps/CLAUDE.md`)
- ห้าม commit/push หรือถ่ายภาพหน้าจอ ถ้าผู้ใช้ไม่สั่ง

## 12) Instructor pages
ใช้กับ `/instructor/dashboard`, `my-courses`, `courses/[courseId]`, `students`, `year-levels` (ค่ากลางอยู่ใน `components/instructor/instructor-ui.ts`)
- หัวหน้า: `PageHeader` (ขนาดชื่อเป็นค่าเริ่มต้น `PAGE_TITLE_CLASS`; `TEXT_PAGE` ใน `instructor-ui.ts` ชี้ค่าเดียวกัน) (ชื่อ + คำอธิบายบรรทัดเดียว + action ขวา) แล้วแถบสรุป `StatCard` + `AnimatedNumber` เมื่อมีตัวเลข; หัวส่วน `PageSection` + `TEXT_SECTION`; ระหว่างส่วน `space-y-6`, ในกริด `gap-4`
- การ์ด: `CARD` (`rounded-xl border-slate-200 shadow-sm`) + `CARD_PAD` (`p-5`) มุมเดียวทั้งระบบ; การ์ดกดได้เติม `interactive-card` (ยก 2px + เงา + `.go-arrow` 180ms) การ์ดไม่ซ้อนการ์ด
- การ์ดรายการ: avatar/ไอคอนซ้าย → ชื่อ (`font-semibold truncate`) + เมตาบรรทัดเดียว (`text-xs text-muted-foreground truncate` + `title`) → ชิปสถานะเดียวขวา → `.go-arrow`; ทั้งใบเป็น `<Link>`; ไม่พิมพ์ซ้ำสิ่งที่ตัวกรองบอกอยู่แล้ว
- ชิปเกรด: `GradeChip` (`components/instructor/grade-chip.tsx`) เท่านั้น ไม่เขียนคำว่า "เกรด" ลอย (มี `sr-only`); สีตาม `gradeBadgeTone` เขียวเฉพาะชิป/จุดเล็ก
- Toolbar: ชิปกรอง → select → ค้นหา → ล้างตัวกรอง `h-11` แถวเดียวที่ `xl` (`student-filter-bar.tsx`) ซ่อน select ถ้ามีตัวเลือกเดียว; ใต้แถวมี "แสดง X จาก N" (`role=status`); รายการยาวใช้ `Pagination` 12/หน้า
- แถบสีขอบซ้าย: เฉพาะการ์ด/แถวที่ต้องเตือน `border-l-4` + `ACCENT_TONE_CLASSES` (warning = D/D+, danger = F/U; ปกติไม่มีแถบ) อธิบายผ่าน `title`/`aria-label` ไม่ใช้จุดสี+legend; หน้านิสิตใช้กริดการ์ด 1/2/3 คอลัมน์ ไม่มีมุมมองแถว; ตัวเรียงเป็น select เดียวใน toolbar
- รายการนิสิตใช้ร่วมกันสองที่ (หน้า `students` และแท็บนิสิตในหน้าวิชา): `StudentFilterBar` (ชิป + ค้นหา + select เรียง + `actions` ขวา), `StudentCardFrame`/`StudentIdentity`/`StudentCardGrid`/`StudentListStatus` ใน `student-card.tsx`, `GradeChip`, `Pagination` 12/หน้า
- Empty = `EmptyState` + `illustration`; Skeleton ทรงเดียวกับการ์ดจริง; Reveal stagger เบาเฉพาะครั้งแรก (`motion-reduce:` ปิดการขยับ)

## 11) ขั้นตอนมาตรฐานท้ายงานดีไซน์
1. `npx tsc --noEmit` (ใน `apps/frontend`)
2. `npx next lint --dir src/...` เฉพาะโฟลเดอร์ที่แตะ
3. `npx jest src/lib src/components` (หรือ spec ที่เกี่ยวข้อง)
4. `npx prettier --check` (flags ข้อ 10) เฉพาะไฟล์ใหม่
5. ส่งรายการให้ผู้ใช้ตรวจด้วยตา: Light/Dark, 3 ความกว้าง, กดทุกการ์ด/ปุ่มไปถูกที่, คีย์บอร์ด, reduced-motion

## รูปแบบรายงานท้ายงานดีไซน์
รายงานสั้นไม่เกิน 15 บรรทัด ไม่แปะโค้ด ประกอบด้วย:
- ไฟล์ที่แก้/สร้าง
- สิ่งที่เปลี่ยน (ต่อข้อ สั้น ๆ)
- สิ่งที่ตั้งใจไม่ทำและเหตุผล
- รายการให้ผู้ใช้ตรวจด้วยตา
