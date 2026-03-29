/**
 * @engine/animate — Animation and tweening module.
 *
 * Provides frame-based animation helpers for smooth transitions.
 * Addresses the SDK gap where all movement is instant (no tweening).
 *
 * Usage:
 *   import { createTween, updateTweens, easeInOut } from '@engine/animate';
 *
 *   // In a system:
 *   const tween = createTween(entity, 'x', 0, 100, 0.5, easeInOut);
 *   tweens.push(tween);
 *
 *   // In render/update system:
 *   updateTweens(tweens, dt);
 */

// --- Easing Functions ---

/** Linear interpolation (no easing) */
export function linear(t) { return t; }

/** Ease in (slow start) */
export function easeIn(t) { return t * t; }

/** Ease out (slow end) */
export function easeOut(t) { return t * (2 - t); }

/** Ease in-out (slow start and end) */
export function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

/** Bounce easing */
export function bounce(t) {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
  if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
  t -= 2.625 / 2.75; return 7.5625 * t * t + 0.984375;
}

/** Elastic easing */
export function elastic(t) {
  if (t === 0 || t === 1) return t;
  return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
}

// --- Tween Management ---

/**
 * Create a tween object.
 *
 * @param {Object} target - Object to animate (e.g., position component)
 * @param {string} property - Property name to animate (e.g., 'x')
 * @param {number} from - Start value
 * @param {number} to - End value
 * @param {number} duration - Duration in seconds
 * @param {Function} [easing] - Easing function (default: linear)
 * @param {Object} [opts] - Options
 * @param {Function} [opts.onComplete] - Callback when tween finishes
 * @param {number} [opts.delay] - Delay before starting (seconds)
 * @returns {Tween}
 */
export function createTween(target, property, from, to, duration, easing = linear, opts = {}) {
  return {
    target,
    property,
    from,
    to,
    duration,
    easing,
    elapsed: 0,
    delay: opts.delay || 0,
    delayElapsed: 0,
    done: false,
    onComplete: opts.onComplete || null,
  };
}

/**
 * Create a tween that animates along a sequence of waypoints.
 *
 * @param {Object} target - Object to animate
 * @param {string} xProp - X property name
 * @param {string} yProp - Y property name
 * @param {{ x: number, y: number }[]} waypoints - Path to follow
 * @param {number} speed - Pixels per second
 * @param {Function} [easing] - Easing function
 * @param {Object} [opts]
 * @returns {PathTween}
 */
export function createPathTween(target, xProp, yProp, waypoints, speed, easing = linear, opts = {}) {
  // Calculate total distance
  let totalDist = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const dx = waypoints[i].x - waypoints[i - 1].x;
    const dy = waypoints[i].y - waypoints[i - 1].y;
    totalDist += Math.sqrt(dx * dx + dy * dy);
  }

  return {
    target,
    xProp,
    yProp,
    waypoints,
    totalDistance: totalDist,
    duration: totalDist / speed,
    easing,
    elapsed: 0,
    done: false,
    isPath: true,
    onComplete: opts.onComplete || null,
  };
}

/**
 * Update all tweens by delta time. Removes completed tweens.
 *
 * @param {Array} tweens - Mutable array of tween objects
 * @param {number} dt - Delta time in seconds
 */
export function updateTweens(tweens, dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];

    // Handle delay
    if (tw.delay > 0) {
      tw.delayElapsed += dt;
      if (tw.delayElapsed < tw.delay) continue;
      dt = tw.delayElapsed - tw.delay;
      tw.delay = 0;
    }

    tw.elapsed += dt;
    const rawT = Math.min(tw.elapsed / tw.duration, 1);
    const t = tw.easing(rawT);

    if (tw.isPath) {
      // Path tween: interpolate along waypoints
      const totalT = t * tw.totalDistance;
      let accumulated = 0;

      for (let w = 1; w < tw.waypoints.length; w++) {
        const prev = tw.waypoints[w - 1];
        const curr = tw.waypoints[w];
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const segLen = Math.sqrt(dx * dx + dy * dy);

        if (accumulated + segLen >= totalT) {
          const segT = (totalT - accumulated) / segLen;
          tw.target[tw.xProp] = prev.x + dx * segT;
          tw.target[tw.yProp] = prev.y + dy * segT;
          break;
        }
        accumulated += segLen;
      }

      if (rawT >= 1) {
        const last = tw.waypoints[tw.waypoints.length - 1];
        tw.target[tw.xProp] = last.x;
        tw.target[tw.yProp] = last.y;
      }
    } else {
      // Simple property tween
      tw.target[tw.property] = tw.from + (tw.to - tw.from) * t;
    }

    if (rawT >= 1) {
      tw.done = true;
      if (tw.onComplete) tw.onComplete();
      tweens.splice(i, 1);
    }
  }
}

/**
 * Check if any tweens are still active.
 * @param {Array} tweens
 * @returns {boolean}
 */
export function isAnimating(tweens) {
  return tweens.length > 0;
}

/**
 * Lerp (linear interpolation) helper.
 * @param {number} a - Start
 * @param {number} b - End
 * @param {number} t - Progress (0-1)
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
