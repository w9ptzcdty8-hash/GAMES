// ========================================
// 寿司パニック - MRS GAMES
// HTML5 Canvas / モバイル対応
// ========================================

const GAME_WIDTH = 480;
const GAME_HEIGHT = 854;

const STATE = {
    TITLE: "title",
    HOWTO: "howto",
    HIGHSCORE: "highscore",
    PLAYING: "playing",
    PAUSED: "paused",
    GAMEOVER: "gameover",
};

// ========================================
// バランス調整用パラメータ（調整しやすいようにまとめて定義）
// ========================================
const RATING_CONFIG = {
    SUCCESS_EACH: 0.01,  // 提供成功（途中皿）時の評判増加量
    SUCCESS_FULL: 0.3,   // 満足退店（規定皿達成）時の評判増加量
    MISS_SERVE: -0.5,    // 誤提供（間違えた寿司）時の基本評判減少量
    MISS_TIMEOUT: -0.8,  // タイムアウト（見逃し）時の基本評判減少量
    TRASH_PENALTY_SCORE: 100, // 廃棄時のスコア減少額
};

// ========================================
// DOM参照
// ========================================

const playArea = document.getElementById("play-area");
const stage = document.getElementById("game-stage");
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const loadingEl = document.getElementById("loading");

// ========================================
// レスポンシブCanvas
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
// Canvasプリレンダリング
// ========================================

const assets = {};

function createAsset(key, w, h, renderFunc) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const cCtx = c.getContext("2d");
    renderFunc(cCtx, w, h);
    assets[key] = c;
}

function renderTable(cCtx, w, h) {
    const grad = cCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#c9a06a');
    grad.addColorStop(0.45, '#c0975b');
    grad.addColorStop(1, '#9c703c');
    cCtx.fillStyle = grad;
    cCtx.fillRect(0, 0, w, h);

    cCtx.strokeStyle = 'rgba(110, 72, 34, 0.22)';
    cCtx.lineWidth = 2;
    for (let i = 0; i < w; i += 32) {
        const x = i + (Math.random()-0.5)*6;
        cCtx.beginPath();
        cCtx.moveTo(x, 0);
        cCtx.bezierCurveTo(x + 8, h*0.3, x - 8, h*0.65, x + (Math.random()-0.5)*10, h);
        cCtx.stroke();
    }
    cCtx.strokeStyle = 'rgba(80, 50, 24, 0.35)';
    cCtx.lineWidth = 3;
    [0.4, 0.78].forEach(f => {
        cCtx.beginPath();
        cCtx.moveTo(0, h*f);
        cCtx.lineTo(w, h*f + (Math.random()-0.5)*4);
        cCtx.stroke();
    });
    const vign = cCtx.createLinearGradient(0, 0, 0, 150);
    vign.addColorStop(0, 'rgba(25,16,8,0.4)');
    vign.addColorStop(1, 'rgba(25,16,8,0)');
    cCtx.fillStyle = vign;
    cCtx.fillRect(0, 0, w, 150);
}

function renderNoren(cCtx, w, h) {
    cCtx.fillStyle = '#33210f';
    cCtx.fillRect(0, 0, w, 9);
    cCtx.fillStyle = '#54341a';
    cCtx.fillRect(0, 9, w, 3);

    const panelCount = 5;
    const gap = 5;
    const panelW = (w - gap*(panelCount-1)) / panelCount;
    const dropH = h * 0.6;
    for (let i = 0; i < panelCount; i++) {
        const x = i * (panelW + gap);
        const g = cCtx.createLinearGradient(0, 12, 0, h);
        g.addColorStop(0, '#20456b');
        g.addColorStop(1, '#14283f');
        cCtx.fillStyle = g;
        cCtx.beginPath();
        cCtx.moveTo(x, 12);
        cCtx.lineTo(x + panelW, 12);
        cCtx.lineTo(x + panelW, dropH);
        cCtx.lineTo(x + panelW * 0.5, h);
        cCtx.lineTo(x, dropH);
        cCtx.closePath();
        cCtx.fill();
    }
    const cx = w/2, cy = h*0.4;
    cCtx.fillStyle = 'rgba(244,238,230,0.95)';
    cCtx.beginPath(); cCtx.arc(cx, cy, 24, 0, Math.PI*2); cCtx.fill();
    cCtx.fillStyle = '#1c3d5f';
    cCtx.font = 'bold 28px serif';
    cCtx.textAlign = 'center'; cCtx.textBaseline = 'middle';
    cCtx.fillText('鮨', cx, cy + 2);
    cCtx.textBaseline = 'alphabetic';
}

function renderChochin(cCtx, w, h) {
    cCtx.strokeStyle = '#3a2415'; cCtx.lineWidth = 3;
    cCtx.beginPath(); cCtx.moveTo(w/2, 0); cCtx.lineTo(w/2, 14); cCtx.stroke();

    cCtx.shadowColor = 'rgba(0,0,0,0.35)'; cCtx.shadowBlur = 16; cCtx.shadowOffsetY = 8;
    const grad = cCtx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#a8241a'); grad.addColorStop(0.5, '#e2452c'); grad.addColorStop(1, '#a8241a');
    cCtx.fillStyle = grad;
    cCtx.beginPath();
    cCtx.moveTo(w*0.5, 14);
    cCtx.bezierCurveTo(w*0.02, 32, w*0.0, h*0.78, w*0.5, h-8);
    cCtx.bezierCurveTo(w*1.0, h*0.78, w*0.98, 32, w*0.5, 14);
    cCtx.closePath();
    cCtx.fill();
    cCtx.shadowColor = 'transparent';

    cCtx.strokeStyle = 'rgba(40,10,5,0.35)'; cCtx.lineWidth = 1.5;
    [0.2, 0.4, 0.6, 0.8].forEach(f => {
        const yy = 14 + (h-24)*f;
        const rx = Math.sin(f*Math.PI) * w*0.48 + 4;
        cCtx.beginPath(); cCtx.ellipse(w/2, yy, rx, 4, 0, 0, Math.PI*2); cCtx.stroke();
    });

    cCtx.fillStyle = '#f6ecd9';
    cCtx.font = 'bold 26px serif';
    cCtx.textAlign = 'center'; cCtx.textBaseline = 'middle';
    cCtx.fillText('鮨', w/2, h/2 + 4);
    cCtx.textBaseline = 'alphabetic';

    cCtx.fillStyle = '#2a1a10';
    cCtx.beginPath(); cCtx.ellipse(w/2, 16, 14, 6, 0, 0, Math.PI*2); cCtx.fill();
    cCtx.beginPath(); cCtx.ellipse(w/2, h-8, 12, 5, 0, 0, Math.PI*2); cCtx.fill();
    cCtx.fillStyle = '#c9973a';
    cCtx.beginPath(); cCtx.arc(w/2, h-2, 3, 0, Math.PI*2); cCtx.fill();
}

function renderHangiri(cCtx, w, h) {
    cCtx.shadowColor = 'rgba(0,0,0,0.3)';
    cCtx.shadowBlur = 12;
    cCtx.shadowOffsetY = 6;

    cCtx.fillStyle = '#e8b97d';
    cCtx.beginPath(); cCtx.ellipse(w/2, h/2, w/2-10, h/2-30, 0, 0, Math.PI*2); cCtx.fill();

    cCtx.shadowColor = 'transparent';
    cCtx.fillStyle = '#d49648';
    cCtx.beginPath(); cCtx.ellipse(w/2, h/2-15, w/2-15, h/2-40, 0, 0, Math.PI*2); cCtx.fill();

    cCtx.fillStyle = '#ffffff';
    cCtx.beginPath(); cCtx.ellipse(w/2, h/2-15, w/2-20, h/2-45, 0, 0, Math.PI*2); cCtx.fill();
    
    cCtx.fillStyle = '#f9f9f9';
    cCtx.strokeStyle = 'rgba(0,0,0,0.06)';
    cCtx.lineWidth = 1;
    for(let i=0; i<500; i++) {
        const a = Math.random() * Math.PI*2;
        const r = Math.sqrt(Math.random()) * (w/2-25);
        const rx = w/2 + Math.cos(a)*r;
        const ry = h/2-15 + Math.sin(a)*r*((h/2-45)/(w/2-20));
        
        cCtx.save();
        cCtx.translate(rx, ry);
        cCtx.rotate(Math.random()*Math.PI);
        cCtx.beginPath(); cCtx.ellipse(0, 0, 4, 2, 0, 0, Math.PI*2);
        cCtx.fill(); cCtx.stroke();
        cCtx.restore();
    }

    const grad = cCtx.createLinearGradient(0, h/2, 0, h);
    grad.addColorStop(0, '#f2ca99');
    grad.addColorStop(1, '#b57933');
    cCtx.fillStyle = grad;
    cCtx.beginPath();
    cCtx.ellipse(w/2, h/2, w/2-10, h/2-30, 0, 0, Math.PI);
    cCtx.lineTo(w/2-10, h-30);
    cCtx.bezierCurveTo(w/2-10, h, w/2+w/2-10, h, w-10, h-30);
    cCtx.lineTo(w-10, h/2);
    cCtx.fill();

    cCtx.strokeStyle = '#c47833'; cCtx.lineWidth = 4;
    cCtx.beginPath(); cCtx.ellipse(w/2, h/2+12, w/2-10, h/2-30, 0, 0, Math.PI); cCtx.stroke();
    cCtx.beginPath(); cCtx.ellipse(w/2, h/2+32, w/2-10, h/2-30, 0, 0, Math.PI); cCtx.stroke();
}

function renderManaita(cCtx, w, h) {
    cCtx.shadowColor = 'rgba(0,0,0,0.4)';
    cCtx.shadowBlur = 10;
    cCtx.shadowOffsetY = 6;
    
    cCtx.fillStyle = '#facd96';
    cCtx.beginPath(); cCtx.roundRect(10, 10, w-20, h-30, 10); cCtx.fill();
    cCtx.shadowColor = 'transparent';

    cCtx.fillStyle = '#d49648';
    cCtx.beginPath(); cCtx.roundRect(10, h-25, w-20, 15, {bottomLeft:10, bottomRight:10}); cCtx.fill();

    cCtx.strokeStyle = 'rgba(186, 142, 91, 0.3)'; cCtx.lineWidth = 2;
    for(let i=25; i<h-30; i+=20) {
        cCtx.beginPath(); cCtx.moveTo(10, i); cCtx.lineTo(w-10, i); cCtx.stroke();
    }
}

function drawPlateBase(cCtx, w, h) {
    cCtx.shadowColor = 'rgba(0,0,0,0.35)';
    cCtx.shadowBlur = 8;
    cCtx.shadowOffsetY = 4;
    cCtx.fillStyle = '#1c1a1a';
    cCtx.beginPath(); cCtx.arc(w/2, h/2, w/2-10, 0, Math.PI*2); cCtx.fill();
    cCtx.shadowColor = 'transparent';

    cCtx.fillStyle = 'rgba(255,255,255,0.07)';
    cCtx.beginPath(); cCtx.ellipse(w/2-9, h/2-13, w/2-24, 9, -0.3, 0, Math.PI*2); cCtx.fill();

    cCtx.strokeStyle = '#c9973a'; cCtx.lineWidth = 3;
    cCtx.beginPath(); cCtx.arc(w/2, h/2, w/2-13, 0, Math.PI*2); cCtx.stroke();
    cCtx.strokeStyle = 'rgba(201,151,58,0.4)'; cCtx.lineWidth = 1;
    cCtx.beginPath(); cCtx.arc(w/2, h/2, w/2-18, 0, Math.PI*2); cCtx.stroke();
}

