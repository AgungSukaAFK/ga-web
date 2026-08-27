import { Content } from "@/components/content";
import { Construction } from "lucide-react";

export function ComingSoon({
  title,
  description = "Fitur ini sedang dalam pengembangan dan akan segera hadir.",
}: {
  title: string;
  description?: string;
}) {
  return (
    <Content title={title}>
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
        <Construction className="h-10 w-10" />
        <p className="text-base font-medium text-foreground">Coming Soon</p>
        <p className="max-w-sm text-sm">{description}</p>
      </div>
    </Content>
  );
}
