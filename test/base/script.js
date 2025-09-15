// アプリケーションの状態
const state = {
    currentProgram: {
        name: '新しい練習プログラム',
        bpm: 120,
        timeSignature: '4/4',
        key: 'C',
        scaleType: 'major',
        exercises: []
    },
    isPlaying: false,
    currentExerciseIndex: 0,
    currentBeat: 1,
    timer: null,
    audioContext: null,
    metronomeInterval: null,
    nextNoteTime: 0.0,
    noteLength: 0.05,
    lookahead: 25.0,
    scheduleAheadTime: 0.1,
    current16thNote: 0,
    next16thNoteDueTime: 0,
    beatsPerMeasure: 4,
    notesInQueue: [],
    tickCounter: 0,
    metronomeBuffer: null
};

// DOM要素
const elements = {
    programName: document.getElementById('programName'),
    bpm: document.getElementById('bpm'),
    timeSignature: document.getElementById('timeSignature'),
    key: document.getElementById('key'),
    scaleType: document.getElementById('scaleType'),
    exerciseList: document.getElementById('exerciseList'),
    metronomeBeat: document.getElementById('metronomeBeat'),
    metronomeBar: document.getElementById('metronomeBar'),
    playPause: document.getElementById('playPause'),
    stop: document.getElementById('stop'),
    currentExercise: document.getElementById('currentExercise'),
    exerciseDisplay: document.getElementById('exerciseDisplay'),
    exerciseModal: document.getElementById('exerciseModal'),
    exerciseType: document.getElementById('exerciseType'),
    exerciseOptions: document.getElementById('exerciseOptions'),
    exerciseDuration: document.getElementById('exerciseDuration'),
    exerciseNotes: document.getElementById('exerciseNotes'),
    saveExercise: document.getElementById('saveExercise'),
    newProgram: document.getElementById('newProgram'),
    saveProgram: document.getElementById('saveProgram'),
    loadProgram: document.getElementById('loadProgram'),
    shareProgram: document.getElementById('shareProgram')
};

// 初期化
function init() {
    // イベントリスナーの設定
    setupEventListeners();
    // 初期状態の設定
    updateUIFromState();
    // オーディオコンテキストの初期化（ユーザーインタラクション後に実行）
    setupAudio();
    // サンプルデータの読み込み（オプション）
    // loadSampleData();
}

// イベントリスナーの設定
function setupEventListeners() {
    // 練習プログラムの設定変更
    elements.programName.addEventListener('change', updateProgramSettings);
    elements.bpm.addEventListener('change', updateProgramSettings);
    elements.timeSignature.addEventListener('change', updateProgramSettings);
    elements.key.addEventListener('change', updateProgramSettings);
    elements.scaleType.addEventListener('change', updateProgramSettings);

    // 練習項目の追加と管理
    document.getElementById('addExercise').addEventListener('click', () => {
        openExerciseModal();
    });

    // モーダルの操作
    document.querySelector('.close').addEventListener('click', closeExerciseModal);
    elements.saveExercise.addEventListener('click', saveExercise);
    elements.exerciseType.addEventListener('change', updateExerciseOptions);

    // 再生・停止コントロール
    elements.playPause.addEventListener('click', togglePlayPause);
    elements.stop.addEventListener('click', stopPlayback);

    // プログラムの保存・読み込み
    elements.newProgram.addEventListener('click', createNewProgram);
    elements.saveProgram.addEventListener('click', saveProgramToLocalStorage);
    elements.loadProgram.addEventListener('click', loadProgramFromLocalStorage);
    elements.shareProgram.addEventListener('click', shareProgram);

    // モーダルの外側をクリックで閉じる
    window.addEventListener('click', (e) => {
        if (e.target === elements.exerciseModal) {
            closeExerciseModal();
        }
    });
}

// オーディオの初期化
function setupAudio() {
    // ユーザージェスチャー後にオーディオコンテキストを初期化
    const initAudioOnInteraction = () => {
        if (!state.audioContext) {
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            createMetronomeSounds();
        }
        // 一度初期化したらイベントリスナーを削除
        document.removeEventListener('click', initAudioOnInteraction);
        document.removeEventListener('keydown', initAudioOnInteraction);
    };

    document.addEventListener('click', initAudioOnInteraction, { once: true });
    document.addEventListener('keydown', initAudioOnInteraction, { once: true });
}

