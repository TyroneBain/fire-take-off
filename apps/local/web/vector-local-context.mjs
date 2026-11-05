// Geometry evidence only. Caller retains body matching, class discrimination and
// original all-layer paint verification. No canvas, saved counts or PDF mutation.
export const LOCAL_CONTEXT_VERSION = 'local-fill-context-1';

const LIMITS = Object.freeze({ elements: 128, edges: 4096, coordinates: 32768, work: 2000000 });
const IDENTITY = [1, 0, 0, 1, 0, 0];
const finite = n => Number.isFinite(n) && Math.abs(n) <= 1e7;
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const on = (a, b, c) => cross(a, b, c) === 0 && c[0] >= Math.min(a[0], b[0]) && c[0] <= Math.max(a[0], b[0]) && c[1] >= Math.min(a[1], b[1]) && c[1] <= Math.max(a[1], b[1]);

/**
 * Compare explicitly erased, opaque, complete filled operations in a common pose.
 * polygonBoolean is the pinned polygon-clipping {union, intersection, xor} API.
 * Source/target records and their PDF ownership are caller-attested; this helper
 * does not attest document identity, clipping, or original-pixel visibility.
 * sourceTransform applies one rigid pose to ALL source geometry. No local refit.
 * Unsupported input/budget/cancellation returns no partial explained identities.
 */
