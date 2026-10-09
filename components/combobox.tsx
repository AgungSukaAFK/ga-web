"use client";

import * as React from "react";

import {
  SearchableSelect,
  SearchableSelectContent,
  SearchableSelectItem,
  SearchableSelectTrigger,
  SearchableSelectValue,
} from "@/components/ui/searchable-select";

export type ComboboxData = {
  value: string;
  label: string;
}[];

export function Combobox({
  id,
  data,
  onChange,
  defaultValue,
  placeholder,
  disabled = false,
}: {
  id?: string;
  data: ComboboxData;
  defaultValue?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = React.useState(defaultValue || "");

  // Ikuti perubahan defaultValue dari parent (mis. data selesai dimuat).
  React.useEffect(() => {
    setValue(defaultValue || "");
  }, [defaultValue]);

  return (
    <SearchableSelect
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onChange(v);
      }}
      disabled={disabled}
    >
      <SearchableSelectTrigger id={id} className="w-full">
        <SearchableSelectValue placeholder={placeholder || "Pilih data..."} />
      </SearchableSelectTrigger>
      <SearchableSelectContent>
        {data?.map((item) => (
          <SearchableSelectItem key={item.value} value={item.value}>
            {item.label}
          </SearchableSelectItem>
        ))}
      </SearchableSelectContent>
    </SearchableSelect>
  );
}
