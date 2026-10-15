-- Seed data master barang untuk local dev (bukan production).
-- Jalankan lewat psql ke local DB:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seed-barang.sql

INSERT INTO public.barang (part_number, part_name, category, uom, vendor, is_asset, last_purchase_price, link, description)
VALUES
  -- ATK / Office Supplies
  ('ATK-0001', 'Kertas HVS A4 80gr', 'ATK', 'Rim', 'PT Sinar Dunia', false, 55000, '', 'Kertas HVS putih ukuran A4'),
  ('ATK-0002', 'Pulpen Standard AE7', 'ATK', 'Pcs', 'PT Sinar Dunia', false, 3000, '', 'Pulpen tinta hitam'),
  ('ATK-0003', 'Map Plastik Folio', 'ATK', 'Pcs', 'Toko Jaya Stationery', false, 4500, '', 'Map plastik warna bening'),
  ('ATK-0004', 'Stapler No. 10', 'ATK', 'Pcs', 'Toko Jaya Stationery', false, 25000, '', 'Stapler ukuran kecil'),
  ('ATK-0005', 'Isi Staples No. 10', 'ATK', 'Box', 'Toko Jaya Stationery', false, 8000, '', ''),
  ('ATK-0006', 'Spidol Whiteboard', 'ATK', 'Pcs', 'PT Sinar Dunia', false, 7500, '', 'Warna hitam/biru/merah'),
  ('ATK-0007', 'Tinta Printer Epson Refill', 'ATK', 'Pcs', 'PT Sinar Dunia', false, 85000, '', 'Tinta refill 4 warna'),
  ('ATK-0008', 'Amplop Coklat Folio', 'ATK', 'Box', 'Toko Jaya Stationery', false, 30000, '', ''),

  -- IT Equipment
  ('IT-0001', 'Laptop Lenovo ThinkPad E14', 'IT Equipment', 'Unit', 'PT Datascrip', true, 12500000, '', 'Core i5, 8GB RAM, 512GB SSD'),
  ('IT-0002', 'Mouse Wireless Logitech M170', 'IT Equipment', 'Unit', 'PT Datascrip', false, 95000, '', ''),
  ('IT-0003', 'Keyboard USB Logitech K120', 'IT Equipment', 'Unit', 'PT Datascrip', false, 150000, '', ''),
  ('IT-0004', 'Monitor LED 24 inch', 'IT Equipment', 'Unit', 'PT Datascrip', true, 1850000, '', ''),
  ('IT-0005', 'Kabel LAN Cat6 5m', 'IT Equipment', 'Pcs', 'Toko Komputer Jaya', false, 45000, '', ''),
  ('IT-0006', 'Flashdisk Sandisk 32GB', 'IT Equipment', 'Pcs', 'Toko Komputer Jaya', false, 65000, '', ''),
  ('IT-0007', 'External HDD 1TB', 'IT Equipment', 'Unit', 'Toko Komputer Jaya', true, 750000, '', ''),
  ('IT-0008', 'UPS 650VA', 'IT Equipment', 'Unit', 'PT Datascrip', true, 450000, '', 'Backup daya untuk PC/server ringan'),

  -- Cleaning / GA Supplies
  ('GA-0001', 'Sapu Ijuk', 'Cleaning Supplies', 'Pcs', 'CV Mitra Bersih', false, 18000, '', ''),
  ('GA-0002', 'Cairan Pembersih Lantai 1L', 'Cleaning Supplies', 'Pcs', 'CV Mitra Bersih', false, 22000, '', ''),
  ('GA-0003', 'Tissue Gulung Besar', 'Cleaning Supplies', 'Pcs', 'CV Mitra Bersih', false, 35000, '', ''),
  ('GA-0004', 'Sabun Cuci Tangan Refill 1L', 'Cleaning Supplies', 'Pcs', 'CV Mitra Bersih', false, 28000, '', ''),
  ('GA-0005', 'Kantong Sampah Besar', 'Cleaning Supplies', 'Box', 'CV Mitra Bersih', false, 15000, '', ''),
  ('GA-0006', 'Galon Air Mineral', 'Consumables', 'Pcs', 'PT Aqua Golden', false, 20000, '', ''),
  ('GA-0007', 'Gula Pasir 1kg', 'Consumables', 'Pcs', 'Toko Sembako Barokah', false, 16000, '', ''),
  ('GA-0008', 'Kopi Sachet', 'Consumables', 'Box', 'Toko Sembako Barokah', false, 32000, '', ''),

  -- K3 / Safety
  ('K3-0001', 'Helm Safety', 'Safety Equipment', 'Pcs', 'PT Safety Pro', true, 85000, '', 'Warna kuning standar SNI'),
  ('K3-0002', 'Sepatu Safety', 'Safety Equipment', 'Pcs', 'PT Safety Pro', true, 350000, '', ''),
  ('K3-0003', 'Sarung Tangan Safety', 'Safety Equipment', 'Pcs', 'PT Safety Pro', false, 25000, '', ''),
  ('K3-0004', 'Masker N95', 'Safety Equipment', 'Box', 'PT Safety Pro', false, 120000, '', 'Isi 20 pcs per box'),
  ('K3-0005', 'Rompi Safety Reflective', 'Safety Equipment', 'Pcs', 'PT Safety Pro', true, 65000, '', ''),
  ('K3-0006', 'APAR 3kg', 'Safety Equipment', 'Unit', 'PT Safety Pro', true, 275000, '', 'Alat Pemadam Api Ringan'),

  -- Spare Parts / Workshop
  ('SP-0001', 'Oli Mesin 4T 1L', 'Spare Parts', 'Pcs', 'PT Astra Otoparts', false, 55000, '', ''),
  ('SP-0002', 'Filter Udara Kendaraan', 'Spare Parts', 'Pcs', 'PT Astra Otoparts', false, 95000, '', ''),
  ('SP-0003', 'Aki Kering 12V', 'Spare Parts', 'Unit', 'PT Astra Otoparts', true, 850000, '', ''),
  ('SP-0004', 'Ban Dalam Motor', 'Spare Parts', 'Pcs', 'PT Astra Otoparts', false, 45000, '', '')
ON CONFLICT (part_number) DO NOTHING;
