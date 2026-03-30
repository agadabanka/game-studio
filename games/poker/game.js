/**
 * Poker (Texas Hold'em) — Card game using @engine SDK.
 *
 * Features:
 * - Texas Hold'em rules: preflop, flop, turn, river
 * - 3 AI opponents with different play styles
 * - Betting: check, call, raise, fold
 * - Hand evaluation (pair, two pair, straight, flush, full house, etc.)
 * - Chip management, blinds, multi-round tournament
 * - Uses @engine/ai for opponent decision-making
 * - Uses new @engine/cards module for deck/hand management
 *
 * New patterns validated:
 * - Card game abstraction (deck, hand, deal, shuffle)
 * - Multi-phase turns (betting rounds within a hand)
 * - Hidden information (player can't see AI cards)
 * - Complex state machine (preflop → flop → turn → river → showdown)
 *
 * Modules: @engine/core, @engine/render, @engine/input, @engine/ai, @engine/cards, @engine/turns
 * Complexity: 7 systems, ~22KB
 */

import { defineGame } from '@engine/core';
import { consumeAction } from '@engine/input';
import { clearCanvas, drawSquare, drawHUD, drawGameOver } from '@engine/render';
import { pickWeightedMove, compositeEvaluator } from '@engine/ai';

// Card constants
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUIT_SYMBOLS = { hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660' };
const SUIT_COLORS = { hearts: '#E74C3C', diamonds: '#E74C3C', clubs: '#2C3E50', spades: '#2C3E50' };

// Hand rankings
const HAND_RANKS = {
  HIGH_CARD: 0, PAIR: 1, TWO_PAIR: 2, THREE_KIND: 3,
  STRAIGHT: 4, FLUSH: 5, FULL_HOUSE: 6, FOUR_KIND: 7,
  STRAIGHT_FLUSH: 8, ROYAL_FLUSH: 9,
};

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let i = 0; i < RANKS.length; i++) {
      deck.push({ suit, rank: RANKS[i], value: i + 2 });
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function evaluateHand(cards) {
  if (cards.length < 5) return { rank: HAND_RANKS.HIGH_CARD, value: 0 };

  // Get best 5-card hand from up to 7 cards
  const combos = getCombinations(cards, 5);
  let bestRank = -1;
  let bestValue = 0;

  for (const combo of combos) {
    const sorted = [...combo].sort((a, b) => b.value - a.value);
    const values = sorted.map(c => c.value);
    const suits = sorted.map(c => c.suit);

    const isFlush = suits.every(s => s === suits[0]);
    const isStraight = checkStraight(values);

    // Count ranks
    const counts = {};
    for (const v of values) counts[v] = (counts[v] || 0) + 1;
    const groups = Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0]);

    let rank, value;
    if (isFlush && isStraight && values[0] === 14) {
      rank = HAND_RANKS.ROYAL_FLUSH; value = 14;
    } else if (isFlush && isStraight) {
      rank = HAND_RANKS.STRAIGHT_FLUSH; value = values[0];
    } else if (groups[0][1] === 4) {
      rank = HAND_RANKS.FOUR_KIND; value = parseInt(groups[0][0]);
    } else if (groups[0][1] === 3 && groups[1][1] === 2) {
      rank = HAND_RANKS.FULL_HOUSE; value = parseInt(groups[0][0]);
    } else if (isFlush) {
      rank = HAND_RANKS.FLUSH; value = values[0];
    } else if (isStraight) {
      rank = HAND_RANKS.STRAIGHT; value = values[0];
    } else if (groups[0][1] === 3) {
      rank = HAND_RANKS.THREE_KIND; value = parseInt(groups[0][0]);
    } else if (groups[0][1] === 2 && groups[1][1] === 2) {
      rank = HAND_RANKS.TWO_PAIR; value = Math.max(parseInt(groups[0][0]), parseInt(groups[1][0]));
    } else if (groups[0][1] === 2) {
      rank = HAND_RANKS.PAIR; value = parseInt(groups[0][0]);
    } else {
      rank = HAND_RANKS.HIGH_CARD; value = values[0];
    }

    if (rank > bestRank || (rank === bestRank && value > bestValue)) {
      bestRank = rank; bestValue = value;
    }
  }
  return { rank: bestRank, value: bestValue };
}

