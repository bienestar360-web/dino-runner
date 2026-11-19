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

    create() {
        const w = this.scale.width, h = this.scale.height;

        // Fondo
        this.bg = this.add.rectangle(w/2, h/2, w, h, 0x1a1a2e);
        this.clouds = [];
        for (let i = 0; i < 5; i++) {
            const c = this.add.image(Math.random()*w, Math.random()*h*0.5, 'flap-cloud');
            c.setScrollFactor(0.2);
            this.clouds.push(c);
        }

        // Suelo (invisible, solo para colisión)
        this.ground = this.add.rectangle(w/2, h - 20, w, 40, 0x8b4513).setVisible(false);
        this.physics.add.existing(this.ground, true);

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

        // Mover nubes
        this.clouds.forEach(c => {
            c.x -= 30 * dt;
            if (c.x < -100) c.x = this.scale.width + 100;
        });

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
