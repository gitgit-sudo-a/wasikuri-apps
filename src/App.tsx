/**
 * @licens
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Code2, 
  Trash2, 
  Copy, 
  Download, 
  Check, 
  Monitor, 
  Smartphone, 
  Tablet,
  RefreshCw,
  Zap,
  Sparkles,
  Send,
  Loader2,
  X,
  Maximize2,
  Minimize2,
  Eraser,
  AlertCircle,
  Terminal,
  Braces,
  Palette,
  FileCode
} from 'lucide-react';
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: 'Inter', system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #020617;
      color: #f8fafc;
    }
    .container {
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(12px);
      padding: 3rem;
      border-radius: 2rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
      text-align: center;
      max-width: 500px;
    }
    h1 { 
      background: linear-gradient(to right, #818cf8, #c084fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 1rem;
      font-size: 2.5rem;
    }
    p { color: #94a3b8; line-height: 1.6; font-size: 1.1rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Full Screen!</h1>
    <p>右上の拡大アイコンを押して<br>全画面プレビューを試してみてください。</p>
  </div>
</body>
</html>`;

export default function App() {
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [css, setCss] = useState('');
  const [js, setJs] = useState('');
  const [python, setPython] = useState('');
  const [activeEditorTab, setActiveEditorTab] = useState<'html' | 'css' | 'js' | 'python'>('html');
  
  const [viewMode, setViewMode] = useState<'split' | 'editor' | 'preview'>('split');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [copied, setCopied] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // UI States
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [logs, setLogs] = useState<{ type: string, content: string, id: number }[]>([]);

  // Refs
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Combine code for iframe
  const combinedCode = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>${css}</style>
        <script src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js"></script>
        <script>
          // Console Proxy
          (function() {
            const originalLog = console.log;
            const originalError = console.error;
            const originalWarn = console.warn;
            
            function sendToParent(type, args) {
              window.parent.postMessage({
                type: 'console',
                logType: type,
                content: args.map(arg => 
                  typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ')
              }, '*');
            }

            console.log = (...args) => {
              sendToParent('log', args);
              originalLog.apply(console, args);
            };
            console.error = (...args) => {
              sendToParent('error', args);
              originalError.apply(console, args);
            };
            console.warn = (...args) => {
              sendToParent('warn', args);
              originalWarn.apply(console, args);
            };

            window.onerror = (msg, url, line, col, error) => {
              sendToParent('error', [msg + ' (line ' + line + ')']);
              return false;
            };

            // Pyodide Runner
            window.runPythonCode = async (code) => {
              if (!code.trim()) return;
              try {
                if (!window.pyodide) {
                  sendToParent('log', ['Initializing Python runtime...']);
                  window.pyodide = await loadPyodide({
                    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
                  });
                  sendToParent('log', ['Python runtime ready.']);
                }
                
                // Redirect Python stdout/stderr to our console
                window.pyodide.setStdout({ batched: (str) => sendToParent('log', [str]) });
                window.pyodide.setStderr({ batched: (str) => sendToParent('error', [str]) });
                
                await window.pyodide.runPythonAsync(code);
              } catch (err) {
                sendToParent('error', ['Python Error: ' + err.message]);
              }
            };
          })();
        </script>
      </head>
      <body>
        ${html}
        <script>${js}<\/script>
        <script>
          if (window.runPythonCode) {
            window.runPythonCode(\`${python.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`);
          }
        </script>
      </body>
    </html>
  `;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'console') {
        setLogs(prev => [...prev, { 
          type: event.data.logType, 
          content: event.data.content, 
          id: Date.now() + Math.random() 
        }].slice(-50)); // Keep last 50 logs
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleCopy = () => {
    const fullCode = `<!-- HTML -->\n${html}\n\n/* CSS */\n${css}\n\n// JS\n${js}\n\n# Python\n${python}`;
    navigator.clipboard.writeText(fullCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([combinedCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmClear = () => {
    setHtml('');
    setCss('');
    setJs('');
    setPython('');
    setLogs([]);
    setIsConfirmOpen(false);
  };

  const handleRefresh = () => {
    setLogs([]);
    setRefreshKey(prev => prev + 1);
  };

  const handleFullScreen = () => {
    const element = previewContainerRef.current;
    if (!element) return;

    // Try native fullscreen first
    const requestMethod = 
      element.requestFullscreen || 
      (element as any).webkitRequestFullscreen || 
      (element as any).mozRequestFullScreen || 
      (element as any).msRequestFullscreen;

    if (requestMethod) {
      requestMethod.call(element).catch(() => {
        // Fallback to internal maximized state if native fails
        setIsMaximized(!isMaximized);
      });
    } else {
      // Fallback for iOS/Mobile Safari
      setIsMaximized(!isMaximized);
    }
  };

  const generateWithAi = async () => {
    if (!prompt.trim() || isGenerating) return;
    
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `以下の要望に合わせたWebアプリのコードを生成してください。
        HTML, CSS, JavaScript, Pythonを分離したJSON形式で出力してください。
        Pythonが必要ない場合は空文字列にしてください。
        
        要望: ${prompt}
        
        現在のコード:
        HTML: ${html}
        CSS: ${css}
        JS: ${js}
        Python: ${python}`,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH
          },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              html: { type: Type.STRING },
              css: { type: Type.STRING },
              js: { type: Type.STRING },
              python: { type: Type.STRING }
            },
            required: ["html", "css", "js", "python"]
          }
        }
      });
      
      const result = JSON.parse(response.text || '{}');
      if (result.html !== undefined) setHtml(result.html);
      if (result.css !== undefined) setCss(result.css);
      if (result.js !== undefined) setJs(result.js);
      if (result.python !== undefined) setPython(result.python);
      
      setIsAiOpen(false);
      setPrompt('');
    } catch (error) {
      console.error("AI Generation Error:", error);
      alert("AI生成中にエラーが発生しました。");
    } finally {
      setIsGenerating(false);
    }
  };

  const deviceWidths = {
    desktop: '100%',
    tablet: '768px',
    mobile: '375px',
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-900 border-b border-slate-800 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white hidden sm:block">HTML Live Viewer</h1>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 bg-slate-800 p-1 rounded-lg">
          <button onClick={() => setViewMode('editor')} className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${viewMode === 'editor' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Editor</button>
          <button onClick={() => setViewMode('split')} className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${viewMode === 'split' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Split</button>
          <button onClick={() => setViewMode('preview')} className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${viewMode === 'preview' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Preview</button>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setIsAiOpen(!isAiOpen)}
            className={`p-2.5 rounded-lg transition-all ${isAiOpen ? 'bg-indigo-600 text-white' : 'text-indigo-400 hover:bg-indigo-500/10'}`}
          >
            <Sparkles className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-slate-800 mx-0.5 hidden sm:block"></div>
          <button onClick={handleRefresh} className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"><RefreshCw className="w-5 h-5" /></button>
          <button onClick={handleCopy} className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors relative">{copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}</button>
          <button onClick={() => setIsConfirmOpen(true)} className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
        </div>
      </header>

      {/* AI Assistant Panel */}
      <AnimatePresence>
        {isAiOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-slate-900 border-b border-slate-800 overflow-hidden z-10"
          >
            <div className="max-w-4xl mx-auto p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">AI Assistant</span>
                </div>
                <button onClick={() => setIsAiOpen(false)} className="text-slate-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
              </div>
              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="例: モダンなログイン画面を作って..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 pr-12 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors resize-none h-24"
                />
                <button
                  onClick={generateWithAi}
                  disabled={isGenerating || !prompt.trim()}
                  className="absolute bottom-4 right-4 p-2.5 bg-indigo-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-500 transition-colors"
                >
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Editor Section */}
        {(viewMode === 'editor' || viewMode === 'split') && (
          <div className={`flex flex-col border-r border-slate-800 bg-slate-950 ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
            <div className="flex items-center justify-between px-2 py-1 bg-slate-900/50 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setActiveEditorTab('html')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${activeEditorTab === 'html' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <FileCode className="w-3 h-3" /> HTML
                </button>
                <button 
                  onClick={() => setActiveEditorTab('css')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${activeEditorTab === 'css' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <Palette className="w-3 h-3" /> CSS
                </button>
                <button 
                  onClick={() => setActiveEditorTab('js')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${activeEditorTab === 'js' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <Braces className="w-3 h-3" /> JS
                </button>
                <button 
                  onClick={() => setActiveEditorTab('python')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${activeEditorTab === 'python' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <Terminal className="w-3 h-3" /> Python
                </button>
              </div>
              <button 
                onClick={() => setIsConfirmOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:text-red-400 transition-colors active:scale-95"
              >
                <Eraser className="w-3.5 h-3.5" />
                CLEAR
              </button>
            </div>
            
            <div className="flex-1 relative">
              {activeEditorTab === 'html' && (
                <textarea
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  spellCheck={false}
                  placeholder="HTML goes here..."
                  className="absolute inset-0 w-full h-full p-4 sm:p-6 bg-transparent text-indigo-300 font-mono text-sm resize-none focus:outline-none selection:bg-indigo-500/30 leading-relaxed"
                />
              )}
              {activeEditorTab === 'css' && (
                <textarea
                  value={css}
                  onChange={(e) => setCss(e.target.value)}
                  spellCheck={false}
                  placeholder="CSS goes here..."
                  className="absolute inset-0 w-full h-full p-4 sm:p-6 bg-transparent text-pink-300 font-mono text-sm resize-none focus:outline-none selection:bg-pink-500/30 leading-relaxed"
                />
              )}
              {activeEditorTab === 'js' && (
                <textarea
                  value={js}
                  onChange={(e) => setJs(e.target.value)}
                  spellCheck={false}
                  placeholder="JavaScript goes here..."
                  className="absolute inset-0 w-full h-full p-4 sm:p-6 bg-transparent text-yellow-200 font-mono text-sm resize-none focus:outline-none selection:bg-yellow-500/30 leading-relaxed"
                />
              )}
              {activeEditorTab === 'python' && (
                <textarea
                  value={python}
                  onChange={(e) => setPython(e.target.value)}
                  spellCheck={false}
                  placeholder="Python code goes here..."
                  className="absolute inset-0 w-full h-full p-4 sm:p-6 bg-transparent text-emerald-300 font-mono text-sm resize-none focus:outline-none selection:bg-emerald-500/30 leading-relaxed"
                />
              )}
            </div>
          </div>
        )}

        {/* Preview Section */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`flex flex-col bg-slate-900 relative ${viewMode === 'split' ? 'w-1/2' : 'w-full'} ${isMaximized ? 'fixed inset-0 z-50' : ''}`}>
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-800 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Preview</span>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-800/50 p-0.5 rounded-md">
                  <button onClick={() => setPreviewDevice('mobile')} className={`p-1.5 rounded transition-colors ${previewDevice === 'mobile' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}><Smartphone className="w-4 h-4" /></button>
                  <button onClick={() => setPreviewDevice('tablet')} className={`p-1.5 rounded transition-colors ${previewDevice === 'tablet' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}><Tablet className="w-4 h-4" /></button>
                  <button onClick={() => setPreviewDevice('desktop')} className={`p-1.5 rounded transition-colors ${previewDevice === 'desktop' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}><Monitor className="w-4 h-4" /></button>
                </div>
                <button 
                  onClick={handleFullScreen}
                  className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition-colors active:scale-95"
                >
                  {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-2 sm:p-8 flex justify-center bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] relative">
              <motion.div 
                ref={previewContainerRef}
                layout 
                initial={false} 
                animate={{ width: isMaximized ? '100%' : deviceWidths[previewDevice] }} 
                className={`bg-white shadow-2xl overflow-hidden h-full border border-slate-700 relative ${isMaximized ? 'rounded-none' : 'rounded-xl'}`}
              >
                <iframe key={refreshKey} srcDoc={combinedCode} title="Preview" className="w-full h-full bg-white" sandbox="allow-scripts allow-modals allow-forms allow-popups" />
              </motion.div>

              {/* Console Toggle Button */}
              <button 
                onClick={() => setIsConsoleOpen(!isConsoleOpen)}
                className={`absolute bottom-4 right-4 sm:bottom-12 sm:right-12 p-3 rounded-full shadow-xl transition-all z-30 flex items-center gap-2 ${isConsoleOpen ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              >
                <Terminal className="w-5 h-5" />
                <span className="text-xs font-bold hidden sm:inline">Console</span>
                {logs.length > 0 && !isConsoleOpen && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-[10px] flex items-center justify-center rounded-full text-white animate-pulse">
                    {logs.length}
                  </span>
                )}
              </button>

              {/* Console Panel */}
              <AnimatePresence>
                {isConsoleOpen && (
                  <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="absolute bottom-16 right-4 left-4 sm:bottom-24 sm:right-12 sm:left-auto sm:w-96 h-64 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-20 flex flex-col"
                  >
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Terminal className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Console Output</span>
                      </div>
                      <button onClick={() => setLogs([])} className="text-[10px] font-bold text-slate-500 hover:text-white transition-colors">CLEAR</button>
                    </div>
                    <div className="flex-1 overflow-auto p-3 font-mono text-[11px] space-y-1.5">
                      {logs.length === 0 ? (
                        <div className="text-slate-600 italic">No logs yet...</div>
                      ) : (
                        logs.map(log => (
                          <div key={log.id} className={`flex gap-2 border-b border-slate-800/50 pb-1 ${log.type === 'error' ? 'text-red-400' : log.type === 'warn' ? 'text-yellow-400' : 'text-slate-300'}`}>
                            <span className="opacity-30 shrink-0">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                            <span className="break-all whitespace-pre-wrap">{log.content}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {isConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfirmOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center gap-3 text-red-400 mb-4">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold text-white">コードを削除しますか？</h3>
              </div>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                エディタ内のすべてのコードが消去されます。この操作は取り消せません。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsConfirmOpen(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={confirmClear}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-colors"
                >
                  削除する
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="flex items-center justify-between px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-bold shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><Zap className="w-3 h-3" />AUTO-SYNC ON</span>
          <span className="opacity-80">HTML: {html.length} | CSS: {css.length} | JS: {js.length} | PY: {python.length}</span>
        </div>
        <div className="flex items-center gap-3 hidden sm:block"><span className="opacity-80">GEMINI 3.1 PRO POWERED</span></div>
      </footer>
    </div>
  );
}
