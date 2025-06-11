# Cortes Water Website

A simple website template with HTML, CSS, and JavaScript.

## Project Structure

```
.
├── src/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   ├── data/
│   │   └── water-quality.json
│   └── js/
│       ├── main.js
│       ├── config.js
│       ├── data-loader.js
│       ├── visualization.js
│       └── [other visualization modules]
├── package.json
└── README.md
```

The project is organized as a modular water quality data visualization website. The `data/` folder contains the water quality dataset, while the `js/` folder is split into specialized modules for different chart types (time-series, depth profiles, correlations) and utility functions. Each visualization module handles a specific aspect of the data analysis, with `main.js` coordinating the overall application flow and `config.js` managing display settings.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

This will start a live server and open the website in your default browser. The server will automatically reload when you make changes to the files.

## Building for WordPress

To create a package that can be uploaded to WordPress:

```bash
npm run build
```

This will:
1. Create a `dist` directory
2. Copy all source files to the `dist` directory
3. Create a ZIP file at `dist/wordpress-package.zip`

You can then upload this ZIP file to your WordPress site.

## GitHub Pages Deployment

This project is configured to work with GitHub Pages. The root `index.html` automatically redirects to the built version in the `dist/` folder.

### Setup:

1. Build the project:
```bash
npm run deploy
```

2. Commit and push all files to your GitHub repository:
```bash
git add .
git commit -m "Deploy to GitHub Pages"
git push origin main
```

3. In your GitHub repository settings:
   - Go to **Settings** → **Pages**
   - Set **Source** to "Deploy from a branch"
   - Select **Branch**: `main` (or `master`)
   - Select **Folder**: `/ (root)`
   - Click **Save**

Your site will be available at `https://yourusername.github.io/your-repository-name/`

The root `index.html` will automatically redirect visitors to `dist/index.html` where your built application lives.

## Cleaning up

To remove the generated `dist` directory:

```bash
npm run clean
```