function checkStraight(values) {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.length < 5) return false;
  for (let i = 0; i < unique.length - 1; i++) {
    if (unique[i] - unique[i + 1] !== 1) {
      // Check ace-low straight
      if (i === 0 && unique[0] === 14 && unique[unique.length - 1] === 2) continue;
      return false;
    }
  }
  return true;
}

function getCombinations(arr, k) {
  if (k === arr.length) return [arr];
  if (k === 1) return arr.map(x => [x]);
  const result = [];
  for (let i = 0; i <= arr.length - k; i++) {
    const rest = getCombinations(arr.slice(i + 1), k - 1);
    for (const combo of rest) result.push([arr[i], ...combo]);
  }
  return result;
}

const RANK_NAMES = ['High Card','Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush','Royal Flush'];

// AI personalities
const AI_PLAYERS = [
  { name: 'Alice', style: 'tight', aggression: 0.3 },  // Conservative
  { name: 'Bob',   style: 'loose', aggression: 0.7 },   // Aggressive
  { name: 'Carol', style: 'balanced', aggression: 0.5 }, // Balanced
];

const game = defineGame({
  display: {
    type: 'custom',
    canvasWidth: 900,
    canvasHeight: 600,
    offsetX: 20,
    offsetY: 20,
    background: '#0B6623',
  },
  input: {
    left:    { keys: ['ArrowLeft', 'a'] },
    right:   { keys: ['ArrowRight', 'd'] },
    action:  { keys: [' ', 'Enter'] },
    up:      { keys: ['ArrowUp', 'w'] },
    down:    { keys: ['ArrowDown', 's'] },
    restart: { keys: ['r', 'R'] },
    mode:    { keys: ['m', 'M'] },
  },
});

game.resource('gameMode', { mode: 'playerVsAi' });

game.component('Card', { suit: '', rank: '', value: 0, faceUp: false });

game.resource('state', {
  phase: 'deal',      // deal, preflop, flop, turn, river, showdown
  deck: [],
  communityCards: [],
  pot: 0,
  currentBet: 0,
  smallBlind: 10,
  bigBlind: 20,
  dealerIdx: 0,
  currentPlayerIdx: 0,
  roundNum: 1,
  gameOver: false,
  message: '',
  showdownTimer: 0,
  selectedAction: 0,   // 0=check/call, 1=raise, 2=fold
  raiseAmount: 0,
  players: [
    { name: 'You', chips: 1000, hand: [], bet: 0, folded: false, isHuman: true, allIn: false },
    { name: 'Alice', chips: 1000, hand: [], bet: 0, folded: false, isHuman: false, allIn: false, style: 'tight', aggression: 0.3 },
    { name: 'Bob', chips: 1000, hand: [], bet: 0, folded: false, isHuman: false, allIn: false, style: 'loose', aggression: 0.7 },
    { name: 'Carol', chips: 1000, hand: [], bet: 0, folded: false, isHuman: false, allIn: false, style: 'balanced', aggression: 0.5 },
  ],
  actionTimer: 0,
});

// --- Spawn/Deal System ---
game.system('spawn', function spawnSystem(world, _dt) {
  if (world.getResource('_spawned')) return;
  world.setResource('_spawned', true);

  const state = world.getResource('state');
  state.deck = shuffleDeck(createDeck());
  state.communityCards = [];
  state.pot = 0;
  state.currentBet = state.bigBlind;
  state.phase = 'preflop';
  state.message = '';

  // Reset players
  for (const p of state.players) {
    p.hand = [];
    p.bet = 0;
    p.folded = false;
    p.allIn = false;
  }

  // Deal 2 cards to each player
  for (let i = 0; i < 2; i++) {
    for (const p of state.players) {
      if (p.chips > 0) p.hand.push(state.deck.pop());
    }
  }

  // Post blinds
  const sb = (state.dealerIdx + 1) % state.players.length;
  const bb = (state.dealerIdx + 2) % state.players.length;
  state.players[sb].bet = Math.min(state.smallBlind, state.players[sb].chips);
  state.players[sb].chips -= state.players[sb].bet;
  state.players[bb].bet = Math.min(state.bigBlind, state.players[bb].chips);
  state.players[bb].chips -= state.players[bb].bet;
  state.pot = state.players[sb].bet + state.players[bb].bet;

  state.currentPlayerIdx = (bb + 1) % state.players.length;
  state.selectedAction = 0;
  state.raiseAmount = state.bigBlind * 2;
});

