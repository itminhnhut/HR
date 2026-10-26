import { describe, expect, it } from 'vitest';
import { INDEXNOW_ENDPOINT, isValidIndexNowKey, notifyIndexNow, type FetchFn } from './indexnow.js';

const KEY = 'test-indexnow-key-1234';

function recordingFetch(status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch: FetchFn = async (url, init) => {
    calls.push({ url, init });
    return new Response(null, { status });
  };
  return { calls, fetch };
}

describe('isValidIndexNowKey', () => {
  it.each(['abcd1234', 'A-b-C-1-2-3-4-5', 'x'.repeat(128)])('should accept %s', (key) => {
    expect(isValidIndexNowKey(key)).toBe(true);
  });

  it.each(['short', 'has space1', 'dots.are.no', 'x'.repeat(129), '../../etc/passwd', ''])(
    'should refuse "%s"',
    (key) => {
      expect(isValidIndexNowKey(key)).toBe(false);
    },
  );
});

describe('notifyIndexNow', () => {
  it('should post every changed address once, absolute and with the key file location', async () => {
    const { calls, fetch } = recordingFetch();

    await notifyIndexNow({ siteUrl: 'https://tuyendung.test', key: KEY, fetch }, [
      '/tin-tuc/bai-1',
      '/tin-tuc',
      '/tin-tuc/bai-1',
    ]);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(INDEXNOW_ENDPOINT);
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      host: 'tuyendung.test',
      key: KEY,
      keyLocation: `https://tuyendung.test/${KEY}.txt`,
      urlList: ['https://tuyendung.test/tin-tuc/bai-1', 'https://tuyendung.test/tin-tuc'],
    });
  });

  it('should not call IndexNow when nothing changed', async () => {
    const { calls, fetch } = recordingFetch();

    await notifyIndexNow({ siteUrl: 'https://tuyendung.test', key: KEY, fetch }, []);

    expect(calls).toHaveLength(0);
  });

  it('should fail with the status when IndexNow refuses the key', async () => {
    const { fetch } = recordingFetch(403);

    await expect(notifyIndexNow({ siteUrl: 'https://tuyendung.test', key: KEY, fetch }, ['/'])).rejects.toThrow(/403/);
  });
});
