#!/bin/bash
# audit_site.sh — Auditoría completa de mydinorun.com para AdSense

DOMAIN="https://mydinorun.com"
PASS=0; FAIL=0; WARN=0

green()  { echo -e "\033[0;32m✅ $1\033[0m"; PASS=$((PASS+1)); }
red()    { echo -e "\033[0;31m❌ $1\033[0m"; FAIL=$((FAIL+1)); }
yellow() { echo -e "\033[0;33m⚠️  $1\033[0m"; WARN=$((WARN+1)); }
section(){ echo ""; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; echo "  $1"; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }

echo ""
echo "🔍 AUDITORÍA DE SITIO — $(date '+%Y-%m-%d %H:%M')"
echo "🌐 Dominio: $DOMAIN"

# ==================== 1. ARCHIVOS ESENCIALES ====================
section "1. ARCHIVOS ESENCIALES"

# ads.txt
ADS=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/ads.txt")
[ "$ADS" = "200" ] && green "ads.txt (HTTP $ADS)" || red "ads.txt (HTTP $ADS)"

# robots.txt
ROBOTS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/robots.txt")
if [ "$ROBOTS_CODE" = "200" ]; then
  green "robots.txt (HTTP $ROBOTS_CODE)"
  ROBOTS_BODY=$(curl -s "$DOMAIN/robots.txt")
  echo "$ROBOTS_BODY" | grep -q "Sitemap:" && green "  └─ Sitemap declarado en robots.txt" || yellow "  └─ Sitemap NO declarado"
  echo "$ROBOTS_BODY" | grep -q "Mediapartners-Google" && green "  └─ Mediapartners-Google permitido" || yellow "  └─ Mediapartners-Google no mencionado (opcional)"
else
  red "robots.txt (HTTP $ROBOTS_CODE)"
fi

# sitemap.xml
SM_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/sitemap.xml")
if [ "$SM_CODE" = "200" ]; then
  SM_COUNT=$(curl -s "$DOMAIN/sitemap.xml" | grep -c '<loc>')
  green "sitemap.xml (HTTP $SM_CODE, $SM_COUNT URLs)"
else
  red "sitemap.xml (HTTP $SM_CODE)"
fi

# ==================== 2. PÁGINAS LEGALES ====================
section "2. PÁGINAS LEGALES (obligatorias AdSense)"

for PAGE in "acerca-de" "politica-de-privacidad" "contacto"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/$PAGE")
  [ "$CODE" = "200" ] && green "$PAGE (HTTP $CODE)" || red "$PAGE (HTTP $CODE)"
done

# También probar variantes comunes
for VARIANT in "about" "privacy" "contact" "terms" "terminos"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/$VARIANT")
  [ "$CODE" = "200" ] && green "$VARIANT (HTTP $CODE) — ¡alias encontrado!" || true
done

# ==================== 3. HOME + ADSENSE ====================
section "3. HOME + ADSENSE EN EL JUEGO"

HOME_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/")
[ "$HOME_CODE" = "200" ] && green "Home (HTTP $HOME_CODE)" || red "Home (HTTP $HOME_CODE)"

HOME_HTML=$(curl -s "$DOMAIN/")

echo "$HOME_HTML" | grep -q "google-adsense-account" && green "  └─ Meta tag AdSense presente" || red "  └─ Meta tag AdSense FALTA"
echo "$HOME_HTML" | grep -q "adsbygoogle.js" && green "  └─ Script AdSense cargado" || red "  └─ Script AdSense FALTA"
echo "$HOME_HTML" | grep -q "adBreak" && green "  └─ Función adBreak() presente" || red "  └─ Función adBreak() FALTA"

# ==================== 4. ARTÍCULOS ====================
section "4. ARTÍCULOS (detectados vía sitemap)"

SITEMAP_URLS=$(curl -s "$DOMAIN/sitemap.xml" | grep -oP '(?<=<loc>)[^<]+' | grep -v "^$DOMAIN/\$" | grep -v "sitemap")

TOTAL_ARTICLES=0
ARTICLES_OK=0
ARTICLES_FAIL=0

if [ -z "$SITEMAP_URLS" ]; then
  red "No hay URLs de artículos en sitemap.xml"
else
  for URL in $SITEMAP_URLS; do
    TOTAL_ARTICLES=$((TOTAL_ARTICLES+1))
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
    SLUG=$(echo "$URL" | sed "s|$DOMAIN/||")
    if [ "$CODE" = "200" ]; then
      # Verificar que tiene <h1> y contenido
      BODY=$(curl -s "$URL")
      H1=$(echo "$BODY" | grep -c "<h1>")
      WORDS=$(echo "$BODY" | sed 's/<[^>]*>//g' | wc -w)
      if [ "$H1" -ge 1 ] && [ "$WORDS" -ge 500 ]; then
        green "$SLUG (HTTP $CODE, ~$WORDS palabras)"
        ARTICLES_OK=$((ARTICLES_OK+1))
      else
        yellow "$SLUG (HTTP $CODE, ~$WORDS palabras, $H1 H1) — revisar"
        ARTICLES_FAIL=$((ARTICLES_FAIL+1))
      fi
    else
      red "$SLUG (HTTP $CODE)"
      ARTICLES_FAIL=$((ARTICLES_FAIL+1))
    fi
  done
