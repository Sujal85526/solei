import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const A = "8f14e45f-ceea-4e7a-9b1c-1a2b3c4d5e6f";

describe("cart store (localStorage)", () => {
  let localStorage: MemoryStorage;

  beforeEach(() => {
    vi.resetModules();
    localStorage = new MemoryStorage();
    vi.stubGlobal("window", {
      localStorage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("persists under solei.cart.v1 and notifies subscribers", async () => {
    const { cart, subscribe, CART_STORAGE_KEY } = await import("./store");
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    cart.add(A, 2);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!)).toMatchObject({
      v: 1,
      lines: [{ variantId: A, qty: 2 }],
    });
    unsubscribe();
    cart.setQty(A, 3);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("returns a stable snapshot until storage changes", async () => {
    const { cart, getSnapshot } = await import("./store");
    const first = getSnapshot();
    expect(getSnapshot()).toBe(first);
    cart.add(A);
    const second = getSnapshot();
    expect(second).not.toBe(first);
    expect(getSnapshot()).toBe(second);
  });

  it("picks up changes written by another tab", async () => {
    const { getSnapshot, CART_STORAGE_KEY } = await import("./store");
    expect(getSnapshot().lines).toEqual([]);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ lines: [{ variantId: A, qty: 4 }] }));
    expect(getSnapshot().lines).toEqual([{ variantId: A, qty: 4 }]);
  });

  it("does not notify when nothing changed", async () => {
    const { cart, subscribe } = await import("./store");
    const listener = vi.fn();
    subscribe(listener);
    cart.remove(A);
    cart.setEmirate(null);
    expect(listener).not.toHaveBeenCalled();
  });

  it("is null on the server snapshot (unknown before hydration)", async () => {
    const { getServerSnapshot } = await import("./store");
    expect(getServerSnapshot()).toBeNull();
  });
});
