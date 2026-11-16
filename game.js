// game.js — Dino Runner (versión limpia y funcional)
class DinoGame extends Phaser.Scene {
    constructor(alias) {
        super('DinoGame');
        this.alias = alias || 'Jugador_0000';
    }

    init() {
        this.score = 0;
        this.speed = 3;
        this.gameOver = false;
        this.ducking = false;
        this.lastHudScore = -1;
        this.lastHudSpeed = null;
    }

    preload() {
        this.makeTexture('dino', (g) => {
            g.fillStyle(0x333333, 1);
            g.fillRect(0, 0, 40, 40);
            g.fillStyle(0xffffff, 1);
            g.fillRect(8, 12, 10, 10);
        }, 40, 40);

        this.makeTexture('cactus', (g) => {
            g.fillStyle(0x666666, 1);
            g.fillRect(0, 0, 20, 60);
            g.fillRect(12, 10, 8, 10);
            g.fillRect(12, 40, 8, 10);
        }, 20, 60);

        this.makeTexture('ptero', (g) => {
            g.fillStyle(0x999999, 1);
            g.fillRect(0, 0, 40, 26);
        }, 40, 26);
    }

    makeTexture(key, drawFn, w, h) {
        const g = this.make.graphics({ key });
        drawFn(g);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    create() {
        const w = this.scale.width;
        const h = this.scale.height;
        console.log('[GAME] scene created, w=', w, 'h=', h);

        this.hudScoreEl = document.getElementById('hud-score');
        this.hudSpeedEl = document.getElementById('hud-speed');
        this.lastHudScore = -1;
        this.lastHudSpeed = null;

        // Suelo
        this.ground = this.add.rectangle(w / 2, h - 25, w, 50, 0x333333);
        this.physics.add.existing(this.ground, true);

        // Jugador: origen en los pies, se para justo encima del suelo
        const groundTop = h - 50;
        this.player = this.physics.add.sprite(w / 2, groundTop, 'dino');
        this.player.setOrigin(0.5, 1);
        this.player.body.setSize(40, 40);
        this.player.setCollideWorldBounds(true);
        this.player.body.setGravityY(900);

        // Obstáculos
        this.obstacles = this.physics.add.group();

        // Colisiones
        this.physics.add.collider(this.player, this.ground, null, null, this);
        this.physics.add.overlap(this.player, this.obstacles, this.gameOverHandler, null, this);

        // Input
        this.jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.jumpKey.on('down', () => this.tryJump());

        this.dashKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ARROW_DOWN);
        this.dashKey.on('down', () => this.setDucking(true));
        this.dashKey.on('up', () => this.setDucking(false));

        this.input.on('pointerdown', () => this.tryJump());

        // Spawns con delay aleatorio recursivo
        this.spawnNext();

        // Textos en canvas
        this.scoreText = this.add.text(10, 10, 'Puntuación: 0', { font: '30px monospace', fill: '#333' });
        this.speedText = this.add.text(w - 220, 10, 'Velocidad: 1.0x', { font: '20px monospace', fill: '#333' });

        console.log('[GAME] create done. player at', this.player.x, this.player.y);
    }

    spawnNext() {
        if (this.gameOver) return;
        const delay = Phaser.Math.Between(1200, 2800);
        this.spawnTimer = this.time.delayedCall(delay, () => {
            if (this.gameOver) return;
            this.spawnObstacle();
            this.spawnNext();
        });
    }

    spawnObstacle() {
        if (this.gameOver) return;
        const w = this.scale.width;
        const h = this.scale.height;
        const usePtero = Phaser.Math.Between(0, 4) === 0;
        const key = usePtero ? 'ptero' : 'cactus';
        const y = usePtero ? h - 130 : h - 50;
        const sprite = this.physics.add.sprite(w + 60, y, key);
        sprite.setOrigin(0.5, 1);
        sprite.body.setAllowGravity(false);
        sprite.body.setImmovable(true);
        this.obstacles.add(sprite);
        console.log('[GAME] obstacle spawned:', key, '| total:', this.obstacles.getChildren().length);
    }

    tryJump() {
        if (this.gameOver) return;
        if (this.player.body.blocked.down || this.player.body.touching.down) {
            this.player.body.setVelocityY(-500);
        }
    }

    setDucking(value) {
        if (this.gameOver) return;
        this.ducking = value;
        this.player.setScale(1, value ? 0.6 : 1);
    }

    gameOverHandler() {
        if (this.gameOver) return;
        this.gameOver = true;
        this.physics.pause();
        if (this.spawnTimer) this.spawnTimer.remove();
        console.log('[GAME] game over, score=', Math.floor(this.score));
        if (window.onGameOver) window.onGameOver(this.alias, Math.floor(this.score));
    }

    update(time, delta) {
        if (this.gameOver) {
            if (Phaser.Input.Keyboard.JustDown(this.jumpKey)) this.scene.restart();
            return;
        }

        const dt = delta / 1000;
        this.score += dt * 10 * this.speed;
        this.speed += dt * 0.05;

        this.player.body.setGravityY(this.ducking ? 0 : 900);

        this.obstacles.getChildren().forEach((o) => {
            o.x -= this.speed;
            if (o.x < -80) o.destroy();
        });

        // HUD DOM (solo si cambia)
        if (this.hudScoreEl) {
            const s = Math.floor(this.score);
            if (s !== this.lastHudScore) {
                this.lastHudScore = s;
                this.hudScoreEl.textContent = s;
            }
        }
        if (this.hudSpeedEl) {
            const v = (this.speed / 3).toFixed(1);
            if (v !== this.lastHudSpeed) {
                this.lastHudSpeed = v;
                this.hudSpeedEl.textContent = 'x' + v;
            }
        }

        // Textos canvas
        this.scoreText.setText('Puntuación: ' + Math.floor(this.score));
        this.speedText.setText('Velocidad: ' + (this.speed / 3).toFixed(1) + 'x');
    }
}

window.startGame = (alias) => {
    const config = {
        type: Phaser.AUTO,
        parent: 'game-canvas',
        scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        backgroundColor: '#f7f7f7',
        physics: {
            default: 'arcade',
            arcade: { gravity: { y: 0 }, debug: false },
        },
        scene: new DinoGame(alias),
    };
    console.log('[GAME] creating scene, parent=', config.parent, 'bg=', config.backgroundColor);
    return new Phaser.Game(config);
};
