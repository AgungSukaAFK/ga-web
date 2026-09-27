


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."create_notifications"("p_notifications" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_count integer;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if p_notifications is null
     or jsonb_typeof(p_notifications) <> 'array' then
    return 0;
  end if;

  insert into public.notifications
    (user_id, actor_id, type, title, message, link,
     resource_id, resource_type, is_read)
  select
    (elem->>'user_id')::uuid,
    v_actor,                                  -- actor selalu = pemanggil (anti-spoof)
    elem->>'type',
    elem->>'title',
    nullif(elem->>'message', ''),
    elem->>'link',
    nullif(elem->>'resource_id', ''),
    nullif(elem->>'resource_type', ''),
    false
  from jsonb_array_elements(p_notifications) as elem
  where coalesce(elem->>'user_id', '') <> ''   -- lewati penerima kosong
    and (elem->>'user_id')::uuid <> v_actor;    -- jangan notif diri sendiri

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."create_notifications"("p_notifications" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_next_mr_code"("department_abbr" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    last_mr_code TEXT;
    last_cumulative_number INT;
    next_cumulative_number INT;
    current_year CHAR(2);
BEGIN
    -- Dapatkan 2 digit tahun saat ini (misal: '25' untuk 2025)
    current_year := to_char(now(), 'YY');

    -- Cari kode_mr terakhir untuk mendapatkan nomor kumulatif tertinggi
    -- Diurutkan berdasarkan ID untuk memastikan record terbaru yang diambil
    SELECT kode_mr INTO last_mr_code
    FROM public.material_requests
    ORDER BY id DESC
    LIMIT 1;

    -- Jika belum ada MR sama sekali
    IF last_mr_code IS NULL THEN
        next_cumulative_number := 1;
    ELSE
        -- Jika sudah ada, pecah string untuk mendapatkan nomor terakhir
        -- Contoh: split_part('GMI/MR-25/HSE/15', '/', 4) akan menghasilkan '15'
        last_cumulative_number := split_part(last_mr_code, '/', 4)::INT;
        next_cumulative_number := last_cumulative_number + 1;
    END IF;

    -- Gabungkan semua bagian menjadi kode MR yang baru
    RETURN 'GMI/MR-' || current_year || '/' || upper(department_abbr) || '/' || next_cumulative_number::TEXT;
END;
$$;


ALTER FUNCTION "public"."generate_next_mr_code"("department_abbr" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_stats"("p_company_code" "text", "p_start_date" "text", "p_end_date" "text") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    stats JSON;
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
BEGIN
    -- Konversi string tanggal ke timestamp
    -- Jika null, atur default (misal: 1 tahun terakhir)
    v_start_date := COALESCE(p_start_date::TIMESTAMPTZ, NOW() - INTERVAL '1 year');
    v_end_date := COALESCE(p_end_date::TIMESTAMPTZ, NOW());

    WITH filtered_mr AS (
        SELECT * FROM public.material_requests
        WHERE created_at BETWEEN v_start_date AND v_end_date
        AND (p_company_code = 'LOURDES' OR company_code = p_company_code)
    ),
    filtered_po AS (
        SELECT * FROM public.purchase_orders
        WHERE created_at BETWEEN v_start_date AND v_end_date
        AND (p_company_code = 'LOURDES' OR company_code = p_company_code)
    )
    SELECT json_build_object(
        'mr_open', (SELECT COUNT(*) FROM filtered_mr WHERE status NOT IN ('Completed', 'Rejected')),
        'mr_closed', (SELECT COUNT(*) FROM filtered_mr WHERE status = 'Completed'),
        'mr_total', (SELECT COUNT(*) FROM filtered_mr),
        'po_pending', (SELECT COUNT(*) FROM filtered_po WHERE status NOT IN ('Completed', 'Rejected')),
        'po_completed', (SELECT COUNT(*) FROM filtered_po WHERE status = 'Completed'),
        'po_total', (SELECT COUNT(*) FROM filtered_po)
    )
    INTO stats;
    
    RETURN stats;
END;
$$;


ALTER FUNCTION "public"."get_dashboard_stats"("p_company_code" "text", "p_start_date" "text", "p_end_date" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_department_mr_distribution"("p_company_code" "text") RETURNS TABLE("department" "text", "total_mr" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(mr.department, 'N/A') as department,
        COUNT(mr.id) AS total_mr
    FROM public.material_requests mr
    WHERE (p_company_code = 'LOURDES' OR mr.company_code = p_company_code)
    AND mr.created_at >= DATE_TRUNC('year', NOW())
    GROUP BY mr.department
    ORDER BY total_mr DESC;
END;
$$;


ALTER FUNCTION "public"."get_department_mr_distribution"("p_company_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_mr_po_trend"("p_company_code" "text", "p_start_date" "text", "p_end_date" "text") RETURNS TABLE("name" "text", "jumlah_mr" bigint, "jumlah_po" bigint)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    start_date_ts TIMESTAMPTZ;
    end_date_ts TIMESTAMPTZ;
BEGIN
    -- Konversi input string ISO ke timestamp
    start_date_ts := p_start_date::TIMESTAMPTZ;
    end_date_ts := p_end_date::TIMESTAMPTZ;

    RETURN QUERY
    WITH all_months AS (
        -- Buat seri bulan berdasarkan rentang tanggal
        SELECT date_trunc('month', m) AS month
        FROM generate_series(
            date_trunc('month', start_date_ts),
            end_date_ts,
            '1 month'::interval
        ) m
    ),
    mr_counts AS (
        SELECT
            date_trunc('month', created_at) AS month,
            count(*) AS total_mr
        FROM public.material_requests
        WHERE
            -- Tambahkan filter rentang tanggal
            created_at >= start_date_ts
            AND created_at <= end_date_ts
            AND (p_company_code = 'LOURDES' OR company_code = p_company_code)
        GROUP BY 1
    ),
    po_counts AS (
        SELECT
            date_trunc('month', created_at) AS month,
            count(*) AS total_po
        FROM public.purchase_orders
        WHERE
            -- Tambahkan filter rentang tanggal
            created_at >= start_date_ts
            AND created_at <= end_date_ts
            AND (p_company_code = 'LOURDES' OR company_code = p_company_code)
        GROUP BY 1
    )
    SELECT
        to_char(all_months.month, 'Mon YY') AS name,
        COALESCE(mr_counts.total_mr, 0)::BIGINT AS jumlah_mr,
        COALESCE(po_counts.total_po, 0)::BIGINT AS jumlah_po
    FROM all_months
    LEFT JOIN mr_counts ON all_months.month = mr_counts.month
    LEFT JOIN po_counts ON all_months.month = po_counts.month
    ORDER BY all_months.month;
    
END;
$$;


ALTER FUNCTION "public"."get_monthly_mr_po_trend"("p_company_code" "text", "p_start_date" "text", "p_end_date" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_mr_trend"("p_company_code" "text") RETURNS TABLE("month_name" "text", "total_mr" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    WITH months AS (
        SELECT TO_CHAR(GENERATE_SERIES(
            DATE_TRUNC('year', NOW()),
            DATE_TRUNC('year', NOW()) + INTERVAL '11 months',
            INTERVAL '1 month'
        ), 'YYYY-MM') AS month_year,
        TO_CHAR(GENERATE_SERIES(
            DATE_TRUNC('year', NOW()),
            DATE_TRUNC('year', NOW()) + INTERVAL '11 months',
            INTERVAL '1m'
        ), 'Mon') AS month_abbr
    )
    SELECT 
        m.month_abbr,
        COUNT(mr.id) AS total_mr
    FROM months m
    LEFT JOIN public.material_requests mr
        ON TO_CHAR(mr.created_at, 'YYYY-MM') = m.month_year
        AND (p_company_code = 'LOURDES' OR mr.company_code = p_company_code)
    GROUP BY m.month_year, m.month_abbr
    ORDER BY m.month_year;
END;
$$;


ALTER FUNCTION "public"."get_monthly_mr_trend"("p_company_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_mr_distribution_by_dept"("p_company_code" "text", "p_start_date" "text", "p_end_date" "text") RETURNS TABLE("department" "text", "total" bigint)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    start_date_ts TIMESTAMPTZ;
    end_date_ts TIMESTAMPTZ;
BEGIN
    -- Konversi input string ISO ke timestamp
    start_date_ts := p_start_date::TIMESTAMPTZ;
    end_date_ts := p_end_date::TIMESTAMPTZ;

    RETURN QUERY
    SELECT
        mr.department,
        count(*)::BIGINT AS total
    FROM public.material_requests mr
    WHERE
        -- Tambahkan filter rentang tanggal
        mr.created_at >= start_date_ts
        AND mr.created_at <= end_date_ts
        AND (p_company_code = 'LOURDES' OR mr.company_code = p_company_code)
    GROUP BY
        mr.department
    ORDER BY
        total DESC;
END;
$$;


ALTER FUNCTION "public"."get_mr_distribution_by_dept"("p_company_code" "text", "p_start_date" "text", "p_end_date" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_mr_budget_deduction"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  mr_cost_estimation numeric;
  cost_center_id_val bigint;
  previous_budget_val numeric;
  new_budget_val numeric;
BEGIN
  -- Cek apakah status berubah MENJADI "Waiting PO"
  IF NEW.status = 'Waiting PO' AND OLD.status <> 'Waiting PO' THEN

    -- Ambil data dari MR yang baru saja di-update
    cost_center_id_val := NEW.cost_center_id; -- Ini adalah ID cost center
    mr_cost_estimation := CAST(NEW.cost_estimation AS numeric); -- Ambil estimasi biaya

    -- Pastikan cost center dan estimasi ada
    IF cost_center_id_val IS NULL OR mr_cost_estimation IS NULL OR mr_cost_estimation <= 0 THEN
      RAISE WARNING 'MR % disetujui tanpa Cost Center ID atau Estimasi Biaya.', NEW.kode_mr;
      RETURN NEW;
    END IF;

    -- Ambil budget sebelumnya (PENTING: Gunakan FOR UPDATE untuk mengunci baris)
    SELECT current_budget
    INTO previous_budget_val
    FROM public.cost_centers
    WHERE id = cost_center_id_val
    FOR UPDATE; -- Lock baris ini untuk mencegah race condition

    -- Hitung budget baru
    new_budget_val := previous_budget_val - mr_cost_estimation;

    -- 1. Update tabel cost_centers
    UPDATE public.cost_centers
    SET 
      current_budget = new_budget_val,
      updated_at = now()
    WHERE id = cost_center_id_val;

    -- 2. Catat di history
    INSERT INTO public.cost_center_history
      (cost_center_id, mr_id, user_id, change_amount, previous_budget, new_budget, description)
    VALUES
      (
        cost_center_id_val,
        NEW.id, -- ID dari MR
        NEW.userid, -- ID user pembuat MR
        -mr_cost_estimation, -- Jumlah pengurangan (negatif)
        previous_budget_val,
        new_budget_val,
        'Deduction via MR Approval: ' || NEW.kode_mr
      );

  END IF;

  -- (Opsional) Logika pengembalian budget jika MR di-Reject setelah Waiting PO
  -- IF NEW.status = 'Rejected' AND OLD.status = 'Waiting PO' THEN
  --   -- ... (logika kebalikan dari di atas, change_amount positif) ...
  -- END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_mr_budget_deduction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$begin
  insert into public.profiles (id, email, role, lokasi, department, company, nrp)
  values (
    new.id, 
    new.email, -- Fetches the email from the newly created user in auth.users
    'user',    -- Default role
    null,      -- Default lokasi
    null,      -- Default department
    null,      -- Default company
    null       -- Default nrp
  );
  return new;
end;$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_logs" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "text" NOT NULL,
    "description" "text",
    "metadata" "jsonb"
);


ALTER TABLE "public"."activity_logs" OWNER TO "postgres";


ALTER TABLE "public"."activity_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."activity_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."approval_templates" (
    "id" bigint NOT NULL,
    "template_name" "text" NOT NULL,
    "description" "text",
    "approval_path" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."approval_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approval_templates_backup" (
    "id" bigint,
    "template_name" "text",
    "description" "text",
    "approval_path" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."approval_templates_backup" OWNER TO "postgres";


ALTER TABLE "public"."approval_templates" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."approval_templates_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."backup_mr_fix_20251120_092355" (
    "id" bigint,
    "userid" "uuid",
    "created_at" timestamp with time zone,
    "due_date" "date",
    "kode_mr" "text",
    "kategori" "text",
    "status" "text",
    "remarks" "text",
    "cost_estimation" "text",
    "department" "text",
    "orders" json,
    "discussions" json,
    "approvals" "jsonb",
    "attachments" json,
    "company_code" "text",
    "cost_center" "text",
    "tujuan_site" "text",
    "cost_center_id" bigint,
    "prioritas" "text",
    "level" "text"
);


ALTER TABLE "public"."backup_mr_fix_20251120_092355" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."barang" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "part_number" "text" NOT NULL,
    "part_name" "text",
    "category" "text",
    "uom" "text",
    "vendor" "text",
    "is_asset" boolean DEFAULT false,
    "last_purchase_price" numeric DEFAULT '0'::numeric,
    "link" "text",
    "description" "text" DEFAULT ''::"text"
);


ALTER TABLE "public"."barang" OWNER TO "postgres";


ALTER TABLE "public"."barang" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."barang_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "resource_type" "text" NOT NULL,
    "user_id" "uuid",
    "content" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cost_center_history" (
    "id" bigint NOT NULL,
    "cost_center_id" bigint NOT NULL,
    "mr_id" bigint,
    "user_id" "uuid",
    "change_amount" numeric NOT NULL,
    "previous_budget" numeric NOT NULL,
    "new_budget" numeric NOT NULL,
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cost_center_history" OWNER TO "postgres";


ALTER TABLE "public"."cost_center_history" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."cost_center_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."cost_centers" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "code" "text",
    "company_code" "text" NOT NULL,
    "initial_budget" numeric DEFAULT 0 NOT NULL,
    "current_budget" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."cost_centers" OWNER TO "postgres";


ALTER TABLE "public"."cost_centers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."cost_centers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."ga_stocks" (
    "id" bigint NOT NULL,
    "barang_id" bigint NOT NULL,
    "company_code" "text" NOT NULL,
    "quantity" numeric DEFAULT 0 NOT NULL,
    "location" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "updated_by" "uuid"
);


ALTER TABLE "public"."ga_stocks" OWNER TO "postgres";


ALTER TABLE "public"."ga_stocks" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."ga_stocks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."item_requests" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "requester_id" "uuid",
    "proposed_name" "text" NOT NULL,
    "proposed_category" "text" NOT NULL,
    "proposed_uom" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "admin_notes" "text",
    "processed_by" "uuid",
    "processed_at" timestamp with time zone
);


ALTER TABLE "public"."item_requests" OWNER TO "postgres";


ALTER TABLE "public"."item_requests" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."item_requests_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."material_requests" (
    "id" bigint NOT NULL,
    "userid" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "due_date" "date" NOT NULL,
    "kode_mr" "text" NOT NULL,
    "kategori" "text" NOT NULL,
    "status" "text" NOT NULL,
    "remarks" "text" DEFAULT ''::"text" NOT NULL,
    "cost_estimation" "text" DEFAULT ''::"text" NOT NULL,
    "department" "text" DEFAULT ''::"text" NOT NULL,
    "orders" json,
    "discussions" json,
    "approvals" "jsonb",
    "attachments" json,
    "company_code" "text" NOT NULL,
    "cost_center" "text",
    "tujuan_site" "text",
    "cost_center_id" bigint,
    "prioritas" "text",
    "level" "text" DEFAULT 'OPEN 1'::"text" NOT NULL,
    CONSTRAINT "chk_level" CHECK (("level" = ANY (ARRAY['OPEN 1'::"text", 'OPEN 2'::"text", 'OPEN 3A'::"text", 'OPEN 3B'::"text", 'OPEN 4'::"text", 'OPEN 5'::"text", 'CLOSE 1'::"text", 'CLOSE 2A'::"text", 'CLOSE 2B'::"text", 'CLOSE 3'::"text"]))),
    CONSTRAINT "chk_prioritas" CHECK (("prioritas" = ANY (ARRAY['P0'::"text", 'P1'::"text", 'P2'::"text", 'P3'::"text", 'P4'::"text"])))
);


ALTER TABLE "public"."material_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."material_requests_duplicate" (
    "id" bigint NOT NULL,
    "userid" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "due_date" "date" NOT NULL,
    "kode_mr" "text" NOT NULL,
    "kategori" "text" NOT NULL,
    "status" "text" NOT NULL,
    "remarks" "text" DEFAULT ''::"text" NOT NULL,
    "cost_estimation" "text" DEFAULT ''::"text" NOT NULL,
    "department" "text" DEFAULT ''::"text" NOT NULL,
    "orders" json,
    "discussions" json,
    "approvals" "jsonb",
    "attachments" json,
    "company_code" "text" NOT NULL,
    "cost_center" "text",
    "tujuan_site" "text",
    "cost_center_id" bigint,
    "prioritas" "text",
    "level" "text" DEFAULT 'OPEN 1'::"text" NOT NULL,
    CONSTRAINT "chk_level" CHECK (("level" = ANY (ARRAY['OPEN 1'::"text", 'OPEN 2'::"text", 'OPEN 3A'::"text", 'OPEN 3B'::"text", 'OPEN 4'::"text", 'OPEN 5'::"text", 'CLOSE 1'::"text", 'CLOSE 2A'::"text", 'CLOSE 2B'::"text", 'CLOSE 3'::"text"]))),
    CONSTRAINT "chk_prioritas" CHECK (("prioritas" = ANY (ARRAY['P0'::"text", 'P1'::"text", 'P2'::"text", 'P3'::"text", 'P4'::"text"])))
);


ALTER TABLE "public"."material_requests_duplicate" OWNER TO "postgres";


COMMENT ON TABLE "public"."material_requests_duplicate" IS 'This is a duplicate of material_requests';



ALTER TABLE "public"."material_requests_duplicate" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."material_requests_duplicate_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."material_requests" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."material_requests_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text",
    "resource_id" "text",
    "resource_type" "text",
    "link" "text",
    "is_read" boolean DEFAULT false
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pc_approval_templates" (
    "id" bigint NOT NULL,
    "template_name" "text" NOT NULL,
    "description" "text",
    "approval_path" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pc_approval_templates" OWNER TO "postgres";


ALTER TABLE "public"."pc_approval_templates" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."pc_approval_templates_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."petty_cash_requests" (
    "id" bigint NOT NULL,
    "kode_pc" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_code" "text" NOT NULL,
    "department" "text" NOT NULL,
    "cost_center_id" bigint,
    "type" "text" NOT NULL,
    "amount" numeric DEFAULT 0 NOT NULL,
    "actual_amount" numeric,
    "purpose" "text" NOT NULL,
    "status" "text" DEFAULT 'Pending Approval'::"text" NOT NULL,
    "approvals" "jsonb" DEFAULT '[]'::"jsonb",
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "settlement_attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "needed_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "discussions" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "petty_cash_requests_status_check" CHECK (("status" = ANY (ARRAY['Pending Validation'::"text", 'In Approval'::"text", 'Cash Distributed'::"text", 'Pending Settlement'::"text", 'Settled'::"text", 'Rejected'::"text"])))
);


ALTER TABLE "public"."petty_cash_requests" OWNER TO "postgres";


ALTER TABLE "public"."petty_cash_requests" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."petty_cash_requests_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "text",
    "lokasi" "text",
    "department" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "nama" "text",
    "nrp" "text",
    "company" "text",
    "email" "text",
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" bigint NOT NULL,
    "kode_po" "text" NOT NULL,
    "mr_id" bigint,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'Draft'::"text" NOT NULL,
    "vendor_details" "jsonb",
    "items" "jsonb" NOT NULL,
    "currency" "text" DEFAULT 'IDR'::"text" NOT NULL,
    "discount" numeric DEFAULT 0,
    "tax" numeric DEFAULT 0,
    "postage" numeric DEFAULT 0,
    "total_price" numeric NOT NULL,
    "payment_term" "text",
    "shipping_address" "text",
    "notes" "text",
    "attachments" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approvals" "jsonb",
    "company_code" "text" NOT NULL,
    "pph_type" "text",
    "pph_rate" numeric DEFAULT 0,
    "pph_amount" numeric DEFAULT 0,
    "dp_paid" boolean DEFAULT false NOT NULL,
    "bp_paid" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


ALTER TABLE "public"."purchase_orders" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."purchase_orders_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."users_with_profiles" AS
 SELECT "u"."id",
    "u"."email",
    "u"."created_at",
    "p"."nama",
    "p"."role",
    "p"."department",
    "p"."company",
    "p"."nrp",
    "p"."lokasi",
    "p"."email" AS "profile_email",
    "p"."created_at" AS "profile_created_at"
   FROM ("auth"."users" "u"
     LEFT JOIN "public"."profiles" "p" ON (("u"."id" = "p"."id")));


ALTER VIEW "public"."users_with_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendors" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "kode_vendor" "text" NOT NULL,
    "nama_vendor" "text" NOT NULL,
    "pic_contact_person" "text",
    "alamat" "text",
    "email" "text"
);


ALTER TABLE "public"."vendors" OWNER TO "postgres";


ALTER TABLE "public"."vendors" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."vendors_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_templates"
    ADD CONSTRAINT "approval_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_templates"
    ADD CONSTRAINT "approval_templates_template_name_key" UNIQUE ("template_name");



ALTER TABLE ONLY "public"."barang"
    ADD CONSTRAINT "barang_part_number_key" UNIQUE ("part_number");



ALTER TABLE ONLY "public"."barang"
    ADD CONSTRAINT "barang_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cost_center_history"
    ADD CONSTRAINT "cost_center_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cost_centers"
    ADD CONSTRAINT "cost_centers_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."cost_centers"
    ADD CONSTRAINT "cost_centers_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."cost_centers"
    ADD CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ga_stocks"
    ADD CONSTRAINT "ga_stocks_barang_id_company_code_key" UNIQUE ("barang_id", "company_code");



ALTER TABLE ONLY "public"."ga_stocks"
    ADD CONSTRAINT "ga_stocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_requests"
    ADD CONSTRAINT "item_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_requests_duplicate"
    ADD CONSTRAINT "material_requests_duplicate_kode_mr_key" UNIQUE ("kode_mr");



ALTER TABLE ONLY "public"."material_requests_duplicate"
    ADD CONSTRAINT "material_requests_duplicate_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_requests"
    ADD CONSTRAINT "material_requests_kode_mr_key" UNIQUE ("kode_mr");



ALTER TABLE ONLY "public"."material_requests"
    ADD CONSTRAINT "material_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pc_approval_templates"
    ADD CONSTRAINT "pc_approval_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pc_approval_templates"
    ADD CONSTRAINT "pc_approval_templates_template_name_key" UNIQUE ("template_name");



ALTER TABLE ONLY "public"."petty_cash_requests"
    ADD CONSTRAINT "petty_cash_requests_kode_pc_key" UNIQUE ("kode_pc");



ALTER TABLE ONLY "public"."petty_cash_requests"
    ADD CONSTRAINT "petty_cash_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_kode_po_key" UNIQUE ("kode_po");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_kode_vendor_key" UNIQUE ("kode_vendor");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activity_logs_resource_id" ON "public"."activity_logs" USING "btree" ("resource_id");



CREATE INDEX "idx_activity_logs_user_id" ON "public"."activity_logs" USING "btree" ("user_id");



CREATE INDEX "idx_cost_centers_is_active" ON "public"."cost_centers" USING "btree" ("is_active");



CREATE INDEX "idx_ga_stocks_barang" ON "public"."ga_stocks" USING "btree" ("barang_id");



CREATE INDEX "idx_ga_stocks_company" ON "public"."ga_stocks" USING "btree" ("company_code");



CREATE INDEX "idx_profiles_is_active" ON "public"."profiles" USING "btree" ("is_active");



CREATE OR REPLACE TRIGGER "on_approval_templates_updated" BEFORE UPDATE ON "public"."approval_templates" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_mr_status_change_update_budget" AFTER UPDATE OF "status" ON "public"."material_requests" FOR EACH ROW EXECUTE FUNCTION "public"."handle_mr_budget_deduction"();



CREATE OR REPLACE TRIGGER "on_purchase_orders_updated" BEFORE UPDATE ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."cost_center_history"
    ADD CONSTRAINT "fk_cost_center" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id");



ALTER TABLE ONLY "public"."material_requests"
    ADD CONSTRAINT "fk_cost_center" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id");



ALTER TABLE ONLY "public"."cost_center_history"
    ADD CONSTRAINT "fk_material_request" FOREIGN KEY ("mr_id") REFERENCES "public"."material_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."material_requests"
    ADD CONSTRAINT "fk_material_requests_profiles" FOREIGN KEY ("userid") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."petty_cash_requests"
    ADD CONSTRAINT "fk_petty_cash_cost_center" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."petty_cash_requests"
    ADD CONSTRAINT "fk_petty_cash_user" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cost_center_history"
    ADD CONSTRAINT "fk_user" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ga_stocks"
    ADD CONSTRAINT "ga_stocks_barang_id_fkey" FOREIGN KEY ("barang_id") REFERENCES "public"."barang"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ga_stocks"
    ADD CONSTRAINT "ga_stocks_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."item_requests"
    ADD CONSTRAINT "item_requests_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."item_requests"
    ADD CONSTRAINT "item_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."material_requests_duplicate"
    ADD CONSTRAINT "material_requests_duplicate_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id");



