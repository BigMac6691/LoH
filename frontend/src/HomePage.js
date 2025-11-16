/**
 * HomePage - Main home page after login with sidebar menu and main content area
 */
import { UTClock } from './components/UTClock.js';
import { NewsEventsView } from './components/NewsEventsView.js';
import { GamesPlayingList } from './components/GamesPlayingList.js';
import { GamesAvailableList } from './components/GamesAvailableList.js';
import { RulesView } from './components/RulesView.js';
import { ManageGamesView } from './components/ManageGamesView.js';
import { UserManagerView } from './components/UserManagerView.js';
import { UIController } from './UIController.js';

export class HomePage {
  constructor() {
    this.container = null;
    this.header = null;
    this.sidebar = null;
    this.mainContent = null;
    this.utcClock = null;
    this.currentView = null;
    this.currentViewInstance = null;
    this.uiController = null;
    this.userRole = localStorage.getItem('user_role') || 'player';
    this.displayName = localStorage.getItem('user_display_name') || localStorage.getItem('user_email') || 'Commander';
  }

  /**
   * Initialize and show the home page
   */
  init() {
    this.createHomePage();
    this.show();
    // Show News and Events by default
    this.showView('news-events');
    // Set active menu item
    this.setActiveMenuItem('news-events');
  }

  /**
   * Create the home page DOM structure
   */
  createHomePage() {
    this.container = document.createElement('div');
    this.container.id = 'home-page';
    this.container.className = 'home-page';
    
    // Create header
    this.createHeader();
    
    // Create body with sidebar and main content
    this.createBody();
    
    document.body.appendChild(this.container);
    
    // Initialize UTC clock
    const clockElement = this.header.querySelector('.utc-clock');
    if (clockElement) {
      this.utcClock = new UTClock(clockElement);
      this.utcClock.init();
    }
  }

  /**
   * Create header with UTC clock, display name, and logoff button
   */
  createHeader() {
    this.header = document.createElement('div');
    this.header.className = 'home-header';
    this.header.innerHTML = `
      <div class="header-left">
        <span class="utc-clock"></span>
      </div>
      <div class="header-center">
        <span class="player-name">${this.escapeHtml(this.displayName)}</span>
        <span class="role-badge role-${this.userRole}">${this.userRole}</span>
      </div>
      <div class="header-right">
        <button class="logoff-btn" id="logoff-btn">Logoff</button>
      </div>
    `;
    
    this.container.appendChild(this.header);
    
    // Add logoff button handler
    const logoffBtn = this.header.querySelector('#logoff-btn');
    if (logoffBtn) {
      logoffBtn.addEventListener('click', () => this.handleLogoff());
    }
  }

  /**
   * Create body with sidebar and main content area
   */
  createBody() {
    const body = document.createElement('div');
    body.className = 'home-body';
    
    // Create sidebar
    this.createSidebar();
    body.appendChild(this.sidebar);
    
    // Create main content area
    this.mainContent = document.createElement('div');
    this.mainContent.className = 'home-main-content';
    body.appendChild(this.mainContent);
    
    this.container.appendChild(body);
  }

