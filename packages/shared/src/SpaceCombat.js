import { EventEmitter } from './EventEmitter.js';
import SeededRandom from './SeededRandom.js';

/**
 * SpaceCombat - Pure combat calculation engine with event emission
 * No I/O dependencies - all database operations handled by listeners
 */
export class SpaceCombat extends EventEmitter {
  /**
   * Create a new combat instance
   * @param {string} starId - Star ID where combat occurs
   * @param {string} turnId - Turn ID (for reference, not used in calculations)
   * @param {number} battleSeed - Pre-generated battle seed for deterministic combat
   * @param {Array} initialShips - Array of ship objects with {id, owner_player, hp, power}
   */
  constructor(starId, turnId, battleSeed, initialShips) {
    super();
    
    this.starId = starId;
    this.turnId = turnId;
    this.battleSeed = battleSeed;
    this.rng = new SeededRandom(battleSeed);
    
    console.log(`⚔️ SpaceCombat: Initializing combat at star ${starId}, turn ${turnId}, seed ${battleSeed}`);
    
    // Normalize and prepare ship data
    this.initialShipStates = this.prepareShips(initialShips);
    console.log(`⚔️ SpaceCombat: Prepared ${this.initialShipStates.length} ships for combat`);
    
    // Sort ships by owner into a map (player_id -> ships array)
    this.shipsByPlayer = new Map();
    this.playerIds = [];
    
    for (const shipState of this.initialShipStates) {
      const playerId = shipState.owner_player;
      if (!this.shipsByPlayer.has(playerId)) {
        this.shipsByPlayer.set(playerId, []);
        this.playerIds.push(playerId);
      }
      
      // Create working copy with destroyed flag
      this.shipsByPlayer.get(playerId).push({
        id: shipState.id,
        owner_player: shipState.owner_player,
        hp: shipState.hp,
        power: shipState.power,
        destroyed: false
      });
    }
    
    // Sort player IDs for consistent processing order
    this.playerIds.sort();
    
    console.log(`⚔️ SpaceCombat: ${this.playerIds.length} players in combat:`, this.playerIds);
    for (const [playerId, ships] of this.shipsByPlayer.entries()) {
      console.log(`⚔️ SpaceCombat: Player ${playerId} has ${ships.length} ship(s)`);
    }
    
    // Track ships lost by player
    this.shipsLostByPlayer = new Map();
    for (const playerId of this.playerIds) {
      this.shipsLostByPlayer.set(playerId, 0);
    }
  }

  /**
   * Normalize ship data format
   * @param {Array} ships - Raw ship data from various sources
   * @returns {Array} Normalized ship states
   */
  prepareShips(ships) {
    return ships.map(ship => ({
      id: ship.id,
      owner_player: ship.owner_player,
      hp: parseFloat(ship.hp),
      power: parseFloat(ship.power)
    }));
  }

  /**
   * Get current state of all ships
   * @returns {Array} Current ship states
   */
  getShipStates() {
    const states = [];
    for (const playerShips of this.shipsByPlayer.values()) {
      for (const ship of playerShips) {
        states.push({
          id: ship.id,
          owner_player: ship.owner_player,
          hp: ship.hp,
          power: ship.power,
          destroyed: ship.destroyed
        });
      }
    }
    return states;
  }

