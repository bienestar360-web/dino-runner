const LB_TABLE = 'leaderboard_dodge';
let supabaseClient = null;

function initSupabase() {
    if (supabaseClient) return supabaseClient;
    const { createClient } = window.supabase;
    supabaseClient = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    return supabaseClient;
}

// True si el alias ya está tomado
async function verificarAlias(alias) {
    const client = initSupabase();
    const { data, error } = await client
        .from(LB_TABLE)
        .select('alias')
        .eq('alias', alias)
        .maybeSingle();
    if (error) throw error;
    return !!data;
}

// Genera e inserta un alias aleatorio no repetido
async function asignarAliasDefault() {
    const client = initSupabase();
    for (let i = 0; i < 20; i++) {
        const num = Math.floor(1000 + Math.random() * 9000);
        const alias = `${CONFIG.defaultAliasPrefix}_${num}`;
        if (await verificarAlias(alias)) continue;
        const { data, error } = await client
            .from(LB_TABLE)
            .insert({ alias, score: 0 })
            .select()
            .single();
        if (error) {
            if (error.code === '23505') continue; // carrera: alias ocupado
            throw error;
        }
        return data.alias;
    }
    throw new Error('No se pudo generar un alias único');
}

// Guarda la puntuación final (solo si mejora la anterior)
async function enviarPuntuacion(alias, score) {
    const client = initSupabase();
    const { data: prev, error: readErr } = await client
        .from(LB_TABLE)
        .select('score')
        .eq('alias', alias)
        .maybeSingle();
    if (readErr) throw readErr;

    if (!prev) {
        const { data, error } = await client
            .from(LB_TABLE)
            .insert({ alias, score })
            .select()
            .single();
        if (error) throw error;
        return data;
    }
    if (score <= prev.score) return { alias, score: prev.score };

    const { data, error } = await client
        .from(LB_TABLE)
        .update({ score })
        .eq('alias', alias)
        .select()
        .single();
    if (error) throw error;
    return data;
}

// Top 3 histórico
async function obtenerTop3() {
    const client = initSupabase();
    const { data, error } = await client
        .from(LB_TABLE)
        .select('alias, score')
        .order('score', { ascending: false })
        .limit(3);
    if (error) throw error;
    return data || [];
}

// Posición del jugador (1 = mejor)
async function obtenerPosicion(alias, score) {
    const client = initSupabase();
    const { data: mine, error: mErr } = await client
        .from(LB_TABLE)
        .select('score')
        .eq('alias', alias)
        .maybeSingle();
    if (mErr) throw mErr;

    const best = Math.max(mine ? mine.score : 0, score || 0);
    const { count, error } = await client
        .from(LB_TABLE)
        .select('alias', { count: 'exact', head: true })
        .gt('score', best);
    if (error) throw error;
    return (count || 0) + 1;
}