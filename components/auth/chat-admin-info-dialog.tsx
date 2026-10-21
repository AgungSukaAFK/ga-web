"use client";

// Info "Chat dengan Admin" di halaman auth (tombol Headset di AuthShell).
// Chat admin (/chat-admin) cuma bisa dipakai setelah login. User yang belum
// bisa login (belum punya akun aktif / lupa password / akun nonaktif) tidak
// diberi kontak IT langsung, tapi diarahkan minta tolong ke Department
// Head-nya, yang lalu meneruskan ke Departemen IT.

import Link from "next/link";
import { Headset, LogIn, UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AskDeptHeadNote({ title }: { title?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border p-3 text-sm">
      <UserRoundCog className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
      <div className="space-y-1">
        {title && <p className="font-medium">{title}</p>}
        <p className="text-muted-foreground">
          Silakan minta bantuan ke <strong className="text-foreground">Department Head</strong>{" "}
          Anda. Department Head yang akan meneruskan permintaan ke{" "}
          <strong className="text-foreground">Departemen IT</strong>. Siapkan
          Nama, Email/NRP yang terdaftar, dan Departemen Anda.
        </p>
      </div>
    </div>
  );
}

export function ChatAdminInfoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Headset className="h-5 w-5" /> Chat dengan Admin
          </DialogTitle>
          <DialogDescription>
            Layanan chat dengan admin IT tersedia setelah Anda login.
          </DialogDescription>
        </DialogHeader>

        <Button asChild className="h-11 w-full">
          <Link
            href="/auth/login?next=%2Fchat-admin"
            onClick={() => onOpenChange(false)}
          >
            <LogIn className="mr-2 h-4 w-4" />
            Login untuk Chat Admin
          </Link>
        </Button>

        <AskDeptHeadNote title="Belum bisa login? (belum punya akun, lupa password, atau akun nonaktif)" />
      </DialogContent>
    </Dialog>
  );
}
