// =========================================================
// LS SHOPPING - Ligação única ao Supabase (supabase-config.js)
// Este ficheiro tem de carregar logo a seguir à biblioteca do
// Supabase e ANTES de todos os outros scripts do site.
// =========================================================

const SUPABASE_URL_LS = 'https://anlzhexippncsdxnwiel.supabase.co';

// Publishable key COMPLETA (nunca use aqui a chave que começa por sb_secret_)
const SUPABASE_CHAVE_LS = 'sb_publishable_XUgtq7ktyeAhE8_bFya5ug_UBfoY0n6';

// Avisos no console para apanhar enganos
if (SUPABASE_CHAVE_LS.includes('COLE_AQUI')) {
    console.error('supabase-config.js: falta colar a chave publicável completa.');
}
if (SUPABASE_CHAVE_LS.startsWith('sb_secret_')) {
    console.error('supabase-config.js: esta é a chave SECRETA. Use só a Publishable key.');
}
if (SUPABASE_CHAVE_LS.length < 40) {
    console.error('supabase-config.js: a chave parece estar incompleta (cortada).');
}

// A ligação que todos os ficheiros partilham
window.supabaseLS = window.supabase
    ? window.supabase.createClient(SUPABASE_URL_LS, SUPABASE_CHAVE_LS)
    : null;