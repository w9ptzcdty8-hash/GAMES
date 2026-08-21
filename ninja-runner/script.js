// ========================================
// NINJA RUNNER
// Main JavaScript
// ========================================

document.addEventListener("DOMContentLoaded", () => {
    init();
});


// ========================================
// Initialization
// ========================================

// DOM要素（init内で取得）
let canvas, ctx;
let startScreen, pauseScreen, gameOverScreen, topControlBar;
let scoreText, titleHighScoreValue, overHighScore, finalScoreText;
let startBtn, pauseBtn, resumeBtn, pauseHomeBtn, restartBtn, overHomeBtn;

function init() {
    console.log("NINJA RUNNER initialized");

    // Canvas
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    // UI Elements
    startScreen = document.getElementById('startScreen');
    pauseScreen = document.getElementById('pauseScreen');
    gameOverScreen = document.getElementById('gameOverScreen');
    topControlBar = document.getElementById('topControlBar');
    scoreText = document.getElementById('scoreText');
    titleHighScoreValue = document.getElementById('titleHighScoreValue');
    overHighScore = document.getElementById('overHighScore');
    finalScoreText = document.getElementById('finalScoreText');

    // Buttons
    startBtn = document.getElementById('startBtn');
    pauseBtn = document.getElementById('pauseBtn');
    resumeBtn = document.getElementById('resumeBtn');
    pauseHomeBtn = document.getElementById('pauseHomeBtn');
    restartBtn = document.getElementById('restartBtn');
    overHomeBtn = document.getElementById('overHomeBtn');

    // ボタンイベント登録
    attachButtonEvent(startBtn, startGame);
    attachButtonEvent(restartBtn, startGame);
    attachButtonEvent(pauseBtn, pauseGame);
    attachButtonEvent(resumeBtn, resumeGame);
    attachButtonEvent(pauseHomeBtn, goToHome);
    attachButtonEvent(overHomeBtn, goToHome);

    // 初期ロード
    setTimeout(() => {
        pushGameStateHistory();
        resizeCanvas();
        loadHighScore();
        initGame();
        drawBackground();
        player.draw();
        gameLoop();
    }, 50);
}


// ========================================
// Web Audio API（効果音）
// ========================================

class SoundFX {
    constructor() {
        this.ctx = null;
    }
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
    playJump(pitch = 1) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150 * pitch, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(450 * pitch, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }
    playBounce() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.25);
    }
    playHit() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(30, this.ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }
}
const sfx = new SoundFX();


// ========================================
// 定数・状態管理
// ========================================

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 450;

// ゲーム状態 ('START', 'PLAYING', 'PAUSED', 'GAMEOVER')
let gameState = 'START';
const FIXED_GAME_SPEED = 6;
let gameSpeed = FIXED_GAME_SPEED;
let score = 0;
let highScore = 0;
let distance = 0;
let animationFrameId = null;


// ========================================
// ハイスコア管理
// ========================================

function loadHighScore() {
    try {
        const saved = localStorage.getItem('ninja_runner_highscore');
        highScore = saved ? parseInt(saved, 10) : 0;
    } catch (e) {
        highScore = 0;
    }
    titleHighScoreValue.innerText = `${highScore}m`;
    overHighScore.innerText = `HIGH SCORE: ${highScore}m`;
}

function saveHighScore(newScore) {
    if (newScore > highScore) {
        highScore = newScore;
        try {
            localStorage.setItem('ninja_runner_highscore', highScore);
        } catch (e) {}
    }
    titleHighScoreValue.innerText = `${highScore}m`;
    overHighScore.innerText = `HIGH SCORE: ${highScore}m`;
}


// ========================================
// 時間帯・背景管理
// ========================================

