-- ==========================================
-- Inventory & Transaction Management System
-- Supabase PostgreSQL Schema
-- ==========================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Drop existing objects
DROP FUNCTION IF EXISTS create_transaction CASCADE;
DROP FUNCTION IF EXISTS cancel_transaction CASCADE;
DROP TABLE IF EXISTS transaction_item_breakdown CASCADE;
DROP TABLE IF EXISTS transaction_details CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS joki_orders CASCADE;
DROP TABLE IF EXISTS joki_services CASCADE;
DROP TABLE IF EXISTS set_items CASCADE;
DROP TABLE IF EXISTS sets CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TYPE IF EXISTS transaction_status CASCADE;
DROP TYPE IF EXISTS detail_type CASCADE;
DROP TYPE IF EXISTS joki_status CASCADE;

-- ============ ENUM TYPES ============
CREATE TYPE transaction_status AS ENUM ('pending', 'done', 'cancelled');
CREATE TYPE detail_type AS ENUM ('item', 'set');
CREATE TYPE joki_status AS ENUM ('pending', 'in_progress', 'done', 'cancelled');

-- ============ ITEMS ============
CREATE TABLE items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  send_quantity INTEGER NOT NULL DEFAULT 1,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ SETS ============
CREATE TABLE sets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE set_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  UNIQUE(set_id, item_id)
);

-- ============ TRANSACTIONS ============
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_name VARCHAR(255) NOT NULL,
  status transaction_status NOT NULL DEFAULT 'pending',
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transaction_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  type detail_type NOT NULL,
  ref_id UUID NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC(12,2) NOT NULL
);

