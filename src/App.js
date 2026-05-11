import React, { useEffect, useState, useRef } from 'react';
import figlet from 'figlet';
import './App.css';

function App() {
  const [text, setText] = useState('Hello');
  const [font, setFont] = useState('Standard');
  const [fonts, setFonts] = useState([]);
  const loadedFontsRef = useRef(new Set());
  const skipReplaceOnMountRef = useRef(false);
  const [commentStyle, setCommentStyle] = useState('python');
  const [borderStyle, setBorderStyle] = useState('single');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasAny = params.has('text') || params.has('font') || params.has('comment') || params.has('border');
    if (params.has('text')) setText(params.get('text') || '');
    if (params.has('font')) setFont(params.get('font') || 'Standard');
    if (params.has('comment')) setCommentStyle(params.get('comment') || 'python');
    if (params.has('border')) setBorderStyle(params.get('border') || 'single');
    if (hasAny) {
      skipReplaceOnMountRef.current = true;
    }
  }, []);

  const DEFAULT_FONTS = ['Standard', 'Slant', 'Banner', 'Big', 'Block', 'Small', 'Script', 'Doh'];
  useEffect(() => {
    setFonts(DEFAULT_FONTS);
    if (!DEFAULT_FONTS.includes(font)) setFont(DEFAULT_FONTS[0] || 'Standard');
  }, []);

  async function ensureFontLoaded(name) {
    if (!name) return;
    if (loadedFontsRef.current.has(name)) return;
    const fileName = `${name}.flf`;
    const url = `https://cdn.jsdelivr.net/npm/figlet@1.5.2/fonts/${encodeURIComponent(fileName)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
      const txt = await res.text();
      figlet.parseFont(name, txt);
      loadedFontsRef.current.add(name);
    } catch (err) {
      console.warn('Could not load font', name, err);
      // Don't throw — fall back to default font generation below
    }
  }

  useEffect(() => {
    if (skipReplaceOnMountRef.current) {
      // First load contained query params — don't overwrite them.
      skipReplaceOnMountRef.current = false;
      return;
    }

    const params = new URLSearchParams();
    params.set('text', text || '');
    params.set('font', font);
    params.set('comment', commentStyle);
    params.set('border', borderStyle);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [text, font, commentStyle, borderStyle]);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!text) {
        setOutput('');
        return;
      }
      try {
        await ensureFontLoaded(font);
        figlet.text(text, { font }, (err, data) => {
          if (cancelled) return;
          const art = err ? `Error generating ASCII: ${err.message}` : data;
          const bordered = addBorder(art, borderStyle);
          const commented = applyCommentStyle(bordered, commentStyle);
          const normalized = commented.replace(/\|/g, '│');
          setOutput(normalized);
        });
      } catch (err) {
        if (cancelled) return;
        // fallback: try generating without explicit font
        figlet.text(text, (err2, data2) => {
          if (cancelled) return;
          const art = err2 ? `Error generating ASCII: ${err2.message}` : data2;
          const bordered = addBorder(art, borderStyle);
          const commented = applyCommentStyle(bordered, commentStyle);
            const normalized = commented.replace(/\|/g, '│');
            setOutput(normalized);
        });
      }
    };
    render();
    return () => {
      cancelled = true;
    };
  }, [text, font, borderStyle, commentStyle]);

  function addBorder(art, style) {
    if (!style || style === 'none') return art;
    const lines = art.split('\n').filter(() => true);
    const width = Math.max(...lines.map((l) => l.length));
    const pad = 1;
    const map = {
      single: { tl: '┌', tr: '┐', bl: '└', br: '┘', v: '│', h: '─' },
      double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', v: '║', h: '═' },
      rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', v: '│', h: '─' },
    };
    const chars = map[style] || map.single;
    const horiz = chars.h.repeat(width + pad * 2);
    const top = `${chars.tl}${horiz}${chars.tr}`;
    const bottom = `${chars.bl}${horiz}${chars.br}`;
    const middle = lines.map((line) => {
      const padded = line + ' '.repeat(width - line.length);
      return `${chars.v}${' '.repeat(pad)}${padded}${' '.repeat(pad)}${chars.v}`;
    });
    return [top, ...middle, bottom].join('\n');
  }

  function applyCommentStyle(art, style) {
    if (!style || style === 'none') return art;
    const lines = art.split('\n');
    if (style === 'python' || style === 'shell') {
      return lines.map((l) => `# ${l}`).join('\n');
    }
    if (style === 'javascript' || style === 'line') {
      return lines.map((l) => `// ${l}`).join('\n');
    }
    if (style === 'html') {
      return `<!--\n${art}\n-->`;
    }
    // block-style languages: java, c, cpp
    return `/*\n${art}\n*/`;
  }

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>ASCII Generator</h1>
        <form
          className="controls"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <label>
            Font:
            <select value={font} onChange={(e) => setFont(e.target.value)}>
              {fonts.length === 0 ? (
                <>
                  <option>Standard</option>
                  <option>Slant</option>
                  <option>Banner</option>
                </>
              ) : (
                fonts.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))
              )}
            </select>
          </label>

          <label>
            Comment style:
            <select value={commentStyle} onChange={(e) => setCommentStyle(e.target.value)}>
              <option value="python">Python (#)</option>
              <option value="java">Java (/* */)</option>
              <option value="html">HTML (&lt;!-- --&gt;)</option>
              <option value="javascript">JavaScript (//)</option>
              <option value="c">C (/* */)</option>
              <option value="cpp">C++ (/* */)</option>
              <option value="shell">Shell (#)</option>
              <option value="none">None</option>
            </select>
          </label>

          <label>
            Border:
            <select value={borderStyle} onChange={(e) => setBorderStyle(e.target.value)}>
              <option value="none">None</option>
              <option value="single">Single</option>
              <option value="double">Double</option>
              <option value="rounded">Rounded</option>
            </select>
          </label>

          <label className="text-input">
            Text:
            <input value={text} onChange={(e) => setText(e.target.value)} />
          </label>
        </form>
      </header>

      <main className="output-area">
        <div className="output-controls">
          <button onClick={copyOutput}>{copied ? 'Copied' : 'Copy'}</button>
          <a
            className="raw-link"
            href={`data:text/plain;charset=utf-8,${encodeURIComponent(output)}`}
            download="ascii.txt"
          >
            Download
          </a>
        </div>
        <pre className="ascii-output" aria-live="polite">
          {output}
        </pre>
      </main>
    </div>
  );
}

export default App;