const SCORE_PER_PHASE = 1500;
const TIME_PHASES = [
    { top: [255, 140, 100], bottom: [255, 210, 150], sunColor: "#fff3e0", sunY: 180 },
    { top: [70, 160, 240],  bottom: [180, 220, 255], sunColor: "#fffde7", sunY: 60 },
    { top: [180, 50, 90],   bottom: [255, 120, 60],  sunColor: "#ff7043", sunY: 220 },
    { top: [10, 15, 30],    bottom: [30, 35, 65],    sunColor: "#eceff1", sunY: 80 }
];

function getInterpolatedBg() {
    const totalCycleScore = TIME_PHASES.length * SCORE_PER_PHASE;
    const currentScoreInCycle = score % totalCycleScore;

    const currentIndex = Math.floor(currentScoreInCycle / SCORE_PER_PHASE);
    const nextIndex = (currentIndex + 1) % TIME_PHASES.length;
    const progress = (currentScoreInCycle % SCORE_PER_PHASE) / SCORE_PER_PHASE;

    const c1 = TIME_PHASES[currentIndex];
    const c2 = TIME_PHASES[nextIndex];

    const rTop = Math.round(c1.top[0] + (c2.top[0] - c1.top[0]) * progress);
    const gTop = Math.round(c1.top[1] + (c2.top[1] - c1.top[1]) * progress);
    const bTop = Math.round(c1.top[2] + (c2.top[2] - c1.top[2]) * progress);

    const rBot = Math.round(c1.bottom[0] + (c2.bottom[0] - c1.bottom[0]) * progress);
    const gBot = Math.round(c1.bottom[1] + (c2.bottom[1] - c1.bottom[1]) * progress);
    const bBot = Math.round(c1.bottom[2] + (c2.bottom[2] - c1.bottom[2]) * progress);

    const sunY = c1.sunY + (c2.sunY - c1.sunY) * progress;

    return {
        top: `rgb(${rTop},${gTop},${bTop})`,
        bottom: `rgb(${rBot},${gBot},${bBot})`,
        sunColor: c1.sunColor,
        sunY: sunY
    };
}


// ========================================
// 忍者（プレイヤー）
// ========================================

const player = {
    x: 100,
    y: 0,
    width: 28,
    height: 38,
    velocityY: 0,
    gravity: 0.65,
    jumpForce: -13,
    isGrounded: false,
    jumpCount: 0,
    maxJumps: 2,
    animFrame: 0,

    reset() {
        this.y = 150;
        this.velocityY = 0;
        this.isGrounded = false;
        this.jumpCount = 0;
    },

    jump(force = this.jumpForce, isBounce = false) {
        if (isBounce) {
            this.velocityY = force;
            this.jumpCount = 1;
            this.isGrounded = false;
            sfx.playBounce();
        } else if (this.jumpCount < this.maxJumps) {
            this.velocityY = force;
            this.jumpCount++;
            this.isGrounded = false;
            sfx.playJump(this.jumpCount === 2 ? 1.3 : 1.0);
        }
    },

    update() {
        this.velocityY += this.gravity;
        this.y += this.velocityY;
        this.animFrame += 0.2;
    },

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.fillStyle = '#e53935';
        ctx.fillRect(-6, 6, this.width + 6, 6);

        const scarfWave = Math.sin(this.animFrame * 2.5) * 8;
        ctx.beginPath();
        ctx.moveTo(-2, 8);
        ctx.lineTo(-18, 10 + scarfWave);
        ctx.lineTo(-2, 14);
        ctx.fill();

        ctx.fillStyle = '#ffeb3b';
        ctx.fillRect(this.width - 10, 8, 8, 4);

        if (this.isGrounded) {
            const leg = Math.sin(this.animFrame * 3.5) * 6;
            ctx.fillStyle = '#222';
            ctx.fillRect(4, this.height, 7, 6 + leg);
            ctx.fillRect(17, this.height, 7, 6 - leg);
        } else {
            ctx.fillStyle = '#222';
            ctx.fillRect(2, this.height - 2, 9, 8);
            ctx.fillRect(16, this.height + 2, 9, 6);
        }

        ctx.restore();
    }
};


