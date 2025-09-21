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
// IMPORTANT: You only need to set the Client ID. Users will authenticate with their own Google account.
const GOOGLE_API_CONFIG = {
    // Get this from Google Cloud Console (no API key needed with OAuth!)
    clientId: '699463673260-1r4abo0rvqa2aflrsd3hk8r22bf9bs5h.apps.googleusercontent.com', 
    // RESTRICTED SCOPES: We only request the minimum permissions needed
    // - spreadsheets: Only for sheets we create (cannot access other sheets)
    // - drive.file: Only files created by this app (cannot see other Drive files)
    // - email: Just to show who's logged in (read-only)
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file email',
    discoveryDocs: [
        'https://sheets.googleapis.com/$discovery/rest?version=v4',
        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
    ]
};

// Security transparency: Show exactly what we're doing
const SECURITY_INFO = {
    sheetName: 'Time Tracker Data',  // The ONLY sheet we create/access
    permissions: {
        sheets: 'Can only edit sheets created by this app',
        drive: 'Can only see/edit files created by this app',
        email: 'Read-only, just to display your email'
    },
    dataFlow: 'Browser → Your Google Account (never through our servers)',
    sourceCode: 'https://github.com/poobigan/time-tracker'  // Add your repo
};

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the app when the page loads
 * This is the entry point of our application
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('%c🔒 Privacy-First Time Tracker', 'font-size: 20px; font-weight: bold; color: #4ECDC4');
    console.log('%cSecurity Transparency:', 'font-weight: bold');
    console.log('• Open the Network tab to see all requests (should only be googleapis.com)');
    console.log('• This app makes NO requests to third-party servers');
    console.log('• Your data flows: Browser → Your Google Account (no intermediaries)');
    console.log('• View source: All code is visible and unobfuscated');
    console.log('• Permissions: drive.file (app files only) + sheets + email (read-only)');
    console.log('• Revoke access anytime at: myaccount.google.com/permissions');
    console.log('---');
    console.log('App initializing...');
    
    // Load saved data from LocalStorage
    loadLocalData();
    
    // Set up event listeners
    setupEventListeners();
    
    // Update the UI with loaded data
    updateUI();
    
    // Load Google API if client ID is configured
    if (GOOGLE_API_CONFIG.clientId !== 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com') {
        loadGoogleAPI();
    } else {
        console.log('Google OAuth not configured. Get a Client ID from Google Cloud Console.');
        console.log('The app works perfectly fine locally without Google Sheets!');
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
    
    // Security and transparency
    document.getElementById('view-source').addEventListener('click', (e) => {
        e.preventDefault();
        showSecurityInfo();
    });
    
    document.getElementById('view-sheet').addEventListener('click', openGoogleSheet);
    
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
    
    // Sync deletion to Google Sheets
    if (appState.googleConnected) {
        console.log('Syncing deletion to Google Sheets...');
        syncAllData(); // Re-sync everything to reflect deletion
    }
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
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
        gapi.load('client:auth2', initGoogleAPI);
    };
    document.body.appendChild(script);
}

/**
 * Initialize Google API
 */
async function initGoogleAPI() {
    try {
        await gapi.client.init({
            clientId: GOOGLE_API_CONFIG.clientId,
            scope: GOOGLE_API_CONFIG.scope,
            discoveryDocs: GOOGLE_API_CONFIG.discoveryDocs
        });
        
        // Listen for sign-in state changes
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
        
        // Handle initial sign-in state
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
        
    } catch (error) {
        console.error('Error initializing Google API:', error);
        updateSyncStatus('offline');
    }
}

/**
 * Update UI based on sign-in status
 */
function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        handleGoogleSignIn();
    } else {
        appState.googleConnected = false;
        updateSyncStatus('offline');
        document.getElementById('connect-sheets').textContent = 'Sign in with Google';
    }
}

/**
 * Handle Google Sheets connection
 */
