/* ========================================
   SutrAlgo - Animation Controller
   Reusable Background Animation System
   ======================================== */

(function() {
    'use strict';

    // Animation configuration presets
    const PRESETS = {
        full: {
            particles: {
                count: window.innerWidth < 768 ? 50 : 100,
                speed: 0.5,
                size: { min: 1, max: 3 },
                connectionDistance: 100,
                opacity: { min: 0.2, max: 0.7 }
            },
            orbs: {
                count: 3,
                mouseTracking: true,
                parallaxSpeed: 0.1
            },
            floatingElements: {
                count: 6
            }
        },
        reduced: {
            particles: {
                count: window.innerWidth < 768 ? 15 : 30,
                speed: 0.3,
                size: { min: 1, max: 2 },
                connectionDistance: 80,
                opacity: { min: 0.1, max: 0.4 }
            },
            orbs: {
                count: 2,
                mouseTracking: false,
                parallaxSpeed: 0.05
            },
            floatingElements: {
                count: 3
            }
        }
    };

    // ========================================
    // PARTICLE SYSTEM
    // ========================================
    class ParticleSystem {
        constructor(canvas, config) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.config = config;
            this.particles = [];
            this.animationId = null;

            this.init();
        }

        init() {
            this.resizeCanvas();
            this.createParticles();
            this.animate();

            window.addEventListener('resize', () => {
                this.resizeCanvas();
                this.createParticles();
            });
        }

        resizeCanvas() {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        }

        createParticles() {
            this.particles = [];
            for (let i = 0; i < this.config.count; i++) {
                this.particles.push({
                    x: Math.random() * this.canvas.width,
                    y: Math.random() * this.canvas.height,
                    size: Math.random() * (this.config.size.max - this.config.size.min) + this.config.size.min,
                    speedX: (Math.random() * this.config.speed - this.config.speed / 2),
                    speedY: (Math.random() * this.config.speed - this.config.speed / 2),
                    opacity: Math.random() * (this.config.opacity.max - this.config.opacity.min) + this.config.opacity.min
                });
            }
        }

        updateParticle(particle) {
            particle.x += particle.speedX;
            particle.y += particle.speedY;

            // Wrap around screen
            if (particle.x > this.canvas.width) particle.x = 0;
            if (particle.x < 0) particle.x = this.canvas.width;
            if (particle.y > this.canvas.height) particle.y = 0;
            if (particle.y < 0) particle.y = this.canvas.height;
        }

        drawParticle(particle) {
            this.ctx.fillStyle = `rgba(212, 175, 55, ${particle.opacity})`;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
        }

        drawConnections() {
            this.particles.forEach((p1, i) => {
                this.particles.slice(i + 1).forEach(p2 => {
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < this.config.connectionDistance) {
                        const opacity = 0.1 * (1 - distance / this.config.connectionDistance);
                        this.ctx.strokeStyle = `rgba(212, 175, 55, ${opacity})`;
                        this.ctx.lineWidth = 0.5;
                        this.ctx.beginPath();
                        this.ctx.moveTo(p1.x, p1.y);
                        this.ctx.lineTo(p2.x, p2.y);
                        this.ctx.stroke();
                    }
                });
            });
        }

        animate() {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            this.particles.forEach(particle => {
                this.updateParticle(particle);
                this.drawParticle(particle);
            });

            this.drawConnections();

            this.animationId = requestAnimationFrame(() => this.animate());
        }

        destroy() {
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
            }
            window.removeEventListener('resize', this.resizeCanvas);
        }
    }

    // ========================================
    // ORB TRACKER
    // ========================================
    class OrbTracker {
        constructor(orbs, config) {
            this.orbs = orbs;
            this.config = config;
            this.mouseX = 0;
            this.mouseY = 0;

            if (this.config.mouseTracking) {
                this.init();
            }
        }

        init() {
            document.addEventListener('mousemove', (e) => {
                this.mouseX = e.clientX;
                this.mouseY = e.clientY;
            });

            this.moveOrbs();
        }

        moveOrbs() {
            this.orbs.forEach((orb, index) => {
                const speed = 0.02 + (index * 0.01);
                const currentX = parseFloat(orb.style.left) || 50;
                const currentY = parseFloat(orb.style.top) || 50;

                const targetX = (this.mouseX / window.innerWidth) * 100;
                const targetY = (this.mouseY / window.innerHeight) * 100;

                const newX = currentX + (targetX - currentX) * speed;
                const newY = currentY + (targetY - currentY) * speed;

                orb.style.left = newX + '%';
                orb.style.top = newY + '%';
            });

            requestAnimationFrame(() => this.moveOrbs());
        }
    }

    // ========================================
    // PARALLAX CONTROLLER
    // ========================================
    class ParallaxController {
        constructor(orbs, floatingElements, config) {
            this.orbs = orbs;
            this.floatingElements = floatingElements;
            this.config = config;

            this.init();
        }

        init() {
            window.addEventListener('scroll', () => {
                const scrolled = window.pageYOffset;

                this.orbs.forEach((orb, index) => {
                    const speed = this.config.parallaxSpeed + (index * 0.05);
                    const yPos = -(scrolled * speed);
                    orb.style.transform = `translateY(${yPos}px)`;
                });

                this.floatingElements.forEach((element, index) => {
                    const speed = (this.config.parallaxSpeed / 2) + (index * 0.02);
                    const yPos = scrolled * speed;
                    element.style.transform = `translateY(${yPos}px)`;
                });
            });
        }
    }

    // ========================================
    // MAIN ANIMATION CONTROLLER
    // ========================================
    window.AnimationController = {
        particleSystem: null,
        orbTracker: null,
        parallaxController: null,

        /**
         * Initialize animations on the page
         * @param {string} intensity - 'full' or 'reduced'
         */
        init(intensity = 'full') {
            // Validate intensity
            if (!PRESETS[intensity]) {
                console.warn(`Invalid intensity "${intensity}". Using "full" instead.`);
                intensity = 'full';
            }

            const config = PRESETS[intensity];

            // Initialize particle system
            const canvas = document.getElementById('particles-canvas');
            if (canvas) {
                this.particleSystem = new ParticleSystem(canvas, config.particles);
                console.log(`✨ Particle system initialized (${intensity} mode)`);
            }

            // Initialize orb tracking
            const orbs = document.querySelectorAll('.gradient-orb');
            if (orbs.length > 0) {
                this.orbTracker = new OrbTracker(Array.from(orbs), config.orbs);
                console.log(`🌀 Orb tracking initialized (${intensity} mode)`);
            }

            // Initialize parallax scrolling
            const floatingElements = document.querySelectorAll('.floating-element');
            if (orbs.length > 0 || floatingElements.length > 0) {
                this.parallaxController = new ParallaxController(
                    Array.from(orbs),
                    Array.from(floatingElements),
                    config.orbs
                );
                console.log(`📜 Parallax scrolling initialized (${intensity} mode)`);
            }

            console.log(`🚀 Animation controller initialized in ${intensity} mode`);
        },

        /**
         * Destroy all animations and clean up
         */
        destroy() {
            if (this.particleSystem) {
                this.particleSystem.destroy();
            }
            // Note: OrbTracker and ParallaxController don't need explicit cleanup
            // as they use passive event listeners
            console.log('🧹 Animation controller destroyed');
        }
    };

})();
