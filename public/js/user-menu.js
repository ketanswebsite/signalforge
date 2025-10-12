// User menu functionality
(function() {
    async function initUserMenu() {
        try {
            const response = await fetch('/api/user');
            const data = await response.json();
            
            if (data.authenticated) {
                addUserMenu(data.user);
            }
        } catch (error) {
        }
    }
    
    function addUserMenu(user) {
        // Check if menu already exists
        if (document.querySelector('.user-menu-container')) return;
        
        const menuContainer = document.createElement('div');
        menuContainer.className = 'user-menu-container';
        menuContainer.innerHTML = `
            <button class="user-menu-button" id="userMenuButton">
                <img src="${user.picture}" alt="${user.name}" class="user-avatar">
                <span class="user-name">${user.name.split(' ')[0]}</span>
                <svg class="dropdown-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>
            <div class="user-dropdown" id="userDropdown">
                <div class="user-info">
                    <img src="${user.picture}" alt="${user.name}" class="user-avatar-large">
                    <div>
                        <div class="user-full-name">${user.name}</div>
                        <div class="user-email">${user.email}</div>
                    </div>
                </div>
                <div class="dropdown-divider"></div>
                <a href="/alerts.html" class="dropdown-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    Alert Settings
                </a>
                <a href="/data-management.html" class="dropdown-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                        <path d="M2 17l10 5 10-5"></path>
                        <path d="M2 12l10 5 10-5"></path>
                    </svg>
                    Data & Privacy
                </a>
                ${user.isAdmin ? `
                <div class="dropdown-divider"></div>
                <a href="/admin-portal.html" class="dropdown-item admin-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                    Admin Portal
                </a>
                ` : ''}
                <div class="dropdown-divider"></div>
                <a href="/logout" class="dropdown-item logout-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Sign out
                </a>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .user-menu-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1001;
            }
            
            .user-menu-button {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 12px;
                background: var(--card-background);
                border: 1px solid var(--border-color);
                border-radius: 24px;
                cursor: pointer;
                font-size: 14px;
                color: var(--text-color);
                transition: all 0.2s ease;
            }
            
            .user-menu-button:hover {
                background: var(--hover-background);
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            
            .user-avatar {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                object-fit: cover;
            }
            
            .user-name {
                font-weight: 500;
            }
            
            .dropdown-icon {
                transition: transform 0.2s ease;
            }
            
            .user-menu-button.active .dropdown-icon {
                transform: rotate(180deg);
            }
            
            .user-dropdown {
                position: absolute;
                top: 100%;
                right: 0;
                margin-top: 8px;
                min-width: 280px;
                background: var(--card-background);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                opacity: 0;
                visibility: hidden;
                transform: translateY(-10px);
                transition: all 0.2s ease;
            }
            
            .user-dropdown.show {
                opacity: 1;
                visibility: visible;
                transform: translateY(0);
            }
            
            .user-info {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 16px;
            }
            
            .user-avatar-large {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                object-fit: cover;
            }
            
            .user-full-name {
                font-weight: 600;
                color: var(--text-color);
                margin-bottom: 2px;
            }
            
            .user-email {
                font-size: 13px;
                color: var(--text-secondary);
            }
            
            .dropdown-divider {
                height: 1px;
                background: var(--border-color);
                margin: 0;
            }
            
            .dropdown-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                color: var(--text-color);
                text-decoration: none;
                transition: background 0.2s ease;
            }
            
            .dropdown-item:hover {
                background: var(--hover-background);
            }
            
            .admin-item {
                color: #8b5cf6;
                font-weight: 500;
            }

            .admin-item svg {
                color: #8b5cf6;
            }

            .logout-item {
                color: var(--danger-color);
                border-radius: 0 0 11px 11px;
            }
            
            @media (max-width: 768px) {
                .user-menu-container {
                    top: 10px;
                    right: 10px;
                }
                
                .user-name {
                    display: none;
                }
                
                .user-dropdown {
                    right: -10px;
                }
            }
        `;
        document.head.appendChild(style);
        
        // Add to page
        document.body.appendChild(menuContainer);
        
        // Add interaction
        const button = document.getElementById('userMenuButton');
        const dropdown = document.getElementById('userDropdown');
        
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('show');
            
            if (isOpen) {
                dropdown.classList.remove('show');
                button.classList.remove('active');
            } else {
                dropdown.classList.add('show');
                button.classList.add('active');
            }
        });
        
        // Close on outside click
        document.addEventListener('click', () => {
            dropdown.classList.remove('show');
            button.classList.remove('active');
        });
        
        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUserMenu);
    } else {
        initUserMenu();
    }
})();