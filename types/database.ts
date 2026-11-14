/**
 * Mirrors supabase/migrations/*.sql in the format produced by the Supabase CLI.
 * Regenerate after any schema change:
 *   npx supabase gen types typescript --project-id <ref> --schema public > types/database.ts
 * (then keep the helper aliases at the bottom).
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      page_drafts: {
        Row: { id: string; document: Json; revision: number; updated_at: string };
        Insert: { id?: string; document: Json; revision?: number; updated_at?: string };
        Update: { id?: string; document?: Json; revision?: number; updated_at?: string };
        Relationships: [];
      };
      homepage_draft: {
        Row: { singleton: boolean; document: Json; revision: number; updated_at: string };
        Insert: { singleton?: boolean; document: Json; revision?: number; updated_at?: string };
        Update: { singleton?: boolean; document?: Json; revision?: number; updated_at?: string };
        Relationships: [];
      };
      media_metadata: {
        Row: { bucket: string; path: string; original_name: string; width: number; height: number };
        Insert: { bucket: string; path: string; original_name: string; width: number; height: number };
        Update: { bucket?: string; path?: string; original_name?: string; width?: number; height?: number };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          role: Database["public"]["Enums"]["admin_role"];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["admin_role"];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["admin_role"];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          is_active: boolean;
          meta_title: string | null;
          meta_description: string | null;
          image_path: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          meta_title?: string | null;
          meta_description?: string | null;
          image_path?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          meta_title?: string | null;
          meta_description?: string | null;
          image_path?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          slug: string;
          short_description: string | null;
          description: string | null;
          price: number;
          currency: string;
          stock_quantity: number;
          is_active: boolean;
          sku: string | null;
          compare_at_price: number | null;
          cost_price: number | null;
          is_featured: boolean;
          meta_title: string | null;
          meta_description: string | null;
          og_image_path: string | null;
          weight: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          slug: string;
          short_description?: string | null;
          description?: string | null;
          price: number;
          currency?: string;
          stock_quantity?: number;
          is_active?: boolean;
          sku?: string | null;
          compare_at_price?: number | null;
          cost_price?: number | null;
          is_featured?: boolean;
          meta_title?: string | null;
          meta_description?: string | null;
          og_image_path?: string | null;
          weight?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          slug?: string;
          short_description?: string | null;
          description?: string | null;
          price?: number;
          currency?: string;
          stock_quantity?: number;
          is_active?: boolean;
          sku?: string | null;
          compare_at_price?: number | null;
          cost_price?: number | null;
          is_featured?: boolean;
          meta_title?: string | null;
          meta_description?: string | null;
          og_image_path?: string | null;
          weight?: number | null;
          created_at?: string;
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
      product_images: {
        Row: {
          id: string;
          product_id: string;
          storage_path: string;
          alt_text: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          storage_path: string;
          alt_text?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          storage_path?: string;
          alt_text?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      favorites: {
        Row: { user_id: string; product_id: string; created_at: string };
        Insert: { user_id: string; product_id: string; created_at?: string };
        Update: { user_id?: string; product_id?: string; created_at?: string };
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      cart_items: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          quantity: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          order_number: number;
          stock_restore_eligible: boolean;
          user_id: string | null;
          status: Database["public"]["Enums"]["order_status"];
          payment_status: Database["public"]["Enums"]["payment_status"];
          customer_name: string;
          customer_email: string;
          customer_phone: string;
          country: string;
          city: string;
          postal_code: string;
          address: string;
          apartment: string | null;
          notes: string | null;
          total_amount: number;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          stock_restore_eligible?: boolean;
          status?: Database["public"]["Enums"]["order_status"];
          payment_status?: Database["public"]["Enums"]["payment_status"];
          customer_name: string;
          customer_email: string;
          customer_phone: string;
          country: string;
          city: string;
          postal_code: string;
          address: string;
          apartment?: string | null;
          notes?: string | null;
          total_amount: number;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          stock_restore_eligible?: boolean;
          status?: Database["public"]["Enums"]["order_status"];
          payment_status?: Database["public"]["Enums"]["payment_status"];
          customer_name?: string;
          customer_email?: string;
          customer_phone?: string;
          country?: string;
          city?: string;
          postal_code?: string;
          address?: string;
          apartment?: string | null;
          notes?: string | null;
          total_amount?: number;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          product_description: string;
          unit_price: number;
          quantity: number;
          subtotal: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          product_description?: string;
          unit_price: number;
          quantity: number;
          subtotal: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          product_name?: string;
          product_description?: string;
          unit_price?: number;
          quantity?: number;
          subtotal?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          provider: string;
          provider_payment_id: string | null;
          amount: number;
          currency: string;
          status: Database["public"]["Enums"]["payment_status"];
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          provider: string;
          provider_payment_id?: string | null;
          amount: number;
          currency: string;
          status?: Database["public"]["Enums"]["payment_status"];
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          provider?: string;
          provider_payment_id?: string | null;
          amount?: number;
          currency?: string;
          status?: Database["public"]["Enums"]["payment_status"];
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_events: {
        Row: {
          id: string;
          provider: string;
          event_id: string;
          provider_payment_id: string;
          status: Database["public"]["Enums"]["payment_status"];
          outcome: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          event_id: string;
          provider_payment_id: string;
          status: Database["public"]["Enums"]["payment_status"];
          outcome: string;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          provider?: string;
          event_id?: string;
          provider_payment_id?: string;
          status?: Database["public"]["Enums"]["payment_status"];
          outcome?: string;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      admin_action_rate_limits: {
        Row: {
          admin_user_id: string;
          action: string;
          window_start: string;
          request_count: number;
        };
        Insert: {
          admin_user_id: string;
          action: string;
          window_start: string;
          request_count: number;
        };
        Update: {
          admin_user_id?: string;
          action?: string;
          window_start?: string;
          request_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "admin_action_rate_limits_admin_user_id_fkey";
            columns: ["admin_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      site_settings: {
        Row: {
          id: string;
          singleton: boolean;
          store_name: string;
          store_description: string | null;
          logo_path: string | null;
          favicon_path: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          whatsapp_number: string | null;
          viber_number: string | null;
          telegram_username: string | null;
          business_address: string | null;
          currency: string;
          default_language: string;
          timezone: string;
          facebook_url: string | null;
          instagram_url: string | null;
          tiktok_url: string | null;
          youtube_url: string | null;
          announcement_text: string | null;
          announcement_enabled: boolean;
          maintenance_mode: boolean;
          low_stock_threshold: number;
          company_name: string | null;
          nip: string | null;
          regon: string | null;
          vat_details: string | null;
          return_address: string | null;
          seller_notification_email: string | null;
          customer_email_notifications: boolean;
          order_status_notifications: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          singleton?: boolean;
          store_name?: string;
          store_description?: string | null;
          logo_path?: string | null;
          favicon_path?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          whatsapp_number?: string | null;
          viber_number?: string | null;
          telegram_username?: string | null;
          business_address?: string | null;
          currency?: string;
          default_language?: string;
          timezone?: string;
          facebook_url?: string | null;
          instagram_url?: string | null;
          tiktok_url?: string | null;
          youtube_url?: string | null;
          announcement_text?: string | null;
          announcement_enabled?: boolean;
          maintenance_mode?: boolean;
          low_stock_threshold?: number;
          company_name?: string | null;
          nip?: string | null;
          regon?: string | null;
          vat_details?: string | null;
          return_address?: string | null;
          seller_notification_email?: string | null;
          customer_email_notifications?: boolean;
          order_status_notifications?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          singleton?: boolean;
          store_name?: string;
          store_description?: string | null;
          logo_path?: string | null;
          favicon_path?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          whatsapp_number?: string | null;
          viber_number?: string | null;
          telegram_username?: string | null;
          business_address?: string | null;
          currency?: string;
          default_language?: string;
          timezone?: string;
          facebook_url?: string | null;
          instagram_url?: string | null;
          tiktok_url?: string | null;
          youtube_url?: string | null;
          announcement_text?: string | null;
          announcement_enabled?: boolean;
          maintenance_mode?: boolean;
          low_stock_threshold?: number;
          company_name?: string | null;
          nip?: string | null;
          regon?: string | null;
          vat_details?: string | null;
          return_address?: string | null;
          seller_notification_email?: string | null;
          customer_email_notifications?: boolean;
          order_status_notifications?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pages: {
        Row: {
          id: string;
          title: string;
          slug: string;
          content: string;
          rich_content: Json | null;
          excerpt: string | null;
          featured_image_path: string | null;
          meta_title: string | null;
          meta_description: string | null;
          canonical_url: string | null;
          og_image_path: string | null;
          is_published: boolean;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          content?: string;
          rich_content?: Json | null;
          excerpt?: string | null;
          featured_image_path?: string | null;
          meta_title?: string | null;
          meta_description?: string | null;
          canonical_url?: string | null;
          og_image_path?: string | null;
          is_published?: boolean;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          slug?: string;
          content?: string;
          rich_content?: Json | null;
          excerpt?: string | null;
          featured_image_path?: string | null;
          meta_title?: string | null;
          meta_description?: string | null;
          canonical_url?: string | null;
          og_image_path?: string | null;
          is_published?: boolean;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      homepage_sections: {
        Row: {
          id: string;
          section_key: string;
          title: string | null;
          subtitle: string | null;
          content: string | null;
          section_type: Database["public"]["Enums"]["homepage_section_type"];
          settings: Json;
          sort_order: number;
          is_visible: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          section_key: string;
          title?: string | null;
          subtitle?: string | null;
          content?: string | null;
          section_type: Database["public"]["Enums"]["homepage_section_type"];
          settings?: Json;
          sort_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          section_key?: string;
          title?: string | null;
          subtitle?: string | null;
          content?: string | null;
          section_type?: Database["public"]["Enums"]["homepage_section_type"];
          settings?: Json;
          sort_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      banners: {
        Row: {
          id: string;
          title: string;
          subtitle: string | null;
          image_path: string;
          mobile_image_path: string | null;
          button_text: string | null;
          button_url: string | null;
          position: string;
          sort_order: number;
          is_active: boolean;
          starts_at: string | null;
          ends_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          subtitle?: string | null;
          image_path: string;
          mobile_image_path?: string | null;
          button_text?: string | null;
          button_url?: string | null;
          position?: string;
          sort_order?: number;
          is_active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          subtitle?: string | null;
          image_path?: string;
          mobile_image_path?: string | null;
          button_text?: string | null;
          button_url?: string | null;
          position?: string;
          sort_order?: number;
          is_active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_activity_logs: {
        Row: {
          id: string;
          admin_user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          description: string | null;
          metadata: Json;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          description?: string | null;
          metadata?: Json;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          description?: string | null;
          metadata?: Json;
          ip_address?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_activity_logs_admin_user_id_fkey";
            columns: ["admin_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_logs: {
        Row: {
          id: string;
          product_id: string | null;
          admin_user_id: string | null;
          change_type: string;
          previous_quantity: number | null;
          new_quantity: number;
          quantity_change: number;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id?: string | null;
          admin_user_id?: string | null;
          change_type: string;
          previous_quantity?: number | null;
          new_quantity: number;
          quantity_change: number;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string | null;
          admin_user_id?: string | null;
          change_type?: string;
          previous_quantity?: number | null;
          new_quantity?: number;
          quantity_change?: number;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_logs_admin_user_id_fkey";
            columns: ["admin_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_logs_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      order_status_history: {
        Row: {
          id: string;
          order_id: string;
          previous_status: Database["public"]["Enums"]["order_status"] | null;
          new_status: Database["public"]["Enums"]["order_status"];
          changed_by: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          previous_status?: Database["public"]["Enums"]["order_status"] | null;
          new_status: Database["public"]["Enums"]["order_status"];
          changed_by?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          previous_status?: Database["public"]["Enums"]["order_status"] | null;
          new_status?: Database["public"]["Enums"]["order_status"];
          changed_by?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_admin_details: {
        Row: { order_id: string; internal_note: string | null; shipping_provider: string | null; tracking_number: string | null; updated_at: string };
        Insert: { order_id: string; internal_note?: string | null; shipping_provider?: string | null; tracking_number?: string | null; updated_at?: string };
        Update: { order_id?: string; internal_note?: string | null; shipping_provider?: string | null; tracking_number?: string | null; updated_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      admin_product_cost: { Args: { p_product_id: string }; Returns: { product_id: string; cost_price: number | null }[] };
      admin_category_product_counts: { Args: { p_ids: string[] }; Returns: { category_id: string; product_count: number }[] };
      admin_sync_notifications: { Args: Record<PropertyKey, never>; Returns: undefined };
      admin_notification_feed: { Args: { p_offset?: number; p_limit?: number }; Returns: Json };
      admin_notification_mark: { Args: { p_id?: string | null }; Returns: undefined };
      admin_notification_set_preferences: { Args: { p_preferences: Json }; Returns: undefined };
      record_order_email_failure: { Args: { p_order: string; p_source: string }; Returns: undefined };
      record_admin_login: { Args: { p_actor: string }; Returns: boolean };
      record_trusted_admin_activity: {
        Args: { p_actor: string; p_action: string; p_entity_type: string; p_entity_id: string | null; p_metadata: Json };
        Returns: boolean;
      };
      admin_activity_list: {
        Args: { p_admin?: string | null; p_action?: string; p_entity?: string; p_from?: string | null; p_to?: string | null; p_query?: string; p_offset?: number; p_limit?: number };
        Returns: { id: string; admin_user_id: string | null; action: string; entity_type: string; entity_id: string | null; description: string | null; metadata: Json; created_at: string }[];
      };
      admin_adjust_inventory: {
        Args: { p_ids: string[]; p_expected: number[]; p_operation: string; p_quantity: number; p_reason: string };
        Returns: boolean;
      };
      admin_inventory_list: {
        Args: { p_query?: string; p_status?: string; p_offset?: number; p_limit?: number };
        Returns: { id: string; name: string; sku: string | null; stock_quantity: number; is_active: boolean; threshold: number; image_path: string | null; last_stock_update: string | null }[];
      };
      admin_publish_page: { Args: { p_id: string; p_revision: number; p_document: Json; p_actor: string }; Returns: boolean };
      admin_page_operation: { Args: { p_id: string; p_operation: string }; Returns: boolean };
      publish_homepage: { Args: { p_revision: number; p_document: Json; p_actor: string }; Returns: boolean };
      admin_media_list: {
        Args: { p_bucket: string; p_query?: string; p_type?: string; p_ascending?: boolean; p_orphan?: boolean; p_offset?: number };
        Returns: { bucket: string; path: string; original_name: string; created_at: string; mime_type: string | null; size: number | null; width: number | null; height: number | null; referenced: boolean; deleting: boolean; managed: boolean }[];
      };
      admin_claim_media_deletion: {
        Args: { p_bucket: string; p_path: string };
        Returns: boolean;
      };
      admin_attach_product_image: {
        Args: { p_product: string; p_path: string };
        Returns: string;
      };
      admin_customers: {
        Args: { p_query?: string; p_from?: string | null; p_to?: string | null; p_min_orders?: number | null; p_max_orders?: number | null; p_ascending?: boolean; p_offset?: number; p_id?: string | null };
        Returns: { id: string; full_name: string | null; phone: string | null; created_at: string; is_active: boolean; order_count: number; latest_order: string | null; totals: Json }[];
      };
      admin_transition_order: {
        Args: { p_order_id: string; p_expected: Database["public"]["Enums"]["order_status"]; p_status: Database["public"]["Enums"]["order_status"]; p_note?: string | null };
        Returns: string;
      };
      admin_save_order_details: {
        Args: { p_order_id: string; p_internal_note: string; p_shipping_provider: string; p_tracking_number: string };
        Returns: boolean;
      };
      add_to_cart: {
        Args: { p_product_id: string; p_quantity: number };
        Returns: number;
      };
      reorder_product_images: {
        Args: { p_product_id: string; p_image_ids: string[] };
        Returns: undefined;
      };
      apply_payment_event: {
        Args: {
          p_provider: string;
          p_event_id: string;
          p_provider_payment_id: string;
          p_status: Database["public"]["Enums"]["payment_status"];
          p_amount: number;
          p_currency: string;
          p_payload?: Json;
        };
        Returns: string;
      };
      is_active_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      get_admin_site_settings: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Tables"]["site_settings"]["Row"][];
      };
      admin_update_order_status: {
        Args: {
          p_order_id: string;
          p_status: Database["public"]["Enums"]["order_status"];
          p_note?: string;
        };
        Returns: boolean;
      };
      admin_set_product_stock: {
        Args: {
          p_product_id: string;
          p_new_quantity: number;
          p_reason: string;
        };
        Returns: boolean;
      };
      record_admin_activity: {
        Args: {
          p_action: string;
          p_entity_type: string;
          p_entity_id?: string | null;
          p_description?: string | null;
          p_metadata?: Json;
          p_ip_address?: string | null;
        };
        Returns: boolean;
      };
      consume_admin_rate_limit: {
        Args: {
          p_action: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      admin_dashboard_overview: {
        Args: {
          p_period?: string;
          p_from?: string | null;
          p_to?: string | null;
        };
        Returns: Json;
      };
      admin_ecommerce_analytics: {
        Args: {
          p_period?: string;
          p_from?: string | null;
          p_to?: string | null;
          p_currency?: string | null;
          p_bucket?: string;
          p_offset?: number;
        };
        Returns: Json;
      };
      admin_save_product: {
        Args: { p_id: string | null; p_product: Json; p_stock: number; p_expected_stock?: number | null };
        Returns: string | null;
      };
      admin_bulk_products: {
        Args: { p_ids: string[]; p_operation: string };
        Returns: boolean;
      };
      admin_delete_category: {
        Args: { p_id: string; p_target?: string | null };
        Returns: boolean;
      };
      admin_move_category: {
        Args: { p_id: string; p_target: string };
        Returns: boolean;
      };
      place_order: {
        Args: {
          p_customer_name: string;
          p_customer_email: string;
          p_customer_phone: string;
          p_country: string;
          p_city: string;
          p_postal_code: string;
          p_address: string;
          p_apartment?: string;
          p_notes?: string;
        };
        Returns: string;
      };
    };
    Enums: {
      admin_role: "customer" | "admin";
      homepage_section_type:
        | "hero"
        | "promotional"
        | "featured_categories"
        | "featured_products"
        | "benefits"
        | "testimonials"
        | "contact";
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "completed"
        | "cancelled";
      payment_status: "pending" | "paid" | "failed" | "refunded";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type Tables = Database["public"]["Tables"];
export type Profile = Tables["profiles"]["Row"];
export type Category = Tables["categories"]["Row"];
export type Product = Tables["products"]["Row"];
export type ProductImage = Tables["product_images"]["Row"];
export type Favorite = Tables["favorites"]["Row"];
export type CartItem = Tables["cart_items"]["Row"];
export type Order = Tables["orders"]["Row"];
export type OrderItem = Tables["order_items"]["Row"];
export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type AdminRole = Database["public"]["Enums"]["admin_role"];
export type HomepageSectionType = Database["public"]["Enums"]["homepage_section_type"];