fi

# ==================== 5. ENLACES INTERNOS ====================
section "5. ENLACES INTERNOS DESDE HOME"

if [ "$HOME_CODE" = "200" ]; then
  INTERNAL_LINKS=$(echo "$HOME_HTML" | grep -oP 'href="/[^"]+"' | sort -u | wc -l)
  if [ "$INTERNAL_LINKS" -ge 5 ]; then
    green "Home tiene $INTERNAL_LINKS enlaces internos (mín. 5 requerido)"
  else
    yellow "Home tiene $INTERNAL_LINKS enlaces internos (recomendado ≥5)"
  fi
  echo "$HOME_HTML" | grep -oP 'href="/[^"]+"' | sort -u | head -10 | sed 's/^/     /'
fi

# ==================== 6. SEGURIDAD Y DOMINIO ====================
section "6. SEGURIDAD Y DOMINIO"

# HTTPS
HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/")
[ "$HTTPS_CODE" = "200" ] && green "HTTPS activo (HTTP $HTTPS_CODE)" || red "HTTPS (HTTP $HTTPS_CODE)"

# Apex sirve directamente (no redirige)
REDIRECTS=$(curl -sI "$DOMAIN/" | grep -c "^location:")
if [ "$REDIRECTS" -eq 0 ]; then
  green "Apex sirve directamente (sin redirect)"
else
  yellow "Apex tiene $REDIRECTS redirecciones — puede afectar canonical"
fi

# www también sirve
WWW_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://www.mydinorun.com/")
[ "$WWW_CODE" = "200" ] && green "www.mydinorun.com también responde (HTTP $WWW_CODE)" || yellow "www (HTTP $WWW_CODE)"

# ==================== 7. ERRORES 404 EN ARTÍCULOS ====================
section "7. ENLACES ROTOS EN ARTÍCULOS"

BROKEN=0
for URL in $SITEMAP_URLS; do
  BODY=$(curl -s "$URL")
  INTERNAL=$(echo "$BODY" | grep -oP 'href="/[^"#]+"' | sed 's/href="//;s/"//' | sort -u)
  for LINK in $INTERNAL; do
    LINK_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN$LINK")
    if [ "$LINK_CODE" != "200" ]; then
      yellow "Enlace roto: $LINK (HTTP $LINK_CODE) en $(echo $URL | sed "s|$DOMAIN/||")"
      BROKEN=$((BROKEN+1))
    fi
  done
done
[ "$BROKEN" -eq 0 ] && green "Cero enlaces rotos detectados" || yellow "$BROKEN enlaces rotos (crear esos artículos o quitarlos)"

# ==================== RESUMEN ====================
section "📊 RESUMEN"

echo ""
echo "  ✅ PASS:    $PASS"
echo "  ⚠️  WARN:    $WARN"
echo "  ❌ FAIL:    $FAIL"
echo ""
echo "  📄 Artículos en sitemap: $TOTAL_ARTICLES"
echo "  ✅ Artículos OK:          $ARTICLES_OK"
echo "  ⚠️  Artículos a revisar:   $ARTICLES_FAIL"
echo ""

# Veredicto
section "🎯 VEREDICTO PARA ADSENSE"

if [ "$FAIL" -eq 0 ] && [ "$ARTICLES_OK" -ge 15 ]; then
  echo ""
  echo -e "\033[0;32m  🟢 LISTO PARA SOLICITAR REVISIÓN\033[0m"
  echo "  Todos los checks pasan y hay $ARTICLES_OK artículos sólidos."
  echo "  → Ve a AdSense → Sitios → Solicitar revisión"
elif [ "$FAIL" -eq 0 ] && [ "$ARTICLES_OK" -ge 8 ]; then
  echo ""
  echo -e "\033[0;33m  🟡 CASI LISTO\033[0m"
  echo "  Tienes $ARTICLES_OK artículos. AdSense recomienda 15-20 mínimo."
  echo "  → Añade $((15 - ARTICLES_OK)) más antes de solicitar para minimizar riesgo."
elif [ "$FAIL" -le 2 ] && [ "$ARTICLES_OK" -ge 5 ]; then
  echo ""
  echo -e "\033[0;33m  🟡 EN CAMINO\033[0m"
  echo "  Tienes $ARTICLES_OK artículos pero faltan $FAIL checks críticos."
  echo "  → Revisa los ❌ de arriba antes de solicitar."
else
  echo ""
  echo -e "\033[0;31m  🔴 NO SOLICITES TODAVÍA\033[0m"
  echo "  Faltan $FAIL checks críticos y solo tienes $ARTICLES_OK artículos."
  echo "  → Completa las páginas legales, ads.txt y al menos 15 artículos."
fi

echo ""
echo "🔗 Verificación manual rápida:"
echo "   $DOMAIN/"
echo "   $DOMAIN/robots.txt"
echo "   $DOMAIN/sitemap.xml"
echo "   $DOMAIN/ads.txt"
echo ""