  /**
   * Create sidebar menu
   */
  createSidebar() {
    this.sidebar = document.createElement('div');
    this.sidebar.className = 'home-sidebar';
    
    const menuItems = [
      { id: 'news-events', label: 'News and Events', icon: '📰', roles: ['player', 'sponsor', 'admin'] },
      { id: 'games-playing', label: 'Games Playing', icon: '🎮', roles: ['player', 'sponsor', 'admin'] },
      { id: 'games-available', label: 'Games Available', icon: '🔍', roles: ['player', 'sponsor', 'admin'] },
      { id: 'rules', label: 'Rules/Instructions', icon: '📖', roles: ['player', 'sponsor', 'admin'] },
      { id: 'create-game', label: 'Create Game', icon: '✨', roles: ['sponsor', 'admin'] },
      { id: 'manage-games', label: 'Manage Games', icon: '⚙️', roles: ['sponsor', 'admin'] },
      { id: 'user-manager', label: 'User Manager', icon: '👥', roles: ['admin'] },
    ];

    const menuHtml = menuItems
      .filter(item => item.roles.includes(this.userRole))
      .map(item => `
        <div class="menu-item" data-view="${item.id}">
          <span class="menu-icon">${item.icon}</span>
          <span class="menu-label">${this.escapeHtml(item.label)}</span>
        </div>
      `).join('');

    this.sidebar.innerHTML = `<div class="menu-items">${menuHtml}</div>`;

    // Add click handlers for menu items
    this.sidebar.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const viewId = e.currentTarget.getAttribute('data-view');
        this.showView(viewId);
        this.setActiveMenuItem(viewId);
      });
    });
  }

  /**
   * Set the active menu item
   */
  setActiveMenuItem(viewId) {
    if (!this.sidebar) return;
    this.sidebar.querySelectorAll('.menu-item').forEach(mi => {
      if (mi.getAttribute('data-view') === viewId) {
        mi.classList.add('active');
      } else {
        mi.classList.remove('active');
      }
    });
  }

  /**
   * Show a specific view in the main content area
   */
  showView(viewId) {
    if (!this.mainContent) return;

    // Clean up current view
    if (this.currentViewInstance) {
      if (this.currentViewInstance.dispose) {
        this.currentViewInstance.dispose();
      }
      this.currentViewInstance = null;
    }

    // Hide UIController if it was showing
    if (this.uiController && this.uiController.panel) {
      this.hideUIController();
    }

    this.currentView = viewId;

    switch (viewId) {
      case 'news-events':
        this.currentViewInstance = new NewsEventsView();
        this.mainContent.innerHTML = '';
        this.mainContent.appendChild(this.currentViewInstance.getContainer());
        break;

      case 'games-playing':
        this.currentViewInstance = new GamesPlayingList();
        this.mainContent.innerHTML = '';
        this.mainContent.appendChild(this.currentViewInstance.getContainer());
        break;

      case 'games-available':
        this.currentViewInstance = new GamesAvailableList();
        this.mainContent.innerHTML = '';
        this.mainContent.appendChild(this.currentViewInstance.getContainer());
        break;

      case 'rules':
        this.currentViewInstance = new RulesView();
        this.mainContent.innerHTML = '';
        this.mainContent.appendChild(this.currentViewInstance.getContainer());
        break;

      case 'create-game':
        // Show UIController for game creation
        this.showUIController();
        break;

      case 'manage-games':
        this.currentViewInstance = new ManageGamesView();
        this.mainContent.innerHTML = '';
        this.mainContent.appendChild(this.currentViewInstance.getContainer());
        break;

      case 'user-manager':
        this.currentViewInstance = new UserManagerView();
        this.mainContent.innerHTML = '';
        this.mainContent.appendChild(this.currentViewInstance.getContainer());
        break;

      default:
        console.warn('Unknown view:', viewId);
    }
  }

  /**
   * Show UIController for game creation
   */
  showUIController() {
    if (!this.uiController) {
      this.uiController = new UIController();
    }
    
    // Clear main content and show UIController
    if (this.mainContent) {
      this.mainContent.innerHTML = '';
      this.mainContent.style.display = 'none';
    }
    
    // UIController creates its own panel that's positioned fixed
    // We just need to make sure it's visible
    if (this.uiController.panel) {
      this.uiController.panel.style.display = 'block';
    } else {
      this.uiController.showPanel();
    }
  }

  /**
   * Hide UIController
   */
  hideUIController() {
    if (this.uiController && this.uiController.panel) {
      this.uiController.panel.style.display = 'none';
    }
    
    if (this.mainContent) {
      this.mainContent.style.display = 'flex';
    }
  }

  /**
   * Handle logoff button click
   */
  async handleLogoff() {
    const refreshToken = localStorage.getItem('refresh_token');
    
    try {
      // Call logout endpoint
      if (refreshToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
          },
          body: JSON.stringify({ refreshToken })
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
      // Continue with logout even if API call fails
    }

    // Clear localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_display_name');
    localStorage.removeItem('user_role');

    // Hide home page
    this.hide();

    // Show splash screen
    if (window.splashScreen) {
      window.splashScreen.show();
      window.splashScreen.showLoginForm();
    } else {
      // Reload page if splash screen not available
      window.location.reload();
    }
  }

  /**
   * Show the home page
   */
  show() {
    if (this.container) {
      this.container.style.display = 'flex';
    }
  }

  /**
   * Hide the home page
   */
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
    }
    
    // Hide UIController if showing
    this.hideUIController();
  }

  /**
   * Clean up
   */
  dispose() {
    if (this.utcClock) {
      this.utcClock.dispose();
    }

    if (this.currentViewInstance && this.currentViewInstance.dispose) {
      this.currentViewInstance.dispose();
    }

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    this.container = null;
    this.header = null;
    this.sidebar = null;
    this.mainContent = null;
    this.utcClock = null;
    this.currentView = null;
    this.currentViewInstance = null;
    this.uiController = null;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
