/**
 * ACTIVITY TIME TRACKER - Main Application
 * 
 * This file contains all the logic for our time tracking app.
 * It's structured as a learning project with extensive comments.
 * 
 * ARCHITECTURE OVERVIEW:
 * - Data is stored in browser's LocalStorage (works offline)
 * - Optional sync to user's own Google Sheet
 * - No backend server required
 * - Each user gets their own isolated data
 */

// ============================================
// GLOBAL STATE & CONFIGURATION
// ============================================

// This object holds our app's current state
const appState = {
    currentSession: null,      // Currently running timer session
    activities: [],             // List of all activities
    sessions: [],               // List of all completed sessions
    timerInterval: null,        // Reference to the timer update interval
    selectedColor: '#4ECDC4',   // Default color for new activities
    googleConnected: false,     // Is Google Sheets connected?
    sheetId: null,             // User's Google Sheet ID
};

// Google API Configuration
const GOOGLE_API_CONFIG = {
    apiKey: 'YOUR_API_KEY_HERE', // You'll need to get this from Google Cloud Console
    clientId: 'YOUR_CLIENT_ID_HERE', // You'll need to get this from Google Cloud Console
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4']
};

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the app when the page loads
 * This is the entry point of our application
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('App initializing...');
    
    // Load saved data from LocalStorage
    loadLocalData();
    
    // Set up event listeners
    setupEventListeners();
    
    // Update the UI with loaded data
    updateUI();
    
    // Load Google API if configured
    if (GOOGLE_API_CONFIG.apiKey !== 'YOUR_API_KEY_HERE') {
        loadGoogleAPI();
    } else {
        console.log('Google Sheets integration not configured. Using local storage only.');
        updateSyncStatus('offline');
    }
    
    // Check if a session was running when the page was closed
    checkForRunningSession();
});

/**
 * Load data from LocalStorage
 * LocalStorage persists even when the browser is closed
 */
function loadLocalData() {
    try {
        // Load activities (or use default if none exist)
        const savedActivities = localStorage.getItem('activities');
        if (savedActivities) {
            appState.activities = JSON.parse(savedActivities);
            console.log('Loaded activities:', appState.activities);
        } else {
            // Create some default activities for first-time users
            appState.activities = [
                { id: generateId(), name: 'Work', color: '#4ECDC4', totalMinutes: 0 },
                { id: generateId(), name: 'Learning', color: '#FF6B6B', totalMinutes: 0 },
                { id: generateId(), name: 'Exercise', color: '#96CEB4', totalMinutes: 0 }
            ];
            saveActivities();
        }
        
        // Load completed sessions
        const savedSessions = localStorage.getItem('sessions');
        if (savedSessions) {
            appState.sessions = JSON.parse(savedSessions);
            console.log('Loaded sessions:', appState.sessions.length);
        }
        
        // Load Google Sheets configuration
        const savedSheetId = localStorage.getItem('sheetId');
        if (savedSheetId) {
            appState.sheetId = savedSheetId;
        }
        
    } catch (error) {
        console.error('Error loading local data:', error);
        alert('Error loading saved data. Starting fresh.');
    }
}

/**
 * Set up all event listeners
 * This is where we connect user actions to functions
 */
function setupEventListeners() {
    // Timer button (Start/Stop)
    document.getElementById('timer-button').addEventListener('click', handleTimerClick);
    
    // Activity selector
    document.getElementById('activity-selector').addEventListener('change', handleActivitySelect);
    
    // Add activity form
    document.getElementById('show-add-activity').addEventListener('click', showAddActivityForm);
    document.getElementById('cancel-add').addEventListener('click', hideAddActivityForm);
    document.getElementById('save-activity').addEventListener('click', saveNewActivity);
    
    // Color picker
    document.querySelectorAll('.color-option').forEach(button => {
        button.addEventListener('click', (e) => {
            selectColor(e.target.dataset.color);
        });
    });
    
    // Google Sheets connection
    document.getElementById('connect-sheets').addEventListener('click', handleGoogleConnect);
    
    // Data management
    document.getElementById('export-data').addEventListener('click', exportData);
    document.getElementById('clear-data').addEventListener('click', confirmClearData);
    
    // Modal buttons
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    
    // Enter key on new activity input
    document.getElementById('new-activity-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveNewActivity();
        }
    });
}