// メトロノーム音の生成
async function createMetronomeSounds() {
    try {
        // メインのビート（高音）
        const mainBeatBuffer = state.audioContext.createBuffer(1, state.audioContext.sampleRate * 0.1, state.audioContext.sampleRate);
        const mainBeatData = mainBeatBuffer.getChannelData(0);
        
        // サブビート（低音）
        const subBeatBuffer = state.audioContext.createBuffer(1, state.audioContext.sampleRate * 0.1, state.audioContext.sampleRate);
        const subBeatData = subBeatBuffer.getChannelData(0);
        
        // メインビートの生成（1000Hz）
        for (let i = 0; i < mainBeatBuffer.length; i++) {
            const t = i / mainBeatBuffer.sampleRate;
            const frequency = 1000;
            mainBeatData[i] = Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * 20);
        }
        
        // サブビートの生成（600Hz）
        for (let i = 0; i < subBeatBuffer.length; i++) {
            const t = i / subBeatBuffer.sampleRate;
            const frequency = 600;
            subBeatData[i] = Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * 20);
        }
        
        state.metronomeBuffer = {
            main: mainBeatBuffer,
            sub: subBeatBuffer
        };
    } catch (error) {
        console.error('メトロノーム音の生成に失敗しました:', error);
    }
}

// メトロノーム音を再生
function playMetronomeSound(isMainBeat) {
    if (!state.audioContext || !state.metronomeBuffer) return;
    
    const source = state.audioContext.createBufferSource();
    source.buffer = isMainBeat ? state.metronomeBuffer.main : state.metronomeBuffer.sub;
    
    const gainNode = state.audioContext.createGain();
    gainNode.gain.value = isMainBeat ? 1.0 : 0.7;
    
    source.connect(gainNode);
    gainNode.connect(state.audioContext.destination);
    
    source.start(0);
    return source;
}

// プログラム設定の更新
function updateProgramSettings() {
    state.currentProgram.name = elements.programName.value;
    state.currentProgram.bpm = parseInt(elements.bpm.value, 10);
    state.currentProgram.timeSignature = elements.timeSignature.value;
    state.currentProgram.key = elements.key.value;
    state.currentProgram.scaleType = elements.scaleType.value;
    
    // 拍子に基づいて1小節の拍数を更新
    const [beats, noteValue] = state.currentProgram.timeSignature.split('/').map(Number);
    state.beatsPerMeasure = beats;
    
    // メトロノーム表示を更新
    updateMetronomeDisplay();
}

// メトロノーム表示の更新
function updateMetronomeDisplay() {
    const beats = state.beatsPerMeasure;
    let barDisplay = '';
    for (let i = 1; i <= beats; i++) {
        barDisplay += i === 1 ? '| ' : '| ';
    }
    barDisplay += '|';
    elements.metronomeBar.textContent = barDisplay;
}

// 練習項目モーダルを開く
function openExerciseModal(exercise = null) {
    state.editingExercise = exercise;
    
    // モーダルの初期化
    if (exercise) {
        // 既存の練習項目を編集
        elements.exerciseType.value = exercise.type;
        elements.exerciseDuration.value = exercise.duration || 5;
        elements.exerciseNotes.value = exercise.notes || '';
    } else {
        // 新しい練習項目
        elements.exerciseType.value = 'scale';
        elements.exerciseDuration.value = 5;
        elements.exerciseNotes.value = '';
    }
    
    // オプションを更新
    updateExerciseOptions();
    
    // モーダルを表示
    elements.exerciseModal.style.display = 'block';
}