// ========================================
// 敵忍者
// ========================================

class EnemyNinja {
    constructor(platform) {
        this.platform = platform;
        this.width = 28;
        this.height = 36;
        this.x = platform.x + platform.width - this.width - 10;
        this.y = platform.y - this.height;
        this.speed = 2.5;
        this.dir = -1;
        this.animFrame = 0;
    }

    update() {
        this.x -= gameSpeed;
        this.x += this.speed * this.dir;

        if (this.x <= this.platform.x + 5) {
            this.x = this.platform.x + 5;
            this.dir = 1;
        } else if (this.x + this.width >= this.platform.x + this.platform.width - 5) {
            this.x = this.platform.x + this.platform.width - this.width - 5;
            this.dir = -1;
        }

        this.y = this.platform.y - this.height;
        this.animFrame += 0.25;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.fillStyle = '#303f9f';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.fillStyle = '#7b1fa2';
        ctx.fillRect(-2, 6, this.width + 4, 5);

        ctx.fillStyle = '#ff1744';
        if (this.dir === -1) {
            ctx.fillRect(2, 8, 8, 4);
        } else {
            ctx.fillRect(this.width - 10, 8, 8, 4);
        }

        const leg = Math.sin(this.animFrame * 3) * 5;
        ctx.fillStyle = '#1a237e';
        ctx.fillRect(4, this.height, 7, 5 + leg);
        ctx.fillRect(17, this.height, 7, 5 - leg);

        ctx.restore();
    }
}


// ========================================
// カラス
// ========================================

class Crow {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 42;
        this.height = 30;
        this.speed = gameSpeed + 2.5;
        this.flapFrame = Math.random() * Math.PI * 2;
    }

    update() {
        this.x -= this.speed;
        this.flapFrame += 0.18;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        const wingPos = Math.sin(this.flapFrame);

        ctx.fillStyle = '#1c1c1c';
        ctx.strokeStyle = '#1c1c1c';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.ellipse(-2, 2, 14, 7, -0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(-14, -2, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0d0f18';
        ctx.beginPath();
        ctx.moveTo(-18, -2);
        ctx.lineTo(-25, 1);
        ctx.lineTo(-18, 3);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(10, 2);
        ctx.lineTo(22, 6);
        ctx.lineTo(20, -1);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#262626';
        ctx.beginPath();
        ctx.moveTo(-4, -2);

        const wingY = wingPos * 22;
        ctx.quadraticCurveTo(-2, -10 + wingY / 2, 8, -15 + wingY);
        ctx.quadraticCurveTo(2, -4, -4, -2);
        ctx.fill();

        ctx.restore();
    }
}


// ========================================
// 飛来する手裏剣（空中障害物）
// ========================================

class FlyingShuriken {
    constructor(spawnSide) {
        this.width = 26;
        this.height = 26;
        this.rotation = 0;

        // ランダムなスピード（+3.5 ～ +6.5）
        const randomSpeedOffset = 3.5 + Math.random() * 3.0;
        const baseSpeed = gameSpeed + randomSpeedOffset;

        // 画面右側 1/3 の範囲（X軸: 2/3 ~ 1.0 の領域）
        const rightAreaMinX = CANVAS_WIDTH * (2 / 3);
        const rightAreaMaxX = CANVAS_WIDTH;

        if (spawnSide === 'top') {
            // 上端（画面右側1/3の幅から出現）
            this.x = rightAreaMinX + Math.random() * (rightAreaMaxX - rightAreaMinX);
            this.y = -40;
            // 【変更】 30度〜45度の範囲で斜め左下へ飛ぶ（度数をラジアンに変換）
            const minDeg = 15;
            const maxDeg = 40;
            const deg = minDeg + Math.random() * (maxDeg - minDeg); // 30 ~ 45度
            const angle = deg * (Math.PI / 180);

            this.speedX = baseSpeed * Math.cos(angle);
            this.speedY = baseSpeed * Math.sin(angle);

        } else if (spawnSide === 'bottom') {
            // 下端（画面右側1/3の幅から出現）
            this.x = rightAreaMinX + Math.random() * (rightAreaMaxX - rightAreaMinX);
            this.y = CANVAS_HEIGHT + 10;
            // 【変更】 30度〜45度の範囲で斜め左上へ飛ぶ（下端からのためマイナス）
            const minDeg = 30;
            const maxDeg = 40;
            const deg = minDeg + Math.random() * (maxDeg - minDeg); // 30 ~ 45度
            const angle = -deg * (Math.PI / 180);

            this.speedX = baseSpeed * Math.cos(angle);
            this.speedY = baseSpeed * Math.sin(angle);

        } else {
            // 右端（縦方向は上側〜中央付近）
            this.x = CANVAS_WIDTH + 30;
            this.y = Math.random() * 220 + 50;
            // 水平〜斜め方向へ飛ぶ
            const maxAngle = Math.PI / 5.5;
            const angle = (Math.random() * 2 - 1) * maxAngle;
            this.speedX = baseSpeed * Math.cos(angle);
            this.speedY = baseSpeed * Math.sin(angle);
        }
    }

    update() {
        this.x -= this.speedX;
        this.y += this.speedY;
        this.rotation += 0.35;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation);

        // 濃い緑（#00e676）と光彩効果で視認性をアップ
        ctx.shadowColor = '#00e676';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#00e676';
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-4, -10);
            ctx.lineTo(0, -15);
            ctx.lineTo(4, -10);
            ctx.closePath();
            ctx.fill();
        }

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}