function renderWasabiPlate(cCtx, w, h) {
    drawPlateBase(cCtx, w, h);
    cCtx.fillStyle = '#89c938';
    cCtx.beginPath();
    cCtx.moveTo(w/2, h/2-18);
    cCtx.quadraticCurveTo(w/2+20, h/2, w/2+12, h/2+16);
    cCtx.quadraticCurveTo(w/2, h/2+24, w/2-12, h/2+16);
    cCtx.quadraticCurveTo(w/2-20, h/2, w/2, h/2-18);
    cCtx.fill();
    
    cCtx.fillStyle = '#abf048';
    for(let i=0; i<25; i++) {
        cCtx.beginPath();
        cCtx.arc(w/2+(Math.random()-0.5)*24, h/2+(Math.random()-0.5)*24+3, 2+Math.random()*2, 0, Math.PI*2);
        cCtx.fill();
    }
}

function renderNoriPlate(cCtx, w, h) {
    drawPlateBase(cCtx, w, h);
    cCtx.shadowColor = 'rgba(0,0,0,0.4)'; cCtx.shadowBlur = 4;
    for(let i=0; i<3; i++) {
        cCtx.save();
        cCtx.translate(w/2 - 8 + i*8, h/2 + 3 - i*3);
        cCtx.rotate(Math.PI/15 * (i-1));
        cCtx.fillStyle = '#171c15'; cCtx.fillRect(-18, -22, 36, 44);
        cCtx.strokeStyle = '#2d3b28'; cCtx.strokeRect(-18, -22, 36, 44);
        cCtx.restore();
    }
    cCtx.shadowColor = 'transparent';
}

function renderKnife(cCtx, w, h) {
    cCtx.shadowColor = 'rgba(0,0,0,0.5)'; cCtx.shadowBlur = 8; cCtx.shadowOffsetY = 4;
    cCtx.fillStyle = '#3a1f14'; cCtx.beginPath(); cCtx.roundRect(5, h/2-8, 65, 16, 3); cCtx.fill();
    cCtx.strokeStyle = 'rgba(0,0,0,0.3)'; cCtx.lineWidth = 1;
    for (let i = 12; i < 60; i += 6) { cCtx.beginPath(); cCtx.moveTo(i, h/2-8); cCtx.lineTo(i-4, h/2+8); cCtx.stroke(); }
    cCtx.fillStyle = '#c9973a'; cCtx.beginPath(); cCtx.arc(25, h/2, 2.5, 0, Math.PI*2); cCtx.arc(50, h/2, 2.5, 0, Math.PI*2); cCtx.fill();
    
    const grad = cCtx.createLinearGradient(70, 0, w, 0);
    grad.addColorStop(0, '#e0e0e0'); grad.addColorStop(0.5, '#ffffff'); grad.addColorStop(1, '#999999');
    cCtx.fillStyle = grad;
    cCtx.beginPath(); cCtx.moveTo(70, h/2-6); cCtx.lineTo(w-10, h/2-6); cCtx.lineTo(w-40, h/2+6); cCtx.lineTo(70, h/2+6); cCtx.closePath(); cCtx.fill();
    cCtx.fillStyle = 'rgba(255,255,255,0.7)'; cCtx.fillRect(70, h/2-6, w-90, 2);
    cCtx.shadowColor = 'transparent';
}

function sashimiSlicePath(w, h) {
    const j = () => (Math.random()-0.5)*3;
    const p = new Path2D();
    p.moveTo(9, 30+j());
    p.quadraticCurveTo(w*0.32, 3+j(), w*0.55, 4+j());
    p.quadraticCurveTo(w-8, 10+j(), w-9, 38+j());
    p.quadraticCurveTo(w-4, 60+j(), w-22, 76+j());
    p.quadraticCurveTo(w*0.5, 68+j(), 14, 66+j());
    p.quadraticCurveTo(6, 48+j(), 9, 30+j());
    p.closePath();
    return p;
}

function renderMaguro(cCtx, w, h) {
    const path = sashimiSlicePath(w, h);
    cCtx.save();
    cCtx.clip(path);
    const grad = cCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#ff5c68'); grad.addColorStop(0.4, '#e8283a');
    grad.addColorStop(0.75, '#b8101f'); grad.addColorStop(1, '#7c0613');
    cCtx.fillStyle = grad; cCtx.fillRect(0, 0, w, h);

    cCtx.strokeStyle = 'rgba(255,255,255,0.5)'; cCtx.lineWidth = 2;
    for (let i = 14; i < w-8; i += 11) {
        cCtx.beginPath();
        cCtx.moveTo(i + (Math.random()-0.5)*3, 4);
        cCtx.bezierCurveTo(i+9, h*0.4, i-7, h*0.6, i+11+(Math.random()-0.5)*3, h-4);
        cCtx.stroke();
    }
    cCtx.fillStyle = 'rgba(255,255,255,0.22)';
    cCtx.beginPath(); cCtx.ellipse(w*0.42, h*0.24, w*0.36, h*0.14, -0.15, 0, Math.PI*2); cCtx.fill();
    cCtx.strokeStyle = 'rgba(255,255,255,0.45)'; cCtx.lineWidth = 1.4;
    cCtx.beginPath(); cCtx.moveTo(w*0.16, h*0.16); cCtx.quadraticCurveTo(w*0.36, h*0.06, w*0.58, h*0.13); cCtx.stroke();
    const shGrad = cCtx.createLinearGradient(0, h-16, 0, h);
    shGrad.addColorStop(0, 'rgba(0,0,0,0)'); shGrad.addColorStop(1, 'rgba(0,0,0,0.25)');
    cCtx.fillStyle = shGrad; cCtx.fillRect(0, h-16, w, 16);
    cCtx.restore();

    cCtx.strokeStyle = 'rgba(120,10,15,0.35)'; cCtx.lineWidth = 1.5;
    cCtx.stroke(path);
}

function renderSalmon(cCtx, w, h) {
    const path = sashimiSlicePath(w, h);
    cCtx.save();
    cCtx.clip(path);
    const grad = cCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#ffa666'); grad.addColorStop(0.5, '#ff7a3d'); grad.addColorStop(1, '#d94c1a');
    cCtx.fillStyle = grad; cCtx.fillRect(0, 0, w, h);

    cCtx.strokeStyle = 'rgba(255,255,255,0.8)'; cCtx.lineWidth = 2.5;
    for (let i = 16; i < w-10; i += 12) {
        cCtx.beginPath();
        cCtx.moveTo(i + (Math.random()-0.5)*3, 2);
        cCtx.bezierCurveTo(i+12, h*0.4, i-8, h*0.65, i-4+(Math.random()-0.5)*3, h-2);
        cCtx.stroke();
    }
    cCtx.fillStyle = 'rgba(255,255,255,0.3)';
    cCtx.beginPath(); cCtx.ellipse(w*0.4, h*0.22, w*0.36, h*0.12, -0.1, 0, Math.PI*2); cCtx.fill();
    cCtx.strokeStyle = 'rgba(255,255,255,0.55)'; cCtx.lineWidth = 1.4;
    cCtx.beginPath(); cCtx.moveTo(w*0.14, h*0.14); cCtx.quadraticCurveTo(w*0.34, h*0.04, w*0.56, h*0.12); cCtx.stroke();
    const shGrad = cCtx.createLinearGradient(0, h-16, 0, h);
    shGrad.addColorStop(0, 'rgba(0,0,0,0)'); shGrad.addColorStop(1, 'rgba(0,0,0,0.2)');
    cCtx.fillStyle = shGrad; cCtx.fillRect(0, h-16, w, 16);
    cCtx.restore();

    cCtx.strokeStyle = 'rgba(190,70,10,0.35)'; cCtx.lineWidth = 1.5;
    cCtx.stroke(path);
}

function renderEbi(cCtx, w, h) {
    cCtx.fillStyle = '#d1230a';
    cCtx.beginPath();
    cCtx.moveTo(w-42, 44); cCtx.lineTo(w-2, 16); cCtx.lineTo(w-10, 46); cCtx.lineTo(w+2, 62); cCtx.lineTo(w-42, 56);
    cCtx.closePath(); cCtx.fill();
    cCtx.strokeStyle = 'rgba(255,255,255,0.4)'; cCtx.lineWidth = 1;
    cCtx.beginPath(); cCtx.moveTo(w-38, 46); cCtx.lineTo(w-6, 24); cCtx.stroke();

    const grad = cCtx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#ffd9ad'); grad.addColorStop(0.45, '#ff8a3d');
    grad.addColorStop(0.8, '#e94f10'); grad.addColorStop(1, '#c22900');
    cCtx.fillStyle = grad;
    cCtx.beginPath();
    cCtx.moveTo(9, 46);
    cCtx.quadraticCurveTo(w*0.42, 4, w-38, 40);
    cCtx.quadraticCurveTo(w*0.55, 76, 14, 66);
    cCtx.closePath(); cCtx.fill();

    cCtx.strokeStyle = 'rgba(200,40,10,0.55)'; cCtx.lineWidth = 2.5;
    for (let i = 18; i < w-46; i += 15) {
        cCtx.beginPath(); cCtx.moveTo(i, 18); cCtx.quadraticCurveTo(i+9, 44, i, 68); cCtx.stroke();
    }
    cCtx.fillStyle = 'rgba(255,255,255,0.55)';
    cCtx.beginPath(); cCtx.ellipse(w*0.42, h*0.32, w*0.34, h*0.1, -0.15, 0, Math.PI*2); cCtx.fill();
    cCtx.strokeStyle = 'rgba(255,255,255,0.6)'; cCtx.lineWidth = 1.2;
    cCtx.beginPath(); cCtx.moveTo(w*0.14, h*0.28); cCtx.quadraticCurveTo(w*0.3, h*0.2, w*0.48, h*0.26); cCtx.stroke();

    cCtx.strokeStyle = 'rgba(150,25,5,0.4)'; cCtx.lineWidth = 1.5;
    cCtx.beginPath();
    cCtx.moveTo(9, 46);
    cCtx.quadraticCurveTo(w*0.42, 4, w-38, 40);
    cCtx.quadraticCurveTo(w*0.55, 76, 14, 66);
    cCtx.closePath(); cCtx.stroke();
}

