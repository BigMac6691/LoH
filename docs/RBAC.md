# Home Page Implementation + RBAC Plan

## Overview
Phase 0: Implement complete home page with sidebar menu, game lists (playing/available), role-based UI visibility, and navigation. Phase 1: Add RBAC backend middleware to protect routes and match frontend permissions.

## Phase 0: Home Page Implementation

### Layout Structure
```
Header (top bar):
  - Left: UTC time display
  - Center: Player display name
  - Right: Logoff button

Body (flex layout):
  - Left sidebar: Menu items
  - Right main area: Content display (changes based on menu selection)
```

### Database Migration 014

1. **Create Migration 014** (`backend/migrations/014_add_max_players.sql`)
   - Add `max_players INT` column to `game` table
   - Set default value (e.g., 4 or 6)
   - Add CHECK constraint: `CHECK (max_players > 0 AND max_players <= 20)`
   - Note: Original RBAC migration becomes 015

### Home Page Components

2. **Update HomePage.js** (`frontend/src/HomePage.js`)
   - Create header with UTC clock, display name, logoff button
   - Create left sidebar menu structure
   - Create main content area that switches based on menu selection
   - Implement menu item click handlers
   - Store current menu selection in state

3. **Menu Items Implementation**
   - **News and Events** (default) - Create `NewsEventsView.js` placeholder component
   - **Games Playing** - Show `GamesPlayingList.js` component
   - **Games Available** - Show `GamesAvailableList.js` component
   - **Rules/Instructions** - Create `RulesView.js` placeholder component
   - **Create Game** - Replace main display with UIController.js (sponsor/admin only)
   - **Manage Games** - Create `ManageGamesView.js` placeholder (sponsor/admin only)
   - **User Manager** - Create `UserManagerView.js` placeholder (admin only)

