# EduAnalyzeAI — Backend Conventions

Conventions every module follows starting Phase 1. Not enforced by tooling (yet) — reviewed by hand until a lint rule/CI check is worth adding.

## 1. Swagger / API Documentation

Every controller and DTO ships doc decorators in the same commit as the code, not as a follow-up.

```ts
@ApiTags('organization')
@Controller('faculties')
export class FacultyController {
  @Get(':id')
  @ApiOperation({ summary: 'Get a faculty by id' })
  @ApiResponse({ status: 200, description: 'Faculty found' })
  @ApiResponse({ status: 404, description: 'Faculty not found' })
  findOne(@Param('id') id: string) { ... }
}

export class CreateFacultyDto {
  @ApiProperty({ example: 'Faculty of Engineering' })
  @IsString()
  name: string;
}
```

Rule: `@ApiTags` on every controller, `@ApiOperation` + success/error `@ApiResponse` on every route, `@ApiProperty` on every DTO field. Once auth lands (Phase 3), protected routes add `@ApiBearerAuth('access-token')`.

## 2. Naming Convention

| Thing | Pattern | Example |
|---|---|---|
| Module folder | `src/modules/<domain>/` | `src/modules/organization/` |
| Module file | `<domain>.module.ts` | `organization.module.ts` |
| Controller | `<domain>.controller.ts` → `<Domain>Controller` | `faculty.controller.ts` → `FacultyController` |
| Service | `<domain>.service.ts` → `<Domain>Service` | `faculty.service.ts` → `FacultyService` |
| DTO | `<action>-<entity>.dto.ts` → `<Action><Entity>Dto` | `create-faculty.dto.ts` → `CreateFacultyDto` |
| Prisma model | PascalCase singular | `Faculty`, `Department`, `Program` |
| Prisma field | camelCase | `facultyId`, `createdAt` |
| Route path | kebab-case plural | `/api/faculties`, `/api/curriculum-versions` |

One entity = one subfolder under its domain module when the domain has multiple entities (e.g. `organization/faculty/`, `organization/department/`), each with its own controller/service/dto — mirrors the existing `src/modules/`, `src/common/`, `src/prisma/` split from Phase 0.

## 3. Security Pattern — Guard Chain

Every endpoint that isn't public goes through the same three-stage chain, in this order: **Authentication → Role → Scope**. Never rely on Role alone.

```ts
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Roles('SUPER_ADMIN')
@Post()
create(@Body() dto: CreateFacultyDto) { ... }
```

- `JwtAuthGuard` — confirms the requester is authenticated (valid access token).
- `RolesGuard` + `@Roles(...)` — confirms the authenticated user's role is permitted for this route.
- `ScopeGuard` — confirms the user's role-scope (e.g. a Department Admin can only touch their own department) actually covers the target resource, not just the role name. This is the one most often forgotten — a role check alone (`SUPER_ADMIN` vs `DEPARTMENT_ADMIN`) says nothing about *which* department.

Guards are added in Phase 3 (auth) but the chain shape is fixed now so every module built before then still slots into it without rewrites.

### 3a. Self-Ownership Check (STUDENT-authored data)

Every module up to Phase 5 is `SUPER_ADMIN`-only CRUD, so `RolesGuard` alone was enough. Starting Phase 6 (`StudentCourseRecord`, and later Smart Credit Checker / Course Assessment), a `STUDENT` can create/read/update/delete their *own* rows only — a case `RolesGuard` cannot express, since it checks the role name, not which row the role owns.

**Where the check lives:** the service layer, never the controller — per §6, this is business logic (a branch on a domain value: does `studentProfile.userId` match the requester?), not orchestration.

