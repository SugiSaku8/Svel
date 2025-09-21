// Analyzer Module - Handles audio analysis and visualization
export class AnalyzerApp {
    constructor() {
        // DOM Elements
        this.audioInputList = document.getElementById('audioInputList');
        this.addInputBtn = document.getElementById('addInput');
        this.analyzeBtn = document.getElementById('analyze');
        this.playMixBtn = document.getElementById('playMix');
        this.stopBtn = document.getElementById('stopAnalyzer');
        this.waveformCanvas = document.getElementById('waveform');
        this.spectrumCanvas = document.getElementById('spectrum');
        this.harmonicCanvas = document.getElementById('harmonic');
        this.visualizationTabs = document.querySelectorAll('.viz-tab');
        
        // Audio context and nodes
        this.audioContext = null;
        this.analyzers = [];
        this.audioBuffers = [];
        this.audioSources = [];
        this.mediaRecorders = [];
        this.recordedChunks = [];
        
        // Visualization
        this.waveformCtx = this.waveformCanvas.getContext('2d');
        this.spectrumCtx = this.spectrumCanvas.getContext('2d');
        this.harmonicCtx = this.harmonicCanvas.getContext('2d');
        this.animationFrameId = null;
        this.isAnalyzing = false;
        this.activeVisualization = 'waveform';
        
        // Initialize
        this.initEventListeners();
        this.setupCanvases();
        this.addAudioInput(); // Add first input by default
    }
    
