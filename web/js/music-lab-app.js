// Music Lab App Module
export const appMeta = {
    name: "MusicLab",
    title: "Music Lab - 統合音楽ツール",
    icon: "/images/icon.png"
};

export function appInit(shell) {
    const root = document.getElementById("app-root");
    if (!root) {
        console.error("MusicLab: #app-root が見つかりません");
        return;
    }
    
    // App HTML Template
    const appHTML = `
    <div class="app-container">
        <!-- サイドバーナビゲーション -->
        <nav class="sidebar">
            <div class="logo">
                <i class="fas fa-music"></i>
                <span>Music Lab</span>
            </div>
            <ul class="nav-links">
                <li class="active" data-tab="practice">
                    <i class="fas fa-dumbbell"></i>
                    <span>練習プログラム</span>
                </li>
                <li data-tab="tuner">
                    <i class="fas fa-tachometer-alt"></i>
                    <span>チューナー</span>
                </li>
                <li data-tab="analyzer">
                    <i class="fas fa-chart-line"></i>
                    <span>オーディオ解析</span>
                </li>
            </ul>
        </nav>

        <!-- メインコンテンツ -->
        <main class="main-content">
            <!-- 練習プログラムタブ -->
            <section id="practice" class="tab-content active">
                <!-- Practice content will be loaded here -->
                <div id="practice-content"></div>
            </section>

            <!-- チューナータブ -->
            <section id="tuner" class="tab-content">
                <!-- Tuner content will be loaded here -->
                <div id="tuner-content"></div>
            </section>

            <!-- オーディオ解析タブ -->
            <section id="analyzer" class="tab-content">
                <!-- Analyzer content will be loaded here -->
                <div id="analyzer-content"></div>
            </section>
        </main>
    </div>
    `;

    // Set the HTML content
    root.innerHTML = appHTML;

    // Initialize modules
    import('./modules/practice.js').then(module => {
        const practiceApp = new module.PracticeApp();
        practiceApp.init();
    });

    import('./modules/tuner.js').then(module => {
        const tunerApp = new module.TunerApp();
        tunerApp.init();
    });

    import('./modules/analyzer.js').then(module => {
        const analyzerApp = new module.AnalyzerApp();
        analyzerApp.init();
    });

    import('./modules/ui.js').then(module => {
        const ui = new module.UI();
        // Initialize UI components
        document.querySelectorAll('.nav-links li').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                ui.switchTab(tabId);
            });
        });
        ui.switchTab('practice');
    });

    // Initialize service worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful');
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }
}
