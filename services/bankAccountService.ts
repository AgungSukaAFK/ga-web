// src/services/bankAccountService.ts

import { createClient } from "@/lib/supabase/client";
import { BankAccount } from "@/type";

const supabase = createClient();

export const fetchMyBankAccounts = async (
  userId: string,
): Promise<BankAccount[]> => {
  const { data, error } = await supabase
    .from("user_bank_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as BankAccount[];
};

export const createBankAccount = async (
  payload: {
    bank_name: string;
    account_number: string;
    account_holder_name: string;
  },
  userId: string,
): Promise<BankAccount> => {
  const { data, error } = await supabase
    .from("user_bank_accounts")
    .insert([{ ...payload, user_id: userId }])
    .select()
    .single();

  if (error) throw error;
  return data as BankAccount;
};

export const updateBankAccount = async (
  id: number,
  payload: {
    bank_name: string;
    account_number: string;
    account_holder_name: string;
  },
): Promise<BankAccount> => {
  const { data, error } = await supabase
    .from("user_bank_accounts")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as BankAccount;
};

export const deleteBankAccount = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from("user_bank_accounts")
    .delete()
    .eq("id", id);

  if (error) throw error;
};
