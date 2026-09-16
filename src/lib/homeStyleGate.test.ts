import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWhenHomeStylesReady } from "./homeStyleGate";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("home stylesheet gate", () => {
  it("renders other routes immediately", () => {
    const render = vi.fn();
    renderWhenHomeStylesReady(render, { document, location: { pathname: "/news" } });
    expect(render).toHaveBeenCalledOnce();
  });

  it("keeps the first-paint shell until the deferred home stylesheet loads", () => {
    document.body.innerHTML = '<div id="dc-first-paint-shell"></div>';
    document.head.innerHTML = '<link rel="preload" as="style" data-dc-app-style href="/assets/index.css">';
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const render = vi.fn();

    renderWhenHomeStylesReady(render, { document, location: { pathname: "/" } });
    expect(render).not.toHaveBeenCalled();

    document.querySelector("link")?.dispatchEvent(new Event("load"));
    expect(render).toHaveBeenCalledOnce();
  });

  it("fails open if the stylesheet cannot load", () => {
    document.body.innerHTML = '<div id="dc-first-paint-shell"></div>';
    document.head.innerHTML = '<link rel="preload" as="style" data-dc-app-style href="/assets/index.css">';
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const render = vi.fn();

    renderWhenHomeStylesReady(render, { document, location: { pathname: "/" } });
    document.querySelector("link")?.dispatchEvent(new Event("error"));
    expect(render).toHaveBeenCalledOnce();
  });
});
