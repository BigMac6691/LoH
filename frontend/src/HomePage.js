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
      this.viewContainer = null;
      this.statusComponent = new StatusComponent();
      this.utcClock = null;
      this.currentView = null;
      this.currentViewInstance = null;

      this.displayName = null;
      this.userRole = null;
      this.emailVerified = null;

      this._boundRefresh = this.refresh.bind(this);
      eventBus.on('system:userUpdated', this._boundRefresh);

      this.createHomePage();
   }

   createHomePage()
   {
      this.container = document.createElement('div');
      this.container.style.display = 'none';
      this.container.id = 'home-page';
      this.container.className = 'home-page';

      this.createHeader();
      this.createBody(); // Create body with sidebar and main content

      document.body.appendChild(this.container);
   }

   refreshHeader()
   {
      // Update role from localStorage
      this.userRole = localStorage.getItem('user_role') || 'visitor';
      this.displayName = localStorage.getItem('user_display_name');

      if (!this.displayName)
      {
         this.displayName = 'Unknown';
         this.statusComponent.postStatusMessage('Unknown display name', 'warning');
      }

      Utils.requireElement('.home-header'); // this throws error if not found

      const roleBadge = Utils.requireChild(this.header, '.role-badge');
      roleBadge.className = `role-badge role-${this.userRole}`;
      roleBadge.textContent = this.userRole;

      Utils.requireChild(this.header, '.player-name').textContent = Utils.escapeHtml(this.displayName);
   }

   /**
    * Create header with UTC clock, display name, and logoff button
    */
   createHeader()
   {
      this.header = document.createElement('div');
      this.header.className = 'home-header';
      this.header.innerHTML = headerHTML;

      this.utcClock = new UTClock(Utils.requireChild(this.header, '.utc-clock'));
      this.utcClock.init();

      Utils.requireChild(this.header, '#logoff-btn')
         .addEventListener('click', () => eventBus.emit('system:logoutRequest', new ApiRequest('system:logoutRequest')));
      
      this.container.appendChild(this.header);
   }

   /**
    * Create body with sidebar, main content area and status component
    */
   createBody()
   {
      this.createSidebar();

      // Create main content area, view container and status component
      this.viewContainer = document.createElement('div');
      this.viewContainer.className = 'view-container';

      this.mainContent = document.createElement('div');
      this.mainContent.className = 'home-main-content';
      this.mainContent.append(this.viewContainer, this.statusComponent.getContainer());

      const body = document.createElement('div');
      body.className = 'home-body';
      body.append(this.sidebar, this.mainContent);

      this.container.appendChild(body);
   }

   /**
    * Refresh sidebar menu when role has been updated
    */
   refreshSidebar()
   {
      this.userRole = localStorage.getItem('user_role') || 'visitor';

      Utils.requireElement('.home-sidebar'); // this throws error if not found

      this.createSidebar();
      this.setActiveMenuItem(this.currentView || 'news-events');
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

   refresh(event)
   {
      this.userRole = localStorage.getItem('user_role') || 'visitor';
      this.displayName = localStorage.getItem('user_display_name');
      this.emailVerified = localStorage.getItem('user_email_verified') === 'true';

      this.refreshHeader();
      this.refreshSidebar();
   }

   setActiveMenuItem(viewId)
   {
      Utils.requireElement('.home-sidebar'); // this throws error if not found

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
      Utils.requireElement('.view-container'); // this throws error if not found

      // Clean up current view
      if (this.currentViewInstance)
      {
         this.currentViewInstance.dispose();
         this.currentViewInstance = null;
      }

      this.currentView = viewId;
      this.currentViewInstance = Viewfactory.create(viewId, {statusComponent: this.statusComponent});

      this.viewContainer.innerHTML = '';
      this.viewContainer.appendChild(this.currentViewInstance.getContainer());
   }

   show()
   {
      Utils.requireElement('#home-page').style.display = 'flex'; // this throws error if not found

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

      eventBus.off('system:userUpdated', this._boundRefresh);
   }
}

class Viewfactory
{
   static registry = new Map();

   static register(viewId, viewClass)
   {
      this.registry.set(viewId, viewClass);
   }

   static create(viewId, options = {})
   {
      const viewClass = this.registry.get(viewId);
      if (!viewClass)
         throw new Error('Viewfactory: View class not found for viewId:', viewId);

      return new viewClass(options.statusComponent);
   }
}

Viewfactory.register('player-profile', PlayerProfileView);
Viewfactory.register('news-events', NewsEventsView);
Viewfactory.register('games-playing', GamesPlayingList);
Viewfactory.register('games-available', GamesAvailableList);
Viewfactory.register('create-game', CreateGameView);
Viewfactory.register('manage-games', ManageGamesView);
Viewfactory.register('user-manager', UserManagerView);
Viewfactory.register('manage-news-events', ManageNewsEventsView);
Viewfactory.register('rules', RulesView);

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

const headerHTML =
`
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