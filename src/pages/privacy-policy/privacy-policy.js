import './privacy-policy.css';
import privacyPolicyTemplate from './privacy-policy.html?raw';

export const privacyPolicyPage = {
  title: 'Paw Star | Privacy Policy',

  render(container) {
    container.innerHTML = privacyPolicyTemplate;
  },
};