// 練習項目のオプションを更新
function updateExerciseOptions() {
    const type = elements.exerciseType.value;
    let optionsHTML = '';
    
    switch (type) {
        case 'scale':
            optionsHTML = `
                <div class="form-group">
                    <label for="scaleType">スケールタイプ:</label>
                    <select id="scaleTypeOption">
                        <option value="major">メジャー</option>
                        <option value="minor">ナチュラルマイナー</option>
                        <option value="harmonicMinor">ハーモニックマイナー</option>
                        <option value="melodicMinor">メロディックマイナー</option>
                        <option value="pentatonic">ペンタトニック</option>
                        <option value="blues">ブルース</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="scaleOctaves">オクターブ数:</label>
                    <select id="scaleOctaves">
                        <option value="1">1オクターブ</option>
                        <option value="2" selected>2オクターブ</option>
                        <option value="3">3オクターブ</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="scaleDirection">進行方向:</label>
                    <select id="scaleDirection">
                        <option value="up">上行</option>
                        <option value="down">下行</option>
                        <option value="updown">上下行</option>
                    </select>
                </div>
            `;
            break;
            
        case 'arpeggio':
            optionsHTML = `
                <div class="form-group">
                    <label for="chordType">コードタイプ:</label>
                    <select id="chordType">
                        <option value="major">メジャー</option>
                        <option value="minor">マイナー</option>
                        <option value="major7">メジャー7th</option>
                        <option value="minor7">マイナー7th</option>
                        <option value="dominant7">ドミナント7th</option>
                        <option value="diminished">ディミニッシュ</option>
                        <option value="augmented">オーギュメント</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="arpeggioOctaves">オクターブ数:</label>
                    <select id="arpeggioOctaves">
                        <option value="1">1オクターブ</option>
                        <option value="2" selected>2オクターブ</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="arpeggioDirection">進行方向:</label>
                    <select id="arpeggioDirection">
                        <option value="up">上行</option>
                        <option value="down">下行</option>
                        <option value="updown">上下行</option>
                    </select>
                </div>
            `;
            break;
            
        case 'interval':
            optionsHTML = `
                <div class="form-group">
                    <label for="intervalType">インターバルタイプ:</label>
                    <select id="intervalType">
                        <option value="2nd">2度</option>
                        <option value="3rd">3度</option>
                        <option value="4th">4度</option>
                        <option value="5th">5度</option>
                        <option value="6th">6度</option>
                        <option value="7th">7度</option>
                        <option value="octave">オクターブ</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="intervalQuality">音程の種類:</label>
                    <select id="intervalQuality">
                        <option value="perfect">完全</option>
                        <option value="major">長</option>
                        <option value="minor">短</option>
                        <option value="augmented">増</option>
                        <option value="diminished">減</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="intervalDirection">進行方向:</label>
                    <select id="intervalDirection">
                        <option value="ascending">上行</option>
                        <option value="descending">下行</option>
                        <option value="harmonic">和音</option>
                    </select>
                </div>
            `;
            break;
            
        case 'chord':
            optionsHTML = `
                <div class="form-group">
                    <label for="chordType">コードタイプ:</label>
                    <select id="chordType">
                        <option value="major">メジャー</option>
                        <option value="minor">マイナー</option>
                        <option value="major7">メジャー7th</option>
                        <option value="minor7">マイナー7th</option>
                        <option value="dominant7">ドミナント7th</option>
                        <option value="diminished">ディミニッシュ</option>
                        <option value="augmented">オーギュメント</option>
                        <option value="suspended2">サス2</option>
                        <option value="suspended4">サス4</option>
                        <option value="add9">add9</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="chordInversion">転回形:</label>
                    <select id="chordInversion">
                        <option value="root">基本形</option>
                        <option value="first">第1転回</option>
                        <option value="second">第2転回</option>
                        <option value="third">第3転回</option>
                    </select>
                </div>
            `;
            break;
            
        case 'custom':
            optionsHTML = `
                <div class="form-group">
                    <label for="exerciseTitle">練習タイトル:</label>
                    <input type="text" id="exerciseTitle" placeholder="練習のタイトルを入力">
                </div>
                <div class="form-group">
                    <label for="customContent">内容:</label>
                    <textarea id="customContent" placeholder="練習の内容を記入"></textarea>
                </div>
            `;
            break;
    }
    
    elements.exerciseOptions.innerHTML = optionsHTML;
    
    // 既存の練習項目を編集する場合は値を設定
    if (state.editingExercise && state.editingExercise.options) {
        for (const [key, value] of Object.entries(state.editingExercise.options)) {
            const element = document.getElementById(key);
            if (element) {
                element.value = value;
            }
        }
    }
}

