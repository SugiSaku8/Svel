// Tuner Module - Handles the guitar/bass tuner functionality
export class TunerApp {
    constructor() {
        // DOM Elements
        this.noteDisplay = document.getElementById('note');
        this.octaveDisplay = document.getElementById('octave');
        this.centsDisplay = document.getElementById('cents');
        this.needle = document.querySelector('.needle');
        this.startTunerBtn = document.getElementById('startTuner');
        this.baseFreqInput = document.getElementById('baseFreq');
        this.noteSystemSelect = document.getElementById('noteSystem');
        
        // Audio context and analyzer
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.scriptProcessor = null;
        this.isListening = false;
        
        // Note detection
        this.noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        this.noteStringsSolfege = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
        this.noteStringsDE = ["C", "Cis", "D", "Dis", "E", "F", "Fis", "G", "Gis", "A", "Ais", "B"];
        this.noteStringsJP = ["ハ", "嬰ハ", "ニ", "嬰ニ", "ホ", "ヘ", "嬰ヘ", "ト", "嬰ト", "イ", "嬰イ", "ロ"];
        
        // Tuner state
        this.baseFrequency = 440; // A4 = 440Hz
        this.currentNote = null;
        this.currentCents = 0;
        this.noteSystem = 'en';
        
        // Initialize
        this.initEventListeners();
    }
    
    /**
     * Initialize the tuner
     */
    init() {
        // Set initial values
        this.baseFrequency = parseFloat(this.baseFreqInput.value) || 440;
        this.noteSystem = this.noteSystemSelect.value;
        
        // Initialize audio context on user interaction
        document.addEventListener('click', () => {
            if (!this.audioContext) {
                this.initializeAudio();
            }
        }, { once: true });
        
        // Update display
        this.updateDisplay('--', '', 0);
    }
    
