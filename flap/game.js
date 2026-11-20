// Dino Flap — Física de vuelo (gravedad + impulso)
class DinoFlap extends Phaser.Scene {
    constructor(alias) { super('DinoFlap'); this.alias = alias || 'Jugador_0000'; }

    makeTexture(key, drawFn, w, h) {
        const g = this.add.graphics();
        drawFn(g);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    init() {
        this.mode = new URLSearchParams(window.location.search).get('mode') || 'normal';
        const MODES = {
            normal:   { speed: 180, spawn: 1600, points: 1 },
            leyenda:  { speed: 280, spawn: 1200, points: 2 },
            lento:    { speed: 120, spawn: 2000, points: 1 }
        };
        const cfg = MODES[this.mode] || MODES.normal;
        this.score = 0;
        this.gameOver = false;
        this.jumpPower = -420;
        this.gravity = 1200;
        this.pipeSpeed = cfg.speed;
        this.pipeSpawnDelay = cfg.spawn;
        this.pointsPerColumn = cfg.points;
        this.nextPipeScore = 0;
        console.log('[FLAP] Modo:', this.mode, cfg);
    }

    preload() {
        // Dino simple (rectángulo verde con ojos)
        this.makeTexture('flap-ptero', (g) => {
            // Cuerpo (verde del dino)
            g.fillStyle(0x27ae60, 1);
            g.fillRect(10, 12, 24, 10);
            // Cabeza
            g.fillCircle(34, 10, 8);
            // Pico (verde del dino, sin amarillo)
            g.fillStyle(0x27ae60, 1);
            g.fillTriangle(40, 8, 50, 10, 40, 12);
            // Ala superior (verde claro para distinguir)
            g.fillStyle(0x2ecc71, 1);
            g.fillTriangle(14, 12, 4, -4, 24, 12);
            // Ala inferior (verde claro para distinguir)
            g.fillTriangle(14, 22, 4, 38, 24, 22);
            // Ojo (blanco + negro, como el dino)
            g.fillStyle(0xffffff, 1);
            g.fillCircle(36, 8, 3);
            g.fillStyle(0x000000, 1);
            g.fillCircle(37, 8, 1.5);
            // Cola (verde del dino)
            g.fillStyle(0x27ae60, 1);
            g.fillTriangle(10, 16, 0, 12, 10, 20);
        }, 52, 38);

        // Columna verde
        this.makeTexture('meteor-column', (g) => {
            // Base de fuego (naranja)
            g.fillStyle(0xe67e22, 1);
            g.fillRect(0, 0, 60, 400);
            // Vetas laterales (naranja oscuro)
            g.fillStyle(0xd35400, 1);
            g.fillRect(0, 0, 10, 400);
            g.fillRect(50, 0, 10, 400);
            // Brillo central (amarillo)
            g.fillStyle(0xf1c40f, 1);
            g.fillRect(22, 0, 16, 400);
            // Llamas irregulares
            g.fillStyle(0xff6b35, 1);
            for (let i = 0; i < 400; i += 40) {
                g.fillTriangle(0, i, 12, i + 20, 0, i + 40);
                g.fillTriangle(60, i, 48, i + 20, 60, i + 40);
            }
            // Chispas
            g.fillStyle(0xffd700, 1);
            for (let i = 30; i < 400; i += 100) {
                g.fillRect(25, i, 4, 8);
                g.fillRect(35, i + 30, 3, 6);
            }
        }, 60, 400);

        // Nube
        this.makeTexture('flap-cloud', (g) => {
            // Meteorito pequeño de fondo
            g.fillStyle(0x6a6a6a, 0.9);
            g.fillCircle(30, 20, 18);
            g.fillStyle(0x4a4a4a, 0.9);
            g.fillCircle(24, 24, 8);
            g.fillCircle(38, 16, 6);
            // Estela
            g.fillStyle(0xff6b35, 0.6);
            g.fillTriangle(48, 20, 70, 15, 70, 25);
        }, 90, 40);

        // Montaña
        this.makeTexture('flap-mountain', (g) => {
            g.fillStyle(0x34495e, 1);
            g.fillTriangle(0, 80, 40, 0, 80, 80);
        }, 80, 80);
    }

    // ---- ARTE (solo aspecto): misma clave y mismo tamano que las texturas originales ----
    // Para comparar con el aspecto anterior abre la pagina con ?art=old
    paintFlapArt() {
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
        const poly = (c, pts) => {
            c.beginPath();
            pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
            c.closePath();
        };
        const zig = (c, pts) => {
            c.beginPath();
            pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
        };
        const line = (c, x0, y0, x1, y1, col, lw) => {
            c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1);
            c.strokeStyle = col; c.lineWidth = lw; c.stroke();
        };
        const dot = (c, x, y, r, fill) => {
            c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = fill; c.fill();
        };
        const lava = (c, pts, lw) => {
            c.save();
            c.lineJoin = 'round'; c.lineCap = 'round';
            c.shadowColor = 'rgba(255,90,20,0.9)'; c.shadowBlur = 6;
            zig(c, pts); c.strokeStyle = '#ff7a24'; c.lineWidth = lw; c.stroke();
            c.restore();
            c.lineJoin = 'round'; c.lineCap = 'round';
            zig(c, pts); c.strokeStyle = '#ffd37a'; c.lineWidth = lw * 0.4; c.stroke();
        };

        // ---------- CIELO (se estira a toda la pantalla) ----------
        mk('flap-sky', 2, 256, (c) => {
            c.fillStyle = lin(c, 0, 0, 0, 256, [[0, '#0e0a1f'], [0.5, '#2a1636'], [0.8, '#6b2432'], [1, '#b04a2a']]);
            c.fillRect(0, 0, 2, 256);
        });

        // ---------- PTERODACTILO 52x38 (dos poses: alas abajo y alas arriba) ----------
        const ptero = (up) => (c) => {
            c.lineJoin = 'round';
            c.lineCap = 'round';
            const OUT = 'rgba(8,40,22,0.85)';
            const farWing = up
                ? [[27, 13], [21, 6], [13, 3], [14, 8], [19, 11], [22, 15]]
                : [[27, 16], [24, 26], [17, 33], [19, 27], [23, 22], [25, 18]];
            const nearWing = up
                ? [[25, 14.5], [17, 4.5], [6, 0.8], [4, 5], [9, 8], [12, 13], [16, 17]]
                : [[25, 14.5], [18, 25], [7, 36.5], [4, 31.5], [9, 28.5], [12, 22], [16, 17.5]];
            const wr = up ? [17, 4.5] : [18, 25];
            // ala lejana
            poly(c, farWing);
            c.fillStyle = '#17703f'; c.fill();
            // cola corta
            poly(c, [[11, 16], [2, 19.5], [3.5, 20.8], [12, 18.8]]);
            c.fillStyle = '#1b7a45'; c.fill();
            // patas
            line(c, 19, 21.5, 17, 25.5, '#17703f', 1.5);
            line(c, 24, 21.5, 23, 26, '#17703f', 1.5);
            // cuerpo
            c.beginPath(); c.ellipse(22, 17, 11.5, 5.5, 0, 0, TAU);
            c.fillStyle = lin(c, 0, 11.5, 0, 22.5, [[0, '#7bf0a6'], [0.4, '#27ae60'], [1, '#176b3a']]);
            c.fill();
            c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
            c.beginPath(); c.ellipse(22, 19.6, 7, 2.2, 0, 0, TAU);
            c.fillStyle = 'rgba(200,255,215,0.35)'; c.fill();
            // cuello
            poly(c, [[28, 13], [33, 8.5], [36.5, 10.8], [32, 17]]);
            c.fillStyle = lin(c, 28, 8, 34, 17, [[0, '#5fdc90'], [1, '#1f8a4d']]);
            c.fill();
            // cresta larga hacia atras (lo que mas delata a un pterosaurio)
            poly(c, [[34.5, 7.4], [23.5, 2.6], [26, 4.8], [33.5, 10.4]]);
            c.fillStyle = '#17703f'; c.fill();
            c.strokeStyle = OUT; c.lineWidth = 0.8; c.stroke();
            // cabeza
            c.beginPath(); c.ellipse(37, 10, 5, 3.6, -0.15, 0, TAU);
            c.fillStyle = lin(c, 33, 6, 40, 14, [[0, '#7bf0a6'], [1, '#1f8a4d']]);
            c.fill();
            c.strokeStyle = OUT; c.lineWidth = 0.9; c.stroke();
            // pico largo y fino (la mandibula inferior mas oscura)
            poly(c, [[40.5, 11], [49.5, 12], [40.5, 13]]);
            c.fillStyle = '#176b3a'; c.fill();
            poly(c, [[40, 8.4], [51.6, 11.2], [40, 11.4]]);
            c.fillStyle = lin(c, 0, 8, 0, 12, [[0, '#4fe08a'], [1, '#1f8a4d']]);
            c.fill();
            c.strokeStyle = OUT; c.lineWidth = 0.8; c.stroke();
            // ojo
            dot(c, 38.3, 9, 2, '#ffffff');
            dot(c, 39, 9.2, 1.1, '#0b1a12');
            dot(c, 38.6, 8.5, 0.45, '#ffffff');
            // ala cercana: membrana, hueso del brazo y dedos
            poly(c, nearWing);
            c.fillStyle = lin(c, 0, 0, 0, 38, [[0, '#9af5bb'], [1, '#2fae66']]);
            c.fill();
            c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
            [nearWing[3], nearWing[4], nearWing[5]].forEach((p) => line(c, wr[0], wr[1], p[0], p[1], 'rgba(10,70,40,0.55)', 0.7));
            line(c, nearWing[0][0], nearWing[0][1], wr[0], wr[1], '#0f4d2a', 1.6);
            line(c, wr[0], wr[1], nearWing[2][0], nearWing[2][1], '#0f4d2a', 1.3);
        };
        mk('flap-ptero', 52, 38, ptero(false));
        mk('flap-ptero-up', 52, 38, ptero(true));

        // ---------- COLUMNA DE METEORITO 60x400 (la misma textura arriba y abajo: boca en ambos extremos) ----------
        mk('meteor-column', 60, 400, (c) => {
            c.fillStyle = lin(c, 0, 0, 60, 0, [[0, '#1d1620'], [0.2, '#4b3b48'], [0.5, '#62505a'], [0.8, '#3a2d38'], [1, '#17111b']]);
            c.fillRect(0, 0, 60, 400);
            for (let i = 0; i < 170; i++) {
                const x = 1 + (i * 37) % 57, y = (i * 91) % 396, sz = 1 + (i % 3);
                c.fillStyle = i % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.18)';
                c.fillRect(x, y, sz, sz);
            }
            [
                [[14, 40], [17, 70], [12, 100], [16, 130], [13, 165]],
                [[44, 90], [41, 125], [46, 160], [42, 200], [45, 235]],
                [[28, 150], [31, 190], [26, 225], [30, 262], [27, 300]],
                [[15, 250], [18, 285], [13, 320], [17, 352]],
                [[46, 300], [43, 335], [47, 368]],
                [[30, 30], [27, 62], [31, 90]]
            ].forEach((pts) => lava(c, pts, 2.2));
            // bocas
            c.fillStyle = lin(c, 0, 0, 0, 26, [[0, '#0f0a12'], [1, '#3b2e3a']]);
            c.fillRect(0, 0, 60, 26);
            c.fillStyle = lin(c, 0, 400, 0, 374, [[0, '#0f0a12'], [1, '#3b2e3a']]);
            c.fillRect(0, 374, 60, 26);
            c.fillStyle = lin(c, 0, 0, 0, 7, [[0, 'rgba(255,205,120,0.95)'], [0.4, 'rgba(255,110,30,0.85)'], [1, 'rgba(255,80,20,0)']]);
            c.fillRect(0, 0, 60, 7);
            c.fillStyle = lin(c, 0, 400, 0, 393, [[0, 'rgba(255,205,120,0.95)'], [0.4, 'rgba(255,110,30,0.85)'], [1, 'rgba(255,80,20,0)']]);
            c.fillRect(0, 393, 60, 7);
            line(c, 0, 26.5, 60, 26.5, 'rgba(0,0,0,0.45)', 1.2);
            line(c, 0, 373.5, 60, 373.5, 'rgba(0,0,0,0.45)', 1.2);
            line(c, 0, 27.6, 60, 27.6, 'rgba(255,255,255,0.10)', 1);
            line(c, 0, 372.4, 60, 372.4, 'rgba(255,255,255,0.10)', 1);
            c.fillStyle = 'rgba(0,0,0,0.35)';
            c.fillRect(0, 0, 1.5, 400);
            c.fillRect(58.5, 0, 1.5, 400);
        });

