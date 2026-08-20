// ========================================
// MRS WORKS
// FOUR COLORS - Game Logic
// ========================================


/**
 * ゲーム設定および定数
 */
const COLOR_PALETTE = [
    { name: 'BLUE',   hex: '#00d2ff', light: '#80e9ff' },
    { name: 'RED',    hex: '#ff3366', light: '#ff80a0' },
    { name: 'YELLOW', hex: '#ffcc00', light: '#ffea80' },
    { name: 'GREEN',  hex: '#42e695', light: '#a1f3ca' }
];

const SPECIAL_TYPES = {
    NONE: 0,
    JAMMER: 1, // おじゃまピース
    GIANT: 2   // でかピース
};

const DIFFICULTY_SETTINGS = {
    EASY:   { initialSpeed: 0.35, accel: 0.00004, jammerMinScore: 100, triangleMinScore: Infinity, horizontalMinScore: Infinity, randomSequence: false },
    NORMAL: { initialSpeed: 0.35, accel: 0.00004, jammerMinScore: 0,   triangleMinScore: 100,      horizontalMinScore: 300,      randomSequence: false },
    HARD:   { initialSpeed: 0.35, accel: 0.00004, jammerMinScore: 0,   triangleMinScore: 0,        horizontalMinScore: 0,        randomSequence: true  }
};

// 点が多角形（Polygon）の内部にあるかチェック
function pointInPolygon(px, py, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x, yi = points[i].y;
        const xj = points[j].x, yj = points[j].y;
        const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// 2つの多角形が実質的な長さの辺を共有しているか判定
function shareEdge(p1, p2) {
    const minOverlap = 10.0;
    const eps = 3.5;

    for (let i = 0; i < p1.points.length; i++) {
        const a1 = p1.points[i];
        const a2 = p1.points[(i + 1) % p1.points.length];

        for (let j = 0; j < p2.points.length; j++) {
            const b1 = p2.points[j];
            const b2 = p2.points[(j + 1) % p2.points.length];

            if (segmentOverlap(a1, a2, b1, b2, minOverlap, eps)) {
                return true;
            }
        }
    }
    return false;
}

function segmentOverlap(a1, a2, b1, b2, minOverlap, eps) {
    const ax = a2.x - a1.x, ay = a2.y - a1.y;
    const aLen = Math.hypot(ax, ay);
    if (aLen < 1e-4) return false;
    const ux = ax / aLen, uy = ay / aLen;

    const dist_b1 = Math.abs((b1.x - a1.x) * (-uy) + (b1.y - a1.y) * ux);
    const dist_b2 = Math.abs((b2.x - a1.x) * (-uy) + (b2.y - a1.y) * ux);

    if (dist_b1 > eps || dist_b2 > eps) return false;

    const t_a1 = 0;
    const t_a2 = aLen;

    const t_b1 = (b1.x - a1.x) * ux + (b1.y - a1.y) * uy;
    const t_b2 = (b2.x - a1.x) * ux + (b2.y - a1.y) * uy;

    const minB = Math.min(t_b1, t_b2);
    const maxB = Math.max(t_b1, t_b2);

    const overlapStart = Math.max(t_a1, minB);
    const overlapEnd = Math.min(t_a2, maxB);

    return (overlapEnd - overlapStart) >= minOverlap;
}

// Web Audio API による効果音再生
class SoundController {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
    }

    playTap() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    playJammerChange() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    playGameOver() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(60, now + 0.4);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
    }
}

/**
 * 幾何学四角形パズルコアロジック
 */
class GameEngine {
    constructor(canvas, sound) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.sound = sound;

        this.width = 0;
        this.height = 0;
        this.dpr = window.devicePixelRatio || 1;

        this.selectedDifficulty = 'EASY';
        this.score = 0;
        this.bestScore = 0;

        this.colorQueue = [0, 1, 2, 3]; 

        this.polygons = [];
        this.nextPolyId = 1;
        this.scrollOffset = 0; 
        this.topGeneratedY = 0; 

        this.speed = 0;
        this.accel = 0;
        this.jammerMinScore = 0;
        this.triangleMinScore = Infinity;
        this.horizontalMinScore = Infinity;
        this.randomSequence = false;
        this.isRunning = false;
        this.isPaused = false;
        this.isGameOver = false;
        this.resultTimerId = null;

