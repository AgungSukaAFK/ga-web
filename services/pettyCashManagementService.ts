// src/services/pettyCashManagementService.ts
//
// Query tabel Management Petty Cash. Paginasi, search, filter, & sort jalan
// di server supaya tab tetap lengkap saat dokumennya melewati batas baris
// PostgREST. Pembatasan company tetap ikut query walau filter dilepas.

import { createClient } from "@/lib/supabase/client";
import { orIlikePattern } from "@/lib/supabase/search-filter";
import { resolveSort, SortColumnConfig } from "@/components/sortable-table-head";
import {
  PcDocType,
  PettyCashDeklarasi,
  PettyCashPengajuan,
  PettyCashSubVoucher,
  PettyCashVoucher,
} from "@/type";
import { DEKLARASI_LIST_SELECT } from "@/services/pettyCashDeklarasiService";
import { PENGAJUAN_LIST_SELECT } from "@/services/pettyCashPengajuanService";
import { SUB_VOUCHER_WITH_VOUCHER } from "@/services/pettyCashSubVoucherService";
import { VOUCHER_LIST_SELECT } from "@/services/pettyCashVoucherService";

const supabase = createClient();

export type PcManagementDoc =
  | PettyCashPengajuan
  | PettyCashVoucher
  | PettyCashSubVoucher
  | PettyCashDeklarasi;

export const PC_MANAGEMENT_DEFAULT_SORT = "tanggal.desc";

export const PC_MANAGEMENT_SEARCH_FIELDS = [
  "Kode dokumen",
  "Departemen",
  "Nama pemohon",
];

const STAGE_QUERY: Record<
  PcDocType,
  {
    table: string;
    select: string;
    companyColumn: string;
    sortColumns: Record<string, SortColumnConfig>;
    kodeColumn: string;
  }
> = {
  pengajuan: {
    table: "petty_cash_pengajuan",
    select: PENGAJUAN_LIST_SELECT,
    companyColumn: "company_code",
    kodeColumn: "kode_pengajuan",
    sortColumns: {
      tanggal: { column: "created_at" },
      kode: { column: "kode_pengajuan" },
      departemen: { column: "department" },
      total: { column: "total_amount" },
      status: { column: "status" },
    },
  },
  voucher: {
    table: "petty_cash_voucher",
    select: VOUCHER_LIST_SELECT,
    companyColumn: "company_code",
    kodeColumn: "kode_voucher",
    sortColumns: {
      tanggal: { column: "created_at" },
      kode: { column: "kode_voucher" },
      departemen: { column: "department" },
      total: { column: "total_amount" },
      status: { column: "status" },
    },
  },
  // Company & departemen Sub-Voucher ada di Voucher induknya. !inner membuat
  // filter company di tabel relasi ikut menyaring baris Sub-Voucher.
  sub_voucher: {
    table: "petty_cash_sub_voucher",
    select: SUB_VOUCHER_WITH_VOUCHER.replace(
      "petty_cash_voucher(",
      "petty_cash_voucher!inner(",
    ),
    companyColumn: "petty_cash_voucher.company_code",
    kodeColumn: "kode_sub_voucher",
    sortColumns: {
      tanggal: { column: "created_at" },
      kode: { column: "kode_sub_voucher" },
      total: { column: "amount" },
      status: { column: "status" },
    },
  },
  deklarasi: {
    table: "petty_cash_deklarasi",
    select: DEKLARASI_LIST_SELECT,
    companyColumn: "company_code",
    kodeColumn: "kode_deklarasi",
    sortColumns: {
      tanggal: { column: "created_at" },
      kode: { column: "kode_deklarasi" },
      departemen: { column: "department" },
      total: { column: "total_amount" },
      status: { column: "status" },
    },
  },
};

const buildSearchFilter = async (stage: PcDocType, term: string) => {
  const pattern = orIlikePattern(term);
  const [{ data: matchingUsers }, { data: matchingVouchers }] =
    await Promise.all([
      supabase.from("users_with_profiles").select("id").ilike("nama", `%${term}%`),
      stage === "sub_voucher"
        ? supabase
            .from("petty_cash_voucher")
            .select("id")
            .ilike("department", `%${term}%`)
        : Promise.resolve({ data: null }),
    ]);

  const filters = [`${STAGE_QUERY[stage].kodeColumn}.ilike.${pattern}`];
  if (stage !== "sub_voucher") filters.push(`department.ilike.${pattern}`);
  if (matchingVouchers?.length) {
    filters.push(`voucher_id.in.(${matchingVouchers.map((v) => v.id).join(",")})`);
  }
  if (matchingUsers?.length) {
    filters.push(`user_id.in.(${matchingUsers.map((u) => u.id).join(",")})`);
  }
  return filters.join(",");
};

export const fetchPcManagementPage = async (
  stage: PcDocType,
  options: {
    page: number;
    limit: number;
    search: string;
    status: string;
    company: string;
    // null = tanpa batas company (admin / company LOURDES).
    allowedCompanies: string[] | null;
    sort: string;
  },
): Promise<{ data: PcManagementDoc[]; count: number }> => {
  const { page, limit, search, status, company, allowedCompanies } = options;
  const config = STAGE_QUERY[stage];
  const sort = resolveSort(
    options.sort,
    config.sortColumns,
    PC_MANAGEMENT_DEFAULT_SORT,
  );
  const from = (page - 1) * limit;

  let query = supabase
    .from(config.table)
    .select(config.select, { count: "exact" });

  if (allowedCompanies) query = query.in(config.companyColumn, allowedCompanies);
  if (company) query = query.eq(config.companyColumn, company);
  if (status) query = query.eq("status", status);
  if (search) query = query.or(await buildSearchFilter(stage, search));

  const { data, error, count } = await query
    .order(sort.column, { ascending: sort.ascending })
    .order("id", { ascending: true }) // urutan stabil antar halaman
    .range(from, from + limit - 1);

  if (error) throw error;
  return {
    data: (data ?? []) as unknown as PcManagementDoc[],
    count: count || 0,
  };
};
