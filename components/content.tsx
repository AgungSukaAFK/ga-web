import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  title?: string;
  description?: string;
  cardAction?: React.ReactNode;
  children?: React.ReactNode;
  cardFooter?: React.ReactNode;
  id?: string;
};

const colSpanMap: Record<NonNullable<Props["size"]>, string> = {
  lg: "lg:col-span-12",
  md: "lg:col-span-6",
  sm: "lg:col-span-4",
  xs: "sm:col-span-6 lg:col-span-4 xl:col-span-3",
};

/**
 *
 * @param size - Ukurang lebar konten berdasarkan grid Tailwind CSS.
 * - `xs`: lebar full, 6 cols SM, 4 cols LG, 3 cols XL.
 * - `sm`: 4 cols LG.
 * - `md`: 6 cols LG.
 * - `lg`: 12 cols LG.
 *
 */
export function Content({
  className = "",
  title,
  size = "lg",
  children,
  cardAction,
  description,
  cardFooter,
  id,
}: Props) {
  const colClass = colSpanMap[size] ?? "";

  return (
    <Card id={id} className={cn("col-span-12", colClass, className)}>
      {(title || description || cardAction) && (
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title && <CardTitle>{title}</CardTitle>}
            {description && (
              <CardDescription className="mt-1">{description}</CardDescription>
            )}
          </div>

          {cardAction && <CardAction>{cardAction}</CardAction>}
        </CardHeader>
      )}

      {children && <CardContent>{children}</CardContent>}

      {cardFooter && (
        <CardFooter className="flex-col gap-2">{cardFooter}</CardFooter>
      )}
    </Card>
  );
}