// 練習項目を保存
function saveExercise() {
    const type = elements.exerciseType.value;
    const duration = parseInt(elements.exerciseDuration.value, 10);
    const notes = elements.exerciseNotes.value;
    
    // オプションを収集
    const options = {};
    const optionElements = elements.exerciseOptions.querySelectorAll('select, input[type="text"], textarea');
    optionElements.forEach(el => {
        if (el.id) {
            options[el.id] = el.value;
        }
    });
    
    // 練習項目のタイトルを生成
    let title = '';
    
    switch (type) {
        case 'scale':
            const scaleType = options.scaleTypeOption || 'major';
            const scaleTypeNames = {
                'major': 'メジャー',
                'minor': 'ナチュラルマイナー',
                'harmonicMinor': 'ハーモニックマイナー',
                'melodicMinor': 'メロディックマイナー',
                'pentatonic': 'ペンタトニック',
                'blues': 'ブルース'
            };
            title = `${state.currentProgram.key} ${scaleTypeNames[scaleType]} スケール`;
            break;
            
        case 'arpeggio':
            const chordType = options.chordType || 'major';
            const chordTypeNames = {
                'major': 'メジャー',
                'minor': 'マイナー',
                'major7': 'メジャー7th',
                'minor7': 'マイナー7th',
                'dominant7': 'ドミナント7th',
                'diminished': 'ディミニッシュ',
                'augmented': 'オーギュメント'
            };
            title = `${state.currentProgram.key} ${chordTypeNames[chordType]} アルペジオ`;
            break;
            
        case 'interval':
            const intervalType = options.intervalType || '3rd';
            const intervalQuality = options.intervalQuality || 'major';
            const intervalNames = {
                '2nd': '2度',
                '3rd': '3度',
                '4th': '4度',
                '5th': '5度',
                '6th': '6度',
                '7th': '7度',
                'octave': 'オクターブ'
            };
            const qualityNames = {
                'perfect': '完全',
                'major': '長',
                'minor': '短',
                'augmented': '増',
                'diminished': '減'
            };
            title = `${state.currentProgram.key} ${qualityNames[intervalQuality]}${intervalNames[intervalType]}`;
            break;
            
        case 'chord':
            const chordTypeName = options.chordType || 'major';
            const chordTypeMap = {
                'major': 'メジャー',
                'minor': 'マイナー',
                'major7': 'メジャー7th',
                'minor7': 'マイナー7th',
                'dominant7': 'ドミナント7th',
                'diminished': 'ディミニッシュ',
                'augmented': 'オーギュメント',
                'suspended2': 'サス2',
                'suspended4': 'サス4',
                'add9': 'add9'
            };
            const inversion = options.chordInversion || 'root';
            const inversionNames = {
                'root': '',
                'first': ' (第1転回)',
                'second': ' (第2転回)',
                'third': ' (第3転回)'
            };
            title = `${state.currentProgram.key} ${chordTypeMap[chordTypeName]}コード${inversionNames[inversion]}`;
            break;
            
        case 'custom':
            title = options.exerciseTitle || 'カスタム練習';
            break;
    }
    
    const exercise = {
        id: state.editingExercise ? state.editingExercise.id : Date.now().toString(),
        type,
        title,
        duration,
        notes,
        options
    };
    
    if (state.editingExercise) {
        // 既存の練習項目を更新
        const index = state.currentProgram.exercises.findIndex(ex => ex.id === state.editingExercise.id);
        if (index !== -1) {
            state.currentProgram.exercises[index] = exercise;
        }
    } else {
        // 新しい練習項目を追加
        state.currentProgram.exercises.push(exercise);
    }
    
    // UIを更新
    renderExerciseList();
    
    // モーダルを閉じる
    closeExerciseModal();
}

// 練習項目モーダルを閉じる
function closeExerciseModal() {
    elements.exerciseModal.style.display = 'none';
    state.editingExercise = null;
}

// 練習項目リストをレンダリング
function renderExerciseList() {
    elements.exerciseList.innerHTML = '';
    
    if (state.currentProgram.exercises.length === 0) {
        elements.exerciseList.innerHTML = '<p class="no-exercises">練習項目がありません。追加ボタンから追加してください。</p>';
        return;
    }
    
    state.currentProgram.exercises.forEach((exercise, index) => {
        const exerciseElement = document.createElement('div');
        exerciseElement.className = 'exercise-item';
        exerciseElement.draggable = true;
        exerciseElement.dataset.id = exercise.id;
        
        exerciseElement.innerHTML = `
            <div class="exercise-header">
                <span class="exercise-title">${exercise.title}</span>
                <div class="exercise-actions">
                    <button class="edit-exercise" data-id="${exercise.id}">編集</button>
                    <button class="delete-exercise" data-id="${exercise.id}">削除</button>
                    <span class="drag-handle">☰</span>
                </div>
            </div>
            <div class="exercise-details">
                <span>時間: ${exercise.duration}分</span>
                ${exercise.notes ? `<div class="exercise-notes">${exercise.notes}</div>` : ''}
            </div>
        `;
        
        elements.exerciseList.appendChild(exerciseElement);
        
        // 編集ボタンのイベントリスナー
        exerciseElement.querySelector('.edit-exercise').addEventListener('click', (e) => {
            e.stopPropagation();
            const exerciseId = e.target.dataset.id;
            const exercise = state.currentProgram.exercises.find(ex => ex.id === exerciseId);
            if (exercise) {
                openExerciseModal(exercise);
            }
        });
        
        // 削除ボタンのイベントリスナー
        exerciseElement.querySelector('.delete-exercise').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('この練習項目を削除しますか？')) {
                state.currentProgram.exercises = state.currentProgram.exercises.filter(ex => ex.id !== e.target.dataset.id);
                renderExerciseList();
            }
        });
        
        // ドラッグ&ドロップの設定
        setupDragAndDrop(exerciseElement);
    });
    
    // ドラッグ&ドロップの設定
    setupExerciseListDropZone();
}