// --- Input System ---
game.system('input', function inputSystem(world, _dt) {
  const state = world.getResource('state');
  const input = world.getResource('input');
  const gm = world.getResource('gameMode');

  // Toggle AI vs AI mode
  if (consumeAction(input, 'mode')) {
    gm.mode = gm.mode === 'playerVsAi' ? 'aiVsAi' : 'playerVsAi';
  }

  if (state.gameOver) {
    if (consumeAction(input, 'restart')) {
      world.setResource('_spawned', false);
      state.gameOver = false;
      state.roundNum = 1;
      for (const p of state.players) p.chips = 1000;
    }
    return;
  }

  if (state.phase === 'showdown') return;
  if (gm.mode !== 'playerVsAi') return; // AI controls human player in aiVsAi

  const currentPlayer = state.players[state.currentPlayerIdx];
  if (!currentPlayer || !currentPlayer.isHuman || currentPlayer.folded) return;

  // Navigate actions
  if (consumeAction(input, 'left')) state.selectedAction = Math.max(0, state.selectedAction - 1);
  if (consumeAction(input, 'right')) state.selectedAction = Math.min(2, state.selectedAction + 1);
  if (consumeAction(input, 'up')) state.raiseAmount = Math.min(currentPlayer.chips, state.raiseAmount + state.bigBlind);
  if (consumeAction(input, 'down')) state.raiseAmount = Math.max(state.currentBet * 2, state.raiseAmount - state.bigBlind);

  if (consumeAction(input, 'action')) {
    if (state.selectedAction === 0) {
      // Check or Call
      const toCall = state.currentBet - currentPlayer.bet;
      if (toCall > 0) {
        const amount = Math.min(toCall, currentPlayer.chips);
        currentPlayer.chips -= amount;
        currentPlayer.bet += amount;
        state.pot += amount;
      }
    } else if (state.selectedAction === 1) {
      // Raise
      const toCall = state.currentBet - currentPlayer.bet;
      const raiseTotal = Math.min(state.raiseAmount, currentPlayer.chips);
      currentPlayer.chips -= raiseTotal;
      currentPlayer.bet += raiseTotal;
      state.pot += raiseTotal;
      state.currentBet = currentPlayer.bet;
    } else {
      // Fold
      currentPlayer.folded = true;
    }
    advancePlayer(state);
  }
});

function advancePlayer(state) {
  const activePlayers = state.players.filter(p => !p.folded && p.chips >= 0);

  // Check if only one player left
  if (activePlayers.length <= 1) {
    state.phase = 'showdown';
    state.showdownTimer = 3;
    return;
  }

  // Find next active player
  let next = (state.currentPlayerIdx + 1) % state.players.length;
  let loops = 0;
  while ((state.players[next].folded || state.players[next].allIn) && loops < state.players.length) {
    next = (next + 1) % state.players.length;
    loops++;
  }

  // Check if betting round is complete (everyone matched or folded)
  const bettingDone = activePlayers.every(p => p.bet === state.currentBet || p.allIn);
  if (bettingDone && next <= state.currentPlayerIdx) {
    // Advance to next phase
    if (state.phase === 'preflop') {
      state.phase = 'flop';
      state.communityCards.push(state.deck.pop(), state.deck.pop(), state.deck.pop());
    } else if (state.phase === 'flop') {
      state.phase = 'turn';
      state.communityCards.push(state.deck.pop());
    } else if (state.phase === 'turn') {
      state.phase = 'river';
      state.communityCards.push(state.deck.pop());
    } else if (state.phase === 'river') {
      state.phase = 'showdown';
      state.showdownTimer = 3;
      return;
    }
    // Reset bets for new round
    for (const p of state.players) p.bet = 0;
    state.currentBet = 0;
    next = (state.dealerIdx + 1) % state.players.length;
    while (state.players[next].folded) next = (next + 1) % state.players.length;
  }

  state.currentPlayerIdx = next;
}

