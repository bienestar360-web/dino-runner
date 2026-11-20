// Dino Mountain Escape — Salto entre plataformas con cámara vertical
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

    create() {
        const w = this.scale.width, h = this.scale.height;

        // Cielo (fijo, scrollFactor 0)
        this.sky = this.add.rectangle(w/2, h/2, w, h, 0x1a1a2e).setScrollFactor(0).setDepth(-20);

        // Montaña parallax
        this.bg = this.add.tileSprite(0, 0, 2048, 2048, 'mountain-bg')
            .setOrigin(0, 0).setScrollFactor(0.2).setDepth(-10);

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
        this.cameras.main.scrollY = this.player.y - h * 0.75;

        // HUD
        this.scoreText = this.add.text(w/2, 20, '0', {
            fontFamily: 'monospace', fontSize: '32px', color: '#fff', fontStyle: 'bold'
        }).setOrigin(0.5, 0).setDepth(20).setScrollFactor(0);

        // Input
        this.input.keyboard.on('keydown-SPACE', () => this.jump(), this);
        this.input.on('pointerdown', () => this.jump(), this);

        console.log('[MOUNTAIN] Iniciado para', this.alias);
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
        const nextLeft = this.lastPlatformRightX + this.platformGap;
        const nextY = this.lastPlatformY - this.heightStep;
        const nextCenterX = nextLeft + this.platformWidth / 2;

        const plat = this.platforms.create(nextCenterX, nextY, 'mountain-rock');
        plat.setDisplaySize(this.platformWidth, 30);
        plat.body.updateFromGameObject();
        plat.setDepth(5);

        this.lastPlatformRightX = nextLeft + this.platformWidth;
        this.scoreQueue.push(nextCenterX);

        // Picos en el último tramo de la plataforma (nivel 2 en adelante, nunca dos seguidas)
        const wantSpike = this.level >= 2 && !this.lastHadSpike &&
            Math.random() < Math.min(0.15 + 0.05 * (this.level - 2), 0.3);
        this.lastHadSpike = wantSpike;
        if (wantSpike) {
            plat.spike = this.add.image(nextCenterX + this.platformWidth * 0.30, nextY - 15, 'spike')
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

        // Cámara X sigue al jugador; Y solo sube (monotónica)
        this.cameras.main.scrollX = this.player.x - w * 0.25;
        const targetScrollY = this.player.y - h * 0.75;
        if (targetScrollY < this.cameras.main.scrollY) {
            this.cameras.main.scrollY = targetScrollY;
        }

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

        const skies = [0x1a1a2e, 0x2a1a3e, 0x3a1a36, 0x4a1a2a, 0x5a1a1e, 0x6a1a12];
        if (this.sky) this.sky.setFillStyle(skies[lvl]);

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
            const list = document.getElementById('top3-list');
            list.innerHTML = top3.map((r, i) =>
                `<li class="rank-item ${i===0?'first':''}"><span class="rank-alias">${r.alias}</span><span class="rank-score">${r.score}</span></li>`
            ).join('');
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
