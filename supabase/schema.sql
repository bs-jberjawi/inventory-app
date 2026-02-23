-- ============================================================
-- Inventory Management System - Supabase Schema
-- Run this in Supabase SQL Editor to set up the database
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================
CREATE TYPE stock_status AS ENUM ('in_stock', 'low_stock', 'out_of_stock', 'ordered', 'discontinued');
CREATE TYPE movement_type AS ENUM ('inbound', 'outbound', 'adjustment');
CREATE TYPE notification_type AS ENUM ('low_stock', 'system', 'stock_change');

-- ============================================================
-- 2. TABLES
-- ============================================================

-- Profiles (auto-created on signup via trigger)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  description TEXT,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER NOT NULL DEFAULT 10,
  status stock_status NOT NULL DEFAULT 'in_stock',
  image_url TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Movements (audit log)
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity_change INTEGER NOT NULL,
  movement_type movement_type NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  type notification_type NOT NULL DEFAULT 'system',
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('english', name));
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at DESC);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);

-- ============================================================
-- 4. FUNCTIONS
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Auto-update product status + create notification on quantity change
CREATE OR REPLACE FUNCTION handle_product_stock_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update status based on quantity
  IF NEW.quantity <= 0 THEN
    NEW.status := 'out_of_stock';
    -- Create notification for out of stock
    INSERT INTO notifications (user_id, title, message, type, product_id)
    VALUES (
      NULL,
      'Out of Stock',
      format('%s (SKU: %s) is now out of stock!', NEW.name, NEW.sku),
      'low_stock',
      NEW.id
    );
  ELSIF NEW.quantity <= NEW.min_stock_level THEN
    NEW.status := 'low_stock';
    -- Create notification for all admins/managers (user_id NULL = broadcast)
    INSERT INTO notifications (user_id, title, message, type, product_id)
    VALUES (
      NULL,
      'Low Stock Alert',
      format('%s (SKU: %s) is low on stock. Current: %s, Minimum: %s', NEW.name, NEW.sku, NEW.quantity, NEW.min_stock_level),
      'low_stock',
      NEW.id
    );
  ELSE
    -- Only auto-set to in_stock if it was low_stock/out_of_stock (preserve ordered/discontinued)
    IF OLD.status IN ('low_stock', 'out_of_stock') THEN
      NEW.status := 'in_stock';
    END IF;
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get low stock items (used by AI agent)
CREATE OR REPLACE FUNCTION get_low_stock_items()
RETURNS SETOF products AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM products
  WHERE quantity <= min_stock_level AND status != 'discontinued'
  ORDER BY (quantity::float / GREATEST(min_stock_level, 1)) ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get dashboard stats
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE (
  total_products BIGINT,
  low_stock_count BIGINT,
  total_value DECIMAL,
  total_categories BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM products)::BIGINT AS total_products,
    (SELECT COUNT(*) FROM products WHERE quantity <= min_stock_level AND status != 'discontinued')::BIGINT AS low_stock_count,
    (SELECT COALESCE(SUM(quantity * unit_price), 0) FROM products) AS total_value,
    (SELECT COUNT(*) FROM categories)::BIGINT AS total_categories;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. TRIGGERS
-- ============================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER on_product_stock_change
  BEFORE UPDATE OF quantity, min_stock_level ON products
  FOR EACH ROW
  EXECUTE FUNCTION handle_product_stock_change();

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role from app_metadata
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    (SELECT auth.jwt()->'app_metadata'->>'role'),
    'viewer'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- PROFILES
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id);

-- CATEGORIES (everyone reads, admin/manager modify)
CREATE POLICY "All can read categories"
  ON categories FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/Manager can insert categories"
  ON categories FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'manager'));

CREATE POLICY "Admin/Manager can update categories"
  ON categories FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'manager'));

CREATE POLICY "Admin can delete categories"
  ON categories FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) = 'admin');

-- PRODUCTS (everyone reads, admin/manager modify, admin deletes)
CREATE POLICY "All can read products"
  ON products FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/Manager can insert products"
  ON products FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'manager'));

