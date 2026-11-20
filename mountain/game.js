// Dino Mountain Escape — Salto entre plataformas con cámara vertical
// === PALETA POR NIVEL: 0 amanecer, 1 dia, 2 tarde, 3 atardecer, 4 anochecer, 5 extincion ===
const MTN_FX = {
    PALETTE: [
        { top: 0x3a3f8f, bottom: 0xffb88c, far: 0x6b6fb0, mid: 0x4b4f94, near: 0x2f3370, fog: 0xffc9a8 },
        { top: 0x4a90e2, bottom: 0xbfe6ff, far: 0x7fa8d8, mid: 0x5b88c0, near: 0x3d6aa0, fog: 0xdff2ff },
        { top: 0x3b5fa8, bottom: 0xffd27a, far: 0x8d86b8, mid: 0x6a6296, near: 0x4a4277, fog: 0xffe0a0 },
        { top: 0x5b2a6e, bottom: 0xff7a59, far: 0x8a4b86, mid: 0x65356f, near: 0x452658, fog: 0xff9a72 },
        { top: 0x2a1a3e, bottom: 0xb03a3a, far: 0x5a2a5a, mid: 0x40204a, near: 0x2c1636, fog: 0x8a3040 },
        { top: 0x140a14, bottom: 0x7a1a12, far: 0x3a1418, mid: 0x2a0e12, near: 0x1a080c, fog: 0x5a1a14 }
    ],
    // === HISTORIA POR NIVEL (0 amanecer ... 5 extincion) ===
    LORE: [
        { glow: 0.05, lava: 0.00, smoke: 0.15, ast: 0.00, ptero: 3, flee: 0 },
        { glow: 0.15, lava: 0.00, smoke: 0.45, ast: 0.00, ptero: 3, flee: 1 },
        { glow: 0.30, lava: 0.05, smoke: 0.75, ast: 0.00, ptero: 2, flee: 1 },
        { glow: 0.55, lava: 0.25, smoke: 0.90, ast: 0.25, ptero: 1, flee: 1 },
        { glow: 0.85, lava: 0.75, smoke: 1.00, ast: 0.60, ptero: 0, flee: 1 },
        { glow: 1.00, lava: 1.00, smoke: 1.00, ast: 1.00, ptero: 0, flee: 1 }
    ],
    lerpLore(A, B, t) {
        const o = {};
        for (const k in A) o[k] = A[k] + (B[k] - A[k]) * t;
        return o;
    },
    hex(n) { return '#' + (n & 0xffffff).toString(16).padStart(6, '0'); },
    lerpHex(a, b, t) {
        const ch = (n, sh) => (n >> sh) & 255;
        const mix = (sh) => Math.round(ch(a, sh) + (ch(b, sh) - ch(a, sh)) * t);
        return (mix(16) << 16) | (mix(8) << 8) | mix(0);
    },
    lerpTheme(A, B, t) {
        const o = {};
        for (const k in A) o[k] = this.lerpHex(A[k], B[k], t);
        return o;
    }
};

class DinoMountain extends Phaser.Scene {
    constructor(alias) { super('DinoMountain'); this.alias = alias || 'Jugador_0000'; }

