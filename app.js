/**
 * app.js - Modernized Logic
 * Auto-Date calculation for Jalali calendar, simplified results, exact year parsing.
 */

const PERSIAN_MONTHS = [
    { value: 1, name: "فروردین" }, { value: 2, name: "اردیبهشت" }, { value: 3, name: "خرداد" },
    { value: 4, name: "تیر" }, { value: 5, name: "مرداد" }, { value: 6, name: "شهریور" },
    { value: 7, name: "مهر" }, { value: 8, name: "آبان" }, { value: 9, name: "آذر" },
    { value: 10, name: "دی" }, { value: 11, name: "بهمن" }, { value: 12, name: "اسفند" }
];

const STORAGE_KEY = 'iran_delay_calculator_modern_state';
const DATA_URL = 'data/indices.json';

class NumberUtils {
    static toEnglishDigits(str) {
        if (!str) return '';
        const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        
        return str.split('').map(char => {
            let pIndex = persianNumbers.indexOf(char);
            if (pIndex >= 0) return pIndex;
            let aIndex = arabicNumbers.indexOf(char);
            if (aIndex >= 0) return aIndex;
            return char;
        }).join('');
    }

    static cleanNumber(str) {
        return str.replace(/[,٬]/g, '').trim();
    }

    static parseFloatStrict(str) {
        const cleaned = this.cleanNumber(this.toEnglishDigits(str));
        return parseFloat(cleaned);
    }

    // Numbers like amount (with comma separation)
    static formatCurrency(num) {
        if (num === null || isNaN(num)) return '';
        return new Intl.NumberFormat('fa-IR').format(num);
    }

    // Formats year numbers to Persian string WITHOUT thousands separators (e.g., 1405 instead of 1,405)
    static formatYear(year) {
        if (!year) return '';
        return new Intl.NumberFormat('fa-IR', { useGrouping: false }).format(year);
    }
}

class DateUtils {
    // Calculates the current Jalali Year and Month natively in the browser
    static getCurrentJalaliDate() {
        const date = new Date();
        // Requesting english digits to easily parse it, but based on Persian Calendar
        const dtf = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: 'numeric' });
        const parts = dtf.formatToParts(date);
        
        let year, month;
        for (const p of parts) {
            if (p.type === 'year') year = parseInt(p.value, 10);
            if (p.type === 'month') month = parseInt(p.value, 10);
        }
        return { year, month };
    }
}

class DataService {
    constructor() {
        this.indices = [];
        this.availableYears = [];
    }

    async loadIndices() {
        try {
            const response = await fetch(DATA_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            this.indices = await response.json();
            this.extractAvailableYears();
            return true;
        } catch (error) {
            console.error("Failed to load index data:", error);
            return false;
        }
    }

    extractAvailableYears() {
        const yearsSet = new Set(this.indices.map(item => item['سال']));
        // Sort descending (newest first)
        this.availableYears = Array.from(yearsSet).sort((a, b) => b - a);
    }

    getIndex(year, monthValue) {
        const yearData = this.indices.find(item => item['سال'] === year);
        if (!yearData) return null;

        const monthObj = PERSIAN_MONTHS.find(m => m.value === monthValue);
        if (!monthObj) return null;

        const indexValue = yearData[monthObj.name];
        if (indexValue === null || indexValue === undefined) return null;
        
        return indexValue;
    }
}

class Calculator {
    static compute(principal, startIndex, endIndex) {
        const multiplier = endIndex / startIndex;
        const delayAmount = principal * (multiplier - 1);
        const finalAmount = principal * multiplier;

        return {
            delayAmount: Math.round(delayAmount),
            finalAmount: Math.round(finalAmount)
        };
    }
}

class UIController {
    constructor() {
        this.dataService = new DataService();
        this.cacheDOM();
        this.bindEvents();
    }

    cacheDOM() {
        this.form = document.getElementById('calc-form');
        this.principalInput = document.getElementById('principal');
        this.startYearSelect = document.getElementById('start-year');
        this.startMonthSelect = document.getElementById('start-month');
        this.endYearSelect = document.getElementById('end-year');
        this.endMonthSelect = document.getElementById('end-month');
        this.btnClear = document.getElementById('btn-clear');
        this.btnCopy = document.getElementById('btn-copy');
        
        this.errorContainer = document.getElementById('error-container');
        this.resultCard = document.getElementById('result-card');
        this.calculatorCard = document.getElementById('calculator-card');
        this.loadingSpinner = document.getElementById('loading-spinner');

        this.resPrincipalAmount = document.getElementById('res-principal-amount');
        this.resDelayAmount = document.getElementById('res-delay-amount');
        this.resFinalAmount = document.getElementById('res-final-amount');
    }

    bindEvents() {
        this.form.addEventListener('submit', (e) => this.handleCalculate(e));
        this.btnClear.addEventListener('click', () => this.clearForm());
        this.btnCopy.addEventListener('click', () => this.copyResults());
        this.principalInput.addEventListener('input', (e) => this.formatPrincipalInput(e));
    }

    async init() {
        const success = await this.dataService.loadIndices();
        this.loadingSpinner.classList.add('d-none');
        
        if (!success) {
            this.showError("خطا در دریافت اطلاعات. لطفاً وضعیت اینترنت را بررسی کنید.");
            return;
        }

        this.calculatorCard.classList.remove('d-none');
        this.populateDropdowns();
        
        // Setup initial default End Date to Today (Jalali)
        this.setAutomaticEndDate();

        // Restore if user has saved data (overrides auto-date if they had a previous search)
        this.restoreState();
    }

