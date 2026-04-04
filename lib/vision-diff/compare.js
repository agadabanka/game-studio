/**
 * vision-diff/compare.js — Tiered visual comparison engine.
 *
 * Compares reference keyframes against actual game screenshots using a
 * cost-escalating pipeline:
 *   Tier 0: Scene graph JSON diff (free, structural)
 *   Tier 1: Perceptual hash Hamming distance (<1ms)
 *   Tier 2: Color moment distance (<1ms)
 *   Tier 3: VLM deep analysis (last resort, ~$0.01/frame)
 *
 * Most frames short-circuit at Tier 0-1, saving ~99% of VLM calls.
 */

import { hammingDistance } from './references.js';

// Thresholds — tuned for HTML5 canvas games
const PHASH_THRESHOLD = 8;          // Out of 64 bits; <=8 = "close enough"
const COLOR_MOMENT_THRESHOLD = 50;  // Euclidean distance across 9 moments
const SCENE_GRAPH_MAX_CHANGES = 0;  // Any structural change triggers deeper look

/**
 * Diff two scene graphs structurally.
 * Scene graphs can be:
 *   - Parsed JSON from VLM analysis (has elements array)
 *   - ECS state snapshot (has entities/resources)
 *   - Text reference (has expectedElements)
 *
 * Returns { added, removed, changed, totalChanges }
 */
export function diffSceneGraphs(reference, actual) {
  const result = { added: [], removed: [], changed: [], totalChanges: 0 };

  if (!reference || !actual) {
    result.totalChanges = 1;
    return result;
  }

  // Case 1: Both are ECS state snapshots
  if (reference.entities && actual.entities) {
    const refIds = new Set(Object.keys(reference.entities));
    const actIds = new Set(Object.keys(actual.entities));

    for (const id of actIds) {
      if (!refIds.has(id)) result.added.push({ entityId: id, components: actual.entities[id] });
    }
    for (const id of refIds) {
      if (!actIds.has(id)) result.removed.push({ entityId: id, components: reference.entities[id] });
    }

    // Check component value changes on shared entities
    for (const id of refIds) {
      if (!actIds.has(id)) continue;
      const refComps = reference.entities[id];
      const actComps = actual.entities[id];
      for (const comp of Object.keys(refComps)) {
        if (!actComps[comp]) {
          result.removed.push({ entityId: id, component: comp });
        } else if (JSON.stringify(refComps[comp]) !== JSON.stringify(actComps[comp])) {
          result.changed.push({ entityId: id, component: comp, from: refComps[comp], to: actComps[comp] });
        }
      }
    }

    // Check resource changes
    if (reference.resources && actual.resources) {
      for (const name of Object.keys(reference.resources)) {
        if (JSON.stringify(reference.resources[name]) !== JSON.stringify(actual.resources[name])) {
          result.changed.push({ resource: name, from: reference.resources[name], to: actual.resources[name] });
        }
      }
    }
  }

  // Case 2: Text reference with expectedElements vs actual
  if (reference.expectedElements && actual.sceneGraph) {
    const actualElements = typeof actual.sceneGraph === 'string'
      ? actual.sceneGraph.toLowerCase()
      : JSON.stringify(actual.sceneGraph).toLowerCase();

    for (const elem of reference.expectedElements) {
      if (!actualElements.includes(elem.toLowerCase().replace(/_/g, ' ')) &&
          !actualElements.includes(elem.toLowerCase())) {
        result.removed.push({ expectedElement: elem, status: 'not found in actual' });
      }
    }
  }

  result.totalChanges = result.added.length + result.removed.length + result.changed.length;
  return result;
}

/**
 * Euclidean distance between two color moment vectors.
 * Each has { r: [mean, var, skew], g: [...], b: [...] }
 */
function colorMomentDistance(cm1, cm2) {
  if (!cm1 || !cm2) return Infinity;
  let sum = 0;
  for (const ch of ['r', 'g', 'b']) {
    for (let i = 0; i < 3; i++) {
      sum += ((cm1[ch]?.[i] || 0) - (cm2[ch]?.[i] || 0)) ** 2;
    }
  }
  return Math.sqrt(sum);
}

/**
 * Compute a delta between a reference keyframe and an actual capture.
 *
 * @param {object} reference - From generateReferenceKeyframes()
 * @param {object} actual - From captureAlignedFrames()
 * @returns {object} Delta with tier results and verdict
 */
export function computeDelta(reference, actual) {
  const delta = {
    refId: reference.id,
    scene: reference.scene,
    tiers: {},
    needsDeepAnalysis: false,
    verdict: 'UNKNOWN',
  };

  // Tier 0: Scene graph structural diff
  delta.tiers.sceneGraph = diffSceneGraphs(reference, actual);
  if (delta.tiers.sceneGraph.totalChanges === 0 && reference.pHash && actual.pHash) {
    // No structural changes — check visual similarity too
    delta.tiers.pHash = hammingDistance(reference.pHash, actual.pHash);
    if (delta.tiers.pHash <= PHASH_THRESHOLD) {
      delta.verdict = 'MATCH';
      return delta;
    }
  } else if (delta.tiers.sceneGraph.totalChanges === 0) {
    delta.verdict = 'MATCH';
    return delta;
  }

  // Tier 1: Perceptual hash
  if (reference.pHash && actual.pHash) {
    delta.tiers.pHash = hammingDistance(reference.pHash, actual.pHash);
    if (delta.tiers.pHash <= PHASH_THRESHOLD / 2) {
      delta.verdict = 'MINOR_DIFF';
      return delta;
    }
  }

  // Tier 2: Color moment distance
  if (reference.colorMoments && actual.colorMoments) {
    delta.tiers.colorMomentDist = colorMomentDistance(reference.colorMoments, actual.colorMoments);
    if (delta.tiers.pHash <= PHASH_THRESHOLD && delta.tiers.colorMomentDist < COLOR_MOMENT_THRESHOLD) {
      delta.verdict = 'ACCEPTABLE';
      return delta;
    }
  }

  // Tier 3: Needs VLM deep analysis
  delta.needsDeepAnalysis = true;
  delta.verdict = 'NEEDS_REVIEW';
  return delta;
}

/**
 * Batch compute deltas for all keyframe pairs.
 * Returns array of deltas, plus summary stats.
 */
export function computeAllDeltas(references, captures) {
  const deltas = references.map((ref, idx) => {
    const actual = captures.find(c => c.refId === ref.id) || captures[idx];
    return actual ? computeDelta(ref, actual) : {
      refId: ref.id,
      scene: ref.scene,
      verdict: 'MISSING_CAPTURE',
      needsDeepAnalysis: true,
      tiers: {},
    };
  });

  const summary = {
    total: deltas.length,
    matched: deltas.filter(d => d.verdict === 'MATCH').length,
    minor: deltas.filter(d => d.verdict === 'MINOR_DIFF').length,
    acceptable: deltas.filter(d => d.verdict === 'ACCEPTABLE').length,
    needsReview: deltas.filter(d => d.needsDeepAnalysis).length,
  };

  return { deltas, summary };
}