CREATE POLICY "Admin/Manager can update products"
  ON products FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'manager'));

CREATE POLICY "Admin can delete products"
  ON products FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) = 'admin');

-- STOCK MOVEMENTS (everyone reads, admin/manager create)
CREATE POLICY "All can read movements"
  ON stock_movements FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/Manager can insert movements"
  ON stock_movements FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'manager'));

-- NOTIFICATIONS (users see their own + broadcasts)
CREATE POLICY "Users see own + broadcast notifications"
  ON notifications FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = (SELECT auth.uid()));

CREATE POLICY "Users can mark own notifications read"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id IS NULL OR user_id = (SELECT auth.uid()));

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- 7. REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================================
-- 8. SEED DATA
-- ============================================================

-- Categories
INSERT INTO categories (id, name, description, color) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Electronics', 'Electronic devices and accessories', '#3b82f6'),
  ('c1000000-0000-0000-0000-000000000002', 'Furniture', 'Office and warehouse furniture', '#f59e0b'),
  ('c1000000-0000-0000-0000-000000000003', 'Office Supplies', 'Pens, paper, stationery', '#10b981'),
  ('c1000000-0000-0000-0000-000000000004', 'Safety Equipment', 'PPE, fire extinguishers, first aid', '#ef4444'),
  ('c1000000-0000-0000-0000-000000000005', 'Raw Materials', 'Manufacturing inputs and components', '#8b5cf6'),
  ('c1000000-0000-0000-0000-000000000006', 'Packaging', 'Boxes, tape, wrapping supplies', '#ec4899');

