/**
 * @engine/turns — Turn management module.
 *
 * Provides a reusable turn manager for multi-player games.
 * Extracted from patterns hand-coded in Chess, Ludo, Go, and Poker.
 *
 * Usage:
 *   import { createTurnManager } from '@engine/turns';
 *
 *   const turns = createTurnManager(['black', 'white'], {
 *     onTurnEnd: (player) => console.log(`${player} ended turn`),
 *   });
 *
 *   turns.current()    // → 'black'
 *   turns.next()       // → advances to 'white'
 *   turns.extraTurn()  // → current player goes again
 *   turns.skip()       // → skip current player
 *   turns.pass()       // → player passes (tracked for consecutive pass detection)
 *   turns.reset()      // → back to first player
 */

/**
 * Create a turn manager for a list of players.
 *
 * @param {string[]} players - Ordered list of player identifiers
 * @param {Object} [opts] - Options
 * @param {Function} [opts.onTurnEnd] - Callback when a turn ends
 * @param {Function} [opts.onTurnStart] - Callback when a turn starts
 * @param {number} [opts.maxConsecutivePasses] - End game after N consecutive passes (default: players.length)
 * @returns {TurnManager}
 */
export function createTurnManager(players, opts = {}) {
  if (!players || players.length < 1) {
    throw new Error('createTurnManager requires at least 1 player');
  }

  let currentIndex = 0;
  let turnCount = 0;
  let consecutivePasses = 0;
  let extraTurnFlag = false;
  const maxPasses = opts.maxConsecutivePasses || players.length;
  const skippedPlayers = new Set();

  const manager = {
    /**
     * Get the current player.
     * @returns {string}
     */
    current() {
      return players[currentIndex];
    },

    /**
     * Get the current player index.
     * @returns {number}
     */
    currentIndex() {
      return currentIndex;
    },

    /**
     * Advance to the next player's turn.
     * Respects extra turns and skips.
     * @returns {string} The new current player
     */
    next() {
      if (opts.onTurnEnd) opts.onTurnEnd(players[currentIndex]);

      if (extraTurnFlag) {
        extraTurnFlag = false;
        // Stay on same player
      } else {
        let attempts = 0;
        do {
          currentIndex = (currentIndex + 1) % players.length;
          attempts++;
        } while (skippedPlayers.has(players[currentIndex]) && attempts < players.length);
      }

      turnCount++;
      consecutivePasses = 0;

      if (opts.onTurnStart) opts.onTurnStart(players[currentIndex]);
      return players[currentIndex];
    },

    /**
     * Grant the current player an extra turn.
     * The next call to next() will stay on the same player.
     */
    extraTurn() {
      extraTurnFlag = true;
    },

    /**
     * Skip a specific player for subsequent turns.
     * @param {string} player
     */
    skip(player) {
      skippedPlayers.add(player);
    },

    /**
     * Unskip a previously skipped player.
     * @param {string} player
     */
    unskip(player) {
      skippedPlayers.delete(player);
    },

    /**
     * Current player passes their turn.
     * Tracks consecutive passes for game-end detection.
     * @returns {{ allPassed: boolean, consecutivePasses: number }}
     */
    pass() {
      consecutivePasses++;
      const allPassed = consecutivePasses >= maxPasses;

      if (opts.onTurnEnd) opts.onTurnEnd(players[currentIndex]);

      currentIndex = (currentIndex + 1) % players.length;
      turnCount++;

      if (opts.onTurnStart) opts.onTurnStart(players[currentIndex]);

      return { allPassed, consecutivePasses };
    },

    /**
     * Reset to the first player and clear all state.
     */
    reset() {
      currentIndex = 0;
      turnCount = 0;
      consecutivePasses = 0;
      extraTurnFlag = false;
      skippedPlayers.clear();
    },

    /**
     * Set the current player by index or name.
     * @param {number|string} playerOrIndex
     */
    setCurrentPlayer(playerOrIndex) {
      if (typeof playerOrIndex === 'number') {
        currentIndex = playerOrIndex % players.length;
      } else {
        const idx = players.indexOf(playerOrIndex);
        if (idx >= 0) currentIndex = idx;
      }
    },

    /**
     * Get the total number of turns played.
     * @returns {number}
     */
    getTurnCount() {
      return turnCount;
    },

    /**
     * Get the number of consecutive passes.
     * @returns {number}
     */
    getConsecutivePasses() {
      return consecutivePasses;
    },

    /**
     * Get the list of active (non-skipped) players.
     * @returns {string[]}
     */
    activePlayers() {
      return players.filter(p => !skippedPlayers.has(p));
    },

    /**
     * Get all players.
     * @returns {string[]}
     */
    allPlayers() {
      return [...players];
    },
  };

  return manager;
}
