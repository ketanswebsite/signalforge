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