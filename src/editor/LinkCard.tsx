import { useEffect, useState } from 'react';
import { Plugin, TextSelection } from '@tiptap/pm/state';
import { Node, NodeViewWrapper, ReactNodeViewRenderer, mergeAttributes, type NodeViewProps } from '@tiptap/react';
import type { LinkPreview } from '@/types';
import { Button } from '@/components/ui';
import { cx } from '@/lib/cx';
import styles from './LinkCard.module.css';

type CardStatus = 'loading' | 'ready' | 'failed';

const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const dataAttr = (name: string) => ({
  default: null,
  parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name}`),
  renderHTML: (attrs: Record<string, unknown>) => (attrs[name] ? { [`data-${name}`]: attrs[name] } : {}),
});

async function fetchPreview(url: string, signal: AbortSignal): Promise<LinkPreview> {
  const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { signal });
  const body = (await res.json().catch(() => ({}))) as LinkPreview & { error?: string };
  if (!res.ok) throw new Error(body.error ?? '미리보기를 가져오지 못했어요.');
  return body;
}

function LinkCardView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const { url, title, description, image, siteName } = node.attrs as Partial<LinkPreview>;
  const status = node.attrs.status as CardStatus;
  const [error, setError] = useState<string>();
  const [imageBroken, setImageBroken] = useState(false);
  const safeUrl = isHttpUrl(url) ? url : undefined;

  useEffect(() => {
    if (status !== 'loading' || !safeUrl) return;
    const controller = new AbortController();
    fetchPreview(safeUrl, controller.signal)
      .then((preview) =>
        updateAttributes({
          title: preview.title,
          description: preview.description ?? null,
          image: preview.image ?? null,
          siteName: preview.siteName ?? null,
          status: 'ready',
        }),
      )
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : undefined);
        updateAttributes({ status: 'failed' });
      });
    return () => controller.abort();
  }, [status, safeUrl, updateAttributes]);

  const showImage = status === 'ready' && isHttpUrl(image) && !imageBroken;

  return (
    <NodeViewWrapper className={cx(styles.card, selected && styles.selected)} data-drag-handle>
      <a className={styles.link} href={safeUrl} target="_blank" rel="noopener noreferrer nofollow">
        <span className={styles.body}>
          {status === 'loading' ? (
            <>
              <span className={cx(styles.skeleton, styles.skeletonTitle)} />
              <span className={styles.skeleton} />
            </>
          ) : (
            <>
              <span className={styles.title}>{status === 'ready' && title ? title : url}</span>
              {status === 'ready' && description && <span className={styles.description}>{description}</span>}
              {status === 'failed' && <span className={styles.description}>{error ?? '미리보기를 가져오지 못했어요.'}</span>}
            </>
          )}
          <span className={styles.host}>{siteName ? `${siteName} · ${hostOf(url ?? '')}` : hostOf(url ?? '')}</span>
        </span>
        {showImage && (
          <img className={styles.image} src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImageBroken(true)} />
        )}
      </a>
      <span className={styles.actions}>
        {status === 'failed' && (
          <Button variant="ghost" size="sm" iconOnly icon="refresh" onClick={() => updateAttributes({ status: 'loading' })} aria-label="미리보기 다시 가져오기" title="미리보기 다시 가져오기" />
        )}
        <Button variant="ghost" size="sm" iconOnly icon="x" onClick={deleteNode} aria-label="링크 카드 삭제" title="링크 카드 삭제" />
      </span>
    </NodeViewWrapper>
  );
}

/**
 * 빈 줄에 주소 하나만 붙여넣으면 링크 카드로 바꾼다. 문장 중간에 붙여넣은 주소는 평범한 링크로 둔다.
 * 카드 정보(제목·설명·이미지 주소)는 메모 HTML 의 data- 속성에 저장해 드라이브 동기화에 그대로 실린다.
 */
export const LinkCard = Node.create({
  name: 'linkCard',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      url: dataAttr('url'),
      title: dataAttr('title'),
      description: dataAttr('description'),
      image: dataAttr('image'),
      siteName: dataAttr('site-name'),
      status: {
        default: 'loading',
        // 저장 도중 끊겨 loading 으로 남은 카드는 다시 열 때 다시 가져온다
        parseHTML: (el: HTMLElement) => el.getAttribute('data-status') ?? 'loading',
        renderHTML: (attrs: Record<string, unknown>) => ({ 'data-status': attrs.status }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-link-card]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const href = isHttpUrl(node.attrs.url) ? node.attrs.url : null;
    return ['div', mergeAttributes({ 'data-link-card': '' }, HTMLAttributes), ['a', { href }, node.attrs.title || node.attrs.url || '']];
  },

  renderText({ node }) {
    return [node.attrs.title, node.attrs.url].filter(Boolean).join(' ');
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkCardView);
  },

  addProseMirrorPlugins() {
    const type = this.type;
    return [
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData('text/plain').trim() ?? '';
            if (!text || /\s/.test(text) || !isHttpUrl(text)) return false;
            const { selection, schema } = view.state;
            const { $from, empty } = selection;
            if (!empty || $from.parent.type !== schema.nodes.paragraph || $from.parent.content.size > 0) return false;

            const card = type.create({ url: text, status: 'loading' });
            const after = schema.nodes.paragraph.create();
            const start = $from.before();
            const tr = view.state.tr.replaceWith(start, $from.after(), [card, after]);
            tr.setSelection(TextSelection.create(tr.doc, start + card.nodeSize + 1));
            view.dispatch(tr.scrollIntoView());
            return true;
          },
        },
      }),
    ];
  },
});
