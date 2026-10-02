import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://ltnipbdpwixeqlkcajct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0bmlwYmRwd2l4ZXFsa2NhamN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NjAyMzcsImV4cCI6MjEwNjUzNjIzN30.WRzU_rzsnXEjVVabJg07TomO6u_euaqCNXLnT6N81fc';

export const supabase = createClient(supabaseUrl, supabaseKey);