// ============================================
// TIMER FUNCTIONALITY
// ============================================

/**
 * Handle timer button clicks (Start/Stop)
 */
function handleTimerClick() {
    const button = document.getElementById('timer-button');
    
    if (appState.currentSession) {
        // Timer is running, stop it
        stopTimer();
    } else {
        // Timer is stopped, start it
        const selectedActivity = document.getElementById('activity-selector').value;
        if (selectedActivity) {
            startTimer(selectedActivity);
        }
    }
}

/**
 * Start the timer for an activity
 * @param {string} activityId - The ID of the activity to track
 */
function startTimer(activityId) {
    console.log('Starting timer for activity:', activityId);
    
    // Find the activity
    const activity = appState.activities.find(a => a.id === activityId);
    if (!activity) return;
    
    // Create a new session
    appState.currentSession = {
        id: generateId(),
        activityId: activityId,
        activityName: activity.name,
        startTime: Date.now(),
        endTime: null
    };
    
    // Save to LocalStorage immediately
    localStorage.setItem('currentSession', JSON.stringify(appState.currentSession));
    
    // Update UI
    const button = document.getElementById('timer-button');
    button.textContent = 'STOP';
    button.classList.remove('start');
    button.classList.add('stop');
    
    document.getElementById('current-activity-name').textContent = activity.name;
    
    // Start updating the display every second
    appState.timerInterval = setInterval(updateTimerDisplay, 1000);
    updateTimerDisplay(); // Update immediately
    
    // Try to sync to Google Sheets
    if (appState.googleConnected) {
        syncSessionStart();
    }
}

/**
 * Stop the timer and save the session
 */
function stopTimer() {
    console.log('Stopping timer');
    
    if (!appState.currentSession) return;
    
    // Complete the session
    appState.currentSession.endTime = Date.now();
    const duration = appState.currentSession.endTime - appState.currentSession.startTime;
    appState.currentSession.duration = duration;
    
    // Add to completed sessions
    appState.sessions.push(appState.currentSession);
    
    // Update activity total time
    const activity = appState.activities.find(a => a.id === appState.currentSession.activityId);
    if (activity) {
        activity.totalMinutes += Math.round(duration / 60000); // Convert to minutes
    }
    
    // Save everything
    saveActivities();
    saveSessions();
    
    // Clear current session
    localStorage.removeItem('currentSession');
    const completedSession = appState.currentSession;
    appState.currentSession = null;
    
    // Stop the display updates
    clearInterval(appState.timerInterval);
    
    // Update UI
    const button = document.getElementById('timer-button');
    button.textContent = 'START';
    button.classList.remove('stop');
    button.classList.add('start');
    
    document.getElementById('timer-display').textContent = '00:00:00';
    document.getElementById('current-activity-name').textContent = '';
    
    // Update all displays
    updateUI();
    
    // Sync to Google Sheets
    if (appState.googleConnected) {
        syncSessionEnd(completedSession);
    }
}

/**
 * Update the timer display
 */
function updateTimerDisplay() {
    if (!appState.currentSession) return;
    
    const elapsed = Date.now() - appState.currentSession.startTime;
    const display = formatDuration(elapsed);
    document.getElementById('timer-display').textContent = display;
}

/**
 * Check if a session was running when the page was closed
 */
function checkForRunningSession() {
    const savedSession = localStorage.getItem('currentSession');
    if (savedSession) {
        appState.currentSession = JSON.parse(savedSession);
        
        // Restore the timer UI
        const button = document.getElementById('timer-button');
        button.textContent = 'STOP';
        button.classList.remove('start');
        button.classList.add('stop');
        
        const activity = appState.activities.find(a => a.id === appState.currentSession.activityId);
        if (activity) {
            document.getElementById('activity-selector').value = activity.id;
            document.getElementById('current-activity-name').textContent = activity.name;
        }
        
        // Resume the timer display
        appState.timerInterval = setInterval(updateTimerDisplay, 1000);
        updateTimerDisplay();
    }
}

// ============================================
// ACTIVITY MANAGEMENT
// ============================================

/**
 * Handle activity selection
 */
