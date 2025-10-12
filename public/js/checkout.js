/**
 * Checkout Page JavaScript
 * Handles Stripe payment integration and checkout flow
 */

class CheckoutPage {
    constructor() {
        this.stripe = null;
        this.cardElement = null;
        this.selectedPlan = null;
        this.selectedPeriod = 'monthly';
        this.discountCode = null;
        this.discountAmount = 0;

        this.init();
    }

    async init() {
        try {
            // Get plan code from URL
            const urlParams = new URLSearchParams(window.location.search);
            const planCode = urlParams.get('plan');

            if (!planCode) {
                this.showError('No plan selected. Redirecting to pricing page...');
                setTimeout(() => window.location.href = '/pricing.html', 2000);
                return;
            }

            // Load plan details
            await this.loadPlanDetails(planCode);

            // Initialize Stripe
            await this.initializeStripe();

            // Setup event listeners
            this.setupEventListeners();

        } catch (error) {
            console.error('Checkout initialization error:', error);
            this.showError('Failed to initialize checkout. Please try again.');
        }
    }

    async loadPlanDetails(planCode) {
        try {
            const response = await fetch(`/api/subscription-plans/${planCode}`);
            const data = await response.json();

            if (data.success && data.data.plan) {
                this.selectedPlan = data.data.plan;
                this.renderPlanSummary();
                this.renderBillingPeriods();
                this.updateOrderSummary();
            } else {
                throw new Error('Plan not found');
            }
        } catch (error) {
            console.error('Error loading plan:', error);
            this.showError('Failed to load plan details. Redirecting...');
            setTimeout(() => window.location.href = '/pricing.html', 2000);
        }
    }

    async initializeStripe() {
        try {
            // Get Stripe publishable key from server
            const response = await fetch('/api/stripe/config');
            const config = await response.json();

            if (!config.publishableKey) {
                throw new Error('Stripe not configured');
            }

            this.stripe = Stripe(config.publishableKey);

            // Create card element
            const elements = this.stripe.elements();
            this.cardElement = elements.create('card', {
                style: {
                    base: {
                        color: '#ffffff',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        fontSize: '16px',
                        '::placeholder': {
                            color: '#b8b8d1'
                        }
                    },
                    invalid: {
                        color: '#e74c3c',
                        iconColor: '#e74c3c'
                    }
                }
            });

            this.cardElement.mount('#card-element');

            // Handle real-time validation errors
            this.cardElement.on('change', (event) => {
                const displayError = document.getElementById('card-errors');
                if (event.error) {
                    displayError.textContent = event.error.message;
                    displayError.classList.add('visible');
                } else {
                    displayError.textContent = '';
                    displayError.classList.remove('visible');
                }
            });

        } catch (error) {
            console.error('Stripe initialization error:', error);
            this.showError('Payment system not available. Please contact support.');
        }
    }

    renderPlanSummary() {
        const plan = this.selectedPlan;
        const isFree = plan.plan_code === 'FREE';
        const currencySymbol = this.getCurrencySymbol(plan.currency);

        const summaryHTML = `
            <div class="plan-name">${plan.plan_name}</div>
            <div class="plan-description">${this.getPlanDescription(plan)}</div>

            ${isFree ? `
                <div class="trial-info">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <div>
                        <strong>90-Day Free Trial</strong><br>
                        Full access to all features. No payment required.
                    </div>
                </div>
            ` : ''}

            <ul class="plan-features">
                ${this.getPlanFeatures(plan).map(feature => `
                    <li>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span>${feature}</span>
                    </li>
                `).join('')}
            </ul>
        `;

        document.getElementById('plan-summary').innerHTML = summaryHTML;
    }

