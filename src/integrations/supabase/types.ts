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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_transactions: {
        Row: {
          account_id: string
          amount: number
          created_at: string | null
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          transaction_date: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_date: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_name: string
          account_number: string
          account_type: Database["public"]["Enums"]["account_type"]
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          parent_account_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_name: string
          account_number: string
          account_type: Database["public"]["Enums"]["account_type"]
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          parent_account_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string
          account_type?: Database["public"]["Enums"]["account_type"]
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          parent_account_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          audio_url: string | null
          contact_id: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          key_points: Json | null
          summary: string | null
          transcript: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          contact_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          key_points?: Json | null
          summary?: string | null
          transcript: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          contact_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          key_points?: Json | null
          summary?: string | null
          transcript?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          company_id: string
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_forecasts: {
        Row: {
          account_id: string
          actual_amount: number | null
          created_at: string | null
          forecasted_amount: number
          generated_by_ai: boolean | null
          id: string
          month: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          actual_amount?: number | null
          created_at?: string | null
          forecasted_amount: number
          generated_by_ai?: boolean | null
          id?: string
          month: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          actual_amount?: number | null
          created_at?: string | null
          forecasted_amount?: number
          generated_by_ai?: boolean | null
          id?: string
          month?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_forecasts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          name: string
          notes: Json | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          name: string
          notes?: Json | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          credit_card_last4: string | null
          customer_id: string | null
          description: string | null
          employee_name: string
          expense_date: string
          id: string
          receipt_url: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          credit_card_last4?: string | null
          customer_id?: string | null
          description?: string | null
          employee_name: string
          expense_date?: string
          id?: string
          receipt_url?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          credit_card_last4?: string | null
          customer_id?: string | null
          description?: string | null
          employee_name?: string
          expense_date?: string
          id?: string
          receipt_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string | null
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          discount: number | null
          id: string
          invoice_number: string
          items: Json
          paid: boolean | null
          paid_at: string | null
          salesman_name: string | null
          ship_to_address: string | null
          ship_to_name: string | null
          shipping: number | null
          subtotal: number
          total: number
        }
        Insert: {
          created_at?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          discount?: number | null
          id?: string
          invoice_number: string
          items?: Json
          paid?: boolean | null
          paid_at?: string | null
          salesman_name?: string | null
          ship_to_address?: string | null
          ship_to_name?: string | null
          shipping?: number | null
          subtotal: number
          total: number
        }
        Update: {
          created_at?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          discount?: number | null
          id?: string
          invoice_number?: string
          items?: Json
          paid?: boolean | null
          paid_at?: string | null
          salesman_name?: string | null
          ship_to_address?: string | null
          ship_to_name?: string | null
          shipping?: number | null
          subtotal?: number
          total?: number
        }
        Relationships: []
      }
      items: {
        Row: {
          cost: number | null
          created_at: string | null
          date_sold: string | null
          description: string
          id: string
          max_reorder_level: number | null
          min_reorder_level: number | null
          part_number: string
          sale_price: number | null
          serial_number: string | null
          shelf_location: string | null
          sold_in_invoice_id: string | null
          status: string
          updated_at: string | null
          volume: number | null
          warranty_months: number | null
          weight: number | null
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          date_sold?: string | null
          description: string
          id?: string
          max_reorder_level?: number | null
          min_reorder_level?: number | null
          part_number: string
          sale_price?: number | null
          serial_number?: string | null
          shelf_location?: string | null
          sold_in_invoice_id?: string | null
          status: string
          updated_at?: string | null
          volume?: number | null
          warranty_months?: number | null
          weight?: number | null
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          date_sold?: string | null
          description?: string
          id?: string
          max_reorder_level?: number | null
          min_reorder_level?: number | null
          part_number?: string
          sale_price?: number | null
          serial_number?: string | null
          shelf_location?: string | null
          sold_in_invoice_id?: string | null
          status?: string
          updated_at?: string | null
          volume?: number | null
          warranty_months?: number | null
          weight?: number | null
        }
        Relationships: []
      }
      people: {
        Row: {
          address: string | null
          branch_id: string | null
          company_id: string | null
          created_at: string | null
          email: string | null
          excavator_lines: string[] | null
          id: string
          job_title: string | null
          name: string
          notes: Json | null
          phone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          excavator_lines?: string[] | null
          id?: string
          job_title?: string | null
          name: string
          notes?: Json | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          excavator_lines?: string[] | null
          id?: string
          job_title?: string | null
          name?: string
          notes?: Json | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          part_number: string
          po_id: string
          quantity: number
          received_quantity: number | null
          serial_number: string | null
          total_cost: number
          unit_cost: number
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          part_number: string
          po_id: string
          quantity?: number
          received_quantity?: number | null
          serial_number?: string | null
          total_cost: number
          unit_cost: number
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          part_number?: string
          po_id?: string
          quantity?: number
          received_quantity?: number | null
          serial_number?: string | null
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string | null
          id: string
          items: Json
          notes: string | null
          po_number: string
          shipping: number | null
          status: string
          subtotal: number
          tax: number | null
          total: number
          updated_at: string | null
          vendor_id: string | null
          vendor_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          items?: Json
          notes?: string | null
          po_number: string
          shipping?: number | null
          status?: string
          subtotal: number
          tax?: number | null
          total: number
          updated_at?: string | null
          vendor_id?: string | null
          vendor_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          items?: Json
          notes?: string | null
          po_number?: string
          shipping?: number | null
          status?: string
          subtotal?: number
          tax?: number | null
          total?: number
          updated_at?: string | null
          vendor_id?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string | null
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          discount: number | null
          id: string
          items: Json
          quote_number: string
          salesman_name: string | null
          ship_to_address: string | null
          ship_to_name: string | null
          shipping: number | null
          subtotal: number
          total: number
        }
        Insert: {
          created_at?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          discount?: number | null
          id?: string
          items?: Json
          quote_number: string
          salesman_name?: string | null
          ship_to_address?: string | null
          ship_to_name?: string | null
          shipping?: number | null
          subtotal: number
          total: number
        }
        Update: {
          created_at?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          discount?: number | null
          id?: string
          items?: Json
          quote_number?: string
          salesman_name?: string | null
          ship_to_address?: string | null
          ship_to_name?: string | null
          shipping?: number | null
          subtotal?: number
          total?: number
        }
        Relationships: []
      }
      spiff_prizes: {
        Row: {
          created_at: string | null
          credits_required: number
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          credits_required: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          credits_required?: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      spiff_program: {
        Row: {
          created_at: string | null
          credits_earned: number
          id: string
          prize_redeemed: string | null
          redeemed_at: string | null
          sale_amount: number
          sale_description: string
          salesman_id: string
          serial_number: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credits_earned?: number
          id?: string
          prize_redeemed?: string | null
          redeemed_at?: string | null
          sale_amount?: number
          sale_description: string
          salesman_id: string
          serial_number?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credits_earned?: number
          id?: string
          prize_redeemed?: string | null
          redeemed_at?: string | null
          sale_amount?: number
          sale_description?: string
          salesman_id?: string
          serial_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_ai_settings: {
        Row: {
          created_at: string
          id: string
          openai_api_key: string | null
          preferred_model: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          openai_api_key?: string | null
          preferred_model?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          openai_api_key?: string | null
          preferred_model?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: Json | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: Json | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: Json | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_note_to_contact: {
        Args: { p_note_text: string; p_person_id: string }
        Returns: undefined
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      app_role: "employee" | "owner" | "customer" | "salesman"
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
      account_type: ["asset", "liability", "equity", "revenue", "expense"],
      app_role: ["employee", "owner", "customer", "salesman"],
    },
  },
} as const
