// ========================================
// MRS GAMES - Ski Downhill Rush
// HTML5 Canvas / モバイル対応 横長ゲーム
// ========================================


// ========================================
// 1. 基本設定（画面モードの選択）
// ========================================

const SCREEN_MODE = "LANDSCAPE"; // 横長モード (960x540)

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;

const STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 5;

const STATE = {
    TITLE: "title",
    HIGHSCORE_MODAL: "highscore",
    PLAYING: "playing",
    BIG_JUMPING: "big_jumping",
    PAUSED: "paused",
    GAMEOVER: "gameover",
};

let state = STATE.TITLE;
let score = 0;


// ========================================
// 2. DOM参照
// ========================================

const playArea = document.getElementById("play-area");
const stage = document.getElementById("game-stage");
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const screens = {
    title: document.getElementById("screen-title"),
    highscore: document.getElementById("screen-highscore"),
    pause: document.getElementById("screen-pause"),
    gameover: document.getElementById("screen-gameover"),
};

const scoreValueEl = document.getElementById("score-value");
const jumpBonusValueEl = document.getElementById("jump-bonus-value");
const bestScoreDisplayEl = document.getElementById("best-score-display");
const modalTopScoreEl = document.getElementById("modal-top-score");
const modalBestDistEl = document.getElementById("modal-best-dist");
const modalBestJumpEl = document.getElementById("modal-best-jump");

const goDistValEl = document.getElementById("go-dist-val");
const goJumpsContainerEl = document.getElementById("go-jumps-container");
const gameoverScoreValueEl = document.getElementById("gameover-score-value");
const gameoverNewrecordEl = document.getElementById("gameover-newrecord");

const btnPlay = document.getElementById("btn-play");
const btnHighscore = document.getElementById("btn-highscore");
const btnCloseHighscore = document.getElementById("btn-close-highscore");
const btnPause = document.getElementById("btn-pause");
const btnResume = document.getElementById("btn-resume");
const btnPauseHome = document.getElementById("btn-pause-home");
const btnRetry = document.getElementById("btn-retry");
const btnGameoverHome = document.getElementById("btn-gameover-home");


// ========================================
// 3. レスポンシブCanvas
// ========================================

function resizeCanvas() {
    const rect = playArea.getBoundingClientRect();

    let width = rect.width;
    let height = width / (GAME_WIDTH / GAME_HEIGHT);

    if (height > rect.height) {
        height = rect.height;
        width = height * (GAME_WIDTH / GAME_HEIGHT);
    }

    stage.style.width = `${width}px`;
    stage.style.height = `${height}px`;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = GAME_WIDTH * dpr;
    canvas.height = GAME_HEIGHT * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);


// ========================================
// 4. 汎用当たり判定
// ========================================

function checkCollision(rectA, rectB, padding = 0) {
    return (
        rectA.x + padding < rectB.x + rectB.width - padding &&
        rectA.x + rectA.width - padding > rectB.x + padding &&
        rectA.y + padding < rectB.y + rectB.height - padding &&
        rectA.y + rectA.height - padding > rectB.y + padding
    );
}


// ========================================
// 5. DOM更新の最小化（スコア表示）
// ========================================

let lastDisplayedScore = null;
let lastDisplayedJumpBonus = null;

function setScore(value) {
    score = value;
    if (score !== lastDisplayedScore) {
        scoreValueEl.innerText = `${score}m`;
        lastDisplayedScore = score;
    }
}

function updateJumpBonusUI(bonusValue) {
    if (bonusValue !== lastDisplayedJumpBonus) {
        jumpBonusValueEl.innerText = `${bonusValue}m`;
        lastDisplayedJumpBonus = bonusValue;
    }
}


// ========================================
// 6. SoundFX (Web Audio API)
// ========================================

class SoundFX {
    constructor() {
        this.ctx = null;
    }

