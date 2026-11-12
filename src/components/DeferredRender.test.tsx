import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DeferredRender } from "./DeferredRender";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("does not mount below-fold data hooks until the section is reached", () => {
  let notify: IntersectionObserverCallback;
  const disconnect = vi.fn();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
      notify = callback;
      expect(options.rootMargin).toBe("0px");
    }
    observe() {}
    disconnect = disconnect;
  });
  const mount = vi.fn();
  function DataSection() { mount(); return <p>Loaded section</p>; }
  render(<DeferredRender rootMargin="0px"><DataSection /></DeferredRender>);
  expect(mount).not.toHaveBeenCalled();
  act(() => notify([{isIntersecting:false}] as IntersectionObserverEntry[], {} as IntersectionObserver));
  expect(mount).not.toHaveBeenCalled();
  act(() => notify([{isIntersecting:true}] as IntersectionObserverEntry[], {} as IntersectionObserver));
  expect(screen.getByText("Loaded section")).toBeInTheDocument();
  expect(disconnect).toHaveBeenCalled();
});
