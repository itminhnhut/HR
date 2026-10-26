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
import { OPEN_DIALOG_COMMAND } from './commands';

/**
 * A call-to-action button ("Ứng tuyển ngay" → a job page, or any safe link), stored as
 * { type: 'cta', text, url }. The site renders it with its primary button look.
 */

export interface CtaPayload {
  text: string;
  url: string;
}

export type SerializedCtaNode = Spread<CtaPayload, SerializedLexicalNode>;

function CtaView({ nodeKey, text, url }: { nodeKey: NodeKey } & CtaPayload) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  return (
    <div className={`cta m-0 ${isSelected ? 'is-selected' : ''}`}>
      <span
        role="presentation"
        className="cta-button cursor-pointer"
        onClick={() => {
          clearSelection();
          setSelected(true);
        }}
      >
        {text}
      </span>
      <BlockBar label={`Nút dẫn tới ${url}`}>
        <BarButton onClick={() => editor.dispatchCommand(OPEN_DIALOG_COMMAND, { kind: 'cta', key: nodeKey })}>
          Sửa nút
        </BarButton>
        <BarButton tone="danger" onClick={() => editor.update(() => $getNodeByKey(nodeKey)?.remove())}>
          Xoá nút
        </BarButton>
      </BlockBar>
    </div>
  );
}

export class CtaNode extends DecoratorNode<JSX.Element> {
  __text: string;
  __url: string;

  static getType(): string {
    return 'cta';
  }

  static clone(node: CtaNode): CtaNode {
    return new CtaNode({ text: node.__text, url: node.__url }, node.__key);
  }

  static importJSON(json: Record<string, unknown>): CtaNode {
    return $createCtaNode({
      text: typeof json.text === 'string' ? json.text : '',
      url: typeof json.url === 'string' ? json.url : '',
    });
  }

  constructor({ text, url }: CtaPayload, key?: NodeKey) {
    super(key);
    this.__text = text;
    this.__url = url;
  }

  exportJSON(): SerializedCtaNode {
    const self = this.getLatest();
    return { type: 'cta', version: 1, text: self.__text, url: self.__url };
  }

  getPayload(): CtaPayload {
    const self = this.getLatest();
    return { text: self.__text, url: self.__url };
  }

  setPayload({ text, url }: CtaPayload): this {
    const self = this.getWritable();
    self.__text = text;
    self.__url = url;
    return self;
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
    return this.__text;
  }

  decorate(): JSX.Element {
    return <CtaView nodeKey={this.getKey()} text={this.__text} url={this.__url} />;
  }
}

export function $createCtaNode(payload: CtaPayload): CtaNode {
  return $applyNodeReplacement(new CtaNode(payload));
}

export function $isCtaNode(node: LexicalNode | null | undefined): node is CtaNode {
  return node instanceof CtaNode;
}
