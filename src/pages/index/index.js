import './index.css';
import indexTemplate from './index.html?raw';
import { isLoggedIn } from '../../lib/auth.js';

const landingImageUrls = {
  happyDogs: new URL('../../../images_temp/happy-dogs.avif', import.meta.url).href,
  catPortrait: new URL('../../../images_temp/cat-photo.webp', import.meta.url).href,
  kittenPuppy: new URL('../../../images_temp/cute-kitten-and-puppy-outdoors-in-grass.webp', import.meta.url).href,
  petStudioPortrait: new URL('../../../images_temp/introducing-dogs-cats-resource_0.avif', import.meta.url).href,
  storiesCover: new URL('../../../images_temp/shutterstock_393108265-1440x900.jpg', import.meta.url).href,
};

const applyLandingImages = (container) => {
  const imageElements = container.querySelectorAll('[data-image-key]');

  imageElements.forEach((imageElement) => {
    const imageKey = imageElement.getAttribute('data-image-key');
    const imageUrl = landingImageUrls[imageKey];

    if (imageUrl) {
      imageElement.setAttribute('src', imageUrl);
    }
  });
};

export const indexPage = {
  title: 'Paw Star | Home',
  async render(container) {
    container.innerHTML = indexTemplate;
    applyLandingImages(container);

    const loggedIn = await isLoggedIn();
    if (loggedIn) {
      const authButtons = container.querySelector('#landing-auth-buttons');
      if (authButtons) {
        authButtons.classList.add('d-none');
      }
    }
  }
};
