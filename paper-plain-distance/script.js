/* ============================================================
   紙ヒコーキ ディスタンス - script.js
   構成：
   1. 共通ユーティリティ・画面切り替え
   2. 機体データ
   3. ハイスコア（localStorage）
   4. タイトル画面の紙飛行機アニメーション
   5. 機体選択画面
   6. ゲーム本編（角度→パワー→飛行→着地）
   7. 初期化
   ============================================================ */

(() => {
  'use strict';

  /* ------------------------------------------------------------
     1. 共通ユーティリティ・画面切り替え
     ------------------------------------------------------------ */
  const $ = (id) => document.getElementById(id);

  const screens = {
    title: $('screen-title'),
    highscore: $('screen-highscore'),
    select: $('screen-select'),
    game: $('screen-game'),
    result: $('screen-result'),
  };

  function showScreen(name) {
    Object.values(screens).forEach((el) => el.classList.remove('is-active'));
    screens[name].classList.add('is-active');
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function randRange(min, max) { return min + Math.random() * (max - min); }

  // ダブルタップズームやピンチズームの保険（CSSのtouch-actionに加えて念のため）
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  /* ------------------------------------------------------------
     2. 機体データ（1〜10段階）
     ------------------------------------------------------------ */
  const PLANES = [
    {
      id: 'hayabusa',
      name: 'はやぶさ号',
      desc: '高速で飛び出すが滞空は短い。風に左右されにくい玄人向け機体。',
      lift: 3, speed: 9,
      color: '#FF6F61',
      icon: '⚡',
    },
    {
      id: 'tsubame',
      name: 'つばめ号',
      desc: 'スピードも滞空もバランス型。だれでも扱いやすい標準機。',
      lift: 6, speed: 6,
      color: '#2FB6A6',
      icon: '🍃',
    },
    {
      id: 'ootori',
      name: 'おおとり号',
      desc: 'ゆっくり進むが長く浮く。風の影響を大きく受けるバクチ機体。',
      lift: 9, speed: 3,
      color: '#FFC94D',
      icon: '🪶',
    },
  ];

  let selectedPlane = PLANES[0];

  /* ------------------------------------------------------------
     3. ハイスコア（localStorage）
     ------------------------------------------------------------ */
  const HS_KEY = 'paperplane_highscores_v1';

  function loadHighscores() {
    try {
      const raw = localStorage.getItem(HS_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr;
    } catch (e) {
      return [];
    }
  }

  function saveHighscores(list) {
    try {
      localStorage.setItem(HS_KEY, JSON.stringify(list));
    } catch (e) { /* 保存できなくてもゲームは続行 */ }
  }

  // スコアを登録。TOP5入りなら true（rank）を返す
  function registerScore(planeName, distance) {
    const list = loadHighscores();
    list.push({ plane: planeName, distance: distance, date: Date.now() });
    list.sort((a, b) => b.distance - a.distance);
    const top5 = list.slice(0, 5);
    saveHighscores(top5);
    const rank = top5.findIndex(
      (item) => item.date === list.find((l) => l.plane === planeName && l.distance === distance).date
    );
    return rank; // 0-4 ならTOP5入り、-1なら圏外
  }

  function renderHighscoreList() {
    const list = loadHighscores();
    const ol = $('highscoreList');
    ol.innerHTML = '';
    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'highscore-empty';
      empty.textContent = 'まだきろくがありません。とばしてみよう！';
      ol.appendChild(empty);
      return;
    }
    list.forEach((item, i) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="rank">${i + 1}</span>
        <span class="hs-plane">${item.plane}</span>
        <span class="hs-dist">${item.distance.toFixed(1)} m</span>
      `;
      ol.appendChild(li);
    });
  }

  /* ------------------------------------------------------------
     4. タイトル画面の紙飛行機アニメーション
     ------------------------------------------------------------ */
  const titleCanvas = $('titlePlaneCanvas');
  const titleCtx = titleCanvas.getContext('2d');
  let titleAnimId = null;
  let titleT = 0;

  function resizeTitleCanvas() {
    const rect = titleCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    titleCanvas.width = rect.width * dpr;
    titleCanvas.height = rect.height * dpr;
    titleCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // シンプルな紙ヒコーキのシルエットを描く（サイド・ビュー）
  function drawPaperPlane(ctx, x, y, angleRad, scale, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angleRad);
    ctx.scale(scale, scale);

    // 胴体（三角形）
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(-20, 9);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-20, -9);
    ctx.closePath();
    ctx.fillStyle = '#FFFDF6';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#2B2B33';
    ctx.stroke();

    // 折り目ライン
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(-10, 0);
    ctx.strokeStyle = 'rgba(43,43,51,.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // アクセントの翼
    ctx.beginPath();
    ctx.moveTo(14, -1);
    ctx.lineTo(-16, -8);
    ctx.lineTo(-6, -1);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function titleLoop() {
    titleT += 0.016;
    resizeTitleCanvas();
    const rect = titleCanvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    titleCtx.clearRect(0, 0, w, h);

    // ふわふわ上下しながら左右に少し揺れる
    const bob = Math.sin(titleT * 1.6) * 10;
    const tilt = Math.sin(titleT * 1.6) * 0.12;
    const cx = w / 2;
    const cy = h / 2 + bob;

    drawPaperPlane(titleCtx, cx, cy, tilt, 2.1, '#FF6F61');

    titleAnimId = requestAnimationFrame(titleLoop);
  }

  function startTitleAnim() {
    if (titleAnimId) return;
    titleLoop();
  }
  function stopTitleAnim() {
    if (titleAnimId) cancelAnimationFrame(titleAnimId);
    titleAnimId = null;
  }

  /* ------------------------------------------------------------
     5. 機体選択画面
     ------------------------------------------------------------ */
  function statPercent(v) { return clamp(v, 0, 10) * 10 + '%'; }

  function renderPlaneList() {
    const wrap = $('planeList');
    wrap.innerHTML = '';
    PLANES.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'plane-card';
      card.innerHTML = `
        <div class="plane-card-top">
          <div class="plane-icon" style="background:${p.color}22;color:${p.color}">${p.icon}</div>
          <div>
            <div class="plane-name">${p.name}</div>
            <div class="plane-desc">${p.desc}</div>
          </div>
        </div>
        <div class="plane-stats">
          <div class="stat-row">
            <span>たいくう</span>
            <div class="stat-bar"><div class="stat-bar-fill" style="width:${statPercent(p.lift)};background:${p.color}"></div></div>
            <span>${p.lift}</span>
          </div>
          <div class="stat-row">
            <span>スピード</span>
            <div class="stat-bar"><div class="stat-bar-fill" style="width:${statPercent(p.speed)};background:${p.color}"></div></div>
            <span>${p.speed}</span>
          </div>
        </div>
      `;
      // カード全体をタップで選択（ボタンは無し）
      card.addEventListener('click', () => {
        selectedPlane = p;
        startGame();
      });
      wrap.appendChild(card);
    });
  }

  /* ------------------------------------------------------------
     6. ゲーム本編
     ------------------------------------------------------------ */
  const gameCanvas = $('gameCanvas');
  const gctx = gameCanvas.getContext('2d');

  const PX_PER_METER = 8;       // 距離1mあたりの画面ピクセル数（小さいほど見える範囲が広い）
  const PLANE_SCALE = 1.05;     // 飛行中の機体の大きさ
  const PLANE_SCREEN_X_RATIO = 0.30; // 画面のどのあたりに機体を固定表示するか

  let dpr = window.devicePixelRatio || 1;
  let cw = 0, ch = 0; // canvasのCSSピクセルサイズ

  function resizeGameCanvas() {
    const rect = gameCanvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    cw = rect.width;
    ch = rect.height;
    gameCanvas.width = cw * dpr;
    gameCanvas.height = ch * dpr;
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---- ゲーム状態 ----
  const GameState = {
    phase: 'idle', // idle | aiming-angle | aiming-power | flying | landed
    angle: 45,
    power: 60,
    x: 0, y: 0.05, vx: 0, vy: 0,
    wind: 0, windTarget: 0, windTimer: 0, windChangeInterval: 2.5,
    elapsed: 0,
    lastTapTime: 0,
    hasLeftGround: false,
    groundParticles: [],
  };

  // 角度/パワーバーの振動アニメーション
  let aimAnimId = null;
  let aimT = 0;
  const ANGLE_MIN = 10, ANGLE_MAX = 80;
  const POWER_MIN = 8, POWER_MAX = 100;

  function aimLoop() {
    aimT += 0.018;
    if (GameState.phase === 'aiming-angle') {
      const t = 0.5 + 0.5 * Math.sin(aimT * 3.1);
      GameState.angle = lerp(ANGLE_MIN, ANGLE_MAX, t);
      $('angleIndicator').style.left = (t * 100) + '%';
    } else if (GameState.phase === 'aiming-power') {
      const t = 0.5 + 0.5 * Math.sin(aimT * 3.6);
      GameState.power = lerp(POWER_MIN, POWER_MAX, t);
      $('powerFill').style.height = (t * 100) + '%';
    }
    aimAnimId = requestAnimationFrame(aimLoop);
  }
  function startAimLoop() {
    if (aimAnimId) return;
    aimT = 0;
    aimLoop();
  }
  function stopAimLoop() {
    if (aimAnimId) cancelAnimationFrame(aimAnimId);
    aimAnimId = null;
  }

  function startGame() {
    showScreen('game');
    resizeGameCanvas();

    GameState.phase = 'aiming-angle';
    GameState.angle = 45;
    GameState.power = 60;
    GameState.x = 0; GameState.y = 0.05; GameState.vx = 0; GameState.vy = 0;
    GameState.wind = 0; GameState.windTarget = 0; GameState.windTimer = 0;
    GameState.windChangeInterval = randRange(2, 4);
    GameState.elapsed = 0;
    GameState.hasLeftGround = false;
    GameState.groundParticles = [];

    $('aimPanel').style.display = 'flex';
    $('angleBarTrack').style.display = 'block';
    $('powerBarTrack').style.display = 'none';
    $('aimLabel').textContent = '画面をタップして 角度をきめろ！';
    $('tapHint').classList.remove('is-visible');
    $('distanceLive').innerHTML = '0.0<span>m</span>';

    startAimLoop();
    updateWindUI();
    requestAnimationFrame(gameLoopTick);
  }

  function onAimTap() {
    if (GameState.phase === 'aiming-angle') {
      GameState.phase = 'aiming-power';
      $('angleBarTrack').style.display = 'none';
      $('powerBarTrack').style.display = 'flex';
      $('aimLabel').textContent = '画面をタップして パワーをきめろ！';
      vibrate(10);
    } else if (GameState.phase === 'aiming-power') {
      launchPlane();
    }
  }

  function launchPlane() {
    stopAimLoop();
    GameState.phase = 'flying';
    $('aimPanel').style.display = 'none';
    $('tapHint').classList.add('is-visible');
    vibrate(15);

    const p = selectedPlane;
    const angleRad = (GameState.angle * Math.PI) / 180;
    const powerFrac = 0.3 + (clamp(GameState.power, 0, 100) / 100) * 0.7;
    const launchSpeed = (5 + (p.speed / 10) * 9) * powerFrac;

    GameState.vx = launchSpeed * Math.cos(angleRad);
    GameState.vy = launchSpeed * Math.sin(angleRad);
    GameState.x = 0;
    GameState.y = 0.05;
    GameState.elapsed = 0;
    GameState.hasLeftGround = false;
  }

  /* ==== タップ関連の調整用パラメータ ====================================
     ここを動かすだけでタップの効きの強さ・シビアさを調整できます。

     TAP_VY_RANGE      : |vy|がこの値を超えるとタップの効果はほぼ0になる。
                          値を大きくするほど「多少vyがブレていてもタップが効く」
                          優しい仕様になる。小さくするほどシビア（水平キープが難しい）。
     TAP_BASE_POWER    : vy=0（水平）かつ十分な前進速度がある時、タップした瞬間の1回あたりの上昇量。
                          大きくするとタップの威力そのものが強くなる。
                          ※ここを上げすぎると、連打の最大レートだけで常に重力に
                            勝ててしまい「vxが減ると追いつかなくなる」感覚が消えるので注意。
     TAP_DECAY_RATE    : 飛行時間が経つにつれてタップ威力がごく微量ずつ弱くなる速さ。
     TAP_DECAY_FLOOR   : どれだけ時間が経ってもこれ以上は弱くならない下限（0にはならない）。
     TAP_VX_REF        : タップが「フル効果」になるために必要なvxの目安値。
                          揚力は前に進んでこそ生まれるものなので、vxが0以下ならタップの
                          効果も0になる（＝真上にふわふわ浮くような不自然さを防ぐ）。
                          vxの飽和判定に使うVX_REF(下の速度揚力パラメータ)より低い値にしてあり、
                          「そこそこ前に進んでいれば十分タップが効く」くらいの手加減にしている。
  ======================================================================== */
  const TAP_VY_RANGE = 9.0;
  const TAP_BASE_POWER = 0.6;
  const TAP_DECAY_RATE = 0.006;
  const TAP_DECAY_FLOOR = 0.55;
  const TAP_VX_REF = 4.0;

  // 飛行中のタップで「機体の先が下がるのを防ぐ」＝vyを直接持ち上げる。
  // ただし効果は
  //   ①vyが0（水平）に近いほど大きい
  //   ②vxが十分あるほど大きく、vxが0以下なら効果ゼロ（揚力はvxがあって初めて生まれるため）
  // → タイミングよく連打し続け、かつ前進速度を保てれば理論上ずっと水平を保てる（ホバリング）が、
  //   vyがズレる・vxが失われる、のどちらでも効きが弱まっていく難易度カーブになる。
  function onFlyTap() {
    if (GameState.phase !== 'flying') return;
    const now = performance.now();
    if (now - GameState.lastTapTime < 90) return; // 連打すぎ防止のクールダウン（最大taps/秒の上限）
    GameState.lastTapTime = now;

    // vyが0に近いほど1.0に近づき、大きく外れるほど0に近づく係数
    const vyProximity = clamp(1 - Math.abs(GameState.vy) / TAP_VY_RANGE, 0, 1);
    // 飛行時間が経つほどごく微量弱まるが、TAP_DECAY_FLOORより下にはならない
    const timeFactor = Math.max(TAP_DECAY_FLOOR, 1 - GameState.elapsed * TAP_DECAY_RATE);
    // vxが0以下なら0、TAP_VX_REF以上あれば1（フル効果）になる係数
    const vxFactor = clamp(GameState.vx / TAP_VX_REF, 0, 1);

    GameState.vy += TAP_BASE_POWER * vyProximity * timeFactor * vxFactor;
    if (vxFactor > 0) vibrate(6); // 効果が無い時は振動フィードバックも出さない
  }

  // 画面のどこをタップしても反応するよう、ゲーム画面全体でタップを受け取り、
  // 今のフェーズに応じて「狙いの確定」か「飛行中のタップ」に振り分ける
  function onGameScreenTap(e) {
    if (e.target.closest && e.target.closest('.hud-back')) return; // 戻るボタンは対象外
    if (GameState.phase === 'aiming-angle' || GameState.phase === 'aiming-power') {
      onAimTap();
    } else if (GameState.phase === 'flying') {
      onFlyTap();
    }
  }
  screens.game.addEventListener('pointerdown', onGameScreenTap);

  // ---- 風のロジック ----
  function updateWind(dt) {
    GameState.windTimer += dt;
    if (GameState.windTimer >= GameState.windChangeInterval) {
      GameState.windTimer = 0;
      GameState.windChangeInterval = randRange(2, 4);
      if (Math.random() < 0.4) {
        GameState.windTarget = 0; // 無風
      } else {
        const level = Math.ceil(Math.random() * 5); // 1〜5
        const sign = Math.random() < 0.5 ? -1 : 1; // 向かい風 / 追い風
        GameState.windTarget = level * sign;
      }
    }
    GameState.wind = lerp(GameState.wind, GameState.windTarget, clamp(dt * 1.3, 0, 1));
    updateWindUI();
  }

  function updateWindUI() {
    const w = GameState.wind;
    const arrow = $('windArrow');
    const label = $('windLabel');
    const speed = $('windSpeed');
    const level = Math.round(Math.abs(w));
    if (level === 0) {
      label.textContent = '無風';
      arrow.style.opacity = '0.35';
      arrow.style.transform = 'rotate(0deg)';
    } else if (w > 0) {
      label.textContent = '追い風';
      arrow.style.opacity = '1';
      arrow.style.color = 'var(--mint-deep)';
      arrow.style.transform = 'rotate(0deg)';
    } else {
      label.textContent = '向かい風';
      arrow.style.opacity = '1';
      arrow.style.color = 'var(--coral-deep)';
      arrow.style.transform = 'rotate(180deg)';
    }
    speed.textContent = level;
  }

  /* ==== 揚力（速度→落下しにくさ）の調整用パラメータ ======================
     「vxが大きいほどvyが減りにくい（揚力が効く）」を表現している。
     揚力の“減りにくさ”はたいくう性能が高いほど有利になる（LIFT_EXP_SCALEの効果）。

     VX_REF                   : この速度でだいたい揚力が飽和する目安値。
                                 launchSpeedの実用レンジ（約7〜14）を基準に設定。
     LIFT_EXP_BASE / _SCALE   : vxに対する揚力の伸び方のカーブ。
                                 指数が小さいほど「vxが多少落ちても揚力を維持しやすい」。
                                 たいくうが高い機体ほど指数が小さくなるよう作ってある
                                 （＝おおとり号はvxが落ちても粘りやすい）。
     MAX_SPEED_LIFT_REDUCTION : vx由来の揚力だけで重力を最大何%まで打ち消せるか。
                                 1.0に近づけるほど「速度さえあればタップなしでも
                                 ほぼ落ちない」状態に近づくので、上げすぎ注意。
  ======================================================================== */
  const VX_REF = 12;
  const LIFT_EXP_BASE = 2.2;
  const LIFT_EXP_SCALE = 1.5;
  const MAX_SPEED_LIFT_REDUCTION = 0.65;

  // 重力の基準値（実際の重力加速度9.8ではなく、ゲームとして気持ちいい値に調整したもの）。
  // 下げるほど全体的に長く飛ぶ・長く滞空するようになる。
  // 目安：角度45度・パワー100%・タップ無しで約30〜40m、現実的な連打（6〜7回/秒を維持）で
  // はやぶさ号・つばめ号が約100m前後になるよう6.6に設定している。
  const GRAVITY_BASE = 6.6;

  // ---- 物理シミュレーション ----
  function stepPhysics(dt) {
    const p = selectedPlane;

    // 重力の素の強さ：たいくう性能だけで決まる（たいくうが低いほど速く落ちる）
    const gravityMult = clamp(1.3 - (p.lift / 10) * 1.0, 0.3, 1.3);
    const gravity = GRAVITY_BASE * gravityMult;

    // 空気抵抗：スピードが高いほどvxが減りにくい。
    // 0.20 = 基準の抵抗の強さ／0.19 = スピードがどれだけ抵抗を減らすか（大きいほどスピード差が効く）
    // → これによりvxが長持ちする時間が伸び、結果として速度揚力（下のVX_REF関連）も長持ちする
    const dragCoeff = clamp(0.20 - (p.speed / 10) * 0.19, 0.01, 0.20) * 0.5;

    // 風の影響：たいくう性能（＝翼の大きさ）が高いほど強く受ける（バフもデバフも）
    const windInfluence = (p.lift / 10) * 0.9;

    GameState.elapsed += dt;
    updateWind(dt);

    // --- vx（前進速度）の更新 ---
    // 追い風なら加速（減りにくい・増えることもある）、向かい風なら減速が早まる
    const ax = GameState.wind * windInfluence;
    GameState.vx += ax * dt;
    // 経時的な自然減速（機体性能スピードが高いほど減りにくい）
    GameState.vx -= dragCoeff * GameState.vx * dt;

    // --- vx由来の揚力を計算 ---
    // vxが大きいほど揚力が効いて重力の影響が弱まる。
    // たいくう性能が高い機体は、vxが多少落ちても揚力を維持しやすい（指数が小さい）
    const liftExponent = clamp(LIFT_EXP_BASE - (p.lift / 10) * LIFT_EXP_SCALE, 0.5, 2.2);
    const speedRatio = clamp(GameState.vx / VX_REF, 0, 1.4);
    const liftFraction = clamp(Math.pow(speedRatio, liftExponent), 0, 1);
    const effectiveGravity = gravity * (1 - liftFraction * MAX_SPEED_LIFT_REDUCTION);

    // --- vy（落下速度）の更新 ---
    // タップの効果はonFlyTap側でvyに直接加算済み。ここでは重力分だけ減らす。
    // vxが減る→揚力が弱まる→effectiveGravityが大きくなる→vyが減りやすくなる、
    // という形で「vxが減るとタップの効果が追いつかなくなる」が自然に表現される
    GameState.vy -= effectiveGravity * dt;

    GameState.x += GameState.vx * dt;
    GameState.y += GameState.vy * dt;

    if (GameState.y > 0.3) GameState.hasLeftGround = true;

    if (GameState.hasLeftGround && GameState.y <= 0) {
      GameState.y = 0;
      land();
    }

    $('distanceLive').innerHTML = Math.max(0, GameState.x).toFixed(1) + '<span>m</span>';
  }

  function land() {
    GameState.phase = 'landed';
    $('tapHint').classList.remove('is-visible');
    spawnDustParticles();
    vibrate([20, 30, 20]);
    setTimeout(() => showResult(Math.max(0, GameState.x)), 550);
  }

  function spawnDustParticles() {
    const groundScreenY = ch * 0.72;
    const planeScreenX = cw * PLANE_SCREEN_X_RATIO;
    for (let i = 0; i < 14; i++) {
      GameState.groundParticles.push({
        x: planeScreenX + randRange(-10, 10),
        y: groundScreenY,
        vx: randRange(-70, 70),
        vy: randRange(-120, -30),
        life: 1,
      });
    }
  }

  function updateDustParticles(dt) {
    GameState.groundParticles.forEach((pt) => {
      pt.vy += 250 * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt * 1.2;
    });
    GameState.groundParticles = GameState.groundParticles.filter((pt) => pt.life > 0);
  }

  // ---- 描画 ----
  function drawGameScene() {
    gctx.clearRect(0, 0, cw, ch);

    // 空
    const skyGrad = gctx.createLinearGradient(0, 0, 0, ch);
    skyGrad.addColorStop(0, '#8FD3FF');
    skyGrad.addColorStop(1, '#EAF7FF');
    gctx.fillStyle = skyGrad;
    gctx.fillRect(0, 0, cw, ch);

    const groundScreenY = ch * 0.72;
    const scrollX = GameState.x * PX_PER_METER;

    // 雲（視差スクロール）
    // 雲は一定間隔(CLOUD_SPACING)で並べ、全体の長さ(CLOUD_TRACK)を周期に
    // 1回だけmodを取ることでジャンプせず滑らかにループさせる
    gctx.globalAlpha = 0.9;
    const CLOUD_SPACING = 260;
    const CLOUD_COUNT = 6;
    const CLOUD_TRACK = CLOUD_SPACING * CLOUD_COUNT;
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const baseX = i * CLOUD_SPACING;
      const raw = (baseX - scrollX * 0.25 - CLOUD_SPACING) % CLOUD_TRACK;
      const screenX = ((raw + CLOUD_TRACK) % CLOUD_TRACK) - CLOUD_SPACING;
      const cy = 60 + (i % 3) * 40;
      drawCloud(screenX, cy);
    }
    gctx.globalAlpha = 1;

    // 地面
    gctx.fillStyle = '#BFE7A6';
    gctx.fillRect(0, groundScreenY, cw, ch - groundScreenY);
    gctx.fillStyle = '#A9DB8C';
    for (let i = 0; i < 40; i++) {
      const gx = ((i * 60) - (scrollX % 60) + cw) % (cw + 60) - 30;
      gctx.fillRect(gx, groundScreenY, 30, 6);
    }

    // 距離マーカー（10mごと）
    gctx.font = '11px "Noto Sans JP", sans-serif';
    gctx.fillStyle = 'rgba(43,43,51,.45)';
    const startMark = Math.floor(GameState.x / 10) * 10;
    for (let m = startMark; m < startMark + 200; m += 10) {
      if (m < 0) continue;
      const screenX = cw * PLANE_SCREEN_X_RATIO + (m - GameState.x) * PX_PER_METER;
      if (screenX < -20 || screenX > cw + 20) continue;
      gctx.fillRect(screenX, groundScreenY - 10, 2, 10);
      gctx.fillText(m + 'm', screenX - 10, groundScreenY + 20);
    }

    // 機体
    const planeScreenX = cw * PLANE_SCREEN_X_RATIO;
    const planeScreenY = groundScreenY - GameState.y * PX_PER_METER;
    // 描画角度は±70度程度に制限。強い向かい風などでvxが小さくなっても
    // 機体が後ろを向いて見えることがないようにする
    const rawAngle = Math.atan2(-GameState.vy, GameState.vx || 0.001);
    const flightAngle = clamp(rawAngle, -1.22, 1.22);
    drawPaperPlane(gctx, planeScreenX, planeScreenY, flightAngle, PLANE_SCALE, selectedPlane.color);

    // 着地ダスト
    GameState.groundParticles.forEach((pt) => {
      gctx.globalAlpha = clamp(pt.life, 0, 1);
      gctx.fillStyle = '#D8CBA6';
      gctx.beginPath();
      gctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      gctx.fill();
      gctx.globalAlpha = 1;
    });
  }

  function drawCloud(x, y) {
    gctx.fillStyle = '#fff';
    gctx.beginPath();
    gctx.ellipse(x, y, 34, 14, 0, 0, Math.PI * 2);
    gctx.ellipse(x + 20, y - 8, 20, 18, 0, 0, Math.PI * 2);
    gctx.ellipse(x - 18, y - 4, 16, 14, 0, 0, Math.PI * 2);
    gctx.fill();
  }

  // ---- メインループ ----
  let lastTs = null;
  function gameLoopTick(ts) {
    if (screens.game.classList.contains('is-active') === false) { lastTs = null; return; }
    if (lastTs === null) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    dt = clamp(dt, 0, 0.033);
    lastTs = ts;

    if (GameState.phase === 'aiming-angle' || GameState.phase === 'aiming-power') {
      // 狙っている間も風は変化させる（ユーザーが発射タイミングを風に合わせられるように）
      updateWind(dt);
    }
    if (GameState.phase === 'flying') {
      stepPhysics(dt);
    }
    if (GameState.phase === 'landed' || GameState.phase === 'flying') {
      updateDustParticles(dt);
    }
    updateDebugInfo();
    drawGameScene();

    requestAnimationFrame(gameLoopTick);
  }

  // ---- デバッグ表示（vx / vy / y） ----
  function updateDebugInfo() {
    const el = $('debugInfo');
    if (!el) return;
    el.innerHTML =
      `<div>vx: ${GameState.vx.toFixed(2)}</div>` +
      `<div>vy: ${GameState.vy.toFixed(2)}</div>` +
      `<div>y: ${GameState.y.toFixed(2)}</div>`;
  }

  // ---- リザルト ----
  function showResult(distance) {
    const finalDistance = Math.round(distance * 10) / 10;
    const rank = registerScore(selectedPlane.name, finalDistance);

    showScreen('result');
    $('resultPlaneName').textContent = selectedPlane.name + ' で とんだ きょり';
    $('recordBadge').classList.remove('is-visible');

    // 距離をカウントアップ演出
    const el = $('resultDistance');
    const start = performance.now();
    const duration = 900;
    function countUp(ts) {
      const t = clamp((ts - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (finalDistance * eased).toFixed(1);
      if (t < 1) requestAnimationFrame(countUp);
      else {
        el.textContent = finalDistance.toFixed(1);
        if (rank !== -1) {
          $('recordBadge').textContent = rank === 0 ? 'NEW RECORD !' : 'TOP5 いり！';
          $('recordBadge').classList.add('is-visible');
          launchConfetti();
        }
      }
    }
    requestAnimationFrame(countUp);
  }

  function launchConfetti() {
    const layer = $('confettiLayer');
    layer.innerHTML = '';
    const colors = ['#FF6F61', '#2FB6A6', '#FFC94D', '#8FD3FF'];
    for (let i = 0; i < 40; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = randRange(0, 100) + '%';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = randRange(1.6, 3) + 's';
      piece.style.animationDelay = randRange(0, 0.6) + 's';
      layer.appendChild(piece);
    }
    setTimeout(() => { layer.innerHTML = ''; }, 3600);
  }

  function vibrate(pattern) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) { /* 無視 */ }
    }
  }

  /* ------------------------------------------------------------
     7. 初期化・画面遷移ボタン
     ------------------------------------------------------------ */
  $('btnStart').addEventListener('click', () => {
    renderPlaneList();
    showScreen('select');
  });

  $('btnHighscore').addEventListener('click', () => {
    renderHighscoreList();
    showScreen('highscore');
  });
  $('btnHSBack').addEventListener('click', () => showScreen('title'));

  $('btnGameBack').addEventListener('click', () => {
    stopAimLoop();
    GameState.phase = 'idle';
    showScreen('title');
  });

  $('btnRetry').addEventListener('click', () => startGame());
  $('btnResultTitle').addEventListener('click', () => showScreen('title'));

  window.addEventListener('resize', () => {
    if (screens.game.classList.contains('is-active')) resizeGameCanvas();
  });

  // 初期表示
  showScreen('title');
  startTitleAnim();
})();
