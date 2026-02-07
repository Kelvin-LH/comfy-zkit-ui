import React, { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { 
  Upload, Camera, Wand2, Download, Printer, RefreshCw, 
  Lock, Unlock, Settings, LogIn, LogOut, User, ChevronDown,
  Sparkles, ImageIcon
} from 'lucide-react';
import Login from './Login';

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
  const [comfyuiUrl, setComfyuiUrl] = useState(config.comfyuiUrl);

  // Watermark settings
  const [textWatermark, setTextWatermark] = useState('');
  const [qrContent, setQrContent] = useState('');

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  // Handle camera
  const startCamera = async () => {
    try {
      // 请求摄像头权限
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      
      streamRef.current = stream;
      
      // 确保 video 元素已挂载
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // 等待视频元数据加载完成
        videoRef.current.onloadedmetadata = () => {
          console.log('视频元数据已加载，分辨率:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
          // 强制播放
          if (videoRef.current) {
            videoRef.current.play().catch(err => {
              console.error('视频播放失败:', err);
              toast.error('视频播放失败，请检查摄像头权限');
            });
          }
        };
      }
      
      setCameraActive(true);
      toast.success('摄像头已启动');
    } catch (error) {
      console.error('摄像头错误:', error);
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          toast.error('请允许访问摄像头权限');
        } else if (error.name === 'NotFoundError') {
          toast.error('未找到摄像头设备');
        } else {
          toast.error('无法访问摄像头: ' + error.message);
        }
      } else {
        toast.error('无法访问摄像头');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

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

  // Generate random seed
  const randomizeSeed = () => {
    if (!seedLocked) {
      setSeed(Math.floor(Math.random() * 2147483647));
    }
  };

  // Progress animation helper
  const animateProgress = (start: number, end: number, duration = 1000) => {
    return new Promise<void>((resolve) => {
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentValue = start + (end - start) * progress;
        setProgress(Math.round(currentValue));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      animate();
    });
  };

  // Handle generation
  const handleGenerate = async () => {
    if (!inputImage) {
      toast.error('请先选择或拍摄一张图片');
      return;
    }

    setIsGenerating(true);
    setResultImage(null);
    setProgress(0);

    try {
      // Step 1: Upload image
      setProgressText(PROGRESS_STEPS.UPLOAD.text);
      await animateProgress(PROGRESS_STEPS.UPLOAD.start, PROGRESS_STEPS.UPLOAD.end, 500);

      const uploadRes = await fetch('/api/generate/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: inputImage })
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

      // Step 2: Generate cartoon
      setProgressText(PROGRESS_STEPS.QUEUE.text);
      await animateProgress(PROGRESS_STEPS.QUEUE.start, PROGRESS_STEPS.QUEUE.end, 500);

      setProgressText(PROGRESS_STEPS.GENERATE.text);
      
      // Start progress animation
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
          comfyuiUrl
        })
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

      // Step 3: Add watermark if needed
      if (textWatermark || qrContent) {
        setProgressText(PROGRESS_STEPS.WATERMARK.text);
        await animateProgress(PROGRESS_STEPS.WATERMARK.start, PROGRESS_STEPS.WATERMARK.end, 500);

        const watermarkRes = await fetch('/api/generate/watermark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: finalUrl,
            localPath: finalPath,
            textWatermark,
            qrContent
          })
        });

        if (watermarkRes.ok) {
          const watermarkData = await watermarkRes.json();
          finalUrl = watermarkData.url;
          finalPath = watermarkData.localPath;
        }
      }

      // Complete
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

  // Handle download
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
    } catch (error) {
      toast.error('下载失败');
    }
  };

  // Handle print
  const handlePrint = () => {
    if (!resultImage) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('无法打开打印窗口');
      return;
    }

    printWindow.document.write(`
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
    printWindow.document.close();
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
                  <button
                    onClick={onAdminClick}
                    className="btn btn-outline"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    管理设置
                  </button>
                )}
                <button
                  onClick={onLogout}
                  className="btn btn-secondary"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  退出
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="btn btn-primary"
              >
                <LogIn className="h-4 w-4 mr-2" />
                登录
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 text-purple-700 text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            AI 驱动的图像转换
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            一键将照片转换为
            <span className="text-purple-600"> 精美卡通</span>
          </h1>
          <p className="text-gray-500 max-w-2xl mx-auto">
            上传照片或使用摄像头拍摄，即可通过 AI 技术将其转换为动漫风格的卡通图像
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Left - Input */}
          <div className="space-y-6">
            {/* Image Input Card */}
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
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      controls={false}
                      crossOrigin="anonymous"
                      className="w-full h-auto rounded-lg bg-black object-cover aspect-square"
                      style={{
                        display: 'block',
                        width: '100%',
                        height: 'auto',
                        backgroundColor: '#000'
                      }}
                    />
                    <div className="flex gap-3">
                      <button onClick={capturePhoto} className="btn btn-primary flex-1">
                        <Camera className="h-4 w-4 mr-2" />
                        拍照
                      </button>
                      <button onClick={stopCamera} className="btn btn-secondary flex-1">
                        取消
                      </button>
                    </div>
                  </div>
                ) : inputImage ? (
                  <div className="space-y-4">
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={inputImage}
                        alt="Input"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      onClick={() => {
                        setInputImage(null);
                        setResultImage(null);
                      }}
                      className="btn btn-secondary w-full"
                    >
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
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button onClick={startCamera} className="btn btn-outline w-full">
                      <Camera className="h-4 w-4 mr-2" />
                      使用摄像头拍照
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Settings Card */}
            <div className="card">
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="card-header w-full flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <h2 className="font-semibold flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <span className="text-purple-600 font-bold">2</span>
                  </div>
                  生成设置
                </h2>
                <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {settingsOpen && (
                <div className="card-content space-y-4">
                  {/* Seed Control */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      随机种子
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={seed}
                        onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                        disabled={seedLocked}
                        className="input flex-1"
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
                  </div>

                  {/* ComfyUI URL */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      ComfyUI 服务地址
                    </label>
                    <input
                      type="text"
                      value={comfyuiUrl}
                      onChange={(e) => setComfyuiUrl(e.target.value)}
                      className="input font-mono text-sm"
                      placeholder="http://127.0.0.1:8188"
                    />
                  </div>

                  {/* Watermark Settings */}
                  <div className="border-t border-gray-100 pt-4 space-y-4">
                    <h3 className="text-sm font-medium text-gray-700">水印设置</h3>
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-600">文字水印</label>
                      <input
                        type="text"
                        value={textWatermark}
                        onChange={(e) => setTextWatermark(e.target.value)}
                        className="input"
                        placeholder="输入水印文字（可选）"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-600">二维码内容</label>
                      <input
                        type="text"
                        value={qrContent}
                        onChange={(e) => setQrContent(e.target.value)}
                        className="input"
                        placeholder="输入二维码内容（可选）"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!inputImage || isGenerating}
              className="btn btn-primary w-full h-12 text-base"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  生成中...
                </>
              ) : (
                <>
                  <Wand2 className="h-5 w-5 mr-2" />
                  开始生成
                </>
              )}
            </button>
          </div>

          {/* Right - Output */}
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
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleDownload} className="btn btn-primary flex-1">
                      <Download className="h-4 w-4 mr-2" />
                      下载图片
                    </button>
                    <button onClick={handlePrint} className="btn btn-outline flex-1">
                      <Printer className="h-4 w-4 mr-2" />
                      打印图片
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

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-gray-500">
          <p>提示：生成过程需要连接本地 ComfyUI 服务，请确保服务已正确配置并运行</p>
        </div>
      </main>

      {/* Login Modal */}
      {showLogin && (
        <Login onLogin={onLogin} onClose={() => setShowLogin(false)} />
      )}
    </div>
  );
}
