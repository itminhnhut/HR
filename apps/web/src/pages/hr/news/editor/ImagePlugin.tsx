import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { DRAG_DROP_PASTE } from '@lexical/rich-text';
import { $insertNodeToNearestRoot } from '@lexical/utils';
import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_LOW,
  mergeRegister,
  type LexicalEditor,
} from 'lexical';
import { useEffect, useRef } from 'react';
import type { UploadedImage } from '../../../../api';
import { errorMessage } from '../../parts';
import { SET_IMAGE_DETAILS_COMMAND, UPLOAD_IMAGES_COMMAND, type EditorStatus } from './commands';
import { $createArticleImageNode, $isArticleImageNode, type ArticleImagePayload } from './ImageNode';
import { shrinkImage } from '../shrinkImage';
import { uploadPicture } from '../uploadPicture';
import { imageFileProblem } from './rules';

export type UploadImage = (file: File) => Promise<UploadedImage>;

function $insertImage(payload: ArticleImagePayload) {
  if (!$getSelection()) $getRoot().selectEnd();
  $insertNodeToNearestRoot($createArticleImageNode(payload));
}

/** One file at a time, so pictures land in the order they were picked. */
async function uploadAll(
  editor: LexicalEditor,
  files: File[],
  upload: UploadImage,
  onStatus: (s: EditorStatus | null) => void,
) {
  let lastError: string | null = null;
  for (const file of files) {
    onStatus({ tone: 'busy', text: `Đang tải ảnh ${file.name}…` });
    const ready = await shrinkImage(file);
    const problem = imageFileProblem(ready, file.name);
    if (problem) {
      lastError = problem;
      continue;
    }
    try {
      const image = await uploadPicture(ready, upload);
      const { url: src, width, height, srcset } = image;
      editor.update(() => $insertImage({ src, width, height, srcset, altText: '', askAlt: true }));
    } catch (error) {
      lastError = errorMessage(error, `Chưa tải được ảnh ${file.name}, thử lại.`);
    }
  }
  onStatus(lastError ? { tone: 'error', text: lastError } : null);
}

/**
 * Pictures come in three ways: the toolbar button, dropping files, pasting a copied picture (a screenshot).
 * Text pasted from Word stays text: Lexical only treats a paste as files when it carries no text.
 */
export function ImagePlugin({ upload, onStatus }: { upload: UploadImage; onStatus: (s: EditorStatus | null) => void }) {
  const [editor] = useLexicalComposerContext();
  // The latest callbacks, without re-registering the commands on every render.
  const latest = useRef({ upload, onStatus });
  latest.current = { upload, onStatus };

  useEffect(() => {
    const run = (files: File[]) => {
      void uploadAll(editor, files, latest.current.upload, latest.current.onStatus);
      return true;
    };
    return mergeRegister(
      editor.registerCommand(UPLOAD_IMAGES_COMMAND, run, COMMAND_PRIORITY_EDITOR),
      editor.registerCommand(DRAG_DROP_PASTE, run, COMMAND_PRIORITY_LOW),
      editor.registerCommand(
        SET_IMAGE_DETAILS_COMMAND,
        ({ key, ...details }) => {
          const node = $getNodeByKey(key);
          if ($isArticleImageNode(node)) node.setDetails(details);
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, [editor]);

  return null;
}
