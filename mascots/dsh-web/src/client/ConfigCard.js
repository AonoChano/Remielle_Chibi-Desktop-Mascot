/**
 * Plugin-configuration card, registered into `settings.plugin.item` — it
 * renders inside DSH Settings -> Plugins -> 插件配置 next to the shipped
 * cards, using the same collapsible card shape (header button + in-place
 * body, collapsed by default). Self-contained: controls read/write the pet's
 * own settings store (localStorage-backed), so it works for a third-party
 * plugin without the host settings namespace (whose exposure is an upstream
 * allowlist).
 *
 * Controls (with ⓘ tooltips): pet size, celebration light probability,
 * agent-state link toggle, position reset, and show/hide. All apply
 * immediately.
 */
import React from 'react';
import { IconChevronDownOutline14, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';
import { mountCss } from './css.js';
import { getSettings, updateSettings, subscribeSettings } from './settings.js';
import { getHidden, setHidden, subscribeHidden, resetPos } from './store.js';
import { SIZE_MIN, SIZE_MAX } from './persist.js';

/** ⓘ anchor wrapped in a primitives Tooltip bubble. */
function info(label) {
  return React.createElement(
    Tooltip,
    { label, side: 'right', delayMs: 300 },
    React.createElement('span', { className: 'remi-pet-config-info', 'aria-label': label }, 'ⓘ'),
  );
}

function row(label, tooltip, control) {
  return React.createElement(
    'div',
    { className: 'remi-pet-config-row' },
    React.createElement(
      'span',
      { className: 'remi-pet-config-label' },
      label,
      info(tooltip),
    ),
    control,
  );
}

export function ConfigCard() {
  const [open, setOpen] = React.useState(false);
  const [settings, setSettingsState] = React.useState(getSettings());
  const [hidden, setHiddenState] = React.useState(getHidden());

  React.useEffect(() => mountCss(), []);
  React.useEffect(() => subscribeSettings(setSettingsState), []);
  React.useEffect(() => subscribeHidden(setHiddenState), []);

  const lightPct = Math.round(settings.lightChance * 100);

  const sizeControl = React.createElement(
    'div',
    { className: 'remi-pet-config-control' },
    React.createElement('input', {
      type: 'range',
      min: SIZE_MIN,
      max: SIZE_MAX,
      step: 20,
      value: settings.size,
      onChange: (event) => updateSettings({ size: Number(event.target.value) }),
    }),
    React.createElement('span', { className: 'remi-pet-config-value' }, `${settings.size}px`),
  );

  const lightControl = React.createElement(
    'div',
    { className: 'remi-pet-config-control' },
    React.createElement('input', {
      type: 'range',
      min: 0,
      max: 100,
      step: 5,
      value: lightPct,
      onChange: (event) => updateSettings({ lightChance: Number(event.target.value) / 100 }),
    }),
    React.createElement('span', { className: 'remi-pet-config-value' }, `${lightPct}%`),
  );

  const activityControl = React.createElement('input', {
    type: 'checkbox',
    className: 'remi-pet-config-check',
    checked: settings.activityEnabled,
    onChange: (event) => updateSettings({ activityEnabled: event.target.checked }),
  });

  const positionControl = React.createElement(
    'button',
    { type: 'button', className: 'remi-pet-config-btn', onClick: resetPos },
    '重置到角落',
  );

  const visibilityControl = React.createElement(
    'button',
    {
      type: 'button',
      className: 'remi-pet-config-btn',
      onClick: () => setHidden(!hidden),
    },
    hidden ? '显示' : '隐藏',
  );

  return React.createElement(
    'li',
    { className: `remi-pet-config-card${open ? ' remi-pet-config-open' : ''}` },
    React.createElement(
      'button',
      {
        type: 'button',
        className: 'remi-pet-config-head',
        'aria-expanded': open,
        'aria-label': `${open ? '折叠' : '展开'}: 蕾米宠物`,
        onClick: () => setOpen(!open),
      },
      React.createElement(
        'span',
        { className: 'remi-pet-config-head-text' },
        React.createElement('span', { className: 'remi-pet-config-name' }, '蕾米宠物'),
        React.createElement('span', { className: 'remi-pet-config-desc' }, 'DeepSeek Harness 页面桌宠配置'),
      ),
      React.createElement(IconChevronDownOutline14, {
        size: 14,
        className: `remi-pet-config-chevron${open ? '' : ' remi-pet-config-closed'}`,
      }),
    ),
    open
      ? React.createElement(
          'div',
          { className: 'remi-pet-config-body' },
          row('大小', '宠物在页面上的显示尺寸（120–320px）', sizeControl),
          row('庆祝金光', '整轮回答结束后，蕾米欣赏作品时闪耀金色光芒的概率；0% 表示不显示金光', lightControl),
          row('跟随代理状态', '开启后，蕾米随代理工作状态切换动画：推理时思考、输出时作画、等待审批或提问时卖萌', activityControl),
          row('位置', '清除已保存的位置，让蕾米回到页面右下角', positionControl),
          row('显示', '蕾米当前是否显示在页面上', visibilityControl),
        )
      : null,
  );
}
