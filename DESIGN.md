# Lord of Heaven (working title)

## Game Overview
- Turn-based space strategy game.

## Map Generation

The game uses a procedural map generation system that creates consistent, deterministic space maps based on user-defined parameters.

### Map Structure
- **Grid-based layout**: Maps are divided into square sectors arranged in a grid
- **Configurable size**: User can specify map size from 2x2 to 9x9 sectors
- **Sector-based organization**: Each sector contains stars and can connect to adjacent sectors

### Generation Parameters
- **Map Size**: Integer value between 2 and 9, determines the grid dimensions (e.g., 5 = 5x5 grid)
- **Star Density Range**: Two values (minimum and maximum) between 0-9 that control star count per sector
- **Seed**: Numeric value that ensures consistent, repeatable generation for the same parameters

### Star Placement Rules
- **Sector distribution**: Stars are placed within individual sectors based on the exact density range values
- **Star count**: Each sector gets a random number of stars between min and max density (inclusive)
- **Edge margins**: Stars are placed at least 5% of sector width from sector edges
- **Minimum distance**: Stars within a sector must maintain at least 10% of sector width distance from each other
- **Depth variation**: Stars are placed at random Z-coordinates between -2 and 2 for visual depth
- **Placement attempts**: System attempts up to 50 placements per star before skipping

### Wormhole Connection System
- **Intra-sector connections**: Stars within each sector are connected using shortest distance algorithm
  - Starts with the first star
  - Finds the unconnected star with shortest distance to any connected star
  - Connects that star to its closest connected star
  - Creates an optimal spanning tree within each sector
- **Inter-sector connections**: Adjacent sectors are connected via their closest stars
  - Connects to right and bottom neighbors only (no diagonal connections)
  - Links the closest pair of stars between adjacent sectors
  - Ensures the entire map is traversable

### Technical Architecture
- **Model-Renderer separation**: Map generation logic is completely separate from rendering
  - `MapModel` class handles pure data generation with no Three.js dependencies
  - `MapGenerator` class handles Three.js rendering of the generated model
  - Clean separation allows the generation logic to be shared between frontend and backend
- **Deterministic generation**: Uses a `SeededRandom` class for consistent, repeatable results
- **Shared code**: The `MapModel` and `SeededRandom` classes can be used in both frontend and backend

### Visual Representation
- **Stars**: Rendered as light gray spheres using Three.js `SphereGeometry`
- **Wormholes**: Rendered as thin, semi-transparent cylinders using Three.js `CylinderGeometry`
- **Materials**: Stars use `MeshPhongMaterial` for lighting effects, wormholes use `MeshBasicMaterial` with transparency
- **3D positioning**: All objects are positioned in 3D space with proper depth for immersive viewing

### Rendering Features
- **Proportional scaling**: Star and wormhole sizes scale automatically with canvas dimensions
  - Star radius: 0.5% of canvas size (configurable via `STAR_RADIUS_PERCENT`)
  - Wormhole radius: 10% of star radius (configurable via `WORMHOLE_RADIUS_PERCENT`)
- **Automatic camera positioning**: Camera automatically repositions to frame the entire map after generation
  - Calculates map bounds and optimal viewing distance
  - Centers camera on map center point
  - Adjusts for field of view to ensure full map visibility
- **Debug sector borders**: Optional wireframe borders showing sector boundaries
  - Toggle with `DEBUG_SHOW_SECTOR_BORDERS` constant
  - Green semi-transparent lines using `THREE.LineSegments`
  - 3D wireframe boxes spanning full map depth (-2 to 2)
  - Helps visualize grid structure and sector organization

### User Interface
- **Dual-handle slider**: Replaces separate min/max star density inputs with a single interactive component
  - Visual range slider with two draggable handles for min and max values
  - Real-time value display below each handle
  - Automatic constraint handling (prevents min > max)
  - Touch support for mobile devices
  - Reusable component design for future use
