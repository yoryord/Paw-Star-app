import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vynhdjkwnxuskbzfhixy.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmhkamt3bnh1c2tiemZoaXh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDI2OTEsImV4cCI6MjA4Nzc3ODY5MX0.S6_IXTp9wCx1kpQK-R7OLyWL1Ks8Zyl1Hv4G0OZSQ_4';

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
