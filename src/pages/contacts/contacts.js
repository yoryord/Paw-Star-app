import './contacts.css';
import contactsTemplate from './contacts.html?raw';

export const contactsPage = {
  title: 'Paw Star | Contacts',

  render(container) {
    container.innerHTML = contactsTemplate;
  },
};
