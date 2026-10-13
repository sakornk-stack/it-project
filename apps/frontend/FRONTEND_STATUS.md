# Frontend Status (สรุปสถานะ ณ 2026-09-19)

> อ่านไฟล์นี้ก่อนเริ่มงานทุกครั้ง เพื่อไม่ต้อง re-explore โค้ด
> ดู backlog เต็มที่ root `TODO.md`

## 1. หน้าที่เสร็จแล้ว (ทุกหน้า functional, ต่อ API จริงผ่าน react-query)

### STUDENT

| Path | สรุป |
|---|---|
| `app/page.tsx` | Landing, auth-aware redirect |
| `app/login/page.tsx` | Login form (RHF+zod) — 1-factor email+password, ได้ token ทันที |
| `app/register/page.tsx` | Register form + org/curriculum select — 1-factor, ได้ token ทันที |
| `app/register/google/page.tsx` | Complete Google OAuth signup |
| `app/(auth)/forgot-password/page.tsx` | ขอ reset password (email เป็น mock) |
| `app/(auth)/reset-password/page.tsx` | Reset password ด้วย token |
| `app/dashboard/page.tsx` | Dashboard: stat cards + entrance animation |
| `app/academic-record/page.tsx` | Transcript timeline, entrance + removal animation |
| `app/aptitude-analysis/page.tsx` | PLO radar chart + rule-based interpretation (ไม่ใช้ AI live) |
| `app/clo-plo-analysis/page.tsx` | CLO/PLO achievement cards |
| `app/course-assessment/[courseId]/page.tsx` | Self-assessment form ต่อ course |
| `app/credit-checker/page.tsx` | Credit check (สรุปหน่วยกิต, วิชาที่ต้องจัดการ, ความคืบหน้าตามหมวด) |
| `app/learning-path/page.tsx` | Drag-and-drop planner (client-only, ไม่มี persist) |
| `app/profile/page.tsx` | Profile/org info + เปลี่ยนรหัสผ่าน — **เปิดให้ทุก role แล้ว** (เดิม STUDENT-only), non-STUDENT เห็นแค่ identity card + role badge + change-password (ไม่มี "ข้อมูลการศึกษา") |

### INSTRUCTOR

| Path | สรุป |
|---|---|
| `app/instructor/dashboard/page.tsx` | ภาพรวมทุกวิชาที่สอน — stat cards, สรุปภาพรวมรายวิชาแบบ rule-based (ไม่ใช่ AI), at-risk alert (แยก CRITICAL/WATCH), course comparison chart, course card grid (status badge อิง threshold จริง) |
| `app/instructor/courses/[courseId]/page.tsx` | หน้ารายวิชา — แยกเป็น route จริงจาก dashboard แล้ว (เดิมเป็น `?courseId=` query param บนหน้าเดียว) **5 tab** ผ่าน `?tab=` แบ่งตามคำถามที่ตอบ: **ผลการเรียน** (`grades` — การกระจายเกรด + แนวโน้มรายเทอม รวมกัน) / **ผลลัพธ์การเรียนรู้** (`clo` — CLO/PLO เทียบ threshold) / **Gradebook** (`roster` — search+risk filter+CSV+timeline เป็น side panel) / **Assessment Evidence** (`evidence`) / **ข้อมูลรายวิชา** (`course`) |

ดึงข้อมูลจาก `GET /dashboard/instructor` เป็นหลัก (course grid + grade distribution + CLO/PLO list + at-risk + semester trend มาในก้อนเดียว) ส่วน `GET /clo-achievement/course/:id`, `GET /courses/:id/students`, assessment evidence ยิงแบบ lazy เฉพาะตอนเปิด tab นั้นจริง — ดู `src/components/instructor/instructor-detail-panel.tsx` สำหรับ query lifecycle ทั้งหมด (อยู่ที่ parent เดียว ลูกเป็น presentational ล้วน)

ทดสอบ end-to-end ผ่านเบราว์เซอร์จริงแล้วทุก feature (Playwright, demo-instructor) — รายการ 9 feature เต็มพร้อม commit hash + design decision ของแต่ละตัว ดูที่ root `TODO.md` หัวข้อ "INSTRUCTOR Dashboard — gradebook/course management"

