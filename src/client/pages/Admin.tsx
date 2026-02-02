import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Save, Upload, Building2, Link2, LogOut } from 'lucide-react';

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

interface AdminProps {
  user: User;
  config: SiteConfig;
  onConfigUpdate: (config: Partial<SiteConfig>) => void;
  onBack: () => void;
  onLogout: () => void;
}

export default function Admin({ user, config, onConfigUpdate, onBack, onLogout }: AdminProps) {
  const [companyName, setCompanyName] = useState(config.companyName);
  const [logo, setLogo] = useState(config.logo);
  const [comfyuiUrl, setComfyuiUrl] = useState(config.comfyuiUrl);
  const [saving, setSaving] = useState(false);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setLogo(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');

    try {
      // Save company name
      await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ key: 'companyName', value: companyName })
      });

      // Save logo
      await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ key: 'logo', value: logo })
      });

      // Save ComfyUI URL
      await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ key: 'comfyuiUrl', value: comfyuiUrl })
      });

      onConfigUpdate({ companyName, logo, comfyuiUrl });
      toast.success('设置已保存');
    } catch (error) {
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="btn btn-outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </button>
            <h1 className="font-semibold text-gray-900">管理设置</h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {user.username}
            </span>
            <button onClick={onLogout} className="btn btn-secondary">
              <LogOut className="h-4 w-4 mr-2" />
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-2xl">
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold">网站设置</h2>
          </div>
          <div className="card-content space-y-6">
            {/* Company Name */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Building2 className="h-4 w-4" />
                公司名称
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="input"
                placeholder="输入公司或网站名称"
              />
            </div>

            {/* Logo */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Upload className="h-4 w-4" />
                网站 Logo
              </label>
              <div className="flex items-center gap-4">
                {logo ? (
                  <div className="relative">
                    <img
                      src={logo}
                      alt="Logo"
                      className="h-16 w-16 rounded-lg object-cover border border-gray-200"
                    />
                    <button
                      onClick={() => setLogo('')}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <span className="text-gray-400 text-xs">无</span>
                  </div>
                )}
                <label className="btn btn-outline cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  上传 Logo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500">建议尺寸：64x64 像素，支持 PNG、JPG 格式</p>
            </div>

            {/* ComfyUI URL */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Link2 className="h-4 w-4" />
                默认 ComfyUI 服务地址
              </label>
              <input
                type="text"
                value={comfyuiUrl}
                onChange={(e) => setComfyuiUrl(e.target.value)}
                className="input font-mono text-sm"
                placeholder="http://127.0.0.1:8188"
              />
              <p className="text-xs text-gray-500">用户可在生成时覆盖此设置</p>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-gray-100">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                保存设置
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
