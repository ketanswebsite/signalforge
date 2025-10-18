/**
 * Checkout Page JavaScript - Multi-Step Wizard
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
        this.currentStep = 1;
        this.totalSteps = 3;
        this.cardholderName = '';
        this.testimonialIndex = 0;
        this.testimonialInterval = null;

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

            // Setup step navigation
            this.setupStepNavigation();

            // Start testimonial rotation
            this.startTestimonialRotation();

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
            const data = await response.json();

            if (!data.success || !data.data?.publishableKey) {
                throw new Error('Stripe not configured');
            }

            this.stripe = Stripe(data.data.publishableKey);

            // Create card element
            const elements = this.stripe.elements();
            this.cardElement = elements.create('card', {
                style: {
                    base: {
                        color: '#ffffff',
                        fontFamily: '"Work Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
                const cardGroup = document.getElementById('card-element').closest('.form-group');

                if (event.error) {
                    displayError.textContent = event.error.message;
                    cardGroup?.classList.remove('valid');
                    cardGroup?.classList.add('invalid');
                } else if (event.complete) {
                    displayError.textContent = '';
                    cardGroup?.classList.remove('invalid');
                    cardGroup?.classList.add('valid');
                } else {
                    displayError.textContent = '';
                    cardGroup?.classList.remove('valid', 'invalid');
                }
            });

        } catch (error) {
            console.error('Stripe initialization error:', error);
            this.showError('Payment system not available. Please contact support.');
        }
    }

    setupStepNavigation() {
        // Step 1 -> Step 2
        const step1Next = document.getElementById('step1-next');
        if (step1Next) {
            step1Next.addEventListener('click', () => {
                if (this.validateStep1()) {
                    this.goToStep(2);
                }
            });
        }

        // Step 2 -> Back to Step 1
        const step2Back = document.getElementById('step2-back');
        if (step2Back) {
            step2Back.addEventListener('click', () => {
                this.goToStep(1);
            });
        }

        // Step 2 -> Step 3
        const step2Next = document.getElementById('step2-next');
        if (step2Next) {
            step2Next.addEventListener('click', () => {
                if (this.validateStep2()) {
                    this.populateReviewStep();
                    this.goToStep(3);
                }
            });
        }

        // Step 3 -> Back to Step 2
        const step3Back = document.getElementById('step3-back');
        if (step3Back) {
            step3Back.addEventListener('click', () => {
                this.goToStep(2);
            });
        }

        // Final submit (Step 3)
        const submitButton = document.getElementById('submit-button');
        if (submitButton) {
            submitButton.addEventListener('click', async () => {
                await this.handlePayment();
            });
        }
    }

    goToStep(stepNumber) {
        // Validate step number
        if (stepNumber < 1 || stepNumber > this.totalSteps) return;

        // Get current and target steps
        const currentStepEl = document.getElementById(`step-${this.currentStep}`);
        const targetStepEl = document.getElementById(`step-${stepNumber}`);

        // Remove active class from current step
        currentStepEl?.classList.remove('active');

        // Add slide-out animation
        if (stepNumber > this.currentStep) {
            currentStepEl?.classList.add('slide-out-left');
        } else {
            currentStepEl?.classList.add('slide-out-right');
        }

        // Wait for animation, then show new step
        setTimeout(() => {
            currentStepEl?.classList.remove('slide-out-left', 'slide-out-right');
            targetStepEl?.classList.add('active');

            // Update current step
            this.currentStep = stepNumber;

            // Update progress indicator
            this.updateProgressIndicator();

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 400);
    }

    updateProgressIndicator() {
        const steps = document.querySelectorAll('.progress-step');

        steps.forEach((step, index) => {
            const stepNum = index + 1;

            if (stepNum < this.currentStep) {
                // Completed step
                step.classList.add('completed');
                step.classList.remove('active');
            } else if (stepNum === this.currentStep) {
                // Active step
                step.classList.add('active');
                step.classList.remove('completed');
            } else {
                // Future step
                step.classList.remove('active', 'completed');
            }
        });
    }

    validateStep1() {
        // Check if a billing period is selected
        const selectedPeriod = document.querySelector('.period-option.selected');

        if (!selectedPeriod) {
            this.showError('Please select a billing period');
            return false;
        }

        return true;
    }

    validateStep2() {
        // Validate cardholder name
        const cardholderNameInput = document.getElementById('card-holder-name');
        const cardholderName = cardholderNameInput?.value.trim();

        if (!cardholderName) {
            this.showError('Please enter cardholder name');
            cardholderNameInput?.focus();
            return false;
        }

        // Store cardholder name
        this.cardholderName = cardholderName;

        // Validate cardholder name format (at least 2 words)
        const nameParts = cardholderName.split(' ').filter(part => part.length > 0);
        if (nameParts.length < 2) {
            this.showError('Please enter your full name');
            cardholderNameInput?.focus();
            return false;
        }

        // Mark as valid
        const nameGroup = cardholderNameInput?.closest('.form-group');
        nameGroup?.classList.add('valid');
        nameGroup?.classList.remove('invalid');

        // Note: Stripe card validation is handled by Stripe Elements
        // We can't manually validate it here
        return true;
    }

    populateReviewStep() {
        // Populate selected plan
        const reviewPlan = document.getElementById('review-plan');
        if (reviewPlan && this.selectedPlan) {
            const currencySymbol = this.getCurrencySymbol(this.selectedPlan.currency);
            let price = 0;
            let periodText = '';

            switch (this.selectedPeriod) {
                case 'monthly':
                    price = parseFloat(this.selectedPlan.price_monthly) || 0;
                    periodText = 'Monthly';
                    break;
                case 'quarterly':
                    price = parseFloat(this.selectedPlan.price_quarterly) || 0;
                    periodText = 'Quarterly';
                    break;
                case 'annual':
                    price = parseFloat(this.selectedPlan.price_yearly) || 0;
                    periodText = 'Annual';
                    break;
            }

            reviewPlan.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${this.selectedPlan.plan_name}</strong><br>
                        <span style="color: var(--text-muted); font-size: 0.875rem;">${periodText} Billing</span>
                    </div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: var(--accent-gold); font-family: var(--font-mono);">
                        ${currencySymbol}${price.toFixed(2)}
                    </div>
                </div>
            `;
        }

        // Populate payment method preview
        const cardholderPreview = document.getElementById('cardholder-preview');
        if (cardholderPreview && this.cardholderName) {
            cardholderPreview.textContent = this.cardholderName;
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
                <div class="trial-info" style="margin-top: var(--spacing-md);">
                    <span class="material-icons">schedule</span>
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
            // Hide billing period selection for free plans
            const billingOptions = document.querySelector('.billing-period-options');
            if (billingOptions) {
                billingOptions.innerHTML = `
                    <div style="padding: var(--spacing-lg); text-align: center; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: var(--radius-lg);">
                        <span class="material-icons" style="font-size: 48px; color: var(--success); margin-bottom: var(--spacing-md);">check_circle</span>
                        <h3 style="color: var(--success); margin-bottom: var(--spacing-sm);">Free Trial</h3>
                        <p style="color: var(--text-secondary);">No payment required. Start your 90-day trial immediately.</p>
                    </div>
                `;
            }

            // Modify submit button for free trial
            const submitBtn = document.getElementById('submit-button');
            if (submitBtn) {
                submitBtn.innerHTML = `
                    <span class="btn-text">Start Free Trial</span>
                    <div class="loading-spinner"></div>
                `;
                submitBtn.onclick = () => this.startFreeTrial();
            }

            return;
        }

        const currencySymbol = this.getCurrencySymbol(plan.currency);
        const periods = [];

        const monthlyPrice = parseFloat(plan.price_monthly) || 0;
        const quarterlyPrice = parseFloat(plan.price_quarterly) || 0;
        const yearlyPrice = parseFloat(plan.price_yearly) || 0;

        if (monthlyPrice > 0) {
            periods.push({
                name: 'Monthly',
                value: 'monthly',
                price: monthlyPrice,
                display: `${currencySymbol}${monthlyPrice.toFixed(2)}/month`,
                details: 'Billed monthly. Cancel anytime.'
            });
        }

        if (quarterlyPrice > 0) {
            const monthlySavings = (monthlyPrice * 3) - quarterlyPrice;
            const percentSavings = Math.round((monthlySavings / (monthlyPrice * 3)) * 100);

            periods.push({
                name: 'Quarterly',
                value: 'quarterly',
                price: quarterlyPrice,
                display: `${currencySymbol}${quarterlyPrice.toFixed(2)}/quarter`,
                details: `Billed every 3 months. Effective ${currencySymbol}${(quarterlyPrice / 3).toFixed(2)}/month`,
                savings: percentSavings > 0 ? `Save ${percentSavings}%` : null
            });
        }

        if (yearlyPrice > 0) {
            const monthlySavings = (monthlyPrice * 12) - yearlyPrice;
            const percentSavings = Math.round((monthlySavings / (monthlyPrice * 12)) * 100);

            periods.push({
                name: 'Annual',
                value: 'annual',
                price: yearlyPrice,
                display: `${currencySymbol}${yearlyPrice.toFixed(2)}/year`,
                details: `Billed annually. Effective ${currencySymbol}${(yearlyPrice / 12).toFixed(2)}/month`,
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
    }

    setupEventListeners() {
        // Billing period selection
        document.addEventListener('click', (e) => {
            const periodOption = e.target.closest('.period-option');
            if (periodOption) {
                document.querySelectorAll('.period-option').forEach(opt => opt.classList.remove('selected'));
                periodOption.classList.add('selected');
                periodOption.querySelector('input').checked = true;
                this.selectedPeriod = periodOption.dataset.period;
                this.updateOrderSummary();
            }
        });

        // Discount code
        document.getElementById('apply-discount')?.addEventListener('click', () => {
            this.applyDiscountCode();
        });

        // Real-time validation for cardholder name
        const cardholderNameInput = document.getElementById('card-holder-name');
        if (cardholderNameInput) {
            cardholderNameInput.addEventListener('input', () => {
                const value = cardholderNameInput.value.trim();
                const group = cardholderNameInput.closest('.form-group');

                if (value.length >= 3) {
                    const nameParts = value.split(' ').filter(part => part.length > 0);
                    if (nameParts.length >= 2) {
                        group?.classList.add('valid');
                        group?.classList.remove('invalid');
                    } else {
                        group?.classList.remove('valid', 'invalid');
                    }
                } else {
                    group?.classList.remove('valid', 'invalid');
                }
            });
        }

        // Testimonial dots click
        document.querySelectorAll('.testimonial-dots .dot').forEach((dot, index) => {
            dot.addEventListener('click', () => {
                this.showTestimonial(index);
                this.resetTestimonialRotation();
            });
        });
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
                price = parseFloat(plan.price_monthly) || 0;
                break;
            case 'quarterly':
                price = parseFloat(plan.price_quarterly) || 0;
                break;
            case 'annual':
                price = parseFloat(plan.price_yearly) || 0;
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
        const submitBtn = document.getElementById('submit-button');
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');

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
            submitBtn.classList.remove('loading');
        }
    }

    async handlePayment() {
        const submitBtn = document.getElementById('submit-button');
        const cardholderName = this.cardholderName;

        if (!cardholderName) {
            this.showError('Please enter cardholder name');
            this.goToStep(2);
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
                data.data.clientSecret,
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
                window.location.href = `/checkout-success.html?subscription_id=${data.data.subscriptionId}`;
            }

        } catch (error) {
            console.error('Payment error:', error);
            this.showError(error.message || 'Payment failed. Please try again.');
            submitBtn.disabled = false;
            submitBtn.classList.remove('processing');
        }
    }

    // Testimonial rotation
    startTestimonialRotation() {
        this.testimonialInterval = setInterval(() => {
            this.showTestimonial((this.testimonialIndex + 1) % 3);
        }, 6000);
    }

    showTestimonial(index) {
        const items = document.querySelectorAll('.testimonial-item');
        const dots = document.querySelectorAll('.testimonial-dots .dot');

        items.forEach((item, i) => {
            if (i === index) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        dots.forEach((dot, i) => {
            if (i === index) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });

        this.testimonialIndex = index;
    }

    resetTestimonialRotation() {
        if (this.testimonialInterval) {
            clearInterval(this.testimonialInterval);
        }
        this.startTestimonialRotation();
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

    showError(message) {
        const errorDiv = document.getElementById('card-errors');
        if (errorDiv) {
            errorDiv.textContent = message;
        }

        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (errorDiv) {
                errorDiv.textContent = '';
            }
        }, 5000);
    }

    showSuccess(message) {
        // Show success message (could be enhanced with a proper notification system)
        console.log('Success:', message);
    }
}

// Initialize checkout when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new CheckoutPage();
});
