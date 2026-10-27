import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { RequestUser } from "../../auth/request-user.interface";
import { StudentProfileService } from "./student-profile.service";

const staff = { userId: "staff-1", roles: ["STAFF"] } as unknown as RequestUser;

function setup(
  opts: {
    missing?: boolean;
    profileActive?: boolean;
    userActive?: boolean;
    roles?: string[];
    userId?: string;
    enteredForOthers?: number;
  } = {},
) {
  const deleteMany = () => jest.fn().mockResolvedValue({ count: 1 });
  const order: string[] = [];
  const track = (name: string, fn: jest.Mock) =>
    jest.fn(async (...args: unknown[]) => {
      order.push(name);
      return fn(...args);
    });
  const tx = {
    studentProfile: {
      findUnique: jest.fn().mockResolvedValue(
        opts.missing
          ? null
          : {
              id: "sp1",
              isActive: opts.profileActive ?? false,
              user: {
                id: opts.userId ?? "u1",
                email: "someone@ku.th",
                isActive: opts.userActive ?? false,
                userRoles: (opts.roles ?? ["STUDENT"]).map((role) => ({
                  role,
                })),
              },
            },
      ),
      delete: track("studentProfile.delete", jest.fn().mockResolvedValue({})),
    },
    courseAssessment: { deleteMany: deleteMany() },
    studentCreditLimitRequest: { deleteMany: deleteMany() },
    studentCourseRecord: {
      deleteMany: track("studentCourseRecord.deleteMany", deleteMany()),
      count: jest.fn().mockResolvedValue(opts.enteredForOthers ?? 0),
    },
    studentPlannedCourse: { deleteMany: deleteMany() },
    pendingInvitation: { deleteMany: deleteMany() },
    passwordResetToken: { deleteMany: deleteMany() },
    twoFactorCredential: { deleteMany: deleteMany() },
    userAuthMethod: { deleteMany: deleteMany() },
    userConsent: { deleteMany: deleteMany() },
    userScope: { deleteMany: deleteMany() },
    userRole: { deleteMany: deleteMany() },
    googlePendingRegistration: { deleteMany: deleteMany() },
    emailSignupRequest: { deleteMany: deleteMany() },
    user: { delete: track("user.delete", jest.fn().mockResolvedValue({})) },
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
  const service = new StudentProfileService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, tx, order };
}

describe("StudentProfileService.permanentlyDelete", () => {
  it("deletes a suspended student with their records and login data, profile before user", async () => {
    const { service, tx, order } = setup();
    await service.permanentlyDelete("sp1", staff);

    expect(tx.studentCourseRecord.deleteMany).toHaveBeenCalledWith({
      where: { studentProfileId: "sp1" },
    });
    expect(tx.courseAssessment.deleteMany).toHaveBeenCalledWith({
      where: { studentProfileId: "sp1" },
    });
    expect(tx.userConsent.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
    expect(tx.emailSignupRequest.deleteMany).toHaveBeenCalledWith({
      where: { email: "someone@ku.th" },
    });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
    expect(order).toEqual([
      "studentCourseRecord.deleteMany",
      "studentProfile.delete",
      "user.delete",
    ]);
  });

  it("refuses a student who is not suspended", async () => {
    const { service, tx } = setup({ profileActive: true, userActive: true });
    await expect(
      service.permanentlyDelete("sp1", staff),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it("refuses when only the sign-in switch is still on", async () => {
    const { service } = setup({ userActive: true });
    await expect(
      service.permanentlyDelete("sp1", staff),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("refuses an account holding a role besides STUDENT", async () => {
    const { service, tx } = setup({ roles: ["STUDENT", "INSTRUCTOR"] });
    await expect(
      service.permanentlyDelete("sp1", staff),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.studentCourseRecord.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses the requester’s own account", async () => {
    const { service } = setup({ userId: "staff-1" });
    await expect(
      service.permanentlyDelete("sp1", staff),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses (and so rolls back) when the account entered grades for someone else", async () => {
    const { service, tx } = setup({ enteredForOthers: 2 });
    await expect(service.permanentlyDelete("sp1", staff)).rejects.toThrow(
      "2 รายการ",
    );
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it("404s an unknown profile", async () => {
    const { service } = setup({ missing: true });
    await expect(
      service.permanentlyDelete("nope", staff),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
