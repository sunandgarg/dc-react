import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWhenPageStylesReady } from "./homeStyleGate";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("home stylesheet gate", () => {
  it("also keeps public detail text visible until its deferred stylesheet is ready", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { callback(0); return 1; });
    document.body.innerHTML = '<div id="root"><article data-dc-edge-prerender><h1>Visible title</h1></article></div>';
    document.head.innerHTML = '<link rel="preload" as="style" data-dc-app-style href="/assets/index.css">';
    const render = vi.fn();
    renderWhenPageStylesReady(render, { document, location: { pathname: "/news/example" } });
    expect(render).not.toHaveBeenCalled();
    expect(document.querySelector("h1")).toHaveTextContent("Visible title");
    document.querySelector("link")?.dispatchEvent(new Event("error"));
    expect(render).toHaveBeenCalledOnce();
  });
  it("renders other routes immediately", () => {
    const render = vi.fn();
    renderWhenPageStylesReady(render, { document, location: { pathname: "/news" } });
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

    renderWhenPageStylesReady(render, { document, location: { pathname: "/" } });
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

    renderWhenPageStylesReady(render, { document, location: { pathname: "/" } });
    document.querySelector("link")?.dispatchEvent(new Event("error"));
    expect(render).toHaveBeenCalledOnce();
  });
});
