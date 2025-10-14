/**
 * Pricing Page JavaScript
 * Handles fetching and displaying subscription plans by region
 */

class PricingPage {
    constructor() {
        this.plans = [];
        this.currentRegion = 'US';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadPlans();
    }

    setupEventListeners() {
        // Region selector buttons
        const regionButtons = document.querySelectorAll('.region-btn');
        regionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const region = e.currentTarget.dataset.region;
                this.selectRegion(region);
            });
        });
    }

    selectRegion(region) {
        // Update button states
        document.querySelectorAll('.region-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.region === region) {
                btn.classList.add('active');
            }
        });

        this.currentRegion = region;
        this.renderPlans();
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
        const currencySymbol = this.getCurrencySymbol(plan.currency);
        const price = parseFloat(plan.price_monthly) || 0;
        const features = this.getPlanFeatures(plan);

        return `
            <div class="pricing-card ${isFeatured ? 'featured' : ''}">
                ${isFeatured ? '<div class="featured-badge">Most Popular</div>' : ''}

                <div class="plan-name">${plan.plan_name}</div>
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
            'FREE': 'Perfect for trying out SutrAlgo',
            'BASIC_UK': 'Essential features for individual traders',
            'PRO_UK': 'Advanced features for serious traders',
            'BASIC_US': 'Essential features for individual traders',
            'PRO_US': 'Advanced features for serious traders',
            'BASIC_IN': 'Essential features for individual traders',
            'PRO_IN': 'Advanced features for serious traders'
        };

        return descriptions[plan.plan_code] || 'Get started with SutrAlgo';
    }

    getPlanFeatures(plan) {
        const isFree = plan.plan_code === 'FREE';
        const isBasic = plan.plan_code.includes('BASIC');
        const isPro = plan.plan_code.includes('PRO');

        const features = [];

        if (isFree) {
            features.push('90-day full access to all features');
            features.push('Unlimited trading signals');
            features.push('Real-time Telegram notifications');
            features.push('All technical indicators');
            features.push('5 years historical data');
            features.push('Basic backtesting');
            features.push('5 custom alerts');
            features.push('Email support');
        } else if (isBasic) {
            features.push('Unlimited trading signals');
            features.push('Real-time Telegram notifications');
            features.push('All technical indicators');
            features.push('5 years historical data');
            features.push('Basic backtesting');
            features.push('20 custom alerts');
            features.push('Email support');
        } else if (isPro) {
            features.push('Everything in Basic');
            features.push('Priority Telegram notifications');
            features.push('10 years historical data');
            features.push('Advanced backtesting & portfolio analysis');
            features.push('Unlimited custom alerts');
            features.push('API access');
            features.push('Priority email support');
            features.push('Early access to new features');
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
            'IN': { symbol: '₹', basic: '999', pro: '1999' }
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
});
