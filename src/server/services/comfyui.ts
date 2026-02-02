import FormData from 'form-data';
import fetch from 'node-fetch';

export interface ComfyUIService {
  uploadImage(imageBuffer: Buffer, filename: string): Promise<string>;
  queuePrompt(prompt: Record<string, unknown>): Promise<string>;
  waitForResult(promptId: string, timeout?: number): Promise<Buffer | null>;
}

export function createComfyUIService(baseUrl: string): ComfyUIService {
  const normalizedUrl = baseUrl.replace(/\/$/, '');

  async function uploadImage(imageBuffer: Buffer, filename: string): Promise<string> {
    const formData = new FormData();
    formData.append('image', imageBuffer, {
      filename,
      contentType: 'image/png'
    });

    const response = await fetch(`${normalizedUrl}/upload/image`, {
      method: 'POST',
      body: formData as any
    });

    if (!response.ok) {
      throw new Error(`上传图片失败: ${response.statusText}`);
    }

    const result = await response.json() as { name: string };
    return result.name;
  }

  async function queuePrompt(prompt: Record<string, unknown>): Promise<string> {
    const response = await fetch(`${normalizedUrl}/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      throw new Error(`提交任务失败: ${response.statusText}`);
    }

    const result = await response.json() as { prompt_id: string };
    return result.prompt_id;
  }

  async function waitForResult(promptId: string, timeout = 180000): Promise<Buffer | null> {
    const startTime = Date.now();
    const pollInterval = 1000;

    while (Date.now() - startTime < timeout) {
      try {
        const historyResponse = await fetch(`${normalizedUrl}/history/${promptId}`);
        if (!historyResponse.ok) {
          await sleep(pollInterval);
          continue;
        }

        const history = await historyResponse.json() as Record<string, {
          outputs?: Record<string, { images?: Array<{ filename: string; subfolder: string; type: string }> }>;
        }>;

        const promptHistory = history[promptId];
        if (!promptHistory?.outputs) {
          await sleep(pollInterval);
          continue;
        }

        // Find the output image
        for (const nodeId in promptHistory.outputs) {
          const output = promptHistory.outputs[nodeId];
          if (output.images && output.images.length > 0) {
            const image = output.images[0];
            const imageUrl = `${normalizedUrl}/view?filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder || '')}&type=${encodeURIComponent(image.type || 'output')}`;
            
            const imageResponse = await fetch(imageUrl);
            if (imageResponse.ok) {
              const arrayBuffer = await imageResponse.arrayBuffer();
              return Buffer.from(arrayBuffer);
            }
          }
        }
      } catch (error) {
        console.error('Error polling ComfyUI:', error);
      }

      await sleep(pollInterval);
    }

    return null;
  }

  return {
    uploadImage,
    queuePrompt,
    waitForResult
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
