import './terms-of-service.css';
import termsOfServiceTemplate from './terms-of-service.html?raw';

export const termsOfServicePage = {
  title: 'Paw Star | Terms of Service',

  render(container) {
    container.innerHTML = termsOfServiceTemplate;
  },
};