function handleActivitySelect() {
    const selectedId = document.getElementById('activity-selector').value;
    const button = document.getElementById('timer-button');
    
    if (selectedId && !appState.currentSession) {
        button.disabled = false;
        button.classList.add('start');
    } else if (!appState.currentSession) {
        button.disabled = true;
        button.classList.remove('start');
    }
}

/**
 * Show the add activity form
 */
function showAddActivityForm() {
    document.getElementById('add-activity-form').classList.remove('hidden');
    document.getElementById('show-add-activity').classList.add('hidden');
    document.getElementById('new-activity-name').focus();
    
    // Select first color by default
    selectColor(appState.selectedColor);
}

/**
 * Hide the add activity form
 */
function hideAddActivityForm() {
    document.getElementById('add-activity-form').classList.add('hidden');
    document.getElementById('show-add-activity').classList.remove('hidden');
    document.getElementById('new-activity-name').value = '';
}

/**
 * Select a color for the new activity
 */
function selectColor(color) {
    appState.selectedColor = color;
    
    // Update UI
    document.querySelectorAll('.color-option').forEach(button => {
        if (button.dataset.color === color) {
            button.classList.add('selected');
        } else {
            button.classList.remove('selected');
        }
    });
}

/**
 * Save a new activity
 */
function saveNewActivity() {
    const name = document.getElementById('new-activity-name').value.trim();
    
    if (!name) {
        alert('Please enter an activity name');
        return;
    }
    
    // Check for duplicates
    if (appState.activities.some(a => a.name.toLowerCase() === name.toLowerCase())) {
        alert('An activity with this name already exists');
        return;
    }
    
    // Create new activity
    const newActivity = {
        id: generateId(),
        name: name,
        color: appState.selectedColor,
        totalMinutes: 0,
        createdAt: Date.now()
    };
    
    // Add to state and save
    appState.activities.push(newActivity);
    saveActivities();
    
    // Update UI
    updateUI();
    hideAddActivityForm();
    
    // Sync to Google Sheets
    if (appState.googleConnected) {
        syncActivityToSheets(newActivity);
    }
}

/**
 * Delete an activity
 */
function deleteActivity(activityId) {
    if (!confirm('Delete this activity? This will also delete all its sessions.')) {
        return;
    }
    
    // Remove activity
    appState.activities = appState.activities.filter(a => a.id !== activityId);
    
    // Remove all sessions for this activity
    appState.sessions = appState.sessions.filter(s => s.activityId !== activityId);
    
    // Save changes
    saveActivities();
    saveSessions();
    
    // Update UI
    updateUI();
}

// ============================================
// UI UPDATES
// ============================================

/**
 * Update all UI elements
 */
function updateUI() {
    updateActivitySelector();
    updateActivitiesGrid();
    updateStats();
    updateRecentSessions();
}

/**
 * Update the activity selector dropdown
 */
function updateActivitySelector() {
    const selector = document.getElementById('activity-selector');
    const currentValue = selector.value;
    
    // Clear and rebuild options
    selector.innerHTML = '<option value="">Select an activity...</option>';
    
    appState.activities.forEach(activity => {
        const option = document.createElement('option');
        option.value = activity.id;
        option.textContent = activity.name;
        selector.appendChild(option);
    });
    
    // Restore selection if it still exists
    if (currentValue && appState.activities.some(a => a.id === currentValue)) {
        selector.value = currentValue;
    }
    
    // Update button state
    handleActivitySelect();
}

/**
 * Update the activities grid (Steam library style)
 */
