# SignalForge - Design System & UI Components Documentation

**Last Updated:** January 2025
**Version:** 2.0 - Modern Design System Update
**Purpose:** Comprehensive design system and catalog of every UI component in SignalForge

---

# 🎨 DESIGN SYSTEM

## Color Palette

### Primary Colors
```css
--primary-dark: #0f0f0f          /* Deep black - primary backgrounds */
--secondary-dark: #1a1a1a        /* Charcoal - secondary backgrounds */
--concrete-grey: #2d2d2d         /* Medium dark grey - elevated surfaces */
--mid-grey: #5a5a5a              /* Neutral grey - disabled states */
--light-grey: #a0a0a0            /* Light grey - secondary text */
```

### Accent Colors
```css
--accent-blue: #3b82f6           /* Vibrant blue - primary actions */
--accent-steel: #64748b          /* Blue-grey - subtle accents */
--accent-gold: #f59e0b           /* Amber/Gold - highlights */
```

### Semantic Colors
```css
--success: #27ae60               /* Success states */
--success-light: #2ecc71         /* Success hover */
--danger: #e74c3c                /* Error/danger states */
--danger-dark: #c0392b           /* Danger hover */
--warning: #f39c12               /* Warning states */
--warning-dark: #e67e22          /* Warning hover */
--info: #4a90e2                  /* Info states */
```

### Neutral Colors
```css
--white: #ffffff                 /* Pure white */
--off-white: #fafafa            /* Light backgrounds */
--border-color: rgba(255, 255, 255, 0.08)  /* Subtle borders */
```

### Gradient Definitions
```css
/* Primary Gradient */
linear-gradient(135deg, var(--accent-blue), var(--accent-gold))

/* Dark Gradient */
linear-gradient(135deg, rgba(15, 15, 15, 0.95), rgba(26, 26, 26, 0.9))

/* Success Gradient */
linear-gradient(135deg, #27ae60, #2ecc71)

/* Danger Gradient */
linear-gradient(135deg, #e74c3c, #c0392b)
```

---

## Typography System

### Font Families
```css
/* Headings - Bold, Modern */
--font-heading: 'Syne', sans-serif;
font-weights: 600 (Semi-Bold), 700 (Bold), 800 (Extra Bold)

/* Body Text - Clean, Readable */
--font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
font-weights: 300 (Light), 400 (Regular), 500 (Medium), 600 (Semi-Bold), 700 (Bold)
```

### Type Scale
```css
/* Hero/Display */
--text-display: 4.5rem          /* 72px - Hero headings */
--text-hero: 3.5rem             /* 56px - Page titles */

/* Headings */
--text-h1: 2.5rem               /* 40px - Main section titles */
--text-h2: 2rem                 /* 32px - Subsection titles */
--text-h3: 1.7rem               /* 27px - Card titles */
--text-h4: 1.3rem               /* 21px - Small headings */

/* Body */
--text-large: 1.3rem            /* 21px - Large body text */
--text-body: 1rem               /* 16px - Default body */
--text-small: 0.95rem           /* 15px - Secondary text */
--text-tiny: 0.85rem            /* 14px - Captions */
```

### Line Heights
```css
--line-tight: 1.1               /* Hero text */
--line-heading: 1.3             /* Headings */
--line-normal: 1.6              /* Body text */
--line-relaxed: 1.9             /* Comfortable reading */
```

### Letter Spacing
```css
--tracking-tight: -2px          /* Display text */
--tracking-snug: -1px           /* Large headings */
--tracking-normal: 0            /* Body text */
--tracking-wide: 0.5px          /* Buttons, labels */
--tracking-wider: 1px           /* Badges, tags */
--tracking-widest: 2px          /* Section tags */
```

---

## Spacing System

### Base Unit: 0.25rem (4px)

```css
--space-0: 0                    /* 0px */
--space-1: 0.25rem              /* 4px */
--space-2: 0.5rem               /* 8px */
--space-3: 0.75rem              /* 12px */
--space-4: 1rem                 /* 16px */
--space-5: 1.5rem               /* 24px */
--space-6: 2rem                 /* 32px */
--space-8: 3rem                 /* 48px */
--space-10: 4rem                /* 64px */
--space-12: 6rem                /* 96px */
--space-16: 10rem               /* 160px */
```

### Common Use Cases
- **Micro spacing:** 4px-8px (between icons and text)
- **Component padding:** 16px-32px (cards, buttons)
- **Section spacing:** 64px-96px (between major sections)
- **Page margins:** 96px-160px (top/bottom of pages)

---

## Shadow System

```css
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.04)         /* Subtle elevation */
--shadow-md: 0 8px 30px rgba(0, 0, 0, 0.12)        /* Card elevation */
--shadow-lg: 0 20px 60px rgba(0, 0, 0, 0.15)       /* Modal elevation */
--shadow-xl: 0 30px 80px rgba(0, 0, 0, 0.5)        /* Hero images */

/* Special Shadows */
--shadow-glow: 0 10px 40px rgba(59, 130, 246, 0.3)  /* Blue glow */
--shadow-glow-hover: 0 15px 50px rgba(59, 130, 246, 0.5)
```

---

## Border Radius Scale

```css
--radius-sm: 8px                /* Small elements (badges) */
--radius: 12px                  /* Standard (inputs, buttons) */
--radius-md: 15px               /* Medium (cards) */
--radius-lg: 20px               /* Large (sections, images) */
--radius-xl: 30px               /* Extra large (major containers) */
--radius-full: 50px             /* Pill shape (CTAs) */
--radius-circle: 50%            /* Perfect circles */
```

---

## Animation & Transitions

### Timing Functions
```css
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1)    /* Standard easing */
--ease-in: cubic-bezier(0.4, 0, 1, 1)            /* Acceleration */
--ease-out: cubic-bezier(0, 0, 0.2, 1)           /* Deceleration */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)      /* Smooth */
```

### Duration Scale
```css
--duration-fast: 150ms          /* Micro-interactions */
--duration-normal: 300ms        /* Standard transitions */
--duration-slow: 400ms          /* Complex animations */
--duration-slower: 600ms        /* Page transitions */
```

### Common Animations
```css
/* Fade In Up */
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(50px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Fade In Right */
@keyframes fadeInRight {
    from {
        opacity: 0;
        transform: translateX(50px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

/* Pulse */
@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
}

/* Float */
@keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-20px); }
}

/* Shake and Scale (errors) */
@keyframes shakeAndScale {
    0% {
        transform: scale(0) rotate(0deg);
        opacity: 0;
    }
    50% {
        transform: scale(1.1) rotate(-5deg);
    }
    75% {
        transform: scale(0.9) rotate(5deg);
    }
    100% {
        transform: scale(1) rotate(0deg);
        opacity: 1;
    }
}

/* Scale In (success) */
@keyframes scaleIn {
    from {
        transform: scale(0);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}
```

---

## Component Patterns

### 1. Cards
```css
.card {
    background: var(--white);
    border-radius: var(--radius-lg);
    padding: 3.5rem;
    box-shadow: var(--shadow-md);
    border: 1px solid rgba(0, 0, 0, 0.05);
    transition: all 0.5s var(--ease-standard);
}

.card:hover {
    transform: translateY(-15px);
    box-shadow: var(--shadow-lg);
}

/* Dark variant */
.card-dark {
    background: var(--primary-dark);
    color: var(--white);
}

/* Glass morphism variant */
.card-glass {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid var(--border-color);
}
```

### 2. Buttons

```css
/* Primary Button */
.btn-primary {
    padding: 1.3rem 3rem;
    background: linear-gradient(135deg, var(--accent-blue), var(--accent-gold));
    color: var(--white);
    border-radius: var(--radius-full);
    font-weight: 700;
    font-size: 1.05rem;
    letter-spacing: var(--tracking-wide);
    box-shadow: var(--shadow-glow);
    transition: all 0.4s var(--ease-standard);
    position: relative;
    overflow: hidden;
}

.btn-primary::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s ease;
}

.btn-primary:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-glow-hover);
}

.btn-primary:hover::before {
    left: 100%;
}

/* Secondary Button */
.btn-secondary {
    padding: 1.3rem 3rem;
    background: transparent;
    color: var(--white);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-full);
    font-weight: 700;
    transition: all 0.4s var(--ease-standard);
}

.btn-secondary:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--accent-blue);
    transform: translateY(-4px);
}

/* Danger Button */
.btn-danger {
    background: linear-gradient(135deg, var(--danger), var(--danger-dark));
    /* Similar structure to primary */
}
```

### 3. Form Inputs

