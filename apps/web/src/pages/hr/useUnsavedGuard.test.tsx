import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { createMemoryRouter, Link, RouterProvider, useNavigate } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { useUnsavedGuard } from './useUnsavedGuard';

const DESCRIPTION = 'Bài có thay đổi chưa lưu.';

function Form({ allowed }: { allowed?: string }) {
  const [isDirty, setIsDirty] = useState(false);
  const allowedPath = useRef(allowed ?? null);
  const navigate = useNavigate();
  const { allowLeave, guardDialog } = useUnsavedGuard(isDirty, { description: DESCRIPTION, allowedPath });
  return (
    <>
      <button type="button" onClick={() => setIsDirty(true)}>
        Sửa
      </button>
      <button type="button" onClick={() => setIsDirty(false)}>
        Đã lưu
      </button>
      <button
        type="button"
        onClick={() => {
          allowLeave();
          navigate('/khac');
        }}
      >
        Lưu rồi đi
      </button>
      <Link to="/khac">Trang khác</Link>
      <Link to="/rieng">Địa chỉ riêng</Link>
      {guardDialog}
    </>
  );
}

function open(allowed?: string) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <Form allowed={allowed} /> },
      { path: '/khac', element: <p>Khác</p> },
      { path: '/rieng', element: <p>Riêng</p> },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const question = () => screen.getByRole('alertdialog', { name: 'Rời trang?' });

afterEach(cleanup);

describe('Leaving a form with unsaved changes', () => {
  it('should let HR go without asking while nothing has changed', async () => {
    // Arrange
    const router = open();

    // Act
    await userEvent.click(screen.getByRole('link', { name: 'Trang khác' }));

    // Assert
    await waitFor(() => expect(router.state.location.pathname).toBe('/khac'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('should ask with the words of this form and stay on "Ở lại"', async () => {
    // Arrange
    const router = open();
    await userEvent.click(screen.getByRole('button', { name: 'Sửa' }));

    // Act
    await userEvent.click(screen.getByRole('link', { name: 'Trang khác' }));
    const text = question().textContent;
    await userEvent.click(within(question()).getByRole('button', { name: 'Ở lại' }));

    // Assert
    expect(text).toContain(DESCRIPTION);
    expect(router.state.location.pathname).toBe('/');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('should go on "Rời trang"', async () => {
    // Arrange
    const router = open();
    await userEvent.click(screen.getByRole('button', { name: 'Sửa' }));

    // Act
    await userEvent.click(screen.getByRole('link', { name: 'Trang khác' }));
    await userEvent.click(within(question()).getByRole('button', { name: 'Rời trang' }));

    // Assert
    await waitFor(() => expect(router.state.location.pathname).toBe('/khac'));
  });

  it('should ask again the next time after "Ở lại"', async () => {
    // Arrange
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Sửa' }));
    await userEvent.click(screen.getByRole('link', { name: 'Trang khác' }));
    await userEvent.click(within(question()).getByRole('button', { name: 'Ở lại' }));

    // Act
    await userEvent.click(screen.getByRole('link', { name: 'Trang khác' }));

    // Assert
    expect(question()).toBeTruthy();
  });

  it('should not ask when leaving on purpose after a save', async () => {
    // Arrange
    const router = open();
    await userEvent.click(screen.getByRole('button', { name: 'Sửa' }));

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Lưu rồi đi' }));

    // Assert
    await waitFor(() => expect(router.state.location.pathname).toBe('/khac'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('should let the one allowed address through and still guard every other', async () => {
    // Arrange
    const router = open('/rieng');
    await userEvent.click(screen.getByRole('button', { name: 'Sửa' }));

    // Act
    await userEvent.click(screen.getByRole('link', { name: 'Trang khác' }));
    const askedForOther = question().textContent;
    await userEvent.click(within(question()).getByRole('button', { name: 'Ở lại' }));
    await userEvent.click(screen.getByRole('link', { name: 'Địa chỉ riêng' }));

    // Assert
    expect(askedForOther).toContain(DESCRIPTION);
    await waitFor(() => expect(router.state.location.pathname).toBe('/rieng'));
  });

  it('should have the browser ask when the tab closes, only while there are changes', async () => {
    // Arrange
    open();
    const closing = () => {
      const event = new Event('beforeunload', { cancelable: true });
      fireEvent(window, event);
      return event.defaultPrevented;
    };
    const whileClean = closing();

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Sửa' }));

    // Assert
    expect(whileClean).toBe(false);
    expect(closing()).toBe(true);
  });
});
