import { ARTICLE_IMAGE_TYPE, type NewsImageVariant } from '@careers/shared';
import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import type { JSX } from 'react';
import { ArticleImageView } from './ImageView';

/**
 * An uploaded picture in the article: a block of its own (never inside a paragraph or table cell), stored as
 * exactly what parseArticleContent accepts: { type: 'article-image', src, altText, width, height, caption,
 * layout, srcset }. Based on the Lexical playground ImageNode (v0.52.0) with a plain-text caption instead of a nested
 * editor, and without resizing or HTML import: pasted <img> tags never become images, so hotlinks and
 * tracking pixels cannot get in.
 */

export type ImageLayout = 'normal' | 'wide';

/**
 * Saved in place of a description HR has not written yet, with `altPending: true`, so the draft keeps saving
 * (the API needs some alt text) while the editor keeps asking ("Cần mô tả ảnh") and publishing stays blocked.
 */
export const PENDING_ALT_TEXT = 'Ảnh minh hoạ';

export interface ArticleImagePayload {
  src: string;
  altText: string;
  width: number;
  height: number;
  /** Plain text under the picture ('' = none). */
  caption?: string;
  /** 'wide' fills the content column; 'normal' keeps the picture's own width, centred. */
  layout?: ImageLayout;
  /** Open the alt popover once shown (fresh upload). Not saved. */
  askAlt?: boolean;
  /** Smaller WebP copies made at upload; pictures uploaded before them have none. */
  srcset?: NewsImageVariant[];
}

export type SerializedArticleImageNode = Spread<
  {
    src: string;
    altText: string;
    width: number;
    height: number;
    caption: string;
    layout: ImageLayout;
    srcset?: NewsImageVariant[];
    /** The description is PENDING_ALT_TEXT, not one HR wrote. */
    altPending?: true;
  },
  SerializedLexicalNode
>;

export interface ImageDetails {
  altText: string;
  caption: string;
  layout: ImageLayout;
}

const toSize = (value: unknown) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1;
};

/** Saved copies as they are; anything malformed is dropped (the API checks addresses on save). */
function toSrcset(value: unknown): NewsImageVariant[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.flatMap((v: unknown) =>
    v && typeof v === 'object' && 'url' in v && typeof v.url === 'string' && 'width' in v
      ? [{ url: v.url, width: toSize(v.width) }]
      : [],
  );
  return items.length > 0 ? items : undefined;
}

export class ArticleImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;
  __width: number;
  __height: number;
  __caption: string;
  __layout: ImageLayout;
  __askAlt: boolean;
  __srcset: NewsImageVariant[] | undefined;

  static getType(): string {
    return ARTICLE_IMAGE_TYPE;
  }

  static clone(node: ArticleImageNode): ArticleImageNode {
    const { __src: src, __altText: altText, __width: width, __height: height } = node;
    const payload = {
      src,
      altText,
      width,
      height,
      caption: node.__caption,
      layout: node.__layout,
      srcset: node.__srcset,
    };
    return new ArticleImageNode({ ...payload, askAlt: node.__askAlt }, node.__key);
  }

  static importJSON(json: Record<string, unknown>): ArticleImageNode {
    return $createArticleImageNode({
      src: typeof json.src === 'string' ? json.src : '',
      altText: json.altPending !== true && typeof json.altText === 'string' ? json.altText : '',
      width: toSize(json.width),
      height: toSize(json.height),
      caption: typeof json.caption === 'string' ? json.caption : '',
      layout: json.layout === 'wide' ? 'wide' : 'normal',
      srcset: toSrcset(json.srcset),
    });
  }

  constructor(payload: ArticleImagePayload, key?: NodeKey) {
    super(key);
    this.__src = payload.src;
    this.__altText = payload.altText;
    this.__width = payload.width;
    this.__height = payload.height;
    this.__caption = payload.caption ?? '';
    this.__layout = payload.layout ?? 'normal';
    this.__askAlt = payload.askAlt ?? false;
    this.__srcset = payload.srcset;
  }

  exportJSON(): SerializedArticleImageNode {
    const self = this.getLatest();
    return {
      type: ARTICLE_IMAGE_TYPE,
      version: 1,
      src: self.__src,
      altText: self.__altText || PENDING_ALT_TEXT,
      ...(self.__altText ? {} : { altPending: true as const }),
      width: self.__width,
      height: self.__height,
      caption: self.__caption,
      layout: self.__layout,
      ...(self.__srcset ? { srcset: self.__srcset } : {}),
    };
  }

  /** Copying out of the editor (to an email, a doc) gives a normal picture. */
  exportDOM(): DOMExportOutput {
    const img = document.createElement('img');
    img.src = this.__src;
    img.alt = this.__altText;
    img.width = this.__width;
    img.height = this.__height;
    return { element: img };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const el = document.createElement('div');
    const className = config.theme.image;
    if (typeof className === 'string') el.className = className;
    return el;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): false {
    return false;
  }

  getAltText(): string {
    return this.getLatest().__altText;
  }

  setDetails({ altText, caption, layout }: ImageDetails): this {
    const self = this.getWritable();
    self.__altText = altText;
    self.__caption = caption;
    self.__layout = layout;
    self.__askAlt = false;
    return self;
  }

  decorate(): JSX.Element {
    return (
      <ArticleImageView
        nodeKey={this.getKey()}
        src={this.__src}
        altText={this.__altText}
        width={this.__width}
        height={this.__height}
        caption={this.__caption}
        layout={this.__layout}
        askAlt={this.__askAlt}
      />
    );
  }
}

export function $createArticleImageNode(payload: ArticleImagePayload): ArticleImageNode {
  return $applyNodeReplacement(new ArticleImageNode(payload));
}

export function $isArticleImageNode(node: LexicalNode | null | undefined): node is ArticleImageNode {
  return node instanceof ArticleImageNode;
}
