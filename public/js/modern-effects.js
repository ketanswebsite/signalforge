/* ========================================
   SutrAlgo - Modern Effects JavaScript
   Custom Cursor, Scroll Progress, Animations
   ======================================== */

(function() {
    'use strict';

    // ========================================
    // SCROLL PROGRESS INDICATOR
    // ========================================
    function initScrollProgress() {
        const progressBar = document.createElement('div');
        progressBar.className = 'scroll-progress';
        progressBar.id = 'scrollProgress';
        document.body.appendChild(progressBar);

        window.addEventListener('scroll', () => {
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrolled = (window.pageYOffset / scrollHeight) * 100;
            progressBar.style.width = Math.min(scrolled, 100) + '%';
        });
    }

    // ========================================
    // CUSTOM CURSOR (Desktop Only)
    // ========================================
    function initCustomCursor() {
        // Only initialize on desktop
        if (window.innerWidth < 1024) return;

        const cursor = document.createElement('div');
        cursor.className = 'cursor';
        cursor.id = 'cursor';
        document.body.appendChild(cursor);

        let mouseX = 0, mouseY = 0;
        let cursorX = 0, cursorY = 0;

        // Track mouse position
        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        // Smooth cursor follow animation
        function animateCursor() {
            const speed = 0.15;
            cursorX += (mouseX - cursorX) * speed;
            cursorY += (mouseY - cursorY) * speed;
            cursor.style.left = cursorX + 'px';
            cursor.style.top = cursorY + 'px';
            requestAnimationFrame(animateCursor);
        }
        animateCursor();

        // Add hover effect to interactive elements
        const hoverElements = 'a, button, .card-interactive, .btn, input[type="button"], input[type="submit"], .metric-card, [role="button"]';

        document.addEventListener('mouseenter', (e) => {
            if (e.target.matches(hoverElements)) {
                cursor.classList.add('hover');
            }
        }, true);

        document.addEventListener('mouseleave', (e) => {
            if (e.target.matches(hoverElements)) {
                cursor.classList.remove('hover');
            }
        }, true);
    }

    // ========================================
    // INTERSECTION OBSERVER FOR ANIMATIONS
    // ========================================
    function initScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                }
            });
        }, observerOptions);

        // Observe elements with .scroll-reveal class
        // These elements should have opacity and transform set in CSS
        const elementsToAnimate = document.querySelectorAll('.scroll-reveal');
        elementsToAnimate.forEach(el => {
            observer.observe(el);
        });
    }

    // ========================================
    // STAGGER ANIMATION FOR CARDS
    // ========================================
    function initStaggerAnimation() {
        const cardGroups = document.querySelectorAll('.grid-2, .grid-3, .grid-4, .charts-grid, .statistics');

        cardGroups.forEach(group => {
            const cards = group.querySelectorAll('.card, .metric-card, .chart-card');

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        cards.forEach((card, index) => {
                            setTimeout(() => {
                                card.classList.add('revealed');
                            }, index * 100); // 100ms delay between each card
                        });
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });

            observer.observe(group);
        });
    }

    // ========================================
    // COUNTER ANIMATION FOR STATISTICS
    // ========================================
    function initCounterAnimation() {
        const animateCounter = (element, target, duration = 2000) => {
            const startTime = performance.now();
            const originalText = element.textContent;

            const updateCounter = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeOutQuart = 1 - Math.pow(1 - progress, 4);
                const currentValue = Math.floor(target * easeOutQuart);

                // Preserve formatting
                if (originalText.includes('%')) {
                    element.textContent = currentValue + '%';
                } else if (originalText.includes('+')) {
                    element.textContent = currentValue + '+';
                } else if (originalText.includes('$')) {
                    element.textContent = '$' + currentValue.toLocaleString();
                } else {
                    element.textContent = currentValue.toLocaleString();
                }

                if (progress < 1) {
                    requestAnimationFrame(updateCounter);
                }
            };

            requestAnimationFrame(updateCounter);
        };

        const statObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
                    entry.target.classList.add('counted');

                    const valueElement = entry.target.querySelector('.stat-value, .metric-value, .stat-number');

                    if (valueElement) {
                        const originalText = valueElement.textContent.trim();
                        const value = parseInt(originalText.replace(/[^0-9]/g, ''));

                        if (!isNaN(value) && value > 0) {
                            valueElement.setAttribute('data-original', originalText);
                            setTimeout(() => animateCounter(valueElement, value), 200);
                        }
                    }
                }
            });
        }, { threshold: 0.5 });

        const statElements = document.querySelectorAll('.stat-item, .metric-card, .stat-card');
        statElements.forEach(el => statObserver.observe(el));
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
                    const offsetTop = target.offsetTop - 100; // Account for fixed nav
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    // ========================================
    // NAVBAR SCROLL EFFECT
    // ========================================
    function initNavbarScroll() {
        const navbar = document.querySelector('.nav-bar, nav');
        if (!navbar) return;

        let lastScroll = 0;

        window.addEventListener('scroll', () => {
            const currentScroll = window.pageYOffset;

            // Add scrolled class when scrolled past 100px
            if (currentScroll > 100) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }

            lastScroll = currentScroll;
        });
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
        initScrollProgress();
        initCustomCursor();
        initScrollAnimations();
        initStaggerAnimation();
        initCounterAnimation();
        initSmoothScroll();
        initNavbarScroll();

        console.log('✨ Modern effects initialized');
    }

    // Start initialization
    init();

})();
