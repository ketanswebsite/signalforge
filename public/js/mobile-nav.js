/**
 * Mobile Navigation Handler
 * Manages hamburger menu and slide-out drawer functionality
 */

(function() {
    'use strict';
    
    // Cache DOM elements
    let hamburgerMenu = null;
    let mobileDrawer = null;
    let mobileOverlay = null;
    let drawerClose = null;
    let body = null;
    
    // Initialize mobile navigation
    function initMobileNav() {
        // Get DOM elements
        hamburgerMenu = document.getElementById('hamburger-menu');
        mobileDrawer = document.getElementById('mobile-nav-drawer');
        mobileOverlay = document.getElementById('mobile-nav-overlay');
        drawerClose = document.getElementById('drawer-close');
        body = document.body;
        
        // Check if elements exist (might not on all pages)
        if (!hamburgerMenu || !mobileDrawer || !mobileOverlay) {
            return;
        }
        
        // Add event listeners
        hamburgerMenu.addEventListener('click', toggleMobileMenu);
        mobileOverlay.addEventListener('click', closeMobileMenu);
        
        if (drawerClose) {
            drawerClose.addEventListener('click', closeMobileMenu);
        }
        
        // Close menu on window resize if open
        window.addEventListener('resize', handleResize);
        
        // Update trade count badges
        updateTradeCounts();
        
        // Listen for trade count updates
        document.addEventListener('tradeCountUpdated', updateTradeCounts);
    }
    
    // Toggle mobile menu
    function toggleMobileMenu() {
        const isOpen = mobileDrawer.classList.contains('active');
        
        if (isOpen) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    }
    
    // Open mobile menu
    function openMobileMenu() {
        hamburgerMenu.classList.add('active');
        mobileDrawer.classList.add('active');
        mobileOverlay.classList.add('active');
        body.classList.add('menu-open');
        
        // Prevent background scrolling
        const scrollY = window.scrollY;
        body.style.position = 'fixed';
        body.style.top = `-${scrollY}px`;
        body.style.width = '100%';
    }
    
    // Close mobile menu
    function closeMobileMenu() {
        hamburgerMenu.classList.remove('active');
        mobileDrawer.classList.remove('active');
        mobileOverlay.classList.remove('active');
        body.classList.remove('menu-open');
        
        // Restore scrolling
        const scrollY = body.style.top;
        body.style.position = '';
        body.style.top = '';
        body.style.width = '';
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    
    // Handle window resize
    function handleResize() {
        // Close menu if window is resized to desktop size
        if (window.innerWidth > 768 && mobileDrawer.classList.contains('active')) {
            closeMobileMenu();
        }
    }
    
    // Update trade count badges
    function updateTradeCounts() {
        // Get active trade count
        const activeTradeCount = document.getElementById('active-trades-count');
        const drawerTradeCount = document.getElementById('drawer-trades-count');
        
        if (activeTradeCount && drawerTradeCount) {
            drawerTradeCount.textContent = activeTradeCount.textContent;
            
            // Hide badge if count is 0
            if (drawerTradeCount.textContent === '0') {
                drawerTradeCount.style.display = 'none';
            } else {
                drawerTradeCount.style.display = 'inline-flex';
            }
        }
    }
    
    // Add mobile fixed action button for index.html
    function addMobileFixedAction() {
        // Only add on index.html
        if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
            return;
        }
        
        // Create fixed action button
        const fixedAction = document.createElement('a');
        fixedAction.href = 'trades.html';
        fixedAction.className = 'mobile-fixed-action';
        fixedAction.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
            <span>Signals</span>
            <span class="active-trades-badge" id="mobile-trades-count">0</span>
        `;
        
        // Only show on mobile
        if (window.innerWidth <= 768) {
            document.body.appendChild(fixedAction);
        }
        
        // Update count when main count updates
        document.addEventListener('tradeCountUpdated', function() {
            const mainCount = document.getElementById('active-trades-count');
            const mobileCount = document.getElementById('mobile-trades-count');
            if (mainCount && mobileCount) {
                mobileCount.textContent = mainCount.textContent;
                if (mobileCount.textContent === '0') {
                    mobileCount.style.display = 'none';
                } else {
                    mobileCount.style.display = 'inline-flex';
                }
            }
        });
        
        // Show/hide based on screen size
        window.addEventListener('resize', function() {
            if (window.innerWidth <= 768) {
                if (!document.querySelector('.mobile-fixed-action')) {
                    document.body.appendChild(fixedAction);
                }
            } else {
                const existing = document.querySelector('.mobile-fixed-action');
                if (existing) {
                    existing.remove();
                }
            }
        });
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initMobileNav();
            addMobileFixedAction();
        });
    } else {
        initMobileNav();
        addMobileFixedAction();
    }
})();