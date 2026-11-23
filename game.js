// game.js — Dino Runner v5 (dino pixel-art + enemigos móviles + parallax + vidas)
class DinoGame extends Phaser.Scene {
    constructor(alias) { super('DinoGame'); this.alias = alias || 'Jugador_0000'; }

    init() {
        // Leer el modo de la URL (ej: ?mode=supervivencia)
        const urlParams = new URLSearchParams(window.location.search);
        this.mode = urlParams.get('mode') || 'normal';
        console.log('[GAME] Modo:', this.mode);

        this.score = 0;
        this.speed = 4.5;
        if (this.mode === 'rapido') this.speed = 9.0;
        if (this.mode === 'leyenda') this.speed = 9.0;
        if (this.mode === 'lento') this.speed = 2.5;
        this.gameOver = false;
        this.isGhost = false;
        this.isMagnet = false;
        this.lives = 1;
        this.nextLifeScore = 10000;
        this.invulnerableUntil = 0;
        this.lastHudScore = -1;
        this.lastHudSpeed = null;
        this.ghostTimer = null;
        this.magnetTimer = null;
        this.ghostEndTime = 0;
        this.magnetEndTime = 0;
        this.spawnTimer = null;
        this.collectTimer = null;
    }

    preload() {
        // ================= DINO PIXEL-ART =================
        this.makeTexture('dino', (g) => {
            const C = 0x27ae60;

            // Cola
            g.fillStyle(C, 1);
            g.fillRect(0, 18, 8, 6);
            g.fillRect(2, 14, 6, 8);

            // Cuerpo
            g.fillRect(6, 14, 24, 14);

            // Cuello
            g.fillRect(16, 10, 8, 8);

            // Cabeza
            g.fillRect(20, 2, 18, 12);

            // Hocico
            g.fillRect(34, 8, 6, 5);

            // Pata trasera (toca el suelo)
            g.fillRect(10, 28, 5, 10);
            g.fillRect(8, 34, 8, 6);

            // Pata delantera (en el aire)
            g.fillRect(20, 28, 5, 8);
            g.fillRect(20, 34, 7, 4);

            // Brazo
            g.fillRect(24, 20, 8, 3);

            // Ojo
            g.fillStyle(0xffffff, 1);
            g.fillRect(26, 5, 5, 5);

            // Pupila
            g.fillStyle(0x000000, 1);
            g.fillRect(28, 7, 2, 2);

            // Boca
            g.fillStyle(C, 1);
            g.fillRect(36, 10, 3, 1);
        }, 40, 40);
        // ==================================================

        // Hongo caminante (rojo)
        this.makeTexture('mushroom', (g) => {
            g.fillStyle(0xe74c3c, 1);
            g.fillCircle(20, 18, 18);
            g.fillRect(2, 18, 36, 4);
            g.fillStyle(0xffffff, 1);
            g.fillCircle(12, 12, 4);
            g.fillCircle(28, 12, 4);
            g.fillCircle(20, 20, 3);
            g.fillStyle(0xfff0d5, 1);
            g.fillRect(12, 22, 16, 18);
            g.fillStyle(0x000000, 1);
            g.fillRect(15, 28, 3, 5);
            g.fillRect(22, 28, 3, 5);
        }, 40, 40);

        // Hongo volador (morado con alas)
        this.makeTexture('mushroom_fly', (g) => {
            g.fillStyle(0xffffff, 0.85);
            g.fillCircle(10, 22, 10);
            g.fillCircle(40, 22, 10);
            g.fillStyle(0x9b59b6, 1);
            g.fillCircle(25, 22, 18);
            g.fillRect(7, 22, 36, 4);
            g.fillStyle(0xffffff, 1);
            g.fillCircle(17, 16, 4);
            g.fillCircle(33, 16, 4);
            g.fillStyle(0xfff0d5, 1);
            g.fillRect(17, 26, 16, 18);
            g.fillStyle(0x000000, 1);
            g.fillRect(20, 32, 3, 5);
            g.fillRect(27, 32, 3, 5);
        }, 50, 50);

        // Carne (muslo de pollo) - 40x40 (escala 1.33x del diseño base 30)
        this.makeTexture('meat', (g) => {
            const k = 40 / 30;  // ajusta 40→36/44 para tamaño fino
            // 1) Hueso: bola blanca + shaft (sale por abajo-izq)
            g.fillStyle(0xf5f0e0, 1);
            g.fillCircle(9 * k, 24 * k, 5 * k);
            g.fillRect(9 * k, 18 * k, 4 * k, 8 * k);
            g.fillStyle(0xd8d2c0, 1);
            g.fillCircle(9 * k, 24 * k, 3 * k);
            // 2) Carne: centro ligeramente a la izq para no clipar el canvas
            g.fillStyle(0x8b2a20, 1);
            g.fillEllipse(17 * k, 13 * k, 26 * k, 22 * k);
            g.fillStyle(0xd94a3a, 1);
            g.fillEllipse(17 * k, 12 * k, 22 * k, 18 * k);
            // 3) Brillo
            g.fillStyle(0xf08070, 1);
            g.fillEllipse(14 * k, 8 * k, 10 * k, 5 * k);
            g.fillStyle(0xffb0a0, 1);
            g.fillEllipse(12 * k, 7 * k, 5 * k, 3 * k);
            // 4) Corte oscuro donde entra el hueso
            g.fillStyle(0x5a1a1a, 1);
            g.fillEllipse(13 * k, 18 * k, 8 * k, 4 * k);
        }, 40, 40);

        // Meteorito (fondo, crece con score)
        this.makeTexture('meteor', (g) => {
            // Halo de fuego (capas concéntricas)
            g.fillStyle(0x8b1a1a, 0.35); g.fillCircle(40, 40, 38);
            g.fillStyle(0xff6a00, 0.45); g.fillCircle(40, 40, 32);
            g.fillStyle(0xffaa00, 0.55); g.fillCircle(40, 40, 26);
            // Cuerpo rocoso
            g.fillStyle(0x3a2a2a, 1); g.fillCircle(40, 40, 22);
            g.fillStyle(0x4a3a3a, 1); g.fillCircle(40, 40, 20);
            g.fillStyle(0x5a4a4a, 1); g.fillCircle(38, 38, 16);
            // Cráteres
            g.fillStyle(0x2a1a1a, 1);
            g.fillCircle(32, 34, 4);
            g.fillCircle(46, 40, 3);
            g.fillCircle(40, 50, 2);
            g.fillCircle(50, 32, 2);
            // Highlight (iluminado arriba-izq)
            g.fillStyle(0x7a6a6a, 1); g.fillCircle(34, 34, 4);
            g.fillStyle(0x9a8a8a, 0.7); g.fillCircle(32, 32, 2);
        }, 80, 80);

        // Estrella
        this.makeTexture('star', (g) => {
            const pts = [];
            for (let i = 0; i < 10; i++) {
                const a = (i * Math.PI) / 5 - Math.PI / 2;
                const r = i % 2 === 0 ? 18 : 8;
                pts.push(new Phaser.Geom.Point(20 + Math.cos(a) * r, 20 + Math.sin(a) * r));
            }
            g.fillStyle(0xffdd00, 1); g.fillPoints(pts, true);
            g.fillStyle(0xffffff, 1); g.fillCircle(20, 20, 3);
        }, 40, 40);

        // Imán
        this.makeTexture('magnet', (g) => {
            g.fillStyle(0x2c3e50, 1);
            g.fillRect(8, 5, 6, 30); g.fillRect(26, 5, 6, 30); g.fillRect(8, 28, 24, 7);
            g.fillStyle(0xe74c3c, 1); g.fillRect(8, 5, 6, 10);
            g.fillStyle(0x3498db, 1); g.fillRect(26, 5, 6, 10);
        }, 40, 40);

        // Corazón
        this.makeTexture('heart', (g) => {
            g.fillStyle(0xe74c3c, 1);
            g.fillCircle(9, 10, 7);
            g.fillCircle(21, 10, 7);
            g.fillTriangle(2, 12, 28, 12, 15, 28);
            g.fillStyle(0xff8a8a, 1);
            g.fillCircle(8, 9, 3);
        }, 30, 30);

        // Nube
        this.makeTexture('cloud', (g) => {
            g.fillStyle(0xd8e0e8, 1);
            g.fillCircle(20, 25, 15);
            g.fillCircle(40, 20, 18);
            g.fillCircle(60, 25, 15);
            g.fillRect(15, 25, 50, 15);
            g.fillStyle(0xb8c4d0, 1);
            g.fillCircle(20, 25, 10);
            g.fillCircle(60, 25, 10);
        }, 80, 40);

        // Montaña
        this.makeTexture('mountain', (g) => {
            g.fillStyle(0x6b7c8f, 1);
            g.fillTriangle(0, 120, 100, 10, 200, 120);
            g.fillStyle(0xe8f0f8, 1);
            g.fillTriangle(85, 30, 100, 10, 115, 30);
        }, 200, 120);
        // Textura de roca para el piso
        this.makeTexture('rock', (g) => {
            g.fillStyle(0x1a1d22, 1);
            g.fillRect(0, 0, 200, 150);
            const shades = [0x2a2d35, 0x353840, 0x252830, 0x40434b, 0x1f2228, 0x30333b, 0x2e313a];
            for (let i = 0; i < 80; i++) {
                const x = Math.random() * 200;
                const y = 5 + Math.random() * 145;
                const r = 4 + Math.random() * 10;
                g.fillStyle(shades[Math.floor(Math.random() * shades.length)], 1);
                g.fillCircle(x, y, r);
            }
            g.fillStyle(0x4a4d55, 1);
            g.fillRect(0, 0, 200, 6);
            g.fillStyle(0x5a5d65, 1);
            g.fillRect(0, 0, 200, 3);
            g.fillStyle(0x0f1115, 1);
            for (let i = 0; i < 8; i++) {
                const x = Math.random() * 200;
                const y = 10 + Math.random() * 130;
                g.fillRect(x, y, 1, 5 + Math.random() * 15);
            }
        }, 200, 150);
    }

