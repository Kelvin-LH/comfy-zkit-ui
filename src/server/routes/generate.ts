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

// This file rewrites the original generate.ts to ensure that image URLs returned to
// the client are absolute and accessible across different hosts or ports.  The
// helper `toPublicUrl` inspects the incoming request and, if a PUBLIC_BASE_URL
// environment variable is set, uses that as the base.  Otherwise it falls back
// to the current request's protocol and host.  All image endpoints now return
// `url` fields pointing at this absolute URL, ensuring that the front‑end can
// retrieve uploaded or generated images even when it is served from a
// different origin.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Configure multer for file uploads
// Use a stable uploads directory rooted at the project working directory.  When
// compiled, __dirname may change, so using process.cwd() avoids incorrect
// relative paths.
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

/**
 * Compute an absolute URL for a given relative path.  If PUBLIC_BASE_URL is
 * defined in the environment, that will be used as the base.  Otherwise
 * the protocol and host from the incoming request are used.  Leading or
 * trailing slashes are handled to avoid duplicate separators.
 */
function toPublicUrl(req: any, relativePath: string): string {
  // Environment variable takes precedence for deployment flexibility
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  // Remove trailing slash from base and ensure relative begins with a slash
  const normalizedBase = base.replace(/\/$/, '');
  const normalizedRel = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
  return normalizedBase + normalizedRel;
}

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

    // Compute URLs
    const relativeUrl = `/uploads/${filename}`;
    const publicUrl = toPublicUrl(req, relativeUrl);

    res.json({
      url: publicUrl,
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
          "text": "spy x family style, anime portrait, 2d illustration, clean crisp lineart, simple shapes, soft cel shading, warm pastel palette, gentle lighting, smooth skin, elegant and cute, expressive big eyes, natural face proportions, subtle blush, neat hair strands, tidy outfit, minimal background, high quality, best quality, masterpiece",
          "clip": ["1", 1]
        },
        "class_type": "CLIPTextEncode",
        "_meta": { "title": "Positive Prompt" }
      },
      "5": {
        "inputs": {
          "text": "photorealistic, realism, skin pores, wrinkles, 3d, cgi, render, doll, wax, lowres, blurry, out of focus, bad face, deformed face, long face, asymmetry, cross-eye, bad anatomy, bad hands, missing fingers, extra fingers, fused fingers, mangled hands, bad teeth, watermark, text, logo, noisy, jpeg artifacts, oversaturated, harsh contrast, glitch",
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

    // Compute URLs
    const relativeUrl = `/uploads/${resultFilename}`;
    const publicUrl = toPublicUrl(req, relativeUrl);

    res.json({
      success: true,
      resultUrl: publicUrl,
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

    // Compute URLs
    const relativeUrl = `/uploads/${filename}`;
    const publicUrl = toPublicUrl(req, relativeUrl);

    res.json({
      url: publicUrl,
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
