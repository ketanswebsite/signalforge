/**
 * Unified Navigation Bar
 * Combines all navigation items (Opportunities, Trades, Telegram, Profile, etc.) into a single navbar
 * Desktop: Horizontal navbar with all items
 * Mobile: Hamburger menu with slide-out drawer
 */

(function() {
    'use strict';

    async function initUnifiedNavbar() {
        try {
            // Get user info
            const response = await fetch('/api/user');
            const data = await response.json();

            if (data.authenticated) {
                createUnifiedNavbar(data.user);
            }
        } catch (error) {
        }
    }

    function createUnifiedNavbar(user) {
        // Check if navbar already exists
        if (document.querySelector('.unified-navbar')) return;

        // Remove old user menu if exists
        const oldUserMenu = document.querySelector('.user-menu-container');
        if (oldUserMenu) oldUserMenu.remove();

        // Get current page to highlight active link
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';

        const navbarHTML = `
            <nav class="unified-navbar">
                <div class="navbar-container">
                    <!-- Logo/Brand -->
                    <a href="/index.html" class="navbar-brand">
                        <img src="/images/logo.PNG" alt="SutrAlgo Logo" class="navbar-logo">
                        <span class="brand-text">SutrAlgo</span>
                    </a>

                    <!-- Desktop Navigation -->
                    <div class="navbar-links">
                        <a href="/index.html" class="nav-item ${currentPage === 'index.html' ? 'active' : ''}">
                            <span class="material-icons nav-icon icon-sm" aria-hidden="true">analytics</span>
                            <span>Opportunities</span>
                        </a>

                        <a href="/trades.html" class="nav-item ${currentPage === 'trades.html' ? 'active' : ''}">
                            <span class="material-icons nav-icon icon-sm" aria-hidden="true">notifications_active</span>
                            <span>Trades</span>
                            <span class="nav-badge" id="nav-trades-count">0</span>
                        </a>

                        <a href="/portfolio-backtest.html" class="nav-item ${currentPage === 'portfolio-backtest.html' ? 'active' : ''}">
                            <span class="material-icons nav-icon icon-sm" aria-hidden="true">assessment</span>
                            <span>Backtested Simulation</span>
                        </a>

                        <a href="/telegram-subscribe.html" class="nav-item ${currentPage === 'telegram-subscribe.html' ? 'active' : ''}">
                            <span class="material-icons nav-icon icon-sm" aria-hidden="true">send</span>
                            <span>Telegram Alerts</span>
                        </a>

                        <a href="/pricing.html" class="nav-item ${currentPage === 'pricing.html' ? 'active' : ''}">
                            <span class="material-icons nav-icon icon-sm" aria-hidden="true">payments</span>
                            <span>Pricing</span>
                        </a>

                        ${user.isAdmin ? `
                        <a href="/admin-portal.html" class="nav-item admin-link ${currentPage === 'admin-portal.html' ? 'active' : ''}">
                            <span class="material-icons nav-icon icon-sm" aria-hidden="true">admin_panel_settings</span>
                            <span>Admin Portal</span>
                        </a>
                        ` : ''}
                    </div>

                    <!-- User Profile Dropdown (Desktop) -->
                    <div class="navbar-user">
                        <button class="user-menu-btn" id="userMenuBtn">
                            <img src="${user.picture}" alt="${user.name}" class="user-avatar">
                            <span class="user-name">${user.name.split(' ')[0]}</span>
                            <span class="material-icons dropdown-arrow icon-xs" aria-hidden="true">expand_more</span>
                        </button>
                        <div class="user-dropdown" id="userDropdown">
                            <div class="dropdown-header">
                                <img src="${user.picture}" alt="${user.name}" class="user-avatar-large">
                                <div class="user-details">
                                    <div class="user-full-name">${user.name}</div>
                                    <div class="user-email">${user.email}</div>
                                </div>
                            </div>
                            <div class="dropdown-divider"></div>
                            <a href="/account.html" class="dropdown-item">
                                <span class="material-icons icon-xs" aria-hidden="true">account_circle</span>
                                My Account
                            </a>
                            <a href="/logout" class="dropdown-item">
                                <span class="material-icons icon-xs" aria-hidden="true">logout</span>
                                Sign out
                            </a>
                        </div>
                    </div>

                    <!-- Mobile Hamburger Button -->
                    <button class="mobile-menu-btn" id="mobileMenuBtn">
                        <span class="hamburger-line"></span>
                        <span class="hamburger-line"></span>
                        <span class="hamburger-line"></span>
                    </button>
                </div>
            </nav>

            <!-- Mobile Drawer -->
            <div class="mobile-drawer" id="mobileDrawer">
                <div class="drawer-header">
                    <div class="drawer-user">
                        <img src="${user.picture}" alt="${user.name}" class="drawer-avatar">
                        <div>
                            <div class="drawer-user-name">${user.name}</div>
                            <div class="drawer-user-email">${user.email}</div>
                        </div>
                    </div>
                    <button class="drawer-close" id="drawerClose" aria-label="Close menu">
                        <span class="material-icons icon-md" aria-hidden="true">close</span>
                    </button>
                </div>
                <div class="drawer-nav">
                    <a href="/index.html" class="drawer-nav-item ${currentPage === 'index.html' ? 'active' : ''}">
                        <span class="material-icons nav-icon icon-sm" aria-hidden="true">analytics</span>
                        <span>Opportunities</span>
                    </a>
                    <a href="/trades.html" class="drawer-nav-item ${currentPage === 'trades.html' ? 'active' : ''}">
                        <span class="material-icons nav-icon icon-sm" aria-hidden="true">notifications_active</span>
                        <span>Trades</span>
                        <span class="drawer-badge" id="drawer-trades-count">0</span>
                    </a>
                    <a href="/portfolio-backtest.html" class="drawer-nav-item ${currentPage === 'portfolio-backtest.html' ? 'active' : ''}">
                        <span class="material-icons nav-icon icon-sm" aria-hidden="true">assessment</span>
                        <span>Backtested Simulation</span>
                    </a>
                    <a href="/telegram-subscribe.html" class="drawer-nav-item ${currentPage === 'telegram-subscribe.html' ? 'active' : ''}">
                        <span class="material-icons nav-icon icon-sm" aria-hidden="true">send</span>
                        <span>Telegram Alerts</span>
                    </a>
                    <a href="/pricing.html" class="drawer-nav-item ${currentPage === 'pricing.html' ? 'active' : ''}">
                        <span class="material-icons nav-icon icon-sm" aria-hidden="true">payments</span>
                        <span>Pricing</span>
                    </a>
                    ${user.isAdmin ? `
                    <a href="/admin-portal.html" class="drawer-nav-item admin-link ${currentPage === 'admin-portal.html' ? 'active' : ''}">
                        <span class="material-icons nav-icon icon-sm" aria-hidden="true">admin_panel_settings</span>
                        <span>Admin Portal</span>
                    </a>
                    ` : ''}
                    <div class="drawer-divider"></div>
                    <a href="/account.html" class="drawer-nav-item ${currentPage === 'account.html' ? 'active' : ''}">
                        <span class="material-icons nav-icon icon-sm" aria-hidden="true">account_circle</span>
                        <span>My Account</span>
                    </a>
                    <a href="/logout" class="drawer-nav-item">
                        <span class="material-icons nav-icon icon-sm" aria-hidden="true">logout</span>
                        <span>Sign out</span>
                    </a>
                </div>
            </div>

            <!-- Mobile Overlay -->
            <div class="mobile-overlay" id="mobileOverlay"></div>
        `;

        // Insert navbar at the beginning of body
        document.body.insertAdjacentHTML('afterbegin', navbarHTML);

        // Setup event listeners
        setupEventListeners();

        // Update trade count if available
        updateTradeCount();

    }

    function setupEventListeners() {
        // Desktop user menu dropdown
        const userMenuBtn = document.getElementById('userMenuBtn');
        const userDropdown = document.getElementById('userDropdown');

        if (userMenuBtn && userDropdown) {
            userMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('active');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                userDropdown.classList.remove('active');
            });

            userDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Mobile menu
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const mobileDrawer = document.getElementById('mobileDrawer');
        const mobileOverlay = document.getElementById('mobileOverlay');
        const drawerClose = document.getElementById('drawerClose');

        const openMobileMenu = () => {
            mobileDrawer.classList.add('active');
            mobileOverlay.classList.add('active');
            document.body.classList.add('menu-open');
        };

        const closeMobileMenu = () => {
            mobileDrawer.classList.remove('active');
            mobileOverlay.classList.remove('active');
            document.body.classList.remove('menu-open');
        };

        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', openMobileMenu);
        }

        if (drawerClose) {
            drawerClose.addEventListener('click', closeMobileMenu);
        }

        if (mobileOverlay) {
            mobileOverlay.addEventListener('click', closeMobileMenu);
        }

        // Close mobile menu on navigation
        const drawerNavItems = document.querySelectorAll('.drawer-nav-item');
        drawerNavItems.forEach(item => {
            item.addEventListener('click', closeMobileMenu);
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeMobileMenu();
                if (userDropdown) {
                    userDropdown.classList.remove('active');
                }
            }
        });
    }

    let tradeCountRetries = 0;
    const MAX_RETRIES = 10;

    async function updateTradeCount() {
        try {
            if (typeof TradeCore !== 'undefined' && TradeCore.getActiveTrades) {
                const trades = await TradeCore.getActiveTrades();
                const count = trades ? trades.length : 0;

                // Update both desktop and mobile badges
                const navBadge = document.getElementById('nav-trades-count');
                const drawerBadge = document.getElementById('drawer-trades-count');

                if (navBadge) {
                    navBadge.textContent = count;
                    navBadge.style.display = count > 0 ? 'inline-block' : 'none';
                }

                if (drawerBadge) {
                    drawerBadge.textContent = count;
                    drawerBadge.style.display = count > 0 ? 'inline-block' : 'none';
                }

                // Reset retry counter on success
                tradeCountRetries = 0;
            } else {
                // TradeCore not ready yet, retry after a short delay
                if (tradeCountRetries < MAX_RETRIES) {
                    tradeCountRetries++;
                    setTimeout(updateTradeCount, 500);
                }
            }
        } catch (error) {
            console.error('Error updating trade count:', error);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUnifiedNavbar);
    } else {
        initUnifiedNavbar();
    }

    // Update trade count periodically
    setInterval(updateTradeCount, 30000); // Every 30 seconds
})();
