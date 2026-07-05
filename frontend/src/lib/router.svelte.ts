// Tiny base-path-aware history router. No external dep; pointer-light per
// docs/concepts/ui-shell.md (history routing, clean back). Production runs under
// import.meta.env.BASE_URL (e.g. /yen-cinthanai/); dev/preview under '/'.

export const BASE = import.meta.env.BASE_URL;

/** Absolute href for the landing screen, base-path aware. */
export function homeHref(): string {
  return BASE;
}

/** App-relative path: strip the configured base so routes compare cleanly. */
export function toRoute(pathname: string): string {
  const stripped = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  return "/" + stripped.replace(/^\/+/, "");
}

/** Full href for an app-relative route, base-path aware. */
export function hrefFor(route: string): string {
  return BASE + route.replace(/^\/+/, "");
}

let _route = $state(toRoute(globalThis.location?.pathname ?? "/"));

export function route(): string {
  return _route;
}

export function navigate(target: string): void {
  _route = "/" + target.replace(/^\/+/, "");
  globalThis.history?.pushState({}, "", hrefFor(_route));
}

/** Canonicalize the address bar in place (replaceState, no new history entry) WITHOUT
 *  touching the reactive route - so unfurling an alias URL (/play/<tier>) to its dated form
 *  (/play/<date>/<tier>) on load does not remount the screen or add a BACK trap. The route
 *  string stays the alias for this render; the next popstate/navigate re-syncs it. */
export function syncLocation(target: string): void {
  globalThis.history?.replaceState({}, "", hrefFor("/" + target.replace(/^\/+/, "")));
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("popstate", () => {
    _route = toRoute(globalThis.location.pathname);
  });
}