        this.recentSplitHistory = [];
        this.deadlineY = 0; 
        this.effects = []; 

        this.lastGameOverLog = null;
        this.tapHistory = [];

        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const container = this.canvas.parentElement;
        if (!container) return;

        let w = container.clientWidth;
        let h = container.clientHeight;

        if (w === 0 || h === 0) {
            const rect = container.getBoundingClientRect();
            w = rect.width || window.innerWidth;
            h = rect.height || (window.innerHeight - 70);
        }

        if (w <= 0 || h <= 0) return;

        this.width = w;
        this.height = h;
        this.dpr = window.devicePixelRatio || 1;

        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.dpr, this.dpr);

        this.deadlineY = this.height - 40;
    }

    stopAndClear() {
        this.isRunning = false;
        this.isPaused = false;
        this.polygons = [];
        this.effects = [];
        if (this.ctx && this.canvas) {
            this.ctx.save();
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.restore();
        }
    }

    start(difficulty) {
        if (this.resultTimerId) {
            clearTimeout(this.resultTimerId);
            this.resultTimerId = null;
        }

        this.stopAndClear();
        this.resize();

        this.selectedDifficulty = difficulty;
        const settings = DIFFICULTY_SETTINGS[difficulty] || DIFFICULTY_SETTINGS.EASY;
        this.speed = settings.initialSpeed;
        this.accel = settings.accel;
        this.jammerMinScore = settings.jammerMinScore;
        this.triangleMinScore = settings.triangleMinScore;
        this.horizontalMinScore = settings.horizontalMinScore;
        this.randomSequence = settings.randomSequence;

        this.score = 0;
        
        if (this.randomSequence) {
            this.colorQueue = [];
            let lastColor = -1;
            for (let i = 0; i < 4; i++) {
                let nextC = this.getRandomNextColor(lastColor);
                this.colorQueue.push(nextC);
                lastColor = nextC;
            }
        } else {
            this.colorQueue = [0, 1, 2, 3];
        }

        this.polygons = [];
        this.nextPolyId = 1;
        this.scrollOffset = 0;
        
        this.topGeneratedY = 0; 
        this.recentSplitHistory = [];
        
        this.effects = [];
        this.isPaused = false;
        this.isGameOver = false;
        this.lastGameOverLog = null;
        this.tapHistory = [];

        this.loadBestScore();
        this.generateInitialBoard();
        this.updateColorUI();
        this.updateScoreUI();
        
        this.isRunning = true;
    }

    getRandomNextColor(previousColor) {
        let candidates = [0, 1, 2, 3].filter(c => c !== previousColor);
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    advanceColor() {
        if (this.randomSequence) {
            this.colorQueue.shift();
            let lastInQueue = this.colorQueue[this.colorQueue.length - 1];
            let newColor = this.getRandomNextColor(lastInQueue);
            this.colorQueue.push(newColor);
        } else {
            let nextVal = (this.colorQueue[0] + 1) % 4;
            this.colorQueue = [
                nextVal,
                (nextVal + 1) % 4,
                (nextVal + 2) % 4,
                (nextVal + 3) % 4
            ];
        }
    }

    pause() {
        if (!this.isRunning || this.isGameOver) return;
        this.isPaused = true;
        this.isRunning = false;
        showPauseOverlay(this.score, this.bestScore);
    }

    resume() {
        if (this.isGameOver) return;
        this.isPaused = false;
        this.isRunning = true;
        hidePauseOverlay();
    }

    loadBestScore() {
        const key = `4color_best_${this.selectedDifficulty}`;
        this.bestScore = parseInt(localStorage.getItem(key) || '0', 10);
    }

    saveBestScore() {
        const key = `4color_best_${this.selectedDifficulty}`;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem(key, this.bestScore.toString());
        }
    }

    generateInitialBoard() {
        this.polygons = [];
        this.topGeneratedY = 0; 
        if (this.width <= 0) return;

        while (this.topGeneratedY > -800) {
            this.generateRow();
        }
    }

    getCurrentJammerRate() {
        if (this.score < this.jammerMinScore) return 0.0;

        if (this.selectedDifficulty === 'HARD') {
            return (this.score >= 100) ? 0.10 : 0.05;
        } else {
            return 0.05;
        }
    }

    generateRow() {
        if (this.width <= 0) return;

        const rowHeight = 70 + Math.random() * 20; 
        const yStart = this.topGeneratedY - rowHeight;
        
        const colsCount = Math.floor(Math.random() * 3) + 3; 
        const minCellWidth = this.width * 0.16;
        const strictDistanceRatio = 0.28; 

        let splits = [];
        let attempts = 0;
        let success = false;

        while (attempts < 60 && !success) {
            let innerSplits = [];
            for (let i = 0; i < colsCount - 1; i++) {
                innerSplits.push(Math.random());
            }
            innerSplits.sort((a, b) => a - b);
            
            let candidateSplits = [0, ...innerSplits, 1];

            let widthOk = true;
            for (let i = 0; i < candidateSplits.length - 1; i++) {
                const w = (candidateSplits[i+1] - candidateSplits[i]) * this.width;
                if (w < minCellWidth) {
                    widthOk = false;
                    break;
                }
            }

            if (!widthOk) {
                attempts++;
                continue;
            }

            let crossJunctionDetected = false;
            for (let cVal of innerSplits) {
                for (let pastSplits of this.recentSplitHistory) {
                    for (let pVal of pastSplits) {
                        if (pVal === 0 || pVal === 1) continue;
                        if (Math.abs(cVal - pVal) < strictDistanceRatio) {
                            crossJunctionDetected = true;
                            break;
                        }
                    }
                    if (crossJunctionDetected) break;
                }
                if (crossJunctionDetected) break;
            }

            if (crossJunctionDetected) {
                attempts++;
                continue; 
            }

            splits = candidateSplits;
            success = true;
        }

        if (!success) {
            splits = [0];
            const avgRatio = 1.0 / colsCount;
            let offset = (this.recentSplitHistory.length > 0) ? 0.33 : 0;
            for (let i = 1; i < colsCount; i++) {
                let val = (i * avgRatio + offset) % 0.85 + 0.08;
                splits.push(val);
            }
            splits.push(1);
            splits.sort((a, b) => a - b);
        }

        let pureInnerSplits = splits.slice(1, -1);
        this.recentSplitHistory.push(pureInnerSplits);
        if (this.recentSplitHistory.length > 3) {
            this.recentSplitHistory.shift();
        }

        let newPolys = [];

        const allowTriangle = (this.score >= this.triangleMinScore);
        const allowHorizontal = (this.score >= this.horizontalMinScore);
        const currentJammerRate = this.getCurrentJammerRate();

        for (let i = 0; i < colsCount; i++) {
            let xStart = splits[i] * this.width;
            let xWidth = (splits[i+1] - splits[i]) * this.width;

            for (let pastSplits of this.recentSplitHistory) {
                for (let lv of pastSplits) {
                    let absX = lv * this.width;
                    if (Math.abs(xStart - absX) < 8) xStart = absX;
                    let endX = xStart + xWidth;
                    if (Math.abs(endX - absX) < 8) xWidth = absX - xStart;
                }
            }

            const safeX = isNaN(xStart) ? 0 : xStart;
            const safeW = (isNaN(xWidth) || xWidth <= 0) ? (this.width / colsCount) : xWidth;

            let special = SPECIAL_TYPES.NONE;
            const rand = Math.random();
            if (rand < currentJammerRate) {
                special = SPECIAL_TYPES.JAMMER; 
            } else if (rand < currentJammerRate + 0.12) {
                special = SPECIAL_TYPES.GIANT;  
            }

            let shapeRand = Math.random();
            let chosenShape = 'NORMAL';

            if (special === SPECIAL_TYPES.NONE && safeW > this.width * 0.18) {
                if (allowHorizontal && allowTriangle) {
                    if (shapeRand < 0.18) chosenShape = 'HORIZONTAL';
                    else if (shapeRand < 0.35) chosenShape = 'TRIANGLE';
                } else if (allowTriangle) {
                    if (shapeRand < 0.17) chosenShape = 'TRIANGLE';
                }
            }

            if (chosenShape === 'HORIZONTAL') {
                const halfH = rowHeight / 2;
                newPolys.push({
                    id: this.nextPolyId++,
                    groupId: null,
                    chosenShape: 'HORIZONTAL',
                    points: [
                        { x: safeX, y: yStart },
                        { x: safeX + safeW, y: yStart },
                        { x: safeX + safeW, y: yStart + halfH },
                        { x: safeX, y: yStart + halfH }
                    ],
                    colorIndex: null,
                    specialType: SPECIAL_TYPES.NONE,
                    isCombined: false,
                    isOffending: false,
                    isFlashing: false
                });
                newPolys.push({
                    id: this.nextPolyId++,
                    groupId: null,
                    chosenShape: 'HORIZONTAL',
                    points: [
                        { x: safeX, y: yStart + halfH },
                        { x: safeX + safeW, y: yStart + halfH },
                        { x: safeX + safeW, y: yStart + rowHeight },
                        { x: safeX, y: yStart + rowHeight }
                    ],
                    colorIndex: null,
                    specialType: SPECIAL_TYPES.NONE,
                    isCombined: false,
                    isOffending: false,
                    isFlashing: false
                });
            } else if (chosenShape === 'TRIANGLE') {
                const isTLtoBR = Math.random() < 0.5;
                if (isTLtoBR) {
                    newPolys.push({
                        id: this.nextPolyId++,
                        groupId: null,
                        chosenShape: 'TRIANGLE',
                        points: [
                            { x: safeX, y: yStart },
                            { x: safeX + safeW, y: yStart },
                            { x: safeX + safeW, y: yStart + rowHeight }
                        ],
                        colorIndex: null,
                        specialType: SPECIAL_TYPES.NONE,
                        isCombined: false,
                        isOffending: false,
                        isFlashing: false
                    });
                    newPolys.push({
                        id: this.nextPolyId++,
                        groupId: null,
                        chosenShape: 'TRIANGLE',
                        points: [
                            { x: safeX, y: yStart },
                            { x: safeX, y: yStart + rowHeight },
                            { x: safeX + safeW, y: yStart + rowHeight }
                        ],
                        colorIndex: null,
                        specialType: SPECIAL_TYPES.NONE,
                        isCombined: false,
                        isOffending: false,
                        isFlashing: false
                    });
                } else {
                    newPolys.push({
                        id: this.nextPolyId++,
                        groupId: null,
                        chosenShape: 'TRIANGLE',
                        points: [
                            { x: safeX, y: yStart },
                            { x: safeX + safeW, y: yStart },
                            { x: safeX, y: yStart + rowHeight }
                        ],
                        colorIndex: null,
                        specialType: SPECIAL_TYPES.NONE,
                        isCombined: false,
                        isOffending: false,
                        isFlashing: false
                    });
                    newPolys.push({
                        id: this.nextPolyId++,
                        groupId: null,
                        chosenShape: 'TRIANGLE',
                        points: [
                            { x: safeX + safeW, y: yStart },
                            { x: safeX + safeW, y: yStart + rowHeight },
                            { x: safeX, y: yStart + rowHeight }
                        ],
                        colorIndex: null,
                        specialType: SPECIAL_TYPES.NONE,
                        isCombined: false,
                        isOffending: false,
                        isFlashing: false
                    });
                }
            } else {
                newPolys.push({
                    id: this.nextPolyId++,
                    groupId: null, 
                    chosenShape: 'NORMAL',
                    points: [
                        { x: safeX, y: yStart },
                        { x: safeX + safeW, y: yStart },
                        { x: safeX + safeW, y: yStart + rowHeight },
                        { x: safeX, y: yStart + rowHeight }
                    ],
                    colorIndex: null, 
                    specialType: special,
                    isCombined: false,
                    isOffending: false,
                    isFlashing: false 
                });
            }
        }

        newPolys.forEach(p => p.groupId = p.id);

        for (let i = 0; i < newPolys.length - 1; i++) {
            if (newPolys[i].specialType === SPECIAL_TYPES.GIANT && !newPolys[i].isCombined && newPolys[i].chosenShape === 'NORMAL') {
                if (i + 1 < newPolys.length && !newPolys[i+1].isCombined && newPolys[i+1].chosenShape === 'NORMAL') {
                    const p1 = newPolys[i];
                    const p2 = newPolys[i+1];
                    p1.points[1].x = p2.points[1].x;
                    p1.points[2].x = p2.points[2].x;
                    p2.isCombined = true; 
                }
            }
        }

        const activePolys = newPolys.filter(p => !p.isCombined);
        activePolys.forEach(p => this.polygons.push(p));

        this.topGeneratedY = yStart;

        this.recalculateNeighbors();
    }

    recalculateNeighbors() {
        this.polygons.forEach(p => p.neighbors = []);

        for (let i = 0; i < this.polygons.length; i++) {
            for (let j = i + 1; j < this.polygons.length; j++) {
                const p1 = this.polygons[i];
                const p2 = this.polygons[j];
                if (shareEdge(p1, p2)) {
                    p1.neighbors.push(p2.id);
                    p2.neighbors.push(p1.id);
                }
            }
        }
    }

    update() {
        if (!this.isRunning || this.isPaused) return;

        this.speed += this.accel;
        const dy = this.speed;
        this.scrollOffset += dy;

        this.polygons.forEach(p => {
            p.points.forEach(pt => pt.y += dy);
        });
        this.topGeneratedY += dy;

        if (this.topGeneratedY > -300) {
            this.generateRow();
        }

        let crossedIds = [];
        for (let p of this.polygons) {
            if (p.colorIndex === null) {
                const maxY = Math.max(...p.points.map(pt => pt.y));
                if (this.deadlineY > 100 && maxY >= this.deadlineY) {
                    crossedIds.push(p.id);
                }
            }
        }

        if (crossedIds.length > 0) {
            this.triggerGameOver('DEADLINE OVER', crossedIds, {
                detail: 'Uncolored cell crossed the deadline.',
                crossedCells: crossedIds.map(id => this.polygons.find(p => p.id === id))
            });
            return;
        }

        this.polygons = this.polygons.filter(p => {
            const minY = Math.min(...p.points.map(pt => pt.y));
            return minY < this.height + 150;
        });

        this.effects.forEach(e => e.life -= 0.05);
        this.effects = this.effects.filter(e => e.life > 0);
    }

    handleTap(screenX, screenY) {
        if (!this.isRunning || this.isPaused || this.isGameOver) return;

        const clickedPoly = this.polygons.find(p => p.colorIndex === null && !p.isFlashing &&
            pointInPolygon(screenX, screenY, p.points)
        );

        if (!clickedPoly) return;

        const currentColorIndex = this.colorQueue[0];

        this.tapHistory.push({
            time: Date.now(),
            polyId: clickedPoly.id,
            colorApplied: COLOR_PALETTE[currentColorIndex].name,
            x: Math.round(screenX),
            y: Math.round(screenY)
        });
        if (this.tapHistory.length > 10) this.tapHistory.shift();

        const currentGroup = clickedPoly.groupId;
        const currentPolysInGroup = this.polygons.filter(p => p.groupId === currentGroup);

        let conflict = false;
        let offendingNeighbors = [];
        let logNeighborsInfo = [];

        for (let member of currentPolysInGroup) {
            for (let nid of member.neighbors) {
                const neighbor = this.polygons.find(p => p.id === nid);
                if (neighbor) {
                    logNeighborsInfo.push({
                        neighborId: neighbor.id,
                        colorIndex: neighbor.colorIndex,
                        colorName: neighbor.colorIndex !== null ? COLOR_PALETTE[neighbor.colorIndex].name : 'NULL',
                        isSame: neighbor.colorIndex === currentColorIndex,
                        points: neighbor.points
                    });
                }
                if (neighbor && neighbor.groupId !== currentGroup && neighbor.colorIndex !== null && neighbor.colorIndex === currentColorIndex) {
                    conflict = true;
                    offendingNeighbors.push(neighbor.id);
                }
            }
        }

        if (conflict) {
            this.sound.playTap();
            currentPolysInGroup.forEach(p => p.colorIndex = currentColorIndex);
            this.addEffect(screenX, screenY, '#ff3366');
            
            const offendingIds = currentPolysInGroup.map(p => p.id);
            this.triggerGameOver('COLOR COLLISION', offendingIds, {
                clickedCell: clickedPoly,
                triedColor: COLOR_PALETTE[currentColorIndex].name,
                neighborsStatus: logNeighborsInfo
            });
            return;
        }

        if (clickedPoly.specialType === SPECIAL_TYPES.JAMMER) {
            this.sound.playTap();
            currentPolysInGroup.forEach(p => {
                p.colorIndex = currentColorIndex;
                p.isFlashing = false;
            });
            this.addEffect(screenX, screenY, COLOR_PALETTE[currentColorIndex].hex);

            const polyCenter = this.getPolyCenter(clickedPoly);

            setTimeout(() => {
                if (!this.isRunning) return;
                currentPolysInGroup.forEach(p => p.isFlashing = true);
                this.addEffect(polyCenter.x, polyCenter.y, '#ffffff');
            }, 250);

            setTimeout(() => {
                if (!this.isRunning) return;

                let possibleColors = [0, 1, 2, 3].filter(c => c !== currentColorIndex);
                let randomColorIndex = possibleColors[Math.floor(Math.random() * possibleColors.length)];

                this.sound.playJammerChange();
                
                const adjacentSame = [];
                for (let member of currentPolysInGroup) {
                    for (let nid of member.neighbors) {
                        const neighbor = this.polygons.find(p => p.id === nid);
                        if (neighbor && neighbor.groupId !== currentGroup && neighbor.colorIndex !== null && neighbor.colorIndex === randomColorIndex) {
                            adjacentSame.push(neighbor);
                        }
                    }
                }

                if (adjacentSame.length > 0) {
                    adjacentSame.forEach(neighbor => {
                        const neighborGroup = neighbor.groupId;
                        this.polygons.forEach(p => {
                            if (p.groupId === neighborGroup) {
                                p.groupId = currentGroup;
                            }
                        });
                    });

                    this.polygons.forEach(p => {
                        if (p.groupId === currentGroup) {
                            p.colorIndex = randomColorIndex;
                            p.isFlashing = false;
                        }
                    });

                    this.addEffect(polyCenter.x, polyCenter.y, '#ff00ff');
                } else {
                    currentPolysInGroup.forEach(p => {
                        p.colorIndex = randomColorIndex;
                        p.isFlashing = false;
                    });
                    this.addEffect(polyCenter.x, polyCenter.y, COLOR_PALETTE[randomColorIndex].hex);
                }
            }, 450);

        } else {
            this.sound.playTap();
            currentPolysInGroup.forEach(p => p.colorIndex = currentColorIndex);
            this.addEffect(screenX, screenY, COLOR_PALETTE[currentColorIndex].hex);
        }

        this.advanceColor();
        this.updateColorUI();

        this.score += 10;
        this.updateScoreUI();
    }

    getPolyCenter(p) {
        let sumX = 0, sumY = 0;
        p.points.forEach(pt => {
            sumX += pt.x;
            sumY += pt.y;
        });
        return { x: sumX / p.points.length, y: sumY / p.points.length };
    }

    addEffect(x, y, color) {
        this.effects.push({ x, y, color, life: 1.0 });
    }

    triggerGameOver(reason, offendingCellIds = [], debugDetails = {}) {
        this.isRunning = false;
        this.isGameOver = true;
        this.sound.playGameOver();

        this.polygons.forEach(p => {
            if (offendingCellIds.includes(p.id)) {
                p.isOffending = true;
            }
        });

        this.lastGameOverLog = {
            timestamp: new Date().toISOString(),
            reason: reason,
            difficulty: this.selectedDifficulty,
            score: this.score,
            offendingCellIds: offendingCellIds,
            debugDetails: debugDetails,
            recentTapHistory: this.tapHistory,
            activePolygonsCount: this.polygons.length,
            screenSize: { width: this.width, height: this.height, dpr: this.dpr, deadlineY: this.deadlineY }
        };

        this.saveBestScore();

        if (this.resultTimerId) clearTimeout(this.resultTimerId);
        this.resultTimerId = setTimeout(() => {
            this.resultTimerId = null;
            showResultOverlay(this.score, this.bestScore);
        }, 2500);
    }

    tracePolyPath(p) {
        this.ctx.beginPath();
        this.ctx.moveTo(p.points[0].x, p.points[0].y);
        for (let i = 1; i < p.points.length; i++) {
            this.ctx.lineTo(p.points[i].x, p.points[i].y);
        }
        this.ctx.closePath();
    }

    render() {
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();

        // 1. 基本塗り・通常白色枠線の描画
        for (let p of this.polygons) {
            this.tracePolyPath(p);

            if (p.isFlashing) {
                this.ctx.fillStyle = '#ffffff';
            } else if (p.colorIndex !== null) {
                this.ctx.fillStyle = COLOR_PALETTE[p.colorIndex].hex;
            } else {
                this.ctx.fillStyle = '#181d2b';
            }
            this.ctx.fill();

            if (!p.isOffending && !p.isFlashing && p.specialType !== SPECIAL_TYPES.JAMMER) {
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                this.ctx.lineWidth = 1.8;
                this.ctx.stroke();
            }
        }

        // 2. おじゃまセルの虹色枠
        for (let p of this.polygons) {
            if (p.specialType === SPECIAL_TYPES.JAMMER && !p.isOffending && !p.isFlashing) {
                this.tracePolyPath(p);

                const rainbowHue = (Date.now() / 6) % 360;
                this.ctx.strokeStyle = `hsl(${rainbowHue}, 100%, 55%)`;
                this.ctx.lineWidth = 3.5;
                this.ctx.shadowColor = `hsl(${rainbowHue}, 100%, 55%)`;
                this.ctx.shadowBlur = 10;
                this.ctx.stroke();
                this.ctx.shadowBlur = 0; 
            }
        }

        // 3. フラッシュ演出中の枠
        for (let p of this.polygons) {
            if (p.isFlashing && !p.isOffending) {
                this.tracePolyPath(p);

                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 4;
                this.ctx.shadowColor = '#ffffff';
                this.ctx.shadowBlur = 20;
                this.ctx.stroke();
                this.ctx.shadowBlur = 0; 
            }
        }

        // 4. 【最前面】アウトのセル枠線（赤白点滅）
        for (let p of this.polygons) {
            if (p.isOffending) {
                this.tracePolyPath(p);

                const flashState = Math.floor(Date.now() / 150) % 2 === 0;
                this.ctx.strokeStyle = flashState ? '#ff3333' : '#ffffff';
                this.ctx.lineWidth = 6;
                this.ctx.shadowColor = '#ff3333';
                this.ctx.shadowBlur = 15;
                this.ctx.stroke();
                this.ctx.shadowBlur = 0; 
            }
        }

        for (let e of this.effects) {
            this.ctx.beginPath();
            this.ctx.arc(e.x, e.y, (1 - e.life) * 55, 0, Math.PI * 2);
            this.ctx.fillStyle = e.color;
            this.ctx.globalAlpha = e.life;
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;
        }
    }

    updateColorUI() {
        const now = COLOR_PALETTE[this.colorQueue[0]];
        const next = COLOR_PALETTE[this.colorQueue[1]];
        const after = COLOR_PALETTE[this.colorQueue[2]];

        document.getElementById('color-now').style.backgroundColor = now.hex;
        document.getElementById('color-now').style.color = now.hex;
        document.getElementById('color-next').style.backgroundColor = next.hex;
        document.getElementById('color-after').style.backgroundColor = after.hex;
    }

    updateScoreUI() {
        document.getElementById('game-score').innerText = this.score;
        document.getElementById('game-best-score').innerText = `BEST: ${Math.max(this.score, this.bestScore)}`;
        const diffTag = document.getElementById('game-diff-tag');
        diffTag.innerText = this.selectedDifficulty;
        diffTag.setAttribute('data-diff', this.selectedDifficulty);
    }
}

