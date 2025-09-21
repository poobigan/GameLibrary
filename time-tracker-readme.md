# Activity Time Tracker 🎮

A beautiful, Steam-inspired time tracking web app that works offline and optionally syncs to your personal Google Sheet. Track how much time you spend on different activities like work, learning, hobbies, and more!

## 🌟 Features

- **Offline-First**: Works without internet, syncs when connected
- **No Backend Required**: Runs entirely in your browser
- **Personal Data**: Each user's data is completely isolated
- **Google Sheets Integration**: Optional backup to your own spreadsheet
- **Steam Library Design**: Beautiful dark theme inspired by gaming platforms
- **Real-Time Tracking**: Live timer with second precision
- **Statistics**: Daily, weekly, and all-time statistics
- **Data Export**: Download your data as JSON anytime

## 📁 Project Structure

```
time-tracker/
│
├── index.html       # Main HTML structure
├── styles.css       # Visual design and layout
├── app.js          # Application logic
├── README.md       # This file
└── SYSTEM_DESIGN.md # Technical architecture documentation
```

## 🚀 Quick Start (Local Version)

### Option 1: Direct Browser Opening (Simplest)
1. Download all three files (index.html, styles.css, app.js) to a folder
2. Double-click `index.html` to open in your browser
3. Start tracking!

### Option 2: Local Web Server (Better for Development)
```bash
# Using Python 3
python -m http.server 8000

# Using Node.js
npx http-server

# Then open http://localhost:8000
```

## 🌐 Deploying Online (Free Hosting)

### GitHub Pages (Recommended)
1. Create a new GitHub repository
2. Upload the three files (index.html, styles.css, app.js)
3. Go to Settings → Pages
4. Select "Deploy from branch" → main → root
5. Your app will be live at `https://[your-username].github.io/[repo-name]`

