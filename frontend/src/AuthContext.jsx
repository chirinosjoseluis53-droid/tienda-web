import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setSession, clearSession, getStoredUser } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function validate() {
      if (!getToken()) {
        setReady(true);
        return;
      }
      try {
        const { user } = await api.get('/auth/me');
        setUser(user);
      } catch {
        clearSession();
        setUser(null);
      } finally {
        setReady(true);
      }
    }
    validate();
  }, []);

  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    setSession(data.token, data.user);
    setUser(data.user);
  }

  async function register(name, email, password) {
    const data = await api.post('/auth/register', { name, email, password });
    setSession(data.token, data.user);
    setUser(data.user);
  }

  function logout() {
    clearSession();
    setUser(null);
  }

  function updateUser(u) {
    setUser(u);
    setSession(getToken(), u);
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}