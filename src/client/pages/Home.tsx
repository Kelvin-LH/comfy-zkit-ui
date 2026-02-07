import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Upload,
  Camera,
  Wand2,
  Download,
  Printer,
  RefreshCw,
  Lock,
  Unlock,
  Settings,
  LogIn,
  LogOut,
  Sparkles,
  ImageIcon,
} from 'lucide-react';
import Login from './Login';

/**
 * Redesigned Home page layout with a horizontal card arrangement.
 * Three cards are displayed side by side on large screens: image input,
 * generation settings (including the generate button), and the result.
 * On smaller screens the cards stack vertically. The service URL remains
 * hidden; users can only adjust random seed, text watermark and QR code
 * content. Prompts and service URL are pulled from configuration.
 */

interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
}

interface SiteConfig {
  companyName: string;
  logo: string;
  comfyuiUrl: string;
  positivePrompt?: string;
  negativePrompt?: string;
}

interface HomeProps {
  user: User | null;
  config: SiteConfig;
  onLogin: (username: string, password: string) => Promise<void>;
  onLogout: () => void;
  onAdminClick: () => void;
}

const PROGRESS_STEPS = {
  UPLOAD: { start: 0, end: 15, text: '正在上传图片...' },
  RESIZE: { start: 15, end: 20, text: '正在处理图片尺寸...' },
  QUEUE: { start: 20, end: 30, text: '正在提交生成任务...' },
  GENERATE: { start: 30, end: 85, text: 'AI 正在生成卡通图...' },
  WATERMARK: { start: 85, end: 95, text: '正在添加水印...' },
  COMPLETE: { start: 95, end: 100, text: '即将完成...' },
};