/**
 * UI管理およびイベントリスナー
 */
const sound = new SoundController();
const canvas = document.getElementById('game-canvas');
const engine = new GameEngine(canvas, sound);

let selectedDiff = 'EASY';

document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        sound.init();
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        selectedDiff = e.target.getAttribute('data-diff');
        updateTitleBestScore();
    });
});

function updateTitleBestScore() {
    const key = `4color_best_${selectedDiff}`;
    const best = localStorage.getItem(key) || '0';
    document.getElementById('title-best-score').innerText = best;
}

document.getElementById('start-btn').addEventListener('click', () => {
    sound.init();
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('pause-overlay').classList.add('hidden');
    document.getElementById('result-overlay').classList.add('hidden');
    document.getElementById('check-overlay-hud').classList.add('hidden');
    document.getElementById('log-modal').classList.add('hidden');

    engine.start(selectedDiff);
});

document.getElementById('pause-btn').addEventListener('click', () => {
    sound.init();
    engine.pause();
});

document.getElementById('resume-btn').addEventListener('click', () => {
    sound.init();
    engine.resume();
});

document.getElementById('pause-retry-btn').addEventListener('click', () => {
    hidePauseOverlay();
    engine.start(selectedDiff);
});

document.getElementById('pause-title-btn').addEventListener('click', () => {
    hidePauseOverlay();
    engine.stopAndClear();
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
    updateTitleBestScore();
});

