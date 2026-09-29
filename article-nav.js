document.documentElement.classList.add('nav-ready');
document.addEventListener('DOMContentLoaded', () => {
  const button = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-head .nav');
  if (!button || !nav) return;

  function closeMenu(returnFocus = false) {
    nav.classList.remove('open');
    button.setAttribute('aria-expanded', 'false');
    if (returnFocus) button.focus();
  }

  button.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    button.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) nav.querySelector('a')?.focus();
  });
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('open')) closeMenu(true);
  });
  document.addEventListener('click', event => {
    if (nav.classList.contains('open') && !event.target.closest('.site-head')) closeMenu();
  });
  window.matchMedia('(min-width: 901px)').addEventListener('change', event => {
    if (event.matches) closeMenu();
  });
});
