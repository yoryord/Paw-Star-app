import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './styles/global.css';
import { initRouter } from './app/router.js';
import { initAuth } from './lib/auth.js';

// Seed Supabase session from persisted token before the first route renders
initAuth().then(() => initRouter());
