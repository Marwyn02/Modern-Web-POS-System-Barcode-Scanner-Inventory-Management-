export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      session_access: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          full_name: string | null;
          is_active: boolean;
          requested_at: string | null;
          granted_at: string | null;
          revoked_at: string | null;
          granted_by: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          full_name?: string | null;
          is_active?: boolean;
          requested_at?: string | null;
          granted_at?: string | null;
          revoked_at?: string | null;
          granted_by?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string;
          full_name?: string | null;
          is_active?: boolean;
          requested_at?: string | null;
          granted_at?: string | null;
          revoked_at?: string | null;
          granted_by?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "session_access_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_access_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      disposed_items: {
        Row: {
          created_at: string | null;
          disposed_at: string | null;
          disposed_by: string | null;
          id: string;
          product_id: string | null;
          quantity: number;
          reason: string | null;
          total_loss: number | null;
          unit_cost: number | null;
        };
        Insert: {
          created_at?: string | null;
          disposed_at?: string | null;
          disposed_by?: string | null;
          id?: string;
          product_id?: string | null;
          quantity?: number;
          reason?: string | null;
          total_loss?: number | null;
          unit_cost?: number | null;
        };
        Update: {
          created_at?: string | null;
          disposed_at?: string | null;
          disposed_by?: string | null;
          id?: string;
          product_id?: string | null;
          quantity?: number;
          reason?: string | null;
          total_loss?: number | null;
          unit_cost?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "disposed_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      employees: {
        Row: {
          created_at: string;
          email: string | null;
          hourly_rate: number | null;
          id: string;
          is_active: boolean | null;
          name: string;
          phone: string | null;
          role: Database["public"]["Enums"]["employee_role"];
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          hourly_rate?: number | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["employee_role"];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          hourly_rate?: number | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["employee_role"];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      products: {
        Row: {
          barcode: string | null;
          category_id: string | null;
          cost_price: number | null;
          created_at: string;
          discount_percentage: number | null;
          discount_reason: string | null;
          expiry_date: string | null;
          id: string;
          is_active: boolean | null;
          low_stock_threshold: number;
          name: string;
          price: number;
          sku: string | null;
          stock_quantity: number;
          unit: string | null;
          updated_at: string;
        };
        Insert: {
          barcode?: string | null;
          category_id?: string | null;
          cost_price?: number | null;
          created_at?: string;
          discount_percentage?: number | null;
          discount_reason?: string | null;
          expiry_date?: string | null;
          id?: string;
          is_active?: boolean | null;
          low_stock_threshold?: number;
          name: string;
          price?: number;
          sku?: string | null;
          stock_quantity?: number;
          unit?: string | null;
          updated_at?: string;
        };
        Update: {
          barcode?: string | null;
          category_id?: string | null;
          cost_price?: number | null;
          created_at?: string;
          discount_percentage?: number | null;
          discount_reason?: string | null;
          expiry_date?: string | null;
          id?: string;
          is_active?: boolean | null;
          low_stock_threshold?: number;
          name?: string;
          price?: number;
          sku?: string | null;
          stock_quantity?: number;
          unit?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      shifts: {
        Row: {
          id: string;
          employee_id: string;
          clock_in: string;
          clock_out: string | null;
          created_at: string;
          starting_cash: number | null;
          ending_cash: number | null;
          expected_cash: number | null;
          cash_difference: number | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          employee_id: string;
          clock_in?: string;
          clock_out?: string | null;
          created_at?: string;
          starting_cash?: number | null;
          ending_cash?: number | null;
          expected_cash?: number | null;
          cash_difference?: number | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          employee_id?: string;
          clock_in?: string;
          clock_out?: string | null;
          created_at?: string;
          starting_cash?: number | null;
          ending_cash?: number | null;
          expected_cash?: number | null;
          cash_difference?: number | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "shifts_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      transaction_items: {
        Row: {
          created_at: string;
          id: string;
          product_id: string | null;
          quantity: number;
          subtotal: number;
          transaction_id: string;
          unit_price: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          product_id?: string | null;
          quantity?: number;
          subtotal?: number;
          transaction_id: string;
          unit_price?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          product_id?: string | null;
          quantity?: number;
          subtotal?: number;
          transaction_id?: string;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "transaction_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      cashbox_logs: {
        Row: {
          id: string;
          employee_id: string;
          shift_id: string | null;
          type: "cash_in" | "cash_out";
          amount: number;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          shift_id?: string | null;
          type: "cash_in" | "cash_out";
          amount?: number;
          reason: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          shift_id?: string | null;
          type?: "cash_in" | "cash_out";
          amount?: number;
          reason?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cashbox_logs_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cashbox_logs_shift_id_fkey";
            columns: ["shift_id"];
            isOneToOne: false;
            referencedRelation: "shifts";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_logs: {
        Row: {
          id: string;
          log_date: string;
          total_sales: number;
          transaction_count: number;
          vat_amount: number;
          discount_amount: number;
          refund_amount: number;
          refund_count: number;
          cash_sales: number;
          card_sales: number;
          stock_loss: number;
          net_profit: number;
          closed_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          log_date: string;
          total_sales?: number;
          transaction_count?: number;
          vat_amount?: number;
          discount_amount?: number;
          refund_amount?: number;
          refund_count?: number;
          cash_sales?: number;
          card_sales?: number;
          stock_loss?: number;
          net_profit?: number;
          closed_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          log_date?: string;
          total_sales?: number;
          transaction_count?: number;
          vat_amount?: number;
          discount_amount?: number;
          refund_amount?: number;
          refund_count?: number;
          cash_sales?: number;
          card_sales?: number;
          stock_loss?: number;
          net_profit?: number;
          closed_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_logs_closed_by_fkey";
            columns: ["closed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      monthly_logs: {
        Row: {
          id: string;
          log_year: number;
          log_month: number;
          total_sales: number;
          transaction_count: number;
          vat_amount: number;
          discount_amount: number;
          refund_amount: number;
          refund_count: number;
          cash_sales: number;
          card_sales: number;
          stock_loss: number;
          net_profit: number;
          closed_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          log_year: number;
          log_month: number;
          total_sales?: number;
          transaction_count?: number;
          vat_amount?: number;
          discount_amount?: number;
          refund_amount?: number;
          refund_count?: number;
          cash_sales?: number;
          card_sales?: number;
          stock_loss?: number;
          net_profit?: number;
          closed_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          log_year?: number;
          log_month?: number;
          total_sales?: number;
          transaction_count?: number;
          vat_amount?: number;
          discount_amount?: number;
          refund_amount?: number;
          refund_count?: number;
          cash_sales?: number;
          card_sales?: number;
          stock_loss?: number;
          net_profit?: number;
          closed_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "monthly_logs_closed_by_fkey";
            columns: ["closed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          cash_tendered: number | null;
          change_amount: number | null;
          created_at: string;
          customer_id_number: string | null;
          discount_amount: number | null;
          discount_type: string | null;
          employee_id: string | null;
          id: string;
          original_amount: number | null;
          payment_method: Database["public"]["Enums"]["payment_method"];
          status: Database["public"]["Enums"]["transaction_status"];
          total_amount: number;
          vat_amount: number;
        };
        Insert: {
          cash_tendered?: number | null;
          change_amount?: number | null;
          created_at?: string;
          customer_id_number?: string | null;
          discount_amount?: number | null;
          discount_type?: string | null;
          employee_id?: string | null;
          id?: string;
          original_amount?: number | null;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          status?: Database["public"]["Enums"]["transaction_status"];
          total_amount?: number;
          vat_amount?: number;
        };
        Update: {
          cash_tendered?: number | null;
          change_amount?: number | null;
          created_at?: string;
          customer_id_number?: string | null;
          discount_amount?: number | null;
          discount_type?: string | null;
          employee_id?: string | null;
          id?: string;
          original_amount?: number | null;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          status?: Database["public"]["Enums"]["transaction_status"];
          total_amount?: number;
          vat_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "cashier" | "store_clerk";
      employee_role: "cashier" | "admin" | "stock_clerk";
      payment_method: "cash" | "card";
      transaction_status: "completed" | "refunded" | "voided";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "cashier", "store_clerk"],
      employee_role: ["cashier", "manager", "stock_clerk"],
      payment_method: ["cash", "card"],
      transaction_status: ["completed", "refunded", "voided"],
    },
  },
} as const;
