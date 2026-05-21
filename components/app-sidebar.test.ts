import { describe, expect, it } from "vitest";
import { isActiveRoute, NAV_ITEMS } from "./app-sidebar";

describe("isActiveRoute", () => {
  it("only matches '/' exactly for the Dashboard item", () => {
    expect(isActiveRoute("/", "/")).toBe(true);
    expect(isActiveRoute("/opportunities", "/")).toBe(false);
    expect(isActiveRoute("/applications/123", "/")).toBe(false);
  });

  it("matches exact path", () => {
    expect(isActiveRoute("/opportunities", "/opportunities")).toBe(true);
    expect(isActiveRoute("/profile", "/profile")).toBe(true);
  });

  it("matches child paths under a nav item", () => {
    expect(isActiveRoute("/applications/abc", "/applications")).toBe(true);
    expect(isActiveRoute("/interviews/xyz/notes", "/interviews")).toBe(true);
  });

  it("does not match an unrelated path that shares a prefix string", () => {
    expect(isActiveRoute("/opportunities-archive", "/opportunities")).toBe(false);
  });
});

describe("NAV_ITEMS", () => {
  it("has the seven routes defined in PRODUCT.md §16", () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual([
      "/",
      "/opportunities",
      "/applications",
      "/interviews",
      "/artifacts",
      "/insights",
      "/profile",
    ]);
  });
});
