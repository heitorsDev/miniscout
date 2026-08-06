import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { applyStyleProfile } from "./applyStyleProfile";
import type { StyleProfile } from "./types";

type StyleProfileContextValue = {
  /** null until the initial GET /api/style-profile resolves. */
  profile: StyleProfile | null;
  /**
   * Applies `profile` to the live document via applyStyleProfile and stores
   * it, so consumers (AdminLayout/ScouterPage headers) re-render with it.
   * Used by the Settings page after a successful save.
   */
  setProfile: (profile: StyleProfile) => void;
};

const StyleProfileContext = createContext<StyleProfileContextValue>({
  profile: null,
  setProfile: () => undefined
});

/**
 * Fetches the active StyleProfile once on mount and applies it via the
 * shared applyStyleProfile mapping, before/alongside the rest of the app's
 * first render. Wraps both the AdminLayout-nested routes and the
 * standalone ScouterPage route (see main.tsx), so both pick up the same
 * fetch/apply without duplicating the request.
 */
export function StyleProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<StyleProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getStyleProfile()
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        applyStyleProfile(loaded);
        setProfileState(loaded);
      })
      .catch(() => {
        // Tolerate: keep whatever the bundled default CSS already renders.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setProfile = useCallback((next: StyleProfile) => {
    applyStyleProfile(next);
    setProfileState(next);
  }, []);

  return (
    <StyleProfileContext.Provider value={{ profile, setProfile }}>
      {children}
    </StyleProfileContext.Provider>
  );
}

export function useStyleProfile(): StyleProfileContextValue {
  return useContext(StyleProfileContext);
}