    unlock() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === "suspended") {
            this.ctx.resume();
        }
    }

    playJump() {
        if (!this.ctx || this.ctx.state !== "running") return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(500, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    playBigJump() {
        if (!this.ctx || this.ctx.state !== "running") return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(850, this.ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    }

    playFlap() {
        if (!this.ctx || this.ctx.state !== "running") return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
    }

    playLanding() {
        if (!this.ctx || this.ctx.state !== "running") return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playCrash() {
        if (!this.ctx || this.ctx.state !== "running") return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
    }

    playNpcFall() {
        if (!this.ctx || this.ctx.state !== "running") return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
    }

    playNewRecord() {
        if (!this.ctx || this.ctx.state !== "running") return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        osc.frequency.setValueAtTime(783.99, now + 0.2);
        osc.frequency.setValueAtTime(1046.50, now + 0.3);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
    }
}

const sfx = new SoundFX();


// ========================================
// 7. 画面遷移 & ハイスコア管理
// ========================================

let highScoreData = {
    totalScore: 0,
    bestDistance: 0,
    bestJumpBonus: 0
};

function loadHighScore() {
    try {
        const saved = localStorage.getItem("mySkiHighScore");
        if (saved) {
            highScoreData = JSON.parse(saved);
        } else if (window.mySkiHighScore) {
            highScoreData = window.mySkiHighScore;
        }
    } catch(e) {}
    updateHighScoreUI();
}

function saveHighScore(total, dist, jump) {
    highScoreData = {
        totalScore: total,
        bestDistance: dist,
        bestJumpBonus: jump
    };
    try {
        window.mySkiHighScore = highScoreData;
        localStorage.setItem("mySkiHighScore", JSON.stringify(highScoreData));
    } catch(e) {}
    updateHighScoreUI();
}

function updateHighScoreUI() {
    bestScoreDisplayEl.innerText = `BEST SCORE: ${highScoreData.totalScore} pts`;
    modalTopScoreEl.innerText = highScoreData.totalScore;
    modalBestDistEl.innerText = highScoreData.bestDistance;
    modalBestJumpEl.innerText = highScoreData.bestJumpBonus;
}

function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
        el.classList.toggle("hidden", key !== name);
    });
}

function hideAllScreens() {
    Object.values(screens).forEach((el) => el.classList.add("hidden"));
}

function goToTitle() {
    state = STATE.TITLE;
    showScreen("title");
}

function showHighScoreModal() {
    state = STATE.HIGHSCORE_MODAL;
    showScreen("highscore");
}

function startGame() {
    sfx.unlock();
    state = STATE.PLAYING;
    hideAllScreens();
    resetGame();
}

function pauseGame() {
    if (state !== STATE.PLAYING && state !== STATE.BIG_JUMPING) return;
    state = STATE.PAUSED;
    showScreen("pause");
}

function resumeGame() {
    if (state !== STATE.PAUSED) return;
    state = STATE.PLAYING;
    hideAllScreens();
}

function endGame() {
    state = STATE.GAMEOVER;
    sfx.playCrash();

    const currentTotalScore = Math.floor(distance) + totalJumpDistance;
    const isNewHighScore = currentTotalScore > 0 && currentTotalScore > highScoreData.totalScore;

    if (isNewHighScore) {
        saveHighScore(currentTotalScore, Math.floor(distance), totalJumpDistance);
        sfx.playNewRecord();
        gameoverNewrecordEl.style.display = "block";
    } else {
        gameoverNewrecordEl.style.display = "none";
    }

    goDistValEl.innerText = `${Math.floor(distance)}m`;
    gameoverScoreValueEl.innerText = `${currentTotalScore} pts`;

    // ジャンプ内訳の生成
    goJumpsContainerEl.innerHTML = "";
    if (jumpHistory.length === 0) {
        const row = document.createElement("div");
        row.className = "breakdown-row";
        row.innerHTML = `<span>• BIG JUMPS</span><span class="val-green">NONE (+0m)</span>`;
        goJumpsContainerEl.appendChild(row);
    } else {
        const maxDisplay = 3;
        for (let k = 0; k < Math.min(jumpHistory.length, maxDisplay); k++) {
            const row = document.createElement("div");
            row.className = "breakdown-row";
            row.innerHTML = `<span>• BIG JUMP #${k + 1}</span><span class="val-green">+${jumpHistory[k]}m</span>`;
            goJumpsContainerEl.appendChild(row);
        }
        if (jumpHistory.length > maxDisplay) {
            const remainingSum = jumpHistory.slice(maxDisplay).reduce((a, b) => a + b, 0);
            const row = document.createElement("div");
            row.className = "breakdown-row";
            row.innerHTML = `<span>• OTHER JUMPS (${jumpHistory.length - maxDisplay})</span><span class="val-green">+${remainingSum}m</span>`;
            goJumpsContainerEl.appendChild(row);
        }
    }

    showScreen("gameover");
}


// ========================================
// 8. 誤操作防止（ブラウザバック対策）
// ========================================

function initBackButtonGuard() {
    history.pushState({ mrsGame: true }, "");

    window.addEventListener("popstate", () => {
        history.pushState({ mrsGame: true }, "");

        if (state === STATE.PLAYING || state === STATE.BIG_JUMPING) {
            pauseGame();
        } else if (state === STATE.GAMEOVER || state === STATE.HIGHSCORE_MODAL) {
            goToTitle();
        }
    });
}


// ========================================
// 9. 操作入力
// ========================================

