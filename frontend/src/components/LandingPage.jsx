import React, { useEffect, useRef } from 'react';
import './LandingPage.css';
import libraryImg from '../assets/library.jpg'; 

function LandingPage({ onNavigate }) {
  const heroRef = useRef(null);
  const splitRef = useRef(null);
  const ctaRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.15 }
    );
    [heroRef, splitRef, ctaRef].forEach((ref) => {
      if (ref.current) observer.observe(ref.current);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-container">

      <header className="landing-header">
        <span className="landing-logo">StorySync</span>
      </header>

      <section className="landing-hero " ref={heroRef}>
      <img
      src="https://i.pinimg.com/1200x/57/9b/c7/579bc78b52350fdace992c3f1cbb0fa3.jpg"
      alt="Library"
      className="hero-image"
    />
    </section>

      <section className="landing-tagline " ref={heroRef}>
        <p>
          Explore and discover medias, organize your list,<br />
          join communities and connect with friends
        </p>
      </section>

      <section className="landing-split " ref={splitRef}>
        <div className="split-image">
          <img
            src="https://i.pinimg.com/736x/82/2d/d5/822dd5637ffd9c7a2094b1f1de3916a4.jpg"
            alt="Movie poster wall"
          />
        </div>
        <div className="split-text">
          <p>
            Get cross media recommendation, track your
            read list, watch list, and podcasts,
            review books, movies, and podcasts,
            join clubs and share your opinions
          </p>
        </div>
      </section>

      <section className="landing-cta " ref={ctaRef}>
        <p className="cta-label">Get Started</p>
        <div className="cta-buttons">
          <button className="cta-btn" onClick={() => onNavigate('login')}>Sign in</button>
          <button className="cta-btn" onClick={() => onNavigate('signup')}>Sign up</button>
        </div>
      </section>

    </div>
  );
}

export default LandingPage;