import './footer.css';
import footerTemplate from './footer.html?raw';

export const renderFooter = (container) => {
  if (!container) {
    return;
  }

  container.innerHTML = footerTemplate;
};
