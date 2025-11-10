/**
 * Utility functions for building star summary table data.
 */

/**
 * Resolve a readable owner label for a star.
 * @param {Object|null} owner - Owner object assigned to the star (may be null).
 * @returns {string} Display label for owner.
 */
function getOwnerLabel(owner)
{
   if (!owner)
   {
      return 'Neutral';
   }

   if (typeof owner === 'string')
   {
      return owner || 'Neutral';
   }

   if (owner.name)
   {
      return owner.name;
   }

   if (owner.display_name)
   {
      return owner.display_name;
   }

   if (owner.player_name)
   {
      return owner.player_name;
   }

   return 'Neutral';
}

/**
 * Normalize a star name for display.
 * @param {import('@loh/shared').Star} star - Star instance.
 * @returns {string} Display name.
 */
function getStarName(star)
{
   if (!star)
   {
      return 'Unknown';
   }

   if (typeof star.getName === 'function')
   {
      const name = star.getName();
      if (name)
      {
         return name;
      }
   }

   const id = typeof star.getId === 'function' ? star.getId() : star?.data?.star_id;
   return id ? `Star ${id}` : 'Unknown';
}

/**
 * Build table row data for all known stars.
 * Relies on window.globalMapModel (MapModel) and window.globalPlayers (Map).
 * @returns {Array<Object>} Array of summary rows.
 */
export function getStarSummaryRows()
{
   const mapModel = window.globalMapModel || window.mapGenerator?.mapModel;
   if (!mapModel || typeof mapModel.getStars !== 'function')
   {
      return [];
   }

   const stars = mapModel.getStars();
   const rows = [];
   const currentPlayerId = window.eventBus?.getContext?.().user ?? window.eventBus?.context?.user ?? null;

   stars.forEach((star) =>
   {
      if (!star)
      {
         return;
      }

      const economy = typeof star.getEconomy === 'function' ? star.getEconomy() : star.economy;
      const owner = typeof star.getOwner === 'function' ? star.getOwner() : star.owner;
      const ships = typeof star.getShips === 'function' ? star.getShips() : star.ships || [];
      const starId = typeof star.getId === 'function' ? star.getId() : star.data?.star_id;

      let ownerColor = '#FFFFFF';
      if (owner)
      {
         ownerColor = owner.color_hex
            || owner.colorHex
            || owner.color
            || owner.colour
            || star?.getColor?.()
            || '#FFFFFF';
      }

      rows.push({
         starId,
         star,
         name: getStarName(star),
         ownerName: getOwnerLabel(owner),
         ownerId: owner?.id ?? owner?.player_id ?? null,
         isOwned: Boolean(owner),
         isOwnedByCurrentPlayer: Boolean(currentPlayerId) && (
            owner?.id === currentPlayerId
            || owner?.player_id === currentPlayerId
            || owner?.user_id === currentPlayerId
            || owner?.userId === currentPlayerId
         ),
         ownerColor,
         resource: typeof star.getResourceValue === 'function' ? star.getResourceValue() : star.data?.resource ?? 0,
         industryCapacity: economy?.capacity ?? 0,
         researchLevel: economy?.techLevel ?? 0,
         availablePoints: economy?.available ?? 0,
         shipCount: Array.isArray(ships) ? ships.length : (typeof star.getShipCount === 'function' ? star.getShipCount() : 0),
      });
   });

   return rows;
}

