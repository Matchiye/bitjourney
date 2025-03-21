import React, { useCallback, useEffect, useRef, useState } from "react";
import { Globe, Settings, Terminal } from "lucide-react";

const PRISM_CORE_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js";
const PRISM_PYTHON_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js";

const loadScript = (url) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const PythonCodeEditor = ({
  initialCode = "",
  onCodeChange = () => {},
  className = "",
}) => {
  const [code, setCode] = useState(initialCode);
  const [lineCount, setLineCount] = useState(1);
  const [prismLoaded, setPrismLoaded] = useState(false);
  const textareaRef = useRef(null);
  const preRef = useRef(null);
  const highlightRef = useRef(null);
  const highlightTimeoutRef = useRef(null);
  const mountedRef = useRef(false);

  // Keep track of the initial code to prevent unnecessary re-renders
  const initialCodeRef = useRef(initialCode);

  // Prism loading logic
  useEffect(() => {
    const loadPrism = async () => {
      try {
        if (!window.Prism) {
          await loadScript(PRISM_CORE_URL);
          await loadScript(PRISM_PYTHON_URL);
        }
        setPrismLoaded(true);
      } catch (error) {
        console.error("Failed to load Prism:", error);
        setTimeout(loadPrism, 1000);
      }
    };

    loadPrism();
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  // Only update code state if initialCode changes and is different from our tracked initialCode
  useEffect(() => {
    if (initialCode !== initialCodeRef.current) {
      setCode(initialCode);
      initialCodeRef.current = initialCode;
    }
  }, [initialCode]);

  // Highlighting logic
  const highlightCode = useCallback((codeToHighlight) => {
    if (
      !mountedRef.current || !prismLoaded || !window.Prism ||
      !highlightRef.current
    ) return;

    try {
      window.Prism.hooks.run("before-highlight", {
        grammar: window.Prism.languages.python,
        language: "python",
        code: codeToHighlight,
      });

      const result = window.Prism.highlight(
        codeToHighlight,
        window.Prism.languages.python,
        "python",
      );

      if (result && highlightRef.current) {
        highlightRef.current.innerHTML = result;
      }
    } catch (error) {
      console.error("Highlighting failed:", error);
      if (highlightRef.current) {
        highlightRef.current.textContent = codeToHighlight;
      }
    }
  }, [prismLoaded]);

  const debouncedHighlight = useCallback((codeToHighlight) => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = setTimeout(() => {
      highlightCode(codeToHighlight);
    }, 30);
  }, [highlightCode]);

  useEffect(() => {
    const lines = code.split("\n").length;
    setLineCount(lines);
    debouncedHighlight(code);
  }, [code, debouncedHighlight]);

  useEffect(() => {
    if (prismLoaded) {
      highlightCode(code);
    }
  }, [prismLoaded, code, highlightCode]);

  const handleChange = (e) => {
    const newCode = e.target.value.replace(/\u00A0/g, " ");
    setCode(newCode);
    onCodeChange(newCode);

    if (preRef.current) {
      preRef.current.scrollTop = e.target.scrollTop;
      preRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollLeft } = e.target;
    const elements = [preRef.current, textareaRef.current];

    elements.forEach((el) => {
      if (el && (el.scrollTop !== scrollTop || el.scrollLeft !== scrollLeft)) {
        el.scrollTop = scrollTop;
        el.scrollLeft = scrollLeft;
      }
    });
  };

  const getIndentLevel = (line) => {
    const match = line.match(/^( *)/);
    return match ? match[0].length : 0;
  };

  const shouldIncreaseIndent = (line) => {
    // Check if the line ends with a colon (indicating a new block)
    return line.trim().endsWith(":");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;

      const newCode = code.substring(0, start) + "    " + code.substring(end);
      setCode(newCode);
      onCodeChange(newCode);

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart =
            textareaRef.current
              .selectionEnd =
              start + 4;
        }
      });
    } else if (e.key === "Enter") {
      e.preventDefault();

      const start = e.target.selectionStart;
      const currentLine = code.substring(0, start).split("\n").pop();
      let indentLevel = getIndentLevel(currentLine);

      // Increase indent if the line ends with a colon
      if (shouldIncreaseIndent(currentLine)) {
        indentLevel += 4;
      }

      // Create the new line with proper indentation
      const indentation = " ".repeat(indentLevel);
      const newCode = code.substring(0, start) + "\n" + indentation +
        code.substring(start);
      setCode(newCode);
      onCodeChange(newCode);

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const newCursorPosition = start + 1 + indentLevel;
          textareaRef.current.selectionStart =
            textareaRef.current
              .selectionEnd =
              newCursorPosition;
        }
      });
    }
  };

  return (
    <div
      className={`w-full rounded-lg border border-blue-500 bg-slate-900 shadow-lg shadow-blue-500/20 ${className}`}
    >
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-blue-500/30 bg-slate-800">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-blue-400 font-medium">
            Mission Control Terminal
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500/100 transition-opacity cursor-pointer">
            </div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500/100 transition-opacity cursor-pointer">
            </div>
            <div className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-500/100 transition-opacity cursor-pointer">
            </div>
          </div>
        </div>
      </div>

      {/* Editor Body */}
      <div className="relative flex bg-slate-900 overflow-hidden">
        {/* Line Numbers */}
        <div className="w-12 flex-none py-4 pr-3 text-right font-mono text-slate-500 text-sm border-r border-blue-500/30 select-none bg-slate-800/50">
          {Array.from(
            { length: lineCount },
            (_, i) => (
              <div key={i + 1} className="leading-6">
                {i + 1}
              </div>
            ),
          )}
        </div>

        {/* Code Area */}
        <div className="relative flex-grow">
          <div className="overflow-auto w-full" style={{ maxHeight: "100%" }}>
            <pre ref={preRef} className="relative m-0">
              <code
                ref={highlightRef}
                className="space-editor-highlight inline-block min-w-full py-4 px-4 text-sm leading-6 whitespace-pre font-mono"
              >
                {code}
              </code>
            </pre>

            <textarea
              ref={textareaRef}
              value={code}
              onChange={handleChange}
              onScroll={handleScroll}
              onKeyDown={handleKeyDown}
              spellCheck="false"
              className="absolute top-0 left-0 w-full h-full min-h-[300px] py-4 px-4 bg-transparent text-transparent caret-blue-400 border-0 resize-none leading-6 focus:outline-none text-sm font-mono"
            />
          </div>
        </div>
      </div>

      {/* Editor Footer */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-t border-blue-500/30 text-xs text-slate-400">
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            <Settings className="w-3 h-3 mr-1" />
            {lineCount} lines
          </span>
          <span className="flex items-center">
            <Terminal className="w-3 h-3 mr-1" />
            {code.length} chars
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            <Globe className="w-3 h-3 mr-1" />
            Python
          </span>
          <span>UTF-8</span>
        </div>
      </div>

      <style>
        {`
        .space-editor-highlight {
          color: #c9d1d9;
        }
        .space-editor-highlight .token.comment { color: #8b949e; font-style: italic; }
        .space-editor-highlight .token.keyword { color: #ff79c6; }
        .space-editor-highlight .token.string { color: #9ee077; }
        .space-editor-highlight .token.function { color: #79c0ff; }
        .space-editor-highlight .token.number { color: #f8c555; }
        .space-editor-highlight .token.operator { color: #c9d1d9; }
        .space-editor-highlight .token.class-name { color: #ffa657; }
        .space-editor-highlight .token.builtin { color: #ffa657; }
        .space-editor-highlight .token.boolean { color: #ff79c6; }
        .space-editor-highlight .token.constant { color: #f8c555; }
        .space-editor-highlight .token.decorator { color: #79c0ff; }
        .space-editor-highlight .token.punctuation { color: #c9d1d9; }
        .space-editor-highlight .token.property { color: #79c0ff; }
        .space-editor-highlight .token.parameter { color: #c9d1d9; }
        .space-editor-highlight .token.self { color: #ff79c6; }
        .space-editor-highlight .token.def { color: #79c0ff; }

        .space-editor-highlight .token {
          background: none !important;
        }

        /* Custom scrollbar for the space theme */
        .overflow-auto::-webkit-scrollbar {
          width: 12px;
          height: 12px;
        }
        .overflow-auto::-webkit-scrollbar-track {
          background: #1e293b;
          border-radius: 6px;
        }
        .overflow-auto::-webkit-scrollbar-thumb {
          background: #3b82f6;
          border-radius: 6px;
          border: 3px solid #1e293b;
        }
        .overflow-auto::-webkit-scrollbar-thumb:hover {
          background: #60a5fa;
        }
        `}
      </style>
    </div>
  );
};

export default PythonCodeEditor;
