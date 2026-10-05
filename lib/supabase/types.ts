/**
 * Row shapes for the tables in supabase/migrations/0001_cloud_sync.sql.
 *
 * Hand-written rather than generated so they only describe the columns sync
 * actually reads and writes. Regenerate with:
 *   npx supabase gen types typescript --project-id <ref> > lib/supabase/types.ts
 */

/** A JSON column value, as returned by Postgres. */
export type Json = string | number | boolean | null | JsonObject | JsonArray;

export type JsonObject = { [key: string]: Json | undefined };

export type JsonArray = Json[];

export interface ThingRow {
  id: string;
  user_id: string;
  name: string;
  category: string;
  kind: string;
  amount: number | null;
  currency: string;
  due_date: string | null;
  last_handled_date: string | null;
  recurrence: Json | null;
  service_interval_days: number | null;
  status: string;
  priority: string;
  notes: string | null;
  details: JsonObject;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SettingsRow {
  user_id: string;
  onboarded: boolean;
  display_name: string;
  locale: string;
  data_saver: boolean;
  notify_urgent: boolean;
  lead_days: JsonArray;
  managed_categories: JsonArray;
  updated_at: string;
}

export interface DismissalRow {
  user_id: string;
  alert_id: string;
  dismissed_at: string;
  deleted_at: string | null;
}