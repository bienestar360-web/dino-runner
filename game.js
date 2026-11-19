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

    create() {
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

        // Fondo: montañas
        this.mountains = [];
        for (let i = 0; i < 3; i++) {
            const m = this.add.image(Phaser.Math.Between(0, w), this.groundTop + 5, 'mountain');
            m.setOrigin(0.5, 1).setScale(Phaser.Math.FloatBetween(1.0, 1.6)).setAlpha(0.75).setDepth(-8);
            this.mountains.push(m);
        }

        // Fondo: nubes
        this.clouds = [];
        for (let i = 0; i < 4; i++) {
            const c = this.add.image(Phaser.Math.Between(0, w), Phaser.Math.Between(40, h * 0.35), 'cloud');
            c.setScale(Phaser.Math.FloatBetween(0.6, 1.2)).setAlpha(0.9).setDepth(-6);
            this.clouds.push(c);
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
        this.meteor = this.add.image(this.scale.width - 100, 100, 'meteor')
            .setDepth(-3)
            .setScale(0.12);

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
            this.meteor.x = this.scale.width - 100 - (s - 0.12) * 35;
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

        // Parallax: montañas
        this.mountains.forEach((m) => {
            m.x -= 0.1;
            if (m.x < -200) m.x = w + Phaser.Math.Between(100, 400);
        });

        // Parallax: nubes
        this.clouds.forEach((c) => {
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
