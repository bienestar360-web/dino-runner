window.I18N = {
  share: {
    title: 'Dino Runner',
    template: (score, pos) => `🦖 I scored ${score} points in Dino Runner${pos ? ` (rank #${pos} worldwide)` : ''}. Can you beat me?`,
    copied: '✅ Copied',
    shareLabel: '📤 Share'
  },
  hud: { lives: 'Lives', nextLife: 'Next life', pts: 'pts' }
};
document.addEventListener('DOMContentLoaded', () => {
  const fix = () => {
    const lives = document.getElementById('hud-lives');
    if (lives && /Vidas:/.test(lives.textContent)) lives.textContent = lives.textContent.replace('Vidas:', `${window.I18N.hud.lives}:`);
    const next = document.getElementById('hud-next-life');
    if (next && /Próxima vida:/.test(next.textContent)) next.textContent = next.textContent.replace('Próxima vida:', `${window.I18N.hud.nextLife}:`).replace(/\bpts\b/, window.I18N.hud.pts);
  };
  new MutationObserver(fix).observe(document.body, { childList: true, subtree: true, characterData: true });
  fix();
});
