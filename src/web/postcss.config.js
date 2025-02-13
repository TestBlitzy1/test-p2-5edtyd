/**
 * PostCSS Configuration
 * Version: 1.0.0
 * 
 * This configuration file sets up PostCSS plugins and processing options for the
 * Sales Intelligence Platform web application. It enables Tailwind CSS integration,
 * cross-browser compatibility, and modular CSS organization.
 * 
 * @requires tailwindcss@3.0.0
 * @requires autoprefixer@10.4.0
 * @requires postcss-import@15.0.0
 */

module.exports = {
  plugins: [
    // Handle @import statements in CSS files
    // Enables modular CSS organization and better code splitting
    require('postcss-import')({
      path: ['src/web/styles']
    }),

    // Core Tailwind CSS processing
    // Processes utility classes and responsive design features
    require('tailwindcss')({
      config: 'src/web/tailwind.config.js'
    }),

    // Add vendor prefixes for cross-browser compatibility
    // Supports modern flexbox, grid, and other CSS features
    require('autoprefixer')({
      flexbox: true,
      grid: true,
      browsers: [
        '>0.2%',
        'not dead',
        'not op_mini all'
      ]
    })
  ]
};