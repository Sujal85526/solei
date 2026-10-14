
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"after": Json | null,"before": Json | null,"created_at": string,"entity": string,"entity_id": string | null,"id": number,"ip": unknown
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity": string,"entity_id"?: string | null,"id"?: never,"ip"?: unknown
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity"?: string,"entity_id"?: string | null,"id"?: never,"ip"?: unknown
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "active": boolean,"created_at": string,"description": string | null,"id": string,"image_url": string | null,"name": string,"slug": string,"sort": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"description"?: string | null,"id"?: string,"image_url"?: string | null,"name": string,"slug": string,"sort"?: number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"description"?: string | null,"id"?: string,"image_url"?: string | null,"name"?: string,"slug"?: string,"sort"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"customers": {
                  Row: {
                    "address": Json | null,"auth_user_id": string | null,"created_at": string,"email": string | null,"emirate": Database["public"]['Enums']["emirate"] | null,"id": string,"marketing_channels": (string)[],"marketing_consent": boolean,"marketing_consent_at": string | null,"name": string | null,"notes": string | null,"phone": string | null,"source": Database["public"]['Enums']["customer_source"],"unsubscribed_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: Json | null,"auth_user_id"?: string | null,"created_at"?: string,"email"?: string | null,"emirate"?: Database["public"]['Enums']["emirate"] | null,"id"?: string,"marketing_channels"?: (string)[],"marketing_consent"?: boolean,"marketing_consent_at"?: string | null,"name"?: string | null,"notes"?: string | null,"phone"?: string | null,"source"?: Database["public"]['Enums']["customer_source"],"unsubscribed_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: Json | null,"auth_user_id"?: string | null,"created_at"?: string,"email"?: string | null,"emirate"?: Database["public"]['Enums']["emirate"] | null,"id"?: string,"marketing_channels"?: (string)[],"marketing_consent"?: boolean,"marketing_consent_at"?: string | null,"name"?: string | null,"notes"?: string | null,"phone"?: string | null,"source"?: Database["public"]['Enums']["customer_source"],"unsubscribed_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"delivery_zones": {
                  Row: {
                    "active": boolean,"emirate": Database["public"]['Enums']["emirate"],"fee_fils": number,"name": string,"sort": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"emirate": Database["public"]['Enums']["emirate"],"fee_fils"?: number,"name": string,"sort"?: number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"emirate"?: Database["public"]['Enums']["emirate"],"fee_fils"?: number,"name"?: string,"sort"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"destinations": {
                  Row: {
                    "accent_colour": string | null,"active": boolean,"country": string | null,"created_at": string,"hero_image_url": string | null,"id": string,"mood": string | null,"name": string,"postcard_image_url": string | null,"region": string | null,"slug": string,"sort": number,"story": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accent_colour"?: string | null,"active"?: boolean,"country"?: string | null,"created_at"?: string,"hero_image_url"?: string | null,"id"?: string,"mood"?: string | null,"name": string,"postcard_image_url"?: string | null,"region"?: string | null,"slug": string,"sort"?: number,"story"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "accent_colour"?: string | null,"active"?: boolean,"country"?: string | null,"created_at"?: string,"hero_image_url"?: string | null,"id"?: string,"mood"?: string | null,"name"?: string,"postcard_image_url"?: string | null,"region"?: string | null,"slug"?: string,"sort"?: number,"story"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"events": {
                  Row: {
                    "booking_id": string | null,"booth_details": string | null,"closed_at": string | null,"created_at": string,"created_by": string | null,"daily_hours": NonNullable<Json>,"emirate": Database["public"]['Enums']["emirate"] | null,"end_date": string,"fee_payment_status": Database["public"]['Enums']["fee_payment_status"],"id": string,"location": string | null,"name": string,"notes": string | null,"organiser_contact": string | null,"organiser_email": string | null,"organiser_name": string | null,"organiser_phone": string | null,"participation_fee_fils": number,"start_date": string,"status": Database["public"]['Enums']["event_status"],"type": Database["public"]['Enums']["event_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id"?: string | null,"booth_details"?: string | null,"closed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"daily_hours"?: NonNullable<Json>,"emirate"?: Database["public"]['Enums']["emirate"] | null,"end_date": string,"fee_payment_status"?: Database["public"]['Enums']["fee_payment_status"],"id"?: string,"location"?: string | null,"name": string,"notes"?: string | null,"organiser_contact"?: string | null,"organiser_email"?: string | null,"organiser_name"?: string | null,"organiser_phone"?: string | null,"participation_fee_fils"?: number,"start_date": string,"status"?: Database["public"]['Enums']["event_status"],"type"?: Database["public"]['Enums']["event_type"],"updated_at"?: string
                  }
                  Update: {
                    "booking_id"?: string | null,"booth_details"?: string | null,"closed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"daily_hours"?: NonNullable<Json>,"emirate"?: Database["public"]['Enums']["emirate"] | null,"end_date"?: string,"fee_payment_status"?: Database["public"]['Enums']["fee_payment_status"],"id"?: string,"location"?: string | null,"name"?: string,"notes"?: string | null,"organiser_contact"?: string | null,"organiser_email"?: string | null,"organiser_name"?: string | null,"organiser_phone"?: string | null,"participation_fee_fils"?: number,"start_date"?: string,"status"?: Database["public"]['Enums']["event_status"],"type"?: Database["public"]['Enums']["event_type"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"order_line_costs": {
                  Row: {
                    "order_line_id": string,"unit_cost_fils": number
                  }
                  ComputedFields: never
                  Insert: {
                    "order_line_id": string,"unit_cost_fils"?: number
                  }
                  Update: {
                    "order_line_id"?: string,"unit_cost_fils"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_line_costs_order_line_id_fkey"
      columns: ["order_line_id"]
isOneToOne: true
      referencedRelation: "order_lines"
      referencedColumns: ["id"]
    }
                  ]
                },"order_lines": {
                  Row: {
                    "category_id": string | null,"created_at": string,"destination_id": string | null,"discount_fils": number,"id": string,"is_reward": boolean,"line_total_fils": number,"list_price_fils": number,"order_id": string,"price_override_reason": string | null,"product_name": string,"qty": number,"sku": string,"unit_price_fils": number,"variant_id": string,"variant_label": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"created_at"?: string,"destination_id"?: string | null,"discount_fils"?: number,"id"?: string,"is_reward"?: boolean,"line_total_fils": number,"list_price_fils": number,"order_id": string,"price_override_reason"?: string | null,"product_name": string,"qty": number,"sku": string,"unit_price_fils": number,"variant_id": string,"variant_label"?: string
                  }
                  Update: {
                    "category_id"?: string | null,"created_at"?: string,"destination_id"?: string | null,"discount_fils"?: number,"id"?: string,"is_reward"?: boolean,"line_total_fils"?: number,"list_price_fils"?: number,"order_id"?: string,"price_override_reason"?: string | null,"product_name"?: string,"qty"?: number,"sku"?: string,"unit_price_fils"?: number,"variant_id"?: string,"variant_label"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_lines_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_lines_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "destinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_lines_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "order_payment_summary"
      referencedColumns: ["order_id"]
    },{
      foreignKeyName: "order_lines_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_lines_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"order_status_history": {
                  Row: {
                    "changed_by": string | null,"created_at": string,"from_status": Database["public"]['Enums']["order_status"] | null,"id": number,"note": string | null,"order_id": string,"to_status": Database["public"]['Enums']["order_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_by"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["order_status"] | null,"id"?: never,"note"?: string | null,"order_id": string,"to_status": Database["public"]['Enums']["order_status"]
                  }
                  Update: {
                    "changed_by"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["order_status"] | null,"id"?: never,"note"?: string | null,"order_id"?: string,"to_status"?: Database["public"]['Enums']["order_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_status_history_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "order_payment_summary"
      referencedColumns: ["order_id"]
    },{
      foreignKeyName: "order_status_history_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "booking_id": string | null,"cancel_reason": string | null,"cancelled_at": string | null,"channel": Database["public"]['Enums']["order_channel"],"client_uuid": string | null,"contact_email": string | null,"contact_name": string | null,"contact_phone": string | null,"courier": string | null,"created_at": string,"customer_id": string | null,"delivery_address": Json | null,"delivery_emirate": Database["public"]['Enums']["emirate"] | null,"delivery_fee_fils": number,"discount_fils": number,"event_day": string | null,"event_id": string | null,"fulfilment": Database["public"]['Enums']["fulfilment_type"],"id": string,"internal_notes": string | null,"notes": string | null,"number": string,"placed_at": string,"prices_include_vat": boolean,"staff_id": string | null,"status": Database["public"]['Enums']["order_status"],"subtotal_fils": number,"total_fils": number,"tracking_number": string | null,"updated_at": string,"vat_fils": number,"vat_rate_bp": number
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"channel": Database["public"]['Enums']["order_channel"],"client_uuid"?: string | null,"contact_email"?: string | null,"contact_name"?: string | null,"contact_phone"?: string | null,"courier"?: string | null,"created_at"?: string,"customer_id"?: string | null,"delivery_address"?: Json | null,"delivery_emirate"?: Database["public"]['Enums']["emirate"] | null,"delivery_fee_fils"?: number,"discount_fils"?: number,"event_day"?: string | null,"event_id"?: string | null,"fulfilment"?: Database["public"]['Enums']["fulfilment_type"],"id"?: string,"internal_notes"?: string | null,"notes"?: string | null,"number"?: string,"placed_at"?: string,"prices_include_vat"?: boolean,"staff_id"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"subtotal_fils"?: number,"total_fils"?: number,"tracking_number"?: string | null,"updated_at"?: string,"vat_fils"?: number,"vat_rate_bp"?: number
                  }
                  Update: {
                    "booking_id"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"channel"?: Database["public"]['Enums']["order_channel"],"client_uuid"?: string | null,"contact_email"?: string | null,"contact_name"?: string | null,"contact_phone"?: string | null,"courier"?: string | null,"created_at"?: string,"customer_id"?: string | null,"delivery_address"?: Json | null,"delivery_emirate"?: Database["public"]['Enums']["emirate"] | null,"delivery_fee_fils"?: number,"discount_fils"?: number,"event_day"?: string | null,"event_id"?: string | null,"fulfilment"?: Database["public"]['Enums']["fulfilment_type"],"id"?: string,"internal_notes"?: string | null,"notes"?: string | null,"number"?: string,"placed_at"?: string,"prices_include_vat"?: boolean,"staff_id"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"subtotal_fils"?: number,"total_fils"?: number,"tracking_number"?: string | null,"updated_at"?: string,"vat_fils"?: number,"vat_rate_bp"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_events": {
                  Row: {
                    "error": string | null,"event_id": string,"id": number,"payload": Json | null,"processed_at": string | null,"provider": string,"received_at": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"event_id": string,"id"?: never,"payload"?: Json | null,"processed_at"?: string | null,"provider": string,"received_at"?: string,"type": string
                  }
                  Update: {
                    "error"?: string | null,"event_id"?: string,"id"?: never,"payload"?: Json | null,"processed_at"?: string | null,"provider"?: string,"received_at"?: string,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"payment_links": {
                  Row: {
                    "amount_fils": number,"booking_id": string | null,"created_at": string,"created_by": string | null,"description": string | null,"expires_at": string | null,"id": string,"order_id": string | null,"provider": string,"provider_id": string | null,"status": Database["public"]['Enums']["payment_link_status"],"updated_at": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_fils": number,"booking_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"expires_at"?: string | null,"id"?: string,"order_id"?: string | null,"provider"?: string,"provider_id"?: string | null,"status"?: Database["public"]['Enums']["payment_link_status"],"updated_at"?: string,"url"?: string | null
                  }
                  Update: {
                    "amount_fils"?: number,"booking_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"expires_at"?: string | null,"id"?: string,"order_id"?: string | null,"provider"?: string,"provider_id"?: string | null,"status"?: Database["public"]['Enums']["payment_link_status"],"updated_at"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_links_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "order_payment_summary"
      referencedColumns: ["order_id"]
    },{
      foreignKeyName: "payment_links_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_fils": number,"created_at": string,"id": string,"kind": Database["public"]['Enums']["payment_kind"],"method": Database["public"]['Enums']["payment_method"],"note": string | null,"order_id": string,"provider": string | null,"provider_payload": Json | null,"provider_ref": string | null,"received_at": string | null,"received_by": string | null,"reference": string | null,"status": Database["public"]['Enums']["payment_state"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_fils": number,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["payment_kind"],"method": Database["public"]['Enums']["payment_method"],"note"?: string | null,"order_id": string,"provider"?: string | null,"provider_payload"?: Json | null,"provider_ref"?: string | null,"received_at"?: string | null,"received_by"?: string | null,"reference"?: string | null,"status"?: Database["public"]['Enums']["payment_state"],"updated_at"?: string
                  }
                  Update: {
                    "amount_fils"?: number,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["payment_kind"],"method"?: Database["public"]['Enums']["payment_method"],"note"?: string | null,"order_id"?: string,"provider"?: string | null,"provider_payload"?: Json | null,"provider_ref"?: string | null,"received_at"?: string | null,"received_by"?: string | null,"reference"?: string | null,"status"?: Database["public"]['Enums']["payment_state"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "order_payment_summary"
      referencedColumns: ["order_id"]
    },{
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"permissions": {
                  Row: {
                    "description": string,"group": string,"key": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"group": string,"key": string,"sort"?: number
                  }
                  Update: {
                    "description"?: string,"group"?: string,"key"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"private_settings": {
                  Row: {
                    "id": number,"low_stock_default": number,"owner_notification_email": string | null,"owner_notification_phone": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: number,"low_stock_default"?: number,"owner_notification_email"?: string | null,"owner_notification_phone"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "id"?: number,"low_stock_default"?: number,"owner_notification_email"?: string | null,"owner_notification_phone"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"product_images": {
                  Row: {
                    "alt": string,"created_at": string,"id": string,"product_id": string,"sort": number,"storage_path": string | null,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alt"?: string,"created_at"?: string,"id"?: string,"product_id": string,"sort"?: number,"storage_path"?: string | null,"url": string
                  }
                  Update: {
                    "alt"?: string,"created_at"?: string,"id"?: string,"product_id"?: string,"sort"?: number,"storage_path"?: string | null,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_images_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"product_variants": {
                  Row: {
                    "active": boolean,"barcode": string | null,"created_at": string,"id": string,"label": string,"low_stock_threshold": number | null,"price_fils": number,"product_id": string,"size_ml": number | null,"sku": string,"sort": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"barcode"?: string | null,"created_at"?: string,"id"?: string,"label"?: string,"low_stock_threshold"?: number | null,"price_fils": number,"product_id": string,"size_ml"?: number | null,"sku": string,"sort"?: number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"barcode"?: string | null,"created_at"?: string,"id"?: string,"label"?: string,"low_stock_threshold"?: number | null,"price_fils"?: number,"product_id"?: string,"size_ml"?: number | null,"sku"?: string,"sort"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_variants_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "active": boolean,"category_id": string,"created_at": string,"description": string | null,"destination_id": string | null,"featured": boolean,"id": string,"name": string,"notes_base": (string)[],"notes_heart": (string)[],"notes_top": (string)[],"slug": string,"sort": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"category_id": string,"created_at"?: string,"description"?: string | null,"destination_id"?: string | null,"featured"?: boolean,"id"?: string,"name": string,"notes_base"?: (string)[],"notes_heart"?: (string)[],"notes_top"?: (string)[],"slug": string,"sort"?: number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"category_id"?: string,"created_at"?: string,"description"?: string | null,"destination_id"?: string | null,"featured"?: boolean,"id"?: string,"name"?: string,"notes_base"?: (string)[],"notes_heart"?: (string)[],"notes_top"?: (string)[],"slug"?: string,"sort"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "destinations"
      referencedColumns: ["id"]
    }
                  ]
                },"role_permissions": {
                  Row: {
                    "permission_key": string,"role_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "permission_key": string,"role_id": string
                  }
                  Update: {
                    "permission_key"?: string,"role_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_permissions_permission_key_fkey"
      columns: ["permission_key"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "role_permissions_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    }
                  ]
                },"roles": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"is_system": boolean,"key": string,"name": string,"requires_mfa": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_system"?: boolean,"key": string,"name": string,"requires_mfa"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_system"?: boolean,"key"?: string,"name"?: string,"requires_mfa"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"settings": {
                  Row: {
                    "booking_deposit_bp": number,"business_name": string,"contact_email": string | null,"contact_phone": string | null,"currency": string,"delivery_policy": string | null,"free_delivery_threshold_fils": number | null,"id": number,"instagram_handle": string | null,"instagram_url": string | null,"legal_name": string | null,"prices_include_vat": boolean,"returns_policy": string | null,"trn": string | null,"updated_at": string,"updated_by": string | null,"vat_rate_bp": number,"whatsapp_number": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_deposit_bp"?: number,"business_name"?: string,"contact_email"?: string | null,"contact_phone"?: string | null,"currency"?: string,"delivery_policy"?: string | null,"free_delivery_threshold_fils"?: number | null,"id"?: number,"instagram_handle"?: string | null,"instagram_url"?: string | null,"legal_name"?: string | null,"prices_include_vat"?: boolean,"returns_policy"?: string | null,"trn"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"vat_rate_bp"?: number,"whatsapp_number"?: string | null
                  }
                  Update: {
                    "booking_deposit_bp"?: number,"business_name"?: string,"contact_email"?: string | null,"contact_phone"?: string | null,"currency"?: string,"delivery_policy"?: string | null,"free_delivery_threshold_fils"?: number | null,"id"?: number,"instagram_handle"?: string | null,"instagram_url"?: string | null,"legal_name"?: string | null,"prices_include_vat"?: boolean,"returns_policy"?: string | null,"trn"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"vat_rate_bp"?: number,"whatsapp_number"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"staff_profiles": {
                  Row: {
                    "active": boolean,"created_at": string,"created_by": string | null,"deactivated_at": string | null,"email": string,"employment_status": Database["public"]['Enums']["employment_status"],"full_name": string,"phone": string | null,"position": string | null,"role_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"deactivated_at"?: string | null,"email": string,"employment_status"?: Database["public"]['Enums']["employment_status"],"full_name": string,"phone"?: string | null,"position"?: string | null,"role_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"deactivated_at"?: string | null,"email"?: string,"employment_status"?: Database["public"]['Enums']["employment_status"],"full_name"?: string,"phone"?: string | null,"position"?: string | null,"role_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_profiles_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_locations": {
                  Row: {
                    "active": boolean,"created_at": string,"event_id": string | null,"id": string,"is_default": boolean,"kind": Database["public"]['Enums']["location_kind"],"name": string,"sells_online": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"event_id"?: string | null,"id"?: string,"is_default"?: boolean,"kind"?: Database["public"]['Enums']["location_kind"],"name": string,"sells_online"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"event_id"?: string | null,"id"?: string,"is_default"?: boolean,"kind"?: Database["public"]['Enums']["location_kind"],"name"?: string,"sells_online"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_locations_event_id_fkey"
      columns: ["event_id"]
isOneToOne: true
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_movements": {
                  Row: {
                    "created_at": string,"created_by": string | null,"event_id": string | null,"id": string,"location_id": string,"order_line_id": string | null,"qty": number,"reason": string | null,"transfer_id": string | null,"type": Database["public"]['Enums']["stock_movement_type"],"variant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"event_id"?: string | null,"id"?: string,"location_id": string,"order_line_id"?: string | null,"qty": number,"reason"?: string | null,"transfer_id"?: string | null,"type": Database["public"]['Enums']["stock_movement_type"],"variant_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"event_id"?: string | null,"id"?: string,"location_id"?: string,"order_line_id"?: string | null,"qty"?: number,"reason"?: string | null,"transfer_id"?: string | null,"type"?: Database["public"]['Enums']["stock_movement_type"],"variant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "stock_locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_order_line_fk"
      columns: ["order_line_id"]
isOneToOne: false
      referencedRelation: "order_lines"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"variant_costs": {
                  Row: {
                    "cost_fils": number,"updated_at": string,"updated_by": string | null,"variant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cost_fils"?: number,"updated_at"?: string,"updated_by"?: string | null,"variant_id": string
                  }
                  Update: {
                    "cost_fils"?: number,"updated_at"?: string,"updated_by"?: string | null,"variant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "variant_costs_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: true
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "order_payment_summary": {
                  Row: {
                    "order_id": string | null,"outstanding_fils": number | null,"paid_fils": number | null,"payment_status": string | null,"refunded_fils": number | null,"total_fils": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"stock_levels": {
                  Row: {
                    "last_movement_at": string | null,"location_id": string | null,"on_hand": number | null,"variant_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "stock_locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "after_order_paid":
{ Args: { "p_order_id": string }; Returns: undefined
                           },
"apply_order_stock":
{ Args: { "p_order_id": string }; Returns: undefined
                           },
"business_day":
{ Args: { "ts": string }; Returns: string
                           },
"business_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"confirm_payment":
{ Args: { "p_amount_fils": number,"p_method": Database["public"]['Enums']["payment_method"],"p_payload"?: Json,"p_provider": string,"p_provider_ref": string }; Returns: {
              "already_processed": boolean,"newly_paid": boolean,"order_id": string,"order_number": string
            }[]
                           },
"create_web_order":
{ Args: { "p": Json }; Returns: {
              "existing": boolean,"order_id": string,"order_number": string,"total_fils": number
            }[]
                           },
"current_staff_role":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,
"description": string | null,
"id": string,
"is_system": boolean,
"key": string,
"name": string,
"requires_mfa": boolean,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "roles"
        isOneToOne: true
        isSetofReturn: false
      } },
"fail_payment":
{ Args: { "p_provider": string,"p_provider_ref": string,"p_reason": string }; Returns: string
                           },
"has_permission":
{ Args: { "p_key": string }; Returns: boolean
                           },
"is_own_order":
{ Args: { "p_order_id": string }; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"marketing_opt_in":
{ Args: { "p_channel": string,"p_email"?: string,"p_phone"?: string }; Returns: undefined
                           },
"my_permissions":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"next_order_number":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"on_hand":
{ Args: { "p_location_id": string,"p_variant_id": string }; Returns: number
                           },
"online_availability":
{ Args: { "p_variant_ids": (string)[] }; Returns: {
              "available": number,"variant_id": string
            }[]
                           },
"record_stock_movement":
{ Args: { "p_location_id": string,"p_qty": number,"p_reason"?: string,"p_type": Database["public"]['Enums']["stock_movement_type"],"p_variant_id": string }; Returns: string
                           },
"request_ip":
{ Args: Record<PropertyKey, never>; Returns: unknown
                           },
"require_permission":
{ Args: { "p_key": string }; Returns: undefined
                           },
"track_order":
{ Args: { "p_number": string,"p_phone": string }; Returns: {
              "courier": string,"fulfilment": Database["public"]['Enums']["fulfilment_type"],"history": Json,"lines": Json,"number": string,"payment_status": string,"placed_at": string,"status": Database["public"]['Enums']["order_status"],"total_fils": number,"tracking_number": string
            }[]
                           },
"transfer_stock":
{ Args: { "p_allow_negative"?: boolean,"p_from_location": string,"p_qty": number,"p_reason"?: string,"p_to_location": string,"p_variant_id": string }; Returns: string
                           },
"upsert_customer":
{ Args: { "p_address"?: Json,"p_email": string,"p_emirate"?: Database["public"]['Enums']["emirate"],"p_marketing_channel"?: string,"p_marketing_consent"?: boolean,"p_name"?: string,"p_phone": string,"p_source"?: Database["public"]['Enums']["customer_source"] }; Returns: string
                           },
"write_audit":
{ Args: { "p_action": string,"p_after"?: Json,"p_before"?: Json,"p_entity": string,"p_entity_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "customer_source": "website"|"pos"|"whatsapp"|"direct"|"booking"|"newsletter"|"import"|"manual","emirate": "abu_dhabi"|"dubai"|"sharjah"|"ajman"|"umm_al_quwain"|"ras_al_khaimah"|"fujairah","employment_status": "full_time"|"part_time"|"freelance"|"event_only"|"former","event_status": "potential"|"confirmed"|"completed"|"cancelled","event_type": "exhibition"|"popup"|"private_booking"|"other","fee_payment_status": "unpaid"|"partially_paid"|"paid"|"waived"|"not_applicable","fulfilment_type": "delivery"|"pickup"|"handed_over","location_kind": "warehouse"|"event"|"other","order_channel": "website"|"pos"|"whatsapp"|"direct"|"payment_link"|"booking","order_status": "pending_payment"|"new"|"preparing"|"dispatched"|"delivered"|"completed"|"cancelled","payment_kind": "payment"|"refund","payment_link_status": "active"|"paid"|"expired"|"cancelled","payment_method": "online_card"|"apple_pay"|"cash"|"card_terminal"|"soft_pos"|"bank_transfer"|"payment_link"|"other","payment_state": "pending"|"succeeded"|"failed"|"cancelled","stock_movement_type": "receive"|"sale"|"refund_return"|"transfer_out"|"transfer_in"|"damage"|"adjustment"|"reward_redemption"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "customer_source": ["website", "pos", "whatsapp", "direct", "booking", "newsletter", "import", "manual"],"emirate": ["abu_dhabi", "dubai", "sharjah", "ajman", "umm_al_quwain", "ras_al_khaimah", "fujairah"],"employment_status": ["full_time", "part_time", "freelance", "event_only", "former"],"event_status": ["potential", "confirmed", "completed", "cancelled"],"event_type": ["exhibition", "popup", "private_booking", "other"],"fee_payment_status": ["unpaid", "partially_paid", "paid", "waived", "not_applicable"],"fulfilment_type": ["delivery", "pickup", "handed_over"],"location_kind": ["warehouse", "event", "other"],"order_channel": ["website", "pos", "whatsapp", "direct", "payment_link", "booking"],"order_status": ["pending_payment", "new", "preparing", "dispatched", "delivered", "completed", "cancelled"],"payment_kind": ["payment", "refund"],"payment_link_status": ["active", "paid", "expired", "cancelled"],"payment_method": ["online_card", "apple_pay", "cash", "card_terminal", "soft_pos", "bank_transfer", "payment_link", "other"],"payment_state": ["pending", "succeeded", "failed", "cancelled"],"stock_movement_type": ["receive", "sale", "refund_return", "transfer_out", "transfer_in", "damage", "adjustment", "reward_redemption"]
          }
        }
} as const
