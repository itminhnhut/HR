import type { ArticleState } from '@careers/shared';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { COMMAND_PRIORITY_EDITOR } from 'lexical';
import { memo, useEffect, useRef, useState } from 'react';
import { SHOW_STATUS_COMMAND, type EditorStatus } from './commands';
import { DragHandlePlugin } from './DragHandlePlugin';
import { EditorDialogs } from './EditorDialogs';
import { articleEditorExtension, MARKDOWN_SHORTCUTS } from './extension';
import { FloatingToolbar } from './FloatingToolbar';
import { ImagePlugin, type UploadImage } from './ImagePlugin';
import { LinePlaceholderPlugin } from './LinePlaceholderPlugin';
import { SlashMenuPlugin } from './slash/SlashMenuPlugin';
import { Toolbar } from './Toolbar';
import { useDesktopPointer } from './useDesktop';

export interface ArticleEditorProps {
  /** The saved content, read once when the editor mounts (mount with `key` = post id). */
  initialContent: ArticleState | null;
  /** Every change to the text: `editorState.toJSON()`, ready to save as `content`. */
  onChange: (content: unknown) => void;
  uploadImage: UploadImage;
  /** id of the error message under the editor, when there is one. */
  errorId?: string;
}

/** Reports content changes, not cursor moves or the initial load. */
function ChangeListener({ onChange }: { onChange: (content: unknown) => void }) {
  const [editor] = useLexicalComposerContext();
  const latest = useRef(onChange);
  latest.current = onChange;
  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves, prevEditorState }) => {
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
        if (prevEditorState.isEmpty()) return;
        latest.current(editorState.toJSON());
      }),
    [editor],
  );
  return null;
}

/** Messages sent with SHOW_STATUS_COMMAND; an "info" one goes away by itself after a few seconds. */
function StatusListener({
  status,
  onStatus,
}: {
  status: EditorStatus | null;
  onStatus: (s: EditorStatus | null) => void;
}) {
  const [editor] = useLexicalComposerContext();
  useEffect(
    () =>
      editor.registerCommand(
        SHOW_STATUS_COMMAND,
        (next) => {
          onStatus(next);
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    [editor, onStatus],
  );
  useEffect(() => {
    if (status?.tone !== 'info') return;
    const timer = window.setTimeout(() => onStatus(null), 6000);
    return () => window.clearTimeout(timer);
  }, [status, onStatus]);
  return null;
}

/**
 * The Lexical editor for news articles. The only module (with its folder) that imports lexical, loaded
 * lazily on the editor page. Uncontrolled: it starts from `initialContent` and only reports changes up.
 */
function ArticleEditor({ initialContent, onChange, uploadImage, errorId }: ArticleEditorProps) {
  const [extension] = useState(() =>
    articleEditorExtension(initialContent ? JSON.stringify(initialContent) : undefined),
  );
  const [status, setStatus] = useState<EditorStatus | null>(null);
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const desktop = useDesktopPointer();

  return (
    <LexicalExtensionComposer extension={extension} contentEditable={null}>
      <div className="field-focus rounded-control border border-field bg-white">
        <Toolbar status={status} />
        <div ref={setAnchor} className="relative">
          <ContentEditable
            ariaLabel="Nội dung bài viết"
            ariaMultiline
            ariaDescribedBy={errorId}
            ariaInvalid={errorId ? true : undefined}
            className="article-prose article-editor min-h-[420px] px-4 py-5 outline-none sm:px-7 sm:py-6 lg:pl-10"
            aria-placeholder="Viết nội dung bài…"
            placeholder={
              <div className="pointer-events-none absolute left-4 top-5 text-[17px] text-muted sm:left-7 sm:top-6 lg:left-10">
                Viết nội dung bài… Gõ “/” để chèn khối (mục lục, ảnh, bảng…), “## ” để tạo tiêu đề lớn.
              </div>
            }
          />
        </div>
      </div>
      <EditorDialogs />
      <ChangeListener onChange={onChange} />
      <ImagePlugin upload={uploadImage} onStatus={setStatus} />
      <StatusListener status={status} onStatus={setStatus} />
      <MarkdownShortcutPlugin transformers={MARKDOWN_SHORTCUTS} />
      <SlashMenuPlugin />
      <LinePlaceholderPlugin />
      {desktop && anchor && <DragHandlePlugin anchor={anchor} />}
      {desktop && <FloatingToolbar />}
    </LexicalExtensionComposer>
  );
}

export default memo(ArticleEditor);