**How it's implemented**, using `StudentCourseRecordService` as the reference shape:
- The controller passes the authenticated `RequestUser` (from `@Req()`/a `@CurrentUser()` decorator) through to every service method, alongside the DTO/id.
- `findAll(user)`: if `user.roles` includes `STUDENT` (and not `SUPER_ADMIN`), resolve `user.sub → studentProfile.id` first, then query with `where: { studentProfileId }` directly — **never** fetch all rows and filter in memory. Query-level filtering makes "forgot to filter" structurally impossible, not just a discipline problem for whoever edits this method next.
- `findOne(id, user)` / `update(id, dto, user)` / `remove(id, user)`: query with `where: { id, studentProfileId: ownStudentProfileId }` (STUDENT) or `where: { id }` (`SUPER_ADMIN`, no ownership filter). If the row isn't found under that `where`, throw `NotFoundException` — the exact same exception as a genuinely nonexistent id.
- **Never throw `ForbiddenException` (403) for "exists but not yours."** A 403 confirms the row exists, which is an information-disclosure leak (OWASP Broken Access Control) — whether the record exists and whether the requester owns it must be indistinguishable from the response.

## 4. Error Handling Convention

Throw Nest's built-in `HttpException` subclasses — never return error shapes manually from a controller.

```ts
if (!faculty) {
  throw new NotFoundException(`Faculty ${id} not found`);
}
if (dto.departmentId && !(await this.isValidDepartment(dto.departmentId, faculty.id))) {
  throw new BadRequestException('Department does not belong to the specified faculty');
}
```

Nest's default exception filter turns these into a consistent JSON shape:

```json
{ "statusCode": 404, "message": "Faculty <id> not found", "error": "Not Found" }
```

A global `AllExceptionsFilter` (added to `src/common/filters/`, referenced in `app.module.ts`) normalizes anything uncaught (e.g. Prisma errors) into the same shape — so the response contract never depends on which layer threw. Controllers/services never `try/catch` just to reformat an error; they only catch when they need to translate a lower-level error (e.g. Prisma's `P2025`) into the right `HttpException` subtype.

## 5. DTO Validation Convention

`main.ts` already sets:

```ts
new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
```

Consequences for how DTOs must be written:
- **`whitelist: true`** strips any property not decorated in the DTO — so every field the client may legitimately send needs a `class-validator` decorator, or it silently disappears.
- **`forbidNonWhitelisted: true`** rejects the request (400) if the client sends an undeclared property — DTOs are the literal contract, not a loose shape.
- **`transform: true`** auto-converts payloads to the DTO class and coerces primitive types — so `@IsInt()` on a route param works without manual `parseInt`.

```ts
export class CreateFacultyDto {
  @ApiProperty({ example: 'Faculty of Engineering' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'ENG' })
  @IsString()
  @Length(1, 10)
  code: string;
}
```

Every DTO field pairs a `class-validator` decorator with an `@ApiProperty` — the two are written together, not one added later.

## 6. Business Logic Placement

All calculation logic (GPA, CLO/PLO achievement, radar values, any derived score) lives in the **service layer only**. Controllers call one service method and return its result — they never compute, aggregate, or branch on domain values themselves.

```ts
// Controller — orchestration only
@Get(':studentId/gpa')
getGpa(@Param('studentId') studentId: string) {
  return this.transcriptService.calculateGpa(studentId);
}

// Service — the only place calculation logic lives
@Injectable()
export class TranscriptService {
  calculateGpa(studentId: string): Promise<number> { ... }
}
```

If two controllers need the same number (e.g. GPA shown on a student profile *and* on an advisor dashboard), both call the same service method — the calculation is never reimplemented or copy-pasted at a second call site. This matters most for the analytics endpoints (GPA, CLO/PLO achievement) since AI only interprets already-computed results and must never see two different code paths producing the same metric.

## 7. Soft-Delete Convention (Hierarchy Entities)

Every entity in the Faculty → Department → Program → Curriculum chain soft-deletes via `isActive = false`; the only hard delete is the SUPER_ADMIN permanent delete of an already-deactivated faculty/department/program (see the exception below; curricula never have one) (matches `onDelete: Restrict` on every parent relation in `schema.prisma`). Before flipping `isActive` to `false`, the service must count the entity's *active* children and refuse with a `ConflictException` if any exist — never let a parent go inactive while active children still point at it.

```ts
async remove(id: string) {
  await this.findOne(id);

  const activeChildCount = await this.prisma.department.count({
    where: { facultyId: id, isActive: true },
  });
  if (activeChildCount > 0) {
    throw new ConflictException(
      `Cannot deactivate faculty ${id}: ${activeChildCount} active department(s) still belong to it`,
    );
  }

  return this.prisma.faculty.update({ where: { id }, data: { isActive: false } });
}
```

Same shape for every level down the chain: `DepartmentService.remove` counts active `Program`s, `ProgramService.remove` counts active `Curriculum`s. The error message always states the exact count of blocking children, not just that deletion failed.

The real rule for choosing soft- vs hard-delete on a new entity is not "is it a mapping table" — it's whether the entity is a parameter of a calculation that gets shown to users and needs to stay reproducible over time. `Course`/`CourseCategory`/`Curriculum` are soft-delete because deleting them would break Smart Credit Checker results for students who already took that course. `Prerequisite` is hard-delete because it's a pure boolean structural gate with no accumulated value. `CloPloMapping` is soft-delete for the same reason as `Course`: it directly parameterizes Achievement/PLO % calculations that feed Radar Charts and trend analytics (§23), so losing an old mapping row would make a previously-shown dashboard value unreproducible.

**Known limitation, tracked for the Achievement calculation phase:** `CloPloMapping`'s `isActive` flag only protects against the mapping being *deleted*. It does **not** provide a full audit trail — if `weight` (or a CLO's `achievementThreshold`) is edited in place, `updatedAt` overwrites the previous value with no history kept. When the Achievement calculation phase (PROJECT_CONTEXT.md §22–23) is designed, revisit whether that's good enough or whether Achievement results need to be persisted as a snapshot (e.g. an `AchievementSnapshot`/`AchievementDetail` table that copies the `weight`/`achievementThreshold` values used at calculation time) so historical dashboard values stay stable even if a mapping is edited later, not just deleted.

