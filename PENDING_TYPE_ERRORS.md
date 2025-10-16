# Pending TypeScript Strict Mode Errors

These errors require type casts (`as X`) to resolve. Casts require explicit user permission per CLAUDE.md rules.

## Status: Awaiting Permission

---

### 1. mercator_covering_tiles_details_provider.ts

**File:** `src/geo/projection/mercator_covering_tiles_details_provider.ts`
**Line:** Affects `mercator_transform.ts:300`
**Error:**
```
Type 'MercatorCoveringTilesDetailsProvider' is not assignable to type 'CoveringTilesDetailsProvider<IBoundingVolume>'.
Types of property 'distanceToTile2d' are incompatible.
```

**Problem:** `MercatorCoveringTilesDetailsProvider` implements `CoveringTilesDetailsProvider<Aabb>`, but `distanceToTile2d` takes `Aabb` (specific) while the interface expects `IBoundingVolume` (general). This is a contravariance issue.

**Proposed Fix:** Change parameter type to `IBoundingVolume` and cast internally:
```typescript
distanceToTile2d(... boundingVolume: IBoundingVolume): number {
    const aabb = boundingVolume as Aabb;  // NEEDS PERMISSION
    ...
}
```

**Alternative:** Fix the interface to use covariant generics (larger refactor).

---

### 2. program.ts (2 errors)

**File:** `src/render/program.ts`
**Lines:** 205, 213
**Error:**
```
Argument of type 'number | number[] | WebGLTexture | IndexedCollection | Tuple | Tile | null | undefined'
is not assignable to parameter of type '(number & IndexedCollection) | ...'
```

**Problem:** When iterating over object keys with `for (const name in obj)`, TypeScript gives `data` the union of ALL property types, but `set()` expects a specific type for each uniform.

**Proposed Fix:**
```typescript
this.terrainUniforms[name].set(data as any);     // Line 205 - NEEDS PERMISSION
this.projectionUniforms[uniformName].set(data as any);  // Line 213 - NEEDS PERMISSION
```

**Alternative:** Refactor to avoid dynamic property access (significant change).

---

### 3. line_style_layer.ts

**File:** `src/style/style_layer/line_style_layer.ts`
**Line:** 79
**Error:**
```
Argument of type 'PropertyValue<unknown, unknown>' is not assignable to
parameter of type 'PropertyValue<number, PossiblyEvaluatedPropertyValue<number>>'
```

**Problem:** `Transitioning._values` is typed with `unknown` generics, so accessing `._values['line-width']` returns `PropertyValue<unknown, unknown>`.

**Proposed Fix:**
```typescript
lineFloorwidthProperty.possiblyEvaluate(
    (assertedNotNullish(this._transitioningPaint)._values['line-width'] as any).value,  // NEEDS PERMISSION
    parameters
);
```

**Alternative:** Fix the `Transitioning` class to have proper generic typing (larger refactor).

---

### 4. map.ts - Delegate iteration (2 errors)

**File:** `src/ui/map.ts`
**Lines:** 1672, 1674
**Error:**
```
Type 'Delegate<MapMouseEvent> | Delegate<MapLibreEvent<unknown>> | ...' is not assignable to type '...'
Argument of type 'Event' is not assignable to parameter of type 'never'
```

**Problem:** When iterating over `delegates` object with `for (const key in delegates)`, TypeScript can't narrow the delegate type properly for assignment and calling.

**Proposed Fix:**
```typescript
const delegate = delegatedListener.delegates[eventKey] as Delegate | undefined;  // NEEDS PERMISSION
if (delegate) {
    (delegatedListener.delegates as Record<string, Delegate>)[eventKey] = ...  // NEEDS PERMISSION
}
```

**Alternative:** Restructure the code to avoid dynamic property iteration (significant change).

---

### 5. map.ts - webglcontextcreationerror

**File:** `src/ui/map.ts`
**Line:** 3237
**Error:**
```
No overload matches this call.
Argument of type '"webglcontextcreationerror"' is not assignable to parameter of type 'keyof HTMLElementEventMap'.
```

**Problem:** `'webglcontextcreationerror'` is not in TypeScript's `HTMLElementEventMap`, and the callback type `(args: WebGLContextEvent) => void` doesn't match `EventListener`.

**Proposed Fix:**
```typescript
canvas.addEventListener('webglcontextcreationerror', ((args: WebGLContextEvent) => {
    ...
}) as EventListener, {once: true});  // NEEDS PERMISSION
```

**Alternative:** Add a type declaration file to extend `HTMLElementEventMap` with `webglcontextcreationerror`.

---

## Summary

| # | File | Line(s) | Cast Needed | Status |
|---|------|---------|-------------|--------|
| 1 | mercator_covering_tiles_details_provider.ts | - | `as Aabb` | Pending |
| 2 | program.ts | 205 | `as any` | Pending |
| 3 | program.ts | 213 | `as any` | Pending |
| 4 | line_style_layer.ts | 79 | `as any` | Pending |
| 5 | map.ts | 1672 | `as Delegate \| undefined` | Pending |
| 6 | map.ts | 1673 | `as Record<string, Delegate>` | Pending |
| 7 | map.ts | 3237 | `as EventListener` | Pending |

**Total: 7 casts pending approval**
