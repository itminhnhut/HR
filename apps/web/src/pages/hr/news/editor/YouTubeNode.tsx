import { YOUTUBE_ID } from '@careers/shared';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import {
  $applyNodeReplacement,
  $getNodeByKey,
  DecoratorNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import type { JSX } from 'react';
import { BarButton, BlockBar } from './BlockBar';

/**
 * A YouTube video, based on the playground YouTubeNode (v0.52.0). Stored as { type: 'youtube', videoID,
 * format: '' }; shown from youtube-nocookie.com, like the public page.
 */

export type SerializedYouTubeNode = Spread<{ videoID: string; format: '' }, SerializedLexicalNode>;

function YouTubeView({ nodeKey, videoID }: { nodeKey: NodeKey; videoID: string }) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  return (
    <figure className={`embed m-0 ${isSelected ? 'is-selected' : ''}`}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoID}`}
        title="Video YouTube"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
      <BlockBar label={`Video YouTube · ${videoID}`}>
        <BarButton
          onClick={() => {
            clearSelection();
            setSelected(true);
          }}
        >
          Chọn
        </BarButton>
        <BarButton tone="danger" onClick={() => editor.update(() => $getNodeByKey(nodeKey)?.remove())}>
          Xoá video
        </BarButton>
      </BlockBar>
    </figure>
  );
}

export class YouTubeNode extends DecoratorNode<JSX.Element> {
  __id: string;

  static getType(): string {
    return 'youtube';
  }

  static clone(node: YouTubeNode): YouTubeNode {
    return new YouTubeNode(node.__id, node.__key);
  }

  static importJSON(json: Record<string, unknown>): YouTubeNode {
    const id = typeof json.videoID === 'string' && YOUTUBE_ID.test(json.videoID) ? json.videoID : '';
    return $createYouTubeNode(id);
  }

  constructor(id: string, key?: NodeKey) {
    super(key);
    this.__id = id;
  }

  exportJSON(): SerializedYouTubeNode {
    return { type: 'youtube', version: 1, videoID: this.getLatest().__id, format: '' };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const el = document.createElement('div');
    const className = config.theme.embedBlock?.base;
    if (typeof className === 'string') el.className = className;
    return el;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): false {
    return false;
  }

  getTextContent(): string {
    return `https://www.youtube.com/watch?v=${this.__id}`;
  }

  decorate(): JSX.Element {
    return <YouTubeView nodeKey={this.getKey()} videoID={this.__id} />;
  }
}

export function $createYouTubeNode(videoID: string): YouTubeNode {
  return $applyNodeReplacement(new YouTubeNode(videoID));
}

export function $isYouTubeNode(node: LexicalNode | null | undefined): node is YouTubeNode {
  return node instanceof YouTubeNode;
}