-- Products
INSERT INTO products (name, sku, description, category_id, unit_price, quantity, min_stock_level, status) VALUES
  -- Electronics
  ('Laptop Dell XPS 15', 'ELEC-001', 'High-performance laptop for development team', 'c1000000-0000-0000-0000-000000000001', 1299.99, 15, 5, 'in_stock'),
  ('Wireless Mouse Logitech MX', 'ELEC-002', 'Ergonomic wireless mouse', 'c1000000-0000-0000-0000-000000000001', 79.99, 42, 20, 'in_stock'),
  ('USB-C Hub 7-in-1', 'ELEC-003', 'Multi-port USB-C adapter', 'c1000000-0000-0000-0000-000000000001', 45.99, 8, 15, 'low_stock'),
  ('Monitor 27" 4K', 'ELEC-004', 'LG 27" UHD IPS Monitor', 'c1000000-0000-0000-0000-000000000001', 449.99, 22, 10, 'in_stock'),
  ('Mechanical Keyboard', 'ELEC-005', 'Cherry MX Brown switches', 'c1000000-0000-0000-0000-000000000001', 129.99, 3, 10, 'low_stock'),
  -- Furniture
  ('Standing Desk Frame', 'FURN-001', 'Electric height-adjustable desk frame', 'c1000000-0000-0000-0000-000000000002', 399.99, 7, 5, 'in_stock'),
  ('Ergonomic Office Chair', 'FURN-002', 'Herman Miller style mesh chair', 'c1000000-0000-0000-0000-000000000002', 549.99, 12, 8, 'in_stock'),
  ('Filing Cabinet 3-Drawer', 'FURN-003', 'Lockable steel cabinet', 'c1000000-0000-0000-0000-000000000002', 189.99, 2, 5, 'low_stock'),
  ('Whiteboard 6x4ft', 'FURN-004', 'Magnetic dry-erase whiteboard', 'c1000000-0000-0000-0000-000000000002', 129.99, 18, 5, 'in_stock'),
  -- Office Supplies
  ('A4 Copy Paper (Ream)', 'OFFC-001', '500 sheets, 80gsm', 'c1000000-0000-0000-0000-000000000003', 8.99, 150, 50, 'in_stock'),
  ('Ballpoint Pens (Box 50)', 'OFFC-002', 'Blue ink, medium point', 'c1000000-0000-0000-0000-000000000003', 14.99, 35, 20, 'in_stock'),
  ('Sticky Notes Assorted', 'OFFC-003', '3x3 inch, 12-pack', 'c1000000-0000-0000-0000-000000000003', 9.99, 60, 25, 'in_stock'),
  ('Toner Cartridge HP 58A', 'OFFC-004', 'Black toner for LaserJet', 'c1000000-0000-0000-0000-000000000003', 89.99, 4, 8, 'low_stock'),
  -- Safety Equipment
  ('Hard Hat (Yellow)', 'SAFE-001', 'OSHA compliant, adjustable', 'c1000000-0000-0000-0000-000000000004', 24.99, 30, 15, 'in_stock'),
  ('Safety Goggles', 'SAFE-002', 'Anti-fog, UV protection', 'c1000000-0000-0000-0000-000000000004', 12.99, 45, 20, 'in_stock'),
  ('First Aid Kit', 'SAFE-003', '100-piece workplace kit', 'c1000000-0000-0000-0000-000000000004', 34.99, 6, 10, 'low_stock'),
  ('Fire Extinguisher 5lb', 'SAFE-004', 'ABC dry chemical', 'c1000000-0000-0000-0000-000000000004', 49.99, 20, 10, 'in_stock'),
  -- Raw Materials
  ('Steel Sheet 4x8ft', 'RAW-001', '16-gauge cold rolled steel', 'c1000000-0000-0000-0000-000000000005', 85.00, 50, 20, 'in_stock'),
  ('Aluminum Extrusion Bar', 'RAW-002', '6061-T6, 10ft length', 'c1000000-0000-0000-0000-000000000005', 32.00, 75, 30, 'in_stock'),
  ('Copper Wire Spool', 'RAW-003', '12 AWG, 500ft', 'c1000000-0000-0000-0000-000000000005', 120.00, 10, 15, 'low_stock'),
  ('Rubber Gasket Sheets', 'RAW-004', '1/8" thick, neoprene', 'c1000000-0000-0000-0000-000000000005', 18.50, 40, 20, 'in_stock'),
  -- Packaging
  ('Corrugated Box 18x14x12', 'PACK-001', 'Standard shipping box', 'c1000000-0000-0000-0000-000000000006', 2.50, 200, 100, 'in_stock'),
  ('Bubble Wrap Roll 12x175ft', 'PACK-002', 'Small bubble, perforated', 'c1000000-0000-0000-0000-000000000006', 29.99, 15, 10, 'in_stock'),
  ('Packing Tape (6-pack)', 'PACK-003', 'Heavy duty, 2 inch', 'c1000000-0000-0000-0000-000000000006', 18.99, 5, 12, 'low_stock'),
  ('Shipping Labels (Roll 500)', 'PACK-004', 'Direct thermal 4x6', 'c1000000-0000-0000-0000-000000000006', 22.50, 8, 10, 'low_stock');

-- Stock Movements (recent history for AI analysis)
-- Generate realistic movement data for the past 30 days
DO $$
DECLARE
  prod RECORD;
  day_offset INTEGER;
  move_type movement_type;
  qty INTEGER;
BEGIN
  FOR prod IN SELECT id, name, quantity FROM products LOOP
    FOR day_offset IN 1..30 LOOP
      -- Create inbound/outbound movements randomly
      IF random() > 0.6 THEN
        IF random() > 0.4 THEN
          move_type := 'outbound';
          qty := -1 * (floor(random() * 5) + 1)::INTEGER;
        ELSE
          move_type := 'inbound';
          qty := (floor(random() * 10) + 1)::INTEGER;
        END IF;
        
        INSERT INTO stock_movements (product_id, quantity_change, movement_type, notes, created_at)
        VALUES (
          prod.id,
          qty,
          move_type,
          CASE move_type
            WHEN 'inbound' THEN 'Supplier delivery'
            WHEN 'outbound' THEN 'Order fulfillment'
            ELSE 'Inventory adjustment'
          END,
          NOW() - (day_offset || ' days')::INTERVAL + (floor(random() * 8 + 8) || ' hours')::INTERVAL
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;