function isInteractiveElement(target) {
    return !!(target && target.closest && target.closest("button, a"));
}

function onPrimaryAction() {
    if (state !== STATE.PLAYING && state !== STATE.BIG_JUMPING) return;
    if (player.isFallingInHole) return;

    const now = Date.now();

    if (state === STATE.PLAYING) {
        if (!player.isJumping) {
            player.vAir = player.jumpPower;
            player.isJumping = true;
            player.tapCountInAir = 0;
            player.slowFallTicks = 0;
            player.lastFlapTime = now;
            
            sfx.playJump();
            createSnowSpray(player.slopeX, getSlopeY(player.slopeX), 6);
        } else {
            // 空中での羽ばたき
            player.slowFallTicks = 16;
            player.tapCountInAir++;

            if (player.vAir > 0) {
                player.vAir *= 0.5;
            }

            if (now - player.lastFlapTime > 120) {
                sfx.playFlap();
                createSnowSpray(player.slopeX - 5, getSlopeY(player.slopeX) - player.airOffset, 2);
                player.lastFlapTime = now;
            }
        }
    } else if (state === STATE.BIG_JUMPING) {
        // 大ジャンプ中の羽ばたき
        player.slowFallTicks = 18;
        player.tapCountInAir++;

        if (player.vAir > 0) {
            player.vAir *= 0.5;
        }

        if (now - player.lastFlapTime > 120) {
            sfx.playFlap();
            createSnowSpray(player.slopeX - 5, getSlopeY(player.slopeX) - player.airOffset, 2);
            player.lastFlapTime = now;
        }
    }
}

function bindButtonClick(button, handler) {
    if (!button) return;
    
    const handleEvent = (e) => {
        e.stopPropagation();
        if (e.type === "touchstart") e.preventDefault();
        sfx.unlock();
        handler();
    };

    button.addEventListener("touchstart", handleEvent, { passive: false });
    button.addEventListener("click", (e) => {
        e.stopPropagation();
        sfx.unlock();
        handler();
    });
}

function initInputHandlers() {
    const handleGlobalStart = (event) => {
        if (isInteractiveElement(event.target)) return;

        sfx.unlock();

        if (state === STATE.PLAYING || state === STATE.BIG_JUMPING) {
            if (event.type === "touchstart") event.preventDefault();
            onPrimaryAction();
        }
    };

    window.addEventListener("touchstart", handleGlobalStart, { passive: false });
    window.addEventListener("mousedown", handleGlobalStart);

    window.addEventListener("keydown", (e) => {
        if (e.repeat) return;

        if (e.code === "Space") {
            sfx.unlock();
            if (state === STATE.TITLE) {
                startGame();
            } else if (state === STATE.HIGHSCORE_MODAL) {
                goToTitle();
            } else if (state === STATE.GAMEOVER) {
                startGame();
            } else if (state === STATE.PLAYING || state === STATE.BIG_JUMPING) {
                onPrimaryAction();
            }
        }
    });

    bindButtonClick(btnPlay, startGame);
    bindButtonClick(btnHighscore, showHighScoreModal);
    bindButtonClick(btnCloseHighscore, goToTitle);

    bindButtonClick(btnPause, pauseGame);
    bindButtonClick(btnResume, resumeGame);
    bindButtonClick(btnPauseHome, () => {
        hideAllScreens();
        goToTitle();
    });

    bindButtonClick(btnRetry, startGame);
    bindButtonClick(btnGameoverHome, goToTitle);
}


// ========================================
// 10. ゲームロジック & 変数
// ========================================

const SLOPE_ANGLE = 0.28;
const SLOPE_COS = Math.cos(SLOPE_ANGLE);
const SLOPE_SIN = Math.sin(SLOPE_ANGLE);
const SLOPE_ORIGIN_Y = 200;

function getSlopeY(x) {
    return SLOPE_ORIGIN_Y + x * Math.tan(SLOPE_ANGLE);
}

const BASE_SPEED = 7.0; // 通常・大ジャンプ共通速度
let speed = BASE_SPEED;

let distance = 0;
let totalJumpDistance = 0;
let lastJumpDist = 0; // 直近1回の獲得ボーナス距離
let jumpHistory = [];
let feedbackText = "";
let feedbackTimer = 0;

let nextRampTargetDistance = 1000; // 1回目は1000m、以降+2000m（3000m, 5000m...）

// 障害物出現のタイマーおよびしきい値
let spawnIntervalThreshold = 1100;

const PLAYER_X = 200;
const player = {
    slopeX: PLAYER_X,
    airOffset: 0,
    vAir: 0,
    gravity: 0.65,
    jumpPower: -11.0,
    isJumping: false,
    
    slowFallTicks: 0,
    tapCountInAir: 0,

    isFallingInHole: false,
    fallX: PLAYER_X,
    fallY: 0,

    lastFlapTime: 0,
    jumpStartDist: 0
};

