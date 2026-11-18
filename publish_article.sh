#!/bin/bash
# publish_article.sh — Publica un artículo desde stdin (frontmatter YAML + Markdown)
# Uso: ./publish_article.sh << 'MDEOF'
#      ---
#      title: ...
#      ...
#      ---
#      # Contenido
#      MDEOF

set -e

WORKSPACE="/home/dario/Documentos/deepseek-harness/default-workspace"
cd "$WORKSPACE"

# --- 1. Leer stdin completo ---
INPUT=$(cat)

if [ -z "$INPUT" ]; then
  echo "❌ No se recibió contenido por stdin"
  exit 1
fi

# --- 2. Extraer frontmatter (entre los dos primeros ---) ---
FRONTMATTER=$(echo "$INPUT" | awk '/^---$/{c++; next} c==1{print} c==2{exit}')
BODY=$(echo "$INPUT" | awk '/^---$/{c++; next} c>=2{print}')

if [ -z "$FRONTMATTER" ]; then
  echo "❌ No se encontró frontmatter (--- ... ---)"
  exit 1
fi

# --- 3. Parsear campos del frontmatter ---
get_field() {
  echo "$FRONTMATTER" | grep "^$1:" | sed "s/^$1:[[:space:]]*//" | sed 's/^"//;s/"$//'
}

TITLE=$(get_field "title")
DESCRIPTION=$(get_field "description")
SLUG=$(get_field "slug")
KEYWORDS=$(get_field "keywords")
CATEGORY=$(get_field "category")
ARTICLE_NUMBER=$(get_field "article_number")

# Validaciones
if [ -z "$TITLE" ] || [ -z "$SLUG" ]; then
  echo "❌ Faltan campos obligatorios: title y slug"
  echo "   title='$TITLE' slug='$SLUG'"
  exit 1
fi

if [ -z "$DESCRIPTION" ]; then
  DESCRIPTION="$TITLE"
fi

echo "📄 Artículo: $TITLE"
echo "   slug: $SLUG"
echo "   categoría: ${CATEGORY:-Extras}"
echo "   número: ${ARTICLE_NUMBER:-?}"

# --- 4. Crear directorio ---
if [ -d "$SLUG" ]; then
  echo "⚠️  El directorio '$SLUG' ya existe. Abortando para no sobrescribir."
  exit 1
fi

mkdir -p "$SLUG"

# --- 5. Generar HTML ---
# Convertir Markdown básico a HTML (headers, párrafos, negritas, enlaces)
# Usamos python3 para una conversión mínima y segura
python3 - "$SLUG" "$TITLE" "$DESCRIPTION" "$KEYWORDS" "$CATEGORY" "$ARTICLE_NUMBER" << 'PYEOF'
import sys, re, html

slug, title, description, keywords, category, article_number = sys.argv[1:7]
body = sys.stdin.read() if not sys.stdin.isatty() else ""

# Leer el body desde el archivo temporal que pasaremos
PYEOF

# Mejor: escribir el body a un archivo temporal y llamar a python
BODY_FILE=$(mktemp)
echo "$BODY" > "$BODY_FILE"

python3 - "$SLUG" "$TITLE" "$DESCRIPTION" "$KEYWORDS" "$CATEGORY" "$ARTICLE_NUMBER" "$BODY_FILE" << 'PYEOF'
import sys, re, html, os

slug, title, description, keywords, category, article_number, body_file = sys.argv[1:8]

with open(body_file, 'r') as f:
    md = f.read()

