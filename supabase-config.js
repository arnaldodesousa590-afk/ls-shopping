// LS SHOPPING - Ligação única ao Supabase (supabase-config.js)
const SUPABASE_URL_LS = 'https://anlzhexippncsdxnwiel.supabase.co';
const SUPABASE_CHAVE_LS = 'sb_publishable_XUgtq7ktyeAhE8_bFya5ug_UBfoY0n6';

window.supabaseLS = window.supabase
    ? window.supabase.createClient(SUPABASE_URL_LS, SUPABASE_CHAVE_LS)
    : null;