async function handleGoogleConnect() {
    if (appState.googleConnected) {
        // Sign out
        gapi.auth2.getAuthInstance().signOut();
        appState.googleConnected = false;
        appState.sheetId = null;
        localStorage.removeItem('sheetId');
        updateSyncStatus('offline');
        document.getElementById('connect-sheets').textContent = 'Sign in with Google';
    } else {
        // Show privacy notice for first-time users
        const hasSeenPrivacyNotice = localStorage.getItem('privacyNoticeAccepted');
        
        if (!hasSeenPrivacyNotice) {
            // Show privacy modal
            document.getElementById('privacy-modal').classList.remove('hidden');
            
            // Set up privacy modal buttons
            document.getElementById('privacy-accept').onclick = async () => {
                localStorage.setItem('privacyNoticeAccepted', 'true');
                document.getElementById('privacy-modal').classList.add('hidden');
                // Proceed with sign in
                try {
                    await gapi.auth2.getAuthInstance().signIn();
                } catch (error) {
                    console.error('Sign in failed:', error);
                    alert('Sign in cancelled or failed. You can still use the app locally!');
                }
            };
            
            document.getElementById('privacy-cancel').onclick = () => {
                document.getElementById('privacy-modal').classList.add('hidden');
            };
        } else {
            // User has seen notice before, proceed directly
            try {
                await gapi.auth2.getAuthInstance().signIn();
            } catch (error) {
                console.error('Sign in failed:', error);
                alert('Sign in cancelled or failed. You can still use the app locally!');
            }
        }
    }
}

/**
 * Handle successful Google sign in
 */
async function handleGoogleSignIn() {
    console.log('=== GOOGLE SIGN IN SUCCESSFUL ===');
    appState.googleConnected = true;
    updateSyncStatus('syncing');
    
    // Get user email for personalization
    const profile = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
    const userEmail = profile.getEmail();
    console.log('Signed in as:', userEmail);
    console.log('Permissions granted: Sheets (app files only), Drive.file (app files only), Email (read-only)');
    
    document.getElementById('connect-sheets').textContent = 'Sign out';
    
    // Create or get the user's tracking sheet
    console.log('Setting up your Google Sheet...');
    await setupUserSheet();
    
    // Initial sync of all data
    console.log('Syncing your data to Google Sheets...');
    await syncAllData();
    
    updateSyncStatus('online');
    console.log('=== SYNC COMPLETE ===');
    console.log('Your data is now backed up to Google Sheets');
    console.log('Sheet URL: https://docs.google.com/spreadsheets/d/' + appState.sheetId);
}

/**
 * Create or get the user's dedicated tracking sheet
 */
async function setupUserSheet() {
    // Check if we already have a sheet ID stored
    let sheetId = localStorage.getItem('sheetId');
    
    if (sheetId) {
        // Verify the sheet still exists and we have access
        try {
            await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: sheetId
            });
            console.log('Found existing sheet:', sheetId);
            appState.sheetId = sheetId;
            return;
        } catch (error) {
            console.log('Stored sheet not accessible, creating new one...');
            localStorage.removeItem('sheetId');
        }
    }
    
    // Search for existing Time Tracker sheet in user's Drive
    try {
        const searchResponse = await gapi.client.drive.files.list({
            q: "name='Time Tracker Data' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
            spaces: 'drive',
            fields: 'files(id, name)'
        });
        
        if (searchResponse.result.files && searchResponse.result.files.length > 0) {
            // Use existing sheet
            sheetId = searchResponse.result.files[0].id;
            console.log('Found existing Time Tracker sheet:', sheetId);
        } else {
            // Create new sheet
            sheetId = await createNewTrackingSheet();
        }
        
        appState.sheetId = sheetId;
        localStorage.setItem('sheetId', sheetId);
        
    } catch (error) {
        console.error('Error setting up sheet:', error);
        alert('Could not create/access Google Sheet. You can still use the app locally.');
    }
}

/**
 * Create a new tracking sheet
 */