export function compareLocalContext({ sourceElements, targetElements, sourceExcludedIds,
  sourceRecords, targetRecords, sourceTransform = IDENTITY, polygonBoolean,
  tolerance = 0.05, maxWork = LIMITS.work, cancelled = () => false } = {}) {
  let work = 0, edges = 0, coordinates = 0;
  const base = { version: LOCAL_CONTEXT_VERSION, requiresOriginalPaintVerification: true, requiresSemanticReview: true };
  const check = (amount = 1) => {
    work += amount;
    if (cancelled()) throw Error('Local context comparison cancelled');
    if (work > maxWork) throw Error('Local context work budget exceeded');
  };
  const fail = reason => ({ ...base, supported: false, equivalent: false, explainedTargetIds: [], unexplainedTargetIds: [], sourceFragments: [], targetFragments: [], work, reason });
  try {
    if (!Number.isInteger(maxWork) || maxWork < 1 || maxWork > LIMITS.work || typeof cancelled !== 'function') throw Error('Invalid local context budget');
    check();
    if (!polygonBoolean || ['union', 'intersection', 'xor'].some(k => typeof polygonBoolean[k] !== 'function')) throw Error('Missing polygon Boolean API');
    if (!Number.isFinite(tolerance) || tolerance <= 0 || tolerance > 0.05) throw Error('Invalid local context tolerance');
    if (!Array.isArray(sourceElements) || !Array.isArray(targetElements) || !sourceElements.length || sourceElements.length + targetElements.length > LIMITS.elements) throw Error('Local context element budget exceeded');
    if (!Array.isArray(sourceExcludedIds) || sourceExcludedIds.length > LIMITS.elements || sourceExcludedIds.some(id => !Number.isInteger(id) || id < 0)) throw Error('Invalid explicit source exclusions');
    if (!Array.isArray(sourceTransform) || sourceTransform.length !== 6 || sourceTransform.some(n => !finite(n))) throw Error('Invalid common source transform');
    const [a, b, c, d] = sourceTransform;
    if (Math.abs(a * a + b * b - 1) > 1e-10 || Math.abs(c * c + d * d - 1) > 1e-10 || Math.abs(a * c + b * d) > 1e-10 || Math.abs(a * d - b * c - 1) > 1e-10) throw Error('Source transform must be a rigid non-reflected pose');
    const excluded = new Set(sourceExcludedIds);
    const records = list => {
      if (!Array.isArray(list) || list.length > LIMITS.elements) throw Error('Invalid local context provenance');
      const map = new Map();
      for (const record of list) {
        check();
        if (!record || !Number.isInteger(record.id) || map.has(record.id)) throw Error('Duplicate or invalid provenance identity');
        map.set(record.id, record);
      }
      return map;
    };
    const sr = records(sourceRecords), tr = records(targetRecords);
    const boolean = (kind, ...geometries) => {
      // Conservative worst-case intersection work is charged before synchronous
      // library entry. Input/output bounds cap the uninterruptible operation.
      const n = geometries.reduce((total, g) => total + g.reduce((s, p) => s + p.reduce((v, r) => v + r.length, 0), 0), 0);
      check(n * n + 1);
      const result = polygonBoolean[kind](...geometries);
      check();
      let count = 0;
      if (!Array.isArray(result)) throw Error('Invalid Boolean output');
      for (const polygon of result) for (const ring of polygon) for (const point of ring) {
        if (++count > LIMITS.edges || !Array.isArray(point) || point.length !== 2 || point.some(n => !finite(n))) throw Error('Local context Boolean output budget exceeded');
      }
      return result;
    };
    const parse = (elements, metadata, matrix, isSource) => {
      const ids = new Set(), parsed = [], fragments = [];
      for (const element of elements) {
        check();
        const id = element?.id, record = metadata.get(id), style = element?.style;
        if (!Number.isInteger(id) || id < 0 || ids.has(id) || isSource && !excluded.has(id)) throw Error('Context is not an explicit whole-operation selection');
        ids.add(id);
        if (!record || record.wholeOperation !== true || record.opaque !== true || record.contextComplete !== true || record.optionalContentVisible === false) throw Error('Unverified context graphics state');
        if (!style || typeof style.fill !== 'string' || !/^#[0-9a-f]{6}$/i.test(style.fill) || style.stroke != null || !['nonzero', 'evenodd'].includes(style.rule)) throw Error('Only opaque un-stroked filled paths are eligible');
        const key = JSON.stringify([style.fill, style.stroke, style.width, style.cap, style.join, style.miter, style.rule]);
        const commands = element.pathCommands;
        if (!Array.isArray(commands) || !commands.length || commands.length > LIMITS.coordinates || (coordinates += commands.length) > LIMITS.coordinates || commands.some(n => !finite(n))) throw Error('Invalid or excessive original path commands');
        let loop = null, start = -1;
        const loops = [];
        for (let i = 0; i < commands.length;) {
          check();
          const index = i, op = commands[i++];
          if (op === 0 || op === 1) {
            if (i + 1 >= commands.length || op === 0 && loop || op === 1 && !loop) throw Error('Invalid closed line path');
            const x = commands[i++], y = commands[i++];
            const point = [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]];
            if (point.some(n => !finite(n))) throw Error('Invalid transformed context coordinate');
            if (op === 0) { loop = [point]; start = index; }
            else if (!same(loop.at(-1), point)) loop.push(point);
          } else if (op === 4 && loop) {
            if (same(loop[0], loop.at(-1))) loop.pop();
            if (loop.length < 3 || (edges += loop.length) > LIMITS.edges) throw Error('Degenerate or excessive fill boundary');
            let simple = true, area = 0;
            for (let j = 0; j < loop.length; j++) {
              const p = loop[j], q = loop[(j + 1) % loop.length];
              area += cross(loop[0], p, q);
              for (let k = j + 2; k < loop.length; k++) {
                if (j === 0 && k === loop.length - 1) continue;
                check();
                const r = loop[k], s = loop[(k + 1) % loop.length];
                if (cross(p, q, r) * cross(p, q, s) < 0 && cross(r, s, p) * cross(r, s, q) < 0 || on(p, q, r) || on(p, q, s) || on(r, s, p) || on(r, s, q)) simple = false;
              }
            }
            if (!simple && style.rule !== 'nonzero') throw Error('Self-intersecting even-odd context is unsupported');
            const normalized = boolean('union', [[loop]]);
            if (!normalized.length) throw Error('Empty context subpath is unsupported');
            const fragment = { elementId: id, subpathIndex: loops.length, commandRange: [start, i], originalCommands: commands.slice(start, i), commonPoseBoundary: loop.map(p => [...p]), wholeSubpath: true };
            fragments.push(fragment);
            loops.push({ normalized, simple, sign: Math.sign(area) });
            loop = null;
          } else throw Error('Only explicitly closed straight fill subpaths are eligible');
        }
        if (loop || !loops.length) throw Error('Unclosed context subpath');
        if (style.rule === 'nonzero') {
          for (let i = 0; i < loops.length; i++) for (let j = i + 1; j < loops.length; j++) {
            if (!boolean('intersection', loops[i].normalized, loops[j].normalized).length) continue;
            if (!loops[i].simple || !loops[j].simple || !loops[i].sign || loops[i].sign !== loops[j].sign) throw Error('Compound winding interaction is unsupported');
          }
        }
        const region = loops.length === 1 ? loops[0].normalized : boolean(style.rule === 'evenodd' ? 'xor' : 'union', ...loops.map(l => l.normalized));
        if (!region.length) throw Error('Empty whole-operation context is unsupported');
        parsed.push({ id, key, region });
      }
      return { parsed, fragments };
    };
    const source = parse(sourceElements, sr, sourceTransform, true), target = parse(targetElements, tr, IDENTITY, false);
    const distance = (p, ring) => {
      let best = Infinity;
      for (let i = 1; i < ring.length; i++) {
        check();
        const u = ring[i - 1], v = ring[i], dx = v[0] - u[0], dy = v[1] - u[1], len = dx * dx + dy * dy;
        const t = len ? Math.max(0, Math.min(1, ((p[0] - u[0]) * dx + (p[1] - u[1]) * dy) / len)) : 0;
        best = Math.min(best, Math.hypot(p[0] - u[0] - t * dx, p[1] - u[1] - t * dy));
      }
      return best;
    };
    const coveredBoundary = (ring, other) => {
      for (let i = 1; i < ring.length; i++) {
        const stack = [[ring[i - 1], ring[i], 0]];
        while (stack.length) {
          check();
          const [p, q, depth] = stack.pop(), dp = distance(p, other), dq = distance(q, other);
          if (dp > tolerance || dq > tolerance) return false;
          // The distance to a closed set is 1-Lipschitz. This certifies every
          // point on the segment, not only a fixed set of sampled vertices.
          const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
          if ((dp + dq + length) / 2 <= tolerance) continue;
          if (depth >= 20) throw Error('Context boundary tolerance could not be certified');
          const middle = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
          stack.push([p, middle, depth + 1], [middle, q, depth + 1]);
        }
      }
      return true;
    };
    const equalRing = (a, b) => coveredBoundary(a, b) && coveredBoundary(b, a);
    const equalPolygon = (a, b) => {
      if (a.length !== b.length || !equalRing(a[0], b[0])) return false;
      const used = new Set();
      for (let i = 1; i < a.length; i++) {
        const matches = [];
        for (let j = 1; j < b.length; j++) if (!used.has(j) && equalRing(a[i], b[j])) matches.push(j);
        if (matches.length !== 1) return false;
        used.add(matches[0]);
      }
      return true;
    };
    const explained = [], unexplained = [], support = [];
    for (const key of new Set(target.parsed.map(e => e.key))) {
      const s = source.parsed.filter(e => e.key === key), t = target.parsed.filter(e => e.key === key);
      if (!s.length) { unexplained.push(...t.map(e => e.id)); continue; }
      const su = boolean('union', ...s.map(e => e.region)), tu = boolean('union', ...t.map(e => e.region));
      const used = new Set();
      let equivalent = true;
      for (const component of tu) {
        const matches = [];
        for (let i = 0; i < su.length; i++) if (!used.has(i) && equalPolygon(component, su[i])) matches.push(i);
        if (matches.length !== 1) { equivalent = false; break; }
        used.add(matches[0]);
      }
      // Entire source components are optional context. Each target component
      // must equal a complete source component; subset containment is not enough.
      if (equivalent) {
        explained.push(...t.map(e => e.id));
        support.push({ sourceElementIds: s.map(e => e.id), targetElementIds: t.map(e => e.id), sourceRegions: su, targetRegions: tu, completeOperations: true });
      } else unexplained.push(...t.map(e => e.id));
    }
    check();
    return { ...base, supported: true, equivalent: unexplained.length === 0, explainedTargetIds: explained.sort((a, b) => a - b), unexplainedTargetIds: unexplained.sort((a, b) => a - b), sourceFragments: source.fragments, targetFragments: target.fragments, support, work };
  } catch (error) { return fail(error.message || 'Unsupported local context'); }
}