    makeTexture(key, drawFn, w, h) {
        const g = this.make.graphics({ key });
        drawFn(g);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    createPowerupBars() {
        const old = document.getElementById('powerup-bars');
        if (old) old.remove();
        const container = document.getElementById('game-container');
        if (!container) return;

        const bars = document.createElement('div');
        bars.id = 'powerup-bars';
        bars.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);display:flex;flex-direction:row;gap:6px;pointer-events:none;z-index:15;';

        const makeBar = (color) => {
            const bar = document.createElement('div');
            bar.style.cssText = 'position:relative;width:8px;height:120px;background:rgba(0,0,0,0.15);border-radius:4px;overflow:hidden;display:none;';
            const fill = document.createElement('div');
            fill.style.cssText = `position:absolute;bottom:0;left:0;width:100%;height:100%;background:${color};border-radius:4px;transition:height 0.05s linear;`;
            bar.appendChild(fill);
            return { bar, fill };
        };

        const ghost = makeBar('#ffdd00');
        const magnet = makeBar('#00aaff');
        bars.appendChild(ghost.bar);
        bars.appendChild(magnet.bar);
        container.appendChild(bars);

        this.ghostBarEl = ghost.bar; this.ghostFillEl = ghost.fill;
        this.magnetBarEl = magnet.bar; this.magnetFillEl = magnet.fill;
    }

    // ---- ARTE (solo aspecto): misma clave y mismo tamano que las texturas originales ----
    // Para comparar con el aspecto anterior abre la pagina con ?art=old
    paintRunnerArt() {
        this.artNew = new URLSearchParams(window.location.search).get('art') !== 'old';
        if (!this.artNew) return;
        const TAU = Math.PI * 2;
        const mk = (key, tw, th, fn) => {
            if (this.textures.exists(key)) this.textures.remove(key);
            const tex = this.textures.createCanvas(key, tw, th);
            if (!tex) return;
            fn(tex.getContext());
            tex.refresh();
        };
        const lin = (c, x0, y0, x1, y1, st) => {
            const g = c.createLinearGradient(x0, y0, x1, y1);
            st.forEach((q) => g.addColorStop(q[0], q[1]));
            return g;
        };
        const rad = (c, x0, y0, r0, x1, y1, r1, st) => {
            const g = c.createRadialGradient(x0, y0, r0, x1, y1, r1);
            st.forEach((q) => g.addColorStop(q[0], q[1]));
            return g;
        };
        const rr = (c, x, y, w, h, r) => {
            c.beginPath();
            c.moveTo(x + r, y);
            c.arcTo(x + w, y, x + w, y + h, r);
            c.arcTo(x + w, y + h, x, y + h, r);
            c.arcTo(x, y + h, x, y, r);
            c.arcTo(x, y, x + w, y, r);
            c.closePath();
        };
        const poly = (c, pts) => {
            c.beginPath();
            pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
            c.closePath();
        };
        const line = (c, x0, y0, x1, y1, col, lw) => {
            c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1);
            c.strokeStyle = col; c.lineWidth = lw; c.stroke();
        };
        const dot = (c, x, y, r, fill) => {
            c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = fill; c.fill();
        };

