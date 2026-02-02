import sharp from 'sharp';
import QRCode from 'qrcode';

const MAX_DIMENSION = 2560;

// Resize image if needed (max 2560px)
export async function resizeImage(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const { width = 0, height = 0 } = metadata;

  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
    return imageBuffer;
  }

  const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  return sharp(imageBuffer)
    .resize(newWidth, newHeight, { fit: 'inside' })
    .png()
    .toBuffer();
}

// Get image dimensions
export async function getImageDimensions(imageBuffer: Buffer): Promise<{ width: number; height: number }> {
  const metadata = await sharp(imageBuffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0
  };
}

// Add watermark (text and/or QR code)
export async function addWatermark(
  imageBuffer: Buffer,
  options: {
    textWatermark?: string;
    qrContent?: string;
  }
): Promise<Buffer> {
  const { textWatermark, qrContent } = options;

  if (!textWatermark && !qrContent) {
    return imageBuffer;
  }

  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const { width = 800, height = 600 } = metadata;

  const composites: sharp.OverlayOptions[] = [];
  const padding = 20;
  let currentBottom = padding;

  // Add QR code watermark
  if (qrContent) {
    const qrSize = Math.min(120, Math.floor(width * 0.15));
    const qrBuffer = await QRCode.toBuffer(qrContent, {
      width: qrSize,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    composites.push({
      input: qrBuffer,
      gravity: 'southeast',
      top: height - qrSize - currentBottom,
      left: width - qrSize - padding
    });

    currentBottom += qrSize + 10;
  }

  // Add text watermark
  if (textWatermark) {
    const fontSize = Math.max(16, Math.floor(width * 0.025));
    const textWidth = textWatermark.length * fontSize * 0.6;
    const textHeight = fontSize + 10;

    const textSvg = `
      <svg width="${textWidth + 20}" height="${textHeight}">
        <style>
          .watermark {
            font-family: Arial, sans-serif;
            font-size: ${fontSize}px;
            fill: rgba(255, 255, 255, 0.8);
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
          }
        </style>
        <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.3)" rx="5"/>
        <text x="10" y="${fontSize}" class="watermark">${escapeXml(textWatermark)}</text>
      </svg>
    `;

    composites.push({
      input: Buffer.from(textSvg),
      gravity: 'southeast',
      top: height - textHeight - currentBottom,
      left: width - Math.ceil(textWidth + 20) - padding
    });
  }

  return image.composite(composites).png().toBuffer();
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
