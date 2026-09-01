import React, { useRef } from 'react';
import { Upload, AlignLeft, Trash2, Copy, Check, FileText, ChevronDown } from 'lucide-react';
import { REFERENCE_TEMPLATES, SAMPLE_MALFORMED_XML } from '../data/templates';

interface XmlEditorProps {
  value: string;
  onChange: (val: string) => void;
  onValidate: () => void;
  onFormat: () => void;
  onClear: () => void;
  fileName: string | null;
  onFileLoaded: (name: string, content: string) => void;
}

export const XmlEditor: React.FC<XmlEditorProps> = ({
  value,
  onChange,
  onValidate,
  onFormat,
  onClear,
  fileName,
  onFileLoaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);
  const [showSamplesMenu, setShowSamplesMenu] = React.useState(false);

  const lines = value ? value.split('\n') : [''];
  const lineCount = lines.length;
  const charCount = value.length;

  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to run validation
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onValidate();
      return;
    }

    // Tab key support
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      onFileLoaded(file.name, content);
    };
    reader.readAsText(file);

    // Reset input so same file can be loaded again if needed
    e.target.value = '';
  };

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadTemplate = (content: string, name: string) => {
    onFileLoaded(name, content);
    setShowSamplesMenu(false);
  };

  return (
    <section
      id="xml_editor_section"
      className="flex-1 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 min-w-0 overflow-hidden"
    >
      {/* Subheader Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 select-none">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-indigo-500" />
            XML Source Editor
          </span>
          {fileName && (
            <span className="text-xs px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono rounded border border-indigo-200 dark:border-indigo-800 max-w-[180px] truncate">
              {fileName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Load XML Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept=".xml,.cxml,.txt,text/xml,application/xml"
            className="hidden"
          />
          <button
            id="btn_load_xml"
            onClick={() => fileInputRef.current?.click()}
            title="Cargar archivo XML local (FileReader)"
            className="flex items-center gap-1 px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 rounded border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-xs font-medium transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Load XML</span>
          </button>

          {/* Format XML Button */}
          <button
            id="btn_format_xml"
            onClick={onFormat}
            title="Formatear e indentar XML de manera segura"
            className="flex items-center gap-1 px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 rounded border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-xs font-medium transition-all"
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Format</span>
          </button>

          {/* Samples Dropdown */}
          <div className="relative">
            <button
              id="btn_samples_dropdown"
              onClick={() => setShowSamplesMenu(!showSamplesMenu)}
              className="flex items-center gap-1 px-2 py-1 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 rounded border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-xs font-medium transition-all"
            >
              <span>Plantillas</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showSamplesMenu && (
              <div
                className="absolute right-0 mt-1 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg py-1 z-30 text-xs"
                onMouseLeave={() => setShowSamplesMenu(false)}
              >
                <div className="px-3 py-1.5 font-semibold text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-700">
                  Casos de Ejemplo
                </div>
                {REFERENCE_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => loadTemplate(tmpl.content, tmpl.name)}
                    className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 block transition-colors"
                  >
                    <div className="font-medium">{tmpl.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{tmpl.description}</div>
                  </button>
                ))}
                <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                <button
                  onClick={() => loadTemplate(SAMPLE_MALFORMED_XML, 'Ejemplo XML Malformado (Prueba de Error)')}
                  className="w-full text-left px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 block transition-colors"
                >
                  <div className="font-medium">⚠️ Ejemplo con Error Sintáctico</div>
                  <div className="text-[10px] text-rose-500">Prueba de diagnóstico de etiquetas no coincidentes</div>
                </button>
              </div>
            )}
          </div>

          {/* Copy Button */}
          <button
            id="btn_copy_xml"
            onClick={handleCopy}
            title="Copiar XML al portapapeles"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 rounded transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Clear Button */}
          <button
            id="btn_clear_xml"
            onClick={onClear}
            title="Limpiar editor"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Editor Body with Monospace & Line Numbers */}
      <div className="flex-1 relative flex overflow-hidden bg-[#fafafa] dark:bg-slate-950 font-mono text-[13px] leading-relaxed">
        {/* Line Numbers Column */}
        <div
          ref={lineNumbersRef}
          aria-hidden="true"
          className="w-12 h-full bg-slate-100/90 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 select-none overflow-hidden text-right pr-2.5 pt-3 text-slate-400 dark:text-slate-600 text-[11px] font-mono"
        >
          {Array.from({ length: Math.max(lineCount, 25) }, (_, i) => (
            <div key={i + 1} className="h-6 leading-6">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea Input */}
        <textarea
          id="xml_source_textarea"
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          placeholder="Pega aquí la factura XML o haz clic en 'Load XML' para abrir un archivo..."
          spellCheck={false}
          className="flex-1 h-full p-3 pl-3 bg-transparent text-slate-800 dark:text-slate-100 font-mono text-[13px] leading-6 resize-none focus:outline-hidden whitespace-pre overflow-auto tab-4 selection:bg-indigo-100 dark:selection:bg-indigo-900/60"
        />
      </div>

      {/* Editor Footer Status Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-100 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 font-mono select-none">
        <div className="flex items-center gap-3">
          <span>Líneas: {lineCount}</span>
          <span>•</span>
          <span>Caracteres: {charCount.toLocaleString()}</span>
        </div>
        <div className="text-[10px] text-slate-400">
          Atajo: <kbd className="px-1 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">Ctrl+Enter</kbd> para validar
        </div>
      </div>
    </section>
  );
};