def md_to_html(md):
    lines = md.split('\n')
    out = []
    in_ul = False
    in_table = False
    table_rows = []

    def flush_table():
        nonlocal in_table, table_rows
        if not in_table or not table_rows:
            return
        header = table_rows[0]
        body_rows = table_rows[1:] if len(table_rows) > 1 else []
        out.append('<table class="md-table">')
        out.append('  <thead>')
        out.append('    <tr>')
        for cell in header:
            out.append(f'      <th>{cell}</th>')
        out.append('    </tr>')
        out.append('  </thead>')
        out.append('  <tbody>')
        for row in body_rows:
            out.append('    <tr>')
            for cell in row:
                out.append(f'      <td>{cell}</td>')
            out.append('    </tr>')
        out.append('  </tbody>')
        out.append('</table>')
        in_table = False
        table_rows = []

    for line in lines:
        line = line.rstrip()

        if line.startswith('|') and line.endswith('|'):
            cells = [c.strip() for c in line.strip('|').split('|')]
            if all(re.match(r'^:?-+:?$', c) for c in cells):
                continue
            if not in_table:
                in_table = True
            table_rows.append(cells)
            continue
        else:
            if in_table:
                flush_table()

        if not line:
            if in_ul:
                out.append('</ul>')
                in_ul = False
            out.append('')
            continue

        m = re.match(r'^(#{1,6})\s+(.*)$', line)
        if m:
            if in_ul:
                out.append('</ul>')
                in_ul = False
            level = len(m.group(1))
            text = m.group(2)
            out.append(f'<h{level}>{inline_format(text)}</h{level}>')
            continue

        m = re.match(r'^[-*]\s+(.*)$', line)
        if m:
            if not in_ul:
                out.append('<ul>')
                in_ul = True
            out.append(f'  <li>{inline_format(m.group(1))}</li>')
            continue

        m = re.match(r'^\d+\.\s+(.*)$', line)
        if m:
            if in_ul:
                out.append('</ul>')
                in_ul = False
            out.append(f'<p>{inline_format(line)}</p>')
            continue

        if in_ul:
            out.append('</ul>')
            in_ul = False
        out.append(f'<p>{inline_format(line)}</p>')

    if in_ul:
        out.append('</ul>')
    if in_table:
        flush_table()

    return '\n'.join(out)


def inline_format(text):
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'(?<!\*)\*([^*]+?)\*(?!\*)', r'<em>\1</em>', text)
    return text

html_body = md_to_html(md)

# Quitar el H1 inicial del body si coincide con el title (para no duplicar)
h1_pattern = re.compile(r'^<h1>.*?</h1>\s*', re.DOTALL)
html_body = h1_pattern.sub('', html_body, count=1)

html_doc = f'''<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{html.escape(title)} — Dino Runner</title>
  <meta name="description" content="{html.escape(description)}">
  <meta name="keywords" content="{html.escape(keywords)}">
  <link rel="canonical" href="https://mydinorun.com/{slug}">
  <link rel="stylesheet" href="/style.css?v=8">
  <meta name="google-adsense-account" content="ca-pub-5551964617457049">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5551964617457049" crossorigin="anonymous"></script>
</head>
<body class="article-page">
  <header class="site-header">
    <nav class="site-nav">
      <a href="/" class="nav-brand">🦖 Dino Runner</a>
      <a href="/acerca-de">Acerca</a>
      <a href="/politica-de-privacidad">Privacidad</a>
      <a href="/contacto">Contacto</a>
    </nav>
  </header>

  <main class="article-content">
    <h1>{html.escape(title)}</h1>
    {html_body}
  </main>

  <footer class="site-footer">
    <p>© 2026 Dino Runner — <a href="/politica-de-privacidad">Privacidad</a> · <a href="/contacto">Contacto</a></p>
  </footer>
</body>
</html>
'''

out_path = os.path.join(slug, 'index.html')
with open(out_path, 'w') as f:
    f.write(html_doc)

print(f'✅ HTML generado: {out_path} ({len(html_doc)} bytes)')
PYEOF

rm -f "$BODY_FILE"

# --- 6. Actualizar sitemap.xml ---
SITEMAP="sitemap.xml"
TODAY=$(date +%Y-%m-%d)

if [ ! -f "$SITEMAP" ]; then
  echo "❌ No existe $SITEMAP. Creando uno mínimo..."
  cat > "$SITEMAP" << 'XML'
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>
XML
fi

# Comprobar si ya está
if grep -q "<loc>https://mydinorun.com/$SLUG</loc>" "$SITEMAP"; then
  echo "⚠️  $SLUG ya está en sitemap.xml"
else
  # Insertar antes de </urlset>
  python3 - "$SITEMAP" "$SLUG" "$TODAY" << 'PYEOF'
import sys
sitemap, slug, today = sys.argv[1:4]
with open(sitemap, 'r') as f:
    content = f.read()

entry = f'''  <url>
    <loc>https://mydinorun.com/{slug}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
'''
content = content.replace('</urlset>', entry + '</urlset>')
with open(sitemap, 'w') as f:
    f.write(content)
print(f'✅ Añadido a sitemap: {slug}')
PYEOF
fi

# --- 7. Commit + push ---
git add -A
git commit -m "feat(content): artículo '${TITLE}'

- slug: ${SLUG}
- categoría: ${CATEGORY:-Extras}
- número: ${ARTICLE_NUMBER:-?}
- sitemap actualizado"

git push

echo ""
echo "✅ Artículo publicado: https://mydinorun.com/$SLUG"
echo "⏳ Vercel despliega en ~30 segundos"