// ========================================
// 足場 & ギミック
// ========================================

let platforms = [];
let obstacles = [];
let springPads = [];
let enemyNinjas = [];
let crows = [];
let flyingShurikens = [];

class Platform {
    constructor(x, y, width, height, type = 'roof') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
    }

    update() {
        this.x -= gameSpeed;
    }

    draw() {
        if (this.type === 'wire') {
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + 2);
            ctx.lineTo(this.x + this.width, this.y + 2);
            ctx.stroke();
            return;
        }

        if (this.type === 'rail') {
            ctx.fillStyle = '#cfd8dc';
            ctx.fillRect(this.x, this.y, this.width, 10);
            ctx.fillStyle = '#90a4ae';
            ctx.fillRect(this.x, this.y + 10, this.width, this.height);
            return;
        }

        ctx.fillStyle = this.type === 'pole' ? '#3e2723' : '#263238';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(this.x, this.y, this.width, 3);

        if (this.type === 'roof') {
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            for (let i = 0; i < this.width; i += 24) {
                ctx.fillRect(this.x + i, this.y + 3, 2, this.height);
            }
        }
    }
}

class SpringPad {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 12;
    }

    update() {
        this.x -= gameSpeed;
    }

    draw() {
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = '#81c784';
        ctx.fillRect(this.x + 3, this.y + 2, this.width - 6, 3);
    }
}

class Obstacle {
    constructor(x, y, width, height, type = 'spike') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
    }

    update() {
        this.x -= gameSpeed;
    }

    draw() {
        ctx.fillStyle = '#ff3d00';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.height);
        ctx.lineTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.closePath();
        ctx.fill();
    }
}


// ========================================
// キャンバス調整（アスペクト比維持）
// ========================================

function resizeCanvas() {
    const wrapper = document.getElementById('main-wrapper');
    if (!wrapper) return;

    const availWidth = wrapper.clientWidth;
    const availHeight = wrapper.clientHeight - 40;

    let w = availWidth;
    let h = availWidth * (9 / 16);

    if (h > availHeight) {
        h = availHeight;
        w = availHeight * (16 / 9);
    }

    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    topControlBar.style.width = `${w}px`;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
}

