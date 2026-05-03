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
      cashbox_logs: {
        Row: {
          amount: number;
          created_at: string;
          employee_id: string;
          id: string;
          reason: string;
          shift_id: string | null;
          type: string;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          employee_id: string;
          id?: string;
          reason: string;
          shift_id?: string | null;
          type: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          employee_id?: string;
          id?: string;
          reason?: string;
          shift_id?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cashbox_logs_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "active_cashier_sessions";
            referencedColumns: ["employee_id"];
          },
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
      daily_logs: {
        Row: {
          card_sales: number;
          cash_sales: number;
          closed_by: string | null;
          created_at: string;
          discount_amount: number;
          id: string;
          log_date: string;
          net_profit: number;
          notes: string | null;
          refund_amount: number;
          refund_count: number;
          stock_loss: number;
          total_sales: number;
          transaction_count: number;
          vat_amount: number;
        };
        Insert: {
          card_sales?: number;
          cash_sales?: number;
          closed_by?: string | null;
          created_at?: string;
          discount_amount?: number;
          id?: string;
          log_date: string;
          net_profit?: number;
          notes?: string | null;
          refund_amount?: number;
          refund_count?: number;
          stock_loss?: number;
          total_sales?: number;
          transaction_count?: number;
          vat_amount?: number;
        };
        Update: {
          card_sales?: number;
          cash_sales?: number;
          closed_by?: string | null;
          created_at?: string;
          discount_amount?: number;
          id?: string;
          log_date?: string;
          net_profit?: number;
          notes?: string | null;
          refund_amount?: number;
          refund_count?: number;
          stock_loss?: number;
          total_sales?: number;
          transaction_count?: number;
          vat_amount?: number;
        };
        Relationships: [];
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
      item_withdrawals: {
        Row: {
          created_at: string;
          id: string;
          note: string | null;
          performed_by: string | null;
          product_id: string;
          quantity: number;
          total_cost: number | null;
          type: Database["public"]["Enums"]["withdrawal_type"];
          unit_cost: number | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          note?: string | null;
          performed_by?: string | null;
          product_id: string;
          quantity: number;
          total_cost?: number | null;
          type: Database["public"]["Enums"]["withdrawal_type"];
          unit_cost?: number | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          note?: string | null;
          performed_by?: string | null;
          product_id?: string;
          quantity?: number;
          total_cost?: number | null;
          type?: Database["public"]["Enums"]["withdrawal_type"];
          unit_cost?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "item_withdrawals_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      monthly_logs: {
        Row: {
          card_sales: number;
          cash_sales: number;
          closed_by: string | null;
          created_at: string;
          discount_amount: number;
          id: string;
          log_month: number;
          log_year: number;
          net_profit: number;
          notes: string | null;
          refund_amount: number;
          refund_count: number;
          stock_loss: number;
          total_sales: number;
          transaction_count: number;
          vat_amount: number;
        };
        Insert: {
          card_sales?: number;
          cash_sales?: number;
          closed_by?: string | null;
          created_at?: string;
          discount_amount?: number;
          id?: string;
          log_month: number;
          log_year: number;
          net_profit?: number;
          notes?: string | null;
          refund_amount?: number;
          refund_count?: number;
          stock_loss?: number;
          total_sales?: number;
          transaction_count?: number;
          vat_amount?: number;
        };
        Update: {
          card_sales?: number;
          cash_sales?: number;
          closed_by?: string | null;
          created_at?: string;
          discount_amount?: number;
          id?: string;
          log_month?: number;
          log_year?: number;
          net_profit?: number;
          notes?: string | null;
          refund_amount?: number;
          refund_count?: number;
          stock_loss?: number;
          total_sales?: number;
          transaction_count?: number;
          vat_amount?: number;
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
      session_access: {
        Row: {
          email: string;
          full_name: string | null;
          granted_at: string | null;
          granted_by: string | null;
          id: string;
          is_active: boolean;
          notes: string | null;
          requested_at: string | null;
          revoked_at: string | null;
          user_id: string;
        };
        Insert: {
          email: string;
          full_name?: string | null;
          granted_at?: string | null;
          granted_by?: string | null;
          id?: string;
          is_active?: boolean;
          notes?: string | null;
          requested_at?: string | null;
          revoked_at?: string | null;
          user_id: string;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          granted_at?: string | null;
          granted_by?: string | null;
          id?: string;
          is_active?: boolean;
          notes?: string | null;
          requested_at?: string | null;
          revoked_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      shifts: {
        Row: {
          cash_difference: number | null;
          clock_in: string;
          clock_out: string | null;
          created_at: string;
          employee_id: string;
          ending_cash: number | null;
          expected_cash: number | null;
          id: string;
          notes: string | null;
          starting_cash: number | null;
        };
        Insert: {
          cash_difference?: number | null;
          clock_in?: string;
          clock_out?: string | null;
          created_at?: string;
          employee_id: string;
          ending_cash?: number | null;
          expected_cash?: number | null;
          id?: string;
          notes?: string | null;
          starting_cash?: number | null;
        };
        Update: {
          cash_difference?: number | null;
          clock_in?: string;
          clock_out?: string | null;
          created_at?: string;
          employee_id?: string;
          ending_cash?: number | null;
          expected_cash?: number | null;
          id?: string;
          notes?: string | null;
          starting_cash?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "shifts_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "active_cashier_sessions";
            referencedColumns: ["employee_id"];
          },
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
        Relationships: [];
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
      active_cashier_sessions: {
        Row: {
          email: string | null;
          employee_id: string | null;
          employee_name: string | null;
          full_name: string | null;
          granted_at: string | null;
          id: string | null;
          is_active: boolean | null;
          requested_at: string | null;
          revoked_at: string | null;
          role: Database["public"]["Enums"]["app_role"] | null;
          user_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_employee_on_access_grant: {
        Args: { target_email: string; target_user_id: string };
        Returns: undefined;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      revoke_session_access: {
        Args: { target_user_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "admin" | "cashier" | "store_clerk";
      employee_role: "cashier" | "admin" | "stock_clerk";
      payment_method: "cash" | "card";
      transaction_status: "completed" | "refunded" | "voided";
      withdrawal_type: "OWNER_WITHDRAWAL" | "STAFF_WITHDRAWAL" | "DAMAGE";
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
      employee_role: ["cashier", "admin", "stock_clerk"],
      payment_method: ["cash", "card"],
      transaction_status: ["completed", "refunded", "voided"],
      withdrawal_type: ["OWNER_WITHDRAWAL", "STAFF_WITHDRAWAL", "DAMAGE"],
    },
  },
} as const;
