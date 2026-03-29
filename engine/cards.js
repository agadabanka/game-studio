/**
 * @engine/cards — Card game utilities module.
 *
 * Provides deck management, hand evaluation, and card game helpers.
 * Extracted from patterns in Poker, Blackjack, and Solitaire.
 *
 * Usage:
 *   import { createDeck, shuffleDeck, dealCards, evaluatePokerHand } from '@engine/cards';
 *
 *   const deck = shuffleDeck(createDeck());
 *   const { hands, remaining } = dealCards(deck, 4, 2);  // 4 players, 2 cards each
 */

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const SUIT_SYMBOLS = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

export const SUIT_COLORS = {
  hearts: '#E74C3C',
  diamonds: '#E74C3C',
  clubs: '#2C3E50',
  spades: '#2C3E50',
};

/**
 * Create a standard 52-card deck.
 * @param {Object} [opts]
 * @param {boolean} [opts.includeJokers] - Add 2 jokers
 * @returns {{ suit: string, rank: string, value: number }[]}
 */
export function createDeck(opts = {}) {
  const deck = [];
  for (const suit of SUITS) {
    for (let i = 0; i < RANKS.length; i++) {
      deck.push({ suit, rank: RANKS[i], value: i + 2 });
    }
  }
  if (opts.includeJokers) {
    deck.push({ suit: 'joker', rank: 'Joker', value: 15 });
    deck.push({ suit: 'joker', rank: 'Joker', value: 15 });
  }
  return deck;
}

/**
 * Shuffle a deck using Fisher-Yates algorithm.
 * @param {Array} deck
 * @returns {Array} New shuffled array
 */
export function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

/**
 * Deal cards from a deck to players.
 * @param {Array} deck - The deck to deal from
 * @param {number} numPlayers - Number of players
 * @param {number} cardsPerPlayer - Cards to deal to each player
 * @returns {{ hands: Array[], remaining: Array }}
 */
export function dealCards(deck, numPlayers, cardsPerPlayer) {
  const remaining = [...deck];
  const hands = Array.from({ length: numPlayers }, () => []);

  for (let c = 0; c < cardsPerPlayer; c++) {
    for (let p = 0; p < numPlayers; p++) {
      if (remaining.length > 0) {
        hands[p].push(remaining.pop());
      }
    }
  }

  return { hands, remaining };
}

/**
 * Draw cards from the top of a deck.
 * @param {Array} deck - Mutated: cards are removed
 * @param {number} count - Number of cards to draw
 * @returns {Array} Drawn cards
 */
export function drawCards(deck, count) {
  const drawn = [];
  for (let i = 0; i < count && deck.length > 0; i++) {
    drawn.push(deck.pop());
  }
  return drawn;
}

/**
 * Get the blackjack value of a hand.
 * Aces count as 11 or 1 to avoid bust.
 * @param {Array} hand
 * @returns {number}
 */
export function blackjackValue(hand) {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === 'A') {
      total += 11;
      aces++;
    } else if (['K', 'Q', 'J'].includes(card.rank)) {
      total += 10;
    } else {
      total += parseInt(card.rank);
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

// Poker hand rankings
export const POKER_HANDS = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  THREE_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_KIND: 7,
  STRAIGHT_FLUSH: 8,
  ROYAL_FLUSH: 9,
};

export const POKER_HAND_NAMES = [
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind',
  'Straight', 'Flush', 'Full House', 'Four of a Kind',
  'Straight Flush', 'Royal Flush',
];

/**
 * Get all combinations of k items from array.
 * @param {Array} arr
 * @param {number} k
 * @returns {Array[]}
 */
function combinations(arr, k) {
  if (k === arr.length) return [arr];
  if (k === 1) return arr.map(x => [x]);
  const result = [];
  for (let i = 0; i <= arr.length - k; i++) {
    const rest = combinations(arr.slice(i + 1), k - 1);
    for (const combo of rest) result.push([arr[i], ...combo]);
  }
  return result;
}

/**
 * Check if values form a straight.
 * @param {number[]} values - Sorted descending
 * @returns {boolean}
 */
