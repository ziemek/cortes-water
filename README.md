# Cortes Water Website

A simple website template with HTML, CSS, and JavaScript.

## Project Structure

```
.
├── src/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       └── main.js
├── package.json
└── README.md
```

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

## Cleaning up

To remove the generated `dist` directory:

```bash
npm run clean
```