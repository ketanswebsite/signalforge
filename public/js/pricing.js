/**
 * Pricing Page JavaScript
 * Handles fetching and displaying subscription plans by region
 */

class PricingPage {
    constructor() {
        this.plans = [];
        this.currentRegion = 'US'; // Default fallback
        this.locationInfo = null;
        this.init();
    }

    async init() {
        // Detect user's location first
        await this.detectLocation();
        // Check subscription status
        await this.loadSubscriptionStatus();
        // Then load and render plans
        await this.loadPlans();
    }

    async detectLocation() {
        try {
            const response = await fetch('/api/user/location');
            const data = await response.json();

            if (data && data.region) {
                this.currentRegion = data.region;
                this.locationInfo = data;
                console.log('Location detected:', data.region, data.detected ? '(auto-detected)' : '(default)');
            }
        } catch (error) {
            console.error('Error detecting location:', error);
            // Keep default region (US)
        }
    }

    async loadPlans() {
        try {
            const response = await fetch('/api/subscription-plans');
            const data = await response.json();

            if (data.success) {
                this.plans = data.data.plans || [];
                this.renderPlans();
            } else {
                console.error('Failed to load plans:', data.error);
                this.showErrorState();
            }
        } catch (error) {
            console.error('Error loading plans:', error);
            this.showFallbackPlans();
        }
    }

