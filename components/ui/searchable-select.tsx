"use client"

/**
 * SearchableSelect — pengganti `Select` (Radix) yang punya kolom pencarian.
 *
 * API-nya sengaja dibuat sama dengan `@/components/ui/select` supaya migrasi
 * cukup ganti nama komponen:
 *
 *   <SearchableSelect value={v} onValueChange={setV}>
 *     <SearchableSelectTrigger className="w-full">
 *       <SearchableSelectValue placeholder="Pilih..." />
 *     </SearchableSelectTrigger>
 *     <SearchableSelectContent>
 *       <SearchableSelectItem value="a">Opsi A</SearchableSelectItem>
 *     </SearchableSelectContent>
 *   </SearchableSelect>
 *
 * Penanganan teks panjang:
 * - Trigger tidak pernah melebihi lebar parent (max-w-full) dan teks terpilih
 *   dipotong dengan "…"; teks lengkap muncul sebagai tooltip (title).
 * - Popup minimal selebar trigger, melebar mengikuti isi sampai batas
 *   28rem / lebar layar, lalu teks item dibungkus ke baris berikutnya
 *   (termasuk string panjang tanpa spasi) sehingga tidak ada overflow.
 * - Tinggi list dibatasi oleh ruang yang tersedia di layar.
 */

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type ItemInfo = {
  label: React.ReactNode
  text: string
  count: number
}

type SearchableSelectContextValue = {
  value: string
  selectValue: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  disabled: boolean
  search: string
  setSearch: (search: string) => void
  registerItem: (
    value: string,
    label: React.ReactNode,
    text: string
  ) => () => void
  getItem: (value: string) => ItemInfo | undefined
}

const SearchableSelectContext =
  React.createContext<SearchableSelectContextValue | null>(null)

/** true saat popup tertutup: item hanya mendaftarkan label, tanpa render. */
const CollectOnlyContext = React.createContext(false)

function useSearchableSelect(component: string) {
  const ctx = React.useContext(SearchableSelectContext)
  if (!ctx) {
    throw new Error(`<${component}> harus berada di dalam <SearchableSelect>`)
  }
  return ctx
}

function getNodeText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(getNodeText).join("")
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getNodeText(node.props.children)
  }
  return ""
}

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

/** Cocok jika semua kata yang diketik ada di label (urutan bebas). */
function filterByLabel(_value: string, search: string, keywords?: string[]) {
  const haystack = normalize(keywords?.join(" ") ?? "")
  const tokens = normalize(search).split(/\s+/).filter(Boolean)
  return tokens.every((token) => haystack.includes(token)) ? 1 : 0
}

function SearchableSelect<T extends string = string>({
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen,
  onOpenChange,
  disabled = false,
  name,
  children,
}: {
  value?: T
  defaultValue?: T
  onValueChange?: (value: T) => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  name?: string
  required?: boolean
  children?: React.ReactNode
}) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string>(
    defaultValue ?? ""
  )
  const value: string = valueProp !== undefined ? valueProp : uncontrolledValue

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
    defaultOpen ?? false
  )
  const open = openProp !== undefined ? openProp : uncontrolledOpen

  const [search, setSearch] = React.useState("")

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setUncontrolledOpen(next)
      onOpenChange?.(next)
      if (!next) setSearch("")
    },
    [openProp, onOpenChange]
  )

  const selectValue = React.useCallback(
    (next: string) => {
      if (next !== value) {
        if (valueProp === undefined) setUncontrolledValue(next)
        onValueChange?.(next as T)
      }
      setOpen(false)
    },
    [value, valueProp, onValueChange, setOpen]
  )

  // Registry value -> label, supaya trigger bisa menampilkan label item
  // terpilih walaupun popup sedang tertutup (sama seperti Radix Select).
  const itemsRef = React.useRef(new Map<string, ItemInfo>())
  const [, forceRender] = React.useReducer((x: number) => x + 1, 0)

  const registerItem = React.useCallback(
    (itemValue: string, label: React.ReactNode, text: string) => {
      const items = itemsRef.current
      const existing = items.get(itemValue)
      if (existing) {
        existing.count += 1
        existing.label = label
        if (existing.text !== text) {
          existing.text = text
          forceRender()
        }
      } else {
        items.set(itemValue, { label, text, count: 1 })
        forceRender()
      }

      return () => {
        const entry = items.get(itemValue)
        if (!entry) return
        entry.count -= 1
        // Ditunda: saat popup buka/tutup item di-unmount lalu langsung
        // di-mount ulang; penundaan ini mencegah label trigger berkedip.
        queueMicrotask(() => {
          const current = items.get(itemValue)
          if (current && current.count <= 0) {
            items.delete(itemValue)
            forceRender()
          }
        })
      }
    },
    []
  )

  const getItem = React.useCallback(
    (itemValue: string) => itemsRef.current.get(itemValue),
    []
  )

  const ctx: SearchableSelectContextValue = {
    value,
    selectValue,
    open,
    setOpen,
    disabled,
    search,
    setSearch,
    registerItem,
    getItem,
  }

  return (
    <SearchableSelectContext.Provider value={ctx}>
      <Popover
        open={open}
        onOpenChange={(next) => !disabled && setOpen(next)}
        modal
      >
        {children}
      </Popover>
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </SearchableSelectContext.Provider>
  )
}