`parseInstructorTab` fallback เป็น `grades` → ลิงก์เก่า `?tab=trend` (ก่อนรวม tab) ตกลงที่ tab ที่บรรจุ trend อยู่พอดี ไม่ต้องมี redirect · deep-link เดียวในโค้ดเบสคือ `?tab=roster` จาก at-risk card

### ADMIN (SUPER_ADMIN only)

| Path | สรุป |
|---|---|
| `app/admin/academic-years/page.tsx` | CRUD ปีการศึกษา+ภาคเรียน (create/soft-delete ทั้งคู่, semester ผูกกับปีที่เลือก, ป้องกันเพิ่มภาคเรียนซ้ำ term เดิมในปีเดียวกันฝั่ง UI ด้วยการกรอง `availableTerms`) |

ไม่มี edit ปี/เทอมในตัว (แค่ create+delete) — backend มี PATCH ให้แล้วแต่ยังไม่ได้ทำ UI แก้ไข (เพิ่มทีหลังได้ถ้าจำเป็น) `RequireRole role="SUPER_ADMIN"` เท่านั้น (ตรงกับ backend guard ของ mutating endpoint — GET เปิดกว้างกว่านั้นแต่หน้านี้ทั้งหน้าเป็นหน้า manage จึงจำกัดทั้งหน้า) ทดสอบ end-to-end ผ่านเบราว์เซอร์จริงแล้ว (2026-08-25): create, duplicate-year 409, add/delete semester, delete year, role-block ครบ

ไม่มีหน้า stub — ทุกหน้าดึงข้อมูลจริงผ่าน `lib/api/*`.

### Cross-cutting: บังคับเปลี่ยนรหัสผ่านครั้งแรก (2026-08-25)

`ProtectedRoute` (`src/components/auth/protected-route.tsx`) เช็ค `user.mustChangePassword` เป็น choke point เดียว — ถ้า true จะ render `ChangePasswordForm` (`src/components/auth/change-password-form.tsx`, ใช้ `AuthSplitLayout`) แทน children ของทุกหน้า ไม่มี route/redirect แยก ครอบทุก deep-link/reload อัตโนมัติ ฟอร์มเดียวกันถูก reuse เป็นปุ่มเปลี่ยนรหัสผ่านแบบสมัครใจใน `/profile` ด้วย (ต่าง context กันแค่ผ่าน `onSuccess` callback prop) enforcement จริงอยู่ฝั่ง backend (`JwtAuthGuard`) — ฝั่งนี้แค่ให้ UX ดีกว่าเห็น API พังเปล่าๆ

## 2. Animation patterns

- **ห้ามใช้ framer-motion / recharts** — เป็น convention ที่ตั้งใจ (มี comment อธิบายไว้หลายที่) ชาร์ตสถิติทุกตัว (instructor, PLO radar) hand-roll เป็น DOM/SVG ล้วน ไม่มีข้อยกเว้น (แผนผังวิชาต่อเนื่องที่เคยใช้ `@xyflow/react` ถูกเอาออกและถอด dependency แล้ว)
- **Count-up ตัวเลข**: hook `src/lib/use-count-up.ts` → `useCountUp(target, { duration, decimals, replayKey })` (hand-rolled rAF + ease-out-cubic)
- **Entrance/exit**: Tailwind plugin `tailwindcss-animate` (ใน `tailwind.config.ts`)
  - เข้า: `animate-in fade-in-0 slide-in-from-bottom-4 duration-500` (ใช้ใน dashboard, academic-record)
  - ออก: `animate-out fade-out-0 slide-out-to-top-4 duration-500` (ใช้ใน `record-timeline.tsx`)
  - Loading skeleton: `animate-pulse` (`dashboard-skeleton.tsx`)
- ไม่มี custom `@keyframes` ใน `globals.css` — ใช้แค่ tailwindcss-animate + useCountUp
- radar ใน aptitude-analysis + ชาร์ตทุกตัวใน instructor = SVG/DOM hand-rolled

