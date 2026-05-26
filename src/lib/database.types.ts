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
          default_line_items?: Json | null;
          position?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["chargers"]["Insert"]>;
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
    };
  };
};
