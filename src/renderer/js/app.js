// 主工作台交互控制器
document.addEventListener('DOMContentLoaded', () => {
  // DOM 元素
  const btnMinimize = document.getElementById('btn-minimize');
  const btnClose = document.getElementById('btn-close');
  const btnToggleOverlay = document.getElementById('btn-toggle-overlay');
  const btnMicToggle = document.getElementById('btn-mic-toggle');
  const btnSendText = document.getElementById('btn-send-text');
  const manualTextInput = document.getElementById('manual-text-input');

  const selectSourceLang = document.getElementById('select-source-lang');
  const selectTargetLang = document.getElementById('select-target-lang');
  const selectProvider = document.getElementById('select-provider');
  const apiKeyGroup = document.getElementById('api-key-group');
  const inputApiKey = document.getElementById('input-api-key');

  const sourceContent = document.getElementById('source-content');
  const targetContent = document.getElementById('target-content');
  const sourceLatency = document.getElementById('source-latency');

  let isListening = false;
  let recognition = null;

  // 窗口基本控制
  btnMinimize?.addEventListener('click', () => window.htAPI?.minimizeWindow());
  btnClose?.addEventListener('click', () => window.htAPI?.closeWindow());
  btnToggleOverlay?.addEventListener('click', () => window.htAPI?.toggleOverlay());

  // Provider 切换
  selectProvider?.addEventListener('change', (e) => {
    if (e.target.value === 'mock') {
      apiKeyGroup.style.display = 'none';
    } else {
      apiKeyGroup.style.display = 'flex';
    }
  });

  // 模拟/API 流式翻译生成器 (前端简化适配)
  async function* streamTranslate(text, sourceLang, targetLang, provider, apiKey) {
    const startTime = performance.now();

    if (provider === 'mock' || !apiKey) {
      const mockDictionary = {
        'hello': '你好',
        'hello world': '你好，世界',
        'good morning': '早上好',
        'real-time translation': '实时转译系统',
        'harrio translate': 'Harrio 实时翻译工作台',
        'i love programming': '我热爱编程代码'
      };

      const lower = text.trim().toLowerCase();
      let targetResult = mockDictionary[lower] || `[译文: ${text}]`;

      for (let i = 0; i < targetResult.length; i++) {
        await new Promise((r) => setTimeout(r, 40));
        const deltaLatency = Math.round(performance.now() - startTime);
        sourceLatency.textContent = `${deltaLatency} ms`;
        yield {
          original: text,
          chunk: targetResult[i],
          text: targetResult.slice(0, i + 1)
        };
      }
      return;
    }

    // 若配置了 API Key，调用流式 Chat Completion
    const baseUrl = provider === 'deepseek' ? 'https://api.deepseek.com' : 'https://api.openai.com/v1';
    const model = provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini';

    try {
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `You are a real-time speech translation engine. Translate the user input from ${sourceLang} into ${targetLang}. Return only the clean translated text without quotes or explanations.`
            },
            { role: 'user', content: text }
          ],
          stream: true,
          temperature: 0.3
        })
      });

      if (!resp.ok) {
        throw new Error(`API error: ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let currentResult = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((l) => l.trim().startsWith('data: '));

        for (const line of lines) {
          const payload = line.replace(/^data: /, '').trim();
          if (payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) {
              currentResult += delta;
              yield { original: text, chunk: delta, text: currentResult };
            }
          } catch {}
        }
      }
    } catch (err) {
      console.warn('API call failed, fallback to mock stream:', err);
      yield { original: text, chunk: '', text: `[接口错误: ${err.message}]` };
    }
  }

  // 执行文本流翻译处理
  async function handleTranslate(text) {
    if (!text || text.trim() === '') return;

    const sourceLang = selectSourceLang.value;
    const targetLang = selectTargetLang.value;
    const provider = selectProvider.value;
    const apiKey = inputApiKey.value.trim();

    sourceContent.textContent = text;
    targetContent.textContent = '';

    const stream = streamTranslate(text, sourceLang, targetLang, provider, apiKey);

    for await (const chunk of stream) {
      targetContent.textContent = chunk.text;
      // 广播给悬浮字幕 HUD
      window.htAPI?.broadcastTranslation(chunk);
    }
  }

  // 手动测试输入
  function submitManualText() {
    const val = manualTextInput.value.trim();
    if (val) {
      handleTranslate(val);
      manualTextInput.value = '';
    }
  }

  btnSendText?.addEventListener('click', submitManualText);
  manualTextInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitManualText();
  });

  // 语音识别集成 (Web Speech API 支持)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectSourceLang.value === 'auto' ? 'zh-CN' : selectSourceLang.value;

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const activeText = finalTranscript || interimTranscript;
      if (activeText) {
        sourceContent.textContent = activeText;
        handleTranslate(activeText);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
    };

    recognition.onend = () => {
      if (isListening) {
        try { recognition.start(); } catch {}
      }
    };
  }

  // 麦克风录音监听切换
  btnMicToggle?.addEventListener('click', () => {
    if (!recognition) {
      alert('当前系统环境未启用原生语音识别引擎，可直接使用下方的流式输入框进行实时转译体验！');
      return;
    }

    if (!isListening) {
      try {
        recognition.lang = selectSourceLang.value === 'auto' ? 'zh-CN' : selectSourceLang.value;
        recognition.start();
        isListening = true;
        btnMicToggle.classList.add('listening');
        btnMicToggle.innerHTML = '🛑 停止实时音频监听';
      } catch (err) {
        console.error('Failed to start recognition:', err);
      }
    } else {
      isListening = false;
      recognition.stop();
      btnMicToggle.classList.remove('listening');
      btnMicToggle.innerHTML = '🎙️ 开启实时音频监听';
    }
  });
});
