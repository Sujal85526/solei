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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          ip: unknown
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: never
          ip?: unknown
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: never
          ip?: unknown
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          slug: string
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          slug: string
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: Json | null
          auth_user_id: string | null
          created_at: string
          email: string | null
          emirate: Database["public"]["Enums"]["emirate"] | null
          id: string
          marketing_channels: string[]
          marketing_consent: boolean
          marketing_consent_at: string | null
          name: string | null
          notes: string | null
          phone: string | null
          source: Database["public"]["Enums"]["customer_source"]
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          address?: Json | null
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          emirate?: Database["public"]["Enums"]["emirate"] | null
          id?: string
          marketing_channels?: string[]
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          source?: Database["public"]["Enums"]["customer_source"]
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: Json | null
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          emirate?: Database["public"]["Enums"]["emirate"] | null
          id?: string
          marketing_channels?: string[]
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          source?: Database["public"]["Enums"]["customer_source"]
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          active: boolean
          emirate: Database["public"]["Enums"]["emirate"]
          fee_fils: number
          name: string
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          emirate: Database["public"]["Enums"]["emirate"]
          fee_fils?: number
          name: string
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          emirate?: Database["public"]["Enums"]["emirate"]
          fee_fils?: number
          name?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      destinations: {
        Row: {
          accent_colour: string | null
          active: boolean
          country: string | null
          created_at: string
          hero_image_url: string | null
          id: string
          mood: string | null
          name: string
          postcard_image_url: string | null
          region: string | null
          slug: string
          sort: number
          story: string | null
          updated_at: string
        }
        Insert: {
          accent_colour?: string | null
          active?: boolean
          country?: string | null
          created_at?: string
          hero_image_url?: string | null
          id?: string
          mood?: string | null
          name: string
          postcard_image_url?: string | null
          region?: string | null
          slug: string
          sort?: number
          story?: string | null
          updated_at?: string
        }
        Update: {
          accent_colour?: string | null
          active?: boolean
          country?: string | null
          created_at?: string
          hero_image_url?: string | null
          id?: string
          mood?: string | null
          name?: string
          postcard_image_url?: string | null
          region?: string | null
          slug?: string
          sort?: number
          story?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      event_documents: {
        Row: {
          created_at: string
          event_id: string
          id: string
          mime: string | null
          name: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          mime?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          mime?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_expenses: {
        Row: {
          amount_fils: number
          category: Database["public"]["Enums"]["event_expense_category"]
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          incurred_on: string
          note: string | null
          receipt_path: string | null
          updated_at: string
        }
        Insert: {
          amount_fils: number
          category?: Database["public"]["Enums"]["event_expense_category"]
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          incurred_on?: string
          note?: string | null
          receipt_path?: string | null
          updated_at?: string
        }
        Update: {
          amount_fils?: number
          category?: Database["public"]["Enums"]["event_expense_category"]
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          incurred_on?: string
          note?: string | null
          receipt_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_expenses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_staff: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          note: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          note?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          note?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      events: {
        Row: {
          booking_id: string | null
          booth_details: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          daily_hours: Json
          emirate: Database["public"]["Enums"]["emirate"] | null
          end_date: string
          fee_payment_status: Database["public"]["Enums"]["fee_payment_status"]
          id: string
          location: string | null
          name: string
          notes: string | null
          organiser_contact: string | null
          organiser_email: string | null
          organiser_name: string | null
          organiser_phone: string | null
          participation_fee_fils: number
          start_date: string
          status: Database["public"]["Enums"]["event_status"]
          type: Database["public"]["Enums"]["event_type"]
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          booth_details?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          daily_hours?: Json
          emirate?: Database["public"]["Enums"]["emirate"] | null
          end_date: string
          fee_payment_status?: Database["public"]["Enums"]["fee_payment_status"]
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          organiser_contact?: string | null
          organiser_email?: string | null
          organiser_name?: string | null
          organiser_phone?: string | null
          participation_fee_fils?: number
          start_date: string
          status?: Database["public"]["Enums"]["event_status"]
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          booth_details?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          daily_hours?: Json
          emirate?: Database["public"]["Enums"]["emirate"] | null
          end_date?: string
          fee_payment_status?: Database["public"]["Enums"]["fee_payment_status"]
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          organiser_contact?: string | null
          organiser_email?: string | null
          organiser_name?: string | null
          organiser_phone?: string | null
          participation_fee_fils?: number
          start_date?: string
          status?: Database["public"]["Enums"]["event_status"]
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          booking_id: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          customer_id: string | null
          dedupe_key: string | null
          error: string | null
          id: number
          order_id: string | null
          provider: string | null
          provider_id: string | null
          recipient: string
          status: Database["public"]["Enums"]["notification_status"]
          subject: string | null
          template_key: string | null
        }
        Insert: {
          booking_id?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          customer_id?: string | null
          dedupe_key?: string | null
          error?: string | null
          id?: never
          order_id?: string | null
          provider?: string | null
          provider_id?: string | null
          recipient: string
          status: Database["public"]["Enums"]["notification_status"]
          subject?: string | null
          template_key?: string | null
        }
        Update: {
          booking_id?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          customer_id?: string | null
          dedupe_key?: string | null
          error?: string | null
          id?: never
          order_id?: string | null
          provider?: string | null
          provider_id?: string | null
          recipient?: string
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string | null
          template_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_payment_summary"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "notification_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_template_key_fkey"
            columns: ["template_key"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["key"]
          },
        ]
      }
      notification_templates: {
        Row: {
          audience: Database["public"]["Enums"]["notification_audience"]
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          description: string | null
          enabled: boolean
          is_marketing: boolean
          key: string
          name: string
          sort: number
          subject: string
          updated_at: string
          updated_by: string | null
          variables: string[]
        }
        Insert: {
          audience: Database["public"]["Enums"]["notification_audience"]
          body: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          description?: string | null
          enabled?: boolean
          is_marketing?: boolean
          key: string
          name: string
          sort?: number
          subject: string
          updated_at?: string
          updated_by?: string | null
          variables?: string[]
        }
        Update: {
          audience?: Database["public"]["Enums"]["notification_audience"]
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          description?: string | null
          enabled?: boolean
          is_marketing?: boolean
          key?: string
          name?: string
          sort?: number
          subject?: string
          updated_at?: string
          updated_by?: string | null
          variables?: string[]
        }
        Relationships: []
      }
      order_line_costs: {
        Row: {
          order_line_id: string
          unit_cost_fils: number
        }
        Insert: {
          order_line_id: string
          unit_cost_fils?: number
        }
        Update: {
          order_line_id?: string
          unit_cost_fils?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_line_costs_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: true
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      order_lines: {
        Row: {
          category_id: string | null
          created_at: string
          destination_id: string | null
          discount_fils: number
          id: string
          is_reward: boolean
          line_total_fils: number
          list_price_fils: number
          order_id: string
          price_override_reason: string | null
          product_name: string
          qty: number
          sku: string
          unit_price_fils: number
          variant_id: string
          variant_label: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          destination_id?: string | null
          discount_fils?: number
          id?: string
          is_reward?: boolean
          line_total_fils: number
          list_price_fils: number
          order_id: string
          price_override_reason?: string | null
          product_name: string
          qty: number
          sku: string
          unit_price_fils: number
          variant_id: string
          variant_label?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          destination_id?: string | null
          discount_fils?: number
          id?: string
          is_reward?: boolean
          line_total_fils?: number
          list_price_fils?: number
          order_id?: string
          price_override_reason?: string | null
          product_name?: string
          qty?: number
          sku?: string
          unit_price_fils?: number
          variant_id?: string
          variant_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_payment_summary"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: number
          note: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          note?: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          note?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_payment_summary"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          booking_id: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          channel: Database["public"]["Enums"]["order_channel"]
          client_uuid: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          courier: string | null
          created_at: string
          customer_id: string | null
          delivery_address: Json | null
          delivery_emirate: Database["public"]["Enums"]["emirate"] | null
          delivery_fee_fils: number
          discount_fils: number
          event_day: string | null
          event_id: string | null
          fulfilment: Database["public"]["Enums"]["fulfilment_type"]
          id: string
          internal_notes: string | null
          notes: string | null
          number: string
          placed_at: string
          prices_include_vat: boolean
          staff_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_fils: number
          total_fils: number
          tracking_number: string | null
          updated_at: string
          vat_fils: number
          vat_rate_bp: number
        }
        Insert: {
          booking_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          channel: Database["public"]["Enums"]["order_channel"]
          client_uuid?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          courier?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_address?: Json | null
          delivery_emirate?: Database["public"]["Enums"]["emirate"] | null
          delivery_fee_fils?: number
          discount_fils?: number
          event_day?: string | null
          event_id?: string | null
          fulfilment?: Database["public"]["Enums"]["fulfilment_type"]
          id?: string
          internal_notes?: string | null
          notes?: string | null
          number?: string
          placed_at?: string
          prices_include_vat?: boolean
          staff_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_fils?: number
          total_fils?: number
          tracking_number?: string | null
          updated_at?: string
          vat_fils?: number
          vat_rate_bp?: number
        }
        Update: {
          booking_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          channel?: Database["public"]["Enums"]["order_channel"]
          client_uuid?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          courier?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_address?: Json | null
          delivery_emirate?: Database["public"]["Enums"]["emirate"] | null
          delivery_fee_fils?: number
          discount_fils?: number
          event_day?: string | null
          event_id?: string | null
          fulfilment?: Database["public"]["Enums"]["fulfilment_type"]
          id?: string
          internal_notes?: string | null
          notes?: string | null
          number?: string
          placed_at?: string
          prices_include_vat?: boolean
          staff_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_fils?: number
          total_fils?: number
          tracking_number?: string | null
          updated_at?: string
          vat_fils?: number
          vat_rate_bp?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          error: string | null
          event_id: string
          id: number
          payload: Json | null
          processed_at: string | null
          provider: string
          received_at: string
          type: string
        }
        Insert: {
          error?: string | null
          event_id: string
          id?: never
          payload?: Json | null
          processed_at?: string | null
          provider: string
          received_at?: string
          type: string
        }
        Update: {
          error?: string | null
          event_id?: string
          id?: never
          payload?: Json | null
          processed_at?: string | null
          provider?: string
          received_at?: string
          type?: string
        }
        Relationships: []
      }
      payment_links: {
        Row: {
          amount_fils: number
          booking_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          order_id: string | null
          provider: string
          provider_id: string | null
          status: Database["public"]["Enums"]["payment_link_status"]
          updated_at: string
          url: string | null
        }
        Insert: {
          amount_fils: number
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          order_id?: string | null
          provider?: string
          provider_id?: string | null
          status?: Database["public"]["Enums"]["payment_link_status"]
          updated_at?: string
          url?: string | null
        }
        Update: {
          amount_fils?: number
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          order_id?: string | null
          provider?: string
          provider_id?: string | null
          status?: Database["public"]["Enums"]["payment_link_status"]
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_payment_summary"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payment_links_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_fils: number
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["payment_kind"]
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          order_id: string
          provider: string | null
          provider_payload: Json | null
          provider_ref: string | null
          received_at: string | null
          received_by: string | null
          reference: string | null
          status: Database["public"]["Enums"]["payment_state"]
          updated_at: string
        }
        Insert: {
          amount_fils: number
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["payment_kind"]
          method: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          order_id: string
          provider?: string | null
          provider_payload?: Json | null
          provider_ref?: string | null
          received_at?: string | null
          received_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_state"]
          updated_at?: string
        }
        Update: {
          amount_fils?: number
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["payment_kind"]
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          order_id?: string
          provider?: string | null
          provider_payload?: Json | null
          provider_ref?: string | null
          received_at?: string | null
          received_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_payment_summary"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          description: string
          group: string
          key: string
          sort: number
        }
        Insert: {
          description: string
          group: string
          key: string
          sort?: number
        }
        Update: {
          description?: string
          group?: string
          key?: string
          sort?: number
        }
        Relationships: []
      }
      private_settings: {
        Row: {
          id: number
          low_stock_default: number
          owner_notification_email: string | null
          owner_notification_phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          low_stock_default?: number
          owner_notification_email?: string | null
          owner_notification_phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          low_stock_default?: number
          owner_notification_email?: string | null
          owner_notification_phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt: string
          created_at: string
          id: string
          product_id: string
          sort: number
          storage_path: string | null
          url: string
        }
        Insert: {
          alt?: string
          created_at?: string
          id?: string
          product_id: string
          sort?: number
          storage_path?: string | null
          url: string
        }
        Update: {
          alt?: string
          created_at?: string
          id?: string
          product_id?: string
          sort?: number
          storage_path?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          active: boolean
          barcode: string | null
          created_at: string
          id: string
          label: string
          low_stock_threshold: number | null
          price_fils: number
          product_id: string
          size_ml: number | null
          sku: string
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          created_at?: string
          id?: string
          label?: string
          low_stock_threshold?: number | null
          price_fils: number
          product_id: string
          size_ml?: number | null
          sku: string
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          barcode?: string | null
          created_at?: string
          id?: string
          label?: string
          low_stock_threshold?: number | null
          price_fils?: number
          product_id?: string
          size_ml?: number | null
          sku?: string
          sort?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category_id: string
          created_at: string
          description: string | null
          destination_id: string | null
          featured: boolean
          id: string
          name: string
          notes_base: string[]
          notes_heart: string[]
          notes_top: string[]
          slug: string
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id: string
          created_at?: string
          description?: string | null
          destination_id?: string | null
          featured?: boolean
          id?: string
          name: string
          notes_base?: string[]
          notes_heart?: string[]
          notes_top?: string[]
          slug: string
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string
          created_at?: string
          description?: string | null
          destination_id?: string | null
          featured?: boolean
          id?: string
          name?: string
          notes_base?: string[]
          notes_heart?: string[]
          notes_top?: string[]
          slug?: string
          sort?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_key: string
          role_id: string
        }
        Insert: {
          permission_key: string
          role_id: string
        }
        Update: {
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          key: string
          name: string
          requires_mfa: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          name: string
          requires_mfa?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          requires_mfa?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          booking_deposit_bp: number
          business_name: string
          contact_email: string | null
          contact_phone: string | null
          currency: string
          delivery_policy: string | null
          free_delivery_threshold_fils: number | null
          id: number
          instagram_handle: string | null
          instagram_url: string | null
          legal_name: string | null
          prices_include_vat: boolean
          returns_policy: string | null
          trn: string | null
          updated_at: string
          updated_by: string | null
          vat_rate_bp: number
          whatsapp_number: string | null
        }
        Insert: {
          booking_deposit_bp?: number
          business_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          currency?: string
          delivery_policy?: string | null
          free_delivery_threshold_fils?: number | null
          id?: number
          instagram_handle?: string | null
          instagram_url?: string | null
          legal_name?: string | null
          prices_include_vat?: boolean
          returns_policy?: string | null
          trn?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_rate_bp?: number
          whatsapp_number?: string | null
        }
        Update: {
          booking_deposit_bp?: number
          business_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          currency?: string
          delivery_policy?: string | null
          free_delivery_threshold_fils?: number | null
          id?: number
          instagram_handle?: string | null
          instagram_url?: string | null
          legal_name?: string | null
          prices_include_vat?: boolean
          returns_policy?: string | null
          trn?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_rate_bp?: number
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      staff_profiles: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          email: string
          employment_status: Database["public"]["Enums"]["employment_status"]
          full_name: string
          phone: string | null
          position: string | null
          role_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          email: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          full_name: string
          phone?: string | null
          position?: string | null
          role_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          email?: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          full_name?: string
          phone?: string | null
          position?: string | null
          role_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_locations: {
        Row: {
          active: boolean
          created_at: string
          event_id: string | null
          id: string
          is_default: boolean
          kind: Database["public"]["Enums"]["location_kind"]
          name: string
          sells_online: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          event_id?: string | null
          id?: string
          is_default?: boolean
          kind?: Database["public"]["Enums"]["location_kind"]
          name: string
          sells_online?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          event_id?: string | null
          id?: string
          is_default?: boolean
          kind?: Database["public"]["Enums"]["location_kind"]
          name?: string
          sells_online?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_locations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          location_id: string
          order_line_id: string | null
          qty: number
          reason: string | null
          transfer_id: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
          variant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          location_id: string
          order_line_id?: string | null
          qty: number
          reason?: string | null
          transfer_id?: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
          variant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          location_id?: string
          order_line_id?: string | null
          qty?: number
          reason?: string | null
          transfer_id?: string | null
          type?: Database["public"]["Enums"]["stock_movement_type"]
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_line_fk"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_costs: {
        Row: {
          cost_fils: number
          updated_at: string
          updated_by: string | null
          variant_id: string
        }
        Insert: {
          cost_fils?: number
          updated_at?: string
          updated_by?: string | null
          variant_id: string
        }
        Update: {
          cost_fils?: number
          updated_at?: string
          updated_by?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_costs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_orders: {
        Row: {
          booking_id: string | null
          channel: Database["public"]["Enums"]["order_channel"] | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          courier: string | null
          created_at: string | null
          customer_id: string | null
          delivery_emirate: Database["public"]["Enums"]["emirate"] | null
          delivery_fee_fils: number | null
          discount_fils: number | null
          event_day: string | null
          event_id: string | null
          event_name: string | null
          fulfilment: Database["public"]["Enums"]["fulfilment_type"] | null
          id: string | null
          item_count: number | null
          number: string | null
          outstanding_fils: number | null
          paid_fils: number | null
          payment_status: string | null
          placed_at: string | null
          refunded_fils: number | null
          staff_id: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          subtotal_fils: number | null
          total_fils: number | null
          tracking_number: string | null
          vat_fils: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_summary: {
        Row: {
          created_at: string | null
          email: string | null
          emirate: Database["public"]["Enums"]["emirate"] | null
          first_purchase_at: string | null
          id: string | null
          last_purchase_at: string | null
          marketing_channels: string[] | null
          marketing_consent: boolean | null
          marketing_consent_at: string | null
          name: string | null
          order_count: number | null
          phone: string | null
          source: Database["public"]["Enums"]["customer_source"] | null
          total_spent_fils: number | null
          unsubscribed_at: string | null
        }
        Relationships: []
      }
      event_stock_summary: {
        Row: {
          allocated: number | null
          damaged: number | null
          event_id: string | null
          location_id: string | null
          other: number | null
          remaining: number | null
          returned: number | null
          sold: number | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_locations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payment_summary: {
        Row: {
          order_id: string | null
          outstanding_fils: number | null
          paid_fils: number | null
          payment_status: string | null
          refunded_fils: number | null
          total_fils: number | null
        }
        Relationships: []
      }
      stock_levels: {
        Row: {
          last_movement_at: string | null
          location_id: string | null
          on_hand: number | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      after_order_cancelled: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      after_order_paid: { Args: { p_order_id: string }; Returns: undefined }
      allocate_event_stock: {
        Args: { p_event_id: string; p_from_location?: string; p_lines: Json }
        Returns: number
      }
      apply_order_stock: { Args: { p_order_id: string }; Returns: undefined }
      business_day: { Args: { ts: string }; Returns: string }
      business_today: { Args: never; Returns: string }
      can_access_event_object: {
        Args: { p_name: string; p_write: boolean }
        Returns: boolean
      }
      cancel_order: {
        Args: { p_order_id: string; p_reason: string; p_restock?: boolean }
        Returns: number
      }
      close_event_stock: {
        Args: {
          p_damages?: Json
          p_event_id: string
          p_returns?: Json
          p_to_location?: string
        }
        Returns: Json
      }
      confirm_payment: {
        Args: {
          p_amount_fils: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_payload?: Json
          p_provider: string
          p_provider_ref: string
        }
        Returns: {
          already_processed: boolean
          newly_paid: boolean
          order_id: string
          order_number: string
        }[]
      }
      create_web_order: {
        Args: { p: Json }
        Returns: {
          existing: boolean
          order_id: string
          order_number: string
          total_fils: number
        }[]
      }
      current_staff_role: {
        Args: never
        Returns: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          key: string
          name: string
          requires_mfa: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "roles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      event_staff_options: {
        Args: never
        Returns: {
          active: boolean
          full_name: string
          position: string
          user_id: string
        }[]
      }
      fail_payment: {
        Args: { p_provider: string; p_provider_ref: string; p_reason: string }
        Returns: string
      }
      has_permission: { Args: { p_key: string }; Returns: boolean }
      is_own_order: { Args: { p_order_id: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      marketing_opt_in: {
        Args: { p_channel: string; p_email?: string; p_phone?: string }
        Returns: undefined
      }
      my_permissions: { Args: never; Returns: string[] }
      next_order_number: { Args: never; Returns: string }
      on_hand: {
        Args: { p_location_id: string; p_variant_id: string }
        Returns: number
      }
      online_availability: {
        Args: { p_variant_ids: string[] }
        Returns: {
          available: number
          variant_id: string
        }[]
      }
      order_status_allowed: {
        Args: {
          p_from: Database["public"]["Enums"]["order_status"]
          p_to: Database["public"]["Enums"]["order_status"]
        }
        Returns: boolean
      }
      overlapping_events: {
        Args: {
          p_end: string
          p_exclude?: string
          p_location?: string
          p_start: string
        }
        Returns: {
          end_date: string
          id: string
          location: string
          name: string
          same_location: boolean
          start_date: string
          status: Database["public"]["Enums"]["event_status"]
          type: Database["public"]["Enums"]["event_type"]
        }[]
      }
      record_payment: {
        Args: {
          p_amount_fils: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_note?: string
          p_order_id: string
          p_reference?: string
        }
        Returns: {
          newly_paid: boolean
          outstanding_fils: number
          payment_id: string
        }[]
      }
      record_refund: {
        Args: {
          p_amount_fils: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_order_id: string
          p_reason: string
        }
        Returns: string
      }
      record_stock_movement: {
        Args: {
          p_location_id: string
          p_qty: number
          p_reason?: string
          p_type: Database["public"]["Enums"]["stock_movement_type"]
          p_variant_id: string
        }
        Returns: string
      }
      reopen_event: { Args: { p_event_id: string }; Returns: undefined }
      request_ip: { Args: never; Returns: unknown }
      require_permission: { Args: { p_key: string }; Returns: undefined }
      track_order: {
        Args: { p_number: string; p_phone: string }
        Returns: {
          courier: string
          fulfilment: Database["public"]["Enums"]["fulfilment_type"]
          history: Json
          lines: Json
          number: string
          payment_status: string
          placed_at: string
          status: Database["public"]["Enums"]["order_status"]
          total_fils: number
          tracking_number: string
        }[]
      }
      transfer_stock: {
        Args: {
          p_allow_negative?: boolean
          p_from_location: string
          p_qty: number
          p_reason?: string
          p_to_location: string
          p_variant_id: string
        }
        Returns: string
      }
      update_order_notes: {
        Args: { p_internal_notes: string; p_order_id: string }
        Returns: undefined
      }
      update_order_status: {
        Args: {
          p_courier?: string
          p_note?: string
          p_order_id: string
          p_status: Database["public"]["Enums"]["order_status"]
          p_tracking_number?: string
        }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      upsert_customer: {
        Args: {
          p_address?: Json
          p_email: string
          p_emirate?: Database["public"]["Enums"]["emirate"]
          p_marketing_channel?: string
          p_marketing_consent?: boolean
          p_name?: string
          p_phone: string
          p_source?: Database["public"]["Enums"]["customer_source"]
        }
        Returns: string
      }
      variant_stock_alerts: {
        Args: { p_variant_ids: string[] }
        Returns: {
          is_low: boolean
          on_hand: number
          product_name: string
          sku: string
          threshold: number
          variant_id: string
          variant_label: string
        }[]
      }
      write_audit: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_entity: string
          p_entity_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      customer_source:
        | "website"
        | "pos"
        | "whatsapp"
        | "direct"
        | "booking"
        | "newsletter"
        | "import"
        | "manual"
      emirate:
        | "abu_dhabi"
        | "dubai"
        | "sharjah"
        | "ajman"
        | "umm_al_quwain"
        | "ras_al_khaimah"
        | "fujairah"
      employment_status:
        | "full_time"
        | "part_time"
        | "freelance"
        | "event_only"
        | "former"
      event_expense_category:
        | "staff"
        | "transport"
        | "setup"
        | "accommodation"
        | "marketing"
        | "other"
      event_status: "potential" | "confirmed" | "completed" | "cancelled"
      event_type: "exhibition" | "popup" | "private_booking" | "other"
      fee_payment_status:
        | "unpaid"
        | "partially_paid"
        | "paid"
        | "waived"
        | "not_applicable"
      fulfilment_type: "delivery" | "pickup" | "handed_over"
      location_kind: "warehouse" | "event" | "other"
      notification_audience: "customer" | "owner"
      notification_channel: "email" | "whatsapp"
      notification_status: "sent" | "failed" | "skipped"
      order_channel:
        | "website"
        | "pos"
        | "whatsapp"
        | "direct"
        | "payment_link"
        | "booking"
      order_status:
        | "pending_payment"
        | "new"
        | "preparing"
        | "dispatched"
        | "delivered"
        | "completed"
        | "cancelled"
      payment_kind: "payment" | "refund"
      payment_link_status: "active" | "paid" | "expired" | "cancelled"
      payment_method:
        | "online_card"
        | "apple_pay"
        | "cash"
        | "card_terminal"
        | "soft_pos"
        | "bank_transfer"
        | "payment_link"
        | "other"
      payment_state: "pending" | "succeeded" | "failed" | "cancelled"
      stock_movement_type:
        | "receive"
        | "sale"
        | "refund_return"
        | "transfer_out"
        | "transfer_in"
        | "damage"
        | "adjustment"
        | "reward_redemption"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      customer_source: [
        "website",
        "pos",
        "whatsapp",
        "direct",
        "booking",
        "newsletter",
        "import",
        "manual",
      ],
      emirate: [
        "abu_dhabi",
        "dubai",
        "sharjah",
        "ajman",
        "umm_al_quwain",
        "ras_al_khaimah",
        "fujairah",
      ],
      employment_status: [
        "full_time",
        "part_time",
        "freelance",
        "event_only",
        "former",
      ],
      event_expense_category: [
        "staff",
        "transport",
        "setup",
        "accommodation",
        "marketing",
        "other",
      ],
      event_status: ["potential", "confirmed", "completed", "cancelled"],
      event_type: ["exhibition", "popup", "private_booking", "other"],
      fee_payment_status: [
        "unpaid",
        "partially_paid",
        "paid",
        "waived",
        "not_applicable",
      ],
      fulfilment_type: ["delivery", "pickup", "handed_over"],
      location_kind: ["warehouse", "event", "other"],
      notification_audience: ["customer", "owner"],
      notification_channel: ["email", "whatsapp"],
      notification_status: ["sent", "failed", "skipped"],
      order_channel: [
        "website",
        "pos",
        "whatsapp",
        "direct",
        "payment_link",
        "booking",
      ],
      order_status: [
        "pending_payment",
        "new",
        "preparing",
        "dispatched",
        "delivered",
        "completed",
        "cancelled",
      ],
      payment_kind: ["payment", "refund"],
      payment_link_status: ["active", "paid", "expired", "cancelled"],
      payment_method: [
        "online_card",
        "apple_pay",
        "cash",
        "card_terminal",
        "soft_pos",
        "bank_transfer",
        "payment_link",
        "other",
      ],
      payment_state: ["pending", "succeeded", "failed", "cancelled"],
      stock_movement_type: [
        "receive",
        "sale",
        "refund_return",
        "transfer_out",
        "transfer_in",
        "damage",
        "adjustment",
        "reward_redemption",
      ],
    },
  },
} as const