window.addEventListener('resize', resizeCanvas);


// ========================================
// 初期化 & スポーン
// ========================================

function initGame() {
    score = 0;
    distance = 0;
    gameSpeed = FIXED_GAME_SPEED;
    player.reset();

    platforms = [];
    obstacles = [];
    springPads = [];
    enemyNinjas = [];
    crows = [];
    flyingShurikens = [];

    platforms.push(new Platform(0, 300, 600, 150, 'roof'));
}

function spawnStageElements() {
    const lastPlatform = platforms[platforms.length - 1];
    if (!lastPlatform) return;

    if (lastPlatform.x + lastPlatform.width < CANVAS_WIDTH + 300) {

        // 解禁タイミングの制御フラグ
        const allowCrow = score >= 200;           // 200m: カラス
        const allowSpike = score >= 300;          // 300m: トゲ
        const allowSpring = score >= 500;         // 500m: ジャンプ台
        const allowComplex = score >= 800;        // 800m: 複雑な足場
        const allowEnemy = score >= 1000;         // 1000m: 敵忍者
        const allowFlyingShuriken = score >= 1300; // 1300m: 飛来する手裏剣

        // 足場間隔・幅の設定
        let minGap = 60, maxGap = 100, minWidth = 260, maxWidth = 420;
        if (score >= 1300) {
            minGap = 80; maxGap = 160; minWidth = 180; maxWidth = 350;
        } else if (score >= 800) {
            minGap = 80; maxGap = 140; minWidth = 200; maxWidth = 350;
        } else if (score >= 300) {
            minGap = 70; maxGap = 120; minWidth = 220; maxWidth = 350;
        }

        const rand = Math.random();
        const gap = Math.random() * (maxGap - minGap) + minGap;
        const nextX = lastPlatform.x + lastPlatform.width + gap;

        // 複雑な足場（800m解禁）
        if (allowComplex && rand < 0.3) {
            const bottomY = Math.random() * 50 + 320;
            const topY = bottomY - 140;
            const width = Math.random() * (maxWidth - minWidth) + minWidth;

            const bottomPlat = new Platform(nextX, bottomY, width, CANVAS_HEIGHT - bottomY, 'rail');
            platforms.push(bottomPlat);
            platforms.push(new Platform(nextX + 40, topY, width - 80, 10, 'wire'));

            if (allowEnemy && Math.random() < 0.5) {
                enemyNinjas.push(new EnemyNinja(bottomPlat));
            }
        }
        // 一本橋連続足場（1300m以上で高難易度生成）
        else if (score >= 1300 && rand > 0.75) {
            let poleX = nextX;
            for (let i = 0; i < 3; i++) {
                const poleY = Math.random() * 60 + 250;
                platforms.push(new Platform(poleX, poleY, 75, CANVAS_HEIGHT - poleY, 'pole'));
                poleX += 75 + Math.random() * 60 + 70;
            }
        }
        // 標準屋根足場
        else {
            const heightVariation = (score < 300) ? 50 : 100;
            const nextY = Math.min(Math.max(lastPlatform.y + (Math.random() * heightVariation - heightVariation / 2), 200), 360);
            const width = Math.random() * (maxWidth - minWidth) + minWidth;

            const newPlat = new Platform(nextX, nextY, width, CANVAS_HEIGHT - nextY, 'roof');
            platforms.push(newPlat);

            // 敵忍者（1000m解禁）
            if (allowEnemy && width > 220 && Math.random() < 0.45) {
                enemyNinjas.push(new EnemyNinja(newPlat));
            } else {
                // ジャンプ台（500m解禁）または トゲ（300m解禁）
                const randGimmick = Math.random();
                if (allowSpring && randGimmick < 0.35) {
                    springPads.push(new SpringPad(nextX + 40, nextY - 12));
                } else if (allowSpike && randGimmick < 0.75) {
                    obstacles.push(new Obstacle(nextX + width / 2, nextY - 25, 25, 25, 'spike'));
                }
            }
        }

        // カラス（200m解禁）
        if (allowCrow && Math.random() < 0.35) {
            const crowY = Math.random() * 120 + 100;
            crows.push(new Crow(CANVAS_WIDTH + 100, crowY));
        }

        // 飛来する手裏剣（1300m解禁: 画面右側1/3範囲の 上・下・右端から出現）
        if (allowFlyingShuriken && Math.random() < 0.5) {
            const randSide = Math.random();
            let spawnSide = 'right';
            if (randSide < 0.35) spawnSide = 'top';
            else if (randSide < 0.7) spawnSide = 'bottom';

            flyingShurikens.push(new FlyingShuriken(spawnSide));
        }
    }
}


