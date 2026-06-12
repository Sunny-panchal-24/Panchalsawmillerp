export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bank_accounts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          opening_balance: number
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          opening_balance?: number
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          opening_balance?: number
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          company_name: string
          created_at: string
          id: string
          mobile: string | null
          opening_cash: number
          owner_id: string
          owner_name: string
          setup_completed: boolean
          updated_at: string
          village: string | null
        }
        Insert: {
          company_name: string
          created_at?: string
          id?: string
          mobile?: string | null
          opening_cash?: number
          owner_id: string
          owner_name: string
          setup_completed?: boolean
          updated_at?: string
          village?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          id?: string
          mobile?: string | null
          opening_cash?: number
          owner_id?: string
          owner_name?: string
          setup_completed?: boolean
          updated_at?: string
          village?: string | null
        }
        Relationships: []
      }
      customer_receipts: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string
          customer_id: string
          id: string
          mode: string
          receipt_date: string
          remarks: string | null
          sale_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          id?: string
          mode?: string
          receipt_date?: string
          remarks?: string | null
          sale_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          id?: string
          mode?: string
          receipt_date?: string
          remarks?: string | null
          sale_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_receipts_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_receipts_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string
          gstin: string | null
          id: string
          mobile: string | null
          name: string
          notes: string | null
          opening_balance: number
          type: Database["public"]["Enums"]["customer_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string
          gstin?: string | null
          id?: string
          mobile?: string | null
          name: string
          notes?: string | null
          opening_balance?: number
          type?: Database["public"]["Enums"]["customer_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string
          gstin?: string | null
          id?: string
          mobile?: string | null
          name?: string
          notes?: string | null
          opening_balance?: number
          type?: Database["public"]["Enums"]["customer_type"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          preferred_language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          actual_man: number
          advance_deducted: number
          bank_account_id: string | null
          chai_pani_expense: number
          cost_per_man: number
          created_at: string
          created_by: string
          diesel_expense: number
          empty_weight: number
          entry_date: string
          entry_no: string
          forest_expense: number
          id: string
          material_cost: number
          net_man: number
          net_weight: number
          other_expense: number
          paid_amount: number
          paid_mode: Database["public"]["Enums"]["payment_mode"] | null
          ptype: Database["public"]["Enums"]["purchase_type"]
          rate_per_man: number
          remarks: string | null
          total_cost: number
          tractor_bank_account_id: string | null
          tractor_id: string | null
          tractor_labour: number
          tractor_paid_amount: number
          tractor_paid_mode: Database["public"]["Enums"]["payment_mode"] | null
          tractor_payable: number
          tractor_rate_per_man: number
          updated_at: string
          vendor_id: string
          vendor_payable: number
          weight_with_material: number
        }
        Insert: {
          actual_man?: number
          advance_deducted?: number
          bank_account_id?: string | null
          chai_pani_expense?: number
          cost_per_man?: number
          created_at?: string
          created_by?: string
          diesel_expense?: number
          empty_weight?: number
          entry_date?: string
          entry_no: string
          forest_expense?: number
          id?: string
          material_cost?: number
          net_man?: number
          net_weight?: number
          other_expense?: number
          paid_amount?: number
          paid_mode?: Database["public"]["Enums"]["payment_mode"] | null
          ptype?: Database["public"]["Enums"]["purchase_type"]
          rate_per_man?: number
          remarks?: string | null
          total_cost?: number
          tractor_bank_account_id?: string | null
          tractor_id?: string | null
          tractor_labour?: number
          tractor_paid_amount?: number
          tractor_paid_mode?: Database["public"]["Enums"]["payment_mode"] | null
          tractor_payable?: number
          tractor_rate_per_man?: number
          updated_at?: string
          vendor_id: string
          vendor_payable?: number
          weight_with_material?: number
        }
        Update: {
          actual_man?: number
          advance_deducted?: number
          bank_account_id?: string | null
          chai_pani_expense?: number
          cost_per_man?: number
          created_at?: string
          created_by?: string
          diesel_expense?: number
          empty_weight?: number
          entry_date?: string
          entry_no?: string
          forest_expense?: number
          id?: string
          material_cost?: number
          net_man?: number
          net_weight?: number
          other_expense?: number
          paid_amount?: number
          paid_mode?: Database["public"]["Enums"]["payment_mode"] | null
          ptype?: Database["public"]["Enums"]["purchase_type"]
          rate_per_man?: number
          remarks?: string | null
          total_cost?: number
          tractor_bank_account_id?: string | null
          tractor_id?: string | null
          tractor_labour?: number
          tractor_paid_amount?: number
          tractor_paid_mode?: Database["public"]["Enums"]["payment_mode"] | null
          tractor_payable?: number
          tractor_rate_per_man?: number
          updated_at?: string
          vendor_id?: string
          vendor_payable?: number
          weight_with_material?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_tractor_bank_account_id_fkey"
            columns: ["tractor_bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_tractor_id_fkey"
            columns: ["tractor_id"]
            isOneToOne: false
            referencedRelation: "tractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          bank_account_id: string | null
          cft: number
          created_at: string
          created_by: string
          customer_id: string | null
          empty_weight: number
          gross_weight: number
          id: string
          net_weight: number
          outstanding: number
          paid_amount: number
          payment_mode: string | null
          payment_status: string
          rate: number
          remarks: string | null
          sale_date: string
          sale_no: string
          sale_type: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          bank_account_id?: string | null
          cft?: number
          created_at?: string
          created_by: string
          customer_id?: string | null
          empty_weight?: number
          gross_weight?: number
          id?: string
          net_weight?: number
          outstanding?: number
          paid_amount?: number
          payment_mode?: string | null
          payment_status?: string
          rate?: number
          remarks?: string | null
          sale_date?: string
          sale_no: string
          sale_type: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          bank_account_id?: string | null
          cft?: number
          created_at?: string
          created_by?: string
          customer_id?: string | null
          empty_weight?: number
          gross_weight?: number
          id?: string
          net_weight?: number
          outstanding?: number
          paid_amount?: number
          payment_mode?: string | null
          payment_status?: string
          rate?: number
          remarks?: string | null
          sale_date?: string
          sale_no?: string
          sale_type?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      tractors: {
        Row: {
          created_at: string
          created_by: string
          default_empty_weight: number
          driver_mobile: string | null
          driver_name: string | null
          id: string
          notes: string | null
          number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          default_empty_weight?: number
          driver_mobile?: string | null
          driver_name?: string | null
          id?: string
          notes?: string | null
          number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          default_empty_weight?: number
          driver_mobile?: string | null
          driver_name?: string | null
          id?: string
          notes?: string | null
          number?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_advances: {
        Row: {
          advance_date: string
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string
          id: string
          remarks: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          advance_date?: string
          amount: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          remarks?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          advance_date?: string
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          remarks?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_advances_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_advances_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string
          id: string
          mode: Database["public"]["Enums"]["payment_mode"]
          payment_date: string
          purchase_id: string | null
          remarks: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          mode?: Database["public"]["Enums"]["payment_mode"]
          payment_date?: string
          purchase_id?: string | null
          remarks?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          mode?: Database["public"]["Enums"]["payment_mode"]
          payment_date?: string
          purchase_id?: string | null
          remarks?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          created_at: string
          created_by: string
          id: string
          mobile: string | null
          name: string
          notes: string | null
          opening_advance: number
          opening_balance: number
          updated_at: string
          village: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          mobile?: string | null
          name: string
          notes?: string | null
          opening_advance?: number
          opening_balance?: number
          updated_at?: string
          village?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          mobile?: string | null
          name?: string
          notes?: string | null
          opening_advance?: number
          opening_balance?: number
          updated_at?: string
          village?: string | null
        }
        Relationships: []
      }
      workers: {
        Row: {
          created_at: string
          created_by: string
          daily_wage: number
          id: string
          is_active: boolean
          mobile: string | null
          name: string
          opening_advance: number
          salary_type: Database["public"]["Enums"]["salary_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          daily_wage?: number
          id?: string
          is_active?: boolean
          mobile?: string | null
          name: string
          opening_advance?: number
          salary_type?: Database["public"]["Enums"]["salary_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          daily_wage?: number
          id?: string
          is_active?: boolean
          mobile?: string | null
          name?: string
          opening_advance?: number
          salary_type?: Database["public"]["Enums"]["salary_type"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "accountant" | "worker"
      customer_type: "waste" | "finished" | "both"
      payment_mode: "cash" | "dad_saving" | "dad_current" | "sunny_saving"
      purchase_type: "A" | "B"
      salary_type: "weekly" | "monthly"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "accountant", "worker"],
      customer_type: ["waste", "finished", "both"],
      payment_mode: ["cash", "dad_saving", "dad_current", "sunny_saving"],
      purchase_type: ["A", "B"],
      salary_type: ["weekly", "monthly"],
    },
  },
} as const
