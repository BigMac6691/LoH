/**
 * HomePage - Main home page after login with sidebar menu and main content area
 */
import { UTClock } from './components/UTClock.js';
import { StatusComponent } from './components/StatusComponent.js';
import { PlayerProfileView } from './components/PlayerProfileView.js';
import { NewsEventsView } from './components/NewsEventsView.js';
import { GamesPlayingList } from './components/GamesPlayingList.js';
import { GamesAvailableList } from './components/GamesAvailableList.js';
import { RulesView } from './components/RulesView.js';
import { ManageGamesView } from './components/ManageGamesView.js';
import { UserManagerView } from './components/UserManagerView.js';
import { ManageNewsEventsView } from './components/ManageNewsEventsView.js';
import { CreateGameView } from './components/CreateGameView.js';
import { RB } from './utils/RequestBuilder.js';

export class HomePage
{
   constructor()
   {
      this.container = null;
      this.header = null;
      this.sidebar = null;
      this.mainContent = null;
      this.statusComponent = new StatusComponent();
      this.utcClock = null;
      this.currentView = null;
      this.currentViewInstance = null;

      this.userRole = localStorage.getItem('user_role') || 'visitor';
      this.displayName = localStorage.getItem('user_display_name') || localStorage.getItem('user_email') || 'Commander';
      this.emailVerified = localStorage.getItem('user_email_verified') === 'true';

      this.init();
   }

   /**
    * Initialize and show the home page
    */
   init()
   {
      this.createHomePage();

      // Show News and Events by default
      this.showView('news-events');
      this.setActiveMenuItem('news-events');
   }

   /**
    * Create the home page DOM structure
    */
   createHomePage()
   {
      this.container = document.createElement('div');
      this.container.style.display = 'none';
      this.container.id = 'home-page';
      this.container.className = 'home-page';

      // Create header
      this.createHeader();

      // Create body with sidebar and main content
      this.createBody();

      document.body.appendChild(this.container);

      // Initialize UTC clock
      const clockElement = this.header.querySelector('.utc-clock');
      if (clockElement)
      {
         this.utcClock = new UTClock(clockElement);
         this.utcClock.init();
      }
   }

   /**
    * Refresh header (updates role from localStorage)
    */
   refreshHeader()
   {
      // Update role from localStorage
      this.userRole = localStorage.getItem('user_role') || 'player';
      this.displayName = localStorage.getItem('user_display_name') || localStorage.getItem('user_email') || 'Commander';

      // Update role badge if header exists
      if (this.header)
      {
         const roleBadge = this.header.querySelector('.role-badge');
         if (roleBadge)
         {
            roleBadge.className = `role-badge role-${this.userRole}`;
            roleBadge.textContent = this.userRole;
         }
         const playerName = this.header.querySelector('.player-name');
         if (playerName)
         {
            playerName.textContent = this.escapeHtml(this.displayName);
         }
      }
   }

   /**
    * Create header with UTC clock, display name, and logoff button
    */
   createHeader()
   {
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
      if (logoffBtn)
      {
         logoffBtn.addEventListener('click', () => this.handleLogoff());
      }
   }

   /**
    * Create body with sidebar and main content area
    */
   createBody()
   {
      const body = document.createElement('div');
      body.className = 'home-body';

      // Create sidebar
      this.createSidebar();
      body.appendChild(this.sidebar);

      // Create main content area
      this.mainContent = document.createElement('div');
      this.mainContent.className = 'home-main-content';

      // Add status component at the bottom
      this.mainContent.appendChild(this.statusComponent.getContainer());

      body.appendChild(this.mainContent);

      this.container.appendChild(body);
   }

