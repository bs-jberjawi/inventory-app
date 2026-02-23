export type UserRole = "admin" | "manager" | "viewer";
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "ordered" | "discontinued";
export type MovementType = "inbound" | "outbound" | "adjustment";
export type NotificationType = "low_stock" | "system" | "stock_change";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  category_id: string;
  unit_price: number;
  quantity: number;
  min_stock_level: number;
  status: StockStatus;
  image_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  category?: Category;
}

export interface StockMovement {
  id: string;
  product_id: string;
  quantity_change: number;
  movement_type: MovementType;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  // Joined fields
  product?: Product;
  profile?: Profile;
}

export interface Notification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  read: boolean;
  type: NotificationType;
  product_id: string | null;
  created_at: string;
}

// Converts interface types to plain object types so they satisfy Record<string, unknown>
// (interfaces lack implicit index signatures due to declaration merging)
type Row<T> = { [K in keyof T]: T[K] };

// Supabase Database type for client generation
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Row<Profile>;
        Insert: Row<
          Omit<Profile, "created_at" | "updated_at" | "full_name" | "avatar_url"> & {
            full_name?: string | null;
            avatar_url?: string | null;
          }
        >;
        Update: Row<Partial<Omit<Profile, "id" | "created_at">>>;
        Relationships: [];
      };
      categories: {
        Row: Row<Category>;
        Insert: Row<Omit<Category, "id" | "created_at">>;
        Update: Row<Partial<Omit<Category, "id" | "created_at">>>;
        Relationships: [];
      };
      products: {
        Row: Row<Product>;
        Insert: Row<
          Omit<Product, "id" | "created_at" | "updated_at" | "category" | "description" | "image_url" | "created_by" | "status"> & {
            description?: string | null;
            image_url?: string | null;
            created_by?: string | null;
            status?: StockStatus;
          }
        >;
        Update: Row<Partial<Omit<Product, "id" | "created_at" | "updated_at" | "category">>>;
        Relationships: [];
      };
      stock_movements: {
        Row: Row<StockMovement>;
        Insert: Row<
          Omit<StockMovement, "id" | "created_at" | "product" | "profile" | "notes" | "created_by"> & {
            notes?: string | null;
            created_by?: string | null;
          }
        >;
        Update: Row<Partial<Omit<StockMovement, "id" | "created_at" | "product" | "profile">>>;
        Relationships: [];
      };
      notifications: {
        Row: Row<Notification>;
        Insert: Row<
          Omit<Notification, "id" | "created_at" | "user_id" | "product_id"> & {
            user_id?: string | null;
            product_id?: string | null;
          }
        >;
        Update: Row<Partial<Omit<Notification, "id" | "created_at">>>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never
    };
    Functions: {
      get_low_stock_items: {
        Args: Record<string, never>;
        Returns: Product[];
      };
      get_dashboard_stats: {
        Args: Record<string, never>;
        Returns: {
          total_products: number;
          low_stock_count: number;
          total_value: number;
          total_categories: number;
        }[];
      };
    };
    Enums: {
      stock_status: StockStatus;
      movement_type: MovementType;
      notification_type: NotificationType;
    };
  };
}
