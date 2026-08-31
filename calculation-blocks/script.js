(function () {
  "use strict";

  const ROWS = 10;
  const COLS = 6;
  const START_ROWS_FILLED = 3;
  const SPAWN_INTERVAL_MS = 5000;

  const DIFFICULTY_CONFIG = {
    VERYEASY: { operandCount: 2, operators: ["+", "－"], structure: "flat2" },
    EASY:     { operandCount: 2, operators: ["+", "－", "×", "÷"], structure: "flat2" },
    NORMAL:   { operandCount: 3, operators: ["+", "×", "－"], structure: "flat3-prec" },
    HARD:     { operandCount: 3, operators: ["+", "－", "×", "÷"], structure: "paren-right" },
  };

  // HARDモードでは毎ラウンド、この3パターンから均等ランダムで数式構造を選ぶ
  const HARD_STRUCTURES = ["flat3-prec", "paren-left", "paren-right"];

  function pickStructure(cfg) {
    if (state.difficulty === "HARD") {
      return HARD_STRUCTURES[Math.floor(Math.random() * HARD_STRUCTURES.length)];
    }
    return cfg.structure;
  }

  const DIFFICULTY_LABELS = {
    VERYEASY: "VERY EASY",
    EASY: "EASY",
    NORMAL: "NORMAL",
    HARD: "HARD",
  };

  const BLOCK_COLORS = {
    0: { bg: "#495057", fg: "#ffffff" },
    1: { bg: "#ef476f", fg: "#ffffff" },
    2: { bg: "#f3722c", fg: "#ffffff" },
    3: { bg: "#f9c74f", fg: "#241a00" },
    4: { bg: "#90be6d", fg: "#122b0a" },
    5: { bg: "#06d6a0", fg: "#07321f" },
    6: { bg: "#118ab2", fg: "#ffffff" },
    7: { bg: "#577590", fg: "#ffffff" },
    8: { bg: "#9b5de5", fg: "#ffffff" },
    9: { bg: "#f15bb5", fg: "#2a0026" },
  };

  function highScoreKey(diff) { return "puzzle_high_score_" + diff; }
  function getHighScore(diff) { return Number(safeGet(highScoreKey(diff))) || 0; }
  function setHighScore(diff, val) { safeSet(highScoreKey(diff), String(val)); }

  const state = {
    difficulty: "VERYEASY",
    score: 0,
    columns: [],
    operatorSeq: [],
    equationStructure: null,
    target: 0,
    selection: [],
    falling: [],
    pendingFall: 0,
    nextQueue: [],
    paused: false,
    spawnTimer: null,
    running: false,
    nextId: 1,
  };

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // ===================== DOM =====================
  let root, titleScreen, levelSelectScreen, gameScreen, pauseScreen, resultScreen;
  let boardWrap, boardEl, cellSize;
  let scoreVal, messageEl, diffLabel;
  let eqBar, slotEls, opEls, targetEl;
  let passButton, pauseButton;
  let resultScoreEl, resultHighScoreEl;
  let feedbackEl;
  let boardViewScreen, boardViewWrap, boardViewEl;
  let reviewScreen, reviewPassList, reviewMissList;
  let highScoreScreen, highScoreList;
  let nextBoxes;
  let confirmModal, confirmTextEl, confirmYesBtn, confirmNoBtn;

  const STAGE_W = 375;
  const STAGE_H = 667; // 9:16 (16:9のポートレート版) 固定デザイン解像度

  function updateStageScale() {
    const stageEl = document.getElementById("stage");
    const viewportEl = document.getElementById("viewport");
    if (!stageEl || !viewportEl) return;
    const vw = viewportEl.clientWidth;
    const vh = viewportEl.clientHeight;
    const scale = Math.min(vw / STAGE_W, vh / STAGE_H);
    stageEl.style.transform = `scale(${scale})`;
  }

  function initUI() {
    root = document.getElementById("app");
    root.innerHTML = "";
    createTitleScreen();
    createLevelSelectScreen();
    createGameScreen();
    createPauseScreen();
    createResultScreen();
    createBoardViewScreen();
    createReviewScreen();
    createHighScoreScreen();
    createFeedbackPop();
    createConfirmModal();
    showScreen("TITLE");
    updateStageScale();
    window.addEventListener("resize", () => { updateStageScale(); layoutBoard(); });
    window.addEventListener("orientationchange", () => setTimeout(() => { updateStageScale(); layoutBoard(); }, 150));
  }

  function createButton(label, cls) {
    const b = document.createElement("button");
    b.innerText = label;
    if (cls) b.className = cls;
    return b;
  }

  function colorizeButton(btn, colorIndex) {
    const c = BLOCK_COLORS[colorIndex % 10];
    btn.style.background = c.bg;
    btn.style.color = c.fg;
  }

  function pressThen(btn, callback, delay = 500) {
    btn.disabled = true;
    btn.classList.add("btn-flash");
    setTimeout(() => {
      btn.classList.remove("btn-flash");
      btn.disabled = false;
      callback();
    }, delay);
  }

  function createConfirmModal() {
    confirmModal = document.createElement("div");
    confirmModal.className = "confirm-modal";
    confirmModal.style.display = "none";

    const panel = document.createElement("div");
    panel.className = "confirm-panel";

    confirmTextEl = document.createElement("div");
    confirmTextEl.className = "confirm-text";

    const btnRow = document.createElement("div");
    btnRow.className = "confirm-btn-row";

    confirmYesBtn = createButton("はい");
    colorizeButton(confirmYesBtn, 5);
    confirmNoBtn = createButton("いいえ");
    colorizeButton(confirmNoBtn, 0);

    btnRow.appendChild(confirmYesBtn);
    btnRow.appendChild(confirmNoBtn);
    panel.appendChild(confirmTextEl);
    panel.appendChild(btnRow);
    confirmModal.appendChild(panel);
    root.appendChild(confirmModal);
  }

  function showConfirmModal(message, onYes) {
    confirmTextEl.innerText = message;
    confirmModal.style.display = "flex";

    confirmYesBtn.onclick = () => {
      pressThen(confirmYesBtn, () => {
        confirmModal.style.display = "none";
        onYes();
      });
    };
    confirmNoBtn.onclick = () => {
      pressThen(confirmNoBtn, () => {
        confirmModal.style.display = "none";
      });
    };
  }

  function createFeedbackPop() {
    feedbackEl = document.createElement("div");
    feedbackEl.id = "feedbackPop";
    root.appendChild(feedbackEl);
  }

  function createTitleScreen() {
    titleScreen = document.createElement("div");
    titleScreen.className = "screen";
    titleScreen.style.justifyContent = "center";

    const title = document.createElement("img");
    title.src = "images/TITLE.PNG";
    title.alt = "四則演算ブロック";
    title.className = "title-logo";

    const sub = document.createElement("div");
    sub.style.color = "var(--muted)";
    sub.style.marginBottom = "10px";
    sub.style.fontSize = "12px";
    sub.style.textAlign = "center";
    sub.style.whiteSpace = "pre-line";
    sub.innerText = "数字を選び、計算式を完成させろ！";

    const btnStart = createButton("START", "diff-btn");
    colorizeButton(btnStart, 5);
    btnStart.addEventListener("click", () => pressThen(btnStart, () => showScreen("LEVELSELECT")));

    const highScoreBtn = createButton("ハイスコア", "diff-btn");
    colorizeButton(highScoreBtn, 6);
    highScoreBtn.addEventListener("click", () => pressThen(highScoreBtn, () => showScreen("HIGHSCORES")));

    const mrsGamesLink = document.createElement("a");
    mrsGamesLink.innerText = "MRS GAMES";
    mrsGamesLink.href = "https://mrs-games.pages.dev";
    mrsGamesLink.target = "_blank";
    mrsGamesLink.rel = "noopener noreferrer";
    mrsGamesLink.className = "mrs-games-link";

    titleScreen.appendChild(title);
    titleScreen.appendChild(sub);
    titleScreen.appendChild(btnStart);
    titleScreen.appendChild(highScoreBtn);
    titleScreen.appendChild(mrsGamesLink);
    root.appendChild(titleScreen);
  }

  function createLevelSelectScreen() {
    levelSelectScreen = document.createElement("div");
    levelSelectScreen.className = "screen";
    levelSelectScreen.style.justifyContent = "center";
    levelSelectScreen.style.display = "none";

    const h = document.createElement("h2");
    h.innerText = "レベルを選択";

    const diffRow = document.createElement("div");
    diffRow.style.display = "flex";
    diffRow.style.flexDirection = "column";
    diffRow.style.alignItems = "center";
    diffRow.style.width = "100%";

    const levelColorMap = { VERYEASY: 4, EASY: 3, NORMAL: 2, HARD: 1 };
    ["VERYEASY", "EASY", "NORMAL", "HARD"].forEach((d) => {
      const btn = createButton(DIFFICULTY_LABELS[d], "diff-btn");
      colorizeButton(btn, levelColorMap[d]);
      btn.addEventListener("click", () => {
        pressThen(btn, () => {
          state.difficulty = d;
          startGame();
        });
      });
      diffRow.appendChild(btn);
    });

    const backBtn = createButton("タイトルへ戻る");
    colorizeButton(backBtn, 7);
    backBtn.addEventListener("click", () => pressThen(backBtn, () => showScreen("TITLE")));

    levelSelectScreen.appendChild(h);
    levelSelectScreen.appendChild(diffRow);
    levelSelectScreen.appendChild(backBtn);
    root.appendChild(levelSelectScreen);
  }

  function createHighScoreScreen() {
    highScoreScreen = document.createElement("div");
    highScoreScreen.className = "screen";
    highScoreScreen.style.justifyContent = "center";

    const h = document.createElement("h2");
    h.innerText = "ハイスコア";

    highScoreList = document.createElement("div");
    highScoreList.className = "review-list";
    highScoreList.style.marginTop = "6px";

    const backBtn = createButton("タイトルへ戻る");
    colorizeButton(backBtn, 8);
    backBtn.style.marginTop = "14px";
    backBtn.addEventListener("click", () => pressThen(backBtn, () => showScreen("TITLE")));

    highScoreScreen.appendChild(h);
    highScoreScreen.appendChild(highScoreList);
    highScoreScreen.appendChild(backBtn);
    root.appendChild(highScoreScreen);
  }

  function renderHighScores() {
    highScoreList.innerHTML = "";
    ["VERYEASY", "EASY", "NORMAL", "HARD"].forEach((d) => {
      const row = document.createElement("div");
      row.className = "review-item";
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      const label = document.createElement("span");
      label.innerText = DIFFICULTY_LABELS[d];
      const val = document.createElement("span");
      val.style.color = "var(--accent)";
      val.style.fontWeight = "bold";
      val.innerText = getHighScore(d);
      row.appendChild(label);
      row.appendChild(val);
      highScoreList.appendChild(row);
    });
  }

  function createGameScreen() {
    gameScreen = document.createElement("div");
    gameScreen.className = "screen";

    const topBar = document.createElement("div");
    topBar.id = "topBar";

    // 左側：DIFFICULTY（上）と SCORE（下）
    const leftCol = document.createElement("div");
    leftCol.id = "leftCol";
    diffLabel = document.createElement("div");
    diffLabel.innerText = "DIFFICULTY: EASY";
    scoreVal = document.createElement("div");
    scoreVal.id = "scoreVal";
    scoreVal.innerText = "SCORE: 0";
    leftCol.appendChild(diffLabel);
    leftCol.appendChild(scoreVal);

    // 右上：ポーズボタン単独配置（大きめ）
    pauseButton = createButton("⏸", "mini-btn pause-btn");
    pauseButton.setAttribute("aria-label", "PAUSE");
    pauseButton.addEventListener("click", () => {
      state.paused = true;
      showScreen("PAUSE");
    });

    topBar.appendChild(leftCol);
    topBar.appendChild(pauseButton);

    // 数式バーとPASSボタンを横並びにするエリア
    const eqRow = document.createElement("div");
    eqRow.id = "eqRow";

    eqBar = document.createElement("div");
    eqBar.id = "equationBar";

    passButton = createButton("PASS", "pass-btn");
    passButton.addEventListener("click", handlePass);

    eqRow.appendChild(eqBar);
    eqRow.appendChild(passButton);

    // サブバー（メッセージ＆NEXT表示エリア）
    const subBar = document.createElement("div");
    subBar.id = "subBar";

    messageEl = document.createElement("div");
    messageEl.id = "message";

    const nextSection = document.createElement("div");
    nextSection.id = "nextSection";
    const nextLabel = document.createElement("span");
    nextLabel.innerText = "NEXT";
    nextSection.appendChild(nextLabel);

    nextBoxes = [];
    for (let i = 0; i < 3; i++) {
      const box = document.createElement("div");
      box.className = "next-box";
      nextSection.appendChild(box);
      nextBoxes.push(box);
    }

    subBar.appendChild(messageEl);
    subBar.appendChild(nextSection);

    boardWrap = document.createElement("div");
    boardWrap.className = "board-area";
    boardEl = document.createElement("div");
    boardEl.className = "board-box";
    boardWrap.appendChild(boardEl);

    gameScreen.appendChild(topBar);
    gameScreen.appendChild(eqRow);
    gameScreen.appendChild(subBar);
    gameScreen.appendChild(boardWrap);
    root.appendChild(gameScreen);
  }

  function createPauseScreen() {
    pauseScreen = document.createElement("div");
    pauseScreen.className = "screen";
    pauseScreen.style.justifyContent = "center";
    const h = document.createElement("h2");
    h.innerText = "PAUSE";
    const resumeBtn = createButton("RESUME", "primary");
    resumeBtn.addEventListener("click", () => {
      state.paused = false;
      showScreen("GAME");
    });
    const titleBtn = createButton("TITLE");
    titleBtn.addEventListener("click", () => {
      showConfirmModal("タイトルに戻りますか？", () => {
        stopTimers();
        showScreen("TITLE");
      });
    });
    pauseScreen.appendChild(h);
    pauseScreen.appendChild(resumeBtn);
    pauseScreen.appendChild(titleBtn);
    root.appendChild(pauseScreen);
  }

  function createResultScreen() {
    resultScreen = document.createElement("div");
    resultScreen.className = "screen";
    resultScreen.style.justifyContent = "center";
    const h = document.createElement("h2");
    h.innerText = "GAME OVER";
    resultScoreEl = document.createElement("div");
    resultScoreEl.style.fontSize = "17px";
    resultScoreEl.style.margin = "8px 0";
    resultHighScoreEl = document.createElement("div");
    resultHighScoreEl.style.fontSize = "17px";
    resultHighScoreEl.style.margin = "8px 0";
    const boardBtn = createButton("盤面を見る");
    boardBtn.addEventListener("click", () => showScreen("BOARDVIEW"));
    const reviewBtn = createButton("復習する");
    reviewBtn.addEventListener("click", () => showScreen("REVIEW"));
    const retryBtn = createButton("RETRY", "primary");
    retryBtn.addEventListener("click", startGame);
    const titleBtn = createButton("TITLE");
    titleBtn.addEventListener("click", () => showScreen("TITLE"));
    resultScreen.appendChild(h);
    resultScreen.appendChild(resultScoreEl);
    resultScreen.appendChild(resultHighScoreEl);
    resultScreen.appendChild(boardBtn);
    resultScreen.appendChild(reviewBtn);
    resultScreen.appendChild(retryBtn);
    resultScreen.appendChild(titleBtn);
    root.appendChild(resultScreen);
  }

  function createBoardViewScreen() {
    boardViewScreen = document.createElement("div");
    boardViewScreen.className = "screen";
    const h = document.createElement("h2");
    h.innerText = "最終盤面";
    boardViewWrap = document.createElement("div");
    boardViewWrap.className = "board-area";
    boardViewEl = document.createElement("div");
    boardViewEl.className = "board-box";
    boardViewWrap.appendChild(boardViewEl);
    const backBtn = createButton("結果へ戻る", "primary");
    backBtn.style.marginTop = "8px";
    backBtn.addEventListener("click", () => showScreen("RESULT"));
    boardViewScreen.appendChild(h);
    boardViewScreen.appendChild(boardViewWrap);
    boardViewScreen.appendChild(backBtn);
    root.appendChild(boardViewScreen);
  }

  function renderColumnsInto(el, columns, size) {
    el.innerHTML = "";
    el.style.width = size * COLS + "px";
    el.style.height = size * ROWS + "px";
    for (let c = 0; c < COLS; c++) {
      const stack = columns[c];
      for (let i = 0; i < stack.length; i++) {
        const v = stack[i].value;
        const row = ROWS - 1 - i;
        const colors = BLOCK_COLORS[v];
        const div = document.createElement("div");
        div.className = "block landed";
        div.style.width = size - 4 + "px";
        div.style.height = size - 4 + "px";
        div.style.left = c * size + 2 + "px";
        div.style.top = row * size + "px";
        div.style.fontSize = Math.floor(size * 0.42) + "px";
        div.style.background = colors.bg;
        div.style.color = colors.fg;
        div.innerText = v;
        el.appendChild(div);
      }
    }
  }

  function layoutBoardView() {
    if (!boardViewWrap) return;
    const availW = boardViewWrap.clientWidth || 300;
    const availH = boardViewWrap.clientHeight || 400;
    const size = Math.floor(Math.min(availW / COLS, availH / ROWS));
    renderColumnsInto(boardViewEl, state.finalColumns || [], size);
  }

  function createReviewScreen() {
    reviewScreen = document.createElement("div");
    reviewScreen.className = "screen";
    reviewScreen.style.overflowY = "auto";

    const h = document.createElement("h2");
    h.innerText = "復習";

    const passTitle = document.createElement("div");
    passTitle.className = "review-title";
    passTitle.innerText = "パスした数式";
    reviewPassList = document.createElement("div");
    reviewPassList.className = "review-list";

    const missTitle = document.createElement("div");
    missTitle.className = "review-title";
    missTitle.innerText = "3回以上まちがえた数式";
    reviewMissList = document.createElement("div");
    reviewMissList.className = "review-list";

    const backBtn = createButton("結果へ戻る", "primary");
    backBtn.style.marginTop = "10px";
    backBtn.style.marginBottom = "16px";
    backBtn.addEventListener("click", () => showScreen("RESULT"));

    reviewScreen.appendChild(h);
    reviewScreen.appendChild(passTitle);
    reviewScreen.appendChild(reviewPassList);
    reviewScreen.appendChild(missTitle);
    reviewScreen.appendChild(reviewMissList);
    reviewScreen.appendChild(backBtn);
    root.appendChild(reviewScreen);
  }

  function renderReviewList(container, items) {
    container.innerHTML = "";
    if (!items || items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "review-empty";
      empty.innerText = "なし";
      container.appendChild(empty);
      return;
    }
    items.forEach((label) => {
      const row = document.createElement("div");
      row.className = "review-item";
      row.innerText = label;
      container.appendChild(row);
    });
  }

  function showScreen(name) {
    [titleScreen, levelSelectScreen, gameScreen, pauseScreen, resultScreen, boardViewScreen, reviewScreen, highScoreScreen].forEach(
      (s) => (s.style.display = "none")
    );
    switch (name) {
      case "TITLE": titleScreen.style.display = "flex"; break;
      case "LEVELSELECT": levelSelectScreen.style.display = "flex"; break;
      case "GAME": gameScreen.style.display = "flex"; break;
      case "PAUSE": pauseScreen.style.display = "flex"; break;
      case "RESULT": resultScreen.style.display = "flex"; break;
      case "BOARDVIEW":
        boardViewScreen.style.display = "flex";
        requestAnimationFrame(layoutBoardView);
        break;
      case "REVIEW":
        renderReviewList(reviewPassList, state.passedLog);
        renderReviewList(reviewMissList, state.missedLog);
        reviewScreen.style.display = "flex";
        break;
      case "HIGHSCORES":
        renderHighScores();
        highScoreScreen.style.display = "flex";
        break;
    }
  }

  // ===================== 演算・equation UI =====================
  function buildEquationUI() {
    eqBar.innerHTML = "";
    slotEls = [];
    opEls = [];
    const cfg = DIFFICULTY_CONFIG[state.difficulty];
    const structure = state.equationStructure || cfg.structure;

    function addSlot() {
      const slot = document.createElement("div");
      slot.className = "slot";
      eqBar.appendChild(slot);
      slotEls.push(slot);
    }
    function addOp() {
      const op = document.createElement("div");
      op.className = "opsign";
      eqBar.appendChild(op);
      opEls.push(op);
    }
    function addParen(ch) {
      const p = document.createElement("div");
      p.className = "paren";
      p.innerText = ch;
      eqBar.appendChild(p);
    }

    if (structure === "paren-right") {
      addSlot();          // slot0
      addOp();             // op0
      addParen("(");
      addSlot();          // slot1
      addOp();             // op1
      addSlot();          // slot2
      addParen(")");
    } else if (structure === "paren-left") {
      addParen("(");
      addSlot();          // slot0
      addOp();             // op0
      addSlot();          // slot1
      addParen(")");
      addOp();             // op1
      addSlot();          // slot2
    } else {
      addSlot();
      addOp();
      addSlot();
      if (cfg.operandCount === 3) {
        addOp();
        addSlot();
      }
    }

    const eq = document.createElement("div");
    eq.className = "eqsign";
    eq.innerText = "=";
    eqBar.appendChild(eq);

    targetEl = document.createElement("div");
    targetEl.className = "targetVal";
    eqBar.appendChild(targetEl);
  }

  function applyOp(a, b, op) {
    switch (op) {
      case "+": return a + b;
      case "－": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? null : a / b;
    }
    return null;
  }

  function evaluateStructured(structure, values, ops) {
    if (structure === "flat2") {
      return applyOp(values[0], values[1], ops[0]);
    }
    if (structure === "paren-right") {
      const inner = applyOp(values[1], values[2], ops[1]);
      if (inner === null) return null;
      return applyOp(values[0], inner, ops[0]);
    }
    if (structure === "paren-left") {
      const inner = applyOp(values[0], values[1], ops[0]);
      if (inner === null) return null;
      return applyOp(inner, values[2], ops[1]);
    }
    const nums = values.slice();
    const opers = ops.slice();
    for (let i = 0; i < opers.length; i++) {
      if (opers[i] === "×" || opers[i] === "÷") {
        const r = applyOp(nums[i], nums[i + 1], opers[i]);
        if (r === null) return null;
        nums.splice(i, 2, r);
        opers.splice(i, 1);
        i = -1;
      }
    }
    let result = nums[0];
    for (let i = 0; i < opers.length; i++) {
      const r = applyOp(result, nums[i + 1], opers[i]);
      if (r === null) return null;
      result = r;
    }
    return result;
  }

  function roundNum(x) { return Math.round(x * 100) / 100; }

  function rollOperators() {
    const cfg = DIFFICULTY_CONFIG[state.difficulty];
    state.operatorSeq = [];
    for (let i = 0; i < cfg.operandCount - 1; i++) {
      state.operatorSeq.push(cfg.operators[Math.floor(Math.random() * cfg.operators.length)]);
    }
  }

  function generateTarget() {
    const cfg = DIFFICULTY_CONFIG[state.difficulty];
    let target = null;
    for (let attempt = 0; attempt < 200 && target === null; attempt++) {
      const sample = [];
      for (let i = 0; i < cfg.operandCount; i++) sample.push(Math.floor(Math.random() * 10));
      const r = evaluateStructured(state.equationStructure, sample, state.operatorSeq);
      if (r !== null && Number.isInteger(r) && r > 0) target = r;
    }
    state.target = target === null ? 1 : target;
  }

  function newRound() {
    const cfg = DIFFICULTY_CONFIG[state.difficulty];
    state.equationStructure = pickStructure(cfg);
    buildEquationUI();
    rollOperators();
    generateTarget();
    state.roundWrongCount = 0;
    state.roundMissLogged = false;
    renderEquation();
  }

  function buildFormulaLabel(structure, ops, target) {
    if (structure === "paren-right") {
      return `□ ${ops[0]} (□ ${ops[1]} □) = ${target}`;
    }
    if (structure === "paren-left") {
      return `(□ ${ops[0]} □) ${ops[1]} □ = ${target}`;
    }
    let s = "□";
    for (let i = 0; i < ops.length; i++) s += ` ${ops[i]} □`;
    return `${s} = ${target}`;
  }

  function renderEquation() {
    opEls.forEach((el, i) => (el.innerText = state.operatorSeq[i]));
    slotEls.forEach((el, i) => {
      const s = state.selection[i];
      el.innerText = s !== undefined ? s.value : "";
      el.classList.toggle("filled", s !== undefined);
    });
    if (targetEl) targetEl.innerText = formatNum(state.target);
  }

  function formatNum(n) {
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  }

  // ===================== ゲームロジック =====================
  function startGame() {
    state.score = 0;
    state.correctCount = 0;
    state.selection = [];
    state.paused = false;
    state.running = true;
    state.columns = [];
    state.passedLog = [];
    state.missedLog = [];
    for (let c = 0; c < COLS; c++) state.columns.push([]);

    for (let r = 0; r < START_ROWS_FILLED; r++) {
      for (let c = 0; c < COLS; c++) {
        state.columns[c].push({ id: state.nextId++, value: randomValue() });
      }
    }

    state.nextQueue = [randomValue(), randomValue(), randomValue()];
    renderNextQueue();

    diffLabel.innerText = `DIFFICULTY: ${DIFFICULTY_LABELS[state.difficulty]}`;
    newRound();
    scoreVal.innerText = "SCORE: 0";
    setMessage("");

    showScreen("GAME");
    layoutBoard();
    restartSpawnTimer();
  }

  function randomValue() { return Math.floor(Math.random() * 10); } // 0-9

  function layoutBoard() {
    if (!boardWrap || gameScreen.style.display === "none") return;
    const availW = boardWrap.clientWidth || 300;
    const availH = boardWrap.clientHeight || 400;
    cellSize = Math.floor(Math.min(availW / COLS, availH / ROWS));
    boardEl.style.width = cellSize * COLS + "px";
    boardEl.style.height = cellSize * ROWS + "px";
    renderLanded();
  }

  function currentSpawnInterval() {
    return Math.max(1500, SPAWN_INTERVAL_MS - state.correctCount * 150);
  }

  function renderNextQueue() {
    if (!nextBoxes) return;
    nextBoxes.forEach((box, i) => {
      const v = state.nextQueue[i];
      if (v === undefined) {
        box.innerText = "";
        box.style.background = "#2a3142";
        box.style.color = "var(--text)";
      } else {
        const colors = BLOCK_COLORS[v];
        box.innerText = v;
        box.style.background = colors.bg;
        box.style.color = colors.fg;
      }
    });
  }

  function restartSpawnTimer() {
    stopTimers();
    state.spawnTimer = setInterval(() => {
      if (state.paused || !state.running) return;
      const value = state.nextQueue.shift();
      state.nextQueue.push(randomValue());
      renderNextQueue();
      spawnBlock(Math.floor(Math.random() * COLS), value);
    }, currentSpawnInterval());
  }
  function stopTimers() {
    if (state.spawnTimer) clearInterval(state.spawnTimer);
    state.spawnTimer = null;
  }

  function columnHeight(col) {
    return state.columns[col].length + reservedCount(col);
  }
  function reservedCount(col) {
    return state.falling.filter((f) => f.col === col).length;
  }

  function spawnBlock(col, value) {
    if (!state.running || state.paused) return;
    const height = columnHeight(col);
    if (height >= ROWS) {
      triggerGameOver();
      return;
    }
    const v = value !== undefined ? value : randomValue();
    const landingRow = ROWS - 1 - height;
    const colors = BLOCK_COLORS[v];
    const el = document.createElement("div");
    el.className = "block";
    el.style.width = cellSize - 4 + "px";
    el.style.height = cellSize - 4 + "px";
    el.style.left = col * cellSize + 2 + "px";
    el.style.top = "-" + cellSize + "px";
    el.style.fontSize = Math.floor(cellSize * 0.42) + "px";
    el.style.background = colors.bg;
    el.style.color = colors.fg;
    el.innerText = v;
    boardEl.appendChild(el);

    const entry = { col, value: v, el, landingRow };
    state.falling.push(entry);
    state.pendingFall++;

    let landed = false;
    const finishLanding = () => {
      if (landed) return;
      landed = true;
      el.removeEventListener("transitionend", onEnd);
      clearTimeout(fallbackTimer);
      state.falling = state.falling.filter((f) => f !== entry);
      if (el.parentNode) boardEl.removeChild(el);
      state.columns[col].push({ id: state.nextId++, value: v });
      state.pendingFall = Math.max(0, state.pendingFall - 1);
      renderLanded();
      checkColumnOverflow();
      if (state.pendingFall === 0) passButton.disabled = false;
    };

    const onEnd = (e) => {
      if (e.target !== el || e.propertyName !== "top") return;
      finishLanding();
    };
    el.addEventListener("transitionend", onEnd);

    void el.offsetHeight;
    el.style.top = landingRow * cellSize + "px";

    const fallbackTimer = setTimeout(finishLanding, 500);
  }

  function checkColumnOverflow() {
    for (let c = 0; c < COLS; c++) {
      if (columnHeight(c) >= ROWS) {
        triggerGameOver();
        return;
      }
    }
  }

  function handlePass() {
    if (state.paused || !state.running || !passButton || passButton.disabled) return;
    state.passedLog.push(buildFormulaLabel(state.equationStructure, state.operatorSeq, state.target));
    newRound();
    setMessage("演算が変わった！");
    passButton.disabled = true;
    for (let c = 0; c < COLS; c++) spawnBlock(c);
  }

  function renderLanded() {
    Array.from(boardEl.querySelectorAll(".block.landed")).forEach((el) => el.remove());
    for (let c = 0; c < COLS; c++) {
      const stack = state.columns[c];
      for (let i = 0; i < stack.length; i++) {
        const block = stack[i];
        const row = ROWS - 1 - i;
        const colors = BLOCK_COLORS[block.value];
        const el = document.createElement("div");
        el.className = "block landed";
        el.dataset.id = block.id;
        el.style.width = cellSize - 4 + "px";
        el.style.height = cellSize - 4 + "px";
        el.style.left = c * cellSize + 2 + "px";
        el.style.top = row * cellSize + "px";
        el.style.fontSize = Math.floor(cellSize * 0.42) + "px";
        el.style.background = colors.bg;
        el.style.color = colors.fg;
        el.innerText = block.value;
        if (state.selection.some((s) => s.id === block.id)) {
          el.classList.add("selected");
        }
        el.addEventListener("click", () => onBlockClick(block, c));
        boardEl.appendChild(el);
      }
    }
  }

  function onBlockClick(block, col) {
    if (state.paused || !state.running) return;
    const cfg = DIFFICULTY_CONFIG[state.difficulty];
    const already = state.selection.findIndex((s) => s.id === block.id);
    if (already !== -1) {
      state.selection.splice(already, 1);
      renderLanded();
      renderEquation();
      return;
    }
    if (state.selection.length >= cfg.operandCount) return;
    state.selection.push({ id: block.id, value: block.value, col });
    renderLanded();
    renderEquation();
    if (state.selection.length === cfg.operandCount) {
      setTimeout(resolveSelection, 150);
    }
  }

  function resolveSelection() {
    const cfg = DIFFICULTY_CONFIG[state.difficulty];
    const structure = state.equationStructure;
    const picks = state.selection.slice();
    const values = picks.map((p) => p.value);
    const usedOps = state.operatorSeq.slice();
    const rawResult = evaluateStructured(structure, values, usedOps);
    const result = rawResult === null ? null : roundNum(rawResult);
    const success = result !== null && result === state.target;
    const exprText = buildExprText(structure, values, usedOps);
    const resultText = result === null ? "計算不可" : formatNum(result);

    const domEls = picks
      .map((p) => boardEl.querySelector(`.block[data-id="${p.id}"]`))
      .filter(Boolean);
    domEls.forEach((el) => el.classList.add(success ? "flash-success" : "flash-fail"));

    showFeedback(success, success ? "せいかい！" : "ざんねん…");
    if (!success) boardEl.classList.add("shake");

    setTimeout(() => {
      boardEl.classList.remove("shake");
      if (success) {
        picks.forEach((p) => removeBlockById(p.id, p.col));
        state.score += 10;
        state.correctCount++;
        scoreVal.innerText = `SCORE: ${state.score}`;
        restartSpawnTimer();
        newRound();
        setMessage(`せいかい！ ${exprText} = ${resultText} (+10)`);
      } else {
        state.roundWrongCount++;
        if (state.roundWrongCount >= 3 && !state.roundMissLogged) {
          state.missedLog.push(buildFormulaLabel(structure, usedOps, state.target));
          state.roundMissLogged = true;
        }
        setMessage(`ざんねん… ${exprText} = ${resultText}`);
      }
      state.selection = [];
      renderEquation();
      renderLanded();
    }, 320);
  }

  function buildExprText(structure, values, ops) {
    if (structure === "paren-right") {
      return `${values[0]} ${ops[0]} (${values[1]} ${ops[1]} ${values[2]})`;
    }
    if (structure === "paren-left") {
      return `(${values[0]} ${ops[0]} ${values[1]}) ${ops[1]} ${values[2]}`;
    }
    let s = `${values[0]}`;
    for (let i = 0; i < ops.length; i++) s += ` ${ops[i]} ${values[i + 1]}`;
    return s;
  }

  function showFeedback(success, text) {
    feedbackEl.textContent = text;
    feedbackEl.className = "";
    void feedbackEl.offsetWidth;
    feedbackEl.className = "show " + (success ? "success" : "fail");
    setTimeout(() => { feedbackEl.className = ""; }, 650);
  }

  function removeBlockById(id, col) {
    const stack = state.columns[col];
    const idx = stack.findIndex((b) => b.id === id);
    if (idx !== -1) stack.splice(idx, 1);
  }

  function triggerGameOver() {
    if (!state.running) return;
    state.running = false;
    stopTimers();
    state.finalColumns = state.columns.map((col) => col.map((b) => ({ value: b.value })));
    const prevHigh = getHighScore(state.difficulty);
    if (state.score > prevHigh) {
      setHighScore(state.difficulty, state.score);
    }
    resultScoreEl.innerText = `SCORE: ${state.score}`;
    resultHighScoreEl.innerText = `HIGH SCORE (${DIFFICULTY_LABELS[state.difficulty]}): ${Math.max(state.score, prevHigh)}`;
    showScreen("RESULT");
  }

  function setMessage(text) {
    messageEl.innerText = text;
  }

  window.addEventListener("DOMContentLoaded", initUI);
})();