export default function Home({ user, config, onLogin, onLogout, onAdminClick }: HomeProps) {
  // Image state
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [localPath, setLocalPath] = useState<string>('');
  // Generation settings
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2147483647));
  const [seedLocked, setSeedLocked] = useState(false);
  // Watermark settings
  const [textWatermark, setTextWatermark] = useState('');
  const [qrContent, setQrContent] = useState('');
  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Derive prompts and service URL from config
  const positivePrompt = config.positivePrompt;
  const negativePrompt = config.negativePrompt;
  const comfyuiUrl = config.comfyuiUrl;

  // Handle file upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setInputImage(event.target?.result as string);
      setResultImage(null);
    };
    reader.readAsDataURL(file);
  };

  // Handle camera activation
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 1280, height: 720 },
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch {
      toast.error('无法访问摄像头');
    }
  };

  // Attach stream to video element when active
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      const videoEl = videoRef.current;
      videoEl.srcObject = streamRef.current;
      videoEl.muted = true;
      videoEl.play().catch(() => {});
    }
  }, [cameraActive]);

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Capture a frame from the video
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      setInputImage(canvas.toDataURL('image/png'));
      setResultImage(null);
      stopCamera();
    }
  };

  // Randomize seed if unlocked
  const randomizeSeed = () => {
    if (!seedLocked) setSeed(Math.floor(Math.random() * 2147483647));
  };

  // Animate progress bar
  const animateProgress = (start: number, end: number, duration = 1000) => {
    return new Promise<void>((resolve) => {
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const ratio = Math.min(elapsed / duration, 1);
        const value = start + (end - start) * ratio;
        setProgress(Math.round(value));
        if (ratio < 1) requestAnimationFrame(animate);
        else resolve();
      };
      animate();
    });
  };

  // Generate cartoon image via API
  const handleGenerate = async () => {
    if (!inputImage) {
      toast.error('请先选择或拍摄一张图片');
      return;
    }
    setIsGenerating(true);
    setResultImage(null);
    setProgress(0);
    try {
      // Upload image
      setProgressText(PROGRESS_STEPS.UPLOAD.text);
      await animateProgress(PROGRESS_STEPS.UPLOAD.start, PROGRESS_STEPS.UPLOAD.end, 500);
      const uploadRes = await fetch('/api/generate/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: inputImage }),
      });
      if (!uploadRes.ok) {
        const error = await uploadRes.json();
        throw new Error(error.error || '上传失败');
      }
      const uploadData = await uploadRes.json();
      setLocalPath(uploadData.localPath);
      if (uploadData.resized) {
        setProgressText(PROGRESS_STEPS.RESIZE.text);
        await animateProgress(PROGRESS_STEPS.RESIZE.start, PROGRESS_STEPS.RESIZE.end, 300);
        toast.info('图片已自动压缩到 2560px 以内');
      }
      // Queue generation
      setProgressText(PROGRESS_STEPS.QUEUE.text);
      await animateProgress(PROGRESS_STEPS.QUEUE.start, PROGRESS_STEPS.QUEUE.end, 500);
      setProgressText(PROGRESS_STEPS.GENERATE.text);
      let currentProgress = PROGRESS_STEPS.GENERATE.start;
      const progressInterval = setInterval(() => {
        if (currentProgress < PROGRESS_STEPS.GENERATE.end - 5) {
          currentProgress += 0.5;
          setProgress(Math.round(currentProgress));
        }
      }, 500);
      const generateRes = await fetch('/api/generate/cartoon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: uploadData.url,
          localPath: uploadData.localPath,
          seed: seedLocked ? seed : Math.floor(Math.random() * 2147483647),
          comfyuiUrl,
          positivePrompt,
          negativePrompt,
        }),
      });
      clearInterval(progressInterval);
      if (!generateRes.ok) {
        const error = await generateRes.json();
        throw new Error(error.error || '生成失败');
      }
      const generateData = await generateRes.json();
      await animateProgress(currentProgress, PROGRESS_STEPS.GENERATE.end, 300);
      let finalUrl = generateData.resultUrl;
      let finalPath = generateData.localPath;
      // Add watermark if necessary
      if (textWatermark || qrContent) {
        setProgressText(PROGRESS_STEPS.WATERMARK.text);
        await animateProgress(PROGRESS_STEPS.WATERMARK.start, PROGRESS_STEPS.WATERMARK.end, 500);
        const wmRes = await fetch('/api/generate/watermark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: finalUrl, localPath: finalPath, textWatermark, qrContent }),
        });
        if (wmRes.ok) {
          const wmData = await wmRes.json();
          finalUrl = wmData.url;
          finalPath = wmData.localPath;
        }
      }
      // Finish
      setProgressText(PROGRESS_STEPS.COMPLETE.text);
      await animateProgress(PROGRESS_STEPS.COMPLETE.start, PROGRESS_STEPS.COMPLETE.end, 300);
      setResultImage(finalUrl);
      setLocalPath(finalPath);
      toast.success('卡通图生成成功！');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '生成失败');
    } finally {
      setIsGenerating(false);
      setProgress(0);
      setProgressText('');
    }
  };

  // Download generated image
  const handleDownload = async () => {
    if (!resultImage) return;
    try {
      const response = await fetch(resultImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cartoon_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('下载失败');
    }
  };

  // Print generated image
  const handlePrint = () => {
    if (!resultImage) return;
    const w = window.open('', '_blank');
    if (!w) {
      toast.error('无法打开打印窗口');
      return;
    }
    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>打印卡通图</title>
          <style>
            body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            img { max-width: 100%; max-height: 100vh; }
            @media print { img { width: 100%; height: auto; } }
          </style>
        </head>
        <body>
          <img src="${resultImage}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
    w.document.close();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            {config.logo ? (
              <img src={config.logo} alt="Logo" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <span className="text-purple-600 font-bold text-sm">卡</span>
              </div>
            )}
            <span className="font-semibold text-gray-900">{config.companyName}</span>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {user.role === 'admin' && (
                  <button onClick={onAdminClick} className="btn btn-outline">
                    <Settings className="h-4 w-4 mr-2" /> 管理设置
                  </button>
                )}
                <button onClick={onLogout} className="btn btn-secondary">
                  <LogOut className="h-4 w-4 mr-2" /> 退出
                </button>
              </>
            ) : (
              <button onClick={() => setShowLogin(true)} className="btn btn-primary">
                <LogIn className="h-4 w-4 mr-2" /> 登录
              </button>
            )}
          </div>
        </div>
      </header>
      {/* Main content */}
      <main className="container py-8">
        {/* Hero section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 text-purple-700 text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" /> AI 驱动的图像转换
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            一键将照片转换为<span className="text-purple-600"> 精美卡通</span>
          </h1>
          <p className="text-gray-500 max-w-2xl mx-auto">
            上传照片或使用摄像头拍摄，即可通过 AI 技术将其转换为动漫风格的卡通图像
          </p>
        </div>
        {/* Responsive grid: three cards side by side on large screens */}
        <div className="grid gap-8 max-w-6xl mx-auto lg:grid-cols-3">
          {/* Card 1: image input */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <span className="text-purple-600 font-bold">1</span>
                </div>
                选择图片
              </h2>
            </div>
            <div className="card-content">
              {cameraActive ? (
                <div className="space-y-4">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg bg-black" />
                  <div className="flex gap-3">
                    <button onClick={capturePhoto} className="btn btn-primary flex-1">
                      <Camera className="h-4 w-4 mr-2" /> 拍照
                    </button>
                    <button onClick={stopCamera} className="btn btn-secondary flex-1">
                      取消
                    </button>
                  </div>
                </div>
              ) : inputImage ? (
                <div className="space-y-4">
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img src={inputImage} alt="Input" className="w-full h-full object-cover" />
                  </div>
                  <button onClick={() => { setInputImage(null); setResultImage(null); }} className="btn btn-secondary w-full">
                    重新选择
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-colors"
                  >
                    <ImageIcon className="h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-sm text-gray-600">点击或拖拽上传图片</p>
                    <p className="text-xs text-gray-400 mt-1">支持 JPG、PNG、WebP 格式</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                  <button onClick={startCamera} className="btn btn-outline w-full">
                    <Camera className="h-4 w-4 mr-2" /> 使用摄像头拍照
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* Card 2: settings and generate */}
          <div className="card h-fit">
            <div className="card-header">
              <h2 className="font-semibold flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <span className="text-purple-600 font-bold">2</span>
                </div>
                生成设置
              </h2>
            </div>
            <div className="card-content space-y-4">
              {/* Settings: vertical stack (short page, clearer scanning) */}
              <div className="space-y-4">
                {/* Seed */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">随机种子</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={seed}
                      onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                      disabled={seedLocked}
                      className="input flex-1"
                      placeholder="留空则随机"
                    />
                    <button
                      onClick={() => setSeedLocked(!seedLocked)}
                      className={`btn ${seedLocked ? 'btn-primary' : 'btn-outline'}`}
                      title={seedLocked ? '解锁种子' : '锁定种子'}
                    >
                      {seedLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={randomizeSeed}
                      disabled={seedLocked}
                      className="btn btn-outline"
                      title="随机生成"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">锁定后多次生成可复现结果。</p>
                </div>

                {/* Text watermark */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">文字水印</label>
                  <input
                    type="text"
                    value={textWatermark}
                    onChange={(e) => setTextWatermark(e.target.value)}
                    className="input w-full"
                    placeholder="可选：输入水印文字"
                    maxLength={200}
                  />
                </div>

                {/* QR code content */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">二维码内容</label>
                  <input
                    type="text"
                    value={qrContent}
                    onChange={(e) => setQrContent(e.target.value)}
                    className="input w-full"
                    placeholder="可选：输入二维码内容（网址/文本）"
                    maxLength={500}
                  />
                </div>
              </div>
              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={!inputImage || isGenerating}
                className="btn btn-primary w-full h-12 text-base"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" /> 生成中...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-5 w-5 mr-2" /> 开始生成
                  </>
                )}
              </button>
            </div>
          </div>
          {/* Card 3: result */}
          <div className="card h-fit">
            <div className="card-header">
              <h2 className="font-semibold flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <span className="text-purple-600 font-bold">3</span>
                </div>
                生成结果
              </h2>
            </div>
            <div className="card-content">
              {isGenerating ? (
                <div className="aspect-square rounded-lg bg-purple-50 flex flex-col items-center justify-center p-6">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-full bg-purple-200 animate-ping"></div>
                    <div className="relative w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
                      <Sparkles className="h-8 w-8 text-purple-600 animate-pulse" />
                    </div>
                  </div>
                  <div className="w-full max-w-xs space-y-3">
                    <div className="progress">
                      <div className="progress-bar" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{progressText}</span>
                      <span className="font-medium text-purple-600">{progress}%</span>
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-medium">正在生成卡通图...</p>
                  <p className="text-xs text-gray-500 mt-1">请耐心等待</p>
                </div>
              ) : resultImage ? (
                <div className="space-y-4">
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={resultImage}
                      alt="Result"
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        console.error('Image load error:', resultImage, e);
                        toast.error('图片加载失败，请检查网络连接');
                      }}
                      onLoad={() => {
                        console.log('图片加载成功:', resultImage);
                      }}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleDownload} className="btn btn-primary flex-1">
                      <Download className="h-4 w-4 mr-2" /> 下载图片
                    </button>
                    <button onClick={handlePrint} className="btn btn-outline flex-1">
                      <Printer className="h-4 w-4 mr-2" /> 打印图片
                    </button>
                  </div>
                </div>
              ) : (
                <div className="aspect-square rounded-lg bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
                  <Sparkles className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-400">生成的卡通图将在这里显示</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="text-center mt-12 text-sm text-gray-500">
          <p>提示：生成过程需要连接本地 ComfyUI 服务，请确保服务已正确配置并运行</p>
        </div>
        {showLogin && <Login onLogin={onLogin} onClose={() => setShowLogin(false)} />}
      </main>
    </div>
  );
}
