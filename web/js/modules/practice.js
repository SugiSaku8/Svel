// Practice Module - Handles the music practice program functionality
export class PracticeApp {
    constructor() {
        // DOM Elements
        this.programNameInput = document.getElementById('programName');
        this.bpmInput = document.getElementById('bpm');
        this.timeSignatureSelect = document.getElementById('timeSignature');
        this.keySelect = document.getElementById('key');
        this.scaleTypeSelect = document.getElementById('scaleType');
        this.exerciseList = document.getElementById('exerciseList');
        this.addExerciseBtn = document.getElementById('addExercise');
        this.playPauseBtn = document.getElementById('playPause');
        this.stopBtn = document.getElementById('stop');
        this.metronomeBeat = document.getElementById('metronomeBeat');
        this.metronomeBar = document.getElementById('metronomeBar');
        this.currentExerciseDisplay = document.getElementById('currentExercise');
        this.exerciseDisplay = document.getElementById('exerciseDisplay');
        this.saveProgramBtn = document.getElementById('saveProgram');
        this.loadProgramBtn = document.getElementById('loadProgram');
        this.newProgramBtn = document.getElementById('newProgram');
        
        // State
        this.program = {
            name: '新しい練習プログラム',
            bpm: 120,
            timeSignature: '4/4',
            key: 'C',
            scaleType: 'major',
            exercises: []
        };
        
        // Audio context and metronome
        this.audioContext = null;
        this.metronomeInterval = null;
        this.isPlaying = false;
        this.currentExerciseIndex = 0;
        this.currentBeat = 0;
        this.beatDuration = 0;
        
        // Initialize
        this.initEventListeners();
    }
    
    /**
     * Initialize the practice app
     */
    init() {
        // Initialize audio context on user interaction
        document.addEventListener('click', () => {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        }, { once: true });
        
        // Load default program
        this.loadDefaultProgram();
    }
    
