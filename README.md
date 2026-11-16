# Dino Runner

Endless runner 2D estilo Chrome Dino con Phaser.js 3 y Supabase.

## Archivos
- `index.html` — Pantalla de inicio, selección de alias, UI, Game Over y Top 3.
- `style.css` — Estilos modernos y responsivos.
- `config.js` — Configuración de Supabase y alias.
- `supabase.js` — Funciones de Supabase (`verificarAlias`, `asignarAliasDefault`, `enviarPuntuacion`, `obtenerTop3`, `obtenerPosicion`).
- `game.js` — Lógica del juego con Phaser.js.

## SQL de la base de datos (Supabase)

```sql
create table leaderboard (
    id uuid primary key default gen_random_uuid(),
    alias text unique not null,
    score integer not null default 0,
    created_at timestamptz default now()
);

-- RLS básico: permitir lectura pública
alter table leaderboard enable row level security;

create policy "Public select"
on leaderboard for select
to anon
using (true);

-- Permitir inserción pública (usuarios nuevos)
create policy "Public insert"
on leaderboard for insert
to anon
with check (true);

-- Permitir actualización pública del propio alias
create policy "Public update own score"
on leaderboard for update
to anon
using (true)
with check (true);
```

## Despliegue

1. Sube todos los archivos a un servidor estático (GitHub Pages, Netlify, Vercel, etc.).
2. Crea un proyecto en [Supabase](https://supabase.com).
3. Ejecuta el SQL anterior en el Editor SQL de Supabase.
4. Obtén la **Project URL** y la **anon key** desde *Proyecto > Configuración > API Keys*.
5. Rellena en `config.js`:

   ```js
   const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';
   const SUPABASE_ANON_KEY = 'TU_ANON_KEY_AQUI';
   ```

6. Abre `index.html` en tu navegador.

## Controles
- Espacio / clic / toque: saltar.
- Flecha abajo / deslizar hacia abajo: agacharse.
- Reinicio tras Game Over.