let particles = [];
let obstacles = [];
let spawnTimer = 0;

const MAX_PARTICLES = 40; // 描画負荷軽減のため最適化上限調整

function createSnowSpray(x, y, count = 10) {
    if (particles.length >= MAX_PARTICLES) return;
    const spawnCount = Math.min(count, MAX_PARTICLES - particles.length);

    for (let i = 0; i < spawnCount; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4 - speed * 0.2 * SLOPE_COS,
            vy: (Math.random() - 0.5) * 4 - speed * 0.2 * SLOPE_SIN,
            life: 1.0,
            size: Math.random() * 3 + 2
        });
    }
}

function createHoleObstacle(spawnDist, isLandslide = false, isHuge = false) {
    const holeWidth = isHuge ? (160 + Math.random() * 60) : (70 + Math.random() * 35);
    return { 
        type: "hole", 
        dist: spawnDist, 
        w: holeWidth, 
        isLandslide: isLandslide, 
        isHuge: isHuge,
        opened: !isLandslide, // 通常および大穴は最初から開いている
        collapseY: 0          // 地すべり崩落アニメーション用オフセット
    };
}

function resetGame() {
    speed = BASE_SPEED;
    distance = 0;
    totalJumpDistance = 0;
    lastJumpDist = 0;
    jumpHistory = [];
    obstacles = [];
    particles = [];
    
    spawnTimer = 0; 
    spawnIntervalThreshold = 1100; // 最初は150mに1回程度（しきい値 1000〜1300）
    
    nextRampTargetDistance = 1000;

    feedbackText = "";
    feedbackTimer = 0;

    player.slopeX = PLAYER_X;
    player.airOffset = 0;
    player.vAir = 0;
    player.isJumping = false;
    player.slowFallTicks = 0;
    player.tapCountInAir = 0;
    player.isFallingInHole = false;
    player.fallX = PLAYER_X;
    player.fallY = 0;
    player.lastFlapTime = 0;
    player.jumpStartDist = 0;

    setScore(0);
    updateJumpBonusUI(0);
}

function updateSpawns() {
    if (player.isFallingInHole) return;

    spawnTimer += speed;

    // ★ ジャンプ台出現判定（1回目:1000m, 2回目:3000m, 3回目:5000m, 5000m以降は+2000m毎）
    if (distance >= nextRampTargetDistance) {
        const spawnDist = 1100;
        obstacles.push({ type: "ramp", dist: spawnDist, w: 100, h: 45, triggered: false });
        
        // 次回の目標距離を設定
        if (nextRampTargetDistance === 1000) {
            nextRampTargetDistance = 3000;
        } else if (nextRampTargetDistance === 3000) {
            nextRampTargetDistance = 5000;
        } else {
            nextRampTargetDistance += 2000; // 5000m以降は2000mごと
        }
        
        spawnTimer = -250;
        return;
    }

    // ★ 障害物生成タイマーチェック
    if (spawnTimer > spawnIntervalThreshold) {
        spawnTimer = 0;

        // ★ 滑走1000mごとに段階的に間隔を縮小（難易度アップ＆ゆらぎ）
        if (distance < 500) {
            spawnIntervalThreshold = Math.floor(600 + Math.random() * 400);
        } else if (distance < 1000) {
            spawnIntervalThreshold = Math.floor(400 + Math.random() * 500);
        } else if (distance < 2000) {
            spawnIntervalThreshold = Math.floor(200 + Math.random() * 500);
        } else if (distance < 3000) {
            spawnIntervalThreshold = Math.floor(200 + Math.random() * 400);
        } else if (distance < 4000) {
            spawnIntervalThreshold = Math.floor(200 + Math.random() * 300);
        } else if (distance < 5000) {
            spawnIntervalThreshold = Math.floor(200 + Math.random() * 250);
        } else if (distance < 7000) {
            spawnIntervalThreshold = Math.floor(200 + Math.random() * 200);
        } else {
            spawnIntervalThreshold = Math.floor(150 + Math.random() * 150);
        }

        const spawnDist = 1100;

        // ★ 解禁距離ルール
        let candidates = [];

        if (distance >= 30) candidates.push("snowman");
        if (distance >= 200) candidates.push("hole");
        if (distance >= 1400) candidates.push("tree_normal");
        if (distance >= 2000) candidates.push("skier");
        if (distance >= 3500) candidates.push("tree_tall");
        if (distance >= 4000) candidates.push("snowman_multi");
        if (distance >= 5500) candidates.push("hole_landslide");

        // 6000m以降、ごく稀に「大穴（huge_hole）」を追加
        if (distance >= 6000 && Math.random() < 0.15) {
            candidates.push("huge_hole");
        }
        
        // 3000m以降ごく稀に「歩く雪だるま」を追加
        if (distance >= 3000 && Math.random() < 0.25) {
            candidates.push("walking_snowman");
        }

        // 該当するギミックが解禁されている場合のみランダム選出
        if (candidates.length > 0) {
            const chosen = candidates[Math.floor(Math.random() * candidates.length)];

            if (chosen === "snowman") {
                obstacles.push({ type: "snowman", dist: spawnDist, w: 38, h: 48, isWalking: false });
            } else if (chosen === "walking_snowman") {
                // ゆっくり歩く雪だるま
                obstacles.push({ type: "snowman", dist: spawnDist, w: 38, h: 48, isWalking: true, walkSpeed: 1.0 });
            } else if (chosen === "snowman_multi") {
                const snowCount = Math.random() < 0.6 ? 2 : 3;
                for (let k = 0; k < snowCount; k++) {
                    obstacles.push({ type: "snowman", dist: spawnDist + (k * 42), w: 38, h: 48, isWalking: false });
                }
            } else if (chosen === "hole") {
                obstacles.push(createHoleObstacle(spawnDist, false, false));
            } else if (chosen === "huge_hole") {
                obstacles.push(createHoleObstacle(spawnDist, false, true)); // 6000m以降のごく稀な大穴
            } else if (chosen === "hole_landslide") {
                obstacles.push(createHoleObstacle(spawnDist, true, false));
            } else if (chosen === "tree_normal") {
                obstacles.push({ type: "tree", dist: spawnDist, w: 48, h: 75, isTall: false });
            } else if (chosen === "skier") {
                obstacles.push({ type: "skier", dist: spawnDist, w: 40, h: 58, relSpeed: 2.0, falling: false, fallY: 0 });
            } else if (chosen === "tree_tall") {
                obstacles.push({ type: "tree", dist: spawnDist, w: 58, h: 110, isTall: true });
            }
        }
    }
}

