import './header.css';
import headerTemplate from './header.html?raw';

export const renderHeader = (container) => {
  if (!container) {
    return;
  }

  container.innerHTML = headerTemplate;
};
