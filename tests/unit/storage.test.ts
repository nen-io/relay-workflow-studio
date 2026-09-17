import { expect, it } from "vitest";
import { seed } from "../../src/domain/fixtures";
import { restore, save, STORAGE_KEY } from "../../src/domain/storage";
it("restores only a validated saved workflow", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  expect(save(storage, seed)).toBe("");
  expect(restore(storage, { ...seed, name: "fallback" }).workflow.name).toBe(
    seed.name,
  );
  data.set(STORAGE_KEY, "corrupt");
  expect(restore(storage, seed)).toMatchObject({
    workflow: seed,
    warning: expect.stringContaining("could not be restored"),
  });
});
it("storage denial is nonfatal and visible", () => {
  const storage = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("quota");
    },
  };
  expect(restore(storage, seed).warning).toContain("could not be restored");
  expect(save(storage, seed)).toContain("not saved");
});
it("an invalid draft never overwrites the last valid draft", () => {
  let value = JSON.stringify(seed);
  const storage = {
    getItem: () => value,
    setItem: (_: string, next: string) => {
      value = next;
    },
  };
  expect(save(storage, { ...seed, edges: [] })).toContain("not saved");
  expect(restore(storage, seed).workflow).toEqual(seed);
});
