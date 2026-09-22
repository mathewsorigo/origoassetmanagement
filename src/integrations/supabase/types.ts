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
          employee_id: string
          external_envelope_id: string | null
          id: string
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
          employee_id: string
          external_envelope_id?: string | null
          id?: string
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
          employee_id?: string
          external_envelope_id?: string | null
          id?: string
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
            foreignKeyName: "agreements_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
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
          asset_type: Database["public"]["Enums"]["asset_type"]
          brand: string | null
          condition: string | null
          contract_number: string | null
          created_at: string
          id: string
          imei: string | null
          intune_device_id: string | null
          intune_last_sync: string | null
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
          asset_type?: Database["public"]["Enums"]["asset_type"]
          brand?: string | null
          condition?: string | null
          contract_number?: string | null
          created_at?: string
          id?: string
          imei?: string | null
          intune_device_id?: string | null
          intune_last_sync?: string | null
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
          asset_type?: Database["public"]["Enums"]["asset_type"]
          brand?: string | null
          condition?: string | null
          contract_number?: string | null
          created_at?: string
          id?: string
          imei?: string | null
          intune_device_id?: string | null
          intune_last_sync?: string | null
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
            foreignKeyName: "assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
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
            foreignKeyName: "documents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          cpf: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          intune_id: string | null
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
          cpf?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id?: string
          intune_id?: string | null
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
          cpf?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          intune_id?: string | null
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
      import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          created_rows: number
          failed_rows: number
          file_name: string | null
          id: string
          kind: string
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
          checked_at: string
          checked_by: string | null
          divergencia: string | null
          id: string
          session_id: string
        }
        Insert: {
          asset_id: string
          checked_at?: string
          checked_by?: string | null
          divergencia?: string | null
          id?: string
          session_id: string
        }
        Update: {
          asset_id?: string
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
            foreignKeyName: "inventory_checks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "inventory_sessions"
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
          name: string
          scope: Json
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          scope?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          scope?: Json
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
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
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
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
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
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      is_operator: { Args: { _user_id: string }; Returns: boolean }
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
