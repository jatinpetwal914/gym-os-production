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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          check_in_time: string | null
          check_out_time: string | null
          created_at: string
          date: string
          gym_id: string
          id: string
          member_id: string
          status: string
        }
        Insert: {
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          date: string
          gym_id: string
          id?: string
          member_id: string
          status?: string
        }
        Update: {
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          date?: string
          gym_id?: string
          id?: string
          member_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          gym_id: string | null
          id: string
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          gym_id?: string | null
          id?: string
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          gym_id?: string | null
          id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_branches: {
        Row: {
          address: string | null
          created_at: string
          gym_id: string
          id: string
          is_default: boolean
          max_capacity: number | null
          name: string
          phone: string | null
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          gym_id: string
          id?: string
          is_default?: boolean
          max_capacity?: number | null
          name: string
          phone?: string | null
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          gym_id?: string
          id?: string
          is_default?: boolean
          max_capacity?: number | null
          name?: string
          phone?: string | null
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_branches_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gyms: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          gym_id: string
          id: string
          name: string
          owner_name: string | null
          owner_profile_id: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          gym_id: string
          id?: string
          name: string
          owner_name?: string | null
          owner_profile_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          gym_id?: string
          id?: string
          name?: string
          owner_name?: string | null
          owner_profile_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gyms_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_forms: {
        Row: {
          allowed_plan_ids: string[]
          created_at: string
          description: string
          gym_id: string
          id: string
          member_sync: string
          name: string
          public_id: string
          status: string
          success_message: string
          updated_at: string
        }
        Insert: {
          allowed_plan_ids?: string[]
          created_at?: string
          description?: string
          gym_id: string
          id?: string
          member_sync?: string
          name: string
          public_id: string
          status?: string
          success_message?: string
          updated_at?: string
        }
        Update: {
          allowed_plan_ids?: string[]
          created_at?: string
          description?: string
          gym_id?: string
          id?: string
          member_sync?: string
          name?: string
          public_id?: string
          status?: string
          success_message?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_forms_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_form_sections: {
        Row: {
          form_id: string
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          form_id: string
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          form_id?: string
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_form_sections_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "gym_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_form_fields: {
        Row: {
          default_value: string
          field_type: string
          form_id: string
          help_text: string
          id: string
          label: string
          options: Json
          placeholder: string
          required: boolean
          section_id: string
          sort_order: number
        }
        Insert: {
          default_value?: string
          field_type: string
          form_id: string
          help_text?: string
          id?: string
          label: string
          options?: Json
          placeholder?: string
          required?: boolean
          section_id: string
          sort_order?: number
        }
        Update: {
          default_value?: string
          field_type?: string
          form_id?: string
          help_text?: string
          id?: string
          label?: string
          options?: Json
          placeholder?: string
          required?: boolean
          section_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "gym_form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "gym_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_form_fields_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "gym_form_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_form_submissions: {
        Row: {
          answers: Json
          created_at: string
          form_id: string
          gym_id: string
          id: string
          member_id: string | null
          plan_id: string | null
          public_reference: string
          schema_snapshot: Json
          submitter_email: string | null
          submitter_name: string | null
          submitter_phone: string | null
          updated_at: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          form_id: string
          gym_id: string
          id?: string
          member_id?: string | null
          plan_id?: string | null
          public_reference: string
          schema_snapshot?: Json
          submitter_email?: string | null
          submitter_name?: string | null
          submitter_phone?: string | null
          updated_at?: string
        }
        Update: {
          answers?: Json
          created_at?: string
          form_id?: string
          gym_id?: string
          id?: string
          member_id?: string | null
          plan_id?: string | null
          public_reference?: string
          schema_snapshot?: Json
          submitter_email?: string | null
          submitter_name?: string | null
          submitter_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "gym_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_form_submissions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_form_submissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_form_submissions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          address: string | null
          age: number | null
          amount_paid: number
          created_at: string
          date_of_birth: string | null
          emergency_contact: string | null
          expiry_date: string | null
          gender: string | null
          gym_id: string
          home_branch_id: string | null
          id: string
          member_id: string
          name: string
          notes: string | null
          phone: string | null
          photo_url: string | null
          plan_id: string | null
          profile_id: string | null
          qr_token: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          age?: number | null
          amount_paid?: number
          created_at?: string
          date_of_birth?: string | null
          emergency_contact?: string | null
          expiry_date?: string | null
          gender?: string | null
          gym_id: string
          home_branch_id?: string | null
          id?: string
          member_id: string
          name: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          plan_id?: string | null
          profile_id?: string | null
          qr_token: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          age?: number | null
          amount_paid?: number
          created_at?: string
          date_of_birth?: string | null
          emergency_contact?: string | null
          expiry_date?: string | null
          gender?: string | null
          gym_id?: string
          home_branch_id?: string | null
          id?: string
          member_id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          plan_id?: string | null
          profile_id?: string | null
          qr_token?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_home_branch_id_fkey"
            columns: ["home_branch_id"]
            isOneToOne: false
            referencedRelation: "gym_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          branch_id: string | null
          created_at: string
          description: string | null
          discount: number
          duration_days: number
          final_price: number
          gym_id: string
          id: string
          name: string
          price: number
          status: string
          tier: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          discount?: number
          duration_days: number
          final_price: number
          gym_id: string
          id?: string
          name: string
          price: number
          status?: string
          tier?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          discount?: number
          duration_days?: number
          final_price?: number
          gym_id?: string
          id?: string
          name?: string
          price?: number
          status?: string
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_plans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "gym_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_plans_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          amount_due: number
          amount_paid: number
          branch_id: string | null
          created_at: string
          ends_on: string
          gym_id: string
          id: string
          member_id: string
          plan_id: string | null
          starts_on: string
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          branch_id?: string | null
          created_at?: string
          ends_on: string
          gym_id: string
          id?: string
          member_id: string
          plan_id?: string | null
          starts_on: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          branch_id?: string | null
          created_at?: string
          ends_on?: string
          gym_id?: string
          id?: string
          member_id?: string
          plan_id?: string | null
          starts_on?: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "gym_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      music_settings: {
        Row: {
          created_at: string
          default_category: string | null
          default_provider: string | null
          enabled: boolean
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_category?: string | null
          default_provider?: string | null
          enabled?: boolean
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_category?: string | null
          default_provider?: string | null
          enabled?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      music_tracks: {
        Row: {
          album: string | null
          artist: string
          artwork_url: string | null
          attribution_required: boolean
          attribution_text: string | null
          bpm: number | null
          category: string
          commercial_use_allowed: boolean
          country_or_region: string | null
          created_at: string
          duration: number | null
          energy_level: number | null
          genre: string | null
          id: string
          is_explicit: boolean
          language: string | null
          license_name: string | null
          license_url: string | null
          provider: string
          provider_track_id: string
          provider_track_url: string | null
          public_performance_allowed: boolean
          source: string | null
          source_url: string | null
          status: string
          stream_url: string | null
          sub_genre: string | null
          title: string
          updated_at: string
          verification_date: string | null
          verification_notes: string | null
        }
        Insert: {
          album?: string | null
          artist: string
          artwork_url?: string | null
          attribution_required?: boolean
          attribution_text?: string | null
          bpm?: number | null
          category?: string
          commercial_use_allowed?: boolean
          country_or_region?: string | null
          created_at?: string
          duration?: number | null
          energy_level?: number | null
          genre?: string | null
          id?: string
          is_explicit?: boolean
          language?: string | null
          license_name?: string | null
          license_url?: string | null
          provider?: string
          provider_track_id: string
          provider_track_url?: string | null
          public_performance_allowed?: boolean
          source?: string | null
          source_url?: string | null
          status?: string
          stream_url?: string | null
          sub_genre?: string | null
          title: string
          updated_at?: string
          verification_date?: string | null
          verification_notes?: string | null
        }
        Update: {
          album?: string | null
          artist?: string
          artwork_url?: string | null
          attribution_required?: boolean
          attribution_text?: string | null
          bpm?: number | null
          category?: string
          commercial_use_allowed?: boolean
          country_or_region?: string | null
          created_at?: string
          duration?: number | null
          energy_level?: number | null
          genre?: string | null
          id?: string
          is_explicit?: boolean
          language?: string | null
          license_name?: string | null
          license_url?: string | null
          provider?: string
          provider_track_id?: string
          provider_track_url?: string | null
          public_performance_allowed?: boolean
          source?: string | null
          source_url?: string | null
          status?: string
          stream_url?: string | null
          sub_genre?: string | null
          title?: string
          updated_at?: string
          verification_date?: string | null
          verification_notes?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          gym_id: string
          id: string
          member_id: string | null
          profile_id: string | null
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          gym_id: string
          id?: string
          member_id?: string | null
          profile_id?: string | null
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          gym_id?: string
          id?: string
          member_id?: string | null
          profile_id?: string | null
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string
          currency: string
          discount: number
          gateway: string
          gateway_reference: string | null
          gateway_response: Json | null
          gym_id: string
          id: string
          member_id: string
          membership_id: string | null
          notes: string | null
          payment_date: string
          payment_method: string | null
          plan_id: string | null
          recorded_by: string | null
          refund_amount: number
          refunded_at: string | null
          reversed_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string
          currency?: string
          discount?: number
          gateway?: string
          gateway_reference?: string | null
          gateway_response?: Json | null
          gym_id: string
          id?: string
          member_id: string
          membership_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          plan_id?: string | null
          recorded_by?: string | null
          refund_amount?: number
          refunded_at?: string | null
          reversed_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          currency?: string
          discount?: number
          gateway?: string
          gateway_reference?: string | null
          gateway_response?: Json | null
          gym_id?: string
          id?: string
          member_id?: string
          membership_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          plan_id?: string | null
          recorded_by?: string | null
          refund_amount?: number
          refunded_at?: string | null
          reversed_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "gym_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          gym_id: string | null
          home_branch_id: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          full_name: string
          gym_id?: string | null
          home_branch_id?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          full_name?: string
          gym_id?: string | null
          home_branch_id?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_home_branch_id_fkey"
            columns: ["home_branch_id"]
            isOneToOne: false
            referencedRelation: "gym_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_branch_access: {
        Row: {
          branch_id: string
          created_at: string
          gym_id: string
          id: string
          profile_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          gym_id: string
          id?: string
          profile_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          gym_id?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_branch_access_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "gym_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_access_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_access_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_grants: {
        Row: {
          created_at: string
          expires_at: string
          granted_to: string
          gym_id: string
          id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          granted_to: string
          gym_id: string
          id?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          granted_to?: string
          gym_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_grants_granted_to_fkey"
            columns: ["granted_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_grants_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_members: {
        Row: {
          created_at: string
          gym_id: string
          id: string
          member_id: string
          trainer_profile_id: string
        }
        Insert: {
          created_at?: string
          gym_id: string
          id?: string
          member_id: string
          trainer_profile_id: string
        }
        Update: {
          created_at?: string
          gym_id?: string
          id?: string
          member_id?: string
          trainer_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_members_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_members_trainer_profile_id_fkey"
            columns: ["trainer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          gym_id: string | null
          id: string
          name: string
          password_hash: string
          role: string
          status: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          gym_id?: string | null
          id?: string
          name: string
          password_hash: string
          role?: string
          status?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          gym_id?: string | null
          id?: string
          name?: string
          password_hash?: string
          role?: string
          status?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          branch_id: string
          check_in_at: string
          check_out_at: string | null
          created_at: string
          gym_id: string
          id: string
          member_id: string
          method: Database["public"]["Enums"]["visit_method"]
          scanned_by: string | null
          status: string
        }
        Insert: {
          branch_id: string
          check_in_at?: string
          check_out_at?: string | null
          created_at?: string
          gym_id: string
          id?: string
          member_id: string
          method?: Database["public"]["Enums"]["visit_method"]
          scanned_by?: string | null
          status?: string
        }
        Update: {
          branch_id?: string
          check_in_at?: string
          check_out_at?: string | null
          created_at?: string
          gym_id?: string
          id?: string
          member_id?: string
          method?: Database["public"]["Enums"]["visit_method"]
          scanned_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "gym_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_scanned_by_fkey"
            columns: ["scanned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_in: {
        Args: { p_branch_id: string; p_qr_token: string }
        Returns: Json
      }
      platform_stats: { Args: Record<PropertyKey, never>; Returns: Json }
      quote_gym_os_registration: {
        Args: { p_coupon_code?: string | null; p_plan_id: string }
        Returns: Json
      }
      mark_gym_os_registration_paid: {
        Args: {
          p_cashfree_order_id: string
          p_cashfree_payment_id?: string | null
          p_paid_amount: number
          p_public_reference_id: string
        }
        Returns: Json
      }
      submit_gym_os_registration: {
        Args: {
          p_city: string
          p_coupon_code?: string | null
          p_email: string
          p_gym_name: string
          p_idempotency_key: string
          p_member_count: number
          p_owner_name: string
          p_phone: string
          p_plan_id: string
          p_state: string
          p_username_preference: string
        }
        Returns: Json
      }
      record_payment: {
        Args: {
          p_amount: number
          p_branch_id?: string
          p_discount: number
          p_member_id: string
          p_method: string
          p_notes: string
          p_plan_id?: string
        }
        Returns: Json
      }
      adjust_member_payment: {
        Args: {
          p_payment_id: string
          p_action: string
          p_amount?: number | null
          p_notes?: string | null
        }
        Returns: Json
      }
      refresh_expiring_memberships: { Args: never; Returns: number }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "gym_owner"
        | "gym_admin"
        | "manager"
        | "staff"
        | "trainer"
        | "member"
      entity_status: "active" | "suspended" | "inactive"
      membership_status:
        | "pending"
        | "active"
        | "expiring"
        | "expired"
        | "frozen"
        | "cancelled"
      notification_channel: "in_app" | "email" | "sms"
      notification_type:
        | "membership_expiring"
        | "membership_expired"
        | "payment_recorded"
        | "check_in"
      payment_method: "cash" | "card" | "bank_transfer" | "digital_wallet"
      payment_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
        | "refunded"
        | "partially_refunded"
        | "reversed"
      visit_method: "qr" | "manual"
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
        "super_admin",
        "gym_owner",
        "gym_admin",
        "manager",
        "staff",
        "trainer",
        "member",
      ],
      entity_status: ["active", "suspended", "inactive"],
      membership_status: [
        "pending",
        "active",
        "expiring",
        "expired",
        "frozen",
        "cancelled",
      ],
      notification_channel: ["in_app", "email", "sms"],
      notification_type: [
        "membership_expiring",
        "membership_expired",
        "payment_recorded",
        "check_in",
      ],
      payment_method: ["cash", "card", "bank_transfer", "digital_wallet"],
      payment_status: ["pending", "processing", "completed", "failed", "cancelled", "refunded", "partially_refunded", "reversed"],
      visit_method: ["qr", "manual"],
    },
  },
} as const