   /**
    * Refresh sidebar menu (updates role and emailVerified from localStorage)
    */
   refreshSidebar()
   {
      // Update role and emailVerified from localStorage
      this.userRole = localStorage.getItem('user_role') || 'player';
      this.emailVerified = localStorage.getItem('user_email_verified') === 'true';

      // Recreate the sidebar
      if (this.sidebar)
      {
         const currentView = this.sidebar.querySelector('.menu-item.active')?.getAttribute('data-view');
         this.createSidebar();
         // Restore active menu item if it still exists
         if (currentView)
         {
            const menuItem = this.sidebar.querySelector(`[data-view="${currentView}"]`);
            if (menuItem)
            {
               this.setActiveMenuItem(currentView);
            }
            else
            {
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
   createSidebar()
   {
      // If sidebar already exists, clear it
      if (this.sidebar)
      {
         this.sidebar.innerHTML = '';
      }
      else
      {
         this.sidebar = document.createElement('div');
         this.sidebar.className = 'home-sidebar';
      }

      const menuItems = [
         {
            id: 'player-profile',
            label: 'Player Profile',
            icon: '👤',
            roles: ['visitor', 'player', 'sponsor', 'admin', 'owner']
         },
         {
            id: 'news-events',
            label: 'News and Events',
            icon: '📰',
            roles: ['visitor', 'player', 'sponsor', 'admin', 'owner']
         },
         {
            id: 'rules',
            label: 'Rules/Instructions',
            icon: '📖',
            roles: ['visitor', 'player', 'sponsor', 'admin', 'owner']
         },
         // Game-related items require verified email (not visitor)
         {
            id: 'games-playing',
            label: 'Games Playing',
            icon: '🎮',
            roles: ['player', 'sponsor', 'admin', 'owner'],
            requiresVerified: true
         },
         {
            id: 'games-available',
            label: 'Games Available',
            icon: '🔍',
            roles: ['player', 'sponsor', 'admin', 'owner'],
            requiresVerified: true
         },
         {
            id: 'create-game',
            label: 'Create Game',
            icon: '✨',
            roles: ['sponsor', 'admin', 'owner'],
            requiresVerified: true
         },
         {
            id: 'manage-games',
            label: 'Manage Games',
            icon: '⚙️',
            roles: ['sponsor', 'admin', 'owner'],
            requiresVerified: true
         },
         {
            id: 'user-manager',
            label: 'User Manager',
            icon: '👥',
            roles: ['admin', 'owner']
         },
         {
            id: 'manage-news-events',
            label: 'Manage News and Events',
            icon: '✏️',
            roles: ['admin', 'owner']
         },
      ];

      const menuHtml = menuItems
         .filter(item =>
         {
            // Check role access
            if (!item.roles.includes(this.userRole))
            {
               return false;
            }
            // Check if verified email is required
            // Hide game-related items for visitors OR any unverified users (regardless of role)
            // This ensures all users verify their email before accessing games
            if (item.requiresVerified && (this.userRole === 'visitor' || !this.emailVerified))
            {
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
      this.sidebar.querySelectorAll('.menu-item').forEach(item =>
      {
         item.addEventListener('click', (e) =>
         {
            const viewId = e.currentTarget.getAttribute('data-view');
            this.showView(viewId);
            this.setActiveMenuItem(viewId);
         });
      });
   }


   /**
    * Set the active menu item
    */
   setActiveMenuItem(viewId)
   {
      if (!this.sidebar) 
         return;

      this.sidebar.querySelectorAll('.menu-item').forEach(mi =>
      {
         if (mi.getAttribute('data-view') === viewId)
            mi.classList.add('active');
         else
            mi.classList.remove('active');
      });
   }

   /**
    * Show a specific view in the main content area
    */
   showView(viewId)
   {
      if (!this.mainContent) 
         return;

      // Clean up current view
      if (this.currentViewInstance)
      {
         if (this.currentViewInstance.dispose)
            this.currentViewInstance.dispose();

         this.currentViewInstance = null;
      }

      // Hide UIController if it was showing
      // if (this.uiController && this.uiController.panel)
      //    this.hideUIController();

      this.currentView = viewId;

      // Find or create view container (preserve status component)
      const statusContainer = this.statusComponent.getContainer();
      let viewContainer = this.mainContent.querySelector('.view-container');
      if (!viewContainer)
      {
         viewContainer = document.createElement('div');
         viewContainer.className = 'view-container';
         // Insert before status component
         if (statusContainer && statusContainer.parentNode)
            this.mainContent.insertBefore(viewContainer, statusContainer);
         else
            this.mainContent.appendChild(viewContainer);
      }
      else
         // Clear existing view content
         viewContainer.innerHTML = '';

      switch (viewId)
      {
         case 'player-profile':
            this.currentViewInstance = new PlayerProfileView(this.statusComponent);
            viewContainer.appendChild(this.currentViewInstance.getContainer());
            break;

         case 'news-events':
            this.currentViewInstance = new NewsEventsView(this.statusComponent);
            viewContainer.appendChild(this.currentViewInstance.getContainer());
            break;

         case 'games-playing':
            this.currentViewInstance = new GamesPlayingList(this.statusComponent);
            viewContainer.appendChild(this.currentViewInstance.getContainer());
            break;

         case 'games-available':
            this.currentViewInstance = new GamesAvailableList(this.statusComponent);
            viewContainer.appendChild(this.currentViewInstance.getContainer());
            break;

         case 'rules':
            this.currentViewInstance = new RulesView(this.statusComponent);
            viewContainer.appendChild(this.currentViewInstance.getContainer());
            break;

         case 'create-game':
            // Show CreateGameView for game creation
            this.currentViewInstance = new CreateGameView(this.statusComponent);
            viewContainer.appendChild(this.currentViewInstance.getContainer());
            break;

         case 'manage-games':
            this.currentViewInstance = new ManageGamesView(this.statusComponent);
            viewContainer.appendChild(this.currentViewInstance.getContainer());
            break;

         case 'user-manager':
            this.currentViewInstance = new UserManagerView(this.statusComponent);
            viewContainer.appendChild(this.currentViewInstance.getContainer());
            break;

         case 'manage-news-events':
            this.currentViewInstance = new ManageNewsEventsView(this.statusComponent);
            viewContainer.appendChild(this.currentViewInstance.getContainer());
            break;

         default:
            console.warn('Unknown view:', viewId);
      }
   }

   /**
    * Handle logoff button click
    */
   async handleLogoff()
   {
      const refreshToken = localStorage.getItem('refresh_token');

      try
      {
         // Call logout endpoint
         if (refreshToken)
            await RB.fetchPost('/api/auth/logout', {refreshToken});
      }
      catch (error)
      {
         console.error('Error during logout:', error);
         // Continue with logout even if API call fails
      }

      // Clear localStorage (user_id is not stored - backend extracts it from JWT token)
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_email');
      localStorage.removeItem('user_display_name');
      localStorage.removeItem('user_role');

      // Hide home page
      this.hide();

      // Show splash screen
      if (window.splashScreen)
      {
         window.splashScreen.show();
         window.splashScreen.showLoginForm();
      }
      else
         // Reload page if splash screen not available
         window.location.reload();
   }

   /**
    * Show the home page
    */
   show()
   {
      console.log('🔐 HomePage: Showing home page');
      
      if (this.container)
         this.container.style.display = 'flex';
   }

   /**
    * Hide the home page
    */
   hide()
   {
      if (this.container)
         this.container.style.display = 'none';
   }

   /**
    * Clean up
    */
   dispose()
   {
      if (this.utcClock)
         this.utcClock.dispose();

      if (this.currentViewInstance && this.currentViewInstance.dispose)
         this.currentViewInstance.dispose();

      if (this.container && this.container.parentNode)
         this.container.parentNode.removeChild(this.container);

      if (this.statusComponent)
        this.statusComponent.dispose();

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
   escapeHtml(text)
   {
      if (!text) 
        return '';

      const div = document.createElement('div');
      div.textContent = text;
      
      return div.innerHTML;
   }
}