        // ---------- DINO 40x40: pose a / pose b (carrera) y pose j (salto) ----------
        const dinoFrame = (pose) => (c) => {
            const OUT = 'rgba(10,45,25,0.85)';
            c.lineJoin = 'round';
            c.lineCap = 'round';
            const P = {
                a: { near: [[14, 28], [18, 33], [21, 37.8], [24.5, 37.8]], far: [[22, 28], [21, 32], [17, 34.5], [19.5, 34.5]], tail: 16 },
                b: { near: [[14, 28], [12.5, 32], [9, 34.5], [11.5, 34.5]], far: [[22, 28], [25, 33], [27, 37.8], [30.5, 37.8]], tail: 21 },
                j: { near: [[14, 28], [18, 31], [20, 35], [23.5, 35.5]], far: [[22, 28], [24.5, 31], [25, 34.5], [28.5, 35]], tail: 14 }
            }[pose];
            const leg = (pts, col) => {
                c.beginPath();
                pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
                c.strokeStyle = OUT; c.lineWidth = 5.4; c.stroke();
                c.strokeStyle = col; c.lineWidth = 3.8; c.stroke();
            };
            // pata lejana (mas oscura)
            leg(P.far, '#1b7a45');
            // cola
            poly(c, [[9, 17], [0.8, P.tail], [9, 27]]);
            c.fillStyle = lin(c, 0, 14, 9, 27, [[0, '#4fe08a'], [1, '#17703f']]);
            c.fill();
            c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
            // placas dorsales
            [12, 17, 22].forEach((x) => {
                poly(c, [[x - 3, 16], [x, 10.5], [x + 3, 16]]);
                c.fillStyle = '#17703f'; c.fill();
                poly(c, [[x - 3, 16], [x, 10.5], [x, 16]]);
                c.fillStyle = '#2fae66'; c.fill();
            });
            // pata cercana
            leg(P.near, '#2fae66');
            // cuerpo con volumen
            rr(c, 7, 15, 22, 15, 6);
            c.fillStyle = lin(c, 0, 15, 0, 30, [[0, '#5fdc90'], [0.3, '#27ae60'], [1, '#176b3a']]);
            c.fill();
            rr(c, 7, 15, 22, 15, 6);
            c.fillStyle = rad(c, 14, 18, 1, 14, 18, 15, [[0, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
            c.fill();
            c.beginPath(); c.ellipse(18, 27, 6, 2.4, 0, 0, TAU);
            c.fillStyle = 'rgba(190,255,200,0.22)'; c.fill();
            rr(c, 7, 15, 22, 15, 6);
            c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
            line(c, 12, 15.7, 21, 15.7, 'rgba(255,255,255,0.45)', 1);
            // brazo
            line(c, 23, 21.5, 26.5, 24.5, '#1f8a4d', 2.4);
            // hocico y cabeza
            rr(c, 32.5, 9, 7.5, 7, 2.5);
            c.fillStyle = lin(c, 0, 9, 0, 16, [[0, '#3fd17c'], [1, '#1f8a4d']]);
            c.fill();
            c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
            c.beginPath(); c.arc(28, 12, 7.5, 0, TAU);
            c.fillStyle = rad(c, 25, 8.5, 1, 28, 12, 10, [[0, '#7bf0a6'], [0.45, '#2fbf6b'], [1, '#17703f']]);
            c.fill();
            c.beginPath(); c.arc(28, 12, 7.5, Math.PI * 0.62, Math.PI * 1.7);
            c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
            // ojo, ceja, nariz y boca
            dot(c, 31.2, 9.2, 3, '#ffffff');
            dot(c, 32.2, 9.6, 1.6, '#0b1a12');
            dot(c, 31.7, 8.9, 0.55, '#ffffff');
            line(c, 28.5, 6, 33.5, 7, 'rgba(10,60,30,0.7)', 1.1);
            dot(c, 38.3, 11, 0.7, 'rgba(0,40,20,0.7)');
            line(c, 34, 14.2, 39.2, 14.2, 'rgba(0,40,20,0.55)', 0.9);
        };
        mk('dino', 40, 40, dinoFrame('a'));
        mk('dino_run2', 40, 40, dinoFrame('b'));
        mk('dino_jump', 40, 40, dinoFrame('j'));

        // ---------- PIEDRA 40x40 (reemplaza al hongo que camina; se desliza por el camino) ----------
        mk('mushroom', 40, 40, (c) => {
            c.lineJoin = 'round';
            const body = [[2, 40], [1, 29], [5, 19], [12, 10], [22, 5], [31, 9], [37, 19], [39, 30], [38, 40]];
            poly(c, body);
            c.fillStyle = rad(c, 14, 14, 2, 20, 24, 28, [[0, '#c4c4cc'], [0.5, '#80808a'], [1, '#3a3a44']]);
            c.fill();
            c.save();
            poly(c, body);
            c.clip();
            // cara iluminada (arriba-izquierda) y cara en sombra (abajo-derecha)
            poly(c, [[5, 19], [12, 10], [22, 5], [20, 15], [10, 20]]);
            c.fillStyle = 'rgba(255,255,255,0.25)'; c.fill();
            poly(c, [[39, 30], [38, 40], [20, 40], [28, 25]]);
            c.fillStyle = 'rgba(0,0,0,0.30)'; c.fill();
            c.fillStyle = lin(c, 0, 32, 0, 40, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.35)']]);
            c.fillRect(0, 32, 40, 8);
            // grietas con borde de luz
            [[[17, 15], [20, 22], [16, 28], [19, 34]], [[30, 18], [28, 25], [31, 30]]].forEach((pts) => {
                [[1, 'rgba(255,255,255,0.18)'], [0, 'rgba(0,0,0,0.5)']].forEach((o) => {
                    c.beginPath();
                    pts.forEach((p, i) => (i ? c.lineTo(p[0] + o[0], p[1]) : c.moveTo(p[0] + o[0], p[1])));
                    c.strokeStyle = o[1]; c.lineWidth = 1; c.stroke();
                });
            });
            // motas (deterministas)
            for (let i = 0; i < 16; i++) {
                const x = 4 + (i * 13) % 32, y = 12 + (i * 7) % 26;
                c.fillStyle = i % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.16)';
                c.fillRect(x, y, 1.5, 1.5);
            }
            c.restore();
            poly(c, body);
            c.strokeStyle = 'rgba(25,25,32,0.85)'; c.lineWidth = 1.2; c.stroke();
            c.beginPath(); c.moveTo(5, 19); c.lineTo(12, 10); c.lineTo(22, 5);
            c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.2; c.stroke();
        });

        // ---------- PTEROSAURIO ENEMIGO 50x50 (reemplaza al hongo volador; mira a la izquierda y aletea) ----------
        const pteroEnemy = (up) => (c) => {
            c.save();
            c.translate(50, 0);
            c.scale(-1, 1);
            c.translate(-1, 2);
            c.lineJoin = 'round';
            c.lineCap = 'round';
            const OUT = 'rgba(40,10,55,0.85)';
            const farWing = up
                ? [[27, 13], [21, 6], [13, 3], [14, 8], [19, 11], [22, 15]]
                : [[27, 16], [24, 26], [17, 33], [19, 27], [23, 22], [25, 18]];
            const nearWing = up
                ? [[25, 14.5], [17, 4.5], [6, 0.8], [4, 5], [9, 8], [12, 13], [16, 17]]
                : [[25, 14.5], [18, 25], [7, 36.5], [4, 31.5], [9, 28.5], [12, 22], [16, 17.5]];
            const wr = up ? [17, 4.5] : [18, 25];
            // ala lejana, cola y patas
            poly(c, farWing);
            c.fillStyle = '#6c3483'; c.fill();
            poly(c, [[11, 16], [2, 19.5], [3.5, 20.8], [12, 18.8]]);
            c.fillStyle = '#7d3c98'; c.fill();
            line(c, 19, 21.5, 17, 25.5, '#5b2c6f', 1.5);
            line(c, 24, 21.5, 23, 26, '#5b2c6f', 1.5);
            // cuerpo
            c.beginPath(); c.ellipse(22, 17, 11.5, 5.5, 0, 0, TAU);
            c.fillStyle = lin(c, 0, 11.5, 0, 22.5, [[0, '#c39bd3'], [0.4, '#9b59b6'], [1, '#5b2c6f']]);
            c.fill();
            c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
            c.beginPath(); c.ellipse(22, 19.6, 7, 2.2, 0, 0, TAU);
            c.fillStyle = 'rgba(240,215,250,0.35)'; c.fill();
            // cuello, cresta larga hacia atras y cabeza
            poly(c, [[28, 13], [33, 8.5], [36.5, 10.8], [32, 17]]);
            c.fillStyle = lin(c, 28, 8, 34, 17, [[0, '#c39bd3'], [1, '#7d3c98']]);
            c.fill();
            poly(c, [[34.5, 7.4], [23.5, 2.6], [26, 4.8], [33.5, 10.4]]);
            c.fillStyle = '#6c3483'; c.fill();
            c.strokeStyle = OUT; c.lineWidth = 0.8; c.stroke();
            c.beginPath(); c.ellipse(37, 10, 5, 3.6, -0.15, 0, TAU);
            c.fillStyle = lin(c, 33, 6, 40, 14, [[0, '#c39bd3'], [1, '#7d3c98']]);
            c.fill();
            c.strokeStyle = OUT; c.lineWidth = 0.9; c.stroke();
            // pico largo y fino
            poly(c, [[40.5, 11], [49.5, 12], [40.5, 13]]);
            c.fillStyle = '#5b2c6f'; c.fill();
            poly(c, [[40, 8.4], [51.6, 11.2], [40, 11.4]]);
            c.fillStyle = lin(c, 0, 8, 0, 12, [[0, '#b07cc6'], [1, '#7d3c98']]);
            c.fill();
            c.strokeStyle = OUT; c.lineWidth = 0.8; c.stroke();
            // ojo con ceja de enfado
            dot(c, 38.3, 9, 2, '#ffffff');
            dot(c, 39, 9.2, 1.1, '#2a0a1a');
            dot(c, 38.6, 8.5, 0.45, '#ffffff');
            line(c, 35.8, 6.6, 40.6, 8.4, 'rgba(30,5,45,0.9)', 1.3);
            // ala cercana: membrana, hueso del brazo y dedos
            poly(c, nearWing);
            c.fillStyle = lin(c, 0, 0, 0, 38, [[0, '#d7bde2'], [1, '#8e44ad']]);
            c.fill();
            c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
            [nearWing[3], nearWing[4], nearWing[5]].forEach((p) => line(c, wr[0], wr[1], p[0], p[1], 'rgba(60,20,80,0.55)', 0.7));
            line(c, nearWing[0][0], nearWing[0][1], wr[0], wr[1], '#4a235a', 1.6);
            line(c, wr[0], wr[1], nearWing[2][0], nearWing[2][1], '#4a235a', 1.3);
            c.restore();
        };
        mk('mushroom_fly', 50, 50, pteroEnemy(false));
        mk('mushroom_fly2', 50, 50, pteroEnemy(true));

        // ---------- CARNE 40x40 (muslo asado con hueso) ----------
        mk('meat', 40, 40, (c) => {
            c.lineJoin = 'round';
            c.lineCap = 'round';
            const OUT = 'rgba(60,15,10,0.9)';
            // hueso
            line(c, 12, 28, 6.5, 33.5, OUT, 7);
            line(c, 12, 28, 6.5, 33.5, '#f3ecd6', 5);
            dot(c, 3.6, 32.8, 3.8, OUT); dot(c, 6.6, 36.2, 3.8, OUT);
            dot(c, 3.6, 32.8, 3.1, '#f3ecd6'); dot(c, 6.6, 36.2, 3.1, '#e6dcc0');
            line(c, 10.6, 27.2, 7, 31, 'rgba(255,255,255,0.7)', 1.2);
            // carne
            const meat = () => {
                c.beginPath();
                c.moveTo(13, 27);
                c.bezierCurveTo(5, 20, 8, 6, 22, 4);
                c.bezierCurveTo(34, 3, 38, 14, 33, 22);
                c.bezierCurveTo(29, 29, 20, 31, 13, 27);
                c.closePath();
            };
            meat();
            c.fillStyle = rad(c, 17, 11, 2, 24, 18, 22, [[0, '#f0a070'], [0.35, '#c8553a'], [0.75, '#8b2a20'], [1, '#5a1a1a']]);
            c.fill();
            c.save();
            meat(); c.clip();
            c.fillStyle = rad(c, 36, 30, 2, 36, 30, 20, [[0, 'rgba(30,5,5,0.55)'], [1, 'rgba(30,5,5,0)']]);
            c.fillRect(0, 0, 40, 40);
            [[[14, 12], [19, 10], [25, 12]], [[12, 18], [19, 16], [27, 19]], [[18, 24], [24, 22], [30, 23]]].forEach((pts) => {
                c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
                c.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
                c.strokeStyle = 'rgba(255,205,175,0.28)'; c.lineWidth = 1.2; c.stroke();
            });
            c.restore();
            // brillo
            c.beginPath(); c.ellipse(16.5, 10.5, 6, 2.8, -0.5, 0, TAU);
            c.fillStyle = 'rgba(255,225,195,0.55)'; c.fill();
            dot(c, 14, 8.5, 1.2, 'rgba(255,255,255,0.85)');
            meat();
            c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke();
            // corte donde entra el hueso
            c.beginPath(); c.ellipse(12.6, 27.4, 3.6, 2.2, 0.8, 0, TAU);
            c.fillStyle = '#e9a79a'; c.fill();
            c.strokeStyle = OUT; c.lineWidth = 0.9; c.stroke();
        });

        // ---------- AMBAR 40x40 (reemplaza a la estrella: gota dorada con un insecto fosil) ----------
        mk('star', 40, 40, (c) => {
            c.lineJoin = 'round';
            c.lineCap = 'round';
            c.fillStyle = rad(c, 20, 22, 6, 20, 22, 21, [[0, 'rgba(255,220,90,0.55)'], [1, 'rgba(255,200,60,0)']]);
            c.fillRect(0, 0, 40, 40);
            const drop = () => {
                c.beginPath();
                c.moveTo(20, 3);
                c.bezierCurveTo(26, 12, 34, 18, 34, 26);
                c.bezierCurveTo(34, 34, 27, 38, 20, 38);
                c.bezierCurveTo(13, 38, 6, 34, 6, 26);
                c.bezierCurveTo(6, 18, 14, 12, 20, 3);
                c.closePath();
            };
            drop();
            c.fillStyle = rad(c, 15, 15, 2, 20, 24, 20, [[0, '#fff3b0'], [0.35, '#ffc61a'], [0.75, '#d9820f'], [1, '#8a4a06']]);
            c.fill();
            c.save();
            drop(); c.clip();
            // insecto fosil
            c.fillStyle = 'rgba(70,35,5,0.8)';
            c.beginPath(); c.ellipse(20, 28, 2.6, 5, 0, 0, TAU); c.fill();
            c.beginPath(); c.ellipse(20, 21.5, 2, 2, 0, 0, TAU); c.fill();
            c.beginPath(); c.ellipse(15.2, 26, 4.6, 2, -0.6, 0, TAU); c.fill();
            c.beginPath(); c.ellipse(24.8, 26, 4.6, 2, 0.6, 0, TAU); c.fill();
            line(c, 18, 29, 13, 32.5, 'rgba(70,35,5,0.7)', 0.9);
            line(c, 22, 29, 27, 32.5, 'rgba(70,35,5,0.7)', 0.9);
            line(c, 19.3, 20, 17, 17.5, 'rgba(70,35,5,0.7)', 0.8);
            line(c, 20.7, 20, 23, 17.5, 'rgba(70,35,5,0.7)', 0.8);
            dot(c, 24, 12, 1, 'rgba(255,255,255,0.5)');
            dot(c, 27, 31, 0.8, 'rgba(255,255,255,0.45)');
            c.restore();
            // brillos y borde
            c.beginPath(); c.ellipse(13.5, 17, 2.6, 6.5, 0.45, 0, TAU);
            c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill();
            dot(c, 12, 12.5, 1.4, 'rgba(255,255,255,0.85)');
            drop();
            c.strokeStyle = 'rgba(110,60,5,0.9)'; c.lineWidth = 1.2; c.stroke();
        });

        // ---------- CRISTAL DEL METEORITO 40x40 (reemplaza al iman: fragmento azul que atrae) ----------
        mk('magnet', 40, 40, (c) => {
            c.lineJoin = 'round';
            c.lineCap = 'round';
            const OUT = 'rgba(8,25,70,0.9)';
            // resplandor
            c.fillStyle = rad(c, 20, 19, 4, 20, 19, 20, [[0, 'rgba(110,200,255,0.55)'], [1, 'rgba(60,150,255,0)']]);
            c.fillRect(0, 0, 40, 40);
            // roca del meteorito con brasas
            poly(c, [[3, 37], [7, 30], [15, 32], [24, 29], [32, 31], [37, 37], [31, 39.5], [9, 39.5]]);
            c.fillStyle = lin(c, 0, 29, 0, 40, [[0, '#5a4a55'], [1, '#231a22']]);
            c.fill();
            c.strokeStyle = 'rgba(15,8,15,0.9)'; c.lineWidth = 1; c.stroke();
            line(c, 8, 31.2, 14, 33, 'rgba(255,255,255,0.18)', 1);
            dot(c, 12, 36, 1, '#ff9a40'); dot(c, 29, 35.5, 0.9, '#ff9a40');
            // cristales pequenos
            const small = (pts, a, b) => {
                poly(c, pts);
                c.fillStyle = lin(c, 0, 14, 0, 32, [[0, a], [1, b]]);
                c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.9; c.stroke();
            };
            small([[6, 23], [9.5, 15], [13, 23], [12, 32], [5.5, 32]], '#8fd4ff', '#2468b8');
            small([[28, 25], [32, 18], [36, 25], [35, 32], [28, 32]], '#7cc4f5', '#1d5aa8');
            // cristal principal con dos caras
            poly(c, [[20, 2], [13, 9], [14, 31], [20, 31]]);
            c.fillStyle = lin(c, 13, 2, 20, 31, [[0, '#c4ecff'], [0.5, '#5dade2'], [1, '#2368c0']]);
            c.fill();
            poly(c, [[20, 2], [27, 9], [26, 31], [20, 31]]);
            c.fillStyle = lin(c, 20, 2, 27, 31, [[0, '#4a9be0'], [1, '#12388a']]);
            c.fill();
            poly(c, [[20, 2], [27, 9], [26, 31], [14, 31], [13, 9]]);
            c.strokeStyle = OUT; c.lineWidth = 1.1; c.stroke();
            line(c, 20, 2.5, 20, 30.5, 'rgba(255,255,255,0.45)', 0.9);
            line(c, 15.5, 11, 15.8, 26, 'rgba(255,255,255,0.55)', 1.2);
            // destellos (la atraccion)
            [[7, 8], [33, 11]].forEach((p) => {
                line(c, p[0] - 3, p[1], p[0] + 3, p[1], 'rgba(255,255,255,0.9)', 1);
                line(c, p[0], p[1] - 3, p[0], p[1] + 3, 'rgba(255,255,255,0.9)', 1);
            });
        });

        // ---- FONDO: meteorito con cola (80x80) y pterosaurios lejanos (siluetas) ----
        mk('meteor', 80, 80, (c) => {
            const cx = 52, cy = 52;
            const circ = (x, y, r, fill) => {
                c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = fill; c.fill();
            };
            const wedge = (hw, tx, ty, c0, c1) => {
                const k = hw / Math.SQRT2;
                const g = c.createLinearGradient(cx, cy, tx, ty);
                g.addColorStop(0, c0);
                g.addColorStop(1, c1);
                c.beginPath();
                c.moveTo(cx + k, cy - k);
                c.lineTo(tx, ty);
                c.lineTo(cx - k, cy + k);
                c.closePath();
                c.fillStyle = g;
                c.fill();
            };
            // cola de fuego hacia arriba-izquierda (3 capas)
            wedge(18, 1, 1, 'rgba(255,106,0,0.55)', 'rgba(139,26,26,0)');
            wedge(12, 8, 8, 'rgba(255,170,0,0.70)', 'rgba(255,106,0,0)');
            wedge(6, 18, 18, 'rgba(255,235,130,0.85)', 'rgba(255,200,60,0)');
            // halo
            circ(cx, cy, 28, 'rgba(139,26,26,0.35)');
            circ(cx, cy, 25, 'rgba(255,106,0,0.45)');
            // cuerpo rocoso con luz arriba-izquierda
            circ(cx, cy, 22, '#3a2a2a');
            circ(cx, cy, 20, '#4a3a3a');
            circ(cx - 2, cy - 2, 16, '#5a4a4a');
            circ(cx - 6, cy - 7, 6, 'rgba(255,255,255,0.12)');
            // crateres
            circ(cx - 8, cy - 4, 4, '#2a1a1a');
            circ(cx + 6, cy + 2, 3, '#2a1a1a');
            circ(cx + 1, cy + 10, 2.5, '#2a1a1a');
            // brasas
            circ(cx + 12, cy - 10, 1.6, 'rgba(255,200,60,0.9)');
            circ(cx - 14, cy + 6, 1.3, 'rgba(255,160,40,0.9)');
        });

        {
            // siluetas de pterosaurio lejano, miran a la DERECHA (color plano; la transparencia se pone en el sprite)
            const sil = (c, pts) => {
                c.beginPath();
                c.moveTo(pts[0][0], pts[0][1]);
                for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
                c.closePath();
                c.fill();
            };
            const body = (c) => {
                c.fillStyle = '#2c3e50';
                c.beginPath(); c.ellipse(30, 22, 10, 4, 0, 0, TAU); c.fill();
                sil(c, [[20, 22], [8, 26], [20, 25]]);                 // cola
                sil(c, [[38, 20], [58, 23], [38, 25]]);                // cabeza y pico
                sil(c, [[39, 19], [33, 13], [43, 19]]);                // cresta
            };
            mk('ptero_far', 60, 40, (c) => {   // alas arriba
                c.fillStyle = '#2c3e50';
                sil(c, [[24, 21], [6, 5], [13, 12], [18, 8], [28, 19]]);
                sil(c, [[32, 20], [46, 4], [42, 13], [38, 9], [30, 19]]);
                body(c);
            });
            mk('ptero_far2', 60, 40, (c) => {  // alas abajo
                c.fillStyle = '#2c3e50';
                sil(c, [[24, 22], [6, 37], [13, 30], [18, 34], [28, 25]]);
                sil(c, [[32, 23], [46, 37], [42, 30], [38, 34], [30, 25]]);
                body(c);
            });
        }

        // ---- PARCHE 5: valle de volcanes (cielo, meteorito, volcanes y nubes densas) ----
        {
            // Cielo: mismo degradado que Flap (2x256, se estira a la pantalla)
            mk('runner-sky', 2, 256, (c) => {
                const g = c.createLinearGradient(0, 0, 0, 256);
                g.addColorStop(0, '#0e0a1f');
                g.addColorStop(0.5, '#2a1636');
                g.addColorStop(0.8, '#6b2432');
                g.addColorStop(1, '#b04a2a');
                c.fillStyle = g;
                c.fillRect(0, 0, 2, 256);
            });

            // Meteorito 256x256: receta de Flap/Mountain en espejo (la cola va arriba-izquierda)
            mk('meteor', 256, 256, (c) => {
                const dot2 = (x, y, r, f) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = f; c.fill(); };
                c.save();
                c.translate(256, 0);
                c.scale(-0.5, 0.5);   // a partir de aqui se dibuja en coordenadas de 512
                const tail = c.createLinearGradient(256, 256, 512, 0);
                tail.addColorStop(0, 'rgba(255,170,70,0.65)');
                tail.addColorStop(0.5, 'rgba(255,90,20,0.25)');
                tail.addColorStop(1, 'rgba(255,60,10,0)');
                c.fillStyle = tail;
                c.beginPath(); c.moveTo(320, 320); c.lineTo(192, 192); c.lineTo(512, 0); c.closePath(); c.fill();
                const halo = c.createRadialGradient(256, 256, 40, 256, 256, 250);
                halo.addColorStop(0, 'rgba(255,160,60,0.5)');
                halo.addColorStop(1, 'rgba(255,80,20,0)');
                c.fillStyle = halo;
                c.fillRect(0, 0, 512, 512);
                [[330, 190, 3], [360, 160, 2.5], [400, 120, 2], [300, 230, 3.5], [440, 80, 2], [345, 215, 2]]
                    .forEach((k) => dot2(k[0], k[1], k[2], 'rgba(255,220,140,0.85)'));
                const body = c.createRadialGradient(226, 226, 8, 256, 256, 104);
                body.addColorStop(0, '#e0a070');
                body.addColorStop(0.4, '#9a4a2a');
                body.addColorStop(1, '#2e0e08');
                c.beginPath(); c.arc(256, 256, 96, 0, TAU);
                c.fillStyle = body; c.fill();
                [[232, 238, 18], [284, 226, 13], [268, 296, 16], [220, 292, 10], [300, 270, 8], [250, 200, 7]]
                    .forEach((k) => dot2(k[0], k[1], k[2], 'rgba(40,10,6,0.5)'));
                c.beginPath(); c.arc(256, 256, 96, Math.PI * 0.35, Math.PI * 1.15);
                c.strokeStyle = 'rgba(255,225,150,0.8)'; c.lineWidth = 5; c.stroke();
                c.restore();
            });

            // Pterosaurios lejanos: se recolorean en ambar tenue (iluminados por el meteorito)
            ['ptero_far', 'ptero_far2'].forEach((k) => {
                const t = this.textures.get(k);
                if (!t || !t.getContext) return;
                const cx = t.getContext();
                cx.globalCompositeOperation = 'source-in';
                cx.fillStyle = '#e0905a';
                cx.fillRect(0, 0, 60, 40);
                cx.globalCompositeOperation = 'source-over';
                t.refresh();
            });

            // Volcanes 520x340 (px = x de la cumbre, top = y de la cumbre, glow = cráter encendido y humo)
            const volc = (px, top, glow) => (c) => {
                const bodyPath = () => {
                    c.beginPath();
                    c.moveTo(0, 340);
                    c.bezierCurveTo(px - 150, 325, px - 70, 230, px - 44, top + 8);
                    c.lineTo(px - 24, top);
                    c.lineTo(px, top + 9);
                    c.lineTo(px + 26, top - 2);
                    c.lineTo(px + 46, top + 8);
                    c.bezierCurveTo(px + 72, 230, px + 150, 325, 520, 340);
                    c.closePath();
                };
                bodyPath();
                const g = c.createLinearGradient(0, top, 0, 340);
                g.addColorStop(0, '#1a0f24');
                g.addColorStop(0.5, '#2c1a34');
                g.addColorStop(1, '#5b2a3a');
                c.fillStyle = g;
                c.fill();
                // luz calida del meteorito (flanco izquierdo) y neblina del horizonte (abajo)
                c.save();
                bodyPath();
                c.clip();
                const lit = c.createLinearGradient(px - 160, 0, px + 40, 0);
                lit.addColorStop(0, 'rgba(255,150,80,0.20)');
                lit.addColorStop(1, 'rgba(255,150,80,0)');
                c.fillStyle = lit;
                c.fillRect(0, 0, 520, 340);
                const haze = c.createLinearGradient(0, 240, 0, 340);
                haze.addColorStop(0, 'rgba(176,74,42,0)');
                haze.addColorStop(1, 'rgba(176,74,42,0.40)');
                c.fillStyle = haze;
                c.fillRect(0, 0, 520, 340);
                c.restore();
                // filo de luz en el flanco izquierdo
                c.beginPath();
                c.moveTo(0, 340);
                c.bezierCurveTo(px - 150, 325, px - 70, 230, px - 44, top + 8);
                c.lineTo(px - 24, top);
                c.strokeStyle = 'rgba(255,170,90,0.35)';
                c.lineWidth = 2.5;
                c.lineJoin = 'round';
                c.stroke();
                if (glow) {
                    // humo que sube y se inclina a la derecha
                    for (let k = 0; k < 5; k++) {
                        const a = 0.6 - k * 0.08;
                        c.beginPath();
                        c.arc(px + 6 + k * 14, top - 6 - k * 22, 12 + k * 6, 0, TAU);
                        c.fillStyle = k < 2 ? 'rgba(120,60,50,' + a + ')' : 'rgba(70,48,66,' + a + ')';
                        c.fill();
                    }
                    // crater encendido
                    const cg = c.createRadialGradient(px, top + 4, 4, px, top + 4, 74);
                    cg.addColorStop(0, 'rgba(255,190,80,0.9)');
                    cg.addColorStop(0.4, 'rgba(255,110,30,0.45)');
                    cg.addColorStop(1, 'rgba(255,80,20,0)');
                    c.fillStyle = cg;
                    c.fillRect(0, 0, 520, 340);
                    // rios de lava
                    c.strokeStyle = 'rgba(255,120,40,0.6)';
                    c.lineWidth = 2.5;
                    c.lineCap = 'round';
                    [[-8, 6, -30, 70, -58, 150], [10, 6, 26, 80, 50, 170]].forEach((s) => {
                        c.beginPath();
                        c.moveTo(px + s[0], top + s[1]);
                        c.quadraticCurveTo(px + s[2], top + s[3], px + s[4], top + s[5]);
                        c.stroke();
                    });
                }
            };
            mk('volcano_a', 520, 340, volc(260, 130, true));
            mk('volcano_b', 520, 340, volc(300, 150, false));

            // Nube densa de ceniza 320x140 (panza iluminada por el horizonte)
            // PARCHE 6: nube de ceniza al estilo de Flap (cuerpo plano, borde suave, jirones y huecos)
            mk('ash_cloud', 320, 140, (c) => {
                const blob = (x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); };
                const hole = (x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); };
                const shapes = [[80, 92, 62, 24], [160, 84, 84, 34], [240, 92, 62, 24],
                                [120, 66, 52, 22], [200, 64, 58, 24], [160, 100, 100, 18]];
                // halo suave (como la niebla de Mountain): evita el borde duro de burbuja
                c.fillStyle = 'rgba(110,64,76,0.22)';
                shapes.forEach((s) => blob(s[0], s[1], s[2] + 10, s[3] + 8));
                // cuerpo plano con degradado vertical (como Flap)
                const g = c.createLinearGradient(0, 40, 0, 125);
                g.addColorStop(0, '#6a5470');
                g.addColorStop(1, '#2c1e36');
                c.fillStyle = g;
                shapes.forEach((s) => blob(s[0], s[1], s[2], s[3]));
                // jirones sueltos a la derecha (la nube se deshace al derivar a la izquierda)
                blob(296, 78, 12, 6); blob(312, 92, 7, 4); blob(284, 99, 9, 5);
                // huecos
                c.globalCompositeOperation = 'destination-out';
                c.fillStyle = '#000';
                hole(60, 108, 16, 2.5); hole(172, 112, 20, 3); hole(236, 82, 13, 2.5); hole(126, 52, 11, 2); hole(270, 104, 12, 2.5);
                // luz del meteorito (arriba-izquierda) y del horizonte (abajo)
                c.globalCompositeOperation = 'source-atop';
                const gl = c.createRadialGradient(30, 20, 4, 30, 20, 210);
                gl.addColorStop(0, 'rgba(255,150,70,0.55)');
                gl.addColorStop(1, 'rgba(255,90,30,0)');
                c.fillStyle = gl;
                c.fillRect(0, 0, 320, 140);
                const hz = c.createLinearGradient(0, 80, 0, 125);
                hz.addColorStop(0, 'rgba(220,100,50,0)');
                hz.addColorStop(1, 'rgba(220,100,50,0.40)');
                c.fillStyle = hz;
                c.fillRect(0, 0, 320, 140);
                c.globalCompositeOperation = 'source-over';
            });
        }

        // [ARTE-FIN] (los siguientes parches anaden aqui las demas texturas)
    }

    // Volcanes estilo Mountain (cono con lava, resplandor y humo) para el fondo; solo aspecto
    paintMountainVolcanoes() {
        if (!this.artNew) return;
        const TAU = Math.PI * 2;
        const make = (key, W, H, hw, tw, cone) => {
            if (this.textures.exists(key)) this.textures.remove(key);
            const tex = this.textures.createCanvas(key, W, H);
            if (!tex) return;
            const c = tex.getContext();
            c.lineJoin = 'round'; c.lineCap = 'round';
            const cx = W / 2, yb = H, top = H - cone;
            const left = [], right = [];
            for (let k = 0; k <= 10; k++) {
                const u = k / 10, y = top + 4 + u * (yb - top - 4);
                const x = tw + (hw - tw) * Math.pow(u, 0.75);
                left.push([cx - x, y]); right.push([cx + x, y]);
            }
            // silueta con cresta de crater
            c.beginPath();
            c.moveTo(cx - tw, top); c.lineTo(cx - tw * 0.45, top + 5);
            c.lineTo(cx + tw * 0.45, top + 5); c.lineTo(cx + tw, top);
            right.forEach((p) => c.lineTo(p[0], p[1]));
            for (let k = left.length - 1; k >= 0; k--) c.lineTo(left[k][0], left[k][1]);
            c.closePath();
            const g = c.createLinearGradient(0, top, 0, yb);
            g.addColorStop(0, '#4a2848'); g.addColorStop(1, '#8a3a30');
            c.fillStyle = g; c.fill();
            // luz desde arriba a la izquierda: flanco izquierdo claro, derecho oscuro
            c.save(); c.clip();
            c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(cx - hw - 6, top - 10, hw + 6, cone + 20);
            c.fillStyle = 'rgba(0,0,0,0.20)'; c.fillRect(cx, top - 10, hw + 6, cone + 20);
            c.restore();
            c.beginPath();
            left.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
            c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 1.5; c.stroke();
            // coladas de lava
            [[-1, 0.8], [1, 0.55]].forEach((sd) => {
                const pts = [];
                for (let k = 0; k <= 10; k++) {
                    const u = k / 10;
                    pts.push([cx + sd[0] * (tw * 0.5 + u * hw * 0.5) + Math.sin(u * 7 + sd[0]) * 4, top + 4 + u * sd[1] * (yb - top)]);
                }
                [['rgba(255,90,20,0.30)', 5], ['rgba(255,200,90,0.80)', 2]].forEach((st) => {
                    c.beginPath();
                    pts.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
                    c.strokeStyle = st[0]; c.lineWidth = st[1]; c.stroke();
                });
            });
            // resplandor del crater
            const gx = cx, gy = top + 3, gr = 100;
            const rg = c.createRadialGradient(gx, gy, 2, gx, gy, gr);
            rg.addColorStop(0, 'rgba(255,205,100,0.80)');
            rg.addColorStop(0.35, 'rgba(255,110,30,0.40)');
            rg.addColorStop(1, 'rgba(255,60,20,0)');
            c.fillStyle = rg; c.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
            // columna de humo
            for (let j = 0; j < 9; j++) {
                const f = j / 9;
                const px = gx + Math.pow(j, 1.6) * 2.2 + Math.sin(j * 1.7 + cx) * 4;
                const py = gy - 6 - j * 10.7;
                const r = 7 + j * 4.3;
                if (py - r < 2) break;
                c.beginPath(); c.arc(px, py, r, 0, TAU);
                c.fillStyle = 'rgba(42,28,38,' + ((0.55 - 0.45 * f) * 0.9) + ')';
                c.fill();
            }
            tex.refresh();
        };
        make('mvol_a', 320, 420, 105, 13, 250);
        make('mvol_b', 260, 360, 85, 11, 200);
    }

    create() {
        this.paintRunnerArt();
        this.paintMountainVolcanoes();

        // Textura procedural del piso (rocas repetibles)
        if (!this.textures.exists('groundTile')) {
            const g = this.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0x3a2a1a, 1); g.fillRect(0, 0, 64, 50);
            g.fillStyle(0x5a4030, 1);
            g.fillRect(6, 8, 6, 4); g.fillRect(28, 18, 8, 5);
            g.fillRect(48, 6, 5, 3); g.fillRect(18, 32, 7, 4);
            g.fillRect(42, 36, 6, 3); g.fillRect(10, 22, 4, 3);
            g.fillStyle(0x2a1a0a, 1);
            g.fillRect(20, 14, 3, 3); g.fillRect(38, 28, 4, 3);
            g.generateTexture('groundTile', 64, 50);

            // Textura de polvo
            if (!this.textures.exists('dust')) {
                const d = this.make.graphics({ x: 0, y: 0, add: false });
                d.fillStyle(0xcccccc, 1);
                d.fillCircle(4, 4, 4);
                d.generateTexture('dust', 8, 8);
                d.destroy();
            }
            g.destroy();
        }

        const w = this.scale.width;
        const h = this.scale.height;
        SoundFX.init();

        this.hudScoreEl = document.getElementById('hud-score');
        this.hudSpeedEl = document.getElementById('hud-speed');
        this.lastHudScore = -1;
        this.lastHudSpeed = null;

        this.createPowerupBars();

        this.boundVisibilityHandler = () => {
            if (document.hidden) { if (!this.gameOver) this.scene.pause(); }
            else { if (this.scene.isPaused()) this.scene.resume(); }
        };
        document.addEventListener('visibilitychange', this.boundVisibilityHandler);
        this.events.once('shutdown', () => document.removeEventListener('visibilitychange', this.boundVisibilityHandler));

        // groundTop se define mas abajo (suelo), pero las montanas lo necesitan antes: sin esto su y era NaN y no se dibujaban
        this.groundOffset = this.isMobile ? 180 : 80;
        this.groundTop = h - this.groundOffset;
        // Fondo: montañas (con arte nuevo: cielo de Flap y volcanes del valle)
        this.mountains = [];
        if (this.artNew) {
            this.skyImg = this.add.image(0, 0, 'runner-sky').setOrigin(0, 0).setDisplaySize(w, h).setDepth(-20);
            this.scale.on('resize', (size) => {
                if (this.skyImg && this.skyImg.active) this.skyImg.setDisplaySize(size.width, size.height);
            }, this);
            const vk = Phaser.Math.Clamp(h / 700, 0.7, 1.4);
            // [textura, x relativa, escala, alpha, velocidad px/s]
            [['volcano_b', 0.12, 0.50, 0.55, 3], ['volcano_a', 0.55, 0.85, 0.90, 6], ['volcano_b', 0.93, 0.62, 0.70, 4]].forEach((v) => {
                const m = this.add.image(w * v[1], this.groundTop + 5, v[0]);
                m.setOrigin(0.5, 1).setScale(v[2] * vk).setAlpha(v[3]).setDepth(-8);
                m.setData('sp', v[4]);
                this.mountains.push(m);
            });
            // Volcanes de Mountain, detras de los anteriores (?mv=1.4 los agranda, ?mv=0 los quita)
            const _mv = parseFloat(new URLSearchParams(window.location.search).get('mv'));
            const mvk = _mv >= 0 ? _mv : 1;
            if (mvk > 0 && this.textures.exists('mvol_a')) {
                [['mvol_b', 0.33, 0.70, 0.85, 4], ['mvol_a', 0.80, 0.80, 0.90, 6]].forEach((v) => {
                    const m = this.add.image(w * v[1], this.groundTop + 5, v[0]);
                    m.setOrigin(0.5, 1).setScale(v[2] * vk * mvk).setAlpha(v[3]).setDepth(-9);
                    m.setData('sp', v[4]);
                    this.mountains.push(m);
                });
            }
        } else {
            for (let i = 0; i < 3; i++) {
                const m = this.add.image(Phaser.Math.Between(0, w), this.groundTop + 5, 'mountain');
                m.setOrigin(0.5, 1).setScale(Phaser.Math.FloatBetween(1.0, 1.6)).setAlpha(0.75).setDepth(-8);
                this.mountains.push(m);
            }
        }

        // Fondo: nubes (con arte nuevo: capas densas de ceniza, 3 lejanas arriba y 4 cercanas mas abajo)
        this.clouds = [];
        if (this.artNew) {
            const ck = Math.min(1, w / 800);
            for (let i = 0; i < 7; i++) {
                const far = i < 3;
                const c = this.add.image(
                    Phaser.Math.Between(0, w),
                    h * (far ? Phaser.Math.FloatBetween(0.07, 0.22) : Phaser.Math.FloatBetween(0.28, 0.46)),
                    'ash_cloud');
                c.setScale((far ? Phaser.Math.FloatBetween(0.7, 1.0) : Phaser.Math.FloatBetween(1.0, 1.6)) * ck)
                    .setAlpha(far ? 0.55 : 0.8).setDepth(-6);
                c.setData('sp', far ? Phaser.Math.Between(4, 7) : Phaser.Math.Between(10, 16));
                c.setData('far', far);
                this.clouds.push(c);
            }
        } else {
            for (let i = 0; i < 4; i++) {
                const c = this.add.image(Phaser.Math.Between(0, w), Phaser.Math.Between(40, h * 0.35), 'cloud');
                c.setScale(Phaser.Math.FloatBetween(0.6, 1.2)).setAlpha(0.9).setDepth(-6);
                this.clouds.push(c);
            }
        }

        // Fondo: pterosaurios lejanos (siluetas que huyen hacia la derecha)
        this.farPteros = [];
        if (this.artNew) {
            [[0.10, 0.9, 38], [0.19, 0.6, 26], [0.27, 0.75, 32], [0.14, 0.5, 20]].forEach((cfg, i) => {
                const p = this.add.image(Phaser.Math.Between(0, w), h * cfg[0], 'ptero_far')
                    .setScale(cfg[1]).setAlpha(0.55).setDepth(-7);
                p.setData('speed', cfg[2]);
                p.setData('ph', i * 1.7);
                this.farPteros.push(p);
            });
        }

        // Suelo
        this.groundOffset = this.isMobile ? 180 : 80;
        this.groundTop = h - this.groundOffset;
        // Collider invisible (fino, en la superficie)
        this.ground = this.add.rectangle(w / 2, this.groundTop + 5, w, 10, 0x333333).setVisible(false);
        this.physics.add.existing(this.ground, true)

        this.ground.setVisible(false);
        this.groundVisual = this.add.tileSprite(
            this.scale.width / 2, this.groundTop + 25,
            this.scale.width, 50, 'groundTile'
        );

        // Emisor de polvo detrás del dino
        this.dustEmitter = this.add.particles(0, 0, 'dust', {
            speed: { min: 20, max: 60 },
            angle: { min: 200, max: 240 },
            scale: { start: 1, end: 0 },
            alpha: { start: 0.6, end: 0 },
            lifespan: 400,
            frequency: 80,
            emitting: false,
            gravityY: -40
        });
        this.dustEmitter.setDepth(-2);
