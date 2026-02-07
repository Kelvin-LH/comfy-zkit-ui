import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import { resizeImage, addWatermark, getImageDimensions } from '../services/imageProcessor.js';
import { createComfyUIService } from '../services/comfyui.js';
import { createHistoryRecord, updateHistoryRecord, getHistoryByUserId, getConfigValue } from '../services/dataStore.js';
import { authMiddleware } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Upload and resize image
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    let imageBuffer: Buffer;

    if (req.file) {
      imageBuffer = req.file.buffer;
    } else if (req.body.imageBase64) {
      const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      return res.status(400).json({ error: '请提供图片' });
    }

    // Resize if needed
    const resizedBuffer = await resizeImage(imageBuffer);
    const dimensions = await getImageDimensions(resizedBuffer);

    // Save to uploads folder
    const filename = `upload_${nanoid()}.png`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, resizedBuffer);

    // Get the host from request headers
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3001';
    const fullUrl = `${protocol}://${host}/uploads/${filename}`;

    res.json({
      url: fullUrl,
      localPath: filePath,
      width: dimensions.width,
      height: dimensions.height,
      resized: imageBuffer.length !== resizedBuffer.length
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: '上传图片失败' });
  }
});

// Generate cartoon image via ComfyUI
router.post('/cartoon', async (req, res) => {
  try {
    const { imageUrl, localPath, seed, comfyuiUrl } = req.body;

    if (!imageUrl && !localPath) {
      return res.status(400).json({ error: '请提供图片' });
    }

    const effectiveComfyuiUrl = comfyuiUrl || getConfigValue('comfyuiUrl') || 'http://127.0.0.1:8188';

    // Read image from local path or download from URL
    let imageBuffer: Buffer;
    if (localPath && fs.existsSync(localPath)) {
      imageBuffer = fs.readFileSync(localPath);
    } else if (imageUrl) {
      // For local URLs, read from file system
      if (imageUrl.startsWith('/uploads/')) {
        const localFilePath = path.join(uploadsDir, path.basename(imageUrl));
        imageBuffer = fs.readFileSync(localFilePath);
      } else {
        const response = await fetch(imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      }
    } else {
      return res.status(400).json({ error: '无法读取图片' });
    }

    // Create ComfyUI service
    const comfyui = createComfyUIService(effectiveComfyuiUrl);

    // Upload image to ComfyUI
    const uploadedName = await comfyui.uploadImage(imageBuffer, `input_${nanoid()}.png`);

    // Generate cartoon with the workflow
    const promptId = await comfyui.queuePrompt({
      "1": {
        "inputs": { "ckpt_name": "anything-v5.safetensors" },
        "class_type": "CheckpointLoaderSimple",
        "_meta": { "title": "Load Checkpoint" }
      },
      "2": {
        "inputs": { "image": uploadedName },
        "class_type": "LoadImage",
        "_meta": { "title": "Load Image (Camera/Upload)" }
      },
      "3": {
        "inputs": { "pixels": ["2", 0], "vae": ["1", 2] },
        "class_type": "VAEEncode",
        "_meta": { "title": "VAE Encode" }
      },
      "4": {
        "inputs": {
          "text": "anime portrait, 2d illustration, crisp lineart, studio anime style, clean edges, soft shading, pastel palette, smooth skin, detailed eyes, high quality, best quality, masterpiece",
          "clip": ["1", 1]
        },
        "class_type": "CLIPTextEncode",
        "_meta": { "title": "Positive Prompt" }
      },
      "5": {
        "inputs": {
          "text": "photorealistic, realistic skin texture, pores, wrinkles, nsfw, lowres, blurry, bad anatomy, bad hands, extra fingers, watermark, text, logo, noisy, jpeg artifacts, oversaturated, harsh contrast, glitch",
          "clip": ["1", 1]
        },
        "class_type": "CLIPTextEncode",
        "_meta": { "title": "Negative Prompt" }
      },
      "6": {
        "inputs": {
          "seed": seed || Math.floor(Math.random() * 2147483647),
          "steps": 26,
          "cfg": 6.5,
          "sampler_name": "euler",
          "scheduler": "normal",
          "denoise": 0.52,
          "model": ["1", 0],
          "positive": ["4", 0],
          "negative": ["5", 0],
          "latent_image": ["3", 0]
        },
        "class_type": "KSampler",
        "_meta": { "title": "KSampler (img2img)" }
      },
      "7": {
        "inputs": { "samples": ["6", 0], "vae": ["1", 2] },
        "class_type": "VAEDecode",
        "_meta": { "title": "VAE Decode" }
      },
      "8": {
        "inputs": { "filename_prefix": "img2img_cartoon", "images": ["7", 0] },
        "class_type": "SaveImage",
        "_meta": { "title": "Save Image" }
      }
    });

    // Wait for result
    const resultBuffer = await comfyui.waitForResult(promptId, 180000);

    if (!resultBuffer) {
      return res.status(500).json({ error: '生成超时，请重试' });
    }

    // Save result
    const resultFilename = `cartoon_${nanoid()}.png`;
    const resultPath = path.join(uploadsDir, resultFilename);
    fs.writeFileSync(resultPath, resultBuffer);

    // Get the host from request headers
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3001';
    const fullUrl = `${protocol}://${host}/uploads/${resultFilename}`;

    res.json({
      success: true,
      resultUrl: fullUrl,
      localPath: resultPath
    });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : '生成失败，请检查 ComfyUI 服务是否正常运行' 
    });
  }
});

// Add watermark
router.post('/watermark', async (req, res) => {
  try {
    const { imageUrl, localPath, textWatermark, qrContent } = req.body;

    if (!textWatermark && !qrContent) {
      return res.json({ url: imageUrl, localPath });
    }

    // Read image
    let imageBuffer: Buffer;
    if (localPath && fs.existsSync(localPath)) {
      imageBuffer = fs.readFileSync(localPath);
    } else if (imageUrl) {
      if (imageUrl.startsWith('/uploads/')) {
        const localFilePath = path.join(uploadsDir, path.basename(imageUrl));
        imageBuffer = fs.readFileSync(localFilePath);
      } else {
        const response = await fetch(imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      }
    } else {
      return res.status(400).json({ error: '无法读取图片' });
    }

    // Add watermark
    const watermarkedBuffer = await addWatermark(imageBuffer, {
      textWatermark,
      qrContent
    });

    // Save result
    const filename = `watermarked_${nanoid()}.png`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, watermarkedBuffer);

    // Get the host from request headers
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3001';
    const fullUrl = `${protocol}://${host}/uploads/${filename}`;

    res.json({
      url: fullUrl,
      localPath: filePath
    });
  } catch (error) {
    console.error('Watermark error:', error);
    res.status(500).json({ error: '添加水印失败' });
  }
});

// Get generation history (requires auth)
router.get('/history', authMiddleware, (req: any, res) => {
  const history = getHistoryByUserId(req.user.id);
  res.json({ history });
});

export { router as generateRouter };
