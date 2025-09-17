import Chart from "@/components/chart-1";
import Chart2 from "@/components/chart-2";
import { Content } from "@/components/content";
import { DatePicker } from "@/components/date-picker";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp } from "lucide-react";

export default function Dashboard() {
  return (
    <>
      <Content
        size="md"
        cardAction={
          <div className="flex items-center gap-4">
            <DatePicker placeholder="Dari tanggal" />
            <DatePicker placeholder="Sampai tanggal" />
          </div>
        }
        cardFooter={
          <div className="flex w-full items-start gap-2 text-sm">
            <div className="grid gap-2">
              <div className="flex items-center gap-2 leading-none font-medium">
                Statistik pembuatan MR dan PO tahun ini{" "}
                <TrendingUp className="h-4 w-4" />
              </div>
              <div className="text-muted-foreground flex items-center gap-2 leading-none">
                Periode Januari - Juni 2025
              </div>
            </div>
          </div>
        }
      >
        <Chart />
      </Content>

      <Content
        size="md"
        cardAction={
          <div className="flex items-center gap-4">
            <DatePicker placeholder="Dari tanggal" />
            <DatePicker placeholder="Sampai tanggal" />
          </div>
        }
        cardFooter={
          <div className="flex w-full items-start gap-2 text-sm">
            <div className="grid gap-2">
              <div className="flex items-center gap-2 leading-none font-medium">
                Statistik pembuatan MR berdarkan departemen tahun ini{" "}
                <TrendingUp className="h-4 w-4" />
              </div>
              <div className="text-muted-foreground flex items-center gap-2 leading-none">
                Periode Januari - Juni 2025
              </div>
            </div>
          </div>
        }
      >
        <Chart2 />
      </Content>

      {/* MR Open */}
      <Content
        size="xs"
        title="MR Open"
        description="Jumlah MR open"
        className="bg-gradient-to-t from-black/5 via-black/0 to-black/0 stop"
      >
        <p className="font-bold text-2xl">14</p>
        <CardDescription>Diambil dari tanggal 1 Juni 2025</CardDescription>
      </Content>

      {/* MR Close */}
      <Content
        size="xs"
        title="MR Close"
        description="Jumlah MR closed"
        className="bg-gradient-to-t from-black/5 via-black/0 to-black/0 stop"
      >
        <p className="font-bold text-2xl">16</p>
        <CardDescription>Diambil dari tanggal 1 Juni 2025</CardDescription>
      </Content>

      {/* Po Pending */}
      <Content
        size="xs"
        title="PO Pending"
        description="Jumlah MR closed"
        className="bg-gradient-to-t from-black/5 via-black/0 to-black/0 stop"
      >
        <p className="font-bold text-2xl">16</p>
        <CardDescription>Diambil dari tanggal 1 Juni 2025</CardDescription>
      </Content>

      {/* Po Paid */}
      <Content
        size="xs"
        title="PO Paid"
        description="Jumlah MR closed"
        className="bg-gradient-to-t from-black/5 via-black/0 to-black/0 stop"
      >
        <p className="font-bold text-2xl">16</p>
        <CardDescription>Diambil dari tanggal 1 Juni 2025</CardDescription>
      </Content>

      {/* Total PO */}
      <Content
        size="xs"
        title="Total PO"
        description="Jumlah MR closed"
        className="bg-gradient-to-t from-black/5 via-black/0 to-black/0 stop"
      >
        <p className="font-bold text-2xl">30</p>
        <CardDescription>Diambil dari tanggal 1 Juni 2025</CardDescription>
      </Content>

      {/* Total MR */}
      <Content
        size="xs"
        title="Total MR"
        description="Jumlah MR closed"
        className="bg-gradient-to-t from-black/5 via-black/0 to-black/0 stop"
      >
        <p className="font-bold text-2xl">30</p>
        <CardDescription>Diambil dari tanggal 1 Juni 2025</CardDescription>
      </Content>

      {/* Rata-rata waktu MR sampai terbuat PO dan rata-rata waktu MR open sampai close */}
      <Content
        size="md"
        title="Rata-rata waktu MR sampai PO"
        description="2 Hari, 6 Jam"
        className="bg-gradient-to-t from-black/5 via-black/0 to-black/0 stop"
      >
        <CardTitle>Rata-rata waktu MR Open sampai MR Close</CardTitle>
        <CardDescription>6 Hari, 12 Jam</CardDescription>

        <p className="text-xs text-muted-foreground text-end">
          Nilai diambil berdasarkan 100 data terakhir
        </p>
      </Content>

      {/* Tabel 50 Material Request terbaru */}
      <Content
        size="lg"
        title="Material Request Terbaru"
        description="diambil dari data 50 MR terakhir"
        className="bg-gradient-to-t from-black/5 via-black/0 to-black/0 stop"
      >
        <Table className="col-span-12">
          <TableHeader>
            <TableRow>
              <TableHead>No</TableHead>
              <TableHead>Kode MR</TableHead>
              <TableHead>PIC</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tanggal dibuat</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </Content>
    </>
  );
}
