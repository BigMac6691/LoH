/**
 * HomePage - Main home page after login with sidebar menu and main content area
 */
import { UTClock } from './components/UTClock.js';
import { PlayerProfileView } from './components/PlayerProfileView.js';
import { NewsEventsView } from './components/NewsEventsView.js';
import { GamesPlayingList } from './components/GamesPlayingList.js';
import { GamesAvailableList } from './components/GamesAvailableList.js';
import { RulesView } from './components/RulesView.js';
import { ManageGamesView } from './components/ManageGamesView.js';
import { UserManagerView } from './components/UserManagerView.js';
import { ManageNewsEventsView } from './components/ManageNewsEventsView.js';
import { CreateGameView } from './components/CreateGameView.js';
import { UIController } from './UIController.js';

export class HomePage {
  constructor() {
    this.container = null;
    this.header = null;
    this.sidebar = null;
    this.mainContent = null;
    this.statusComponent = null;
    this.utcClock = null;
    this.currentView = null;
    this.currentViewInstance = null;
    this.uiController = null;
    this.userRole = localStorage.getItem('user_role') || 'player';
    this.displayName = localStorage.getItem('user_display_name') || localStorage.getItem('user_email') || 'Commander';
    this.emailVerified = localStorage.getItem('user_email_verified') === 'true';
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
   * Refresh header (updates role from localStorage)
   */
  refreshHeader() {
    // Update role from localStorage
    this.userRole = localStorage.getItem('user_role') || 'player';
    this.displayName = localStorage.getItem('user_display_name') || localStorage.getItem('user_email') || 'Commander';
    
    // Update role badge if header exists
    if (this.header) {
      const roleBadge = this.header.querySelector('.role-badge');
      if (roleBadge) {
        roleBadge.className = `role-badge role-${this.userRole}`;
        roleBadge.textContent = this.userRole;
      }
      const playerName = this.header.querySelector('.player-name');
      if (playerName) {
        playerName.textContent = this.escapeHtml(this.displayName);
      }
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
    
    // Create status component at the bottom
    this.createStatusComponent();
    this.mainContent.appendChild(this.statusComponent);
    
    body.appendChild(this.mainContent);
    
    this.container.appendChild(body);
  }

  /**
   * Refresh sidebar menu (updates role and emailVerified from localStorage)
   */
  refreshSidebar() {
    // Update role and emailVerified from localStorage
    this.userRole = localStorage.getItem('user_role') || 'player';
    this.emailVerified = localStorage.getItem('user_email_verified') === 'true';
    
    // Recreate the sidebar
    if (this.sidebar) {
      const currentView = this.sidebar.querySelector('.menu-item.active')?.getAttribute('data-view');
      this.createSidebar();
      // Restore active menu item if it still exists
      if (currentView) {
        const menuItem = this.sidebar.querySelector(`[data-view="${currentView}"]`);
        if (menuItem) {
          this.setActiveMenuItem(currentView);
        } else {
          // If the current view is no longer available, default to news-events
          this.setActiveMenuItem('news-events');
          this.showView('news-events');
        }
      }
    }
  }

  /**
   * Create sidebar menu
   */
  createSidebar() {
    // If sidebar already exists, clear it
    if (this.sidebar) {
      this.sidebar.innerHTML = '';
    } else {
      this.sidebar = document.createElement('div');
      this.sidebar.className = 'home-sidebar';
    }
    
    const menuItems = [
      { id: 'player-profile', label: 'Player Profile', icon: '👤', roles: ['visitor', 'player', 'sponsor', 'admin', 'owner'] },
      { id: 'news-events', label: 'News and Events', icon: '📰', roles: ['visitor', 'player', 'sponsor', 'admin', 'owner'] },
      { id: 'rules', label: 'Rules/Instructions', icon: '📖', roles: ['visitor', 'player', 'sponsor', 'admin', 'owner'] },
      // Game-related items require verified email (not visitor)
      { id: 'games-playing', label: 'Games Playing', icon: '🎮', roles: ['player', 'sponsor', 'admin', 'owner'], requiresVerified: true },
      { id: 'games-available', label: 'Games Available', icon: '🔍', roles: ['player', 'sponsor', 'admin', 'owner'], requiresVerified: true },
      { id: 'create-game', label: 'Create Game', icon: '✨', roles: ['sponsor', 'admin', 'owner'], requiresVerified: true },
      { id: 'manage-games', label: 'Manage Games', icon: '⚙️', roles: ['sponsor', 'admin', 'owner'], requiresVerified: true },
      { id: 'user-manager', label: 'User Manager', icon: '👥', roles: ['admin', 'owner'] },
      { id: 'manage-news-events', label: 'Manage News and Events', icon: '✏️', roles: ['admin', 'owner'] },
    ];

    const menuHtml = menuItems
      .filter(item => {
        // Check role access
        if (!item.roles.includes(this.userRole)) {
          return false;
        }
        // Check if verified email is required
        // Hide game-related items for visitors OR any unverified users (regardless of role)
        // This ensures all users verify their email before accessing games
        if (item.requiresVerified && (this.userRole === 'visitor' || !this.emailVerified)) {
          return false;
        }
        return true;
      })
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
   * Create status component at the bottom of main content
   */
  createStatusComponent() {
    this.statusComponent = document.createElement('div');
    this.statusComponent.className = 'home-status-component';
    this.statusComponent.innerHTML = '<div class="status-messages"></div>';
  }

  /**
   * Post a message to the status component
   * @param {string} message - Message to display
   * @param {string} type - Message type: 'info', 'success', 'error', 'warning' (default: 'info')
   */
  postStatusMessage(message, type = 'info') {
    if (!this.statusComponent) return;
    
    const messagesContainer = this.statusComponent.querySelector('.status-messages');
    if (!messagesContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `status-message status-${type}`;
    
    // Format timestamp
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    messageDiv.innerHTML = `<span class="status-time">[${timeStr}]</span> <span class="status-text">${this.escapeHtml(message)}</span>`;
    
    messagesContainer.appendChild(messageDiv);
    
    // Auto-scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Auto-remove old messages after 30 seconds (keep last 10 messages)
    setTimeout(() => {
      const messages = messagesContainer.querySelectorAll('.status-message');
      if (messages.length > 10) {
        messages[0].remove();
      }
    }, 30000);
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

    // Find or create view container (preserve status component)
    let viewContainer = this.mainContent.querySelector('.view-container');
    if (!viewContainer) {
      viewContainer = document.createElement('div');
      viewContainer.className = 'view-container';
      // Insert before status component
      if (this.statusComponent && this.statusComponent.parentNode) {
        this.mainContent.insertBefore(viewContainer, this.statusComponent);
      } else {
        this.mainContent.appendChild(viewContainer);
      }
    } else {
      // Clear existing view content
      viewContainer.innerHTML = '';
    }

    switch (viewId) {
      case 'player-profile':
        this.currentViewInstance = new PlayerProfileView(this);
        viewContainer.appendChild(this.currentViewInstance.getContainer());
        break;

      case 'news-events':
        this.currentViewInstance = new NewsEventsView(this);
        viewContainer.appendChild(this.currentViewInstance.getContainer());
        break;

      case 'games-playing':
        this.currentViewInstance = new GamesPlayingList(this);
        viewContainer.appendChild(this.currentViewInstance.getContainer());
        break;

      case 'games-available':
        this.currentViewInstance = new GamesAvailableList(this);
        viewContainer.appendChild(this.currentViewInstance.getContainer());
        break;

      case 'rules':
        this.currentViewInstance = new RulesView(this);
        viewContainer.appendChild(this.currentViewInstance.getContainer());
        break;

      case 'create-game':
        // Show CreateGameView for game creation
        this.currentViewInstance = new CreateGameView(this);
        viewContainer.appendChild(this.currentViewInstance.getContainer());
        break;

      case 'manage-games':
        this.currentViewInstance = new ManageGamesView(this);
        viewContainer.appendChild(this.currentViewInstance.getContainer());
        break;

      case 'user-manager':
        this.currentViewInstance = new UserManagerView(this);
        viewContainer.appendChild(this.currentViewInstance.getContainer());
        break;

      case 'manage-news-events':
        this.currentViewInstance = new ManageNewsEventsView(this);
        viewContainer.appendChild(this.currentViewInstance.getContainer());
        break;

      default:
        console.warn('Unknown view:', viewId);
    }
  }

  /**
   * Show UIController for game creation
   */
  showUIController() {
    console.log('showUIController called');
    if (!this.uiController) {
      console.log('Creating new UIController');
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
      console.log('Panel exists, showing it');
      this.uiController.panel.style.display = 'block';
    } else {
      console.log('Panel does not exist, calling showPanel()');
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
    this.statusComponent = null;
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
