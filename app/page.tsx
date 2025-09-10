// app/page.tsx
import HeroSection from '../components/landing/HeroSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import Footer from '../components/landing/Footer';

export default function Home() {
  return (
    <div>
      <HeroSection />
      <FeaturesSection />
      <Footer />
    </div>
  );
}