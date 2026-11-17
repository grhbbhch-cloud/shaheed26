import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PlatformProvider } from './context/PlatformContext';
import { AdminGate } from './pages/admin/AdminGate';
import { CollectionPage } from './pages/public/CollectionPage';
import { ContentDetailPage } from './pages/public/ContentDetailPage';
import { HomePage } from './pages/public/HomePage';
import { PoemDetailPage } from './pages/public/PoemDetailPage';
import { PublicLayout } from './pages/public/PublicLayout';
import { SearchPage } from './pages/public/SearchPage';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <PlatformProvider>
          <Routes>
            <Route path="/admin/*" element={<AdminGate />} />
            <Route path="/" element={<PublicLayout />}>
              <Route index element={<HomePage />} />
              <Route path="p/:slug" element={<CollectionPage />} />
              <Route path="content/:slug" element={<ContentDetailPage />} />
              <Route path="poem/:slug" element={<PoemDetailPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="*" element={<HomePage />} />
            </Route>
          </Routes>
        </PlatformProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