function triggerBigJump(rampObs) {
    if (rampObs.triggered) return;
    rampObs.triggered = true;

    state = STATE.BIG_JUMPING;
    player.vAir = -15;
    player.airOffset = 10;
    player.slowFallTicks = 0;
    player.tapCountInAir = 0;
    
    speed = BASE_SPEED;
    player.jumpStartDist = distance;
    lastJumpDist = 0;

    sfx.playBigJump();
}

function update(dtMs) {
    if (state === STATE.TITLE || state === STATE.HIGHSCORE_MODAL) {
        distance += 0.5;
        if (Math.random() < 0.2) {
            createSnowSpray(PLAYER_X - 10, getSlopeY(PLAYER_X), 1);
        }
        updateParticles();
        return;
    }

    if (state === STATE.PLAYING || state === STATE.BIG_JUMPING) {
        distance += speed * 0.12;
        setScore(Math.floor(distance));

        if (state === STATE.BIG_JUMPING) {
            lastJumpDist = distance - player.jumpStartDist;
        }

        updateJumpBonusUI(Math.floor(lastJumpDist));
        updateSpawns();

        for (let i = obstacles.length - 1; i >= 0; i--) {
            let obs = obstacles[i];
            
            if (obs.type === "skier") {
                if (!obs.falling) {
                    obs.dist -= (speed - obs.relSpeed);

                    // 穴との衝突チェック（配列の再生成なし）
                    for (let j = 0; j < obstacles.length; j++) {
                        const h = obstacles[j];
                        if (h.type === "hole" && h.opened) {
                            const holeLeft = h.dist - h.w / 2;
                            const holeRight = h.dist + h.w / 2;
                            if (obs.dist >= holeLeft && obs.dist <= holeRight) {
                                obs.falling = true;
                                sfx.playNpcFall();
                                break;
                            }
                        }
                    }
                } else {
                    obs.fallY += 10;
                    obs.dist -= speed * 0.5;
                }
            } else if (obs.type === "snowman" && obs.isWalking) {
                obs.dist -= (speed + obs.walkSpeed);
            } else {
                obs.dist -= speed;
            }

            const ox = obs.dist;
            const px = player.slopeX;

            // 地すべり穴のアニメーション＆オープン判定
            if (obs.type === "hole" && obs.isLandslide) {
                if (ox - px <= 250 && obs.collapseY === 0) {
                    obs.opened = true;
                    createSnowSpray(ox, getSlopeY(ox), 12);
                }

                if (obs.opened && obs.collapseY < 80) {
                    obs.collapseY += 3.5;
                }
            }

            if (!player.isFallingInHole && obs.type === "hole" && obs.opened && (!obs.isLandslide || obs.collapseY > 15)) {
                const holeLeft = ox - obs.w * 0.35;
                const holeRight = ox + obs.w * 0.35;

                if (px >= holeLeft && px <= holeRight && player.airOffset <= 5) {
                    player.isFallingInHole = true;
                    player.fallX = px;
                    player.fallY = 0;
                    sfx.playNpcFall();
                }
            } else if (!player.isFallingInHole && obs.type === "ramp") {
                const rampStart = ox - obs.w / 2;
                const rampTip = ox + obs.w / 2;

                if (px >= rampStart && px <= rampTip) {
                    if (player.airOffset < 30 && !obs.triggered) {
                        triggerBigJump(obs);
                    }
                }
            } else if (!player.isFallingInHole && obs.type === "skier") {
                if (!obs.falling && Math.abs(ox - px) < 28) {
                    if (player.airOffset < obs.h * 0.7) {
                        endGame();
                        return;
                    }
                }
            } else if (!player.isFallingInHole && Math.abs(ox - px) < 28) {
                if (player.airOffset < obs.h * 0.72) {
                    endGame();
                    return;
                }
            }

            // 画面左端へ画面外消滅した場合の処理
            if (obs.dist < -200 || (obs.falling && obs.fallY > GAME_HEIGHT)) {
                obstacles.splice(i, 1);
            }
        }
    }

    if (player.isFallingInHole) {
        player.fallY += 11;
        player.fallX -= speed * 0.4;

        const currentDisplayY = getSlopeY(player.fallX) + player.fallY;

        if (currentDisplayY > GAME_HEIGHT + 80) {
            endGame();
            return;
        }
    }

    if (state === STATE.PLAYING && !player.isFallingInHole) {
        if (player.isJumping) {
            let currentGravity = player.gravity * 0.65;
            
            if (player.slowFallTicks > 0 && player.vAir >= 0) {
                currentGravity *= 0.15;
                player.slowFallTicks--;
            } else if (player.slowFallTicks > 0 && player.vAir < 0) {
                player.slowFallTicks--;
            }

            player.vAir += currentGravity;
            player.airOffset -= player.vAir;

            if (player.airOffset <= 0) {
                createSnowSpray(player.slopeX, getSlopeY(player.slopeX), 8);
                sfx.playLanding();
                player.airOffset = 0;
                player.vAir = 0;
                player.isJumping = false;
                player.slowFallTicks = 0;
            }
        } else {
            if (Math.random() < 0.3) {
                createSnowSpray(player.slopeX - 10, getSlopeY(player.slopeX), 1);
            }
        }

    } else if (state === STATE.BIG_JUMPING && !player.isFallingInHole) {
        let currentGravity = player.gravity * 0.35;
        if (player.slowFallTicks > 0 && player.vAir >= 0) {
            currentGravity *= 0.15;
            player.slowFallTicks--;
        } else if (player.slowFallTicks > 0 && player.vAir < 0) {
            player.slowFallTicks--;
        }

        player.vAir += currentGravity;
        player.airOffset -= player.vAir;

        if (player.airOffset > 320) {
            player.airOffset = 320;
            if (player.vAir < 0) player.vAir = 0;
        }

        // 着地判定
        if (player.airOffset <= 0) {
            player.airOffset = 0;
            player.vAir = 0;
            state = STATE.PLAYING;

            createSnowSpray(player.slopeX, getSlopeY(player.slopeX), 12);
            sfx.playLanding();

            const landedJumpBonus = Math.floor(lastJumpDist);
            jumpHistory.push(landedJumpBonus);
            totalJumpDistance += landedJumpBonus;

            feedbackText = `BIG JUMP #${jumpHistory.length}: +${landedJumpBonus}m!`;
            feedbackTimer = 60;
        }
    }

    if (feedbackTimer > 0) feedbackTimer--;

    updateParticles();
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.04;
        if (p.life <= 0) particles.splice(i, 1);
    }
}


