import React, { useState, useEffect, useRef } from "react";
import {
  Copy,
  Trash2,
  Minus,
  X,
  Check,
  ExternalLink,
  ChevronRight,
  ArrowRightLeft,
  Volume2,
  CornerDownLeft
} from "lucide-react";

export default function App() {
  // 状态管理
  const [sourceLang, setSourceLang] = useState(() => localStorage.getItem("ht_source_lang") || "auto");
  const [targetLang, setTargetLang] = useState(() => localStorage.getItem("ht_target_lang") || "zh-CN");
  const [audioSource, setAudioSource] = useState(() => localStorage.getItem("ht_audio_source") || "system");
  const [asrEngine, setAsrEngine] = useState(() => localStorage.getItem("ht_asr_engine") || "groq");
  const [provider, setProvider] = useState(() => localStorage.getItem("ht_provider") || "groq");
  const [groqModel, setGroqModel] = useState(() => localStorage.getItem("ht_groq_model") || "openai/gpt-oss-120b");
  const [deepseekModel, setDeepseekModel] = useState(() => localStorage.getItem("ht_deepseek_model") || "deepseek-flash");
  const [sliceDuration, setSliceDuration] = useState(() => localStorage.getItem("ht_slice_duration") || "1500");

  const [groqKey, setGroqKey] = useState(() => localStorage.getItem("ht_groq_key") || (typeof import.meta !== "undefined" && import.meta.env?.VITE_GROQ_API_KEY) || "");
  const [deepseekKey, setDeepseekKey] = useState(() => localStorage.getItem("ht_deepseek_key") || "");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("ht_api_key") || "");

  const [isAudioActive, setIsAudioActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const [sourceText, setSourceText] = useState("");
  const [prevSourceText, setPrevSourceText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [sourceLatency, setSourceLatency] = useState("");
  const [targetLatency, setTargetLatency] = useState("");
  const [contextMemory, setContextMemory] = useState(() => localStorage.getItem("ht_context_memory") !== "false");
  const [translationStyle, setTranslationStyle] = useState(() => localStorage.getItem("ht_translation_style") || "natural");

  const [manualInput, setManualInput] = useState("");
  const [copiedSource, setCopiedSource] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState(false);

  // 引用
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isAudioActiveRef = useRef(false);
  const sliceDurationRef = useRef(1500);
  const lastGroqTimeRef = useRef(0);
  const prevSourceRef = useRef("");

  // 本地存储同步
  useEffect(() => { localStorage.setItem("ht_source_lang", sourceLang); }, [sourceLang]);
  useEffect(() => { localStorage.setItem("ht_target_lang", targetLang); }, [targetLang]);
  useEffect(() => { localStorage.setItem("ht_audio_source", audioSource); }, [audioSource]);
  useEffect(() => { localStorage.setItem("ht_asr_engine", asrEngine); }, [asrEngine]);
  useEffect(() => { localStorage.setItem("ht_provider", provider); }, [provider]);
  useEffect(() => { localStorage.setItem("ht_groq_model", groqModel); }, [groqModel]);
  useEffect(() => { localStorage.setItem("ht_deepseek_model", deepseekModel); }, [deepseekModel]);
  useEffect(() => { localStorage.setItem("ht_context_memory", contextMemory); }, [contextMemory]);
  useEffect(() => { localStorage.setItem("ht_translation_style", translationStyle); }, [translationStyle]);
  useEffect(() => { 
    localStorage.setItem("ht_slice_duration", sliceDuration); 
    sliceDurationRef.current = parseInt(sliceDuration) || 1500;
  }, [sliceDuration]);
  useEffect(() => { localStorage.setItem("ht_groq_key", groqKey); }, [groqKey]);
  useEffect(() => { localStorage.setItem("ht_deepseek_key", deepseekKey); }, [deepseekKey]);
  useEffect(() => { localStorage.setItem("ht_api_key", apiKey); }, [apiKey]);

  // 窗口控制
  const handleMinimize = () => window.htAPI?.minimizeWindow();
  const handleClose = () => window.htAPI?.closeWindow();
  const handleToggleOverlay = () => window.htAPI?.toggleOverlay();

  // 语种互换
  const handleSwapLang = () => {
    if (sourceLang === "auto") return;
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
  };

  // 流式翻译核心 (支持携带上文 context 与 风格定制)
  async function* streamTranslate(text, sLang, tLang, prov, aKey, gKey, gModel, dKey, dModel, context, style = "natural") {
    const startTime = performance.now();
    let effectiveKey = aKey;
    if (prov === "groq") {
      effectiveKey = gKey || aKey;
    } else if (prov === "deepseek") {
      effectiveKey = dKey || aKey;
    }

    if (prov === "mock" || !effectiveKey) {
      const mockDict = {
        "hello": "你好",
        "hello world": "你好，世界",
        "welcome to harrio translate": "欢迎使用 Harrio 实时同传系统",
      };
      const translated = mockDict[text.toLowerCase().trim()] || `[译文: ${text}]`;
      for (let i = 0; i < translated.length; i++) {
        await new Promise((r) => setTimeout(r, 25));
        setTargetLatency(`${Math.round(performance.now() - startTime)}ms`);
        yield { original: text, text: translated.slice(0, i + 1) };
      }
      return;
    }

    let baseUrl = "https://api.openai.com/v1";
    let model = "gpt-4o-mini";

    if (prov === "deepseek") {
      baseUrl = "https://api.deepseek.com";
      model = dModel || "deepseek-flash";
    } else if (prov === "groq") {
      baseUrl = "https://api.groq.com/openai/v1";
      model = gModel || "openai/gpt-oss-120b";
    }

    try {
      const hasContext = Boolean(context && context.trim());
      const userContent = hasContext
        ? `[上文参考 (Context)]:\n${context.trim()}\n\n[本次需翻译本句 (Current Text)]:\n${text.trim()}`
        : text;

      const styleRule = style === "polished"
        ? "【风格：信达雅·典雅精炼】用词文雅考究，句式优美精炼，适合文学、演讲与高端交流。"
        : style === "literal"
        ? "【风格：严谨直译·忠实客观】严格依照原文结构逐字对齐直译，适合学术规范与严谨文献。"
        : "【风格：极富人味·地道鲜活】彻底摆脱机械死板的机翻腔和生硬被动句！像母语者在耳边自然聊天一样说话，用接地气的大实话口语，句式自然松弛，省略多余的生硬代词（如滥用“它”、“他们”），保持人情味与温度。";

      const systemContent = `你是一位顶级同传口译与本地化翻译专家。请将用户发言从 ${sLang} 翻译为目标语言 ${tLang}。
【核心法则】：
1. ${styleRule}
${hasContext ? "2. 若提供了 [上文参考]，仅用于理清逻辑脉络、消除主语代词歧义与前后语气连贯；【严禁】把上文重新翻译，必须且仅翻译【本次需翻译本句】！\n" : ""}3. 译文要有真实的交流感和呼吸感，听起来像真人现场口译。
4. 绝对只输出纯净译文，严禁输出任何引号、前缀、拼音、括号或多余说明。`;

      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemContent },
            { role: "user", content: userContent },
          ],
          stream: true,
          temperature: style === "literal" ? 0.1 : 0.3,
        }),
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        const rawMsg = errJson.error?.message || `HTTP ${resp.status}`;
        if (resp.status === 429 || rawMsg.includes("Rate limit") || rawMsg.includes("RPM")) {
          yield { original: text, text: `[提示: 触发 Groq 免费限流 (20 RPM)，冷却 3 秒后自动恢复]` };
          return;
        }
        throw new Error(rawMsg);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let currentResult = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.trim().startsWith("data: "));

        for (const line of lines) {
          const payload = line.replace(/^data: /, "").trim();
          if (payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content || "";
            if (delta) {
              currentResult += delta;
              setTargetLatency(`${Math.round(performance.now() - startTime)}ms`);
              yield { original: text, text: currentResult };
            }
          } catch {}
        }
      }
    } catch (err) {
      console.warn("Translation failed:", err);
      yield { original: text, text: `[错误: ${err.message}]` };
    }
  }

  // 执行翻译与广播 (携带上一次的原文作为上下文)
  const handleTranslate = async (text) => {
    if (!text || !text.trim()) return;

    // 获取上一次的原文作为上下文参考（如果开启了上下文记忆模式）
    const context = (contextMemory && prevSourceRef.current) ? prevSourceRef.current : "";

    setSourceText(text);
    setTargetText("");

    const stream = streamTranslate(text, sourceLang, targetLang, provider, apiKey, groqKey, groqModel, deepseekKey, deepseekModel, context, translationStyle);
    for await (const chunk of stream) {
      setTargetText(chunk.text);
      window.htAPI?.broadcastTranslation(chunk);
    }

    // 翻译完成后，将当前句更新为下一次的上文参考
    prevSourceRef.current = text.trim();
    setPrevSourceText(text.trim());
  };

  const handleManualSubmit = (e) => {
    e?.preventDefault();
    if (manualInput.trim()) {
      handleTranslate(manualInput.trim());
      setManualInput("");
    }
  };

  const handleCopy = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === "source") {
      setCopiedSource(true);
      setTimeout(() => setCopiedSource(false), 1200);
    } else {
      setCopiedTarget(true);
      setTimeout(() => setCopiedTarget(false), 1200);
    }
  };

  // 音频捕获控制
  const stopAudio = () => {
    isAudioActiveRef.current = false;
    setIsAudioActive(false);

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    mediaRecorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }

    setAudioLevel(0);
  };

  const startAudio = async () => {
    try {
      let stream;
      if (audioSource === "system") {
        const sources = await window.htAPI?.getDesktopSources();
        const primaryId = sources && sources.length > 0 ? sources[0].id : undefined;

        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: primaryId,
            },
          },
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: primaryId,
            },
          },
        });
        stream.getVideoTracks().forEach((t) => t.stop());
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }

      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const srcNode = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      srcNode.connect(analyser);
      analyserRef.current = analyser;

      isAudioActiveRef.current = true;
      setIsAudioActive(true);

      const updateMeter = () => {
        if (!analyserRef.current || !isAudioActiveRef.current) return;
        const dataArr = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArr);

        const sum = dataArr.reduce((a, b) => a + b, 0);
        const avg = sum / dataArr.length;
        const pct = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(pct);

        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();

      startSlicing(stream);
    } catch (err) {
      console.error("Audio capture failed:", err);
      alert(`无法捕获音频流: ${err.message}\n请检查音频播放设备与权限。`);
      stopAudio();
    }
  };

  const startSlicing = (stream) => {
    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    } catch {
      recorder = new MediaRecorder(stream);
    }
    mediaRecorderRef.current = recorder;

    let chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const intervalMs = sliceDurationRef.current || 1500;
    const interval = setInterval(async () => {
      if (!isAudioActiveRef.current || !mediaRecorderRef.current) {
        clearInterval(interval);
        return;
      }

      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current.start();

      if (analyserRef.current) {
        const dataArr = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArr);
        const avg = dataArr.reduce((a, b) => a + b, 0) / dataArr.length;

        if (avg > 5 && chunks.length > 0) {
          const now = Date.now();
          // Groq 免费版限制每分钟 20 次 (RPM 20)，保证两次调用至少间隔 2.8 秒，不足时继续累积音频
          if (asrEngine === "groq" && (now - lastGroqTimeRef.current < 2800)) {
            return;
          }
          lastGroqTimeRef.current = now;

          const blob = new Blob(chunks, { type: "audio/webm" });
          chunks = [];

          if (asrEngine === "groq" && groqKey) {
            await transcribeWithGroq(blob);
          } else if (asrEngine === "openai" && apiKey) {
            await transcribeWithOpenAI(blob);
          } else {
            const mock = "Welcome back everyone, today we discuss real-time translation.";
            setSourceText(`[演示] ${mock}`);
            handleTranslate(mock);
          }
        }
      }
    }, intervalMs);

    recorder.start();
  };

  const transcribeWithGroq = async (blob) => {
    const formData = new FormData();
    formData.append("file", blob, "audio.webm");
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("temperature", "0.0");
    formData.append("response_format", "json");

    if (sourceLang !== "auto") {
      formData.append("language", sourceLang.split("-")[0]);
    }

    try {
      setSourceLatency("识别中");
      const t0 = performance.now();
      const resp = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}` },
        body: formData,
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        const rawMsg = errJson.error?.message || `HTTP ${resp.status}`;
        if (resp.status === 429 || rawMsg.includes("Rate limit") || rawMsg.includes("RPM")) {
          setSourceLatency("429 频控");
          setSourceText("[提示: Groq 免费版每分钟限20次，自动冷却 3 秒中...]");
          return;
        }
        throw new Error(rawMsg);
      }

      const data = await resp.json();
      setSourceLatency(`${Math.round(performance.now() - t0)}ms`);

      if (data.text && data.text.trim()) {
        setSourceText(data.text.trim());
        handleTranslate(data.text.trim());
      }
    } catch (err) {
      console.warn("Groq transcription error:", err);
      setSourceLatency(`失败: ${err.message}`);
    }
  };

  const transcribeWithOpenAI = async (blob) => {
    const formData = new FormData();
    formData.append("file", blob, "audio.webm");
    formData.append("model", "whisper-1");
    if (sourceLang !== "auto") formData.append("language", sourceLang.split("-")[0]);

    try {
      setSourceLatency("识别中");
      const t0 = performance.now();
      const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });
      if (resp.ok) {
        const data = await resp.json();
        setSourceLatency(`${Math.round(performance.now() - t0)}ms`);
        if (data.text?.trim()) {
          setSourceText(data.text.trim());
          handleTranslate(data.text.trim());
        }
      }
    } catch (err) {
      setSourceLatency(`失败: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0c0d0e] text-[#ededed] select-none overflow-hidden font-sans antialiased text-xs">
      {/* 极简无干扰顶栏 (Linear / Raycast 风格) */}
      <header className="flex items-center justify-between h-9 px-3 bg-[#0c0d0e] border-b border-[#202226] shrink-0 [-webkit-app-region:drag]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-sm bg-neutral-400" />
          <span className="font-semibold text-xs tracking-tight text-neutral-200">
            HT Translate
          </span>
          <span className="text-[11px] text-neutral-500 font-mono">v0.1.0</span>
        </div>
        <div className="flex items-center gap-1 [-webkit-app-region:no-drag]">
          <button
            onClick={handleMinimize}
            className="w-6 h-6 flex items-center justify-center rounded text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition"
            title="最小化"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            onClick={handleClose}
            className="w-6 h-6 flex items-center justify-center rounded text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition"
            title="关闭"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* 主布局 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧控制栏 */}
        <aside className="w-64 flex flex-col border-r border-[#202226] bg-[#111215] p-3 shrink-0 justify-between">
          <div className="space-y-4 overflow-y-auto pr-0.5 custom-scrollbar">
            {/* 语言选择 */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                Language
              </span>
              <div className="flex items-center gap-1 bg-[#18191d] p-1 rounded-md border border-[#27292e]">
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="flex-1 bg-transparent text-neutral-200 text-xs py-1 px-1.5 rounded outline-none cursor-pointer"
                >
                  <option value="auto" className="bg-[#18191d]">自动检测</option>
                  <option value="en-US" className="bg-[#18191d]">英语</option>
                  <option value="zh-CN" className="bg-[#18191d]">中文</option>
                  <option value="ja-JP" className="bg-[#18191d]">日语</option>
                  <option value="ko-KR" className="bg-[#18191d]">韩语</option>
                </select>

                <button
                  type="button"
                  onClick={handleSwapLang}
                  className="p-1 text-neutral-400 hover:text-neutral-200 transition"
                  title="交换语言"
                >
                  <ArrowRightLeft className="w-3 h-3" />
                </button>

                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="flex-1 bg-transparent text-neutral-200 text-xs py-1 px-1.5 rounded outline-none cursor-pointer"
                >
                  <option value="zh-CN" className="bg-[#18191d]">中文</option>
                  <option value="en-US" className="bg-[#18191d]">英语</option>
                  <option value="ja-JP" className="bg-[#18191d]">日语</option>
                  <option value="ko-KR" className="bg-[#18191d]">韩语</option>
                </select>
              </div>
            </div>

            {/* 音频与模型配置 */}
            <div className="space-y-3">
              <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                Pipeline
              </span>

              {/* 输入源 */}
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400">音频输入源</label>
                <select
                  value={audioSource}
                  onChange={(e) => setAudioSource(e.target.value)}
                  className="w-full bg-[#18191d] border border-[#27292e] text-neutral-200 text-xs py-1.5 px-2 rounded-md outline-none focus:border-neutral-500 cursor-pointer"
                >
                  <option value="system" className="bg-[#18191d]">系统声音内录 (视频/音乐)</option>
                  <option value="mic" className="bg-[#18191d]">物理麦克风</option>
                </select>
              </div>

              {/* ASR 引擎 */}
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400">语音识别引擎 (ASR)</label>
                <select
                  value={asrEngine}
                  onChange={(e) => setAsrEngine(e.target.value)}
                  className="w-full bg-[#18191d] border border-[#27292e] text-neutral-200 text-xs py-1.5 px-2 rounded-md outline-none focus:border-neutral-500 cursor-pointer"
                >
                  <option value="groq" className="bg-[#18191d]">Groq Whisper Turbo (极速)</option>
                  <option value="openai" className="bg-[#18191d]">OpenAI Whisper-1</option>
                  <option value="mock" className="bg-[#18191d]">内置演示</option>
                </select>
              </div>

              {/* 翻译引擎 */}
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400">翻译引擎 (MT)</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full bg-[#18191d] border border-[#27292e] text-neutral-200 text-xs py-1.5 px-2 rounded-md outline-none focus:border-neutral-500 cursor-pointer"
                >
                  <option value="groq" className="bg-[#18191d]">Groq 极速云端</option>
                  <option value="deepseek" className="bg-[#18191d]">DeepSeek (V4.1 / Flash)</option>
                  <option value="openai" className="bg-[#18191d]">OpenAI GPT-4o-mini</option>
                  <option value="mock" className="bg-[#18191d]">内置演示</option>
                </select>
              </div>

              {/* DeepSeek 架构模型选择 (V4.1 Flash / V4 Pro / Chat) */}
              {provider === "deepseek" && (
                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-400">DeepSeek 模型选择</label>
                  <select
                    value={deepseekModel}
                    onChange={(e) => setDeepseekModel(e.target.value)}
                    className="w-full bg-[#18191d] border border-[#27292e] text-neutral-200 text-xs py-1.5 px-2 rounded-md outline-none focus:border-neutral-500 cursor-pointer"
                  >
                    <option value="deepseek-flash" className="bg-[#18191d]">deepseek-flash (V4.1 Flash 极速 - 推荐)</option>
                    <option value="deepseek-chat" className="bg-[#18191d]">deepseek-chat (通用对话 / V3-V4 兼容)</option>
                    <option value="deepseek-v4-pro" className="bg-[#18191d]">deepseek-v4-pro (V4 Pro 旗舰)</option>
                  </select>
                </div>
              )}

              {/* Groq 架构模型选择 (包括主人截图中的 120b 与 20b) */}
              {provider === "groq" && (
                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-400">Groq 模型选择</label>
                  <select
                    value={groqModel}
                    onChange={(e) => setGroqModel(e.target.value)}
                    className="w-full bg-[#18191d] border border-[#27292e] text-neutral-200 text-xs py-1.5 px-2 rounded-md outline-none focus:border-neutral-500 cursor-pointer"
                  >
                    <option value="openai/gpt-oss-120b" className="bg-[#18191d]">openai/gpt-oss-120b (120B 大模型)</option>
                    <option value="openai/gpt-oss-20b" className="bg-[#18191d]">openai/gpt-oss-20b (极速 ~400ms)</option>
                    <option value="qwen/qwen3.8-27b" className="bg-[#18191d]">qwen/qwen3.8-27b (千问 27B)</option>
                  </select>
                </div>
              )}

              {/* 翻译风格 (人味 / 信达雅 / 直译) */}
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400">翻译风格</label>
                <select
                  value={translationStyle}
                  onChange={(e) => setTranslationStyle(e.target.value)}
                  className="w-full bg-[#18191d] border border-[#27292e] text-neutral-200 text-xs py-1.5 px-2 rounded-md outline-none focus:border-neutral-500 cursor-pointer"
                >
                  <option value="natural" className="bg-[#18191d]">自然人味 (地道口语/去机翻味)</option>
                  <option value="polished" className="bg-[#18191d]">信达雅 (典雅优美/文学润色)</option>
                  <option value="literal" className="bg-[#18191d]">严谨直译 (学术忠实)</option>
                </select>
              </div>

              {/* 采音切片间隔调节 */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-neutral-400">采音切片时延</span>
                  <span className="text-[10px] text-neutral-500 font-mono">{sliceDuration}ms</span>
                </div>
                <select
                  value={sliceDuration}
                  onChange={(e) => setSliceDuration(e.target.value)}
                  className="w-full bg-[#18191d] border border-[#27292e] text-neutral-200 text-xs py-1.5 px-2 rounded-md outline-none focus:border-neutral-500 cursor-pointer"
                >
                  <option value="1200" className="bg-[#18191d]">1.2 秒 (极速同传响应)</option>
                  <option value="1800" className="bg-[#18191d]">1.8 秒 (平衡推荐)</option>
                  <option value="3500" className="bg-[#18191d]">3.5 秒 (长句完整)</option>
                </select>
              </div>

              {/* 上下文记忆开关 */}
              <div className="flex items-center justify-between py-1 border-t border-[#202226] pt-2">
                <div>
                  <div className="text-[11px] text-neutral-300 font-medium">附加上文翻译</div>
                  <div className="text-[10px] text-neutral-500">将上句作为上下文发给模型</div>
                </div>
                <button
                  type="button"
                  onClick={() => setContextMemory(!contextMemory)}
                  className={`w-7 h-4 rounded-full transition-colors relative cursor-pointer ${
                    contextMemory ? "bg-emerald-600" : "bg-neutral-700"
                  }`}
                  title={contextMemory ? "已开启上下文连贯" : "已关闭上下文连贯"}
                >
                  <div
                    className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${
                      contextMemory ? "left-3.5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Groq Key */}
              {(asrEngine === "groq" || provider === "groq") && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-neutral-400">Groq API Key</span>
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-neutral-400 hover:text-neutral-200 underline text-[10px]"
                    >
                      获取 Key
                    </a>
                  </div>
                  <input
                    type="password"
                    placeholder="gsk_..."
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value.trim())}
                    className="w-full bg-[#18191d] border border-[#27292e] text-neutral-200 text-xs py-1.5 px-2 rounded-md outline-none focus:border-neutral-500 font-mono"
                  />
                </div>
              )}

              {/* DeepSeek Key */}
              {provider === "deepseek" && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-neutral-400">DeepSeek API Key</span>
                    <a
                      href="https://platform.deepseek.com/api_keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-neutral-400 hover:text-neutral-200 underline text-[10px]"
                    >
                      获取 Key
                    </a>
                  </div>
                  <input
                    type="password"
                    placeholder="sk-..."
                    value={deepseekKey}
                    onChange={(e) => setDeepseekKey(e.target.value.trim())}
                    className="w-full bg-[#18191d] border border-[#27292e] text-neutral-200 text-xs py-1.5 px-2 rounded-md outline-none focus:border-neutral-500 font-mono"
                  />
                </div>
              )}

              {/* OpenAI Key */}
              {(provider === "openai" || asrEngine === "openai") && (
                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-400">OpenAI Key</label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value.trim())}
                    className="w-full bg-[#18191d] border border-[#27292e] text-neutral-200 text-xs py-1.5 px-2 rounded-md outline-none focus:border-neutral-500 font-mono"
                  />
                </div>
              )}
            </div>

            {/* 音频信号状态 */}
            <div className="pt-2">
              <div className="flex justify-between items-center text-[10px] text-neutral-400 mb-1">
                <span>音频电平</span>
                <span className="font-mono text-neutral-300">
                  {audioLevel > 5 ? `${audioLevel}%` : "静音"}
                </span>
              </div>
              <div className="h-1 w-full bg-[#202226] rounded-full overflow-hidden">
                <div
                  className="h-full bg-neutral-300 transition-all duration-75"
                  style={{ width: `${audioLevel}%` }}
                />
              </div>
            </div>
          </div>

          {/* 底部按钮栏 */}
          <div className="pt-3 border-t border-[#202226] space-y-2 shrink-0">
            <button
              onClick={handleToggleOverlay}
              className="w-full py-1.5 px-3 bg-[#18191d] hover:bg-[#202226] text-neutral-300 text-xs font-medium rounded-md border border-[#27292e] transition"
            >
              悬浮字幕 HUD
            </button>
            <button
              onClick={isAudioActive ? stopAudio : startAudio}
              className={`w-full py-2 px-3 text-xs font-medium rounded-md transition ${
                isAudioActive
                  ? "bg-red-950 text-red-200 border border-red-800 hover:bg-red-900"
                  : "bg-neutral-100 text-neutral-900 hover:bg-white font-semibold"
              }`}
            >
              {isAudioActive ? "停止实时同传" : "开启实时同传"}
            </button>
          </div>
        </aside>

        {/* 右侧核心工作台 (双栏极简对照设计) */}
        <main className="flex-1 flex flex-col bg-[#0c0d0e] overflow-hidden">
          {/* 原文与译文分栏 */}
          <div className="flex-1 flex divide-x divide-[#202226] overflow-hidden">
            {/* 左半区：原文 */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#0c0d0e]">
              <div className="flex justify-between items-center h-8 px-3 border-b border-[#202226] bg-[#0f1012]">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-neutral-400">原文</span>
                  {sourceLatency && (
                    <span className="text-[10px] text-neutral-500 font-mono">{sourceLatency}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(sourceText, "source")}
                    className="p-1 text-neutral-500 hover:text-neutral-300 transition rounded"
                    title="复制"
                  >
                    {copiedSource ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={() => {
                      setSourceText("");
                      setPrevSourceText("");
                      prevSourceRef.current = "";
                    }}
                    className="p-1 text-neutral-500 hover:text-neutral-300 transition rounded"
                    title="清空"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex-1 p-3.5 overflow-y-auto text-sm leading-relaxed text-neutral-300 whitespace-pre-wrap select-text custom-scrollbar font-sans space-y-3">
                {contextMemory && prevSourceText && (
                  <div className="p-2 rounded bg-[#131418] border border-[#202227] text-xs">
                    <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                      已附带上文记忆 (Context)
                    </div>
                    <div className="text-neutral-400 font-sans text-xs italic">
                      "{prevSourceText}"
                    </div>
                  </div>
                )}
                <div>
                  {contextMemory && prevSourceText && (
                    <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-1">
                      本句原文
                    </div>
                  )}
                  <div className="text-neutral-100 font-medium">
                    {sourceText || (
                      <span className="text-neutral-600 select-none font-normal">
                        等待音频流输入，或在下方输入测试文本...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 右半区：译文 */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#0e0f11]">
              <div className="flex justify-between items-center h-8 px-3 border-b border-[#202226] bg-[#0f1012]">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-neutral-200">译文</span>
                  {targetLatency && (
                    <span className="text-[10px] text-neutral-400 font-mono">{targetLatency}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(targetText, "target")}
                    className="p-1 text-neutral-500 hover:text-neutral-300 transition rounded"
                    title="复制"
                  >
                    {copiedTarget ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={() => setTargetText("")}
                    className="p-1 text-neutral-500 hover:text-neutral-300 transition rounded"
                    title="清空"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex-1 p-3.5 overflow-y-auto text-sm leading-relaxed text-neutral-100 font-medium whitespace-pre-wrap select-text custom-scrollbar font-sans">
                {targetText || (
                  <span className="text-neutral-600 select-none">
                    实时翻译结果将呈现在这里...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 底部测试输入栏 (类似 Spotlight / Raycast) */}
          <form
            onSubmit={handleManualSubmit}
            className="flex items-center h-10 px-3 bg-[#111215] border-t border-[#202226] gap-2 shrink-0"
          >
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="输入文本按回车测试转译..."
              className="flex-1 bg-transparent text-xs text-neutral-200 placeholder:text-neutral-600 outline-none"
            />
            <button
              type="submit"
              className="flex items-center gap-1 px-2.5 py-1 bg-[#1a1b20] hover:bg-[#22242a] text-neutral-300 rounded border border-[#27292e] text-[11px] font-medium transition"
            >
              <span>发送</span>
              <CornerDownLeft className="w-2.5 h-2.5 text-neutral-500" />
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