**Courses (STAFF, 2026-10-20).** `DELETE /courses/:id` soft-deletes and is refused (409, Thai, with counts) while anything still uses the course: another course's prerequisite, active student course records, instructor assignments, active CLOs, course assessments, study plans or active career links. Its own prerequisite rows are hard-deleted in the same transaction. A course that is already deactivated is a 404 for `PATCH`/`DELETE`; `POST /courses/:id/reactivate` (STAFF + `ScopeTarget('course')`) brings it back, refused with 409 while it is active, its curriculum or category is deactivated, or an active course uses its code. The deleted prerequisites do not come back. `GET /courses/inactive?curriculumId=` (STAFF) lists deactivated courses within the caller's curricula. Credits are whole numbers 0–12 (`CreateCourseDto`).

**CLOs (ADMIN, 2026-10-21).** `Clo.isConfirmed` (default true) marks a CLO copied from another curriculum year as not yet checked; ADMIN sets it with `PATCH /clos/:id`. `GET /clos?courseId=` narrows the scope-filtered list to one course. `DELETE /clos/:id` soft-deletes and is refused (409, Thai, with counts) while an active CLO-PLO mapping or a course assessment score uses it; a deactivated CLO is a 404 for `PATCH`/`DELETE`. Every write is audited in the same transaction. Reactivating a CLO is not built yet. ADMIN edits CLOs, PLOs and their links on one page, `/admin/curriculum-outcomes` (frontend only): saving a CLO calls `/clos` and then `/clo-plo-mappings` one request at a time, so it is not atomic; the page reports which steps went through when one fails.

