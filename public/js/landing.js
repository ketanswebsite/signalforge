/* ========================================
   SutrAlgo - Landing Page JavaScript
   Enhanced Animations & Interactions
   ======================================== */

(function() {
    'use strict';

    // ========================================
    // PARTICLE SYSTEM
    // ========================================
    function initParticles() {
        const canvas = document.getElementById('particles-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let particles = [];
        let animationId;

        // Set canvas size
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Particle class
        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 2 + 1;
                this.speedX = Math.random() * 0.5 - 0.25;
                this.speedY = Math.random() * 0.5 - 0.25;
                this.opacity = Math.random() * 0.5 + 0.2;
            }

            update() {
                this.x += this.speedX;
                this.y += this.speedY;

                // Wrap around screen
                if (this.x > canvas.width) this.x = 0;
                if (this.x < 0) this.x = canvas.width;
                if (this.y > canvas.height) this.y = 0;
                if (this.y < 0) this.y = canvas.height;
            }

            draw() {
                ctx.fillStyle = `rgba(212, 175, 55, ${this.opacity})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Create particles
        function createParticles() {
            const particleCount = window.innerWidth < 768 ? 50 : 100;
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        }

        // Animation loop
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach(particle => {
                particle.update();
                particle.draw();
            });

            // Draw connections
            particles.forEach((p1, i) => {
                particles.slice(i + 1).forEach(p2 => {
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 100) {
                        ctx.strokeStyle = `rgba(212, 175, 55, ${0.1 * (1 - distance / 100)})`;
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                });
            });

            animationId = requestAnimationFrame(animate);
        }

        createParticles();
        animate();

        // Cleanup
        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', resizeCanvas);
        };
    }

    // ========================================
    // TYPING EFFECT
    // ========================================
    function initTypingEffect() {
        const element = document.getElementById('typing-text');
        if (!element) return;

        const texts = [
            'Where Formula Meets Algorithm',
            'Where Gold Meets Speed',
            'Where Wisdom Meets Technology'
        ];
        let textIndex = 0;
        let charIndex = 0;
        let isDeleting = false;
        let typingSpeed = 100;

        function type() {
            const currentText = texts[textIndex];

            if (isDeleting) {
                element.textContent = currentText.substring(0, charIndex - 1);
                charIndex--;
                typingSpeed = 50;
            } else {
                element.textContent = currentText.substring(0, charIndex + 1);
                charIndex++;
                typingSpeed = 100;
            }

            // Finished typing current text
            if (!isDeleting && charIndex === currentText.length) {
                typingSpeed = 2000; // Pause at end
                isDeleting = true;
            }

            // Finished deleting
            if (isDeleting && charIndex === 0) {
                isDeleting = false;
                textIndex = (textIndex + 1) % texts.length;
                typingSpeed = 500; // Pause before next text
            }

            setTimeout(type, typingSpeed);
        }

        // Start typing after a brief delay
        setTimeout(type, 500);
    }

    // ========================================
    // COUNTER ANIMATIONS (Optional - for future use)
    // ========================================
    function initCounters() {
        // Stats section removed from landing page
        // Keeping function for potential future use
        return;
    }

    // ========================================
    // PARALLAX SCROLLING
    // ========================================
    function initParallax() {
        const orbs = document.querySelectorAll('.gradient-orb');
        const floatingElements = document.querySelectorAll('.floating-element');

        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;

            orbs.forEach((orb, index) => {
                const speed = 0.1 + (index * 0.05);
                const yPos = -(scrolled * speed);
                orb.style.transform = `translateY(${yPos}px)`;
            });

            floatingElements.forEach((element, index) => {
                const speed = 0.05 + (index * 0.02);
                const yPos = scrolled * speed;
                element.style.transform = `translateY(${yPos}px)`;
            });
        });
    }

    // ========================================
    // ENHANCED SCROLL REVEALS
    // ========================================
    function initScrollReveals() {
        const reveals = document.querySelectorAll('.scroll-reveal');

        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -100px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                }
            });
        }, observerOptions);

        reveals.forEach((element, index) => {
            // Stagger animation delay
            element.style.animationDelay = `${index * 0.1}s`;
            observer.observe(element);
        });
    }

    // ========================================
    // SMOOTH SCROLL FOR ANCHOR LINKS
    // ========================================
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const href = this.getAttribute('href');
                if (href === '#' || !href) return;

                e.preventDefault();
                const target = document.querySelector(href);

                if (target) {
                    const offsetTop = target.offsetTop - 80;
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    // ========================================
    // CARD HOVER EFFECTS
    // ========================================
    function initCardEffects() {
        const cards = document.querySelectorAll('.feature-card, .about-card, .pricing-teaser-card');

        cards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = (y - centerY) / 20;
                const rotateY = (centerX - x) / 20;

                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
            });
        });
    }

    // ========================================
    // MAGNETIC CURSOR EFFECT
    // ========================================
    function initMagneticCursor() {
        if (window.innerWidth < 1024) return; // Desktop only

        const buttons = document.querySelectorAll('.cta-button');

        buttons.forEach(button => {
            button.addEventListener('mousemove', (e) => {
                const rect = button.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;

                button.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
            });

            button.addEventListener('mouseleave', () => {
                button.style.transform = 'translate(0, 0)';
            });
        });
    }

    // ========================================
    // SCROLL INDICATOR
    // ========================================
    function initScrollIndicator() {
        const indicator = document.querySelector('.scroll-indicator');
        if (!indicator) return;

        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 100) {
                indicator.style.opacity = '0';
                indicator.style.pointerEvents = 'none';
            } else {
                indicator.style.opacity = '1';
                indicator.style.pointerEvents = 'auto';
            }
        });
    }

    // ========================================
    // GRADIENT ORBS MOUSE FOLLOW
    // ========================================
    function initOrbTracking() {
        const orbs = document.querySelectorAll('.gradient-orb');
        let mouseX = 0;
        let mouseY = 0;

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        function moveOrbs() {
            orbs.forEach((orb, index) => {
                const speed = 0.02 + (index * 0.01);
                const currentX = parseFloat(orb.style.left) || 50;
                const currentY = parseFloat(orb.style.top) || 50;

                const targetX = (mouseX / window.innerWidth) * 100;
                const targetY = (mouseY / window.innerHeight) * 100;

                const newX = currentX + (targetX - currentX) * speed;
                const newY = currentY + (targetY - currentY) * speed;

                orb.style.left = newX + '%';
                orb.style.top = newY + '%';
            });

            requestAnimationFrame(moveOrbs);
        }

        moveOrbs();
    }

    // ========================================
    // SECTION WAVE DIVIDERS
    // ========================================
    function initWaveDividers() {
        const sections = document.querySelectorAll('.landing-section');

        sections.forEach((section, index) => {
            if (index === 0) return; // Skip first section

            const wave = document.createElement('div');
            wave.className = 'wave-divider';
            wave.innerHTML = `
                <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
                    <path d="M0,0 Q300,60 600,30 T1200,0 L1200,120 L0,120 Z" fill="currentColor"/>
                </svg>
            `;
            section.insertBefore(wave, section.firstChild);
        });
    }

    // ========================================
    // FEATURE CARD STAGGER
    // ========================================
    function initFeatureStagger() {
        const featureGrid = document.querySelector('.features-grid');
        if (!featureGrid) return;

        const cards = featureGrid.querySelectorAll('.feature-card');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    cards.forEach((card, index) => {
                        setTimeout(() => {
                            card.classList.add('revealed');
                        }, index * 150);
                    });
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.2 });

        observer.observe(featureGrid);
    }

    // ========================================
    // PERFORMANCE OPTIMIZATION
    // ========================================
    let ticking = false;
    let lastScrollY = 0;

    function optimizedScroll(callback) {
        lastScrollY = window.pageYOffset;

        if (!ticking) {
            window.requestAnimationFrame(() => {
                callback(lastScrollY);
                ticking = false;
            });

            ticking = true;
        }
    }

    // ========================================
    // INITIALIZE ALL EFFECTS
    // ========================================
    function init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        // Initialize all effects
        console.log('🚀 Initializing landing page effects...');

        initParticles();
        initTypingEffect();
        initCounters();
        initParallax();
        initScrollReveals();
        initSmoothScroll();
        initCardEffects();
        initMagneticCursor();
        initScrollIndicator();
        initOrbTracking();
        initFeatureStagger();

        // Add initial reveal class to hero elements
        setTimeout(() => {
            document.querySelectorAll('.landing-hero .scroll-reveal').forEach(el => {
                el.classList.add('revealed');
            });
        }, 300);

        console.log('✨ Landing page effects initialized');
    }

    // Start initialization
    init();

    // Prevent memory leaks
    window.addEventListener('beforeunload', () => {
        // Cleanup animations
        const canvas = document.getElementById('particles-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    });

})();
