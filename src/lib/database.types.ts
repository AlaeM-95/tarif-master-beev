// Types générés manuellement pour correspondre au schéma Supabase.
// À régénérer via `supabase gen types typescript` si vous modifiez la structure.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      vehicles: {
        Row: {
          id: string;
          brand: string;
          model: string;
          version: string | null;
          category: string | null;
          energy: string | null;
          battery_kwh: number | null;
          range_wltp: number | null;
          power_hp: number | null;
          consumption: number | null;
          co2: number | null;
          fiscal_hp: number | null;
          env_score: number | null;
          price_ttc: number;
          monthly_lld: number;
          image: string | null;
          services: Json | null;
          position: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          brand: string;
          model: string;
          version?: string | null;
          category?: string | null;
          energy?: string | null;
          battery_kwh?: number | null;
          range_wltp?: number | null;
          power_hp?: number | null;
          consumption?: number | null;
          co2?: number | null;
          fiscal_hp?: number | null;
          env_score?: number | null;
          price_ttc: number;
          monthly_lld: number;
          image?: string | null;
          services?: Json | null;
          position?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["vehicles"]["Insert"]>;
      };
      chargers: {
        Row: {
          id: string;
          brand: string;
          model: string;
          power_kw: number;
          type: string | null;
          deployment: "domicile" | "site" | null;
          price_ht: number;
          install_price_ht: number;
          features: Json | null;
          image: string | null;
          description: string | null;
          default_line_items: Json | null;
          position: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          brand: string;
          model: string;
          power_kw: number;
          type?: string | null;
          deployment?: "domicile" | "site" | null;
          price_ht: number;
          install_price_ht?: number;
          features?: Json | null;
          image?: string | null;
          description?: string | null;
          default_line_items?: Json | null;
          position?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["chargers"]["Insert"]>;
      };
      materials: {
        Row: {
          id: string;
          label: string;
          brand: string | null;
          model: string | null;
          category: string;
          price_buy_ht: number;
          price_sell_min_ht: number;
          position: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          label: string;
          brand?: string | null;
          model?: string | null;
          category: string;
          price_buy_ht?: number;
          price_sell_min_ht?: number;
          position?: number;
          active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["materials"]["Insert"]>;
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          role: "admin" | "visitor";
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          role?: "admin" | "visitor";
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      pdf_settings: {
        Row: {
          project_type: "vehicles" | "home" | "site";
          color_ink: string;
          color_accent: string;
          color_lavender: string;
          color_bg: string;
          logo_url: string | null;
          cover_image_url: string | null;
          cover_subtitle: string | null;
          why_beev_intro: string | null;
          why_beev_bullets: Json | null;
          validation_conditions: string | null;
          validation_bpa_text: string | null;
          validation_bpa_title: string | null;
          updated_at: string;
        };
        Insert: {
          project_type: "vehicles" | "home" | "site";
          color_ink?: string;
          color_accent?: string;
          color_lavender?: string;
          color_bg?: string;
          logo_url?: string | null;
          cover_image_url?: string | null;
          cover_subtitle?: string | null;
          why_beev_intro?: string | null;
          why_beev_bullets?: Json | null;
          validation_conditions?: string | null;
          validation_bpa_text?: string | null;
          validation_bpa_title?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["pdf_settings"]["Insert"]>;
      };
      journey_steps: {
        Row: {
          id: string;
          project_type: "vehicles" | "home" | "site";
          position: number;
          step_number: string;
          title: string;
          summary: string | null;
          duration: string | null;
          beev_actions: Json | null;
          client_actions: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_type: "vehicles" | "home" | "site";
          position: number;
          step_number: string;
          title: string;
          summary?: string | null;
          duration?: string | null;
          beev_actions?: Json | null;
          client_actions?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["journey_steps"]["Insert"]>;
      };
      proposals: {
        Row: {
          id: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          status: "draft" | "sent" | "signed" | "refused" | "expired";
          follow_up_date: string | null;
          client_company: string;
          client_contact: string | null;
          client_email: string | null;
          client_notes: string | null;
          proposal_date: string | null;
          sales_rep_name: string | null;
          sales_rep_email: string | null;
          sales_rep_phone: string | null;
          project_type: "vehicles" | "home" | "site";
          selected_vehicles: Json;
          selected_chargers: Json;
          energy_params: Json | null;
          total_amount: number;
          vehicle_count: number;
          charger_count: number;
          internal_notes: string | null;
        };
        Insert: {
          id?: string;
          created_by?: string | null;
          status?: "draft" | "sent" | "signed" | "refused" | "expired";
          follow_up_date?: string | null;
          client_company: string;
          client_contact?: string | null;
          client_email?: string | null;
          client_notes?: string | null;
          proposal_date?: string | null;
          sales_rep_name?: string | null;
          sales_rep_email?: string | null;
          sales_rep_phone?: string | null;
          project_type: "vehicles" | "home" | "site";
          selected_vehicles?: Json;
          selected_chargers?: Json;
          energy_params?: Json | null;
          total_amount?: number;
          vehicle_count?: number;
          charger_count?: number;
          internal_notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["proposals"]["Insert"]>;
      };
    };
  };
};