ALTER TABLE ONLY "public"."material_requests_duplicate"
    ADD CONSTRAINT "material_requests_duplicate_userid_fkey" FOREIGN KEY ("userid") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."material_requests"
    ADD CONSTRAINT "material_requests_userid_fkey" FOREIGN KEY ("userid") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_mr_id_fkey" FOREIGN KEY ("mr_id") REFERENCES "public"."material_requests"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



CREATE POLICY "ALlow public to read" ON "public"."purchase_orders" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow authenticated user to access PO" ON "public"."purchase_orders" TO "authenticated" USING (true);



CREATE POLICY "Allow full access for admins" ON "public"."approval_templates" USING (true);



CREATE POLICY "Allow read access for authenticated users" ON "public"."approval_templates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenthicated Access Only" ON "public"."barang" TO "authenticated" USING (true);



CREATE POLICY "Enable all access for authenticated users" ON "public"."pc_approval_templates" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users" ON "public"."petty_cash_requests" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."item_requests" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable read access for authenticated users" ON "public"."petty_cash_requests" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read for admin and purchasing" ON "public"."item_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role" = 'admin'::"text") OR ("profiles"."role" = 'approver'::"text") OR ("profiles"."department" = 'Purchasing'::"text"))))));



CREATE POLICY "Enable read for authenticated users" ON "public"."pc_approval_templates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read for users based on user_id" ON "public"."item_requests" FOR SELECT USING (("auth"."uid"() = "requester_id"));