### Netlify
1. Put files in a folder
2. Drag folder to [netlify.com/drop](https://netlify.com/drop)
3. Get instant URL

### Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in your project folder
3. Follow prompts

## 📝 File Explanations

### index.html - The Structure
This file defines the skeleton of our app. Think of it as the blueprint of a house:

- **Header Section**: App title and sync status indicator
- **Timer Section**: The main control panel with start/stop button
- **Stats Section**: Shows today's and this week's totals
- **Activities Grid**: Steam-style cards showing each activity
- **Recent Sessions**: List of your last 10 time tracking sessions

Key learning points in this file:
- Semantic HTML5 structure
- ID and class naming conventions
- How to structure a single-page application
- Loading external scripts (Google API)

### styles.css - The Visual Design
This file makes everything look beautiful. It's like the interior design of our house:

- **CSS Variables**: Define colors and spacing once, use everywhere
- **Dark Theme**: Modern dark design that's easy on the eyes
- **Grid Layouts**: Responsive card layouts that adapt to screen size
- **Animations**: Smooth transitions and hover effects
- **Mobile Responsive**: Works on phones, tablets, and desktops

Key learning points in this file:
- CSS custom properties (variables)
- Flexbox and Grid layouts
- Responsive design with media queries
- Modern CSS techniques (gradients, shadows, animations)
- BEM-style class naming

### app.js - The Brain
This file contains all the logic. It's what makes our app actually work:

**Main Components:**
1. **State Management**: Tracks current data in `appState` object
2. **LocalStorage**: Saves data to browser storage
3. **Timer Logic**: Handles start/stop and time calculations
4. **UI Updates**: Keeps the interface in sync with data
5. **Google Sheets**: Optional cloud backup integration

Key learning points in this file:
- JavaScript event handling
- Working with LocalStorage API
- Date and time manipulation
- Dynamic DOM updates
- Async/await for API calls
- Modular function organization

## 🔧 How It Works

### Data Flow
```
User Action → JavaScript Function → Update State → Save to LocalStorage → Update UI
                                                  ↓
                                          Sync to Google Sheets (optional)
```

### LocalStorage Structure
```javascript
{
  "activities": [
    {
      "id": "unique-id",
      "name": "Machine Learning",
      "color": "#4ECDC4",
      "totalMinutes": 450
    }
  ],
  "sessions": [
    {
      "id": "unique-id",
      "activityId": "activity-id",
      "startTime": 1699564800000,
      "endTime": 1699568400000,
      "duration": 3600000
    }
  ],
  "currentSession": { /* if timer is running */ }
}
```

## 🔑 Google Sheets Setup (Optional)

### Step 1: Get Google Cloud Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable Google Sheets API
4. Create credentials (OAuth 2.0 Client ID)
5. Add your website URL to authorized JavaScript origins

### Step 2: Update app.js
Replace these lines in app.js:
```javascript
const GOOGLE_API_CONFIG = {
    apiKey: 'YOUR_API_KEY_HERE',      // ← Put your API key here
    clientId: 'YOUR_CLIENT_ID_HERE',  // ← Put your client ID here
    // ... rest stays the same
};
```

### Step 3: Create a Google Sheet
1. Create a new Google Sheet
2. Copy the sheet ID from the URL: `docs.google.com/spreadsheets/d/[SHEET_ID_HERE]/edit`
3. The app will ask for this ID when you connect

## 🎓 Learning Path

If you're using this to learn web development, here's a suggested path:

### Phase 1: Understanding (Week 1)
- [ ] Read through all three files
- [ ] Run the app locally
- [ ] Try modifying colors in CSS
- [ ] Add a new default activity in JavaScript
- [ ] Change some text in HTML

### Phase 2: Customization (Week 2)
- [ ] Add a new statistic (like "most productive day")
- [ ] Create a new color theme
- [ ] Add a feature to edit activity names
- [ ] Implement activity categories

### Phase 3: Enhancement (Week 3)
- [ ] Add data visualization (charts)
- [ ] Implement goals/targets for activities
- [ ] Add sound notifications
- [ ] Create a pomodoro timer mode

### Phase 4: Advanced (Week 4+)
- [ ] Implement full Google Sheets sync
- [ ] Add data import feature
- [ ] Create a PWA manifest for mobile install
- [ ] Add keyboard shortcuts

## 🐛 Troubleshooting

### Timer doesn't start
- Make sure you've selected an activity first
- Check browser console for errors (F12 → Console)

### Data not saving
- Check if LocalStorage is enabled in your browser
- Try a different browser
- Check available storage: `navigator.storage.estimate()`

### Google Sheets not connecting
- Ensure you've added correct API credentials
- Check that your domain is authorized in Google Cloud Console
- Look for errors in browser console

## 📚 Technologies Used

- **HTML5**: Semantic markup
- **CSS3**: Modern styling with CSS Grid and Flexbox
- **JavaScript ES6+**: Modern JavaScript features
- **LocalStorage API**: Browser storage
- **Google Sheets API v4**: Cloud sync (optional)

## 🤝 Contributing

This is a learning project! Feel free to:
- Fork and modify for your needs
- Add new features
- Improve the design
- Fix bugs
- Share your version!

## 📄 License

This project is open source and available for anyone to use, modify, and learn from.

## 💡 Ideas for Extension

- **Integrations**: Connect to Todoist, Notion, or Obsidian
- **Analytics**: Add charts and graphs with Chart.js
- **Teams**: Add multi-user support with Firebase
- **Mobile App**: Wrap with Capacitor for iOS/Android
- **Desktop App**: Package with Electron
- **AI Insights**: Analyze patterns and suggest improvements
- **Webhooks**: Send data to Zapier/IFTTT
- **Browser Extension**: Track time on specific websites

## 🎯 Why This Architecture?

We chose this serverless, client-side approach because:

1. **Zero Cost**: No server hosting fees
2. **Privacy**: Your data never leaves your devices
3. **Instant**: No network latency for actions
4. **Simple**: No backend complexity to manage
5. **Educational**: Perfect for learning web development
6. **Scalable**: Each user brings their own storage

## 📮 Questions?

If you're learning and have questions:
1. Check the SYSTEM_DESIGN.md for technical details
2. Read through the commented code in app.js
3. Experiment and break things - that's how you learn!
4. Google specific errors - they're all learning opportunities

Happy tracking! 🚀