// Main Application Module
import { PracticeApp } from './modules/practice.js';
import { TunerApp } from './modules/tuner.js';
import { AnalyzerApp } from './modules/analyzer.js';
import { UI } from './modules/ui.js';

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI components
    const ui = new UI();
    
    // Initialize app modules
    const practiceApp = new PracticeApp();
    const tunerApp = new TunerApp();
    const analyzerApp = new AnalyzerApp();
    
    // Handle tab switching
    document.querySelectorAll('.nav-links li').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            ui.switchTab(tabId);
            
            // Initialize specific app when tab is activated
            if (tabId === 'tuner') {
                tunerApp.init();
            } else if (tabId === 'analyzer') {
                analyzerApp.init();
            } else if (tabId === 'practice') {
                practiceApp.init();
            }
        });
    });
    
    // Initialize the default tab
    ui.switchTab('practice');
    practiceApp.init();
    
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
});