    /**
     * Initialize the analyzer
     */
    init() {
        // Initialize audio context on user interaction
        document.addEventListener('click', () => {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.setupAnalyzers();
            }
        }, { once: true });
    }
    
    /**
     * Set up event listeners
     */
    initEventListeners() {
        // Add input button
        this.addInputBtn.addEventListener('click', () => this.addAudioInput());
        
        // Analysis controls
        this.analyzeBtn.addEventListener('click', () => this.toggleAnalysis());
        this.playMixBtn.addEventListener('click', () => this.playMix());
        this.stopBtn.addEventListener('click', () => this.stopPlayback());
        
        // Visualization tabs
        this.visualizationTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const vizType = tab.getAttribute('data-viz');
                this.switchVisualization(vizType);
            });
        });
        
        // Handle window resize
        window.addEventListener('resize', () => this.setupCanvases());
    }
    
    /**
     * Set up canvas dimensions and scaling for high-DPI displays
     */
    setupCanvases() {
        const canvases = [this.waveformCanvas, this.spectrumCanvas, this.harmonicCanvas];
        const container = document.querySelector('.visualization-container');
        
        if (!container) return;
        
        const width = container.clientWidth;
        const height = 300; // Fixed height for visualizations
        
        canvases.forEach(canvas => {
            // Set display size
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            
            // Set actual size in memory (scaled for high DPI)
            const dpr = window.devicePixelRatio || 1;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            
            // Scale the context to ensure correct drawing operations
            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);
        });
    }
    
    /**
     * Set up audio analyzers for each input
     */
    setupAnalyzers() {
        if (!this.audioContext) return;
        
        // Clear existing analyzers
        this.analyzers = [];
        
        // Create analyzers for each input
        const inputs = document.querySelectorAll('.audio-input-item');
        inputs.forEach((input, index) => {
            const analyzer = this.audioContext.createAnalyser();
            analyzer.fftSize = 2048;
            this.analyzers[index] = analyzer;
        });
    }
    
    /**
     * Add a new audio input to the analyzer
     */
    addAudioInput() {
        const inputCount = document.querySelectorAll('.audio-input-item').length;
        if (inputCount >= 4) {
            alert('最大4つの入力まで追加できます。');
            return;
        }
        
        const index = inputCount;
        const inputItem = document.createElement('div');
        inputItem.className = 'audio-input-item';
        inputItem.innerHTML = `
            <h3>入力 ${index + 1}</h3>
            <div class="input-controls">
                <label class="file-upload">
                    <i class="fas fa-file-audio"></i> ファイルを選択
                    <input type="file" accept="audio/*" class="audio-file" data-index="${index}" hidden>
                </label>
                <button class="btn btn-secondary record-btn" data-index="${index}">
                    <i class="fas fa-microphone"></i> 録音
                </button>
                <audio controls class="audio-preview" data-index="${index}"></audio>
            </div>
        `;
        
        this.audioInputList.appendChild(inputItem);
        
        // Set up event listeners for the new input
        this.setupInputListeners(index);
        
        // Update analyzers
        if (this.audioContext) {
            this.setupAnalyzers();
        }
        
        // Scroll to the new input
        inputItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    /**
     * Set up event listeners for an audio input
     * @param {number} index - The index of the audio input
     */
    setupInputListeners(index) {
        const fileInput = document.querySelector(`.audio-file[data-index="${index}"]`);
        const recordBtn = document.querySelector(`.record-btn[data-index="${index}"]`);
        const audioPreview = document.querySelector(`.audio-preview[data-index="${index}"]`);
        
        if (!fileInput || !recordBtn || !audioPreview) return;
        
        // File input handler
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            this.loadAudioFile(file, index);
        });
        
        // Record button handler
        recordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleRecording(index);
        });
    }
    
    /**
     * Load an audio file into the specified input
     * @param {File} file - The audio file to load
     * @param {number} index - The index of the input to load the file into
     */
    loadAudioFile(file, index) {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const arrayBuffer = e.target.result;
            
            this.audioContext.decodeAudioData(arrayBuffer)
                .then((audioBuffer) => {
                    // Store the audio buffer
                    this.audioBuffers[index] = audioBuffer;
                    
                    // Update the audio preview
                    const audioPreview = document.querySelector(`.audio-preview[data-index="${index}"]`);
                    if (audioPreview) {
                        const audioUrl = URL.createObjectURL(file);
                        audioPreview.src = audioUrl;
                    }
                    
                    console.log(`Audio file loaded for input ${index + 1}`);
                })
                .catch((error) => {
                    console.error('Error decoding audio data:', error);
                    alert('オーディオファイルの読み込み中にエラーが発生しました。');
                });
        };
        
        reader.onerror = () => {
            console.error('Error reading file');
            alert('ファイルの読み込み中にエラーが発生しました。');
        };
        
        reader.readAsArrayBuffer(file);
    }
    
    /**
     * Toggle audio recording for the specified input
     * @param {number} index - The index of the input to record from
     */
    async toggleRecording(index) {
        const recordBtn = document.querySelector(`.record-btn[data-index="${index}"]`);
        
        if (!this.mediaRecorders[index]) {
            // Start recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.mediaRecorders[index] = new MediaRecorder(stream);
                this.recordedChunks[index] = [];
                
                this.mediaRecorders[index].ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        this.recordedChunks[index].push(e.data);
                    }
                };
                
                this.mediaRecorders[index].onstop = () => {
                    const audioBlob = new Blob(this.recordedChunks[index], { type: 'audio/wav' });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    
                    // Update the audio preview
                    const audioPreview = document.querySelector(`.audio-preview[data-index="${index}"]`);
                    if (audioPreview) {
                        audioPreview.src = audioUrl;
                    }
                    
                    // Convert to audio buffer for analysis
                    this.loadAudioFile(audioBlob, index);
                };
                
                this.mediaRecorders[index].start();
                recordBtn.innerHTML = '<i class="fas fa-stop"></i> 停止';
                recordBtn.classList.add('recording');
                
                console.log(`Started recording for input ${index + 1}`);
            } catch (error) {
                console.error('Error accessing microphone:', error);
                alert('マイクにアクセスできませんでした。許可を確認してください。');
            }
        } else {
            // Stop recording
            this.mediaRecorders[index].stop();
            this.mediaRecorders[index].stream.getTracks().forEach(track => track.stop());
            this.mediaRecorders[index] = null;
            
            recordBtn.innerHTML = '<i class="fas fa-microphone"></i> 録音';
            recordBtn.classList.remove('recording');
            
            console.log(`Stopped recording for input ${index + 1}`);
        }
    }
    
    /**
     * Toggle audio analysis
     */
    toggleAnalysis() {
        if (this.isAnalyzing) {
            this.stopAnalysis();
        } else {
            this.startAnalysis();
        }
    }
    
    /**
     * Start audio analysis and visualization
     */
    startAnalysis() {
        if (this.isAnalyzing) return;
        
        // Check if we have any audio to analyze
        const hasAudio = this.audioBuffers.some(buffer => buffer !== undefined);
        if (!hasAudio) {
            alert('分析するオーディオがありません。ファイルを読み込むか、録音してください。');
            return;
        }
        
        // Set up audio sources and connect to analyzers
        this.audioSources = [];
        
        this.audioBuffers.forEach((buffer, index) => {
            if (!buffer) return;
            
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            
            // Connect to analyzer if available
            if (this.analyzers[index]) {
                source.connect(this.analyzers[index]);
                this.analyzers[index].connect(this.audioContext.destination);
            } else {
                source.connect(this.audioContext.destination);
            }
            
            // Store the source so we can stop it later
            this.audioSources[index] = source;
        });
        
        // Start visualization
        this.isAnalyzing = true;
        this.analyzeBtn.innerHTML = '<i class="fas fa-pause"></i> 解析を一時停止';
        this.analyzeBtn.classList.add('active');
        
        // Start the visualization loop
        this.visualize();
        
        console.log('Started audio analysis');
    }
    
    /**
     * Stop audio analysis
     */
    stopAnalysis() {
        if (!this.isAnalyzing) return;
        
        // Stop all audio sources
        this.audioSources.forEach(source => {
            if (source) {
                try {
                    source.stop();
                } catch (e) {
                    // Source might have already been stopped
                }
            }
        });
        
        // Stop visualization
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Update UI
        this.isAnalyzing = false;
        this.analyzeBtn.innerHTML = '<i class="fas fa-play"></i> 解析開始';
        this.analyzeBtn.classList.remove('active');
        
        console.log('Stopped audio analysis');
    }
    
    /**
     * Play a mix of all loaded audio files
     */
    playMix() {
        // Stop any currently playing audio
        this.stopPlayback();
        
        // Create a new audio context if needed
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Create and start sources for all audio buffers
        this.audioBuffers.forEach((buffer, index) => {
            if (!buffer) return;
            
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioContext.destination);
            
            // Store the source so we can stop it later
            this.audioSources[index] = source;
            
            // Start playing
            source.start();
            
            // Set up event for when playback ends
            source.onended = () => {
                this.audioSources[index] = null;
            };
        });
        
        // Update UI
        this.playMixBtn.classList.add('active');
        
        console.log('Playing audio mix');
    }
    
    /**
     * Stop all audio playback
     */
    stopPlayback() {
        // Stop all audio sources
        this.audioSources.forEach((source, index) => {
            if (source) {
                try {
                    source.stop();
                } catch (e) {
                    // Source might have already been stopped
                }
                this.audioSources[index] = null;
            }
        });
        
        // Stop any active recordings
        this.mediaRecorders.forEach((recorder, index) => {
            if (recorder && recorder.state !== 'inactive') {
                recorder.stop();
                recorder.stream.getTracks().forEach(track => track.stop());
                this.mediaRecorders[index] = null;
                
                // Update UI
                const recordBtn = document.querySelector(`.record-btn[data-index="${index}"]`);
                if (recordBtn) {
                    recordBtn.innerHTML = '<i class="fas fa-microphone"></i> 録音';
                    recordBtn.classList.remove('recording');
                }
            }
        });
        
        // Update UI
        this.playMixBtn.classList.remove('active');
        
        console.log('Stopped all audio playback');
    }
    
    /**
     * Switch between different visualization types
     * @param {string} vizType - The type of visualization to show ('waveform', 'spectrum', 'harmonic')
     */
    switchVisualization(vizType) {
        // Hide all visualizations
        document.querySelectorAll('.visualization-container canvas').forEach(canvas => {
            canvas.classList.remove('active');
        });
        
        // Show the selected visualization
        const activeCanvas = document.getElementById(vizType);
        if (activeCanvas) {
            activeCanvas.classList.add('active');
        }
        
        // Update active tab
        this.visualizationTabs.forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-viz') === vizType);
        });
        
        this.activeVisualization = vizType;
    }
    
    /**
     * Main visualization loop
     */
    visualize() {
        if (!this.isAnalyzing) return;
        
        // Clear canvases
        const clearCanvas = (ctx, canvas) => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        };
        
        // Draw the active visualization
        switch (this.activeVisualization) {
            case 'waveform':
                clearCanvas(this.waveformCtx, this.waveformCanvas);
                this.drawWaveform();
                break;
                
            case 'spectrum':
                clearCanvas(this.spectrumCtx, this.spectrumCanvas);
                this.drawSpectrum();
                break;
                
            case 'harmonic':
                clearCanvas(this.harmonicCtx, this.harmonicCanvas);
                this.drawHarmonicAnalysis();
                break;
        }
        
        // Continue the animation loop
        this.animationFrameId = requestAnimationFrame(() => this.visualize());
    }
    
    /**
     * Draw the waveform visualization
     */
    drawWaveform() {
        if (!this.analyzers.length) return;
        
        const width = this.waveformCanvas.width;
        const height = this.waveformCanvas.height;
        const dpr = window.devicePixelRatio || 1;
        const ctx = this.waveformCtx;
        
        // Set up the drawing context
        ctx.lineWidth = 2 * dpr;
        ctx.strokeStyle = '#007AFF';
        ctx.beginPath();
        
        // Get the time domain data
        const bufferLength = this.analyzers[0].frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyzers[0].getByteTimeDomainData(dataArray);
        
        // Draw the waveform
        const sliceWidth = (width * 1.0) / bufferLength;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * height) / 2;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        // Draw a line to the right edge of the canvas
        ctx.lineTo(width, height / 2);
        ctx.stroke();
    }
    
    /**
     * Draw the frequency spectrum visualization
     */
    drawSpectrum() {
        if (!this.analyzers.length) return;
        
        const width = this.spectrumCanvas.width;
        const height = this.spectrumCanvas.height;
        const dpr = window.devicePixelRatio || 1;
        const ctx = this.spectrumCtx;
        
        // Get the frequency data
        const bufferLength = this.analyzers[0].frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyzers[0].getByteFrequencyData(dataArray);
        
        // Draw the spectrum
        const barWidth = (width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * height;
            
            // Create a gradient for each bar
            const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
            gradient.addColorStop(0, '#007AFF');
            gradient.addColorStop(1, '#5AC8FA');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
            
            x += barWidth + 1;
        }
    }
    
    /**
     * Draw the harmonic analysis visualization
     */
    drawHarmonicAnalysis() {
        if (!this.analyzers.length) return;
        
        const width = this.harmonicCanvas.width;
        const height = this.harmonicCanvas.height;
        const dpr = window.devicePixelRatio || 1;
        const ctx = this.harmonicCtx;
        
        // Get the frequency data
        const bufferLength = this.analyzers[0].frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyzers[0].getByteFrequencyData(dataArray);
        
        // Simple harmonic series visualization
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) * 0.4;
        
        // Draw the base circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius * 0.1, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 122, 255, 0.5)';
        ctx.fill();
        
        // Draw harmonic circles
        const numHarmonics = 8;
        
        for (let i = 1; i <= numHarmonics; i++) {
            const radius = (maxRadius * i) / numHarmonics;
            const amplitude = dataArray[Math.floor((i / numHarmonics) * bufferLength)] / 255;
            
            // Draw the circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = `rgba(0, 122, 255, ${0.2 + 0.8 * amplitude})`;
            ctx.lineWidth = 2 * dpr * (0.5 + amplitude);
            ctx.stroke();
            
            // Draw amplitude indicators
            const indicatorLength = 20 * dpr * amplitude;
            ctx.beginPath();
            ctx.moveTo(centerX - indicatorLength, centerY - radius);
            ctx.lineTo(centerX + indicatorLength, centerY - radius);
            ctx.strokeStyle = `rgba(255, 59, 48, ${0.5 + 0.5 * amplitude})`;
            ctx.lineWidth = 3 * dpr;
            ctx.stroke();
        }
    }
    
    /**
     * Clean up resources when the analyzer is closed
     */
    destroy() {
        this.stopAnalysis();
        this.stopPlayback();
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        // Clear any animation frames
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
}
