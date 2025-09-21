// UI Module - Handles all UI interactions and updates
export class UI {
    constructor() {
        // Cache DOM elements
        this.tabs = document.querySelectorAll('.tab-content');
        this.navLinks = document.querySelectorAll('.nav-links li');
        this.modal = document.getElementById('exerciseModal');
        this.closeModalBtn = document.querySelector('.close');
        this.saveExerciseBtn = document.getElementById('saveExercise');
        
        // Initialize event listeners
        this.initEventListeners();
    }
    
    /**
     * Initialize event listeners for UI elements
     */
    initEventListeners() {
        // Close modal when clicking the close button
        if (this.closeModalBtn) {
            this.closeModalBtn.addEventListener('click', () => this.closeModal());
        }
        
        // Close modal when clicking outside the modal content
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });
        
        // Handle escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('show')) {
                this.closeModal();
            }
        });
    }
    
    /**
     * Switch between application tabs
     * @param {string} tabId - The ID of the tab to switch to
     */
    switchTab(tabId) {
        // Hide all tab contents
        this.tabs.forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Show the selected tab content
        const activeTab = document.getElementById(tabId);
        if (activeTab) {
            activeTab.classList.add('active');
        }
        
        // Update active state in navigation
        this.navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('data-tab') === tabId);
        });
        
        // Dispatch custom event for tab change
        document.dispatchEvent(new CustomEvent('tabChanged', { detail: { tabId } }));
    }
    
    /**
     * Show the exercise modal
     */
    showModal() {
        if (this.modal) {
            this.modal.classList.add('show');
            document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open
            
            // Focus the first input field when modal opens
            const firstInput = this.modal.querySelector('input, select, textarea');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }
    
    /**
     * Close the exercise modal
     */
    closeModal() {
        if (this.modal) {
            this.modal.classList.remove('show');
            document.body.style.overflow = ''; // Re-enable scrolling
        }
    }
    
    /**
     * Toggle loading state for a button
     * @param {HTMLElement} button - The button element
     * @param {boolean} isLoading - Whether to show loading state
     * @param {string} [loadingText='処理中...'] - Text to show during loading
     */
    setButtonLoading(button, isLoading, loadingText = '処理中...') {
        if (!button) return;
        
        if (isLoading) {
            button.setAttribute('data-original-text', button.textContent);
            button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
            button.disabled = true;
        } else {
            const originalText = button.getAttribute('data-original-text') || '';
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }
    
    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} [type='info'] - The type of notification (info, success, warning, error)
     * @param {number} [duration=3000] - How long to show the notification in milliseconds
     */
    showToast(message, type = 'info', duration = 3000) {
        // Create toast container if it doesn't exist
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Add to container
        toastContainer.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Auto-remove after duration
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
                // Remove container if no more toasts
                if (toastContainer && toastContainer.children.length === 0) {
                    toastContainer.remove();
                }
            }, 300);
        }, duration);
    }
    
    /**
     * Toggle mobile menu
     */
    toggleMobileMenu() {
        document.querySelector('.sidebar').classList.toggle('open');
    }
    
    /**
     * Update the UI based on the current theme (light/dark mode)
     */
    updateTheme() {
        // This will be handled by our CSS variables and the prefers-color-scheme media query
        // But we can add additional theme-related logic here if needed
    }
}
