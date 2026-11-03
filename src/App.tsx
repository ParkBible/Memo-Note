import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { NoNoteSelected, NotesPage } from '@/pages/NotesPage';
import { NotePage } from '@/pages/NotePage';

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      {
        element: <NotesPage />,
        children: [
          { path: '/', element: <NoNoteSelected /> },
          { path: '/notes/:id', element: <NotePage /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
