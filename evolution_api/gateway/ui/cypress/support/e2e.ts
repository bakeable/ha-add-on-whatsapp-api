// Cypress E2E support file
import './commands'

// Hide fetch/XHR requests from command log to reduce noise
const app = window.top
if (app && !app.document.head.querySelector('[data-hide-command-log-request]')) {
  const style = app.document.createElement('style')
  style.innerHTML = '.command-name-request, .command-name-xhr { display: none }'
  style.setAttribute('data-hide-command-log-request', '')
  app.document.head.appendChild(style)
}

// Catch uncaught exceptions
Cypress.on('uncaught:exception', (err, runnable) => {
  // Don't fail tests on React errors during development
  if (err.message.includes('Minified React error')) {
    return false
  }
  // Don't fail on Monaco editor worker loading errors (CDN/network issues in headless mode)
  if (err.message.includes('WorkerGlobalScope') || err.message.includes('monaco-editor')) {
    return false
  }
  // Don't fail on network errors for external resources
  if (err.message.includes('NetworkError') && err.message.includes('cdn.jsdelivr.net')) {
    return false
  }
  return true
})
