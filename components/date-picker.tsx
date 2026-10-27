"use client";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState, type Dispatch } from "react";
import { formatTanggal } from "@/lib/utils";

type DatePickerProps = {
  value?: Date;
  onChange?: Dispatch<Date | undefined>;
  placeholder?: string;
  /** Tanggal sebelum ini tidak bisa dipilih, navigasi kalender mulai dari bulannya. */
  minDate?: Date;
  /** Bulan terakhir di navigasi - default react-day-picker (mode dropdown) cuma s.d. akhir tahun ini. */
  endMonth?: Date;
};

export function DatePicker({
  value,
  onChange,
  placeholder,
  minDate,
  endMonth,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id="date"
            className="w-full justify-between font-normal"
          >
            {value
              ? formatTanggal(value.toLocaleDateString("id-ID"))
              : placeholder
              ? placeholder
              : "Pilih tanggal"}
            <ChevronDownIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            defaultMonth={value}
            captionLayout="dropdown"
            disabled={minDate ? { before: minDate } : undefined}
            startMonth={minDate}
            endMonth={endMonth}
            onSelect={(date) => {
              onChange?.(date);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