    renderBillingPeriods() {
        const plan = this.selectedPlan;
        const isFree = plan.plan_code === 'FREE';

        if (isFree) {
            document.querySelector('.billing-period-options').style.display = 'none';
            document.querySelector('.payment-section').style.display = 'none';
            document.getElementById('trial-notice').style.display = 'flex';

            // Show "Start Free Trial" button instead
            const form = document.getElementById('payment-form');
            form.innerHTML = `
                <button type="button" class="btn-checkout" id="start-trial-btn">
                    Start 90-Day Free Trial
                </button>
            `;

            document.getElementById('start-trial-btn').addEventListener('click', () => {
                this.startFreeTrial();
            });

            return;
        }

        const currencySymbol = this.getCurrencySymbol(plan.currency);
        const periods = [];

        if (plan.monthly_price > 0) {
            periods.push({
                name: 'Monthly',
                value: 'monthly',
                price: plan.monthly_price,
                display: `${currencySymbol}${plan.monthly_price.toFixed(2)}/month`,
                details: 'Billed monthly. Cancel anytime.'
            });
        }

        if (plan.quarterly_price > 0) {
            const monthlySavings = (plan.monthly_price * 3) - plan.quarterly_price;
            const percentSavings = Math.round((monthlySavings / (plan.monthly_price * 3)) * 100);

            periods.push({
                name: 'Quarterly',
                value: 'quarterly',
                price: plan.quarterly_price,
                display: `${currencySymbol}${plan.quarterly_price.toFixed(2)}/quarter`,
                details: `Billed every 3 months. Effective ${currencySymbol}${(plan.quarterly_price / 3).toFixed(2)}/month`,
                savings: percentSavings > 0 ? `Save ${percentSavings}%` : null
            });
        }

        if (plan.annual_price > 0) {
            const monthlySavings = (plan.monthly_price * 12) - plan.annual_price;
            const percentSavings = Math.round((monthlySavings / (plan.monthly_price * 12)) * 100);

            periods.push({
                name: 'Annual',
                value: 'annual',
                price: plan.annual_price,
                display: `${currencySymbol}${plan.annual_price.toFixed(2)}/year`,
                details: `Billed annually. Effective ${currencySymbol}${(plan.annual_price / 12).toFixed(2)}/month`,
                savings: percentSavings > 0 ? `Save ${percentSavings}%` : null
            });
        }

        const periodsHTML = periods.map(period => `
            <label class="period-option ${period.value === 'monthly' ? 'selected' : ''}" data-period="${period.value}">
                <input type="radio" name="billing-period" value="${period.value}" ${period.value === 'monthly' ? 'checked' : ''}>
                <div class="period-header">
                    <span class="period-name">${period.name}</span>
                    <span class="period-price">${period.display}</span>
                    ${period.savings ? `<span class="period-savings">${period.savings}</span>` : ''}
                </div>
                <div class="period-details">${period.details}</div>
            </label>
        `).join('');

        document.getElementById('billingPeriodOptions').innerHTML = periodsHTML;

        // Show trial notice if trial_days > 0
        if (plan.trial_days > 0) {
            const trialNotice = document.getElementById('trial-notice');
            trialNotice.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                </svg>
                <div>
                    <strong>${plan.trial_days}-Day Free Trial</strong><br>
                    Your card will not be charged today. Billing starts after your trial ends.
                </div>
            `;
            trialNotice.style.display = 'flex';
        }
    }

    setupEventListeners() {
        // Billing period selection
        document.querySelectorAll('.period-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.period-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                option.querySelector('input').checked = true;
                this.selectedPeriod = option.dataset.period;
                this.updateOrderSummary();
            });
        });

        // Discount code
        document.getElementById('apply-discount')?.addEventListener('click', () => {
            this.applyDiscountCode();
        });

        // Payment form submission
        const form = document.getElementById('payment-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handlePayment();
            });
        }
    }

    updateOrderSummary() {
        const plan = this.selectedPlan;
        const isFree = plan.plan_code === 'FREE';

        if (isFree) {
            document.getElementById('subtotal').textContent = 'Free';
            document.getElementById('tax').textContent = '$0.00';
            document.getElementById('discount').textContent = '$0.00';
            document.getElementById('total').textContent = 'Free';
            return;
        }

        const currencySymbol = this.getCurrencySymbol(plan.currency);

        let price = 0;
        switch (this.selectedPeriod) {
            case 'monthly':
                price = plan.monthly_price;
                break;
            case 'quarterly':
                price = plan.quarterly_price;
                break;
            case 'annual':
                price = plan.annual_price;
                break;
        }

        const tax = 0; // TODO: Calculate tax based on location
        const subtotal = price;
        const discount = this.discountAmount;
        const total = Math.max(0, subtotal + tax - discount);

        document.getElementById('subtotal').textContent = `${currencySymbol}${subtotal.toFixed(2)}`;
        document.getElementById('tax').textContent = `${currencySymbol}${tax.toFixed(2)}`;
        document.getElementById('discount').textContent = discount > 0 ? `-${currencySymbol}${discount.toFixed(2)}` : `${currencySymbol}0.00`;
        document.getElementById('total').textContent = `${currencySymbol}${total.toFixed(2)}`;
    }

    async applyDiscountCode() {
        const codeInput = document.getElementById('discount-code');
        const code = codeInput.value.trim();

        if (!code) {
            this.showError('Please enter a discount code');
            return;
        }

        try {
            const response = await fetch('/api/stripe/validate-discount', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, planCode: this.selectedPlan.plan_code })
            });

            const data = await response.json();

            if (data.success && data.discount) {
                this.discountCode = code;
                this.discountAmount = data.discount.amount;
                this.updateOrderSummary();
                this.showSuccess('Discount applied successfully!');
            } else {
                this.showError(data.error?.message || 'Invalid discount code');
            }
        } catch (error) {
            console.error('Error applying discount:', error);
            this.showError('Failed to apply discount code');
        }
    }

    async startFreeTrial() {
        const submitBtn = document.getElementById('start-trial-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Activating Trial...';

        try {
            const response = await fetch('/api/subscription/start-free-trial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planCode: this.selectedPlan.plan_code
                })
            });

            const data = await response.json();

            if (data.success) {
                window.location.href = '/checkout-success.html?trial=true';
            } else {
                throw new Error(data.error?.message || 'Failed to start trial');
            }
        } catch (error) {
            console.error('Error starting trial:', error);
            this.showError(error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Start 90-Day Free Trial';
        }
    }

    async handlePayment() {
        const submitBtn = document.getElementById('submit-button');
        const cardholderName = document.getElementById('card-holder-name').value.trim();

        if (!cardholderName) {
            this.showError('Please enter cardholder name');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.classList.add('processing');

        try {
            // Create payment intent on server
            const response = await fetch('/api/stripe/create-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planCode: this.selectedPlan.plan_code,
                    billingPeriod: this.selectedPeriod,
                    discountCode: this.discountCode
                })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error?.message || 'Failed to create subscription');
            }

            // Confirm payment with Stripe
            const { error, paymentIntent } = await this.stripe.confirmCardPayment(
                data.clientSecret,
                {
                    payment_method: {
                        card: this.cardElement,
                        billing_details: {
                            name: cardholderName
                        }
                    }
                }
            );

            if (error) {
                throw new Error(error.message);
            }

            if (paymentIntent.status === 'succeeded') {
                // Redirect to success page
                window.location.href = `/checkout-success.html?subscription_id=${data.subscriptionId}`;
            }

        } catch (error) {
            console.error('Payment error:', error);
            this.showError(error.message || 'Payment failed. Please try again.');
            submitBtn.disabled = false;
            submitBtn.classList.remove('processing');
        }
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

    getPlanDescription(plan) {
        const descriptions = {
            'FREE': 'Perfect for trying out SignalForge',
            'BASIC_UK': 'Essential features for individual traders',
            'PRO_UK': 'Advanced features for serious traders',
            'BASIC_US': 'Essential features for individual traders',
            'PRO_US': 'Advanced features for serious traders',
            'BASIC_IN': 'Essential features for individual traders',
            'PRO_IN': 'Advanced features for serious traders'
        };
        return descriptions[plan.plan_code] || 'Get started with SignalForge';
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

    showError(message) {
        const errorDiv = document.getElementById('card-errors');
        errorDiv.textContent = message;
        errorDiv.classList.add('visible');

        setTimeout(() => {
            errorDiv.classList.remove('visible');
        }, 5000);
    }

    showSuccess(message) {
        // You could create a success message element similar to error
        console.log('Success:', message);
    }
}

// Initialize checkout when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new CheckoutPage();
});