// ========================================
// 描画
// ========================================

function drawBackground() {
    const bgData = getInterpolatedBg();

    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, bgData.top);
    grad.addColorStop(1, bgData.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = bgData.sunColor;
    ctx.beginPath();
    ctx.arc(660, bgData.sunY, 40, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let i = 0; i < 8; i++) {
        const x = ((i * 120) - (distance * 0.1) % 120);
        ctx.fillRect(x, CANVAS_HEIGHT - 120, 80, 120);
    }
}


// ========================================
// ループ＆更新
// ========================================

function update() {
    if (gameState !== 'PLAYING') return;

    distance += gameSpeed;
    score = Math.floor(distance / 10);

    scoreText.innerText = `${score}m`;

    player.update();

    let currentlyGrounded = false;
    for (let i = platforms.length - 1; i >= 0; i--) {
        const p = platforms[i];
        p.update();

        if (
            player.x + player.width > p.x &&
            player.x < p.x + p.width &&
            player.y + player.height >= p.y &&
            player.y + player.height <= p.y + player.velocityY + 10 &&
            player.velocityY >= 0
        ) {
            player.y = p.y - player.height;
            player.velocityY = 0;
            player.isGrounded = true;
            player.jumpCount = 0;
            currentlyGrounded = true;
        }

        if (p.x + p.width < -100) platforms.splice(i, 1);
    }

    if (!currentlyGrounded) player.isGrounded = false;

    for (let i = enemyNinjas.length - 1; i >= 0; i--) {
        const e = enemyNinjas[i];
        e.update();

        const p = 4;
        if (
            player.x + p < e.x + e.width &&
            player.x + player.width - p > e.x &&
            player.y + p < e.y + e.height &&
            player.y + player.height - p > e.y
        ) {
            triggerGameOver();
        }

        if (e.x + e.width < -100) enemyNinjas.splice(i, 1);
    }

    for (let i = crows.length - 1; i >= 0; i--) {
        const c = crows[i];
        c.update();

        const p = 6;
        if (
            player.x + p < c.x + c.width &&
            player.x + player.width - p > c.x &&
            player.y + p < c.y + c.height &&
            player.y + player.height - p > c.y
        ) {
            triggerGameOver();
        }

        if (c.x + c.width < -100) crows.splice(i, 1);
    }

    for (let i = flyingShurikens.length - 1; i >= 0; i--) {
        const fs = flyingShurikens[i];
        fs.update();

        const p = 5;
        if (
            player.x + p < fs.x + fs.width &&
            player.x + player.width - p > fs.x &&
            player.y + p < fs.y + fs.height &&
            player.y + player.height - p > fs.y
        ) {
            triggerGameOver();
        }

        // 画面外に出て消滅（上下左右の画面外）
        if (fs.x < -150 || fs.x > CANVAS_WIDTH + 200 || fs.y < -100 || fs.y > CANVAS_HEIGHT + 100) {
            flyingShurikens.splice(i, 1);
        }
    }

    for (let i = springPads.length - 1; i >= 0; i--) {
        const s = springPads[i];
        s.update();

        if (
            player.x + player.width > s.x &&
            player.x < s.x + s.width &&
            player.y + player.height >= s.y &&
            player.y + player.height <= s.y + 12 &&
            player.velocityY >= 0
        ) {
            player.jump(-18, true);
        }

        if (s.x + s.width < -50) springPads.splice(i, 1);
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.update();

        const p = 4;
        if (
            player.x + p < obs.x + obs.width &&
            player.x + player.width - p > obs.x &&
            player.y + p < obs.y + obs.height &&
            player.y + player.height - p > obs.y
        ) {
            triggerGameOver();
        }

        if (obs.x + obs.width < -50) obstacles.splice(i, 1);
    }

    if (player.y > CANVAS_HEIGHT + 60) {
        triggerGameOver();
    }

    spawnStageElements();
}