function SearchableSelectTrigger({
  className,
  size = "default",
  children,
  disabled: disabledProp,
  onKeyDown,
  ...props
}: Omit<React.ComponentProps<"button">, "value"> & {
  size?: "sm" | "default"
}) {
  const ctx = useSearchableSelect("SearchableSelectTrigger")
  const selected = ctx.value ? ctx.getItem(ctx.value) : undefined
  const disabled = ctx.disabled || disabledProp

  return (
    <PopoverTrigger asChild>
      <button
        type="button"
        role="combobox"
        aria-expanded={ctx.open}
        aria-haspopup="listbox"
        data-slot="select-trigger"
        data-size={size}
        data-placeholder={selected ? undefined : ""}
        disabled={disabled}
        title={selected?.text || undefined}
        className={cn(
          "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit max-w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-left text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className
        )}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.defaultPrevented || ctx.open || disabled) return
          // Seperti Select biasa: panah membuka list, mengetik langsung
          // membuka list dan mengisi kolom pencarian.
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault()
            ctx.setOpen(true)
          } else if (
            event.key.length === 1 &&
            event.key !== " " &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            event.preventDefault()
            ctx.setOpen(true)
            ctx.setSearch(event.key)
          }
        }}
        {...props}
      >
        {children}
        <ChevronDownIcon className="size-4 opacity-50" />
      </button>
    </PopoverTrigger>
  )
}

function SearchableSelectValue({
  placeholder,
  className,
}: {
  placeholder?: React.ReactNode
  className?: string
}) {
  const ctx = useSearchableSelect("SearchableSelectValue")
  const selected = ctx.value ? ctx.getItem(ctx.value) : undefined

  return (
    <span
      data-slot="select-value"
      className={cn("block min-w-0 flex-1 truncate", className)}
    >
      {selected ? selected.label : placeholder}
    </span>
  )
}

