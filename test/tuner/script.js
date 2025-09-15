// script.js
// 外部依存なしのウェブチューナー
(() => {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  const bufferLength = analyser.fftSize;
  const buffer = new Float32Array(bufferLength);

  const baseFreqSlider = document.getElementById('baseFreq');
  const baseFreqLabel = document.getElementById('baseFreqLabel');
  const noteSpan = document.getElementById('note');
  const centsSpan = document.getElementById('cents');
  const statusDiv = document.getElementById('status');
  const canvas = document.getElementById('graph');
  const ctx = canvas.getContext('2d');
  // コンソールログ用のデバッグフラグ
  const DEBUG = true;

  let history = [];
  const MAX_POINTS = 1000;

  function updateGraph() {
    // キャンバスを完全にクリア
    ctx.save();
    // コンテキストを完全にリセット
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // すべての描画効果を無効化
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 0;
    ctx.filter = 'none';
    
    // アンチエイリアシングを無効化
    ctx.imageSmoothingEnabled = false;
    
    // サブピクセルレンダリングを無効化
    ctx.translate(0.5, 0.5);
    
    // 線の描画スタイルをリセット
    ctx.globalCompositeOperation = 'source-over';
    
    // 背景グリッドを描画
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.2)';
    ctx.lineWidth = 1;
    
    // 水平グリッド線を描画
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    // 垂直グリッド線を描画
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    // ベースラインを描画
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.strokeStyle = '#aaa';
    ctx.stroke();
    

    
    // 履歴がなくてもグラフを動かす
    if (history.length === 0) {
      const time = Date.now() / 1000;
      const wave1 = Math.sin(time * 1.5) * 20;
      const wave2 = Math.sin(time * 0.7) * 10;
      const wave3 = Math.sin(time * 2.2) * 5;
      const subtleMovement = wave1 + wave2 + wave3;
      
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x++) {
        const t = (x / canvas.width) * 2 * Math.PI;
        const y = canvas.height / 2 + Math.sin(t + time) * 10 + subtleMovement;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = 'rgba(0, 140, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      const SCALE = 2; // 視認性向上のためのピクセル/セント比
      const startIdx = Math.max(0, history.length - MAX_POINTS);
      const pointsToDraw = Math.min(MAX_POINTS, history.length);
      const xStep = canvas.width / pointsToDraw;
      
      // 現在の履歴長に基づいて開始インデックスを計算
      const startHistoryIdx = Math.max(0, history.length - pointsToDraw);
      
      // メインキャンバスに直接描画（一時キャンバスは使用しない）
      ctx.beginPath();
      
      // 最初のポイントに移動
      const firstX = 0;
      const firstY = Math.round(canvas.height / 2 - history[startHistoryIdx] * SCALE);
      ctx.moveTo(firstX, firstY);
      
      // ポイントを結ぶ線を描画
      for (let i = 1; i < pointsToDraw; i++) {
        const x = Math.round(i * xStep);
        const y = Math.round(canvas.height / 2 - history[startHistoryIdx + i] * SCALE);
        ctx.lineTo(x, y);
      }
      
      // 線のスタイルを設定（影なし）
      ctx.strokeStyle = '#008cff';
      ctx.lineWidth = 1; // 1pxの線
      ctx.lineCap = 'butt'; // 線の端を四角く
      ctx.lineJoin = 'miter'; // 線の接続部をシャープに
      
      // すべての描画効果を無効化
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.filter = 'none';
      ctx.globalAlpha = 1.0;
      
      // 線を描画
      ctx.stroke();
      
      // コンテキストの状態を復元
      ctx.restore();
    }
  }

  function noteFromFrequency(freq, baseA = 442) {
    const semitone = 12 * Math.log2(freq / baseA) + 57; // MIDIノート番号 (A4=57)
    return Math.round(semitone);
  }

  const noteNamesMap = {
    en: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    solfege: ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'],
    de: ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H'],
    jp: ['ハ', '嬰ハ', 'ニ', '嬰ニ', 'ホ', 'ヘ', '嬰ヘ', 'ト', '嬰ト', 'イ', '嬰イ', 'ロ']
  };

  const noteSystemSelect = document.getElementById('noteSystem');

  function noteName(midi, system = 'en') {
    const names = noteNamesMap[system] || noteNamesMap.en;
    const name = names[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${name}${octave}`;
  }

  function freqFromNote(midi, baseA = 442) {
    return baseA * Math.pow(2, (midi - 57) / 12);
  }

  function autoCorrelate(buf, sampleRate) {
    // Chris Wilsonのチューナーアルゴリズムより
    let SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) {
      let val = buf[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1; // 音が小さすぎる

    let lastBest = -1;
    let bestOffset = -1;
    let bestCorrelation = 0;
    const correlations = new Array(SIZE).fill(0);

    for (let offset = 32; offset < SIZE / 2; offset++) {
      let corr = 0;
      for (let i = 0; i < SIZE / 2; i++) {
        corr += Math.abs(buf[i] - buf[i + offset]);
      }
      corr = 1 - corr / (SIZE / 2);
      correlations[offset] = corr;
      if (corr > 0.7 && corr > bestCorrelation) {
        bestCorrelation = corr;
        bestOffset = offset;
      }
    }
    if (bestCorrelation > 0.7) {
      const frequency = sampleRate / bestOffset;
      return frequency;
    }
    return -1;
  }

  function process() {
    analyser.getFloatTimeDomainData(buffer);
    const freq = autoCorrelate(buffer, audioCtx.sampleRate);
    if (DEBUG) console.log('autoCorrelate ->', freq);
    const baseA = parseFloat(baseFreqSlider.value);
    const time = Date.now() / 1000;    // スムーズなアニメーションのための現在時刻（秒）
    
    // 音が検出されなくてもグラフを動かし続ける
    if (history.length >= MAX_POINTS) history.shift();
    
    // 音が検出された場合は処理、そうでない場合はゆらぎを生成
    if (freq > 0) {
      const midi = noteFromFrequency(freq, baseA);
      const noteFreq = freqFromNote(midi, baseA);
      const cents = 1200 * Math.log2(freq / noteFreq);
      const system = noteSystemSelect.value;
      
      if (DEBUG) console.log(`Detected freq ${freq.toFixed(2)} Hz, note ${noteName(midi, system)}, cents ${cents.toFixed(2)}`);
      
      // 表示を更新
      noteSpan.textContent = noteName(midi, system);
      const displayCents = Math.round(cents * 10) / 10;
      centsSpan.textContent = displayCents > 0 ? `+${displayCents.toFixed(1)}` : displayCents.toFixed(1);
      
      // 音が安定しているかチェック
      let isStable = false;
      if (history.length >= 30) {
        const recent = history.slice(-30);
        const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const variance = recent.reduce((a, b) => a + (b - avg) ** 2, 0) / recent.length;
        const std = Math.sqrt(variance);
        isStable = std < 5;
        statusDiv.textContent = isStable ? '安定しています' : '';
        statusDiv.style.color = isStable ? 'green' : '#c00';
      }
      
      // 安定していても自然な動きを追加
      const timeOffset = Math.sin(time * 2) * 0.1;
      const movement = isStable ? timeOffset * 0.5 : timeOffset * 2;
      
      // 値をスムージング
      const lastValue = history.length > 0 ? history[history.length - 1] : 0;
      const targetValue = isStable ? movement : cents;
      const smoothedCents = lastValue * 0.7 + targetValue * 0.3;
      
      history.push(smoothedCents);
    } else {
      // 音が検出されません - ゆるやかな波のアニメーションを表示
      noteSpan.textContent = '--';
      centsSpan.textContent = '0.0';
      statusDiv.textContent = '';
      
      // 音が検出されない場合の見やすい波パターンを生成
      const wave1 = Math.sin(time * 1.5) * 20;
      const wave2 = Math.sin(time * 0.7) * 10;
      const wave3 = Math.sin(time * 2.2) * 5;
      const subtleMovement = wave1 + wave2 + wave3;
      
      // より自然な動きのためのランダム性を追加
      const randomOffset = (Math.random() - 0.5) * 2;
      
      // 動きをスムーズにしつつ、ダイナミックさを維持
      const lastValue = history.length > 0 ? history[history.length - 1] : 0;
      const smoothedMovement = lastValue * 0.7 + (subtleMovement + randomOffset) * 0.3;
      
      history.push(smoothedMovement);
      
      // グラフを強制的に更新
      updateGraph();
    }
    
    // スムーズな更新のためにrequestAnimationFrameで次の処理をスケジュール
    requestAnimationFrame(process);
  }

  // グラフの更新を独立して行う
  function startGraphAnimation() {
    let lastTime = 0;
    const fps = 30;
    const frameInterval = 1000 / fps;
    
    function animate(timestamp) {
      // フレームレートを30fpsに制御
      if (timestamp - lastTime >= frameInterval) {
        lastTime = timestamp;
        updateGraph();
      }
      requestAnimationFrame(animate);
    }
    
    // アニメーションループを開始
    requestAnimationFrame(animate);
  }

  // 初期化関数
  function init() {
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        process();
      })
      .catch(err => {
        console.error('Error accessing microphone:', err);
        alert('マイクへのアクセスに失敗しました。マイクの使用が許可されていることを確認してください。');
        // マイクが使えなくてもグラフのアニメーションは続行
        startGraphAnimation();
      });
    
    // グラフのアニメーションを開始
    startGraphAnimation();
  }

  // イベントリスナーを設定
  baseFreqSlider.addEventListener('input', () => {
    baseFreqLabel.textContent = baseFreqSlider.value;
  });

  // ページ読み込み完了時に初期化を実行
  window.addEventListener('load', init);
})();
