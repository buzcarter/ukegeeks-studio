/**
 * A right-click menu: a list of buttons where the click was, closed by choosing an
 * item, clicking elsewhere, or Esc. One at a time. Styled by ".libraryMenu"
 * (web/css/song-list.css).
 */

let open = null;

export function closeContextMenu() {
  if (open) open.remove();
  open = null;
}

/**
 * Shows the menu at the mouse event's place, kept inside the window.
 * @param {MouseEvent} event the "contextmenu" event
 * @param {({ label: string, action?: () => void, disabled?: boolean } | null)[]} items null is a separator
 */
export function showContextMenu(event, items) {
  event.preventDefault();
  closeContextMenu();
  const menu = document.createElement('ul');
  menu.className = 'libraryMenu';
  menu.setAttribute('role', 'menu');
  for (const item of items) {
    const li = document.createElement('li');
    if (item) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'menuitem');
      button.textContent = item.label;
      button.disabled = !!item.disabled;
      button.addEventListener('click', () => {
        closeContextMenu();
        item.action();
      });
      li.append(button);
    } else {
      li.className = 'libraryMenuSeparator';
      li.setAttribute('role', 'separator');
    }
    menu.append(li);
  }
  document.body.append(menu);
  const { width, height } = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(event.clientX, innerWidth - width - 4)}px`;
  menu.style.top = `${Math.min(event.clientY, innerHeight - height - 4)}px`;
  open = menu;
}

document.addEventListener('click', (event) => {
  if (open && !open.contains(event.target)) closeContextMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeContextMenu();
});
