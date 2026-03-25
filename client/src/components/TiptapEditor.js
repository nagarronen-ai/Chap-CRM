import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { useEffect, useCallback } from 'react';

const MenuBar = ({ editor }) => {
  const addLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank' }).run();
  }, [editor]);

  if (!editor) return null;

  const btnStyle = (isActive) => ({
    background: isActive ? '#3E423D' : '#fff',
    color: isActive ? '#fff' : '#5A6059',
    border: '1px solid rgba(62,66,61,0.1)',
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    fontWeight: isActive ? 600 : 400,
    transition: 'all 0.1s',
  });

  return (
    <div style={{
      background: '#F5F3EF', padding: '8px 12px',
      borderBottom: '1px solid rgba(62,66,61,0.1)',
      display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
    }}>
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} style={btnStyle(editor.isActive('bold'))}>
        <b>B</b>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} style={btnStyle(editor.isActive('italic'))}>
        <i>I</i>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} style={btnStyle(editor.isActive('underline'))}>
        <u>U</u>
      </button>

      <div style={{ width: 1, height: 20, background: 'rgba(62,66,61,0.15)', margin: '0 4px' }} />

      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} style={btnStyle(editor.isActive('bulletList'))}>
        • List
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} style={btnStyle(editor.isActive('orderedList'))}>
        1. List
      </button>

      <div style={{ width: 1, height: 20, background: 'rgba(62,66,61,0.15)', margin: '0 4px' }} />

      <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} style={btnStyle(editor.isActive({ textAlign: 'left' }))}>
        ←
      </button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} style={btnStyle(editor.isActive({ textAlign: 'center' }))}>
        ↔
      </button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} style={btnStyle(editor.isActive({ textAlign: 'right' }))}>
        →
      </button>

      <div style={{ width: 1, height: 20, background: 'rgba(62,66,61,0.15)', margin: '0 4px' }} />

      <button type="button" onClick={addLink} style={btnStyle(editor.isActive('link'))}>
        🔗 Link
      </button>
      {editor.isActive('link') && (
        <button type="button" onClick={() => editor.chain().focus().unsetLink().run()}
          style={{ ...btnStyle(false), color: '#D4183D', fontSize: 11 }}>
          ✕ Unlink
        </button>
      )}

      <div style={{ width: 1, height: 20, background: 'rgba(62,66,61,0.15)', margin: '0 4px' }} />

      <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}
        style={{ ...btnStyle(false), opacity: editor.can().undo() ? 1 : 0.4 }}>
        ↩
      </button>
      <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}
        style={{ ...btnStyle(false), opacity: editor.can().redo() ? 1 : 0.4 }}>
        ↪
      </button>
    </div>
  );
};

export default function TiptapEditor({ content, onChange, onFocus, placeholder, minHeight = 280 }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      TextAlign.configure({
        types: ['paragraph'],
      }),
      TextStyle,
      Color,
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      if (onChange) onChange(editor.getHTML());
    },
    onFocus: () => {
      if (onFocus) onFocus();
    },
  });

  useEffect(() => {
    if (editor && content !== undefined) {
      const currentContent = editor.getHTML();
      if (content !== currentContent && content !== '<p></p>') {
        editor.commands.setContent(content || '');
      }
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor) {
      editor.insertTagAtCursor = (tag) => {
        editor.chain().focus().insertContent(tag).run();
      };
    }
  }, [editor]);
  return (
<div style={{
      border: '1px solid rgba(62,66,61,0.1)',
      borderRadius: 8,
      overflow: 'hidden',
      background: '#fff',
      isolation: 'isolate',
    }}>
      <MenuBar editor={editor} />
      <div
        onClick={() => editor?.chain().focus().run()}
        style={{ cursor: 'text', minHeight }}
      >
        <EditorContent editor={editor} />
      </div>
      <style>{`
        .tiptap { outline: none; min-height: ${minHeight}px; padding: 16px; font-size: 14px; line-height: 1.7; color: #3E423D; font-family: 'Inter', sans-serif; }
        .tiptap p { margin: 0 0 8px 0; }
        .tiptap ul, .tiptap ol { padding-left: 24px; margin: 8px 0; }
        .tiptap li { margin: 2px 0; }
        .tiptap a { color: #94B0BC; text-decoration: underline; cursor: pointer; }
        .tiptap p.is-editor-empty:first-child::before {
          content: '${placeholder || "Start typing..."}';
          float: left;
          color: #CBCED4;
          pointer-events: none;
          height: 0;
          font-style: italic;
        }
        .ProseMirror { outline: none; min-height: ${minHeight}px; border-radius: 0 0 8px 8px; }
      `}</style>
    </div>
  );
}