type HomeStyleGateOptions = {
  document?: Document;
  location?: Pick<Location, "pathname">;
  timeoutMs?: number;
};

export function renderWhenHomeStylesReady(
  render: () => void,
  options: HomeStyleGateOptions = {},
) {
  const documentRef = options.document ?? document;
  const locationRef = options.location ?? window.location;
  const stylesheet = documentRef.querySelector<HTMLLinkElement>("link[data-dc-app-style]");
  const hasHomeShell = Boolean(documentRef.getElementById("dc-first-paint-shell"));

  if (locationRef.pathname !== "/" || !hasHomeShell || !stylesheet || stylesheet.rel === "stylesheet" || stylesheet.sheet) {
    render();
    return;
  }

  let rendered = false;
  const finish = () => {
    if (rendered) return;
    rendered = true;
    window.clearTimeout(watchdog);
    stylesheet.removeEventListener("load", finish);
    stylesheet.removeEventListener("error", finish);
    const schedule = documentRef.defaultView?.requestAnimationFrame;
    if (schedule) schedule.call(documentRef.defaultView, render);
    else render();
  };
  const watchdog = window.setTimeout(finish, options.timeoutMs ?? 5000);

  stylesheet.addEventListener("load", finish, { once: true });
  stylesheet.addEventListener("error", finish, { once: true });
}