document.getElementById('retry-btn').addEventListener('click', () => {
    document.getElementById('result-overlay').classList.add('hidden');
    document.getElementById('check-overlay-hud').classList.add('hidden');
    document.getElementById('log-modal').classList.add('hidden');
    engine.start(selectedDiff);
});

document.getElementById('result-title-btn').addEventListener('click', () => {
    document.getElementById('result-overlay').classList.add('hidden');
    document.getElementById('check-overlay-hud').classList.add('hidden');
    document.getElementById('log-modal').classList.add('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
    engine.stopAndClear();
    updateTitleBestScore();
});

document.getElementById('check-board-btn').addEventListener('click', () => {
    document.getElementById('result-overlay').classList.add('hidden');
    document.getElementById('check-overlay-hud').classList.remove('hidden');
});

document.getElementById('return-result-btn').addEventListener('click', () => {
    document.getElementById('check-overlay-hud').classList.add('hidden');
    document.getElementById('result-overlay').classList.remove('hidden');
});

document.getElementById('dev-log-btn').addEventListener('click', () => {
    const logData = engine.lastGameOverLog;
    const logStr = JSON.stringify(logData, null, 2);
    document.getElementById('log-text').value = logStr;
    document.getElementById('log-modal').classList.remove('hidden');
});

document.getElementById('copy-log-btn').addEventListener('click', () => {
    const text = document.getElementById('log-text').value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            alert('Log copied to clipboard!');
        }).catch(() => {
            document.getElementById('log-text').select();
            document.execCommand('copy');
            alert('Log copied!');
        });
    } else {
        document.getElementById('log-text').select();
        document.execCommand('copy');
        alert('Log copied!');
    }
});

