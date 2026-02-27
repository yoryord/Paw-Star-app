import './index.css';
import indexTemplate from './index.html?raw';

export const indexPage = {
  title: 'Paw Star | Home',
  render(container) {
    container.innerHTML = indexTemplate;
  }
};