**PLOs and CLO-PLO links (ADMIN, 2026-10-21).** `DELETE /plos/:id` soft-deletes and is refused (409, Thai, with the count) while an active link to a CLO exists; `PATCH`/`DELETE` of a deactivated PLO or link is a 404. `GET /plos` and `GET /clo-plo-mappings` take `?curriculumId=` on top of the scope filter. A link's weight is a whole number 1-5 (`CreateCloPloMappingDto`); the PLO % is the weighted mean of its CLOs' % (`plo-achievement.service.ts`), so a changed weight or link changes every student's figure at once. `POST /clo-plo-mappings` for a pair removed earlier re-activates that row with the new weight (the `(cloId, ploId)` unique covers inactive rows too) instead of answering 409; an active pair is 409; a CLO and PLO of different curricula is 400.

**Exception — permanent delete of `AcademicYear`/`Semester` (SUPER_ADMIN).** `DELETE /academic-years/:id/permanent` and `DELETE /semesters/:id/permanent` hard-delete a row only if it is already deactivated and *nothing* references it: every `StudentCourseRecord` pointing at the semester counts (no `isActive` filter), and a year additionally needs all its semesters deactivated. Otherwise 409 with the counts in Thai. A year's semesters are deleted with it in one transaction; a P2003 from a concurrent insert is mapped to 409 (`semester-references.util.ts`). Success is logged with the acting user (no audit table yet). Other hierarchy entities stay soft-delete only.

**Exception — permanent delete of `Faculty`/`Department`/`Program` (SUPER_ADMIN).** `DELETE /faculties|departments|programs/:id/permanent` (204) hard-deletes a row only if it is already deactivated and nothing points at it. Refused with a Thai message: still active (409); any child row, active or not (`departments` / `programs` / `curricula`: delete the deactivated children first, one level at a time — no cascade), any `user_scopes` row at that level (withdraw the scope first), and for a program any `student_profiles` or `student_invitations` (409 with the counts). Counted and deleted in one transaction (`org-references.util.ts`); a P2003 from a concurrent insert is mapped to 409 (`conflictOnReferenced`). Foreign keys stay `Restrict`; no schema change. Routes are `@Roles('SUPER_ADMIN')` only, without `ScopeGuard` (pinned in `roles-table.spec.ts`); `GET /faculties|departments|programs/inactive` add `references` so the screen can say why the delete is refused. Success is logged with the acting user id and the record id only — no name or code. **Curricula have no permanent delete**: `CurriculumController` is ADMIN-only by design (`roles-table.spec.ts` forbids SUPER_ADMIN there), so a program that still has curricula cannot be deleted. The screen offers it only on `/superadmin/organization`, behind a typed confirmation of the record's code.

**Exception — permanent delete of `User` (SUPER_ADMIN).** `DELETE /users/:id/permanent` hard-deletes an account only if it is already suspended (`isActive = false`) and nothing else points at it. Refused with a Thai message: your own account (403), any `SUPER_ADMIN` account (403, always), any `STUDENT` account or one with a student profile (403), an account that is still active (409), and — in one transaction with the delete — an account that is still referenced (409 with the counts): `course_instructors.userId` (still teaching: STAFF removes the assignment first), `student_course_records.enteredByUserId` (it entered grades: the history is kept, so the account stays suspended) and `student_invitations.invitedByUserId` (invitations it sent: wait for them to expire). Those three foreign keys stay `Restrict`; no schema change. The login data goes with the account in the same transaction: `pending_invitations`, `password_reset_tokens`, `two_factor_credentials`, `user_auth_methods`, `user_scopes`, `user_roles`, plus any `google_pending_registrations` row for its email (no FK). A P2003 from a concurrent insert is mapped to 409 (`conflictOnReferenced`), and a last-active-SUPER_ADMIN check is repeated as a safeguard. Route is `@Roles('SUPER_ADMIN')` only (pinned in `roles-table.spec.ts`); `GET /users` and `GET /users/:id` add `references` to a suspended non-student account so the screen can say why the delete is refused (`user-references.util.ts`). Success is logged with the acting user id and row counts only — never an email, name or token. The screen offers it only on `/superadmin/users` (`canPermanentlyDelete`), behind a typed confirmation of the account's email.

