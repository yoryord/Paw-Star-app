# Paw Star
Paw Star is an app for cats and dogs' lovers. Users can create and register profiles of their pets, adding pictures and biography/description, blog posting, likes and rankings based on likes count, communication between users through comments and messages for authenticated users. The app is built with JS and Supabase. Users after register / login, can create pet profiles (sub-profiles of their pets - cat/dog), post blogs named "stories" (add tags in the blog of their pets), like other users' stories, comment on them and send messages to other users. The users can like the pets registered by other users. The app has a ranking system based on the number of likes received for each pet, and weekly ranking named "Star of the week". Every week there is a separate ranking for cats and dogs. The likes for each pet are counted in two ways - "total" (all time) and "weekly" (from Monday to Sunday each week, then this count is reset with the start of the new week). The two pets (one cat and one dog) which received the most likes in one week are highlighted as the "Star of the Week" and are praised on the top of the ranking. The app also has a search feature that allows users to search for stories by tags or keywords.

## Architecture and Tech Stack

Classical client-server app:
- Frontend: JS app with HTML and CSS, using Bootstrap for styling and responsive design
- Backend: Supabase (authentication, storage, real-time features)
- Database: PostgreSQL
- Authentication: Supabase Auth
- Build tools: Vite, npm 
- API: Supabase REST API
- Storage: Supabase Storage for images and media files
- Hosting: Netlify
- Source code: GitHub

## Modular Design

Use modular code structure with clear separation of concerns and reusable components (pages, features). Follow best practices for code organization, naming conventions, and documentation to ensure maintainability and scalability of the app. 

## UI guidelines
- Use HTML, CSS, and Vanilla JavaScript for the frontend development.
- Use Bootstrap components and utilities to create a responsive and visually appealing design.
- Implement modern responsive UI design principles, with semantic HTML.
- Use a consistent color scheme and typography throughout the app to create a cohesive and visually appealing design.
- Use appropriate icons, effects and animations to enhance the user experience and make the app more engaging, enhance usability.

## Pages and Navigation
- Split the app into multiple pages: home, login, registration, user profile, pet profile, story creation, story listing, admin panel, ranking, search results, etc. 
- Implement pages as reusable components (HTML, CSS and JS code).
- Use routing to navigate between pages.
- Use full URLs like: /, /login, /register, /profile, /pet-profile, /create-story, /stories, /stories/{id}/story, /admin, etc.

## Backend and Database
- Use Supabase for backend services and database.
- Use PostgreSQL as the database to store user data, pet profiles, stories, likes, comments, messages, etc.
- Use Supabase storage for storing images and media files related to user profiles, pet profiles and stories.
- When changing the database scheme always use migrations to keep track of changes and ensure consistency across different environments.
- After applying a migration in Supabase, keep a copy of the migration SQL file in the project repository for reference and documentation purposes.

## Authentication and Authorization
- Use Supabase Auth for user registration, login, and authentication.
-Implement RLS (Row Level Security) policies to ensure that users can only access and modify their own data, and to enforce permissions for different user roles (e.g. users, admins).
-Implement user roles with a separate DB table: 'user_roles' + enum 'roles' (e.g. user, admin).
