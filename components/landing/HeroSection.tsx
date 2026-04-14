// components/landing/HeroSection.tsx
import Link from 'next/link';
// import { Button } from '@/components/ui/Button';

export default function HeroSection() {
  return (
    <>
      <nav className="navbar navbar-expand-lg fixed-top navbar-custom sticky sticky-dark landing-navbar" id="navbar">
        <div className="container">
          <a className="navbar-brand logo">
            <img src="/images/logo.png" alt="" className="logo-dark" height={60} />
            {/* <img src="/images/logo.png" alt="" className="logo-light" height={24} /> */}
          </a>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarCollapse" aria-controls="navbarCollapse" aria-expanded="false" aria-label="Toggle navigation">
            <i className="mdi mdi-menu" />
          </button>
          <div className="collapse navbar-collapse" id="navbarCollapse">
            <ul className="navbar-nav mx-auto navbar-center" id="navbar-navlist">
              <li className="nav-item">
                <a data-scroll href="#home" className="nav-link landing-nav-link">Home</a>
              </li>
              <li className="nav-item">
                <a data-scroll href="#features" className="nav-link landing-nav-link">Features</a>
              </li>
              <li className="nav-item">
                <a data-scroll href="#blog" className="nav-link landing-nav-link">Guide</a>
              </li>
              <li className="nav-item">
                <a data-scroll href="#contact" className="nav-link landing-nav-link">Support</a>
              </li>
            </ul>
            <ul className="navbar-nav navbar-center">
              <li className="nav-item">
                <Link href="/login" className="btn btn-primary">Login</Link>
              </li>
            </ul>
          </div>
        </div>
      </nav>
      <section className="hero-1-bg landing-hero" style={{backgroundImage: 'url(/images/hero-1-bg-img.png)'}} id="home">
        <div className="container">
          <div className="row align-items-center justify-content-center">
            <div className="col-lg-6">
              <h1 className="hero-1-title fw-bold text-shadow mb-4 landing-heading">Welcome to <span className="landing-accent">Chatbox</span></h1>
              <div className="w-75 mb-5 mb-lg-0">
                <p className="text-muted mb-1 pb-5 font-size-17">Turn WhatsApp into your company’s customer support hub. All your chats, one dashboard, faster replies.</p>
                <p>Manage all client conversations from your company’s WhatsApp number in one secure, easy-to-use platform.</p>
                <div className="subscribe-form">
                  <Link href="/login" className="btn btn-primary">Get Started</Link>
                </div>
              </div>
            </div>
            <div className="col-lg-6 col-md-10">
              <div className=" mt-5 mt-lg-0">
                <img src="/images/hero-1-img.png" alt="" className="img-fluid d-block mx-auto" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}