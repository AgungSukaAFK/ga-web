// TODO
/*
    1. Menampilkan data user (25 data per halaman)
    2. Search user berdasarkan nama atau email
    3. Filter user berdasarkan role, lokasi, atau departemen
    4. Pagination
    5. Edit data user
*/

import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function UserManagement() {
  const s = await createClient();
  const { data } = await s.from("users_with_profiles").select("*").limit(25);
  console.log(data);
  return (
    <>
      <Content size="lg">
        <Table className="">
          <TableHeader>
            <TableRow className="bg-gray-50 col-span-12">
              <TableHead>No</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((user, index) => (
              <TableRow key={user.id} className="col-span-12">
                <TableCell className="p-2">{index + 1}</TableCell>
                <TableCell className="p-2">{user.nama}</TableCell>
                <TableCell className="p-2">{user.email}</TableCell>
                <TableCell className="p-2">{user.role}</TableCell>
                <TableCell className="p-2">{user.lokasi}</TableCell>
                <TableCell className="p-2">{user.department}</TableCell>
                <TableCell className="p-2">
                  <Button variant={"outline"} size="sm">
                    <Link href={`/user-management/${user.id}`}>Edit</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Content>
    </>
  );
}
