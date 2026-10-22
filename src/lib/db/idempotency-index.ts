import type { IndexDescription } from "mongodb";

const INDEX_KEY = { userId: 1, idempotencyKey: 1 } as const;
const PARTIAL_FILTER = {
  userId: { $type: "string" },
  idempotencyKey: { $type: "string" },
} as const;

export type IdempotencyIndexCollection = {
  createIndex(
    key: typeof INDEX_KEY,
    options: { unique: true; partialFilterExpression: typeof PARTIAL_FILTER },
  ): Promise<string>;
  listIndexes(): { toArray(): Promise<IndexDescription[]> };
  dropIndex(name: string): Promise<unknown>;
};

function indexEntries(index: IndexDescription): [string, unknown][] {
  return index.key instanceof Map ? [...index.key.entries()] : Object.entries(index.key);
}

function hasKeyPattern(index: IndexDescription, expected: Record<string, unknown>): boolean {
  const entries = indexEntries(index);
  const expectedEntries = Object.entries(expected);
  return (
    entries.length === expectedEntries.length &&
    entries.every(
      ([field, direction], position) =>
        field === expectedEntries[position]?.[0] && direction === expectedEntries[position]?.[1],
    )
  );
}

function hasCompoundIdempotencyFields(index: IndexDescription): boolean {
  const fields = indexEntries(index).map(([field]) => field);
  return (
    fields.length === 2 &&
    fields.includes("userId") &&
    fields.includes("idempotencyKey")
  );
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

function samePartialFilter(value: unknown): boolean {
  return JSON.stringify(canonicalize(value)) === JSON.stringify(canonicalize(PARTIAL_FILTER));
}

function isCompatibleCompoundIndex(index: IndexDescription): boolean {
  const collationIsSimple =
    index.collation === undefined ||
    (index.collation.locale === "simple" && Object.keys(index.collation).length === 1);

  return (
    hasKeyPattern(index, INDEX_KEY) &&
    index.unique === true &&
    samePartialFilter(index.partialFilterExpression) &&
    index.sparse !== true &&
    index.expireAfterSeconds === undefined &&
    collationIsSimple
  );
}

function legacyIndexDisposition(index: IndexDescription): "legacy" | "unrelated" {
  const entries = indexEntries(index);
  if (
    index.unique !== true ||
    entries.length !== 1 ||
    entries[0]?.[0] !== "idempotencyKey"
  ) {
    return "unrelated";
  }

  if (index.partialFilterExpression !== undefined) {
    throw new Error(
      `Unique idempotencyKey index "${index.name ?? "(unnamed)"}" has a partial filter. ` +
        "Its scope cannot be safely inferred; inspect it and resolve it manually.",
    );
  }

  if (entries[0][1] !== 1 && entries[0][1] !== -1) {
    throw new Error(
      `Unique idempotencyKey index "${index.name ?? "(unnamed)"}" has an unsupported key direction. ` +
        "Inspect it and resolve it manually.",
    );
  }

  return "legacy";
}

function assertNoConflictingCompoundIndex(indexes: IndexDescription[]): void {
  const matching = indexes.filter(hasCompoundIdempotencyFields);
  const incompatible = matching.find((index) => !isCompatibleCompoundIndex(index));
  if (incompatible) {
    throw new Error(
      `Existing compound index "${incompatible.name ?? "(unnamed)"}" on ` +
        "{ userId: 1, idempotencyKey: 1 } has incompatible options. " +
        "Expected unique:true with the string-fields partial filter; inspect and resolve it manually.",
    );
  }
}

/**
 * Ensures the user-scoped unique index before removing only confirmed,
 * global single-field idempotency indexes.
 */
export async function ensureIdempotencyIndex(
  collection: IdempotencyIndexCollection,
): Promise<string[]> {
  let indexes = await collection.listIndexes().toArray();
  assertNoConflictingCompoundIndex(indexes);

  // A partial unique legacy index may impose only a narrower constraint. Do
  // not guess whether it is obsolete or delete it automatically.
  for (const index of indexes) legacyIndexDisposition(index);

  if (!indexes.some((index) => isCompatibleCompoundIndex(index))) {
    await collection.createIndex(INDEX_KEY, {
      unique: true,
      partialFilterExpression: PARTIAL_FILTER,
    });

    indexes = await collection.listIndexes().toArray();
    assertNoConflictingCompoundIndex(indexes);
  }

  const verified = indexes.find((index) => isCompatibleCompoundIndex(index));
  if (!verified) {
    throw new Error(
      "MongoDB did not report the expected unique compound idempotency index after creation. " +
        "No legacy idempotency indexes were removed.",
    );
  }

  const legacyIndexes = indexes.filter(
    (index) => legacyIndexDisposition(index) === "legacy",
  );
  if (legacyIndexes.some((index) => !index.name)) {
    throw new Error(
      "A legacy unique idempotency index has no reported name; it cannot be safely removed.",
    );
  }
  const legacyNames = legacyIndexes.flatMap((index) => (index.name ? [index.name] : []));

  for (const name of legacyNames) {
    await collection.dropIndex(name);
  }
  return legacyNames;
}
