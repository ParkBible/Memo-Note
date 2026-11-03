import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { deleteEmptyNotes } from './data/notes';
import './styles/global.css';

const openNoteId = window.location.pathname.match(/^\/notes\/([^/]+)/)?.[1];
void deleteEmptyNotes(openNoteId).catch((e) => console.warn('[notes] empty cleanup failed', e));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