**Soft-delete + natural-key uniqueness never combine as a schema-level `@@unique`.** Prisma's `@@unique`/`@unique` has no syntax for a filtered/partial index, so a plain unique constraint on a natural key (e.g. `Faculty.code`, `Department.[facultyId, code]`) still counts soft-deleted rows — once one is deactivated, its key is permanently blocked from reuse. The fix is a partial unique index written as raw SQL in the migration (`CREATE UNIQUE INDEX ... WHERE "isActive" = true`), with the schema-level `@@unique` removed and replaced by an explanatory comment (see `StudentCourseRecord`, `Faculty`, and the other 8 org-structure models in `schema.prisma` for the pattern — migrations `add_student_course_record_partial_unique_index` and `add_soft_delete_partial_unique_indexes`). `prisma migrate dev` cannot see a raw-SQL index since it isn't declared in the schema and may propose dropping it as drift — always review with `--create-only`, never auto-accept.

This has two layers, not one: **any app-level pre-check must also filter `isActive: true`.** A `assertXAvailable`-style helper that does `findUnique`/`findFirst` on the natural key alone will find a soft-deleted row and reject the create/update before the request ever reaches Postgres — the partial index alone does not fix this, since the app-level check runs first and doesn't know about it. Every such pre-check must add `isActive: true` to its `where` clause. The Postgres-level `P2002` → 409 mapping (global exception filter) needs no changes either way — it's a fallback for the race-condition case, not the primary guard.

## 8. Scope Resolution Rule (Phase 3 onward)

Every time a user's real permissions are resolved from `UserScope`, the resolver must join and check `isActive` on whichever `Faculty`/`Department`/`Program` that scope points to — via the `findActiveByIdOrThrow` pattern or equivalent. Never treat the mere existence of a `UserScope` row as proof the permission is still valid.

**Why:** `onDelete: Restrict` on `UserScope`'s parent relations only blocks *hard* deletes — it does nothing for soft-delete (`isActive = false`), since that's a plain `UPDATE`, not a `DELETE`, and never touches the primary key the FK constraint watches. A `UserScope` pointing at a `Faculty`/`Department`/`Program` that has since been soft-deleted stays in the database untouched — a dangling reference at the business-logic level, even though the schema considers it perfectly valid.

```ts
// Wrong: trusts the row's existence alone
const scopes = await this.prisma.userScope.findMany({ where: { userId } });

// Right: resolves against current isActive state of the scoped entity
const scopes = await this.prisma.userScope.findMany({
  where: { userId },
  include: { faculty: true, department: true, program: true },
});
const effectiveScopes = scopes.filter(
  (s) => s.faculty?.isActive !== false &&
         s.department?.isActive !== false &&
         s.program?.isActive !== false,
);
```

## 9. Update DTO — Immutable Parent Keys (hierarchy entities)

`ScopeGuard` only resolves and checks the entity's *current* parent (from `:id`). If an Update DTO is `PartialType(CreateXDto)`, it silently also accepts a new parent id — and unless the service does something smarter than "does this parent exist", a caller can re-parent an in-scope entity onto an out-of-scope parent, moving it past `ScopeGuard` entirely. This is the same class of bug as trusting a client-sent id without validating the relationship (PROJECT_CONTEXT.md §33 rule 13), just on `update()` instead of `create()`.

**Default rule: the parent id is immutable on PATCH.** Omit it from the Update DTO with `OmitType` (same `@nestjs/swagger` import the DTO already uses for `PartialType`, so the Swagger schema stays accurate) rather than adding a new-parent scope check:

```ts
export class UpdateProgramDto extends PartialType(
  OmitType(CreateProgramDto, ['departmentId'] as const),
) {}
```

