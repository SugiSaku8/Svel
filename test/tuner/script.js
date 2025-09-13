// script.js
// Web Tuner without external dependencies
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
  // Debug flag for console logging
  const DEBUG = true;

  let history = [];
  const MAX_POINTS = 1000;

  function updateGraph() {
    // Clear the canvas with a slight fade effect for trail
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw background grid
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.2)';
    ctx.lineWidth = 1;
    
    // Draw horizontal grid lines
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    // Draw vertical grid lines
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    // Draw baseline
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.strokeStyle = '#aaa';
    ctx.stroke();
    
    // Draw center line (blue vertical line in the middle)
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.strokeStyle = 'rgba(0, 140, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Always show some graph movement, even with no history
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
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (history.length > 0) {
      ctx.beginPath();
      const SCALE = 2; // pixel per cent for better visibility
      const startIdx = Math.max(0, history.length - MAX_POINTS);
      
      // Start from the first point
      const firstX = 0;
      const firstY = canvas.height / 2 - history[startIdx] * SCALE;
      ctx.moveTo(firstX, firstY);
      
      // Draw the rest of the points with smoothing
      for (let i = 1; i < history.length - startIdx; i++) {
        const x = (i / MAX_POINTS) * canvas.width;
        // Add a small random value to prevent the line from being completely flat
        const randomOffset = (Math.random() - 0.5) * 0.1;
        const y = canvas.height / 2 - (history[startIdx + i] + randomOffset) * SCALE;
        
        // Use quadratic curves for smoother lines
        if (i === 1) {
          ctx.lineTo(x, y);
        } else {
          const xc = (x + (i-1) / MAX_POINTS * canvas.width) / 2;
          const yc = (y + (canvas.height / 2 - (history[startIdx + i - 1] + randomOffset) * SCALE)) / 2;
          ctx.quadraticCurveTo(xc, yc, x, y);
        }
      }
      
      ctx.strokeStyle = '#008cff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function noteFromFrequency(freq, baseA = 442) {
    const semitone = 12 * Math.log2(freq / baseA) + 57; // MIDI note number (A4=57)
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
    // from Chris Wilson's tuner algorithm
    let SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) {
      let val = buf[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1; // too quiet

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
    const time = Date.now() / 1000; // Current time in seconds for smooth animation
    
    // Always keep the graph moving, even when no sound is detected
    if (history.length >= MAX_POINTS) history.shift();
    
    // Process sound if detected, otherwise create a gentle wave
    if (freq > 0) {
      const midi = noteFromFrequency(freq, baseA);
      const noteFreq = freqFromNote(midi, baseA);
      const cents = 1200 * Math.log2(freq / noteFreq);
      const system = noteSystemSelect.value;
      
      if (DEBUG) console.log(`Detected freq ${freq.toFixed(2)} Hz, note ${noteName(midi, system)}, cents ${cents.toFixed(2)}`);
      
      // Update the display
      noteSpan.textContent = noteName(midi, system);
      const displayCents = Math.round(cents * 10) / 10;
      centsSpan.textContent = displayCents > 0 ? `+${displayCents.toFixed(1)}` : displayCents.toFixed(1);
      
      // Check if sound is stable
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
      
      // Add some natural movement to the line, even when stable
      const timeOffset = Math.sin(time * 2) * 0.1;
      const movement = isStable ? timeOffset * 0.5 : timeOffset * 2;
      
      // Smooth the value
      const lastValue = history.length > 0 ? history[history.length - 1] : 0;
      const targetValue = isStable ? movement : cents;
      const smoothedCents = lastValue * 0.7 + targetValue * 0.3;
      
      history.push(smoothedCents);
    } else {
      // No sound detected - show a gentle wave animation
      noteSpan.textContent = '--';
      centsSpan.textContent = '0.0';
      statusDiv.textContent = '';
      
      // Create a more visible wave pattern when no sound is detected
      const wave1 = Math.sin(time * 1.5) * 20;
      const wave2 = Math.sin(time * 0.7) * 10;
      const wave3 = Math.sin(time * 2.2) * 5;
      const subtleMovement = wave1 + wave2 + wave3;
      
      // Add some randomness to make it more organic
      const randomOffset = (Math.random() - 0.5) * 2;
      
      // Smooth the movement but keep it more dynamic
      const lastValue = history.length > 0 ? history[history.length - 1] : 0;
      const smoothedMovement = lastValue * 0.7 + (subtleMovement + randomOffset) * 0.3;
      
      history.push(smoothedMovement);
      
      // Force a graph update
      updateGraph();
    }
    
    // Schedule next process call with requestAnimationFrame for smooth updates
    requestAnimationFrame(process);
  }

  // グラフの更新を独立して行う
  function startGraphAnimation() {
    let lastTime = 0;
    const fps = 30;
    const frameInterval = 1000 / fps;
    
    function animate(timestamp) {
      // フレームレートを制御
      if (timestamp - lastTime >= frameInterval) {
        lastTime = timestamp;
        updateGraph();
      }
      requestAnimationFrame(animate);
    }
    
    // アニメーションを開始
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

  // イベントリスナーの設定
  baseFreqSlider.addEventListener('input', () => {
    baseFreqLabel.textContent = baseFreqSlider.value;
  });

  // ページ読み込み時に初期化
  window.addEventListener('load', init);
})();
