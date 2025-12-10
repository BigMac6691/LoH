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
import { ApiRequest } from './events/Events.js';
import { eventBus } from './eventBus.js';
import { Utils } from './utils/Utils.js';

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

      this.displayName = null;
      this.userRole = null;
      this.emailVerified = null;

      this.createHomePage();
   }

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
      else
         throw new Error('HomePage: UTC clock element not found!');
   }

   refreshHeader()
   {
      // Update role from localStorage
      this.userRole = localStorage.getItem('user_role') || 'visitor';
      this.displayName = localStorage.getItem('user_display_name');

      if (!this.displayName)
         throw new Error('HomePage: Display name not found!');

      // Update role badge if header exists
      if (this.header)
      {
         const roleBadge = this.header.querySelector('.role-badge');
         if (roleBadge)
         {
            roleBadge.className = `role-badge role-${this.userRole}`;
            roleBadge.textContent = this.userRole;
         }
         else
            throw new Error('HomePage: Role badge not found!');

         const playerName = this.header.querySelector('.player-name');
         if (playerName)
            playerName.textContent = Utils.escapeHtml(this.displayName);
         else
            throw new Error('HomePage: Player name not found!');
      }
      else
         throw new Error('HomePage: Header not found!');
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
        <span class="player-name">name</span>
        <span class="role-badge role-visitor">role</span>
      </div>
      <div class="header-right">
        <button class="logoff-btn" id="logoff-btn">Logoff</button>
      </div>
    `;

      this.container.appendChild(this.header);

      // Add logoff button handler
      const logoffBtn = this.header.querySelector('#logoff-btn');
      if (logoffBtn)
         logoffBtn.addEventListener('click', () => this.handleLogoff());
      else
         throw new Error('HomePage: Logoff button not found!');
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
      this.userRole = localStorage.getItem('user_role') || 'visitor';

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
               this.setActiveMenuItem(currentView);
            else
               this.setActiveMenuItem('news-events');
         }
         else
            this.setActiveMenuItem('news-events');
      }
      else
         throw new Error('HomePage: Sidebar not found!');
   }

   createSidebar()
   {
      // If sidebar already exists, clear it
      if (this.sidebar)
         this.sidebar.innerHTML = '';
      else
      {
         this.sidebar = document.createElement('div');
         this.sidebar.className = 'home-sidebar';
      }

      // menuItems array is defined at the bottom of the file
      const menuHtml = menuItems
         .filter(item => item.roles.includes(this.userRole))
         .map(item => 
         `
         <div class="menu-item" data-view="${item.id}">
            <span class="menu-icon">${item.icon}</span>
            <span class="menu-label">${Utils.escapeHtml(item.label)}</span>
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

   setActiveMenuItem(viewId)
   {
      if (!this.sidebar) 
         throw new Error('HomePage: Sidebar not found!');

      this.sidebar.querySelectorAll('.menu-item').forEach(mi =>
      {
         if (mi.getAttribute('data-view') === viewId)
            mi.classList.add('active');
         else
            mi.classList.remove('active');
      });
   }

   showView(viewId)
   {
      if (!this.mainContent) 
         throw new Error('HomePage: Main content not found!');

      // Clean up current view
      if (this.currentViewInstance)
      {
         this.currentViewInstance.dispose();
         this.currentViewInstance = null;
      }

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
      eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', {targetScreen: 'splash'}));
   }

   show()
   {
      console.log('🔐 HomePage: Showing home page', this.currentViewInstance);

      if (this.container)
         this.container.style.display = 'flex';
      else
         throw new Error('HomePage: Container not found!');

      this.userRole = localStorage.getItem('user_role') || 'visitor';
      this.displayName = localStorage.getItem('user_display_name');
      this.emailVerified = localStorage.getItem('user_email_verified') === 'true';

      this.refreshHeader();
      this.refreshSidebar();

      if (!this.currentViewInstance) // necessary to show the first view
      {
         this.showView('news-events');
         this.setActiveMenuItem('news-events');
      }   
   }

   hide()
   {
      this.container.style.display = 'none';
   }

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
}

const menuItems = 
[
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
      roles: ['player', 'sponsor', 'admin', 'owner']
   },
   {
      id: 'games-available',
      label: 'Games Available',
      icon: '🔍',
      roles: ['player', 'sponsor', 'admin', 'owner']
   },
   {
      id: 'create-game',
      label: 'Create Game',
      icon: '✨',
      roles: ['sponsor', 'admin', 'owner']
   },
   {
      id: 'manage-games',
      label: 'Manage Games',
      icon: '⚙️',
      roles: ['sponsor', 'admin', 'owner']
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