"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { StudentProfileDetail } from "@eduanalyze-ai/shared-types";
import { deleteStudentPermanently } from "@/lib/api/staff";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/button";
import { PermanentDeleteDialog } from "@/components/admin/permanent-delete-button";
import { isStudentSuspended } from "./student-account";

// STAFF permanently deleting a student, offered only once the account is
// suspended (so it is always a second deliberate step) and confirmed by typing
// the student code. Frees the email for a new sign-up; leaves for the list.
export function StudentPermanentDeleteButton({
  profile,
}: Readonly<{ profile: StudentProfileDetail }>) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  if (!isStudentSuspended(profile)) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="gap-1.5 border-destructive/40 px-4 text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/10"
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden="true" size={16} />
        ลบถาวร
      </Button>
      <PermanentDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title={`ลบบัญชีของ ${profile.user.fullName} ถาวร?`}
        confirmText={profile.studentCode}
        keepOpenOnError
        description={
          <div className="space-y-2">
            <p>
              จะลบบัญชีเข้าสู่ระบบ ข้อมูลนิสิต ผลการเรียน การประเมินตนเอง
              และแผนการเรียนของนิสิตคนนี้ อีเมล {profile.user.email}{" "}
              จะใช้สมัครใหม่ได้
            </p>
            <p className="font-medium text-foreground">
              การลบนี้ย้อนกลับไม่ได้
            </p>
          </div>
        }
        onConfirm={async () => {
          await deleteStudentPermanently(profile.id);
          toast.success(`ลบบัญชีของ ${profile.user.fullName} ถาวรแล้ว`);
          router.push("/staff/students");
        }}
      />
    </>
  );
}