function renderTamago(cCtx, w, h) {
    const grad = cCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#ffe36b'); grad.addColorStop(0.5, '#ffcf3d'); grad.addColorStop(1, '#e8ac10');
    cCtx.fillStyle = grad;
    cCtx.beginPath(); cCtx.roundRect(14, 22, w-28, 38, 5); cCtx.fill();

    cCtx.strokeStyle = 'rgba(180,120,0,0.3)'; cCtx.lineWidth = 1.5;
    [30, 38, 46].forEach(y => { cCtx.beginPath(); cCtx.moveTo(16, y); cCtx.lineTo(w-16, y); cCtx.stroke(); });

    cCtx.fillStyle = 'rgba(196,122,20,0.4)';
    cCtx.beginPath(); cCtx.roundRect(14, 50, w-28, 10, {bottomLeft:5, bottomRight:5}); cCtx.fill();

    cCtx.fillStyle = 'rgba(255,255,255,0.55)'; cCtx.fillRect(18, 25, w-36, 4);
}

function renderIka(cCtx, w, h) {
    const path = sashimiSlicePath(w, h);
    cCtx.save();
    cCtx.clip(path);
    const grad = cCtx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.5, '#f3f0ea'); grad.addColorStop(1, '#e4ddd0');
    cCtx.fillStyle = grad; cCtx.fillRect(0, 0, w, h);

    cCtx.strokeStyle = 'rgba(160,150,130,0.5)'; cCtx.lineWidth = 1;
    for (let i = -h; i < w; i += 9) {
        cCtx.beginPath(); cCtx.moveTo(i, 0); cCtx.lineTo(i+h, h); cCtx.stroke();
        cCtx.beginPath(); cCtx.moveTo(i+h, 0); cCtx.lineTo(i, h); cCtx.stroke();
    }
    cCtx.fillStyle = 'rgba(255,255,255,0.6)';
    cCtx.beginPath(); cCtx.ellipse(w*0.4, h*0.22, w*0.32, h*0.1, -0.1, 0, Math.PI*2); cCtx.fill();
    cCtx.strokeStyle = 'rgba(255,255,255,0.5)'; cCtx.lineWidth = 1.2;
    cCtx.beginPath(); cCtx.moveTo(w*0.16, h*0.16); cCtx.quadraticCurveTo(w*0.34, h*0.06, w*0.54, h*0.14); cCtx.stroke();
    cCtx.fillStyle = 'rgba(200,210,230,0.18)';
    cCtx.beginPath(); cCtx.ellipse(w*0.6, h*0.6, w*0.3, h*0.14, 0.2, 0, Math.PI*2); cCtx.fill();
    cCtx.restore();

    cCtx.strokeStyle = 'rgba(160,150,130,0.4)'; cCtx.lineWidth = 1.5;
    cCtx.stroke(path);
}

function renderBuri(cCtx, w, h) {
    const path = sashimiSlicePath(w, h);
    cCtx.save();
    cCtx.clip(path);
    const grad = cCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#fff3ee'); grad.addColorStop(0.6, '#ffe3d8'); grad.addColorStop(1, '#f6c9b8');
    cCtx.fillStyle = grad; cCtx.fillRect(0, 0, w, h);

    cCtx.fillStyle = 'rgba(170,190,195,0.55)';
    cCtx.beginPath(); cCtx.moveTo(6, 26); cCtx.quadraticCurveTo(w*0.4, 2, w-8, 34); cCtx.lineTo(w-8, 42); cCtx.quadraticCurveTo(w*0.4, 12, 6, 36); cCtx.fill();

    cCtx.strokeStyle = 'rgba(230,140,120,0.35)'; cCtx.lineWidth = 1.6;
    for (let i = 18; i < w-10; i += 13) {
        cCtx.beginPath(); cCtx.moveTo(i, h*0.42); cCtx.bezierCurveTo(i+8, h*0.6, i-6, h*0.75, i+6, h-6); cCtx.stroke();
    }
    cCtx.fillStyle = 'rgba(255,255,255,0.55)';
    cCtx.beginPath(); cCtx.ellipse(w*0.55, h*0.52, w*0.3, h*0.1, -0.05, 0, Math.PI*2); cCtx.fill();
    cCtx.strokeStyle = 'rgba(255,255,255,0.5)'; cCtx.lineWidth = 1.2;
    cCtx.beginPath(); cCtx.moveTo(w*0.2, h*0.44); cCtx.quadraticCurveTo(w*0.4, h*0.34, w*0.62, h*0.42); cCtx.stroke();
    cCtx.restore();

    cCtx.strokeStyle = 'rgba(190,140,110,0.4)'; cCtx.lineWidth = 1.5;
    cCtx.stroke(path);
}

function renderAnago(cCtx, w, h) {
    const path = sashimiSlicePath(w, h);
    cCtx.save();
    cCtx.clip(path);
    const grad = cCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#c97a2e'); grad.addColorStop(0.55, '#8a4715'); grad.addColorStop(1, '#5a2c08');
    cCtx.fillStyle = grad; cCtx.fillRect(0, 0, w, h);

    cCtx.fillStyle = 'rgba(30,15,5,0.55)';
    cCtx.beginPath(); cCtx.moveTo(8, 22); cCtx.quadraticCurveTo(w*0.5, 2, w-10, 30); cCtx.lineTo(w-10, 40); cCtx.quadraticCurveTo(w*0.5, 14, 8, 34); cCtx.fill();

    cCtx.fillStyle = 'rgba(40,15,3,0.5)';
    for (let i = 0; i < 14; i++) {
        cCtx.beginPath();
        cCtx.ellipse(16+Math.random()*(w-32), 40+Math.random()*30, 3+Math.random()*2, 1.5, Math.random()*Math.PI, 0, Math.PI*2);
        cCtx.fill();
    }
    cCtx.fillStyle = 'rgba(255,220,160,0.25)';
    cCtx.beginPath(); cCtx.ellipse(w*0.4, h*0.35, w*0.32, h*0.1, -0.1, 0, Math.PI*2); cCtx.fill();
    cCtx.strokeStyle = 'rgba(255,235,190,0.35)'; cCtx.lineWidth = 1.2;
    cCtx.beginPath(); cCtx.moveTo(w*0.16, h*0.3); cCtx.quadraticCurveTo(w*0.32, h*0.22, w*0.5, h*0.28); cCtx.stroke();
    cCtx.restore();

    cCtx.strokeStyle = 'rgba(50,20,5,0.4)'; cCtx.lineWidth = 1.5;
    cCtx.stroke(path);
}

function renderIkuraCluster(cCtx, cx, cy, rx, ry, spacing) {
    const balls = [];
    let row = 0;
    for (let y = cy - ry; y <= cy + ry; y += spacing * 0.82, row++) {
        const rowOffset = (row % 2 === 0) ? 0 : spacing / 2;
        for (let x = cx - rx - spacing; x <= cx + rx + spacing; x += spacing) {
            const xx = x + rowOffset;
            const dx = (xx - cx) / rx, dy = (y - cy) / ry;
            if (dx*dx + dy*dy <= 1.08) {
                balls.push({
                    x: xx + (Math.random()-0.5)*spacing*0.32,
                    y: y + (Math.random()-0.5)*spacing*0.32,
                    r: spacing*0.52*(0.85+Math.random()*0.28)
                });
            }
        }
    }
    balls.sort((a, b) => a.y - b.y);
    const palettes = [
        ['#ffe9bc', '#ff9a3d', '#f24d12', '#8f1503'],
        ['#ffd79a', '#ff7e2b', '#e2400d', '#7c1002'],
        ['#fff0c8', '#ffab55', '#f65e1c', '#9c1e05']
    ];
    balls.forEach(b => {
        const pal = palettes[Math.floor(Math.random()*palettes.length)];
        const grad = cCtx.createRadialGradient(b.x-b.r*0.35, b.y-b.r*0.4, b.r*0.15, b.x, b.y, b.r);
        grad.addColorStop(0, pal[0]); grad.addColorStop(0.35, pal[1]);
        grad.addColorStop(0.7, pal[2]); grad.addColorStop(1, pal[3]);
        cCtx.fillStyle = grad;
        cCtx.beginPath(); cCtx.arc(b.x, b.y, b.r, 0, Math.PI*2); cCtx.fill();
        cCtx.strokeStyle = 'rgba(90,8,4,0.35)'; cCtx.lineWidth = 0.6; cCtx.stroke();
        cCtx.fillStyle = 'rgba(255,255,255,0.5)';
        cCtx.beginPath(); cCtx.arc(b.x+b.r*0.12, b.y+b.r*0.2, b.r*0.22, 0, Math.PI*2); cCtx.fill();
        cCtx.fillStyle = 'rgba(255,255,255,0.9)';
        cCtx.beginPath(); cCtx.arc(b.x-b.r*0.38, b.y-b.r*0.42, b.r*0.24, 0, Math.PI*2); cCtx.fill();
        cCtx.strokeStyle = 'rgba(255,255,255,0.3)'; cCtx.lineWidth = b.r*0.16;
        cCtx.beginPath(); cCtx.arc(b.x, b.y, b.r*0.86, Math.PI*1.1, Math.PI*1.7); cCtx.stroke();
    });
}

function renderIkura(cCtx, w, h) {
    cCtx.fillStyle = '#12140f';
    cCtx.beginPath(); cCtx.roundRect(14, 32, w-28, 42, 3); cCtx.fill();
    cCtx.fillStyle = 'rgba(255,255,255,0.05)'; cCtx.fillRect(16, 34, w-32, 3);
    cCtx.save();
    cCtx.beginPath(); cCtx.ellipse(w/2, 36, w/2-15, 21, 0, 0, Math.PI*2); cCtx.clip();
    renderIkuraCluster(cCtx, w/2, 36, w/2-15, 21, 11);
    cCtx.restore();
}

function renderUniCluster(cCtx, cx, cy, rx, ry, spacing) {
    const pieces = [];
    let row = 0;
    for (let y = cy - ry; y <= cy + ry; y += spacing * 0.7, row++) {
        const rowOffset = (row % 2 === 0) ? 0 : spacing / 2;
        for (let x = cx - rx - spacing; x <= cx + rx + spacing; x += spacing) {
            const xx = x + rowOffset;
            const dx = (xx - cx) / rx, dy = (y - cy) / ry;
            if (dx*dx + dy*dy <= 1.12) {
                pieces.push({
                    x: xx + (Math.random()-0.5)*spacing*0.3,
                    y: y + (Math.random()-0.5)*spacing*0.3,
                    rot: (Math.random()-0.5)*1.3,
                    s: (spacing/15)*(0.95+Math.random()*0.35)
                });
            }
        }
    }
    pieces.sort((a, b) => a.y - b.y);
    const palettes = [
        ['#ffe98a', '#f7b93a', '#e8891a', '#a85305'],
        ['#fff0a8', '#f9c34e', '#ec9420', '#b05f08'],
        ['#ffdf72', '#f2a82c', '#dd7c12', '#9c4a02']
    ];
    pieces.forEach(t => {
        cCtx.save();
        cCtx.translate(t.x, t.y);
        cCtx.rotate(t.rot);
        cCtx.scale(t.s, t.s);
        const path = new Path2D();
        path.moveTo(-14, 0);
        path.quadraticCurveTo(-10, -8, -2, -6);
        path.quadraticCurveTo(4, -9, 9, -3);
        path.quadraticCurveTo(13, 2, 8, 6);
        path.quadraticCurveTo(-10, 7, -14, 0);
        path.closePath();
        const pal = palettes[Math.floor(Math.random()*palettes.length)];
        const grad = cCtx.createLinearGradient(-14, -8, 10, 8);
        grad.addColorStop(0, pal[0]); grad.addColorStop(0.4, pal[1]);
        grad.addColorStop(0.75, pal[2]); grad.addColorStop(1, pal[3]);
        cCtx.fillStyle = grad; cCtx.fill(path);
        cCtx.strokeStyle = 'rgba(110,55,0,0.45)'; cCtx.lineWidth = 0.7; cCtx.stroke(path);
        cCtx.strokeStyle = 'rgba(255,250,210,0.6)'; cCtx.lineWidth = 0.8;
        cCtx.beginPath(); cCtx.moveTo(-9, -2); cCtx.quadraticCurveTo(-2, -6, 6, -1); cCtx.stroke();
        cCtx.strokeStyle = 'rgba(255,250,210,0.35)'; cCtx.lineWidth = 0.6;
        cCtx.beginPath(); cCtx.moveTo(-6, 3); cCtx.quadraticCurveTo(0, 6, 6, 3); cCtx.stroke();
        cCtx.restore();
    });
}

