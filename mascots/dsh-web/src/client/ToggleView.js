/**
 * Sidebar show/hide toggle, registered into the sidebar.footer.action slot.
 *
 * Icon + text row styled to sit beside the Settings trigger: theme-token
 * colors, 14px sparkle icon (matching the 14px Settings glyph), hover state.
 * The icon component is a shell-own module (@deepseek-ai/dsh-client-ui-primitives),
 * so the bundle requires it instead of inlining it.
 */
import React from 'react';
import { IconSparkle16 } from '@deepseek-ai/dsh-client-ui-primitives';
import { mountCss } from './css.js';
import { getHidden, setHidden } from './store.js';

export function ToggleView() {
  const [hidden, setHiddenState] = React.useState(getHidden());

  React.useEffect(() => mountCss(), []);

  return React.createElement(
    'button',
    {
      type: 'button',
      className: 'remi-pet-toggle',
      title: hidden ? '显示蕾米宠物' : '隐藏蕾米宠物',
      'aria-label': hidden ? '显示蕾米宠物' : '隐藏蕾米宠物',
      onClick: () => {
        setHidden(!hidden);
        setHiddenState(!hidden);
      },
    },
    React.createElement(IconSparkle16, { size: 14 }),
    React.createElement('span', null, `宠物：${hidden ? '隐藏' : '显示'}`),
  );
}
