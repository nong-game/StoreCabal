import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore, setUnauthorizedHandler, clearApiCache } from '../services/api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(!!tokenStore.get());

  const logout = useCallback(() => { tokenStore.clear(); clearApiCache(); setUser(null); }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return;
    api.me().then(setUser).catch(logout).finally(() => setBooting(false));
  }, [logout]);

  const finish = useCallback(({ token, user }) => { tokenStore.set(token); setUser(user); }, []);
  const login = useCallback(async (username, password) => finish(await api.login(username, password)), [finish]);

  const value = useMemo(() => ({ user, setUser, booting, login, logout }), [user, booting, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