CREATE POLICY "Enable update for admin and purchasing" ON "public"."item_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role" = 'admin'::"text") OR ("profiles"."role" = 'approver'::"text") OR ("profiles"."department" = 'Purchasing'::"text"))))));



CREATE POLICY "Enable update for authenticated users" ON "public"."petty_cash_requests" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "For all authenticated" ON "public"."material_requests" TO "authenticated" USING (true);



CREATE POLICY "Users can insert notifications for others" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."approval_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."barang" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ga_stocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ga_stocks_delete" ON "public"."ga_stocks" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "ga_stocks_insert" ON "public"."ga_stocks" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "ga_stocks_select" ON "public"."ga_stocks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "ga_stocks_update" ON "public"."ga_stocks" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."item_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_requests_duplicate" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."pc_approval_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."petty_cash_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."create_notifications"("p_notifications" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_notifications"("p_notifications" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_notifications"("p_notifications" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notifications"("p_notifications" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_next_mr_code"("department_abbr" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_next_mr_code"("department_abbr" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_next_mr_code"("department_abbr" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dashboard_stats"("p_company_code" "text", "p_start_date" "text", "p_end_date" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"("p_company_code" "text", "p_start_date" "text", "p_end_date" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"("p_company_code" "text", "p_start_date" "text", "p_end_date" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_department_mr_distribution"("p_company_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_department_mr_distribution"("p_company_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_department_mr_distribution"("p_company_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_mr_po_trend"("p_company_code" "text", "p_start_date" "text", "p_end_date" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_mr_po_trend"("p_company_code" "text", "p_start_date" "text", "p_end_date" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_mr_po_trend"("p_company_code" "text", "p_start_date" "text", "p_end_date" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_mr_trend"("p_company_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_mr_trend"("p_company_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_mr_trend"("p_company_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_mr_distribution_by_dept"("p_company_code" "text", "p_start_date" "text", "p_end_date" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_mr_distribution_by_dept"("p_company_code" "text", "p_start_date" "text", "p_end_date" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_mr_distribution_by_dept"("p_company_code" "text", "p_start_date" "text", "p_end_date" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_mr_budget_deduction"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_mr_budget_deduction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_mr_budget_deduction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."activity_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."activity_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."activity_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."approval_templates" TO "anon";
GRANT ALL ON TABLE "public"."approval_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_templates" TO "service_role";



GRANT ALL ON TABLE "public"."approval_templates_backup" TO "anon";
GRANT ALL ON TABLE "public"."approval_templates_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_templates_backup" TO "service_role";



GRANT ALL ON SEQUENCE "public"."approval_templates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."approval_templates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."approval_templates_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."backup_mr_fix_20251120_092355" TO "anon";
GRANT ALL ON TABLE "public"."backup_mr_fix_20251120_092355" TO "authenticated";
GRANT ALL ON TABLE "public"."backup_mr_fix_20251120_092355" TO "service_role";



GRANT ALL ON TABLE "public"."barang" TO "anon";
GRANT ALL ON TABLE "public"."barang" TO "authenticated";
GRANT ALL ON TABLE "public"."barang" TO "service_role";



GRANT ALL ON SEQUENCE "public"."barang_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."barang_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."barang_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."cost_center_history" TO "anon";
GRANT ALL ON TABLE "public"."cost_center_history" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_center_history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cost_center_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cost_center_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cost_center_history_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cost_centers" TO "anon";
GRANT ALL ON TABLE "public"."cost_centers" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_centers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cost_centers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cost_centers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cost_centers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ga_stocks" TO "anon";
GRANT ALL ON TABLE "public"."ga_stocks" TO "authenticated";
GRANT ALL ON TABLE "public"."ga_stocks" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ga_stocks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ga_stocks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ga_stocks_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."item_requests" TO "anon";
GRANT ALL ON TABLE "public"."item_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."item_requests" TO "service_role";



GRANT ALL ON SEQUENCE "public"."item_requests_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."item_requests_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."item_requests_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."material_requests" TO "anon";
GRANT ALL ON TABLE "public"."material_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."material_requests" TO "service_role";



GRANT ALL ON TABLE "public"."material_requests_duplicate" TO "anon";
GRANT ALL ON TABLE "public"."material_requests_duplicate" TO "authenticated";
GRANT ALL ON TABLE "public"."material_requests_duplicate" TO "service_role";



GRANT ALL ON SEQUENCE "public"."material_requests_duplicate_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."material_requests_duplicate_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."material_requests_duplicate_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."material_requests_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."material_requests_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."material_requests_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."pc_approval_templates" TO "anon";
GRANT ALL ON TABLE "public"."pc_approval_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."pc_approval_templates" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pc_approval_templates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pc_approval_templates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pc_approval_templates_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."petty_cash_requests" TO "anon";
GRANT ALL ON TABLE "public"."petty_cash_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."petty_cash_requests" TO "service_role";



GRANT ALL ON SEQUENCE "public"."petty_cash_requests_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."petty_cash_requests_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."petty_cash_requests_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT ALL ON SEQUENCE "public"."purchase_orders_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."purchase_orders_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."purchase_orders_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users_with_profiles" TO "anon";
GRANT ALL ON TABLE "public"."users_with_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."users_with_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."vendors" TO "anon";
GRANT ALL ON TABLE "public"."vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."vendors" TO "service_role";



GRANT ALL ON SEQUENCE "public"."vendors_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."vendors_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."vendors_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































