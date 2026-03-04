import './disclaimer.css';
import disclaimerTemplate from './disclaimer.html?raw';

export const disclaimerPage = {
  title: 'Paw Star | Disclaimer',

  render(container) {
    container.innerHTML = disclaimerTemplate;
  },
};
