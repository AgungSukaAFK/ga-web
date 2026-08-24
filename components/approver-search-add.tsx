"use client";

import { useState } from "react";
import { User } from "@/type";
import { searchUsers } from "@/services/approvalTemplateService";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";

interface ApproverSearchAddProps {
  onAdd: (user: User) => void;
}

// Cari & tambah approver ad-hoc ke jalur approval yang lagi disusun GA saat
// validasi (bukan ke template tersimpan) - perubahan ini cuma berlaku untuk
// approval dokumen ini saja.
export function ApproverSearchAdd({ onAdd }: ApproverSearchAddProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);

  const handleSearch = async () => {
    try {
      const data = await searchUsers(query);
      setResults(data);
    } catch (err: any) {
      toast.error("Gagal mencari user", { description: err.message });
    }
  };

  const handleAdd = (user: User) => {
    onAdd(user);
    setResults([]);
    setQuery("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Cari nama approver untuk ditambahkan (sementara, tidak mengubah template)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Button type="button" variant="outline" onClick={handleSearch}>
          <Search className="h-4 w-4" />
        </Button>
      </div>
      {results.length > 0 && (
        <div className="space-y-2 border p-2 rounded-md max-h-48 overflow-y-auto">
          {results.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-2 p-1 rounded hover:bg-accent"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={`https://ui-avatars.com/api/?name=${user.nama}`}
                />
                <AvatarFallback>{user.nama?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{user.nama}</p>
                  <Badge variant="outline">{user.department}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => handleAdd(user)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