    renderPlans() {
        const container = document.getElementById('pricing-plans');
        const regionPlans = this.plans.filter(plan => plan.region === this.currentRegion);

        if (regionPlans.length === 0) {
            this.showFallbackPlans();
            return;
        }

        // Sort plans: Free Trial first, then by price
        regionPlans.sort((a, b) => {
            if (a.plan_code === 'FREE') return -1;
            if (b.plan_code === 'FREE') return 1;
            return a.price_monthly - b.price_monthly;
        });

        container.innerHTML = regionPlans.map((plan, index) => this.createPlanCard(plan, index === 1)).join('');

        // Add click handlers to CTA buttons
        document.querySelectorAll('.plan-cta').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const planCode = e.currentTarget.dataset.planCode;
                this.selectPlan(planCode);
            });
        });
    }

    createPlanCard(plan, isFeatured = false) {
        const isFree = plan.plan_code === 'FREE';
        const isBasic = plan.plan_code.includes('BASIC');
        const currencySymbol = this.getCurrencySymbol(plan.currency);
        const price = parseFloat(plan.price_monthly) || 0;
        const features = this.getPlanFeatures(plan);

        // Display unified plan names: Explorer or Trader (regardless of region suffix in DB)
        const displayName = isFree ? 'Explorer' : (isBasic ? 'Trader' : plan.plan_name);

        return `
            <div class="pricing-card ${isFeatured ? 'featured' : ''}">
                ${isFeatured ? '<div class="featured-badge">Most Popular</div>' : ''}

                <div class="plan-name">${displayName}</div>
                <div class="plan-description">${this.getPlanDescription(plan)}</div>

                <div class="plan-price">
                    ${isFree ? `
                        <div class="price-amount">Free</div>
                        <div class="trial-badge">90-Day Trial</div>
                    ` : `
                        <span class="price-currency">${currencySymbol}</span>
                        <span class="price-amount">${price.toFixed(2)}</span>
                        <span class="price-period">/month</span>
                    `}
                </div>

                <ul class="plan-features">
                    ${features.map(feature => `
                        <li>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-icon">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <span>${feature}</span>
                        </li>
                    `).join('')}
                </ul>

                <button class="plan-cta ${isFree ? 'secondary' : ''}" data-plan-code="${plan.plan_code}">
                    ${isFree ? 'Start Free Trial' : 'Get Started'}
                </button>
            </div>
        `;
    }

    getPlanDescription(plan) {
        const descriptions = {
            'FREE': 'Start your trading journey with 90 days unlimited access',
            'BASIC_UK': 'Unlimited access forever. Trade with confidence.',
            'BASIC_US': 'Unlimited access forever. Trade with confidence.',
            'BASIC_IN': 'Unlimited access forever. Trade with confidence.'
        };

        return descriptions[plan.plan_code] || 'Get started with SutrAlgo';
    }

    getPlanFeatures(plan) {
        const isFree = plan.plan_code === 'FREE';
        const isBasic = plan.plan_code.includes('BASIC');

        const features = [];

        if (isFree) {
            features.push('✨ 90 days of unlimited access');
            features.push('📊 Unlimited trading signals');
            features.push('🔔 Real-time Telegram alerts');
            features.push('📈 All technical indicators');
            features.push('🔄 Unlimited backtesting');
            features.push('🌍 India, UK & US markets');
            features.push('📧 Email support');
            features.push('⚠️ Requires Trader upgrade after 90 days');
        } else if (isBasic) {
            features.push('♾️ Unlimited access forever');
            features.push('📊 Unlimited trading signals');
            features.push('🔔 Real-time Telegram alerts');
            features.push('📈 All technical indicators');
            features.push('🔄 Unlimited backtesting');
            features.push('🌍 India, UK & US markets');
            features.push('🎯 Unlimited custom alerts');
            features.push('📧 Email support');
        }

        return features;
    }

    getCurrencySymbol(currency) {
        const symbols = {
            'GBP': '£',
            'USD': '$',
            'INR': '₹',
            'EUR': '€'
        };
        return symbols[currency] || '$';
    }

    selectPlan(planCode) {
        // Redirect to checkout page with selected plan
        window.location.href = `/checkout.html?plan=${planCode}`;
    }

    async loadSubscriptionStatus() {
        try {
            const response = await fetch('/api/user/subscription', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.showSubscriptionBanner(data);
            }
        } catch (error) {
            // Not logged in or error - don't show banner
            console.log('No subscription status to display');
        }
    }

    showSubscriptionBanner(data) {
        const banner = document.getElementById('subscription-status-banner');
        if (!banner) return;

        let html = '';

        if (data.data.isAdmin) {
            // Admin banner
            html = `
                <div class="alert alert-success" style="margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem;">
                    <span class="material-icons" style="font-size: 2rem;">verified_user</span>
                    <div style="flex: 1;">
                        <strong style="font-size: 1.125rem;">Admin Access - Unlimited</strong><br>
                        <span style="opacity: 0.9;">You have full access to all features with no restrictions.</span>
                    </div>
                </div>
            `;
        } else if (data.data.hasSubscription && data.data.subscription) {
            const sub = data.data.subscription;

            if (sub.status === 'trial') {
                // Trial banner
                const daysRemaining = sub.daysRemaining || 0;
                html = `
                    <div class="alert alert-info" style="margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem;">
                        <span class="material-icons" style="font-size: 2rem;">schedule</span>
                        <div style="flex: 1;">
                            <strong style="font-size: 1.125rem;">Free Trial Active</strong><br>
                            <span style="opacity: 0.9;">You have ${daysRemaining} days remaining in your 90-day free trial.</span>
                        </div>
                        <a href="/account.html" class="btn btn-secondary">View Details</a>
                    </div>
                `;
            } else if (sub.status === 'active') {
                // Active subscription banner
                html = `
                    <div class="alert alert-success" style="margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem;">
                        <span class="material-icons" style="font-size: 2rem;">check_circle</span>
                        <div style="flex: 1;">
                            <strong style="font-size: 1.125rem;">Active Subscription</strong><br>
                            <span style="opacity: 0.9;">You're currently subscribed to ${sub.plan_name || 'a plan'}.</span>
                        </div>
                        <a href="/account.html" class="btn btn-secondary">Manage</a>
                    </div>
                `;
            }
        }

        if (html) {
            banner.innerHTML = html;
            banner.style.display = 'block';
        }
    }

    showFallbackPlans() {
        // Show hardcoded plans if API fails
        const container = document.getElementById('pricing-plans');
        const currencyInfo = this.getCurrencyInfo(this.currentRegion);

        container.innerHTML = `
            <div class="pricing-card">
                <div class="plan-name">Free Trial</div>
                <div class="plan-description">Perfect for trying out SutrAlgo</div>
                <div class="plan-price">
                    <div class="price-amount">Free</div>
                    <div class="trial-badge">90-Day Trial</div>
                </div>
                <ul class="plan-features">
                    <li><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg><span>90-day full access</span></li>
                    <li><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Unlimited signals</span></li>
                    <li><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Telegram notifications</span></li>
                </ul>
                <button class="plan-cta secondary" onclick="window.location.href='/login.html'">Start Free Trial</button>
            </div>

            <div class="pricing-card featured">
                <div class="featured-badge">Most Popular</div>
                <div class="plan-name">Basic</div>
                <div class="plan-description">Essential features for traders</div>
                <div class="plan-price">
                    <span class="price-currency">${currencyInfo.symbol}</span>
                    <span class="price-amount">${currencyInfo.basic}</span>
                    <span class="price-period">/month</span>
                </div>
                <ul class="plan-features">
                    <li><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Unlimited signals</span></li>
                    <li><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Real-time notifications</span></li>
                    <li><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg><span>20 custom alerts</span></li>
                </ul>
                <button class="plan-cta" onclick="window.location.href='/login.html'">Get Started</button>
            </div>

            <div class="pricing-card">
                <div class="plan-name">Pro</div>
                <div class="plan-description">Advanced features for serious traders</div>
                <div class="plan-price">
                    <span class="price-currency">${currencyInfo.symbol}</span>
                    <span class="price-amount">${currencyInfo.pro}</span>
                    <span class="price-period">/month</span>
                </div>
                <ul class="plan-features">
                    <li><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Everything in Basic</span></li>
                    <li><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg><span>API access</span></li>
                    <li><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Priority support</span></li>
                </ul>
                <button class="plan-cta" onclick="window.location.href='/login.html'">Get Started</button>
            </div>
        `;
    }

    getCurrencyInfo(region) {
        const info = {
            'UK': { symbol: '£', basic: '9.99', pro: '19.99' },
            'US': { symbol: '$', basic: '12.99', pro: '24.99' },
            'India': { symbol: '₹', basic: '799', pro: '1599' }
        };
        return info[region] || info['US'];
    }

    showErrorState() {
        const container = document.getElementById('pricing-plans');
        container.innerHTML = `
            <div class="pricing-card">
                <div class="plan-name">Error Loading Plans</div>
                <div class="plan-description">
                    We're having trouble loading the pricing plans. Please refresh the page or try again later.
                </div>
                <button class="plan-cta secondary" onclick="location.reload()">Refresh Page</button>
            </div>
        `;
    }
}

// Initialize pricing page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PricingPage();
    initFAQAccordion();
});

/**
 * FAQ Accordion Functionality
 * Handles expanding/collapsing FAQ items
 */
function initFAQAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');

        question.addEventListener('click', () => {
            // Toggle active state
            const isActive = item.classList.contains('active');

            // Close all FAQ items
            faqItems.forEach(faq => faq.classList.remove('active'));

            // If this item wasn't active, open it
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });
}
