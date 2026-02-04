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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          action_category: string
          actor_email: string | null
          actor_id: string | null
          actor_role: string | null
          created_at: string
          failure_reason: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          request_id: string | null
          result: string
          risk_level: string | null
          session_id: string | null
          target_id: string | null
          target_name: string | null
          target_type: string | null
          timestamp: string
          user_agent: string | null
        }
        Insert: {
          action: string
          action_category: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          request_id?: string | null
          result?: string
          risk_level?: string | null
          session_id?: string | null
          target_id?: string | null
          target_name?: string | null
          target_type?: string | null
          timestamp?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          action_category?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          request_id?: string | null
          result?: string
          risk_level?: string | null
          session_id?: string | null
          target_id?: string | null
          target_name?: string | null
          target_type?: string | null
          timestamp?: string
          user_agent?: string | null
        }
        Relationships: []
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
      company_meetings: {
        Row: {
          attendees: string[] | null
          audio_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          location: string | null
          meeting_date: string
          meeting_type: string | null
          notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          attendees?: string[] | null
          audio_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          meeting_date: string
          meeting_type?: string | null
          notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          attendees?: string[] | null
          audio_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          meeting_date?: string
          meeting_type?: string | null
          notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      data_export_logs: {
        Row: {
          download_completed: boolean | null
          export_format: string
          export_type: string
          exported_at: string
          filters_applied: Json | null
          id: string
          ip_address: unknown
          record_count: number | null
          user_id: string
        }
        Insert: {
          download_completed?: boolean | null
          export_format: string
          export_type: string
          exported_at?: string
          filters_applied?: Json | null
          id?: string
          ip_address?: unknown
          record_count?: number | null
          user_id: string
        }
        Update: {
          download_completed?: boolean | null
          export_format?: string
          export_type?: string
          exported_at?: string
          filters_applied?: Json | null
          id?: string
          ip_address?: unknown
          record_count?: number | null
          user_id?: string
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
            referencedRelation: "active_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_notes: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          is_pinned: boolean | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          created_at: string | null
          created_by: string | null
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
          status: string
          subtotal: number
          total: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
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
          status?: string
          subtotal: number
          total: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
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
          status?: string
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
      login_attempts: {
        Row: {
          attempted_at: string
          email: string
          id: string
          ip_address: unknown
          success: boolean | null
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string
          email: string
          id?: string
          ip_address?: unknown
          success?: boolean | null
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string
          email?: string
          id?: string
          ip_address?: unknown
          success?: boolean | null
          user_agent?: string | null
        }
        Relationships: []
      }
      people: {
        Row: {
          address: string | null
          branch_id: string | null
          company_id: string | null
          created_at: string | null
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
          weight: number | null
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
          weight?: number | null
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
          weight?: number | null
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
      quickbooks_connections: {
        Row: {
          access_token_encrypted: string
          connected_at: string
          created_at: string
          id: string
          realm_id: string
          refresh_token_encrypted: string
          refresh_token_expires_at: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          connected_at?: string
          created_at?: string
          id?: string
          realm_id: string
          refresh_token_encrypted: string
          refresh_token_expires_at: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          connected_at?: string
          created_at?: string
          id?: string
          realm_id?: string
          refresh_token_encrypted?: string
          refresh_token_expires_at?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quickbooks_sync_log: {
        Row: {
          created_at: string
          entity_type: string
          error_message: string | null
          id: string
          local_id: string
          quickbooks_id: string
          status: string
          sync_direction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          error_message?: string | null
          id?: string
          local_id: string
          quickbooks_id: string
          status?: string
          sync_direction?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          local_id?: string
          quickbooks_id?: string
          status?: string
          sync_direction?: string
          user_id?: string
        }
        Relationships: []
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
      signup_notifications: {
        Row: {
          created_at: string
          email: string
          email_encrypted: string | null
          full_name: string | null
          id: string
          read_at: string | null
          signed_up_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          email_encrypted?: string | null
          full_name?: string | null
          id?: string
          read_at?: string | null
          signed_up_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          email_encrypted?: string | null
          full_name?: string | null
          id?: string
          read_at?: string | null
          signed_up_at?: string
          user_id?: string
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
          adjusted_amount: number | null
          adjusted_credits: number | null
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          credits_earned: number
          id: string
          prize_redeemed: string | null
          redeemed_at: string | null
          sale_amount: number
          sale_description: string
          salesman_id: string
          serial_number: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          adjusted_amount?: number | null
          adjusted_credits?: number | null
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          credits_earned?: number
          id?: string
          prize_redeemed?: string | null
          redeemed_at?: string | null
          sale_amount?: number
          sale_description: string
          salesman_id: string
          serial_number?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          adjusted_amount?: number | null
          adjusted_credits?: number | null
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          credits_earned?: number
          id?: string
          prize_redeemed?: string | null
          redeemed_at?: string | null
          sale_amount?: number
          sale_description?: string
          salesman_id?: string
          serial_number?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      spiff_warranties: {
        Row: {
          created_at: string | null
          id: string
          sale_description: string
          salesman_id: string
          serial_number: string
          spiff_sale_id: string
          updated_at: string | null
          warranty_end_date: string
          warranty_months: number
          warranty_start_date: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          sale_description: string
          salesman_id: string
          serial_number: string
          spiff_sale_id: string
          updated_at?: string | null
          warranty_end_date: string
          warranty_months?: number
          warranty_start_date?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          sale_description?: string
          salesman_id?: string
          serial_number?: string
          spiff_sale_id?: string
          updated_at?: string | null
          warranty_end_date?: string
          warranty_months?: number
          warranty_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "spiff_warranties_spiff_sale_id_fkey"
            columns: ["spiff_sale_id"]
            isOneToOne: false
            referencedRelation: "spiff_program"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_settings: {
        Row: {
          created_at: string
          id: string
          preferred_model: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preferred_model?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
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
      user_security_settings: {
        Row: {
          account_locked: boolean | null
          account_locked_at: string | null
          account_locked_reason: string | null
          created_at: string
          failed_login_attempts: number | null
          id: string
          last_activity: string | null
          last_failed_login: string | null
          mfa_enabled: boolean | null
          mfa_verified_at: string | null
          password_changed_at: string | null
          require_password_change: boolean | null
          session_timeout_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_locked?: boolean | null
          account_locked_at?: string | null
          account_locked_reason?: string | null
          created_at?: string
          failed_login_attempts?: number | null
          id?: string
          last_activity?: string | null
          last_failed_login?: string | null
          mfa_enabled?: boolean | null
          mfa_verified_at?: string | null
          password_changed_at?: string | null
          require_password_change?: boolean | null
          session_timeout_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_locked?: boolean | null
          account_locked_at?: string | null
          account_locked_reason?: string | null
          created_at?: string
          failed_login_attempts?: number | null
          id?: string
          last_activity?: string | null
          last_failed_login?: string | null
          mfa_enabled?: boolean | null
          mfa_verified_at?: string | null
          password_changed_at?: string | null
          require_password_change?: boolean | null
          session_timeout_minutes?: number | null
          updated_at?: string
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
      active_people: {
        Row: {
          address: string | null
          branch_id: string | null
          company_id: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          excavator_lines: string[] | null
          id: string | null
          job_title: string | null
          name: string | null
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
          deleted_at?: string | null
          email?: string | null
          excavator_lines?: string[] | null
          id?: string | null
          job_title?: string | null
          name?: string | null
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
          deleted_at?: string | null
          email?: string | null
          excavator_lines?: string[] | null
          id?: string | null
          job_title?: string | null
          name?: string | null
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
      quickbooks_connection_status: {
        Row: {
          connected_at: string | null
          is_token_valid: boolean | null
          realm_id: string | null
          user_id: string | null
        }
        Insert: {
          connected_at?: string | null
          is_token_valid?: never
          realm_id?: string | null
          user_id?: string | null
        }
        Update: {
          connected_at?: string | null
          is_token_valid?: never
          realm_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      signup_notifications_decrypted: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          read_at: string | null
          signed_up_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: never
          full_name?: string | null
          id?: string | null
          read_at?: string | null
          signed_up_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: never
          full_name?: string | null
          id?: string | null
          read_at?: string | null
          signed_up_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_note_to_contact: {
        Args: { p_note_text: string; p_person_id: string }
        Returns: undefined
      }
      check_account_status: { Args: { p_email: string }; Returns: Json }
      dearmor: { Args: { "": string }; Returns: string }
      decrypt_email: { Args: { encrypted_email: string }; Returns: string }
      decrypt_token: {
        Args: { encrypted_token: string; user_id: string }
        Returns: string
      }
      encrypt_email: { Args: { email_text: string }; Returns: string }
      encrypt_token: {
        Args: { token: string; user_id: string }
        Returns: string
      }
      gen_random_uuid: { Args: never; Returns: string }
      gen_salt: { Args: { "": string }; Returns: string }
      get_qb_connection_status: {
        Args: { p_user_id: string }
        Returns: {
          connected_at: string
          realm_id: string
        }[]
      }
      get_qb_tokens: {
        Args: { p_user_id: string }
        Returns: {
          access_token: string
          realm_id: string
          refresh_token: string
          refresh_token_expires_at: string
          token_expires_at: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
      permanently_delete_person: {
        Args: { person_id: string }
        Returns: undefined
      }
      pgp_armor_headers: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      restore_person: { Args: { person_id: string }; Returns: undefined }
      store_qb_tokens: {
        Args: {
          p_access_token: string
          p_realm_id: string
          p_refresh_token: string
          p_refresh_token_expires_at: string
          p_token_expires_at: string
          p_user_id: string
        }
        Returns: undefined
      }
      update_qb_tokens: {
        Args: {
          p_access_token: string
          p_refresh_token: string
          p_refresh_token_expires_at: string
          p_token_expires_at: string
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      app_role: "employee" | "owner" | "customer" | "salesman" | "developer"
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
      app_role: ["employee", "owner", "customer", "salesman", "developer"],
    },
  },
} as const