```css
.form-input {
    width: 100%;
    padding: 1.3rem 1.5rem;
    border: 2px solid rgba(0, 0, 0, 0.08);
    border-radius: var(--radius);
    font-size: 1rem;
    font-family: var(--font-body);
    background: var(--off-white);
    transition: all 0.3s var(--ease-standard);
}

.form-input:focus {
    outline: none;
    border-color: var(--accent-blue);
    background: var(--white);
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.08);
    transform: translateY(-2px);
}

.form-input::placeholder {
    color: var(--mid-grey);
}

/* Dark variant */
.form-input-dark {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--border-color);
    color: var(--white);
}
```

### 4. Badges & Tags

```css
.badge {
    display: inline-flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.7rem 1.8rem;
    background: rgba(59, 130, 246, 0.1);
    color: var(--accent-blue);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: var(--radius-full);
    font-size: var(--text-tiny);
    font-weight: 700;
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
}

.badge::before {
    content: '';
    width: 8px;
    height: 8px;
    background: var(--accent-blue);
    border-radius: var(--radius-circle);
    animation: pulse 2s ease-in-out infinite;
}

/* Success badge */
.badge-success {
    background: rgba(39, 174, 96, 0.1);
    color: var(--success);
    border-color: rgba(39, 174, 96, 0.2);
}

/* Warning badge */
.badge-warning {
    background: rgba(243, 156, 18, 0.1);
    color: var(--warning);
    border-color: rgba(243, 156, 18, 0.2);
}
```

### 5. Service/Feature Cards

```css
.service-card {
    background: var(--white);
    padding: 3.5rem;
    border-radius: var(--radius-lg);
    border: 1px solid rgba(0, 0, 0, 0.05);
    position: relative;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.5s var(--ease-standard);
}

/* Top accent line */
.service-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 6px;
    background: linear-gradient(90deg, var(--accent-blue), var(--accent-gold));
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.5s var(--ease-standard);
}

/* Radial background effect */
.service-card::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.05), transparent);
    transform: translate(-50%, -50%);
    transition: all 0.6s ease;
}

.service-card:hover::before {
    transform: scaleX(1);
}

.service-card:hover::after {
    width: 500px;
    height: 500px;
}

.service-card:hover {
    transform: translateY(-15px);
    box-shadow: var(--shadow-lg);
}

.service-icon {
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, var(--accent-blue), var(--accent-gold));
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 2.5rem;
    box-shadow: 0 10px 30px rgba(59, 130, 246, 0.2);
    transition: all 0.4s ease;
}

.service-card:hover .service-icon {
    transform: rotateY(180deg);
}
```

### 6. Statistics Cards

```css
.stat-card {
    text-align: center;
    padding: 3rem;
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(10px);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-color);
    transition: all 0.4s var(--ease-standard);
}

.stat-card:hover {
    background: rgba(255, 255, 255, 0.06);
    transform: translateY(-10px);
    border-color: rgba(59, 130, 246, 0.3);
}

.stat-number {
    font-family: var(--font-heading);
    font-size: 4rem;
    font-weight: 800;
    background: linear-gradient(135deg, var(--accent-blue), var(--accent-gold));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 1rem;
    letter-spacing: var(--tracking-tight);
}

.stat-label {
    color: var(--light-grey);
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: var(--tracking-wide);
}
```

### 7. Navigation Bar

```css
.navbar {
    position: fixed;
    width: 100%;
    background: rgba(15, 15, 15, 0.8);
    backdrop-filter: blur(20px) saturate(180%);
    padding: 1.5rem 0;
    transition: all 0.4s var(--ease-standard);
    border-bottom: 1px solid transparent;
    z-index: 1000;
}

.navbar.scrolled {
    padding: 1rem 0;
    background: rgba(15, 15, 15, 0.95);
    border-bottom: 1px solid var(--border-color);
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
}

.nav-link {
    color: var(--light-grey);
    font-weight: 600;
    font-size: 0.95rem;
    letter-spacing: var(--tracking-wide);
    position: relative;
    transition: all 0.3s var(--ease-standard);
}

.nav-link::before {
    content: '';
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%) scaleX(0);
    width: 100%;
    height: 2px;
    background: linear-gradient(90deg, var(--accent-blue), var(--accent-gold));
    transition: transform 0.4s var(--ease-standard);
}

.nav-link:hover {
    color: var(--white);
}

.nav-link:hover::before {
    transform: translateX(-50%) scaleX(1);
}
```

### 8. Modals/Dialogs

```css
.dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(15, 15, 15, 0.9);
    backdrop-filter: blur(10px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s var(--ease-standard);
}

.dialog-overlay.active {
    opacity: 1;
    pointer-events: all;
}

.dialog-content {
    background: var(--white);
    border-radius: var(--radius-xl);
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow: auto;
    box-shadow: var(--shadow-xl);
    transform: scale(0.9) translateY(50px);
    opacity: 0;
    transition: all 0.4s var(--ease-standard);
}

.dialog-overlay.active .dialog-content {
    transform: scale(1) translateY(0);
    opacity: 1;
}
```

---

## Effects Library

### Glass Morphism
```css
.glass {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid var(--border-color);
}

.glass-dark {
    background: rgba(15, 15, 15, 0.7);
    backdrop-filter: blur(20px);
}
```

### Gradient Text
```css
.gradient-text {
    background: linear-gradient(135deg, var(--accent-blue), var(--accent-gold));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    display: inline-block;
}
```

### Shine Effect (on hover)
```css
.shine {
    position: relative;
    overflow: hidden;
}

.shine::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s ease;
}

.shine:hover::before {
    left: 100%;
}
```

### Floating Animation
```css
.floating {
    animation: float 6s ease-in-out infinite;
}
```

### Parallax Effect
```css
.parallax {
    transform: translateY(calc(var(--scroll) * 0.3px));
    opacity: calc(1 - (var(--scroll) / 800));
}
```

---

## Grid & Layout Systems

### Standard Container
```css
.container {
    max-width: 1600px;
    margin: 0 auto;
    padding: 0 4rem;
}

@media (max-width: 968px) {
    .container {
        padding: 0 1.5rem;
    }
}
```

### Grid Patterns
```css
/* 2-Column Grid */
.grid-2 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 3rem;
}

/* 3-Column Grid */
.grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3rem;
}

/* 4-Column Grid */
.grid-4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 3rem;
}

/* Auto-fit Grid (responsive) */
.grid-auto {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 3rem;
}

/* Responsive breakpoints */
@media (max-width: 1200px) {
    .grid-3, .grid-4 {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 768px) {
    .grid-2, .grid-3, .grid-4 {
        grid-template-columns: 1fr;
        gap: 2rem;
    }
}
```

---

## Responsive Breakpoints

```css
/* Mobile First Approach */
--breakpoint-sm: 640px     /* Small devices */
--breakpoint-md: 768px     /* Tablets */
--breakpoint-lg: 1024px    /* Laptops */
--breakpoint-xl: 1280px    /* Desktops */
--breakpoint-2xl: 1536px   /* Large desktops */

@media (max-width: 640px) {
    /* Mobile styles */
}

@media (min-width: 641px) and (max-width: 968px) {
    /* Tablet styles */
}

@media (min-width: 969px) {
    /* Desktop styles */
}
```

---

## Special Effects

### Scroll Progress Indicator
```css
.scroll-progress {
    position: fixed;
    top: 0;
    left: 0;
    width: 0%;
    height: 3px;
    background: linear-gradient(90deg, var(--accent-blue), var(--accent-gold));
    z-index: 10000;
    transition: width 0.1s ease;
}
```

### Custom Cursor (Desktop only)
```css
.cursor {
    width: 20px;
    height: 20px;
    border: 2px solid var(--accent-blue);
    border-radius: 50%;
    position: fixed;
    pointer-events: none;
    z-index: 9999;
    transition: all 0.15s ease;
}

@media (min-width: 1024px) {
    .cursor {
        display: block;
    }
}

.cursor.hover {
    transform: scale(1.8);
    background: rgba(59, 130, 246, 0.1);
}
```

### Pattern Background
```css
.pattern-bg {
    background-image:
        linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
    background-size: 50px 50px;
    animation: movePattern 20s linear infinite;
}

@keyframes movePattern {
    0% { transform: translate(0, 0); }
    100% { transform: translate(50px, 50px); }
}
```

---

## 📋 PHASED IMPLEMENTATION PLAN

### Phase 1: Foundation & Core Components (Week 1-2)
**Objective:** Establish design system foundation and update global styles

#### Week 1: Design Tokens & Global Styles
- [ ] Create `design-system.css` with all CSS variables
- [ ] Update color palette across all pages
- [ ] Implement typography system (Syne + Inter fonts)
- [ ] Set up spacing and shadow systems
- [ ] Create animation library
- [ ] Update global reset and base styles