;
        // Visual: roca que cubre desde el suelo hasta abajo
        const floorHeight = this.groundOffset + 80;
        // [REMOVED: sobrescribía groundVisual con capa oculta depth:-1 que no se scrolleaba]
        // this.groundVisual = this.add.tileSprite(w / 2, this.groundTop + floorHeight / 2, w, floorHeight, 'rock').setDepth(-1);

        // Player
        this.player = this.physics.add.sprite(Math.max(50, w * 0.2), this.groundTop, "dino");
        this.player.setOrigin(0.5, 1);
        this.player.body.setSize(40, 40);
        this.player.setCollideWorldBounds(true);
        this.player.body.setGravityY(900);

        // Grupos
        this.enemies = this.physics.add.group();
        this.collectibles = this.physics.add.group();

        this.physics.add.collider(this.player, this.ground, null, null, this);
        this.physics.add.overlap(this.player, this.enemies, this.handleEnemyCollision, null, this);
        this.physics.add.overlap(this.player, this.collectibles, this.collectItem, null, this);

        // Input
        this.jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.jumpKey.on('down', () => this.tryJump());
        this.input.on('pointerdown', () => this.tryJump());

        // Meteorito en el fondo (semilla casi invisible al inicio)
        this.meteor = this.add.image(
            this.artNew ? this.scale.width * 0.12 : this.scale.width - 100,
            this.artNew ? this.scale.height * 0.16 : 100,
            'meteor')
            .setDepth(this.artNew ? -10 : -3)
            .setScale(0.12);
        if (this.artNew) {
            const _k0 = Math.round(this.scale.height * 0.14);
            this.meteor.setDisplaySize(_k0, _k0);
        }

        this.spawnNext();
        this.spawnNextCollectible();

        // HUD en canvas
        // HUD via DOM (index.html + style.css)
        this.hudNextLifeEl = document.getElementById('hud-next-life');
        this.hudLivesEl = document.getElementById('hud-lives');
        this.lastNextLife = -1;
        this.lastLives = -1;
    }

    spawnNext() {
        if (this.gameOver) return;
        const _isLeyenda = this.mode === 'leyenda';
        const _spawnMin = _isLeyenda ? 600 : 1200;
        const _spawnMax = _isLeyenda ? 1400 : 2800;
        this.spawnTimer = this.time.delayedCall(Phaser.Math.Between(_spawnMin, _spawnMax), () => {
            if (this.gameOver) return;
            this.spawnEnemy();
            this.spawnNext();
        });
    }

    spawnEnemy() {
        const w = this.scale.width, h = this.scale.height;
        const isFlying = Phaser.Math.Between(0, 6) === 0;
        const key = isFlying ? 'mushroom_fly' : 'mushroom';
        const baseY = isFlying ? this.groundTop - 80 : this.groundTop;

        const e = this.physics.add.sprite(w + 60, baseY, key);
        e.setOrigin(0.5, 1);
        e.body.setAllowGravity(false);
        e.body.setImmovable(true);
        e.setData('isFlying', isFlying);
        e.setData('baseY', baseY);
        e.setData('hopPhase', Math.random() * Math.PI * 2);
        this.enemies.add(e);
    }

    spawnNextCollectible() {
        if (this.gameOver) return;
        this.collectTimer = this.time.delayedCall(Phaser.Math.Between(800, 1500), () => {
            if (this.gameOver) return;
            const _mode = (new URLSearchParams(window.location.search)).get('mode') || 'normal';
            if (_mode !== 'supervivencia') this.spawnCollectible();
            this.spawnNextCollectible();
        });
    }

    spawnCollectible() {
        const w = this.scale.width, h = this.scale.height;
        const r = Math.random();
        let key, type;
        if (r < 0.845) { key = 'meat'; type = 'meat'; }
        else if (r < 0.92) { key = 'star'; type = 'star'; }
        else if (r < 0.995) { key = 'magnet'; type = 'magnet'; }
        else { key = 'heart'; type = 'heart'; }

        const y = Phaser.Math.Between(this.groundTop - 200, this.groundTop - 60);
        const item = this.physics.add.sprite(w + 40, y, key);
        item.setData('type', type);
        item.body.setAllowGravity(false);
        item.body.setImmovable(true);
        this.collectibles.add(item);
    }

    tryJump() {
        if (this.gameOver) return;
        if (this.player.body.blocked.down || this.player.body.touching.down) {
            this.player.body.setVelocityY(-500);
            SoundFX.jump();
        }
    }

    handleEnemyCollision(player, enemy) {
        if (this.gameOver) return;

        // Estrella activa: matar enemigos al tocarlos
        if (this.isGhost) {
            enemy.destroy();
            this.score += 150;
            SoundFX.stomp();
            return;
        }

        if (this.time.now < this.invulnerableUntil) return;

        const falling = player.body.velocity.y > 50;
        const feetNearTop = (player.body.bottom - enemy.body.top) < 25;

        if (falling && feetNearTop) {
            // STOMP
            enemy.destroy();
            player.body.setVelocityY(-450);
            this.score += 100;
            SoundFX.stomp();
        } else {
            this.hitPlayer();
        }
    }

    hitPlayer() {
        if (this.isGhost || this.time.now < this.invulnerableUntil) return;

        if (this.lives > 1) {
            this.lives--;
            SoundFX.hurt();
            this.invulnerableUntil = this.time.now + 2000;
            this.player.setAlpha(0.5);
            this.time.delayedCall(2000, () => this.player.setAlpha(1));
            this.enemies.clear(true, true);
            this.updateLivesText();
        } else {
            this.gameOverHandler();
        }
    }

    updateLivesText() {
        if (this.hudLivesEl) {
            this.hudLivesEl.textContent = 'Vidas: x' + this.lives;
            this.hudLivesEl.style.color = this.lives > 1 ? '#ff6b6b' : '#aaa';
        }
    }

    collectItem(player, item) {
        const type = item.getData('type');
        item.destroy();
        if (type === 'meat') { this.score += (this.mode === 'leyenda' ? 100 : 50); SoundFX.coin(); }
        else if (type === 'star') { this.activateGhost(); }
        else if (type === 'magnet') { this.activateMagnet(); }
        else if (type === 'heart') { this.lives++; this.updateLivesText(); SoundFX.extraLife(); }
    }

    activateGhost() {
        this.isGhost = true;
        this.ghostEndTime = this.time.now + 10000;
        this.updatePlayerTint();
        this.cameras.main.flash(180, 255, 255, 100);
        SoundFX.powerup();
        if (this.ghostBarEl) { this.ghostBarEl.style.display = 'block'; this.ghostFillEl.style.width = '100%'; }
        if (this.ghostTimer) this.ghostTimer.remove();
        this.ghostTimer = this.time.delayedCall(10000, () => {
            this.isGhost = false;
            this.ghostTimer = null;
            this.updatePlayerTint();
            if (this.ghostBarEl) this.ghostBarEl.style.display = 'none';
        });
    }

    activateMagnet() {
        this.isMagnet = true;
        this.magnetEndTime = this.time.now + 10000;
        this.updatePlayerTint();
        this.cameras.main.flash(180, 100, 200, 255);
        SoundFX.powerup();
        if (this.magnetBarEl) { this.magnetBarEl.style.display = 'block'; this.magnetFillEl.style.width = '100%'; }
        if (this.magnetTimer) this.magnetTimer.remove();
        this.magnetTimer = this.time.delayedCall(10000, () => {
            this.isMagnet = false;
            this.magnetTimer = null;
            this.updatePlayerTint();
            if (this.magnetBarEl) this.magnetBarEl.style.display = 'none';
        });
    }

    updatePlayerTint() {
        if (this.isGhost && this.isMagnet) this.player.setTint(0x9933ff).setAlpha(0.75);
        else if (this.isGhost) this.player.setTint(0xffff00).setAlpha(0.65);
        else if (this.isMagnet) this.player.setTint(0x00aaff).setAlpha(1);
        else this.player.clearTint().setAlpha(1);
    }

    gameOverHandler() {
        if (this.gameOver) return;
        this.gameOver = true;
        this.physics.pause();
        [this.spawnTimer, this.collectTimer, this.ghostTimer, this.magnetTimer].forEach(t => t && t.remove());
        SoundFX.death();
        if (window.onGameOver) window.onGameOver(this.alias, Math.floor(this.score));
    }

    update(time, delta) {
        if (this.groundVisual) this.groundVisual.tilePositionX += 5;
        // Meteorito creciendo con el score (0.12 → 1.2 en 10000 pts)
        if (this.meteor) {
            const _meteorDiv = this.mode === 'meteorito' ? 5000 : 10000;
            const s = Math.min(1.2, 0.12 + (this.score / _meteorDiv) * 1.08);
            this.meteor.setScale(s);
            if (this.artNew) {
                // grande, de izquierda a derecha y bajando: se acerca, pero cae a un lado del dino
                const _p = (s - 0.12) / 1.08;
                const _H = this.scale.height, _W = this.scale.width;
                const _k = Math.round(_H * (0.14 + 0.76 * _p));
                this.meteor.setDisplaySize(_k, _k);
                this.meteor.x = _W * (0.12 + 0.50 * _p);
                this.meteor.y = _H * (0.16 + 0.26 * _p);
            } else {
                this.meteor.x = this.scale.width - 100 - (s - 0.12) * 35;
            }
        }
        if (this.dustEmitter && !this.gameOver) {
            const onFloor = this.player.body.onFloor();
            this.dustEmitter.emitting = onFloor;
            if (onFloor) {
                this.dustEmitter.setPosition(this.player.x - 18, this.player.body.bottom - 6);
            }
        }
        if (this.gameOver) {
            if (Phaser.Input.Keyboard.JustDown(this.jumpKey)) this.scene.restart();
            return;
        }

        const dt = delta / 1000;
        const w = this.scale.width;

        // Dino animado: patas al correr y pose de salto (solo aspecto; el hitbox no cambia)
        if (this.artNew && this.player) {
            const grounded = this.player.body.blocked.down || this.player.body.touching.down;
            let pk = 'dino_jump';
            if (grounded) {
                const period = Math.max(60, 150 - this.speed * 8);
                pk = Math.floor(time / period) % 2 ? 'dino_run2' : 'dino';
            }
            if (this.player.texture.key !== pk) this.player.setTexture(pk);
        }

        const _mode2 = (new URLSearchParams(window.location.search)).get('mode') || 'normal';
        if (_mode2 !== 'carnivoro') this.score += dt * 10 * this.speed;
        this.speed += dt * 0.05;

        // Vida extra cada 20k
        if (this.score >= this.nextLifeScore) {
            this.lives++;
            this.nextLifeScore += 10000;
            SoundFX.extraLife();
            this.updateLivesText();
            this.cameras.main.flash(300, 255, 150, 150);
        }

        // Parallax: montañas (con arte nuevo: volcanes, por dt)
        this.mountains.forEach((m) => {
            if (this.artNew) {
                m.x -= (m.getData('sp') || 5) * ((delta || 16) / 1000);
                const half = m.displayWidth / 2;
                if (m.x < -half) m.x = w + half + Phaser.Math.Between(0, 200);
            } else {
                m.x -= 0.1;
                if (m.x < -200) m.x = w + Phaser.Math.Between(100, 400);
            }
        });

        // Fondo: pterosaurios lejanos (por dt, hacia la derecha)
        if (this.farPteros && this.farPteros.length) {
            const _dtF = (delta || 16) / 1000;
            const _wF = this.scale.width;
            const _hF = this.scale.height;
            this.farPteros.forEach((p) => {
                p.x += p.getData('speed') * _dtF;
                const ph = p.getData('ph') + _dtF * 8;
                p.setData('ph', ph);
                p.setTexture(Math.sin(ph) > 0 ? 'ptero_far' : 'ptero_far2');
                if (p.x > _wF + 60) {
                    p.x = -60;
                    p.y = Phaser.Math.Between(Math.round(_hF * 0.08), Math.round(_hF * 0.32));
                }
            });
        }

        // Parallax: nubes (con arte nuevo: ceniza, por dt)
        this.clouds.forEach((c) => {
            if (this.artNew) {
                c.x -= c.getData('sp') * ((delta || 16) / 1000);
                const half = c.displayWidth / 2;
                if (c.x < -half) {
                    c.x = w + half;
                    c.y = this.scale.height * (c.getData('far') ? Phaser.Math.FloatBetween(0.07, 0.22) : Phaser.Math.FloatBetween(0.28, 0.46));
                }
                return;
            }
            c.x -= 0.3;
            if (c.x < -100) {
                c.x = w + 100;
                c.y = Phaser.Math.Between(40, this.scale.height * 0.35);
            }
        });

        // Enemigos
        this.enemies.getChildren().forEach((e) => {
            const isFlying = e.getData('isFlying');
            const speedMult = isFlying ? 1.0 : 1.3;
            e.x -= this.speed * speedMult;
            if (isFlying) {
                const phase = e.getData('hopPhase') + 0.08;
                e.setData('hopPhase', phase);
                e.y = e.getData('baseY') + Math.sin(phase) * 12;
                if (this.artNew) {
                    // Aleteo: alterna las dos poses de alas (solo aspecto)
                    const fk = Math.sin(phase * 3) > 0 ? 'mushroom_fly2' : 'mushroom_fly';
                    if (e.texture.key !== fk) e.setTexture(fk);
                }
            }
            if (e.x < -100) e.destroy();
        });

        // Coleccionables
        this.collectibles.getChildren().forEach((c) => {
            c.x -= this.speed;
            if (c.x < -50) { c.destroy(); return; }
            if (this.isMagnet) {
                const dx = this.player.x - c.x;
                const dy = (this.player.y - 20) - c.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d > 1) { c.x += (dx / d) * 10; c.y += (dy / d) * 10; }
            }
        });

        // Barras de power-ups
        if (this.isGhost && this.ghostFillEl) {
            const rem = Math.max(0, this.ghostEndTime - this.time.now);
            this.ghostFillEl.style.height = (rem / 10000 * 100) + '%';
        }
        if (this.isMagnet && this.magnetFillEl) {
            const rem = Math.max(0, this.magnetEndTime - this.time.now);
            this.magnetFillEl.style.height = (rem / 10000 * 100) + '%';
        }

        // HUD DOM
        if (this.hudScoreEl) {
            const s = Math.floor(this.score);
            if (s !== this.lastHudScore) { this.lastHudScore = s; this.hudScoreEl.textContent = s; }
        }
        if (this.hudSpeedEl) {
            const v = (this.speed / 3).toFixed(1);
            if (v !== this.lastHudSpeed) { this.lastHudSpeed = v; this.hudSpeedEl.textContent = 'x' + v; }
        }
        if (this.hudNextLifeEl) {
            const remaining = Math.max(0, Math.ceil(this.nextLifeScore - this.score));
            if (remaining !== this.lastNextLife) {
                this.lastNextLife = remaining;
                this.hudNextLifeEl.textContent = 'Próxima vida: ' + remaining.toLocaleString() + ' pts';
            }
        }
        if (this.hudLivesEl && this.lives !== this.lastLives) {
            this.lastLives = this.lives;
            this.hudLivesEl.textContent = 'Vidas: x' + this.lives;
            this.hudLivesEl.style.color = this.lives > 1 ? '#ff6b6b' : '#aaa';
        }

        // HUD canvas
    }
}