// ドラッグ&ドロップの設定
function setupDragAndDrop(item) {
    item.addEventListener('dragstart', (e) => {
        item.classList.add('dragging');
        e.dataTransfer.setData('text/plain', item.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
    });
    
    item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
    });
}

// 練習リストのドロップゾーンの設定
function setupExerciseListDropZone() {
    const items = elements.exerciseList.querySelectorAll('.exercise-item');
    
    items.forEach(item => {
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingItem = document.querySelector('.dragging');
            if (draggingItem && draggingItem !== item) {
                const rect = item.getBoundingClientRect();
                const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5 ? item.nextElementSibling : item;
                elements.exerciseList.insertBefore(draggingItem, next && next !== draggingItem.nextSibling ? next : null);
            }
        });
    });
    
    // ドロップ時に順番を更新
    elements.exerciseList.addEventListener('drop', (e) => {
        e.preventDefault();
        const exerciseId = e.dataTransfer.getData('text/plain');
        const exercise = state.currentProgram.exercises.find(ex => ex.id === exerciseId);
        
        if (exercise) {
            // 現在の順番を取得
            const newOrder = [];
            const items = elements.exerciseList.querySelectorAll('.exercise-item');
            items.forEach(item => {
                const id = item.dataset.id;
                const ex = state.currentProgram.exercises.find(e => e.id === id);
                if (ex) newOrder.push(ex);
            });
            
            // 順番を更新
            state.currentProgram.exercises = newOrder;
            renderExerciseList();
        }
    });
    
    elements.exerciseList.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
}

// 再生・一時停止の切り替え
function togglePlayPause() {
    if (state.isPlaying) {
        pausePlayback();
    } else {
        startPlayback();
    }
}

// 再生を開始
function startPlayback() {
    if (state.currentProgram.exercises.length === 0) {
        alert('練習項目がありません。');
        return;
    }
    
    state.isPlaying = true;
    state.currentExerciseIndex = 0;
    state.currentBeat = 1;
    state.tickCounter = 0;
    
    // UIを更新
    elements.playPause.textContent = '⏸ 一時停止';
    elements.playPause.classList.add('active');
    
    // オーディオコンテキストを再開（必要に応じて）
    if (state.audioContext && state.audioContext.state === 'suspended') {
        state.audioContext.resume();
    }
    
    // 最初の練習項目を開始
    startCurrentExercise();
    
    // メトロノームを開始
    startMetronome();
}

// 一時停止
function pausePlayback() {
    state.isPlaying = false;
    
    // メトロノームを停止
    stopMetronome();
    
    // UIを更新
    elements.playPause.textContent = '▶ 再生';
    elements.playPause.classList.remove('active');
}

// 停止
function stopPlayback() {
    state.isPlaying = false;
    state.currentExerciseIndex = 0;
    state.currentBeat = 1;
    state.tickCounter = 0;
    
    // メトロノームを停止
    stopMetronome();
    
    // UIを更新
    elements.playPause.textContent = '▶ 再生';
    elements.playPause.classList.remove('active');
    elements.metronomeBeat.textContent = '1';
    elements.metronomeBeat.classList.remove('beat-active');
    
    // 現在の練習項目をリセット
    updateCurrentExerciseDisplay();
}

// 現在の練習項目を開始
function startCurrentExercise() {
    if (state.currentExerciseIndex >= state.currentProgram.exercises.length) {
        // すべての練習が完了
        stopPlayback();
        alert('練習が完了しました！');
        return;
    }
    
    const exercise = state.currentProgram.exercises[state.currentExerciseIndex];
    
    // 現在の練習項目を表示
    updateCurrentExerciseDisplay();
    
    // 練習時間のタイマーを設定
    if (state.exerciseTimer) {
        clearTimeout(state.exerciseTimer);
    }
    
    state.exerciseTimer = setTimeout(() => {
        // 次の練習項目に進む
        state.currentExerciseIndex++;
        startCurrentExercise();
    }, exercise.duration * 60 * 1000); // 分をミリ秒に変換
}