function renderUni(cCtx, w, h) {
    cCtx.fillStyle = '#12140f';
    cCtx.beginPath(); cCtx.roundRect(14, 32, w-28, 42, 3); cCtx.fill();
    cCtx.fillStyle = 'rgba(255,255,255,0.05)'; cCtx.fillRect(16, 34, w-32, 3);
    cCtx.save();
    cCtx.beginPath(); cCtx.ellipse(w/2, 34, w/2-13, 20, 0, 0, Math.PI*2); cCtx.clip();
    renderUniCluster(cCtx, w/2, 34, w/2-13, 20, 15);
    cCtx.restore();
}

function renderServingBowlBase(cCtx, w, h) {
    const cx = w/2, rimY = h*0.46, rimRX = w*0.4, rimRY = h*0.13;
    const baseY = h*0.92, baseRX = w*0.28, baseRY = h*0.09;

    cCtx.shadowColor = 'rgba(0,0,0,0.25)'; cCtx.shadowBlur = 6; cCtx.shadowOffsetY = 3;
    cCtx.fillStyle = '#f7f4ee';
    cCtx.beginPath();
    cCtx.ellipse(cx, rimY, rimRX, rimRY, 0, Math.PI, 0);
    cCtx.lineTo(cx+baseRX, baseY);
    cCtx.ellipse(cx, baseY, baseRX, baseRY, 0, 0, Math.PI);
    cCtx.lineTo(cx-rimRX, rimY);
    cCtx.closePath();
    cCtx.fill();
    cCtx.shadowColor = 'transparent';

    cCtx.strokeStyle = 'rgba(35,70,110,0.55)'; cCtx.lineWidth = 1.3;
    for (let i = -4; i <= 4; i++) {
        const t = i/4;
        const xTop = cx + t*rimRX*0.92;
        const xBot = cx + t*baseRX*0.92;
        cCtx.beginPath(); cCtx.moveTo(xTop, rimY+2); cCtx.lineTo(xBot, baseY-2); cCtx.stroke();
        cCtx.fillStyle = 'rgba(35,70,110,0.55)';
        cCtx.beginPath(); cCtx.arc(xBot, baseY-2, 1.3, 0, Math.PI*2); cCtx.fill();
    }
    cCtx.strokeStyle = '#2c5b86'; cCtx.lineWidth = 2;
    cCtx.beginPath(); cCtx.ellipse(cx, rimY, rimRX, rimRY, 0, Math.PI, 0); cCtx.stroke();
    cCtx.strokeStyle = 'rgba(44,91,134,0.5)'; cCtx.lineWidth = 1;
    cCtx.beginPath(); cCtx.ellipse(cx, rimY+3, rimRX-2, rimRY-1, 0, Math.PI, 0); cCtx.stroke();

    cCtx.fillStyle = 'rgba(0,0,0,0.06)';
    cCtx.beginPath(); cCtx.ellipse(cx, rimY, rimRX-4, rimRY-2, 0, 0, Math.PI*2); cCtx.fill();
}

function renderIkuraBowl(cCtx, w, h) {
    renderServingBowlBase(cCtx, w, h);
    const cx = w/2, rimY = h*0.46, rimRX = w*0.4;
    cCtx.save();
    cCtx.beginPath(); cCtx.ellipse(cx, rimY-10, rimRX-4, 24, 0, 0, Math.PI*2); cCtx.clip();
    renderIkuraCluster(cCtx, cx, rimY-10, rimRX-4, 24, 10.5);
    cCtx.restore();
}

function renderUniBowl(cCtx, w, h) {
    renderServingBowlBase(cCtx, w, h);
    const cx = w/2, rimY = h*0.46, rimRX = w*0.4;
    cCtx.save();
    cCtx.beginPath(); cCtx.ellipse(cx, rimY-10, rimRX-4, 22, 0, 0, Math.PI*2); cCtx.clip();
    renderUniCluster(cCtx, cx, rimY-10, rimRX-4, 22, 14.5);
    cCtx.restore();
}

function renderShari(cCtx, w, h) {
    cCtx.fillStyle = '#ffffff'; cCtx.beginPath(); cCtx.roundRect(10, 20, w-20, h-35, 15); cCtx.fill();
    cCtx.strokeStyle = 'rgba(0,0,0,0.1)'; cCtx.stroke();
    cCtx.fillStyle = '#f2f2f2';
    for(let i=0; i<25; i++) {
        cCtx.beginPath(); cCtx.ellipse(15+Math.random()*(w-30), 25+Math.random()*(h-45), 4, 2, Math.random()*Math.PI, 0, Math.PI*2); cCtx.fill();
    }
}

// ネタデータ
const TOPPINGS = {
    maguro: { name: 'マグロ', category: 'nigiri', price: 500 },
    salmon: { name: 'サーモン', category: 'nigiri', price: 600 },
    ikura:  { name: 'イクラ',  category: 'gunkan', price: 800 },
    tamago: { name: 'たまご', category: 'tamago', price: 300 },
    ebi:    { name: 'エビ',    category: 'nigiri', price: 450 },
    buri:   { name: 'ぶり',    category: 'nigiri', price: 700 },
    uni:    { name: 'ウニ',    category: 'gunkan', price: 850 },
    anago:  { name: 'アナゴ', category: 'tamago', price: 750 },
    ika:    { name: 'イカ',    category: 'nigiri', price: 400 }
};

// ネタのみ在庫管理（初期数10個、最大10個）※シャリ・わさび・海苔は無限化
const MAX_STOCK = 10;
let ingredientStock = {};

function resetStock() {
    ingredientStock = {
        maguro: MAX_STOCK, salmon: MAX_STOCK, ikura: MAX_STOCK,
        tamago: MAX_STOCK, ebi: MAX_STOCK, buri: MAX_STOCK,
        uni: MAX_STOCK, anago: MAX_STOCK, ika: MAX_STOCK
    };
}

function initAssets() {
    createAsset('bg', GAME_WIDTH, GAME_HEIGHT, renderTable);
    createAsset('noren', GAME_WIDTH, 95, renderNoren);
    createAsset('noren_closed', GAME_WIDTH, GAME_HEIGHT, (c,w,h) => renderNoren(c,w,h*1.35));
    createAsset('chochin', 110, 150, renderChochin);
    createAsset('hangiri', 180, 180, renderHangiri);
    createAsset('manaita', 280, 200, renderManaita);
    createAsset('wasabi_plate', 80, 80, renderWasabiPlate);
    createAsset('nori_plate', 80, 80, renderNoriPlate);
    createAsset('knife', 220, 30, renderKnife);
    
    createAsset('maguro', 120, 80, renderMaguro);
    createAsset('salmon', 120, 80, renderSalmon);
    createAsset('ebi', 120, 80, renderEbi);
    createAsset('tamago', 120, 80, renderTamago);
    createAsset('ika', 120, 80, renderIka);
    createAsset('buri', 120, 80, renderBuri);
    createAsset('anago', 120, 80, renderAnago);
    createAsset('ikura', 120, 80, (ctx, w, h) => renderIkura(ctx, w, h));
    createAsset('uni', 120, 80, (ctx, w, h) => renderUni(ctx, w, h));
    createAsset('ikura_bowl', 120, 80, renderIkuraBowl);
    createAsset('uni_bowl', 120, 80, renderUniBowl);
    createAsset('shari', 120, 80, renderShari);
}

// --- ゲーム状態変数 ---
let state = STATE.TITLE;
let score = 0;
let rating = 3.0;
const MAX_RATING = 5.0;
let servedCount = 0;
const CUSTOMER_SLOTS = 5;
let customers = [];
let cuttingBoard = [];
let elapsedTime = 0;

// 電光掲示板（テロップ）用メッセージ管理
let tickerQueue = [];
let currentTickerText = "";
let tickerX = GAME_WIDTH;

function addTickerMessage(text) {
    if (!tickerQueue.includes(text) && currentTickerText !== text) {
        tickerQueue.push(text);
    }
}

// 長押し補充用ステート
let reloadingItem = null;
let holdTimer = 0;
let justCompletedReload = false; // 長押し完了直後のタップ誤判定防止用
const HOLD_TIME_REQUIRED = 0.8; // 長押しに必要な時間（0.8秒）
const RING_SHOW_DELAY = 0.15; // リング表示を開始する経過時間（0.15秒）

// ========================================
// ハイスコア管理 (localStorage)
// ========================================

const HIGHSCORE_KEY = "sushi_panic_highscores";

function getHighScores() {
    try {
        const data = localStorage.getItem(HIGHSCORE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

function saveHighScore(newScore) {
    if (newScore <= 0) return;
    const scores = getHighScores();
    const now = new Date();
    const dateStr = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    scores.push({ score: newScore, date: dateStr });
    scores.sort((a, b) => b.score - a.score);
    const top5 = scores.slice(0, 5);
    
    try {
        localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(top5));
    } catch (e) {}
}

// ========================================
// SoundFX
// ========================================

class SoundFX {
    constructor() {
        this.ctx = null;
    }

    unlock() {
        this._ensureContext();
        if (this.ctx.state === "suspended") {
            this.ctx.resume();
        }
    }

    _ensureContext() {
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();
        }
        return this.ctx;
    }

    _tone({ freq = 440, freqEnd = null, duration = 0.12, type = "sine", gain = 0.2, delay = 0 }) {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const t0 = ctx.currentTime + delay;

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (freqEnd !== null) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
        }

        gainNode.gain.setValueAtTime(gain, t0);
        gainNode.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

        osc.connect(gainNode).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + duration + 0.02);
    }

    playTap() {
        this._tone({ freq: 600, freqEnd: 900, duration: 0.05, type: "sine", gain: 0.06 });
    }

    playSuccess() {
        this._tone({ freq: 523.25, duration: 0.1, type: "triangle", gain: 0.12 });
        this._tone({ freq: 659.25, duration: 0.22, type: "triangle", gain: 0.12, delay: 0.08 });
    }

    playVipSuccess() {
        this._tone({ freq: 523.25, duration: 0.12, type: "triangle", gain: 0.15 });
        this._tone({ freq: 659.25, duration: 0.12, type: "triangle", gain: 0.15, delay: 0.08 });
        this._tone({ freq: 783.99, duration: 0.25, type: "triangle", gain: 0.18, delay: 0.16 });
    }

    playError() {
        this._tone({ freq: 160, freqEnd: 100, duration: 0.2, type: "sawtooth", gain: 0.08 });
    }

    playTrash() {
        this._tone({ freq: 180, duration: 0.08, type: "square", gain: 0.06 });
    }

    playReloadComplete() {
        this._tone({ freq: 880, duration: 0.15, type: "triangle", gain: 0.12 });
    }
}

