// @testing-library/jest-dom v6.1.0 - Custom matchers for DOM testing
// @testing-library/react v14.0.0 - React testing utilities 
// jest-environment-jsdom v29.0.0 - JSDOM environment for browser-like testing
import '@testing-library/jest-dom';

// Mock fetch API globally
globalThis.fetch = jest.fn();

// Mock ResizeObserver
window.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock IntersectionObserver
window.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(), 
  disconnect: jest.fn()
}));

/**
 * Mocks the window.matchMedia function for responsive design testing
 */
const mockMatchMedia = () => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // Deprecated
      removeListener: jest.fn(), // Deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

// Initialize matchMedia mock
mockMatchMedia();

// Configure Jest environment
const jestConfig = {
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  testEnvironment: 'jsdom',
  resetMocks: true,
  clearMocks: true,
  moduleNameMapper: {
    // Handle CSS/SCSS imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Handle image imports
    '\\.(gif|ttf|eot|svg|png|jpg|jpeg)$': '<rootDir>/__mocks__/fileMock.js'
  }
};

export default jestConfig;