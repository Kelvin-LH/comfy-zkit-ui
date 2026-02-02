import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import Home from './pages/Home';
import Login from './pages/Login';
import Admin from './pages/Admin';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
}

interface SiteConfig {
  companyName: string;
  logo: string;
  comfyuiUrl: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<SiteConfig>({
    companyName: '卡通图生成器',
    logo: '',
    comfyuiUrl: 'http://127.0.0.1:8188'
  });
  const [currentPage, setCurrentPage] = useState<'home' | 'admin'>('home');
  const [loading, setLoading] = useState(true);

  // Load config on mount
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setConfig(prev => ({ ...prev, ...data }));
      })
      .catch(console.error);
  }, []);

  // Check auth on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Unauthorized');
        })
        .then(data => {
          setUser(data.user);
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '登录失败');
      }

      localStorage.setItem('token', data.token);
      setUser(data.user);
      toast.success('登录成功');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '登录失败');
      throw error;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setCurrentPage('home');
    toast.success('已退出登录');
  };

  const handleConfigUpdate = (newConfig: Partial<SiteConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      
      {currentPage === 'admin' && user?.role === 'admin' ? (
        <Admin 
          user={user}
          config={config}
          onConfigUpdate={handleConfigUpdate}
          onBack={() => setCurrentPage('home')}
          onLogout={handleLogout}
        />
      ) : (
        <Home 
          user={user}
          config={config}
          onLogin={handleLogin}
          onLogout={handleLogout}
          onAdminClick={() => setCurrentPage('admin')}
        />
      )}
    </>
  );
}