    /**
     * Set up event listeners
     */
    initEventListeners() {
        // Base frequency input
        this.baseFreqInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            if (!isNaN(value) && value >= 300 && value <= 500) {
                this.baseFrequency = value;
            }
        });
        
        // Validate on blur to ensure value is within range
        this.baseFreqInput.addEventListener('blur', (e) => {
            let value = parseFloat(e.target.value);
            if (isNaN(value)) {
                value = 440;
            } else if (value < 300) {
                value = 300;
            } else if (value > 500) {
                value = 500;
            }
            this.baseFrequency = value;
            e.target.value = value.toFixed(1);
        });
        
        // Note system selector
        this.noteSystemSelect.addEventListener('change', (e) => {
            this.noteSystem = e.target.value;
            // Update display with current note in the new system
            if (this.currentNote) {
                this.updateNoteDisplay(this.currentNote);
            }
        });
        
        // Start/stop tuner button
        this.startTunerBtn.addEventListener('click', () => {
            if (this.isListening) {
                this.stopListening();
            } else {
                this.startListening();
            }
        });
    }
    
    /**
     * Initialize the Web Audio API
     */
    initializeAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
            
            // Set up audio processing
            this.analyser.smoothingTimeConstant = 0.8;
            this.analyser.fftSize = 1024;
            
            // Connect nodes
            this.scriptProcessor.connect(this.audioContext.destination);
            
            // Set up audio processing callback
            this.scriptProcessor.onaudioprocess = () => {
                if (!this.isListening) return;
                
                // Get frequency data
                const bufferLength = this.analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                this.analyser.getByteFrequencyData(dataArray);
                
                // Process the audio data to find the dominant frequency
                this.processAudioData(dataArray);
            };
            
            console.log('Audio context initialized');
        } catch (error) {
            console.error('Error initializing audio:', error);
            alert('オーディオデバイスにアクセスできませんでした。マイクのアクセスを許可しているか確認してください。');
        }
    }
    
    /**
     * Start listening to microphone input
     */
    async startListening() {
        if (this.isListening) return;
        
        try {
            // Initialize audio context if not already done
            if (!this.audioContext) {
                this.initializeAudio();
            }
            
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Create a microphone source
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            // Connect microphone to analyser and script processor
            this.microphone.connect(this.analyser);
            this.analyser.connect(this.scriptProcessor);
            
            // Update UI
            this.isListening = true;
            this.startTunerBtn.innerHTML = '<i class="fas fa-microphone-slash"></i> 測定を停止';
            this.startTunerBtn.classList.add('active');
            
            console.log('Started listening to microphone');
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('マイクにアクセスできませんでした。許可を確認してください。');
        }
    }
    
    /**
     * Stop listening to microphone input
     */
    stopListening() {
        if (!this.isListening) return;
        
        // Disconnect audio nodes
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        
        // Update UI
        this.isListening = false;
        this.startTunerBtn.innerHTML = '<i class="fas fa-microphone"></i> 測定開始';
        this.startTunerBtn.classList.remove('active');
        
        // Reset display
        this.updateDisplay('--', '', 0);
        
        console.log('Stopped listening to microphone');
    }
    
    /**
     * Process audio data to detect pitch
     * @param {Uint8Array} dataArray - The frequency data from the analyser
     */
    processAudioData(dataArray) {
        // Find the index of the highest frequency peak
        let maxIndex = 0;
        let maxValue = 0;
        
        for (let i = 0; i < dataArray.length; i++) {
            if (dataArray[i] > maxValue) {
                maxValue = dataArray[i];
                maxIndex = i;
            }
        }
        
        // Calculate the frequency of the peak
        const sampleRate = this.audioContext.sampleRate;
        const frequency = maxIndex * sampleRate / (this.analyser.fftSize * 2);
        
        // Only process if we have a strong enough signal
        if (maxValue > 10) {
            this.detectPitch(frequency);
        } else {
            // No sound detected
            this.updateDisplay('--', '', 0);
        }
    }
    
    /**
     * Detect the musical note from a frequency
     * @param {number} frequency - The frequency to analyze
     */
    detectPitch(frequency) {
        if (frequency < 27.5 || frequency > 4186.0) { // A0 to C8
            this.updateDisplay('--', '', 0);
            return;
        }
        
        // Calculate the number of half steps from A4 (440Hz)
        const A4 = this.baseFrequency; // Can be adjusted for different tuning standards
        const halfStepsFromA4 = 12 * (Math.log2(frequency / A4));
        
        // Calculate the nearest note
        const noteIndex = Math.round(halfStepsFromA4) % 12;
        const octave = Math.floor(Math.log2(frequency / A4) * 12 / 12) + 4;
        
        // Calculate cents (how far from the nearest note)
        const cents = Math.round(100 * (halfStepsFromA4 - Math.round(halfStepsFromA4)));
        
        // Update the display
        this.currentNote = {
            name: this.noteStrings[((noteIndex % 12) + 12) % 12],
            octave: octave,
            cents: cents,
            frequency: frequency
        };
        
        this.updateNoteDisplay(this.currentNote);
        this.updateNeedle(cents);
    }
    
    /**
     * Update the note display
     * @param {Object} note - The note to display
     */
    updateNoteDisplay(note) {
        if (!note) return;
        
        let noteName = note.name;
        
        // Convert to selected note naming system
        switch (this.noteSystem) {
            case 'solfege':
                const solfegeIndex = this.noteStrings.indexOf(noteName);
                noteName = this.noteStringsSolfege[solfegeIndex] || noteName;
                break;
            case 'de':
                const deIndex = this.noteStrings.indexOf(noteName);
                noteName = this.noteStringsDE[deIndex] || noteName;
                break;
            case 'jp':
                const jpIndex = this.noteStrings.indexOf(noteName);
                noteName = this.noteStringsJP[jpIndex] || noteName;
                break;
            // 'en' is the default
        }
        
        this.updateDisplay(noteName, note.octave, note.cents);
    }
    
    /**
     * Update the display with note and cents information
     * @param {string} note - The note name
     * @param {string|number} octave - The octave number
     * @param {number} cents - The cents offset from the note
     */
    updateDisplay(note, octave, cents) {
        this.noteDisplay.textContent = note;
        this.octaveDisplay.textContent = octave;
        this.centsDisplay.textContent = Math.abs(cents);
        
        // Update cent sign
        const centsSign = document.querySelector('.cents-display');
        if (centsSign) {
            centsSign.innerHTML = `${Math.abs(cents)} <span class="cents-label">cent${cents <= -50 ? ' ↓' : cents >= 50 ? ' ↑' : ''}</span>`;
        }
    }
    
    /**
     * Update the needle position based on cents
     * @param {number} cents - The cents offset from the note
     */
    updateNeedle(cents) {
        if (!this.needle) return;
        
        // Limit the range to -50 to +50 cents for display
        const maxCents = 50;
        const boundedCents = Math.max(-maxCents, Math.min(maxCents, cents));
        
        // Calculate rotation angle (-45 to +45 degrees)
        const angle = (boundedCents / maxCents) * 45;
        
        // Apply the rotation
        this.needle.style.transform = `translateX(-50%) rotate(${angle}deg)`;
        
        // Update needle color based on how close to in-tune
        if (Math.abs(cents) < 5) {
            this.needle.style.backgroundColor = '#34C759'; // Green when in tune
        } else if (Math.abs(cents) < 25) {
            this.needle.style.backgroundColor = '#FF9500'; // Orange when close
        } else {
            this.needle.style.backgroundColor = '#FF3B30'; // Red when far
        }
    }
    
    /**
     * Clean up resources when the tuner is closed
     */
    destroy() {
        this.stopListening();
        
        if (this.audioContext) {
            if (this.scriptProcessor) {
                this.scriptProcessor.disconnect();
                this.scriptProcessor.onaudioprocess = null;
                this.scriptProcessor = null;
            }
            
            if (this.analyser) {
                this.analyser.disconnect();
                this.analyser = null;
            }
            
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}
