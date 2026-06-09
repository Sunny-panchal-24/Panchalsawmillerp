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
      customers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string
          gstin: string | null
          id: string
          name: string
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
          name: string
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
          name?: string
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
          tractor_id: string | null
          tractor_labour: number
          updated_at: string
          vendor_id: string
          weight_with_material: number
        }
        Insert: {
          actual_man?: number
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
          tractor_id?: string | null
          tractor_labour?: number
          updated_at?: string
          vendor_id: string
          weight_with_material?: number
        }
        Update: {
          actual_man?: number
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
          tractor_id?: string | null
          tractor_labour?: number
          updated_at?: string
          vendor_id?: string
          weight_with_material?: number
        }
        Relationships: [
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
      tractors: {
        Row: {
          created_at: string
          created_by: string
          default_empty_weight: number
          driver_name: string | null
          id: string
          number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          default_empty_weight?: number
          driver_name?: string | null
          id?: string
          number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          default_empty_weight?: number
          driver_name?: string | null
          id?: string
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
      vendor_payments: {
        Row: {
          amount: number
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
          name: string
          opening_balance: number
          updated_at: string
          village: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          name: string
          opening_balance?: number
          updated_at?: string
          village?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
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
          name: string
          salary_type: Database["public"]["Enums"]["salary_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          daily_wage?: number
          id?: string
          name: string
          salary_type?: Database["public"]["Enums"]["salary_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          daily_wage?: number
          id?: string
          name?: string
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
