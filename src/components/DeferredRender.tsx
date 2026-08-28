import { type ReactNode, useEffect, useRef, useState } from "react";

export function DeferredRender({ children, minHeight = 600, rootMargin = "600px 0px" }: { children: ReactNode; minHeight?: number; rootMargin?: string }) {
  const marker = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    const element = marker.current;
    let timer = 0;
    const reveal = () => setReady(true);

    if (!element || !("IntersectionObserver" in window)) {
      timer = window.setTimeout(reveal, 100);
      return () => { if (timer) window.clearTimeout(timer); };
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        reveal();
        observer.disconnect();
      }
    }, { rootMargin });
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [ready, rootMargin]);

  return <div ref={marker} style={!ready ? { minHeight } : undefined}>{ready ? children : null}</div>;
}