    /**
     * Set up event listeners
     */
    initEventListeners() {
        // Program settings changes
        this.programNameInput.addEventListener('change', (e) => {
            this.program.name = e.target.value || '新しい練習プログラム';
        });
        
        this.bpmInput.addEventListener('change', (e) => {
            this.program.bpm = parseInt(e.target.value) || 120;
            this.beatDuration = 60 / this.program.bpm;
        });
        
        this.timeSignatureSelect.addEventListener('change', (e) => {
            this.program.timeSignature = e.target.value;
            this.updateMetronomeDisplay();
        });
        
        this.keySelect.addEventListener('change', (e) => {
            this.program.key = e.target.value;
        });
        
        this.scaleTypeSelect.addEventListener('change', (e) => {
            this.program.scaleType = e.target.value;
        });
        
        // Exercise management
        this.addExerciseBtn.addEventListener('click', () => {
            this.showAddExerciseModal();
        });
        
        // Playback controls
        this.playPauseBtn.addEventListener('click', () => this.togglePlayback());
        this.stopBtn.addEventListener('click', () => this.stopPlayback());
        
        // Program management
        this.saveProgramBtn.addEventListener('click', () => this.saveProgram());
        this.loadProgramBtn.addEventListener('click', () => this.loadProgram());
        this.newProgramBtn.addEventListener('click', () => this.newProgram());
        
        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Space to play/pause
            if (e.code === 'Space' && !e.target.matches('input, textarea, select, button')) {
                e.preventDefault();
                this.togglePlayback();
            }
            // Escape to stop
            if (e.code === 'Escape' && this.isPlaying) {
                this.stopPlayback();
            }
        });
    }
    
    /**
     * Load default program
     */
    loadDefaultProgram() {
        // Set default values in the UI
        this.programNameInput.value = this.program.name;
        this.bpmInput.value = this.program.bpm;
        this.timeSignatureSelect.value = this.program.timeSignature;
        this.keySelect.value = this.program.key;
        this.scaleTypeSelect.value = this.program.scaleType;
        
        // Add a default exercise if none exists
        if (this.program.exercises.length === 0) {
            this.addExercise({
                id: Date.now(),
                type: 'scale',
                name: 'メジャースケール',
                duration: 5,
                tempo: 120,
                notes: 'ゆっくりと正確に弾きましょう。'
            });
        }
        
        // Update the display
        this.updateExerciseList();
        this.updateMetronomeDisplay();
    }
    
    /**
     * Show the add exercise modal
     */
    showAddExerciseModal() {
        const modal = document.getElementById('exerciseModal');
        const saveBtn = document.getElementById('saveExercise');
        
        // Reset form
        const form = modal.querySelector('form');
        if (form) form.reset();
        
        // Show modal
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Save button handler
        const saveHandler = () => {
            const exercise = {
                id: Date.now(),
                type: document.getElementById('exerciseType').value,
                name: document.getElementById('exerciseName').value || '無題の練習',
                duration: parseInt(document.getElementById('exerciseDuration').value) || 5,
                tempo: parseInt(document.getElementById('exerciseTempo').value) || 120,
                notes: document.getElementById('exerciseNotes').value || ''
            };
            
            this.addExercise(exercise);
            modal.classList.remove('show');
            document.body.style.overflow = '';
            
            // Remove the event listener to prevent duplicates
            saveBtn.removeEventListener('click', saveHandler);
        };
        
        saveBtn.addEventListener('click', saveHandler);
        
        // Close button
        const closeBtn = modal.querySelector('.close');
        closeBtn.onclick = () => {
            modal.classList.remove('show');
            document.body.style.overflow = '';
            saveBtn.removeEventListener('click', saveHandler);
        };
        
        // Close when clicking outside
        window.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
                document.body.style.overflow = '';
                saveBtn.removeEventListener('click', saveHandler);
            }
        };
    }
    
    /**
     * Add an exercise to the program
     * @param {Object} exercise - The exercise to add
     */
    addExercise(exercise) {
        this.program.exercises.push(exercise);
        this.updateExerciseList();
    }
    
    /**
     * Update the exercise list in the UI
     */
    updateExerciseList() {
        // Clear current list
        this.exerciseList.innerHTML = '';
        
        // Add each exercise
        this.program.exercises.forEach((exercise, index) => {
            const exerciseEl = document.createElement('div');
            exerciseEl.className = 'exercise-item';
            exerciseEl.innerHTML = `
                <div class="exercise-info">
                    <h4>${exercise.name}</h4>
                    <div class="exercise-meta">
                        <span>${exercise.duration}分</span>
                        <span>${exercise.tempo} BPM</span>
                        <span>${this.getExerciseTypeName(exercise.type)}</span>
                    </div>
                </div>
                <div class="exercise-actions">
                    <button class="btn btn-icon edit-exercise" data-index="${index}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-icon delete-exercise" data-index="${index}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            // Add event listeners for edit and delete
            exerciseEl.querySelector('.edit-exercise').addEventListener('click', (e) => {
                e.stopPropagation();
                this.editExercise(index);
            });
            
            exerciseEl.querySelector('.delete-exercise').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('この練習項目を削除してもよろしいですか？')) {
                    this.deleteExercise(index);
                }
            });
            
            // Click to select exercise
            exerciseEl.addEventListener('click', () => {
                this.selectExercise(index);
            });
            
            this.exerciseList.appendChild(exerciseEl);
        });
    }
    
    /**
     * Get the display name for an exercise type
     * @param {string} type - The exercise type
     * @returns {string} The display name
     */
    getExerciseTypeName(type) {
        const types = {
            'scale': 'スケール',
            'arpeggio': 'アルペジオ',
            'etude': 'エチュード',
            'song': '楽曲',
            'warmup': 'ウォームアップ',
            'technique': 'テクニック',
            'repertoire': 'レパートリー',
            'improvisation': '即興'
        };
        return types[type] || type;
    }
    
    /**
     * Edit an exercise
     * @param {number} index - The index of the exercise to edit
     */
    editExercise(index) {
        const exercise = this.program.exercises[index];
        if (!exercise) return;
        
        const modal = document.getElementById('exerciseModal');
        const saveBtn = document.getElementById('saveExercise');
        
        // Set form values
        document.getElementById('exerciseType').value = exercise.type;
        document.getElementById('exerciseName').value = exercise.name;
        document.getElementById('exerciseDuration').value = exercise.duration;
        document.getElementById('exerciseTempo').value = exercise.tempo;
        document.getElementById('exerciseNotes').value = exercise.notes || '';
        
        // Show modal
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Save button handler
        const saveHandler = () => {
            this.program.exercises[index] = {
                ...exercise,
                type: document.getElementById('exerciseType').value,
                name: document.getElementById('exerciseName').value || '無題の練習',
                duration: parseInt(document.getElementById('exerciseDuration').value) || 5,
                tempo: parseInt(document.getElementById('exerciseTempo').value) || 120,
                notes: document.getElementById('exerciseNotes').value || ''
            };
            
            this.updateExerciseList();
            modal.classList.remove('show');
            document.body.style.overflow = '';
            
            // Remove the event listener to prevent duplicates
            saveBtn.removeEventListener('click', saveHandler);
        };
        
        saveBtn.addEventListener('click', saveHandler);
        
        // Close button
        const closeBtn = modal.querySelector('.close');
        closeBtn.onclick = () => {
            modal.classList.remove('show');
            document.body.style.overflow = '';
            saveBtn.removeEventListener('click', saveHandler);
        };
        
        // Close when clicking outside
        window.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
                document.body.style.overflow = '';
                saveBtn.removeEventListener('click', saveHandler);
            }
        };
    }
    
    /**
     * Delete an exercise
     * @param {number} index - The index of the exercise to delete
     */
    deleteExercise(index) {
        this.program.exercises.splice(index, 1);
        this.updateExerciseList();
        
        // Reset current exercise if it was deleted
        if (this.currentExerciseIndex >= this.program.exercises.length) {
            this.currentExerciseIndex = Math.max(0, this.program.exercises.length - 1);
            this.selectExercise(this.currentExerciseIndex);
        }
    }
    
    /**
     * Select an exercise to display in the preview
     * @param {number} index - The index of the exercise to select
     */
    selectExercise(index) {
        if (index < 0 || index >= this.program.exercises.length) return;
        
        this.currentExerciseIndex = index;
        const exercise = this.program.exercises[index];
        
        // Update the display
        this.currentExerciseDisplay.textContent = exercise.name;
        this.exerciseDisplay.innerHTML = `
            <p><strong>種類:</strong> ${this.getExerciseTypeName(exercise.type)}</p>
            <p><strong>時間:</strong> ${exercise.duration}分</p>
            <p><strong>テンポ:</strong> ${exercise.tempo} BPM</p>
            ${exercise.notes ? `<p><strong>メモ:</strong> ${exercise.notes}</p>` : ''}
        `;
        
        // Update selected state in the list
        document.querySelectorAll('.exercise-item').forEach((item, i) => {
            item.classList.toggle('selected', i === index);
        });
    }
    
    /**
     * Toggle playback (play/pause)
     */
    togglePlayback() {
        if (this.isPlaying) {
            this.pausePlayback();
        } else {
            this.startPlayback();
        }
    }
    
    /**
     * Start or resume playback
     */
    startPlayback() {
        if (this.program.exercises.length === 0) {
            alert('練習項目がありません。先に練習項目を追加してください。');
            return;
        }
        
        // Initialize audio context if needed
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Resume audio context if it was suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        // Update UI
        this.isPlaying = true;
        this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i> 一時停止';
        this.playPauseBtn.classList.add('active');
        
        // Calculate timing
        const bpm = this.program.exercises[this.currentExerciseIndex]?.tempo || this.program.bpm;
        this.beatDuration = 60 / bpm; // in seconds
        
        // Start metronome
        this.startMetronome();
    }
    
    /**
     * Pause playback
     */
    pausePlayback() {
        this.isPlaying = false;
        
        // Update UI
        this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i> 再生';
        this.playPauseBtn.classList.remove('active');
        
        // Stop metronome
        this.stopMetronome();
    }
    
    /**
     * Stop playback and reset to beginning
     */
    stopPlayback() {
        this.pausePlayback();
        this.currentBeat = 0;
        this.updateMetronomeDisplay();
    }
    
    /**
     * Start the metronome
     */
    startMetronome() {
        if (this.metronomeInterval) {
            clearInterval(this.metronomeInterval);
        }
        
        // Initial beat
        this.playClick(this.currentBeat === 0);
        
        // Set up interval for subsequent beats
        const bpm = this.program.exercises[this.currentExerciseIndex]?.tempo || this.program.bpm;
        const interval = (60 / bpm) * 1000; // in milliseconds
        
        this.metronomeInterval = setInterval(() => {
            this.currentBeat = (this.currentBeat % this.getBeatsPerMeasure()) + 1;
            this.updateMetronomeDisplay();
            this.playClick(this.currentBeat === 1);
        }, interval);
    }
    
    /**
     * Stop the metronome
     */
    stopMetronome() {
        if (this.metronomeInterval) {
            clearInterval(this.metronomeInterval);
            this.metronomeInterval = null;
        }
    }
    
    /**
     * Play a metronome click sound
     * @param {boolean} isAccented - Whether to play an accented click
     */
    playClick(isAccented) {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = isAccented ? 800 : 600;
        gainNode.gain.value = isAccented ? 0.5 : 0.3;
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }
    
    /**
     * Update the metronome display
     */
    updateMetronomeDisplay() {
        if (!this.metronomeBeat || !this.metronomeBar) return;
        
        // Update beat number
        this.metronomeBeat.textContent = this.currentBeat;
        
        // Update bar display
        const beats = this.getBeatsPerMeasure();
        let bar = '';
        for (let i = 1; i <= beats; i++) {
            bar += i === this.currentBeat ? '● ' : '○ ';
        }
        this.metronomeBar.textContent = bar.trim();
    }
    
    /**
     * Get the number of beats per measure based on time signature
     * @returns {number} The number of beats per measure
     */
    getBeatsPerMeasure() {
        const [beats] = this.timeSignatureSelect.value.split('/').map(Number);
        return beats || 4;
    }
    
    /**
     * Save the current program
     */
    saveProgram() {
        try {
            // Update program data from form fields
            this.program = {
                ...this.program,
                name: this.programNameInput.value || '新しい練習プログラム',
                bpm: parseInt(this.bpmInput.value) || 120,
                timeSignature: this.timeSignatureSelect.value,
                key: this.keySelect.value,
                scaleType: this.scaleTypeSelect.value
            };
            
            // Create a data URI for download
            const dataStr = 'data:text/json;charset=utf-8,' + 
                encodeURIComponent(JSON.stringify(this.program, null, 2));
            
            // Create a download link
            const downloadLink = document.createElement('a');
            downloadLink.href = dataStr;
            downloadLink.download = `${this.program.name.replace(/\s+/g, '_')}.json`;
            
            // Trigger download
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            // Show success message
            alert(`「${this.program.name}」を保存しました。`);
        } catch (error) {
            console.error('Error saving program:', error);
            alert('プログラムの保存中にエラーが発生しました。');
        }
    }
    
    /**
     * Load a program from a file
     */
    loadProgram() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const programData = JSON.parse(e.target.result);
                    this.loadProgramData(programData);
                } catch (error) {
                    console.error('Error parsing program file:', error);
                    alert('無効なプログラムファイルです。');
                }
            };
            reader.onerror = () => {
                alert('ファイルの読み込み中にエラーが発生しました。');
            };
            reader.readAsText(file);
        };
        
        input.click();
    }
    
    /**
     * Load program data into the UI
     * @param {Object} programData - The program data to load
     */
    loadProgramData(programData) {
        // Validate program data
        if (!programData || typeof programData !== 'object') {
            throw new Error('Invalid program data');
        }
        
        // Update program state
        this.program = {
            name: programData.name || '新しい練習プログラム',
            bpm: programData.bpm || 120,
            timeSignature: programData.timeSignature || '4/4',
            key: programData.key || 'C',
            scaleType: programData.scaleType || 'major',
            exercises: Array.isArray(programData.exercises) ? programData.exercises : []
        };
        
        // Update UI
        this.programNameInput.value = this.program.name;
        this.bpmInput.value = this.program.bpm;
        this.timeSignatureSelect.value = this.program.timeSignature;
        this.keySelect.value = this.program.key;
        this.scaleTypeSelect.value = this.program.scaleType;
        
        // Update exercise list
        this.updateExerciseList();
        
        // Select the first exercise if available
        if (this.program.exercises.length > 0) {
            this.selectExercise(0);
        } else {
            this.currentExerciseDisplay.textContent = '-';
            this.exerciseDisplay.innerHTML = '';
        }
        
        // Show success message
        alert(`「${this.program.name}」を読み込みました。`);
    }
    
    /**
     * Create a new program
     */
    newProgram() {
        if (confirm('現在のプログラムを破棄して新規作成しますか？未保存の変更は失われます。')) {
            this.program = {
                name: '新しい練習プログラム',
                bpm: 120,
                timeSignature: '4/4',
                key: 'C',
                scaleType: 'major',
                exercises: []
            };
            
            // Reset UI
            this.loadDefaultProgram();
            this.stopPlayback();
            
            // Show message
            alert('新しいプログラムを作成しました。');
        }
    }
    
    /**
     * Clean up resources when the app is closed
     */
    destroy() {
        this.stopPlayback();
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        // Remove event listeners
        // (In a real app, you'd want to store references to the handlers)
    }
}
