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
      access_allowlist: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          full_name: string | null
          id: string
          note: string | null
          roles: Database["public"]["Enums"]["app_role"][]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          full_name?: string | null
          id?: string
          note?: string | null
          roles?: Database["public"]["Enums"]["app_role"][]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string | null
          id?: string
          note?: string | null
          roles?: Database["public"]["Enums"]["app_role"][]
        }
        Relationships: []
      }
      access_denied_attempts: {
        Row: {
          attempts: number
          email: string
          first_attempt_at: string
          full_name: string | null
          id: string
          last_attempt_at: string
          reason: string
          resolved_at: string | null
        }
        Insert: {
          attempts?: number
          email: string
          first_attempt_at?: string
          full_name?: string | null
          id?: string
          last_attempt_at?: string
          reason?: string
          resolved_at?: string | null
        }
        Update: {
          attempts?: number
          email?: string
          first_attempt_at?: string
          full_name?: string | null
          id?: string
          last_attempt_at?: string
          reason?: string
          resolved_at?: string | null
        }
        Relationships: []
      }
      agreement_reminders: {
        Row: {
          agreement_id: string
          id: string
          note: string | null
          sent_at: string
          sent_by: string | null
        }
        Insert: {
          agreement_id: string
          id?: string
          note?: string | null
          sent_at?: string
          sent_by?: string | null
        }
        Update: {
          agreement_id?: string
          id?: string
          note?: string | null
          sent_at?: string
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreement_reminders_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_reminders_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements_list"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      agreements: {
        Row: {
          asset_id: string
          assignment_id: string
          content: string
          created_at: string
          declined_reason: string | null
          dispatch_error: string | null
          dispatch_key: string | null
          dispatch_state: string | null
          employee_id: string
          external_envelope_id: string | null
          id: string
          is_test: boolean
          provider: string
          sent_at: string | null
          signed_at: string | null
          signed_document_path: string | null
          status: Database["public"]["Enums"]["agreement_status"]
          template_id: string | null
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          asset_id: string
          assignment_id: string
          content: string
          created_at?: string
          declined_reason?: string | null
          dispatch_error?: string | null
          dispatch_key?: string | null
          dispatch_state?: string | null
          employee_id: string
          external_envelope_id?: string | null
          id?: string
          is_test?: boolean
          provider?: string
          sent_at?: string | null
          signed_at?: string | null
          signed_document_path?: string | null
          status?: Database["public"]["Enums"]["agreement_status"]
          template_id?: string | null
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          asset_id?: string
          assignment_id?: string
          content?: string
          created_at?: string
          declined_reason?: string | null
          dispatch_error?: string | null
          dispatch_key?: string | null
          dispatch_state?: string | null
          employee_id?: string
          external_envelope_id?: string | null
          id?: string
          is_test?: boolean
          provider?: string
          sent_at?: string | null
          signed_at?: string | null
          signed_document_path?: string | null
          status?: Database["public"]["Enums"]["agreement_status"]
          template_id?: string | null
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreements_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "agreement_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      asset_tags: {
        Row: {
          asset_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_tags_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_tags_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          archived_at: string | null
          asset_type: Database["public"]["Enums"]["asset_type"]
          bitdefender_installed: boolean
          brand: string | null
          condition: string | null
          contract_number: string | null
          created_at: string
          id: string
          imei: string | null
          intune_device_id: string | null
          intune_last_sync: string | null
          is_test: boolean
          last_seen_location: string | null
          lease_end: string | null
          lease_start: string | null
          location: string | null
          model: string | null
          monthly_cost: number | null
          notes: string | null
          patrimony: string | null
          serial_number: string
          status: Database["public"]["Enums"]["asset_status"]
          supplier: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          asset_type?: Database["public"]["Enums"]["asset_type"]
          bitdefender_installed?: boolean
          brand?: string | null
          condition?: string | null
          contract_number?: string | null
          created_at?: string
          id?: string
          imei?: string | null
          intune_device_id?: string | null
          intune_last_sync?: string | null
          is_test?: boolean
          last_seen_location?: string | null
          lease_end?: string | null
          lease_start?: string | null
          location?: string | null
          model?: string | null
          monthly_cost?: number | null
          notes?: string | null
          patrimony?: string | null
          serial_number: string
          status?: Database["public"]["Enums"]["asset_status"]
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          asset_type?: Database["public"]["Enums"]["asset_type"]
          bitdefender_installed?: boolean
          brand?: string | null
          condition?: string | null
          contract_number?: string | null
          created_at?: string
          id?: string
          imei?: string | null
          intune_device_id?: string | null
          intune_last_sync?: string | null
          is_test?: boolean
          last_seen_location?: string | null
          lease_end?: string | null
          lease_start?: string | null
          location?: string | null
          model?: string | null
          monthly_cost?: number | null
          notes?: string | null
          patrimony?: string | null
          serial_number?: string
          status?: Database["public"]["Enums"]["asset_status"]
          supplier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      assignment_checklists: {
        Row: {
          assignment_id: string
          created_at: string
          created_by: string | null
          id: string
          items: Json
          kind: string
          photos: string[]
        }
        Insert: {
          assignment_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          items?: Json
          kind?: string
          photos?: string[]
        }
        Update: {
          assignment_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          items?: Json
          kind?: string
          photos?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "assignment_checklists_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_checklists_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments_list"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          asset_id: string
          assigned_at: string
          created_at: string
          created_by: string | null
          delivery_condition: string | null
          employee_id: string
          id: string
          is_test: boolean
          notes: string | null
          return_condition: string | null
          returned_at: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
        }
        Insert: {
          asset_id: string
          assigned_at?: string
          created_at?: string
          created_by?: string | null
          delivery_condition?: string | null
          employee_id: string
          id?: string
          is_test?: boolean
          notes?: string | null
          return_condition?: string | null
          returned_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
        }
        Update: {
          asset_id?: string
          assigned_at?: string
          created_at?: string
          created_by?: string | null
          delivery_condition?: string | null
          employee_id?: string
          id?: string
          is_test?: boolean
          notes?: string | null
          return_condition?: string | null
          returned_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_list"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          active: boolean
          created_at: string
          id: string
          is_test: boolean
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          is_test?: boolean
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          is_test?: boolean
          name?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          agreement_id: string | null
          asset_id: string | null
          created_at: string
          employee_id: string | null
          file_name: string
          id: string
          is_test: boolean
          kind: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          agreement_id?: string | null
          asset_id?: string | null
          created_at?: string
          employee_id?: string | null
          file_name: string
          id?: string
          is_test?: boolean
          kind?: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          agreement_id?: string | null
          asset_id?: string | null
          created_at?: string
          employee_id?: string | null
          file_name?: string
          id?: string
          is_test?: boolean
          kind?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_list"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          archived_at: string | null
          cpf: string | null
          created_at: string
          department: string | null
          email: string
          entra_user_id: string | null
          full_name: string
          id: string
          intune_id: string | null
          is_test: boolean
          job_title: string | null
          manager_name: string | null
          notes: string | null
          phone: string | null
          status: Database["public"]["Enums"]["employee_status"]
          unit: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          archived_at?: string | null
          cpf?: string | null
          created_at?: string
          department?: string | null
          email: string
          entra_user_id?: string | null
          full_name: string
          id?: string
          intune_id?: string | null
          is_test?: boolean
          job_title?: string | null
          manager_name?: string | null
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          unit?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          archived_at?: string | null
          cpf?: string | null
          created_at?: string
          department?: string | null
          email?: string
          entra_user_id?: string | null
          full_name?: string
          id?: string
          intune_id?: string | null
          is_test?: boolean
          job_title?: string | null
          manager_name?: string | null
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          unit?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      hermes_operations: {
        Row: {
          after_state: Json | null
          batch_id: string | null
          before_state: Json | null
          correlation_id: string
          created_at: string
          created_by: string | null
          entity: string
          entity_id: string | null
          id: string
          idempotency_key: string
          operation: string
          request_hash: string
          response: Json | null
          reverted_at: string | null
          status_code: number
        }
        Insert: {
          after_state?: Json | null
          batch_id?: string | null
          before_state?: Json | null
          correlation_id: string
          created_at?: string
          created_by?: string | null
          entity: string
          entity_id?: string | null
          id?: string
          idempotency_key: string
          operation: string
          request_hash: string
          response?: Json | null
          reverted_at?: string | null
          status_code?: number
        }
        Update: {
          after_state?: Json | null
          batch_id?: string | null
          before_state?: Json | null
          correlation_id?: string
          created_at?: string
          created_by?: string | null
          entity?: string
          entity_id?: string | null
          id?: string
          idempotency_key?: string
          operation?: string
          request_hash?: string
          response?: Json | null
          reverted_at?: string | null
          status_code?: number
        }
        Relationships: []
      }
      hermes_request_log: {
        Row: {
          correlation_id: string | null
          created_at: string
          id: string
          method: string
          path: string
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          id?: string
          method: string
          path: string
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          id?: string
          method?: string
          path?: string
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          created_rows: number
          failed_rows: number
          file_name: string | null
          id: string
          kind: string
          status: string
          total_rows: number
          updated_rows: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_rows?: number
          failed_rows?: number
          file_name?: string | null
          id?: string
          kind: string
          status?: string
          total_rows?: number
          updated_rows?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_rows?: number
          failed_rows?: number
          file_name?: string | null
          id?: string
          kind?: string
          status?: string
          total_rows?: number
          updated_rows?: number
        }
        Relationships: []
      }
      import_rows: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          message: string | null
          payload: Json
          result: string
          row_number: number
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          message?: string | null
          payload: Json
          result: string
          row_number: number
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          message?: string | null
          payload?: Json
          result?: string
          row_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_runs: {
        Row: {
          action: string
          created_at: string
          id: string
          message: string | null
          payload: Json | null
          provider: string
          status: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          message?: string | null
          payload?: Json | null
          provider: string
          status: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          message?: string | null
          payload?: Json | null
          provider?: string
          status?: string
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          base_url: string | null
          config: Json
          enabled: boolean
          id: string
          label: string
          last_status: string | null
          last_sync_at: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          config?: Json
          enabled?: boolean
          id?: string
          label: string
          last_status?: string | null
          last_sync_at?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          config?: Json
          enabled?: boolean
          id?: string
          label?: string
          last_status?: string | null
          last_sync_at?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_checks: {
        Row: {
          asset_id: string
          asset_snapshot: Json | null
          checked_at: string
          checked_by: string | null
          divergencia: string | null
          id: string
          session_id: string
        }
        Insert: {
          asset_id: string
          asset_snapshot?: Json | null
          checked_at?: string
          checked_by?: string | null
          divergencia?: string | null
          id?: string
          session_id: string
        }
        Update: {
          asset_id?: string
          asset_snapshot?: Json | null
          checked_at?: string
          checked_by?: string | null
          divergencia?: string | null
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_checks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_checks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_checks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "inventory_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_checks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "inventory_sessions_list"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_sessions: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          is_test: boolean
          name: string
          scope: Json
          snapshot: Json | null
          snapshot_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_test?: boolean
          name: string
          scope?: Json
          snapshot?: Json | null
          snapshot_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_test?: boolean
          name?: string
          scope?: Json
          snapshot?: Json | null
          snapshot_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          active: boolean
          created_at: string
          id: string
          is_test: boolean
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          is_test?: boolean
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          is_test?: boolean
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          invited_at: string | null
          job_title: string | null
          last_sign_in_at: string | null
          phone: string | null
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          invited_at?: string | null
          job_title?: string | null
          last_sign_in_at?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          invited_at?: string | null
          job_title?: string | null
          last_sign_in_at?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          is_test: boolean
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_test?: boolean
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_test?: boolean
          name?: string
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
      vendors: {
        Row: {
          active: boolean
          created_at: string
          id: string
          is_test: boolean
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          is_test?: boolean
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          is_test?: boolean
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      agreement_statistics: {
        Row: {
          active: number | null
          covered: number | null
          pending: number | null
          signed: number | null
        }
        Relationships: []
      }
      agreements_list: {
        Row: {
          asset: Json | null
          asset_id: string | null
          asset_name: string | null
          assignment_id: string | null
          content: string | null
          created_at: string | null
          declined_reason: string | null
          dispatch_error: string | null
          dispatch_key: string | null
          dispatch_state: string | null
          employee: Json | null
          employee_id: string | null
          employee_name: string | null
          external_envelope_id: string | null
          id: string | null
          is_test: boolean | null
          provider: string | null
          search_text: string | null
          sent_at: string | null
          signed_at: string | null
          signed_document_path: string | null
          status: Database["public"]["Enums"]["agreement_status"] | null
          template_id: string | null
          updated_at: string | null
          viewed_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreements_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "agreement_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      assets_list: {
        Row: {
          archived_at: string | null
          asset_type: Database["public"]["Enums"]["asset_type"] | null
          assignments: Json | null
          bitdefender_installed: boolean | null
          brand: string | null
          condition: string | null
          contract_number: string | null
          created_at: string | null
          holder_name: string | null
          id: string | null
          imei: string | null
          intune_device_id: string | null
          intune_last_sync: string | null
          is_test: boolean | null
          last_seen_location: string | null
          lease_end: string | null
          lease_start: string | null
          location: string | null
          model: string | null
          monthly_cost: number | null
          notes: string | null
          patrimony: string | null
          search_text: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["asset_status"] | null
          supplier: string | null
          tag_ids: string[] | null
          updated_at: string | null
        }
        Relationships: []
      }
      assignments_list: {
        Row: {
          agreements: Json | null
          asset: Json | null
          asset_id: string | null
          asset_name: string | null
          assigned_at: string | null
          created_at: string | null
          created_by: string | null
          delivery_condition: string | null
          employee: Json | null
          employee_id: string | null
          employee_name: string | null
          id: string | null
          is_test: boolean | null
          notes: string | null
          return_condition: string | null
          returned_at: string | null
          search_text: string | null
          status: Database["public"]["Enums"]["assignment_status"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_list"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_list: {
        Row: {
          action: string | null
          actor_email: string | null
          actor_id: string | null
          created_at: string | null
          details: Json | null
          entity: string | null
          entity_id: string | null
          id: string | null
          search_text: string | null
        }
        Insert: {
          action?: string | null
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string | null
          search_text?: never
        }
        Update: {
          action?: string | null
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string | null
          search_text?: never
        }
        Relationships: []
      }
      employees_list: {
        Row: {
          active_count: number | null
          archived_at: string | null
          assignments: Json | null
          cpf: string | null
          created_at: string | null
          department: string | null
          email: string | null
          entra_user_id: string | null
          full_name: string | null
          id: string | null
          intune_id: string | null
          is_test: boolean | null
          job_title: string | null
          manager_name: string | null
          notes: string | null
          phone: string | null
          search_text: string | null
          status: Database["public"]["Enums"]["employee_status"] | null
          unit: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
      inventory_sessions_list: {
        Row: {
          checks_count: number | null
          closed_at: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          inventory_checks: Json | null
          is_test: boolean | null
          name: string | null
          scope: Json | null
          scope_text: string | null
          search_text: string | null
          snapshot: Json | null
          snapshot_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          checks_count?: never
          closed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          inventory_checks?: never
          is_test?: boolean | null
          name?: string | null
          scope?: Json | null
          scope_text?: never
          search_text?: never
          snapshot?: Json | null
          snapshot_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          checks_count?: never
          closed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          inventory_checks?: never
          is_test?: boolean | null
          name?: string | null
          scope?: Json | null
          scope_text?: never
          search_text?: never
          snapshot?: Json | null
          snapshot_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      allow_email_atomic: {
        Args: {
          p_email: string
          p_name: string
          p_note: string
          p_roles: string[]
        }
        Returns: undefined
      }
      apply_import_row: {
        Args: { p_batch: string; p_line: number }
        Returns: Json
      }
      apply_signature_webhook: { Args: { p_data: Json }; Returns: undefined }
      archive_entities: {
        Args: { p_entity: string; p_ids: string[]; p_restore?: boolean }
        Returns: undefined
      }
      claim_agreement_dispatch: { Args: { p_id: string }; Returns: string }
      close_assignment_complete: {
        Args: {
          p_condition: string
          p_id: string
          p_items: Json
          p_photos: string[]
        }
        Returns: undefined
      }
      create_assignment_complete: {
        Args: {
          p_asset_id: string
          p_assigned_at: string
          p_content: string
          p_delivery_condition: string
          p_employee_id: string
          p_id: string
          p_items: Json
          p_notes: string
          p_photos: string[]
          p_template_id: string
        }
        Returns: string
      }
      finalize_access_invite: {
        Args: {
          p_email: string
          p_name: string
          p_roles: string[]
          p_user: string
        }
        Returns: undefined
      }
      finish_import: { Args: { p_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      is_operator: { Args: { _user_id: string }; Returns: boolean }
      prepare_import: {
        Args: { p_id: string; p_kind: string; p_name: string; p_rows: Json }
        Returns: string
      }
      qa_assert_operator: { Args: never; Returns: undefined }
      qa_transaction: {
        Args: { p_action: string; p_data: Json }
        Returns: Json
      }
      set_access_roles_atomic: {
        Args: { p_roles: string[]; p_user: string }
        Returns: undefined
      }
    }
    Enums: {
      agreement_status:
        | "rascunho"
        | "enviado"
        | "visualizado"
        | "assinado"
        | "recusado"
        | "expirado"
      app_role: "admin" | "ti" | "gestor" | "colaborador"
      asset_status:
        | "disponivel"
        | "em_uso"
        | "manutencao"
        | "devolvido"
        | "extraviado"
      asset_type: "notebook" | "celular" | "monitor" | "acessorio" | "outro"
      assignment_status: "ativo" | "encerrado"
      employee_status: "ativo" | "inativo" | "afastado"
      profile_status: "ativo" | "convidado" | "desativado"
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
      agreement_status: [
        "rascunho",
        "enviado",
        "visualizado",
        "assinado",
        "recusado",
        "expirado",
      ],
      app_role: ["admin", "ti", "gestor", "colaborador"],
      asset_status: [
        "disponivel",
        "em_uso",
        "manutencao",
        "devolvido",
        "extraviado",
      ],
      asset_type: ["notebook", "celular", "monitor", "acessorio", "outro"],
      assignment_status: ["ativo", "encerrado"],
      employee_status: ["ativo", "inativo", "afastado"],
      profile_status: ["ativo", "convidado", "desativado"],
    },
  },
} as const
