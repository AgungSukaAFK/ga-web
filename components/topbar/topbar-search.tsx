"use client";

// Global search di top bar: cari menu, aksi cepat, dan data (MR, PO, Petty
// Cash, Barang, Vendor, User) dari satu kotak. Susunan hasil ada di
// ./search-sections.ts, pengambilan data di ./use-global-search.ts.
//
// lg ke atas: field inline di tengah top bar + panel hasil di bawahnya. Di
// bawah lg: tombol ikon yg membuka dialog (hemat tinggi header di mobile &
// tidak menjepit breadcrumb di tablet). Shortcut ⌘K / Ctrl+K memfokuskan
// field inline kalau tampil, selain itu membuka dialog.
//
// Keyboard: ↑/↓ pilih, Enter buka, Esc tutup. Enter sebelum hasil server
// datang (mis. tempel kode MR lalu Enter) menunggu hasilnya dulu, lalu
// membuka yang paling cocok.

import {
  forwardRef,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Loader2, RotateCw, Search, SearchX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { MyAlertDialog } from "@/components/dialog-confirm";
import { createClient } from "@/lib/supabase/client";
import { buildNavGroups } from "@/lib/sidebar/nav-config";
import { setPendingNavUrl } from "@/lib/sidebar/nav-pending";
import { runViewTransition } from "@/lib/view-transition";
import { cn } from "@/lib/utils";
import { useTopbarProfileData } from "./topbar";
import { TopbarIconButton } from "./topbar-icon-button";
import {
  buildSections,
  type BuildSectionsInput,
  type SearchItem,
  type SearchSection,
} from "./search-sections";
import {
  normalizeQuery,
  SEARCH_MIN_CHARS,
  type SearchStatus,
  useGlobalSearch,
  usePendingApprovals,
  useSearchHistory,
} from "./use-global-search";

// Field search - dipakai inline (desktop) & di dalam dialog (mobile/tablet).
// State query dipegang TopbarSearch supaya dua tampilan ini berbagi isi.
const SearchField = forwardRef<
  HTMLInputElement,
  {
    query: string;
    onQueryChange: (q: string) => void;
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
    onFocus?: () => void;
    loading?: boolean;
    listId: string;
    expanded: boolean;
    activeId?: string;
    shortcut?: ReactNode;
    className?: string;
  }
>(function SearchField(
  {
    query,
    onQueryChange,
    onKeyDown,
    onFocus,
    loading,
    listId,
    expanded,
    activeId,
    shortcut,
    className,
  },
  ref,
) {
  const localRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => localRef.current!);
  const Icon = loading ? Loader2 : Search;

  return (
    <form
      role="search"
      onSubmit={(e) => e.preventDefault()}
      className={cn(
        "group/search flex h-9 w-full min-w-0 items-center rounded-lg border border-border/70 bg-muted/40 text-muted-foreground shadow-xs transition-colors focus-within:border-ring focus-within:bg-background focus-within:ring-2 focus-within:ring-ring/20 hover:bg-muted/70 focus-within:hover:bg-background",
        className,
      )}
    >
      <Icon
        className={cn(
          "pointer-events-none ml-3 size-4 shrink-0",
          loading && "animate-spin",
        )}
      />
      <input
        ref={localRef}
        type="search"
        enterKeyHint="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        placeholder="Cari MR, PO, barang, menu…"
        aria-label="Global Search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded ? activeId : undefined}
        autoComplete="off"
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {query ? (
        <button
          type="button"
          onClick={() => {
            onQueryChange("");
            localRef.current?.focus();
          }}
          aria-label="Hapus pencarian"
          className="mr-1.5 flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : (
        shortcut
      )}
    </form>
  );
});

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Tebalkan bagian teks yang cocok dengan kata-kata di query.
function Highlight({ text, query }: { text: string; query: string }) {
  const words = normalizeQuery(query)
    .split(" ")
    .filter((w) => w.length >= 2)
    .map(escapeRegExp);
  if (words.length === 0) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.join("|")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className="rounded-[3px] bg-primary/15 text-inherit"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function ResultRow({
  item,
  id,
  active,
  query,
  onHover,
  onSelect,
}: {
  item: SearchItem;
  id: string;
  active: boolean;
  query: string;
  onHover: () => void;
  onSelect: () => void;
}) {
  const Icon = item.icon;
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      onMouseMove={onHover}
      onClick={onSelect}
      className={cn(
        "mx-1.5 flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5",
        active && "bg-accent text-accent-foreground",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground",
          item.more && "border-transparent bg-transparent",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm",
            item.more ? "text-muted-foreground" : "font-medium",
          )}
        >
          {item.fillQuery !== undefined ? (
            item.title
          ) : (
            <Highlight text={item.title} query={query} />
          )}
        </span>
        {item.subtitle && (
          <span className="block truncate text-xs text-muted-foreground">
            <Highlight text={item.subtitle} query={query} />
          </span>
        )}
      </span>
      {(item.status || item.hint) && (
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          {item.status && (
            <span className="max-w-[9rem] truncate rounded-full border px-2 py-px text-[10px] font-medium text-muted-foreground">
              {item.status}
            </span>
          )}
          {item.hint && (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {item.hint}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

function SearchResults({
  sections,
  listId,
  optionId,
  activeIndex,
  query,
  status,
  hasUser,
  onHover,
  onSelect,
  onRetry,
  onClearHistory,
  showKeyHints,
  className,
}: {
  sections: SearchSection[];
  listId: string;
  optionId: (index: number) => string;
  activeIndex: number;
  query: string;
  status: SearchStatus;
  hasUser: boolean;
  onHover: (index: number) => void;
  onSelect: (item: SearchItem) => void;
  onRetry: () => void;
  onClearHistory: () => void;
  showKeyHints?: boolean;
  className?: string;
}) {
  const q = normalizeQuery(query);
  const empty = sections.length === 0;
  const tooShort = !!q && q.length < SEARCH_MIN_CHARS;

  let message: ReactNode = null;
  if (!hasUser) {
    message = (
      <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Memuat…
      </p>
    );
  } else if (status === "error") {
    message = (
      <div className="flex flex-col items-center gap-2 px-4 py-5 text-center text-sm text-muted-foreground">
        Pencarian data gagal dimuat.
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={onRetry}
        >
          <RotateCw className="size-3.5" /> Coba lagi
        </Button>
      </div>
    );
  } else if (status === "loading" && empty) {
    message = (
      <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Mencari…
      </p>
    );
  } else if (q && empty && !tooShort) {
    message = (
      <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-muted-foreground">
        <SearchX className="size-6 opacity-60" />
        <p>
          Tidak ada hasil untuk &ldquo;
          <span className="font-medium text-foreground">{q}</span>&rdquo;
        </p>
      </div>
    );
  } else if (!q && empty) {
    message = (
      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
        Ketik nomor MR/PO, nama barang, vendor, atau menu.
      </p>
    );
  }

  let index = 0;
  return (
    // mousedown di panel tidak boleh mencuri fokus dari input.
    <div onMouseDown={(e) => e.preventDefault()} className={className}>
      <div className="max-h-[min(30rem,calc(100dvh-10rem))] overflow-y-auto overscroll-contain py-1.5">
        <div id={listId} role="listbox" aria-label="Hasil pencarian">
          {sections.map((section) => {
            const headingId = `${listId}-${section.id}`;
            return (
              <div
                key={section.id}
                role="group"
                aria-labelledby={headingId}
                className="pb-1"
              >
                <div className="flex items-center justify-between gap-2 px-3.5 pb-1 pt-2">
                  <span
                    id={headingId}
                    className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {section.label}
                  </span>
                  {section.clearable && (
                    <button
                      type="button"
                      onClick={onClearHistory}
                      className="text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Hapus riwayat
                    </button>
                  )}
                </div>
                {section.items.map((item) => {
                  const i = index++;
                  return (
                    <ResultRow
                      key={item.key}
                      item={item}
                      id={optionId(i)}
                      active={i === activeIndex}
                      query={query}
                      onHover={() => onHover(i)}
                      onSelect={() => onSelect(item)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
        {message}
        {tooShort && (
          <p className="px-3.5 pb-1.5 pt-2 text-xs text-muted-foreground">
            Ketik minimal {SEARCH_MIN_CHARS} huruf untuk mencari dokumen &amp;
            data.
          </p>
        )}
      </div>
      {showKeyHints && (
        <div className="flex items-center gap-3 border-t px-3.5 py-1.5 text-[11px] text-muted-foreground">
          <span>
            <kbd className="font-sans">↑↓</kbd> pilih
          </span>
          <span>
            <kbd className="font-sans">Enter</kbd> buka
          </span>
          <span>
            <kbd className="font-sans">Esc</kbd> tutup
          </span>
        </div>
      )}
    </div>
  );
}

export function TopbarSearch() {
  const profile = useTopbarProfileData();
  const userId = profile?.id ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [opening, setOpening] = useState(false);
  const inlineRef = useRef<HTMLInputElement>(null);
  const dialogInputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const scrollToActive = useRef(false);
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;
  const open = panelOpen || dialogOpen;

  // Label shortcut sesuai OS (⌘K di Mac, Ctrl K di Windows/Linux). Dicek
  // setelah mount supaya tidak beda dgn hasil render server.
  const [isMac, setIsMac] = useState<boolean | null>(null);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  const navGroups = useMemo(() => buildNavGroups(profile), [profile]);
  const search = useGlobalSearch(query, userId);
  const pending = usePendingApprovals(userId, open);
  const { history, addDoc, addQuery, clear: clearHistory } =
    useSearchHistory(userId);

  const sectionInput: BuildSectionsInput = {
    query,
    navGroups,
    profile,
    rows: search.rows,
    pending,
    history,
    theme,
  };
  const sections = useMemo(
    () => (profile ? buildSections(sectionInput) : []),
    // sectionInput dibentuk dari nilai-nilai ini.
    [query, navGroups, profile, search.rows, pending, history, theme],
  );
  const items = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  // Pilihan balik ke item teratas tiap query / hasil berubah.
  useEffect(() => setActiveIndex(0), [query, search.rows]);
  useEffect(() => {
    if (activeIndex >= items.length && items.length > 0) setActiveIndex(0);
  }, [items.length, activeIndex]);
  useEffect(() => {
    if (!scrollToActive.current) return;
    scrollToActive.current = false;
    document
      .getElementById(optionId(activeIndex))
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      const el = inlineRef.current;
      if (el && el.offsetParent !== null) {
        el.focus();
        el.select();
      } else {
        setDialogOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const closeAll = () => {
    setPanelOpen(false);
    setDialogOpen(false);
    inlineRef.current?.blur();
  };

  const navigate = (href: string) => {
    const path = href.split("?")[0];
    // Progress bar/highlight sidebar dibersihkan saat pathname berubah -
    // jangan dipasang kalau cuma query string yang beda.
    if (path !== pathname) setPendingNavUrl(path);
    router.push(href);
  };

  const select = (item: SearchItem) => {
    if (item.fillQuery !== undefined) {
      setQuery(item.fillQuery);
      (dialogOpen ? dialogInputRef : inlineRef).current?.focus();
      return;
    }
    if (normalizeQuery(query)) addQuery(query);
    if (item.recent) addDoc(item.recent);
    setQuery("");
    closeAll();

    const action = item.action;
    if (action?.type === "theme") {
      runViewTransition(() => setTheme(action.value));
    } else if (action?.type === "logout") {
      setLogoutOpen(true);
    } else if (item.href) {
      navigate(item.href);
    }
  };

  const handleEnter = async () => {
    if (opening) return;
    // Belum ada hasil server utk query ini & user belum memilih item lain:
    // tunggu hasilnya, lalu buka yang teratas (kode persis selalu di atas).
    if (activeIndex === 0 && search.status === "loading") {
      setOpening(true);
      try {
        const rows = await search.flush();
        const top = buildSections({ ...sectionInput, rows }).flatMap(
          (s) => s.items,
        )[0];
        if (top) select(top);
      } catch {
        // pesan gagal sudah ditampilkan dari status hook
      } finally {
        setOpening(false);
      }
      return;
    }
    const item = items[activeIndex];
    if (item) select(item);
  };

  const handleKeyDown =
    (inline: boolean) => (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (inline) setPanelOpen(true);
        if (items.length === 0) return;
        const step = e.key === "ArrowDown" ? 1 : -1;
        scrollToActive.current = true;
        setActiveIndex((i) => (i + step + items.length) % items.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleEnter();
      } else if (e.key === "Escape" && inline) {
        setQuery("");
        closeAll();
      }
    };

  const handleQueryChange = (inline: boolean) => (q: string) => {
    setQuery(q);
    if (inline) setPanelOpen(true);
  };

  async function handleLogout() {
    await createClient().auth.signOut();
    router.push("/auth/login");
  }

  const shortcut = isMac !== null && (
    <kbd className="pointer-events-none mr-2 inline-flex h-5 shrink-0 select-none items-center gap-1 whitespace-nowrap rounded border bg-background px-1.5 font-sans text-[10px] font-medium leading-none group-focus-within/search:hidden">
      {isMac ? (
        <>
          <span className="text-xs leading-none">⌘</span>K
        </>
      ) : (
        <>Ctrl K</>
      )}
    </kbd>
  );

  const loading = opening || search.status === "loading";
  const activeId = items.length > 0 ? optionId(activeIndex) : undefined;
  const results = (showKeyHints: boolean, className?: string) => (
    <SearchResults
      sections={sections}
      listId={listId}
      optionId={optionId}
      activeIndex={activeIndex}
      query={query}
      status={search.status}
      hasUser={!!profile}
      onHover={setActiveIndex}
      onSelect={select}
      onRetry={() => search.flush().catch(() => {})}
      onClearHistory={clearHistory}
      showKeyHints={showKeyHints}
      className={className}
    />
  );

  return (
    <>
      <Popover open={panelOpen} onOpenChange={setPanelOpen}>
        <PopoverAnchor asChild>
          <div ref={anchorRef} className="hidden w-full min-w-0 max-w-md lg:block">
            <SearchField
              ref={inlineRef}
              query={query}
              onQueryChange={handleQueryChange(true)}
              onKeyDown={handleKeyDown(true)}
              onFocus={() => setPanelOpen(true)}
              loading={loading}
              listId={listId}
              expanded={panelOpen}
              activeId={activeId}
              shortcut={shortcut}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="center"
          sideOffset={8}
          collisionPadding={8}
          className="w-[min(34rem,calc(100vw-2rem))] overflow-hidden p-0"
          // Fokus tetap di input; klik di field sendiri bukan "di luar".
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
        >
          {results(true)}
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <TopbarIconButton
          label="Global Search"
          className="lg:hidden"
          onClick={() => setDialogOpen(true)}
        >
          <Search />
        </TopbarIconButton>
        {/* Nempel di atas layar (bukan di tengah) supaya tidak ketutup
            keyboard virtual di mobile. */}
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          // minmax(0,1fr): kolom grid DialogContent tidak boleh melebar
          // mengikuti teks hasil yg panjang (harus terpotong "…").
          className="top-3 max-w-[calc(100%-1.5rem)] translate-y-0 grid-cols-[minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:top-[12vh] sm:max-w-lg"
        >
          <DialogTitle className="sr-only">Global Search</DialogTitle>
          <div className="flex items-center gap-1 p-2">
            <SearchField
              ref={dialogInputRef}
              query={query}
              onQueryChange={handleQueryChange(false)}
              onKeyDown={handleKeyDown(false)}
              loading={loading}
              listId={listId}
              expanded={dialogOpen}
              activeId={activeId}
              className="h-10 border-transparent bg-transparent shadow-none focus-within:border-transparent focus-within:bg-transparent focus-within:ring-0"
            />
            <DialogClose asChild>
              <Button variant="ghost" size="sm" className="h-10 shrink-0 px-3">
                Batal
              </Button>
            </DialogClose>
          </div>
          {results(false, "border-t")}
        </DialogContent>
      </Dialog>

      <MyAlertDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        onAction={handleLogout}
      />
    </>
  );
}