    populateDropdowns() {
        const yearOptions = this.dataService.availableYears.map(year => 
            // Notice: Using NumberUtils.formatYear instead of formatCurrency to prevent comma separation
            `<option value="${year}">${NumberUtils.formatYear(year)}</option>`
        ).join('');
        
        this.startYearSelect.innerHTML += yearOptions;
        this.endYearSelect.innerHTML += yearOptions;

        const monthOptions = PERSIAN_MONTHS.map(m => 
            `<option value="${m.value}">${m.name}</option>`
        ).join('');
        
        this.startMonthSelect.innerHTML += monthOptions;
        this.endMonthSelect.innerHTML += monthOptions;
    }

    setAutomaticEndDate() {
        try {
            const today = DateUtils.getCurrentJalaliDate();
            
            // Check if current year exists in our JSON
            if (this.dataService.availableYears.includes(today.year)) {
                this.endYearSelect.value = today.year;
                this.endMonthSelect.value = today.month;
            }
        } catch (e) {
            console.warn("Could not automatically set Jalali date", e);
        }
    }

    formatPrincipalInput(e) {
        const rawValue = e.target.value;
        const number = NumberUtils.parseFloatStrict(rawValue);
        if (isNaN(number)) {
            e.target.value = '';
        } else {
            e.target.value = NumberUtils.formatCurrency(number);
        }
    }

    showError(message) {
        this.errorContainer.textContent = message;
        this.errorContainer.classList.remove('d-none');
        this.resultCard.classList.add('d-none');
    }

    hideError() {
        this.errorContainer.classList.add('d-none');
        this.errorContainer.textContent = '';
    }

    handleCalculate(e) {
        e.preventDefault();
        this.hideError();

        const principal = NumberUtils.parseFloatStrict(this.principalInput.value);
        const startYear = parseInt(this.startYearSelect.value, 10);
        const startMonth = parseInt(this.startMonthSelect.value, 10);
        const endYear = parseInt(this.endYearSelect.value, 10);
        const endMonth = parseInt(this.endMonthSelect.value, 10);

        if (!principal || principal <= 0) {
            return this.showError("لطفاً مبلغ معتبری برای اصل دین وارد کنید.");
        }
        if (!startYear || !startMonth || !endYear || !endMonth) {
            return this.showError("لطفاً تاریخ شروع و پایان را به درستی انتخاب کنید.");
        }

        const startIndex = this.dataService.getIndex(startYear, startMonth);
        const endIndex = this.dataService.getIndex(endYear, endMonth);

        if (startIndex === null) {
            const mName = PERSIAN_MONTHS.find(m=>m.value === startMonth).name;
            return this.showError(`شاخص تاریخ مبدأ (${mName} ${NumberUtils.formatYear(startYear)}) اعلام نشده است.`);
        }
        if (endIndex === null) {
            const mName = PERSIAN_MONTHS.find(m=>m.value === endMonth).name;
            return this.showError(`شاخص تاریخ مقصد (${mName} ${NumberUtils.formatYear(endYear)}) هنوز اعلام نشده است.`);
        }

        const results = Calculator.compute(principal, startIndex, endIndex);
        this.displayResults(principal, results);

        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            principal: this.principalInput.value,
            startYear, startMonth, endYear, endMonth
        }));
    }

    displayResults(principal, results) {
        // Only show 3 elements as requested
        this.resPrincipalAmount.textContent = NumberUtils.formatCurrency(principal) + ' ریال';
        this.resDelayAmount.textContent = NumberUtils.formatCurrency(results.delayAmount) + ' ریال';
        this.resFinalAmount.textContent = NumberUtils.formatCurrency(results.finalAmount) + ' ریال';

        this.resultCard.classList.remove('d-none');
        this.resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    clearForm() {
        this.form.reset();
        this.hideError();
        this.resultCard.classList.add('d-none');
        localStorage.removeItem(STORAGE_KEY);
        this.setAutomaticEndDate(); // Reset to today instead of blank
        this.principalInput.focus();
    }

    restoreState() {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            const state = JSON.parse(data);
            if (state.principal) this.principalInput.value = state.principal;
            if (state.startYear) this.startYearSelect.value = state.startYear;
            if (state.startMonth) this.startMonthSelect.value = state.startMonth;
            if (state.endYear) this.endYearSelect.value = state.endYear;
            if (state.endMonth) this.endMonthSelect.value = state.endMonth;
        }
    }

    async copyResults() {
        const textToCopy = `نتیجه محاسبه خسارت تأخیر تأدیه:
اصل دین: ${this.resPrincipalAmount.textContent}
تاریخ سررسید: ${this.startMonthSelect.options[this.startMonthSelect.selectedIndex].text} ${NumberUtils.formatYear(this.startYearSelect.value)}
تاریخ یوم‌الادا: ${this.endMonthSelect.options[this.endMonthSelect.selectedIndex].text} ${NumberUtils.formatYear(this.endYearSelect.value)}

خالص خسارت: ${this.resDelayAmount.textContent}
مجموع نهایی: ${this.resFinalAmount.textContent}`;

        try {
            await navigator.clipboard.writeText(textToCopy);
            
            const originalHTML = this.btnCopy.innerHTML;
            this.btnCopy.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-check-circle me-2" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/></svg> کپی شد!';
            this.btnCopy.classList.add('btn-copied', 'text-white');
            this.btnCopy.classList.remove('btn-outline-primary', 'custom-btn-outline');
            
            setTimeout(() => {
                this.btnCopy.innerHTML = originalHTML;
                this.btnCopy.classList.remove('btn-copied', 'text-white');
                this.btnCopy.classList.add('btn-outline-primary', 'custom-btn-outline');
            }, 2500);
        } catch (err) {
            alert('متأسفانه کپی در مرورگر شما پشتیبانی نمی‌شود.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new UIController();
    app.init();
});
