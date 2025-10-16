/**
 * Unified Navigation Bar
 * Combines all navigation items (Signal Management, Telegram, Profile, etc.) into a single navbar
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
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                            </svg>
                            <span>DTI Backtest</span>
                        </a>

                        <a href="/trades.html" class="nav-item ${currentPage === 'trades.html' ? 'active' : ''}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                            </svg>
                            <span>Signal Management</span>
                            <span class="nav-badge" id="nav-trades-count">0</span>
                        </a>

                        <a href="/portfolio-backtest.html" class="nav-item ${currentPage === 'portfolio-backtest.html' ? 'active' : ''}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="20" x2="18" y2="10"></line>
                                <line x1="12" y1="20" x2="12" y2="4"></line>
                                <line x1="6" y1="20" x2="6" y2="14"></line>
                            </svg>
                            <span>Backtested Chart</span>
                        </a>

                        <a href="/telegram-subscribe.html" class="nav-item ${currentPage === 'telegram-subscribe.html' ? 'active' : ''}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                            <span>Telegram Alerts</span>
                        </a>

                        <a href="/pricing.html" class="nav-item ${currentPage === 'pricing.html' ? 'active' : ''}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                                <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            <span>Pricing</span>
                        </a>

                        ${user.isAdmin ? `
                        <a href="/admin-portal.html" class="nav-item admin-link ${currentPage === 'admin-portal.html' ? 'active' : ''}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="3"/>
                                <path d="M12 1v6m0 6v6"/>
                            </svg>
                            <span>Admin Portal</span>
                        </a>
                        ` : ''}
                    </div>

                    <!-- User Profile Dropdown (Desktop) -->
                    <div class="navbar-user">
                        <button class="user-menu-btn" id="userMenuBtn">
                            <img src="${user.picture}" alt="${user.name}" class="user-avatar">
                            <span class="user-name">${user.name.split(' ')[0]}</span>
                            <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
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
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                    <circle cx="12" cy="7" r="4"/>
                                </svg>
                                My Account
                            </a>
                            <a href="/logout" class="dropdown-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                                    <polyline points="16 17 21 12 16 7"/>
                                    <line x1="21" y1="12" x2="9" y2="12"/>
                                </svg>
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
                    <button class="drawer-close" id="drawerClose">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="drawer-nav">
                    <a href="/index.html" class="drawer-nav-item ${currentPage === 'index.html' ? 'active' : ''}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                        </svg>
                        <span>DTI Backtest</span>
                    </a>
                    <a href="/trades.html" class="drawer-nav-item ${currentPage === 'trades.html' ? 'active' : ''}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                        </svg>
                        <span>Signal Management</span>
                        <span class="drawer-badge" id="drawer-trades-count">0</span>
                    </a>
                    <a href="/portfolio-backtest.html" class="drawer-nav-item ${currentPage === 'portfolio-backtest.html' ? 'active' : ''}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="20" x2="18" y2="10"></line>
                            <line x1="12" y1="20" x2="12" y2="4"></line>
                            <line x1="6" y1="20" x2="6" y2="14"></line>
                        </svg>
                        <span>Backtested Chart</span>
                    </a>
                    <a href="/telegram-subscribe.html" class="drawer-nav-item ${currentPage === 'telegram-subscribe.html' ? 'active' : ''}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span>Telegram Alerts</span>
                    </a>
                    <a href="/pricing.html" class="drawer-nav-item ${currentPage === 'pricing.html' ? 'active' : ''}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <span>Pricing</span>
                    </a>
                    ${user.isAdmin ? `
                    <a href="/admin-portal.html" class="drawer-nav-item admin-link ${currentPage === 'admin-portal.html' ? 'active' : ''}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M12 1v6m0 6v6"/>
                        </svg>
                        <span>Admin Portal</span>
                    </a>
                    ` : ''}
                    <div class="drawer-divider"></div>
                    <a href="/account.html" class="drawer-nav-item ${currentPage === 'account.html' ? 'active' : ''}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                        <span>My Account</span>
                    </a>
                    <a href="/logout" class="drawer-nav-item">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
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

    async function updateTradeCount() {
        try {
            if (typeof TradeCore !== 'undefined' && TradeCore.getActiveTrades) {
                const trades = await TradeCore.getActiveTrades();
                const count = trades.length;

                // Update both desktop and mobile badges
                const navBadge = document.getElementById('nav-trades-count');
                const drawerBadge = document.getElementById('drawer-trades-count');

                if (navBadge) {
                    navBadge.textContent = count;
                    navBadge
                }

                if (drawerBadge) {
                    drawerBadge.textContent = count;
                    drawerBadge
                }
            }
        } catch (error) {
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
