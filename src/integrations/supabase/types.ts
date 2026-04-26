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
      backgrounds: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          file_path: string
          id: string
          image_url: string
          name: string
          tags: string[]
          thumbnail_path: string | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          file_path: string
          id?: string
          image_url: string
          name?: string
          tags?: string[]
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          file_path?: string
          id?: string
          image_url?: string
          name?: string
          tags?: string[]
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      images: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          file_path: string
          id: string
          image_url: string
          name: string
          tags: string[]
          thumbnail_path: string | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          file_path: string
          id?: string
          image_url: string
          name?: string
          tags?: string[]
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          file_path?: string
          id?: string
          image_url?: string
          name?: string
          tags?: string[]
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      logos: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          file_path: string
          id: string
          image_url: string
          name: string
          tags: string[]
          thumbnail_path: string | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          file_path: string
          id?: string
          image_url: string
          name?: string
          tags?: string[]
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          file_path?: string
          id?: string
          image_url?: string
          name?: string
          tags?: string[]
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      poll_answers: {
        Row: {
          color: string
          created_at: string
          id: string
          is_correct: boolean
          label: string
          live_votes: number
          poll_id: string
          short_label: string
          sort_order: number
          test_votes: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          label: string
          live_votes?: number
          poll_id: string
          short_label?: string
          sort_order?: number
          test_votes?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          label?: string
          live_votes?: number
          poll_id?: string
          short_label?: string
          sort_order?: number
          test_votes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_answers_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_assets: {
        Row: {
          anchor: string
          asset_type: string
          config_json: Json
          created_at: string
          height_pct: number
          id: string
          locked: boolean
          opacity: number
          poll_id: string
          scale: number
          updated_at: string
          visible: boolean
          width_pct: number
          x_pct: number
          y_pct: number
          z_index: number
        }
        Insert: {
          anchor?: string
          asset_type: string
          config_json?: Json
          created_at?: string
          height_pct?: number
          id?: string
          locked?: boolean
          opacity?: number
          poll_id: string
          scale?: number
          updated_at?: string
          visible?: boolean
          width_pct?: number
          x_pct?: number
          y_pct?: number
          z_index?: number
        }
        Update: {
          anchor?: string
          asset_type?: string
          config_json?: Json
          created_at?: string
          height_pct?: number
          id?: string
          locked?: boolean
          opacity?: number
          poll_id?: string
          scale?: number
          updated_at?: string
          visible?: boolean
          width_pct?: number
          x_pct?: number
          y_pct?: number
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_assets_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_test_data: {
        Row: {
          mode: string
          per_answer_votes: Json
          poll_id: string
          total_votes: number
          updated_at: string
        }
        Insert: {
          mode?: string
          per_answer_votes?: Json
          poll_id: string
          total_votes?: number
          updated_at?: string
        }
        Update: {
          mode?: string
          per_answer_votes?: Json
          poll_id?: string
          total_votes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_test_data_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: true
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_viewer_configs: {
        Row: {
          auto_close_seconds: number | null
          desktop_enabled: boolean
          mobile_enabled: boolean
          poll_id: string
          show_results_after_close: boolean
          show_results_live: boolean
          show_thank_you: boolean
          updated_at: string
        }
        Insert: {
          auto_close_seconds?: number | null
          desktop_enabled?: boolean
          mobile_enabled?: boolean
          poll_id: string
          show_results_after_close?: boolean
          show_results_live?: boolean
          show_thank_you?: boolean
          updated_at?: string
        }
        Update: {
          auto_close_seconds?: number | null
          desktop_enabled?: boolean
          mobile_enabled?: boolean
          poll_id?: string
          show_results_after_close?: boolean
          show_results_live?: boolean
          show_thank_you?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_viewer_configs_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: true
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          answer_type: string
          answers: Json
          auto_close_seconds: number | null
          autosaved_at: string | null
          bg_color: string
          bg_image: string | null
          block_label: string | null
          block_letter: string
          block_position: number
          created_at: string
          id: string
          internal_name: string
          label_style: string
          mc_label_style: string
          on_air_question: string
          post_vote_delay_ms: number
          preview_data_mode: string
          project_id: string | null
          question: string
          scene_type: string
          show_final_results: boolean
          show_live_results: boolean
          show_thank_you: boolean
          slate_image: string | null
          slate_subline_style: Json
          slate_subline_text: string
          slate_text: string
          slate_text_style: Json
          slug: string
          status: string
          subheadline: string
          template: string
          template_type: string
          updated_at: string
          user_id: string
          viewer_slug: string
        }
        Insert: {
          answer_type?: string
          answers?: Json
          auto_close_seconds?: number | null
          autosaved_at?: string | null
          bg_color?: string
          bg_image?: string | null
          block_label?: string | null
          block_letter?: string
          block_position?: number
          created_at?: string
          id?: string
          internal_name?: string
          label_style?: string
          mc_label_style?: string
          on_air_question?: string
          post_vote_delay_ms?: number
          preview_data_mode?: string
          project_id?: string | null
          question?: string
          scene_type?: string
          show_final_results?: boolean
          show_live_results?: boolean
          show_thank_you?: boolean
          slate_image?: string | null
          slate_subline_style?: Json
          slate_subline_text?: string
          slate_text?: string
          slate_text_style?: Json
          slug?: string
          status?: string
          subheadline?: string
          template?: string
          template_type?: string
          updated_at?: string
          user_id: string
          viewer_slug?: string
        }
        Update: {
          answer_type?: string
          answers?: Json
          auto_close_seconds?: number | null
          autosaved_at?: string | null
          bg_color?: string
          bg_image?: string | null
          block_label?: string | null
          block_letter?: string
          block_position?: number
          created_at?: string
          id?: string
          internal_name?: string
          label_style?: string
          mc_label_style?: string
          on_air_question?: string
          post_vote_delay_ms?: number
          preview_data_mode?: string
          project_id?: string | null
          question?: string
          scene_type?: string
          show_final_results?: boolean
          show_live_results?: boolean
          show_thank_you?: boolean
          slate_image?: string | null
          slate_subline_style?: Json
          slate_subline_text?: string
          slate_text?: string
          slate_text_style?: Json
          slug?: string
          status?: string
          subheadline?: string
          template?: string
          template_type?: string
          updated_at?: string
          user_id?: string
          viewer_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_backgrounds: {
        Row: {
          background_id: string
          created_at: string
          id: string
          pinned: boolean
          project_id: string
        }
        Insert: {
          background_id: string
          created_at?: string
          id?: string
          pinned?: boolean
          project_id: string
        }
        Update: {
          background_id?: string
          created_at?: string
          id?: string
          pinned?: boolean
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_backgrounds_background_id_fkey"
            columns: ["background_id"]
            isOneToOne: false
            referencedRelation: "backgrounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_backgrounds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_live_state: {
        Row: {
          active_folder_id: string | null
          active_poll_id: string | null
          live_folder_id: string | null
          live_poll_snapshot: Json | null
          output_state: string
          preview_poll_id: string | null
          project_id: string
          transition_type: string
          updated_at: string
          updated_by: string | null
          voting_state: string
        }
        Insert: {
          active_folder_id?: string | null
          active_poll_id?: string | null
          live_folder_id?: string | null
          live_poll_snapshot?: Json | null
          output_state?: string
          preview_poll_id?: string | null
          project_id: string
          transition_type?: string
          updated_at?: string
          updated_by?: string | null
          voting_state?: string
        }
        Update: {
          active_folder_id?: string | null
          active_poll_id?: string | null
          live_folder_id?: string | null
          live_poll_snapshot?: Json | null
          output_state?: string
          preview_poll_id?: string | null
          project_id?: string
          transition_type?: string
          updated_at?: string
          updated_by?: string | null
          voting_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_live_state_active_poll_id_fkey"
            columns: ["active_poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_live_state_preview_poll_id_fkey"
            columns: ["preview_poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_live_state_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          default_background_id: string | null
          description: string | null
          id: string
          last_used_at: string
          name: string
          notes: string
          project_date: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          default_background_id?: string | null
          description?: string | null
          id?: string
          last_used_at?: string
          name: string
          notes?: string
          project_date?: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          default_background_id?: string | null
          description?: string | null
          id?: string
          last_used_at?: string
          name?: string
          notes?: string
          project_date?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_default_background_id_fkey"
            columns: ["default_background_id"]
            isOneToOne: false
            referencedRelation: "backgrounds"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_preferences: {
        Row: {
          center_pane_height: number | null
          complexity: string
          id: string
          layout_json: Json
          left_pane_width: number | null
          mode: string
          preview_overlays: Json
          project_id: string | null
          right_pane_width: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          center_pane_height?: number | null
          complexity?: string
          id?: string
          layout_json?: Json
          left_pane_width?: number | null
          mode?: string
          preview_overlays?: Json
          project_id?: string | null
          right_pane_width?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          center_pane_height?: number | null
          complexity?: string
          id?: string
          layout_json?: Json
          left_pane_width?: number | null
          mode?: string
          preview_overlays?: Json
          project_id?: string | null
          right_pane_width?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_preferences_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_viewer_poll_by_slug: {
        Args: { _slug: string }
        Returns: {
          bg_color: string
          bg_image: string
          id: string
          post_vote_delay_ms: number
          project_id: string
          question: string
          show_final_results: boolean
          show_live_results: boolean
          show_thank_you: boolean
          slate_image: string
          slate_subline_text: string
          slate_text: string
          subheadline: string
        }[]
      }
      normalize_project_tags: { Args: { _tags: string[] }; Returns: string[] }
      poll_is_publicly_live: { Args: { _poll_id: string }; Returns: boolean }
      poll_owned_by_user: { Args: { _poll_id: string }; Returns: boolean }
      project_owned_by_user: { Args: { _project_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
