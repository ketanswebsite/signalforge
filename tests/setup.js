/**
 * Jest Test Setup
 * Runs before each test file
 */

// Mock browser APIs
global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
};

global.sessionStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
};

// Mock fetch API
global.fetch = jest.fn();

// Mock navigator
global.navigator = {
    clipboard: {
        writeText: jest.fn(() => Promise.resolve())
    },
    userAgent: 'Mozilla/5.0'
};

// Mock window location
delete window.location;
window.location = {
    href: 'http://localhost',
    hash: '',
    reload: jest.fn()
};

// Mock Chart.js
global.Chart = jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
    update: jest.fn(),
    resize: jest.fn(),
    resetZoom: jest.fn()
}));

// Mock Canvas API
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    fillStyle: '',
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn(),
    putImageData: jest.fn(),
    createImageData: jest.fn(),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    transform: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn()
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
}));

// Mock EventSource (Server-Sent Events)
global.EventSource = jest.fn().mockImplementation(() => ({
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    close: jest.fn()
}));

// Helper to create DOM elements
global.createMockElement = (tag, attributes = {}) => {
    const element = document.createElement(tag);
    Object.keys(attributes).forEach(key => {
        element.setAttribute(key, attributes[key]);
    });
    return element;
};

// Helper to wait for async operations
global.waitFor = (callback, timeout = 1000) => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
            try {
                const result = callback();
                if (result) {
                    resolve(result);
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error('Timeout waiting for condition'));
                } else {
                    setTimeout(check, 50);
                }
            } catch (error) {
                reject(error);
            }
        };
        check();
    });
};

// Clean up after each test
afterEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Clear localStorage
    localStorage.clear();
    sessionStorage.clear();

    // Clear document body
    document.body.innerHTML = '';

    // Reset fetch
    fetch.mockClear();
});
