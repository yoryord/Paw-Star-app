import './stories.css';
import storiesTemplate from './stories.html?raw';

export const storiesPage = {
  title: 'Paw Star | Stories',
  render(container) {
    container.innerHTML = storiesTemplate;
  }
};