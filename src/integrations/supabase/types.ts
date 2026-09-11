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
      access_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          key: string
          kind: string
          new_value: boolean | null
          previous_value: boolean | null
          target_user_id: string
          tenant_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          key: string
          kind: string
          new_value?: boolean | null
          previous_value?: boolean | null
          target_user_id: string
          tenant_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          key?: string
          kind?: string
          new_value?: boolean | null
          previous_value?: boolean | null
          target_user_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      account_deletion_requests: {
        Row: {
          id: string
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      awarded_program: {
        Row: {
          amenities: string[]
          brand: string | null
          cancellation_hours: number
          cap: number
          city: string
          client_tenant_id: string
          compliance_pct: number
          contract_end: string | null
          contract_start: string | null
          created_at: string
          final_adr: number
          hotel_id: string | null
          hotel_name: string
          id: string
          quality_score: number
          room_nights: number
          starting_adr: number
          status: string
          tier: string
          updated_at: string
        }
        Insert: {
          amenities?: string[]
          brand?: string | null
          cancellation_hours?: number
          cap?: number
          city: string
          client_tenant_id: string
          compliance_pct?: number
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          final_adr?: number
          hotel_id?: string | null
          hotel_name: string
          id?: string
          quality_score?: number
          room_nights?: number
          starting_adr?: number
          status?: string
          tier?: string
          updated_at?: string
        }
        Update: {
          amenities?: string[]
          brand?: string | null
          cancellation_hours?: number
          cap?: number
          city?: string
          client_tenant_id?: string
          compliance_pct?: number
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          final_adr?: number
          hotel_id?: string | null
          hotel_name?: string
          id?: string
          quality_score?: number
          room_nights?: number
          starting_adr?: number
          status?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      baseline_contracts: {
        Row: {
          cap: number
          city: string | null
          client_tenant_id: string
          created_at: string
          currency: string
          hotel_code: string | null
          hotel_name: string
          id: string
          raw: Json
          upload_id: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          cap?: number
          city?: string | null
          client_tenant_id: string
          created_at?: string
          currency?: string
          hotel_code?: string | null
          hotel_name: string
          id?: string
          raw?: Json
          upload_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          cap?: number
          city?: string | null
          client_tenant_id?: string
          created_at?: string
          currency?: string
          hotel_code?: string | null
          hotel_name?: string
          id?: string
          raw?: Json
          upload_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "baseline_contracts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "baseline_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      baseline_uploads: {
        Row: {
          client_tenant_id: string
          dataset_type: string
          error_count: number
          errors: Json
          filename: string
          id: string
          row_count: number
          status: string
          storage_path: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          client_tenant_id: string
          dataset_type: string
          error_count?: number
          errors?: Json
          filename: string
          id?: string
          row_count?: number
          status?: string
          storage_path?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          client_tenant_id?: string
          dataset_type?: string
          error_count?: number
          errors?: Json
          filename?: string
          id?: string
          row_count?: number
          status?: string
          storage_path?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          client_tenant_id: string | null
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          terms_version: string | null
          tmc_tenant_id: string | null
        }
        Insert: {
          client_tenant_id?: string | null
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          terms_version?: string | null
          tmc_tenant_id?: string | null
        }
        Update: {
          client_tenant_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          terms_version?: string | null
          tmc_tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_client_tenant_id_fkey"
            columns: ["client_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_tmc_tenant_id_fkey"
            columns: ["tmc_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          adr: number
          booking_external_id: string | null
          channel: string | null
          checkin: string | null
          city: string
          client_tenant_id: string
          created_at: string
          hotel_name: string
          id: string
          raw: Json
          room_nights: number
          state: string | null
          upload_id: string | null
        }
        Insert: {
          adr?: number
          booking_external_id?: string | null
          channel?: string | null
          checkin?: string | null
          city: string
          client_tenant_id: string
          created_at?: string
          hotel_name: string
          id?: string
          raw?: Json
          room_nights?: number
          state?: string | null
          upload_id?: string | null
        }
        Update: {
          adr?: number
          booking_external_id?: string | null
          channel?: string | null
          checkin?: string | null
          city?: string
          client_tenant_id?: string
          created_at?: string
          hotel_name?: string
          id?: string
          raw?: Json
          room_nights?: number
          state?: string | null
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_tenant_id_fkey"
            columns: ["client_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_actions: {
        Row: {
          city: string | null
          client_tenant_id: string
          created_at: string
          created_by: string | null
          effort: string
          id: string
          kind: string
          kpis: Json
          label: string
          module: string
          opportunity_id: string | null
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          client_tenant_id: string
          created_at?: string
          created_by?: string | null
          effort?: string
          id?: string
          kind: string
          kpis?: Json
          label: string
          module: string
          opportunity_id?: string | null
          payload?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          client_tenant_id?: string
          created_at?: string
          created_by?: string | null
          effort?: string
          id?: string
          kind?: string
          kpis?: Json
          label?: string
          module?: string
          opportunity_id?: string | null
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      consent_logs: {
        Row: {
          consent_type: string
          created_at: string
          granted: boolean
          id: string
          ip_address: string | null
          policy_version: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          consent_type: string
          created_at?: string
          granted: boolean
          id?: string
          ip_address?: string | null
          policy_version?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          consent_type?: string
          created_at?: string
          granted?: boolean
          id?: string
          ip_address?: string | null
          policy_version?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      decision_actions: {
        Row: {
          alert_id: string | null
          assigned_to: string | null
          client_tenant_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          email_recipients: string[] | null
          id: string
          payload: Json
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          alert_id?: string | null
          assigned_to?: string | null
          client_tenant_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          email_recipients?: string[] | null
          id?: string
          payload?: Json
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          alert_id?: string | null
          assigned_to?: string | null
          client_tenant_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          email_recipients?: string[] | null
          id?: string
          payload?: Json
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      decision_alerts: {
        Row: {
          client_tenant_id: string
          completed_at: string | null
          created_at: string
          description: string
          dismissed_at: string | null
          financial_impact: number
          id: string
          impacted_city: string | null
          impacted_hotel: string | null
          metadata: Json
          severity: string
          signature: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          client_tenant_id: string
          completed_at?: string | null
          created_at?: string
          description?: string
          dismissed_at?: string | null
          financial_impact?: number
          id?: string
          impacted_city?: string | null
          impacted_hotel?: string | null
          metadata?: Json
          severity: string
          signature: string
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          client_tenant_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string
          dismissed_at?: string | null
          financial_impact?: number
          id?: string
          impacted_city?: string | null
          impacted_hotel?: string | null
          metadata?: Json
          severity?: string
          signature?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      decision_attachments: {
        Row: {
          action_id: string
          client_tenant_id: string
          created_at: string
          filename: string
          id: string
          mime_type: string | null
          size_bytes: number
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          action_id: string
          client_tenant_id: string
          created_at?: string
          filename: string
          id?: string
          mime_type?: string | null
          size_bytes?: number
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          action_id?: string
          client_tenant_id?: string
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      decision_comments: {
        Row: {
          action_id: string | null
          alert_id: string | null
          author_id: string | null
          body: string
          client_tenant_id: string
          created_at: string
          id: string
        }
        Insert: {
          action_id?: string | null
          alert_id?: string | null
          author_id?: string | null
          body: string
          client_tenant_id: string
          created_at?: string
          id?: string
        }
        Update: {
          action_id?: string | null
          alert_id?: string | null
          author_id?: string | null
          body?: string
          client_tenant_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      decision_followups: {
        Row: {
          action_id: string
          client_tenant_id: string
          created_at: string
          created_by: string | null
          executed_at: string | null
          id: string
          kind: string
          notes: string
          outcome: string
          scheduled_at: string | null
          updated_at: string
        }
        Insert: {
          action_id: string
          client_tenant_id: string
          created_at?: string
          created_by?: string | null
          executed_at?: string | null
          id?: string
          kind: string
          notes?: string
          outcome?: string
          scheduled_at?: string | null
          updated_at?: string
        }
        Update: {
          action_id?: string
          client_tenant_id?: string
          created_at?: string
          created_by?: string | null
          executed_at?: string | null
          id?: string
          kind?: string
          notes?: string
          outcome?: string
          scheduled_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      decision_watchlist: {
        Row: {
          action_id: string
          client_tenant_id: string
          created_at: string
          due_at: string | null
          id: string
          last_activity_at: string
          pinned: boolean
          summary: string
          updated_at: string
        }
        Insert: {
          action_id: string
          client_tenant_id: string
          created_at?: string
          due_at?: string | null
          id?: string
          last_activity_at?: string
          pinned?: boolean
          summary?: string
          updated_at?: string
        }
        Update: {
          action_id?: string
          client_tenant_id?: string
          created_at?: string
          due_at?: string | null
          id?: string
          last_activity_at?: string
          pinned?: boolean
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      demand_targets: {
        Row: {
          city: string
          client_tenant_id: string
          created_at: string
          id: string
          target_nights: number
          updated_at: string
        }
        Insert: {
          city: string
          client_tenant_id: string
          created_at?: string
          id?: string
          target_nights?: number
          updated_at?: string
        }
        Update: {
          city?: string
          client_tenant_id?: string
          created_at?: string
          id?: string
          target_nights?: number
          updated_at?: string
        }
        Relationships: []
      }
      feature_entitlements: {
        Row: {
          allow_overage: boolean
          bonus_units: number
          client_tenant_id: string
          configured_by: string | null
          created_at: string
          effective_from: string | null
          effective_until: string | null
          enabled: boolean
          feature_key: string
          id: string
          internal_note: string | null
          overage_limit: number | null
          quota_limit: number | null
          quota_period: string
          updated_at: string
          usage_mode: string
        }
        Insert: {
          allow_overage?: boolean
          bonus_units?: number
          client_tenant_id: string
          configured_by?: string | null
          created_at?: string
          effective_from?: string | null
          effective_until?: string | null
          enabled?: boolean
          feature_key: string
          id?: string
          internal_note?: string | null
          overage_limit?: number | null
          quota_limit?: number | null
          quota_period?: string
          updated_at?: string
          usage_mode?: string
        }
        Update: {
          allow_overage?: boolean
          bonus_units?: number
          client_tenant_id?: string
          configured_by?: string | null
          created_at?: string
          effective_from?: string | null
          effective_until?: string | null
          enabled?: boolean
          feature_key?: string
          id?: string
          internal_note?: string | null
          overage_limit?: number | null
          quota_limit?: number | null
          quota_period?: string
          updated_at?: string
          usage_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_entitlements_client_tenant_id_fkey"
            columns: ["client_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_usage_ledger: {
        Row: {
          attempt_id: string | null
          campaign_id: string | null
          check_id: string | null
          client_tenant_id: string
          created_at: string
          feature_key: string
          finalized_at: string | null
          id: string
          period_key: string
          usage_reason: string | null
          usage_status: string
          usage_units: number
        }
        Insert: {
          attempt_id?: string | null
          campaign_id?: string | null
          check_id?: string | null
          client_tenant_id: string
          created_at?: string
          feature_key: string
          finalized_at?: string | null
          id?: string
          period_key: string
          usage_reason?: string | null
          usage_status?: string
          usage_units?: number
        }
        Update: {
          attempt_id?: string | null
          campaign_id?: string | null
          check_id?: string | null
          client_tenant_id?: string
          created_at?: string
          feature_key?: string
          finalized_at?: string | null
          id?: string
          period_key?: string
          usage_reason?: string | null
          usage_status?: string
          usage_units?: number
        }
        Relationships: [
          {
            foreignKeyName: "feature_usage_ledger_client_tenant_id_fkey"
            columns: ["client_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      final_agreed_terms: {
        Row: {
          awarded_program_id: string | null
          breakfast: boolean | null
          cancellation_hours: number | null
          cancellation_policy: string | null
          city: string | null
          client_tenant_id: string
          corporate_rate_code: string | null
          created_at: string
          created_by: string | null
          currency: string
          double_rate: number | null
          hotel_id: string | null
          hotel_name: string
          id: string
          inclusions: Json
          lra: boolean | null
          mandatory_amenities: string[]
          negotiation_thread_id: string | null
          notes: string | null
          optional_amenities: string[]
          parking: boolean | null
          rate_basis: string
          rate_plan: string | null
          refundable: boolean | null
          rfp_id: string | null
          room_type: string | null
          service_charge_pct: number | null
          single_rate: number | null
          source: string
          taxes_included: boolean | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          wifi: boolean | null
        }
        Insert: {
          awarded_program_id?: string | null
          breakfast?: boolean | null
          cancellation_hours?: number | null
          cancellation_policy?: string | null
          city?: string | null
          client_tenant_id: string
          corporate_rate_code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          double_rate?: number | null
          hotel_id?: string | null
          hotel_name: string
          id?: string
          inclusions?: Json
          lra?: boolean | null
          mandatory_amenities?: string[]
          negotiation_thread_id?: string | null
          notes?: string | null
          optional_amenities?: string[]
          parking?: boolean | null
          rate_basis?: string
          rate_plan?: string | null
          refundable?: boolean | null
          rfp_id?: string | null
          room_type?: string | null
          service_charge_pct?: number | null
          single_rate?: number | null
          source?: string
          taxes_included?: boolean | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          wifi?: boolean | null
        }
        Update: {
          awarded_program_id?: string | null
          breakfast?: boolean | null
          cancellation_hours?: number | null
          cancellation_policy?: string | null
          city?: string | null
          client_tenant_id?: string
          corporate_rate_code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          double_rate?: number | null
          hotel_id?: string | null
          hotel_name?: string
          id?: string
          inclusions?: Json
          lra?: boolean | null
          mandatory_amenities?: string[]
          negotiation_thread_id?: string | null
          notes?: string | null
          optional_amenities?: string[]
          parking?: boolean | null
          rate_basis?: string
          rate_plan?: string | null
          refundable?: boolean | null
          rfp_id?: string | null
          room_type?: string | null
          service_charge_pct?: number | null
          single_rate?: number | null
          source?: string
          taxes_included?: boolean | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          wifi?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "final_agreed_terms_awarded_program_id_fkey"
            columns: ["awarded_program_id"]
            isOneToOne: false
            referencedRelation: "awarded_program"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_agreed_terms_client_tenant_id_fkey"
            columns: ["client_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_agreed_terms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_agreed_terms_negotiation_thread_id_fkey"
            columns: ["negotiation_thread_id"]
            isOneToOne: false
            referencedRelation: "negotiation_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_agreed_terms_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_members: {
        Row: {
          created_at: string
          hotel_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hotel_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hotel_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_members_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          address: string | null
          city: string
          cnpj: string | null
          code: string | null
          contact_email: string | null
          contact_name: string | null
          country_code: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          metadata: Json
          name: string
          phone: string | null
          postal_code: string | null
          star_rating: number | null
          state: string | null
          tenant_id_owner: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city: string
          cnpj?: string | null
          code?: string | null
          contact_email?: string | null
          contact_name?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          name: string
          phone?: string | null
          postal_code?: string | null
          star_rating?: number | null
          state?: string | null
          tenant_id_owner?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string
          cnpj?: string | null
          code?: string | null
          contact_email?: string | null
          contact_name?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          name?: string
          phone?: string | null
          postal_code?: string | null
          star_rating?: number | null
          state?: string | null
          tenant_id_owner?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotels_tenant_id_owner_fkey"
            columns: ["tenant_id_owner"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiation_lots: {
        Row: {
          city: string
          client_tenant_id: string
          created_at: string
          current_savings_pct: number
          deadline: string | null
          hotels_count: number
          id: string
          name: string
          notes: string | null
          owner: string | null
          status: string
          target_savings_pct: number
          updated_at: string
        }
        Insert: {
          city: string
          client_tenant_id: string
          created_at?: string
          current_savings_pct?: number
          deadline?: string | null
          hotels_count?: number
          id?: string
          name: string
          notes?: string | null
          owner?: string | null
          status?: string
          target_savings_pct?: number
          updated_at?: string
        }
        Update: {
          city?: string
          client_tenant_id?: string
          created_at?: string
          current_savings_pct?: number
          deadline?: string | null
          hotels_count?: number
          id?: string
          name?: string
          notes?: string | null
          owner?: string | null
          status?: string
          target_savings_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      negotiation_threads: {
        Row: {
          city: string
          client_tenant_id: string
          created_at: string
          current_offer: number
          deadline: string | null
          hotel_name: string
          id: string
          last_message_at: string | null
          last_message_from: string | null
          lot_id: string
          owner: string | null
          starting_adr: number
          status: string
          target_adr: number
          updated_at: string
        }
        Insert: {
          city: string
          client_tenant_id: string
          created_at?: string
          current_offer?: number
          deadline?: string | null
          hotel_name: string
          id?: string
          last_message_at?: string | null
          last_message_from?: string | null
          lot_id: string
          owner?: string | null
          starting_adr?: number
          status?: string
          target_adr?: number
          updated_at?: string
        }
        Update: {
          city?: string
          client_tenant_id?: string
          created_at?: string
          current_offer?: number
          deadline?: string | null
          hotel_name?: string
          id?: string
          last_message_at?: string | null
          last_message_from?: string | null
          lot_id?: string
          owner?: string | null
          starting_adr?: number
          status?: string
          target_adr?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          primary_tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          primary_tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          primary_tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_primary_tenant_id_fkey"
            columns: ["primary_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_buckets: {
        Row: {
          bucket_key: string
          count: number
          window_start: string
        }
        Insert: {
          bucket_key: string
          count?: number
          window_start: string
        }
        Update: {
          bucket_key?: string
          count?: number
          window_start?: string
        }
        Relationships: []
      }
      rate_loading_attempts: {
        Row: {
          adapter_version: string | null
          attempt_number: number
          check_id: string
          client_tenant_id: string
          correlation_id: string | null
          created_at: string
          duration_ms: number | null
          error_code: string | null
          error_message_sanitized: string | null
          finished_at: string | null
          found_offer: Json | null
          id: string
          job_id: string | null
          login_status: string | null
          mismatches: Json
          page_url: string | null
          portal_adapter_key: string | null
          result_code: string | null
          result_summary: string | null
          search_status: string | null
          started_at: string | null
          status: string
          warnings: Json
          worker_id: string | null
        }
        Insert: {
          adapter_version?: string | null
          attempt_number: number
          check_id: string
          client_tenant_id: string
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message_sanitized?: string | null
          finished_at?: string | null
          found_offer?: Json | null
          id?: string
          job_id?: string | null
          login_status?: string | null
          mismatches?: Json
          page_url?: string | null
          portal_adapter_key?: string | null
          result_code?: string | null
          result_summary?: string | null
          search_status?: string | null
          started_at?: string | null
          status?: string
          warnings?: Json
          worker_id?: string | null
        }
        Update: {
          adapter_version?: string | null
          attempt_number?: number
          check_id?: string
          client_tenant_id?: string
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message_sanitized?: string | null
          finished_at?: string | null
          found_offer?: Json | null
          id?: string
          job_id?: string | null
          login_status?: string | null
          mismatches?: Json
          page_url?: string | null
          portal_adapter_key?: string | null
          result_code?: string | null
          result_summary?: string | null
          search_status?: string | null
          started_at?: string | null
          status?: string
          warnings?: Json
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_loading_attempts_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "rate_loading_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_loading_attempts_client_tenant_id_fkey"
            columns: ["client_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_loading_campaigns: {
        Row: {
          client_tenant_id: string
          created_at: string
          created_by: string | null
          description: string | null
          finished_at: string | null
          id: string
          name: string
          portal_connection_id: string | null
          rfp_id: string | null
          started_at: string | null
          status: string
          updated_at: string
          validation_rules: Json
        }
        Insert: {
          client_tenant_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          finished_at?: string | null
          id?: string
          name: string
          portal_connection_id?: string | null
          rfp_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          validation_rules?: Json
        }
        Update: {
          client_tenant_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          finished_at?: string | null
          id?: string
          name?: string
          portal_connection_id?: string | null
          rfp_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          validation_rules?: Json
        }
        Relationships: [
          {
            foreignKeyName: "rate_loading_campaigns_client_tenant_id_fkey"
            columns: ["client_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_loading_campaigns_portal_connection_id_fkey"
            columns: ["portal_connection_id"]
            isOneToOne: false
            referencedRelation: "rate_loading_portal_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_loading_campaigns_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_loading_checks: {
        Row: {
          adults: number
          awarded_program_id: string | null
          campaign_id: string
          check_in: string
          check_out: string
          children: number
          city: string | null
          client_tenant_id: string
          created_at: string
          expected_amenities: Json
          expected_breakfast: boolean | null
          expected_cancellation_policy: string | null
          expected_currency: string | null
          expected_lra: boolean | null
          expected_parking: boolean | null
          expected_rate_amount: number | null
          expected_rate_basis: string
          expected_rate_code: string | null
          expected_rate_plan: string | null
          expected_refundable: boolean | null
          expected_room_type: string | null
          expected_snapshot: Json
          expected_snapshot_hash: string
          expected_taxes_included: boolean | null
          expected_wifi: boolean | null
          final_agreed_terms_id: string | null
          hotel_id: string | null
          hotel_name: string
          id: string
          last_checked_at: string | null
          latest_attempt_id: string | null
          latest_result_code: string | null
          number_of_nights: number
          rate_tolerance_amount: number
          rate_tolerance_percent: number
          rooms: number
          status: string
          updated_at: string
        }
        Insert: {
          adults?: number
          awarded_program_id?: string | null
          campaign_id: string
          check_in: string
          check_out: string
          children?: number
          city?: string | null
          client_tenant_id: string
          created_at?: string
          expected_amenities?: Json
          expected_breakfast?: boolean | null
          expected_cancellation_policy?: string | null
          expected_currency?: string | null
          expected_lra?: boolean | null
          expected_parking?: boolean | null
          expected_rate_amount?: number | null
          expected_rate_basis?: string
          expected_rate_code?: string | null
          expected_rate_plan?: string | null
          expected_refundable?: boolean | null
          expected_room_type?: string | null
          expected_snapshot: Json
          expected_snapshot_hash: string
          expected_taxes_included?: boolean | null
          expected_wifi?: boolean | null
          final_agreed_terms_id?: string | null
          hotel_id?: string | null
          hotel_name: string
          id?: string
          last_checked_at?: string | null
          latest_attempt_id?: string | null
          latest_result_code?: string | null
          number_of_nights: number
          rate_tolerance_amount?: number
          rate_tolerance_percent?: number
          rooms?: number
          status?: string
          updated_at?: string
        }
        Update: {
          adults?: number
          awarded_program_id?: string | null
          campaign_id?: string
          check_in?: string
          check_out?: string
          children?: number
          city?: string | null
          client_tenant_id?: string
          created_at?: string
          expected_amenities?: Json
          expected_breakfast?: boolean | null
          expected_cancellation_policy?: string | null
          expected_currency?: string | null
          expected_lra?: boolean | null
          expected_parking?: boolean | null
          expected_rate_amount?: number | null
          expected_rate_basis?: string
          expected_rate_code?: string | null
          expected_rate_plan?: string | null
          expected_refundable?: boolean | null
          expected_room_type?: string | null
          expected_snapshot?: Json
          expected_snapshot_hash?: string
          expected_taxes_included?: boolean | null
          expected_wifi?: boolean | null
          final_agreed_terms_id?: string | null
          hotel_id?: string | null
          hotel_name?: string
          id?: string
          last_checked_at?: string | null
          latest_attempt_id?: string | null
          latest_result_code?: string | null
          number_of_nights?: number
          rate_tolerance_amount?: number
          rate_tolerance_percent?: number
          rooms?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_loading_checks_awarded_program_id_fkey"
            columns: ["awarded_program_id"]
            isOneToOne: false
            referencedRelation: "awarded_program"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_loading_checks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "rate_loading_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_loading_checks_client_tenant_id_fkey"
            columns: ["client_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_loading_checks_final_agreed_terms_id_fkey"
            columns: ["final_agreed_terms_id"]
            isOneToOne: false
            referencedRelation: "final_agreed_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_loading_checks_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_loading_evidence: {
        Row: {
          attempt_id: string | null
          campaign_id: string | null
          captured_at: string
          check_id: string | null
          client_tenant_id: string
          created_at: string
          evidence_type: string
          id: string
          metadata: Json
          page_url: string | null
          retention_policy_days: number | null
          sha256: string
          storage_path: string
          viewport: string | null
        }
        Insert: {
          attempt_id?: string | null
          campaign_id?: string | null
          captured_at?: string
          check_id?: string | null
          client_tenant_id: string
          created_at?: string
          evidence_type: string
          id?: string
          metadata?: Json
          page_url?: string | null
          retention_policy_days?: number | null
          sha256: string
          storage_path: string
          viewport?: string | null
        }
        Update: {
          attempt_id?: string | null
          campaign_id?: string | null
          captured_at?: string
          check_id?: string | null
          client_tenant_id?: string
          created_at?: string
          evidence_type?: string
          id?: string
          metadata?: Json
          page_url?: string | null
          retention_policy_days?: number | null
          sha256?: string
          storage_path?: string
          viewport?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_loading_evidence_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "rate_loading_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_loading_evidence_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "rate_loading_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_loading_evidence_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "rate_loading_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_loading_evidence_client_tenant_id_fkey"
            columns: ["client_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_loading_jobs: {
        Row: {
          attempts: number
          available_at: string
          campaign_id: string
          check_id: string
          client_tenant_id: string
          created_at: string
          finished_at: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          lease_expires_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          portal_connection_id: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          campaign_id: string
          check_id: string
          client_tenant_id: string
          created_at?: string
          finished_at?: string | null
          id?: string
          idempotency_key: string
          last_error?: string | null
          lease_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          portal_connection_id?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          campaign_id?: string
          check_id?: string
          client_tenant_id?: string
          created_at?: string
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          last_error?: string | null
          lease_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          portal_connection_id?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_loading_jobs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "rate_loading_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_loading_jobs_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "rate_loading_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_loading_jobs_client_tenant_id_fkey"
            columns: ["client_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_loading_jobs_portal_connection_id_fkey"
            columns: ["portal_connection_id"]
            isOneToOne: false
            referencedRelation: "rate_loading_portal_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_loading_portal_connections: {
        Row: {
          adapter_version: string | null
          auth_type: string
          authorization_confirmed_at: string | null
          authorization_confirmed_by: string | null
          authorized_by_client: boolean
          base_url: string
          client_tenant_id: string
          consecutive_failures: number
          created_at: string
          created_by: string | null
          credential_secret_ref: string | null
          disabled_at: string | null
          display_name: string
          id: string
          last_connection_test_at: string | null
          last_connection_test_status: string | null
          last_error_code: string | null
          last_failure_at: string | null
          last_success_at: string | null
          max_concurrent_sessions: number
          mfa_mode: string
          portal_adapter_key: string
          portal_name: string
          read_only_confirmed: boolean
          status: string
          updated_at: string
          username_hint: string | null
        }
        Insert: {
          adapter_version?: string | null
          auth_type?: string
          authorization_confirmed_at?: string | null
          authorization_confirmed_by?: string | null
          authorized_by_client?: boolean
          base_url: string
          client_tenant_id: string
          consecutive_failures?: number
          created_at?: string
          created_by?: string | null
          credential_secret_ref?: string | null
          disabled_at?: string | null
          display_name: string
          id?: string
          last_connection_test_at?: string | null
          last_connection_test_status?: string | null
          last_error_code?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          max_concurrent_sessions?: number
          mfa_mode?: string
          portal_adapter_key: string
          portal_name: string
          read_only_confirmed?: boolean
          status?: string
          updated_at?: string
          username_hint?: string | null
        }
        Update: {
          adapter_version?: string | null
          auth_type?: string
          authorization_confirmed_at?: string | null
          authorization_confirmed_by?: string | null
          authorized_by_client?: boolean
          base_url?: string
          client_tenant_id?: string
          consecutive_failures?: number
          created_at?: string
          created_by?: string | null
          credential_secret_ref?: string | null
          disabled_at?: string | null
          display_name?: string
          id?: string
          last_connection_test_at?: string | null
          last_connection_test_status?: string | null
          last_error_code?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          max_concurrent_sessions?: number
          mfa_mode?: string
          portal_adapter_key?: string
          portal_name?: string
          read_only_confirmed?: boolean
          status?: string
          updated_at?: string
          username_hint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_loading_portal_connections_client_tenant_id_fkey"
            columns: ["client_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_loading_portal_credentials: {
        Row: {
          ciphertext: string
          client_tenant_id: string
          connection_id: string
          created_at: string
          rotated_at: string
          rotated_by: string | null
          secret_ref: string
        }
        Insert: {
          ciphertext: string
          client_tenant_id: string
          connection_id: string
          created_at?: string
          rotated_at?: string
          rotated_by?: string | null
          secret_ref?: string
        }
        Update: {
          ciphertext?: string
          client_tenant_id?: string
          connection_id?: string
          created_at?: string
          rotated_at?: string
          rotated_by?: string | null
          secret_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_loading_portal_credentials_client_tenant_id_fkey"
            columns: ["client_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_loading_portal_credentials_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "rate_loading_portal_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      rfp_analysis_rows: {
        Row: {
          amenities: string[]
          city: string
          client_tenant_id: string
          compliance_pct: number
          created_at: string
          current_adr: number
          hotel_name: string
          id: string
          notes: string | null
          proposed_adr: number
          quality_score: number
          recommendation: string
          rfp_id: string | null
          savings_pct: number
          updated_at: string
        }
        Insert: {
          amenities?: string[]
          city: string
          client_tenant_id: string
          compliance_pct?: number
          created_at?: string
          current_adr?: number
          hotel_name: string
          id?: string
          notes?: string | null
          proposed_adr?: number
          quality_score?: number
          recommendation?: string
          rfp_id?: string | null
          savings_pct?: number
          updated_at?: string
        }
        Update: {
          amenities?: string[]
          city?: string
          client_tenant_id?: string
          compliance_pct?: number
          created_at?: string
          current_adr?: number
          hotel_name?: string
          id?: string
          notes?: string | null
          proposed_adr?: number
          quality_score?: number
          recommendation?: string
          rfp_id?: string | null
          savings_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      rfp_invitations: {
        Row: {
          created_at: string
          deadline: string | null
          hotel_id: string
          id: string
          rfp_id: string
          status: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          hotel_id: string
          id?: string
          rfp_id: string
          status?: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          hotel_id?: string
          id?: string
          rfp_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfp_invitations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_invitations_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
        ]
      }
      rfp_responses: {
        Row: {
          hotel_id: string
          id: string
          rates: Json
          rfp_id: string
          submitted_at: string
        }
        Insert: {
          hotel_id: string
          id?: string
          rates?: Json
          rfp_id: string
          submitted_at?: string
        }
        Update: {
          hotel_id?: string
          id?: string
          rates?: Json
          rfp_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfp_responses_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_responses_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
        ]
      }
      rfps: {
        Row: {
          client_tenant_id: string
          created_at: string
          created_by_tenant_id: string | null
          deadline: string | null
          id: string
          metadata: Json
          name: string
          pois: Json
          status: string
          updated_at: string
        }
        Insert: {
          client_tenant_id: string
          created_at?: string
          created_by_tenant_id?: string | null
          deadline?: string | null
          id?: string
          metadata?: Json
          name: string
          pois?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          client_tenant_id?: string
          created_at?: string
          created_by_tenant_id?: string | null
          deadline?: string | null
          id?: string
          metadata?: Json
          name?: string
          pois?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfps_client_tenant_id_fkey"
            columns: ["client_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfps_created_by_tenant_id_fkey"
            columns: ["created_by_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_caps: {
        Row: {
          approved_cap: number | null
          baseline_adr: number
          city: string
          client_tenant_id: string
          created_at: string
          id: string
          rationale: string | null
          suggested_cap: number
          updated_at: string
        }
        Insert: {
          approved_cap?: number | null
          baseline_adr?: number
          city: string
          client_tenant_id: string
          created_at?: string
          id?: string
          rationale?: string | null
          suggested_cap?: number
          updated_at?: string
        }
        Update: {
          approved_cap?: number | null
          baseline_adr?: number
          city?: string
          client_tenant_id?: string
          created_at?: string
          id?: string
          rationale?: string | null
          suggested_cap?: number
          updated_at?: string
        }
        Relationships: []
      }
      strategy_clusters: {
        Row: {
          cities: string[]
          client_tenant_id: string
          created_at: string
          hotels: string[]
          id: string
          name: string
          rationale: string | null
          share_pct: number
          updated_at: string
        }
        Insert: {
          cities?: string[]
          client_tenant_id: string
          created_at?: string
          hotels?: string[]
          id?: string
          name: string
          rationale?: string | null
          share_pct?: number
          updated_at?: string
        }
        Update: {
          cities?: string[]
          client_tenant_id?: string
          created_at?: string
          hotels?: string[]
          id?: string
          name?: string
          rationale?: string | null
          share_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      strategy_tiers: {
        Row: {
          brands: string[]
          client_tenant_id: string
          created_at: string
          id: string
          notes: string | null
          position: number
          qs_max: number
          qs_min: number
          share_pct: number
          tier: string
          updated_at: string
        }
        Insert: {
          brands?: string[]
          client_tenant_id: string
          created_at?: string
          id?: string
          notes?: string | null
          position?: number
          qs_max?: number
          qs_min?: number
          share_pct?: number
          tier: string
          updated_at?: string
        }
        Update: {
          brands?: string[]
          client_tenant_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          position?: number
          qs_max?: number
          qs_min?: number
          share_pct?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_features: {
        Row: {
          enabled: boolean
          feature_key: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          feature_key: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          feature_key?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_features_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_modules: {
        Row: {
          enabled: boolean
          module_key: string
          tenant_id: string
        }
        Insert: {
          enabled?: boolean
          module_key: string
          tenant_id: string
        }
        Update: {
          enabled?: boolean
          module_key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_thresholds: {
        Row: {
          key: string
          tenant_id: string
          value: number
        }
        Insert: {
          key: string
          tenant_id: string
          value: number
        }
        Update: {
          key?: string
          tenant_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_thresholds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          billing_status: string
          created_at: string
          default_cap: number
          environment: string
          id: string
          metadata: Json
          name: string
          parent_tenant_id: string | null
          terms_accepted_at: string | null
          type: Database["public"]["Enums"]["tenant_type"]
          updated_at: string
        }
        Insert: {
          billing_status?: string
          created_at?: string
          default_cap?: number
          environment?: string
          id?: string
          metadata?: Json
          name: string
          parent_tenant_id?: string | null
          terms_accepted_at?: string | null
          type: Database["public"]["Enums"]["tenant_type"]
          updated_at?: string
        }
        Update: {
          billing_status?: string
          created_at?: string
          default_cap?: number
          environment?: string
          id?: string
          metadata?: Json
          name?: string
          parent_tenant_id?: string | null
          terms_accepted_at?: string | null
          type?: Database["public"]["Enums"]["tenant_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_parent_tenant_id_fkey"
            columns: ["parent_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feature_overrides: {
        Row: {
          enabled: boolean
          feature_key: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          enabled?: boolean
          feature_key: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          enabled?: boolean
          feature_key?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feature_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_overrides: {
        Row: {
          enabled: boolean
          module_key: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          enabled?: boolean
          module_key: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          enabled?: boolean
          module_key?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_module_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_pages: {
        Row: {
          content_md: string
          created_at: string
          created_by: string | null
          id: string
          module_key: string | null
          parent_id: string | null
          position: number
          slug: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content_md?: string
          created_at?: string
          created_by?: string | null
          id?: string
          module_key?: string | null
          parent_id?: string | null
          position?: number
          slug: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content_md?: string
          created_at?: string
          created_by?: string | null
          id?: string
          module_key?: string | null
          parent_id?: string | null
          position?: number
          slug?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wiki_pages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "wiki_pages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_tenant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: { _key: string; _max: number; _window_seconds: number }
        Returns: {
          allowed: boolean
          current_count: number
          retry_after_seconds: number
        }[]
      }
      claim_rate_loading_job: {
        Args: { _lease_seconds?: number; _worker_id: string }
        Returns: {
          attempts: number
          available_at: string
          campaign_id: string
          check_id: string
          client_tenant_id: string
          created_at: string
          finished_at: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          lease_expires_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          portal_connection_id: string | null
          started_at: string | null
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "rate_loading_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_rate_limit_buckets: { Args: never; Returns: undefined }
      effective_user_access: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: {
          enabled: boolean
          key: string
          kind: string
        }[]
      }
      finalize_feature_usage: {
        Args: {
          _attempt_id: string
          _billable: boolean
          _campaign_id: string
          _check_id: string
          _feature_key: string
          _period_key: string
          _reason?: string
          _tenant_id: string
        }
        Returns: undefined
      }
      has_feature: {
        Args: { _key: string; _tenant_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_tenant: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_feature_enabled_for_user: {
        Args: { _key: string; _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_hotel_member: {
        Args: { _hotel_id: string; _user_id: string }
        Returns: boolean
      }
      is_module_enabled_for_user: {
        Args: { _key: string; _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_ta_master: { Args: { _user_id: string }; Returns: boolean }
      reserve_feature_quota: {
        Args: {
          _campaign_id: string
          _feature_key: string
          _period_key: string
          _tenant_id: string
          _units: number
        }
        Returns: {
          allowed: boolean
          available: number
          reason: string
        }[]
      }
      reset_all_user_overrides_for_tenant: {
        Args: { _actor: string; _tenant_id: string }
        Returns: number
      }
      visible_tenant_ids: { Args: { _user_id: string }; Returns: string[] }
    }
    Enums: {
      app_role:
        | "ta_master"
        | "ta_staff"
        | "tmc_admin"
        | "tmc_user"
        | "corp_admin"
        | "corp_user"
        | "hotel_admin"
        | "hotel_user"
      tenant_type: "TA" | "TMC" | "CORP" | "HOTEL"
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
      app_role: [
        "ta_master",
        "ta_staff",
        "tmc_admin",
        "tmc_user",
        "corp_admin",
        "corp_user",
        "hotel_admin",
        "hotel_user",
      ],
      tenant_type: ["TA", "TMC", "CORP", "HOTEL"],
    },
  },
} as const
