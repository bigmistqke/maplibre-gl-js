# TypeScript Strict Mode Patterns

Design document for resolving TypeScript strict mode errors in the maplibre-gl-js codebase.
All fixes must follow these patterns consistently. **Do not deviate.**

## Goal

The goal is **NOT to fix bugs**. If the code would throw at a given place, we need it to throw — do not add null guards that change runtime behavior.

We are only making the existing code pass strict type checking while preserving its exact runtime semantics.

**Important:** Sometimes a variable is passed as an argument to a function and the variable's type includes `undefined`, but the function body already handles that case gracefully. In that situation, do **NOT** wrap the call site with `assertedNotNullish` or similar — instead, **change the function's type signature** to accept `undefined` (or make the parameter optional). The function already works with undefined; the types should reflect that.

```ts
// BAD: adding a runtime assertion where the function already handles undefined
doSomething(assertedNotNullish(value));

// GOOD: if doSomething already handles undefined internally, fix its signature
function doSomething(value: string | undefined) { ... }
doSomething(value);
```

## Core Principles

1. **No `!` non-null assertions** — use `assertedNotNullish()` or `assertNotNullish()` instead
2. **No `as` type casts** — except in tests (see Test Patterns below) and `keyof typeof` indexing
3. **Prefer runtime safety** — assertions throw with meaningful messages rather than silently assuming

## Assertion Utilities (from `src/util/util.ts`)

```ts
import {assertedNotNullish, assertNotNullish, isNotNullish, isNullish} from '../util/util';
```

### `assertedNotNullish<T>(value: T, message?: string): NonNullable<T>`
Returns the value if non-nullish, throws otherwise. **Use inline as an expression.**

```ts
// GOOD
const layout = assertedNotNullish(this.layers[0].layout);
const dataArr = assertedNotNullish(this.data, 'DEM data array must be initialized');
circleSortKey = assertedNotNullish(circleStyle.layout).get('circle-sort-key');

// GOOD: use optional chaining inside assertedNotNullish to avoid nesting assertions
const offset = assertedNotNullish(sectionAttributes?.imageOffset);
const name = assertedNotNullish(layer?.source?.name);

// BAD: nesting assertedNotNullish or using ! inside assertedNotNullish
const offset = assertedNotNullish(assertedNotNullish(sectionAttributes).imageOffset);
const offset = assertedNotNullish(sectionAttributes!.imageOffset);

// BAD
const layout = this.layers[0].layout!;
const dataArr = this.data as DEMData;
```

### `assertNotNullish<T>(val, message?): asserts val is T`
Assertion function — narrows the type in subsequent code. **Use as a statement.**

```ts
// GOOD
assertNotNullish(this.map);
this.map.fire('error'); // this.map is now non-null

// BAD
this.map!.fire('error');
```

### `isNotNullish<T>(value: T): value is NonNullable<T>`
Type guard for conditionals.

```ts
// GOOD
if (isNotNullish(this.scaledDistance)) {
    return this.scaledDistance * factor;
}

// BAD
if (this.scaledDistance !== undefined && this.scaledDistance !== null) {
```

### `isNullish(value): value is null | undefined`
Inverse type guard.

## Pattern Reference

### 1. Accessing potentially undefined properties

```ts
// GOOD: wrap in assertedNotNullish
const paint = assertedNotNullish(layer.paint);
if (paint.get('fill-opacity') === 0) return;

// GOOD: inline
assertedNotNullish(layer.paint).get('fill-extrusion-pattern');

// BAD
layer.paint!.get('fill-opacity');
(layer.paint as Paint).get('fill-opacity');
```

### 2. Making class properties nullable

When a property may genuinely be unset, declare it with `| undefined` or `?`:

```ts
// GOOD
layoutVertexBuffer?: VertexBuffer;
source: string | undefined;
_easeStart: number | undefined;

// BAD
layoutVertexBuffer!: VertexBuffer;  // definite assignment assertion
```

### 3. Indexing with dynamic keys (`keyof typeof`)

When indexing an object with a dynamic key, use `as keyof typeof`:

```ts
// GOOD
const verticalChar = verticalizedCharacterMap[char as keyof typeof verticalizedCharacterMap];
shaders[name as keyof typeof shaders];
touches[identifier as keyof typeof touches];

// BAD
(shaders as any)[name];
shaders[name as string];
```

### 4. `@ts-expect-error` — preserving intentional behavior

Use only when the code intentionally relies on behavior that strict mode flags, and changing it would alter runtime semantics:

```ts
// GOOD: documented reason
// @ts-expect-error - Preserves original behavior: undefined - undefined = NaN
return a.sortKey - b.sortKey;

// GOOD: document that a value can be undefined and what happens
// @ts-expect-error - UNEXPECTED BEHAVIOR: padding.left can be undefined, subtracting undefined will result in NaN
const paddingOffsetX = (padding.left - padding.right) / 2;

// BAD: suppressing without explanation
// @ts-expect-error
return a.sortKey - b.sortKey;

// BAD: using ! non-null assertion to silence the error
const paddingOffsetX = (padding.left! - padding.right!) / 2;

// BAD: adding ?? fallback that changes runtime behavior
const paddingOffsetX = ((padding.left ?? 0) - (padding.right ?? 0)) / 2;
```

### 5. Function parameter types

Make parameters nullable when the function genuinely accepts null/undefined:

```ts
// GOOD
addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number,
    canonical: CanonicalTileID, imagePositions: {[_: string]: ImagePosition},
    dashPositions: Record<string, DashEntry> | undefined,
    subdivisionGranularity: SubdivisionGranularitySetting) {

// BAD
addFeature(..., dashPositions: Record<string, DashEntry>) {  // lies about nullability
```

### 6. Return types

Declare nullable return types explicitly:

```ts
// GOOD
getGlyphsUrl(): string | null;
getId(): number | string | undefined;
```

### 7. Optional chaining for read access

Use `?.` for safe property reads, but prefer `assertedNotNullish` when the value should always exist:

```ts
// GOOD: value might legitimately be missing
layer.stateDependentLayers?.forEach(...)

// GOOD: value should exist (programmer error if it doesn't)
assertedNotNullish(layer.stateDependentLayers).forEach(...)
```

## Test File Patterns

Tests are the **only** place where `as any` / `as unknown as X` casts are acceptable, for creating mock objects:

```ts
// OK in tests
const mockPainter = new Painter(null as any, null as any);
const tileManagerMock = new TileManager(null as any, null as any, null as any);
featureIndex.insert(geojsonWrapper.feature(0) as any as VectorTileFeatureLike, ...);

// Still prefer assertedNotNullish for actual assertions in tests
expect(assertedNotNullish(bucket.features, 'bucket.features must be defined').length).toBeGreaterThan(0);
```

## Summary of What NOT To Do

| Pattern | Use Instead |
|---|---|
| `value!` | `assertedNotNullish(value)` |
| `value as Type` (in src/) | Fix the type, or use `assertedNotNullish` |
| `value as any` (in src/) | Fix the type properly |
| `// @ts-ignore` | Never use. Use `@ts-expect-error` with explanation |
| `obj[key]` with dynamic key | `obj[key as keyof typeof obj]` |
| Bare `!== undefined` checks | `isNotNullish(value)` type guard |