CREATE TABLE transaction_item_breakdown (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_detail_id UUID NOT NULL REFERENCES transaction_details(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);

-- ============ JOKI ============
CREATE TABLE joki_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE joki_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  joki_service_id UUID NOT NULL REFERENCES joki_services(id),
  customer_name VARCHAR(255) NOT NULL,
  game_username VARCHAR(255) NOT NULL,
  game_password VARCHAR(255) NOT NULL,
  tiktok_usn VARCHAR(255) NOT NULL,
  status joki_status NOT NULL DEFAULT 'pending',
  price NUMERIC(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ INDEXES ============
CREATE INDEX idx_set_items_set_id ON set_items(set_id);
CREATE INDEX idx_set_items_item_id ON set_items(item_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transaction_details_txn_id ON transaction_details(transaction_id);
CREATE INDEX idx_breakdown_detail_id ON transaction_item_breakdown(transaction_detail_id);
CREATE INDEX idx_joki_orders_status ON joki_orders(status);
CREATE INDEX idx_joki_orders_service ON joki_orders(joki_service_id);

-- ============ RPC: CREATE TRANSACTION (Atomic) ============
-- p_items format: [{ type, ref_id, quantity, price, send_amount? }]
-- For type='item': send_amount = actual units sent (stock deducted = quantity * send_amount)
-- For type='set': stock deducted per set_item = quantity * set_item.qty_in_set
CREATE OR REPLACE FUNCTION create_transaction(
  p_buyer_name TEXT,
  p_items JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_txn_id UUID;
  v_total_price NUMERIC := 0;
  v_item_needs JSONB := '{}'::JSONB;
  v_detail JSONB;
  v_detail_id UUID;
  v_item RECORD;
  v_set RECORD;
  v_set_item RECORD;
  v_price NUMERIC;
  v_qty INT;
  v_send INT;
  v_needed INT;
  v_key TEXT;
  v_current INT;
  i INT;
BEGIN
  -- ======= PASS 1: Aggregate item needs & lock rows =======
  FOR i IN 0..jsonb_array_length(p_items) - 1
  LOOP
    v_detail := p_items->i;
    v_qty := (v_detail->>'quantity')::INT;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity harus lebih dari 0';
    END IF;

    IF (v_detail->>'type') = 'item' THEN
      v_key := v_detail->>'ref_id';

      -- Lock the item row
      SELECT * INTO v_item FROM items WHERE id = v_key::UUID FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Item tidak ditemukan: %', v_key;
      END IF;

      -- send_amount: how many units per purchase (default to item.send_quantity)
      v_send := COALESCE((v_detail->>'send_amount')::INT, v_item.send_quantity, 1);

      v_price := COALESCE((v_detail->>'price')::NUMERIC, v_item.price);
      v_total_price := v_total_price + (v_price * v_qty);

      -- Stock needed = purchase qty * units per purchase
      v_needed := v_qty * v_send;
      v_current := COALESCE((v_item_needs->>v_key)::INT, 0);
      v_item_needs := jsonb_set(v_item_needs, ARRAY[v_key], to_jsonb(v_current + v_needed));

    ELSIF (v_detail->>'type') = 'set' THEN
      SELECT * INTO v_set FROM sets WHERE id = (v_detail->>'ref_id')::UUID;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Set tidak ditemukan: %', v_detail->>'ref_id';
      END IF;

      v_price := COALESCE((v_detail->>'price')::NUMERIC, v_set.price);
      v_total_price := v_total_price + (v_price * v_qty);

      -- Lock set items
      FOR v_set_item IN
        SELECT si.item_id, si.quantity as qty_in_set
        FROM set_items si
        JOIN items it ON it.id = si.item_id
        WHERE si.set_id = v_set.id
        FOR UPDATE OF it
      LOOP
        v_key := v_set_item.item_id::TEXT;
        v_needed := v_qty * v_set_item.qty_in_set;
        v_current := COALESCE((v_item_needs->>v_key)::INT, 0);
        v_item_needs := jsonb_set(v_item_needs, ARRAY[v_key], to_jsonb(v_current + v_needed));
      END LOOP;
    ELSE
      RAISE EXCEPTION 'Type tidak valid: %. Gunakan "item" atau "set"', v_detail->>'type';
    END IF;
  END LOOP;

  -- ======= PASS 2: Validate all stock =======
  FOR v_item IN
    SELECT i.id, i.name, i.stock, (v_item_needs->>i.id::TEXT)::INT as needed
    FROM items i
    WHERE i.id::TEXT IN (SELECT jsonb_object_keys(v_item_needs))
  LOOP
    IF v_item.stock < v_item.needed THEN
      RAISE EXCEPTION 'Stok tidak cukup untuk "%". Butuh %, tersedia %',
        v_item.name, v_item.needed, v_item.stock;
    END IF;
  END LOOP;

  -- ======= PASS 3: Deduct stock =======
  FOR v_key IN SELECT jsonb_object_keys(v_item_needs)
  LOOP
    UPDATE items SET stock = stock - (v_item_needs->>v_key)::INT
    WHERE id = v_key::UUID;
  END LOOP;

  -- ======= PASS 4: Create transaction record =======
  INSERT INTO transactions (buyer_name, total_price)
  VALUES (p_buyer_name, v_total_price)
  RETURNING id INTO v_txn_id;

  -- ======= PASS 5: Create details & breakdown =======
  FOR i IN 0..jsonb_array_length(p_items) - 1
  LOOP
    v_detail := p_items->i;
    v_qty := (v_detail->>'quantity')::INT;

    IF (v_detail->>'type') = 'item' THEN
      SELECT price, send_quantity INTO v_price, v_send FROM items WHERE id = (v_detail->>'ref_id')::UUID;
      v_price := COALESCE((v_detail->>'price')::NUMERIC, v_price);
      v_send := COALESCE((v_detail->>'send_amount')::INT, v_send, 1);

      INSERT INTO transaction_details (transaction_id, type, ref_id, quantity, price)
      VALUES (v_txn_id, 'item', (v_detail->>'ref_id')::UUID, v_qty, v_price)
      RETURNING id INTO v_detail_id;

      -- Breakdown uses actual units consumed (qty * send_amount)
      INSERT INTO transaction_item_breakdown (transaction_detail_id, item_id, quantity)
      VALUES (v_detail_id, (v_detail->>'ref_id')::UUID, v_qty * v_send);

    ELSIF (v_detail->>'type') = 'set' THEN
      SELECT price INTO v_price FROM sets WHERE id = (v_detail->>'ref_id')::UUID;
      v_price := COALESCE((v_detail->>'price')::NUMERIC, v_price);

      INSERT INTO transaction_details (transaction_id, type, ref_id, quantity, price)
      VALUES (v_txn_id, 'set', (v_detail->>'ref_id')::UUID, v_qty, v_price)
      RETURNING id INTO v_detail_id;

      INSERT INTO transaction_item_breakdown (transaction_detail_id, item_id, quantity)
      SELECT v_detail_id, si.item_id, v_qty * si.quantity
      FROM set_items si
      WHERE si.set_id = (v_detail->>'ref_id')::UUID;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_txn_id,
    'buyer_name', p_buyer_name,
    'total_price', v_total_price,
    'status', 'pending',
    'created_at', NOW()
  );
END;
$$;

-- ============ RPC: CANCEL TRANSACTION (Atomic) ============
CREATE OR REPLACE FUNCTION cancel_transaction(p_txn_id UUID) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_txn RECORD;
  v_breakdown RECORD;
BEGIN
  -- Lock transaction
  SELECT * INTO v_txn FROM transactions WHERE id = p_txn_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan';
  END IF;

  IF v_txn.status != 'pending' THEN
    RAISE EXCEPTION 'Hanya transaksi pending yang bisa di-cancel';
  END IF;

  -- Restore stock from breakdown
  FOR v_breakdown IN
    SELECT tib.item_id, SUM(tib.quantity)::INT as total_qty
    FROM transaction_item_breakdown tib
    JOIN transaction_details td ON td.id = tib.transaction_detail_id
    WHERE td.transaction_id = p_txn_id
    GROUP BY tib.item_id
  LOOP
    UPDATE items SET stock = stock + v_breakdown.total_qty
    WHERE id = v_breakdown.item_id;
  END LOOP;

  -- Update status
  UPDATE transactions SET status = 'cancelled' WHERE id = p_txn_id;

  RETURN jsonb_build_object(
    'id', p_txn_id,
    'buyer_name', v_txn.buyer_name,
    'total_price', v_txn.total_price,
    'status', 'cancelled',
    'created_at', v_txn.created_at
  );
END;
$$;

-- ============ PERMISSIONS ============
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_transaction TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_transaction TO anon, authenticated;
