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
      ad_templates: {
        Row: {
          aspect_ratio: string | null
          concept_input: string | null
          concept_source: string
          concept_video_url: string | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          name: string
          preview_video_url: string | null
          status: string
          tags: string[] | null
          template_json: Json
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aspect_ratio?: string | null
          concept_input?: string | null
          concept_source?: string
          concept_video_url?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          name: string
          preview_video_url?: string | null
          status?: string
          tags?: string[] | null
          template_json?: Json
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aspect_ratio?: string | null
          concept_input?: string | null
          concept_source?: string
          concept_video_url?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          name?: string
          preview_video_url?: string | null
          status?: string
          tags?: string[] | null
          template_json?: Json
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_projects: {
        Row: {
          created_at: string
          current_accepted_version_id: string | null
          deleted_at: string | null
          id: string
          mode: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_accepted_version_id?: string | null
          deleted_at?: string | null
          id?: string
          mode?: string
          status?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_accepted_version_id?: string | null
          deleted_at?: string | null
          id?: string
          mode?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_project_versions: {
        Row: { campaign_recipe: Json; change_reason: string | null; configuration: Json; created_at: string; id: string; mode: string; parent_version_id: string | null; product_recipe: Json; project_id: string; template_version_id: string | null; user_id: string; version_number: number }
        Insert: { campaign_recipe?: Json; change_reason?: string | null; configuration: Json; created_at?: string; id?: string; mode: string; parent_version_id?: string | null; product_recipe?: Json; project_id: string; template_version_id?: string | null; user_id: string; version_number: number }
        Update: { campaign_recipe?: Json; change_reason?: string | null; configuration?: Json; created_at?: string; id?: string; mode?: string; parent_version_id?: string | null; product_recipe?: Json; project_id?: string; template_version_id?: string | null; user_id?: string; version_number?: number }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          target_count: number | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_count?: number | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_count?: number | null
        }
        Relationships: []
      }
      agent_profiles: {
        Row: {
          agent_id: string
          display_name: string
          doc_summary: string
          examples: string
          id: string
          is_active: boolean
          system_addendum: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agent_id: string
          display_name: string
          doc_summary?: string
          examples?: string
          id?: string
          is_active?: boolean
          system_addendum?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agent_id?: string
          display_name?: string
          doc_summary?: string
          examples?: string
          id?: string
          is_active?: boolean
          system_addendum?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          link_text: string | null
          link_text_ar: string | null
          link_url: string | null
          message: string
          message_ar: string | null
          starts_at: string | null
          title: string
          title_ar: string | null
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_text?: string | null
          link_text_ar?: string | null
          link_url?: string | null
          message: string
          message_ar?: string | null
          starts_at?: string | null
          title: string
          title_ar?: string | null
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_text?: string | null
          link_text_ar?: string | null
          link_url?: string | null
          message?: string
          message_ar?: string | null
          starts_at?: string | null
          title?: string
          title_ar?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_identities: {
        Row: {
          avoid_colors: Json | null
          brand_voice: string | null
          created_at: string
          finish_vibe: string | null
          font_hint: string | null
          id: string
          industry: string | null
          lighting_style: string | null
          logo_path: string | null
          logo_treatment: string | null
          mood_notes: string | null
          pacing: string | null
          primary_color: string | null
          supporting_colors: Json | null
          tagline: string | null
          typography_vibe: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avoid_colors?: Json | null
          brand_voice?: string | null
          created_at?: string
          finish_vibe?: string | null
          font_hint?: string | null
          id?: string
          industry?: string | null
          lighting_style?: string | null
          logo_path?: string | null
          logo_treatment?: string | null
          mood_notes?: string | null
          pacing?: string | null
          primary_color?: string | null
          supporting_colors?: Json | null
          tagline?: string | null
          typography_vibe?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avoid_colors?: Json | null
          brand_voice?: string | null
          created_at?: string
          finish_vibe?: string | null
          font_hint?: string | null
          id?: string
          industry?: string | null
          lighting_style?: string | null
          logo_path?: string | null
          logo_treatment?: string | null
          mood_notes?: string | null
          pacing?: string | null
          primary_color?: string | null
          supporting_colors?: Json | null
          tagline?: string | null
          typography_vibe?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      brand_kit_selection: {
        Row: {
          brand_kit_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_kit_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_kit_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_kit_selection_brand_kit_id_fkey"
            columns: ["brand_kit_id"]
            isOneToOne: false
            referencedRelation: "brand_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_kit_selections: {
        Row: {
          brand_kit_id: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_kit_id: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_kit_id?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_kit_selections_brand_kit_id_fkey"
            columns: ["brand_kit_id"]
            isOneToOne: false
            referencedRelation: "brand_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_kits: {
        Row: {
          audience: string | null
          category: string | null
          created_at: string
          description: string
          hero_colors: Json | null
          id: string
          logo_path: string | null
          materials: string | null
          name: string
          packaging: string | null
          subject: string
          tagline: string | null
          updated_at: string
          url: string | null
          user_id: string
          visual_parts: string | null
        }
        Insert: {
          audience?: string | null
          category?: string | null
          created_at?: string
          description?: string
          hero_colors?: Json | null
          id?: string
          logo_path?: string | null
          materials?: string | null
          name?: string
          packaging?: string | null
          subject?: string
          tagline?: string | null
          updated_at?: string
          url?: string | null
          user_id: string
          visual_parts?: string | null
        }
        Update: {
          audience?: string | null
          category?: string | null
          created_at?: string
          description?: string
          hero_colors?: Json | null
          id?: string
          logo_path?: string | null
          materials?: string | null
          name?: string
          packaging?: string | null
          subject?: string
          tagline?: string | null
          updated_at?: string
          url?: string | null
          user_id?: string
          visual_parts?: string | null
        }
        Relationships: []
      }
      character_kit_selection: {
        Row: {
          character_kit_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          character_kit_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          character_kit_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      character_kit_selections: {
        Row: {
          character_kit_id: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          character_kit_id: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          character_kit_id?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_kit_selections_character_kit_id_fkey"
            columns: ["character_kit_id"]
            isOneToOne: false
            referencedRelation: "character_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      character_kits: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          reference_path: string | null
          role: string | null
          shot_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          reference_path?: string | null
          role?: string | null
          shot_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          reference_path?: string | null
          role?: string | null
          shot_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          balance_after: number
          created_at: string
          delta: number
          id: string
          metadata: Json | null
          reason: string
          ref_id: string | null
          user_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          delta: number
          id?: string
          metadata?: Json | null
          reason: string
          ref_id?: string | null
          user_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          delta?: number
          id?: string
          metadata?: Json | null
          reason?: string
          ref_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      credit_prices: {
        Row: {
          amount: number
          description: string | null
          key: string
          kind: string
          updated_at: string
        }
        Insert: {
          amount: number
          description?: string | null
          key: string
          kind: string
          updated_at?: string
        }
        Update: {
          amount?: number
          description?: string | null
          key?: string
          kind?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_topups: {
        Row: {
          cents: number | null
          created_at: string
          credits: number
          id: string
          provider: string | null
          provider_ref: string | null
          status: string
          user_id: string
        }
        Insert: {
          cents?: number | null
          created_at?: string
          credits: number
          id?: string
          provider?: string | null
          provider_ref?: string | null
          status?: string
          user_id: string
        }
        Update: {
          cents?: number | null
          created_at?: string
          credits?: number
          id?: string
          provider?: string | null
          provider_ref?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_presets: {
        Row: {
          anim_class: string | null
          best_for: string
          created_at: string
          created_by: string | null
          description: string
          group_id: string
          icon_name: string
          id: string
          label: string
        }
        Insert: {
          anim_class?: string | null
          best_for?: string
          created_at?: string
          created_by?: string | null
          description?: string
          group_id: string
          icon_name: string
          id: string
          label: string
        }
        Update: {
          anim_class?: string | null
          best_for?: string
          created_at?: string
          created_by?: string | null
          description?: string
          group_id?: string
          icon_name?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      director_message_feedback: {
        Row: {
          chip_label: string | null
          content: string
          content_kind: string
          created_at: string
          id: string
          message_index: number | null
          question_text: string | null
          rating: number
          session_id: string | null
          user_id: string
        }
        Insert: {
          chip_label?: string | null
          content: string
          content_kind: string
          created_at?: string
          id?: string
          message_index?: number | null
          question_text?: string | null
          rating: number
          session_id?: string | null
          user_id: string
        }
        Update: {
          chip_label?: string | null
          content?: string
          content_kind?: string
          created_at?: string
          id?: string
          message_index?: number | null
          question_text?: string | null
          rating?: number
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      director_sessions: {
        Row: {
          brief_context: Json
          created_at: string
          final_prompt: string | null
          id: string
          messages: Json
          pinned: boolean
          plan: Json
          title: string | null
          updated_at: string
          user_id: string
          video_job_id: string | null
        }
        Insert: {
          brief_context?: Json
          created_at?: string
          final_prompt?: string | null
          id?: string
          messages?: Json
          pinned?: boolean
          plan?: Json
          title?: string | null
          updated_at?: string
          user_id: string
          video_job_id?: string | null
        }
        Update: {
          brief_context?: Json
          created_at?: string
          final_prompt?: string | null
          id?: string
          messages?: Json
          pinned?: boolean
          plan?: Json
          title?: string | null
          updated_at?: string
          user_id?: string
          video_job_id?: string | null
        }
        Relationships: []
      }
      director_user_memory: {
        Row: {
          memory: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          memory?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          memory?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      generation_events: {
        Row: {
          created_at: string
          id: string
          session_id: string
          target_model: string
          user_id: string | null
          workflow_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          target_model: string
          user_id?: string | null
          workflow_type: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          target_model?: string
          user_id?: string | null
          workflow_type?: string
        }
        Relationships: []
      }
      media_favorites: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          media_key: string
          session_id: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          media_key: string
          session_id?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          media_key?: string
          session_id?: string | null
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      media_folder_items: {
        Row: {
          created_at: string
          folder_id: string
          id: string
          kind: string
          label: string | null
          media_key: string
          session_id: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          folder_id: string
          id?: string
          kind: string
          label?: string | null
          media_key: string
          session_id?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          folder_id?: string
          id?: string
          kind?: string
          label?: string | null
          media_key?: string
          session_id?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_folder_items_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "media_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      media_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      media_hidden: {
        Row: {
          created_at: string
          media_key: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          media_key: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          media_key?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      media_labels: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          media_key: string
          name: string
          session_id: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          media_key: string
          name: string
          session_id?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          media_key?: string
          name?: string
          session_id?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      model_availability: {
        Row: {
          available: boolean
          display_name: string
          first_available_at: string | null
          last_checked_at: string | null
          last_error: string | null
          model_id: string
          updated_at: string
        }
        Insert: {
          available?: boolean
          display_name: string
          first_available_at?: string | null
          last_checked_at?: string | null
          last_error?: string | null
          model_id: string
          updated_at?: string
        }
        Update: {
          available?: boolean
          display_name?: string
          first_available_at?: string | null
          last_checked_at?: string | null
          last_error?: string | null
          model_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          id: string
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          message_ar: string | null
          title: string
          title_ar: string | null
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          message_ar?: string | null
          title: string
          title_ar?: string | null
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          message_ar?: string | null
          title?: string
          title_ar?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      page_visits: {
        Row: {
          id: string
          page_path: string
          session_id: string
          user_agent: string | null
          visited_at: string
        }
        Insert: {
          id?: string
          page_path: string
          session_id: string
          user_agent?: string | null
          visited_at?: string
        }
        Update: {
          id?: string
          page_path?: string
          session_id?: string
          user_agent?: string | null
          visited_at?: string
        }
        Relationships: []
      }
      preset_preview_meta: {
        Row: {
          generated_at: string
          generated_by: string | null
          preset_id: string
          preview_model: string | null
        }
        Insert: {
          generated_at?: string
          generated_by?: string | null
          preset_id: string
          preview_model?: string | null
        }
        Update: {
          generated_at?: string
          generated_by?: string | null
          preset_id?: string
          preview_model?: string | null
        }
        Relationships: []
      }
      product_references: {
        Row: {
          brand_kit_id: string
          created_at: string
          id: string
          image_path: string
          kind: string
          label: string | null
          position: number
          user_id: string
        }
        Insert: {
          brand_kit_id: string
          created_at?: string
          id?: string
          image_path: string
          kind?: string
          label?: string | null
          position?: number
          user_id: string
        }
        Update: {
          brand_kit_id?: string
          created_at?: string
          id?: string
          image_path?: string
          kind?: string
          label?: string | null
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_notes: string | null
          admin_notes_updated_at: string | null
          admin_notes_updated_by: string | null
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          admin_notes?: string | null
          admin_notes_updated_at?: string | null
          admin_notes_updated_by?: string | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          admin_notes?: string | null
          admin_notes_updated_at?: string | null
          admin_notes_updated_by?: string | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      prompt_history: {
        Row: {
          created_at: string | null
          id: string
          image_paths: string[] | null
          results: Json
          target_model: string
          user_id: string
          workflow_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_paths?: string[] | null
          results: Json
          target_model: string
          user_id: string
          workflow_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_paths?: string[] | null
          results?: Json
          target_model?: string
          user_id?: string
          workflow_type?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          id: string
          referred_user_id: string
          referrer_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          referred_user_id: string
          referrer_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          referred_user_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      shared_prompts: {
        Row: {
          agent_name: string | null
          created_at: string
          expires_at: string | null
          featured: boolean
          featured_at: string | null
          id: string
          results: Json
          slug: string
          target_model: string
          title: string | null
          updated_at: string
          user_id: string
          view_count: number
          workflow_type: string
        }
        Insert: {
          agent_name?: string | null
          created_at?: string
          expires_at?: string | null
          featured?: boolean
          featured_at?: string | null
          id?: string
          results: Json
          slug: string
          target_model: string
          title?: string | null
          updated_at?: string
          user_id: string
          view_count?: number
          workflow_type: string
        }
        Update: {
          agent_name?: string | null
          created_at?: string
          expires_at?: string | null
          featured?: boolean
          featured_at?: string | null
          id?: string
          results?: Json
          slug?: string
          target_model?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          view_count?: number
          workflow_type?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number
          last_daily_grant_at: string | null
          lifetime_granted: number
          lifetime_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          last_daily_grant_at?: string | null
          lifetime_granted?: number
          lifetime_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          last_daily_grant_at?: string | null
          lifetime_granted?: number
          lifetime_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_jobs: {
        Row: {
          act_index: number | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          error: string | null
          fal_request_id: string | null
          fal_response_url: string | null
          fal_status_url: string | null
          id: string
          liked: boolean
          metadata: Json | null
          prompt: string
          provider: string
          reference_image_urls: Json | null
          session_id: string | null
          status: string
          story_render_id: string | null
          storyboard_session_id: string | null
          storyboard_shot_index: number | null
          user_id: string
          video_url: string | null
        }
        Insert: {
          act_index?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error?: string | null
          fal_request_id?: string | null
          fal_response_url?: string | null
          fal_status_url?: string | null
          id?: string
          liked?: boolean
          metadata?: Json | null
          prompt: string
          provider: string
          reference_image_urls?: Json | null
          session_id?: string | null
          status?: string
          story_render_id?: string | null
          storyboard_session_id?: string | null
          storyboard_shot_index?: number | null
          user_id: string
          video_url?: string | null
        }
        Update: {
          act_index?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error?: string | null
          fal_request_id?: string | null
          fal_response_url?: string | null
          fal_status_url?: string | null
          id?: string
          liked?: boolean
          metadata?: Json | null
          prompt?: string
          provider?: string
          reference_image_urls?: Json | null
          session_id?: string | null
          status?: string
          story_render_id?: string | null
          storyboard_session_id?: string | null
          storyboard_shot_index?: number | null
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_jobs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "director_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      welcome_popups: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          is_active: boolean
          link_text: string | null
          link_text_ar: string | null
          link_url: string | null
          message: string
          message_ar: string | null
          title: string
          title_ar: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_text?: string | null
          link_text_ar?: string | null
          link_url?: string | null
          message: string
          message_ar?: string | null
          title: string
          title_ar?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_text?: string | null
          link_text_ar?: string | null
          link_url?: string | null
          message?: string
          message_ar?: string | null
          title?: string
          title_ar?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "welcome_popups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      announcements_public: {
        Row: {
          created_at: string | null
          ends_at: string | null
          id: string | null
          is_active: boolean | null
          link_text: string | null
          link_text_ar: string | null
          link_url: string | null
          message: string | null
          message_ar: string | null
          starts_at: string | null
          title: string | null
          title_ar: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          ends_at?: string | null
          id?: string | null
          is_active?: boolean | null
          link_text?: string | null
          link_text_ar?: string | null
          link_url?: string | null
          message?: string | null
          message_ar?: string | null
          starts_at?: string | null
          title?: string | null
          title_ar?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          ends_at?: string | null
          id?: string | null
          is_active?: boolean | null
          link_text?: string | null
          link_text_ar?: string | null
          link_url?: string | null
          message?: string | null
          message_ar?: string | null
          starts_at?: string | null
          title?: string | null
          title_ar?: string | null
          type?: string | null
        }
        Relationships: []
      }
      preset_preview_meta_public: {
        Row: {
          generated_at: string | null
          preset_id: string | null
          preview_model: string | null
        }
        Insert: {
          generated_at?: string | null
          preset_id?: string | null
          preview_model?: string | null
        }
        Update: {
          generated_at?: string | null
          preset_id?: string | null
          preview_model?: string | null
        }
        Relationships: []
      }
      shared_prompts_public: {
        Row: {
          agent_name: string | null
          created_at: string | null
          expires_at: string | null
          featured: boolean | null
          featured_at: string | null
          results: Json | null
          slug: string | null
          target_model: string | null
          title: string | null
          view_count: number | null
          workflow_type: string | null
        }
        Insert: {
          agent_name?: string | null
          created_at?: string | null
          expires_at?: string | null
          featured?: boolean | null
          featured_at?: string | null
          results?: Json | null
          slug?: string | null
          target_model?: string | null
          title?: string | null
          view_count?: number | null
          workflow_type?: string | null
        }
        Update: {
          agent_name?: string | null
          created_at?: string | null
          expires_at?: string | null
          featured?: boolean | null
          featured_at?: string | null
          results?: Json | null
          slug?: string | null
          target_model?: string | null
          title?: string | null
          view_count?: number | null
          workflow_type?: string | null
        }
        Relationships: []
      }
      welcome_popups_public: {
        Row: {
          created_at: string | null
          id: string | null
          image_url: string | null
          is_active: boolean | null
          link_text: string | null
          link_text_ar: string | null
          link_url: string | null
          message: string | null
          message_ar: string | null
          title: string | null
          title_ar: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          link_text?: string | null
          link_text_ar?: string | null
          link_url?: string | null
          message?: string | null
          message_ar?: string | null
          title?: string | null
          title_ar?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          link_text?: string | null
          link_text_ar?: string | null
          link_url?: string | null
          message?: string | null
          message_ar?: string | null
          title?: string | null
          title_ar?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      attribute_referral: { Args: { _code: string }; Returns: boolean }
      charge_credits: {
        Args: {
          _amount: number
          _metadata?: Json
          _reason: string
          _ref_id?: string
          _user_id: string
        }
        Returns: number
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      gen_referral_code: { Args: never; Returns: string }
      get_or_create_my_referral_code: { Args: never; Returns: string }
      grant_credits: {
        Args: {
          _amount: number
          _metadata?: Json
          _reason: string
          _user_id: string
        }
        Returns: number
      }
      grant_daily_credits_if_due: {
        Args: { _user_id: string }
        Returns: number
      }
      has_role:
        | {
            Args: { _role: Database["public"]["Enums"]["app_role"] }
            Returns: boolean
          }
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
      increment_shared_prompt_views: {
        Args: { _slug: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      refund_credits: {
        Args: {
          _amount: number
          _metadata?: Json
          _reason: string
          _ref_id?: string
          _user_id: string
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
