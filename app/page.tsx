// app/page.tsx
'use client';
import { useEffect } from 'react';
import HeroSection from '../components/landing/HeroSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import Footer from '../components/landing/Footer';

export default function Home() {
  useEffect(() => {
    document.body.classList.add('landing-page');
    return () => document.body.classList.remove('landing-page');
  }, []);

  return (
    <div>
      <HeroSection />
      <FeaturesSection />
      <Footer />
    </div>
  );
}