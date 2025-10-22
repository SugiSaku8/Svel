/* Pure JS: small behavior layer.
   The structure uses data-action attributes so the cards are reusable.
*/
document.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.action-card');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const action = card.dataset.action;
      handleCardAction(action, card);
    });
    // keyboard accessibility
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });
});

function handleCardAction(action, el) {
  // small visual feedback
  el.animate([{ transform: 'scale(1.02)' }, { transform: 'scale(1)' }], { duration: 200 });

  // Example handler: wiring point for real app logic
  switch(action) {
    case 'tuner':
      showToast('Tuner を開きます…');
      break;
    case 'rands':
      showToast('R & S を開きます…');
      break;
    case 'p':
      showToast('P を開きます…');
      break;
    default:
      showToast('未定義の操作: ' + action);
  }
}

/* tiny toast so it's obvious clicks work (pure JS, no libs) */
function showToast(message, timeout = 1500) {
  let t = document.createElement('div');
  t.className = 'app-toast';
  t.textContent = message;
  Object.assign(t.style, {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: '40px',
    background: 'rgba(0,0,0,0.7)',
    color: 'white',
    padding: '10px 16px',
    borderRadius: '8px',
    zIndex: 9999,
    fontSize: '14px',
    pointerEvents: 'none'
  });
  document.body.appendChild(t);
  setTimeout(() => t.style.opacity = '0', timeout - 300);
  setTimeout(() => t.remove(), timeout);
}