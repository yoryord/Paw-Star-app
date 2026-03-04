import './index.css';
import indexTemplate from './index.html?raw';
import { isLoggedIn } from '../../lib/auth.js';
import { supabaseClient } from '../../lib/supabase.js';

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

const fetchTopPetsByLikes = async () => {
  const [{ data: pets, error: petsError }, { data: likes, error: likesError }] = await Promise.all([
    supabaseClient
      .from('pets')
      .select('id, name, species, pet_picture_url')
      .in('species', ['dog', 'cat']),
    supabaseClient
      .from('pet_likes')
      .select('pet_id'),
  ]);

  if (petsError) throw petsError;
  if (likesError) throw likesError;

  const likeCountByPetId = new Map();
  (likes ?? []).forEach((like) => {
    const petId = like.pet_id;
    likeCountByPetId.set(petId, (likeCountByPetId.get(petId) ?? 0) + 1);
  });

  const topBySpecies = { dog: null, cat: null };

  (pets ?? []).forEach((pet) => {
    const species = String(pet.species ?? '').toLowerCase();
    if (species !== 'dog' && species !== 'cat') return;

    const currentLikes = likeCountByPetId.get(pet.id) ?? 0;
    const currentTop = topBySpecies[species];

    if (!currentTop || currentLikes > currentTop.likes) {
      topBySpecies[species] = {
        ...pet,
        likes: currentLikes,
      };
    }
  });

  return topBySpecies;
};

const applySpeciesStarCard = (container, speciesKey, starPet) => {
  const fallbackEmoji = speciesKey === 'dog' ? '🐶' : '🐱';
  const imageEl = container.querySelector(`#landing-${speciesKey}-star-avatar-img`);
  const fallbackEl = container.querySelector(`#landing-${speciesKey}-star-avatar-fallback`);
  const nameEl = container.querySelector(`#landing-${speciesKey}-star-name`);

  if (!imageEl || !fallbackEl || !nameEl) return;

  if (!starPet) {
    fallbackEl.textContent = fallbackEmoji;
    fallbackEl.classList.remove('d-none');
    imageEl.classList.add('d-none');
    nameEl.textContent = 'Waiting for likes...';
    return;
  }

  nameEl.textContent = `${starPet.name ?? 'Unnamed pet'} · ${starPet.likes} likes`;

  if (starPet.pet_picture_url) {
    imageEl.src = starPet.pet_picture_url;
    imageEl.alt = `${starPet.name ?? 'Pet'} avatar`;
    imageEl.classList.remove('d-none');
    fallbackEl.classList.add('d-none');
    imageEl.onerror = () => {
      imageEl.classList.add('d-none');
      fallbackEl.textContent = fallbackEmoji;
      fallbackEl.classList.remove('d-none');
    };
  } else {
    fallbackEl.textContent = fallbackEmoji;
    fallbackEl.classList.remove('d-none');
    imageEl.classList.add('d-none');
  }
};

const applyWeeklyStars = async (container) => {
  try {
    const topBySpecies = await fetchTopPetsByLikes();
    applySpeciesStarCard(container, 'dog', topBySpecies.dog);
    applySpeciesStarCard(container, 'cat', topBySpecies.cat);
  } catch (error) {
    console.error('[Landing] Failed to load weekly stars:', error);
  }
};

export const indexPage = {
  title: 'Paw Star | Home',
  async render(container) {
    container.innerHTML = indexTemplate;
    applyLandingImages(container);
    await applyWeeklyStars(container);

    const loggedIn = await isLoggedIn();
    if (loggedIn) {
      const authButtons = container.querySelector('#landing-auth-buttons');
      if (authButtons) {
        authButtons.classList.add('d-none');
      }
    }
  }
};
