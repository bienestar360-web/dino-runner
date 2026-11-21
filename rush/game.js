// Dino Dodge — Lluvia de meteoritos: el dino esquiva a izquierda y derecha
// Tipos de caida (r y off centran el circulo de colision en cada textura; fire = probabilidad de quedarse ardiendo)
const DODGE_TYPES = {
    rock:     { key: 'dodge-meteor-slow', mult: 1.0,  r: 22, off: 8, spin: 40,  fire: 0.45 },
    fragment: { key: 'dodge-meteor',      mult: 1.35, r: 12, off: 8, spin: 120, fire: 0.20 },
    ember:    { key: 'dodge-meteor-fast', mult: 1.9,  r: 9,  off: 7, spin: 0,   fire: 0 }
};

class DinoDodge extends Phaser.Scene {
    constructor(alias) { super('DinoDodge'); this.alias = alias || 'Jugador_0000'; }

    makeTexture(key, drawFn, w, h) {
        const g = this.add.graphics();
        drawFn(g);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    init() {
        this.mode = new URLSearchParams(window.location.search).get('mode') || 'normal';
        const MODES = {
            normal:  { fall: 260, spawn: 1100, minSpawn: 420, points: 1 },
            leyenda: { fall: 340, spawn: 800,  minSpawn: 300, points: 2 },
            lento:   { fall: 200, spawn: 1400, minSpawn: 600, points: 1 }
        };
        const cfg = MODES[this.mode] || MODES.normal;
        this.score = 0;
        this.gameOver = false;
        this.baseFall = cfg.fall;
        this.fallSpeed = cfg.fall;
        this.spawnEvery = cfg.spawn;
        this.minSpawn = cfg.minSpawn;
        this.points = cfg.points;
        this.moveSpeed = 380;
        this.spawnAcc = 0;
        this.elapsed = 0;
        this.targetX = null;
        console.log('[DODGE] Modo:', this.mode, cfg);
    }

    preload() {
        // Texturas provisionales (el arte final se pinta despues con las mismas claves)
        this.makeTexture('dodge-dino', (g) => {
            g.fillStyle(0x27ae60, 1);
            g.fillRect(6, 14, 24, 18);
            g.fillRect(24, 4, 14, 12);
            g.fillRect(8, 32, 6, 8);
            g.fillRect(20, 32, 6, 8);
            g.fillStyle(0xffffff, 1);
            g.fillRect(31, 7, 4, 4);
        }, 40, 40);
        this.makeTexture('dodge-meteor', (g) => {
            g.fillStyle(0xff6a00, 0.5); g.fillCircle(20, 20, 20);
            g.fillStyle(0x4a3a3a, 1); g.fillCircle(20, 20, 14);
            g.fillStyle(0x6a5a5a, 1); g.fillCircle(16, 16, 5);
        }, 40, 40);

        // Meteorito lento: grande, oscuro y con brasas
        this.makeTexture('dodge-meteor-slow', (g) => {
            g.fillStyle(0xaa2200, 0.35); g.fillCircle(30, 30, 30);
            g.fillStyle(0x2e2424, 1); g.fillCircle(30, 30, 23);
            g.fillStyle(0x4a3a3a, 1); g.fillCircle(25, 25, 8);
            g.fillStyle(0x1a1414, 1); g.fillCircle(36, 35, 6);
            g.fillStyle(0xff5a1a, 1); g.fillCircle(38, 24, 2);
        }, 60, 60);
        // Meteorito rapido: pequeno y brillante
        this.makeTexture('dodge-meteor-fast', (g) => {
            g.fillStyle(0xffc233, 0.45); g.fillCircle(16, 16, 16);
            g.fillStyle(0xff7a1a, 1); g.fillCircle(16, 16, 11);
            g.fillStyle(0xfff2b0, 1); g.fillCircle(16, 16, 6);
        }, 32, 32);
        // Fuego en el suelo (provisional)
        this.makeTexture('dodge-fire', (g) => {
            g.fillStyle(0xff4a00, 0.9); g.fillTriangle(2, 24, 10, 6, 16, 24);
            g.fillStyle(0xff8a00, 0.95); g.fillTriangle(10, 24, 18, 2, 26, 24);
            g.fillStyle(0xffc233, 1); g.fillTriangle(18, 24, 24, 10, 30, 24);
            g.fillStyle(0xfff2b0, 1); g.fillTriangle(12, 24, 17, 12, 22, 24);
        }, 32, 24);
    }

    // ---- ARTE (solo aspecto): mismas claves y tamanos que las texturas originales ----
    // Para comparar con el aspecto anterior abre la pagina con ?art=old
    paintDodgeArt() {
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
        const hex = (n) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
        const mixc = (a, b, t) => {
            const ch = (n, sh) => (n >> sh) & 255;
            const m = (sh) => Math.round(ch(a, sh) + (ch(b, sh) - ch(a, sh)) * t);
            return (m(16) << 16) | (m(8) << 8) | m(0);
        };
        const lava = (c, pts, lw) => {
            c.save();
            c.lineJoin = 'round'; c.lineCap = 'round';
            c.shadowColor = 'rgba(255,90,20,0.9)'; c.shadowBlur = 6;
            c.beginPath();
            pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
            c.strokeStyle = '#ff7a24'; c.lineWidth = lw; c.stroke();
            c.restore();
            c.lineJoin = 'round'; c.lineCap = 'round';
            c.beginPath();
            pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
            c.strokeStyle = '#ffd37a'; c.lineWidth = lw * 0.4; c.stroke();
        };

        // ---------- DINO (el del runner y Mountain) 40x40, pose base y pose de carrera ----------
        const dinoFrame = (pose) => (c) => {
            const OUT = 'rgba(10,45,25,0.85)';
            c.lineJoin = 'round';
            c.lineCap = 'round';
            const P = {
                a: { near: [[14, 28], [18, 33], [21, 37.8], [24.5, 37.8]], far: [[22, 28], [21, 32], [17, 34.5], [19.5, 34.5]], tail: 16 },
                b: { near: [[14, 28], [12.5, 32], [9, 34.5], [11.5, 34.5]], far: [[22, 28], [25, 33], [27, 37.8], [30.5, 37.8]], tail: 21 }
            }[pose];
            const leg = (pts, col) => {
                c.beginPath();
                pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
                c.strokeStyle = OUT; c.lineWidth = 5.4; c.stroke();
                c.strokeStyle = col; c.lineWidth = 3.8; c.stroke();
            };
            leg(P.far, '#1b7a45');
            poly(c, [[9, 17], [0.8, P.tail], [9, 27]]);
            c.fillStyle = lin(c, 0, 14, 9, 27, [[0, '#4fe08a'], [1, '#17703f']]);
            c.fill();
            c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
            [12, 17, 22].forEach((x) => {
                poly(c, [[x - 3, 16], [x, 10.5], [x + 3, 16]]);
                c.fillStyle = '#17703f'; c.fill();
                poly(c, [[x - 3, 16], [x, 10.5], [x, 16]]);
                c.fillStyle = '#2fae66'; c.fill();
            });
            leg(P.near, '#2fae66');
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
            line(c, 23, 21.5, 26.5, 24.5, '#1f8a4d', 2.4);
            rr(c, 32.5, 9, 7.5, 7, 2.5);
            c.fillStyle = lin(c, 0, 9, 0, 16, [[0, '#3fd17c'], [1, '#1f8a4d']]);
            c.fill();
            c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
            c.beginPath(); c.arc(28, 12, 7.5, 0, TAU);
            c.fillStyle = rad(c, 25, 8.5, 1, 28, 12, 10, [[0, '#7bf0a6'], [0.45, '#2fbf6b'], [1, '#17703f']]);
            c.fill();
            c.beginPath(); c.arc(28, 12, 7.5, Math.PI * 0.62, Math.PI * 1.7);
            c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
            dot(c, 31.2, 9.2, 3, '#ffffff');
            dot(c, 32.2, 9.6, 1.6, '#0b1a12');
            dot(c, 31.7, 8.9, 0.55, '#ffffff');
            line(c, 28.5, 6, 33.5, 7, 'rgba(10,60,30,0.7)', 1.1);
            dot(c, 38.3, 11, 0.7, 'rgba(0,40,20,0.7)');
            line(c, 34, 14.2, 39.2, 14.2, 'rgba(0,40,20,0.55)', 0.9);
        };
        mk('dodge-dino', 40, 40, dinoFrame('a'));
        mk('dodge-dino-run2', 40, 40, dinoFrame('b'));

        // ---------- CIELO DE CENIZA (se estira a toda la pantalla) ----------
        mk('dodge-sky', 4, 256, (c) => {
            c.fillStyle = lin(c, 0, 0, 0, 256, [[0, '#0e0a1f'], [0.5, '#2a1636'], [0.8, '#6b2432'], [1, '#b04a2a']]);
            c.fillRect(0, 0, 4, 256);
        });

        // ---------- CORDILLERAS DEL VALLE 512x160 (senos de periodo entero: el mosaico encaja) ----------
        const ridge = (key, color, base, a1, k1, p1, a2, k2, p2) => mk(key, 512, 300, (c) => {
            const W = 512, H = 300;
            const yAt = (x) => base - a1 * Math.sin((TAU * k1 * x) / W + p1) - a2 * Math.sin((TAU * k2 * x) / W + p2);
            c.beginPath(); c.moveTo(0, H);
            for (let x = 0; x <= W; x += 4) c.lineTo(x, yAt(x));
            c.lineTo(W, H); c.closePath();
            c.fillStyle = lin(c, 0, base - a1 - a2, 0, H, [[0, hex(color)], [1, hex(mixc(color, 0x9a4030, 0.65))]]);
            c.fill();
            c.beginPath();
            for (let x = 0; x <= W; x += 4) { if (x === 0) c.moveTo(x, yAt(x)); else c.lineTo(x, yAt(x)); }
            c.strokeStyle = 'rgba(255,170,120,0.35)'; c.lineWidth = 2; c.stroke();
        });
        ridge('dodge-ridge-far', 0x5a2a5a, 170, 45, 2, 0.6, 14, 5, 1.9);
        ridge('dodge-ridge-near', 0x2c1636, 235, 32, 3, 2.4, 10, 7, 0.4);

        // ---------- VOLCAN EN ERUPCION 400x520 (el cono, la lava, el crater y la columna de humo) ----------
        mk('dodge-volcano', 400, 520, (c) => {
            c.lineJoin = 'round'; c.lineCap = 'round';
            c.beginPath();
            c.moveTo(0, 520);
            c.bezierCurveTo(70, 500, 140, 380, 168, 206);
            c.lineTo(232, 206);
            c.bezierCurveTo(262, 380, 330, 500, 400, 520);
            c.closePath();
            c.fillStyle = lin(c, 0, 206, 0, 520, [[0, '#6b3a52'], [0.4, '#432839'], [1, '#2a1824']]);
            c.fill();
            c.strokeStyle = 'rgba(255,150,90,0.35)'; c.lineWidth = 2; c.stroke();
            [
                [[190, 208], [184, 260], [192, 320], [178, 400], [184, 480]],
                [[212, 208], [220, 270], [210, 340], [226, 420]],
                [[200, 210], [203, 250], [198, 300]],
                [[176, 214], [150, 290], [138, 360]]
            ].forEach((pts) => lava(c, pts, 2.6));
            c.beginPath(); c.ellipse(200, 206, 34, 9, 0, 0, TAU);
            c.fillStyle = lin(c, 0, 197, 0, 215, [[0, '#ffd37a'], [1, '#ff6a1a']]);
            c.fill();
            c.fillStyle = rad(c, 200, 200, 4, 200, 200, 130, [[0, 'rgba(255,170,80,0.65)'], [1, 'rgba(255,90,30,0)']]);
            c.fillRect(0, 70, 400, 260);
            const puffs = [[200, 178, 24], [205, 152, 30], [214, 124, 35], [226, 94, 40], [240, 64, 44], [254, 40, 42]];
            puffs.forEach((p, i) => {
                const t = i / (puffs.length - 1);
                const rr0 = Math.round(150 - 90 * t), gg0 = Math.round(72 - 30 * t), bb0 = Math.round(46 + 10 * t);
                c.fillStyle = rad(c, p[0] - 6, p[1] - 6, 2, p[0], p[1], p[2],
                    [[0, 'rgba(' + rr0 + ',' + gg0 + ',' + bb0 + ',0.95)'], [1, 'rgba(48,30,42,0)']]);
                c.beginPath(); c.arc(p[0], p[1], p[2], 0, TAU); c.fill();
            });
        });
        // Resplandor del crater (se dibuja en modo aditivo y late)
        mk('dodge-vglow', 256, 256, (c) => {
            c.fillStyle = rad(c, 128, 128, 4, 128, 128, 128,
                [[0, 'rgba(255,200,110,0.9)'], [0.35, 'rgba(255,120,40,0.45)'], [1, 'rgba(255,80,20,0)']]);
            c.fillRect(0, 0, 256, 256);
        });
        // Chispa minuscula (adorno lejano que sale del crater)
        mk('dodge-spark', 12, 12, (c) => {
            c.fillStyle = rad(c, 6, 6, 0.5, 6, 6, 6,
                [[0, 'rgba(255,240,180,1)'], [0.5, 'rgba(255,140,50,0.8)'], [1, 'rgba(255,80,20,0)']]);
            c.fillRect(0, 0, 12, 12);
        });

        // ---------- NUBE DE CENIZA 320x140 ----------
        mk('dodge-ash', 320, 140, (c) => {
            const blob = (x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); };
            const shapes = [[80, 92, 62, 24], [160, 84, 84, 34], [240, 92, 62, 24],
                            [120, 66, 52, 22], [200, 64, 58, 24], [160, 100, 100, 18]];
            c.fillStyle = 'rgba(110,64,76,0.22)';
            shapes.forEach((q) => blob(q[0], q[1], q[2] + 10, q[3] + 8));
            c.fillStyle = lin(c, 0, 40, 0, 125, [[0, '#6a5470'], [1, '#2c1e36']]);
            shapes.forEach((q) => blob(q[0], q[1], q[2], q[3]));
            blob(296, 78, 12, 6); blob(312, 92, 7, 4); blob(284, 99, 9, 5);
            c.globalCompositeOperation = 'destination-out';
            c.fillStyle = '#000';
            [[60, 108, 16, 2.5], [172, 112, 20, 3], [236, 82, 13, 2.5], [126, 52, 11, 2], [270, 104, 12, 2.5]]
                .forEach((k) => { c.beginPath(); c.ellipse(k[0], k[1], k[2], k[3], 0, 0, TAU); c.fill(); });
            c.globalCompositeOperation = 'source-atop';
            c.fillStyle = rad(c, 30, 20, 4, 30, 20, 210, [[0, 'rgba(255,150,70,0.55)'], [1, 'rgba(255,90,30,0)']]);
            c.fillRect(0, 0, 320, 140);
            c.fillStyle = lin(c, 0, 80, 0, 125, [[0, 'rgba(220,100,50,0)'], [1, 'rgba(220,100,50,0.40)']]);
            c.fillRect(0, 0, 320, 140);
            c.globalCompositeOperation = 'source-over';
        });

        // ---------- SUELO DEL VALLE 64x56 (se repite en horizontal) ----------
        mk('dodge-ground', 64, 56, (c) => {
            c.fillStyle = lin(c, 0, 0, 0, 56, [[0, '#4a3640'], [0.12, '#35252d'], [1, '#150f14']]);
            c.fillRect(0, 0, 64, 56);
            for (let i = 0; i < 30; i++) {
                const x = 1 + (i * 23) % 61, y = 8 + (i * 17) % 46, sz = 1 + (i % 2);
                c.fillStyle = i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.22)';
                c.fillRect(x, y, sz, sz);
            }
            [
                [[12, 16], [16, 22], [13, 29]],
                [[34, 14], [31, 21], [35, 28], [32, 38]],
                [[52, 18], [55, 26], [51, 34]]
            ].forEach((pts) => lava(c, pts, 1.6));
            c.fillStyle = lin(c, 0, 0, 0, 7, [[0, 'rgba(255,150,80,0.55)'], [1, 'rgba(255,90,30,0)']]);
            c.fillRect(0, 0, 64, 7);
            c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, 0, 64, 1);
        });

        // ---------- RESTOS DE LA PRESA 72x30 (lo que el dino estaba comiendo) ----------
        mk('dodge-prey', 72, 30, (c) => {
            c.lineCap = 'round'; c.lineJoin = 'round';
            c.beginPath(); c.ellipse(36, 27.5, 34, 2.6, 0, 0, TAU);
            c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
            [[9, 11], [17, 15], [25, 17], [33, 16], [41, 13]].forEach((r) => {
                c.beginPath(); c.ellipse(r[0] + 5, 26, 5, r[1], 0, Math.PI, TAU);
                c.strokeStyle = 'rgba(40,25,20,0.7)'; c.lineWidth = 4; c.stroke();
                c.strokeStyle = '#e9dcc2'; c.lineWidth = 2.4; c.stroke();
            });
            line(c, 4, 26.5, 52, 26.5, 'rgba(40,25,20,0.7)', 4);
            line(c, 4, 26.5, 52, 26.5, '#d8c9aa', 2.2);
            c.beginPath(); c.ellipse(56, 21.5, 11, 7, -0.15, 0, TAU);
            c.fillStyle = rad(c, 53, 18, 1, 56, 21.5, 12, [[0, '#e0675a'], [0.5, '#a8322a'], [1, '#5e1a18']]);
            c.fill();
            c.strokeStyle = 'rgba(40,10,10,0.8)'; c.lineWidth = 1; c.stroke();
            c.beginPath(); c.ellipse(53, 18.5, 4, 1.6, -0.3, 0, TAU);
            c.fillStyle = 'rgba(255,220,200,0.35)'; c.fill();
            line(c, 62, 16.5, 68, 11, 'rgba(40,25,20,0.7)', 4.2);
            line(c, 62, 16.5, 68, 11, '#e9dcc2', 2.8);
            dot(c, 68.4, 10.2, 2.2, '#e9dcc2');
            dot(c, 69.4, 12.4, 2, '#e9dcc2');
        });
    }

    create() {
        const w = this.scale.width, h = this.scale.height;
        this.groundH = 56;
        this.paintDodgeArt();
        this.paintDodgeMeteorArt();
        const _pd = parseInt(new URLSearchParams(window.location.search).get('pad'), 10);
        this.groundPad = _pd >= 0 ? _pd : 60; // margen inferior: en movil la pantalla visible corta el borde de abajo
        this.groundY = h - this.groundH - this.groundPad;

        // Fondo y suelo (con ?art=old, los rectangulos provisionales de antes)
        if (this.artNew) {
            this.sky = this.add.image(w / 2, h / 2, 'dodge-sky').setDisplaySize(w, h).setDepth(-20);
            const ck = Math.min(1.2, w / 700);
            // [x relativa, y relativa, escala, alpha, velocidad px/s]
            this.ashClouds = [[0.10, 0.14, 1.2, 0.80, 9], [0.45, 0.24, 0.9, 0.70, 6], [0.80, 0.12, 1.1, 0.75, 8], [0.62, 0.34, 1.3, 0.80, 11]]
                .map((k) => ({
                    img: this.add.image(w * k[0], h * k[1], 'dodge-ash').setDepth(-17).setScale(k[2] * ck).setAlpha(k[3]),
                    sp: k[4]
                }));
            this.ridges = [
                this.add.tileSprite(w / 2, this.groundY, 2560, 300, 'dodge-ridge-far').setOrigin(0.5, 1).setDepth(-15),
                this.add.tileSprite(w / 2, this.groundY, 2560, 300, 'dodge-ridge-near').setOrigin(0.5, 1).setDepth(-14)
            ];
            // Volcan en erupcion al fondo: explica la lluvia de rocas, fragmentos y brasas
            this.volcano = this.add.image(0, 0, 'dodge-volcano').setOrigin(0.5, 1).setDepth(-16);
            this.vglow = this.add.image(0, 0, 'dodge-vglow').setDepth(-15.9).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
            this.tweens.add({ targets: this.vglow, alpha: 0.9, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            this.vSparks = [0, 1, 2, 3, 4, 5].map((i) => ({
                img: this.add.image(0, 0, 'dodge-spark').setDepth(-15.5).setBlendMode(Phaser.BlendModes.ADD).setVisible(false),
                t: -i * 0.7, life: 2.4,
                vx: Phaser.Math.Between(-110, 110), vy: -Phaser.Math.Between(260, 380)
            }));
            // Cordilleras y volcan escalan con la altura de la pantalla; el crater queda siempre sobre las cordilleras
            this.layoutBackdrop = () => {
                const W = this.scale.width, Hh = this.scale.height;
                const ks = Math.max(1, Math.min(2, (Hh - this.groundH) / 330));
                this.ridges.forEach((r) => r.setPosition(W / 2, this.groundY).setScale(1, ks));
                const vs = 0.72 * (Hh - this.groundH) / 314;
                const vx = W * 0.74;
                this.volcano.setScale(vs).setPosition(vx, this.groundY);
                this.crater = { x: vx, y: this.groundY - 314 * vs, s: vs };
                this.vglow.setPosition(this.crater.x, this.crater.y).setScale(vs * 1.6);
            };
            this.layoutBackdrop();
            this.ground = this.add.tileSprite(w / 2, this.groundY + this.groundH / 2, 2560, this.groundH, 'dodge-ground').setDepth(5);
            this.groundFill = this.add.rectangle(w / 2, h, 2560, this.groundPad, 0x1a0e0a).setOrigin(0.5, 1).setDepth(5);
            this.prey = this.add.image(w / 2, this.groundY, 'dodge-prey').setOrigin(0.5, 1).setDepth(5.5);
        } else {
            this.sky = this.add.rectangle(w / 2, h / 2, w, h, 0x1a1a2e).setDepth(-20);
            this.ground = this.add.rectangle(w / 2, h - this.groundH / 2, w, this.groundH, 0x3a2a1a).setDepth(5);
        }

        // Dino: el hitbox es mas pequeno que el dibujo para que sea justo
        this.player = this.physics.add.sprite(w / 2, this.groundY, 'dodge-dino');
        this.player.setOrigin(0.5, 1).setDepth(10);
        this.player.body.setAllowGravity(false);
        this.player.body.setSize(22, 34);
        this.player.body.setOffset(9, 6);

        // Meteoritos
        this.meteors = this.physics.add.group();
        this.physics.add.overlap(this.player, this.meteors, () => this.die(), null, this);

        // Fuegos en el suelo: algunos meteoritos se quedan ardiendo un momento (tocarlos mata)
        this.fires = this.physics.add.group();
        this.physics.add.overlap(this.player, this.fires, () => this.die(), null, this);

        // Controles: flechas o A/D, y tocar/arrastrar
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.input.on('pointerdown', (p) => {
            if (this.fp) { this.tapT = this.time.now; this.tapX = p.x; this.tapMoved = false; }
            else this.targetX = p.x;
        });
        this.input.on('pointermove', (p) => {
            if (!p.isDown) return;
            if (!this.fp) { this.targetX = p.x; return; }
            if (Math.abs(p.x - this.tapX) > 12) { this.tapMoved = true; this.targetX = p.x; }
        });
        this.input.on('pointerup', () => {
            if (this.fp && !this.tapMoved && this.time.now - this.tapT < 250) this.fpJump();
        });

        this.scale.on('resize', (size) => this.onResize(size), this);

        // HUD
        this.scoreText = this.add.text(w / 2, 20, '0', {
            fontFamily: 'monospace', fontSize: '32px', color: '#ffffff', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5, 0).setDepth(20).setScrollFactor(0);

        console.log('[DODGE] Iniciado para', this.alias);
        // Vista en primera persona (con ?view=dodge se ve el Dodge original; con ?art=old, el Dodge antiguo)
        this.fp = !!this.artNew && new URLSearchParams(window.location.search).get('view') !== 'dodge';
        if (this.fp) this.fpSetup();
    }

    onResize(size) {
        const w = size.width, h = size.height;
        this.groundY = h - this.groundH - this.groundPad;
        this.sky.setPosition(w / 2, h / 2);
        if (this.artNew) this.sky.setDisplaySize(w, h); else this.sky.setSize(w, h);
        this.ground.setPosition(w / 2, this.groundY + this.groundH / 2);
        if (this.groundFill) this.groundFill.setPosition(w / 2, h);
        if (!this.artNew) this.ground.setSize(w, this.groundH);
        if (this.layoutBackdrop) this.layoutBackdrop();
        if (this.prey) this.prey.setPosition(w / 2, this.groundY);
        if (this.player) {
            this.player.y = this.groundY;
            this.player.x = Phaser.Math.Clamp(this.player.x, 20, w - 20);
        }
        if (this.scoreText) this.scoreText.setX(w / 2);
    }

    // Tipos de caida: la mezcla cambia con el tiempo (mas brasas rapidas durante el primer minuto)
    meteorType() {
        const t = Math.min(1, this.elapsed / 60);
        const pEmber = 0.15 + 0.15 * t;
        const pRock = 0.45 - 0.15 * t;
        const r = Math.random();
        if (r < pEmber) return 'ember';
        if (r < pEmber + pRock) return 'rock';
        return 'fragment';
    }

    // ---- VISTA EN PRIMERA PERSONA (pseudo-3D): reutiliza el control, la dificultad y el die() de Dodge ----
    // La camara son los ojos del dino: this.player.x - w/2 es la posicion lateral de la camara.
    // Cada obstaculo tiene una distancia d (de FP.far a FP.near); q = near / d da su tamano y su altura en pantalla.
    fpSetup() {
        const spd = parseFloat(new URLSearchParams(window.location.search).get('spd'));
        this.FP = { near: 3, far: 56, speed: spd > 0 ? spd : 12, stripe: 4 };
        this.fpDist = 0;
        this.fpObs = [];
        this.camH = 0;   // altura de la camara (salto), en px del plano del jugador
        this.camV = 0;   // velocidad vertical del salto
        const _bar = parseFloat(new URLSearchParams(window.location.search).get('bar'));
        this.FP.bar = _bar >= 0 ? _bar : 10;   // segundos hasta la primera barrera
        // Barrera baja 200x44: tronco calcinado con grietas de lava (se salta o se rodea)
        if (this.textures.exists('rush-barrier')) this.textures.remove('rush-barrier');
        const bt = this.textures.createCanvas('rush-barrier', 200, 44);
        if (bt) {
            const c = bt.getContext();
            const rrB = (x, y, w, h, r) => {
                c.beginPath(); c.moveTo(x + r, y);
                c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
                c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
            };
            const bg = c.createLinearGradient(0, 6, 0, 42);
            bg.addColorStop(0, '#5a3a22'); bg.addColorStop(0.45, '#33201a'); bg.addColorStop(1, '#140a08');
            rrB(4, 6, 192, 36, 12); c.fillStyle = bg; c.fill();
            const lg = c.createLinearGradient(0, 24, 0, 44);
            lg.addColorStop(0, 'rgba(255,110,30,0)'); lg.addColorStop(1, 'rgba(255,110,30,0.55)');
            rrB(4, 6, 192, 36, 12); c.fillStyle = lg; c.fill();
            rrB(4, 6, 192, 36, 12); c.strokeStyle = 'rgba(10,5,4,0.8)'; c.lineWidth = 2; c.stroke();
            c.strokeStyle = 'rgba(255,150,50,0.9)'; c.lineWidth = 2; c.lineCap = 'round';
            [[30, 14, 44, 24, 36, 34], [84, 10, 96, 22, 90, 36], [140, 14, 152, 26, 146, 36], [176, 12, 168, 24, 172, 34]]
                .forEach((s) => { c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); c.lineTo(s[4], s[5]); c.stroke(); });
            c.strokeStyle = 'rgba(255,220,170,0.35)'; c.lineWidth = 1.5;
            c.beginPath(); c.moveTo(16, 9); c.lineTo(184, 9); c.stroke();
            bt.refresh();
        }
        // Lo que en Dodge era dino, suelo y presa se oculta: se mira desde los ojos del dino
        [this.player, this.ground, this.groundFill, this.prey].forEach((o) => { if (o) o.setVisible(false); });
        this.fpGfx = this.add.graphics().setDepth(5);
        // El horizonte baja la cordillera y el volcan a una linea mas alta; onResize vuelve a llamar a esta funcion
        this.layoutBackdrop = () => {
            const W = this.scale.width, Hh = this.scale.height;
            const yb0 = Hh - this.groundPad;
            const _cr = parseFloat(new URLSearchParams(window.location.search).get('cam'));
            const hy0 = Hh * 0.42;
            // Pantallas altas y estrechas (movil vertical): el camino no puede ser mas profundo que _cr veces su semiancho,
            // asi la camara queda mas baja. En pantallas anchas hy = hy0 y no cambia nada.
            const hy = Math.max(hy0, yb0 - (_cr > 0 ? _cr : 1.5) * (W / 2 - 20));
            this.fpHy = hy;
            const ks = Math.max(0.5, Math.min(1.3, hy0 / 300 * 0.55));
            this.ridges.forEach((r) => r.setPosition(W / 2, hy).setScale(1, ks));
            const vs = 0.62 * hy0 / 314;
            this.fpVx = W * 0.7;
            this.volcano.setScale(vs).setPosition(this.fpVx, hy);
            this.crater = { x: this.fpVx, y: hy - 314 * vs, s: vs };
            this.vglow.setPosition(this.crater.x, this.crater.y).setScale(vs * 1.6);
        };
        this.layoutBackdrop();
    }

    fpJump() {
        if (this.gameOver || !this.fp || this.camH > 0 || this.camV > 0) return;
        this.camV = 540 * Phaser.Math.Clamp(this.scale.width / 700, 0.55, 2);
        try { SoundFX.play(520, 0.12, 'sine', 0.06); } catch (e) {}
    }

    fpSpawn() {
        const w = this.scale.width;
        const rw = w / 2 - 20;
        const lat = this.player.x - w / 2;
        // Barrera baja (se salta o se rodea): aparece pasados FP.bar segundos y cada vez mas
        if (this.elapsed > this.FP.bar && Math.random() < Math.min(0.28, 0.10 + (this.elapsed - this.FP.bar) / 300)) {
            const half = rw * Phaser.Math.FloatBetween(0.18, 0.32);
            const bx = Phaser.Math.Clamp(lat + Phaser.Math.Between(-120, 120), -rw + half, rw - half);
            const bimg = this.add.image(0, 0, 'rush-barrier').setOrigin(0.5, 1).setVisible(false);
            this.fpObs.push({ img: bimg, type: 'barrier', T: { mult: 1.0, r: 0 }, X: bx, d: this.FP.far, half: half, low: true });
            return;
        }
        const type = this.meteorType();
        const T = DODGE_TYPES[type];
        const near = Math.random() < 0.6;
        const X = near
            ? Phaser.Math.Clamp(lat + Phaser.Math.Between(-140, 140), -rw, rw)
            : Phaser.Math.Between(-rw, rw);
        const img = this.add.image(0, 0, T.key)
            .setOrigin(0.5, (2 * T.r + T.off) / (2 * (T.r + T.off)))
            .setVisible(false);
        this.fpObs.push({ img: img, type: type, T: T, X: X, d: this.FP.far });
    }

    fpUpdate(dt) {
        const w = this.scale.width, h = this.scale.height;
        const F = this.FP, hy = this.fpHy, cx = w / 2;
        const rw = w / 2 - 20;
        const yb = h - this.groundPad;            // altura del plano del jugador (por encima del recorte del movil)
        const lat = this.player.x - cx;           // posicion lateral de la camara
        const sNear = w * 0.0042;                 // escala del dibujo en el plano del jugador
        const pHalf = w * 0.035;                  // mitad del ancho del jugador
        const v = F.speed * (this.fallSpeed / 260);
        this.fpDist += v * dt;
        // Salto: la camara sube (camH) y todo baja en pantalla; se escala con el ancho para que se sienta igual en movil y escritorio
        const kj = Phaser.Math.Clamp(w / 700, 0.55, 2);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.cursors.space)) this.fpJump();
        if (this.camH > 0 || this.camV > 0) {
            this.camV -= 1700 * kj * dt;
            this.camH += this.camV * dt;
            if (this.camH <= 0) { this.camH = 0; this.camV = 0; }
        }
        const yOf = (q) => hy + (yb - hy + this.camH) * q;

        // Paralaje: al moverte de lado, lo lejano casi no se mueve
        this.ridges[0].tilePositionX = lat * 0.04;
        this.ridges[1].tilePositionX = lat * 0.08;
        const vx = this.fpVx - lat * 0.06;
        this.volcano.x = vx; this.vglow.x = vx; this.crater.x = vx;

        const g = this.fpGfx;
        g.clear();
        const quad = (x1, y1, x2, y2, x3, y3, x4, y4) => {
            g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.lineTo(x4, y4); g.closePath(); g.fillPath();
        };
        // Basalto a los lados del camino
        g.fillStyle(0x24140f, 1);
        g.fillRect(0, hy, w, h - hy);
        // Franjas del camino que vienen hacia ti (alternan de color; el desplazamiento da la sensacion de velocidad)
        const L = F.stripe, dmin = F.near * 0.4;
        const base = Math.floor(this.fpDist / L);
        const off = this.fpDist - base * L;
        for (let k = -2; k * L < F.far; k++) {
            let d1 = F.near + k * L - off;
            let d2 = d1 + L;
            d1 = Math.max(dmin, d1);
            if (d2 <= dmin || d1 >= F.far) continue;
            d2 = Math.min(F.far, d2);
            const q1 = F.near / d1, q2 = F.near / d2;
            const y1 = yOf(q1), y2 = yOf(q2);
            const h1 = rw * q1, h2 = rw * q2;
            const c1 = cx - lat * q1, c2 = cx - lat * q2;
            const odd = ((base + k) & 1) === 1;
            g.fillStyle(odd ? 0x3d2a1b : 0x46301f, 1);
            quad(c1 - h1, y1, c1 + h1, y1, c2 + h2, y2, c2 - h2, y2);
            const e1 = rw * 0.05 * q1, e2 = rw * 0.05 * q2;
            g.fillStyle(odd ? 0xc0502a : 0x5a2214, 1);
            quad(c1 - h1 - e1, y1, c1 - h1 + e1, y1, c2 - h2 + e2, y2, c2 - h2 - e2, y2);
            quad(c1 + h1 - e1, y1, c1 + h1 + e1, y1, c2 + h2 + e2, y2, c2 + h2 - e2, y2);
        }

        // Obstaculos: se acercan; al llegar a tu plano, o te alcanzan o los esquivaste
        for (let i = this.fpObs.length - 1; i >= 0; i--) {
            const o = this.fpObs[i];
            const T = o.T;
            o.d -= v * T.mult * dt;
            if (o.d <= F.near) {
                if (o.low) {
                    if (Math.abs(o.X - lat) < o.half + pHalf && this.camH < 42 * kj) { this.die(); return; }
                } else {
                    const hit = T.r * sNear * 0.9 + pHalf;
                    if (Math.abs(o.X - lat) < hit) { this.die(); return; }
                }
                this.score += this.points;
                this.scoreText.setText(this.score);
                SoundFX.impact(o.low ? 'fragment' : o.type, Phaser.Math.Clamp((o.X - lat) / rw, -1, 1));
                o.img.destroy();
                this.fpObs.splice(i, 1);
                continue;
            }
            const q = F.near / o.d;
            const x = cx + (o.X - lat) * q;
            const yg = yOf(q);
            if (o.low) {
                g.fillStyle(0x000000, 0.35);
                g.fillEllipse(x, yg, o.half * 2 * q, o.half * 0.25 * q);
                o.img.setVisible(true).setScale(o.half * 2 * q / 200, 42 * kj * q / 44).setPosition(x, yg).setDepth(8 + q);
                continue;
            }
            g.fillStyle(0x000000, 0.35);
            g.fillEllipse(x, yg, T.r * sNear * q * 2.2, T.r * sNear * q * 0.7);
            o.img.setVisible(true).setScale(sNear * q).setPosition(x, yg).setDepth(8 + q);
        }
    }

    spawnMeteor() {
        if (this.fp) { this.fpSpawn(); return; }
        const w = this.scale.width;
        const type = this.meteorType();
        const T = DODGE_TYPES[type];
        const near = Math.random() < 0.6;
        const x = near
            ? Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(-140, 140), 30, w - 30)
            : Phaser.Math.Between(30, w - 30);
        // Se crea desde el grupo: anadir un sprite ya configurado reiniciaria su velocidad
        const m = this.meteors.create(x, -40, T.key);
        m.setDepth(8);
        m.setData('type', type);
        m.setData('r', T.r);
        m.body.setAllowGravity(false);
        m.body.setCircle(T.r, T.off, T.off);
        m.setVelocityY(Math.min(720, this.fallSpeed * T.mult * Phaser.Math.FloatBetween(0.95, 1.1)));
        m.setAngularVelocity(T.spin ? Phaser.Math.Between(-T.spin, T.spin) : 0);
        if (this.artNew) {
            // Cola de fuego que acompana la caida (no gira con el meteorito)
            const TS = { rock: [1.5, 1.1], fragment: [0.9, 0.8], ember: [0.6, 1.3] }[type] || [1, 1];
            const tail = this.add.image(m.x, m.y, 'dodge-tail').setOrigin(0.5, 1).setDepth(7.5)
                .setBlendMode(Phaser.BlendModes.ADD).setScale(TS[0], TS[1]).setAlpha(type === 'rock' ? 0.8 : 0.9);
            m.setData('tail', tail);
            m.once('destroy', () => tail.destroy());
        }
    }

    // Al tocar el suelo: suena (en el lado donde cae) y a veces se queda ardiendo
    onImpact(m) {
        const type = m.getData('type') || 'fragment';
        const T = DODGE_TYPES[type];
        SoundFX.impact(type, (m.x / this.scale.width) * 2 - 1);
        this.impactFx(type, m.x);
        if (T.fire && Math.random() < T.fire) this.spawnFire(m.x);
    }

    // ---- ARTE DE LA CAIDA (solo aspecto): mismas claves y tamanos que las texturas originales ----
    paintDodgeMeteorArt() {
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
        const poly = (c, pts) => {
            c.beginPath();
            pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
            c.closePath();
        };
        // contorno irregular: un radio por vertice
        const blob = (c, cx, cy, radii, rot) => {
            const n = radii.length;
            c.beginPath();
            radii.forEach((r, i) => {
                const a = rot + (TAU * i) / n;
                const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
                if (i) c.lineTo(x, y); else c.moveTo(x, y);
            });
            c.closePath();
        };
        const vein = (c, pts, lw) => {
            c.save();
            c.lineJoin = 'round'; c.lineCap = 'round';
            c.shadowColor = 'rgba(255,90,20,0.9)'; c.shadowBlur = 5;
            c.beginPath();
            pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
            c.strokeStyle = '#ff7a24'; c.lineWidth = lw; c.stroke();
            c.restore();
            c.lineJoin = 'round'; c.lineCap = 'round';
            c.beginPath();
            pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
            c.strokeStyle = '#ffd37a'; c.lineWidth = lw * 0.4; c.stroke();
        };

        // ROCA 60x60: grande, oscura, con vetas de brasa y la parte baja al rojo vivo
        mk('dodge-meteor-slow', 60, 60, (c) => {
            c.fillStyle = rad(c, 30, 30, 8, 30, 30, 30, [[0, 'rgba(255,110,30,0.45)'], [1, 'rgba(255,70,20,0)']]);
            c.fillRect(0, 0, 60, 60);
            const R = [22, 19, 23, 20, 23, 18, 22, 21, 19, 23, 20, 22];
            blob(c, 30, 30, R, 0.2);
            c.fillStyle = rad(c, 23, 21, 2, 30, 30, 27, [[0, '#7a6062'], [0.5, '#3b2c2f'], [1, '#150e10']]);
            c.fill();
            c.strokeStyle = 'rgba(10,5,6,0.9)'; c.lineWidth = 1.2; c.stroke();
            vein(c, [[17, 26], [23, 31], [21, 38], [28, 43]], 1.7);
            vein(c, [[37, 18], [35, 26], [42, 31]], 1.5);
            vein(c, [[30, 47], [35, 41], [43, 44]], 1.3);
            c.save();
            blob(c, 30, 30, R, 0.2); c.clip();
            c.fillStyle = rad(c, 30, 54, 2, 30, 54, 26, [[0, 'rgba(255,140,50,0.65)'], [1, 'rgba(255,100,30,0)']]);
            c.fillRect(0, 0, 60, 60);
            c.restore();
            c.beginPath(); c.arc(30, 30, 20, Math.PI * 1.05, Math.PI * 1.55);
            c.strokeStyle = 'rgba(255,190,130,0.45)'; c.lineWidth = 1.6; c.stroke();
        });

        // FRAGMENTO 40x40: resto incandescente, mas ligero y claro
        mk('dodge-meteor', 40, 40, (c) => {
            c.fillStyle = rad(c, 20, 20, 5, 20, 20, 20, [[0, 'rgba(255,170,60,0.55)'], [1, 'rgba(255,90,20,0)']]);
            c.fillRect(0, 0, 40, 40);
            const R = [14, 12, 15, 13, 14, 11, 15, 13];
            blob(c, 20, 20, R, 0.5);
            c.fillStyle = rad(c, 17, 16, 1, 20, 20, 16, [[0, '#ffe7b0'], [0.4, '#f08a2a'], [1, '#6a2410']]);
            c.fill();
            c.strokeStyle = 'rgba(70,20,8,0.85)'; c.lineWidth = 1; c.stroke();
            vein(c, [[13, 22], [19, 20], [25, 25]], 1.2);
            c.beginPath(); c.arc(16, 15, 3, 0, TAU);
            c.fillStyle = 'rgba(255,250,220,0.55)'; c.fill();
        });

        // BRASA 32x32: pequena, casi blanca en el centro
        mk('dodge-meteor-fast', 32, 32, (c) => {
            c.fillStyle = rad(c, 16, 16, 3, 16, 16, 16, [[0, 'rgba(255,220,110,0.65)'], [1, 'rgba(255,120,30,0)']]);
            c.fillRect(0, 0, 32, 32);
            c.beginPath(); c.arc(16, 16, 10, 0, TAU);
            c.fillStyle = rad(c, 16, 16, 1, 16, 16, 10, [[0, '#fffbe6'], [0.45, '#ffc23a'], [1, '#ff5a14']]);
            c.fill();
        });

        // COLA DE FUEGO 32x96 (el extremo brillante abajo, pegado al meteorito)
        mk('dodge-tail', 32, 96, (c) => {
            poly(c, [[1, 96], [16, 0], [31, 96]]);
            c.fillStyle = lin(c, 0, 96, 0, 0, [[0, 'rgba(255,200,100,0.9)'], [0.35, 'rgba(255,110,35,0.55)'], [1, 'rgba(255,60,10,0)']]);
            c.fill();
            poly(c, [[9, 96], [16, 26], [23, 96]]);
            c.fillStyle = lin(c, 0, 96, 0, 26, [[0, 'rgba(255,245,200,0.85)'], [1, 'rgba(255,200,100,0)']]);
            c.fill();
        });

        // LLAMA DEL SUELO 32x24 (el hitbox 22x14 queda en su parte baja)
        mk('dodge-fire', 32, 24, (c) => {
            c.fillStyle = rad(c, 16, 23, 2, 16, 23, 15, [[0, 'rgba(255,130,40,0.55)'], [1, 'rgba(255,80,20,0)']]);
            c.fillRect(0, 6, 32, 18);
            const flame = (d, tipY, c0, c1) => {
                c.beginPath();
                c.moveTo(d[0], 24);
                c.quadraticCurveTo(d[1], d[2], d[3], d[4]);
                c.quadraticCurveTo(d[5], d[6], d[7], 24);
                c.closePath();
                c.fillStyle = lin(c, 0, 24, 0, tipY, [[0, c0], [1, c1]]);
                c.fill();
            };
            flame([3, 1, 14, 7, 8, 10, 16, 13], 8, '#ffb030', '#ff4a00');
            flame([19, 20, 16, 25, 10, 31, 16, 29], 10, '#ffb030', '#ff4a00');
            flame([8, 6, 12, 16, 0.5, 26, 12, 25], 0.5, '#ffc23a', '#ff3a00');
            flame([12, 11, 15, 16, 6, 21, 15, 20], 6, '#fff0b0', '#ffb030');
        });

        // Chispas del impacto: un solo emisor reutilizado (si la API fallara, el juego sigue sin chispas)
        this.sparkFx = null;
        try {
            if (this.textures.exists('dodge-spark')) {
                this.sparkFx = this.add.particles(0, 0, 'dodge-spark', {
                    emitting: false,
                    speed: { min: 80, max: 260 },
                    angle: { min: 215, max: 325 },
                    gravityY: 700,
                    lifespan: { min: 280, max: 520 },
                    scale: { start: 1.1, end: 0 },
                    alpha: { start: 1, end: 0 },
                    blendMode: 'ADD'
                }).setDepth(9);
            }
        } catch (e) { this.sparkFx = null; }
    }

    // Impacto en el suelo: destello, chispas y (solo la roca) una sacudida minima
    impactFx(type, x) {
        if (!this.artNew) return;
        const gy = this.groundY;
        const P = { rock: { n: 12, fl: 0.9, sh: true }, fragment: { n: 7, fl: 0.5, sh: false }, ember: { n: 3, fl: 0.22, sh: false } }[type]
            || { n: 5, fl: 0.4, sh: false };
        const fl = this.add.image(x, gy - 4, 'dodge-vglow').setDepth(7)
            .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.85).setScale(P.fl * 0.4);
        this.tweens.add({ targets: fl, scale: P.fl, alpha: 0, duration: 220, ease: 'Quad.easeOut', onComplete: () => fl.destroy() });
        if (this.sparkFx) this.sparkFx.explode(P.n, x, gy - 6);
        if (P.sh) this.cameras.main.shake(70, 0.003);
    }

    // Fuego en el suelo: arde unos 3 s, parpadea al apagarse y mata si lo tocas
    spawnFire(x) {
        if (this.fires.countActive(true) >= 3) return;
        if (Math.abs(x - this.player.x) < 70) return;
        if (this.fires.getChildren().some((f) => Math.abs(f.x - x) < 90)) return;
        // El dino no salta: un fuego es un muro. Su zona libre debe seguir midiendo al menos 150 px
        const px = this.player.x;
        let lo = 0, hi = this.scale.width;
        this.fires.getChildren().concat([{ x: x }]).forEach((f) => {
            if (f.x < px) lo = Math.max(lo, f.x + 11);
            else hi = Math.min(hi, f.x - 11);
        });
        if (hi - lo < 150) return;
        const f = this.fires.create(x, this.groundY, 'dodge-fire');
        f.setOrigin(0.5, 1).setDepth(6).setAlpha(0.85);
        f.body.setAllowGravity(false);
        f.body.setSize(22, 14);
        f.body.setOffset(5, 10);
        const idle = this.tweens.add({ targets: f, alpha: 1, duration: 150, yoyo: true, repeat: -1 });
        this.time.delayedCall(2200, () => {
            if (!f.active) return;
            idle.stop();
            this.tweens.add({ targets: f, alpha: 0.25, duration: 90, yoyo: true, repeat: 3 });
        });
        this.time.delayedCall(2950, () => {
            if (!f.active) return;
            this.tweens.killTweensOf(f);
            f.destroy();
        });
    }

    update(time, delta) {
        if (this.gameOver) return;
        const dt = delta / 1000;
        const w = this.scale.width;
        this.elapsed += dt;

        // Movimiento del dino: teclado o toque/arrastre (por tiempo, no por fotograma)
        const left = this.cursors.left.isDown || this.keyA.isDown;
        const right = this.cursors.right.isDown || this.keyD.isDown;
        let dir = 0;
        if (left && !right) dir = -1;
        else if (right && !left) dir = 1;
        if (dir !== 0) {
            this.targetX = null;
            this.player.x += dir * this.moveSpeed * dt;
        } else if (this.targetX !== null) {
            const dx = this.targetX - this.player.x;
            const step = this.moveSpeed * dt;
            if (Math.abs(dx) <= step) { this.player.x = this.targetX; this.targetX = null; }
            else { dir = Math.sign(dx); this.player.x += dir * step; }
        }
        this.player.x = Phaser.Math.Clamp(this.player.x, 20, w - 20);
        this.moveDir = dir;

        // Aspecto del dino: patas al caminar y mira hacia donde va (el hitbox no cambia)
        if (this.artNew) {
            if (dir !== 0) this.facing = dir;
            this.player.setFlipX(this.facing < 0);
            const pk = dir !== 0 && Math.floor(this.time.now / 110) % 2 ? 'dodge-dino-run2' : 'dodge-dino';
            if (this.player.texture.key !== pk) this.player.setTexture(pk);
            // nubes de ceniza: derivan a la izquierda
            this.ashClouds.forEach((a) => {
                a.img.x -= a.sp * dt;
                const half = a.img.displayWidth / 2;
                if (a.img.x < -half) a.img.x = w + half;
            });
            // chispas que salen del crater del volcan (adorno lejano, detras de las cordilleras)
            const cr = this.crater;
            this.vSparks.forEach((q) => {
                q.t += dt;
                if (q.t < 0) { q.img.setVisible(false); return; }
                if (q.t > q.life) {
                    q.t = -Math.random() * 1.5;
                    q.vx = Phaser.Math.Between(-110, 110);
                    q.vy = -Phaser.Math.Between(260, 380);
                    q.img.setVisible(false);
                    return;
                }
                q.img.setVisible(true)
                    .setPosition(cr.x + q.vx * cr.s * q.t, cr.y + q.vy * cr.s * q.t + 0.5 * 420 * cr.s * q.t * q.t)
                    .setAlpha(0.9 * (1 - q.t / q.life))
                    .setScale(cr.s * 0.9);
            });
        }

        // Dificultad: mas rapido y mas frecuente con el tiempo (independiente de los fps)
        this.fallSpeed = Math.min(this.baseFall * 2, this.baseFall + this.elapsed * 3);
        this.spawnAcc += delta;
        if (this.spawnAcc >= this.spawnEvery) {
            this.spawnAcc = 0;
            this.spawnMeteor();
            this.spawnEvery = Math.max(this.minSpawn, this.spawnEvery * 0.985);
        }

        if (this.fp) this.fpUpdate(dt);
        // Un meteorito que llega al suelo sin tocarte cuenta como esquivado
        const gy = this.groundY;
        this.meteors.getChildren().slice().forEach((m) => {
            const tl = m.getData('tail');
            if (tl) tl.setPosition(m.x, m.y - (m.getData('r') || 12) * 0.3);
            if (m.y >= gy - (m.getData('r') || 12)) {
                this.score += this.points;
                this.scoreText.setText(this.score);
                this.onImpact(m);
                m.destroy();
            }
        });
    }

    async die() {
        if (this.gameOver) return;
        this.gameOver = true;
        this.physics.pause();
        SoundFX.death();
        this.cameras.main.shake(220, 0.012);

        // Guardar puntuacion
        try { await enviarPuntuacion(this.alias, this.score); }
        catch (e) { console.warn('Error guardando score:', e); }

        document.getElementById('final-score-text').textContent = this.score;
        document.getElementById('over-alias').textContent = this.alias;

        // Top 3 (textContent: un alias con HTML no se interpreta)
        try {
            const top3 = await obtenerTop3();
            const list = document.getElementById('top3-list');
            list.textContent = '';
            top3.forEach((r, i) => {
                const li = document.createElement('li');
                li.className = 'rank-item' + (i === 0 ? ' first' : '');
                const a = document.createElement('span');
                a.className = 'rank-alias'; a.textContent = r.alias;
                const s = document.createElement('span');
                s.className = 'rank-score'; s.textContent = r.score;
                li.appendChild(a); li.appendChild(s);
                list.appendChild(li);
            });
        } catch (e) {}

        // Posicion
        const line = document.getElementById('position-line');
        try {
            const pos = await obtenerPosicion(this.alias, this.score);
            line.textContent = 'Puesto: ';
            const st = document.createElement('strong');
            st.textContent = '#' + pos;
            line.appendChild(st);
        } catch (e) { line.textContent = ''; }

        window.onGameOver?.(this.alias, this.score);

        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('game-over-screen').style.display = 'flex';
    }
}