function isStraight(values) {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.length < 5) return false;
  // Normal straight
  if (unique[0] - unique[4] === 4) return true;
  // Ace-low straight (A-2-3-4-5)
  if (unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) return true;
  return false;
}

/**
 * Evaluate the best poker hand from up to 7 cards.
 * @param {Array} cards - Array of card objects
 * @returns {{ rank: number, value: number, name: string }}
 */
export function evaluatePokerHand(cards) {
  if (cards.length < 5) {
    return { rank: POKER_HANDS.HIGH_CARD, value: 0, name: 'High Card' };
  }

  const combos = combinations(cards, 5);
  let bestRank = -1;
  let bestValue = 0;

  for (const combo of combos) {
    const sorted = [...combo].sort((a, b) => b.value - a.value);
    const values = sorted.map(c => c.value);
    const suits = sorted.map(c => c.suit);

    const isFlush = suits.every(s => s === suits[0]);
    const straight = isStraight(values);

    const counts = {};
    for (const v of values) counts[v] = (counts[v] || 0) + 1;
    const groups = Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0]);

    let rank, value;
    if (isFlush && straight && values[0] === 14) {
      rank = POKER_HANDS.ROYAL_FLUSH; value = 14;
    } else if (isFlush && straight) {
      rank = POKER_HANDS.STRAIGHT_FLUSH; value = values[0];
    } else if (groups[0][1] === 4) {
      rank = POKER_HANDS.FOUR_KIND; value = parseInt(groups[0][0]);
    } else if (groups[0][1] === 3 && groups[1][1] === 2) {
      rank = POKER_HANDS.FULL_HOUSE; value = parseInt(groups[0][0]);
    } else if (isFlush) {
      rank = POKER_HANDS.FLUSH; value = values[0];
    } else if (straight) {
      rank = POKER_HANDS.STRAIGHT; value = values[0];
    } else if (groups[0][1] === 3) {
      rank = POKER_HANDS.THREE_KIND; value = parseInt(groups[0][0]);
    } else if (groups[0][1] === 2 && groups[1][1] === 2) {
      rank = POKER_HANDS.TWO_PAIR; value = Math.max(parseInt(groups[0][0]), parseInt(groups[1][0]));
    } else if (groups[0][1] === 2) {
      rank = POKER_HANDS.PAIR; value = parseInt(groups[0][0]);
    } else {
      rank = POKER_HANDS.HIGH_CARD; value = values[0];
    }

    if (rank > bestRank || (rank === bestRank && value > bestValue)) {
      bestRank = rank; bestValue = value;
    }
  }

  return {
    rank: bestRank,
    value: bestValue,
    name: POKER_HAND_NAMES[bestRank] || 'Unknown',
  };
}

/**
 * Compare two poker hand evaluations.
 * @returns {number} Positive if a wins, negative if b wins, 0 for tie
 */
export function comparePokerHands(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  return a.value - b.value;
}

/**
 * Draw a card on canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {Object} card - { suit, rank, value }
 * @param {boolean} faceUp
 * @param {Object} [opts] - { width: 60, height: 80 }
 */
export function drawCard(ctx, x, y, card, faceUp, opts = {}) {
  const w = opts.width || 60;
  const h = opts.height || 80;

  if (!faceUp || !card) {
    ctx.fillStyle = '#1a3a6b';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#FFF';
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#2a5aab';
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    return;
  }

  ctx.fillStyle = '#FFF';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#000';
  ctx.strokeRect(x, y, w, h);

  const color = SUIT_COLORS[card.suit] || '#000';
  const symbol = SUIT_SYMBOLS[card.suit] || '?';

  ctx.fillStyle = color;
  ctx.font = 'bold 14px monospace';
  ctx.fillText(card.rank, x + 4, y + 16);
  ctx.font = '18px serif';
  ctx.fillText(symbol, x + 4, y + 36);

  ctx.font = '24px serif';
  ctx.textAlign = 'center';
  ctx.fillText(symbol, x + w / 2, y + h / 2 + 10);
  ctx.textAlign = 'left';
}