        // ---------- METEORITO DE FONDO 90x40 (viaja hacia la izquierda, la estela queda a la derecha) ----------
        mk('flap-cloud', 90, 40, (c) => {
            poly(c, [[44, 10], [90, 17], [90, 23], [44, 30]]);
            c.fillStyle = lin(c, 40, 0, 90, 0, [[0, 'rgba(255,170,70,0.75)'], [0.6, 'rgba(255,90,20,0.35)'], [1, 'rgba(255,60,10,0)']]);
            c.fill();
            [[58, 14, 1.2], [70, 24, 1], [78, 17, 0.9], [64, 21, 0.8]].forEach((k) => dot(c, k[0], k[1], k[2], 'rgba(255,220,140,0.85)'));
            c.beginPath(); c.arc(30, 20, 17, 0, TAU);
            c.fillStyle = rad(c, 24, 14, 2, 30, 20, 20, [[0, '#9a9aa2'], [0.55, '#5a5560'], [1, '#26222a']]);
            c.fill();
            [[24, 24, 6], [38, 15, 4.5], [34, 28, 3.5], [22, 13, 3]].forEach((k) => dot(c, k[0], k[1], k[2], 'rgba(20,15,20,0.45)'));
            c.beginPath(); c.arc(30, 20, 17, Math.PI * 0.7, Math.PI * 1.3);
            c.strokeStyle = 'rgba(255,170,80,0.7)'; c.lineWidth = 2; c.stroke();
        });

