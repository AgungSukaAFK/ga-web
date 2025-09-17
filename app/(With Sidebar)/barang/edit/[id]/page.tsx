"use client";

import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";

export default function EditBarangPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function fetch() {
      const s = createClient();
      const { data, error } = await s
        .from("barang")
        .select("*")
        .eq("id", id)
        .single();
      if (!error) setData(data);
      if (error) {
        console.log(error);
      }
    }
    fetch();
  }, [id]);

  const handleSubmit = async () => {
    if (
      data.part_name === "" ||
      data.part_number === "" ||
      data.category === "" ||
      data.uom === "" ||
      data.vendor === ""
    ) {
      toast.warning("Semua field harus diisi");
      return;
    }

    const s = createClient();
    const { error } = await s.from("barang").update(data).eq("id", id);
    if (error) {
      toast.error("Gagal menyimpan perubahan");
      return;
    }
    toast.success("Perubahan berhasil disimpan");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setData((prevData: any) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Kick user yang bukan approver atau admin
  useEffect(() => {
    const fetchProfile = async () => {
      const s = createClient();
      const { data: userData, error: userError } = await s.auth.getUser();
      if (userError || !userData.user) {
        window.location.href = "/barang";
        return;
      }
      const { data: profileData, error: profileError } = await s
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single();
      if (profileError || !profileData) {
        window.location.href = "/barang";
        return;
      }
      if (profileData.role !== "approver" && profileData.role !== "admin") {
        window.location.href = "/barang";
        return;
      }
    };
    fetchProfile();
  }, []);

  return (
    <>
      <Content size="md" title="Edit Barang">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Part Number</Label>
            <Input
              onChange={handleInputChange}
              name="part_number"
              defaultValue={data?.part_number}
            />
          </div>
          <div className="space-y-2">
            <Label>Part Name</Label>
            <Input
              onChange={handleInputChange}
              name="part_name"
              defaultValue={data?.part_name}
            />
          </div>
          <div className="space-y-2">
            <Label>Kategori</Label>
            <Input
              onChange={handleInputChange}
              name="category"
              defaultValue={data?.category}
            />
          </div>
          <div className="space-y-2">
            <Label>UoM</Label>
            <Input
              onChange={handleInputChange}
              name="uom"
              defaultValue={data?.uom}
            />
          </div>
          <div className="space-y-2">
            <Label>Vendor</Label>
            <Input
              onChange={handleInputChange}
              name="vendor"
              defaultValue={data?.vendor}
            />
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <Button onClick={handleSubmit}>Simpan Perubahan</Button>
        </div>
      </Content>
    </>
  );
}