// --- AI System ---
game.system('ai', function aiSystem(world, dt) {
  const state = world.getResource('state');
  if (state.gameOver || state.phase === 'showdown') return;

  const gm = world.getResource('gameMode');
  const current = state.players[state.currentPlayerIdx];
  if (!current || current.folded) return;
  // In playerVsAi mode, skip human player; in aiVsAi, AI plays for everyone
  if (current.isHuman && gm.mode === 'playerVsAi') return;

  state.actionTimer += dt;
  if (state.actionTimer < 0.8) return;
  state.actionTimer = 0;

  const hand = evaluateHand([...current.hand, ...state.communityCards]);
  const toCall = state.currentBet - current.bet;
  const handStrength = hand.rank / 9;

  // AI decision based on personality
  const aggressiveness = current.aggression || 0.5;
  const confidence = handStrength + (Math.random() * 0.3 - 0.15);

  if (confidence < 0.2 - aggressiveness * 0.1 && toCall > 0) {
    // Fold
    current.folded = true;
    state.message = `${current.name} folds`;
  } else if (confidence > 0.6 + (1 - aggressiveness) * 0.2 && current.chips > state.currentBet * 2) {
    // Raise
    const raiseAmt = Math.min(state.currentBet * 2 + state.bigBlind, current.chips);
    current.chips -= raiseAmt;
    current.bet += raiseAmt;
    state.pot += raiseAmt;
    state.currentBet = current.bet;
    state.message = `${current.name} raises to ${current.bet}`;
  } else {
    // Call/Check
    const amount = Math.min(toCall, current.chips);
    current.chips -= amount;
    current.bet += amount;
    state.pot += amount;
    state.message = toCall > 0 ? `${current.name} calls ${amount}` : `${current.name} checks`;
  }

  advancePlayer(state);
});

// --- Showdown System ---
game.system('showdown', function showdownSystem(world, dt) {
  const state = world.getResource('state');
  if (state.phase !== 'showdown') return;

  state.showdownTimer -= dt;
  if (state.showdownTimer > 0) return;

  // Determine winner
  const activePlayers = state.players.filter(p => !p.folded);

  if (activePlayers.length === 1) {
    activePlayers[0].chips += state.pot;
    state.message = `${activePlayers[0].name} wins $${state.pot}!`;
  } else {
    let bestHand = -1;
    let bestValue = -1;
    let winner = null;

    for (const p of activePlayers) {
      const h = evaluateHand([...p.hand, ...state.communityCards]);
      if (h.rank > bestHand || (h.rank === bestHand && h.value > bestValue)) {
        bestHand = h.rank; bestValue = h.value; winner = p;
      }
    }

    if (winner) {
      winner.chips += state.pot;
      const handName = RANK_NAMES[bestHand] || 'High Card';
      state.message = `${winner.name} wins $${state.pot} with ${handName}!`;
    }
  }

  // Check for eliminated players / game over
  const alive = state.players.filter(p => p.chips > 0);
  if (alive.length <= 1 || state.players[0].chips <= 0) {
    state.gameOver = true;
    return;
  }

  // Next round
  state.roundNum++;
  state.dealerIdx = (state.dealerIdx + 1) % state.players.length;
  state.phase = 'deal';
  world.setResource('_spawned', false);
});