- **Form validation**: Comprehensive validation of all input parameters
- **Error handling**: User-friendly error messages with automatic dismissal
- **Responsive design**: UI adapts to different screen sizes and orientations

## Player Management

The game features a comprehensive player management system that allows multiple players to be created and assigned to the generated map before starting gameplay.

### Player Creation Flow
- **Post-map generation**: Player setup screen appears automatically after successful map generation
- **Sequential player addition**: Players are added one at a time with name and color selection
- **Validation before assignment**: All player data is validated before being added to the game
- **Game start trigger**: Game begins when "Start Game" button is clicked (requires minimum 2 players)

### Player Data Requirements
- **Name**: Unique identifier for each player (case-insensitive validation)
  - Must be non-empty string
  - Cannot duplicate existing player names
  - Trimmed of leading/trailing whitespace
- **Color**: Visual identifier for player's stars and territory
  - Selected from predefined color palette
  - Must meet minimum distance threshold from existing player colors
  - Prevents visual confusion between players

### Player Validation Rules
- **Name uniqueness**: System enforces case-insensitive unique names across all players
- **Color distance**: Uses Euclidean RGB distance calculation to prevent similar colors
  - Minimum distance threshold: 50 units in RGB space
  - Converts hex colors to RGB values for accurate distance calculation
  - Automatically filters out colors that are too similar to existing players
- **Player limits**: Minimum 2 players required to start game, no maximum limit enforced

### Sector Assignment System
- **Random sector selection**: Each player is assigned to a randomly chosen sector
- **Occupancy checking**: System ensures no two players are assigned to the same sector
- **Star availability**: Only sectors with at least one star are considered for assignment
- **Adjacent sector logic**: Reusable function for determining sector neighbors (right and bottom only)

### Star Ownership and Visualization
- **Single star assignment**: Each player is assigned exactly one random star in their sector
- **Color coding**: Player-owned stars are colored with the player's chosen color
- **Default appearance**: All unowned stars remain light gray (#CCCCCC)
- **Visual updates**: Star colors update immediately when players are assigned
- **Ownership tracking**: Each star object includes `owner` and `color` properties

### User Interface Components
- **Player input form**: Name text field and color dropdown for new player creation
- **Player list display**: Shows all added players with name, color, and remove option
- **Color selection**: Dropdown with available colors (filters out similar colors automatically)
- **Start game button**: Enabled only when minimum player requirement is met
- **Error messaging**: Real-time validation feedback with automatic dismissal
- **Responsive design**: UI adapts to different screen sizes and orientations

### Technical Implementation
- **PlayerManager class**: Core logic for player data management and validation
  - Player storage and retrieval
  - Name and color validation
  - Sector assignment logic
  - Color distance calculations
- **PlayerSetupUI class**: User interface for player creation and management
  - Form handling and validation
  - Player list display and management
  - Integration with PlayerManager
- **Integration points**: 
  - Called automatically after map generation in main.js
  - Updates MapGenerator for visual star coloring
  - Provides callback for game start transition

### Color Distance Algorithm
- **RGB conversion**: Hex colors converted to RGB values (0-255 range)
- **Euclidean distance**: Calculated as √((R₁-R₂)² + (G₁-G₂)² + (B₁-B₂)²)
- **Threshold enforcement**: Colors with distance ≤ 50 are considered too similar
- **Dynamic filtering**: Available color options update as players are added

### Reusable Components
- **Adjacent sector calculation**: Function to determine neighboring sectors
- **Color distance calculation**: Utility for comparing color similarity
- **Player validation**: Comprehensive validation logic for names and colors
- **Sector assignment**: Logic for finding available sectors with stars

### Game State Management
- **Player persistence**: Player data maintained throughout game session
- **Map regeneration**: Players cleared when new map is generated
- **Visual synchronization**: Star colors update immediately with player assignments
- **Game start transition**: Smooth transition from setup to gameplay phase
