import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';

const MenuBar = ({ editor, p }) => {
  const addLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank' }).run();
  }, [editor]);

  if (!editor) return null;

  const btnStyle = (isActive) => ({
    background: isActive ? p.text : p.cardBg,
    color: isActive ? '#fff' : p.textSecondary,
    border: `1px solid ${p.inputBorder}`,
    borderRadius: 4, padding: '4px 10px', fontSize: 13,
    cursor: 'pointer', fontFamily: "'Inter', sans-serif",
    fontWeight: isActive ? 600 : 400, transition: 'all 0.1s',
  });

  const divider = <div style={{ width: 1, height: 20, background: p.inputBorder, margin: '0 4px' }} />;

  return (
    <div style={{ background: p.inputBg, padding: '8px 12px', borderBottom: `1px solid ${p.inputBorder}`, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} style={btnStyle(editor.isActive('bold'))}><b>B</b></button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} style={btnStyle(editor.isActive('italic'))}><i>I</i></button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} style={btnStyle(editor.isActive('underline'))}><u>U</u></button>
      {divider}
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} style={btnStyle(editor.isActive('bulletList'))}>• List</button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} style={btnStyle(editor.isActive('orderedList'))}>1. List</button>
      {divider}
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} style={btnStyle(editor.isActive({ textAlign: 'left' }))}>←</button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} style={btnStyle(editor.isActive({ textAlign: 'center' }))}>↔</button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} style={btnStyle(editor.isActive({ textAlign: 'right' }))}>→</button>
      {divider}
      <button type="button" onClick={addLink} style={btnStyle(editor.isActive('link'))}>🔗 Link</button>
      {editor.isActive('link') && (
        <button type="button" onClick={() => editor.chain().focus().unsetLink().run()}
          style={{ ...btnStyle(false), color: '#D4183D', fontSize: 11 }}>✕ Unlink</button>
      )}
      {divider}
      <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} style={{ ...btnStyle(false), opacity: editor.can().undo() ? 1 : 0.4 }}>↩</button>
      <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} style={{ ...btnStyle(false), opacity: editor.can().redo() ? 1 : 0.4 }}>↪</button>
    </div>
  );
};

export default function TiptapEditor({ content, onChange, onFocus, placeholder, minHeight = 280 }) {
  const { palette: p } = useApp();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } }),
      TextAlign.configure({ types: ['paragraph'] }),
      TextStyle,
      Color,
    ],
    content: content || '',
    onUpdate: ({ editor }) => { if (onChange) onChange(editor.getHTML()); },
    onFocus: () => { if (onFocus) onFocus(); },
  });

  useEffect(() => {
    if (editor && content !== undefined) {
      const currentContent = editor.getHTML();
      if (content !== currentContent && content !== '<p></p>') editor.commands.setContent(content || '');
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor) { editor.insertTagAtCursor = (tag) => { editor.chain().focus().insertContent(tag).run(); }; }
  }, [editor]);

  return (
    <div style={{ border: `1px solid ${p.inputBorder}`, borderRadius: 8, overflow: 'hidden', background: p.cardBg, isolation: 'isolate' }}>
      <MenuBar editor={editor} p={p} />
      <div onClick={() => editor?.chain().focus().run()} style={{ cursor: 'text', minHeight }}>
        <EditorContent editor={editor} />
      </div>
      <style>{`
        .tiptap { outline: none; min-height: ${minHeight}px; padding: 16px; font-size: 14px; line-height: 1.7; color: ${p.text}; font-family: 'Inter', 'Arial Hebrew', sans-serif; background: ${p.cardBg}; unicode-bidi: plaintext; }
        .tiptap p { margin: 0 0 8px 0; }
        .tiptap ul, .tiptap ol { padding-left: 24px; margin: 8px 0; }
        .tiptap li { margin: 2px 0; }
        .tiptap a { color: ${p.primary}; text-decoration: underline; cursor: pointer; }
        .tiptap p.is-editor-empty:first-child::before {
          content: '${placeholder || "Start typing..."}';
          float: left;
          color: ${p.textMuted};
          pointer-events: none;
          height: 0;
          font-style: italic;
        }
        .ProseMirror { outline: none; min-height: ${minHeight}px; border-radius: 0 0 8px 8px; }
      `}</style>
    </div>
  );
}