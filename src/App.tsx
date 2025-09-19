import { Suspense, lazy } from 'react';
import ErrorBoundary from './components/organisms/ErrorBoundary';
import Header from './components/organisms/Header';
import Hero from './components/organisms/Hero';
import LoadingSpinner from './components/atoms/LoadingSpinner';

// Lazy load components for better performance
const FeatureGrid = lazy(() => import('./components/organisms/FeatureGrid'));
const DemoSection = lazy(() => import('./components/organisms/DemoSection'));

function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-900">
        {/* Skip Links for Accessibility */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Skip to main content
        </a>
        <a 
          href="#demo-section" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-32 bg-blue-600 text-white px-4 py-2 rounded-md z-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Skip to demo
        </a>
        
        <Header />
        <main id="main-content" role="main">
          <Hero />
          <section aria-label="Features">
            <Suspense fallback={<LoadingSpinner size="lg" text="Loading features..." />}>
              <FeatureGrid />
            </Suspense>
          </section>
          <section id="demo-section" aria-label="Interactive Demo">
            <Suspense fallback={<LoadingSpinner size="lg" text="Loading demo..." />}>
              <DemoSection />
            </Suspense>
          </section>
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