## 3. Reusable UI components (`src/components/ui/`)

shadcn-style — ส่วนใหญ่ hand-rolled แต่ **มี Radix อยู่ 4 ตัวใน `package.json`** (`react-label`, `react-popover`, `react-select`, `react-slot`): `select.tsx` = Radix Select, `combobox.tsx` = Radix Popover, `button.tsx`/`form.tsx` ใช้ `Slot`, `label.tsx` = Radix Label — ที่เหลือ hand-rolled จริง (นี่คือเหตุผลที่ Playwright ใช้ selector `button[role="combobox"]` / `getByRole('option')` ได้)
`alert.tsx`, `badge.tsx` (tone-based: green/amber/red/gray — เพิ่ม 2026-08-25 แทน `<span>+cn()` inline ที่เคยซ้ำอยู่หลายจุด), `button.tsx`, `card.tsx` (Card/CardHeader/CardContent/CardTitle), `combobox.tsx`, `form.tsx` (RHF wrapper), `input.tsx`, `label.tsx`, `progress.tsx`, `select.tsx`, `slider.tsx`, `textarea.tsx`

`DashboardShell` (`src/components/dashboard/dashboard-shell.tsx`) เป็น role-aware แล้ว (nav items ตาม `role` prop, default `'STUDENT'` — 9 หน้า STUDENT เดิมเรียกแบบไม่ใส่ `role` ได้เหมือนเดิม ไม่ต้องแก้) ส่วน role-gate ใช้ `src/components/auth/require-role.tsx` (`<RequireRole role="INSTRUCTOR">`) — หน้า STUDENT เดิมยังใช้ inline `isStudent` check เดิมอยู่ ยังไม่ได้ retro-fit ให้ใช้ `RequireRole` ร่วม

## 4. Convention ที่ตกลงกันไว้

- **ห้าม** framer-motion, recharts, dnd-library
- แผนผังวิชาต่อเนื่อง (prerequisite flow chart) และ `@xyflow/react` ถูกเอาออกจาก /credit-checker และถอด dependency แล้ว — ไม่มีไลบรารีแผนผังในโปรเจกต์
- Animation ทั้งหมด hand-roll ก่อนเสมอ (Tailwind utilities + custom hook) — ใช้ library เฉพาะกรณีจำเป็นจริงมากๆ เท่านั้น (ปัจจุบันยังไม่มีข้อยกเว้น)
- Drag-and-drop ใช้ native HTML5 DnD + ปุ่ม move fallback สำหรับ touch device
- ตอบ user เป็นภาษาไทย (โค้ด/comment เป็นอังกฤษ) — ดู `apps/CLAUDE.md`
- อ่าน `PROJECT_CONTEXT.md` / `CONVENTIONS.md` ก่อนเริ่มงานเสมอ (ตาม `apps/CLAUDE.md`)

## 5. Backlog (เต็มดูที่ root `TODO.md`)

- Learning Path ไม่มี backend persistence — state หายเมื่อ reload
- Email (forgot-password/invite) เป็น mock (console.warn เท่านั้น)
- PLO/CLO seed data ครอบคลุมแค่ 24/96 วิชา ที่เหลือเป็น demo data
- AI Skill Analysis ไม่มี caching/persistence, ต้องใช้ ANTHROPIC_API_KEY จริง — และยังไม่รองรับ INSTRUCTOR scope เลย (ดู TODO.md)

## 6. Dev environment gotcha (พบ 2026-08-25)

เคยมี backend process เก่าค้าง (รันมาจาก path `/Users/patcharadnai/Downloads/eduanalyze-ai/` ที่ไม่มี `Projects/` — น่าจะเป็นซากจากตอนย้ายโปรเจกต์) ครอง port 3001 อยู่นานหลายวัน ทำให้ backend ตัวจริงจาก `Projects/eduanalyze-ai` (ที่ `nest start --watch` เอง) bind port ไม่ได้เงียบๆ — API calls ทั้งหมดไปโดน process เก่าโดยไม่รู้ตัว ก่อนเริ่มงาน backend ครั้งต่อไป ควรเช็คว่า `lsof -iTCP:3001 -sTCP:LISTEN -P -n` คืน cwd ตรงกับ `Projects/eduanalyze-ai/apps/backend` จริง

