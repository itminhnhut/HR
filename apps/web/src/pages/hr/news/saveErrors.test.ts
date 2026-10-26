import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api';
import { imagesWaitingForAlt, saveErrorMessage } from './saveErrors';

describe('why a save was refused', () => {
  it('should name the content problem the server gave, once, without repeating "Chưa lưu được"', () => {
    const refused = new ApiError(422, 'Chưa lưu được, kiểm tra các ô được đánh dấu.', {
      content: 'Nội dung lồng nhau quá sâu.',
    });

    expect(saveErrorMessage(refused)).toBe('Nội dung bài: Nội dung lồng nhau quá sâu.');
  });

  it('should explain English schema messages in Vietnamese', () => {
    const refused = new ApiError(422, 'Chưa lưu được, kiểm tra các ô được đánh dấu.', {
      content: 'Too big: expected string to have <=10000 characters',
    });

    expect(saveErrorMessage(refused)).toBe(
      'Nội dung bài: Một đoạn chữ dài quá 10.000 ký tự, hãy tách thành nhiều đoạn.',
    );
    expect(saveErrorMessage(new ApiError(422, 'x', { content: 'Invalid input' }))).toMatch(
      /^Nội dung bài: .*[ăâđêôơư]/,
    );
  });

  it('should fall back to the server message, then to a network hint', () => {
    expect(saveErrorMessage(new ApiError(500, 'Máy chủ đang bận.'))).toBe('Máy chủ đang bận.');
    expect(saveErrorMessage(new TypeError('Failed to fetch'))).toBe('Kiểm tra mạng rồi thử lại.');
  });
});

describe('pictures waiting for a description', () => {
  it('should count the pictures saved without a description, anywhere in the article', () => {
    const image = (pending: boolean) => ({
      type: 'article-image',
      altText: pending ? 'Ảnh minh hoạ' : 'Đội ngũ',
      ...(pending ? { altPending: true } : {}),
    });
    const content = {
      root: {
        type: 'root',
        children: [
          image(true),
          image(false),
          { type: 'layout-container', children: [{ type: 'layout-item', children: [image(true)] }] },
        ],
      },
    };

    expect(imagesWaitingForAlt(content)).toBe(2);
    expect(imagesWaitingForAlt(null)).toBe(0);
  });
});
