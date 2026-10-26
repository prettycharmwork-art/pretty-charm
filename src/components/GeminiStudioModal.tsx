import React, { useState } from 'react';
import {
  MessageSquare,
  Image as ImageIcon,
  Film,
  Search,
  MapPin,
  Send,
  Upload,
  X,
  Loader2,
} from 'lucide-react';

interface GeminiStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GeminiStudioModal: React.FC<GeminiStudioModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'image' | 'video' | 'grounding'>('chat');

  // 1. Multi-Turn Chat State
  const [chatModel, setChatModel] = useState<'standard' | 'complex' | 'fast'>('standard');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'model'; text: string }>>([
    {
      role: 'model',
      text: 'Hello! I am your Pretty Charm Styling & Gifting Concierge. Ask me for hair claw or rose-gold jewellery gift ideas under ₹500, or shipping rules from Gurugram!',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // 2. Image Generation & Editing State
  const [imagePrompt, setImagePrompt] = useState(
    'Luxury blush pink gift box with rose gold ribbon, pearl hair claw clip, and silk scrunchies on cream travertine stone'
  );
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:3' | '16:9'>('1:1');
  const [useProPreview, setUseProPreview] = useState<boolean>(false);
  const [uploadedImageBase64, setUploadedImageBase64] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // 3. Video Generation & Photo Animation State (gemini-omni-1.1-flash via Interactions API)
  const [videoPrompt, setVideoPrompt] = useState(
    'Soft morning sunlight shimmering across a blush pink gift hamper with rose gold pearls in slow motion'
  );
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoResultUrl, setVideoResultUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // 4. Search & Maps Grounding State
  const [groundingType, setGroundingType] = useState<'search' | 'maps'>('search');
  const [groundingQuery, setGroundingQuery] = useState(
    'Latest bridal and bridesmaid hair accessory gifting trends in India'
  );
  const [groundingResult, setGroundingResult] = useState<string>('');
  const [groundingChunks, setGroundingChunks] = useState<any[]>([]);
  const [groundingLoading, setGroundingLoading] = useState(false);

  if (!isOpen) return null;

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const nextMessages = [...messages, { role: 'user' as const, text: chatInput.trim() }];
    setMessages(nextMessages);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, modelMode: chatModel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat request failed');
      setMessages([...nextMessages, { role: 'model', text: data.text }]);
    } catch (err: any) {
      setMessages([
        ...nextMessages,
        { role: 'model', text: `Error: ${err.message || 'Unable to reach Gemini API.'}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImageBase64(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateOrEditImage = async (e: React.FormEvent) => {
    e.preventDefault();
    setImageLoading(true);
    setImageError(null);
    try {
      const res = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          imageSize,
          aspectRatio,
          base64Image: uploadedImageBase64,
          useProPreview,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image generation failed');
      setGeneratedImageUrl(data.imageUrl);
    } catch (err: any) {
      setImageError(err.message);
    } finally {
      setImageLoading(false);
    }
  };

  const handleGenerateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setVideoLoading(true);
    setVideoError(null);
    try {
      const res = await fetch('/api/ai/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: videoPrompt,
          aspectRatio: videoAspectRatio,
          base64Image: uploadedImageBase64,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Video generation failed');
      setVideoResultUrl(data.videoUrl);
    } catch (err: any) {
      setVideoError(err.message);
    } finally {
      setVideoLoading(false);
    }
  };

  const handleRunGrounding = async (e: React.FormEvent) => {
    e.preventDefault();
    setGroundingLoading(true);
    try {
      const res = await fetch('/api/ai/grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: groundingQuery,
          groundingType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Grounding request failed');
      setGroundingResult(data.text);
      setGroundingChunks(data.groundingChunks || []);
    } catch (err: any) {
      setGroundingResult(`Error: ${err.message}`);
    } finally {
      setGroundingLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gemini-studio-title"
    >
      <div className="w-full max-w-3xl rounded-2xl bg-[#fffdfb] border border-[#e4b7c0] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#fdf2f4] border-b border-[#e4b7c0]">
          <div>
            <h2 id="gemini-studio-title" className="text-2xl font-bold text-[#2d1e22]">
              Pretty Charm Gift Concierge &amp; Creative Studio
            </h2>
            <p className="text-xs text-[#6e5259]">
              Multi-turn styling assistant, high-resolution hamper visualizer (1K/2K/4K), video animator &amp; live search/maps grounding
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#7a3b47] hover:bg-[#fce9ee]"
            aria-label="Close Creative Studio"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 bg-[#fff8fa] border-b border-[#f0d8de] overflow-x-auto">
          {(
            [
              { id: 'chat', label: 'Styling Chatbot', icon: MessageSquare },
              { id: 'image', label: 'Create & Edit Images (1K–4K)', icon: ImageIcon },
              { id: 'video', label: 'Animate & Video (16:9 / 9:16)', icon: Film },
              { id: 'grounding', label: 'Search & Maps Grounding', icon: Search },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === t.id
                    ? 'bg-[#9e5461] text-white'
                    : 'bg-white text-[#6e5259] border border-[#e4b7c0] hover:text-[#2d1e22]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="p-6 max-h-[72vh] overflow-y-auto">
          {activeTab === 'chat' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#fdf2f4] p-3 rounded-xl border border-[#e4b7c0]">
                <span className="text-xs font-medium text-[#5c4349]">Select Gemini Reasoning Mode:</span>
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: 'fast', label: 'Fast (Flash Lite)' },
                      { id: 'standard', label: 'Balanced (3.8 Flash)' },
                      { id: 'complex', label: 'Deep Styling (4 Argon)' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setChatModel(m.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        chatModel === m.id
                          ? 'bg-[#2d1e22] text-white'
                          : 'bg-white text-[#6e5259] border border-[#e4b7c0]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-64 overflow-y-auto rounded-xl border border-[#e8d5d9] bg-white p-4 space-y-3">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-[#9e5461] text-white'
                          : 'bg-[#fdf2f4] text-[#2d1e22] border border-[#e4b7c0]'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-xs text-[#7a3b47]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Pretty Charm Concierge is thinking...</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSendChat} className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask for gift hamper advice, hair accessory styling, or Gurugram shipping..."
                  aria-label="Chat message"
                  className="flex-1 rounded-xl border border-[#e4b7c0] bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-[#9e5461]"
                />
                <button
                  type="submit"
                  disabled={chatLoading}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#9e5461] text-white text-sm font-medium hover:bg-[#83424e] disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          )}

          {activeTab === 'image' && (
            <form onSubmit={handleGenerateOrEditImage} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                  Image Prompt (Create or Edit Gift Concept)
                </label>
                <textarea
                  rows={2}
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  className="w-full rounded-xl border border-[#e4b7c0] bg-white p-3 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                    Resolution Size
                  </label>
                  <div className="flex gap-1.5">
                    {(['1K', '2K', '4K'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setImageSize(sz)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${
                          imageSize === sz
                            ? 'bg-[#9e5461] text-white border-[#9e5461]'
                            : 'bg-white text-[#5c4349] border-[#e4b7c0]'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                    Aspect Ratio
                  </label>
                  <div className="flex gap-1.5">
                    {(['1:1', '4:3', '16:9'] as const).map((ar) => (
                      <button
                        key={ar}
                        type="button"
                        onClick={() => setAspectRatio(ar)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${
                          aspectRatio === ar
                            ? 'bg-[#9e5461] text-white border-[#9e5461]'
                            : 'bg-white text-[#5c4349] border-[#e4b7c0]'
                        }`}
                      >
                        {ar}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                    Model Engine
                  </label>
                  <button
                    type="button"
                    onClick={() => setUseProPreview((p) => !p)}
                    className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold border border-[#e4b7c0] bg-white text-[#2d1e22]"
                  >
                    {useProPreview ? 'gemini-3-pro-image-preview' : 'gemini-nano-banana-2.1'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#e4b7c0] bg-[#fdf2f4] text-xs font-medium text-[#7a3b47] cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadedImageBase64 ? 'Reference Photo Attached' : 'Upload Photo to Edit (Optional)'}</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>

                <button
                  type="submit"
                  disabled={imageLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#9e5461] text-white text-sm font-medium hover:bg-[#83424e] disabled:opacity-50"
                >
                  {imageLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{uploadedImageBase64 ? 'Edit Image' : `Generate ${imageSize} Image`}</span>
                </button>
              </div>

              {imageError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                  {imageError}
                </div>
              )}

              {generatedImageUrl && (
                <div className="mt-3 rounded-xl overflow-hidden border border-[#e4b7c0] bg-white p-3">
                  <img
                    src={generatedImageUrl}
                    alt="Generated custom Pretty Charm concept"
                    referrerPolicy="no-referrer"
                    className="max-h-72 mx-auto rounded-lg object-contain"
                  />
                </div>
              )}
            </form>
          )}

          {activeTab === 'video' && (
            <form onSubmit={handleGenerateVideo} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                  Video Motion Prompt (gemini-omni-1.1-flash via Interactions API)
                </label>
                <textarea
                  rows={2}
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  className="w-full rounded-xl border border-[#e4b7c0] bg-white p-3 text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#5c4349]">Aspect Ratio:</span>
                  {(['16:9', '9:16'] as const).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setVideoAspectRatio(ratio)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                        videoAspectRatio === ratio
                          ? 'bg-[#9e5461] text-white border-[#9e5461]'
                          : 'bg-white text-[#5c4349] border-[#e4b7c0]'
                      }`}
                    >
                      {ratio === '16:9' ? '16:9 Landscape' : '9:16 Portrait Reel'}
                    </button>
                  ))}
                </div>

                <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#e4b7c0] bg-[#fdf2f4] text-xs font-medium text-[#7a3b47] cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadedImageBase64 ? 'Starting Photo Ready' : 'Upload Photo to Animate (Optional)'}</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>

                <button
                  type="submit"
                  disabled={videoLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#9e5461] text-white text-sm font-medium hover:bg-[#83424e] disabled:opacity-50"
                >
                  {videoLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{uploadedImageBase64 ? 'Animate Photo into Video' : 'Generate Video'}</span>
                </button>
              </div>

              {videoError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                  {videoError}
                </div>
              )}

              {videoResultUrl && (
                <div className="mt-3 rounded-xl overflow-hidden border border-[#e4b7c0] bg-black p-2">
                  <video src={videoResultUrl} controls className="max-h-72 mx-auto rounded-lg" />
                </div>
              )}
            </form>
          )}

          {activeTab === 'grounding' && (
            <form onSubmit={handleRunGrounding} className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setGroundingType('search');
                    setGroundingQuery('Trending bridesmaid gift hampers and hair accessories in India');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border ${
                    groundingType === 'search'
                      ? 'bg-[#9e5461] text-white border-[#9e5461]'
                      : 'bg-white text-[#5c4349] border-[#e4b7c0]'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Google Search Grounding</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGroundingType('maps');
                    setGroundingQuery('Courier hubs and gifting shopping areas near Gurugram Haryana 122001');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border ${
                    groundingType === 'maps'
                      ? 'bg-[#9e5461] text-white border-[#9e5461]'
                      : 'bg-white text-[#5c4349] border-[#e4b7c0]'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Google Maps Grounding (Gurugram Origin)</span>
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={groundingQuery}
                  onChange={(e) => setGroundingQuery(e.target.value)}
                  className="flex-1 rounded-xl border border-[#e4b7c0] bg-white px-4 py-2.5 text-sm"
                />
                <button
                  type="submit"
                  disabled={groundingLoading}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#9e5461] text-white text-sm font-medium hover:bg-[#83424e] disabled:opacity-50"
                >
                  {groundingLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Search</span>
                </button>
              </div>

              {groundingResult && (
                <div className="rounded-xl border border-[#e4b7c0] bg-white p-4 space-y-3">
                  <p className="text-sm text-[#2d1e22] whitespace-pre-line leading-relaxed">
                    {groundingResult}
                  </p>
                  {groundingChunks.length > 0 && (
                    <div className="pt-2 border-t border-[#f0d8de]">
                      <p className="text-xs font-semibold text-[#7a3b47] mb-1">Verified Sources:</p>
                      <ul className="space-y-1 text-xs">
                        {groundingChunks.map((chunk: any, i: number) => {
                          const uri = chunk.web?.uri || chunk.maps?.uri;
                          const title = chunk.web?.title || chunk.maps?.title || uri;
                          if (!uri) return null;
                          return (
                            <li key={i}>
                              <a
                                href={uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#9e5461] underline hover:text-[#7a3b47]"
                              >
                                {title}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
