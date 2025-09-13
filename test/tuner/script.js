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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    const SCALE = 2; // pixel per cent for better visibility
    history.forEach((cent, idx) => {
      const x = (idx / MAX_POINTS) * canvas.width;
      const y = canvas.height / 2 - cent * SCALE;
      ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#008cff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // baseline
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.strokeStyle = '#aaa';
    ctx.stroke();
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
    let centsForHistory = 0; // 0 cent (center line) by default
    
    if (freq !== -1) {
      const midi = noteFromFrequency(freq, baseA);
      const noteFreq = freqFromNote(midi, baseA);
      const cents = Math.floor(1200 * Math.log2(freq / noteFreq));
      const system = noteSystemSelect.value;
      if (DEBUG) console.log(`Detected freq ${freq.toFixed(2)} Hz, note ${noteName(midi, system)}, cents ${cents}`);
      noteSpan.textContent = noteName(midi, system);
      centsSpan.textContent = cents > 0 ? `+${cents}` : cents;
      
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
      
      // Only update history if sound is not stable
      if (!isStable) {
        centsForHistory = cents;
        lastCent = cents;
      } else {
        centsForHistory = 0; // Flat line when stable
      }
    } else {
      // No sound detected
      noteSpan.textContent = '--';
      centsSpan.textContent = '0';
      statusDiv.textContent = '';
    }
    
    // Always add to history and update graph
    if (history.length >= MAX_POINTS) history.shift();
    history.push(centsForHistory);
    
    // Update graph and continue processing
    updateGraph();
    requestAnimationFrame(process);
  }

  // 初期描画
  updateGraph();

  function init() {
    if (!navigator.mediaDevices?.getUserMedia) {
      statusDiv.textContent = 'お使いのブラウザはマイク入力に対応していません';
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        process();
      }).catch(err => {
        statusDiv.textContent = 'マイクへのアクセスが拒否されました';
        console.error(err);
      });
  }

  baseFreqSlider.addEventListener('input', () => {
    baseFreqLabel.textContent = baseFreqSlider.value;
  });

  window.addEventListener('load', init);
})();
