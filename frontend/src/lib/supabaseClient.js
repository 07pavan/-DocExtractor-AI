import { createClient } from '@supabase/supabase-js';

// Clean and sanitize environment variables
let rawUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://eqfhchblpruxifztwuxd.supabase.co').trim();
// Strip extra quotation marks, spaces, or /rest/v1 suffixes if mistakenly entered
rawUrl = rawUrl.replace(/^["']|["']$/g, '').replace(/\/+$/, '');
if (rawUrl.endsWith('/rest/v1')) {
  rawUrl = rawUrl.substring(0, rawUrl.length - '/rest/v1'.length);
}

let rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxZmhjaGJscHJ1eGlmenR3dXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMzA0NjIsImV4cCI6MjEwMzkwNjQ2Mn0.hITs--mnh-T3sPgRi7MOJvwxmfbrHZRL3e_x_K9uhCk').trim();
rawAnonKey = rawAnonKey.replace(/^["']|["']$/g, '');

export const supabase = createClient(rawUrl, rawAnonKey);