const sfx = new SoundFX();

// ========================================
// 画面遷移
// ========================================

function goToTitle() {
    state = STATE.TITLE;
}

function goToHowto() {
    state = STATE.HOWTO;
}

function goToHighscore() {
    state = STATE.HIGHSCORE;
}

function startGame() {
    sfx.unlock();
    state = STATE.PLAYING;
    score = 0; rating = 3.0; servedCount = 0; customers = []; cuttingBoard = [];
    tickerQueue = []; currentTickerText = ""; tickerX = GAME_WIDTH;
    reloadingItem = null; holdTimer = 0; justCompletedReload = false;
    resetStock();
    unlockedSlots = 1;
    spawnCustomer(0);
}

function pauseGame() {
    if (state !== STATE.PLAYING) return;
    state = STATE.PAUSED;
    reloadingItem = null; holdTimer = 0; justCompletedReload = false;
}

function resumeGame() {
    if (state !== STATE.PAUSED) return;
    state = STATE.PLAYING;
}

function endGame() {
    saveHighScore(score);
    state = STATE.GAMEOVER;
    reloadingItem = null; holdTimer = 0; justCompletedReload = false;
}

// ========================================
// 誤操作防止（ブラウザバック対策）
// ========================================

function initBackButtonGuard() {
    history.pushState({ mrsGame: true }, "");

    window.addEventListener("popstate", () => {
        history.pushState({ mrsGame: true }, "");

        if (state === STATE.PLAYING) {
            pauseGame();
        } else if (state === STATE.GAMEOVER || state === STATE.HOWTO || state === STATE.HIGHSCORE) {
            goToTitle();
        }
    });
}

// ========================================
// 操作入力（タップ / 長押し制御）
// ========================================

const customerSlotX = (i) => 10 + i * 92 + 46;

function getItemAtCoord(vx, vy) {
    if (state !== STATE.PLAYING) return null;

    // パレット (3x3)
    const gridX = [20, 170, 320]; const gridY = [265, 350, 435];
    const keys = ['maguro', 'salmon', 'ikura', 'tamago', 'ebi', 'buri', 'uni', 'anago', 'ika'];
    for (let i = 0; i < 9; i++) {
        const row = Math.floor(i/3); const col = i%3;
        if (vx >= gridX[col] && vx <= gridX[col]+130 && vy >= gridY[row] && vy <= gridY[row]+75) {
            return keys[i];
        }
    }

    // 調理場（わさび、のり、シャリ）
    if (vx >= 15 && vx <= 95 && vy >= 520 && vy <= 600) return 'wasabi';
    if (vx >= 95 && vx <= 175 && vy >= 520 && vy <= 600) return 'nori';
    if (vx >= 5 && vx <= 185 && vy >= 605 && vy <= 785) return 'rice';

    return null;
}

// ありえない組み合わせの追加防止判定
function canAddIngredient(item) {
    const cb = cuttingBoard;

    // まな板の上限（4個）
    if (cb.length >= 4) return false;

    // シャリが置いていない状態ではシャリ以外置けない
    if (cb.length === 0) {
        return item === 'rice';
    }

    // すでに完成品判定がある場合は追加不可
    if (getPreparedSushi() !== null) return false;

    const topping = TOPPINGS[item];

    // ① シャリだけが載っている場合
    if (cb.length === 1 && cb[0] === 'rice') {
        if (item === 'wasabi') return true;
        if (item === 'nori') return true;
        if (topping) return true; // 全ネタ（にぎり・軍艦・たまご）可
        return false;
    }

    // ② シャリ ＋ わさび
    if (cb.length === 2 && cb[0] === 'rice' && cb[1] === 'wasabi') {
        // にぎりネタのみ可
        return topping && topping.category === 'nigiri';
    }

    // ③ シャリ ＋ のり （軍艦・たまご準備）
    if (cb.length === 2 && cb[0] === 'rice' && cb[1] === 'nori') {
        // 軍艦ネタ（イクラ・ウニ）のみ可
        return topping && topping.category === 'gunkan';
    }

    // ④ シャリ ＋ ネタ （たまご・アナゴ等）
    if (cb.length === 2 && cb[0] === 'rice' && TOPPINGS[cb[1]]) {
        // たまごカテゴリネタ（たまご・アナゴ）の上に『のり』を巻く場合のみ可
        if (TOPPINGS[cb[1]].category === 'tamago' && item === 'nori') {
            return true;
        }
        return false;
    }

    return false;
}

function handleTouchDown(x, y) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    const vx = (x - rect.left) * scaleX;
    const vy = (y - rect.top) * scaleY;

    if (state === STATE.TITLE) {
        if (vx >= 90 && vx <= 390 && vy >= 630 && vy <= 702) { startGame(); sfx.playTap(); }
        else if (vx >= 90 && vx <= 230 && vy >= 716 && vy <= 766) { goToHowto(); sfx.playTap(); }
        else if (vx >= 250 && vx <= 390 && vy >= 716 && vy <= 766) { goToHighscore(); sfx.playTap(); }
        else if (vx >= 140 && vx <= 340 && vy >= 780 && vy <= 830) {
            window.location.href = 'https://mrs-games.pages.dev';
            sfx.playTap();
        }
    } else if (state === STATE.HOWTO) {
        goToTitle(); sfx.playTap();
    } else if (state === STATE.HIGHSCORE) {
        goToTitle(); sfx.playTap();
    } else if (state === STATE.PAUSED) {
        if (vy >= 350 && vy <= 410 && vx >= 100 && vx <= 380) { resumeGame(); sfx.playTap(); }
        else if (vy >= 430 && vy <= 490 && vx >= 100 && vx <= 380) { startGame(); sfx.playTap(); }
        else if (vy >= 510 && vy <= 570 && vx >= 100 && vx <= 380) { goToTitle(); sfx.playTap(); }
    } else if (state === STATE.GAMEOVER) {
        if (vy >= 560 && vy <= 622 && vx >= 100 && vx <= 380) { goToTitle(); sfx.playTap(); }
    } else if (state === STATE.PLAYING) {
        if (vx >= 410 && vx <= 468 && vy >= 10 && vy <= 55) { pauseGame(); sfx.playTap(); return; }

        // カウンターの客タップ
        if (vy >= 95 && vy <= 255) {
            for (let i = 0; i < CUSTOMER_SLOTS; i++) {
                const cx = customerSlotX(i);
                if (vx >= cx - 46 && vx <= cx + 46) {
                    const idx = customers.findIndex(c => c.slot === i);
                    if (idx !== -1) serveCustomer(idx);
                    return;
                }
            }
        }

        // まな板上の寿司タップでリセット（廃棄ペナルティ：-100円）
        if (vx >= 180 && vx <= 460 && vy >= 535 && vy <= 735) {
            if (cuttingBoard.length > 0) {
                cuttingBoard = [];
                score = Math.max(0, score - RATING_CONFIG.TRASH_PENALTY_SCORE); // -100円
                sfx.playTrash();
            }
            return;
        }

        // パレット・食材判定（タップ＆長押し開始）
        const item = getItemAtCoord(vx, vy);
        if (item) {
            justCompletedReload = false;

            // まな板の状態に関わらず、在庫が9個以下なら長押し補充判定を開始
            if (TOPPINGS[item] && ingredientStock[item] < MAX_STOCK) {
                reloadingItem = item;
                holdTimer = 0;
            } else {
                // シャリ・わさび・海苔、あるいは在庫満タン時は即座に追加試行
                tryAddIngredient(item);
            }
        }
    }
}

function handleTouchUp(x, y) {
    if (state !== STATE.PLAYING) return;

    // 長押し補充が完了しておらず、タップ判定として処理する場合
    if (reloadingItem && !justCompletedReload) {
        tryAddIngredient(reloadingItem);
    }

    reloadingItem = null;
    holdTimer = 0;
    justCompletedReload = false;
}

function tryAddIngredient(item) {
    if (!canAddIngredient(item)) return; // 無効な組み合わせは反応しない

    // 無限化アイテム（シャリ・わさび・海苔）
    if (item === 'rice' || item === 'wasabi' || item === 'nori') {
        addIngredient(item);
        return;
    }

    // ネタアイテム（在庫チェック）
    if (ingredientStock[item] > 0) {
        addIngredient(item);
    } else {
        sfx.playError();
    }
}

function addIngredient(item) {
    if (item === 'rice' && cuttingBoard.length > 0) cuttingBoard = [];
    cuttingBoard.push(item);

    // ネタアイテムの場合のみ在庫減少
    if (TOPPINGS[item]) {
        ingredientStock[item]--;
        // 在庫が0になったら電光掲示板に警告追加
        if (ingredientStock[item] === 0) {
            addTickerMessage(`⚠️ ${TOPPINGS[item].name}が在庫切れ！`);
        }
    }
    sfx.playTap();
}

function initInputHandlers() {
    stage.addEventListener("pointerdown", (e) => {
        sfx.unlock();
        handleTouchDown(e.clientX, e.clientY);
        e.preventDefault();
    }, { passive: false });

    stage.addEventListener("pointerup", (e) => {
        handleTouchUp(e.clientX, e.clientY);
        e.preventDefault();
    }, { passive: false });

    stage.addEventListener("pointercancel", (e) => {
        handleTouchUp(e.clientX, e.clientY);
        e.preventDefault();
    }, { passive: false });
}

// --- 難易度設定 ---
const SCORE_THRESHOLDS = [0, 1500, 4500, 10000, 20000];
let unlockedSlots = 1;

function getDifficultyLevel() {
    let lvl = 0;
    for (let i = 1; i < SCORE_THRESHOLDS.length; i++) {
        if (score >= SCORE_THRESHOLDS[i]) lvl = i;
    }
    return lvl;
}

function getActiveSlotCount() {
    return Math.min(CUSTOMER_SLOTS, getDifficultyLevel() + 1);
}

function getPatienceRate() { return 2.8 * (1 + getDifficultyLevel() * 0.16); }
function getRevealDuration() { return Math.max(3.5, 6.0 - getDifficultyLevel() * 0.4); }
function getRespawnDelay(base) { return Math.max(base * 0.4, base - getDifficultyLevel() * 60); }

function unlockNewSeatsIfNeeded() {
    const target = getActiveSlotCount();
    while (unlockedSlots < target) {
        spawnCustomer(unlockedSlots);
        unlockedSlots++;
    }
}

