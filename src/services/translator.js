/**
 * Harrio Translate - 翻译服务核心适配层
 * 支持多源接入：内置智能流式接口、DeepSeek/OpenAI 兼容接口等
 */

class TranslatorService {
  constructor(config = {}) {
    this.config = {
      provider: config.provider || 'mock',
      apiKey: config.apiKey || '',
      baseUrl: config.baseUrl || 'https://api.deepseek.com',
      model: config.model || 'deepseek-chat',
      ...config
    };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 模拟流式打字机翻译（离线调试/原型体验）
   */
  async *streamMockTranslate(text, sourceLang = 'auto', targetLang = 'zh-CN') {
    if (!text || text.trim() === '') return;

    const mockDictionary = {
      'hello': '你好',
      'world': '世界',
      'good morning': '早上好',
      'welcome to harrio translate': '欢迎使用 Harrio 实时翻译系统',
      'real-time translation system': '实时转译流式引擎系统',
      'how are you': '你好吗',
      'let us build something amazing': '让我们一起打造令人惊叹的作品吧'
    };

    const lower = text.trim().toLowerCase();
    let translated = mockDictionary[lower];

    if (!translated) {
      if (targetLang.startsWith('zh')) {
        translated = `[译文: ${text}]`;
      } else {
        translated = `[Translated: ${text}]`;
      }
    }

    // 模拟逐字流式返回
    for (let i = 0; i < translated.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 35));
      yield {
        original: text,
        chunk: translated[i],
        text: translated.slice(0, i + 1),
        isFinal: i === translated.length - 1
      };
    }
  }

  /**
   * 调用兼容 OpenAI / DeepSeek 的流式 Chat Completion API 进行实时翻译
   */
  async *streamApiTranslate(text, sourceLang = 'auto', targetLang = 'zh-CN') {
    if (!this.config.apiKey) {
      // 未配置 API Key 时降级为模拟流
      yield* this.streamMockTranslate(text, sourceLang, targetLang);
      return;
    }

    const systemPrompt = `You are a high-speed real-time translator for the Harrio Translate desktop app.
Translate the user input from ${sourceLang} to ${targetLang}.
Preserve tone, formatting, and technical terms.
Output ONLY the translated text without explanations or quotes.`;

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          stream: true,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '));

        for (const line of lines) {
          const payload = line.replace(/^data: /, '').trim();
          if (payload === '[DONE]') continue;

          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              yield {
                original: text,
                chunk: delta,
                text: fullText,
                isFinal: false
              };
            }
          } catch {
            // 忽略非 JSON 数据行
          }
        }
      }

      yield {
        original: text,
        chunk: '',
        text: fullText,
        isFinal: true
      };
    } catch (err) {
      console.error('[TranslatorService] Stream failed, falling back:', err);
      yield* this.streamMockTranslate(text, sourceLang, targetLang);
    }
  }
}

module.exports = { TranslatorService };
