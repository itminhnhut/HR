import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const openOptions = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')];

/** Picks in the admin's Select (pages/hr/shadcn/Select.tsx) as HR would. By value or by its words; waits for a list still loading. */
export async function chooseOption(trigger: HTMLElement, choice: string): Promise<void> {
  await userEvent.click(trigger);
  const option = await waitFor(() => {
    const found = openOptions().find((o) => o.dataset.value === choice || o.textContent === choice);
    if (!found)
      throw new Error(
        `No option "${choice}" in: ${openOptions()
          .map((o) => o.textContent)
          .join(', ')}`,
      );
    return found;
  });
  await userEvent.click(option);
}

/** What the list offers once `loaded` is among it, leaving the list closed again. */
export async function optionNames(trigger: HTMLElement, loaded: string): Promise<(string | null)[]> {
  await userEvent.click(trigger);
  const names = await waitFor(() => {
    const now = openOptions().map((o) => o.textContent);
    if (!now.includes(loaded)) throw new Error(`Still no option "${loaded}" in: ${now.join(', ')}`);
    return now;
  });
  await userEvent.keyboard('{Escape}');
  return names;
}