const SoundFX = {
    ctx: null,
    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { console.warn('[SFX] no disponible', e); }
    },
    play(freq, dur, type, vol, delay) {
        if (!this.ctx) return;
        type = type || 'square'; vol = vol || 0.08; delay = delay || 0;
        const t0 = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(t0); osc.stop(t0 + dur);
    },
    jump() { this.play(500, 0.08, 'square', 0.06); },
    coin() { this.play(880, 0.05, 'sine', 0.10, 0); this.play(1180, 0.06, 'sine', 0.11, 0.05); this.play(1560, 0.10, 'sine', 0.12, 0.10); },
    stomp() { this.play(700, 0.05, 'square', 0.10, 0); this.play(350, 0.10, 'square', 0.10, 0.05); },
    hurt() { this.play(250, 0.15, 'sawtooth', 0.12, 0); this.play(150, 0.20, 'sawtooth', 0.12, 0.10); },
    powerup() { this.play(600, 0.10, 'sine', 0.10, 0); this.play(900, 0.10, 'sine', 0.10, 0.08); this.play(1200, 0.15, 'sine', 0.10, 0.16); },
    extraLife() { this.play(660, 0.10, 'sine', 0.12, 0); this.play(880, 0.10, 'sine', 0.12, 0.10); this.play(1100, 0.15, 'sine', 0.12, 0.20); this.play(1320, 0.20, 'sine', 0.12, 0.35); },
    death() { this.play(300, 0.15, 'sawtooth', 0.12, 0); this.play(200, 0.20, 'sawtooth', 0.12, 0.15); this.play(120, 0.40, 'sawtooth', 0.12, 0.35); }
};

// Precargar alias en el input
try {
    const savedAlias = localStorage.getItem('dino_alias');
    if (savedAlias) {
        const input = document.getElementById('alias-input');
        if (input) input.value = savedAlias;
    }
} catch (e) { /* ignorar */ }

window.startGame = (alias) => {
    try { localStorage.setItem('dino_alias', alias); } catch (e) { /* ignorar */ }

    const config = {
        type: Phaser.AUTO,
        parent: 'game-canvas',
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
        backgroundColor: '#f7f7f7',
        physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
        scene: new DinoGame(alias),
    };
    return new Phaser.Game(config);
};
