# Lords of Hyperion (LoH) - Data Dictionary

## Overview
This document provides a comprehensive data dictionary for the Lords of Hyperion game database. The database is built using PostgreSQL and follows a normalized structure with proper foreign key relationships and constraints.

## Table of Contents
- [Core Tables](#core-tables)
  - [app_user](#app_user)
  - [game](#game)
  - [game_turn](#game_turn)
  - [game_player](#game_player)
- [Game Content Tables](#game-content-tables)
  - [star](#star)
  - [wormhole](#wormhole)
  - [star_state](#star_state)
  - [ship](#ship)
- [Game Mechanics Tables](#game-mechanics-tables)
  - [order_submission](#order_submission)
  - [turn_resolution_event](#turn_resolution_event)
- [System Tables](#system-tables)
  - [_migrations](#_migrations)

---

## Core Tables

### app_user
**Purpose**: Stores user account information for authentication and user management.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier for the user account |
| `email` | TEXT | UNIQUE, NOT NULL | User's email address (login identifier) |
| `password_hash` | TEXT | NOT NULL | Hashed password for authentication |
| `display_name` | TEXT | NOT NULL | User's display name |
| `role` | TEXT | NOT NULL, DEFAULT 'player' | User role (player, admin, etc.) |
| `status` | TEXT | NOT NULL, DEFAULT 'active' | Account status (active, suspended, etc.) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Account creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update timestamp |

**Business Rules**:
- Email must be unique across all users
- Role defaults to 'player' for new accounts
- Status defaults to 'active' for new accounts

**Example**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "player@example.com",
  "display_name": "Space Commander",
  "role": "player",
  "status": "active"
}
```

---

### game
**Purpose**: Represents a game instance with configuration and metadata.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier for the game |
| `owner_id` | UUID | REFERENCES app_user(id) | User who created/owns the game |
| `seed` | TEXT | NOT NULL | Random seed for deterministic map generation |
| `map_size` | INT | NOT NULL, CHECK (2-9) | Map dimensions (2x2 to 9x9 sectors) |
| `density_min` | INT | NOT NULL | Minimum star density per sector |
| `density_max` | INT | NOT NULL | Maximum star density per sector |
| `rules_version` | TEXT | NOT NULL, DEFAULT 'v1' | Game rules version |
| `status` | TEXT | NOT NULL, CHECK (lobby/running/paused/finished) | Current game status |
| `title` | TEXT | NOT NULL | Human-readable game title |
| `description` | TEXT | NOT NULL | Game description |
| `params` | JSONB | NOT NULL, DEFAULT '{}' | Additional game parameters |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Game creation timestamp |
| `started_at` | TIMESTAMPTZ | NULLABLE | When the game actually started |

**Business Rules**:
- Map size must be between 2 and 9 (inclusive)
- Status must be one of: 'lobby', 'running', 'paused', 'finished'
- Started_at is set when game transitions from 'lobby' to 'running'

**Example**:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "owner_id": "550e8400-e29b-41d4-a716-446655440000",
  "seed": "galaxy-42",
  "map_size": 5,
  "density_min": 1,
  "density_max": 3,
  "status": "running",
  "title": "Epic Space Battle",
  "description": "A battle for galactic supremacy"
}
```

---

### game_turn
**Purpose**: Tracks game turns and their status for turn-based gameplay.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier for the turn |
| `game_id` | UUID | NOT NULL, REFERENCES game(id) | Associated game |
| `number` | INT | NOT NULL | Turn number (1, 2, 3, etc.) |
| `status` | TEXT | NOT NULL, CHECK (open/resolving/closed) | Turn status |
| `opened_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | When turn was opened |
| `closed_at` | TIMESTAMPTZ | NULLABLE | When turn was closed |

**Business Rules**:
- Turn numbers must be unique within a game
- Status must be one of: 'open', 'resolving', 'closed'
- Only one turn can be 'open' per game at a time
- Closed_at is set when turn status changes to 'closed'

**Indexes**:
- `idx_turn_status` on (game_id, status) for fast open turn lookups

**Example**:
```json
{
  "id": "789e0123-e45b-67d8-a901-234567890123",
  "game_id": "123e4567-e89b-12d3-a456-426614174000",
  "number": 1,
  "status": "open",
  "opened_at": "2024-01-15T10:00:00Z"
}
```

---

### game_player
**Purpose**: Represents players within a specific game instance.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier for the game player |
| `game_id` | UUID | NOT NULL, REFERENCES game(id) | Associated game |
| `user_id` | UUID | REFERENCES app_user(id) | Associated user account (nullable) |
| `name` | TEXT | NOT NULL | Player's name in this game |
| `color_hex` | TEXT | NOT NULL | Hex color code for player identification |
| `country_name` | TEXT | NULLABLE | Player's empire/country name |
| `status` | TEXT | NOT NULL, DEFAULT 'active' | Player's turn status |
| `meta` | JSONB | NOT NULL, DEFAULT '{}' | Additional player metadata |

**Business Rules**:
- Player names must be unique within a game
- Color codes must be unique within a game
- Status can be 'active' (can take actions) or 'waiting' (turn ended)
- User_id can be null for AI players or guest players

**Unique Constraints**:
- (game_id, name) - Player names unique per game
- (game_id, color_hex) - Colors unique per game

**Example**:
```json
{
  "id": "456e7890-e12b-34d5-a678-901234567890",
  "game_id": "123e4567-e89b-12d3-a456-426614174000",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Terran Empire",
  "color_hex": "#FF5733",
  "country_name": "United Terran Systems",
  "status": "active",
  "meta": {"fleet_count": 5, "last_action": "move"}
}
```

---

## Game Content Tables

### star
**Purpose**: Represents star systems in the game map with fixed properties.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier for the star |
| `game_id` | UUID | NOT NULL, REFERENCES game(id) | Associated game |
| `star_id` | TEXT | NOT NULL | Deterministic star identifier (e.g., "STAR_3_1_0") |
| `name` | TEXT | NOT NULL | Star system name |
| `sector_x` | INT | NOT NULL | X coordinate of the sector |
| `sector_y` | INT | NOT NULL | Y coordinate of the sector |
| `pos_x` | REAL | NOT NULL | X position within the sector |
| `pos_y` | REAL | NOT NULL | Y position within the sector |
| `pos_z` | REAL | NOT NULL | Z position within the sector |
| `resource` | DOUBLE PRECISION | NOT NULL, DEFAULT 50.0, CHECK (0.0-100.0) | Fixed natural resource abundance |

**Business Rules**:
- Star_id must be unique within a game (deterministic based on seed)
- Resource value is fixed and unchangeable once set
- Resource must be between 0.0 and 100.0

**Indexes**:
- `idx_star_game` on (game_id)
- `idx_star_sector` on (game_id, sector_x, sector_y)
- `idx_star_game_star_id` on (game_id, star_id)

**Example**:
```json
{
  "id": "789e0123-e45b-67d8-a901-234567890123",
  "game_id": "123e4567-e89b-12d3-a456-426614174000",
  "star_id": "STAR_3_1_0",
  "name": "Alpha Centauri",
  "sector_x": 3,
  "sector_y": 1,
  "pos_x": 125.5,
  "pos_y": 87.2,
  "pos_z": 0.0,
  "resource": 75.5
}
```

---

### wormhole
**Purpose**: Represents wormhole connections between star systems.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier for the wormhole |
| `game_id` | UUID | NOT NULL, REFERENCES game(id) | Associated game |
| `wormhole_id` | TEXT | NOT NULL | Deterministic wormhole identifier (e.g., "EDGE_STAR_A_STAR_B") |
| `star_a_id` | TEXT | NOT NULL | First connected star identifier |
| `star_b_id` | TEXT | NOT NULL | Second connected star identifier |

**Business Rules**:
- Wormhole_id must be unique within a game
- Star_a_id and star_b_id must be different
- Wormholes are undirected (bidirectional)

**Unique Constraints**:
- (game_id, star_a_id, star_b_id) - No duplicate connections

**Indexes**:
- `idx_wormhole_game` on (game_id)
- `idx_wormhole_game_wormhole_id` on (game_id, wormhole_id)

**Example**:
```json
{
  "id": "abc12345-e67b-89d0-a123-456789012345",
  "game_id": "123e4567-e89b-12d3-a456-426614174000",
  "wormhole_id": "EDGE_STAR_3_1_0_STAR_3_2_0",
  "star_a_id": "STAR_3_1_0",
  "star_b_id": "STAR_3_2_0"
}
```

---

### star_state
**Purpose**: Tracks dynamic state changes for star systems during gameplay.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier for the state record |
| `game_id` | UUID | NOT NULL, REFERENCES game(id) | Associated game |
| `star_id` | TEXT | NOT NULL | Associated star identifier |
| `owner_player` | UUID | REFERENCES game_player(id) | Current owner of the star |
| `economy` | JSONB | NOT NULL, DEFAULT '{}' | Economic state (industry, tech level, etc.) |
| `details` | JSONB | NOT NULL, DEFAULT '{}' | Additional state information (damage, destruction, etc.) |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last state update timestamp |

**Business Rules**:
- Only one state record per star per game
- Owner_player can be null (unclaimed star)
- Economy and details are JSON objects with flexible structure

**Unique Constraints**:
- (game_id, star_id) - One state per star per game

**Indexes**:
- `idx_star_owner` on (game_id, owner_player)
- `idx_stars_updated` on (game_id, updated_at DESC)

**Example**:
```json
{
  "id": "def67890-e12b-34d5-a678-901234567890",
  "game_id": "123e4567-e89b-12d3-a456-426614174000",
  "star_id": "STAR_3_1_0",
  "owner_player": "456e7890-e12b-34d5-a678-901234567890",
  "economy": {
    "industry": 25,
    "technology": 15,
    "available": 10
  },
  "details": {
    "infrastructure": 0,
    "population": 0
  }
}
```

---

### ship
**Purpose**: Represents ships/fleets in the game with their properties and locations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier for the ship |
| `game_id` | UUID | NOT NULL, REFERENCES game(id) | Associated game |
| `owner_player` | UUID | NOT NULL, REFERENCES game_player(id) | Ship owner |
| `location_star_id` | TEXT | NOT NULL | Current location (star identifier) |
| `hp` | INT | NOT NULL | Hit points/health |
| `power` | INT | NOT NULL | Combat power rating |
| `status` | TEXT | NOT NULL, DEFAULT 'active' | Ship status |
| `details` | JSONB | NOT NULL, DEFAULT '{}' | Additional ship properties |

**Business Rules**:
- Ships must have an owner
- Ships must be located at a valid star
- Status can be 'active', 'disabled', 'destroyed', etc.

**Indexes**:
- `idx_ship_loc` on (game_id, location_star_id)
- `idx_ship_owner` on (game_id, owner_player)
- `idx_ships_status` on (game_id, status)

**Example**:
```json
{
  "id": "ghi90123-e45b-67d8-a901-234567890123",
  "game_id": "123e4567-e89b-12d3-a456-426614174000",
  "owner_player": "456e7890-e12b-34d5-a678-901234567890",
  "location_star_id": "STAR_3_1_0",
  "hp": 100,
  "power": 25,
  "status": "active",
  "details": {
    "type": "battleship",
    "weapons": ["laser_cannon", "missile_launcher"]
  }
}
```

---

## Game Mechanics Tables

### order_submission
**Purpose**: Stores player orders with revision tracking for turn-based gameplay.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier for the order |
| `game_id` | UUID | NOT NULL, REFERENCES game(id) | Associated game |
| `turn_id` | UUID | NOT NULL, REFERENCES game_turn(id) | Associated turn |
| `player_id` | UUID | NOT NULL, REFERENCES game_player(id) | Ordering player |
| `client_order_id` | UUID | NOT NULL | Logical order identifier for revisions |
| `revision` | INT | NOT NULL, DEFAULT 1 | Revision number of this order |
| `order_type` | TEXT | NOT NULL | Type of order (move, industry, research, etc.) |
| `payload` | JSONB | NOT NULL | Order-specific data |
| `is_deleted` | BOOLEAN | NOT NULL, DEFAULT false | Whether this revision is deleted |
| `is_final` | BOOLEAN | NOT NULL, DEFAULT false | Whether this is the final submission |
| `finalized_at` | TIMESTAMPTZ | NULLABLE | When the order was finalized |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Order creation timestamp |

**Business Rules**:
- Only one final order per player per turn
- Orders can be revised multiple times before finalization
- Deleted orders are soft-deleted (is_deleted = true)
- Payload must include version information

**Unique Constraints**:
- (game_id, turn_id, player_id) WHERE is_final = true - One final order per player per turn

**Indexes**:
- `idx_orders_latest` on (game_id, turn_id, player_id, client_order_id, revision DESC)
- `idx_orders_turn_type` on (game_id, turn_id, order_type, is_final)
- `idx_orders_payload_gin` on payload (GIN index for JSON queries)

**Example**:
```json
{
  "id": "jkl23456-e78b-90d1-a234-567890123456",
  "game_id": "123e4567-e89b-12d3-a456-426614174000",
  "turn_id": "789e0123-e45b-67d8-a901-234567890123",
  "player_id": "456e7890-e12b-34d5-a678-901234567890",
  "client_order_id": "mno34567-e89b-01d2-a345-678901234567",
  "revision": 3,
  "order_type": "move",
  "payload": {
    "version": "v1",
    "ship_id": "ghi90123-e45b-67d8-a901-234567890123",
    "destination": "STAR_3_2_0"
  },
  "is_final": true,
  "finalized_at": "2024-01-15T10:30:00Z"
}
```

---

### turn_resolution_event
**Purpose**: Records events that occur during turn resolution (combat, movement, etc.).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier for the event |
| `game_id` | UUID | NOT NULL, REFERENCES game(id) | Associated game |
| `turn_id` | UUID | NOT NULL, REFERENCES game_turn(id) | Associated turn |
| `seq` | INT | NOT NULL | Sequence number within the turn |
| `kind` | TEXT | NOT NULL | Event type (move, combat, production, etc.) |
| `details` | JSONB | NOT NULL | Event-specific data and outcomes |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Event creation timestamp |

**Business Rules**:
- Sequence numbers must be unique within a turn
- Events are processed in sequence order
- Details contain seeded RNG steps for reproducibility

**Unique Constraints**:
- (turn_id, seq) - Unique sequence per turn

**Indexes**:
- `idx_events_kind` on (game_id, turn_id, kind)
- `idx_events_seq` on (game_id, turn_id, seq DESC)
- `idx_tre_details_gin` on details (GIN index for JSON queries)

**Example**:
```json
{
  "id": "pqr45678-e90b-12d3-a456-789012345678",
  "game_id": "123e4567-e89b-12d3-a456-426614174000",
  "turn_id": "789e0123-e45b-67d8-a901-234567890123",
  "seq": 1,
  "kind": "combat",
  "details": {
    "location": "STAR_3_2_0",
    "attacker": "456e7890-e12b-34d5-a678-901234567890",
    "defender": "789e0123-e45b-67d8-a901-234567890123",
    "outcome": "victory",
    "damage_dealt": 25,
    "rng_seed": 42
  }
}
```

---

## System Tables

### _migrations
**Purpose**: Tracks which database migrations have been applied.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing migration ID |
| `filename` | TEXT | UNIQUE, NOT NULL | Migration filename |
| `applied_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | When migration was applied |

**Business Rules**:
- Filenames must be unique
- Migrations are applied in order
- Used for database version control

**Example**:
```json
{
  "id": 1,
  "filename": "001_init.sql",
  "applied_at": "2024-01-01T00:00:00Z"
}
```

---

## Data Relationships

### Primary Relationships
- **game** → **game_turn** (1:many) - A game has multiple turns
- **game** → **game_player** (1:many) - A game has multiple players
- **game** → **star** (1:many) - A game has multiple stars
- **game** → **wormhole** (1:many) - A game has multiple wormholes
- **game_player** → **star_state** (1:many) - A player can own multiple stars
- **game_player** → **ship** (1:many) - A player can have multiple ships
- **game_turn** → **order_submission** (1:many) - A turn has multiple orders
- **game_turn** → **turn_resolution_event** (1:many) - A turn has multiple events

### Key Constraints
- All game-related data is deleted when a game is deleted (CASCADE)
- Player names and colors must be unique within a game
- Only one turn can be open per game at a time
- Only one final order per player per turn

---

## Indexes Summary

### Performance Indexes
- **Game lookups**: `idx_star_game`, `idx_wormhole_game`
- **Sector queries**: `idx_star_sector`
- **Player status**: `idx_turn_status`, `idx_ships_status`
- **Order processing**: `idx_orders_turn_type`, `idx_orders_latest`
- **Event processing**: `idx_events_kind`, `idx_events_seq`
- **JSON queries**: GIN indexes on `payload` and `details` columns

### Unique Constraints
- User emails
- Game player names and colors
- Star and wormhole IDs within games
- Turn numbers within games
- Final orders per player per turn
- Event sequence numbers within turns

---

## Data Types Reference

### UUID
- **Format**: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
- **Usage**: Primary keys, foreign keys
- **Example**: `550e8400-e29b-41d4-a716-446655440000`

### JSONB
- **Usage**: Flexible data storage for game state, orders, and events
- **Benefits**: Indexable, queryable, efficient storage
- **Example**: `{"industry": 25, "technology": 15}`

### TIMESTAMPTZ
- **Format**: ISO 8601 with timezone
- **Usage**: Timestamps for audit trails and game events
- **Example**: `2024-01-15T10:30:00Z`

### TEXT
- **Usage**: Variable-length strings for names, descriptions, identifiers
- **Constraints**: Various length and format constraints per column

### INT/REAL/DOUBLE PRECISION
- **Usage**: Numeric values for coordinates, stats, and game mechanics
- **Constraints**: Range checks and precision requirements per column

---

*This data dictionary is maintained alongside the database schema and should be updated when migrations are applied.*
