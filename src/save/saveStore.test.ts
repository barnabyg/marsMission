import { describe, expect, it } from "vitest";
import { createSimulation } from "../simulation/simulation";
import { testCatalogue } from "../simulation/testCatalogue";
import { createSaveStore, storageKeyFor } from "./saveStore";

function fakeStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
  };
}

function setup() {
  const simulation = createSimulation(testCatalogue());
  const storage = fakeStorage();
  return {
    simulation,
    storage,
    store: createSaveStore(storage, simulation),
    program: simulation.startProgram(42),
  };
}

describe("the Save Store", () => {
  it("reports nothing saved in a new browser", () => {
    const { store } = setup();
    expect(store.load("automatic")).toEqual({ kind: "empty" });
  });

  it("gives back the Program it was given", () => {
    const { store, program } = setup();
    expect(store.save("automatic", program)).toBe(true);
    expect(store.load("automatic")).toEqual({ kind: "program", program });
  });

  it("keeps the save after being reopened, as when the browser closes", () => {
    const { simulation, storage, store, program } = setup();
    store.save("automatic", program);
    expect(createSaveStore(storage, simulation).load("automatic")).toEqual({
      kind: "program",
      program,
    });
  });

  it("clears a save", () => {
    const { store, program } = setup();
    store.save("automatic", program);
    store.clear("automatic");
    expect(store.load("automatic")).toEqual({ kind: "empty" });
  });

  it("gives a clear message for a save that isn't valid JSON", () => {
    const { storage, store } = setup();
    storage.setItem(storageKeyFor("automatic"), "{not json");
    const loaded = store.load("automatic");
    expect(loaded).toMatchObject({ kind: "problem" });
    expect(JSON.stringify(loaded)).toMatch(/corrupt/);
  });

  it("gives a clear message for a save from an unknown format version", () => {
    const { storage, store } = setup();
    storage.setItem(
      storageKeyFor("automatic"),
      JSON.stringify({ formatVersion: 99, program: {} }),
    );
    const loaded = store.load("automatic");
    expect(loaded).toMatchObject({ kind: "problem" });
    expect(JSON.stringify(loaded)).toMatch(/format 99/);
  });

  it("reports a failed write rather than throwing, as when storage is full", () => {
    const { simulation, program } = setup();
    const store = createSaveStore(
      {
        ...fakeStorage(),
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
      simulation,
    );
    expect(store.save("automatic", program)).toBe(false);
  });

  it("treats storage it can't read as having nothing saved", () => {
    const { simulation } = setup();
    const store = createSaveStore(
      {
        ...fakeStorage(),
        getItem: () => {
          throw new Error("SecurityError");
        },
      },
      simulation,
    );
    expect(store.load("automatic")).toEqual({ kind: "empty" });
  });
});