## Dark mode (2026-10-01)

- Toggle: `ThemeToggle` (sun/moon) in the DashboardShell header and fixed top-right on pages without the shell (landing, login, register, forgot/reset password, register/google). Two states; with nothing stored the OS `prefers-color-scheme` decides, an explicit click wins afterwards.
- Persistence: `localStorage['eduanalyze-theme']` = `light|dark` (every access in try/catch). An inline script in `app/layout.tsx` (`lib/theme-script.ts`) sets `<html class="dark">` before first paint; `lib/theme-context.tsx` keeps React state in sync.
- Tokens: `.dark { … }` in `app/globals.css` for the semantic colours (`background`, `card`, `primary`, `brand`, …). `primary` is a pale blue in dark (it doubles as the heading colour and button fill).
- Palettes: `slate`, `emerald`, `amber`, `red`, `sky`, `violet`, `rose`, `blue` are theme-aware — `tailwind.config.ts` maps every step to CSS variables in `src/styles/theme-palette.css`, generated by `node scripts/generate-theme-palette.js > src/styles/theme-palette.css`. Light = stock Tailwind values (unchanged). Dark: slate 50–300 are dark surfaces/borders and 400–950 light text greys; the status hues are mirrored (step N ← step 1000−N, 500 ← 400).
- Colour rules for new code: write classes for the light theme and dark follows; use semantic tokens (`bg-background`, `bg-card`, `text-muted-foreground`) for surfaces; never hard-code hex or `bg-white`/`text-black`; for SVG use `stroke-*`/`fill-*` classes (or `rgb(var(--slate-400))` in inline styles); add a `dark:` variant only when a mirrored step reads badly (e.g. the radar grid).
- Known: the React Flow "React Flow" attribution link is library-styled (4.2:1 in dark).

## EmptyState illustrations (2026-10-01)

- `EmptyState` takes exactly one of `icon` (compact Lucide, 28px slate-300 — unchanged) or `illustration` (line-art from `components/ui/empty-state-illustrations.tsx`), plus `size="sm" | "md"` (72/96px) for the illustration branch.
- Illustrations: `no-data` (generic), `no-students`, `no-outcomes` (CLO/PLO/AI summary with no data), `no-results` (search/filter found nothing), `all-done` (requirement met — success, not emptiness). Brand-tinted, 2px round strokes on a 96 grid, tokens only (dark mode follows, no `dark:`).
- When to use: page/card-level empties → `illustration` (`size="sm"` inside small dashboard panels). Restricted/no-access (Lock, ShieldCheck) stays on Lucide icons. One-line empties inside dense lists/tables stay a plain `<p className="text-sm text-muted-foreground">`.

## Motion helpers (2026-10-04)

- `useCountUp` (`lib/use-count-up.ts`): default is ease-out-cubic. `easing: 'elastic'` is opt-in and always clamped (`clampMin`/`clampMax`; with none it cannot overshoot). Use it only for headline numbers with a hard ceiling (GPA 0–4, credits 0–total) — never for values that drive a threshold (ring colour, `>= 100`, confetti) or integer counts.
- `RevealOnScroll` (`components/layout/reveal-on-scroll.tsx`): same entrance as `Reveal`, but waits until scrolled into view. Use it only for blocks that are below the fold at 1280×800 AND mount after client-side data loads; keep `Reveal` (index stagger) for the top of a page, confetti blocks, tab bodies, conditional forms and server-rendered pages (the landing page). Hidden state is `.reveal-pending`, cleared for reduced motion and print.
- Skeleton cross-fade: pass `skeleton={<XSkeleton />}` to `DashboardShell` on every render of the page and `ready={false}` in the loading return (children `{null}`); the skeleton then fades out as the content fades in. Pages that don't pass it are unchanged. Done so far: the 8 student pages (dashboard, credit-checker, academic-record, learning-path, profile, aptitude-analysis, clo-plo-analysis, course-assessment); the instructor/staff/admin pages that render skeletons inline are not migrated.