  /**
   * Resolve the combat
   * @returns {Object} Combat result with winner, rounds, and statistics
   */
  resolve() {
    console.log(`⚔️ SpaceCombat: Starting combat resolution at star ${this.starId}`);
    
    // Emit combat start event
    const startEvent = {
      starId: this.starId,
      turnId: this.turnId,
      battleSeed: this.battleSeed,
      initialShipStates: [...this.initialShipStates],
      playerIds: [...this.playerIds]
    };
    this.emit('combat:start', startEvent);
    console.log(`⚔️ SpaceCombat: Emitted combat:start event with ${this.playerIds.length} players, ${this.initialShipStates.length} ships`);

    let round = 0;
    let winner = null;
    let remainingShips = 0;

    // Round loop - continue until only one player has ships or no ships remain
    while (true) {
      round++;
      console.log(`⚔️ SpaceCombat: Starting round ${round}`);

      const shipStates = this.getShipStates();
      const activeShips = shipStates.filter(s => !s.destroyed);
      console.log(`⚔️ SpaceCombat: Round ${round} - ${activeShips.length} active ships remaining`);
      
      // Emit round start event
      const roundStartEvent = {
        round,
        shipStates: [...shipStates]
      };
      this.emit('combat:roundStart', roundStartEvent);

      // Check if combat is over
      const playersWithShips = [];
      for (const [playerId, playerShips] of this.shipsByPlayer.entries()) {
        const activeShips = playerShips.filter(s => !s.destroyed);
        if (activeShips.length > 0) {
          playersWithShips.push(playerId);
        }
      }

      // Combat ends if 0 or 1 players have ships
      if (playersWithShips.length <= 1) {
        winner = playersWithShips.length === 1 ? playersWithShips[0] : null;
        
        // Record remaining ships count for the winner
        if (winner) {
          const winnerShips = this.shipsByPlayer.get(winner);
          const activeShips = winnerShips.filter(s => !s.destroyed);
          remainingShips = activeShips.length;
          console.log(`⚔️ SpaceCombat: Combat ended at round ${round}, winner: ${winner} with ${remainingShips} ship(s) remaining`);
        } else {
          remainingShips = 0; // No winner means no ships left
          console.log(`⚔️ SpaceCombat: Combat ended at round ${round}, no winner (mutual destruction)`);
        }
        
        break;
      }

      // Firing phase: collect all attacks first (simultaneous firing)
      const attacks = [];
      const shipsDestroyedThisRound = [];

      console.log(`⚔️ SpaceCombat: Round ${round} - Firing phase begins`);

      for (const attackerPlayerId of this.playerIds) {
        const attackerShips = this.shipsByPlayer.get(attackerPlayerId).filter(s => !s.destroyed);

        // Get all enemy ships (ships from other players) - snapshot at start of round
        const enemyShips = [];
        for (const enemyPlayerId of this.playerIds) {
          if (enemyPlayerId !== attackerPlayerId) {
            const enemyPlayerShips = this.shipsByPlayer.get(enemyPlayerId).filter(s => !s.destroyed);
            enemyShips.push(...enemyPlayerShips);
          }
        }

        // Skip if no attackers or no enemies
        if (attackerShips.length === 0 || enemyShips.length === 0) {
          if (attackerShips.length === 0) {
            console.log(`⚔️ SpaceCombat: Round ${round} - Player ${attackerPlayerId} has no active ships, skipping`);
          }
          continue;
        }

        console.log(`⚔️ SpaceCombat: Round ${round} - Player ${attackerPlayerId} firing with ${attackerShips.length} ship(s) at ${enemyShips.length} enemy ship(s)`);

        // Each attacker ship fires at a random enemy (collect attacks, don't apply yet)
        for (const attacker of attackerShips) {
          // Randomly select target from all enemy ships (using snapshot from start of round)
          const targetIndex = this.rng.nextInt(0, enemyShips.length - 1);
          const defender = enemyShips[targetIndex];

          // Calculate accuracy: attacker power / (attacker power + defender power)
          const accuracy = attacker.power / (attacker.power + defender.power);

          // Determine if hit
          const roll = this.rng.nextFloat(0, 1);
          const isHit = roll < accuracy;

          let damage = 0;
          if (isHit) {
            // Calculate damage: attacker power * random(0..1)
            const damageMultiplier = this.rng.nextFloat(0, 1);
            damage = attacker.power * damageMultiplier;
          }

          // Store attack to apply after all ships have fired
          // IMPORTANT: Keep references to actual ship objects (not copies) so damage is applied correctly
          const attack = {
            round,
            attacker, // Reference to actual attacker ship object
            defender, // Reference to actual defender ship object (from shipsByPlayer)
            attackerInfo: {
              id: attacker.id,
              owner_player: attacker.owner_player,
              power: attacker.power
            },
            defenderInfo: {
              id: defender.id,
              owner_player: defender.owner_player,
              hp: defender.hp,
              power: defender.power
            },
            accuracy,
            roll,
            isHit,
            damage
          };
          
          attacks.push(attack);

          // Emit attack event (use info objects for event, not ship references)
          this.emit('combat:attack', {
            round: attack.round,
            attacker: attack.attackerInfo,
            defender: attack.defenderInfo,
            accuracy: attack.accuracy,
            roll: attack.roll,
            isHit: attack.isHit,
            damage: attack.damage
          });
          
          console.log(`⚔️ SpaceCombat: Round ${round} - Ship ${attack.attackerInfo.id} (${attack.attackerInfo.owner_player}) ${attack.isHit ? 'HITS' : 'misses'} ship ${attack.defenderInfo.id} (${attack.defenderInfo.owner_player})${attack.isHit ? ` for ${attack.damage.toFixed(2)} damage` : ''}`);
        }
      }

      console.log(`⚔️ SpaceCombat: Round ${round} - Collected ${attacks.length} attack(s), applying damage simultaneously`);

      // Now apply all damage simultaneously
      for (const attack of attacks) {
        if (attack.isHit) {
          const hpBefore = attack.defender.hp; // Read from actual ship object
          
          // Apply damage to actual ship object (not a copy)
          attack.defender.hp -= attack.damage;
          const hpAfter = attack.defender.hp; // Read updated value from actual ship object

          // Emit damage event
          const damageEvent = {
            round: attack.round,
            shipId: attack.defender.id,
            ownerId: attack.defender.owner_player,
            damage: attack.damage,
            hpBefore,
            hpAfter,
            destroyed: false
          };
          this.emit('combat:damage', damageEvent);

          // Check if ship is destroyed (check actual ship object)
          if (attack.defender.hp <= 0 && !attack.defender.destroyed) {
            attack.defender.destroyed = true;
            attack.defender.hp = 0; // Update actual ship object
            
            // Track ship loss
            const currentLosses = this.shipsLostByPlayer.get(attack.defender.owner_player);
            this.shipsLostByPlayer.set(attack.defender.owner_player, currentLosses + 1);
            const updatedLosses = this.shipsLostByPlayer.get(attack.defender.owner_player);
            
            shipsDestroyedThisRound.push({
              shipId: attack.defender.id,
              ownerId: attack.defender.owner_player
            });

            console.log(`⚔️ SpaceCombat: Round ${round} - Ship ${attack.defender.id} (${attack.defender.owner_player}) DESTROYED! Player losses: ${updatedLosses}`);

            // Emit ship destroyed event
            const destroyedEvent = {
              round: attack.round,
              shipId: attack.defender.id,
              ownerId: attack.defender.owner_player
            };
            this.emit('combat:shipDestroyed', destroyedEvent);

            // Update damage event with destroyed flag
            const finalDamageEvent = {
              round: attack.round,
              shipId: attack.defender.id,
              ownerId: attack.defender.owner_player,
              damage: attack.damage,
              hpBefore,
              hpAfter: 0,
              destroyed: true
            };
            this.emit('combat:damage', finalDamageEvent);
          }
        }
      }

      // Emit round end event
      const roundEndEvent = {
        round,
        shipStates: this.getShipStates(),
        shipsLostThisRound: shipsDestroyedThisRound.length,
        attacksThisRound: attacks.length
      };
      this.emit('combat:roundEnd', roundEndEvent);
      console.log(`⚔️ SpaceCombat: Round ${round} ended - ${shipsDestroyedThisRound.length} ship(s) destroyed, ${attacks.length} attack(s) executed`);
    }

    // Compile final results
    const finalShipStates = this.getShipStates();
    const result = {
      starId: this.starId,
      turnId: this.turnId,
      battleSeed: this.battleSeed,
      rounds: round,
      winner,
      remainingShips,
      shipsLostByPlayer: Object.fromEntries(this.shipsLostByPlayer),
      initialShipStates: [...this.initialShipStates],
      finalShipStates
    };

    console.log(`⚔️ SpaceCombat: Combat resolution complete - ${round} rounds, winner: ${winner || 'none'}, remaining ships: ${remainingShips}`);
    console.log(`⚔️ SpaceCombat: Ships lost by player:`, Object.fromEntries(this.shipsLostByPlayer));

    // Emit combat end event
    this.emit('combat:end', result);

    return result;
  }
}