function spawnCustomer(slot) {
    if (customers.some(c => c.slot === slot)) return;
    const keys = Object.keys(TOPPINGS);
    const rKey = keys[Math.floor(Math.random() * keys.length)];
    const isSabiNuki = (TOPPINGS[rKey].category === 'nigiri') ? (Math.random() < 0.3) : false;
    const isVip = Math.random() < 0.20;

    // 覆面調査員（10%）と短気客（15%）のフラグ判定
    const isInspector = Math.random() < 0.10;
    const isImpatient = Math.random() < 0.15;

    // 短気客は我慢ゲージ減少速度が2〜3倍
    const speedFactor = isImpatient
        ? (2.0 + Math.random() * 1.0)
        : (0.7 + Math.random() * 0.8);

    // 満足退店までの必要皿数（通常客: 3〜5皿, VIP: 5〜8皿）
    const targetEatenCount = isVip
        ? Math.floor(Math.random() * 4) + 5
        : Math.floor(Math.random() * 3) + 3;

    customers.push({
        slot,
        key: rKey,
        category: TOPPINGS[rKey].category,
        price: TOPPINGS[rKey].price * (isVip ? 3 : 1),
        name: TOPPINGS[rKey].name,
        isSabiNuki: isSabiNuki,
        isVip: isVip,
        isInspector: isInspector,  // 覆面調査員フラグ
        isImpatient: isImpatient,  // 短気客フラグ
        eatenCount: 0,
        targetEatenCount: targetEatenCount,
        patience: 100,
        maxPatience: 100,
        patienceSpeedFactor: speedFactor,
        revealTimer: getRevealDuration(),
        revealDuration: getRevealDuration(),
        eatingTimer: 0
    });
}

function getPreparedSushi() {
    const cb = cuttingBoard;
    if (cb.length < 2) return null;
    const toppingItem = cb.find(item => TOPPINGS[item]);
    if (!toppingItem) return null;
    const cat = TOPPINGS[toppingItem].category;
    let complete = false;

    if (cat === 'nigiri') {
        if (cb[0] === 'rice' && cb[cb.length - 1] === toppingItem) {
            if (cb.length === 2 && !cb.includes('wasabi')) complete = true;
            if (cb.length === 3 && cb[1] === 'wasabi') complete = true;
        }
    } else if (cat === 'gunkan') {
        if (cb.length === 3 && cb[0] === 'rice' && cb[1] === 'nori' && cb[2] === toppingItem) complete = true;
    } else if (cat === 'tamago') {
        if (cb.length === 3 && cb[0] === 'rice' && cb[1] === toppingItem && cb[2] === 'nori') complete = true;
    }
    if (!complete) return null;
    return { key: toppingItem, category: cat, hasWasabi: cb.includes('wasabi') };
}

function serveCustomer(idx) {
    const c = customers[idx];
    if (!c || c.eatingTimer > 0) return;

    const sushi = getPreparedSushi();
    if (!sushi) { sfx.playTap(); return; }

    let isMatch = false;
    if (sushi.key === c.key) {
        if (c.category === 'nigiri') {
            if ((c.isSabiNuki && !sushi.hasWasabi) || (!c.isSabiNuki && sushi.hasWasabi)) isMatch = true;
        } else isMatch = true;
    }

    if (isMatch) {
        score += c.price;
        servedCount++;
        c.eatenCount++;
        
        if (c.isVip) sfx.playVipSuccess();
        else sfx.playSuccess();

        cuttingBoard = [];

        unlockNewSeatsIfNeeded();

        if (c.eatenCount >= c.targetEatenCount) {
            rating = Math.min(MAX_RATING, rating + RATING_CONFIG.SUCCESS_FULL);
            const slot = c.slot;
            customers.splice(idx, 1);
            setTimeout(() => spawnCustomer(slot), getRespawnDelay(400));
        } else {
            rating = Math.min(MAX_RATING, rating + RATING_CONFIG.SUCCESS_EACH);
            c.eatingTimer = 1.5 + Math.random() * 2.5;
            c.patience = 100;
        }
    } else {
        // 覆面調査員へ誤提供した場合、評判減少量が2倍（-1.0）かつ電光掲示板に警告表示
        const penalty = c.isInspector ? (RATING_CONFIG.MISS_SERVE * 2) : RATING_CONFIG.MISS_SERVE;
        if (c.isInspector) {
            addTickerMessage('⚠️ 覆面調査員による減点！');
        }
        rating = Math.max(0, rating + penalty);
        cuttingBoard = [];
        sfx.playError();
        if (rating <= 0) endGame();
    }
}

function update(dt) {
    if (state !== STATE.PLAYING) return;

    // 長押し補充タイマーの進捗処理（まな板に関わらず動作）
    if (reloadingItem) {
        holdTimer += dt;
        if (holdTimer >= HOLD_TIME_REQUIRED) {
            ingredientStock[reloadingItem] = MAX_STOCK;
            reloadingItem = null;
            holdTimer = 0;
            justCompletedReload = true; // 放したときの誤タップ判定を回避
            sfx.playReloadComplete();
        }
    }

    // 電光掲示板（マーキーテロップ）更新ロジック
    if (!currentTickerText && tickerQueue.length > 0) {
        currentTickerText = tickerQueue.shift();
        tickerX = GAME_WIDTH;
    }

    if (currentTickerText) {
        tickerX -= dt * 180; // スクロール速度（180px/s）
        ctx.font = 'bold 15px sans-serif';
        const textWidth = ctx.measureText(currentTickerText).width;
        if (tickerX < -textWidth) {
            currentTickerText = "";
            tickerX = GAME_WIDTH;
        }
    }

    const basePatienceRate = getPatienceRate();

    for (let i = customers.length - 1; i >= 0; i--) {
        const c = customers[i];

        if (c.eatingTimer > 0) {
            c.eatingTimer -= dt;
            if (c.eatingTimer <= 0) {
                c.eatingTimer = 0;
                const keys = Object.keys(TOPPINGS);
                const rKey = keys[Math.floor(Math.random() * keys.length)];
                c.key = rKey;
                c.category = TOPPINGS[rKey].category;
                c.price = TOPPINGS[rKey].price * (c.isVip ? 3 : 1);
                c.isSabiNuki = (TOPPINGS[rKey].category === 'nigiri') ? (Math.random() < 0.3) : false;
                c.patience = 100;
                c.revealTimer = getRevealDuration();
            }
            continue;
        }

        if (c.revealTimer > 0) c.revealTimer = Math.max(0, c.revealTimer - dt);

        c.patience -= dt * basePatienceRate * c.patienceSpeedFactor;

        if (c.patience <= 0) {
            const slot = c.slot;

            // 覆面調査員を見逃した場合、評判減少量が2倍（-1.6）かつ電光掲示板に警告表示
            const penalty = c.isInspector ? (RATING_CONFIG.MISS_TIMEOUT * 2) : RATING_CONFIG.MISS_TIMEOUT;
            if (c.isInspector) {
                addTickerMessage('⚠️ 覆面調査員による減点！');
            }

            rating = Math.max(0, rating + penalty);
            customers.splice(i, 1);
            sfx.playError();

            if (rating <= 0) {
                endGame();
            } else {
                setTimeout(() => spawnCustomer(slot), getRespawnDelay(600));
            }
        }
    }
}

// --- 描画関数 ---
function drawCard(ctx, x, y, w, h, bg) {
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x+2, y+2, w-4, h-4, 12); ctx.stroke();
}

function drawWashiCard(ctx, x, y, w, h, radius) {
    const r = radius || 13;
    ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#f6ecd9';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(28,61,95,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x+2, y+2, w-4, h-4, r-2); ctx.stroke();
    ctx.fillStyle = 'rgba(120,90,50,0.07)';
    const flecks = Math.min(40, Math.floor(w*h/700));
    for (let i = 0; i < flecks; i++) {
        ctx.beginPath();
        ctx.arc(x + Math.random()*w, y + Math.random()*h, 0.8, 0, Math.PI*2);
        ctx.fill();
    }
}

function drawCompleteSushi(ctx, x, y, key, isSabiNuki, scale) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    const cat = TOPPINGS[key].category;
    ctx.drawImage(assets['shari'], -60, -30);
    if (cat === 'nigiri') {
        if (!isSabiNuki) { ctx.fillStyle='#8cc63f'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill(); }
        ctx.drawImage(assets[key], -60, -45);
    } else if (cat === 'gunkan') {
        ctx.fillStyle = '#171c15'; ctx.beginPath(); ctx.roundRect(-45, -35, 90, 50, 5); ctx.fill();
        ctx.drawImage(assets[key], -60, -45);
    } else if (cat === 'tamago') {
        ctx.drawImage(assets[key], -60, -45);
        ctx.fillStyle = '#171c15'; ctx.fillRect(-10, -30, 20, 55);
    }
    ctx.restore();
}

const CUSTOMER_STYLES = [
    { hair: '#3a2a1a', shirt: '#d9381e' },
    { hair: '#5a3820', shirt: '#1c3d5f' },
    { hair: '#1a1a1a', shirt: '#3a7d44' },
    { hair: '#7a4a25', shirt: '#c9973a' },
    { hair: '#2a2a2a', shirt: '#8a4fae' }
];

