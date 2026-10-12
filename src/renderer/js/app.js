// 主工作台交互控制器
document.addEventListener('DOMContentLoaded', () => {
  // DOM 元素
  const btnMinimize = document.getElementById('btn-minimize');
  const btnClose = document.getElementById('btn-close');
  const btnToggleOverlay = document.getElementById('btn-toggle-overlay');
  const btnSendText = document.getElementById('btn-send-text');
  const manualTextInput = document.getElementById('manual-text-input');

  const selectSourceLang = document.getElementById('select-source-lang');
  const selectTargetLang = document.getElementById('select-target-lang');
  const selectAsrEngine = document.getElementById('select-asr-engine');
  const groqKeyGroup = document.getElementById('groq-key-group');
  const inputGroqKey = document.getElementById('input-groq-key');
  const linkGetGroqKey = document.getElementById('link-get-groq-key');

  const selectProvider = document.getElementById('select-provider');
  const apiKeyGroup = document.getElementById('api-key-group');
  const inputApiKey = document.getElementById('input-api-key');

  const sourceContent = document.getElementById('source-content');
  const targetContent = document.getElementById('target-content');
  const sourceLatency = document.getElementById('source-latency');

  // 本地记忆加载与保存
  if (inputGroqKey) {
    inputGroqKey.value = localStorage.getItem('ht_groq_key') || '';
  }
  if (inputApiKey) inputApiKey.value = localStorage.getItem('ht_api_key') || '';
  if (selectProvider) selectProvider.value = localStorage.getItem('ht_provider') || 'groq';
  if (selectAsrEngine) selectAsrEngine.value = localStorage.getItem('ht_asr_engine') || 'groq';
  if (selectSourceLang) selectSourceLang.value = localStorage.getItem('ht_source_lang') || 'auto';
  if (selectTargetLang) selectTargetLang.value = localStorage.getItem('ht_target_lang') || 'zh-CN';

  inputGroqKey?.addEventListener('input', (e) => localStorage.setItem('ht_groq_key', e.target.value.trim()));
  inputApiKey?.addEventListener('input', (e) => localStorage.setItem('ht_api_key', e.target.value.trim()));
  selectProvider?.addEventListener('change', (e) => localStorage.setItem('ht_provider', e.target.value));
  selectAsrEngine?.addEventListener('change', (e) => localStorage.setItem('ht_asr_engine', e.target.value));
  selectSourceLang?.addEventListener('change', (e) => localStorage.setItem('ht_source_lang', e.target.value));
  selectTargetLang?.addEventListener('change', (e) => localStorage.setItem('ht_target_lang', e.target.value));

  // 快捷获取 Groq Key
  linkGetGroqKey?.addEventListener('click', (e) => {
    e.preventDefault();
    window.open('https://console.groq.com/keys', '_blank');
  });

  // 窗口基本控制
  btnMinimize?.addEventListener('click', () => window.htAPI?.minimizeWindow());
  btnClose?.addEventListener('click', () => window.htAPI?.closeWindow());
  btnToggleOverlay?.addEventListener('click', () => window.htAPI?.toggleOverlay());

  // 快捷复制与清屏
  document.getElementById('btn-copy-source')?.addEventListener('click', () => {
    if (sourceContent.textContent) {
      navigator.clipboard.writeText(sourceContent.textContent);
      const btn = document.getElementById('btn-copy-source');
      btn.textContent = '✓ 已复制';
      setTimeout(() => (btn.textContent = '📋 复制'), 1500);
    }
  });
  document.getElementById('btn-clear-source')?.addEventListener('click', () => {
    sourceContent.textContent = '';
  });
  document.getElementById('btn-copy-target')?.addEventListener('click', () => {
    if (targetContent.textContent) {
      navigator.clipboard.writeText(targetContent.textContent);
      const btn = document.getElementById('btn-copy-target');
      btn.textContent = '✓ 已复制';
      setTimeout(() => (btn.textContent = '📋 复制'), 1500);
    }
  });
  document.getElementById('btn-clear-target')?.addEventListener('click', () => {
    targetContent.textContent = '';
  });

  // 控制面板显示联动
  function syncControlVisibility() {
    const prov = selectProvider ? selectProvider.value : 'groq';
    const asr = selectAsrEngine ? selectAsrEngine.value : 'groq';

    if (groqKeyGroup) {
      groqKeyGroup.style.display = (asr === 'groq' || prov === 'groq') ? 'flex' : 'none';
    }
    if (apiKeyGroup) {
      apiKeyGroup.style.display = (prov === 'deepseek' || prov === 'openai' || asr === 'openai') ? 'flex' : 'none';
    }
  }

  selectProvider?.addEventListener('change', syncControlVisibility);
  selectAsrEngine?.addEventListener('change', syncControlVisibility);
  syncControlVisibility();

  // 模拟/API 流式翻译生成器 (支持 Groq / DeepSeek / OpenAI / Mock)
  async function* streamTranslate(text, sourceLang, targetLang, provider, apiKey, groqKey) {
    const startTime = performance.now();
    const effectiveKey = provider === 'groq' ? (groqKey || apiKey) : apiKey;

    if (provider === 'mock' || !effectiveKey) {
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
        await new Promise((r) => setTimeout(r, 35));
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

    // 模型与基地址适配
    let baseUrl = 'https://api.openai.com/v1';
    let model = 'gpt-4o-mini';

    if (provider === 'deepseek') {
      baseUrl = 'https://api.deepseek.com';
      model = 'deepseek-chat';
    } else if (provider === 'groq') {
      baseUrl = 'https://api.groq.com/openai/v1';
      model = 'qwen/qwen3.8-27b';
    }

    try {
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `You are an ultra-fast real-time speech translation engine. Translate the user input from ${sourceLang} into ${targetLang}. Return ONLY the direct translation text without quotes, notes, or explanations.`
            },
            { role: 'user', content: text }
          ],
          stream: true,
          temperature: 0.3
        })
      });

      if (!resp.ok) {
        const errObj = await resp.json().catch(() => ({}));
        throw new Error(errObj.error?.message || `HTTP ${resp.status}`);
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
    const apiKey = inputApiKey ? inputApiKey.value.trim() : '';
    const groqKey = inputGroqKey ? inputGroqKey.value.trim() : '';

    sourceContent.textContent = text;
    targetContent.textContent = '';

    const stream = streamTranslate(text, sourceLang, targetLang, provider, apiKey, groqKey);

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

  // ==========================================
  // 系统音频内录 & 麦克风捕获 & 实时转译 (ASR Pipeline)
  // ==========================================
  const selectAudioSource = document.getElementById('select-audio-source');
  const audioLevelBar = document.getElementById('audio-level-bar');
  const audioLevelText = document.getElementById('audio-level-text');
  const btnAudioToggle = document.getElementById('btn-audio-toggle');

  let currentAudioStream = null;
  let audioContext = null;
  let analyserNode = null;
  let mediaRecorder = null;
  let isAudioActive = false;
  let animationFrameId = null;

  // 实时波形/音量跳动更新
  function updateAudioMeter() {
    if (!analyserNode || !isAudioActive) return;
    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    analyserNode.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    const percent = Math.min(100, Math.round((average / 128) * 100));

    if (audioLevelBar) audioLevelBar.style.width = `${percent}%`;
    if (audioLevelText) {
      audioLevelText.textContent = percent > 5 ? `已捕获 (${percent}%)` : `静音中 (${percent}%)`;
    }

    animationFrameId = requestAnimationFrame(updateAudioMeter);
  }

  // 停止捕获与资源释放
  function stopAudioCapture() {
    isAudioActive = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch {}
    }
    mediaRecorder = null;

    if (currentAudioStream) {
      currentAudioStream.getTracks().forEach((track) => track.stop());
      currentAudioStream = null;
    }

    if (audioContext && audioContext.state !== 'closed') {
      try { audioContext.close(); } catch {}
      audioContext = null;
    }

    if (audioLevelBar) audioLevelBar.style.width = '0%';
    if (audioLevelText) audioLevelText.textContent = '未捕获';

    if (btnAudioToggle) {
      btnAudioToggle.classList.remove('listening');
      btnAudioToggle.innerHTML = '⚡ 开启实时音频同传';
    }
  }

  // 开启音频捕获（支持系统声音内录和物理麦克风）
  async function startAudioCapture() {
    const sourceType = selectAudioSource ? selectAudioSource.value : 'system';
    const provider = selectProvider.value;
    const apiKey = inputApiKey.value.trim();

    try {
      if (sourceType === 'system') {
        // 捕获系统正在播放的桌面声音（外语视频/音乐）
        const sources = await window.htAPI?.getDesktopSources();
        const primarySource = sources && sources.length > 0 ? sources[0].id : undefined;

        currentAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: primarySource
            }
          },
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: primarySource
            }
          }
        });

        // 关闭视频轨道，只保留纯净的系统音频内录流
        currentAudioStream.getVideoTracks().forEach((t) => t.stop());
      } else {
        // 捕获物理麦克风
        currentAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });
      }

      // 初始化 Web Audio API 进行音量与波形分析
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const sourceNode = audioContext.createMediaStreamSource(currentAudioStream);
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 128;
      sourceNode.connect(analyserNode);

      isAudioActive = true;
      updateAudioMeter();

      if (btnAudioToggle) {
        btnAudioToggle.classList.add('listening');
        btnAudioToggle.innerHTML = '🛑 停止实时音频同传';
      }

      // 启动切片录制与 ASR 管道
      startAudioSlicing(currentAudioStream);

    } catch (err) {
      console.error('音频捕获启动失败:', err);
      alert(`无法捕获音频流: ${err.message}\n请检查音频播放设备与权限配置喵！`);
      stopAudioCapture();
    }
  }

  // 音频分片切片与语音转文字处理
  function startAudioSlicing(stream) {
    if (!window.MediaRecorder) return;

    try {
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    } catch {
      mediaRecorder = new MediaRecorder(stream);
    }

    let audioChunks = [];
    let sliceCounter = 0;

    const mockCaptions = [
      'Welcome back everyone to our live stream!',
      'In today\'s video, we are learning how to build next-generation applications.',
      'Thank you so much for joining our podcast today.',
      'This background music sounds absolutely fantastic.',
      'Let us see what happens next in this exciting tutorial.'
    ];

    mediaRecorder.ondataavailable = async (e) => {
      if (e.data && e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    // 每 3.5 秒切片一次进行语音识别
    const sliceInterval = setInterval(async () => {
      if (!isAudioActive || !mediaRecorder) {
        clearInterval(sliceInterval);
        return;
      }

      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }

      mediaRecorder.start();

      // 判断是否有声音在播放
      if (analyserNode) {
        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteFrequencyData(dataArray);
        let sum = dataArray.reduce((a, b) => a + b, 0);
        let avg = sum / dataArray.length;

        const asrEngine = selectAsrEngine ? selectAsrEngine.value : 'groq';
        const groqKey = inputGroqKey ? inputGroqKey.value.trim() : '';
        const apiKey = inputApiKey ? inputApiKey.value.trim() : '';
        const sourceLang = selectSourceLang ? selectSourceLang.value : 'auto';

        if (avg > 6) {
          // 检测到当前有音量信号
          if (audioChunks.length > 0) {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            audioChunks = [];

            if (asrEngine === 'groq' && groqKey) {
              // 🚀 调用 Groq Whisper 极速语音识别
              await transcribeWithGroq(audioBlob, groqKey, sourceLang);
            } else if (asrEngine === 'openai' && apiKey) {
              // 调用 OpenAI Whisper
              await transcribeWithOpenAI(audioBlob, apiKey, sourceLang);
            } else {
              // 演示模式
              const mockText = mockCaptions[sliceCounter % mockCaptions.length];
              sliceCounter++;
              sourceContent.textContent = `[系统内录感应中 - 请填入 Groq Key 开启真实识别] ${mockText}`;
              handleTranslate(mockText);
            }
          }
        }
      }
    }, 3500);

    mediaRecorder.start();
  }

  // ⚡ 调用 Groq Whisper 极速 ASR (whisper-large-v3-turbo)
  async function transcribeWithGroq(blob, groqKey, sourceLang) {
    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('temperature', '0.0');
    formData.append('response_format', 'json');

    if (sourceLang && sourceLang !== 'auto') {
      const code = sourceLang.split('-')[0];
      formData.append('language', code);
    }

    try {
      sourceLatency.textContent = 'Groq Whisper 识别中...';
      const t0 = performance.now();

      const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}` },
        body: formData
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `HTTP ${resp.status}`);
      }

      const data = await resp.json();
      const latency = Math.round(performance.now() - t0);
      sourceLatency.textContent = `${latency} ms (Groq Whisper ⚡)`;

      if (data.text && data.text.trim()) {
        sourceContent.textContent = data.text.trim();
        handleTranslate(data.text.trim());
      }
    } catch (err) {
      console.warn('Groq Whisper 转录失败:', err);
      sourceLatency.textContent = `识别错误: ${err.message}`;
    }
  }

  // 调用 OpenAI Whisper ASR
  async function transcribeWithOpenAI(blob, apiKey, sourceLang) {
    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');

    if (sourceLang && sourceLang !== 'auto') {
      formData.append('language', sourceLang.split('-')[0]);
    }

    try {
      sourceLatency.textContent = 'OpenAI 识别中...';
      const t0 = performance.now();

      const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData
      });

      if (resp.ok) {
        const data = await resp.json();
        const latency = Math.round(performance.now() - t0);
        sourceLatency.textContent = `${latency} ms (OpenAI)`;

        if (data.text && data.text.trim()) {
          sourceContent.textContent = data.text.trim();
          handleTranslate(data.text.trim());
        }
      }
    } catch (err) {
      console.warn('OpenAI Whisper 转录失败:', err);
      sourceLatency.textContent = `转录错误: ${err.message}`;
    }
  }

  // 按钮点击监听
  btnAudioToggle?.addEventListener('click', () => {
    if (isAudioActive) {
      stopAudioCapture();
    } else {
      startAudioCapture();
    }
  });
});
