export function toast(message, type='info'){
  const el = document.getElementById('toast');
  el.textContent = message; el.className = `toast show ${type}`;
  setTimeout(()=>el.classList.remove('show'),3000);
}