function drawCustomerBust(ctx, cx, cy, styleIdx, isVip, isEating, isAngry) {
    if (isVip) {
        ctx.save();
        ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 18;
        ctx.fillStyle = '#e8ac10';
        ctx.beginPath(); ctx.arc(cx, cy-8, 28, 0, Math.PI*2); ctx.fill();
        ctx.restore();

        ctx.fillStyle = '#d4af37';
        ctx.beginPath(); ctx.roundRect(cx-30, cy+8, 60, 42, {topLeft:18, topRight:18, bottomLeft:0, bottomRight:0}); ctx.fill();
        ctx.fillStyle = '#f0c49a'; ctx.fillRect(cx-8, cy+2, 16, 14);
        ctx.fillStyle = '#f7d3ab'; ctx.beginPath(); ctx.arc(cx, cy-8, 20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx, cy-14, 21, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#2c2c2c';
        ctx.beginPath(); ctx.arc(cx-7, cy-8, 2, 0, Math.PI*2); ctx.arc(cx+7, cy-8, 2, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#a35c3c'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy-2, 5, 0.1*Math.PI, 0.9*Math.PI); ctx.stroke();
    } else {
        const st = CUSTOMER_STYLES[styleIdx % CUSTOMER_STYLES.length];
        ctx.fillStyle = st.shirt;
        ctx.beginPath(); ctx.roundRect(cx-30, cy+8, 60, 42, {topLeft:18, topRight:18, bottomLeft:0, bottomRight:0}); ctx.fill();
        ctx.fillStyle = '#f0c49a'; ctx.fillRect(cx-8, cy+2, 16, 14);
        ctx.fillStyle = '#f7d3ab'; ctx.beginPath(); ctx.arc(cx, cy-8, 20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = st.hair; ctx.beginPath(); ctx.arc(cx, cy-14, 21, Math.PI, 0); ctx.fill();
        ctx.fillRect(cx-21, cy-14, 6, 16); ctx.fillRect(cx+15, cy-14, 6, 16);
        ctx.fillStyle = '#2c2c2c'; ctx.beginPath(); ctx.arc(cx-7, cy-8, 2, 0, Math.PI*2); ctx.arc(cx+7, cy-8, 2, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#a35c3c'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy-2, 5, 0.1*Math.PI, 0.9*Math.PI); ctx.stroke();
    }

    if (isEating) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(cx, cy-35, 14, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#1c3d5f'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('🎵', cx, cy-31);
    } else if (isAngry) {
        ctx.font = '22px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('💢', cx + 18, cy - 25);
    }
}

function drawHowtoFormula(ctx, cy, slots) {
    const spacing = slots.length <= 5 ? 65 : 60;
    const start = 240 - (slots.length - 1) / 2 * spacing;
    slots.forEach((s, i) => {
        const cx = start + i * spacing;
        if (s.type === 'symbol') {
            ctx.fillStyle = '#1c3d5f'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(s.text, cx, cy + 7);
        } else if (s.type === 'icon') {
            const w = s.w || 64, h = s.h || 43;
            ctx.drawImage(assets[s.key], cx - w/2, cy - h/2, w, h);
            ctx.fillStyle = '#1c3d5f'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(s.label, cx, cy + h/2 + 14);
        } else if (s.type === 'result') {
            drawCompleteSushi(ctx, cx, cy + 2, s.key, s.sabiNuki || false, 0.5);
            ctx.fillStyle = '#1c3d5f'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(s.label, cx, cy + 40);
        }
    });
}

// 長押し補充時のプログレスリング描画（拡大・少し遅れて描画開始）
function drawReloadProgress(cx, cy, progress) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath(); ctx.arc(cx, cy, 38, 0, Math.PI*2); ctx.fill();

    ctx.strokeStyle = '#f6ecd9';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 31, -Math.PI/2, -Math.PI/2 + Math.PI * 2 * progress);
    ctx.stroke();

    ctx.fillStyle = '#f6ecd9';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('補充中', cx, cy);
    ctx.restore();
}

// パレットに在庫数、点滅表示、および「売切御免！」帯を描画
function drawStockOverlay(px, py, w, h, key) {
    if (!TOPPINGS[key]) return;

    const count = ingredientStock[key] ?? 0;
    const cx = px + w/2;
    const cy = py + h/2;

    if (count <= 0) {
        ctx.save();
        // ① 在庫切れのグレーアウト（暗転）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath(); ctx.roundRect(px, py, w, h, 13); ctx.fill();

        // ② 太い赤枠で囲む
        ctx.strokeStyle = '#d9381e';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.roundRect(px+1, py+1, w-2, h-2, 12); ctx.stroke();

        // ③ 斜めの赤帯＋「売切御免！」描画
        ctx.translate(cx, cy);
        ctx.rotate(-15 * Math.PI / 180);

        ctx.fillStyle = '#d9381e';
        ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 6;
        ctx.fillRect(-w*0.6, -14, w*1.2, 28);
        ctx.shadowColor = 'transparent';

        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
        ctx.strokeRect(-w*0.6, -12, w*1.2, 24);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('売切御免！', 0, 1);

        ctx.restore();
    } else {
        ctx.save();
        // 残り1個のときは点滅（パルス効果）
        let isFlashVisible = true;
        if (count === 1) {
            isFlashVisible = Math.floor(elapsedTime * 6) % 2 === 0;
        }

        if (isFlashVisible) {
            ctx.fillStyle = count === 1 ? '#ff1a1a' : (count <= 3 ? '#d9381e' : '#1c3d5f');
            ctx.font = count === 1 ? 'bold 16px sans-serif' : 'bold 13px sans-serif';
            ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
            ctx.fillText(`x${count}`, px + w - 10, py + h - 8);
        }
        ctx.restore();
    }
}

function draw() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    if(assets['bg']) ctx.drawImage(assets['bg'], 0, 0);

    if (state === STATE.TITLE) {
        const dimGrad = ctx.createLinearGradient(0,0,0,GAME_HEIGHT);
        dimGrad.addColorStop(0, 'rgba(20,14,8,0.55)');
        dimGrad.addColorStop(0.55, 'rgba(20,14,8,0.72)');
        dimGrad.addColorStop(1, 'rgba(20,14,8,0.82)');
        ctx.fillStyle = dimGrad; ctx.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);

        ctx.save();
        ctx.translate(GAME_WIDTH/2, 110);
        ctx.rotate(Math.sin(elapsedTime*1.3)*0.05);
        ctx.drawImage(assets['chochin'], -55, 0);
        ctx.restore();

        ctx.fillStyle = 'rgba(217,56,30,0.9)';
        ctx.beginPath(); ctx.arc(GAME_WIDTH/2, 370, 105, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'rgba(246,236,217,0.85)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(GAME_WIDTH/2, 370, 115, 0, Math.PI*2); ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#f6ecd9';
        ctx.font = 'bold 56px serif';
        ctx.fillText('寿司パニック', GAME_WIDTH/2, 358);
        ctx.font = 'bold 15px sans-serif';
        ctx.fillStyle = 'rgba(246,236,217,0.85)';
        ctx.fillText('立ち食い寿司の板前修業', GAME_WIDTH/2, 388);

        drawCompleteSushi(ctx, GAME_WIDTH/2, 500, 'salmon', false, 1.2);

        drawCard(ctx, 90, 630, 300, 70, '#d9381e');
        ctx.fillStyle = '#f6ecd9'; ctx.font = 'bold 24px serif'; ctx.fillText('のれんをくぐる', GAME_WIDTH/2, 674);

        drawWashiCard(ctx, 90, 716, 140, 50, 12);
        ctx.fillStyle = '#1c3d5f'; ctx.font = 'bold 17px serif'; ctx.fillText('遊び方', 160, 747);

        drawWashiCard(ctx, 250, 716, 140, 50, 12);
        ctx.fillStyle = '#1c3d5f'; ctx.font = 'bold 17px serif'; ctx.fillText('ハイスコア', 320, 747);

        // Canvas描画によるアンダーライン付き外部リンクテキスト
        const linkText = 'Produced by MRS GAMES';
        const linkX = GAME_WIDTH / 2;
        const linkY = 805;

        ctx.fillStyle = 'rgba(246,236,217,0.85)';
        ctx.font = '13px sans-serif';
        ctx.fillText(linkText, linkX, linkY);

        const textWidth = ctx.measureText(linkText).width;
        ctx.strokeStyle = 'rgba(246,236,217,0.85)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(linkX - textWidth / 2, linkY + 4);
        ctx.lineTo(linkX + textWidth / 2, linkY + 4);
        ctx.stroke();

        ctx.textAlign = 'left';
        return;
    }

    if (state === STATE.HOWTO) {
        ctx.fillStyle = '#f4eee6'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1c3d5f'; ctx.font = 'bold 26px serif';
        ctx.fillText('作り方・ルール', GAME_WIDTH/2, 38);

        const rows = [
            { top: 55, num: '①', title: 'にぎり', sub: 'マグロ・サーモン・エビ・ぶり・イカ',
              formula: [
                  { type: 'icon', key: 'shari', label: 'シャリ' },
                  { type: 'symbol', text: '＋' },
                  { type: 'icon', key: 'wasabi_plate', label: 'わさび', w: 40, h: 40 },
                  { type: 'symbol', text: '＋' },
                  { type: 'icon', key: 'salmon', label: 'ネタ' },
                  { type: 'symbol', text: '＝' },
                  { type: 'result', key: 'salmon', sabiNuki: false, label: '完成' }
              ],
              note: 'わさびを抜けば「サビ抜き」の注文に対応できる'
            },
            { top: 235, num: '②', title: '軍艦（ぐんかん）', sub: 'いくら・うに',
              formula: [
                  { type: 'icon', key: 'shari', label: 'シャリ' },
                  { type: 'symbol', text: '＋' },
                  { type: 'icon', key: 'nori_plate', label: 'のり', w: 40, h: 40 },
                  { type: 'symbol', text: '＋' },
                  { type: 'icon', key: 'ikura_bowl', label: 'ネタ' },
                  { type: 'symbol', text: '＝' },
                  { type: 'result', key: 'ikura', sabiNuki: false, label: '完成' }
              ],
              note: 'のりを先に巻いてから、ネタを盛りつける'
            },
            { top: 415, num: '③', title: 'たまご・アナゴ', sub: 'たまご・アナゴ',
              formula: [
                  { type: 'icon', key: 'shari', label: 'シャリ' },
                  { type: 'symbol', text: '＋' },
                  { type: 'icon', key: 'tamago', label: 'ネタ' },
                  { type: 'symbol', text: '＋' },
                  { type: 'icon', key: 'nori_plate', label: 'のり', w: 40, h: 40 },
                  { type: 'symbol', text: '＝' },
                  { type: 'result', key: 'tamago', sabiNuki: false, label: '完成' }
              ],
              note: '軍艦とは順番が違う。のりは最後に巻いて仕上げる'
            }
        ];

        rows.forEach(r => {
            ctx.fillStyle = '#1c3d5f'; ctx.font = 'bold 18px serif'; ctx.textAlign = 'center';
            ctx.fillText(`${r.num} ${r.title}`, GAME_WIDTH/2, r.top + 20);
            ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(28,61,95,0.7)';
            ctx.fillText(r.sub, GAME_WIDTH/2, r.top + 36);

            drawHowtoFormula(ctx, r.top + 90, r.formula);

            ctx.fillStyle = 'rgba(28,61,95,0.75)'; ctx.font = '10px sans-serif';
            ctx.fillText(r.note, GAME_WIDTH/2, r.top + 150);
        });

        // ④ ネタ切れと仕入れ（補充）セクションの描画
        const r4Top = 595;
        ctx.fillStyle = '#1c3d5f'; ctx.font = 'bold 18px serif'; ctx.textAlign = 'center';
        ctx.fillText('④ ネタ切れと仕入れ（補充）', GAME_WIDTH/2, r4Top + 20);
        ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(28,61,95,0.7)';
        ctx.fillText('ネタは使用すると在庫が減る。', GAME_WIDTH/2, r4Top + 36);

        // ミニサンプルの描画
        ctx.save();
        // 左：売切表示サンプル
        drawWashiCard(ctx, 80, r4Top + 48, 140, 50, 10);
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.roundRect(80, r4Top + 48, 140, 50, 10); ctx.fill();
        ctx.strokeStyle = '#d9381e'; ctx.lineWidth = 3; ctx.strokeRect(81, r4Top + 49, 138, 48);
        ctx.fillStyle = '#d9381e'; ctx.fillRect(90, r4Top + 63, 120, 20);
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px serif'; ctx.fillText('売切御免！', 150, r4Top + 77);

        // 右：補充完了サンプル
        drawWashiCard(ctx, 260, r4Top + 48, 140, 50, 10);
        ctx.fillStyle = '#3a7d44'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('仕入れ完了！', 330, r4Top + 72);
        ctx.fillStyle = '#1c3d5f'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('x10', 385, r4Top + 90);
        ctx.restore();

        ctx.fillStyle = 'rgba(28,61,95,0.85)'; ctx.font = 'bold 11px sans-serif';
        ctx.fillText('使いたいネタを長押しで補充可能！', GAME_WIDTH/2, r4Top + 120);

        drawCard(ctx, 100, 765, 280, 55, '#1c3d5f');
        ctx.fillStyle = '#f6ecd9'; ctx.font = 'bold 20px serif'; ctx.textAlign = 'center';
        ctx.fillText('タイトルへ戻る', GAME_WIDTH/2, 800);

        ctx.textAlign = 'left';
        return;
    }

    if (state === STATE.HIGHSCORE) {
        ctx.fillStyle = '#f4eee6'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1c3d5f'; ctx.font = 'bold 28px serif';
        ctx.fillText('歴代ハイスコア', GAME_WIDTH/2, 60);

        const scores = getHighScores();
        if (scores.length === 0) {
            ctx.fillStyle = '#1c3d5f'; ctx.font = '18px serif';
            ctx.fillText('記録がありません', GAME_WIDTH/2, 350);
        } else {
            const startY = 110;
            const rowH = 105;
            const medals = ['🥇', '🥈', '🥉', ' 4位', ' 5位'];
            const medalSizes = [72, 72, 72, 26, 26]; // 各順位文字サイズ

            scores.forEach((sc, i) => {
                const y = startY + i * rowH;
                drawWashiCard(ctx, 40, y, 400, 85, 14);
                
                // 順位表示
                ctx.font = `bold ${medalSizes[i]}px sans-serif`; //順位文字サイズ・フォント
                ctx.fillStyle = '#1c3d5f'; //順位文字色
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(medals[i], 50, y + 43);

                ctx.textBaseline = 'alphabetic'; // 以降の描画のためベースラインを元に戻す
                // スコア
                ctx.font = 'bold 26px serif'; ctx.textAlign = 'right';
                ctx.fillStyle = '#d9381e';
                ctx.fillText(`￥${sc.score.toLocaleString()}`, 410, y + 43);
                // 日付
                ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(28,61,95,0.6)';
                ctx.fillText(sc.date, 410, y + 68);
            });
        }

        drawCard(ctx, 100, 745, 280, 60, '#1c3d5f');
        ctx.fillStyle = '#f6ecd9'; ctx.font = 'bold 20px serif'; ctx.textAlign = 'center';
        ctx.fillText('タイトルへ戻る', GAME_WIDTH/2, 783);

        ctx.textAlign = 'left';
        return;
    }

    if (state === STATE.GAMEOVER) {
        ctx.fillStyle = '#c0975b'; ctx.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);
        ctx.drawImage(assets['noren_closed'], 0, 0);
        ctx.fillStyle = 'rgba(10,8,5,0.25)'; ctx.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#f6ecd9'; ctx.font = 'bold 42px serif'; ctx.fillText('本日の営業終了', GAME_WIDTH/2, 340);
        ctx.fillStyle = '#e6c877'; ctx.font = 'bold 32px sans-serif'; ctx.fillText(`本日の売上 ￥${score.toLocaleString()}`, GAME_WIDTH/2, 400);

        drawCard(ctx, 100, 560, 280, 62, '#1c3d5f');
        ctx.fillStyle = '#f6ecd9'; ctx.font = 'bold 20px serif'; ctx.fillText('また明日、タイトルへ', GAME_WIDTH/2, 599);
        ctx.textAlign = 'left';
        return;
    }

    // 上部の暖簾
    ctx.drawImage(assets['noren'], 0, 0);

    // ヘッダーUI
    drawWashiCard(ctx, 10, 10, 150, 50);
    ctx.fillStyle = '#1c3d5f'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign='left';
    ctx.fillText(`💰￥${score}`, 20, 30); ctx.fillText(`⭐${rating.toFixed(1)}`, 20, 50);

    drawWashiCard(ctx, 410, 10, 58, 45);
    ctx.fillStyle = '#1c3d5f'; ctx.fillRect(430, 20, 6, 25); ctx.fillRect(442, 20, 6, 25);

    // 画面横いっぱいの電光掲示板（マーキーテロップ表示）
    if (currentTickerText) {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 15, 15, 0.9)';
        ctx.fillRect(0, 65, GAME_WIDTH, 24);

        ctx.strokeStyle = '#d9381e';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 65, GAME_WIDTH, 24);

        // クリッピング領域を設定して画面外へのはみ出しを防止
        ctx.beginPath();
        ctx.rect(0, 65, GAME_WIDTH, 24);
        ctx.clip();

        ctx.fillStyle = '#ff4d4d';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(currentTickerText, tickerX, 77);
        ctx.restore();
    }

    // カウンターのお客さん
    for (let i = 0; i < CUSTOMER_SLOTS; i++) {
        const slotCx = customerSlotX(i);
        const c = customers.find(cc => cc.slot === i);
        if (!c) continue;

        const isAngry = c.patience <= 35 && c.eatingTimer <= 0;

        if (c.eatingTimer <= 0 && (c.revealTimer > 0 || isAngry)) {
            const bw = 82, bh = 58, by = 95;
            const bx = slotCx - bw/2;
            const alpha = (c.revealTimer < 0.5 && !isAngry) ? c.revealTimer/0.5 : 1;
            ctx.globalAlpha = alpha;
            drawWashiCard(ctx, bx, by, bw, bh, 12);
            ctx.fillStyle = '#f6ecd9';
            ctx.beginPath();
            ctx.moveTo(slotCx-8, by+bh-2); ctx.lineTo(slotCx+8, by+bh-2); ctx.lineTo(slotCx, by+bh+9);
            ctx.closePath(); ctx.fill();

            drawCompleteSushi(ctx, slotCx, by+30, c.key, c.isSabiNuki, 0.36);

            if (c.isSabiNuki) {
                ctx.fillStyle = '#d9381e'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText('サビ抜き', slotCx, by+bh-6);
            }
            if (c.isVip) {
                ctx.fillStyle = '#b8860b'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText('★VIP★', slotCx, by+10);
            }
            if (isAngry) {
                ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText('💢', bx + bw - 6, by + 14);
            }
            ctx.globalAlpha = 1;
        }

        drawCustomerBust(ctx, slotCx, 205, i, c.isVip, c.eatingTimer > 0, isAngry);

        if (c.eatingTimer <= 0) {
            const tRatio = Math.max(0, c.patience / c.maxPatience);
            const barW = 56;
            drawWashiCard(ctx, slotCx-barW/2-4, 165, barW+8, 13, 6);
            ctx.fillStyle = 'rgba(28,61,95,0.2)'; ctx.fillRect(slotCx-barW/2, 169, barW, 4);
            ctx.fillStyle = tRatio > 0.3 ? '#3a7d44' : '#d9381e';
            ctx.fillRect(slotCx-barW/2, 169, barW*tRatio, 4);
        }
    }

    // カウンターの縁
    ctx.strokeStyle = 'rgba(60,38,18,0.5)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(8, 250); ctx.lineTo(472, 250); ctx.stroke();

    // パレット (3x3)
    const gridX = [20, 170, 320]; const gridY = [265, 350, 435];
    const keys = ['maguro', 'salmon', 'ikura', 'tamago', 'ebi', 'buri', 'uni', 'anago', 'ika'];
    keys.forEach((k, i) => {
        const r = Math.floor(i/3); const c = i%3;
        const px = gridX[c], py = gridY[r];
        drawWashiCard(ctx, px, py, 130, 75);
        const paletteKey = (k === 'ikura' || k === 'uni') ? k + '_bowl' : k;
        ctx.drawImage(assets[paletteKey], px+5, py-2);

        // 在庫数・売切帯表示を描画
        drawStockOverlay(px, py, 130, 75, k);

        // 長押し補充プログレスリングを描画（指定時間経過後に表示）
        if (reloadingItem === k && holdTimer >= RING_SHOW_DELAY) {
            drawReloadProgress(px + 65, py + 30, Math.min(1.0, holdTimer / HOLD_TIME_REQUIRED));
        }
    });

    // 下部調理場（わさび・のり・シャリは在庫数・プログレスリングなし）
    ctx.drawImage(assets['wasabi_plate'], 15, 520);
    ctx.drawImage(assets['nori_plate'], 95, 520);
    ctx.drawImage(assets['hangiri'], 5, 605);

    ctx.drawImage(assets['manaita'], 180, 535);
    ctx.drawImage(assets['knife'], 180, 770);

    // まな板上の寿司
    if (cuttingBoard.length > 0) {
        const bx = 320, by = 625;
        if (cuttingBoard.includes('rice')) ctx.drawImage(assets['shari'], bx-60, by-40);
        if (cuttingBoard[0]==='rice' && cuttingBoard[1]==='nori') { ctx.fillStyle='#171c15'; ctx.beginPath(); ctx.roundRect(bx-45, by-45, 90, 50, 5); ctx.fill(); }
        if (cuttingBoard.includes('wasabi') && !cuttingBoard.includes('nori')) { ctx.fillStyle='#8cc63f'; ctx.beginPath(); ctx.arc(bx, by-10, 10, 0, Math.PI*2); ctx.fill(); }
        
        const top = cuttingBoard.find(i => TOPPINGS[i]);
        if (top) ctx.drawImage(assets[top], bx-60, by-55);
        if (cuttingBoard[0]==='rice' && TOPPINGS[cuttingBoard[1]]?.category==='tamago' && cuttingBoard[2]==='nori') {
            ctx.fillStyle='#171c15'; ctx.fillRect(bx-10, by-40, 20, 55);
        }

        ctx.fillStyle = 'rgba(28,61,95,0.5)'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('タップでやり直し (-100円)', bx, by+45);
    }

    // PAUSE
    if (state === STATE.PAUSED) {
        ctx.fillStyle = 'rgba(20,14,8,0.72)'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = '#f6ecd9'; ctx.font = 'bold 34px serif'; ctx.textAlign = 'center'; ctx.fillText('少々休憩', GAME_WIDTH/2, 280);
        drawCard(ctx, 100, 350, 280, 60, '#3a7d44'); ctx.fillStyle = '#f6ecd9'; ctx.font = 'bold 20px serif'; ctx.fillText('つづける', GAME_WIDTH/2, 388);
        drawCard(ctx, 100, 430, 280, 60, '#c9973a'); ctx.fillStyle = '#f6ecd9'; ctx.fillText('はじめから', GAME_WIDTH/2, 468);
        drawCard(ctx, 100, 510, 280, 60, '#1c3d5f'); ctx.fillStyle = '#f6ecd9'; ctx.fillText('やめる', GAME_WIDTH/2, 548);
        ctx.font = 'bold 20px sans-serif';
    }
}

// ========================================
// 固定60FPSゲームループ
// ========================================

const STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 5;

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

    elapsedTime += frameDelta / 1000;

    if (frameDelta > STEP_MS * MAX_STEPS_PER_FRAME) {
        frameDelta = STEP_MS * MAX_STEPS_PER_FRAME;
    }

    accumulator += frameDelta;

    while (accumulator >= STEP_MS) {
        update(STEP_MS / 1000);
        accumulator -= STEP_MS;
    }

    draw();
}

// ========================================
// 初期化
// ========================================

function init() {
    resizeCanvas();
    initInputHandlers();
    initBackButtonGuard();

    initAssets();
    loadingEl.style.display = "none";

    requestAnimationFrame(gameLoop);
}

document.addEventListener("DOMContentLoaded", init);
