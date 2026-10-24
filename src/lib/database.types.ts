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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
      booking_event_types: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      booking_messages: {
        Row: {
          body: string
          booking_id: string
          channel: Database["public"]["Enums"]["booking_message_channel"]
          created_at: string
          created_by: string | null
          direction: Database["public"]["Enums"]["booking_message_direction"]
          id: string
        }
        Insert: {
          body: string
          booking_id: string
          channel?: Database["public"]["Enums"]["booking_message_channel"]
          created_at?: string
          created_by?: string | null
          direction: Database["public"]["Enums"]["booking_message_direction"]
          id?: string
        }
        Update: {
          body?: string
          booking_id?: string
          channel?: Database["public"]["Enums"]["booking_message_channel"]
          created_at?: string
          created_by?: string | null
          direction?: Database["public"]["Enums"]["booking_message_direction"]
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_packages: {
        Row: {
          active: boolean
          base_price_fils: number
          created_at: string
          description: string | null
          id: string
          images: string[]
          inclusions: string[]
          name: string
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_price_fils?: number
          created_at?: string
          description?: string | null
          id?: string
          images?: string[]
          inclusions?: string[]
          name: string
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_price_fils?: number
          created_at?: string
          description?: string | null
          id?: string
          images?: string[]
          inclusions?: string[]
          name?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      booking_quotes: {
        Row: {
          accepted_at: string | null
          booking_id: string
          created_at: string
          created_by: string | null
          deposit_fils: number
          discount_fils: number
          id: string
          lines: Json
          notes: string | null
          sent_at: string
          status: Database["public"]["Enums"]["booking_quote_status"]
          subtotal_fils: number
          token: string
          total_fils: number
          valid_until: string
          version: number
        }
        Insert: {
          accepted_at?: string | null
          booking_id: string
          created_at?: string
          created_by?: string | null
          deposit_fils: number
          discount_fils?: number
          id?: string
          lines: Json
          notes?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["booking_quote_status"]
          subtotal_fils: number
          token?: string
          total_fils: number
          valid_until: string
          version: number
        }
        Update: {
          accepted_at?: string | null
          booking_id?: string
          created_at?: string
          created_by?: string | null
          deposit_fils?: number
          discount_fils?: number
          id?: string
          lines?: Json
          notes?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["booking_quote_status"]
          subtotal_fils?: number
          token?: string
          total_fils?: number
          valid_until?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_quotes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_service_types: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          booth_design_id: string | null
          client_uuid: string | null
          confirmed_at: string | null
          consent_at: string | null
          contact_email: string
          contact_name: string
          contact_phone: string
          created_at: string
          customer_id: string | null
          emirate: Database["public"]["Enums"]["emirate"]
          end_time: string
          estimate: Json
          estimated_total_fils: number
          event_date: string
          event_id: string | null
          event_type_id: string
          flower_option_id: string | null
          flowers: boolean
          guests: number
          id: string
          location: string
          package_id: string | null
          products_interest: Json
          ref: string
          reject_reason: string | null
          service_type_ids: string[]
          special_requests: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          booth_design_id?: string | null
          client_uuid?: string | null
          confirmed_at?: string | null
          consent_at?: string | null
          contact_email: string
          contact_name: string
          contact_phone: string
          created_at?: string
          customer_id?: string | null
          emirate: Database["public"]["Enums"]["emirate"]
          end_time: string
          estimate?: Json
          estimated_total_fils?: number
          event_date: string
          event_id?: string | null
          event_type_id: string
          flower_option_id?: string | null
          flowers?: boolean
          guests: number
          id?: string
          location: string
          package_id?: string | null
          products_interest?: Json
          ref?: string
          reject_reason?: string | null
          service_type_ids?: string[]
          special_requests?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          booth_design_id?: string | null
          client_uuid?: string | null
          confirmed_at?: string | null
          consent_at?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          customer_id?: string | null
          emirate?: Database["public"]["Enums"]["emirate"]
          end_time?: string
          estimate?: Json
          estimated_total_fils?: number
          event_date?: string
          event_id?: string | null
          event_type_id?: string
          flower_option_id?: string | null
          flowers?: boolean
          guests?: number
          id?: string
          location?: string
          package_id?: string | null
          products_interest?: Json
          ref?: string
          reject_reason?: string | null
          service_type_ids?: string[]
          special_requests?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_booth_design_id_fkey"
            columns: ["booth_design_id"]
            isOneToOne: false
            referencedRelation: "booth_designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "booking_event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_flower_option_id_fkey"
            columns: ["flower_option_id"]
            isOneToOne: false
            referencedRelation: "flower_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "booking_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      booth_designs: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          photos: string[]
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          photos?: string[]
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          photos?: string[]
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          customer_id: string | null
          email: string
          error: string | null
          id: number
          sent_at: string | null
          status: Database["public"]["Enums"]["campaign_recipient_status"]
        }
        Insert: {
          campaign_id: string
          created_at?: string
          customer_id?: string | null
          email: string
          error?: string | null
          id?: never
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_recipient_status"]
        }
        Update: {
          campaign_id?: string
          created_at?: string
          customer_id?: string | null
          email?: string
          error?: string | null
          id?: never
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_recipient_status"]
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          segment_id: string | null
          segment_name: string | null
          sent_at: string | null
          sent_by: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          segment_id?: string | null
          segment_name?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          subject?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          segment_id?: string | null
          segment_name?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "customer_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_reminder_optouts: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      carts: {
        Row: {
          closed_at: string | null
          created_at: string
          email: string
          id: string
          item_count: number
          last_reminder_at: string | null
          lines: Json
          link_opened_at: string | null
          name: string | null
          order_id: string | null
          reminders_sent: number
          status: Database["public"]["Enums"]["cart_status"]
          updated_at: string
          user_id: string
          value_fils: number
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          email: string
          id?: string
          item_count?: number
          last_reminder_at?: string | null
          lines?: Json
          link_opened_at?: string | null
          name?: string | null
          order_id?: string | null
          reminders_sent?: number
          status?: Database["public"]["Enums"]["cart_status"]
          updated_at?: string
          user_id: string
          value_fils?: number
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          item_count?: number
          last_reminder_at?: string | null
          lines?: Json
          link_opened_at?: string | null
          name?: string | null
          order_id?: string | null
          reminders_sent?: number
          status?: Database["public"]["Enums"]["cart_status"]
          updated_at?: string
          user_id?: string
          value_fils?: number
        }
        Relationships: [
          {
            foreignKeyName: "carts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_payment_summary"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "carts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      coupons: {
        Row: {
          active: boolean
          amount_fils: number | null
          category_ids: string[]
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          kind: Database["public"]["Enums"]["coupon_kind"]
          max_uses: number | null
          min_order_fils: number | null
          once_per_customer: boolean
          per_customer_limit: number | null
          percent_bp: number | null
          product_ids: string[]
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_fils?: number | null
          category_ids?: string[]
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["coupon_kind"]
          max_uses?: number | null
          min_order_fils?: number | null
          once_per_customer?: boolean
          per_customer_limit?: number | null
          percent_bp?: number | null
          product_ids?: string[]
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_fils?: number | null
          category_ids?: string[]
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["coupon_kind"]
          max_uses?: number | null
          min_order_fils?: number | null
          once_per_customer?: boolean
          per_customer_limit?: number | null
          percent_bp?: number | null
          product_ids?: string[]
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customer_segments: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          rules: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          rules?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          rules?: Json
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
        Relationships: [
          {
            foreignKeyName: "events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      flower_options: {
        Row: {
          active: boolean
          created_at: string
          hex: string
          id: string
          name: string
          price_fils: number
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          hex?: string
          id?: string
          name: string
          price_fils?: number
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          hex?: string
          id?: string
          name?: string
          price_fils?: number
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      gift_card_ledger: {
        Row: {
          amount_fils: number
          created_at: string
          created_by: string | null
          entry: Database["public"]["Enums"]["gift_card_entry"]
          gift_card_id: string
          id: number
          note: string | null
          order_id: string | null
          payment_id: string | null
        }
        Insert: {
          amount_fils: number
          created_at?: string
          created_by?: string | null
          entry: Database["public"]["Enums"]["gift_card_entry"]
          gift_card_id: string
          id?: never
          note?: string | null
          order_id?: string | null
          payment_id?: string | null
        }
        Update: {
          amount_fils?: number
          created_at?: string
          created_by?: string | null
          entry?: Database["public"]["Enums"]["gift_card_entry"]
          gift_card_id?: string
          id?: never
          note?: string | null
          order_id?: string | null
          payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_card_ledger_gift_card_id_fkey"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_payment_summary"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "gift_card_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_ledger_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          activated_at: string | null
          buyer_customer_id: string | null
          code: string
          created_at: string
          expires_at: string | null
          id: string
          initial_fils: number
          issued_by: string | null
          message: string | null
          note: string | null
          purchase_order_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          sender_name: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["gift_card_status"]
          updated_at: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          activated_at?: string | null
          buyer_customer_id?: string | null
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          initial_fils: number
          issued_by?: string | null
          message?: string | null
          note?: string | null
          purchase_order_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          sender_name?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["gift_card_status"]
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          activated_at?: string | null
          buyer_customer_id?: string | null
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          initial_fils?: number
          issued_by?: string | null
          message?: string | null
          note?: string | null
          purchase_order_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          sender_name?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["gift_card_status"]
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_buyer_customer_id_fkey"
            columns: ["buyer_customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_cards_buyer_customer_id_fkey"
            columns: ["buyer_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_cards_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_cards_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "order_payment_summary"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "gift_cards_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      help_topics: {
        Row: {
          body: string
          created_at: string
          id: string
          published: boolean
          slug: string
          sort: number
          title: string
          updated_at: string
          updated_by: string | null
          updated_label: string | null
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          published?: boolean
          slug: string
          sort?: number
          title: string
          updated_at?: string
          updated_by?: string | null
          updated_label?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          published?: boolean
          slug?: string
          sort?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
          updated_label?: string | null
        }
        Relationships: []
      }
      loyalty_programs: {
        Row: {
          created_at: string
          enabled: boolean
          id: number
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: number
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: number
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      loyalty_rewards: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          note: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          redeemed_order_id: string | null
          redeemed_order_line_id: string | null
          revoked_at: string | null
          reward_config: Json
          reward_label: string
          reward_type: Database["public"]["Enums"]["loyalty_reward_type"]
          rule_version_id: string
          source_order_id: string | null
          stamps_cost: number
          status: Database["public"]["Enums"]["loyalty_reward_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          note?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          redeemed_order_id?: string | null
          redeemed_order_line_id?: string | null
          revoked_at?: string | null
          reward_config?: Json
          reward_label: string
          reward_type: Database["public"]["Enums"]["loyalty_reward_type"]
          rule_version_id: string
          source_order_id?: string | null
          stamps_cost: number
          status?: Database["public"]["Enums"]["loyalty_reward_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          note?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          redeemed_order_id?: string | null
          redeemed_order_line_id?: string | null
          revoked_at?: string | null
          reward_config?: Json
          reward_label?: string
          reward_type?: Database["public"]["Enums"]["loyalty_reward_type"]
          rule_version_id?: string
          source_order_id?: string | null
          stamps_cost?: number
          status?: Database["public"]["Enums"]["loyalty_reward_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rewards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_rewards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_rewards_redeemed_order_id_fkey"
            columns: ["redeemed_order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_rewards_redeemed_order_id_fkey"
            columns: ["redeemed_order_id"]
            isOneToOne: false
            referencedRelation: "order_payment_summary"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "loyalty_rewards_redeemed_order_id_fkey"
            columns: ["redeemed_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_rewards_redeemed_order_line_id_fkey"
            columns: ["redeemed_order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_rewards_rule_version_id_fkey"
            columns: ["rule_version_id"]
            isOneToOne: false
            referencedRelation: "loyalty_rule_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_rewards_source_order_id_fkey"
            columns: ["source_order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_rewards_source_order_id_fkey"
            columns: ["source_order_id"]
            isOneToOne: false
            referencedRelation: "order_payment_summary"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "loyalty_rewards_source_order_id_fkey"
            columns: ["source_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rule_versions: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          expiry_months: number | null
          id: string
          issue_passport_after_purchases: number | null
          note: string | null
          program_id: number
          qualifying_category_ids: string[]
          qualifying_product_ids: string[]
          reward_config: Json
          reward_items_earn_stamps: boolean
          reward_label: string
          reward_type: Database["public"]["Enums"]["loyalty_reward_type"]
          stamps_for_reward: number
          stamps_per_item: number
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          expiry_months?: number | null
          id?: string
          issue_passport_after_purchases?: number | null
          note?: string | null
          program_id?: number
          qualifying_category_ids?: string[]
          qualifying_product_ids?: string[]
          reward_config?: Json
          reward_items_earn_stamps?: boolean
          reward_label: string
          reward_type: Database["public"]["Enums"]["loyalty_reward_type"]
          stamps_for_reward: number
          stamps_per_item: number
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          expiry_months?: number | null
          id?: string
          issue_passport_after_purchases?: number | null
          note?: string | null
          program_id?: number
          qualifying_category_ids?: string[]
          qualifying_product_ids?: string[]
          reward_config?: Json
          reward_items_earn_stamps?: boolean
          reward_label?: string
          reward_type?: Database["public"]["Enums"]["loyalty_reward_type"]
          stamps_for_reward?: number
          stamps_per_item?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rule_versions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_stamps: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          destination_id: string | null
          expires_at: string | null
          id: string
          kind: Database["public"]["Enums"]["loyalty_stamp_kind"]
          order_id: string | null
          order_line_id: string | null
          reason: string | null
          reverses_id: string | null
          reward_id: string | null
          rule_version_id: string | null
          stamps: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          destination_id?: string | null
          expires_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["loyalty_stamp_kind"]
          order_id?: string | null
          order_line_id?: string | null
          reason?: string | null
          reverses_id?: string | null
          reward_id?: string | null
          rule_version_id?: string | null
          stamps: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          destination_id?: string | null
          expires_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["loyalty_stamp_kind"]
          order_id?: string | null
          order_line_id?: string | null
          reason?: string | null
          reverses_id?: string | null
          reward_id?: string | null
          rule_version_id?: string | null
          stamps?: number
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_stamps_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_stamps_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_stamps_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_stamps_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_stamps_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_payment_summary"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "loyalty_stamps_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_stamps_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_stamps_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: false
            referencedRelation: "loyalty_stamps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_stamps_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "loyalty_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_stamps_rule_version_id_fkey"
            columns: ["rule_version_id"]
            isOneToOne: false
            referencedRelation: "loyalty_rule_versions"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "notification_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
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
          applied_promotions: Json
          booking_id: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          channel: Database["public"]["Enums"]["order_channel"]
          client_uuid: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          coupon_code: string | null
          coupon_id: string | null
          courier: string | null
          created_at: string
          customer_id: string | null
          delivery_address: Json | null
          delivery_discount_fils: number
          delivery_emirate: Database["public"]["Enums"]["emirate"] | null
          delivery_fee_fils: number
          discount_fils: number
          event_day: string | null
          event_id: string | null
          fulfilment: Database["public"]["Enums"]["fulfilment_type"]
          gift_card_purchase: boolean
          id: string
          internal_notes: string | null
          notes: string | null
          number: string
          paid_at: string | null
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
          applied_promotions?: Json
          booking_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          channel: Database["public"]["Enums"]["order_channel"]
          client_uuid?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          coupon_code?: string | null
          coupon_id?: string | null
          courier?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_address?: Json | null
          delivery_discount_fils?: number
          delivery_emirate?: Database["public"]["Enums"]["emirate"] | null
          delivery_fee_fils?: number
          discount_fils?: number
          event_day?: string | null
          event_id?: string | null
          fulfilment?: Database["public"]["Enums"]["fulfilment_type"]
          gift_card_purchase?: boolean
          id?: string
          internal_notes?: string | null
          notes?: string | null
          number?: string
          paid_at?: string | null
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
          applied_promotions?: Json
          booking_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          channel?: Database["public"]["Enums"]["order_channel"]
          client_uuid?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          coupon_code?: string | null
          coupon_id?: string | null
          courier?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_address?: Json | null
          delivery_discount_fils?: number
          delivery_emirate?: Database["public"]["Enums"]["emirate"] | null
          delivery_fee_fils?: number
          discount_fils?: number
          event_day?: string | null
          event_id?: string | null
          fulfilment?: Database["public"]["Enums"]["fulfilment_type"]
          gift_card_purchase?: boolean
          id?: string
          internal_notes?: string | null
          notes?: string | null
          number?: string
          paid_at?: string | null
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
            foreignKeyName: "orders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
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
      passports: {
        Row: {
          customer_id: string
          how: Database["public"]["Enums"]["passport_issue_how"]
          id: string
          issued_at: string
          issued_by: string | null
          number: string
          order_id: string | null
        }
        Insert: {
          customer_id: string
          how: Database["public"]["Enums"]["passport_issue_how"]
          id?: string
          issued_at?: string
          issued_by?: string | null
          number?: string
          order_id?: string | null
        }
        Update: {
          customer_id?: string
          how?: Database["public"]["Enums"]["passport_issue_how"]
          id?: string
          issued_at?: string
          issued_by?: string | null
          number?: string
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "passports_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passports_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_payment_summary"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "passports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
            foreignKeyName: "payment_links_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
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
      product_reviews: {
        Row: {
          author_name: string
          body: string
          created_at: string
          customer_id: string | null
          id: string
          moderated_at: string | null
          moderated_by: string | null
          order_id: string | null
          photos: string[]
          product_id: string
          rating: number
          status: Database["public"]["Enums"]["review_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name: string
          body: string
          created_at?: string
          customer_id?: string | null
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          order_id?: string | null
          photos?: string[]
          product_id: string
          rating: number
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          order_id?: string | null
          photos?: string[]
          product_id?: string
          rating?: number
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_payment_summary"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
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
          booking_flower_base_fils: number
          booking_quote_validity_days: number
          business_name: string
          cart_reminder_first_hours: number
          cart_reminder_second_hours: number | null
          cart_reminders_enabled: boolean
          contact_email: string | null
          contact_phone: string | null
          currency: string
          delivery_policy: string | null
          free_delivery_threshold_fils: number | null
          gift_card_amounts_fils: number[]
          gift_card_expiry_months: number | null
          gift_cards_at_pos: boolean
          gift_cards_enabled: boolean
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
          booking_flower_base_fils?: number
          booking_quote_validity_days?: number
          business_name?: string
          cart_reminder_first_hours?: number
          cart_reminder_second_hours?: number | null
          cart_reminders_enabled?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          currency?: string
          delivery_policy?: string | null
          free_delivery_threshold_fils?: number | null
          gift_card_amounts_fils?: number[]
          gift_card_expiry_months?: number | null
          gift_cards_at_pos?: boolean
          gift_cards_enabled?: boolean
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
          booking_flower_base_fils?: number
          booking_quote_validity_days?: number
          business_name?: string
          cart_reminder_first_hours?: number
          cart_reminder_second_hours?: number | null
          cart_reminders_enabled?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          currency?: string
          delivery_policy?: string | null
          free_delivery_threshold_fils?: number | null
          gift_card_amounts_fils?: number[]
          gift_card_expiry_months?: number | null
          gift_cards_at_pos?: boolean
          gift_cards_enabled?: boolean
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
            foreignKeyName: "orders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
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
      loyalty_balances: {
        Row: {
          balance: number | null
          collected: number | null
          customer_id: string | null
          last_stamp_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_stamps_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_stamps_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
      _booking_payment_order: {
        Args: { p_booking_id: string; p_kind: string }
        Returns: string
      }
      _confirm_booking: { Args: { p_booking_id: string }; Returns: string }
      accept_quote: {
        Args: { p_token: string }
        Returns: {
          deposit_fils: number
          ref: string
          status: Database["public"]["Enums"]["booking_status"]
        }[]
      }
      admin_order_stats: {
        Args: { p_day_end: string; p_day_start: string }
        Returns: {
          outstanding_count: number
          outstanding_fils: number
          today_count: number
          today_revenue_fils: number
        }[]
      }
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
      booking_estimate: { Args: { p: Json }; Returns: Json }
      booking_paid_fils: { Args: { p_booking_id: string }; Returns: number }
      booking_payment_order: {
        Args: { p_booking_id: string; p_kind: string }
        Returns: string
      }
      booking_status_counts: {
        Args: never
        Returns: {
          n: number
          status: Database["public"]["Enums"]["booking_status"]
        }[]
      }
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
      cart_order_paid: { Args: { p_order_id: string }; Returns: undefined }
      cart_reminder_sent: { Args: { p_cart: string }; Returns: undefined }
      cart_set_optout: {
        Args: { p_out: boolean; p_user: string }
        Returns: undefined
      }
      cart_stats: {
        Args: { p_from: string }
        Returns: {
          abandoned: number
          abandoned_fils: number
          recovered: number
          recovered_fils: number
          reminded: number
        }[]
      }
      cart_sync: {
        Args: { p_email: string; p_lines: Json; p_name: string; p_user: string }
        Returns: string
      }
      carts_due_for_reminder: {
        Args: never
        Returns: {
          closed_at: string | null
          created_at: string
          email: string
          id: string
          item_count: number
          last_reminder_at: string | null
          lines: Json
          link_opened_at: string | null
          name: string | null
          order_id: string | null
          reminders_sent: number
          status: Database["public"]["Enums"]["cart_status"]
          updated_at: string
          user_id: string
          value_fils: number
        }[]
        SetofOptions: {
          from: "*"
          to: "carts"
          isOneToOne: false
          isSetofReturn: true
        }
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
      confirm_booking: { Args: { p_booking_id: string }; Returns: string }
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
      coupon_covers: {
        Args: {
          c: Database["public"]["Tables"]["coupons"]["Row"]
          p_category: string
          p_product: string
        }
        Returns: boolean
      }
      coupon_evaluate: {
        Args: { p_code: string; p_email: string; p_lines: Json }
        Returns: Json
      }
      coupon_usage: {
        Args: never
        Returns: {
          coupon_id: string
          discount_fils: number
          uses: number
        }[]
      }
      coupon_uses: {
        Args: { p_coupon: string; p_email?: string }
        Returns: number
      }
      create_gift_card_order: {
        Args: { p: Json }
        Returns: {
          existing: boolean
          order_id: string
          order_number: string
          total_fils: number
        }[]
      }
      create_manual_order: {
        Args: { p: Json }
        Returns: {
          order_id: string
          order_number: string
          outstanding_fils: number
          total_fils: number
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
      customer_unsubscribe: { Args: { p_customer: string }; Returns: undefined }
      dashboard_summary: { Args: never; Returns: Json }
      event_report_data: { Args: { p_event_ids: string[] }; Returns: Json }
      event_staff_options: {
        Args: never
        Returns: {
          active: boolean
          full_name: string
          position: string
          user_id: string
        }[]
      }
      export_orders: { Args: { p_from: string; p_to: string }; Returns: Json }
      export_payments: { Args: { p_from: string; p_to: string }; Returns: Json }
      export_stock_levels: { Args: never; Returns: Json }
      fail_payment: {
        Args: { p_provider: string; p_provider_ref: string; p_reason: string }
        Returns: string
      }
      get_booking_quote: { Args: { p_token: string }; Returns: Json }
      gift_card_adjust: {
        Args: { p_amount: number; p_card: string; p_reason: string }
        Returns: number
      }
      gift_card_balance: { Args: { p_card: string }; Returns: number }
      gift_card_issue: { Args: { p: Json }; Returns: string }
      gift_card_lookup: { Args: { p_code: string }; Returns: Json }
      gift_card_new_code: { Args: never; Returns: string }
      gift_card_normalize: { Args: { p_code: string }; Returns: string }
      gift_card_redeem: {
        Args: { p_amount: number; p_code: string; p_order_id: string }
        Returns: string
      }
      gift_card_release_stale: {
        Args: never
        Returns: number
      }
      gift_card_summary: {
        Args: never
        Returns: {
          active_cards: number
          outstanding_fils: number
          redeemed_this_month_fils: number
          sold_this_month_fils: number
        }[]
      }
      gift_card_void: {
        Args: { p_card: string; p_reason: string }
        Returns: undefined
      }
      gift_cards_activate_for_order: {
        Args: { p_order_id: string }
        Returns: number
      }
      has_permission: { Args: { p_key: string }; Returns: boolean }
      is_own_customer: { Args: { p_customer_id: string }; Returns: boolean }
      is_own_order: { Args: { p_order_id: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      link_customer_account: {
        Args: never
        Returns: string
      }
      loyalty_active_rule: {
        Args: { p_at?: string }
        Returns: {
          created_at: string
          created_by: string | null
          effective_from: string
          expiry_months: number | null
          id: string
          issue_passport_after_purchases: number | null
          note: string | null
          program_id: number
          qualifying_category_ids: string[]
          qualifying_product_ids: string[]
          reward_config: Json
          reward_items_earn_stamps: boolean
          reward_label: string
          reward_type: Database["public"]["Enums"]["loyalty_reward_type"]
          stamps_for_reward: number
          stamps_per_item: number
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "loyalty_rule_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      loyalty_adjust_stamps: {
        Args: {
          p_customer_id: string
          p_destination_id?: string
          p_reason: string
          p_stamps: number
        }
        Returns: number
      }
      loyalty_award_order: { Args: { p_order_id: string }; Returns: number }
      loyalty_expire_stamps: {
        Args: { p_customer_id: string }
        Returns: number
      }
      loyalty_issue_passport: {
        Args: {
          p_customer_id: string
          p_how?: Database["public"]["Enums"]["passport_issue_how"]
        }
        Returns: string
      }
      loyalty_line_qualifies: {
        Args: {
          p_category_id: string
          p_is_reward: boolean
          p_product_id: string
          r: Database["public"]["Tables"]["loyalty_rule_versions"]["Row"]
        }
        Returns: boolean
      }
      loyalty_overview: {
        Args: never
        Returns: {
          members: number
          passports_issued: number
          rewards_available: number
          rewards_redeemed: number
          stamps_30d: number
          stamps_collected: number
          stamps_on_cards: number
        }[]
      }
      loyalty_redeem_reward: {
        Args: {
          p_location_id?: string
          p_note?: string
          p_order_id?: string
          p_reward_id: string
          p_variant_id?: string
        }
        Returns: {
          order_id: string
          order_number: string
        }[]
      }
      loyalty_reverse_order: {
        Args: {
          p_order_id: string
          p_reason: string
          p_restore_rewards?: boolean
        }
        Returns: number
      }
      loyalty_reward_options: {
        Args: { p_reward_id: string }
        Returns: {
          destination_name: string
          on_hand: number
          price_fils: number
          product_name: string
          sku: string
          variant_id: string
          variant_label: string
        }[]
      }
      loyalty_save_rules: { Args: { p: Json }; Returns: string }
      loyalty_settle: {
        Args: { p_customer_id: string; p_order_id?: string }
        Returns: number
      }
      marketing_opt_in: {
        Args: { p_channel: string; p_email?: string; p_phone?: string }
        Returns: undefined
      }
      my_permissions: { Args: never; Returns: string[] }
      next_booking_ref: { Args: never; Returns: string }
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
      order_attach_customer: {
        Args: {
          p_email: string
          p_name?: string
          p_order_id: string
          p_phone: string
        }
        Returns: string
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
      pos_complete_sale: {
        Args: { p: Json }
        Returns: {
          existing: boolean
          order_id: string
          order_number: string
          total_fils: number
        }[]
      }
      pos_day_summary: {
        Args: { p_day?: string; p_event_id: string }
        Returns: Json
      }
      promotion_report: {
        Args: { p_from: string; p_to: string }
        Returns: {
          code: string
          coupon_id: string
          delivery_discount_fils: number
          discount_fils: number
          first_order_at: string
          last_order_at: string
          orders: number
          sales_fils: number
        }[]
      }
      quote_payment_order: {
        Args: { p_kind: string; p_token: string }
        Returns: string
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
      report_event_options: {
        Args: never
        Returns: {
          emirate: Database["public"]["Enums"]["emirate"]
          end_date: string
          id: string
          location: string
          name: string
          order_count: number
          start_date: string
          status: Database["public"]["Enums"]["event_status"]
          type: Database["public"]["Enums"]["event_type"]
          units: number
        }[]
      }
      request_ip: { Args: never; Returns: unknown }
      require_permission: { Args: { p_key: string }; Returns: undefined }
      review_purchase: {
        Args: {
          p_email: string
          p_order_ids: string[]
          p_product: string
          p_user: string
        }
        Returns: string
      }
      review_status_counts: {
        Args: never
        Returns: {
          count: number
          status: Database["public"]["Enums"]["review_status"]
        }[]
      }
      segment_members: {
        Args: { p_rules: Json }
        Returns: {
          customer_id: string
          email: string
          emailable: boolean
          emirate: Database["public"]["Enums"]["emirate"]
          has_passport: boolean
          last_purchase_at: string
          name: string
          order_count: number
          total_spent_fils: number
        }[]
      }
      send_booking_quote: {
        Args: { p: Json }
        Returns: {
          deposit_fils: number
          quote_id: string
          token: string
          total_fils: number
          version: number
        }[]
      }
      set_booking_status: {
        Args: {
          p_booking_id: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["booking_status"]
        }
        Returns: undefined
      }
      settle_if_paid: { Args: { p_order_id: string }; Returns: boolean }
      stock_on_hand_by_variant: {
        Args: never
        Returns: {
          on_hand: number
          variant_id: string
        }[]
      }
      submit_booking: {
        Args: { p: Json }
        Returns: {
          booking_id: string
          estimated_total_fils: number
          existing: boolean
          ref: string
        }[]
      }
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
      update_booking_settings: {
        Args: {
          p_deposit_bp: number
          p_flower_base_fils: number
          p_quote_validity_days: number
        }
        Returns: undefined
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
      booking_message_channel: "email" | "whatsapp_link" | "internal"
      booking_message_direction: "in" | "out" | "note"
      booking_quote_status: "sent" | "accepted" | "superseded" | "withdrawn"
      booking_status:
        | "requested"
        | "in_review"
        | "quoted"
        | "accepted"
        | "confirmed"
        | "completed"
        | "rejected"
        | "cancelled"
      campaign_recipient_status: "pending" | "sent" | "failed" | "skipped"
      campaign_status: "draft" | "sending" | "sent"
      cart_status: "open" | "converted" | "emptied"
      coupon_kind: "percent" | "fixed" | "free_delivery"
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
        "full_time" | "part_time" | "freelance" | "event_only" | "former"
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
        "unpaid" | "partially_paid" | "paid" | "waived" | "not_applicable"
      fulfilment_type: "delivery" | "pickup" | "handed_over"
      gift_card_entry: "issue" | "redeem" | "refund" | "adjust" | "void"
      gift_card_status: "pending" | "active" | "void"
      location_kind: "warehouse" | "event" | "other"
      loyalty_reward_status: "available" | "redeemed" | "expired" | "revoked"
      loyalty_reward_type:
        | "choose_from_category"
        | "specific_products"
        | "fixed_amount"
        | "percent"
      loyalty_stamp_kind:
        "earned" | "manual" | "reversed" | "redeemed" | "expired"
      notification_audience: "customer" | "owner"
      notification_channel: "email" | "whatsapp"
      notification_status: "sent" | "failed" | "skipped"
      order_channel:
        "website" | "pos" | "whatsapp" | "direct" | "payment_link" | "booking"
      order_status:
        | "pending_payment"
        | "new"
        | "preparing"
        | "dispatched"
        | "delivered"
        | "completed"
        | "cancelled"
      passport_issue_how: "auto" | "request" | "manual"
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
        | "gift_card"
      payment_state: "pending" | "succeeded" | "failed" | "cancelled"
      review_status: "pending" | "approved" | "declined"
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      booking_message_channel: ["email", "whatsapp_link", "internal"],
      booking_message_direction: ["in", "out", "note"],
      booking_quote_status: ["sent", "accepted", "superseded", "withdrawn"],
      booking_status: [
        "requested",
        "in_review",
        "quoted",
        "accepted",
        "confirmed",
        "completed",
        "rejected",
        "cancelled",
      ],
      campaign_recipient_status: ["pending", "sent", "failed", "skipped"],
      campaign_status: ["draft", "sending", "sent"],
      cart_status: ["open", "converted", "emptied"],
      coupon_kind: ["percent", "fixed", "free_delivery"],
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
      gift_card_entry: ["issue", "redeem", "refund", "adjust", "void"],
      gift_card_status: ["pending", "active", "void"],
      location_kind: ["warehouse", "event", "other"],
      loyalty_reward_status: ["available", "redeemed", "expired", "revoked"],
      loyalty_reward_type: [
        "choose_from_category",
        "specific_products",
        "fixed_amount",
        "percent",
      ],
      loyalty_stamp_kind: [
        "earned",
        "manual",
        "reversed",
        "redeemed",
        "expired",
      ],
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
      passport_issue_how: ["auto", "request", "manual"],
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
        "gift_card",
      ],
      payment_state: ["pending", "succeeded", "failed", "cancelled"],
      review_status: ["pending", "approved", "declined"],
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