// Sonidos
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
    _noise(ctx) {
        if (!this._nb) {
            const len = Math.floor(ctx.sampleRate * 0.4);
            const b = ctx.createBuffer(1, len, ctx.sampleRate);
            const d = b.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
            this._nb = b;
        }
        return this._nb;
    },
    // Impacto en el suelo: cada tipo suena distinto y se oye en su lado de la pantalla (pan de -1 a 1)
    impact(type, pan) {
        try {
            const ctx = this._getCtx();
            if (ctx.state === 'suspended') ctx.resume();
            if ((this._voices || 0) >= 6) return;
            this._voices = (this._voices || 0) + 1;
            setTimeout(() => { this._voices = Math.max(0, this._voices - 1); }, 300);
            const t0 = ctx.currentTime;
            const out = ctx.createGain();
            if (ctx.createStereoPanner) {
                const p = ctx.createStereoPanner();
                p.pan.value = Math.max(-1, Math.min(1, pan || 0));
                out.connect(p); p.connect(ctx.destination);
            } else {
                out.connect(ctx.destination);
            }
            const k = 0.9 + Math.random() * 0.2;
            const burst = (dur, filterType, freq, vol) => {
                const src = ctx.createBufferSource();
                src.buffer = this._noise(ctx);
                const f = ctx.createBiquadFilter();
                f.type = filterType; f.frequency.value = freq * k;
                const g = ctx.createGain();
                g.gain.setValueAtTime(vol, t0);
                g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
                src.connect(f); f.connect(g); g.connect(out);
                src.start(t0); src.stop(t0 + dur);
            };
            const thump = (f0, f1, dur, vol, wave) => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = wave || 'sine';
                o.frequency.setValueAtTime(f0 * k, t0);
                o.frequency.exponentialRampToValueAtTime(f1 * k, t0 + dur);
                g.gain.setValueAtTime(vol, t0);
                g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
                o.connect(g); g.connect(out);
                o.start(t0); o.stop(t0 + dur);
            };
            if (type === 'rock') { thump(130, 42, 0.22, 0.28); burst(0.14, 'lowpass', 500, 0.14); }
            else if (type === 'fragment') { thump(260, 110, 0.09, 0.12, 'triangle'); burst(0.08, 'bandpass', 1800, 0.10); }
            else { burst(0.05, 'highpass', 3200, 0.07); }
        } catch (e) {}
    },
    death() { this.play(300, 0.15, 'sawtooth', 0.12); this.play(200, 0.2, 'sawtooth', 0.12, 0.15); }
};

// Iniciar juego
window.startGame = (alias) => {
    try { localStorage.setItem('dino_alias', alias); } catch(e) {}
    // El audio debe activarse dentro del toque del boton Jugar (movil)
    try { SoundFX._getCtx().resume(); } catch(e) {}
    const config = {
        type: Phaser.AUTO,
        parent: 'game-canvas',
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
        backgroundColor: '#1a1a2e',
        physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
        scene: new DinoDodge(alias)
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
            type: 'next', name: 'rush_game_over',
            beforeAd: () => { clearTimeout(timeout); },
            afterAd: () => { clearTimeout(timeout); show(); },
            adBreakDone: () => { clearTimeout(timeout); show(); }
        });
    } else { clearTimeout(timeout); }
};