#### Week 2: Core Components
- [ ] **Navigation Bar**
  - Glass morphism effect
  - Gradient underline on hover
  - Smooth scroll behavior
  - Logo animation

- [ ] **Button System**
  - Primary (gradient with shine effect)
  - Secondary (outline)
  - Danger (red gradient)
  - Success (green gradient)
  - All hover states and animations

- [ ] **Form Inputs**
  - Standard text inputs
  - Textareas
  - Select dropdowns
  - Checkboxes & radio buttons
  - Focus states with blue glow

- [ ] **Card Components**
  - Standard card
  - Glass morphism card
  - Service card with hover effects
  - Stat card with gradient text

- [ ] **Badges & Tags**
  - Status badges
  - Category tags
  - Animated dot indicators

**Deliverables:**
- `design-system.css` (complete)
- `components.css` (buttons, cards, forms)
- `animations.css` (all keyframes)
- Updated documentation

---

### Phase 2: Core Pages (Week 3-4)
**Objective:** Apply new design system to main user-facing pages

#### Week 3: Main Dashboard & Trading Pages
- [ ] **index.html (Main Backtester)**
  - Hero section with gradient text
  - Parameter controls with new form styles
  - Results cards with stat card design
  - Chart containers with glass morphism
  - Trade history table with hover effects
  - Floating action buttons

- [ ] **trades.html (Signal Management)**
  - Filter bar with new button styles
  - Signal cards with service card pattern
  - Closed trades table upgrade
  - Modal dialogs with blur backdrop
  - Summary stat cards

#### Week 4: Pricing & Account Pages
- [ ] **pricing.html (Subscription Plans)**
  - Pricing cards with hover lifts
  - Gradient CTAs
  - Feature comparison table redesign
  - FAQ accordion with smooth animations
  - Trust indicators section

- [ ] **account.html (User Dashboard)**
  - Profile card with glass effect
  - Subscription status with badges
  - Settings forms with new inputs
  - Activity feed with timeline design
  - Payment method cards

**Deliverables:**
- 4 fully redesigned pages
- Mobile responsive implementations
- Cross-browser tested
- Performance optimized

---

### Phase 3: Extended Pages & Polish (Week 5-6)
**Objective:** Complete remaining pages and final optimization

#### Week 5: Admin & Tools
- [ ] **admin-v2.html (Admin Portal)**
  - Sidebar with gradient accents
  - Dashboard cards with stats
  - All admin tables
  - Modal confirmations
  - Charts with new color scheme

- [ ] **portfolio-backtest.html**
  - Configuration panel
  - Results visualization
  - Analytics dashboard tabs
  - Trade tables
  - Export functionality styling

#### Week 6: Supporting Pages & Polish
- [ ] **login.html**
  - Centered card layout
  - Google OAuth button
  - Gradient background
  - Loading states

- [ ] **checkout.html**
  - Stripe form styling
  - Plan summary card
  - Trial banner
  - Payment flow indicators

- [ ] **checkout-success.html & checkout-failure.html**
  - Icon animations
  - Status cards
  - Action buttons

- [ ] **data-management.html**
  - GDPR sections
  - Action cards
  - Warning boxes
  - Confirmation dialogs

- [ ] **telegram-subscribe.html**
  - Step-by-step cards
  - CTA buttons
  - OAuth linking section
  - Benefit cards

#### Final Polish
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsiveness check (all breakpoints)
- [ ] Performance optimization
  - Lazy loading
  - Animation performance
  - Bundle size reduction
- [ ] Accessibility audit
  - ARIA labels
  - Keyboard navigation
  - Screen reader testing
  - Color contrast validation
- [ ] Documentation updates
- [ ] Deployment to staging
- [ ] User acceptance testing

**Deliverables:**
- All 11+ pages redesigned
- Complete design system documentation
- Performance report
- Accessibility compliance report
- Production deployment

---

## Implementation Guidelines

### CSS Organization
```
styles/
├── design-system.css       /* All CSS variables */
├── base.css                /* Reset, typography */
├── animations.css          /* Keyframes, transitions */
├── components.css          /* Reusable components */
├── layouts.css             /* Grid, container systems */
├── utilities.css           /* Utility classes */
└── pages/
    ├── index.css           /* Page-specific styles */
    ├── trades.css
    ├── pricing.css
    └── ...
```

### Naming Conventions
- **BEM Methodology** for components: `.block__element--modifier`
- **Utility classes:** `.u-margin-top-4`, `.u-text-center`
- **State classes:** `.is-active`, `.is-loading`, `.is-visible`

### Performance Considerations
- Use `will-change` sparingly for animated elements
- Implement CSS containment where appropriate
- Lazy load non-critical styles
- Minimize animation frame drops
- Use `transform` and `opacity` for animations (GPU-accelerated)

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile: iOS 14+, Android Chrome 90+

---

# 📦 UI COMPONENTS CATALOG

