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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_tenant: {
        Args: { _tenant_id: string; _user_id: string }
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
      is_hotel_member: {
        Args: { _hotel_id: string; _user_id: string }
        Returns: boolean
      }
      is_ta_master: { Args: { _user_id: string }; Returns: boolean }
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
