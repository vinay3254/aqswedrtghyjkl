import { useCallback, useRef, useState, useEffect } from "react";
import { aiChat } from "../api/apiClient";

const ACCEPT = "image/jpeg,image/png,image/gif,image/webp";

const LANGUAGES = [
  { code: "en",  label: "English" },
  { code: "hi",  label: "हिंदी" },
  { code: "kn",  label: "ಕನ್ನಡ" },
  { code: "te",  label: "తెలుగు" },
  { code: "ta",  label: "தமிழ்" },
];

function renderMarkdown(text) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
    return (
      <span key={i}>
        {parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={j} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith("[") && part.includes("](") && part.endsWith(")")) {
            const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
            if (match) {
              return (
                <a 
                  key={j} 
                  href={match[2]} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium break-all"
                >
                  {match[1]}
                </a>
              );
            }
          }
          return part;
        })}
        <br />
      </span>
    );
  });
}

export default function AskAIPage() {
  const [image, setImage]           = useState(null);   // { preview, base64, mediaType, name }
  const [messages, setMessages]     = useState([]);      // [{role, content, isImage?}]
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const [error, setError]           = useState(null);
  const [language, setLanguage]     = useState("en");
  const [userLocation, setUserLocation] = useState(null);
  const inputRef                    = useRef();
  const fileInputRef                = useRef();
  const bottomRef                   = useRef();

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (err) => {
          console.error("Error getting geolocation:", err.message);
        }
      );
    }
  }, []);

  const scrollBottom = () =>
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

  const loadImage = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please upload a valid image file (JPEG, PNG, GIF, WebP).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const base64 = dataUrl.split(",")[1];
      setImage({ preview: dataUrl, base64, mediaType: file.type, name: file.name });
      setMessages([]);
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadImage(file);
  }, [loadImage]);

  const send = useCallback(async (question = "") => {
    if (!image) return;
    setLoading(true);
    setError(null);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const next = [...messages];
    if (question) next.push({ role: "user", content: question });
    setMessages(next);
    scrollBottom();

    try {
      const data = await aiChat(image.base64, image.mediaType, history, question, language, userLocation);
      setMessages([...next, { role: "assistant", content: data.reply }]);
      setInput("");
      scrollBottom();
    } catch {
      setError("AI Assistant temporarily unavailable. Please try again.");
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  }, [image, messages, userLocation]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !loading) {
      e.preventDefault();
      if (messages.length === 0) {
        send(input.trim() || "");
      } else if (input.trim()) {
        send(input.trim());
      }
    }
  };

  const reset = () => {
    setImage(null);
    setMessages([]);
    setInput("");
    setError(null);
    setLanguage("en");
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900">CliniQ</h1>
            <p className="text-xs text-slate-400">Upload any medical image — get condition, prevention, treatment & medications</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="text-xs text-slate-600 border border-slate-200 rounded-lg px-2 py-1 bg-white hover:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400 transition-colors"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          {image && (
            <button onClick={reset} className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              New chat
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-4 py-6 gap-4">

        {/* Upload zone — shown until image selected */}
        {!image && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl cursor-pointer transition-all min-h-[320px] ${
              dragOver ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:border-violet-400 hover:bg-slate-50"
            }`}
          >
            <input ref={fileInputRef} type="file" accept={ACCEPT} className="hidden"
              onChange={(e) => e.target.files[0] && loadImage(e.target.files[0])} />
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center">
                <svg className="w-8 h-8 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  <span className="text-violet-600">Click to upload</span> or drag & drop
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Skin conditions, rashes, X-rays, wounds, eyes, and more
                </p>
                <p className="text-xs text-slate-300 mt-0.5">JPEG · PNG · GIF · WebP</p>
              </div>
            </div>
          </div>
        )}

        {/* Chat messages */}
        {image && (
          <div className="flex-1 space-y-4 overflow-y-auto pb-2">
            {/* Image bubble */}
            <div className="flex justify-end">
              <div className="bg-violet-600 rounded-2xl rounded-tr-sm overflow-hidden max-w-[240px] shadow-sm">
                <img src={image.preview} alt={image.name} className="w-full object-cover max-h-48" />
                <p className="text-white/80 text-xs px-3 py-1.5 truncate">{image.name}</p>
              </div>
            </div>

            {/* Conversation messages */}
            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="bg-violet-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-[75%] shadow-sm">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-700 leading-relaxed flex-1 shadow-sm">
                    {renderMarkdown(msg.content)}
                  </div>
                </div>
              )
            )}

            {/* Loading bubble */}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                  <div className="spinner w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-400 italic shadow-sm">
                  Analyzing your image…
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}

        {/* Input area */}
        {image && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-1.5 border-b border-slate-100">
              <img src={image.preview} alt="" className="w-5 h-5 rounded object-cover" />
              <span className="text-xs text-slate-400 truncate flex-1">{image.name}</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-violet-500 hover:text-violet-700 font-medium shrink-0"
              >
                Change
              </button>
              <input ref={fileInputRef} type="file" accept={ACCEPT} className="hidden"
                onChange={(e) => e.target.files[0] && loadImage(e.target.files[0])} />
            </div>
            <div className="flex items-end gap-2 px-3 py-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={messages.length === 0 ? "Ask something, or press Enter to analyze…" : "Ask a follow-up question…"}
                disabled={loading}
                rows={1}
                className="flex-1 resize-none text-sm text-slate-700 placeholder-slate-400 outline-none bg-transparent disabled:opacity-50 py-1"
                style={{ maxHeight: "120px", overflowY: "auto" }}
              />
              <button
                onClick={() => {
                  if (messages.length === 0) send(input.trim());
                  else if (input.trim()) send(input.trim());
                }}
                disabled={loading || (messages.length > 0 && !input.trim())}
                className="w-8 h-8 rounded-xl bg-violet-600 hover:bg-violet-700 flex items-center justify-center shrink-0 transition-colors disabled:opacity-40"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