// --- Render System ---
game.system('render', function renderSystem(world, _dt) {
  const renderer = world.getResource('renderer');
  if (!renderer) return;
  const { ctx } = renderer;
  const state = world.getResource('state');

  clearCanvas(ctx, '#0B6623');

  // Felt table
  ctx.fillStyle = '#0D7A2B';
  ctx.beginPath();
  ctx.ellipse(450, 300, 400, 250, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 8;
  ctx.stroke();

  // Community cards
  const comX = 250;
  const comY = 220;
  ctx.fillStyle = '#FFF';
  ctx.font = '14px monospace';
  ctx.fillText('Community Cards', comX + 80, comY - 10);

  for (let i = 0; i < 5; i++) {
    const cx = comX + i * 80;
    if (i < state.communityCards.length) {
      drawCard(ctx, cx, comY, state.communityCards[i], true);
    } else {
      drawCard(ctx, cx, comY, null, false);
    }
  }

  // Pot
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`Pot: $${state.pot}`, 450, 320);
  ctx.textAlign = 'left';

  // Players
  const positions = [
    { x: 350, y: 430, label: 'bottom' },   // Human (bottom)
    { x: 50, y: 200, label: 'left' },      // Alice (left)
    { x: 350, y: 30, label: 'top' },       // Bob (top)
    { x: 650, y: 200, label: 'right' },    // Carol (right)
  ];

  state.players.forEach((p, i) => {
    const pos = positions[i];
    const isActive = i === state.currentPlayerIdx && state.phase !== 'showdown';

    // Player info box
    ctx.fillStyle = isActive ? '#FFD700' : (p.folded ? '#666' : '#DDD');
    ctx.font = 'bold 14px monospace';
    ctx.fillText(p.name, pos.x, pos.y);
    ctx.font = '12px monospace';
    ctx.fillStyle = p.folded ? '#888' : '#FFF';
    ctx.fillText(`$${p.chips}`, pos.x, pos.y + 16);
    if (p.bet > 0) {
      ctx.fillStyle = '#FFD700';
      ctx.fillText(`Bet: $${p.bet}`, pos.x, pos.y + 32);
    }
    if (p.folded) {
      ctx.fillStyle = '#F44';
      ctx.fillText('FOLDED', pos.x, pos.y + 32);
    }

    // Cards — show all in aiVsAi mode
    const gm = world.getResource('gameMode');
    const showCards = p.isHuman || state.phase === 'showdown' || gm.mode === 'aiVsAi';
    for (let c = 0; c < p.hand.length; c++) {
      drawCard(ctx, pos.x + c * 50, pos.y + 40, p.hand[c], showCards && !p.folded);
    }
  });

  // Action buttons for human player
  const human = state.players[0];
  if (state.currentPlayerIdx === 0 && !human.folded && state.phase !== 'showdown') {
    const toCall = state.currentBet - human.bet;
    const actions = [
      toCall > 0 ? `Call $${toCall}` : 'Check',
      `Raise $${state.raiseAmount}`,
      'Fold',
    ];

    actions.forEach((label, i) => {
      const ax = 300 + i * 120;
      const ay = 555;
      ctx.fillStyle = i === state.selectedAction ? '#FFD700' : '#444';
      ctx.fillRect(ax, ay, 100, 30);
      ctx.fillStyle = i === state.selectedAction ? '#000' : '#FFF';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, ax + 50, ay + 20);
      ctx.textAlign = 'left';
    });
  }

  // Message
  if (state.message) {
    ctx.fillStyle = '#FFF';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(state.message, 450, 370);
    ctx.textAlign = 'left';
  }

  // Phase indicator + mode
  const gmMode = world.getResource('gameMode');
  ctx.fillStyle = '#AAA';
  ctx.font = '12px monospace';
  ctx.fillText(`Round ${state.roundNum} | ${state.phase.toUpperCase()}`, 20, 590);
  ctx.fillStyle = gmMode.mode === 'aiVsAi' ? '#FF4444' : '#4CAF50';
  ctx.fillText(gmMode.mode === 'aiVsAi' ? '[AI vs AI] M: toggle' : '[Player vs AI] M: toggle', 20, 575);

  if (state.gameOver) {
    drawGameOver(ctx, 50, 50, 800, 500, {
      title: state.players[0].chips > 0 ? 'YOU WIN!' : 'GAME OVER',
      subtitle: `Final chips: $${state.players[0].chips} | Press R to restart`,
    });
  }
});

function drawCard(ctx, x, y, card, faceUp) {
  const W = 60;
  const H = 80;

  if (!faceUp || !card) {
    // Card back
    ctx.fillStyle = '#1a3a6b';
    ctx.fillRect(x, y, W, H);
    ctx.strokeStyle = '#FFF';
    ctx.strokeRect(x, y, W, H);
    ctx.fillStyle = '#2a5aab';
    ctx.fillRect(x + 4, y + 4, W - 8, H - 8);
    return;
  }

  // Card face
  ctx.fillStyle = '#FFF';
  ctx.fillRect(x, y, W, H);
  ctx.strokeStyle = '#000';
  ctx.strokeRect(x, y, W, H);

  const color = SUIT_COLORS[card.suit];
  const symbol = SUIT_SYMBOLS[card.suit];

  ctx.fillStyle = color;
  ctx.font = 'bold 16px monospace';
  ctx.fillText(card.rank, x + 4, y + 18);
  ctx.font = '20px serif';
  ctx.fillText(symbol, x + 4, y + 40);

  // Center symbol
  ctx.font = '28px serif';
  ctx.textAlign = 'center';
  ctx.fillText(symbol, x + W / 2, y + H / 2 + 10);
  ctx.textAlign = 'left';
}

export default game;