// 現在の練習項目の表示を更新
function updateCurrentExerciseDisplay() {
    if (state.currentExerciseIndex < state.currentProgram.exercises.length) {
        const exercise = state.currentProgram.exercises[state.currentExerciseIndex];
        elements.currentExercise.textContent = exercise.title;
        
        // 練習内容の表示を更新
        let contentHTML = `
            <p><strong>タイプ:</strong> ${getExerciseTypeName(exercise.type)}</p>
            <p><strong>時間:</strong> ${exercise.duration}分</p>
        `;
        
        if (exercise.notes) {
            contentHTML += `<div class="exercise-preview-notes"><strong>メモ:</strong> ${exercise.notes}</div>`;
        }
        
        // タイプに応じた追加情報を表示
        if (exercise.options) {
            contentHTML += '<div class="exercise-options"><strong>オプション:</strong><ul>';
            
            for (const [key, value] of Object.entries(exercise.options)) {
                const label = getOptionLabel(key);
                const displayValue = getOptionDisplayValue(key, value);
                if (label && displayValue) {
                    contentHTML += `<li>${label}: ${displayValue}</li>`;
                }
            }
            
            contentHTML += '</ul></div>';
        }
        
        elements.exerciseDisplay.innerHTML = contentHTML;
    } else {
        elements.currentExercise.textContent = '-';
        elements.exerciseDisplay.innerHTML = '<p>練習が完了しました。</p>';
    }
}

// 練習タイプの表示名を取得
function getExerciseTypeName(type) {
    const typeNames = {
        'scale': 'スケール',
        'arpeggio': 'アルペジオ',
        'interval': 'インターバル',
        'chord': 'コード',
        'custom': 'カスタム'
    };
    return typeNames[type] || type;
}

// オプションの表示ラベルを取得
function getOptionLabel(key) {
    const labels = {
        'scaleTypeOption': 'スケールタイプ',
        'scaleOctaves': 'オクターブ数',
        'scaleDirection': '進行方向',
        'chordType': 'コードタイプ',
        'arpeggioOctaves': 'オクターブ数',
        'arpeggioDirection': '進行方向',
        'intervalType': 'インターバルタイプ',
        'intervalQuality': '音程の種類',
        'intervalDirection': '進行方向',
        'chordInversion': '転回形',
        'exerciseTitle': 'タイトル',
        'customContent': '内容'
    };
    return labels[key] || key;
}

// オプションの表示値を取得
function getOptionDisplayValue(key, value) {
    if (!value) return '';
    
    // スケールタイプ
    if (key === 'scaleTypeOption') {
        const scaleTypes = {
            'major': 'メジャー',
            'minor': 'ナチュラルマイナー',
            'harmonicMinor': 'ハーモニックマイナー',
            'melodicMinor': 'メロディックマイナー',
            'pentatonic': 'ペンタトニック',
            'blues': 'ブルース'
        };
        return scaleTypes[value] || value;
    }
    
    // コードタイプ
    if (key === 'chordType') {
        const chordTypes = {
            'major': 'メジャー',
            'minor': 'マイナー',
            'major7': 'メジャー7th',
            'minor7': 'マイナー7th',
            'dominant7': 'ドミナント7th',
            'diminished': 'ディミニッシュ',
            'augmented': 'オーギュメント',
            'suspended2': 'サス2',
            'suspended4': 'サス4',
            'add9': 'add9'
        };
        return chordTypes[value] || value;
    }
    
    // 進行方向
    if (key.endsWith('Direction')) {
        const directions = {
            'up': '上行',
            'down': '下行',
            'updown': '上下行',
            'ascending': '上行',
            'descending': '下行',
            'harmonic': '和音'
        };
        return directions[value] || value;
    }
    
    // 転回形
    if (key === 'chordInversion') {
        const inversions = {
            'root': '基本形',
            'first': '第1転回',
            'second': '第2転回',
            'third': '第3転回'
        };
        return inversions[value] || value;
    }
    
    // インターバルタイプ
    if (key === 'intervalType') {
        const intervals = {
            '2nd': '2度',
            '3rd': '3度',
            '4th': '4度',
            '5th': '5度',
            '6th': '6度',
            '7th': '7度',
            'octave': 'オクターブ'
        };
        return intervals[value] || value;
    }
    
    // 音程の種類
    if (key === 'intervalQuality') {
        const qualities = {
            'perfect': '完全',
            'major': '長',
            'minor': '短',
            'augmented': '増',
            'diminished': '減'
        };
        return qualities[value] || value;
    }
    
    // オクターブ数
    if (key.endsWith('Octaves')) {
        return `${value}オクターブ`;
    }
    
    return value;
}

