document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    item.classList.add('active');
    const tabId = 'tab-' + item.dataset.tab;
    document.getElementById(tabId).classList.add('active');
  });
});

const statusEl = document.getElementById('status-text');

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

document.querySelectorAll('.btn-anim').forEach(btn => {
  btn.addEventListener('click', () => {
    const anim = btn.dataset.anim;
    if (window.electronAPI) {
      window.electronAPI.send('play-animation', anim);
      setStatus('已发送动画指令: ' + anim);
    }
  });
});

document.querySelectorAll('.btn-outfit').forEach(btn => {
  btn.addEventListener('click', () => {
    const outfit = btn.dataset.outfit;
    if (window.electronAPI) {
      window.electronAPI.send('set-outfit', outfit);
      setStatus('已发送换装指令: 套装 ' + outfit);
    }
  });
});