## Table of Contents
1. [Common/Shared Components](#commonshared-components)
2. [index.html - Main Backtester Dashboard](#indexhtml---main-backtester-dashboard)
3. [trades.html - Signal Management](#tradeshtml---signal-management)
4. [login.html - Authentication](#loginhtml---authentication)
5. [pricing.html - Subscription Plans](#pricinghtml---subscription-plans)
6. [checkout.html - Payment Processing](#checkouthtml---payment-processing)
7. [account.html - Account Management](#accounthtml---account-management)
8. [admin-v2.html - Admin Portal](#admin-v2html---admin-portal)
9. [portfolio-backtest.html - Portfolio Simulator](#portfolio-backtesthtml---portfolio-simulator)
10. [data-management.html - GDPR/Data Management](#data-managementhtml---gdprdata-management)
11. [telegram-subscribe.html - Telegram Integration](#telegram-subscribehtml---telegram-integration)
12. [checkout-success.html - Success Page](#checkout-successhtml---success-page)
13. [checkout-failure.html - Failure Page](#checkout-failurehtml---failure-page)

---

## Common/Shared Components

These components appear across multiple pages:

### Navigation & Header Components
- **Unified Navigation Bar** (`unified-navbar.js`, `unified-navbar.css`)
  - **New Design:** Glass morphism background, gradient logo accent
  - Logo/Brand link with pulse animation
  - Page navigation links with gradient underline on hover
  - User profile dropdown
  - Theme toggle button
  - Responsive mobile menu (slide-in)
  - **Colors:** Background: `rgba(15, 15, 15, 0.8)` with blur
  - **Animation:** Shrinks on scroll, border-bottom appears

- **Page Header**
  - Page title (`<h1 class="nav-title">`) - Font: Syne, 2.5rem
  - Subtitle/description (`<p class="app-description">`) - Font: Inter, 1.2rem, light grey
  - Navigation breadcrumbs

### Theme & Display
- **Dark Mode Toggle Button** (`theme-toggle.js`)
  - **New Design:** Floating button with gradient border
  - Sun icon (light mode indicator)
  - Moon icon (dark mode indicator)
  - Position: bottom-right corner with `position: fixed`
  - Smooth rotation transition between states

### Legal & Compliance
- **Legal Footer** (`<footer class="legal-footer">`)
  - **New Design:** Dark gradient background
  - 4-column grid layout
  - Social links with gradient hover
  - Terms of Service link
  - Privacy Policy link
  - Copyright notice
  - Disclaimer text

- **Cookie Consent Banner** (`cookie-consent.js`)
  - **New Design:** Glass morphism card
  - Cookie notice modal
  - Gradient Accept button
  - Outline Reject button
  - Cookie preferences settings

---

## index.html - Main Backtester Dashboard

**Purpose:** DTI (Daily Trading Indicator) backtesting tool with interactive charts and trade simulation

**New Design Features:**
- Hero section with gradient overlay
- Glass morphism cards for controls
- Animated metric cards
- Gradient accent lines on charts

### Header Components
1. **Page Navigation Bar**
   - **Design:** `background: linear-gradient(135deg, var(--primary-dark), var(--secondary-dark))`
   - Title: "SignalForge DTI Backtest Dashboard" - Font: Syne, 3.5rem
   - Description text - Font: Inter, 1.2rem
   - Navigation buttons with gradient on hover

2. **Legal Disclaimer Box** (`<div class="legal-disclaimer">`)
   - **Design:** Warning color border-left, light background
   - Warning icon with amber color
   - UK regulatory compliance text
   - Educational purposes disclaimer

### Main Control Panel (Card)
3. **Symbol/Stock Search Section**
   - **Design:** Glass morphism card with blue glow on focus
   - **Market Selector** (`<select id="market-select">`)
     - Custom dropdown with gradient selected state
     - Options: India, UK, US
   - **Symbol/Stock Dropdown** (`<select id="symbol-select">`)
     - Dynamically populated
     - Search functionality
     - Flag icons for markets

4. **Parameters Configuration**
   - **Design:** Two-column grid on desktop

   - **Buy Threshold Slider** (`<input type="range" id="buy-threshold">`)
     - Custom track with gradient fill
     - Range: 0-100, Default: 45
     - Real-time value display with badge
     - Blue accent color

   - **Sell Threshold Slider** (`<input type="range" id="sell-threshold">`)
     - Custom track with gradient fill
     - Range: 0-100, Default: 90
     - Gold accent color

   - **Position Management Toggles**
     - Custom checkbox design with gradient check
     - Hold when DTI is above checkbox
     - Enable trailing stop checkbox
     - Trailing stop percentage input

5. **Action Buttons**
   - **Run Backtest Button** (`<button id="run-backtest-btn" class="btn-primary">`)
     - Gradient background (blue to gold)
     - Play icon (SVG)
     - Shine effect on hover
     - Loading spinner state

   - **Add to Portfolio Button**
     - Secondary style (outline)
     - Bookmark icon

### Results Section (Shows after backtest runs)
6. **Performance Metrics Grid** (`<div class="metrics-grid">`)
   - **Design:** 3-column grid, glass morphism cards
   - Counter animation on load

   - **Total Return Card**
     - Large gradient number
     - Percentage badge
     - Arrow indicator (up/down)
     - Color-coded: green (profit) / red (loss)

   - **Number of Trades Card**
     - Count display
     - Win/loss breakdown with mini chart

   - **Win Rate Card**
     - Percentage with circular progress
     - Historical comparison line

   - **Max Drawdown Card**
     - Percentage in red gradient
     - Date label
     - Warning icon

   - **Sharpe Ratio Card**
     - Numeric value
     - Info tooltip

   - **Average Hold Time Card**
     - Days display
     - Calendar icon

7. **Interactive Charts** (Chart.js powered)
   - **New Color Scheme:** Blue (#3b82f6) and Gold (#f59e0b)

   - **Portfolio Value Chart** (`<canvas id="portfolio-value-chart">`)
     - Line chart with gradient fill
     - Buy signals: green dots
     - Sell signals: red dots
     - Tooltip with date/value
     - Zoom/pan controls
     - Grid lines: subtle white

   - **DTI Indicator Chart** (`<canvas id="dti-chart">`)
     - Line chart with threshold bands
     - Buy zone: green background (0-45)
     - Sell zone: red background (90-100)
     - Gradient line color

   - **Drawdown Chart** (`<canvas id="drawdown-chart">`)
     - Area chart with red gradient
     - Shows underwater periods

8. **Trade History Table** (`<table id="trade-history-table">`)
   - **Design:** Hover row highlight, sortable headers
   - **Columns:**
     - Entry Date (with calendar icon)
     - Entry Price (formatted currency)
     - Exit Date
     - Exit Price
     - Return % (colored badge)
     - Hold Days (with day counter)
     - Entry DTI (progress bar)
     - Exit DTI (progress bar)
   - **Features:**
     - Sort by column (arrow indicators)
     - Expandable rows for details
     - Color-coded P/L values
     - Pagination at bottom

### Advanced Settings Modal
9. **Advanced Settings Dialog** (`<div class="dialog" id="advanced-settings">`)
   - **Design:** Blur backdrop, centered card with shadow

   - **Commission/Fee Inputs**
     - Percentage slider
     - Fixed fee number input

   - **Slippage Settings**
     - Percentage input with info tooltip

   - **Position Sizing**
     - Initial capital with currency selector
     - Position size percentage slider

   - **Time Period Selection**
     - Start date picker (custom styled)
     - End date picker

   - **Save/Cancel Buttons**
     - Save: primary gradient
     - Cancel: outline secondary

### Notifications & Alerts
10. **Notification Container** (`<div id="notification-container">`)
    - **Design:** Toast notifications, top-right position
    - Success: green gradient
    - Error: red gradient
    - Warning: amber gradient
    - Info: blue gradient
    - Slide-in animation
    - Auto-dismiss after 5 seconds
    - Close button with X icon

### Loading States
11. **Loading Spinner** (`<div class="spinner">`)
    - **Design:** Circular gradient spinner
    - Blue to gold colors
    - Overlay with blur backdrop
    - "Calculating..." text
    - Smooth rotation animation

---

## trades.html - Signal Management

**Purpose:** View and manage trading signals, track live trades, and access trade history

**New Design Features:**
- Signal cards with service card pattern
- Stat badges with gradient text
- Interactive table with smooth hover
- Filter bar with glass morphism

### Header
1. **Page Header**
   - Title: "Signal Management & Trade Tracking" - Syne, 3.5rem
   - Description with gradient accent words

### Filter & Control Bar
2. **Filter Controls** (`<div class="filter-bar">`)
   - **Design:** Glass morphism bar, sticky on scroll

   - **Market Filter** (`<select id="market-filter">`)
     - Custom dropdown with flags
     - All Markets / India / UK / US

   - **Status Filter** (`<select id="status-filter">`)
     - Badge-style options
     - All / Active / Closed / Pending

   - **Date Range Picker**
     - Two inputs side-by-side
     - Custom calendar icon

   - **Search Box** (`<input type="text" id="search-box">`)
     - Magnifying glass icon
     - Blue glow on focus
     - Autocomplete suggestions

   - **Refresh Button** (`<button id="refresh-signals">`)
     - Rotating refresh icon
     - Circular shape
     - Pulse animation when loading

3. **Action Buttons Row**
   - **Export CSV Button**
     - Download icon, secondary style
   - **Run Scanner Button**
     - Radar icon, primary gradient
   - **View Analytics Button**
     - Chart icon, outline style

### Active Signals Section
4. **Active Signals Grid** (`<div class="signals-grid">`)
   - **Design:** 3-column grid (responsive to 1 on mobile)

   **Signal Card** (`<div class="signal-card">`)
   - **New Design:** Service card pattern with hover lift
   - **Structure:**

     **Header**
     - Symbol badge (gradient background)
     - Company name (Syne font)
     - Market flag icon
     - Favorite star (toggleable)

     **Price Information**
     - Current price (large, bold)
     - Entry price (smaller, grey)
     - Price change % (colored badge with arrow)

     **DTI Indicators**
     - Daily DTI: circular progress gauge
     - Weekly DTI: circular progress gauge
     - Trend arrow (gradient)
     - Tooltips on hover

     **Performance Metrics**
     - P/L percentage (gradient number)
     - P/L value in currencies
     - Days in position with clock icon

     **Signal Strength Badge**
     - High: green gradient
     - Medium: amber
     - Low: red gradient
     - Pulsing dot indicator

     **Historical Statistics**
     - 5-year win rate (progress bar)
     - Average return
     - Signal count

     **Action Buttons**
     - View Details (eye icon)
     - Close Position (red, X icon)
     - Add Note (note icon)

### Closed Trades Section
5. **Closed Trades Table** (`<table id="closed-trades-table" class="trades-table">`)
   - **New Design:** Zebra striping, hover row highlight

   - **Headers:** (with sort arrows)
     - Symbol (with icon)
     - Entry Date
     - Exit Date
     - Entry Price
     - Exit Price
     - Hold Duration (days badge)
     - P/L % (colored)
     - P/L Value
     - Win Rate
     - Exit Reason (badge)

   - **Features:**
     - Sortable by clicking headers
     - Gradient on hover
     - Expandable rows (click to expand)
     - Color-coded P/L

6. **Pagination Controls** (`<div class="pagination">`)
   - **Design:** Button group style
   - Previous/Next with arrows
   - Page numbers (active has gradient)
   - Items per page dropdown

### Signal Details Modal
7. **Signal Details Dialog** (`<div class="dialog" id="signal-details">`)
   - **Design:** Large modal, blur backdrop

   - **Header**
     - Symbol and company name
     - Status badge
     - Close button (X, top-right)

   - **Tabbed Content**
     **Overview Tab**
     - 2-column layout
     - Market data card
     - Entry details card
     - Performance mini chart

     **DTI History Tab**
     - Line chart showing DTI over time
     - Signal trigger annotations
     - Zoom controls

     **Notes Tab**
     - Rich text editor
     - Save/Cancel buttons
     - Timestamp on notes

   - **Action Footer**
     - Close position (danger gradient)
     - Edit alert (secondary)
     - Delete signal (danger outline)

### Statistics Summary Cards
8. **Summary Cards Row** (`<div class="summary-cards">`)
   - **Design:** 4 stat cards, glass morphism

   - **Active Positions Card**
     - Gradient count number
     - Icon
     - Total exposure value

   - **Today's Signals Card**
     - New signals count
     - High conviction badge

   - **Performance Card**
     - Win rate circular progress
     - Average return

   - **Alerts Card**
     - Count with badge
     - Triggered today indicator

---

## login.html - Authentication

**Purpose:** User authentication via Google OAuth

**New Design Features:**
- Centered card with blur backdrop
- Gradient logo
- Smooth transition animations

### Login Container
1. **Login Card** (`<div class="login-card">`)
   - **Design:** Centered, glass morphism, max-width 500px
   - Drop shadow with blue glow

   - **Logo Section**
     - SignalForge logo with gradient
     - Pulse animation
     - App tagline below

   - **Welcome Message**
     - "Welcome to SignalForge" - Syne, 2rem
     - Subtitle - Inter, light grey

   - **Google Sign-In Button** (`<button id="google-signin-btn">`)
     - Google logo icon (SVG)
     - "Sign in with Google" text
     - White background
     - Shadow on hover
     - Smooth lift animation

   - **Divider Line**
     - "OR" text in center
     - Horizontal lines on sides

   - **Guest Access Link**
     - "Continue as Guest" button (outline)
     - Lock icon
     - Limited features note below

   - **Legal Links**
     - Terms and Privacy (small, grey)
     - Hover: gradient color

   - **Features List**
     - 4 items with checkmark icons
     - Gradient checkmarks
     - Feature benefits

2. **Loading Overlay** (`<div class="loading-overlay">`)
   - Blur backdrop
   - Gradient spinner
   - "Signing you in..." text
   - Fade-in animation

---

## pricing.html - Subscription Plans

**Purpose:** Display pricing tiers and subscription options

**New Design Features:**
- Hover lift on cards
- Gradient CTAs
- Animated feature comparison

### Header Section
1. **Pricing Header**
   - **Design:** Centered, gradient text on heading
   - Main heading: "Choose Your Plan" - Syne, 3.5rem
   - Subtitle with gradient keywords

2. **Billing Toggle** (`<div class="billing-toggle">`)
   - **Design:** Pill switch with gradient background
   - Monthly / Annual buttons
   - "Save 17%" badge on annual
   - Smooth slide animation

### Pricing Cards Grid
3. **Pricing Cards Container** (`<div class="pricing-grid">`)
   - **Design:** 3-column grid (responsive)

   **Free Tier Card** (`<div class="pricing-card">`)
   - **Design:** White card, subtle shadow
   - Border: thin grey
   - Hover: slight lift

   - **Header**
     - "Free" badge (blue outline)
     - Icon
   - **Price Display**
     - £0/month (Syne, large)
     - "Forever free" subtitle
   - **Features List**
     - Checkmarks (blue) for included
     - X marks (grey) for not included
     - 7 items
   - **CTA Button**
     - "Get Started Free" (secondary)
     - Arrow icon

   **Professional Tier Card** (`<div class="pricing-card featured">`)
   - **Design:** Blue glow, gradient border
   - "Most Popular" ribbon (top-right)
   - Hover: lift + stronger glow

   - **Header**
     - "Professional" badge (gradient)
     - Star icon
   - **Price Display**
     - £29/month or £290/year
     - "Save 17%" badge (green)
     - "90-day free trial" banner
   - **Features List**
     - All checkmarks (gradient)
     - 10 items (all included)
   - **CTA Button**
     - "Start Free Trial" (gradient primary)
     - Shine effect on hover
     - Prominent size

   **Enterprise Tier Card** (`<div class="pricing-card">`)
   - **Design:** Similar to Free tier

   - **Header**
     - "Enterprise" badge
     - Building icon
   - **Price Display**
     - "Custom Pricing"
     - "Contact us" subtitle
   - **Features List**
     - Checkmarks + plus icons
     - 8 items
   - **CTA Button**
     - "Contact Sales" (secondary)
     - Phone icon

### Feature Comparison Section
4. **Comparison Table** (`<table class="comparison-table">`)
   - **Design:** Sticky header, zebra rows

   - **Columns:**
     - Feature name (left-aligned)
     - Free (center icon)
     - Professional (center icon)
     - Enterprise (center icon)

   - **Feature Groups:**
     - Trading Signals (blue accent)
     - Backtesting (gold accent)
     - Notifications (green accent)
     - Support (purple accent)

   - **Icons:**
     - Checkmark: gradient green
     - X mark: light grey
     - Tooltips on hover for details

### FAQ Section
5. **FAQ Accordion** (`<div class="faq-section">`)
   - **Design:** Card style, gradient border-left on active

   - **FAQ Items** (8 items)
     - Question: bold, Syne font
     - Click to expand/collapse
     - Chevron rotates on expand
     - Answer: slide-down animation
     - Content: Inter font, grey text

   - **Topics:**
     - Trial details
     - Cancellation policy
     - Payment methods
     - Refund policy
     - Feature access
     - Data security
     - Support availability
     - Upgrade process

### Trust Indicators
6. **Trust Section** (`<div class="trust-indicators">`)
   - **Design:** Light background section

   - **Security Badges**
     - SSL badge
     - Stripe logo
     - GDPR compliant badge

   - **Testimonials Carousel**
     - 3 visible at once
     - Auto-scroll
     - Quote cards with gradient border
     - 5-star rating (gold stars)
     - User avatar (gradient circle)
     - Name and role

   - **Statistics**
     - 3 stat cards
     - Animated counters
     - Icons
     - "1000+ users", "50k+ trades", "98% satisfaction"

---

## checkout.html - Payment Processing

**Purpose:** Stripe payment integration and subscription setup

**New Design Features:**
- Stripe Elements with custom styling
- Progress indicators
- Security badges

### Checkout Container
1. **Checkout Form** (`<form id="payment-form">`)
   - **Design:** 2-column layout (plan summary | payment form)

   **Plan Summary Card** (`<div class="plan-summary">`)
   - **Design:** Sticky sidebar, glass morphism

   - **Selected Plan**
     - Plan name with badge
     - Icon
     - Features list (checkmarks)

   - **Price Breakdown**
     - Subtotal
     - Discount line (if applicable, green)
     - Tax/VAT (calculated)
     - Divider line
     - Total (large, bold)

   - **Billing Frequency**
     - Monthly/Annual badge

2. **Payment Details Section**
   - **Design:** White card, form styling

   **Card Information** (`<div id="card-element">`)
   - Stripe Card Element (custom styled)
   - Matches design system colors
   - Blue focus glow
   - Error messages below (red)

3. **Billing Information Form**
   - **Design:** 2-column grid for name/email

   - Name input (full width on mobile)
   - Email input
   - Country selector (with flags)
   - Postal code
   - All inputs: standard form style

4. **Trial Information Banner** (`<div class="trial-info">`)
   - **Design:** Blue gradient background
   - Clock icon
   - "90-Day Free Trial" heading
   - "No charge until [date]" text
   - Info icon tooltip

5. **Terms & Conditions**
   - Custom checkbox (gradient check)
   - Label with links
   - Error state: red border

6. **Payment Actions**
   - **Subscribe Button** (`<button id="submit-payment">`)
     - Full width
     - Primary gradient
     - "Start Free Trial" text
     - Loading spinner (replaces text)
     - Disabled state: grey

   - **Back Button**
     - Link style, arrow icon
     - "Back to Pricing"

   - **Security Icons**
     - Lock icon
     - "Secured by Stripe" text
     - SSL badge

7. **Payment Processing Overlay**
   - **Design:** Full-screen blur
   - Large spinner (gradient)
   - "Processing payment..." text
   - "Please don't close this page" warning
   - Progress bar animation

---

## account.html - Account Management

**Purpose:** User profile, subscription management, and account settings

**New Design Features:**
- Tabbed interface with smooth transitions
- Profile card with gradient border
- Activity timeline with icons

### Profile Section
1. **Profile Card** (`<div class="profile-card">`)
   - **Design:** Glass morphism, gradient border-top

   - **Avatar**
     - Large circle (120px)
     - Gradient border
     - Upload on hover (overlay with icon)

   - **User Info**
     - Name (Syne, 1.5rem)
     - Email (grey)
     - Member since (badge)
     - Account ID (monospace, small)

   - **Edit Button**
     - Outline style
     - Pencil icon

2. **Edit Profile Modal**
   - **Design:** Standard modal
   - Form fields for name, email, phone, timezone
   - Save/Cancel buttons

### Subscription Management
3. **Subscription Status Card** (`<div class="subscription-card">`)
   - **Design:** Large card, gradient accent

   - **Plan Display**
     - Plan name badge (gradient)
     - Status indicator (dot + text)
     - Plan icon

   - **Details Grid**
     - Next billing date
     - Amount (large)
     - Payment method (card icon + last 4)

   - **Trial Countdown** (if trial)
     - Days remaining (large number)
     - Progress bar
     - End date

   - **Actions**
     - Change Plan (primary)
     - Cancel Subscription (danger outline)
     - Update Payment (secondary)

4. **Payment Method Section**
   - **Design:** Card display with brand icon

   - **Current Card**
     - Visa/Mastercard logo
     - •••• •••• •••• 1234
     - Expiry date
     - "Default" badge

   - **Update Button**
     - Opens Stripe modal

5. **Billing History Table**
   - **Design:** Simple table, hover highlight

   - **Columns:**
     - Date
     - Description
     - Amount
     - Status (badge)
     - Invoice (download icon)

   - Pagination if needed

### Settings Section
6. **Notification Preferences**
   - **Design:** Toggle switches with gradient

   - Email notifications (3 toggles)
   - Telegram settings
   - SMS settings (Pro only badge)

   - Save button at bottom

7. **Trading Preferences**
   - **Design:** Form card

   - Default market (radio buttons with flags)
   - Signal threshold slider (blue gradient)
   - Auto-close settings (checkboxes)

   - Save button

8. **Data & Privacy**
   - **Design:** Simple card with action buttons

   - Export data button (download icon)
   - Privacy settings link
   - Delete account button (danger, bottom)

### Activity Log
9. **Recent Activity Feed**
   - **Design:** Timeline style, left border

   - **Activity Items:**
     - Timestamp (relative)
     - Icon (gradient circle)
     - Description text
     - Detail link

   - Events: login, subscription changes, signals, settings

### Security Section
10. **Security Settings**
    - **Design:** Card with sections

    - **Connected Accounts**
      - Google badge
      - Connected date
      - Disconnect button

    - **2FA** (future)
      - Enable button
      - Status indicator

    - **Active Sessions**
      - Device list
      - Location with flag
      - Last active time
      - Revoke button (per session)

---

## admin-v2.html - Admin Portal

**Purpose:** Comprehensive admin dashboard for system management

**New Design Features:**
- Sidebar with gradient accent bar
- Stat cards with animated counters
- Data tables with interactive filters

### Layout
1. **Admin Container** (`<div class="admin-container">`)
   - **Design:** Sidebar + main content layout
   - Dark theme throughout

### Sidebar Navigation
2. **Admin Sidebar** (`<aside class="admin-sidebar">`)
   - **Design:** Fixed, dark background, gradient accent

   - **Logo**
     - SignalForge with icon
     - Gradient accent bar (left)

   - **Navigation Menu**
     - 8 items with icons
     - Active state: gradient background
     - Hover: slight highlight

     Items:
     - Dashboard 📊
     - Users 👥
     - Subscriptions 💳
     - Payments 💰
     - Audit Log 📋
     - Analytics 📈
     - Database 🗄️
     - Settings ⚙️

### Header Bar
3. **Admin Header** (`<header class="admin-header">`)
   - **Design:** Glass morphism bar

   - Page title (dynamic)
   - Status indicator (green dot)
   - Back to app button (arrow icon)

### Dashboard Page
4. **Key Metrics Grid** (`<div class="metrics-grid">`)
   - **Design:** 4 stat cards, glass morphism

   **Stat Cards:**
   - MRR (Monthly Recurring Revenue)
     - Icon: 📊
     - Large gradient number
     - Change indicator (% up/down)

   - Total Users
     - Icon: 👥
     - Count with animation
     - Change vs. last month

   - Active Subscriptions
     - Icon: 💳
     - Count
     - Change indicator

   - Payments This Month
     - Icon: 💰
     - Amount
     - Count

5. **Revenue Trend Chart**
   - **Design:** Large card with Chart.js
   - Line chart, gradient fill
   - Period toggle (Month/Year buttons)
   - Last 12 months data
   - Tooltips on hover
   - Blue/gold gradient line

6. **Recent Activity Panel**
   - **Design:** Scrollable feed

   - **Activity Items:**
     - Avatar (gradient circle)
     - Timestamp (relative)
     - Action description
     - Icon (colored by type)

   - View All button at bottom

7. **Quick Actions Panel**
   - **Design:** Button grid

   - 5 action buttons:
     - Manage Users (gradient)
     - View Subscriptions
     - Check Payments
     - Run Stock Scanner
     - Database Tools

### Users Page
8. **Users Management**
   - **Design:** Table with filters

   - **Filters:**
     - Search box (with icon)
     - Status dropdown
     - Plan dropdown
     - Date range picker

   - **Users Table:**
     - Avatar (small circle)
     - Name/Email
     - Plan (badge)
     - Status (dot + text)
     - Created date
     - Last active (relative time)
     - Actions (3-dot menu)

   - **Actions per row:**
     - View (eye icon)
     - Edit (pencil)
     - Suspend/Activate (toggle)
     - Delete (trash, with confirmation)

### Subscriptions Page
9. **Subscriptions Management**
   - Similar table structure
   - Filters for status/plan/date
   - **Columns:** User, Plan, Status, Dates, Amount, Actions
   - **Stats cards above:** Active, Trials, Churned, Conversions

### Payments Page
10. **Payments Management**
    - **Design:** Table with status badges

    - **Filters:**
      - Status (succeeded/failed/pending)
      - Date range
      - Amount range slider

    - **Table:**
      - Transaction ID (monospace)
      - User
      - Amount
      - Status (colored badge)
      - Date
      - Payment method (icon)
      - Actions (view/refund/invoice)

### Audit Log Page
11. **Audit Log**
    - **Design:** Dense table, monospace font for IDs

    - **Filters:**
      - Event type
      - User
      - Date range
      - Severity (color-coded)

    - **Table:**
      - Timestamp (precise)
      - User (link)
      - Action (colored badge)
      - Resource
      - Status icon
      - IP Address
      - Details (expandable)

    - Export CSV button

### Analytics Page
12. **Analytics Dashboard**
    - **Design:** Multiple charts layout

    - **Period Selector:**
      - Button group (Today/Week/Month/Year)
      - Custom date range picker

    - **Charts:** (6 charts)
      - User Growth (line chart)
      - Revenue by Plan (bar chart)
      - Churn Analysis (line chart)
      - Feature Usage (pie chart)
      - Geographic Distribution (map/bar)
      - Cohort Retention (heatmap)

    - **Key Metrics:**
      - 4 stat cards at top
      - Conversion rate
      - LTV
      - ARPU
      - Active %

### Database Page
13. **Database Tools**
    - **Design:** Developer-focused

    - **Status Panel:**
      - Connection status (green dot)
      - Database size (progress bar)
      - Table count
      - Last backup date/time

    - **Quick Actions:**
      - Run migrations (with confirm)
      - Backup now
      - View logs

    - **SQL Console:** (admin only)
      - Textarea with syntax highlighting
      - Execute button
      - Results table below
      - Query history sidebar
      - Read-only mode toggle

    - **Tables List:**
      - Table name
      - Row count
      - Size
      - View/Export buttons

### Settings Page
14. **System Settings**
    - **Design:** Form sections with cards

    - **General:**
      - Site name input
      - Maintenance mode toggle
      - Debug mode toggle

    - **Email:**
      - SMTP config fields
      - Test email button
      - Status indicator

    - **Stripe:**
      - API keys (masked)
      - Test mode toggle
      - Webhook status
      - Webhook URL (copy button)

    - **Scanner:**
      - Schedule input (cron format)
      - Markets checkboxes
      - Threshold slider

    - **Telegram:**
      - Bot token (masked)
      - Connection status
      - Test notification button

    - Save All button (primary, bottom)

### Alert Container
15. **Alert Container** (global)
    - **Design:** Toast notifications, top-right
    - 4 types with color-coded backgrounds
    - Auto-dismiss
    - Close button
    - Slide-in animation

---

## portfolio-backtest.html - Portfolio Simulator

**Purpose:** Simulate portfolio performance with multiple positions across markets

**New Design Features:**
- Multi-tab analytics dashboard
- Interactive trade filters
- Export functionality with custom modal

### Header Section
1. **Page Header**
   - Title: "Portfolio Backtest Simulator" - Syne, 3.5rem
   - Description with gradient keywords

   **Legal Disclaimer Banner**
   - Yellow border-left
   - Warning icon
   - UK regulatory text
   - Info icon with tooltip

### Configuration Section
2. **Simulation Parameters Card**
   - **Design:** Glass morphism card

   - **Simulation Start Date**
     - Custom date picker
     - Default: 1 year ago label
     - Helper text below

   - **Display Currency**
     - Dropdown with flags
     - GBP / INR / USD options

   - **Investment Amounts** (read-only display)
     - 3 cards showing:
       - India: ₹50,000
       - UK: £400
       - US: $500
     - Icons for each market

   - **Configuration Info**
     - Position limits badge
     - Signal filter badge
     - Entry logic badge

   - **Run Simulation Button**
     - Large, primary gradient
     - Play icon
     - "Run Simulation" text

   - **Status Display**
     - Progress bar
     - Step indicators
     - Processing text

### Portfolio Summary Section
3. **Portfolio Summary Card**
   - **Design:** Hidden until complete, fade-in animation

   **Metric Cards Grid:**
   - 6 cards in 3x2 grid

   - **Initial Value**
     - Icon
     - Value in selected currency

   - **Final Value**
     - Icon
     - Value (large)

   - **Total Return** (highlighted)
     - Gradient background
     - Large percentage
     - Absolute value
     - Color: green (profit) / red (loss)

   - **Win Rate**
     - Circular progress
     - Percentage

   - **Total Trades**
     - Count
     - Win/loss split

   - **Max Drawdown**
     - Red percentage
     - Warning icon

### Simulation Details Section
4. **Simulation Details Card**
   - **Design:** Expandable/collapsible

   **4 Info Sections:**

   - **Date Ranges**
     - 5 data points
     - Calendar icons
     - Formatted dates

   - **Data Quality**
     - 4 stats
     - Progress bars
     - Info icons

   - **Signal Processing**
     - 4 counts
     - Badges

   - **Force-Close Events**
     - 3 statistics
     - Colored badges

### Portfolio Value Chart
5. **Portfolio Value Chart Card**
   - **Design:** Large card with Chart.js

   - **Chart:**
     - Line chart with gradient fill
     - X-axis: Time
     - Y-axis: Portfolio value
     - Tooltips with date/value
     - Zoom controls (top-right)
     - Pan with mouse drag
     - Blue/gold gradient line

### Analytics Dashboard
6. **Analytics Dashboard Card**
   - **Design:** Tabbed interface

   **Tab Navigation:**
   - 4 tabs with gradient underline on active
   - Performance
   - Market Analysis
   - Trade Patterns
   - Drawdown Analysis

   **Performance Tab:**
   - **Metrics Grid:**
     - 6 metrics in 2x3 layout
     - Annualized Return
     - Sharpe Ratio
     - Sortino Ratio
     - Profit Factor
     - Expectancy
     - Calmar Ratio
     - All with info tooltips

   - **Monthly Returns Chart:**
     - Bar chart
     - Green (positive) / Red (negative)
     - Hover shows exact %

   **Market Analysis Tab:**
   - **Two Charts:**
     - Trades by Market (pie chart)
     - P&L by Market (bar chart)
   - Side by side on desktop
   - Stacked on mobile

   **Trade Patterns Tab:**
   - **Two Charts:**
     - Return Distribution (histogram)
     - Exit Reason Breakdown (pie chart)

   **Drawdown Analysis Tab:**
   - **Drawdown Chart:**
     - Area chart (red gradient)
     - Shows underwater periods
     - Max drawdown annotated

### Active Trades Section
7. **Active Positions Card**
   - **Design:** Table with badge count in header

   **Table:**
   - **Columns:**
     - Symbol (with market flag)
     - Name
     - Market
     - Entry Date
     - Entry Price (formatted)
     - Current Price
     - Days Held (badge)
     - P/L % (colored)
     - P/L Value (currency)

   - **Empty state:**
     - Icon
     - "No active positions" text

### Completed Trades Section
8. **Completed Trades Card**
   - **Design:** Table with export button

   **Header:**
   - Title with count badge
   - Export CSV button (download icon)

   **Trade Filters:**
   - Market filter dropdown
   - Outcome filter (All/Winners/Losers)
   - Date range (optional)

   **Table:**
   - **18 columns** (scrollable horizontally)
   - Symbol, Name, Market, Dates, Prices, Days
   - 4 DTI columns (with tooltips)
   - Historical signals (5Y)
   - P/L in 3 currencies
   - Exit reason (badge)

   - **Features:**
     - Sortable headers
     - Color-coded P/L
     - Hover row highlight
     - Pagination at bottom

   - **Empty state:**
     - "No completed trades"

### Notification System
9. **Notification Container**
   - Same as other pages
   - Toast notifications for simulation events

---

## data-management.html - GDPR/Data Management

**Purpose:** UK GDPR compliance, data rights, and account deletion

**New Design Features:**
- Information boxes with colored borders
- Confirmation dialog for deletion
- Download progress indicators

### Header
1. **Page Header**
   - Title: "Data Management" - Syne, 3.5rem
   - Description about GDPR
   - Back button (arrow icon)

### Your Rights Section
2. **Data Rights Card**
   - **Design:** Info box with blue border-left

   **Rights List:**
   - 7 items
   - Bold titles
   - Descriptions below
   - Checkmark icons (gradient)
   - Items:
     - Access
     - Rectification
     - Erasure
     - Restrict Processing
     - Data Portability
     - Object
     - Withdraw Consent

### Data Overview Section
3. **Data Overview Card**
   - **Design:** White card with data grid

   **Data Info Display:**
   - 5 rows with label/value pairs
   - Account created date
   - Email address
   - Total trades count
   - Active signals count
   - Last activity datetime

   **Data Retention Info Box:**
   - Green border-left
   - 4 retention periods listed
   - Icons for each category

### Data Actions Section
4. **Data Actions Card**
   - **Design:** 3-column grid of action cards

   **Download Data Card:**
   - Icon (download)
   - Heading
   - Description
   - Download button (primary)
   - Shows progress bar when downloading

   **Export Trade History Card:**
   - Icon (table)
   - Heading
   - Description
   - Export button (primary)

   **Cookie Settings Card:**
   - Icon (cookie)
   - Heading
   - Description
   - Settings button (secondary)

### Account Deletion Section
5. **Delete Account Card**
   - **Design:** Danger zone, red accents

   **Warning Box:**
   - Red border-left
   - Bold warning text
   - Icon

   **Pre-deletion Checklist:**
   - 3 items with checkbox icons
   - Download data
   - Export trades
   - Check active positions

   **Delete Button:**
   - Danger style (red gradient)
   - Trash icon
   - Requires confirmation

6. **Delete Confirmation Dialog**
   - **Design:** Modal with blur backdrop

   **Header:**
   - Title with trash icon
   - Red gradient text
   - Close button

   **Body:**
   - Warning box (red)
   - Consequences list (4 items)
   - Confirmation input
     - "Type DELETE to confirm"
     - Input field (red border when filled correctly)
     - Enables delete button when correct

   **Actions:**
   - Cancel (secondary)
   - Delete (danger, disabled initially)

### Contact Section
7. **Contact Card**
   - **Design:** Info box

   **Contact Info:**
   - Email addresses (2)
   - Response time
   - All with icons

   **Complaint Info Box:**
   - Blue border-left
   - ICO information
   - Website link
   - Phone number

---

## telegram-subscribe.html - Telegram Integration

**Purpose:** Subscribe to Telegram bot for trading signals

**New Design Features:**
- Step cards with number badges
- OAuth linking section with gradient background
- Subscription type cards with hover effects

### Page Header
1. **Telegram Header**
   - **Design:** Centered

   - Icon circle (📱 emoji, large)
   - Main heading - Syne, 3.5rem
   - Subtitle - Inter, grey

### Benefits Section
2. **Why Subscribe Card**
   - **Design:** White card

   **Benefits Grid:**
   - 4 cards in 2x2 grid (1 column on mobile)

   **Benefit Cards:**
   - Icon (emoji, large)
   - Heading - Syne, 1.3rem
   - Description - Inter, grey

   Cards:
   - Instant Notifications (⚡)
   - Daily 7 AM Scans (🌅)
   - Backtested Signals (📊)
   - High Conviction (🎯)

### How to Subscribe Section
3. **Steps Card**
   - **Design:** White card with step cards

   **Step Cards:** (3 steps)
   - **Design:** Horizontal layout (icon + content)

   - **Step Number Badge:**
     - Circular
     - Gradient background
     - Large number

   - **Content:**
     - Heading (bold)
     - Description

   Steps:
   1. Click Button Below
   2. Send /start
   3. You're All Set

### Call to Action
4. **CTA Section**
   - **Design:** Centered

   **Open in Telegram Button:**
   - Large size
   - Primary gradient
   - Telegram icon (SVG)
   - "Open in Telegram" text
   - Prominent shadow
   - Shine effect on hover

### Subscription Types Section
5. **Subscription Types Card**
   - **Design:** White card

   **Subscription Cards:** (3 cards)
   - **Design:** Border-left with color, hover lift

   **All Signals Card:**
   - Icon: 🎯
   - Heading with "(Recommended)" badge
   - Description
   - Subscribe link with arrow
   - Blue accent

   **Morning Conviction Card:**
   - Icon: 🌅
   - Heading
   - Description
   - Subscribe link
   - Gold accent

   **Scan Results Card:**
   - Icon: 🔍
   - Heading
   - Description
   - Subscribe link
   - Green accent

### Alternative Section
6. **Manual Search Section**
   - **Design:** Grey background box

   - Heading
   - Instructions
   - **Bot Username:**
     - @MySignalForgeBot
     - Monospace font
     - Blue color
     - Copy button on hover
   - Send /start instruction

### Help Section
7. **Help Text**
   - **Design:** Light background

   - Instructions for bot commands:
     - /status (check subscription)
     - /change (change type)
     - /help (get help)
   - Bold command text

### OAuth Linking Section (Conditional)
8. **OAuth Linking Section**
   - **Design:** Gradient background (blue to gold)
   - Only visible if logged in
   - White text

   **Not Linked State:**
   - Heading: "Link Your Account"
   - Description

   **Benefits Card:**
   - Glass morphism style
   - Benefits list (3 items)
   - Checkmarks

   **Generate Link Button:**
   - White background
   - Blue text
   - Shadow

   **Deep Link Display:** (appears after generating)
   - Step 1 instructions
   - Telegram Deep Link Button (large)
   - Step 2 instructions
   - Check Status Button (outline)

   **Linked State:**
   - Success icon (✅, large)
   - "Account Linked!" heading
   - Telegram username display
   - Link date
   - Unlink button (outline)

### Back Link
9. **Back to Home Link**
   - **Design:** Top of page
   - Arrow icon
   - "Back to Home" text
   - Hover: gradient color

---

## checkout-success.html - Success Page

**Purpose:** Subscription success confirmation

**New Design Features:**
- Animated success icon (scale-in)
- Gradient text
- Next steps with number badges

### Success Container
1. **Success Card**
   - **Design:** Centered card, max-width 800px

   **Success Icon:**
   - Circular (120px)
   - Green gradient background
   - Checkmark SVG (white)
   - Scale-in animation (bouncy)

   **Success Title:**
   - "Subscription Successful!"
   - Syne, 2.5rem
   - Gradient text (green)

   **Success Message:**
   - Thank you text
   - Dynamic based on trial status
   - Inter, 1.2rem

2. **Trial Banner** (conditional)
   - **Design:** Green gradient background
   - Clock icon
   - "90-Day Free Trial Started" heading
   - Details about trial
   - "No charge" notice

3. **Subscription Details**
   - **Design:** Grid of detail rows

   **Detail Rows:**
   - Label (left, grey)
   - Value (right, bold, black)

   Details:
   - Plan name
   - Status (badge)
   - Start date
   - Next billing/trial end date
   - Billing period (if applicable)

4. **Next Steps Section**
   - **Design:** Left-aligned list

   - Heading: "What's Next?"

   **Step List:** (4 steps)
   - **Step Item:**
     - Number badge (circular, gradient)
     - Title (bold)
     - Description (grey text)

   Steps:
   1. Connect Telegram
   2. Explore Trading Signals
   3. Set Up Custom Alerts
   4. Join Our Community

5. **Action Buttons**
   - **Design:** Button group, centered

   - **Connect Telegram Button:**
     - Primary gradient
     - Telegram icon
     - "Connect Telegram" text

   - **Go to Dashboard Button:**
     - Secondary (outline)
     - Dashboard icon
     - "Go to Dashboard" text

---

## checkout-failure.html - Failure Page

**Purpose:** Payment failure handling and troubleshooting

**New Design Features:**
- Animated failure icon (shake)
- Common issues accordion
- Support contact cards

### Failure Container
1. **Failure Card**
   - **Design:** Centered card, max-width 800px

   **Failure Icon:**
   - Circular (120px)
   - Red gradient background
   - X mark SVG (white)
   - Shake animation on load

   **Failure Title:**
   - "Payment Failed"
   - Syne, 2.5rem
   - Red color

   **Failure Message:**
   - Explanation text
   - "Card not charged" reassurance
   - Inter, 1.2rem

2. **Error Details** (conditional)
   - **Design:** Red border box

   - **Error Code:**
     - Monospace font
     - Bold
     - Error code display

   - **Error Description:**
     - Human-readable message
     - Grey text

3. **Common Issues Section**
   - **Design:** White card

   - Heading with warning icon

   **Issue List:** (5 issues)
   - **Issue Item:**
     - Warning icon (amber)
     - Title (bold)
     - Solution description (grey)

   Issues:
   1. Incorrect Card Details
   2. Insufficient Funds
   3. Card Declined by Bank
   4. International Payments Blocked
   5. Expired or Invalid Card

4. **Action Buttons**
   - **Design:** Button group, centered

   - **Try Again Button:**
     - Primary gradient
     - Refresh icon
     - Links to checkout with same plan

   - **Back to Pricing Button:**
     - Secondary (outline)
     - Arrow icon

5. **Support Section**
   - **Design:** Blue border box

   - Heading: "Need Help?"
   - Description text

   **Support Contact Links:**
   - **Email Support:**
     - Email icon
     - Link to support email

   - **Telegram Support:**
     - Telegram icon
     - Link to Telegram page

---

## JavaScript Modules & Dependencies

### External Libraries
- **Chart.js v4.4.0:** Charts and data visualization
  - Blue/gold color scheme
  - Custom tooltips
  - Gradient fills

- **Stripe.js:** Payment processing
  - Custom styled elements

- **Google OAuth:** Authentication
  - Button styling

### Custom JS Files

**Core Functionality:**
- **unified-navbar.js:** Navigation bar with scroll behavior
- **theme-toggle.js:** Dark/light mode (if implemented)
- **cookie-consent.js:** Cookie banner management
- **xss-protection.js:** Security sanitization
- **error-handler.js:** Global error handling

**Trading Features:**
- **dti-core.js:** DTI calculation logic
- **dti-calculator.js:** Backtest calculations
- **backtest-calculator.js:** Backtest engine
- **portfolio-simulator.js:** Portfolio simulation
- **portfolio-analytics.js:** Analytics calculations
- **portfolio-charts.js:** Chart rendering with new colors
- **portfolio-ui.js:** UI updates with animations
- **portfolio-export.js:** CSV export functionality

**Admin Features:**
- **admin-components.js:** Reusable admin UI components
- **admin-dashboard.js:** Dashboard logic with stat animations
- **admin-users.js:** User management
- **admin-subscriptions.js:** Subscription management
- **admin-payments.js:** Payment management
- **admin-audit.js:** Audit log
- **admin-analytics.js:** Analytics charts
- **admin-database.js:** Database tools
- **admin-settings.js:** Settings management

---

## Accessibility Features

### ARIA Labels
- All interactive elements have `aria-label` or `aria-labelledby`
- Form inputs have associated `<label>` elements
- Buttons describe their action clearly
- Dynamic content has `aria-live` regions

### Keyboard Navigation
- Logical tab order (left-to-right, top-to-bottom)
- All interactive elements focusable with Tab
- Modal traps focus when open (Escape to close)
- Dropdowns navigable with arrow keys
- Focus visible with blue glow outline

### Color Contrast
- WCAG AA compliant (4.5:1 minimum)
- Text on gradient backgrounds has solid fallback
- High contrast mode supported
- Color not the only indicator (icons + text)

### Screen Reader Support
- Semantic HTML elements (`<nav>`, `<main>`, `<article>`)
- ARIA live regions for dynamic updates
- Alt text for images
- Form error messages announced

---

## Browser Compatibility
- **Chrome/Edge:** Latest 2 versions (90+)
- **Firefox:** Latest 2 versions (88+)
- **Safari:** Latest 2 versions (14+)
- **Mobile:**
  - iOS Safari 14+
  - Chrome Android 90+
  - Samsung Internet

---

## Performance Optimizations

### Loading Strategies
- Lazy load charts (Chart.js) when scrolled into view
- Virtual scrolling for large tables (>100 rows)
- Debounced search inputs (300ms delay)
- Memoized calculations for repeated data
- Service worker for offline functionality (optional)

### Animation Performance
- Use `transform` and `opacity` (GPU-accelerated)
- `will-change` on elements about to animate
- RequestAnimationFrame for smooth animations
- CSS containment for isolated updates

### Bundle Optimization
- Code splitting per page
- Minified CSS/JS in production
- Critical CSS inlined
- Deferred non-critical scripts

---

**End of Design System & UI Components Documentation**

*For implementation questions or design system updates, contact the development team.*

**Version History:**
- v1.0 (Dec 2024): Initial component catalog
- v2.0 (Jan 2025): Complete design system integration with modern styling