// メトロノームを開始
function startMetronome() {
    if (!state.audioContext) {
        console.error('オーディオコンテキストが初期化されていません');
        return;
    }
    
    // 既存のインターバルをクリア
    stopMetronome();
    
    // 次のノートの時間を現在のオーディオ時間に設定
    state.nextNoteTime = state.audioContext.currentTime + 0.05; // 少し余裕を持たせる
    
    // テンポに基づいて16分音符1つの長さを計算（秒単位）
    const secondsPerBeat = 60.0 / state.currentProgram.bpm;
    state.sixteenthNoteTime = secondsPerBeat / 4.0;
    
    // スケジューリングを開始
    state.metronomeInterval = setInterval(scheduleMetronome, 25); // 25ミリ秒ごとにスケジューリング
}

// メトロノームを停止
function stopMetronome() {
    if (state.metronomeInterval) {
        clearInterval(state.metronomeInterval);
        state.metronomeInterval = null;
    }
    
    // キューをクリア
    state.notesInQueue = [];
    state.tickCounter = 0;
    state.currentBeat = 1;
}

// メトロノームのスケジューリング
function scheduleMetronome() {
    if (!state.isPlaying) return;
    
    const currentTime = state.audioContext.currentTime;
    
    // スケジュールする時間を計算
    while (state.nextNoteTime < currentTime + state.scheduleAheadTime) {
        // 現在の拍を計算
        state.currentBeat = (state.tickCounter % state.beatsPerMeasure) + 1;
        
        // ノートをキューに追加
        state.notesInQueue.push({
            time: state.nextNoteTime,
            isMainBeat: (state.tickCounter % state.beatsPerMeasure) === 0
        });
        
        // 次のノートの時間を計算
        state.nextNoteTime += state.sixteenthNoteTime * 4; // 4分音符ごと
        state.tickCounter++;
    }
    
    // キューにあるノートを再生
    playScheduledNotes();
    
    // UIを更新
    updateMetronomeUI();
}

// スケジュールされたノートを再生
function playScheduledNotes() {
    const currentTime = state.audioContext.currentTime;
    
    // 再生すべきノートをフィルタリング
    const notesToPlay = state.notesInQueue.filter(note => note.time <= currentTime);
    
    // 再生済みのノートをキューから削除
    state.notesInQueue = state.notesInQueue.filter(note => note.time > currentTime);
    
    // ノートを再生
    notesToPlay.forEach(note => {
        playMetronomeSound(note.isMainBeat);
    });
}

// メトロノームのUIを更新
function updateMetronomeUI() {
    // 現在の拍を表示
    elements.metronomeBeat.textContent = state.currentBeat;
    
    // メインビートの場合はアニメーションを追加
    const beatElement = elements.metronomeBeat;
    if (state.currentBeat === 1) {
        beatElement.classList.add('beat-active');
        setTimeout(() => {
            beatElement.classList.remove('beat-active');
        }, 200);
    }
    
    // 小節の表示を更新
    const beats = state.beatsPerMeasure;
    let barDisplay = '';
    for (let i = 1; i <= beats; i++) {
        if (i === state.currentBeat) {
            barDisplay += '|●';
        } else {
            barDisplay += '| ';
        }
    }
    barDisplay += '|';
    elements.metronomeBar.textContent = barDisplay;
}

// 新しいプログラムを作成
function createNewProgram() {
    if (state.currentProgram.exercises.length > 0 && 
        !confirm('現在のプログラムは保存されていません。新しいプログラムを作成しますか？')) {
        return;
    }
    
    state.currentProgram = {
        name: '新しい練習プログラム',
        bpm: 120,
        timeSignature: '4/4',
        key: 'C',
        scaleType: 'major',
        exercises: []
    };
    
    updateUIFromState();
}