// ========================================
// 11. 描画処理 (軽量化・最適化済み)
// ========================================

const skyGrad = ctx.createLinearGradient(0, 0, GAME_WIDTH, GAME_HEIGHT);
skyGrad.addColorStop(0, "#75c6f1");
skyGrad.addColorStop(0.6, "#bce3f7");
skyGrad.addColorStop(1, "#e8f5fb");

function render() {
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 山並み
    ctx.fillStyle = "#a9d2e9";
    ctx.beginPath();
    ctx.moveTo(0, 180);
    ctx.lineTo(200, 80);
    ctx.lineTo(450, 220);
    ctx.lineTo(700, 90);
    ctx.lineTo(960, 240);
    ctx.lineTo(960, GAME_HEIGHT);
    ctx.lineTo(0, GAME_HEIGHT);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#2b384a";
    ctx.lineWidth = 2;

    let currentX = -100;

    // 地面・穴・ジャンプ台の連続描画（ソート用新配列を作らず直接ループ処理）
    for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        if (obs.type === "hole" && obs.opened) {
            const hLeft = obs.dist - obs.w / 2;
            const hRight = obs.dist + obs.w / 2;

            if (hLeft > currentX) {
                drawSlopeBlock(currentX, hLeft);
            }

            if (obs.isLandslide && obs.collapseY < 75) {
                drawCollapsingBlock(hLeft, hRight, obs.collapseY);
            }

            currentX = Math.max(currentX, hRight);

        } else if (obs.type === "ramp") {
            const rStart = obs.dist - obs.w / 2;
            const rEnd = obs.dist + obs.w / 2;

            if (rStart > currentX) {
                drawSlopeBlock(currentX, rStart);
            }
            drawRampBlock(rStart, rEnd, obs.h);
            currentX = Math.max(currentX, rEnd);
        }
    }

    if (currentX < GAME_WIDTH + 100) {
        drawSlopeBlock(currentX, GAME_WIDTH + 100);
    }

    function drawSlopeBlock(x1, x2) {
        const y1 = getSlopeY(x1);
        const y2 = getSlopeY(x2);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, GAME_HEIGHT + 100);
        ctx.lineTo(x1, GAME_HEIGHT + 100);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.fillStyle = "rgba(150, 180, 200, 0.15)";
        ctx.fillRect(x1, y1 + 5, 4, GAME_HEIGHT);
        ctx.fillRect(x2 - 4, y2 + 5, 4, GAME_HEIGHT);
        ctx.fillStyle = "#ffffff";
    }

    function drawCollapsingBlock(x1, x2, offsetY) {
        const y1 = getSlopeY(x1) + offsetY;
        const y2 = getSlopeY(x2) + offsetY;

        ctx.save();
        ctx.fillStyle = "#e0f2fe";
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, y2 + 35);
        ctx.lineTo(x1, y1 + 35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    function drawRampBlock(x1, x2, height) {
        const y1 = getSlopeY(x1);
        const y2 = getSlopeY(x2);

        ctx.beginPath();
        ctx.moveTo(x1, y1);

        const cp1x = x1 + (x2 - x1) * 0.5;
        const cp1y = y1 + (y2 - y1) * 0.5;
        const cp2x = x1 + (x2 - x1) * 0.8;
        const cp2y = y2 - height * 0.2;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2 - height);
        ctx.lineTo(x2, GAME_HEIGHT + 100);
        ctx.lineTo(x1, GAME_HEIGHT + 100);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2 - height);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
    }

    // スピードライン
    if (state === STATE.PLAYING || state === STATE.BIG_JUMPING) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            let lx = (Date.now() * (speed * 0.2) + i * 180) % (GAME_WIDTH + 200) - 100;
            let ly = getSlopeY(lx) - Math.random() * 200;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx - 30 * SLOPE_COS, ly - 30 * SLOPE_SIN);
            ctx.stroke();
        }
    }

    // 障害物描画（画面外スキップ機能付き）
    const nowTime = Date.now();
    for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        if ((obs.type === "hole" && obs.opened) || obs.type === "ramp") continue;

        const ox = obs.dist;
        // 画面の視界外（左右100px外）にある場合は描画スキップして軽量化
        if (ox < -100 || ox > GAME_WIDTH + 100) continue;

        const oy = getSlopeY(ox) + (obs.falling ? obs.fallY : 0);

        ctx.save();
        ctx.translate(ox, oy);

        const walkWobble = (obs.type === "snowman" && obs.isWalking) ? Math.sin(nowTime * 0.015) * 0.18 : 0;
        ctx.rotate(SLOPE_ANGLE + (obs.falling ? 0.4 : walkWobble));

        if (obs.type === "hole" && obs.isLandslide && !obs.opened) {
            ctx.strokeStyle = "rgba(180, 50, 50, 0.45)";
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(-obs.w / 2, 0);
            ctx.lineTo(obs.w / 2, 0);
            ctx.stroke();
            ctx.setLineDash([]);
        } else if (obs.type === "tree") {
            const trunkW = obs.isTall ? 10 : 8;
            const trunkH = obs.isTall ? 18 : 14;
            ctx.fillStyle = "#5d4037";
            ctx.fillRect(-trunkW / 2, -trunkH, trunkW, trunkH);
            ctx.fillStyle = obs.isTall ? "#1b5e20" : "#2e7d32";
            ctx.beginPath();
            ctx.moveTo(-obs.w / 2, -trunkH);
            ctx.lineTo(0, -obs.h);
            ctx.lineTo(obs.w / 2, -trunkH);
            ctx.fill();
        } else if (obs.type === "snowman") {
            ctx.fillStyle = "#e0f7fa";
            ctx.beginPath();
            ctx.arc(0, -14, 15, 0, Math.PI * 2);
            ctx.arc(0, -34, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#ff6d00";
            if (obs.isWalking) {
                ctx.fillRect(-10, -36, 8, 3);
            } else {
                ctx.fillRect(2, -36, 8, 3);
            }

            ctx.fillStyle = "#263238";
            ctx.fillRect(-8, -44, 16, 3);
            ctx.fillRect(-5, -52, 10, 8);
        } else if (obs.type === "skier") {
            ctx.fillStyle = "#ffb300";
            ctx.fillRect(-10, -40, 20, 26);
            ctx.fillStyle = "#212121";
            ctx.beginPath();
            ctx.arc(0, -45, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#d32f2f";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-20, -2);
            ctx.lineTo(25, -2);
            ctx.stroke();

            if (obs.falling) {
                ctx.fillStyle = "#ff1744";
                ctx.font = "bold 18px sans-serif";
                ctx.fillText("AAAAH!", -24, -58);
            }
        }

        ctx.restore();
    }

    // 雪パーティクル描画（高速化）
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.fillStyle = `rgba(255, 255, 255, ${p.life})`;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }

    // プレイヤー描画
    const px = player.isFallingInHole ? player.fallX : player.slopeX;
    const py = player.isFallingInHole ? (getSlopeY(player.fallX) + player.fallY) : (getSlopeY(px) - player.airOffset);

    ctx.save();
    ctx.translate(px, py);
    const leanAngle = SLOPE_ANGLE + (player.isFallingInHole ? 0.4 : (player.airOffset > 0 ? -0.15 : 0.15));
    ctx.rotate(leanAngle);

    if (player.airOffset > 0 && !player.isFallingInHole) {
        ctx.save();
        ctx.translate(0, player.airOffset);
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // スキー板
    ctx.strokeStyle = "#0288d1";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-20, -2);
    ctx.lineTo(25, -2);
    ctx.stroke();

    // ウェア
    ctx.fillStyle = "#d32f2f";
    ctx.fillRect(-8, -30, 16, 22);

    // ヘルメット
    ctx.fillStyle = "#1565c0";
    ctx.beginPath();
    ctx.arc(4, -33, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffeb3b";
    ctx.fillRect(6, -35, 5, 4);

    // ストック
    ctx.strokeStyle = "#78909c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2, -20);
    ctx.lineTo(-18, -2);
    ctx.stroke();

    ctx.restore();

    // プレイ中テキスト
    if (state === STATE.PLAYING || state === STATE.BIG_JUMPING) {
        if (state === STATE.BIG_JUMPING) {
            ctx.fillStyle = "#ff6d00";
            ctx.font = "bold 20px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("TAP TAP TO FLOAT! 🪂", px, py - 55);

            ctx.fillStyle = "#00e676";
            ctx.font = "bold 16px sans-serif";
            ctx.fillText(`Air Bonus: +${Math.floor(lastJumpDist)}m`, px, py - 30);
        }

        if (feedbackTimer > 0) {
            ctx.fillStyle = "#ff6f00";
            ctx.font = "bold 32px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(feedbackText, GAME_WIDTH / 2, 110);
        }
    }
}


// ========================================
// 12. 固定60FPSゲームループ
// ========================================

let lastTimestamp = 0;
let accumulator = 0;

function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    if (!lastTimestamp) {
        lastTimestamp = timestamp;
        return;
    }

    let frameDelta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    if (frameDelta > STEP_MS * MAX_STEPS_PER_FRAME) {
        frameDelta = STEP_MS * MAX_STEPS_PER_FRAME;
    }

    accumulator += frameDelta;

    while (accumulator >= STEP_MS) {
        if (state === STATE.PLAYING || state === STATE.BIG_JUMPING || state === STATE.TITLE || state === STATE.HIGHSCORE_MODAL) {
            update(STEP_MS);
        }
        accumulator -= STEP_MS;
    }

    render();
}


// ========================================
// 13. 初期化
// ========================================

function init() {
    resizeCanvas();
    loadHighScore();
    initInputHandlers();
    initBackButtonGuard();
    resetGame();
    goToTitle();

    requestAnimationFrame(gameLoop);
}

document.addEventListener("DOMContentLoaded", init);