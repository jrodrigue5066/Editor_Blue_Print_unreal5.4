import React, { useEffect, useRef, useState } from 'react';
import { Message, Sender, BlueprintNode, AspectRatio } from '../types';
import { Send, Image as ImageIcon, Loader2, Bot, User, Sparkles, Search, ImagePlus, Settings2 } from 'lucide-react';
import { sendMessageToGemini, generateBlueprintImage } from '../services/geminiService';

interface ChatInterfaceProps {
  setNodes: React.Dispatch<React.SetStateAction<BlueprintNode[]>>;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ setNodes }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: "Hello! I'm your Unreal Engine 5.4 Blueprint Architect. Describe a game mechanic, and I'll help you design the node logic. I can also generate UI assets or search the docs.",
      sender: Sender.BOT,
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [mode, setMode] = useState<'chat' | 'image_gen'>('chat');
  
  // Image Gen State
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Attachment State
  const [attachment, setAttachment] = useState<{ data: string; mimeType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data URL prefix for API
      const base64Data = base64String.split(',')[1];
      setAttachment({
        data: base64Data,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachment) || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: input,
      sender: Sender.USER,
      timestamp: new Date(),
      attachment: attachment ? { type: 'image', data: attachment.data, mimeType: attachment.mimeType } : undefined
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setAttachment(null);
    setIsLoading(true);

    try {
      // Convert previous messages to history context (simplified)
      const history = messages.map(m => `${m.sender}: ${m.text}`);
      
      const responseText = await sendMessageToGemini(
        userMsg.text,
        history,
        userMsg.attachment ? { data: userMsg.attachment.data, mimeType: userMsg.attachment.mimeType } : undefined,
        useSearch
      );

      // Parse for JSON nodes
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.nodes && Array.isArray(parsed.nodes)) {
                // Layout logic: Spread them out roughly
                const newNodes = parsed.nodes.map((n: any, idx: number) => ({
                    id: `node-${Date.now()}-${idx}`,
                    name: n.name,
                    type: n.type || 'function',
                    inputs: n.inputs || [],
                    outputs: n.outputs || [],
                    x: 100 + (idx * 250), // Stagger position
                    y: 100 + (idx % 2) * 100
                }));
                setNodes(prev => [...prev, ...newNodes]);
            }
        } catch (e) {
            console.error("Failed to parse Blueprint nodes JSON", e);
        }
      }

      // Clean the JSON out of the text for display if desired, or keep it. 
      // We'll keep it as it helps explain the logic.
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        sender: Sender.BOT,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!input.trim() || isGeneratingImage) return;
    setIsGeneratingImage(true);
    setGeneratedImage(null);

    try {
        const base64Image = await generateBlueprintImage(input, selectedAspectRatio);
        if (base64Image) {
            setGeneratedImage(base64Image);
            const botMsg: Message = {
                id: Date.now().toString(),
                text: `Generated asset for: "${input}"`,
                sender: Sender.BOT,
                timestamp: new Date(),
                attachment: { type: 'image', data: base64Image.split(',')[1], mimeType: 'image/png' }
            };
            setMessages(prev => [...prev, botMsg]);
        }
    } catch (e) {
        console.error(e);
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            text: "Failed to generate image. Please try again.",
            sender: Sender.BOT,
            timestamp: new Date()
        }]);
    } finally {
        setIsGeneratingImage(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900 border-l border-neutral-800 shadow-2xl">
      {/* Header Tabs */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-800 border-b border-neutral-700">
        <div className="flex space-x-4">
            <button 
                onClick={() => setMode('chat')}
                className={`flex items-center gap-2 text-sm font-medium ${mode === 'chat' ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
            >
                <Bot size={18} />
                Blueprint Assistant
            </button>
            <button 
                onClick={() => setMode('image_gen')}
                className={`flex items-center gap-2 text-sm font-medium ${mode === 'image_gen' ? 'text-purple-400' : 'text-gray-400 hover:text-gray-200'}`}
            >
                <ImagePlus size={18} />
                Asset Gen
            </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {mode === 'chat' && (
            <>
                {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.sender === Sender.USER ? 'flex-row-reverse' : ''}`}
                >
                    <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        msg.sender === Sender.USER ? 'bg-blue-600' : 'bg-emerald-600'
                    }`}
                    >
                    {msg.sender === Sender.USER ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    <div
                    className={`max-w-[85%] p-3 rounded-2xl text-sm whitespace-pre-wrap ${
                        msg.sender === Sender.USER
                        ? 'bg-blue-600/20 text-blue-100 rounded-tr-none border border-blue-500/30'
                        : 'bg-neutral-800 text-gray-200 rounded-tl-none border border-neutral-700'
                    }`}
                    >
                    {msg.attachment && (
                        <img 
                            src={`data:${msg.attachment.mimeType};base64,${msg.attachment.data}`} 
                            alt="Attachment" 
                            className="max-w-full rounded-lg mb-2 border border-neutral-600"
                        />
                    )}
                    {msg.text}
                    </div>
                </div>
                ))}
                {isLoading && (
                <div className="flex gap-3">
                     <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                        <Bot size={16} />
                     </div>
                     <div className="bg-neutral-800 p-3 rounded-2xl rounded-tl-none border border-neutral-700 flex items-center gap-2 text-gray-400 text-sm">
                         <Loader2 className="animate-spin" size={14} />
                         Thinking (Pro 3)...
                     </div>
                </div>
                )}
                <div ref={messagesEndRef} />
            </>
        )}

        {mode === 'image_gen' && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
                {!generatedImage && !isGeneratingImage && (
                    <>
                        <Sparkles size={48} className="text-purple-500 mb-2" />
                        <p>Enter a prompt below to generate UI assets or textures.</p>
                    </>
                )}
                {isGeneratingImage && (
                    <div className="flex flex-col items-center animate-pulse">
                        <Loader2 className="animate-spin mb-2 text-purple-500" size={32} />
                        <p>Generating high-quality asset...</p>
                    </div>
                )}
                {generatedImage && (
                    <div className="bg-neutral-800 p-2 rounded-lg border border-neutral-700">
                        <img src={generatedImage} alt="Generated" className="max-w-full max-h-[400px] rounded" />
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-neutral-800 border-t border-neutral-700">
        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-3 text-xs">
            {mode === 'chat' && (
                 <button
                    onClick={() => setUseSearch(!useSearch)}
                    className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
                        useSearch 
                        ? 'bg-blue-900/50 border-blue-500 text-blue-300' 
                        : 'bg-neutral-700 border-transparent text-gray-400 hover:bg-neutral-600'
                    }`}
                >
                    <Search size={12} />
                    Google Search
                </button>
            )}

            {mode === 'image_gen' && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 w-full">
                    <Settings2 size={14} className="text-gray-400 flex-shrink-0" />
                    {Object.values(AspectRatio).map((ratio) => (
                        <button
                            key={ratio}
                            onClick={() => setSelectedAspectRatio(ratio)}
                            className={`px-2 py-1 rounded border text-[10px] whitespace-nowrap ${
                                selectedAspectRatio === ratio
                                ? 'bg-purple-900/50 border-purple-500 text-purple-300'
                                : 'bg-neutral-700 border-transparent text-gray-400'
                            }`}
                        >
                            {ratio}
                        </button>
                    ))}
                </div>
            )}
        </div>

        {attachment && (
             <div className="flex items-center gap-2 mb-2 bg-neutral-700/50 p-2 rounded w-fit">
                <ImageIcon size={14} className="text-gray-300" />
                <span className="text-xs text-gray-300 truncate max-w-[200px]">Image attached</span>
                <button onClick={() => setAttachment(null)} className="text-gray-400 hover:text-red-400 ml-2">
                    &times;
                </button>
             </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-neutral-700 rounded-lg transition-colors"
            title="Upload Screenshot"
            disabled={mode === 'image_gen'}
          >
            <ImageIcon size={20} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*"
          />
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (mode === 'chat' ? handleSend() : handleGenerateImage())}
            placeholder={mode === 'chat' ? "How do I make a dash ability?" : "Describe texture or UI element..."}
            className="flex-1 bg-neutral-900 border border-neutral-600 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 placeholder-gray-600"
          />
          
          <button
            onClick={mode === 'chat' ? handleSend : handleGenerateImage}
            disabled={isLoading || isGeneratingImage}
            className={`p-2 rounded-lg transition-colors ${
                mode === 'chat' 
                ? 'bg-blue-600 hover:bg-blue-500 text-white disabled:bg-blue-800'
                : 'bg-purple-600 hover:bg-purple-500 text-white disabled:bg-purple-800'
            }`}
          >
            {isGeneratingImage ? <Loader2 className="animate-spin" size={20}/> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