function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    drawBackground();

    platforms.forEach(p => p.draw());
    springPads.forEach(s => s.draw());
    obstacles.forEach(o => o.draw());
    enemyNinjas.forEach(e => e.draw());
    crows.forEach(c => c.draw());
    flyingShurikens.forEach(fs => fs.draw());

    player.draw();
}

function gameLoop() {
    if (gameState === 'PLAYING') {
        update();
        draw();
    }
    animationFrameId = requestAnimationFrame(gameLoop);
}


// ========================================
// ブラウザバック（戻るボタン）制御
// ========================================

function pushGameStateHistory() {
    try {
        history.pushState({ inGame: true }, '', location.href);
    } catch (e) {}
}

window.addEventListener('popstate', (e) => {
    if (gameState === 'PLAYING') {
        pauseGame();
        pushGameStateHistory();
    } else if (gameState === 'PAUSED' || gameState === 'GAMEOVER') {
        goToHome();
        pushGameStateHistory();
    }
});


// ========================================
// 画面切り替え制御
// ========================================

function showScreen(screen) {
    startScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');

    if (screen) {
        screen.classList.remove('hidden');
    }
}

function goToHome() {
    gameState = 'START';
    showScreen(startScreen);
    loadHighScore();

    initGame();
    drawBackground();
    player.draw();
}

function startGame() {
    sfx.init();
    initGame();
    gameState = 'PLAYING';

    pushGameStateHistory();
    showScreen(null);

    if (!animationFrameId) {
        gameLoop();
    }
}

function pauseGame() {
    if (gameState !== 'PLAYING') return;
    gameState = 'PAUSED';
    showScreen(pauseScreen);
}

function resumeGame() {
    if (gameState !== 'PAUSED') return;
    gameState = 'PLAYING';
    pushGameStateHistory();
    showScreen(null);
}

function triggerGameOver() {
    sfx.playHit();
    gameState = 'GAMEOVER';

    saveHighScore(score);

    showScreen(gameOverScreen);
    finalScoreText.innerText = `${score}m`;
}


// ========================================
// 操作系
// ========================================

function handleInput(e) {
    // BUTTONタグ、Aタグ（リンク）、.icon-btnは入力処理から除外する
    if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.closest('a') || e.target.classList.contains('icon-btn'))) return;

    if (e.type === 'touchstart') {
        e.preventDefault();
    }

    if (gameState === 'PLAYING') {
        player.jump();
    }
}

window.addEventListener('touchstart', handleInput, { passive: false });
window.addEventListener('mousedown', handleInput);
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (gameState === 'START' || gameState === 'GAMEOVER') {
            startGame();
        } else if (gameState === 'PAUSED') {
            resumeGame();
        } else if (gameState === 'PLAYING') {
            player.jump();
        }
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
        if (gameState === 'PLAYING') pauseGame();
        else if (gameState === 'PAUSED') resumeGame();
    }
});

function attachButtonEvent(btn, action) {
    const handler = (e) => {
        e.stopPropagation();
        e.preventDefault();
        action();
    };
    btn.addEventListener('click', handler);
    btn.addEventListener('touchstart', handler, { passive: false });
}
