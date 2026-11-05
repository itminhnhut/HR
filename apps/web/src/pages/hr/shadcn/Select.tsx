import * as Primitive from '@radix-ui/react-select';
import { Children, Fragment, isValidElement, useId, type ChangeEvent, type ReactElement, type ReactNode } from 'react';
import { Icon, type IconName } from '../../../ui/icons';
import { useTopLayer } from './topLayer';

/** The list refuses an empty value, which here means "all" or "none chosen". */
const EMPTY = '__empty__';

interface Item {
  value: string;
  label: ReactNode;
  disabled: boolean;
}

type OptionProps = { value?: string | number; children?: ReactNode; disabled?: boolean };

/** The <option>s the fields were written with, so a page only changes its import. */
function itemsOf(children: ReactNode): Item[] {
  return Children.toArray(children).flatMap((child): Item[] => {
    if (!isValidElement(child)) return [];
    const element = child as ReactElement<OptionProps>;
    if (element.type === Fragment) return itemsOf(element.props.children);
    return [
      {
        // As in HTML, an option with no value has its words as the value.
        value: String(element.props.value ?? element.props.children ?? ''),
        label: element.props.children,
        disabled: !!element.props.disabled,
      },
    ];
  });
}

const toList = (value: string) => (value === '' ? EMPTY : value);

export interface SelectProps {
  label: ReactNode;
  hideLabel?: boolean;
  icon?: IconName;
  className?: string;
  value?: string | number;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  children: ReactNode;
}

function FieldTrigger({
  ref,
  labelId,
  current,
  icon,
}: {
  ref: (el: HTMLButtonElement | null) => void;
  labelId: string;
  current: string;
  icon?: IconName;
}) {
  return (
    <Primitive.Trigger
      ref={ref}
      aria-labelledby={labelId}
      value={current}
      className="ui-field group flex w-full min-w-0 items-center justify-between gap-2 rounded-control border bg-white text-left text-sm text-navy outline-none data-[placeholder]:text-muted disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon && <Icon name={icon} size={16} className="shrink-0 text-muted" />}
        <span className="truncate">
          <Primitive.Value />
        </span>
      </span>
      <Primitive.Icon className="shrink-0 text-slate opacity-70">
        <Icon name="chevronDown" size={16} />
      </Primitive.Icon>
    </Primitive.Trigger>
  );
}

function OptionList({ items, container }: { items: Item[]; container: HTMLElement }) {
  return (
    <Primitive.Portal container={container}>
      <Primitive.Content
        position="popper"
        sideOffset={4}
        className="z-50 max-h-[min(300px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-control border border-line bg-white text-navy shadow-md animate-fade"
      >
        <Primitive.Viewport className="p-1">
          {items.map((item) => (
            <Primitive.Item
              key={item.value}
              value={toList(item.value)}
              disabled={item.disabled}
              data-value={item.value}
              className="relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-tint"
            >
              <Primitive.ItemText>{item.label}</Primitive.ItemText>
              <Primitive.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center">
                <Icon name="check" size={14} />
              </Primitive.ItemIndicator>
            </Primitive.Item>
          ))}
        </Primitive.Viewport>
      </Primitive.Content>
    </Primitive.Portal>
  );
}

/** shadcn's Select, with the props of the field it replaces. */
export function SelectField({
  label,
  hideLabel,
  icon,
  className = '',
  value,
  onChange,
  disabled,
  children,
}: SelectProps) {
  const id = useId();
  const { ref, container } = useTopLayer<HTMLButtonElement>();
  const current = String(value ?? '');
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <span id={id} className={hideLabel ? 'sr-only' : 'text-sm font-medium text-navy'}>
        {label}
      </span>
      <Primitive.Root
        value={toList(current)}
        disabled={disabled}
        onValueChange={(next) => {
          const picked = next === EMPTY ? '' : next;
          onChange?.({ target: { value: picked }, currentTarget: { value: picked } } as ChangeEvent<HTMLSelectElement>);
        }}
      >
        <FieldTrigger ref={ref} labelId={id} current={current} icon={icon} />
        {container && <OptionList items={itemsOf(children)} container={container} />}
      </Primitive.Root>
    </div>
  );
}
