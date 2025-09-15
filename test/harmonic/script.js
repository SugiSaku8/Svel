document.addEventListener('DOMContentLoaded', () => {
    // グローバル変数
    let audioContext;
    let audioBuffers = [];
    let audioSources = [];
    let isRecording = [];
    let mediaRecorders = [];
    let audioChunks = [];
    let isAnalyzing = false;
    let animationId = null;
    
    // 数学的解析用の変数
    const FFT_SIZE = 4096;  // FFTのサイズを大きくして周波数分解能を向上
    const HOP_SIZE = 1024;  // オーバーラップを増やして時間分解能を向上
    const SAMPLE_RATE = 44100;  // サンプルレート (後でオーディオコンテキストから取得)
    
    // ハニングウィンドウを事前計算
    const hannWindow = new Float32Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) {
        hannWindow[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (FFT_SIZE - 1)));
    }

    // DOM要素の取得
    const audioInputsContainer = document.querySelector('.audio-inputs');
    const addInputBtn = document.getElementById('add-input');
    const analyzeBtn = document.getElementById('analyze');
    const playMixBtn = document.getElementById('play-mix');
    const stopBtn = document.getElementById('stop');
    const feedbackDiv = document.getElementById('feedback');
    
    // キャンバスの取得と設定
    const waveformCanvas = document.getElementById('waveform');
    const spectrumCanvas = document.getElementById('spectrum');
    const harmonicCanvas = document.getElementById('harmonic');
    
    const waveformCtx = waveformCanvas.getContext('2d');
    const spectrumCtx = spectrumCanvas.getContext('2d');
    const harmonicCtx = harmonicCanvas.getContext('2d');

    // 初期化
    function init() {
        // オーディオコンテキストの初期化
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // イベントリスナーの設定
        setupEventListeners();
        
        // 初期の2つの入力フィールドを設定
        updateAudioInputs();
    }

    // イベントリスナーの設定
    function setupEventListeners() {
        addInputBtn.addEventListener('click', addAudioInput);
        analyzeBtn.addEventListener('click', startAnalysis);
        playMixBtn.addEventListener('click', playMix);
        stopBtn.addEventListener('click', stopAll);
        
        // 動的に追加される要素のイベント委譲
        document.addEventListener('click', (e) => {
            // 録音ボタン
            if (e.target.classList.contains('record-btn')) {
                const index = parseInt(e.target.dataset.index);
                toggleRecording(index);
            }
            
            // ファイル入力の変更
            if (e.target.classList.contains('audio-file')) {
                const index = parseInt(e.target.dataset.index);
                handleFileUpload(e.target.files[0], index);
            }
        });
    }

    // オーディオ入力フィールドを追加
    function addAudioInput() {
        updateAudioInputs();
    }

    // オーディオ入力フィールドを更新
    function updateAudioInputs() {
        const inputCount = document.querySelectorAll('.audio-input').length;
        
        // 最大8つまでに制限
        if (inputCount >= 8) {
            alert('最大8つのオーディオ入力まで追加できます');
            return;
        }
        
        const newIndex = inputCount;
        const audioInput = document.createElement('div');
        audioInput.className = 'audio-input';
        audioInput.innerHTML = `
            <h3>入力 ${newIndex + 1}</h3>
            <input type="file" accept="audio/*" class="audio-file" data-index="${newIndex}">
            <button class="record-btn" data-index="${newIndex}">録音開始</button>
            <audio controls class="audio-preview" data-index="${newIndex}"></audio>
        `;
        
        audioInputsContainer.appendChild(audioInput);
        
        // 配列を初期化
        analysers[newIndex] = null;
        audioBuffers[newIndex] = null;
        audioSources[newIndex] = null;
        isRecording[newIndex] = false;
        mediaRecorders[newIndex] = null;
        audioChunks[newIndex] = [];
    }

    // 録音の開始/停止を切り替え
    async function toggleRecording(index) {
        if (!isRecording[index]) {
            await startRecording(index);
        } else {
            stopRecording(index);
        }
    }

    // 録音を開始
    async function startRecording(index) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            isRecording[index] = true;
            updateRecordButton(index, true);
            
            // メディアレコーダーの設定
            mediaRecorders[index] = new MediaRecorder(stream);
            audioChunks[index] = [];
            
            mediaRecorders[index].ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks[index].push(event.data);
                }
            };
            
            mediaRecorders[index].onstop = async () => {
                const audioBlob = new Blob(audioChunks[index], { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                
                // オーディオ要素に設定
                const audioElement = document.querySelector(`.audio-preview[data-index="${index}"]`);
                audioElement.src = audioUrl;
                
                // オーディオバッファに変換して保存
                const arrayBuffer = await audioBlob.arrayBuffer();
                audioBuffers[index] = await audioContext.decodeAudioData(arrayBuffer);
                
                // ストリームを解放
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorders[index].start();
            
        } catch (err) {
            console.error('録音の開始に失敗しました:', err);
            alert('マイクへのアクセスが拒否されました。');
        }
    }

    // 録音を停止
    function stopRecording(index) {
        if (mediaRecorders[index] && isRecording[index]) {
            mediaRecorders[index].stop();
            isRecording[index] = false;
            updateRecordButton(index, false);
        }
    }

    // 録音ボタンの状態を更新
    function updateRecordButton(index, recording) {
        const button = document.querySelector(`.record-btn[data-index="${index}"]`);
        button.textContent = recording ? '録音停止' : '録音開始';
        button.style.backgroundColor = recording ? '#e74c3c' : '';
    }

    // ファイルアップロードを処理
    function handleFileUpload(file, index) {
        if (!file) return;
        
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            const arrayBuffer = e.target.result;
            
            try {
                // オーディオコンテキストがサスペンドされていないか確認
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }
                
                // オーディオバッファにデコード
                audioBuffers[index] = await audioContext.decodeAudioData(arrayBuffer);
                
                // オーディオ要素に設定
                const audioUrl = URL.createObjectURL(file);
                const audioElement = document.querySelector(`.audio-preview[data-index="${index}"]`);
                audioElement.src = audioUrl;
                
            } catch (err) {
                console.error('オーディオファイルの読み込みに失敗しました:', err);
                alert('このオーディオファイルはサポートされていない形式か、破損しています。');
            }
        };
        
        reader.readAsArrayBuffer(file);
    }

    // 解析を開始
    function startAnalysis() {
        if (isAnalyzing) return;
        
        // 少なくとも1つのオーディオバッファが必要
        const hasAudio = audioBuffers.some(buffer => buffer !== null);
        if (!hasAudio) {
            alert('解析するオーディオがありません。録音またはファイルをアップロードしてください。');
            return;
        }
        
        isAnalyzing = true;
        analyzeBtn.disabled = true;
        playMixBtn.disabled = true;
        
        // アナライザーを設定
        setupAnalyzers();
        
        // 可視化を開始
        visualize();
        
        // フィードバックを生成
        generateFeedback();
    }

    // 数学的FFT実装 (Cooley-Tukeyアルゴリズム)
    function fft(re, im) {
        const n = re.length;
        if (n === 1) return;
        
        // ビットリバース
        let j = 0;
        for (let i = 0; i < n; i++) {
            if (i < j) {
                [re[i], re[j]] = [re[j], re[i]];
                [im[i], im[j]] = [im[j], im[i]];
            }
            
            let k = n >> 1;
            while (k <= j) {
                j -= k;
                k >>= 1;
            }
            j += k;
        }
        
        // バタフライ演算
        for (let m = 1; m < n; m <<= 1) {
            const m2 = m << 1;
            const theta = -Math.PI / m;
            const wRe = Math.cos(theta);
            const wIm = Math.sin(theta);
            
            for (let k = 0; k < n; k += m2) {
                let wReCurrent = 1.0;
                let wImCurrent = 0.0;
                
                for (let j = 0; j < m; j++) {
                    const tRe = wReCurrent * re[k + j + m] - wImCurrent * im[k + j + m];
                    const tIm = wReCurrent * im[k + j + m] + wImCurrent * re[k + j + m];
                    
                    re[k + j + m] = re[k + j] - tRe;
                    im[k + j + m] = im[k + j] - tIm;
                    
                    re[k + j] += tRe;
                    im[k + j] += tIm;
                    
                    const wReTmp = wReCurrent * wRe - wImCurrent * wIm;
                    wImCurrent = wReCurrent * wIm + wImCurrent * wRe;
                    wReCurrent = wReTmp;
                }
            }
        }
    }
    
    // 自己相関関数を使用した基本周波数検出
    function findPitchByAutocorrelation(samples, sampleRate) {
        const n = samples.length;
        const maxLag = Math.floor(sampleRate / 50);  // 最低周波数50Hz
        const minLag = Math.floor(sampleRate / 2000); // 最高周波数2000Hz
        
        // 自己相関を計算
        const corr = new Float32Array(maxLag);
        
        for (let lag = minLag; lag < maxLag; lag++) {
            let sum = 0;
            for (let i = 0; i < n - lag; i++) {
                sum += samples[i] * samples[i + lag];
            }
            corr[lag] = sum / (n - lag);
        }
        
        // 最初のピークを探す（基本周波数に対応）
        let maxCorr = 0;
        let maxLagIndex = minLag;
        
        for (let i = minLag; i < maxLag; i++) {
            if (corr[i] > maxCorr) {
                maxCorr = corr[i];
                maxLagIndex = i;
            }
        }
        
        // 二次補間でより正確なピーク位置を求める
        if (maxLagIndex > minLag && maxLagIndex < maxLag - 1) {
            const y0 = corr[maxLagIndex - 1];
            const y1 = corr[maxLagIndex];
            const y2 = corr[maxLagIndex + 1];
            
            const d = (y2 - y0) / (2 * (2 * y1 - y2 - y0));
            maxLagIndex += d;
        }
        
        return sampleRate / maxLagIndex;
    }
    
    // ケプストラム解析による基本周波数検出
    function findPitchByCepstrum(samples, sampleRate) {
        const n = samples.length;
        
        // ハニングウィンドウを適用
        const windowed = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            windowed[i] = samples[i] * hannWindow[i];
        }
        
        // FFT用の配列を準備（複素数部は0で初期化）
        const re = new Float32Array(FFT_SIZE);
        const im = new Float32Array(FFT_SIZE);
        
        // データをコピー
        for (let i = 0; i < n; i++) {
            re[i] = windowed[i];
        }
        
        // FFTを実行
        fft(re, im);
        
        // 対数パワースペクトルを計算
        const logSpectrum = new Float32Array(FFT_SIZE / 2);
        for (let i = 0; i < FFT_SIZE / 2; i++) {
            const power = re[i] * re[i] + im[i] * im[i];
            logSpectrum[i] = Math.log(1 + 1000 * power); // スケーリングを調整
        }
        
        // 逆FFT（実数部のみ使用）
        const cepstrumRe = new Float32Array(FFT_SIZE);
        const cepstrumIm = new Float32Array(FFT_SIZE);
        
        // 対数スペクトルをコピー（対称性を考慮）
        for (let i = 0; i < FFT_SIZE / 2; i++) {
            cepstrumRe[i] = logSpectrum[i];
            cepstrumRe[FFT_SIZE - 1 - i] = logSpectrum[i];
        }
        
        // 逆FFTを実行
        fft(cepstrumRe, cepstrumIm);
        
        // ケプストラムのピークを探す（基本周波数に対応）
        const minQuefrency = Math.floor(sampleRate / 1000);  // 1kHz以下
        const maxQuefrency = Math.floor(sampleRate / 50);    // 50Hz以上
        
        let maxCepstrum = -Infinity;
        let maxIndex = minQuefrency;
        
        for (let i = minQuefrency; i <= maxQuefrency && i < FFT_SIZE / 2; i++) {
            const cepstrumValue = cepstrumRe[i] * cepstrumRe[i] + cepstrumIm[i] * cepstrumIm[i];
            if (cepstrumValue > maxCepstrum) {
                maxCepstrum = cepstrumValue;
                maxIndex = i;
            }
        }
        
        // 周波数に変換
        return sampleRate / maxIndex;
    }
    
    // 調波構造を解析
    function analyzeHarmonics(samples, sampleRate, fundamentalFreq) {
        const n = samples.length;
        const harmonics = [];
        
        // ハニングウィンドウを適用
        const windowed = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            windowed[i] = samples[i] * hannWindow[i];
        }
        
        // FFTを実行
        const re = new Float32Array(FFT_SIZE);
        const im = new Float32Array(FFT_SIZE);
        
        for (let i = 0; i < n; i++) {
            re[i] = windowed[i];
        }
        
        fft(re, im);
        
        // 基本周波数とその倍音を分析
        const numHarmonics = 10;  // 分析する倍音の数
        
        for (let i = 1; i <= numHarmonics; i++) {
            const targetFreq = fundamentalFreq * i;
            const bin = Math.round(targetFreq * FFT_SIZE / sampleRate);
            
            if (bin < FFT_SIZE / 2) {  // ナイキスト周波数以下に制限
                // 近傍のビンも考慮して正確な振幅を計算
                let sumPower = 0;
                const windowSize = 3;  // 前後1ビンずつ考慮
                
                for (let j = -windowSize; j <= windowSize; j++) {
                    const currentBin = bin + j;
                    if (currentBin >= 0 && currentBin < FFT_SIZE / 2) {
                        const power = re[currentBin] * re[currentBin] + im[currentBin] * im[currentBin];
                        sumPower += power;
                    }
                }
                
                const magnitude = Math.sqrt(sumPower) / (2 * windowSize + 1);
                
                harmonics.push({
                    frequency: targetFreq,
                    magnitude: magnitude,
                    db: 20 * Math.log10(magnitude + 1e-10)  // dBに変換（0除算を防ぐため小さい値を加算）
                });
            }
        }
        
        return harmonics;
    }

    // 可視化を実行
    function visualize() {
        if (!isAnalyzing) return;
        
        // アニメーションフレームをリクエスト
        animationId = requestAnimationFrame(visualize);
        
        // キャンバスをクリア
        const width = waveformCanvas.width = waveformCanvas.offsetWidth;
        const height = waveformCanvas.height = waveformCanvas.offsetHeight;
        
        waveformCtx.clearRect(0, 0, width, height);
        spectrumCtx.clearRect(0, 0, width, height);
        harmonicCtx.clearRect(0, 0, width, height);
        
        // 各オーディオバッファに対して処理
        audioBuffers.forEach((buffer, index) => {
            if (!buffer) return;
            
            // オーディオデータを取得
            const channelData = buffer.getChannelData(0);
            
            // 現在の時間位置に基づいて分析するフレームを選択
            const currentTime = audioContext.currentTime % buffer.duration;
            const startSample = Math.floor(currentTime * buffer.sampleRate);
            const analysisSamples = Math.min(FFT_SIZE, channelData.length - startSample);
            
            // 分析用のサンプルを抽出
            const samples = new Float32Array(FFT_SIZE);
            for (let i = 0; i < analysisSamples; i++) {
                samples[i] = channelData[startSample + i];
            }
            
            // 基本周波数を検出
            const fundamentalFreq = findFundamentalFrequency(samples, buffer.sampleRate);
            
            // 倍音を分析
            const harmonics = findHarmonics(samples, buffer.sampleRate, fundamentalFreq);
            
            // 波形を描画
            drawWaveform(samples, index, width, height);
            
            // スペクトルを描画
            drawSpectrum(samples, buffer.sampleRate, index, width, height);
            
            // 倍音を描画
            drawHarmonics(harmonics, index, width, height);
        });
    }

    // 波形を描画
    function drawWaveform(samples, index, width, height) {
        const centerY = height / 2;
        const amp = height / 4;
        const offsetY = (index % 2 === 0) ? centerY - 20 : centerY + 20;
        
        // 色を設定
        waveformCtx.strokeStyle = index % 2 === 0 ? '#3498db' : '#e74c3c';
        waveformCtx.lineWidth = 1.5;
        waveformCtx.beginPath();
        
        // 波形を描画
        const step = Math.ceil(samples.length / width);
        
        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;
            
            // 各ピクセルに対応するサンプルの範囲で最小値と最大値を求める
            const start = i * step;
            const end = Math.min(start + step, samples.length);
            
            for (let j = start; j < end; j++) {
                const value = samples[j] || 0;
                min = Math.min(value, min);
                max = Math.max(value, max);
            }
            
            // 線を描画
            const x = i;
            const y1 = offsetY + min * amp;
            const y2 = offsetY + max * amp;
            
            if (i === 0) {
                waveformCtx.moveTo(x, y1);
            } else {
                waveformCtx.moveTo(x, y1);
            }
            
            waveformCtx.lineTo(x, y2);
        }
        
        waveformCtx.stroke();
        
        // 時間軸の目盛りを描画
        waveformCtx.strokeStyle = '#95a5a6';
        waveformCtx.beginPath();
        waveformCtx.moveTo(0, offsetY);
        waveformCtx.lineTo(width, offsetY);
        waveformCtx.stroke();
    }

    // スペクトルを描画（数学的実装）
    function drawSpectrum(samples, sampleRate, index, width, height) {
        // ハニングウィンドウを適用
        const windowed = new Float32Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
            windowed[i] = samples[i] * hannWindow[i];
        }
        
        // FFTを実行
        const re = new Float32Array(FFT_SIZE);
        const im = new Float32Array(FFT_SIZE);
        
        for (let i = 0; i < samples.length; i++) {
            re[i] = windowed[i];
        }
        
        fft(re, im);
        
        // パワースペクトルを計算
        const spectrum = new Float32Array(FFT_SIZE / 2);
        let maxPower = 0;
        
        for (let i = 0; i < FFT_SIZE / 2; i++) {
            const power = re[i] * re[i] + im[i] * im[i];
            spectrum[i] = power;
            maxPower = Math.max(maxPower, power);
        }
        
        // 正規化してdBスケールに変換
        const minDb = -100;  // 最小表示レベル (dB)
        
        for (let i = 0; i < spectrum.length; i++) {
            const db = 10 * Math.log10(spectrum[i] / maxPower + 1e-10);
            spectrum[i] = Math.max(0, (db - minDb) / -minDb);  // 0-1に正規化
        }
        
        // スペクトルを描画
        const barWidth = width / (spectrum.length / 4);  // 高周波数は間引く
        let x = 0;
        
        // 色を設定
        spectrumCtx.fillStyle = index % 2 === 0 ? 'rgba(52, 152, 219, 0.7)' : 'rgba(231, 76, 60, 0.7)';
        
        // 対数スケールで表示（低周波数側を拡大）
        const logScale = (i) => {
            const logMin = Math.log(1);
            const logMax = Math.log(spectrum.length);
            const scale = (logMax - logMin) / width;
            return Math.floor(Math.exp(logMin + scale * i * 0.9 * width));
        };
        
        for (let i = 0; i < width; i++) {
            const bin = logScale(i / width);
            if (bin >= spectrum.length) continue;
            
            const barHeight = spectrum[bin] * height * 0.9;
            
            spectrumCtx.fillRect(
                x,
                height - barHeight,
                Math.max(1, barWidth),
                barHeight
            );
            
            x += barWidth;
        }
        
        // 周波数軸の目盛りを描画
        spectrumCtx.strokeStyle = '#95a5a6';
        spectrumCtx.fillStyle = '#2c3e50';
        spectrumCtx.font = '10px Arial';
        
        const freqs = [100, 200, 500, 1000, 2000, 5000, 10000];
        freqs.forEach(freq => {
            const xPos = (Math.log(freq / 20) / Math.log(20000 / 20)) * width;
            
            spectrumCtx.beginPath();
            spectrumCtx.moveTo(xPos, height - 5);
            spectrumCtx.lineTo(xPos, height);
            spectrumCtx.stroke();
            
            spectrumCtx.fillText(
                freq >= 1000 ? `${freq/1000}k` : freq,
                xPos - 10,
                height - 8
            );
        });
    }

    // 倍音を分析して描画
    function analyzeHarmonics() {
        const width = harmonicCanvas.width;
        const height = harmonicCanvas.height;
        
        harmonicCtx.fillStyle = '#f8f9fa';
        harmonicCtx.fillRect(0, 0, width, height);
        
        // 各アナライザーの倍音を分析
        const harmonicsData = [];
        
        analysers.forEach((analyser, index) => {
            if (!analyser) return;
            
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);
            
            // 基本周波数と倍音を検出
            const fundamentalFreq = findFundamentalFrequency(dataArray, analyser);
            const harmonics = findHarmonics(dataArray, analyser, fundamentalFreq);
            
            harmonicsData.push({
                index: index,
                fundamental: fundamentalFreq,
                harmonics: harmonics
            });
        });
        
        // 倍音を描画
        drawHarmonics(harmonicsData);
    }

    // 数学的な基本周波数検出
    function findFundamentalFrequency(samples, sampleRate) {
        // 自己相関法とケプストラム法の両方で検出し、より信頼性の高い結果を返す
        const freq1 = findPitchByAutocorrelation(samples, sampleRate);
        const freq2 = findPitchByCepstrum(samples, sampleRate);
        
        // 両方の結果が近い場合は平均を、大きく異なる場合はケプストラム法を優先
        const ratio = Math.max(freq1, freq2) / Math.min(freq1, freq2);
        return ratio > 1.5 ? freq2 : (freq1 + freq2) / 2;
    }
    
    // 倍音を検出（数学的実装）
    function findHarmonics(samples, sampleRate, fundamentalFreq) {
        // 調波構造を分析
        return analyzeHarmonics(samples, sampleRate, fundamentalFreq);
    }

    // 倍音を描画（数学的実装）
    function drawHarmonics(harmonics, index, width, height) {
        if (!harmonics || harmonics.length === 0) return;
        
        const barWidth = 30;
        const maxHarmonics = 8;
        const offsetX = 50 + (index * 100);
        const color = index % 2 === 0 ? '#3498db' : '#e74c3c';
        
        // 基本周波数を表示
        harmonicCtx.fillStyle = color;
        harmonicCtx.font = '12px Arial';
        harmonicCtx.textAlign = 'left';
        harmonicCtx.fillText(
            `入力 ${index + 1}: ${Math.round(harmonics[0].frequency / 2)} Hz`,
            10,
            20 + (index * 20)
        );
        
        // 最大振幅を求める（正規化用）
        let maxAmplitude = 0;
        harmonics.slice(0, maxHarmonics).forEach(harmonic => {
            maxAmplitude = Math.max(maxAmplitude, harmonic.magnitude);
        });
        
        // 倍音を表示
        harmonics.slice(0, maxHarmonics).forEach((harmonic, i) => {
            // 正規化された高さを計算（最大値がheight-50に相当）
            const barHeight = (harmonic.magnitude / (maxAmplitude || 1)) * (height - 100);
            const x = offsetX + (i * (barWidth + 10));
            const y = height - barHeight - 50;
            
            // バーを描画
            harmonicCtx.fillStyle = color;
            harmonicCtx.fillRect(x, y, barWidth, barHeight);
            
            // 周波数を表示
            harmonicCtx.fillStyle = '#333';
            harmonicCtx.font = '10px Arial';
            harmonicCtx.textAlign = 'center';
            
            // 周波数を表示（kHz単位に変換）
            const freqText = harmonic.frequency >= 1000 ? 
                `${(harmonic.frequency / 1000).toFixed(1)}k` : 
                Math.round(harmonic.frequency);
                
            harmonicCtx.fillText(
                freqText,
                x + barWidth / 2,
                height - 30
            );
            
            // dB値を表示
            harmonicCtx.fillText(
                `${harmonic.db.toFixed(1)} dB`,
                x + barWidth / 2,
                y - 5
            );
            
            // 倍音番号を表示
            harmonicCtx.fillText(
                `${i+1}次`,
                x + barWidth / 2,
                height - 10
            );
        });
        
        // 基本周波数と倍音の関係を線で結ぶ
        if (harmonics.length > 1) {
            harmonicCtx.strokeStyle = color;
            harmonicCtx.lineWidth = 1;
            harmonicCtx.beginPath();
            
            const startX = offsetX + barWidth / 2;
            const startY = height - 50;
            
            harmonics.slice(0, maxHarmonics).forEach((_, i) => {
                const x = offsetX + (i * (barWidth + 10)) + barWidth / 2;
                const y = height - 50;
                
                if (i === 0) {
                    harmonicCtx.moveTo(x, y);
                } else {
                    harmonicCtx.lineTo(x, y);
                }
            });
            
            harmonicCtx.stroke();
        }
    }

    // フィードバックを生成（数学的実装）
    function generateFeedback() {
        if (audioBuffers.every(buffer => !buffer)) return;
        
        let feedback = '<h3>解析結果のフィードバック</h3><ul>';
        const harmonicData = [];
        
        // 各オーディオ入力のフィードバックを生成
        audioBuffers.forEach((buffer, index) => {
            if (!buffer) return;
            
            // 分析用のサンプルを取得（最初の1秒分）
            const startSample = 0;
            const analysisSamples = Math.min(FFT_SIZE, Math.floor(1.0 * buffer.sampleRate));
            const samples = new Float32Array(FFT_SIZE);
            
            const channelData = buffer.getChannelData(0);
            for (let i = 0; i < analysisSamples; i++) {
                samples[i] = channelData[startSample + i] || 0;
            }
            
            // 基本周波数と倍音を分析
            const fundamentalFreq = findFundamentalFrequency(samples, buffer.sampleRate);
            const harmonics = findHarmonics(samples, buffer.sampleRate, fundamentalFreq);
            
            // フィードバックを構築
            feedback += `<li><strong>入力 ${index + 1}:</strong> `;
            feedback += `長さ: ${buffer.duration.toFixed(2)}秒, `;
            feedback += `サンプルレート: ${buffer.sampleRate}Hz, `;
            feedback += `チャンネル数: ${buffer.numberOfChannels}<br>`;
            
            // 基本周波数と音程を表示
            const noteInfo = frequencyToNote(fundamentalFreq);
            feedback += `基本周波数: ${Math.round(fundamentalFreq)} Hz (${noteInfo.note}${noteInfo.octave}`;
            feedback += noteInfo.cents !== 0 ? `, ${noteInfo.cents > 0 ? '+' : ''}${Math.round(noteInfo.cents)}セント` : '';
            feedback += ')<br>';
            
            // 倍音の分析
            if (harmonics.length > 0) {
                const totalHarmonicDistortion = calculateTHD(harmonics);
                
                feedback += `全高調波歪み(THD): ${(totalHarmonicDistortion * 100).toFixed(2)}%<br>`;
                
                // 倍音のバランスに基づいたフィードバック
                const balanceScore = analyzeHarmonicBalance(harmonics);
                
                if (balanceScore > 0.7) {
                    feedback += '倍音のバランスが非常に良いです。豊かで深みのある音です。';
                } else if (balanceScore > 0.4) {
                    feedback += '倍音のバランスは標準的です。';
                } else {
                    feedback += '倍音が少ないか、バランスが偏っています。イコライザーでの調整を検討してください。';
                }
                
                // 特定の倍音の特徴を分析
                const oddEvenRatio = analyzeOddEvenHarmonics(harmonics);
                if (oddEvenRatio > 2.0) {
                    feedback += ' 奇数倍音が優勢で、倍音の豊かな音色です。';
                } else if (oddEvenRatio < 0.5) {
                    feedback += ' 偶数倍音が優勢で、明るくクリアな音色です。';
                }
                
                harmonicData.push({
                    index: index,
                    fundamental: fundamentalFreq,
                    harmonics: harmonics,
                    thd: totalHarmonicDistortion
                });
            }
            
            feedback += '</li>';
        });
        
        // 複数オーディオがある場合の相関分析
        if (harmonicData.length > 1) {
            feedback += '<li><strong>複数オーディオの相関分析:</strong> ';
            
            // 周波数の近さをチェック
            const freqDiffs = [];
            for (let i = 0; i < harmonicData.length; i++) {
                for (let j = i + 1; j < harmonicData.length; j++) {
                    const ratio = Math.max(harmonicData[i].fundamental, harmonicData[j].fundamental) / 
                                 Math.min(harmonicData[i].fundamental, harmonicData[j].fundamental);
                    
                    // 単純な整数比に近いかチェック
                    const simpleRatio = Math.round(ratio * 4) / 4;
                    const ratioDiff = Math.abs(ratio - simpleRatio);
                    
                    if (ratioDiff < 0.1) {  // 許容誤差
                        const intervalName = getIntervalName(simpleRatio);
                        feedback += `入力${i+1}と入力${j+1}は${intervalName}の関係にあります。`;
                        
                        // 調和の程度を評価
                        if (simpleRatio <= 1.1) {
                            feedback += ' 同じ音程に近く、うなりが発生する可能性があります。';
                        } else if (simpleRatio <= 1.26) {
                            feedback += ' 短2度の関係で、緊張感のある響きになります。';
                        } else if (simpleRatio <= 1.34) {
                            feedback += ' 長2度の関係で、やや緊張感のある響きです。';
                        } else if (Math.abs(simpleRatio - 1.5) < 0.1) {
                            feedback += ' 完全5度の関係で、調和のとれた響きです。';
                        } else if (Math.abs(simpleRatio - 2.0) < 0.1) {
                            feedback += ' オクターブの関係で、非常に調和のとれた響きです。';
                        }
                    }
                }
            }
            
            // 倍音の重なりをチェック
            const overlapScore = analyzeHarmonicOverlap(harmonicData);
            if (overlapScore > 0.7) {
                feedback += ' 複数の音源で倍音が重なり合っており、音が濁る可能性があります。';
            } else if (overlapScore > 0.4) {
                feedback += ' 一部の倍音が重なり合っていますが、許容範囲内です。';
            } else {
                feedback += ' 倍音の重なりは少なく、クリアなサウンドです。';
            }
            
            feedback += '</li>';
        }
        
        feedback += '</ul>';
        
        // 全体的なアドバイスを追加
        feedback += '<h3>アドバイス</h3><ul>';
        
        // 各オーディオのTHDに基づいたアドバイス
        harmonicData.forEach((data, index) => {
            feedback += `<li><strong>入力 ${index + 1}:</strong> `;
            
            if (data.thd > 0.1) {
                feedback += '歪みが大きいです。入力レベルを下げるか、ハードウェアの接続を確認してください。';
            } else if (data.thd > 0.05) {
                feedback += '適度な歪みがあり、温かみのあるサウンドです。';
            } else {
                feedback += 'クリーンなサウンドです。';
            }
            
            // 基本周波数に基づいたアドバイス
            if (data.fundamental < 80) {
                feedback += ' 低域が強調されています。バスブーストやローカットの調整を検討してください。';
            } else if (data.fundamental > 1000) {
                feedback += ' 高域が強調されています。トレブルカットやハイパスフィルターの使用を検討してください。';
            }
            
            feedback += '</li>';
        });
        
        // マスタリングに関する一般的なアドバイス
        feedback += '<li><strong>マスタリングのヒント:</strong> ';
        feedback += '複数の音源をミックスする際は、各音源の周波数帯域が重ならないようにEQで調整するとクリアなミックスになります。';
        feedback += '低域はモノラルに、高域はステレオ感を出すとまとまりのあるサウンドになります。';
        feedback += 'コンプレッサーを使用してダイナミックレンジをコントロールすると、よりプロフェッショナルな仕上がりになります。</li>';
        
        feedback += '</ul>';
        
        feedbackDiv.innerHTML = feedback;
    }
    
    // 周波数から音程を計算
    function frequencyToNote(frequency) {
        const A4 = 440;  // A4の周波数 (Hz)
        const noteNames = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
        
        // 半音の数を計算
        const semitones = 12 * (Math.log2(frequency / A4));
        const noteNumber = Math.round(semitones) + 69;  // MIDIノート番号に変換 (A4 = 69)
        
        // オクターブと音名を計算
        const octave = Math.floor(noteNumber / 12) - 1;
        const noteIndex = (noteNumber % 12 + 12) % 12;
        const noteName = noteNames[noteIndex];
        
        // セント単位の誤差を計算
        const cents = Math.round(1200 * Math.log2(frequency / (A4 * Math.pow(2, (noteNumber - 69) / 12))));
        
        return {
            note: noteName,
            octave: octave,
            cents: cents,
            frequency: frequency
        };
    }
    
    // 全高調波歪み(THD)を計算
    function calculateTHD(harmonics) {
        if (harmonics.length < 2) return 0;
        
        const fundamentalPower = Math.pow(10, harmonics[0].db / 10);
        let harmonicPowerSum = 0;
        
        for (let i = 1; i < harmonics.length; i++) {
            harmonicPowerSum += Math.pow(10, harmonics[i].db / 10);
        }
        
        return Math.sqrt(harmonicPowerSum / fundamentalPower);
    }
    
    // 倍音のバランスを分析
    function analyzeHarmonicBalance(harmonics) {
        if (harmonics.length < 3) return 0;
        
        // 基本周波数に対する各倍音の相対的な強さを評価
        let balanceScore = 0;
        const expectedDecay = 0.8;  // 期待される減衰率
        
        for (let i = 1; i < Math.min(6, harmonics.length); i++) {
            const expectedDb = harmonics[0].db - (i * 6);  // 6dB/octaveの減衰を期待
            const actualDb = harmonics[i].db;
            const diff = Math.abs(actualDb - expectedDb);
            
            // 差が小さいほどスコアが高くなる
            balanceScore += Math.max(0, 1 - (diff / 20));
        }
        
        return balanceScore / (Math.min(6, harmonics.length) - 1);
    }
    
    // 奇数倍音と偶数倍音の比率を分析
    function analyzeOddEvenHarmonics(harmonics) {
        if (harmonics.length < 3) return 1.0;
        
        let oddPower = 0;
        let evenPower = 0;
        
        for (let i = 1; i < harmonics.length; i++) {
            const power = Math.pow(10, harmonics[i].db / 10);
            
            if (i % 2 === 1) {
                oddPower += power;  // 奇数倍音
            } else {
                evenPower += power;  // 偶数倍音
            }
        }
        
        return oddPower / (evenPower + 1e-10);  // ゼロ除算を防ぐ
    }
    
    // 倍音の重なりを分析
    function analyzeHarmonicOverlap(harmonicData) {
        if (harmonicData.length < 2) return 0;
        
        // 周波数ビンごとのエネルギーを計算
        const freqBins = new Array(120).fill(0);  // 20Hz-20kHzを120ビンに分割
        const minFreq = 20;
        const maxFreq = 20000;
        const freqToBin = freq => Math.floor(Math.log(freq / minFreq) / Math.log(maxFreq / minFreq) * freqBins.length);
        
        // 各オーディオの倍音をビンにマッピング
        harmonicData.forEach(data => {
            data.harmonics.forEach(harmonic => {
                const bin = Math.min(freqBins.length - 1, Math.max(0, freqToBin(harmonic.frequency)));
                freqBins[bin]++;
            });
        });
        
        // 重なりの割合を計算
        const overlapBins = freqBins.filter(count => count > 1).length;
        const totalBins = freqBins.filter(count => count > 0).length;
        
        return totalBins > 0 ? overlapBins / totalBins : 0;
    }
    
    // 音程の間隔名を取得
    function getIntervalName(ratio) {
        const intervals = [
            { ratio: 1.0, name: 'ユニゾン' },
            { ratio: 1.06, name: '半音' },
            { ratio: 1.12, name: '全音' },
            { ratio: 1.19, name: '短3度' },
            { ratio: 1.26, name: '長3度' },
            { ratio: 1.33, name: '完全4度' },
            { ratio: 1.41, name: '増4度' },
            { ratio: 1.5, name: '完全5度' },
            { ratio: 1.68, name: '長6度' },
            { ratio: 1.78, name: '短7度' },
            { ratio: 1.89, name: '長7度' },
            { ratio: 2.0, name: 'オクターブ' }
        ];
        
        let closestInterval = intervals[0];
        let minDiff = Math.abs(ratio - closestInterval.ratio);
        
        for (const interval of intervals) {
            const diff = Math.abs(ratio - interval.ratio);
            if (diff < minDiff) {
                minDiff = diff;
                closestInterval = interval;
            }
        }
        
        return closestInterval.name;
    }

    // ミックスを再生
    async function playMix() {
        if (isAnalyzing) return;
        
        // 少なくとも1つのオーディオバッファが必要
        const hasAudio = audioBuffers.some(buffer => buffer !== null);
        if (!hasAudio) {
            alert('再生するオーディオがありません。録音またはファイルをアップロードしてください。');
            return;
        }
        
        try {
            // オーディオコンテキストがサスペンドされていないか確認
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            
            // 各オーディオを再生
            audioBuffers.forEach((buffer, index) => {
                if (!buffer) return;
                
                const source = audioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(audioContext.destination);
                source.start();
                
                // 再生終了時の処理
                source.onended = () => {
                    playMixBtn.disabled = false;
                };
            });
            
            playMixBtn.disabled = true;
            
        } catch (err) {
            console.error('オーディオの再生に失敗しました:', err);
            alert('オーディオの再生中にエラーが発生しました。');
        }
    }

    // すべてのオーディオを停止
    function stopAll() {
        // アニメーションを停止
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        // オーディオソースを停止
        audioSources.forEach(source => {
            if (source && source.source) {
                try {
                    source.source.stop();
                } catch (e) {
                    console.warn('オーディオソースの停止中にエラーが発生しました:', e);
                }
            }
        });
        
        // 録音を停止
        mediaRecorders.forEach((recorder, index) => {
            if (recorder && isRecording[index]) {
                recorder.stop();
                isRecording[index] = false;
                updateRecordButton(index, false);
            }
        });
        
        // 状態をリセット
        isAnalyzing = false;
        analyzeBtn.disabled = false;
        playMixBtn.disabled = false;
    }

    // ウィンドウのリサイズ時にキャンバスを更新
    window.addEventListener('resize', () => {
        if (isAnalyzing) {
            // 可視化を再開
            visualize();
        }
    });

    // 初期化を実行
    init();
});