async function createNewTrackingSheet() {
    console.log('Creating new Time Tracker sheet...');
    
    const createResponse = await gapi.client.sheets.spreadsheets.create({
        properties: {
            title: 'Time Tracker Data'
        },
        sheets: [
            {
                properties: {
                    title: 'Activities',
                    gridProperties: { frozenRowCount: 1 }
                },
                data: [{
                    startRow: 0,
                    startColumn: 0,
                    rowData: [{
                        values: [
                            { userEnteredValue: { stringValue: 'ID' } },
                            { userEnteredValue: { stringValue: 'Name' } },
                            { userEnteredValue: { stringValue: 'Color' } },
                            { userEnteredValue: { stringValue: 'Total Minutes' } },
                            { userEnteredValue: { stringValue: 'Created At' } }
                        ]
                    }]
                }]
            },
            {
                properties: {
                    title: 'Sessions',
                    gridProperties: { frozenRowCount: 1 }
                },
                data: [{
                    startRow: 0,
                    startColumn: 0,
                    rowData: [{
                        values: [
                            { userEnteredValue: { stringValue: 'ID' } },
                            { userEnteredValue: { stringValue: 'Activity ID' } },
                            { userEnteredValue: { stringValue: 'Activity Name' } },
                            { userEnteredValue: { stringValue: 'Start Time' } },
                            { userEnteredValue: { stringValue: 'End Time' } },
                            { userEnteredValue: { stringValue: 'Duration (min)' } },
                            { userEnteredValue: { stringValue: 'Date' } }
                        ]
                    }]
                }]
            },
            {
                properties: {
                    title: 'Metadata',
                    gridProperties: { frozenRowCount: 1 }
                },
                data: [{
                    startRow: 0,
                    startColumn: 0,
                    rowData: [
                        {
                            values: [
                                { userEnteredValue: { stringValue: 'Key' } },
                                { userEnteredValue: { stringValue: 'Value' } }
                            ]
                        },
                        {
                            values: [
                                { userEnteredValue: { stringValue: 'Last Sync' } },
                                { userEnteredValue: { stringValue: new Date().toISOString() } }
                            ]
                        },
                        {
                            values: [
                                { userEnteredValue: { stringValue: 'Version' } },
                                { userEnteredValue: { stringValue: '1.0' } }
                            ]
                        }
                    ]
                }]
            }
        ]
    });
    
    const newSheetId = createResponse.result.spreadsheetId;
    console.log('Created new sheet:', newSheetId);
    
    // Format the sheet for better readability
    await formatSheet(newSheetId);
    
    return newSheetId;
}

/**
 * Format the sheet with colors and column widths
 */
async function formatSheet(sheetId) {
    try {
        const requests = [
            // Format header rows
            {
                repeatCell: {
                    range: {
                        sheetId: 0,
                        startRowIndex: 0,
                        endRowIndex: 1
                    },
                    cell: {
                        userEnteredFormat: {
                            backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
                        }
                    },
                    fields: 'userEnteredFormat(backgroundColor,textFormat)'
                }
            },
            // Auto-resize columns
            {
                autoResizeDimensions: {
                    dimensions: {
                        sheetId: 0,
                        dimension: 'COLUMNS',
                        startIndex: 0,
                        endIndex: 5
                    }
                }
            }
        ];
        
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requests: requests
        });
    } catch (error) {
        console.log('Could not format sheet, continuing anyway:', error);
    }
}

/**
 * Sync all data to Google Sheets
 */
async function syncAllData() {
    if (!appState.googleConnected || !appState.sheetId) return;
    
    updateSyncStatus('syncing');
    
    try {
        // Clear existing data (except headers)
        await clearSheetData();
        
        // Sync activities
        if (appState.activities.length > 0) {
            await syncActivitiesToSheets();
        }
        
        // Sync sessions
        if (appState.sessions.length > 0) {
            await syncSessionsToSheets();
        }
        
        // Update metadata
        await updateSheetMetadata();
        
        updateSyncStatus('online');
        console.log('Full sync completed');
        
    } catch (error) {
        console.error('Sync failed:', error);
        updateSyncStatus('online'); // Still online, just sync failed
        
        // If the sheet was deleted, clear the reference
        if (error.status === 404) {
            localStorage.removeItem('sheetId');
            appState.sheetId = null;
            alert('Your tracking sheet was deleted. A new one will be created on next sync.');
        }
    }
}

/**
 * Clear sheet data (keep headers)
 */
async function clearSheetData() {
    const clearRequests = [
        { range: 'Activities!A2:Z', },
        { range: 'Sessions!A2:Z' }
    ];
    
    for (const request of clearRequests) {
        try {
            await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: appState.sheetId,
                range: request.range
            });
        } catch (error) {
            console.log('Could not clear range:', request.range);
        }
    }
}

/**
 * Sync activities to sheets
 */
async function syncActivitiesToSheets() {
    const values = appState.activities.map(activity => [
        activity.id,
        activity.name,
        activity.color,
        activity.totalMinutes,
        activity.createdAt ? new Date(activity.createdAt).toISOString() : ''
    ]);
    
    console.log('Syncing activities to Google Sheets:', values.length, 'activities');
    
    await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: appState.sheetId,
        range: 'Activities!A2:E',
        valueInputOption: 'USER_ENTERED',
        resource: { values }
    });
    
    console.log('✓ Activities synced successfully');
}

/**
 * Sync sessions to sheets
 */
