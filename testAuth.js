const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ltnipbdpwixeqlkcajct.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0bmlwYmRwd2l4ZXFsa2NhamN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NjAyMzcsImV4cCI6MjEwNjUzNjIzN30.WRzU_rzsnXEjVVabJg07TomO6u_euaqCNXLnT6N81fc'
);

async function testLogin() {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'dennys@hamilton.com',
        password: 'password123' // Or we just try to sign up
    });
    console.log("LOGIN ERR:", error);

    const { data: sData, error: sErr } = await supabase.auth.signUp({
        email: 'agente@hamilton.com',
        password: 'password123'
    });
    console.log("SIGNUP DATA:", sData);
    console.log("SIGNUP ERR:", sErr);
}
testLogin();