4. **Games Playing List Component** (`frontend/src/components/GamesPlayingList.js`)
   - Fetch games where current user is a player (JOIN game_player WHERE user_id = current_user)
   - Display for each game:
     - game.title
     - game.description
     - app_user.display_name (sponsor/owner)
     - game.map_size
     - game_turn.number (current/latest turn)
     - game_player.status (current user's status in this game)
     - PLAY button
   - On PLAY click: Load game (hide home page, show game view)

5. **Games Available List Component** (`frontend/src/components/GamesAvailableList.js`)
   - Fetch games where:
     - Current user is NOT a player (LEFT JOIN game_player WHERE user_id != current_user OR user_id IS NULL)
     - Player count < max_players
     - Game status is 'lobby' or 'running'
   - Display for each game:
     - game.title
     - game.description
     - app_user.display_name (sponsor/owner)
     - game.map_size
     - Count of players from game_player (COUNT(game_player.id))
     - game.max_players
     - JOIN button
   - On JOIN click: Add user to game_player, then load game

6. **API Endpoints Needed**

   **GET /api/games/playing** - Games where user is a player
   - Join: game + game_player + app_user (owner) + game_turn (latest)
   - Filter: WHERE game_player.user_id = current_user_id
   - Return: game fields + owner display_name + current turn number + player status

   **GET /api/games/available** - Games user can join
   - Join: game + app_user (owner) + COUNT(game_player) as player_count
   - Filter: WHERE game_player.user_id != current_user_id OR user_id IS NULL
   - Filter: HAVING COUNT(game_player.id) < max_players
   - Filter: WHERE game.status IN ('lobby', 'running')
   - Return: game fields + owner display_name + player_count + max_players

   **POST /api/games/:gameId/join** - Join a game
   - Add current user as game_player
   - Return: success/error

7. **Role-Based Menu Visibility** (`frontend/src/HomePage.js`)
   - Read `user_role` from localStorage
   - Show "Create Game" menu item only if role is 'sponsor' or 'admin'
   - Show "Manage Games" menu item only if role is 'sponsor' or 'admin'
   - Show "User Manager" menu item only if role is 'admin'
   - Apply CSS classes for role-based styling

8. **UTC Clock Component** (`frontend/src/components/UTClock.js`)
   - Display current UTC time
   - Update every second
   - Format: "UTC: YYYY-MM-DD HH:MM:SS" or similar

9. **Logoff Functionality**
   - Call `/api/auth/logout` endpoint
   - Clear localStorage (tokens, user info)
   - Hide home page
   - Show splash screen
   - Reset app state

10. **Create Game Flow** (`frontend/src/HomePage.js`)
    - On "Create Game" menu click:
      - Hide main display area
      - Show UIController.js panel (game creation UI)
      - Handle game creation submission
      - On success: Hide UIController, show Games Playing list with new game

11. **Game Loading Flow**
    - On PLAY or JOIN button click:
      - Fetch game state from API
      - Hide home page container
      - Initialize game view (MapViewGenerator, etc.)
      - Load game state into game view
      - Add "Back to Home" button in game view

### Styling

12. **Update home-page.css** (`frontend/src/styles/home-page.css`)
    - Layout styles for header, sidebar, main area
    - Menu item styles (hover, active states)
    - Game list card styles
    - Role-based visibility styles
    - Responsive design

## Phase 1: RBAC Backend Implementation

### Roles
- **player**: Basic gameplay, view games, submit orders
- **sponsor**: All player + create games, manage owned games
- **admin**: All sponsor + manage all games, manage users, dev routes

### Implementation

13. **Create Authentication Middleware** (`backend/src/middleware/auth.js`)
    - Extract JWT from Authorization header
    - Verify token with `verifyAccessToken()`
    - Attach user to `req.user` (id, email, role)
    - Return 401 if missing/invalid

14. **Create RBAC Middleware** (`backend/src/middleware/rbac.js`)
    - `requireRole(roles)` - Check user has required role(s)
    - `requireAnyRole(roles)` - Check user has any of the roles
    - `requireGameOwner()` - Check user owns the game
    - `requireGameOwnerOrAdmin()` - Check user owns game OR is admin

15. **Protect GameRouter** (`backend/src/routes/GameRouter.js`)
    - Apply auth middleware to all routes
    - POST /api/games - Require 'sponsor' or 'admin' role
    - GET /api/games/playing - Require auth, filter by current user
    - GET /api/games/available - Require auth, filter by user not in game
    - POST /api/games/:gameId/join - Require auth, verify game has space
    - PUT/DELETE /api/games/:gameId - Require game owner or admin
    - Other routes - Require auth

16. **Protect Other Routers**
    - OrdersRouter - Require auth, verify user is player in game
    - DevRouter - Require 'admin' role
    - TurnRouter - Require auth, verify user is player in game

17. **Create AdminRouter** (`backend/src/routes/AdminRouter.js`)
    - GET /api/admin/users - List all users (admin only)
    - PUT /api/admin/users/:userId/role - Update user role (admin only)
    - PUT /api/admin/users/:userId/status - Update user status (admin only)
    - GET /api/admin/users/:userId - Get user details (admin only)

18. **Add Role Constraint** (Migration 015 - originally 014)
    - Add CHECK constraint: `CHECK (role IN ('player', 'sponsor', 'admin'))`

## Files to Create

### Phase 0
- `backend/migrations/014_add_max_players.sql`
- `frontend/src/components/GamesPlayingList.js`
- `frontend/src/components/GamesAvailableList.js`
- `frontend/src/components/NewsEventsView.js`
- `frontend/src/components/RulesView.js`
- `frontend/src/components/ManageGamesView.js`
- `frontend/src/components/UserManagerView.js`
- `frontend/src/components/UTClock.js`

### Phase 1
- `backend/src/middleware/auth.js`
- `backend/src/middleware/rbac.js`
- `backend/src/routes/AdminRouter.js`
- `backend/migrations/015_add_role_constraint.sql` (rename from 014)

## Files to Modify

### Phase 0
- `frontend/src/HomePage.js` - Complete rewrite with new layout
- `frontend/src/styles/home-page.css` - New layout styles
- `backend/src/routes/GameRouter.js` - Add /games/playing, /games/available, /:gameId/join endpoints
- `backend/src/repos/gamesRepo.js` - Add functions for playing/available games queries

### Phase 1
- `backend/src/routes/GameRouter.js` - Apply auth/authorization middleware
- `backend/src/routes/OrdersRouter.js` - Apply auth middleware
- `backend/src/routes/DevRouter.js` - Apply admin-only protection
- `backend/src/routes/TurnRouter.js` - Apply auth middleware
- `backend/server.js` - Register AdminRouter and middleware
- `frontend/src/main.js` - Handle 403 errors, role-based UI

## Implementation Notes

- UTC time in header is system UTC, not game-specific
- Games Playing = WHERE game_player.user_id = current_user_id
- Games Available = WHERE user NOT in game_player AND player_count < max_players
- PLAY and JOIN both load game (hide home page, show game view)
- Create Game button shows UIController.js directly (replaces main display)
- Menu visibility based on localStorage 'user_role' value
- Role badge in header should show user's role (player/sponsor/admin)

## Suggested Additional Roles (Optional, Future)

- **moderator** - Can moderate games but not full admin
  - Can view/manage all games
  - Cannot manage users or system settings
- **spectator** - Can view games but not play (future)

## Security Considerations

- Always validate JWT tokens before checking roles
- Never trust client-provided role - always verify from database/token
- Default to most restrictive permission (deny if unsure)
- Log authorization failures for security auditing
- Consider rate limiting on role change operations
- Verify game ownership before allowing game management
- Verify user is player in game before allowing order submission

