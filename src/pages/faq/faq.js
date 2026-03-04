import './faq.css';
import faqTemplate from './faq.html?raw';

export const faqPage = {
  title: 'Paw Star | FAQ',

  render(container) {
    container.innerHTML = faqTemplate;
  },
};
