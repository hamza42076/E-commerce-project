import { describe, expect, it, vi } from "vitest";
import type { IndexDescription } from "mongodb";
import {
  ensureIdempotencyIndex,
  type IdempotencyIndexCollection,
} from "./idempotency-index";

const compound: IndexDescription = {
  name: "userId_1_idempotencyKey_1",
  key: { userId: 1, idempotencyKey: 1 },
  unique: true,
  partialFilterExpression: {
    userId: { $type: "string" },
    idempotencyKey: { $type: "string" },
  },
};

function mockCollection(initial: IndexDescription[] = []) {
  let indexes = [{ name: "_id_", key: { _id: 1 } }, ...initial] as IndexDescription[];
  const calls: string[] = [];

  const collection: IdempotencyIndexCollection = {
    createIndex: vi.fn(async () => {
      calls.push("create");
      indexes = [...indexes, compound];
      return compound.name!;
    }),
    listIndexes: vi.fn(() => ({
      toArray: async () => {
        calls.push("list");
        return indexes;
      },
    })),
    dropIndex: vi.fn(async (name: string) => {
      calls.push(`drop:${name}`);
      indexes = indexes.filter((index) => index.name !== name);
    }),
  };

  return { collection, calls };
}

describe("ensureIdempotencyIndex", () => {
  it.each([1, -1])("replaces a global unique legacy index with direction %s", async (direction) => {
    const legacyName = `idempotencyKey_${direction}`;
    const { collection, calls } = mockCollection([
      {
        name: legacyName,
        key: { idempotencyKey: direction },
        unique: true,
        sparse: true,
      },
    ]);

    const removed = await ensureIdempotencyIndex(collection);

    expect(calls).toEqual(["list", "create", "list", `drop:${legacyName}`]);
    expect(removed).toEqual([legacyName]);
  });

  it("keeps an already compatible compound index on rerun", async () => {
    const { collection, calls } = mockCollection([compound]);

    await expect(ensureIdempotencyIndex(collection)).resolves.toEqual([]);

    expect(calls).toEqual(["list"]);
    expect(collection.createIndex).not.toHaveBeenCalled();
    expect(collection.dropIndex).not.toHaveBeenCalled();
  });

  it.each([
    { ...compound, unique: false },
    { ...compound, key: { idempotencyKey: 1, userId: 1 } },
    { ...compound, key: { userId: -1, idempotencyKey: 1 } },
    {
      ...compound,
      partialFilterExpression: { userId: { $type: "string" } },
    },
    { ...compound, sparse: true },
    { ...compound, collation: { locale: "en", strength: 2 } },
  ])("stops on an incompatible compound index without changing indexes", async (index) => {
    const legacyName = "legacy_idempotency_unique";
    const { collection, calls } = mockCollection([
      index,
      { name: legacyName, key: { idempotencyKey: 1 }, unique: true },
    ]);

    await expect(ensureIdempotencyIndex(collection)).rejects.toThrow(
      /incompatible options/,
    );

    expect(calls).toEqual(["list"]);
    expect(collection.createIndex).not.toHaveBeenCalled();
    expect(collection.dropIndex).not.toHaveBeenCalled();
  });

  it("does not remove unrelated indexes", async () => {
    const unrelated = [
      { name: "idempotencyKey_lookup", key: { idempotencyKey: 1 } },
      { name: "other_unique", key: { other: 1 }, unique: true },
    ] as IndexDescription[];
    const { collection } = mockCollection(unrelated);

    await expect(ensureIdempotencyIndex(collection)).resolves.toEqual([]);

    expect(collection.dropIndex).not.toHaveBeenCalled();
  });

  it("refuses an ambiguous partial unique single-field index before mutation", async () => {
    const { collection, calls } = mockCollection([
      {
        name: "partial_unique_idempotency",
        key: { idempotencyKey: 1 },
        unique: true,
        partialFilterExpression: { enabled: true },
      },
    ]);

    await expect(ensureIdempotencyIndex(collection)).rejects.toThrow(/partial filter/);

    expect(calls).toEqual(["list"]);
    expect(collection.createIndex).not.toHaveBeenCalled();
    expect(collection.dropIndex).not.toHaveBeenCalled();
  });

  it("does not drop legacy indexes when compound-index creation fails", async () => {
    const { collection, calls } = mockCollection([
      {
        name: "legacy_idempotency_unique",
        key: { idempotencyKey: 1 },
        unique: true,
      },
    ]);
    vi.mocked(collection.createIndex).mockImplementationOnce(async () => {
      calls.push("create");
      throw new Error("index conflict");
    });

    await expect(ensureIdempotencyIndex(collection)).rejects.toThrow("index conflict");

    expect(calls).toEqual(["list", "create"]);
    expect(collection.dropIndex).not.toHaveBeenCalled();
  });

  it("does not drop legacy indexes if MongoDB does not report the created index", async () => {
    const { collection, calls } = mockCollection([
      {
        name: "legacy_idempotency_unique",
        key: { idempotencyKey: -1 },
        unique: true,
      },
    ]);
    vi.mocked(collection.listIndexes).mockImplementation(() => ({
      toArray: async () => {
        calls.push("list");
        return [
          { name: "_id_", key: { _id: 1 } },
          {
            name: "legacy_idempotency_unique",
            key: { idempotencyKey: -1 },
            unique: true,
          },
        ] as IndexDescription[];
      },
    }));

    await expect(ensureIdempotencyIndex(collection)).rejects.toThrow(
      /No legacy idempotency indexes were removed/,
    );

    expect(calls).toEqual(["list", "create", "list"]);
    expect(collection.dropIndex).not.toHaveBeenCalled();
  });
});
