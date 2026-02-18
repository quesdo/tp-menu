// Supabase Configuration
window.SUPABASE_URL = 'https://jajibuwuhotlqyezliei.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphamlidXd1aG90bHF5ZXpsaWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MDIzMTcsImV4cCI6MjA4MDk3ODMxN30.-Mo_qs4ui14X34t424yU6vQqdLRtcL4qluU2I5am2Yg';

// Generate a unique user ID for this session
window.USER_ID = 'user_' + Math.random().toString(36).substr(2, 9);

console.log('Supabase configuration loaded');
console.log('User ID:', window.USER_ID);