        // ---------- SUELO 64x40 (se repite en horizontal) ----------
        mk('flap-ground', 64, 40, (c) => {
            c.fillStyle = lin(c, 0, 0, 0, 40, [[0, '#4a3a42'], [0.15, '#33262e'], [1, '#150f14']]);
            c.fillRect(0, 0, 64, 40);
            for (let i = 0; i < 26; i++) {
                const x = 1 + (i * 23) % 61, y = 8 + (i * 17) % 30, sz = 1 + (i % 2);
                c.fillStyle = i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.2)';
                c.fillRect(x, y, sz, sz);
            }
            [
                [[8, 14], [12, 19], [9, 25]],
                [[30, 12], [27, 18], [31, 24], [28, 31]],
                [[50, 16], [53, 22], [49, 28]]
            ].forEach((pts) => lava(c, pts, 1.6));
            c.fillStyle = lin(c, 0, 0, 0, 6, [[0, '#ffd37a'], [0.35, '#ff7a24'], [1, 'rgba(255,90,20,0)']]);
            c.fillRect(0, 0, 64, 6);
        });

        // ---------- METEORITO GIGANTE DE FONDO 512x512 (cae hacia abajo-izquierda, la cola va arriba-derecha) ----------
        mk('flap-meteor-big', 512, 512, (c) => {
            c.fillStyle = lin(c, 256, 256, 512, 0, [[0, 'rgba(255,170,70,0.65)'], [0.5, 'rgba(255,90,20,0.25)'], [1, 'rgba(255,60,10,0)']]);
            poly(c, [[320, 320], [192, 192], [512, 0]]);
            c.fill();
            c.fillStyle = rad(c, 256, 256, 40, 256, 256, 250, [[0, 'rgba(255,160,60,0.5)'], [1, 'rgba(255,80,20,0)']]);
            c.fillRect(0, 0, 512, 512);
            [[330, 190, 3], [360, 160, 2.5], [400, 120, 2], [300, 230, 3.5], [440, 80, 2], [345, 215, 2]]
                .forEach((k) => dot(c, k[0], k[1], k[2], 'rgba(255,220,140,0.85)'));
            c.beginPath(); c.arc(256, 256, 96, 0, TAU);
            c.fillStyle = rad(c, 226, 226, 8, 256, 256, 104, [[0, '#e0a070'], [0.4, '#9a4a2a'], [1, '#2e0e08']]);
            c.fill();
            [[232, 238, 18], [284, 226, 13], [268, 296, 16], [220, 292, 10], [300, 270, 8], [250, 200, 7]]
                .forEach((k) => dot(c, k[0], k[1], k[2], 'rgba(40,10,6,0.5)'));
            c.beginPath(); c.arc(256, 256, 96, Math.PI * 0.35, Math.PI * 1.15);
            c.strokeStyle = 'rgba(255,225,150,0.8)'; c.lineWidth = 5; c.stroke();
        });

        // ---------- NUBE DE CENIZA 160x64 (se deshace: fragmentos sueltos, huecos y luz del meteorito) ----------
        mk('flap-ashcloud', 160, 64, (c) => {
            const blob = (x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); };
            c.fillStyle = lin(c, 0, 10, 0, 56, [[0, '#6a5470'], [1, '#2c1e36']]);
            blob(40, 38, 34, 16); blob(80, 32, 40, 22); blob(118, 38, 32, 15);
            blob(62, 24, 26, 14); blob(100, 24, 28, 14);
            blob(148, 30, 8, 5); blob(156, 42, 5, 3); blob(141, 49, 6, 3.5);
            c.globalCompositeOperation = 'destination-out';
            dot(c, 26, 50, 6, '#000'); dot(c, 92, 54, 7, '#000'); dot(c, 128, 26, 5, '#000'); dot(c, 58, 16, 4, '#000');
            c.globalCompositeOperation = 'source-atop';
            c.fillStyle = rad(c, 150, 6, 4, 150, 6, 110, [[0, 'rgba(255,150,70,0.65)'], [1, 'rgba(255,90,30,0)']]);
            c.fillRect(0, 0, 160, 64);
            c.globalCompositeOperation = 'source-over';
        });

        // ---------- PTEROSAURIO LEJANO 48x24 (dos poses, mira a la derecha, iluminado por el meteorito) ----------
        const farP = (wing) => (c) => {
            c.fillStyle = '#e2a07a';
            c.beginPath(); c.ellipse(24, 13, 6.5, 2.6, 0, 0, TAU); c.fill();
            poly(c, [[28, 11], [47, 13], [28, 15.2]]); c.fill();
            poly(c, [[27, 11.5], [22, 6], [31, 10.5]]); c.fill();
            poly(c, [[19, 13], [9, 14], [19, 15]]); c.fill();
            poly(c, wing); c.fill();
        };
        mk('flap-farptero-0', 48, 24, farP([[20, 13.5], [12, 23], [2, 19], [11, 14], [23, 14.5]]));
        mk('flap-farptero-1', 48, 24, farP([[20, 12.5], [13, 0.5], [3, 3], [11, 8], [23, 14.5]]));
    }

    create() {
        const w = this.scale.width, h = this.scale.height;

        this.paintFlapArt();

        // Fondo: cielo en degradado (con ?art=old, el rectangulo liso de antes)
        if (this.artNew) {
            this.bg = this.add.image(0, 0, 'flap-sky').setOrigin(0, 0).setDisplaySize(w, h).setDepth(-20);
            this.scale.on('resize', (size) => { this.bg.setDisplaySize(size.width, size.height); }, this);
        } else {
            this.bg = this.add.rectangle(w/2, h/2, w, h, 0x1a1a2e);
        }
        this.clouds = [];
        for (let i = 0; i < (this.artNew ? 0 : 5); i++) {
            const c = this.add.image(Math.random()*w, Math.random()*h*0.5, 'flap-cloud');
            c.setScrollFactor(0.2);
            this.clouds.push(c);
        }

        // Meteorito gigante de fondo (un solo cuerpo enorme que cae muy despacio)
        if (this.artNew) {
            const ms = Math.round(h * 0.9);
            this.bigMeteor = this.add.image(w * 0.28, h * 0.30, 'flap-meteor-big')
                .setDisplaySize(ms, ms).setFlipX(true).setAlpha(0.65).setDepth(-18);
            this.scale.on('resize', (size) => {
                const k = Math.round(size.height * 0.9);
                this.bigMeteor.setDisplaySize(k, k);
            }, this);
        }

        // Fondo vivo: nubes de ceniza que se deshacen y pterosaurios que huyen a lo lejos
        if (this.artNew) {
            this.ashClouds = [0, 1, 2].map((i) => {
                const x = w * (0.15 + i * 0.35), y = h * (0.12 + 0.16 * i);
                return { img: this.add.image(x, y, 'flap-ashcloud').setFlipX(true).setDepth(-17).setAlpha(0),
                         x: x, y: y, sp: 10 + i * 5, life: 14 + i * 3, t: i * 5, sc: 1.1 + 0.3 * i };
            });
            this.farPteros = [0, 1, 2, 3].map((i) => {
                const x = w * (0.1 + i * 0.27), y = h * (0.12 + 0.09 * i);
                return { img: this.add.image(x, y, 'flap-farptero-0').setDepth(-16).setAlpha(0.55),
                         x: x, y: y, sp: 22 + i * 7, sc: [0.9, 0.6, 1.1, 0.7][i], ph: i * 1.7 };
            });
        }

        // Suelo (invisible, solo para colisión)
        this.ground = this.add.rectangle(w/2, h - 20, w, 40, 0x8b4513).setVisible(false);
        this.physics.add.existing(this.ground, true);
        if (this.artNew) {
            // Suelo visible justo sobre el rectangulo de colision (la fisica no cambia)
            this.groundArt = this.add.tileSprite(0, h - 40, w, 40, 'flap-ground').setOrigin(0, 0).setDepth(6);
        }

        // Dino
        this.player = this.physics.add.sprite(w*0.25, h/2, 'flap-ptero');
        this.player.body.setSize(36, 28);
        this.player.body.setAllowGravity(false);
        this.player.setDepth(10);

        // Grupo de columnas
        this.pipes = this.physics.add.group();
        this.physics.add.collider(this.player, this.pipes, () => this.die(), null, this);
        this.physics.add.collider(this.player, this.ground, () => this.die(), null, this);

        // Input: espacio, clic, toque
        this.input.keyboard.on('keydown-SPACE', () => this.jump(), this);
        this.input.on('pointerdown', () => this.jump(), this);

        // Spawner de columnas
        this.spawnTimer = this.time.addEvent({
            delay: this.pipeSpawnDelay,
            callback: this.spawnPipe,
            callbackScope: this,
            loop: true
        });

        // HUD
        this.scoreText = this.add.text(w/2, 20, '0', {
            fontFamily: 'monospace', fontSize: '32px', color: '#fff', fontStyle: 'bold'
        }).setOrigin(0.5, 0).setDepth(20).setScrollFactor(0);

        console.log('[FLAP] Iniciado para', this.alias);
    }

    jump() {
        if (this.gameOver) return;
        this.player.body.setVelocityY(this.jumpPower);
        SoundFX?.coin?.(); // sonido de salto (reutiliza el del runner)
    }

    spawnPipe() {
        if (this.gameOver) return;
        const w = this.scale.width, h = this.scale.height;
        const gap = 160;
        const gapY = Phaser.Math.Between(100 + gap/2, h - 100 - gap/2);

        // Pipe superior
        const topPipe = this.pipes.create(w + 60, gapY - gap/2, 'meteor-column');
        topPipe.setOrigin(0.5, 1);
        topPipe.body.setAllowGravity(false);
        topPipe.body.setImmovable(true);
        topPipe.setDepth(5);

        // Pipe inferior
        const botPipe = this.pipes.create(w + 60, gapY + gap/2, 'meteor-column');
        botPipe.setOrigin(0.5, 0);
        botPipe.body.setAllowGravity(false);
        botPipe.body.setImmovable(true);
        botPipe.setDepth(5);

        // Asignar puntuación
        topPipe.setData('scored', false);
        botPipe.setData('scored', false);
    }

    update(time, delta) {
        if (this.gameOver) return;
        const dt = delta / 1000;
        const h = this.scale.height;

        // Gravedad
        this.player.body.velocity.y += this.gravity * dt;

        // Rotación del dino según velocidad
        this.player.rotation = Phaser.Math.Clamp(this.player.body.velocity.y / 800, -0.5, 0.8);
        // Alas arriba al subir, abajo al caer (solo aspecto)
        if (this.artNew) {
            const pkey = this.player.body.velocity.y < 0 ? 'flap-ptero-up' : 'flap-ptero';
            if (this.player.texture.key !== pkey) this.player.setTexture(pkey);
        }

        // Mover columnas
        this.pipes.getChildren().forEach(pipe => {
            pipe.x -= this.pipeSpeed * dt;
            if (pipe.x < -100) pipe.destroy();

            // Puntuación al pasar la columna
            if (pipe.getData('scored') === false && pipe.x < this.player.x) {
                pipe.setData('scored', true);
                this.score += this.pointsPerColumn;
                this.scoreText.setText(this.score);
            }
        });

        // Meteorito gigante de fondo: cae muy despacio
        if (this.bigMeteor) {
            const m = this.bigMeteor;
            m.x += this.pipeSpeed * 0.05 * dt;
            m.y += this.pipeSpeed * 0.035 * dt;
            const half = m.displayWidth / 2;
            if (m.x > this.scale.width + half || m.y > this.scale.height + half) {
                m.x = -half * 0.5;
                m.y = -half * 0.3;
            }
        }

        // Nubes de ceniza: derivan a la izquierda, se estiran y se desvanecen (se rompen)
        if (this.ashClouds) {
            const W = this.scale.width, H = this.scale.height;
            this.ashClouds.forEach((a) => {
                a.t += dt;
                if (a.t >= a.life) {
                    a.t = 0;
                    a.x = W * (0.6 + Math.random() * 0.5);
                    a.y = H * (0.08 + Math.random() * 0.4);
                }
                a.x -= a.sp * dt;
                const p = a.t / a.life;
                a.img.setPosition(a.x, a.y)
                    .setAlpha(0.55 * Math.sin(Math.PI * p))
                    .setScale(a.sc * (1 + 0.5 * p), a.sc * (1 - 0.25 * p));
            });
        }
        // Pterosaurios que huyen a lo lejos (vuelan hacia la derecha, delante del jugador)
        if (this.farPteros) {
            const W = this.scale.width, H = this.scale.height;
            this.farPteros.forEach((q) => {
                q.x += q.sp * dt;
                if (q.x > W + 60) { q.x = -60; q.y = H * (0.08 + Math.random() * 0.4); }
                q.img.setPosition(q.x, q.y + Math.sin(time / 600 + q.ph) * 6).setScale(q.sc);
                q.img.setTexture(Math.floor(time / 220 + q.ph) % 2 ? 'flap-farptero-1' : 'flap-farptero-0');
            });
        }

        // Mover nubes
        this.clouds.forEach(c => {
            c.x -= 30 * dt;
            if (c.x < -100) c.x = this.scale.width + 100;
        });

        // El suelo se desplaza con las columnas
        if (this.groundArt) this.groundArt.tilePositionX += this.pipeSpeed * dt;

        // Limitar dino a la pantalla
        if (this.player.y < 0) this.player.y = 0;
        if (this.player.y > h) this.die();
    }

    async die() {
        if (this.gameOver) return;
        this.gameOver = true;
        this.player.body.setVelocityY(0);
        this.spawnTimer.destroy();
        SoundFX?.death?.();

        // Guardar puntuación
        try {
            await enviarPuntuacion(this.alias, this.score);
        } catch(e) { console.warn('Error guardando score:', e); }

        // Mostrar game over
        document.getElementById('final-score-text').textContent = this.score;
        document.getElementById('over-alias').textContent = this.alias;

        // Obtener top 3
        try {
            const top3 = await obtenerTop3();
            const list = document.getElementById('top3-list');
            list.innerHTML = top3.map((r, i) =>
                `<li class="rank-item ${i===0?'first':''}"><span class="rank-alias">${r.alias}</span><span class="rank-score">${r.score}</span></li>`
            ).join('');
        } catch(e) {}

        // Posición
        try {
            const pos = await obtenerPosicion(this.alias, this.score);
            document.getElementById('position-line').innerHTML = `Puesto: <strong>#${pos}</strong>`;
        } catch(e) {}

        // adBreak
        window.onGameOver?.(this.alias, this.score);

        // Mostrar pantalla
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
        scene: new DinoFlap(alias)
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
            type: 'next', name: 'flap_game_over',
            beforeAd: () => { clearTimeout(timeout); },
            afterAd: () => { clearTimeout(timeout); show(); },
            adBreakDone: () => { clearTimeout(timeout); show(); }
        });
    } else { clearTimeout(timeout); }
};