    makeTexture(key, drawFn, w, h) {
        const g = this.add.graphics();
        drawFn(g);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    init() {
        this.mode = new URLSearchParams(window.location.search).get('mode') || 'normal';
        const MODES = {
            normal:  { scroll: 180, jump: -540, gravity: 1500, width: 130, gap: 20, heightStep: 60, points: 1, rockEvery: 3000, rockSpeed: 520, warn: 1000 },
            leyenda: { scroll: 230, jump: -580, gravity: 1700, width: 130, gap: 40, heightStep: 70, points: 2, rockEvery: 2000, rockSpeed: 700, warn: 800 },
            lento:   { scroll: 140, jump: -500, gravity: 1300, width: 100, gap: 25, heightStep: 50, points: 1, rockEvery: 4000, rockSpeed: 400, warn: 1100 }
        };
        const cfg = MODES[this.mode] || MODES.normal;
        this.score = 0;
        this.gameOver = false;
        this.scrollSpeed = cfg.scroll;
        this.jumpPower = cfg.jump;
        this.gravity = cfg.gravity;
        this.platformWidth = cfg.width;
        this.platformGap = cfg.gap;
        this.heightStep = cfg.heightStep;
        this.pointsPerPlatform = cfg.points;
        this.rockEvery = cfg.rockEvery;
        this.rockSpeed = cfg.rockSpeed;
        this.rockWarn = cfg.warn;
        this.nextRockAt = null;
        this.scoreQueue = [];
        this.rocks = [];
        this.bonusJump = false;
        this.bonusTimer = null;
        this.baseScroll = cfg.scroll;
        this.basePitch = cfg.width + cfg.gap;
        this.baseRockEvery = cfg.rockEvery;
        this.passed = 0;
        this.level = 0;
        this.lastHadSpike = false;
        this.lastType = 'up';
        this.pendingRockAt = null;
        this.lastPlatformRightX = 0;
        this.lastPlatformY = 0;
        console.log('[MOUNTAIN] Modo:', this.mode, cfg);
    }

    preload() {
        // Dino verde (color 0x27ae60 del proyecto)
        this.makeTexture('mountain-dino', (g) => {
            g.fillStyle(0x27ae60, 1);
            g.fillRect(8, 10, 20, 14);
            g.fillCircle(28, 12, 8);
            g.fillRect(34, 10, 6, 5);
            g.fillStyle(0xffffff, 1);
            g.fillCircle(32, 10, 3);
            g.fillStyle(0x000000, 1);
            g.fillCircle(33, 10, 1.5);
            g.fillStyle(0x27ae60, 1);
            g.fillTriangle(8, 14, 0, 10, 8, 20);
            g.fillStyle(0x1e8449, 1);
            g.fillRect(14, 22, 3, 8);
            g.fillRect(22, 22, 3, 8);
            g.fillRect(12, 28, 7, 3);
            g.fillRect(21, 28, 7, 3);
        }, 40, 32);

        // Plataforma de roca
        this.makeTexture('mountain-rock', (g) => {
            g.fillStyle(0x6a6a6a, 1);
            g.fillRect(0, 0, 160, 30);
            g.fillStyle(0x8a8a8a, 1);
            g.fillRect(0, 0, 160, 6);
            g.fillStyle(0x4a4a4a, 1);
            g.fillRect(0, 24, 160, 6);
            for (let x = 10; x < 160; x += 30) {
                g.fillTriangle(x, 0, x + 8, 12, x + 16, 0);
            }
        }, 160, 30);

        // Fondo montaña parallax
        this.makeTexture('mountain-bg', (g) => {
            g.fillStyle(0x2c3e50, 1);
            g.fillTriangle(0, 300, 100, 100, 200, 300);
            g.fillTriangle(150, 300, 250, 150, 350, 300);
            g.fillStyle(0x34495e, 1);
            g.fillTriangle(50, 300, 150, 50, 250, 300);
            g.fillTriangle(200, 300, 300, 80, 400, 300);
        }, 400, 300);

        // Roca que cae
        this.makeTexture('falling-rock', (g) => {
            g.fillStyle(0x5a5a5a, 1);
            g.fillCircle(15, 15, 15);
            g.fillStyle(0x7a7a7a, 1);
            g.fillCircle(11, 10, 5);
            g.fillStyle(0x3a3a3a, 1);
            g.fillCircle(20, 20, 4);
        }, 30, 30);

        // Aviso de roca
        this.makeTexture('rock-warning', (g) => {
            g.fillStyle(0xe74c3c, 1);
            g.fillTriangle(16, 2, 30, 28, 2, 28);
            g.fillStyle(0xffffff, 1);
            g.fillRect(14, 10, 4, 10);
            g.fillRect(14, 22, 4, 4);
        }, 32, 32);

        // Pico
        this.makeTexture('spike', (g) => {
            g.fillStyle(0xc0392b, 1);
            g.fillTriangle(12, 0, 24, 20, 0, 20);
            g.fillStyle(0xe74c3c, 1);
            g.fillTriangle(12, 5, 18, 20, 6, 20);
        }, 24, 20);
    }

    // ---- ARTE 3D (solo aspecto): misma clave y mismo tamano que las texturas originales ----
    // Para comparar con el aspecto anterior abre la pagina con ?art=old
    paintCharacterArt() {
        if (new URLSearchParams(window.location.search).get('art') === 'old') return;
        const TAU = Math.PI * 2;
        const mk = (key, w, h, fn) => {
            if (this.textures.exists(key)) this.textures.remove(key);
            const tex = this.textures.createCanvas(key, w, h);
            if (!tex) return;
            fn(tex.getContext());
            tex.refresh();
        };
        const lin = (c, x0, y0, x1, y1, st) => {
            const g = c.createLinearGradient(x0, y0, x1, y1);
            st.forEach((s) => g.addColorStop(s[0], s[1]));
            return g;
        };
        const rad = (c, x0, y0, r0, x1, y1, r1, st) => {
            const g = c.createRadialGradient(x0, y0, r0, x1, y1, r1);
            st.forEach((s) => g.addColorStop(s[0], s[1]));
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

        // ---------- DINO 40x32 ----------
        mk('mountain-dino', 40, 32, (c) => {
            const OUT = 'rgba(10,45,25,0.8)';
            c.lineJoin = 'round';
            // patas (la trasera mas oscura)
            [[14, '#1b7a45', '#0f4d2a'], [22, '#2fae66', '#17703f']].forEach((l) => {
                rr(c, l[0], 21, 4, 9, 1.5);
                c.fillStyle = lin(c, l[0], 0, l[0] + 4, 0, [[0, l[1]], [1, l[2]]]);
                c.fill();
            });
            [12, 21].forEach((x, i) => {
                rr(c, x, 28, 8, 3.6, 1.6);
                c.fillStyle = lin(c, 0, 28, 0, 31.6, [[0, i ? '#2a9a5a' : '#1b7a45'], [1, '#0d3f23']]);
                c.fill();
            });
            // cola
            poly(c, [[10, 13], [0.8, 9.5], [10, 21]]);
            c.fillStyle = lin(c, 0, 9, 10, 21, [[0, '#4fe08a'], [1, '#17703f']]);
            c.fill();
            c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
            line(c, 1.5, 10.2, 10, 13.4, 'rgba(255,255,255,0.35)', 0.8);
            // placas dorsales
            [12, 17, 22].forEach((x) => {
                poly(c, [[x - 3, 11], [x, 5.5], [x + 3, 11]]);
                c.fillStyle = '#17703f'; c.fill();
                poly(c, [[x - 3, 11], [x, 5.5], [x, 11]]);
                c.fillStyle = '#2fae66'; c.fill();
            });
            // cuerpo
            rr(c, 8, 10, 21, 15, 6);
            c.fillStyle = lin(c, 0, 10, 0, 25, [[0, '#5fdc90'], [0.3, '#27ae60'], [1, '#176b3a']]);
            c.fill();
            rr(c, 8, 10, 21, 15, 6);
            c.fillStyle = rad(c, 14, 13, 1, 14, 13, 15, [[0, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
            c.fill();
            c.beginPath(); c.ellipse(19, 22, 6, 2.5, 0, 0, TAU);
            c.fillStyle = 'rgba(190,255,200,0.22)'; c.fill();
            rr(c, 8, 10, 21, 15, 6);
            c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
            line(c, 13, 10.7, 22, 10.7, 'rgba(255,255,255,0.45)', 1);
            // hocico (se dibuja antes que la cabeza para que esta lo tape por la izquierda)
            rr(c, 33, 9, 7, 7, 2.5);
            c.fillStyle = lin(c, 0, 9, 0, 16, [[0, '#3fd17c'], [1, '#1f8a4d']]);
            c.fill();
            c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
            // cabeza
            c.beginPath(); c.arc(28, 12, 8, 0, TAU);
            c.fillStyle = rad(c, 25, 8, 1, 28, 12, 10, [[0, '#7bf0a6'], [0.45, '#2fbf6b'], [1, '#17703f']]);
            c.fill();
            c.beginPath(); c.arc(28, 12, 8, Math.PI * 0.62, Math.PI * 1.7);
            c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
            // ojo, nariz, boca
            c.beginPath(); c.arc(31.5, 9.5, 3.2, 0, TAU);
            c.fillStyle = lin(c, 29, 7, 34, 12, [[0, '#ffffff'], [1, '#d3e2d9']]);
            c.fill();
            c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.8; c.stroke();
            dot(c, 32.5, 10, 1.7, '#0b1a12');
            dot(c, 32, 9.3, 0.6, '#ffffff');
            line(c, 29, 6.4, 34, 7.4, 'rgba(10,60,30,0.7)', 1.1);
            dot(c, 38.2, 11, 0.7, 'rgba(0,40,20,0.7)');
            line(c, 34.5, 14.2, 39.5, 14.2, 'rgba(0,40,20,0.55)', 0.9);
        });

        // ---------- PLATAFORMA 160x30 (se estira en horizontal) ----------
        mk('mountain-rock', 160, 30, (c) => {
            c.lineJoin = 'round';
            // frente de roca
            c.fillStyle = lin(c, 0, 0, 0, 30, [[0, '#8d8d95'], [0.25, '#74747c'], [1, '#3b3b42']]);
            c.fillRect(0, 0, 160, 30);
            // motas (determinista)
            for (let i = 0; i < 44; i++) {
                const x = (i * 37) % 158, y = 9 + ((i * 53) % 17), sz = 1 + (i % 2);
                c.fillStyle = i % 2 ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.14)';
                c.fillRect(x, y, sz, sz);
            }
            // grietas con borde de luz
            const cracks = [
                [[22, 7], [24, 12], [21, 17], [23, 23]],
                [[58, 7], [56, 13], [60, 19], [57, 26]],
                [[96, 7], [98, 11], [95, 18]],
                [[131, 7], [129, 14], [132, 20], [130, 27]],
                [[146, 9], [148, 14]]
            ];
            cracks.forEach((pts) => {
                [[1, 'rgba(255,255,255,0.14)'], [0, 'rgba(0,0,0,0.38)']].forEach((o) => {
                    c.beginPath();
                    pts.forEach((p, i) => (i ? c.lineTo(p[0] + o[0], p[1]) : c.moveTo(p[0] + o[0], p[1])));
                    c.strokeStyle = o[1]; c.lineWidth = 1; c.stroke();
                });
            });
            // luz izquierda, sombra derecha y sombra inferior
            c.fillStyle = lin(c, 0, 0, 160, 0, [[0, 'rgba(255,255,255,0.14)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0.22)']]);
            c.fillRect(0, 0, 160, 30);
            c.fillStyle = lin(c, 0, 22, 0, 30, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.38)']]);
            c.fillRect(0, 22, 160, 8);
            // cara superior clara
            c.fillStyle = lin(c, 0, 0, 0, 7, [[0, '#cfcfd6'], [1, '#9a9aa2']]);
            c.fillRect(0, 0, 160, 7);
            line(c, 0, 7.5, 160, 7.5, 'rgba(0,0,0,0.32)', 1);
            // parches de musgo en el borde superior
            [[0, 24], [60, 90], [118, 140]].forEach((m) => {
                poly(c, [[m[0], 0], [m[1], 0], [m[1] - 4, 4], [m[1] - 9, 2.5], [m[0] + 9, 5], [m[0] + 4, 3]]);
                c.fillStyle = lin(c, 0, 0, 0, 5, [[0, '#8fbf4a'], [1, '#4a8a30']]);
                c.fill();
                const mid = (m[0] + m[1]) / 2;
                poly(c, [[mid - 3, 4], [mid, 10], [mid + 3, 4]]);
                c.fillStyle = '#4a8a30'; c.fill();
            });
            // brillo superior y bordes laterales
            c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(0, 0, 160, 1);
            c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(0, 0, 1.5, 30);
            c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(158.5, 0, 1.5, 30);
        });

        // ---------- ROCA QUE CAE 30x30 ----------
        mk('falling-rock', 30, 30, (c) => {
            c.lineJoin = 'round';
            const body = [[15, 1], [23, 3], [28, 10], [29, 19], [23, 27], [14, 29], [6, 25], [1, 17], [2, 8], [8, 3]];
            poly(c, body);
            c.fillStyle = rad(c, 10, 9, 2, 15, 15, 18, [[0, '#a9a9b1'], [0.5, '#6e6e76'], [1, '#35353b']]);
            c.fill();
            poly(c, [[8, 3], [15, 1], [23, 3], [15, 10], [9, 12]]);
            c.fillStyle = 'rgba(255,255,255,0.2)'; c.fill();
            poly(c, [[29, 19], [23, 27], [14, 29], [18, 19]]);
            c.fillStyle = 'rgba(0,0,0,0.28)'; c.fill();
            c.beginPath(); c.moveTo(12, 14); c.lineTo(16, 18); c.lineTo(15, 23);
            c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 1; c.stroke();
            poly(c, body);
            c.strokeStyle = 'rgba(20,20,25,0.85)'; c.lineWidth = 1; c.stroke();
        });

        // ---------- AVISO 32x32 ----------
        mk('rock-warning', 32, 32, (c) => {
            c.lineJoin = 'round';
            const tri = [[16, 3], [29.5, 27.5], [2.5, 27.5]];
            poly(c, tri);
            c.fillStyle = lin(c, 0, 3, 0, 28, [[0, '#ff7a68'], [1, '#c0392b']]);
            c.fill();
            c.strokeStyle = '#8e2a20'; c.lineWidth = 2.5; c.stroke();
            line(c, 15, 7, 5.5, 24.5, 'rgba(255,255,255,0.35)', 1);
            c.fillStyle = 'rgba(0,0,0,0.3)';
            rr(c, 14.8, 11, 4, 10, 2); c.fill();
            dot(c, 16.8, 24.8, 2.1, 'rgba(0,0,0,0.3)');
            c.fillStyle = '#ffffff';
            rr(c, 14, 10, 4, 10, 2); c.fill();
            dot(c, 16, 24, 2.1, '#ffffff');
        });

        // ---------- PICO 24x20 ----------
        mk('spike', 24, 20, (c) => {
            c.lineJoin = 'round';
            poly(c, [[12, 0], [12, 20], [0, 20]]);
            c.fillStyle = lin(c, 0, 20, 12, 0, [[0, '#d94a38'], [1, '#ff9a85']]);
            c.fill();
            poly(c, [[12, 0], [24, 20], [12, 20]]);
            c.fillStyle = lin(c, 12, 0, 24, 20, [[0, '#b83224'], [1, '#6e1f17']]);
            c.fill();
            line(c, 12, 0.5, 12, 20, 'rgba(0,0,0,0.25)', 1);
            line(c, 11.2, 1.8, 1.8, 19, 'rgba(255,255,255,0.4)', 1);
            c.save();
            poly(c, [[12, 0], [24, 20], [0, 20]]);
            c.clip();
            c.fillStyle = lin(c, 0, 16, 0, 20, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.38)']]);
            c.fillRect(0, 16, 24, 4);
            c.restore();
            poly(c, [[12, 1], [23, 19.5], [1, 19.5]]);
            c.strokeStyle = 'rgba(60,10,8,0.8)'; c.lineWidth = 1; c.stroke();
        });
    }

    create() {
        this.paintCharacterArt();
        const w = this.scale.width, h = this.scale.height;

        // Fondo: cielo en degradado + 3 capas de montañas con niebla (ver MTN_FX.PALETTE)
        this.buildBackdrop(w, h);

        // Jugador
        const startX = w * 0.25;
        const startY = h * 0.7;
        this.player = this.physics.add.sprite(startX, startY - 5, 'mountain-dino');
        this.player.body.setSize(36, 28);
        this.player.body.setAllowGravity(false);
        this.player.setDepth(10);

        // Plataformas (estáticas)
        this.platforms = this.physics.add.staticGroup();

        // Plataforma inicial (200 ancho, jugador en borde izquierdo)
        const startPlatCenterX = startX + 70;
        const startPlatY = startY + 29;
        const startPlat = this.platforms.create(startPlatCenterX, startPlatY, 'mountain-rock');
        startPlat.setDisplaySize(200, 30);
        startPlat.body.updateFromGameObject();
        startPlat.setDepth(5);

        this.lastPlatformRightX = startPlatCenterX + 100;
        this.lastPlatformY = startPlatY;

        // Primera plataforma siguiente
        this.spawnNextPlatform();

        // Colisión one-way: solo aterrizar desde arriba
        this.physics.add.collider(
            this.player,
            this.platforms,
            null,
            (player, plat) => {
                return player.body.velocity.y >= -50 &&
                       player.body.bottom <= plat.body.top + 20;
            },
            this
        );

        // Cámara
        this.cameras.main.setBackgroundColor(0x1a1a2e);
        this.cameras.main.scrollX = this.player.x - w * 0.25;
        this.camFocusY = this.player.y;
        this.cameras.main.scrollY = this.camFocusY - h * 0.65;

        // HUD
        this.scoreText = this.add.text(w/2, 20, '0', {
            fontFamily: 'monospace', fontSize: '32px', color: '#fff', fontStyle: 'bold'
        }).setOrigin(0.5, 0).setDepth(20).setScrollFactor(0);

        // Input
        this.input.keyboard.on('keydown-SPACE', () => this.jump(), this);
        this.input.on('pointerdown', () => this.jump(), this);

        console.log('[MOUNTAIN] Iniciado para', this.alias);
    }

    // === FONDO: cielo en degradado + 3 capas de montanas con niebla ===
    buildBackdrop(w, h) {
        const mk = (key, tw, th) => {
            if (this.textures.exists(key)) this.textures.remove(key);
            return this.textures.createCanvas(key, tw, th);
        };
        this.skyTex = mk('sky-gradient', 4, 256);
        this.mtnTex = [mk('mtn-far', 512, 512), mk('mtn-mid', 512, 512), mk('mtn-near', 512, 512)];

        this.sky = this.add.image(0, 0, 'sky-gradient')
            .setOrigin(0, 0).setDisplaySize(w, h).setScrollFactor(0).setDepth(-20);

        // Parallax de lejos a cerca: fx = desplazamiento horizontal, fy = cuanto bajan al subir
        this.mtnCfg = [
            { key: 'mtn-far',  fx: 0.06, fy: 0.04, depth: -15 },
            { key: 'mtn-mid',  fx: 0.14, fy: 0.08, depth: -14 },
            { key: 'mtn-near', fx: 0.26, fy: 0.14, depth: -13 }
        ];
        // Cada capa = varias imagenes de 512 px en fila (leen el canvas en vivo, en Canvas y en WebGL)
        const nImgs = Math.ceil(Math.max(w, 2560) / 512) + 1;
        this.mtnLayers = this.mtnCfg.map((c) => {
            const imgs = [];
            for (let k = 0; k < nImgs; k++) {
                imgs.push(this.add.image(0, h, c.key).setOrigin(0, 1).setScrollFactor(0).setDepth(c.depth));
            }
            return imgs;
        });

        this.backdropY0 = null;
        this.themeNow = MTN_FX.PALETTE[0];
        this.loreOn = new URLSearchParams(window.location.search).get('lore') !== 'off';
        this.loreNow = MTN_FX.LORE[0];
        this.themeTween = null;
        this.themeStep = -1;
        this.paintBackdrop(this.themeNow);
        this.buildLore(w, h);

        this.scale.on('resize', (size) => {
            this.sky.setDisplaySize(size.width, size.height);
        }, this);
    }

    paintBackdrop(t) {
        const css = (n) => MTN_FX.hex(n);

        // Cielo: degradado vertical
        const sc = this.skyTex.getContext();
        const sg = sc.createLinearGradient(0, 0, 0, 256);
        sg.addColorStop(0, css(t.top));
        sg.addColorStop(1, css(t.bottom));
        sc.fillStyle = sg;
        sc.fillRect(0, 0, 4, 256);
        this.skyTex.refresh();

        // Montanas: crestas con senos de periodo entero (el mosaico encaja sin costuras)
        const W = 512, H = 512;
        const defs = [
            { color: t.far,  base: 250, a1: 70, k1: 2, p1: 0.6, a2: 22, k2: 5, p2: 1.9 },
            { color: t.mid,  base: 310, a1: 70, k1: 3, p1: 2.4, a2: 24, k2: 7, p2: 0.4 },
            { color: t.near, base: 380, a1: 55, k1: 4, p1: 4.1, a2: 18, k2: 9, p2: 3.3 }
        ];
        defs.forEach((d, i) => {
            const c = this.mtnTex[i].getContext();
            const yAt = (x) => d.base
                - d.a1 * Math.sin((2 * Math.PI * d.k1 * x) / W + d.p1)
                - d.a2 * Math.sin((2 * Math.PI * d.k2 * x) / W + d.p2);
            c.clearRect(0, 0, W, H);

            // Cuerpo con niebla hacia la base
            c.beginPath();
            c.moveTo(0, H);
            for (let x = 0; x <= W; x += 4) c.lineTo(x, yAt(x));
            c.lineTo(W, H);
            c.closePath();
            const g = c.createLinearGradient(0, d.base - d.a1 - d.a2, 0, H);
            g.addColorStop(0, css(d.color));
            g.addColorStop(1, css(MTN_FX.lerpHex(d.color, t.fog, 0.65)));
            c.fillStyle = g;
            c.fill();

            // Luz de borde en la cresta
            c.beginPath();
            for (let x = 0; x <= W; x += 4) { if (x === 0) c.moveTo(x, yAt(x)); else c.lineTo(x, yAt(x)); }
            c.strokeStyle = css(MTN_FX.lerpHex(d.color, 0xffffff, 0.35));
            c.globalAlpha = 0.5;
            c.lineWidth = 2;
            c.stroke();
            c.globalAlpha = 1;

            if (this.loreOn) this.paintLoreLayer(i, c, d, yAt, t, W, H);
            this.mtnTex[i].refresh();
        });
    }

    // === LORE: volcanes, vegetacion prehistorica, pterosaurios y asteroide (solo aspecto) ===
    // Para comparar con el fondo anterior abre la pagina con ?lore=off
    buildLore(w, h) {
        if (!this.loreOn) return;
        const TAU = Math.PI * 2;
        const mk = (key, tw, th, fn) => {
            if (this.textures.exists(key)) this.textures.remove(key);
            const tex = this.textures.createCanvas(key, tw, th);
            if (!tex) return;
            fn(tex.getContext());
            tex.refresh();
        };
        const poly = (c, pts) => {
            c.beginPath();
            pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
            c.closePath();
        };

        // Asteroide 256x256: cola de fuego hacia arriba a la derecha, halo y cuerpo con crateres
        mk('lore-ast', 256, 256, (c) => {
            const tg = c.createLinearGradient(128, 128, 256, 0);
            tg.addColorStop(0, 'rgba(255,170,70,0.6)');
            tg.addColorStop(1, 'rgba(255,80,20,0)');
            poly(c, [[152, 152], [104, 104], [256, 0]]);
            c.fillStyle = tg; c.fill();
            const hg = c.createRadialGradient(128, 128, 20, 128, 128, 120);
            hg.addColorStop(0, 'rgba(255,160,60,0.55)');
            hg.addColorStop(1, 'rgba(255,80,20,0)');
            c.fillStyle = hg; c.fillRect(0, 0, 256, 256);
            c.beginPath(); c.arc(128, 128, 36, 0, TAU);
            const bg = c.createRadialGradient(116, 114, 3, 128, 128, 40);
            bg.addColorStop(0, '#ffd9a0'); bg.addColorStop(0.45, '#c0562a'); bg.addColorStop(1, '#4a170d');
            c.fillStyle = bg; c.fill();
            [[118, 120, 7], [138, 114, 5], [130, 140, 6], [112, 138, 4]].forEach((k) => {
                c.beginPath(); c.arc(k[0], k[1], k[2], 0, TAU);
                c.fillStyle = 'rgba(60,15,8,0.45)'; c.fill();
            });
            c.beginPath(); c.arc(128, 128, 36, Math.PI * 0.35, Math.PI * 1.15);
            c.strokeStyle = 'rgba(255,235,170,0.75)'; c.lineWidth = 2; c.stroke();
        });

        // Pterosaurio 48x24 en dos fotogramas (alas arriba / abajo)
        const ptero = (wing) => (c) => {
            c.fillStyle = '#120a20';
            c.beginPath(); c.ellipse(24, 13, 6.5, 2.6, 0, 0, TAU); c.fill();
            poly(c, [[28, 11], [47, 13], [28, 15.2]]); c.fill();
            poly(c, [[27, 11.5], [22, 6], [31, 10.5]]); c.fill();
            poly(c, [[19, 13], [9, 14], [19, 15]]); c.fill();
            poly(c, wing);
            c.fill();
        };
        mk('lore-ptero-0', 48, 24, ptero([[20, 12.5], [13, 0.5], [3, 3], [11, 8], [23, 14.5]]));
        mk('lore-ptero-1', 48, 24, ptero([[20, 13.5], [12, 23], [2, 19], [11, 14], [23, 14.5]]));

        this.asteroid = this.add.image(w * 0.74, h * 0.25, 'lore-ast')
            .setScrollFactor(0).setDepth(-18).setVisible(false);
        this.pteros = [0, 1, 2, 3].map((i) => ({
            img: this.add.image(0, 0, 'lore-ptero-0').setScrollFactor(0).setDepth(-16).setVisible(false),
            x: w * (0.1 + i * 0.27), y: 0.10 + 0.075 * i, sp: 16 + i * 6, sc: [1.3, 1, 1.6, 0.9][i]
        }));
    }

    updateLore() {
        if (!this.loreOn || !this.asteroid) return;
        const L = this.loreNow;
        const w = this.scale.width, h = this.scale.height, now = this.time.now;
        const dt = Math.min(0.05, this.game.loop.delta / 1000);

        const a = this.asteroid;
        if (L.ast < 0.02) {
            a.setVisible(false);
        } else {
            const sc = L.ast * 2.2 * Math.min(1, h / 700);
            a.setVisible(true).setScale(sc).setAlpha(Math.min(1, L.ast * 3))
                .setPosition(w * 0.74, h * (0.27 - 0.05 * L.ast) + Math.sin(now / 1800) * 3);
        }

        this.pteros.forEach((p, i) => {
            const al = Math.max(0, Math.min(1, L.ptero - i));
            if (al < 0.02) { p.img.setVisible(false); return; }
            p.x += p.sp * (1 + 2.2 * L.flee) * dt;
            if (p.x > w + 60) p.x = -60;
            const key = Math.floor(now / (300 - 110 * L.flee) + i) % 2 ? 'lore-ptero-1' : 'lore-ptero-0';
            if (p.img.texture.key !== key) p.img.setTexture(key);
            p.img.setVisible(true).setAlpha(al * 0.9).setScale(p.sc)
                .setPosition(p.x, h * p.y + Math.sin(now / 900 + i * 2) * 8);
        });
    }

    // Se llama desde paintBackdrop para cada capa i (0 lejos, 1 media, 2 cerca), sobre el canvas ya pintado
    paintLoreLayer(i, c, d, yAt, t, W, H) {
        const L = this.loreNow, css = MTN_FX.hex, TAU = Math.PI * 2;
        const rgba = (n, a) => 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
        c.lineJoin = 'round';
        c.lineCap = 'round';

        if (i < 2) {
            // ---- VOLCANES ----
            const vols = i === 0
                ? [{ cx: 120, top: 175, tw: 12, hw: 100 }, { cx: 380, top: 135, tw: 16, hw: 135 }]
                : [{ cx: 270, top: 190, tw: 14, hw: 115 }];
            const smc = MTN_FX.lerpHex(t.fog, 0x241c22, 0.45 + 0.4 * L.smoke);
            vols.forEach((v) => {
                const yb = 330, top = v.top;
                const left = [], right = [];
                for (let k = 0; k <= 10; k++) {
                    const u = k / 10, y = top + 4 + u * (yb - top - 4);
                    const hw = v.tw + (v.hw - v.tw) * Math.pow(u, 0.75);
                    left.push([v.cx - hw, y]);
                    right.push([v.cx + hw, y]);
                }
                [-W, 0, W].forEach((o) => {
                    c.save();
                    c.translate(o, 0);

                    // silueta con cresta de cráter
                    c.beginPath();
                    c.moveTo(v.cx - v.tw, top);
                    c.lineTo(v.cx - v.tw * 0.45, top + 5);
                    c.lineTo(v.cx + v.tw * 0.45, top + 5);
                    c.lineTo(v.cx + v.tw, top);
                    right.forEach((p) => c.lineTo(p[0], p[1]));
                    c.lineTo(v.cx + v.hw, H);
                    c.lineTo(v.cx - v.hw, H);
                    for (let k = left.length - 1; k >= 0; k--) c.lineTo(left[k][0], left[k][1]);
                    c.closePath();
                    const g = c.createLinearGradient(0, d.base - d.a1 - d.a2, 0, H);
                    g.addColorStop(0, css(d.color));
                    g.addColorStop(1, css(MTN_FX.lerpHex(d.color, t.fog, 0.65)));
                    c.fillStyle = g;
                    c.fill();

                    // luz desde arriba a la izquierda: flanco izquierdo claro, derecho oscuro
                    c.save();
                    c.clip();
                    c.fillStyle = 'rgba(255,255,255,0.09)';
                    c.fillRect(v.cx - v.hw - 6, top - 10, v.hw + 6, H);
                    c.fillStyle = 'rgba(0,0,0,0.17)';
                    c.fillRect(v.cx, top - 10, v.hw + 6, H);
                    c.restore();

                    // filo de luz en el flanco izquierdo
                    c.beginPath();
                    left.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
                    c.strokeStyle = 'rgba(255,255,255,0.3)';
                    c.lineWidth = 1.5;
                    c.stroke();

                    // coladas de lava
                    if (L.lava > 0.04) {
                        [[-1, 0.8], [1, 0.55]].forEach((sd) => {
                            const dir = sd[0], len = sd[1];
                            const pts = [];
                            for (let k = 0; k <= 10; k++) {
                                const u = k / 10;
                                pts.push([
                                    v.cx + dir * (v.tw * 0.5 + u * v.hw * 0.5) + Math.sin(u * 7 + dir) * 4,
                                    top + 4 + u * len * (yb - top)
                                ]);
                            }
                            [['rgba(255,90,20,' + (0.35 * L.lava) + ')', 5], ['rgba(255,200,90,' + (0.9 * L.lava) + ')', 2]].forEach((st) => {
                                c.beginPath();
                                pts.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
                                c.strokeStyle = st[0];
                                c.lineWidth = st[1];
                                c.stroke();
                            });
                        });
                    }

                    // resplandor del cráter
                    const gx = v.cx, gy = top + 3, gr = 40 + 70 * L.glow;
                    const rg = c.createRadialGradient(gx, gy, 2, gx, gy, gr);
                    rg.addColorStop(0, 'rgba(255,205,100,' + (0.95 * L.glow) + ')');
                    rg.addColorStop(0.35, 'rgba(255,110,30,' + (0.45 * L.glow) + ')');
                    rg.addColorStop(1, 'rgba(255,60,20,0)');
                    c.fillStyle = rg;
                    c.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);

                    // columna de humo (mas alta y densa con el nivel); se corta antes de tocar el borde del lienzo
                    const n = 4 + Math.round(6 * L.smoke);
                    for (let j = 0; j < n; j++) {
                        const f = j / n;
                        const px = gx + Math.pow(j, 1.6) * 2.2 + Math.sin(j * 1.7 + v.cx) * 4;
                        const py = gy - 6 - j * (8 + 3 * L.smoke);
                        const r = 7 + j * (3.2 + 1.2 * L.smoke);
                        if (py - r < 2) break;
                        c.beginPath();
                        c.arc(px, py, r, 0, TAU);
                        c.fillStyle = rgba(smc, (0.55 - 0.45 * f) * (0.35 + 0.65 * L.smoke));
                        c.fill();
                    }
                    c.restore();
                });
            });
        } else {
            // ---- CICADAS Y HELECHOS (silueta sobre la cresta cercana) ----
            const col = css(MTN_FX.lerpHex(d.color, 0x000000, 0.5));
            c.strokeStyle = col;
            c.fillStyle = col;

            const frond = (x, y, len, ang, droop, wd) => {
                const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len + droop;
                const qx = x + Math.cos(ang) * len * 0.55, qy = y + Math.sin(ang) * len * 0.9;
                c.lineWidth = wd;
                c.beginPath();
                c.moveTo(x, y);
                c.quadraticCurveTo(qx, qy, ex, ey);
                c.stroke();
                for (let k = 1; k <= 6; k++) {
                    const u = k / 7, m = 1 - u;
                    const ux = m * m * x + 2 * m * u * qx + u * u * ex;
                    const uy = m * m * y + 2 * m * u * qy + u * u * ey;
                    const tx = 2 * m * (qx - x) + 2 * u * (ex - qx);
                    const ty = 2 * m * (qy - y) + 2 * u * (ey - qy);
                    const tl = Math.hypot(tx, ty) || 1;
                    const nx = -ty / tl, ny = tx / tl;
                    const ll = len * 0.16 * (1 - u * 0.6);
                    const fx = (tx / tl) * ll * 0.5, fy = (ty / tl) * ll * 0.5;
                    c.beginPath();
                    c.moveTo(ux, uy); c.lineTo(ux + nx * ll + fx, uy + ny * ll + fy);
                    c.moveTo(ux, uy); c.lineTo(ux - nx * ll + fx, uy - ny * ll + fy);
                    c.lineWidth = Math.max(1, wd * 0.5);
                    c.stroke();
                }
            };

            const plants = [
                { x: 70, kind: 'cycad', s: 1.1 }, { x: 150, kind: 'fern', s: 0.9 },
                { x: 205, kind: 'fern', s: 0.7 }, { x: 300, kind: 'cycad', s: 1.0 },
                { x: 385, kind: 'fern', s: 1.0 }, { x: 445, kind: 'fern', s: 0.8 }
            ];
            plants.forEach((p) => {
                const y = yAt(p.x) + 4;
                if (p.kind === 'cycad') {
                    const th = 26 * p.s, ty = y - th;
                    c.lineWidth = 7 * p.s;
                    c.beginPath(); c.moveTo(p.x, y); c.lineTo(p.x, ty); c.stroke();
                    [-2.9, -2.4, -1.95, -1.57, -1.18, -0.75, -0.25].forEach((a) => {
                        frond(p.x, ty, 34 * p.s, a, 14 * p.s * Math.abs(Math.cos(a)), 2.4 * p.s);
                    });
                } else {
                    [-2.6, -2.2, -1.85, -1.3, -0.95, -0.5].forEach((a) => {
                        frond(p.x, y, 30 * p.s, a, 10 * p.s * Math.abs(Math.cos(a)), 2 * p.s);
                    });
                }
            });
        }
    }

    // Transicion suave entre paletas al cambiar de nivel (8 repintados en 2.5 s)
    setTheme(lvl) {
        if (!this.mtnLayers) return;
        const target = MTN_FX.PALETTE[Math.min(lvl, MTN_FX.PALETTE.length - 1)];
        const from = this.themeNow;
        const loreFrom = this.loreNow || MTN_FX.LORE[0];
        const loreTo = MTN_FX.LORE[Math.min(lvl, MTN_FX.LORE.length - 1)];
        if (this.themeTween) this.themeTween.stop();
        const state = { t: 0 };
        this.themeStep = -1;
        this.themeTween = this.tweens.add({
            targets: state, t: 1, duration: 2500, ease: 'Sine.easeInOut',
            onUpdate: () => {
                this.loreNow = MTN_FX.lerpLore(loreFrom, loreTo, state.t);
                const step = Math.round(state.t * 8);
                if (step === this.themeStep) return;
                this.themeStep = step;
                this.themeNow = MTN_FX.lerpTheme(from, target, step / 8);
                this.paintBackdrop(this.themeNow);
            }
        });
    }

    // Parallax: las capas se desplazan por codigo (no se acaban) y bajan al subir
    updateBackdrop() {
        if (!this.mtnLayers) return;
        const cam = this.cameras.main;
        const h = this.scale.height;
        if (this.backdropY0 === null) this.backdropY0 = cam.scrollY;
        const climbed = this.backdropY0 - cam.scrollY;
        this.mtnLayers.forEach((imgs, i) => {
            const c = this.mtnCfg[i];
            const off = Math.round(((cam.scrollX * c.fx) % 512 + 512) % 512);
            const y = Math.round(h + climbed * c.fy);
            imgs.forEach((img, k) => img.setPosition(k * 512 - off, y));
        });
        this.updateLore();
    }

    jump() {
        if (this.gameOver) return;
        // Solo saltar si está sobre una plataforma
        const grounded = this.player.body.blocked.down || this.player.body.touching.down;
        if (!grounded) {
            // Salto extra concedido por un pisotón (una sola vez)
            if (!this.bonusJump) return;
            this.bonusJump = false;
            this.player.clearTint();
            SoundFX?.play?.(1175, 0.08, 'square', 0.08);
        }
        this.player.body.setVelocityY(this.jumpPower);
        SoundFX?.coin?.();
    }

    spawnNextPlatform() {
        // Tipo de plataforma: subida (normal), bajada o recta con pico.
        // Solo puede haber un tipo especial despues de una subida: nunca dos seguidos
        // y tras una bajada siempre viene una subida.
        let type = 'up';
        if (this.lastType === 'up') {
            const r = Math.random();
            const pFlat = Math.min(0.15 + 0.05 * (this.level - 2), 0.3);
            if (this.level >= 2 && r < pFlat) type = 'flat';
            else if (this.level >= 1 && r > 0.75) type = 'down';
        }
        this.lastType = type;

        const w = type === 'flat' ? Math.round(this.platformWidth * 1.8)
                : type === 'down' ? Math.round(this.platformWidth * 1.25)
                : this.platformWidth;
        const dy = type === 'up' ? -this.heightStep : (type === 'down' ? this.heightStep : 0);

        const nextLeft = this.lastPlatformRightX + this.platformGap;
        const nextY = this.lastPlatformY + dy;
        const nextCenterX = nextLeft + w / 2;

        const plat = this.platforms.create(nextCenterX, nextY, 'mountain-rock');
        plat.setDisplaySize(w, 30);
        plat.body.updateFromGameObject();
        plat.setDepth(5);

        this.lastPlatformRightX = nextLeft + w;
        this.scoreQueue.push(nextCenterX);

        // Pico centrado solo en las plataformas rectas
        if (type === 'flat') {
            plat.spike = this.add.image(nextCenterX, nextY - 15, 'spike')
                .setOrigin(0.5, 1).setDepth(6);
            plat.hasSpike = true;
        }
        this.lastPlatformY = nextY;
    }

    update(time, delta) {
        if (this.gameOver) return;
        const dt = delta / 1000;
        const w = this.scale.width, h = this.scale.height;

        // Auto-scroll horizontal
        this.player.x += this.scrollSpeed * dt;

        // Gravedad manual
        this.player.body.velocity.y += this.gravity * dt;

        // Cámara X sigue al jugador; Y sigue el suelo
        this.cameras.main.scrollX = this.player.x - w * 0.25;
        // Y: sigue el suelo donde esta apoyado (sube y baja), sin seguir el apice del salto
        const grounded = this.player.body.blocked.down || this.player.body.touching.down;
        if (grounded) this.camFocusY = this.player.y;
        const targetScrollY = this.camFocusY - h * 0.65;
        this.cameras.main.scrollY += (targetScrollY - this.cameras.main.scrollY) * Math.min(1, 8 * dt);

        this.updateBackdrop();

        // Mantener plataformas generadas por delante
        while (this.lastPlatformRightX < this.player.x + 900) {
            this.spawnNextPlatform();
        }

        // Puntos al pasar el centro de cada plataforma
        while (this.scoreQueue.length && this.player.x > this.scoreQueue[0]) {
            this.scoreQueue.shift();
            this.passed++;
            this.checkLevel();
            this.score += this.pointsPerPlatform;
            this.scoreText.setText(this.score);
        }

        // Limpiar plataformas que quedaron atrás
        const leftEdge = this.cameras.main.scrollX - 200;
        this.platforms.getChildren().slice().forEach((p) => {
            if (p.x + p.displayWidth / 2 < leftEdge) {
                if (p.spike) p.spike.destroy();
                p.destroy();
            }
        });

        // Rocas que caen
        this.updateRocks(time, dt);
        if (this.gameOver) return;
        this.updateSpikes();
        if (this.gameOver) return;

        // Muerte por caída al vacío
        if (this.player.y > this.cameras.main.scrollY + h + 50) {
            this.die();
        }
    }

    // === NIVELES: cada N plataformas sube la dificultad ===
    checkLevel() {
        const every = parseInt(new URLSearchParams(window.location.search).get('every'), 10);
        const LEVEL_EVERY = every > 0 ? every : 15;
        const MAX_LEVEL = 5;
        const lvl = Math.min(Math.floor(this.passed / LEVEL_EVERY), MAX_LEVEL);
        if (lvl === this.level) return;
        this.level = lvl;

        // Más velocidad, con el hueco entre plataformas escalado en la misma proporción
        const k = 1 + 0.03 * lvl;
        this.scrollSpeed = this.baseScroll * k;
        this.platformGap = Math.round(this.basePitch * k - this.platformWidth);
        this.rockEvery = Math.round(this.baseRockEvery * (1 - 0.04 * lvl));

        this.setTheme(lvl);

        const msgs = ['', '¡Más rápido!', '¡Cuidado con los picos!', '¡El meteorito se acerca!',
                      '¡Lluvia de rocas!', '¡Extinción inminente!'];
        this.showBanner(msgs[lvl]);
    }

    showBanner(text) {
        const w = this.scale.width, h = this.scale.height;
        const t = this.add.text(w / 2, h * 0.3, text, {
            fontFamily: 'monospace', fontSize: '28px', color: '#f1c40f', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
        this.tweens.add({
            targets: t, y: h * 0.3 - 30, alpha: 0, duration: 1800,
            onComplete: () => t.destroy()
        });
        SoundFX?.play?.(660, 0.1, 'triangle', 0.08);
        SoundFX?.play?.(880, 0.14, 'triangle', 0.08, 0.1);
    }

    updateSpikes() {
        const pb = this.player.body;
        const kids = this.platforms.getChildren();
        for (let i = 0; i < kids.length; i++) {
            const sp = kids[i].spike;
            if (!sp || !sp.active) continue;
            const sy = sp.y - 8;
            const cx = Phaser.Math.Clamp(sp.x, pb.x, pb.x + pb.width);
            const cy = Phaser.Math.Clamp(sy, pb.y, pb.y + pb.height);
            const dx = cx - sp.x, dy = cy - sy;
            if (dx * dx + dy * dy < 8 * 8) {
                this.die();
                return;
            }
        }
    }

    // === ROCAS QUE CAEN: aviso -> caída -> escombro ===
    spawnRock(time) {
        const cam = this.cameras.main;
        const pitch = this.platformWidth + this.platformGap;
        const leadX = this.scrollSpeed * (this.rockWarn / 1000 + 0.55) + 2 * pitch;
        const targetX = this.player.x + leadX;
        let target = null;
        this.platforms.getChildren().forEach((p) => {
            if (p.hasSpike || p.rockTarget) return;
            if (p.x >= targetX && p.y - cam.scrollY > 90 && (!target || p.x < target.x)) target = p;
        });
        if (!target) return;
        target.rockTarget = true;
        const sprite = this.add.image(target.x, cam.scrollY + 40, 'rock-warning').setDepth(15);
        this.rocks.push({ state: 'warn', x: target.x, landY: target.y - 30, fallAt: time + this.rockWarn, sprite: sprite });
    }

    updateRocks(time, dt) {
        if (this.nextRockAt === null) this.nextRockAt = time + 4000;
        if (time >= this.nextRockAt) {
            this.spawnRock(time);
            if (this.level >= 4 && Math.random() < 0.3) this.pendingRockAt = time + 900;
            this.nextRockAt = time + this.rockEvery;
        }
        if (this.pendingRockAt !== null && time >= this.pendingRockAt) {
            this.pendingRockAt = null;
            this.spawnRock(time);
        }

        const cam = this.cameras.main;
        const w = this.scale.width;
        const pb = this.player.body;

        for (let i = this.rocks.length - 1; i >= 0; i--) {
            const r = this.rocks[i];

            if (r.state === 'warn') {
                r.sprite.x = Math.min(r.x, cam.scrollX + w - 24);
                r.sprite.y = cam.scrollY + 40;
                r.sprite.setVisible(Math.floor(time / 120) % 2 === 0);
                if (time >= r.fallAt) {
                    r.sprite.destroy();
                    r.sprite = this.add.image(r.x, cam.scrollY - 30, 'falling-rock').setDepth(8);
                    r.state = 'fall';
                }
                continue;
            }

            if (r.state === 'fall') {
                r.sprite.y += this.rockSpeed * dt;
                r.sprite.rotation += 6 * dt;
                if (r.sprite.y >= r.landY) {
                    r.sprite.y = r.landY;
                    r.state = 'debris';
                    r.dieAt = time + 3000;
                    SoundFX?.play?.(120, 0.1, 'square', 0.08);
                }
            } else if (r.state === 'debris') {
                if (time >= r.dieAt || r.x < cam.scrollX - 200) {
                    r.sprite.destroy();
                    this.rocks.splice(i, 1);
                    continue;
                }
            }

            // Colisión: círculo de 10 px (menor que el dibujo) contra el cuerpo del dino
            const cx = Phaser.Math.Clamp(r.sprite.x, pb.x, pb.x + pb.width);
            const cy = Phaser.Math.Clamp(r.sprite.y, pb.y, pb.y + pb.height);
            const dx = cx - r.sprite.x, dy = cy - r.sprite.y;
            if (dx * dx + dy * dy < 10 * 10) {
                // Pisotón: solo al escombro, cayendo y con los pies por encima del centro de la roca
                const stomp = r.state === 'debris' && pb.velocity.y >= 0 && pb.bottom <= r.sprite.y + 4;
                if (stomp) {
                    this.player.body.setVelocityY(this.jumpPower * 0.55);
                    this.bonusJump = true;
                    this.player.setTint(0xf1c40f);
                    if (this.bonusTimer) this.bonusTimer.remove(false);
                    this.bonusTimer = this.time.delayedCall(1500, () => {
                        this.bonusJump = false;
                        this.player.clearTint();
                    });
                    this.score += this.pointsPerPlatform;
                    this.scoreText.setText(this.score);
                    SoundFX?.coin?.();
                    const spr = r.sprite;
                    this.tweens.add({
                        targets: spr, alpha: 0, scale: 1.6, duration: 150,
                        onComplete: () => spr.destroy()
                    });
                    this.rocks.splice(i, 1);
                    continue;
                }
                this.die();
                return;
            }
        }
    }

    async die() {
        if (this.gameOver) return;
        this.gameOver = true;
        this.player.body.setVelocityY(0);
        SoundFX?.death?.();

        try { await enviarPuntuacion(this.alias, this.score); }
        catch(e) { console.warn('Error guardando score:', e); }

        document.getElementById('final-score-text').textContent = this.score;
        document.getElementById('over-alias').textContent = this.alias;

        try {
            const top3 = await obtenerTop3();
            window.renderTop3('top3-list', top3);
        } catch(e) {}

        try {
            const pos = await obtenerPosicion(this.alias, this.score);
            document.getElementById('position-line').innerHTML = `Puesto: <strong>#${pos}</strong>`;
        } catch(e) {}

        window.onGameOver?.(this.alias, this.score);

        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('game-over-screen').style.display = 'flex';
    }
}

// Sonidos (reutilizados del runner)
const SoundFX = {
    _ctx: null,
    _getCtx() { if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)(); return this._ctx; },
    play(freq, dur, type='sine', vol=0.1, delay=0) {
        try {
            const ctx = this._getCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.value = vol;
            osc.connect(gain); gain.connect(ctx.destination);
            const now = ctx.currentTime + delay;
            osc.start(now); osc.stop(now + dur);
        } catch(e) {}
    },
    coin() { this.play(880, 0.08, 'square', 0.08); },
    death() { this.play(300, 0.15, 'sawtooth', 0.12); this.play(200, 0.2, 'sawtooth', 0.12, 0.15); }
};

// Iniciar juego
window.startGame = (alias) => {
    try { localStorage.setItem('dino_alias', alias); } catch(e) {}
    const config = {
        type: Phaser.AUTO,
        parent: 'game-canvas',
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
        backgroundColor: '#1a1a2e',
        physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
        scene: new DinoMountain(alias)
    };
    return new Phaser.Game(config);
};

// adBreak al morir
window.onGameOver = (alias, score) => {
    let shown = false;
    const show = () => { if (shown) return; shown = true; };
    const timeout = setTimeout(() => { console.warn('[ADS] timeout, forzando'); show(); }, 1500);
    if (typeof adBreak === 'function') {
        adBreak({
            type: 'next', name: 'mountain_game_over',
            beforeAd: () => { clearTimeout(timeout); },
            afterAd: () => { clearTimeout(timeout); show(); },
            adBreakDone: () => { clearTimeout(timeout); show(); }
        });
    } else { clearTimeout(timeout); }
};
