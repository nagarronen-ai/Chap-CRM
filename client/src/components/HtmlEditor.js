// client/src/components/HtmlEditor.js
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';

export default function HtmlEditor({ value, onChange, minHeight = '300px' }) {
  return (
    <CodeMirror
      value={value || ''}
      height={minHeight}
      extensions={[html()]}
      theme={oneDark}
      onChange={(val) => onChange && onChange(val)}
      style={{
        fontSize: 12,
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid rgba(62,66,61,0.1)',
        fontFamily: "'SF Mono', 'Fira Code', monospace",
      }}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        autocompletion: true,
        indentOnInput: true,
        bracketMatching: true,
        closeBrackets: true,
      }}
    />
  );
}