function SearchableSelectContent({
  className,
  children,
  searchPlaceholder = "Cari...",
  emptyText = "Tidak ada data ditemukan.",
  align = "start",
}: {
  className?: string
  children?: React.ReactNode
  searchPlaceholder?: string
  emptyText?: React.ReactNode
  align?: "start" | "center" | "end"
}) {
  const ctx = useSearchableSelect("SearchableSelectContent")
  const listRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [activeValue, setActiveValue] = React.useState(ctx.value)

  // Saat dibuka, sorot item yang sedang terpilih.
  const [prevOpen, setPrevOpen] = React.useState(ctx.open)
  if (prevOpen !== ctx.open) {
    setPrevOpen(ctx.open)
    if (ctx.open) setActiveValue(ctx.value)
  }

  React.useEffect(() => {
    if (!ctx.open) return
    // Pastikan item terpilih terlihat saat list dibuka.
    const frame = requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>("[cmdk-item][data-selected='true']")
        ?.scrollIntoView({ block: "nearest" })
    })
    return () => cancelAnimationFrame(frame)
  }, [ctx.open])

  if (!ctx.open) {
    return (
      <CollectOnlyContext.Provider value={true}>
        {children}
      </CollectOnlyContext.Provider>
    )
  }

  return (
    <PopoverContent
      align={align}
      collisionPadding={8}
      onOpenAutoFocus={(event) => {
        // Fokus manual tanpa menyeleksi teks, supaya huruf yang diketik
        // di trigger tidak tertimpa ketikan berikutnya.
        event.preventDefault()
        const input = inputRef.current
        if (input) {
          input.focus()
          const end = input.value.length
          input.setSelectionRange(end, end)
        }
      }}
      className={cn(
        "w-auto min-w-[max(var(--radix-popover-trigger-width),10rem)] max-w-[min(28rem,calc(100vw_-_1rem))] overflow-hidden p-0",
        className
      )}
    >
      <CommandPrimitive
        data-slot="command"
        filter={filterByLabel}
        value={activeValue}
        onValueChange={setActiveValue}
        loop
        className="bg-popover text-popover-foreground flex w-full flex-col overflow-hidden rounded-md"
      >
        <div
          data-slot="command-input-wrapper"
          className="flex h-9 shrink-0 items-center gap-2 border-b px-3"
        >
          <SearchIcon className="size-4 shrink-0 opacity-50" />
          <CommandPrimitive.Input
            ref={inputRef}
            data-slot="command-input"
            value={ctx.search}
            onValueChange={ctx.setSearch}
            placeholder={searchPlaceholder}
            className="placeholder:text-muted-foreground flex h-9 w-full min-w-0 bg-transparent py-2 text-sm outline-hidden"
          />
        </div>
        <CommandPrimitive.List
          ref={listRef}
          data-slot="command-list"
          className="max-h-[min(18rem,calc(var(--radix-popover-content-available-height)_-_2.5rem))] scroll-py-1 overflow-x-hidden overflow-y-auto overscroll-contain p-1"
        >
          <CommandPrimitive.Empty className="text-muted-foreground px-2 py-6 text-center text-sm">
            {emptyText}
          </CommandPrimitive.Empty>
          {children}
        </CommandPrimitive.List>
      </CommandPrimitive>
    </PopoverContent>
  )
}

function SearchableSelectItem({
  value,
  textValue,
  disabled,
  className,
  children,
}: {
  value: string
  textValue?: string
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}) {
  const ctx = useSearchableSelect("SearchableSelectItem")
  const collectOnly = React.useContext(CollectOnlyContext)
  const text = (textValue ?? getNodeText(children)).trim()
  const { registerItem } = ctx

  React.useLayoutEffect(
    () => registerItem(value, children, text),
    // children sengaja tidak dijadikan dependency (identitasnya berubah
    // setiap render); label diperbarui saat value/text berubah.
    [registerItem, value, text]
  )

  if (collectOnly) return null

  const isSelected = ctx.value === value

  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      value={value}
      keywords={[text]}
      disabled={disabled}
      onSelect={() => ctx.selectValue(value)}
      title={text || undefined}
      className={cn(
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative flex w-full cursor-default items-start gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        isSelected && "font-medium",
        className
      )}
    >
      <span className="min-w-0 flex-1 break-words whitespace-normal [overflow-wrap:anywhere]">
        {children}
      </span>
      <span className="absolute top-2 right-2 flex size-3.5 items-center justify-center">
        {isSelected ? <CheckIcon className="size-4" /> : null}
      </span>
    </CommandPrimitive.Item>
  )
}

function SearchableSelectGroup({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  const collectOnly = React.useContext(CollectOnlyContext)
  if (collectOnly) return <>{children}</>

  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn("text-foreground overflow-hidden", className)}
    >
      {children}
    </CommandPrimitive.Group>
  )
}

function SearchableSelectLabel({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  const collectOnly = React.useContext(CollectOnlyContext)
  if (collectOnly) return null

  return (
    <div
      data-slot="select-label"
      className={cn(
        "text-muted-foreground px-2 py-1.5 text-xs break-words",
        className
      )}
    >
      {children}
    </div>
  )
}

function SearchableSelectSeparator({ className }: { className?: string }) {
  const collectOnly = React.useContext(CollectOnlyContext)
  if (collectOnly) return null

  return (
    <CommandPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
    />
  )
}

export {
  SearchableSelect,
  SearchableSelectContent,
  SearchableSelectGroup,
  SearchableSelectItem,
  SearchableSelectLabel,
  SearchableSelectSeparator,
  SearchableSelectTrigger,
  SearchableSelectValue,
}