function updateActivitiesGrid() {
    const grid = document.getElementById('activities-grid');
    
    if (appState.activities.length === 0) {
        grid.innerHTML = '<div class="empty-state">No activities yet. Add one to get started!</div>';
        return;
    }
    
    grid.innerHTML = '';
    
    appState.activities.forEach(activity => {
        // Calculate stats for this activity
        const sessions = appState.sessions.filter(s => s.activityId === activity.id);
        const lastSession = sessions[sessions.length - 1];
        
        // Create card
        const card = document.createElement('div');
        card.className = 'activity-card';
        card.innerHTML = `
            <div class="activity-color-bar" style="background: ${activity.color}"></div>
            <div class="activity-content">
                <button class="activity-delete" onclick="deleteActivity('${activity.id}')">×</button>
                <h3>${activity.name}</h3>
                <div class="activity-time">${formatMinutesToHours(activity.totalMinutes)}</div>
                <div class="activity-sessions">${sessions.length} session${sessions.length !== 1 ? 's' : ''}</div>
                <div class="activity-last">
                    ${lastSession ? 'Last: ' + getRelativeTime(lastSession.endTime) : 'No sessions yet'}
                </div>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

/**
 * Update statistics
 */
function updateStats() {
    // Calculate today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    
    const todaySessions = appState.sessions.filter(s => s.startTime >= todayTime);
    const todayMinutes = todaySessions.reduce((total, s) => total + Math.round(s.duration / 60000), 0);
    
    // Calculate this week's stats
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);
    const weekTime = weekAgo.getTime();
    
    const weekSessions = appState.sessions.filter(s => s.startTime >= weekTime);
    const weekMinutes = weekSessions.reduce((total, s) => total + Math.round(s.duration / 60000), 0);
    
    // Update UI
    document.getElementById('today-total').textContent = formatMinutesToHours(todayMinutes);
    document.getElementById('week-total').textContent = formatMinutesToHours(weekMinutes);
    document.getElementById('session-count').textContent = todaySessions.length;
}

/**
 * Update recent sessions list
 */
function updateRecentSessions() {
    const container = document.getElementById('recent-sessions');
    
    // Get last 10 sessions
    const recentSessions = [...appState.sessions]
        .sort((a, b) => b.endTime - a.endTime)
        .slice(0, 10);
    
    if (recentSessions.length === 0) {
        container.innerHTML = '<div class="empty-state">No completed sessions yet</div>';
        return;
    }
    
    container.innerHTML = '';
    
    recentSessions.forEach(session => {
        const activity = appState.activities.find(a => a.id === session.activityId);
        if (!activity) return; // Skip if activity was deleted
        
        const sessionEl = document.createElement('div');
        sessionEl.className = 'session-item';
        sessionEl.innerHTML = `
            <div class="session-info">
                <div class="session-color" style="background: ${activity.color}"></div>
                <div class="session-details">
                    <div class="session-activity">${activity.name}</div>
                    <div class="session-time">${formatDateTime(session.startTime)}</div>
                </div>
            </div>
            <div class="session-duration">${formatDuration(session.duration)}</div>
        `;
        
        container.appendChild(sessionEl);
    });
}

// ============================================
// DATA PERSISTENCE
// ============================================

/**
 * Save activities to LocalStorage
 */
function saveActivities() {
    localStorage.setItem('activities', JSON.stringify(appState.activities));
    console.log('Saved activities to LocalStorage');
}

/**
 * Save sessions to LocalStorage
 */
function saveSessions() {
    localStorage.setItem('sessions', JSON.stringify(appState.sessions));
    console.log('Saved sessions to LocalStorage');
}

// ============================================
// GOOGLE SHEETS INTEGRATION
// ============================================

/**
 * Load Google API
 */
function loadGoogleAPI() {
    console.log('Loading Google API...');
    gapi.load('client:auth2', initGoogleAPI);
}

/**
 * Initialize Google API
 */
async function initGoogleAPI() {
    try {
        await gapi.client.init({
            apiKey: GOOGLE_API_CONFIG.apiKey,
            clientId: GOOGLE_API_CONFIG.clientId,
            scope: GOOGLE_API_CONFIG.scope,
            discoveryDocs: GOOGLE_API_CONFIG.discoveryDocs
        });
        
        // Check if already signed in
        const isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();
        if (isSignedIn) {
            handleGoogleSignIn();
        }
        
    } catch (error) {
        console.error('Error initializing Google API:', error);
        updateSyncStatus('offline');
    }
}

/**
 * Handle Google Sheets connection
 */
async function handleGoogleConnect() {
    if (appState.googleConnected) {
        // Disconnect
        gapi.auth2.getAuthInstance().signOut();
        appState.googleConnected = false;
        updateSyncStatus('offline');
        document.getElementById('connect-sheets').textContent = 'Connect Google Sheets';
    } else {
        // Connect
        try {
            await gapi.auth2.getAuthInstance().signIn();
            handleGoogleSignIn();
        } catch (error) {
            console.error('Sign in failed:', error);
        }
    }
}

/**
 * Handle successful Google sign in
 */
async function handleGoogleSignIn() {
    appState.googleConnected = true;
    updateSyncStatus('online');
    document.getElementById('connect-sheets').textContent = 'Disconnect Google Sheets';
    
    // Create or get sheet
    if (!appState.sheetId) {
        await createOrGetSheet();
    }
    
    // Initial sync
    syncAllData();
}

/**
 * Create or get Google Sheet
 */
async function createOrGetSheet() {
    // For this demo, we'll prompt for a sheet ID
    // In production, you might create a new sheet automatically
    const sheetId = prompt('Enter your Google Sheet ID (or leave blank to create new):');
    
    if (sheetId) {
        appState.sheetId = sheetId;
        localStorage.setItem('sheetId', sheetId);
    } else {
        // Create new sheet (simplified for demo)
        alert('Automatic sheet creation not implemented. Please create a sheet manually and enter its ID.');
    }
}

/**
 * Sync all data to Google Sheets
 */
async function syncAllData() {
    if (!appState.googleConnected || !appState.sheetId) return;
    
    updateSyncStatus('syncing');
    
    try {
        // Sync activities and sessions
        // Implementation would go here
        console.log('Syncing to Google Sheets...');
        
        updateSyncStatus('online');
    } catch (error) {
        console.error('Sync failed:', error);
        updateSyncStatus('online'); // Still online, just failed
    }
}

/**
 * Update sync status indicator
 */
function updateSyncStatus(status) {
    const statusEl = document.getElementById('sync-status');
    const textEl = statusEl.querySelector('.sync-text');
    
    statusEl.className = 'sync-status ' + status;
    
    switch(status) {
        case 'online':
            textEl.textContent = 'Connected';
            break;
        case 'syncing':
            textEl.textContent = 'Syncing...';
            break;
        case 'offline':
        default:
            textEl.textContent = 'Local Only';
    }
}

// Placeholder functions for Google Sheets sync
function syncSessionStart() {
    console.log('Would sync session start to Google Sheets');
}

function syncSessionEnd(session) {
    console.log('Would sync session end to Google Sheets:', session);
}

function syncActivityToSheets(activity) {
    console.log('Would sync new activity to Google Sheets:', activity);
}

// ============================================
// DATA EXPORT/IMPORT
// ============================================

/**
 * Export all data as JSON
 */
function exportData() {
    const data = {
        activities: appState.activities,
        sessions: appState.sessions,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-tracker-backup-${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
}

/**
 * Confirm and clear all data
 */
function confirmClearData() {
    showModal(
        'Clear All Data',
        'This will delete all activities and sessions. This cannot be undone! Are you sure?',
        () => {
            clearAllData();
        }
    );
}

/**
 * Clear all data
 */
function clearAllData() {
    // Stop timer if running
    if (appState.currentSession) {
        stopTimer();
    }
    
    // Clear state
    appState.activities = [];
    appState.sessions = [];
    
    // Clear LocalStorage
    localStorage.removeItem('activities');
    localStorage.removeItem('sessions');
    localStorage.removeItem('currentSession');
    
    // Reset UI
    updateUI();
    closeModal();
    
    alert('All data has been cleared');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate a unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Format duration in milliseconds to HH:MM:SS
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return [hours, minutes, secs]
        .map(v => v.toString().padStart(2, '0'))
        .join(':');
}

/**
 * Format minutes to hours and minutes
 */
function formatMinutesToHours(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

/**
 * Format timestamp to readable date/time
 */
function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    
    // If today, just show time
    if (date.toDateString() === today.toDateString()) {
        return 'Today at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Otherwise show date and time
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
           ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Get relative time string
 */
function getRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days !== 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    return 'Just now';
}

/**
 * Show modal dialog
 */
function showModal(title, message, onConfirm) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    document.getElementById('modal').classList.remove('hidden');
    
    // Set up confirm handler
    document.getElementById('modal-confirm').onclick = onConfirm;
}

/**
 * Close modal dialog
 */
function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

// ============================================
// END OF APPLICATION
// ============================================

console.log('Time Tracker app loaded successfully!');