// プログラムをローカルストレージに保存
function saveProgramToLocalStorage() {
    try {
        const programData = JSON.stringify({
            ...state.currentProgram,
            // 一時的なプロパティを除外
            _editingExercise: undefined
        });
        
        const programName = state.currentProgram.name || '無題のプログラム';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `practice-program-${timestamp}.json`;
        
        // ダウンロード用のリンクを作成
        const blob = new Blob([programData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert(`プログラム「${programName}」を保存しました。`);
    } catch (error) {
        console.error('プログラムの保存に失敗しました:', error);
        alert('プログラムの保存に失敗しました。');
    }
}

// プログラムをローカルストレージから読み込み
function loadProgramFromLocalStorage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const programData = JSON.parse(event.target.result);
                
                // 必要なプロパティがあるか確認
                if (!programData.name || !programData.exercises) {
                    throw new Error('無効なプログラムファイルです。');
                }
                
                // プログラムを読み込み
                state.currentProgram = programData;
                updateUIFromState();
                
                alert(`プログラム「${programData.name}」を読み込みました。`);
            } catch (error) {
                console.error('プログラムの読み込みに失敗しました:', error);
                alert('プログラムの読み込みに失敗しました。ファイルが正しくないか、破損しています。');
            }
        };
        
        reader.onerror = () => {
            alert('ファイルの読み込みに失敗しました。');
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// プログラムを共有するためのリンクを生成
function shareProgram() {
    try {
        // プログラムデータを取得
        const programData = {
            ...state.currentProgram,
            // 一時的なプロパティを除外
            _editingExercise: undefined
        };
        
        // Base64エンコード
        const programString = JSON.stringify(programData);
        const base64String = btoa(unescape(encodeURIComponent(programString)));
        
        // 現在のURLを取得してクエリパラメータを追加
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('program', base64String);
        
        // クリップボードにコピー
        navigator.clipboard.writeText(currentUrl.toString()).then(() => {
            alert('共有リンクをクリップボードにコピーしました。このリンクを他の人と共有してください。');
        }).catch(err => {
            console.error('クリップボードへのコピーに失敗しました:', err);
            // コピーに失敗した場合はURLを表示
            prompt('以下のURLをコピーして共有してください:', currentUrl.toString());
        });
    } catch (error) {
        console.error('共有リンクの生成に失敗しました:', error);
        alert('共有リンクの生成に失敗しました。');
    }
}

// URLからプログラムを読み込む
function loadProgramFromUrl() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const programParam = urlParams.get('program');
        
        if (programParam) {
            // Base64デコード
            const programString = decodeURIComponent(escape(atob(programParam)));
            const programData = JSON.parse(programString);
            
            // 必要なプロパティがあるか確認
            if (programData.name && programData.exercises) {
                state.currentProgram = programData;
                updateUIFromState();
                
                // URLからパラメータを削除（オプション）
                history.replaceState({}, document.title, window.location.pathname);
                
                alert(`共有されたプログラム「${programData.name}」を読み込みました。`);
            }
        }
    } catch (error) {
        console.error('共有されたプログラムの読み込みに失敗しました:', error);
    }
}

// 状態からUIを更新
function updateUIFromState() {
    elements.programName.value = state.currentProgram.name;
    elements.bpm.value = state.currentProgram.bpm;
    elements.timeSignature.value = state.currentProgram.timeSignature;
    elements.key.value = state.currentProgram.key;
    elements.scaleType.value = state.currentProgram.scaleType;
    
    // 拍子に基づいて1小節の拍数を更新
    const [beats, noteValue] = state.currentProgram.timeSignature.split('/').map(Number);
    state.beatsPerMeasure = beats;
    
    // メトロノーム表示を更新
    updateMetronomeDisplay();
    
    // 練習項目リストを再描画
    renderExerciseList();
    
    // 現在の練習項目を更新
    updateCurrentExerciseDisplay();
}

// サンプルデータを読み込む（デモ用）
function loadSampleData() {
    state.currentProgram = {
        name: 'サンプル練習プログラム',
        bpm: 100,
        timeSignature: '4/4',
        key: 'C',
        scaleType: 'major',
        exercises: [
            {
                id: '1',
                type: 'scale',
                title: 'C メジャー スケール',
                duration: 5,
                notes: 'ゆっくりと正確に。メトロノームに合わせて。',
                options: {
                    scaleTypeOption: 'major',
                    scaleOctaves: '2',
                    scaleDirection: 'updown'
                }
            },
            {
                id: '2',
                type: 'arpeggio',
                title: 'C メジャー アルペジオ',
                duration: 5,
                notes: 'スムーズに。各音を均等に。',
                options: {
                    chordType: 'major',
                    arpeggioOctaves: '2',
                    arpeggioDirection: 'updown'
                }
            },
            {
                id: '3',
                type: 'interval',
                title: 'C 長3度',
                duration: 5,
                notes: '音程を正確に。ハーモニーを聴く。',
                options: {
                    intervalType: '3rd',
                    intervalQuality: 'major',
                    intervalDirection: 'ascending'
                }
            },
            {
                id: '4',
                type: 'chord',
                title: 'C メジャー コード',
                duration: 5,
                notes: '各転回形を練習。',
                options: {
                    chordType: 'major',
                    chordInversion: 'root'
                }
            }
        ]
    };
    
    updateUIFromState();
}

// ドキュメントの読み込みが完了したら初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ページを離れる前に確認
window.addEventListener('beforeunload', (e) => {
    if (state.isPlaying) {
        e.preventDefault();
        e.returnValue = '再生中の練習があります。ページを離れますか？';
        return e.returnValue;
    }
});

// 初期化後にURLからプログラムを読み込む
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(loadProgramFromUrl, 100);
});
