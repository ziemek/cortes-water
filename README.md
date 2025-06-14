# Cortes Water Website

A simple water quality data visualization website that displays interactive charts and analysis for lake water monitoring data, in particular for Cortes
Island. The site features time-series analysis, depth profiles, correlation charts, and Secchi disk transparency measurements to help understand water quality trends.

## Project Structure

```
.
├── src/
│   ├── index.html                      # Main HTML file
│   ├── css/
│   │   └── styles.css                  # Site styling
│   ├── data/                           # Water quality datasets
│   │   └── water-data.json
│   └── js/                             # JavaScript modules
│       ├── main.js                     # Main application coordinator
│       ├── config.js                   # Display configuration settings
│       ├── data-loader.js              # Data loading utilities
│       ├── controls-manager.js         # UI control management
│       ├── legend-manager.js           # Chart legend handling
│       ├── time-series-charts.js       # Time-based visualizations
│       ├── depth-profile-charts.js     # Depth-based charts
│       ├── horizontal-depth-charts.js  # Horizontal depth analysis
│       ├── correlation-charts.js       # Data correlation analysis
│       ├── secchi-analysis.js          # Secchi disk transparency
│       └── utils.js                    # Utility functions
├── scripts/                            # Build and data processing scripts
│   ├── merge-data.js                   # Data merging utility
│   └── convert-csv.js                  # CSV to JSON converter
├── origiinal-data/                     # Raw data and source files
├── package.json                        # Project dependencies
└── README.md
```

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm start
   ```
   This will start a live server on `http://localhost:8080` and automatically open the website in your default browser. The server will reload automatically when you make changes to any files.

3. **Build for production:**
   ```bash
   npm run build
   ```
   This creates a `dist/` folder with the production-ready files.

## Data Processing Scripts

The `scripts/` folder contains utility scripts for data processing:

- **`merge-data.js`**: Combines multiple JSON data files into a single `water-data.json` file
- **`convert-csv.js`**: Converts CSV files from water quality monitoring equipment into JSON format

These scripts are automatically run during the build process but can also be executed manually:

```bash
# Merge data files
npm run merge-data

# Convert CSV to JSON (run directly)
node scripts/convert-csv.js "Lake Name" input.csv output.json
```

## GitHub Pages Deployment

This project is automatically deployed to GitHub Pages using GitHub Actions. The deployment workflow is triggered on every push to the `main` branch and builds the site using the `npm run build` command before publishing to the `gh-pages` branch. You can view the live site at your repository's GitHub Pages URL once deployment is complete.