document.getElementById('close-log-btn').addEventListener('click', () => {
    document.getElementById('log-modal').classList.add('hidden');
});

function showPauseOverlay(score, best) {
    document.getElementById('pause-score').innerText = score;
    document.getElementById('pause-best').innerText = best;
    document.getElementById('pause-overlay').classList.remove('hidden');
}

function hidePauseOverlay() {
    document.getElementById('pause-overlay').classList.add('hidden');
}

function showResultOverlay(score, best) {
    document.getElementById('result-score').innerText = score;
    document.getElementById('result-best').innerText = best;
    document.getElementById('result-overlay').classList.remove('hidden');
}

const canvasContainer = document.getElementById('canvas-container');

function handleInput(e) {
    if (e.cancelable) e.preventDefault();
    if (engine.width <= 0) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY || 0;
    }

    const x = (clientX - rect.left) * (engine.width / rect.width);
    const y = (clientY - rect.top) * (engine.height / rect.height);
    engine.handleTap(x, y);
}

// タッチ対応端末での二重発火を防止
let touchHandled = false;

canvasContainer.addEventListener('touchstart', (e) => {
    touchHandled = true;
    handleInput(e);
}, { passive: false });

canvasContainer.addEventListener('mousedown', (e) => {
    if (touchHandled) {
        touchHandled = false;
        return;
    }
    handleInput(e);
});

function gameLoop() {
    engine.update();
    engine.render();
    requestAnimationFrame(gameLoop);
}

updateTitleBestScore();
requestAnimationFrame(gameLoop);