With the global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` (§5), a PATCH body containing the parent key now gets a clean 400 before it reaches any service — the service's `update()` no longer needs (and should delete) any "does the new parent exist" branch; it just keeps reading the parent off the stored row:

```ts
// before — dead once the DTO omits departmentId, delete it
if (dto.departmentId) { await this.departmentService.findActiveByIdOrThrow(dto.departmentId); }
const departmentId = dto.departmentId ?? program.departmentId;
// after
const { departmentId } = program;
```

`UpdateCurriculumRequirementDto` follows it since 2026-10-20 (it used to be a plain `PartialType` and accepted a new `curriculumId`, which the service only checked for being active, not for scope); its `categoryId` stays editable and must belong to the same curriculum.

This is the default, not an absolute rule — an entity can keep one *sibling-scoped* key mutable when moving between siblings under the same parent is a legitimate operation with its own validation already in place (e.g. `Course.categoryId`: moving a course between categories inside the same curriculum doesn't cross a scope boundary, so it stays on the DTO while `curriculumId` itself is omitted).

**Before applying this default, check whether any real caller sends the parent key on update** (grep the frontend `lib/api/*.ts` + every form that calls it) — if nothing does, omitting it is a pure attack-surface reduction with no behavior change for real usage. If something legitimately needs to re-parent, that's a product decision to build as its own explicit endpoint with scope checks on *both* the old and the new parent — never by leaving the field mutable on the general update path.

---

## 10. Docker / Database Safety Rule

The dev database lives only in the `postgres_data` Docker volume. On 2026-10-06 `docker-compose down -v` deleted it (every table emptied) and it was restored only because an earlier `pg_dump` existed. So, in every case:

- **Never** run `docker compose down -v` / `docker-compose down -v`, `docker volume rm`, `docker volume prune` or `docker system prune`. Stop containers with `npm run docker:stop` (`docker compose stop`), which keeps containers and volumes.
- **Never** stop, start, remove or otherwise touch containers or volumes that belong to another project (for example `pm25-pipeline`). If a port such as 5433 looks taken, find out what holds it (`docker ps`, `lsof -i :5433`) and report it; do not clear it.
- Run `bash scripts/db-backup.sh <label>` **before every QA/test round that touches Docker** (rebuilds, restarts, browser testing against real data). Dumps go to `apps/backend/.backups/` as `eduanalyze_ai_<YYYYMMDD>_<HHMMSS>_<label>.dump` and are git-ignored. Run it from the project root. The files hold real user data: never send anything in `.backups` off the machine.
- To clear test data, use a seed or the API, never by deleting the volume.

## 11. Audit Log and Student Account Management (2026-10)

**One table, `audit_logs`, written in the same transaction as the change it records.** `AuditLogService.record(tx, entry)` takes the transaction client as a required argument (no default to `this.prisma`), so a caller cannot write the row outside the change's own `prisma.$transaction`; if the audit insert fails, the change rolls back with it. Pattern: check role/scope first, then inside the transaction read the current row with `tx`, write, `record(tx, …)`.

- What is recorded: grade create/update/delete by STAFF or INSTRUCTOR, and a student's update/delete of their own grade (`StudentCourseRecordService`, `isAudited`; a student adding a new grade is not). A student may update/delete only a row whose `enteredByRole` is `STUDENT` or NULL (legacy); a row STAFF/INSTRUCTOR/ADMIN entered or last corrected is 403 for them. student suspend/reactivate and profile edits (`StudentProfileService`), invitation cancels (`StudentInvitationService.cancel`), and (since 2026-10-20) every STAFF write to the curriculum catalogue: course create/update/deactivate/reactivate, course category create/update/deactivate, curriculum requirement create/update/delete and prerequisite create/update/delete (`targetType` `Course`/`CourseCategory`/`CurriculumRequirement`/`Prerequisite`, `studentProfileId` null, `programId` from the curriculum; snapshots built in `curriculum-content/catalog-audit.ts`). ADMIN's CLO writes (`CloService`: `CLO_CREATE`/`CLO_UPDATE`/`CLO_DEACTIVATE`, `targetType` `Clo`, snapshot `cloSnapshot`) are recorded too; so are ADMIN's PLO writes (`PloService`, `PLO_CREATE`/`PLO_UPDATE`/`PLO_DEACTIVATE`, `targetType` `Plo`) and CLO-PLO link writes (`CloPloMappingService`, `CLO_PLO_MAPPING_CREATE`/`UPDATE`/`DEACTIVATE`/`REACTIVATE`, `targetType` `CloPloMapping`; programId from the PLO's curriculum). Each row has the actor id and role snapshot, the target, the student and the program at that moment, `before`/`after`, an optional reason and the time.
- `before`/`after` are allow-listed per action (grade: `grade, courseId, semesterId`; status: `profileActive, userActive`; profile: only the changed `programId/curriculumId/admissionYear`; invitation: `studentCode, programId, curriculumId, admissionYear, expiresAt`; course: `code, name, nameEn, credits, isRequired, categoryId, curriculumId, isActive`, plus `removedPrerequisites` on a deactivate, never the description; category: `name, code, curriculumId, isActive`; requirement: `curriculumId, categoryId, minCredits, minCourses`; prerequisite: `courseId, prerequisiteCourseId, groupId`). A course's or category's own name is catalogue data, not a person's name. Never an email, name, password, token or hash; `assertNoSecretKeys` refuses such keys before anything is written.
- No foreign keys on purpose (same as `revoked_refresh_tokens`): an audit row must never block the SUPER_ADMIN permanent user delete (§7) or the demo cleanup scripts, and it outlives its target. The cleanup scripts delete the rows of the demo students they remove; nothing else updates or deletes an audit row.
- Reading: catalogue rows have no read route yet (query `audit_logs` by `programId`/`targetId`). For students, only `GET /student-profiles/:id/audit-logs` (STAFF + `ScopeGuard` on the student), filtered by `studentProfileId` in the query. The actor is returned by name, never by email; a deleted account comes back as `actorName: null`. The history follows the student, so after a program move the new program's STAFF sees it all.

**Student accounts are managed by STAFF within scope, never deleted.**
- `PATCH /student-profiles/:id/active-status` (reason required, 5–500 characters) sets `student_profiles.isActive` (the directory's "suspended") and `users.isActive` (sign-in; the JWT strategies check it on every request) together. The `/users/:id/active-status` and `/users/:id/resend-invitation` routes answer 404 for a student account to every requester (`findManageable`), as `GET /users/:id` already did for SUPER_ADMIN.
- `PATCH /student-profiles/:id` corrects program, curriculum or admission year (reason required). `studentCode` is not on the DTO, so it is a 400. A new program must be in the requester's scope too (403). A curriculum change is refused (409, with counts) while the student has active grades or course assessments in courses outside the new curriculum; planned courses outside it are dropped in the same transaction and counted in the audit row. A suspended student must be reactivated first.
- `DELETE /student-invitations/:id` (STAFF, `ScopeTarget('studentInvitation')`) deletes a pending invitation so its link stops working.
- `GET /student-profiles/:id` returns a suspended student too (`findInScopeById`), so the page can offer reactivation; `findActiveByIdOrThrow` stays for the grade writes, which still refuse a suspended student on create.
- All of these handlers are pinned to `['STAFF']` with `ScopeGuard` in `roles-table.spec.ts`. There is still no route that deletes a student account (§7).

`users.lastLoginAt` is stamped by every sign-in that issues a session (password, 2FA, Google, sign-up), not by a token refresh or a password change, and not for a suspended account. It was added on 2026-10-18 with no backfill, so `null` means "no sign-in since then".