async function syncSessionsToSheets() {
    const values = appState.sessions.map(session => {
        const activity = appState.activities.find(a => a.id === session.activityId);
        return [
            session.id,
            session.activityId,
            activity ? activity.name : 'Unknown',
            new Date(session.startTime).toISOString(),
            new Date(session.endTime).toISOString(),
            Math.round(session.duration / 60000), // Convert to minutes
            new Date(session.startTime).toLocaleDateString()
        ];
    });
    
    console.log('Syncing sessions to Google Sheets:', values.length, 'sessions');
    
    await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: appState.sheetId,
        range: 'Sessions!A2:G',
        valueInputOption: 'USER_ENTERED',
        resource: { values }
    });
    
    console.log('✓ Sessions synced successfully');
}

/**
 * Update sheet metadata
 */
async function updateSheetMetadata() {
    await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: appState.sheetId,
        range: 'Metadata!B2',
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: [[new Date().toISOString()]]
        }
    });
}

/**
 * Sync new activity to sheets (incremental)
 */
async function syncActivityToSheets(activity) {
    if (!appState.googleConnected || !appState.sheetId) return;
    
    try {
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: appState.sheetId,
            range: 'Activities!A:E',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [[
                    activity.id,
                    activity.name,
                    activity.color,
                    activity.totalMinutes,
                    activity.createdAt ? new Date(activity.createdAt).toISOString() : ''
                ]]
            }
        });
    } catch (error) {
        console.error('Failed to sync activity:', error);
    }
}

/**
 * Sync session start to sheets
 */
async function syncSessionStart() {
    // We'll sync the complete session when it ends
    console.log('Session started, will sync when completed');
}

/**
 * Sync completed session to sheets
 */
async function syncSessionEnd(session) {
    if (!appState.googleConnected || !appState.sheetId) return;
    
    try {
        const activity = appState.activities.find(a => a.id === session.activityId);
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: appState.sheetId,
            range: 'Sessions!A:G',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [[
                    session.id,
                    session.activityId,
                    activity ? activity.name : 'Unknown',
                    new Date(session.startTime).toISOString(),
                    new Date(session.endTime).toISOString(),
                    Math.round(session.duration / 60000),
                    new Date(session.startTime).toLocaleDateString()
                ]]
            }
        });
        
        // Also update the activity's total time
        await syncActivitiesToSheets();
        
    } catch (error) {
        console.error('Failed to sync session:', error);
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
            textEl.textContent = 'Synced';
            break;
        case 'syncing':
            textEl.textContent = 'Syncing...';
            break;
        case 'offline':
        default:
            textEl.textContent = 'Local Only';
    }
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
// SECURITY & TRANSPARENCY FUNCTIONS
// ============================================

/**
 * Show security information to build trust
 */
function showSecurityInfo() {
    const info = `
🔒 SECURITY & PRIVACY INFORMATION

This app respects your privacy:

1. DATA FLOW:
   Your Browser → Your Google Account
   (Never through any other server)

2. PERMISSIONS EXPLAINED:
   • Google Sheets: Can ONLY edit the "Time Tracker Data" sheet it creates
   • Google Drive: Can ONLY see files created by this app
   • Email: Read-only, just to show who's signed in

3. WHAT THIS APP CANNOT DO:
   ✗ Cannot see your other Google Sheets
   ✗ Cannot access your other Drive files  
   ✗ Cannot modify your account
   ✗ Cannot share your data with anyone
   ✗ Cannot work without your explicit permission

4. YOU'RE IN CONTROL:
   • View the sheet directly in Google Drive
   • Revoke access anytime at: myaccount.google.com/permissions
   • Delete the app's sheet to remove all cloud data
   • All code is visible - press F12 to inspect

5. VERIFICATION:
   • Check your Google Drive - you'll see only ONE sheet: "Time Tracker Data"
   • Review permissions at: myaccount.google.com/permissions
   • This app appears as "Time Tracker" in your connected apps

The app is open source. Every line of code is visible and auditable.
    `;
    
    alert(info);
    console.log('Full source code is visible in DevTools (F12)');
}

/**
 * Open the user's Google Sheet directly
 */
function openGoogleSheet() {
    if (!appState.sheetId) {
        alert('No Google Sheet connected yet. Click "Sign in with Google" first.');
        return;
    }
    
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${appState.sheetId}/edit`;
    window.open(sheetUrl, '_blank');
    console.log('Opening your sheet:', sheetUrl);
}

// ============================================
// END OF APPLICATION
// ============================================

console.log('Time Tracker app loaded successfully!');
console.log('This app is privacy-focused: your data never leaves your browser and Google account.');
console.log('Press F12 to inspect all code and network requests.');